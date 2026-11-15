import {
  BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,NotFoundException
} from "@nestjs/common";
import type {Pool} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {ProtectedAccessOwnerService} from "../../cg-01-identity-access/application/protected-access-owner.service";
import {UUID,hash} from "./proposal.service";

type CaseRow={id:string;realm_id:string;case_number:string;proposer_id:string;
  process_id:string;status:string;revision:number;current_step:number};
type StepRow={ordinal:number;capability_key:"roles.assign"|"approvals.review";
  protected_root_required:boolean};
type DecisionRow={actor_id:string;request_digest:string;action:string;
  accepted_case_revision:number};
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
    private readonly owner:ProtectedAccessOwnerService){}

  async decide(bearer:string,caseInput:unknown,payload:unknown,correlationRef:string){
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
        SELECT id,realm_id,case_number,proposer_id,process_id,status,revision,current_step
        FROM cg03_case WHERE realm_id=$1 AND id=$2 FOR UPDATE
      `,[actor.realmId,caseInput]);
      const row=result.rows[0];
      if(!row)throw new NotFoundException("Application unavailable");
      if(row.proposer_id===actor.accountId)
        throw new ForbiddenException("You cannot approve your own request");
      const prior=await client.query<DecisionRow>(`
        SELECT actor_id,request_digest,action,accepted_case_revision
        FROM cg03_case_decision WHERE case_id=$1 AND request_key=$2 FOR SHARE
      `,[row.id,body.requestKey]);
      if(prior.rowCount){
        const previous=prior.rows[0];
        if(previous.actor_id!==actor.accountId||previous.request_digest!==digest)
          throw new ConflictException({code:"APPROVAL_REPLAY_CONFLICT"});
        // Still check live step authority for a replay; no replay mutation.
        try{await this.sessions.requireAction(bearer,"approvals.view");}
        catch(error){
          if(!(error instanceof ForbiddenException))throw error;
          await this.sessions.requireAction(bearer,"roles.assign");
        }
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
        expected.protected_root_required?"FINAL_APPROVED":"IN_REVIEW";
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
          expected_case_revision,accepted_case_revision,request_key,request_digest,safe_remarks)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id
      `,[actor.realmId,row.id,actor.accountId,body.action,row.current_step,
        row.revision,saved.rows[0].revision,body.requestKey,digest,body.remarks]);
      const event=body.action==="RETURN"?"RETURNED":
        body.action==="REJECT"?"REJECTED":
        state==="FINAL_APPROVED"?"FINAL_APPROVED":
        body.action==="FORWARD"?"FORWARDED":"APPROVED";
      await client.query(`
        INSERT INTO cg03_case_event(realm_id,case_id,actor_id,action,step_ordinal,
          safe_remarks,correlation_ref) VALUES($1,$2,$3,$4,$5,$6,$7)
      `,[actor.realmId,row.id,actor.accountId,event,row.current_step,
        body.remarks,correlationRef]);
      await client.query("COMMIT");active=false;
      return {status:state,caseNumber:row.case_number,revision:saved.rows[0].revision,
        decisionRecorded:true,sourceEffect:"NOT_APPLICABLE_UNTIL_FINALIZATION"};
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
    const rows=await this.db.query<{accepted_case_revision:number;action:string}>(`
      SELECT d.accepted_case_revision,d.action
      FROM cg03_case_decision d
      JOIN cg03_case c ON c.id=d.case_id AND c.realm_id=d.realm_id
      WHERE c.realm_id=$1 AND c.id=$2 AND d.actor_id=$3 AND d.request_key=$4
    `,[actor.realmId,caseInput,actor.accountId,keyInput]);
    if(!rows.rowCount)return {status:"NOT_FOUND",revision:null};
    // Only the current, active reviewer can confirm their own protected action.
    try{await this.sessions.requireAction(bearer,"approvals.view");}
    catch(error){
      if(!(error instanceof ForbiddenException))throw error;
      await this.sessions.requireAction(bearer,"roles.assign");
    }
    return {status:"CONFIRMED",revision:rows.rows[0].accepted_case_revision,
      action:rows.rows[0].action};
  }
}
