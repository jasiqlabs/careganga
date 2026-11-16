import {
  BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,NotFoundException
} from "@nestjs/common";
import type {Pool} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {ProtectedAccessOwnerService} from "../../cg-01-identity-access/application/protected-access-owner.service";
import {UUID,hash} from "./proposal.service";
import {ApprovalFinalizationService} from "./finalization.service";

type CaseRow={id:string;realm_id:string;case_number:string;proposer_id:string;
  process_id:string;status:string;revision:number;current_step:number;
  proposal_digest:string};
type StepRow={ordinal:number;capability_key:"roles.assign"|"approvals.review";
  protected_root_required:boolean};
type DecisionRow={actor_id:string;request_digest:string;action:string;
  accepted_case_revision:number;capability_key:"roles.assign"|"approvals.review";
  protected_root_required:boolean};
function inputRecord(value:unknown){
  if(!value||typeof value!=="object"||Array.isArray(value))
    throw new BadRequestException("Check your approval decision");
  const body=value as Record<string,unknown>;
  if(Object.keys(body).some(k=>!["action","remarks","expectedRevision","requestKey","totp"].includes(k)))
    throw new BadRequestException("Unsupported approval action");
  if(!["APPROVE","RETURN","REJECT","FORWARD"].includes(String(body.action))||
    !Number.isSafeInteger(body.expectedRevision)||Number(body.expectedRevision)<1||
    typeof body.requestKey!=="string"||!UUID.test(body.requestKey)||
    typeof body.remarks!=="string"||body.remarks.length>500||
    typeof body.totp!=="string"||body.totp.length>6)
    throw new BadRequestException("Check decision, current revision and remarks");
  if(/[\u0000-\u001f\u007f]/.test(body.remarks))
    throw new BadRequestException("Remove unsupported characters from remarks");
  return {action:body.action as "APPROVE"|"RETURN"|"REJECT"|"FORWARD",
    remarks:body.remarks.trim(),expectedRevision:Number(body.expectedRevision),
    requestKey:body.requestKey,totp:body.totp};
}
@Injectable()
export class ApprovalDecisionService{
  constructor(@Inject(DATABASE)private readonly db:Pool,
    private readonly sessions:SessionService,
    private readonly owner:ProtectedAccessOwnerService,
    private readonly finalizer:ApprovalFinalizationService){}

  async decide(bearer:string,caseInput:unknown,payload:unknown,correlationRef:string){
    const committed=await this.decideCommitted(bearer,caseInput,payload,correlationRef);
    if("effectKey" in committed&&typeof committed.effectKey==="string"){
      const {effectKey,...safe}=committed;
      let result:"PENDING_OWNER"|"OWNER_COMPLETED"|"OWNER_BLOCKED"="PENDING_OWNER";
      try{result=(await this.finalizer.applyPending(effectKey)).status;}
      catch{/* The immutable pending owner effect is still authoritative. */}
      return {...safe,status:result,sourceEffect:result};
    }
    return committed;
  }
  private async decideCommitted(bearer:string,caseInput:unknown,payload:unknown,
    correlationRef:string){
    if(typeof caseInput!=="string"||!UUID.test(caseInput))
      throw new BadRequestException("Choose a valid application");
    const body=inputRecord(payload);
    const actor=await this.sessions.verifySession(bearer);
    if(actor.accountId===caseInput)throw new ForbiddenException();
    const digest=hash([body.action,body.remarks,body.expectedRevision]);
    const client=await this.db.connect();let active=false;
    try{
      await client.query("BEGIN");active=true;
      const result=await client.query<CaseRow>(`
        SELECT id,realm_id,case_number,proposer_id,process_id,status,revision,
          current_step,proposal_digest FROM cg03_case WHERE realm_id=$1 AND id=$2 FOR UPDATE
      `,[actor.realmId,caseInput]);
      const row=result.rows[0];
      if(!row)throw new NotFoundException("Application unavailable");
      if(row.proposer_id===actor.accountId)
        throw new ForbiddenException("You cannot approve your own request");
      const prior=await client.query<DecisionRow>(`
        SELECT d.actor_id,d.request_digest,d.action,d.accepted_case_revision,
          step.capability_key,step.protected_root_required
        FROM cg03_case_decision d
        JOIN cg03_process_step step ON step.process_id=$3
          AND step.ordinal=d.step_ordinal
        WHERE d.case_id=$1 AND d.request_key=$2
        FOR SHARE OF d,step
      `,[row.id,body.requestKey,row.process_id]);
      if(prior.rowCount){
        const previous=prior.rows[0];
        if(previous.actor_id!==actor.accountId||previous.request_digest!==digest)
          throw new ConflictException({code:"APPROVAL_REPLAY_CONFLICT"});
        // Replay must check the original step authority, not just generic
        // view access. A revoked reviewer may not confirm a protected decision.
        await this.sessions.requireAction(bearer,previous.capability_key);
        await this.owner.verifyReviewer(client,actor,previous.capability_key,
          previous.protected_root_required);
        await client.query("COMMIT");active=false;
        return {status:"PREVIOUSLY_CONFIRMED",caseNumber:row.case_number,
          currentStatus:row.status,revision:row.revision};
      }
      if(!["SUBMITTED","IN_REVIEW"].includes(row.status)||
        row.revision!==body.expectedRevision)
        throw new ConflictException({code:"APPROVAL_STALE"});
      const step=await client.query<StepRow>(`
        SELECT ordinal,capability_key,protected_root_required FROM cg03_process_step
        WHERE process_id=$1 AND ordinal=$2 FOR SHARE
      `,[row.process_id,row.current_step]);
      const expected=step.rows[0];
      if(!expected)throw new ConflictException({code:"APPROVAL_ROUTE_UNAVAILABLE"});
      if(expected.protected_root_required&&body.action==="FORWARD")
        throw new BadRequestException("Final reviewers must decide, return or reject");
      // Only the frozen, actual CG-01 capability may be used; never trust UI grants.
      await this.sessions.requireAction(bearer,expected.capability_key);
      await this.owner.verifyReviewer(client,actor,expected.capability_key,
        expected.protected_root_required);
      if(expected.protected_root_required){
        if(!/^[0-9]{6}$/.test(body.totp))
          throw new BadRequestException("Final decision requires fresh authenticator proof");
        // Failed proofs are rate-limited outside the current write rollback.
        await this.sessions.limitFoundationRootProof(actor);
        // One-use CG-01 TOTP counter is updated in the same short transaction.
        await this.sessions.requireFreshFoundationRootProof(client,actor,body.totp);
      }
      const state=body.action==="RETURN"?"RETURNED":
        body.action==="REJECT"?"REJECTED":
        expected.protected_root_required?"PENDING_OWNER":"IN_REVIEW";
      const nextStep=state==="IN_REVIEW"?row.current_step+1:row.current_step;
      const saved=await client.query<{revision:number}>(`
        UPDATE cg03_case
        SET status=$3,current_step=$4,revision=revision+1,updated_at=now()
        WHERE id=$1 AND realm_id=$2 AND revision=$5
        RETURNING revision
      `,[row.id,actor.realmId,state,nextStep,row.revision]);
      if(!saved.rowCount)throw new ConflictException({code:"APPROVAL_STALE"});
      const decision=await client.query<{id:string}>(`
        INSERT INTO cg03_case_decision(realm_id,case_id,actor_id,action,step_ordinal,
          expected_case_revision,accepted_case_revision,request_key,request_digest,
          safe_remarks,fresh_mfa_verified_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
          CASE WHEN $11::boolean THEN now() ELSE NULL END) RETURNING id
      `,[actor.realmId,row.id,actor.accountId,body.action,row.current_step,
        row.revision,saved.rows[0].revision,body.requestKey,digest,body.remarks,
        expected.protected_root_required]);
      const event=body.action==="RETURN"?"RETURNED":
        body.action==="REJECT"?"REJECTED":
        state==="PENDING_OWNER"?"FINAL_APPROVED":
        body.action==="FORWARD"?"FORWARDED":"APPROVED";
      await client.query(`
        INSERT INTO cg03_case_event(realm_id,case_id,actor_id,action,step_ordinal,
          safe_remarks,correlation_ref) VALUES($1,$2,$3,$4,$5,$6,$7)
      `,[actor.realmId,row.id,actor.accountId,event,row.current_step,
        body.remarks,correlationRef]);
      let effectKey:string|undefined;
      if(state==="PENDING_OWNER"){
        const effect=await client.query<{effect_key:string}>(`
          INSERT INTO cg03_finalization(realm_id,case_id,final_decision_id,proposal_digest)
          VALUES($1,$2,$3,$4) RETURNING effect_key
        `,[actor.realmId,row.id,decision.rows[0].id,row.proposal_digest]);
        effectKey=effect.rows[0].effect_key;
        await client.query(`
          INSERT INTO cg03_case_event(realm_id,case_id,actor_id,action,step_ordinal,
            correlation_ref) VALUES($1,$2,$3,'PENDING_OWNER',$4,$5)
        `,[actor.realmId,row.id,actor.accountId,row.current_step,correlationRef]);
      }
      // CG-03 owns the original immutable decision. PostgreSQL NOTIFY is
      // delivered only upon commit; CG-19's bounded replay cursor recovers
      // missed notifications after process restarts (hint is not evidence).
      await client.query("SELECT pg_notify('cg19_decision_committed',$1)",[
        actor.realmId
      ]);
      await client.query("COMMIT");active=false;
      return {status:state,caseNumber:row.case_number,revision:saved.rows[0].revision,
        decisionRecorded:true,sourceEffect:state==="PENDING_OWNER"?"PENDING_OWNER":"NOT_APPLICABLE",
        effectKey};
    }catch(e){
      if(active)try{await client.query("ROLLBACK");}catch{}
      if(e&&typeof e==="object"&&"code" in e&&e.code==="23505")
        throw new ConflictException({code:"APPROVAL_STALE"});
      throw e;
    }finally{client.release();}
  }
  async lookup(bearer:string,caseInput:unknown,keyInput:unknown){
    const actor=await this.sessions.verifySession(bearer);
    if(typeof caseInput!=="string"||!UUID.test(caseInput)||
       typeof keyInput!=="string"||!UUID.test(keyInput))
      throw new BadRequestException("Invalid previous decision");
    const rows=await this.db.query<{
      accepted_case_revision:number;action:string;
      capability_key:"roles.assign"|"approvals.review"
    }>(`
      SELECT d.accepted_case_revision,d.action,step.capability_key
      FROM cg03_case_decision d
      JOIN cg03_case c ON c.id=d.case_id AND c.realm_id=d.realm_id
      JOIN cg03_process_step step ON step.process_id=c.process_id
        AND step.ordinal=d.step_ordinal
      WHERE c.realm_id=$1 AND c.id=$2 AND d.actor_id=$3 AND d.request_key=$4
    `,[actor.realmId,caseInput,actor.accountId,keyInput]);
    if(!rows.rowCount)return {status:"NOT_FOUND",revision:null};
    // Match the exact original reviewer step; generic read rights are not
    // sufficient once the previous decision authority is revoked.
    await this.sessions.requireAction(bearer,rows.rows[0].capability_key);
    return {status:"CONFIRMED",revision:rows.rows[0].accepted_case_revision,
      action:rows.rows[0].action};
  }
}
