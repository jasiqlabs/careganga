import {
 BadRequestException,ConflictException,Inject,Injectable,
 NotFoundException,ServiceUnavailableException
} from "@nestjs/common";
import {createHash,createHmac,randomBytes} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade}
 from "../../cg-01-identity-access/application/foundation-structure-identity.facade";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RECEIPT=/^[A-Za-z0-9_-]{43}$/;
const TYPES=["HOSPITAL","CLINIC","DIAGNOSTIC_LAB","DOCTOR",
 "PHARMACY","NURSING","SURGERY_CENTER"] as const;
const CONTROL=/[\u0000-\u001f\u007f<>]/;
type Application={
 requestKey:string;partnerType:typeof TYPES[number];applicantName:string;
 contactName:string;contactPhone:string;contactEmail:string|null;
 registrationNumber:string|null;addressLine:string;districtName:string;
 stateName:string;pinCode:string;consentAccepted:true;
};
function input(value:unknown):Record<string,unknown>{
 if(!value||typeof value!=="object"||Array.isArray(value))
  throw new BadRequestException({code:"PARTNER_FIELD_INVALID"});
 return value as Record<string,unknown>;
}
function clean(value:unknown,field:string,min:number,max:number):string{
 if(typeof value!=="string"||CONTROL.test(value))
  throw new BadRequestException({code:"PARTNER_FIELD_INVALID",field});
 const text=value.trim().replace(/\s+/g," ");
 if(text.length<min||text.length>max)
  throw new BadRequestException({code:"PARTNER_FIELD_INVALID",field});
 return text;
}
function optional(value:unknown,field:string,max:number):string|null{
 if(value===undefined||value===null||value==="")return null;
 return clean(value,field,1,max);
}
function parse(value:unknown):Application{
 const obj=input(value);
 const fields=["requestKey","partnerType","applicantName","contactName",
  "contactPhone","contactEmail","registrationNumber","addressLine",
  "districtName","stateName","pinCode","consentAccepted"];
 if(Object.keys(obj).some(x=>!fields.includes(x)))
  throw new BadRequestException({code:"PARTNER_FIELD_INVALID"});
 const requestKey=clean(obj.requestKey,"requestKey",36,36);
 if(!UUID.test(requestKey))throw new BadRequestException({
  code:"PARTNER_FIELD_INVALID",field:"requestKey"});
 const partnerType=obj.partnerType;
 if(typeof partnerType!=="string"||!TYPES.includes(partnerType as typeof TYPES[number]))
  throw new BadRequestException({code:"PARTNER_FIELD_INVALID",field:"partnerType"});
 const contactPhone=clean(obj.contactPhone,"contactPhone",10,16);
 if(!/^[+]?[0-9]{10,15}$/.test(contactPhone))
  throw new BadRequestException({code:"PARTNER_FIELD_INVALID",field:"contactPhone"});
 const pinCode=clean(obj.pinCode,"pinCode",6,6);
 if(!/^[1-9][0-9]{5}$/.test(pinCode))
  throw new BadRequestException({code:"PARTNER_FIELD_INVALID",field:"pinCode"});
 const email=optional(obj.contactEmail,"contactEmail",180)?.toLowerCase()??null;
 if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  throw new BadRequestException({code:"PARTNER_FIELD_INVALID",field:"contactEmail"});
 if(obj.consentAccepted!==true)
  throw new BadRequestException({code:"PARTNER_CONSENT_REQUIRED",field:"consentAccepted"});
 const registrationNumber=optional(obj.registrationNumber,"registrationNumber",120);
 if(partnerType==="DOCTOR"&&!registrationNumber)
  throw new BadRequestException({code:"PARTNER_FIELD_INVALID",field:"registrationNumber"});
 return {requestKey,partnerType:partnerType as Application["partnerType"],
  applicantName:clean(obj.applicantName,"applicantName",2,180),
  contactName:clean(obj.contactName,"contactName",2,120),
  contactPhone,contactEmail:email,registrationNumber,
  addressLine:clean(obj.addressLine,"addressLine",5,300),
  districtName:clean(obj.districtName,"districtName",2,100),
  stateName:clean(obj.stateName,"stateName",2,100),
  pinCode,consentAccepted:true};
}
const digest=(value:unknown)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
function signingKey():Buffer{
 const raw=Buffer.from(process.env.IDENTITY_ENCRYPTION_KEY??"","base64");
 if(raw.length!==32)throw new ServiceUnavailableException(
  "Partner registration is temporarily unavailable.");
 return createHmac("sha256",raw).update("cg14-partner-application-receipt-v1").digest();
}
const receipt=(root:string,key:string,bodyDigest:string)=>createHmac("sha256",signingKey())
 .update(root+":"+key+":"+bodyDigest).digest("base64url");
const hashReceipt=(token:string)=>createHash("sha256").update(token).digest("hex");
const ref=()=> "CGPA-"+randomBytes(6).toString("hex").toUpperCase();
function uuid(value:unknown,field:string){
 if(typeof value!=="string"||!UUID.test(value))
  throw new BadRequestException({code:"PARTNER_FIELD_INVALID",field});
 return value;
}
function version(value:unknown){
 if(!Number.isSafeInteger(value)||Number(value)<1||Number(value)>2147483646)
  throw new BadRequestException({code:"PARTNER_VERSION_INVALID"});
 return Number(value);
}
function simpleStatus(state:string):string{
 return state==="LINKED"?"FOUNDATION_REVIEW":state;
}

@Injectable()
export class HealthPartnerApplicationsService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade){}

 private async foundationRoot():Promise<string>{
  const r=await this.db.query<{id:string}>(
   "SELECT id FROM access_realm WHERE realm_key='FOUNDATION_ROOT' LIMIT 1");
  if(!r.rows[0])throw new ServiceUnavailableException(
   "Partner registration is temporarily unavailable.");
  return r.rows[0].id;
 }
 private async transaction<T>(task:(client:PoolClient)=>Promise<T>):Promise<T>{
  const client=await this.db.connect();let open=false;
  try{
   await client.query("BEGIN");open=true;
   await client.query("SET LOCAL lock_timeout='3s'");
   await client.query("SET LOCAL statement_timeout='12s'");
   const result=await task(client);
   await client.query("COMMIT");open=false;
   return result;
  }catch(e){
   if(open)try{await client.query("ROLLBACK");}catch{}
   throw e;
  }finally{client.release();}
 }

 /** Only pending original CG14 intake. A public application is NEVER a provider,
  * professional license, CG01 account, CG03 approval, offer or CG17 benefit. */
 async apply(body:unknown){
  const data=parse(body),root=await this.foundationRoot();
  const payload={partnerType:data.partnerType,applicantName:data.applicantName,
   contactName:data.contactName,contactPhone:data.contactPhone,
   contactEmail:data.contactEmail,registrationNumber:data.registrationNumber,
   addressLine:data.addressLine,districtName:data.districtName,
   stateName:data.stateName,pinCode:data.pinCode,consentAccepted:true};
  const source=digest(payload);
  const token=receipt(root,data.requestKey,source);
  const reference=ref();
  const created=await this.db.query<{reference_code:string;request_digest:string}>(
   "INSERT INTO health_partner_application(root_realm_id,reference_code,"+
   "receipt_digest,request_key,request_digest,partner_type,applicant_name,"+
   "contact_name,contact_phone,contact_email,registration_number,address_line,"+
   "district_name,state_name,pin_code) "+
   "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) "+
   "ON CONFLICT(root_realm_id,request_key) DO NOTHING "+
   "RETURNING reference_code,request_digest",
   [root,reference,hashReceipt(token),data.requestKey,source,data.partnerType,
    data.applicantName,data.contactName,data.contactPhone,data.contactEmail,
    data.registrationNumber,data.addressLine,data.districtName,
    data.stateName,data.pinCode]);
  let row=created.rows[0];
  if(!row){
   const previous=await this.db.query<{reference_code:string;request_digest:string}>(
    "SELECT reference_code,request_digest FROM health_partner_application "+
    "WHERE root_realm_id=$1 AND request_key=$2",
    [root,data.requestKey]);
   row=previous.rows[0];
   if(!row||row.request_digest!==source)
    throw new ConflictException({code:"PARTNER_REQUEST_CONFLICT"});
  }
  return {reference:row.reference_code,receipt:token,status:"PENDING",
   message:"Application received. Foundation verification is still required."};
 }
 async status(body:unknown){
  const obj=input(body);
  if(Object.keys(obj).some(x=>x!=="receipt")||
    typeof obj.receipt!=="string"||!RECEIPT.test(obj.receipt))
   throw new BadRequestException({code:"PARTNER_RECEIPT_INVALID"});
  const root=await this.foundationRoot();
  const result=await this.db.query<{reference_code:string;status:string}>(
   "SELECT reference_code,status FROM health_partner_application "+
   "WHERE root_realm_id=$1 AND receipt_digest=$2",
   [root,hashReceipt(obj.receipt)]);
  if(!result.rows[0])throw new NotFoundException({code:"PARTNER_RECEIPT_UNAVAILABLE"});
  return {reference:result.rows[0].reference_code,
   status:simpleStatus(result.rows[0].status),
   message:"Foundation review status only. Registration is not automatic approval."};
 }
 async list(bearer:string,status="ALL",offset=0){
  const actor=await this.sessions.requireAction(bearer,"health.providers.view");
  if(!["ALL","PENDING","IN_REVIEW","RETURNED","DECLINED","LINKED"].includes(status)||
   !Number.isInteger(offset)||offset<0||offset>10000)
   throw new BadRequestException({code:"PARTNER_FIELD_INVALID"});
  const result=await this.db.query<{
   id:string;reference_code:string;partner_type:string;applicant_name:string;
   contact_name:string;contact_phone:string;contact_email:string|null;
   registration_number:string|null;address_line:string;district_name:string;
   state_name:string;pin_code:string;status:string;revision:number;
   received_at:Date;review_note:string|null;linked_provider_id:string|null;
   linked_doctor_id:string|null
  }>("SELECT id,reference_code,partner_type,applicant_name,contact_name,"+
    "contact_phone,contact_email,registration_number,address_line,district_name,"+
    "state_name,pin_code,status,revision,received_at,review_note,"+
    "linked_provider_id,linked_doctor_id FROM health_partner_application "+
    "WHERE root_realm_id=$1 AND ($2::text='ALL' OR status=$2) "+
    "ORDER BY received_at DESC,id DESC LIMIT 51 OFFSET $3",
    [actor.realmId,status,offset]);
  return {applications:result.rows.slice(0,50).map(a=>({
   applicationRef:a.id,reference:a.reference_code,
   type:a.partner_type,name:a.applicant_name,contactName:a.contact_name,
   phone:a.contact_phone,email:a.contact_email,
   registrationNumber:a.registration_number,address:a.address_line,
   district:a.district_name,state:a.state_name,pinCode:a.pin_code,
   status:a.status,revision:a.revision,receivedAt:a.received_at,
   reviewNote:a.review_note,linkedProviderRef:a.linked_provider_id,
   linkedDoctorRef:a.linked_doctor_id
  })),nextOffset:result.rows.length>50?offset+50:null};
 }
 async decide(bearer:string,applicationRef:string,body:unknown){
  const actor=await this.sessions.requireAction(bearer,"health.providers.manage");
  const id=uuid(applicationRef,"applicationRef"),obj=input(body);
  if(Object.keys(obj).some(x=>!["expectedVersion","status","reviewNote"].includes(x))||
   !["IN_REVIEW","RETURNED","DECLINED"].includes(String(obj.status)))
   throw new BadRequestException({code:"PARTNER_FIELD_INVALID"});
  const v=version(obj.expectedVersion),note=clean(obj.reviewNote,"reviewNote",5,500);
  return this.transaction(async tx=>{
   await this.identity.assertCurrent(tx,actor,"health.providers.manage");
   const r=await tx.query<{status:string;revision:number}>(
    "SELECT status,revision FROM health_partner_application "+
    "WHERE root_realm_id=$1 AND id=$2 FOR UPDATE",[actor.realmId,id]);
   if(!r.rows[0])throw new NotFoundException({code:"PARTNER_APPLICATION_UNAVAILABLE"});
   if(r.rows[0].revision!==v)throw new ConflictException({code:"PARTNER_VERSION_CHANGED"});
   if(r.rows[0].status==="LINKED"||r.rows[0].status==="DECLINED")
    throw new ConflictException({code:"PARTNER_REVIEW_CLOSED"});
   const status=String(obj.status);
   await tx.query("UPDATE health_partner_application SET status=$3,"+
    "revision=revision+1,review_note=$4,reviewed_by=$5,reviewed_at=now() "+
    "WHERE root_realm_id=$1 AND id=$2",
    [actor.realmId,id,status,note,actor.accountId]);
   return {status,version:v+1,
    message:"Application review updated; this has not approved a provider."};
  });
 }
 async linkOriginal(bearer:string,applicationRef:string,body:unknown){
  const actor=await this.sessions.requireAction(bearer,"health.providers.manage");
  const id=uuid(applicationRef,"applicationRef"),obj=input(body);
  if(Object.keys(obj).some(x=>!["expectedVersion","providerRef","doctorRef"].includes(x))||
    Boolean(obj.providerRef)===Boolean(obj.doctorRef))
   throw new BadRequestException({code:"PARTNER_FIELD_INVALID"});
  const target=uuid(obj.providerRef??obj.doctorRef,"originalRef");
  const v=version(obj.expectedVersion);
  return this.transaction(async tx=>{
   await this.identity.assertCurrent(tx,actor,"health.providers.manage");
   const row=await tx.query<{partner_type:string;applicant_name:string;
    contact_phone:string;registration_number:string|null;
    status:string;revision:number}>(
     "SELECT partner_type,applicant_name,contact_phone,registration_number,"+
     "status,revision FROM health_partner_application "+
     "WHERE root_realm_id=$1 AND id=$2 FOR UPDATE",[actor.realmId,id]);
   const current=row.rows[0];
   if(!current)throw new NotFoundException({code:"PARTNER_APPLICATION_UNAVAILABLE"});
   if(current.revision!==v)throw new ConflictException({code:"PARTNER_VERSION_CHANGED"});
   if(current.status==="LINKED"||current.status==="DECLINED")
    throw new ConflictException({code:"PARTNER_REVIEW_CLOSED"});
   if(obj.doctorRef){
    if(current.partner_type!=="DOCTOR")
     throw new BadRequestException({code:"PARTNER_SOURCE_MISMATCH"});
    const doctor=await tx.query<{full_name:string;registration_number:string}>(
     "SELECT full_name,registration_number FROM health_doctor "+
     "WHERE root_realm_id=$1 AND id=$2",[actor.realmId,target]);
    if(!doctor.rows[0]||
      doctor.rows[0].full_name.toLowerCase()!==current.applicant_name.toLowerCase()||
      doctor.rows[0].registration_number.replace(/[\s\/-]+/g,"").toLowerCase()!==
       (current.registration_number??"").replace(/[\s\/-]+/g,"").toLowerCase())
     throw new ConflictException({code:"PARTNER_SOURCE_MISMATCH"});
   }else{
    if(current.partner_type==="DOCTOR")
     throw new BadRequestException({code:"PARTNER_SOURCE_MISMATCH"});
    const source=await tx.query<{legal_name:string;contact_phone:string;provider_type:string}>(
     "SELECT legal_name,contact_phone,provider_type FROM health_provider "+
     "WHERE root_realm_id=$1 AND id=$2",[actor.realmId,target]);
    const p=source.rows[0];
    const expected=current.partner_type==="SURGERY_CENTER"?
     ["HOSPITAL","CLINIC"]: [current.partner_type];
    if(!p||p.legal_name.toLowerCase()!==current.applicant_name.toLowerCase()||
      p.contact_phone!==current.contact_phone||!expected.includes(p.provider_type))
     throw new ConflictException({code:"PARTNER_SOURCE_MISMATCH"});
   }
   await tx.query("UPDATE health_partner_application SET status='LINKED',"+
    "linked_provider_id=$3,linked_doctor_id=$4,revision=revision+1,"+
    "reviewed_by=$5,reviewed_at=now() WHERE root_realm_id=$1 AND id=$2",
    [actor.realmId,id,obj.providerRef??null,obj.doctorRef??null,actor.accountId]);
   return {status:"FOUNDATION_REVIEW",version:v+1,
    message:"Linked to original CG14 source. Independent verification and publication still apply."};
  });
 }
}
