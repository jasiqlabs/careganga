import {BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,
 NotFoundException} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {catalogPage} from "./referral-catalog.service";
import {recordAcknowledgedRewardRecognition} from
 "../../cg-19-documents-notifications/application/reward-recognition-source";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ref=(x:unknown):string=>{
 if(typeof x!=="string"||!UUID.test(x))
  throw new BadRequestException("Select a current reward from the catalogue.");
 return x.toLowerCase();
};
const obj=(x:unknown,keys:string[]):Record<string,unknown>=>{
 if(!x||typeof x!=="object"||Array.isArray(x)||
  Object.keys(x).some(k=>!keys.includes(k)))
  throw new BadRequestException("Check the current redemption request.");
 return x as Record<string,unknown>;
};
type Kind="MEMBER"|"VOLUNTEER";
type Request={
 programmeRef:string;productRef:string;relationship:Kind;
 expectedProductVersion:number;requestKey:string;
};
type Wallet={id:string;earned:string;reversed:string;held:string;spent:string};
type Redemption={ref:string;state:string;productName:string;
 pointsCost:string;revision:number;requestedAt:string;
 digitalFulfillmentMethod:string;recognitionTitle:string|null;
 recognitionDescription:string|null;recognizedAt:string|null};
const parse=(raw:unknown):Request=>{
 const x=obj(raw,["programmeRef","productRef","relationship","expectedProductVersion","requestKey"]);
 if(x.relationship!=="MEMBER"&&x.relationship!=="VOLUNTEER")
  throw new BadRequestException("Choose your verified relationship.");
 if(typeof x.expectedProductVersion!=="number"||
  !Number.isSafeInteger(x.expectedProductVersion)||x.expectedProductVersion<1
  ||Number(x.expectedProductVersion)>2147483647)
  throw new BadRequestException("Refresh the current reward price before confirming.");
 return {programmeRef:ref(x.programmeRef),productRef:ref(x.productRef),
  relationship:x.relationship,expectedProductVersion:Number(x.expectedProductVersion),
  requestKey:ref(x.requestKey)};
};
const digest=(r:Request)=>createHash("sha256").update(JSON.stringify([
 r.programmeRef,r.productRef,r.relationship,r.expectedProductVersion
])).digest("hex");
/** US003 source contract: no invented provider, stock or money. Digital request
 * only holds real earned CG04 points. Fulfillment stays pending until original
 * independently verifiable delivery evidence exists in a future approved owner.
 */
@Injectable()
export class RedemptionService {
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade){}
 private async run<T>(token:string,fn:(tx:PoolClient,a:VerifiedFoundationActor)=>Promise<T>):Promise<T>{
  const actor=await this.sessions.verifySession(token),tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   await tx.query("SET LOCAL lock_timeout='3s'");
   await this.identity.assertRootSelfSessionCurrent(tx,actor);
   const value=await fn(tx,actor);await tx.query("COMMIT");return value;
  }catch(e){
   try{await tx.query("ROLLBACK");}catch{}
   if(e&&typeof e==="object"&&"code" in e&&
    ["23503","23514","40P01","40001","55P03","P0001"].includes(String(e.code)))
    throw new ConflictException("The reward source changed. Refresh before retrying the same request.");
   throw e;
  }finally{tx.release();}
 }
 private async current(tx:PoolClient,a:VerifiedFoundationActor,kind:Kind):Promise<string>{
  if(kind==="MEMBER"){
   const q=await tx.query<{ref:string}>(
    "SELECT m.id AS ref FROM member m JOIN membership_term term "+
    "ON term.root_realm_id=m.root_realm_id AND term.member_id=m.id "+
    "WHERE m.root_realm_id=$1 AND m.account_ref=$2 AND m.status='ACTIVE' "+
    "AND (m.branch_ref IS NULL OR EXISTS(SELECT 1 FROM branch br "+
    "WHERE br.root_realm_id=m.root_realm_id AND br.id=m.branch_ref "+
    "AND br.status='ACTIVE')) "+
    "AND term.starts_on<=(now() AT TIME ZONE 'Asia/Kolkata')::date "+
    "AND (term.expires_on IS NULL OR term.expires_on>(now() AT TIME ZONE 'Asia/Kolkata')::date) "+
    "ORDER BY term.starts_on DESC LIMIT 1 FOR SHARE OF m,term",
    [a.realmId,a.accountId]);
   if(q.rows[0])return q.rows[0].ref;
  }else{
   const q=await tx.query<{ref:string}>(
    "SELECT v.id AS ref FROM volunteer v WHERE v.root_realm_id=$1 "+
    "AND v.account_ref=$2 AND v.status='ACTIVE' AND "+
    "cg04_current_volunteer(v.root_realm_id,v.id,v.account_ref,v.branch_ref) "+
    "LIMIT 1 FOR SHARE OF v",[a.realmId,a.accountId]);
   if(q.rows[0])return q.rows[0].ref;
  }
  throw new ForbiddenException("A current verified Foundation relationship is required.");
 }
 async request(token:string,raw:unknown){
  const source=parse(raw),hash=digest(source);
  return this.run(token,async(tx,a)=>{
   const relationship=await this.current(tx,a,source.relationship);
   // A source key belongs to one actor, one payload, forever. Re-query
   // before attempting writes on retries, even if the product later changes.
   await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
    ["CG13:DIGITAL:"+a.realmId+":"+a.accountId+":"+source.requestKey]);
   const existing=await tx.query<{ref:string;state:string;payloadDigest:string;pointsCost:string}>(
    "SELECT id AS ref,state,payload_digest AS \"payloadDigest\",points_cost::text AS \"pointsCost\" "+
    "FROM redemption WHERE root_realm_id=$1 AND recipient_account_ref=$2 "+
    "AND request_key=$3 FOR UPDATE",
    [a.realmId,a.accountId,source.requestKey]);
   if(existing.rows[0]){
    if(existing.rows[0].payloadDigest!==hash)
     throw new ConflictException("This request was already used for a different reward.");
    return {ref:existing.rows[0].ref,state:existing.rows[0].state,
     pointsCost:existing.rows[0].pointsCost,replayed:true,
     notice:"Your original digital reward request has been retrieved."};
   }
   const product=await tx.query<{price:string;version:number;name:string;policyVersion:number;minimumClaimPoints:string}>(
    "SELECT p.points_price::text AS price,p.version,p.name,"+
    "policy.version_no AS \"policyVersion\","+
    "policy.minimum_claim_points::text AS \"minimumClaimPoints\" FROM reward_product p "+
    "JOIN referral_program programme ON programme.root_realm_id=p.root_realm_id "+
    "AND programme.id=p.programme_id "+
    "JOIN LATERAL (SELECT pv.version_no,pv.minimum_claim_points FROM referral_policy_version pv "+
    "WHERE pv.root_realm_id=programme.root_realm_id AND pv.programme_id=programme.id "+
    "AND pv.effective_from<=now() ORDER BY pv.effective_from DESC,pv.version_no DESC "+
    "LIMIT 1) policy ON true "+
    "WHERE p.root_realm_id=$1 AND p.id=$2 AND p.programme_id=$3 "+
    "AND p.product_type='DIGITAL' AND p.status='ACTIVE' AND p.public_visible "+
    "AND programme.status='ACTIVE' AND "+
    "(programme.audience='BOTH' OR programme.audience=$4) "+
    "AND (p.eligible_audience='BOTH' OR p.eligible_audience=$4) "+
    "AND EXISTS(SELECT 1 FROM referral_policy_version policy "+
    "WHERE policy.root_realm_id=p.root_realm_id AND policy.programme_id=p.programme_id "+
    "AND policy.effective_from<=now()) FOR SHARE OF p,programme",
    [a.realmId,source.productRef,source.programmeRef,source.relationship]);
   if(!product.rows[0]||product.rows[0].version!==source.expectedProductVersion)
    throw new ConflictException("The reward changed. Refresh its current price.");
   const price=BigInt(product.rows[0].price);
   const claimMinimum=BigInt(product.rows[0].minimumClaimPoints);
   // The current migration supports one DIGITAl hold of at most 1 billion
   // points. Reject an incompatible catalog price before DB transition.
   if(price<=0n||price>1000000000000n||claimMinimum>1000000000n)
    throw new ConflictException("This reward is not available for points redemption.");
   const account=await tx.query<Wallet>(
    "SELECT id,earned_points::text AS earned,reversed_points::text AS reversed,"+
    "held_points::text AS held,spent_points::text AS spent FROM points_account "+
    "WHERE root_realm_id=$1 AND programme_id=$2 AND referrer_kind=$3 "+
    "AND referrer_relationship_ref=$4 AND referrer_account_ref=$5 FOR UPDATE",
    [a.realmId,source.programmeRef,source.relationship,relationship,a.accountId]);
   const wallet=account.rows[0];
   const available=wallet?BigInt(wallet.earned)-BigInt(wallet.reversed)-
    BigInt(wallet.held)-BigInt(wallet.spent):0n;
   if(!wallet||available<price||available<claimMinimum)
    throw new ConflictException("Not enough verified available points for the current minimum claim.");
   const created=await tx.query<{ref:string}>(
    "INSERT INTO redemption(root_realm_id,programme_id,policy_version,points_account_id,"+
    "recipient_account_ref,relationship_kind,relationship_ref,product_id,"+
    "product_revision,product_type,points_cost,request_key,payload_digest) "+
    "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'DIGITAL',$10,$11,$12) RETURNING id AS ref",
    [a.realmId,source.programmeRef,product.rows[0].policyVersion,wallet.id,
     a.accountId,source.relationship,relationship,source.productRef,
     source.expectedProductVersion,price.toString(),source.requestKey,hash]);
   const redemption=created.rows[0];
   if(!redemption)throw new ConflictException("Reward request outcome uncertain.");
   const held=await tx.query<{ref:string}>(
    "INSERT INTO points_event(root_realm_id,points_account_id,redemption_id,"+
    "event_kind,policy_version,points_delta,qualifying_source_digest) "+
    "SELECT $1,$2,$3,'POINTS_HOLD',r.policy_version,$4,$5 "+
    "FROM redemption r WHERE r.root_realm_id=$1 AND r.id=$3 "+
    "AND r.programme_id=$6 "+
    "RETURNING id AS ref",
    [a.realmId,wallet.id,redemption.ref,price.toString(),hash,source.programmeRef]);
   if(!held.rows[0])throw new ConflictException("Reward reservation not confirmed.");
   const updated=await tx.query(
    "UPDATE points_account SET held_points=held_points+$3,revision=revision+1,"+
    "updated_at=now() WHERE root_realm_id=$1 AND id=$2 "+
    "AND earned_points-reversed_points-held_points-spent_points>=$3",
    [a.realmId,wallet.id,price.toString()]);
   if(updated.rowCount!==1)throw new ConflictException("Current points are unavailable.");
   await tx.query(
    "INSERT INTO redemption_event(root_realm_id,redemption_id,event_kind,"+
    "original_points_event_id,source_key) VALUES($1,$2,'REQUESTED',$3,$4)",
    [a.realmId,redemption.ref,held.rows[0].ref,source.requestKey]);
   return {ref:redemption.ref,state:"HELD",pointsCost:price.toString(),replayed:false,
    notice:"Points reserved. Digital delivery remains pending verified fulfillment; no gift code or cash entitlement is issued."};
  });
 }
 async cancel(token:string,redemptionInput:unknown){
  const redemptionRef=ref(redemptionInput);
  return this.run(token,async(tx,a)=>{
   const found=await tx.query<{
    ref:string;state:string;price:string;wallet:string;relationship:Kind
   }>(
    "SELECT id AS ref,state,points_cost::text AS price,"+
    "points_account_id AS wallet,relationship_kind AS relationship "+
    "FROM redemption WHERE root_realm_id=$1 AND id=$2 "+
    "AND recipient_account_ref=$3 FOR UPDATE",
    [a.realmId,redemptionRef,a.accountId]);
   const redemption=found.rows[0];
   if(!redemption)throw new NotFoundException("Your reward request was not found.");
   await this.current(tx,a,redemption.relationship);
   if(redemption.state==="CANCELLED")
    return {state:"CANCELLED",replayed:true};
   if(redemption.state!=="HELD")
    throw new ConflictException("This reward can no longer be cancelled.");
   // Same original wallet lock and immutable points release source.
   const lock=await tx.query(
    "SELECT 1 FROM points_account WHERE root_realm_id=$1 AND id=$2 "+
    "AND referrer_account_ref=$3 FOR UPDATE",
    [a.realmId,redemption.wallet,a.accountId]);
   if(!lock.rowCount)throw new ForbiddenException("Your original points account is unavailable.");
   const change=await tx.query(
    "UPDATE redemption SET state='CANCELLED',revision=revision+1,cancelled_at=now() "+
    "WHERE root_realm_id=$1 AND id=$2 AND state='HELD'",
    [a.realmId,redemptionRef]);
   if(change.rowCount!==1)throw new ConflictException("Reward status changed.");
   const effect=await tx.query<{id:string}>(
    "INSERT INTO points_event(root_realm_id,points_account_id,redemption_id,"+
    "event_kind,policy_version,points_delta,qualifying_source_digest) "+
    "SELECT $1,$2,$3,'POINTS_RELEASE',r.policy_version,-$4::bigint,r.payload_digest "+
    "FROM redemption r WHERE r.root_realm_id=$1 AND r.id=$3 RETURNING id",
    [a.realmId,redemption.wallet,redemptionRef,redemption.price]);
   if(!effect.rows[0])throw new ConflictException("Release source is unavailable.");
   const wallet=await tx.query(
    "UPDATE points_account SET held_points=held_points-$3,revision=revision+1,"+
    "updated_at=now() WHERE root_realm_id=$1 AND id=$2 AND held_points>=$3",
    [a.realmId,redemption.wallet,redemption.price]);
   if(wallet.rowCount!==1)throw new ConflictException("Original held points do not match.");
   await tx.query(
    "INSERT INTO redemption_event(root_realm_id,redemption_id,event_kind,"+
    "original_points_event_id,source_key) "+
    "SELECT $1,$2,'CANCELLED',$3,r.request_key FROM redemption r "+
    "WHERE r.root_realm_id=$1 AND r.id=$2",
    [a.realmId,redemptionRef,effect.rows[0].id]);
   return {state:"CANCELLED",replayed:false,
    notice:"Your pending request was cancelled. The held points were released."};
  });
 }
 /** Original CG19 ON_PLATFORM_RECOGNITION is the delivered benefit itself:
  * a current signed-in recipient expressly acknowledges seeing their original
  * immutable recognition inside this same points/recognition transaction.
  * External vouchers, generic digital items and PDFs are NEVER auto-fulfilled.
  */
 async claimRecognition(token:string,redemptionInput:unknown){
  const id=ref(redemptionInput);
  return this.run(token,async(tx,a)=>{
   const found=await tx.query<{
    id:string;state:string;wallet:string;relationship:Kind;
    relationshipRef:string;price:string;requestKey:string
   }>(
    "SELECT id,state,points_account_id AS wallet,"+
    "relationship_kind AS relationship,relationship_ref AS \"relationshipRef\","+
    "points_cost::text AS price,request_key AS \"requestKey\" "+
    "FROM redemption WHERE root_realm_id=$1 AND id=$2 "+
    "AND recipient_account_ref=$3 FOR UPDATE",
    [a.realmId,id,a.accountId]);
   const row=found.rows[0];
   if(!row)throw new NotFoundException("Your reward recognition is unavailable.");
   if(await this.current(tx,a,row.relationship)!==row.relationshipRef)
    throw new ForbiddenException("Your original verified recipient relationship has changed.");
   if(row.state==="FULFILLED"){
    const prior=await tx.query<{title:string;description:string}>(
     "SELECT title,description FROM cg19_reward_recognition "+
     "WHERE realm_id=$1 AND redemption_id=$2 AND recipient_account_ref=$3",
     [a.realmId,id,a.accountId]);
    if(!prior.rows[0])throw new ConflictException("Original recognition proof unavailable.");
    return {state:"FULFILLED",replayed:true,
     recognition:{title:prior.rows[0].title,description:prior.rows[0].description},
     notice:"Your previously acknowledged on-platform recognition is ready."};
   }
   if(row.state!=="HELD")
    throw new ConflictException("This recognition cannot be claimed in its current state.");
   const locked=await tx.query<{id:string}>(
    "SELECT id FROM points_account WHERE root_realm_id=$1 AND id=$2 "+
    "AND referrer_account_ref=$3 AND held_points>=$4::bigint FOR UPDATE",
    [a.realmId,row.wallet,a.accountId,row.price]);
   if(!locked.rows[0])throw new ConflictException("Original held points are unavailable.");
   const proof=await recordAcknowledgedRewardRecognition(tx,{
    root:a.realmId,redemption:id,recipient:a.accountId,requestKey:row.requestKey
   });
   const change=await tx.query(
    "UPDATE redemption SET state='FULFILLED',revision=revision+1,fulfilled_at=now() "+
    "WHERE root_realm_id=$1 AND id=$2 AND recipient_account_ref=$3 AND state='HELD'",
    [a.realmId,id,a.accountId]);
   if(change.rowCount!==1)throw new ConflictException("Recognition was already changed.");
   const spent=await tx.query<{id:string}>(
    "INSERT INTO points_event(root_realm_id,points_account_id,redemption_id,"+
    "event_kind,policy_version,points_delta,qualifying_source_digest) "+
    "SELECT $1,$2,$3,'POINTS_SPENT',r.policy_version,r.points_cost,"+
    "r.payload_digest FROM redemption r "+
    "WHERE r.root_realm_id=$1 AND r.id=$3 "+
    "AND r.recipient_account_ref=$4 RETURNING id",
    [a.realmId,row.wallet,id,a.accountId]);
   if(!spent.rows[0])throw new ConflictException("Original points spend evidence unavailable.");
   const wallet=await tx.query(
    "UPDATE points_account SET held_points=held_points-$3::bigint,"+
    "spent_points=spent_points+$3::bigint,revision=revision+1,updated_at=now() "+
    "WHERE root_realm_id=$1 AND id=$2 AND held_points>=$3::bigint",
    [a.realmId,row.wallet,row.price]);
   if(wallet.rowCount!==1)throw new ConflictException("Points projection changed.");
   await tx.query(
    "INSERT INTO redemption_event(root_realm_id,redemption_id,event_kind,"+
    "original_points_event_id,source_key) "+
    "VALUES($1,$2,'RECOGNIZED',$3,$4)",
    [a.realmId,id,spent.rows[0].id,row.requestKey]);
   return {state:"FULFILLED",replayed:false,
    recognition:{title:proof.title,description:proof.description},
    notice:"Your on-platform recognition was acknowledged and issued. Original held points were spent."};
  });
 }
 async myHistory(token:string,pageInput?:string){
  const page=catalogPage(pageInput);
  return this.run(token,async(tx,a)=>{
   // Only the same authenticated actor; no applicant, staff or referrer PII.
   const records=await tx.query<Redemption>(
    "SELECT r.id AS ref,r.state,p.name AS \"productName\","+
    "p.digital_fulfillment_method AS \"digitalFulfillmentMethod\","+
    "proof.title AS \"recognitionTitle\",proof.description AS \"recognitionDescription\","+
    "proof.acknowledged_at AS \"recognizedAt\","+
    "r.points_cost::text AS \"pointsCost\",r.revision,"+
    "r.requested_at AS \"requestedAt\" FROM redemption r "+
    "JOIN reward_product_revision p ON p.root_realm_id=r.root_realm_id "+
    "AND p.product_id=r.product_id AND p.revision=r.product_revision "+
    "LEFT JOIN cg19_reward_recognition proof ON proof.realm_id=r.root_realm_id "+
    "AND proof.redemption_id=r.id AND proof.recipient_account_ref=r.recipient_account_ref "+
    "WHERE r.root_realm_id=$1 AND r.recipient_account_ref=$2 "+
    "AND ((r.relationship_kind='MEMBER' AND EXISTS("+
    "SELECT 1 FROM member m JOIN membership_term term "+
    "ON term.root_realm_id=m.root_realm_id AND term.member_id=m.id "+
    "WHERE m.root_realm_id=r.root_realm_id AND m.id=r.relationship_ref "+
    "AND m.account_ref=r.recipient_account_ref AND m.status='ACTIVE' "+
    "AND term.starts_on<=(now() AT TIME ZONE 'Asia/Kolkata')::date "+
    "AND (term.expires_on IS NULL OR term.expires_on>(now() AT TIME ZONE 'Asia/Kolkata')::date))) "+
    "OR (r.relationship_kind='VOLUNTEER' AND EXISTS("+
    "SELECT 1 FROM volunteer v WHERE v.root_realm_id=r.root_realm_id "+
    "AND v.id=r.relationship_ref AND v.account_ref=r.recipient_account_ref "+
    "AND v.status='ACTIVE' "+
    "AND cg04_current_volunteer(v.root_realm_id,v.id,v.account_ref,v.branch_ref)))) "+
    "ORDER BY r.requested_at DESC,r.id DESC LIMIT 26 OFFSET $3",
    [a.realmId,a.accountId,(page-1)*25]);
   return {items:records.rows.slice(0,25),hasMore:records.rows.length>25,page};
  });
 }
}
