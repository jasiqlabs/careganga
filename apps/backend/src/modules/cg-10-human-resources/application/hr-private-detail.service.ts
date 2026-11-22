import {BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,ServiceUnavailableException} from "@nestjs/common";
import {createCipheriv,createDecipheriv,createHash,randomBytes} from "node:crypto";
import type {Pool} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {HrEnrollmentSourceFacade} from "./hr-enrollment-source.facade";
type PrivateFields={contactPhone:string|null;postalAddress:string|null;
 emergencyName:string|null;emergencyPhone:string|null;pan:string|null;
 bankAccount:string|null;bankIfsc:string|null;fatherName:string|null;motherName:string|null;dateOfBirth:string|null;gender:string|null;bloodGroup:string|null;contactEmail:string|null;pinCode:string|null;bankName:string|null;accountHolder:string|null;bankBranch:string|null;accountType:string|null;upiId:string|null;addressState:string|null;addressDistrict:string|null;addressBlock:string|null;workLocation:string|null;compensationProposal:string|null};
type Row={payload_ciphertext:string;payload_nonce:string;payload_tag:string;
 payload_digest:string;record_version:number};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const id=(v:unknown)=>{
 if(typeof v!=="string"||!UUID.test(v))
  throw new BadRequestException("Choose an original employee application");
 return v;
};
const digest=(v:string)=>createHash("sha256").update(v).digest("hex");
function key(){
 const source=process.env.CG10_PII_ENCRYPTION_KEY??"";
 let bytes:Buffer;
 try{bytes=Buffer.from(source,"base64");}
 catch{throw new ServiceUnavailableException("Private employee encryption is not configured");}
 if(bytes.length!==32)
  throw new ServiceUnavailableException("Private employee encryption is not configured");
 return bytes;
}
export function parseHrPrivateDetails(value:unknown):PrivateFields{
 if(!value||typeof value!=="object"||Array.isArray(value))
  throw new BadRequestException({code:"CG10_PRIVATE_INVALID"});
 const x=value as Record<string,unknown>;
 const keys=["contactPhone","postalAddress","emergencyName","emergencyPhone",
   "pan","bankAccount","bankIfsc","fatherName","motherName","dateOfBirth","gender","bloodGroup","contactEmail","pinCode","bankName","accountHolder","bankBranch","accountType","upiId","addressState","addressDistrict","addressBlock","workLocation","compensationProposal"];
 if(Object.keys(x).some(k=>!keys.includes(k)))
  throw new BadRequestException({code:"CG10_PRIVATE_INVALID"});
 const optional=(v:unknown,max:number)=>{
  if(v===null||v===undefined||v==="")return null;
  if(typeof v!=="string"||v.trim().length>max||
    /[\u0000-\u001f\u007f]/.test(v)||v.trim().length<2)
   throw new BadRequestException({code:"CG10_PRIVATE_INVALID"});
  return v.trim().replace(/\s+/g," ");
 };
 const contactPhone=optional(x.contactPhone,20),
  emergencyPhone=optional(x.emergencyPhone,20),
  pan=optional(x.pan,10)?.toUpperCase()??null,
  bankAccount=optional(x.bankAccount,22),
  bankIfsc=optional(x.bankIfsc,11)?.toUpperCase()??null,
  contactEmail=optional(x.contactEmail,254),dateOfBirth=optional(x.dateOfBirth,10),
  bloodGroup=optional(x.bloodGroup,3)?.toUpperCase()??null,pinCode=optional(x.pinCode,6),
  compensationProposal=x.compensationProposal===null||x.compensationProposal===undefined||x.compensationProposal===""?null:x.compensationProposal,
  upiId=optional(x.upiId,128),accountType=optional(x.accountType,16)?.toUpperCase()??null;
 if([contactPhone,emergencyPhone].some(v=>v&&!/^\+?[0-9]{10,15}$/.test(v))||
   (pan&&!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan))||
   (bankAccount&&!/^[0-9]{6,22}$/.test(bankAccount))||
   (bankIfsc&&!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bankIfsc))||
   Boolean(bankAccount)!==Boolean(bankIfsc)||
   (contactEmail&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail))||
   (dateOfBirth&&(!/^(19|20)\d{2}-\d{2}-\d{2}$/.test(dateOfBirth)||Number.isNaN(Date.parse(dateOfBirth))||new Date(dateOfBirth+"T00:00:00Z").toISOString().slice(0,10)!==dateOfBirth||dateOfBirth>new Date().toISOString().slice(0,10)))||
   (bloodGroup&&!/^(A|B|AB|O)[+-]$/.test(bloodGroup))||
   (pinCode&&!/^[1-9][0-9]{5}$/.test(pinCode))||
   (upiId&&!/^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+$/.test(upiId))||
   (compensationProposal!==null&&(typeof compensationProposal!=="string"||! /^(?:[1-9]\d{0,9}|0)(?:\.\d{1,2})?$/.test(compensationProposal)||Number(compensationProposal)<=0))||
   (accountType&&!['SAVINGS','CURRENT','OTHER'].includes(accountType)))
  throw new BadRequestException({code:"CG10_PRIVATE_INVALID"});
 return {contactPhone,postalAddress:optional(x.postalAddress,700),
  emergencyName:optional(x.emergencyName,120),emergencyPhone,
  pan,bankAccount,bankIfsc,fatherName:optional(x.fatherName,120),motherName:optional(x.motherName,120),
  dateOfBirth,gender:optional(x.gender,32),bloodGroup,contactEmail,pinCode,
  bankName:optional(x.bankName,120),accountHolder:optional(x.accountHolder,120),
  bankBranch:optional(x.bankBranch,120),accountType,upiId,addressState:optional(x.addressState,100),addressDistrict:optional(x.addressDistrict,100),addressBlock:optional(x.addressBlock,100),workLocation:optional(x.workLocation,160),compensationProposal:compensationProposal as string|null};
}
function encrypt(fields:PrivateFields,realm:string,ref:string,version:number){
 const iv=randomBytes(12);
 const cipher=createCipheriv("aes-256-gcm",key(),iv);
 cipher.setAAD(Buffer.from(realm+"|"+ref+"|"+version));
 const plaintext=Buffer.from(JSON.stringify(fields),"utf8");
 const value=Buffer.concat([cipher.update(plaintext),cipher.final()]);
 return {ciphertext:value.toString("base64url"),nonce:iv.toString("base64url"),
  tag:cipher.getAuthTag().toString("base64url"),hash:digest(value.toString("base64url"))};
}
function decrypt(row:Row,realm:string,ref:string):PrivateFields{
 try{
  const decipher=createDecipheriv("aes-256-gcm",key(),
   Buffer.from(row.payload_nonce,"base64url"));
  decipher.setAAD(Buffer.from(realm+"|"+ref+"|"+row.record_version));
  decipher.setAuthTag(Buffer.from(row.payload_tag,"base64url"));
  if(digest(row.payload_ciphertext)!==row.payload_digest)
   throw Error("Ciphertext mismatch");
  const clear=Buffer.concat([decipher.update(
   Buffer.from(row.payload_ciphertext,"base64url")),decipher.final()])
   .toString("utf8");
  return parseHrPrivateDetails(JSON.parse(clear));
 }catch{
  // Nothing about source bytes, key, PAN or bank account reaches responses/logs.
  throw new ServiceUnavailableException("Protected employee information is unavailable");
 }
}
@Injectable()
export class HrPrivateDetailService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,
  private readonly source:HrEnrollmentSourceFacade){}
 private async compensationAllowed(tx:import("pg").PoolClient,actor:Awaited<ReturnType<SessionService["requireAction"]>>){
  try{await this.identity.assertCurrent(tx,actor,"hr.changes.manage");return true;}
  catch(e){if(e instanceof ForbiddenException)return false;throw e;}
 }
 /** B20 restricted upcoming birthdays: no stored plaintext dates, no public projection.
  * An explicit dashboard read processes only one bounded page and audits every
  * inspected private record. Birthday year/other PII never crosses the API. */
 async birthdays(token:string,offsetInput?:string){
  const actor=await this.sessions.requireAction(token,"hr.employees.private.view");
  await this.sessions.requireAction(token,"hr.employees.view");
  await this.sessions.requireAction(token,"hr.applications.view");
  const offset=Number(offsetInput??0);
  if(!Number.isSafeInteger(offset)||offset<0||offset>10000)throw new BadRequestException("Choose a valid birthdays page");
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   for(const action of ["hr.employees.private.view","hr.employees.view","hr.applications.view"] as const)await this.identity.assertCurrent(tx,actor,action);
   const q=await tx.query<Row&{application_id:string;legal_name:string;today:string}>(`
    WITH rights AS (SELECT EXISTS(
     SELECT 1 FROM account_role ar JOIN role r ON r.id=ar.role_id AND r.realm_id=ar.realm_id AND r.active
     LEFT JOIN role_grant g ON g.role_id=r.id AND g.capability_key='foundation.branches.admin'
     WHERE ar.realm_id=$1 AND ar.account_id=$2 AND ar.revoked_at IS NULL AND (r.is_protected OR g.capability_key IS NOT NULL)) AS full_access)
    SELECT p.payload_ciphertext,p.payload_nonce,p.payload_tag,p.payload_digest,p.record_version,
      app.id AS application_id,app.legal_name,to_char(CURRENT_DATE,'YYYY-MM-DD') AS today
    FROM hr_employee e JOIN hr_employee_application app ON app.id=e.application_id AND app.root_realm_id=e.root_realm_id
    JOIN hr_application_private p ON p.application_id=app.id AND p.root_realm_id=app.root_realm_id
    JOIN hr_employment_assignment a ON a.employee_id=e.id AND a.root_realm_id=e.root_realm_id AND a.valid_from<=CURRENT_DATE AND (a.valid_to IS NULL OR a.valid_to>CURRENT_DATE)
    JOIN branch current_branch ON current_branch.id=a.branch_ref AND current_branch.root_realm_id=a.root_realm_id AND current_branch.status='ACTIVE'
    JOIN branch origin_branch ON origin_branch.id=app.proposed_branch_ref AND origin_branch.root_realm_id=app.root_realm_id AND origin_branch.status='ACTIVE'
    CROSS JOIN rights
    WHERE e.root_realm_id=$1 AND e.status IN('ACTIVE','PROBATION')
      AND (rights.full_access OR current_branch.manager_account_ref=$2)
      AND (rights.full_access OR origin_branch.manager_account_ref=$2)
    ORDER BY e.id LIMIT 251 OFFSET $3 FOR SHARE OF app,p`,[actor.realmId,actor.accountId,offset]);
   const page=q.rows.slice(0,250);
   const items:{name:string;date:string}[]=[];
   for(const row of page){
    const birth=decrypt(row,actor.realmId,row.application_id).dateOfBirth;
    if(!birth)continue;
    const start=new Date(row.today+"T00:00:00Z");
    for(let day=0;day<30;day++){
     const next=new Date(start.getTime()+day*86400000).toISOString().slice(0,10);
     if(next.slice(5)===birth.slice(5)){items.push({name:row.legal_name,date:next});break;}
    }
   }
   if(page.length)await tx.query(`
    INSERT INTO hr_private_access_audit(root_realm_id,application_id,actor_ref,event_type,record_version)
    SELECT $1,p.application_id,$2,'PRIVATE_READ',p.record_version
    FROM unnest($3::uuid[],$4::integer[]) AS p(application_id,record_version)`,
    [actor.realmId,actor.accountId,page.map(x=>x.application_id),page.map(x=>x.record_version)]);
   await tx.query("COMMIT");
   return {items:items.sort((x,y)=>x.date.localeCompare(y.date)||x.name.localeCompare(y.name)),offset,hasMore:q.rows.length>250};
  }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
 }
 async read(token:string,applicationInput:string){
  const actor=await this.sessions.requireAction(token,"hr.employees.private.view");
  const ref=id(applicationInput),tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   await this.identity.assertCurrent(tx,actor,"hr.employees.private.view");
   await this.source.draft(tx,actor,ref,false);
   const q=await tx.query<Row>(
    "SELECT payload_ciphertext,payload_nonce,payload_tag,payload_digest,record_version "+
    "FROM hr_application_private WHERE root_realm_id=$1 AND application_id=$2 FOR SHARE",
    [actor.realmId,ref]);
   const row=q.rows[0];
   const details=row?decrypt(row,actor.realmId,ref):{
     contactPhone:null,postalAddress:null,emergencyName:null,
     emergencyPhone:null,pan:null,bankAccount:null,bankIfsc:null,fatherName:null,motherName:null,dateOfBirth:null,gender:null,bloodGroup:null,contactEmail:null,pinCode:null,bankName:null,accountHolder:null,bankBranch:null,accountType:null,upiId:null,addressState:null,addressDistrict:null,addressBlock:null,workLocation:null,compensationProposal:null};
   await tx.query(
    "INSERT INTO hr_private_access_audit(root_realm_id,application_id,actor_ref,"+
    "event_type,record_version) VALUES($1,$2,$3,'PRIVATE_READ',$4)",
    [actor.realmId,ref,actor.accountId,row?.record_version??1]);
   const canProposeCompensation=await this.compensationAllowed(tx,actor);
   const {compensationProposal,...personal}=details;
   await tx.query("COMMIT");
   return {details:canProposeCompensation?{...personal,compensationProposal}:personal,revision:row?.record_version??0,canProposeCompensation};
  }catch(e){await tx.query("ROLLBACK");throw e;}
  finally{tx.release();}
 }
 async update(token:string,applicationInput:string,value:unknown){
  const actor=await this.sessions.requireAction(token,"hr.employees.private.manage");
  const ref=id(applicationInput);
  if(!value||typeof value!=="object"||Array.isArray(value)||
   Object.keys(value as Record<string,unknown>).some(k=>!["expectedRevision","details"].includes(k))||
   !("expectedRevision" in value)||!("details" in value)||
   !Number.isSafeInteger((value as {expectedRevision:unknown}).expectedRevision)||
   Number((value as {expectedRevision:number}).expectedRevision)<0)
   throw new BadRequestException("Refresh the protected employee form");
  const expected=Number((value as {expectedRevision:number}).expectedRevision);
  const requested=(value as {details:unknown}).details;
  // Validate the submitted shape before taking a lock. Preserve fields omitted by
  // older clients, and validate the complete merged record under the version lock.
  if(!requested||typeof requested!=="object"||Array.isArray(requested))throw new BadRequestException({code:"CG10_PRIVATE_INVALID"});
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   await this.identity.assertCurrent(tx,actor,"hr.employees.private.manage");
   const app=await this.source.draft(tx,actor,ref);
   if(!["DRAFT","RETURNED"].includes(app.state))
    throw new ConflictException("Submitted employee personal evidence cannot be edited");
   const row=await tx.query<Row>(
    "SELECT payload_ciphertext,payload_nonce,payload_tag,payload_digest,record_version "+
    "FROM hr_application_private WHERE root_realm_id=$1 AND application_id=$2 FOR UPDATE",
    [actor.realmId,ref]);
   const current=row.rows[0]?.record_version??0;
   if(current!==expected)throw new ConflictException(
     "Protected employee information changed. Refresh before saving.");
   const prior=row.rows[0]?decrypt(row.rows[0],actor.realmId,ref):{};
   if(Object.hasOwn(requested,"compensationProposal")&&!(await this.compensationAllowed(tx,actor)))throw new ForbiddenException("Your role cannot manage compensation proposals");
   const data=parseHrPrivateDetails({...prior,...requested});
   const next=current+1,encrypted=encrypt(data,actor.realmId,ref,next);
   if(encrypted.ciphertext.length>8192)throw new BadRequestException({code:"CG10_PRIVATE_INVALID"});
   const updated=await tx.query(
    "INSERT INTO hr_application_private(application_id,root_realm_id,"+
    "payload_ciphertext,payload_nonce,payload_tag,payload_digest,record_version,"+
    "updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) "+
    "ON CONFLICT(root_realm_id,application_id) DO UPDATE SET "+
    "payload_ciphertext=EXCLUDED.payload_ciphertext,"+
    "payload_nonce=EXCLUDED.payload_nonce,payload_tag=EXCLUDED.payload_tag,"+
    "payload_digest=EXCLUDED.payload_digest,record_version=EXCLUDED.record_version,"+
    "updated_by=EXCLUDED.updated_by,updated_at=now() "+
    "WHERE hr_application_private.record_version=$9",
    [ref,actor.realmId,encrypted.ciphertext,encrypted.nonce,encrypted.tag,
     encrypted.hash,next,actor.accountId,expected]);
   if(!updated.rowCount)
    throw new ConflictException("Protected employee details were changed. Refresh before retrying.");
   await tx.query(
    "INSERT INTO hr_private_access_audit(root_realm_id,application_id,actor_ref,"+
    "event_type,record_version) VALUES($1,$2,$3,'PRIVATE_WRITE',$4)",
    [actor.realmId,ref,actor.accountId,next]);
   await tx.query("COMMIT");
   return {saved:true,revision:next,
    message:"Protected employee details saved. No approval or access permission was granted."};
  }catch(e){await tx.query("ROLLBACK");throw e;}
  finally{tx.release();}
 }
}
