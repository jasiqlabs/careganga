import {BadRequestException,ConflictException,ForbiddenException,Inject,Injectable} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const id=(v:unknown)=>{
 if(typeof v!=="string"||!UUID.test(v))throw new BadRequestException("Select a current Foundation record");
 return v;
};
type Scope="BRANCH"|"AREA";
type Grant={id:string;account_ref:string;scope_kind:Scope;branch_ref:string|null;area_ref:string|null;
 reason:string;granted_by:string;granted_at:Date;ended_at:Date|null;end_request_key:string|null;
 request_digest:string;source_version:number};
function object(value:unknown,keys:readonly string[]):Record<string,unknown>{
 if(!value||typeof value!=="object"||Array.isArray(value))throw new BadRequestException("Check the access assignment");
 const v=value as Record<string,unknown>;
 if(Object.keys(v).some(x=>!keys.includes(x)))throw new BadRequestException("The access assignment contains unsupported fields");
 return v;
}
const fingerprint=(input:unknown)=>createHash("sha256").update(JSON.stringify(input)).digest("hex");

/** CG02 owns current branch/area assignment, CG01 still owns all role actions.
 * CG14 healthcare center affiliation must never be replaced by this grant.
 */
@Injectable()
export class BranchStaffAccessService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,private readonly identity:FoundationStructureIdentityFacade){}
 private async administrator(bearer:string){
  return this.sessions.requireAction(bearer,"foundation.branches.admin");
 }
 async list(bearer:string,accountInput?:string){
  const actor=await this.administrator(bearer);
  const account=accountInput?id(accountInput):null;
  const rows=await this.db.query<Grant&{display_name:string;scope_name:string}>(`
   SELECT s.*,a.display_name,COALESCE(b.name,g.display_name) AS scope_name
   FROM cg02_staff_scope_assignment s
   JOIN account a ON a.id=s.account_ref AND a.realm_id=s.root_realm_id
   LEFT JOIN branch b ON b.id=s.branch_ref AND b.root_realm_id=s.root_realm_id
   LEFT JOIN geography_area g ON g.id=s.area_ref AND g.root_realm_id=s.root_realm_id
   WHERE s.root_realm_id=$1 AND ($2::uuid IS NULL OR s.account_ref=$2)
   ORDER BY (s.ended_at IS NULL) DESC,s.granted_at DESC,s.id DESC LIMIT 101
  `,[actor.realmId,account]);
  if(rows.rows.length>100)throw new ConflictException("Narrow the assignment list by staff member");
  const protectedRole=await this.db.query<{allowed:boolean}>(
   "SELECT EXISTS(SELECT 1 FROM account_role ar JOIN role r ON r.id=ar.role_id "+
   "WHERE ar.realm_id=$1 AND ar.account_id=$2 AND ar.revoked_at IS NULL "+
   "AND r.active=true AND r.is_protected=true) AS allowed",[actor.realmId,actor.accountId]);
  return {canGrant:protectedRole.rows[0]?.allowed===true,
   items:rows.rows.map(x=>({assignmentRef:x.id,accountRef:x.account_ref,
    staffName:x.display_name,scopeKind:x.scope_kind,scopeName:x.scope_name,
    scopeRef:x.branch_ref??x.area_ref,reason:x.reason,sourceVersion:x.source_version,
    grantedAt:x.granted_at,endedAt:x.ended_at}))};
 }
 async options(bearer:string,query:string){
  const actor=await this.administrator(bearer);
  if(query.length>100)throw new BadRequestException("Narrow the staff search");
  const client=await this.db.connect();
  try{
   const accounts=await this.identity.eligibleOfficeholderOptions(client,actor,query.trim());
   const branches=await client.query<{id:string;name:string}>(
    "SELECT id,name FROM branch WHERE root_realm_id=$1 AND status='ACTIVE' ORDER BY name,id LIMIT 100",
    [actor.realmId]);
   const areas=await client.query<{id:string;display_name:string;level:string}>(
    "SELECT id,display_name,level FROM geography_area WHERE root_realm_id=$1 "+
    "AND status='ACTIVE' ORDER BY level,display_name,id LIMIT 100",[actor.realmId]);
   return {accounts,branches:branches.rows.map(x=>({value:x.id,label:x.name})),
    areas:areas.rows.map(x=>({value:x.id,label:x.level+" · "+x.display_name}))};
  }finally{client.release();}
 }
 private async protectedWrite(bearer:string,password:unknown,handler:(tx:PoolClient,a:VerifiedFoundationActor)=>Promise<unknown>){
  const actor=await this.administrator(bearer);
  await this.sessions.limitFoundationRootProof(actor);
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   await this.identity.assertCurrent(tx,actor,"foundation.branches.admin");
   await this.sessions.requireFreshFoundationRootProof(tx,actor,String(password??""));
   const result=await handler(tx,actor);
   await tx.query("COMMIT");
   return result;
  }catch(e){await tx.query("ROLLBACK");throw e;}
  finally{tx.release();}
 }
 async grant(bearer:string,raw:unknown){
  const x=object(raw,["requestKey","accountRef","scopeKind","branchRef","areaRef","reason","currentPassword"]);
  const account=id(x.accountRef),key=id(x.requestKey),kind=x.scopeKind;
  if(kind!=="BRANCH"&&kind!=="AREA")throw new BadRequestException("Select branch or geographic area access");
  const branch=kind==="BRANCH"?id(x.branchRef):null,area=kind==="AREA"?id(x.areaRef):null;
  if(kind==="BRANCH"&&x.areaRef!==undefined&&x.areaRef!==null||
    kind==="AREA"&&x.branchRef!==undefined&&x.branchRef!==null)
    throw new BadRequestException("Choose only one kind of staff access");
  if(typeof x.reason!=="string"||x.reason.trim().length<6||x.reason.trim().length>500)
   throw new BadRequestException("Explain why the staff member needs this branch or area");
  const reason=x.reason.trim(),digest=fingerprint([account,kind,branch,area,reason]);
  return this.protectedWrite(bearer,x.currentPassword,async(tx,a)=>{
   const target=await this.identity.eligibleOfficeholder(tx,a,account);
   const existing=await tx.query<Grant>(
    "SELECT * FROM cg02_staff_scope_assignment WHERE root_realm_id=$1 AND granted_by=$2 "+
    "AND request_key=$3 FOR SHARE",[a.realmId,a.accountId,key]);
   if(existing.rows[0]){
    if(existing.rows[0].request_digest!==digest)throw new ConflictException("The original request has different details");
    return {assignmentRef:existing.rows[0].id,status:existing.rows[0].ended_at?"ENDED":"ACTIVE",
     message:"Original staff assignment verified. Refresh the current branch access."};
   }
   if(branch){
    const permitted=await tx.query("SELECT 1 FROM branch WHERE root_realm_id=$1 AND id=$2 "+
     "AND status='ACTIVE' FOR SHARE",[a.realmId,branch]);
    if(!permitted.rowCount)throw new BadRequestException("Choose an active Foundation branch");
   }else{
    const permitted=await tx.query("SELECT 1 FROM geography_area WHERE root_realm_id=$1 "+
     "AND id=$2 AND status='ACTIVE' FOR SHARE",[a.realmId,area]);
    if(!permitted.rowCount)throw new BadRequestException("Choose a current geographic area");
   }
   const inserted=await tx.query<{id:string}>(`
    INSERT INTO cg02_staff_scope_assignment(root_realm_id,account_ref,scope_kind,
     branch_ref,area_ref,reason,granted_by,request_key,request_digest)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
    ON CONFLICT DO NOTHING RETURNING id
   `,[a.realmId,account,kind,branch,area,reason,a.accountId,key,digest]);
   if(!inserted.rows[0]){
    const replay=await tx.query<Grant>(
     "SELECT * FROM cg02_staff_scope_assignment WHERE root_realm_id=$1 AND granted_by=$2 "+
     "AND request_key=$3 FOR SHARE",[a.realmId,a.accountId,key]);
    if(replay.rows[0]&&replay.rows[0].request_digest===digest)
     return {assignmentRef:replay.rows[0].id,status:replay.rows[0].ended_at?"ENDED":"ACTIVE",
      message:"Original staff assignment verified. Refresh the current branch access."};
    throw new ConflictException("This staff member already has current access to that scope");
   }
   // Grant changes invalidate the target's earlier sessions and cached choices.
   await tx.query("UPDATE account SET access_version=access_version+1 WHERE id=$1 AND realm_id=$2",
    [account,a.realmId]);
   await tx.query("INSERT INTO access_audit(realm_id,actor_account_id,target_account_id,"+
    "action_key,outcome,correlation_ref) VALUES($1,$2,$3,'cg02.staff.scope.grant','SUCCESS',$4)",
    [a.realmId,a.accountId,account,key]);
   return {assignmentRef:inserted.rows[0].id,status:"ACTIVE",
    message:target.displayName+" has access to the selected scope. They must sign in again."};
  });
 }
 async end(bearer:string,assignmentInput:string,raw:unknown){
  const assignment=id(assignmentInput);
  const x=object(raw,["requestKey","currentPassword"]),key=id(x.requestKey);
  return this.protectedWrite(bearer,x.currentPassword,async(tx,a)=>{
   const row=await tx.query<Grant>(
    "SELECT * FROM cg02_staff_scope_assignment WHERE id=$1 AND root_realm_id=$2 FOR UPDATE",
    [assignment,a.realmId]);
   const old=row.rows[0];
   if(!old)throw new ConflictException("Staff assignment is unavailable");
   if(old.ended_at){
    if(old.ended_by!==a.accountId||old.end_request_key!==key)
     throw new ConflictException("Access was already ended. Refresh before continuing.");
    return {assignmentRef:assignment,status:"ENDED",message:"Original access removal verified."};
   }
   const result=await tx.query(`
    UPDATE cg02_staff_scope_assignment
    SET ended_at=now(),ended_by=$3,end_request_key=$4,source_version=2
    WHERE id=$1 AND root_realm_id=$2 AND ended_at IS NULL
    RETURNING id
   `,[assignment,a.realmId,a.accountId,key]);
   if(!result.rowCount)throw new ConflictException("Staff access changed. Refresh.");
   await tx.query("UPDATE account SET access_version=access_version+1 WHERE id=$1 AND realm_id=$2",
    [old.account_ref,a.realmId]);
   await tx.query("INSERT INTO access_audit(realm_id,actor_account_id,target_account_id,"+
    "action_key,outcome,correlation_ref) VALUES($1,$2,$3,'cg02.staff.scope.end','SUCCESS',$4)",
    [a.realmId,a.accountId,old.account_ref,key]);
   return {assignmentRef:assignment,status:"ENDED",
    message:"Staff access ended. Their previous sessions are no longer valid."};
  });
 }
}
