import {
  BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,NotFoundException
} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {ProtectedAccessOwnerService} from "../../cg-01-identity-access/application/protected-access-owner.service";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";

export const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export const hash=(value:unknown)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
type ProcessRow={id:string;version:number;first_reviewer_capability:string|null};
type CaseRow={id:string;case_number:string;proposer_id:string;target_account_id:string;
  target_role_id:string;account_name_snapshot:string;role_name_snapshot:string;
  process_version:number;proposal_revision:number;proposal_digest:string;request_digest:string;
  request_key:string;expected_access_version:string;expected_role_revision:number;
  status:string;current_step:number;revision:number;submitted_at:Date;previous_case_id:string|null};
type ProposalInput={targetAccountRef:unknown;targetRoleRef:unknown;requestKey:unknown;
  previousCaseRef?:unknown};
function checkInput(value:unknown,keys:readonly string[]):Record<string,unknown>{
  if(!value||typeof value!=="object"||Array.isArray(value))
    throw new BadRequestException("Check the protected access request");
  const v=value as Record<string,unknown>;
  if(Object.keys(v).some(k=>!keys.includes(k)))
    throw new BadRequestException("This request type is not supported");
  return v;
}
function requireUuid(value:unknown):string{
  if(typeof value!=="string"||!UUID.test(value))
    throw new BadRequestException("Choose an available account or role");
  return value;
}
function view(row:CaseRow){
  return {caseRef:row.id,reference:row.case_number,
    accountName:row.account_name_snapshot,roleName:row.role_name_snapshot,
    status:row.status,revision:row.revision,proposalRevision:row.proposal_revision,
    processVersion:row.process_version,currentStep:row.current_step,
    sourceAccountAccessRevision:row.expected_access_version,
    sourceRoleRevision:row.expected_role_revision,
    submittedAt:row.submitted_at.toISOString(),previousCaseRef:row.previous_case_id};
}
@Injectable()
export class ApprovalProposalService{
  constructor(@Inject(DATABASE)private readonly db:Pool,
    private readonly sessions:SessionService,
    private readonly owner:ProtectedAccessOwnerService){}

  private async current(client:PoolClient,actor:VerifiedFoundationActor):Promise<ProcessRow>{
    const existing=await client.query<ProcessRow>(`
      SELECT p.id,p.version,p.first_reviewer_capability
      FROM cg03_process_current cur JOIN cg03_process p ON p.id=cur.process_id
      WHERE cur.realm_id=$1
    `,[actor.realmId]);
    if(existing.rowCount)return existing.rows[0];
    // The Foundation realm may be bootstrapped after SQL migrations run.
    // First actual authorized proposal creates only this current, usable route.
    const inserted=await client.query<ProcessRow>(`
      INSERT INTO cg03_process(realm_id,version,first_reviewer_capability,configured_by)
      VALUES($1,1,NULL,$2)
      RETURNING id,version,first_reviewer_capability
    `,[actor.realmId,actor.accountId]);
    const process=inserted.rows[0];
    await client.query(`
      INSERT INTO cg03_process_step(process_id,ordinal,capability_key,protected_root_required)
      VALUES($1,1,'approvals.review',true)
    `,[process.id]);
    await client.query(`
      INSERT INTO cg03_process_current(realm_id,process_id) VALUES($1,$2)
    `,[actor.realmId,process.id]);
    return process;
  }
  private async readActor(bearer:string):Promise<{
    actor:VerifiedFoundationActor;root:boolean;reviewer:boolean
  }>{
    let actor:VerifiedFoundationActor;
    try{actor=await this.sessions.requireAction(bearer,"approvals.view");}
    catch(error){
      if(!(error instanceof ForbiddenException))throw error;
      try{actor=await this.sessions.requireAction(bearer,"approvals.propose");}
      catch(next){
        if(!(next instanceof ForbiddenException))throw next;
        actor=await this.sessions.requireAction(bearer,"roles.assign");
      }
    }
    let root=false,reviewer=false;
    try{await this.sessions.requireAction(bearer,"approvals.review");root=true;}
    catch(error){if(!(error instanceof ForbiddenException))throw error;}
    try{await this.sessions.requireAction(bearer,"roles.assign");reviewer=true;}
    catch(error){if(!(error instanceof ForbiddenException))throw error;}
    return {actor,root,reviewer};
  }
  async options(bearer:string,kind:unknown,search:unknown){
    return this.owner.options(bearer,kind,search??"");
  }
  async process(bearer:string){
    const {actor}=await this.readActor(bearer);
    const q=await this.db.query<ProcessRow>(`
      SELECT p.id,p.version,p.first_reviewer_capability
      FROM cg03_process_current cur JOIN cg03_process p ON p.id=cur.process_id
      WHERE cur.realm_id=$1
    `,[actor.realmId]);
    return {active:Boolean(q.rowCount),version:q.rows[0]?.version??0,
      firstReviewer:q.rows[0]?.first_reviewer_capability==="roles.assign"?
        "Permitted access manager":null,
      finalReviewer:"A different Foundation Super Admin",
      requiresFreshAuthenticator:true,
      message:q.rowCount?"Protected access route is configured":
        "The protected route is initialized with the first eligible submission"};
  }
  async processLookup(bearer:string,requestKeyInput:unknown){
    const actor=await this.sessions.requireAction(bearer,"approvals.process.manage");
    const requestKey=requireUuid(requestKeyInput);
    const rows=await this.db.query<{version:number}>(`
      SELECT p.version FROM cg03_process_command c
      JOIN cg03_process p ON p.id=c.process_id AND p.realm_id=c.realm_id
      WHERE c.realm_id=$1 AND c.actor_id=$2 AND c.request_key=$3
    `,[actor.realmId,actor.accountId,requestKey]);
    return rows.rowCount?{status:"CONFIRMED",version:rows.rows[0].version}:
      {status:"NOT_FOUND",version:null};
  }
  async newProcessVersion(bearer:string,body:unknown){
    const payload=checkInput(body,["firstReviewerCapability","requestKey","totp"]);
    if(payload.firstReviewerCapability!==null&&payload.firstReviewerCapability!=="roles.assign")
      throw new BadRequestException("Choose a supported reviewer step");
    const requestKey=requireUuid(payload.requestKey);
    if(typeof payload.totp!=="string"||!/^[0-9]{6}$/.test(payload.totp))
      throw new BadRequestException("Enter a fresh authenticator code");
    const actor=await this.sessions.requireAction(bearer,"approvals.process.manage");
    const digest=hash([payload.firstReviewerCapability]);
    const original=await this.db.query<{request_digest:string;version:number}>(`
      SELECT cmd.request_digest,p.version FROM cg03_process_command cmd
      JOIN cg03_process p ON p.id=cmd.process_id
      WHERE cmd.realm_id=$1 AND cmd.actor_id=$2 AND cmd.request_key=$3
    `,[actor.realmId,actor.accountId,requestKey]);
    if(original.rowCount){
      if(original.rows[0].request_digest!==digest)
        throw new ConflictException({code:"APPROVAL_REPLAY_CONFLICT"});
      return {version:original.rows[0].version,status:"PREVIOUSLY_CONFIRMED"};
    }
    await this.sessions.limitFoundationRootProof(actor);
    const client=await this.db.connect();
    let active=false;
    try{
      await client.query("BEGIN");active=true;
      const realm=await client.query(`
        SELECT 1 FROM access_realm WHERE id=$1 AND realm_key='FOUNDATION_ROOT' FOR UPDATE
      `,[actor.realmId]);
      if(!realm.rowCount)throw new ForbiddenException("Foundation scope unavailable");
      const replay=await client.query<{request_digest:string;version:number}>(`
        SELECT cmd.request_digest,p.version FROM cg03_process_command cmd
        JOIN cg03_process p ON p.id=cmd.process_id
        WHERE cmd.realm_id=$1 AND cmd.actor_id=$2 AND cmd.request_key=$3
      `,[actor.realmId,actor.accountId,requestKey]);
      if(replay.rowCount){
        if(replay.rows[0].request_digest!==digest)
          throw new ConflictException({code:"APPROVAL_REPLAY_CONFLICT"});
        await client.query("COMMIT");active=false;
        return {version:replay.rows[0].version,status:"PREVIOUSLY_CONFIRMED"};
      }
      await this.sessions.requireFreshFoundationRootProof(client,actor,payload.totp);
      // A new Foundation with no process may explicitly choose the secure
      // Super-Admin-only default. Record that first version as a real command;
      // changing an existing process to its own version remains a no-op error.
      const hadRoute=await client.query(`
        SELECT 1 FROM cg03_process_current WHERE realm_id=$1
      `,[actor.realmId]);
      const current=await this.current(client,actor);
      if(current.first_reviewer_capability===payload.firstReviewerCapability){
        if(hadRoute.rowCount)throw new BadRequestException("Choose a different reviewer route");
        await client.query(`
          INSERT INTO cg03_process_command(realm_id,actor_id,request_key,request_digest,process_id)
          VALUES($1,$2,$3,$4,$5)
        `,[actor.realmId,actor.accountId,requestKey,digest,current.id]);
        await client.query("COMMIT");active=false;
        return {version:current.version,status:"CONFIRMED"};
      }
      const process=await client.query<ProcessRow>(`
        INSERT INTO cg03_process(realm_id,version,first_reviewer_capability,configured_by)
        VALUES($1,$2,$3,$4) RETURNING id,version,first_reviewer_capability
      `,[actor.realmId,current.version+1,payload.firstReviewerCapability,actor.accountId]);
      const newRoute=process.rows[0];
      if(newRoute.first_reviewer_capability){
        await client.query(`
          INSERT INTO cg03_process_step(process_id,ordinal,capability_key,protected_root_required)
          VALUES($1,1,'roles.assign',false),($1,2,'approvals.review',true)
        `,[newRoute.id]);
      }else{
        await client.query(`
          INSERT INTO cg03_process_step(process_id,ordinal,capability_key,protected_root_required)
          VALUES($1,1,'approvals.review',true)
        `,[newRoute.id]);
      }
      await client.query(`
        UPDATE cg03_process_current SET process_id=$2,updated_at=now()
        WHERE realm_id=$1
      `,[actor.realmId,newRoute.id]);
      await client.query(`
        INSERT INTO cg03_process_command(realm_id,actor_id,request_key,request_digest,process_id)
        VALUES($1,$2,$3,$4,$5)
      `,[actor.realmId,actor.accountId,requestKey,digest,newRoute.id]);
      await client.query("COMMIT");active=false;
      return {version:newRoute.version,status:"CONFIRMED"};
    }catch(e){if(active)try{await client.query("ROLLBACK");}catch{};throw e;}
    finally{client.release();}
  }
  async create(bearer:string,body:unknown,correlationRef:string){
    const input=checkInput(body,["targetAccountRef","targetRoleRef","requestKey","previousCaseRef"]) as ProposalInput;
    const target=requireUuid(input.targetAccountRef),role=requireUuid(input.targetRoleRef);
    const requestKey=requireUuid(input.requestKey);
    const previous=input.previousCaseRef===undefined||input.previousCaseRef===null?
      null:requireUuid(input.previousCaseRef);
    const actor=await this.sessions.requireAction(bearer,"approvals.propose");
    const requestDigest=hash(["CG01_PROTECTED_ROLE_ASSIGN",target,role,previous]);
    const client=await this.db.connect();let open=false;
    try{
      await client.query("BEGIN");open=true;
      // Serialize source proposal and process activation without a global worker.
      const root=await client.query(`
        SELECT 1 FROM access_realm WHERE id=$1 AND realm_key='FOUNDATION_ROOT' FOR UPDATE
      `,[actor.realmId]);
      if(!root.rowCount)throw new ForbiddenException("Foundation realm unavailable");
      await this.owner.verifyProposer(client,actor);
      const old=await client.query<CaseRow>(`
        SELECT * FROM cg03_case WHERE realm_id=$1 AND proposer_id=$2 AND request_key=$3
      `,[actor.realmId,actor.accountId,requestKey]);
      if(old.rowCount){
        if(old.rows[0].request_digest!==requestDigest)
          throw new ConflictException({code:"APPROVAL_REPLAY_CONFLICT"});
        await client.query("COMMIT");open=false;
        return {...view(old.rows[0]),result:"PREVIOUSLY_CONFIRMED"};
      }
      await this.owner.requireDistinctFinalReviewer(client,actor.realmId,actor.accountId);
      let revision=1;
      if(previous){
        const past=await client.query<CaseRow>(`
          SELECT * FROM cg03_case WHERE id=$1 AND realm_id=$2 AND proposer_id=$3
            AND target_account_id=$4 FOR SHARE
        `,[previous,actor.realmId,actor.accountId,target]);
        if(!past.rowCount||past.rows[0].status!=="RETURNED")
          throw new ConflictException({code:"CORRECTION_REQUIRES_RETURN"});
        revision=past.rows[0].proposal_revision+1;
      }
      const snapshot=await this.owner.freeze(client,actor.realmId,target,role,actor.accountId);
      const process=await this.current(client,actor);
      const proposalDigest=hash([actor.realmId,target,role,revision,
        snapshot.accountAccessVersion,snapshot.roleRevision,actor.accountId,
        process.version,previous]);
      const entry=await client.query<CaseRow>(`
        INSERT INTO cg03_case(
          realm_id,case_number,process_id,process_version,proposer_id,
          target_account_id,target_role_id,account_name_snapshot,role_name_snapshot,
          expected_access_version,expected_role_revision,proposal_revision,
          proposal_digest,request_digest,request_key,previous_case_id)
        VALUES($1,'CG-AP-'||lpad(nextval('cg03_public_case_sequence')::text,6,'0'),
          $2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        RETURNING *
      `,[actor.realmId,process.id,process.version,actor.accountId,
        target,role,snapshot.accountName,snapshot.roleName,snapshot.accountAccessVersion,
        snapshot.roleRevision,revision,proposalDigest,requestDigest,requestKey,previous]);
      const created=entry.rows[0];
      await client.query(`
        INSERT INTO cg03_case_event(realm_id,case_id,actor_id,action,step_ordinal,
          correlation_ref) VALUES($1,$2,$3,$4,1,$5)
      `,[actor.realmId,created.id,actor.accountId,previous?"CORRECTED":"SUBMITTED",correlationRef]);
      await client.query("COMMIT");open=false;
      return {...view(created),result:"SUBMITTED"};
    }catch(e){
      if(open)try{await client.query("ROLLBACK");}catch{}
      if(e&&typeof e==="object"&&"code" in e&&e.code==="23505")
        throw new ConflictException({code:"ACTIVE_CASE_EXISTS"});
      throw e;
    }finally{client.release();}
  }
  async list(bearer:string,query:{status?:unknown;limit?:unknown}={}){
    const {actor,root,reviewer}=await this.readActor(bearer);
    const status=query.status===undefined?"all":query.status;
    const limit=query.limit===undefined?20:Number(query.limit);
    if(typeof status!=="string"||
      !["all","SUBMITTED","IN_REVIEW","RETURNED","REJECTED","FINAL_APPROVED",
        "PENDING_OWNER","OWNER_COMPLETED","OWNER_BLOCKED","OWNER_FAILED_RETRYABLE"].includes(status)||
      !Number.isInteger(limit)||limit<1||limit>30)
      throw new BadRequestException("Check case filters");
    const rows=await this.db.query<CaseRow>(`
      SELECT c.* FROM cg03_case c WHERE c.realm_id=$1
        AND ($2::boolean OR c.proposer_id=$3 OR ($6::boolean AND
          (EXISTS(SELECT 1 FROM cg03_process_step step
            WHERE step.process_id=c.process_id AND step.ordinal=c.current_step
              AND step.capability_key='roles.assign' AND c.status IN('SUBMITTED','IN_REVIEW'))
            OR EXISTS(SELECT 1 FROM cg03_case_decision d
              WHERE d.case_id=c.id AND d.actor_id=$3))))
        AND ($4='all' OR c.status=$4)
      ORDER BY c.submitted_at DESC,c.id DESC LIMIT $5
    `,[actor.realmId,root,actor.accountId,status,limit,reviewer]);
    return {cases:rows.rows.map(view),limit};
  }
  async detail(bearer:string,caseRef:unknown){
    const {actor,root,reviewer}=await this.readActor(bearer);
    if(typeof caseRef!=="string"||!UUID.test(caseRef))
      throw new BadRequestException("Choose a valid application");
    const rows=await this.db.query<CaseRow>(`
      SELECT c.* FROM cg03_case c WHERE c.realm_id=$1 AND c.id=$2
        AND ($3::boolean OR c.proposer_id=$4 OR ($5::boolean AND
          (EXISTS(SELECT 1 FROM cg03_process_step step
            WHERE step.process_id=c.process_id AND step.ordinal=c.current_step
              AND step.capability_key='roles.assign' AND c.status IN('SUBMITTED','IN_REVIEW'))
            OR EXISTS(SELECT 1 FROM cg03_case_decision d
              WHERE d.case_id=c.id AND d.actor_id=$4))))
    `,[actor.realmId,caseRef,root,actor.accountId,reviewer]);
    if(!rows.rowCount)throw new NotFoundException("Application unavailable");
    const row=rows.rows[0];
    const events=await this.db.query<{action:string;safe_remarks:string;occurred_at:Date;
      actor_name:string}>(`
      SELECT e.action,e.safe_remarks,e.occurred_at,a.display_name AS actor_name
      FROM cg03_case_event e JOIN account a ON a.id=e.actor_id AND a.realm_id=e.realm_id
      WHERE e.realm_id=$1 AND e.case_id=$2
      ORDER BY e.occurred_at,e.id LIMIT 50
    `,[actor.realmId,row.id]);
    const eligible=actor.accountId!==row.proposer_id&&
      ["SUBMITTED","IN_REVIEW"].includes(row.status);
    const pending=eligible?await this.db.query<{capability_key:string;
      protected_root_required:boolean}>(`
      SELECT capability_key,protected_root_required FROM cg03_process_step
      WHERE process_id=$1 AND ordinal=$2
    `,[row.process_id,row.current_step]):null;
    const step=pending?.rows[0];
    const canAct=!!step&&(step.protected_root_required?root:reviewer||root);
    const allowedDecisions=canAct?
      step.protected_root_required?["APPROVE","RETURN","REJECT"]:
      ["APPROVE","FORWARD","RETURN","REJECT"]:[];
    return {...view(row),allowedDecisions,requiresFreshAuthenticator:canAct&&
      Boolean(step?.protected_root_required),
      history:events.rows.map(e=>({
      action:e.action,remarks:e.safe_remarks,at:e.occurred_at.toISOString(),
      by:e.actor_name
    }))};
  }
  async lookup(bearer:string,key:unknown){
    const actor=await this.sessions.requireAction(bearer,"approvals.propose");
    const requestKey=requireUuid(key);
    const rows=await this.db.query<CaseRow>(`
      SELECT * FROM cg03_case WHERE realm_id=$1 AND proposer_id=$2 AND request_key=$3
    `,[actor.realmId,actor.accountId,requestKey]);
    return rows.rowCount?{status:"CONFIRMED",case:view(rows.rows[0])}:
      {status:"NOT_FOUND",case:null};
  }
}
