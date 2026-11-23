import {
 BadRequestException,ConflictException,ForbiddenException,Inject,Injectable
} from "@nestjs/common";
import {randomBytes} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {catalogPage} from "./referral-catalog.service";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type RelationshipKind="MEMBER"|"VOLUNTEER";
type Relationship={kind:RelationshipKind;ref:string};
type Programme={ref:string;name:string;audience:RelationshipKind|"BOTH"};
const programmeRef=(v:unknown):string=>{
 if(typeof v!=="string"||!UUID.test(v))throw new BadRequestException({code:"CG13_INVALID_INPUT",field:"programmeRef"});
 return v.toLowerCase();
};
const relationshipKind=(v:unknown):RelationshipKind=>{
 if(v!=="MEMBER"&&v!=="VOLUNTEER")
  throw new BadRequestException({code:"CG13_INVALID_INPUT",field:"relationship"});
 return v;
};
@Injectable()
export class ReferralSelfService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade){}
 private async inCurrentSelf<T>(token:string,read:boolean,
  run:(tx:PoolClient,actor:VerifiedFoundationActor)=>Promise<T>):Promise<T>{
  const actor=await this.sessions.verifySession(token);
  const tx=await this.db.connect();
  try{
   await tx.query(read?"BEGIN ISOLATION LEVEL REPEATABLE READ":"BEGIN");
   await this.identity.assertRootSelfSessionCurrent(tx,actor);
   const value=await run(tx,actor);
   await tx.query("COMMIT");return value;
  }catch(e){
   try{await tx.query("ROLLBACK");}catch{}
   const err=e as {code?:string};
   if(err?.code==="23505")throw new ConflictException({code:"CG13_SOURCE_ALREADY_EXISTS"});
   if(err?.code==="23503"||err?.code==="23514"||err?.code==="P0001")
    throw new ConflictException({code:"CG13_CURRENT_SOURCE_UNAVAILABLE"});
   throw e;
  }finally{tx.release();}
 }
 /** Every read is an ORIGINAL CG04 current self relationship read. No member or
  * volunteer row is created and never infer relationship from contact details.
  */
 private async currentRelationships(tx:PoolClient,actor:VerifiedFoundationActor):Promise<Relationship[]>{
  const member=await tx.query<{ref:string}>(
   "SELECT m.id AS ref FROM member m "+
   "JOIN membership_application_effect effect ON effect.root_realm_id=m.root_realm_id "+
   "AND effect.member_id=m.id AND effect.application_id=m.original_application_id "+
   "JOIN membership_application app ON app.root_realm_id=m.root_realm_id "+
   "AND app.id=m.original_application_id AND app.status='APPROVED' "+
   "JOIN cg03_case review ON review.realm_id=effect.root_realm_id "+
   "AND review.id=effect.case_id AND review.status='OWNER_COMPLETED' "+
   "JOIN account verified ON verified.realm_id=m.root_realm_id AND verified.id=m.account_ref "+
   "AND verified.status='ACTIVE' AND verified.contact_phone_verified_at IS NOT NULL "+
   "JOIN membership_term term ON term.root_realm_id=m.root_realm_id AND term.member_id=m.id "+
   "LEFT JOIN branch b ON b.root_realm_id=m.root_realm_id AND b.id=m.branch_ref "+
   "WHERE m.root_realm_id=$1 AND m.account_ref=$2 AND m.status='ACTIVE' "+
   "AND (m.branch_ref IS NULL OR b.status='ACTIVE') "+
   "AND term.starts_on<=(now() AT TIME ZONE 'Asia/Kolkata')::date "+
   "AND (term.expires_on IS NULL OR term.expires_on>(now() AT TIME ZONE 'Asia/Kolkata')::date) "+
   "ORDER BY term.starts_on DESC,m.id LIMIT 2 FOR SHARE OF m,term",[actor.realmId,actor.accountId]);
  const volunteer=await tx.query<{ref:string}>(
   "SELECT v.id AS ref FROM volunteer v "+
   "WHERE v.root_realm_id=$1 AND v.account_ref=$2 AND v.status='ACTIVE' "+
   "AND cg04_current_volunteer(v.root_realm_id,v.id,v.account_ref,v.branch_ref) "+
   "ORDER BY v.id LIMIT 2 FOR SHARE OF v",[actor.realmId,actor.accountId]);
  return [
   ...member.rows.slice(0,1).map(row=>({kind:"MEMBER" as const,ref:row.ref})),
   ...volunteer.rows.slice(0,1).map(row=>({kind:"VOLUNTEER" as const,ref:row.ref}))
  ];
 }
 private async activeProgrammes(tx:PoolClient,realm:string,page:number):Promise<{items:Programme[];hasMore:boolean}>{
  const data=await tx.query<Programme>(
   "SELECT p.id AS ref,p.display_name AS name,p.audience FROM referral_program p "+
   "WHERE p.root_realm_id=$1 AND p.status='ACTIVE' "+
   "AND EXISTS(SELECT 1 FROM referral_policy_version policy "+
   "WHERE policy.root_realm_id=p.root_realm_id AND policy.programme_id=p.id "+
   "AND policy.effective_from<=now()) "+
   "ORDER BY p.display_name,p.id LIMIT $2 OFFSET $3",
   [realm,41,(page-1)*40]);
  return {items:data.rows.slice(0,40),hasMore:data.rows.length>40};
 }
 /** Source-safe private code choices; no program ref becomes a cross-account credential. */
 async options(token:string,pageInput?:string){
  const page=catalogPage(pageInput);
  return this.inCurrentSelf(token,true,async(tx,actor)=>{
   const active=await this.currentRelationships(tx,actor);
   if(!active.length)return {items:[],hasMore:false,page,
    notice:"A currently active approved membership or volunteer relationship is required."};
   const programmes=await this.activeProgrammes(tx,actor.realmId,page);
   const items=programmes.items.flatMap(p=>active
    .filter(rel=>p.audience==="BOTH"||p.audience===rel.kind)
    .map(rel=>({programmeRef:p.ref,programmeName:p.name,relationship:rel.kind})));
   return {items,hasMore:programmes.hasMore,page,
    notice:"Share your code only with a new applicant. Points are awarded only after verified approval."};
  });
 }
 /** Idempotent issuance for explicitly selected, verified member/volunteer.
  * A GET returns the original stable code; no points are credited by this API.
  */
 async myCode(token:string,programmeInput:unknown,kindInput:unknown){
  const programme=programmeRef(programmeInput),kind=relationshipKind(kindInput);
  return this.inCurrentSelf(token,false,async(tx,actor)=>{
   const current=await this.currentRelationships(tx,actor);
   const rel=current.find(x=>x.kind===kind);
   if(!rel)throw new ForbiddenException("An active, verified relationship is required.");
   const eligible=await tx.query<{ref:string;name:string;qualifyingEvent:string}>(
    "SELECT p.id AS ref,p.display_name AS name,"+
    "rules.qualifying_event AS \"qualifyingEvent\" FROM referral_program p "+
    "JOIN LATERAL (SELECT policy.qualifying_event FROM referral_policy_version policy "+
    "WHERE policy.root_realm_id=p.root_realm_id AND policy.programme_id=p.id "+
    "AND policy.effective_from<=now() "+
    "ORDER BY policy.effective_from DESC,policy.version_no DESC LIMIT 1) rules ON true "+
    "WHERE p.root_realm_id=$1 AND p.id=$2 AND p.status='ACTIVE' "+
    "AND (p.audience=$3 OR p.audience='BOTH') FOR SHARE OF p",
    [actor.realmId,programme,kind]);
   if(!eligible.rows[0])throw new ForbiddenException("This referral programme is unavailable.");
   const opaque=randomBytes(24).toString("base64url");
   await tx.query(
    "INSERT INTO referral_code(root_realm_id,programme_id,referrer_kind,"+
    "referrer_relationship_ref,referrer_account_ref,code_value) "+
    "VALUES($1,$2,$3,$4,$5,$6) "+
    "ON CONFLICT(root_realm_id,programme_id,referrer_kind,referrer_relationship_ref) DO NOTHING",
    [actor.realmId,programme,kind,rel.ref,actor.accountId,opaque]);
   const saved=await tx.query<{code:string}>(
    "SELECT code_value AS code FROM referral_code "+
    "WHERE root_realm_id=$1 AND programme_id=$2 AND referrer_kind=$3 "+
    "AND referrer_relationship_ref=$4 AND referrer_account_ref=$5",
    [actor.realmId,programme,kind,rel.ref,actor.accountId]);
   if(!saved.rows[0])throw new ConflictException({code:"CG13_CURRENT_SOURCE_UNAVAILABLE"});
   return {programmeName:eligible.rows[0].name,relationship:kind,code:saved.rows[0].code,
    sharePath:eligible.rows[0].qualifyingEvent==="MEMBERSHIP_ACTIVATED_VERIFIED"?
     "/membership?ref="+saved.rows[0].code:
     "/volunteer?ref="+saved.rows[0].code,
    notice:"A referral only earns points after independent verification and eligible activation. A visit or signup alone earns nothing."};
  });
 }
}
