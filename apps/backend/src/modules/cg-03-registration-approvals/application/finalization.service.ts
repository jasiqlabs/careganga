import {
  BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,NotFoundException
} from "@nestjs/common";
import {randomUUID} from "node:crypto";
import type {Pool} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {ProtectedAccessOwnerService} from "../../cg-01-identity-access/application/protected-access-owner.service";
import {UUID} from "./proposal.service";

type EffectRow={id:string;realm_id:string;case_id:string;effect_key:string;
  final_decision_id:string;state:string;claim_token:string;attempt_count:number;
  next_retry_at:Date|null;claimed_until:Date|null};
type CaseScope={case_number:string;status:string;proposer_id:string;reviewer_id:string};
@Injectable()
export class ApprovalFinalizationService{
  constructor(@Inject(DATABASE)private readonly db:Pool,
    private readonly sessions:SessionService,
    private readonly owner:ProtectedAccessOwnerService){}

  /** The only application pathway after a truly committed FINAL_APPROVED step.
   * No background scan, external network hop, second owner ledger or worker.
   * Effect claims and CG-01 owner writes are separate short transactions.
   */
  async applyPending(effectKey:string):Promise<
    {status:"OWNER_COMPLETED"|"OWNER_BLOCKED"|"PENDING_OWNER"}>{
    if(!UUID.test(effectKey))throw new BadRequestException("Invalid approval reference");
    // Claim only one eligible real effect; expired unknown claims recover on
    // explicit invocation without a zero-work polling process.
    const claim=await this.db.query<EffectRow>(`
      UPDATE cg03_finalization SET
        state='APPLYING',claim_token=gen_random_uuid(),
        claimed_until=now()+interval '90 seconds',
        attempt_count=attempt_count+1,updated_at=now()
      WHERE effect_key=$1 AND attempt_count<12 AND
        (state='PENDING_OWNER'
          OR (state='OWNER_FAILED_RETRYABLE' AND next_retry_at<=now())
          OR (state='APPLYING' AND claimed_until<now()))
      RETURNING id,realm_id,case_id,effect_key,final_decision_id,
        state,claim_token,attempt_count,next_retry_at,claimed_until
    `,[effectKey]);
    const item=claim.rows[0];
    if(!item){
      const state=await this.db.query<{state:string}>(`
        SELECT state FROM cg03_finalization WHERE effect_key=$1
      `,[effectKey]);
      return {status:state.rows[0]?.state==="OWNER_COMPLETED"?"OWNER_COMPLETED":
        state.rows[0]?.state==="OWNER_BLOCKED"?"OWNER_BLOCKED":"PENDING_OWNER"};
    }
    let result:"CONFIRMED"|"SOURCE_CHANGED"|"UNKNOWN"="UNKNOWN";
    try{
      // Lost post-commit result is resolved from the original CG-01 effect key.
      const old=await this.owner.protectedEffectOutcome(effectKey);
      if(old.state==="CONFIRMED")result="CONFIRMED";
      else{
        const done=await this.owner.applyApprovedAccessChange(effectKey,item.claim_token);
        result=done.state==="UNVERIFIED"?"UNKNOWN":done.state;
      }
    }catch{/* Keep exact original key for reconciliation. Never assert success. */}
    // A crash or claim timeout between CG-01 commit and this final update
    // leaves the owner ledger authoritative. A later same-key retry will repair it.
    const state=result==="CONFIRMED"?"OWNER_COMPLETED":
      result==="SOURCE_CHANGED"?"OWNER_BLOCKED":"OWNER_FAILED_RETRYABLE";
    const client=await this.db.connect();let tx=false;
    try{
      await client.query("BEGIN");tx=true;
      const changed=await client.query<{id:string;case_id:string;realm_id:string}>(`
        UPDATE cg03_finalization SET state=$3,
          last_result_class=$4,next_retry_at=CASE
            WHEN $3='OWNER_FAILED_RETRYABLE' AND attempt_count<12
            THEN now()+make_interval(secs=>LEAST(1800,
              (60*power(2,LEAST(attempt_count,5)))::integer))
            ELSE NULL END,
          claim_token=NULL,claimed_until=NULL,updated_at=now()
        WHERE id=$1 AND claim_token=$2 AND state='APPLYING'
        RETURNING id,case_id,realm_id
      `,[item.id,item.claim_token,state,
        result==="CONFIRMED"?"CONFIRMED":
        result==="SOURCE_CHANGED"?"SOURCE_CHANGED":"UNKNOWN"]);
      if(!changed.rowCount){
        await client.query("ROLLBACK");tx=false;
        return {status:"PENDING_OWNER"};
      }
      if(result!=="UNKNOWN"){
        const updated=await client.query<{id:string;proposer_id:string}>(`
          UPDATE cg03_case SET status=$3,revision=revision+1,updated_at=now()
          WHERE id=$1 AND realm_id=$2 AND status='PENDING_OWNER'
          RETURNING id,proposer_id
        `,[item.case_id,item.realm_id,state]);
        if(!updated.rowCount){
          // A mismatch is not proof of an owner effect. Leave the committed
          // CG-01 ledger as truth and allow a later bounded source reconcile.
          await client.query("ROLLBACK");tx=false;
          return {status:"PENDING_OWNER"};
        }
        const actor=await client.query<{actor_id:string}>(`
          SELECT actor_id FROM cg03_case_decision WHERE id=$1 AND case_id=$2
        `,[item.final_decision_id,item.case_id]);
        if(!actor.rowCount)throw new Error("Missing original reviewer");
        await client.query(`
          INSERT INTO cg03_case_event(realm_id,case_id,actor_id,action,
            step_ordinal,safe_remarks,correlation_ref)
          SELECT $1,$2,$3,$4,
            (SELECT max(ordinal) FROM cg03_process_step
              WHERE process_id=c.process_id),'', $5
          FROM cg03_case c WHERE c.id=$2 AND c.realm_id=$1
        `,[item.realm_id,item.case_id,actor.rows[0].actor_id,state,randomUUID()]);
      }
      await client.query("COMMIT");tx=false;
      return {status:result==="CONFIRMED"?"OWNER_COMPLETED":
        result==="SOURCE_CHANGED"?"OWNER_BLOCKED":"PENDING_OWNER"};
    }catch{
      if(tx){try{await client.query("ROLLBACK");}catch{}}
      return {status:"PENDING_OWNER"};
    }finally{client.release();}
  }

  private async authorizedCase(bearer:string,caseRef:string){
    if(!UUID.test(caseRef))throw new BadRequestException("Choose an application");
    const actor=await this.sessions.verifySession(bearer);
    const rows=await this.db.query<CaseScope>(`
      SELECT c.case_number,c.status,c.proposer_id,d.actor_id reviewer_id
      FROM cg03_case c JOIN cg03_finalization f ON f.case_id=c.id
      JOIN cg03_case_decision d ON d.id=f.final_decision_id
      WHERE c.id=$1 AND c.realm_id=$2
    `,[caseRef,actor.realmId]);
    if(!rows.rowCount)throw new NotFoundException("Application unavailable");
    const row=rows.rows[0];
    if(actor.accountId!==row.proposer_id&&actor.accountId!==row.reviewer_id){
      await this.sessions.requireAction(bearer,"approvals.review");
    }else{
      try{await this.sessions.requireAction(bearer,"approvals.view");}
      catch(e){
        if(!(e instanceof ForbiddenException))throw e;
        await this.sessions.requireAction(bearer,"approvals.propose");
      }
    }
    return {actor,row};
  }
  async status(bearer:string,caseRef:string){
    const {actor}=await this.authorizedCase(bearer,caseRef);
    const rows=await this.db.query<{state:string;attempt_count:number;
      next_retry_at:Date|null;claimed_until:Date|null}>(`
      SELECT f.state,f.attempt_count,f.next_retry_at,f.claimed_until FROM cg03_finalization f
      JOIN cg03_case c ON c.id=f.case_id AND c.realm_id=f.realm_id
      WHERE c.id=$1 AND c.realm_id=$2
    `,[caseRef,actor.realmId]);
    const state=rows.rows[0];
    const status=state?.state==="OWNER_COMPLETED"?"OWNER_COMPLETED":
      state?.state==="OWNER_BLOCKED"?"OWNER_BLOCKED":"PENDING_OWNER";
    return {status,attempts:state?.attempt_count??0,
      canRetry:!!state&&state.attempt_count<12&&
        (state.state==="PENDING_OWNER"||
          state.state==="OWNER_FAILED_RETRYABLE"&&
          !!state.next_retry_at&&state.next_retry_at<=new Date()||
          state.state==="APPLYING"&&!!state.claimed_until&&
            state.claimed_until<=new Date())};
  }
  async retry(bearer:string,caseRef:string){
    const {actor,row}=await this.authorizedCase(bearer,caseRef);
    if(row.reviewer_id!==actor.accountId)
      throw new ForbiddenException("Only the original final reviewer can retry verification");
    await this.sessions.requireAction(bearer,"approvals.review");
    const effect=await this.db.query<{effect_key:string}>(`
      SELECT f.effect_key FROM cg03_finalization f
      JOIN cg03_case c ON c.id=f.case_id AND c.realm_id=f.realm_id
      WHERE c.id=$1 AND c.realm_id=$2 AND f.state IN(
        'PENDING_OWNER','OWNER_FAILED_RETRYABLE','APPLYING')
    `,[caseRef,actor.realmId]);
    if(!effect.rowCount)throw new ConflictException({code:"APPROVAL_FINALIZATION_NOT_PENDING"});
    return this.applyPending(effect.rows[0].effect_key);
  }
}
