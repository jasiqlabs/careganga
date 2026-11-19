import {
 BadRequestException,ConflictException,HttpException,HttpStatus,Inject,Injectable,
 ServiceUnavailableException
} from "@nestjs/common";
import {createHmac} from "node:crypto";
import type {Pool} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {hashPassword} from "../domain/secret-crypto";

const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const MOBILE=/^[6-9][0-9]{9}$/;
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type Command={request_digest:string;account_id:string|null};
function secret(){
 const key=Buffer.from(process.env.IDENTITY_ENCRYPTION_KEY??"","base64");
 if(key.length!==32)throw new ServiceUnavailableException({
  code:"CG01_PUBLIC_SIGNUP_UNAVAILABLE"});
 return key;
}
const hash=(key:Buffer,s:string)=>createHmac("sha256",key).update(s).digest("hex");
function providerConfigured(){
 const sid=process.env.CG01_VERIFY_TWILIO_ACCOUNT_SID??"";
 const token=process.env.CG01_VERIFY_TWILIO_AUTH_TOKEN??"";
 const service=process.env.CG01_VERIFY_TWILIO_SERVICE_SID??"";
 const hmac=process.env.CG01_MOBILE_PROOF_HMAC_KEY??"";
 return process.env.CG01_PHONE_VERIFICATION_ENABLED==="1"&&
  /^AC[a-f0-9]{32}$/i.test(sid)&&token.length>=20&&
  /^VA[a-f0-9]{32}$/i.test(service)&&hmac.length>=32;
}
@Injectable()
export class PublicPatientSignupService{
 constructor(@Inject(DATABASE)private readonly db:Pool){}
 private async provider(path:"Verifications"|"VerificationCheck",form:URLSearchParams){
  if(!providerConfigured())
   throw new ServiceUnavailableException({code:"CG01_PUBLIC_SIGNUP_UNAVAILABLE"});
  const sid=process.env.CG01_VERIFY_TWILIO_ACCOUNT_SID!;
  const token=process.env.CG01_VERIFY_TWILIO_AUTH_TOKEN!;
  const service=process.env.CG01_VERIFY_TWILIO_SERVICE_SID!;
  let response:Response;
  try{
   response=await fetch(
    "https://verify.twilio.com/v2/Services/"+service+"/"+path,{
     method:"POST",signal:AbortSignal.timeout(12000),
     headers:{"Authorization":"Basic "+Buffer.from(sid+":"+token).toString("base64"),
      "Content-Type":"application/x-www-form-urlencoded"},
     body:form.toString()
    });
  }catch{throw new ServiceUnavailableException({code:"CG01_PUBLIC_SIGNUP_UNAVAILABLE"});}
  if(response.status===429)
   throw new HttpException({code:"CG01_PUBLIC_SIGNUP_LIMIT"},HttpStatus.TOO_MANY_REQUESTS);
  if(!response.ok){
   if(path==="VerificationCheck"&&[400,404].includes(response.status))
    throw new BadRequestException({code:"CG01_PUBLIC_SIGNUP_CODE_INVALID"});
   throw new ServiceUnavailableException({code:"CG01_PUBLIC_SIGNUP_UNAVAILABLE"});
  }
  const data:unknown=await response.json().catch(()=>null);
  if(!data||typeof data!=="object"||!("status" in data)||
   typeof data.status!=="string")
   throw new ServiceUnavailableException({code:"CG01_PUBLIC_SIGNUP_UNAVAILABLE"});
  return data.status;
 }
 async requestCode(raw:unknown,remote:string){
  if(!raw||typeof raw!=="object"||Array.isArray(raw)||
   Object.keys(raw).length!==1||!("mobile" in raw)||
   typeof raw.mobile!=="string"||!MOBILE.test(raw.mobile.trim()))
   throw new BadRequestException({code:"CG01_PUBLIC_SIGNUP_INVALID"});
  const mobile=raw.mobile.trim(),key=secret();
  await this.attempt(remote,mobile,key,"start");
  const form=new URLSearchParams({To:"+91"+mobile,Channel:"sms"});
  const status=await this.provider("Verifications",form);
  if(status!=="pending"&&status!=="approved")
   throw new ServiceUnavailableException({code:"CG01_PUBLIC_SIGNUP_UNAVAILABLE"});
  return {status:"CODE_REQUESTED_UNCONFIRMED_DELIVERY" as const,
   message:"A code was requested for the provided mobile. Delivery may be delayed."};
 }
 private async attempt(remote:string,mobile:string,key:Buffer,mode:"start"|"finish"){
  // Do not trust a body/header-supplied address. The controller supplies the
  // same transport-derived request.ip used in the original CG01 login.
  const buckets=[
   {label:"public-patient-"+mode+"-network",value:remote,
    limit:mode==="start"?12:24,window:900},
   {label:"public-patient-"+mode+"-mobile",value:mobile,
    limit:mode==="start"?5:10,window:86400}
  ];
  for(const b of buckets){
   const result=await this.db.query<{attempt_count:number}>(
    "INSERT INTO auth_login_attempt(key_digest,window_started_at,attempt_count) "+
    "VALUES($1,now(),1) ON CONFLICT(key_digest) DO UPDATE SET "+
    "attempt_count=CASE WHEN auth_login_attempt.window_started_at<"+
    "now()-make_interval(secs=>$2) THEN 1 ELSE "+
    "LEAST(auth_login_attempt.attempt_count+1,2147483647) END,"+
    "window_started_at=CASE WHEN auth_login_attempt.window_started_at<"+
    "now()-make_interval(secs=>$2) THEN now() "+
    "ELSE auth_login_attempt.window_started_at END RETURNING attempt_count",
    [hash(key,b.label+":"+b.value),b.window]);
   if((result.rows[0]?.attempt_count??b.limit+1)>b.limit)
    throw new HttpException({code:"CG01_PUBLIC_SIGNUP_LIMIT"},HttpStatus.TOO_MANY_REQUESTS);
  }
 }
 async register(raw:unknown,remote:string){
  if(!raw||typeof raw!=="object"||Array.isArray(raw))
   throw new BadRequestException({code:"CG01_PUBLIC_SIGNUP_INVALID"});
  const v=raw as Record<string,unknown>;
  if(Object.keys(v).some(k=>![
   "requestKey","firstName","lastName","mobile","email","password","code"].includes(k)))
   throw new BadRequestException({code:"CG01_PUBLIC_SIGNUP_INVALID"});
  const requestKey=v.requestKey,firstName=v.firstName,lastName=v.lastName,
   mobile=v.mobile,email=v.email,password=v.password,code=v.code;
  if(typeof requestKey!=="string"||!ID.test(requestKey)||
   typeof firstName!=="string"||firstName.trim().length<2||
   firstName.trim().length>100||/[\u0000-\u001f\u007f<>]/.test(firstName)||
   typeof lastName!=="string"||lastName.trim().length<1||
   lastName.trim().length>100||/[\u0000-\u001f\u007f<>]/.test(lastName)||
   typeof mobile!=="string"||!MOBILE.test(mobile.trim())||
   email!==undefined&&email!==null&&email!==""&&
    (typeof email!=="string"||!EMAIL.test(email.trim())||email.length>254)||
   typeof code!=="string"||!/^[0-9]{4,10}$/.test(code)||
   typeof password!=="string"||password.length<8||
   Buffer.byteLength(password,"utf8")>1024)
   throw new BadRequestException({code:"CG01_PUBLIC_SIGNUP_INVALID"});
  const safeFirst=firstName.trim().replace(/\s+/g," "),
   safeLast=lastName.trim().replace(/\s+/g," ");
  const normalizedEmail=typeof email==="string"&&email.trim()?
   email.trim().toLowerCase():null;
  const digits=mobile.trim(),key=secret();
  if(!providerConfigured())
   throw new ServiceUnavailableException({code:"CG01_PUBLIC_SIGNUP_UNAVAILABLE"});
  await this.attempt(remote,digits,key,"finish");
  const signature=hash(key,JSON.stringify({safeFirst,safeLast,digits,
   normalizedEmail,password,code}));
  // Keep external SMS verification and password hashing OUTSIDE PostgreSQL
  // transactions; recheck the idempotency key under a row lock before insert.
  const realm=await this.db.query<{id:string}>(
   "SELECT id FROM access_realm WHERE realm_key='FOUNDATION_ROOT'");
  if(!realm.rows[0])throw new ServiceUnavailableException({
   code:"CG01_PUBLIC_SIGNUP_UNAVAILABLE"});
  const root=realm.rows[0].id;
  const replay=await this.db.query<Command>(
   "SELECT request_digest,account_id FROM cg01_public_patient_signup_command "+
   "WHERE root_realm_id=$1 AND request_key=$2",
   [root,requestKey]);
  if(replay.rows[0]){
   if(replay.rows[0].request_digest!==signature)
    throw new ConflictException({code:"CG01_PUBLIC_SIGNUP_CONFLICT"});
   if(replay.rows[0].account_id)
    return {status:"ACCOUNT_CREATED" as const,
     nextStep:"SIGN_IN_THEN_CREATE_PATIENT_PROFILE" as const};
  }
  const check=await this.provider("VerificationCheck",
   new URLSearchParams({To:"+91"+digits,Code:code}));
  if(check!=="approved")
   throw new BadRequestException({code:"CG01_PUBLIC_SIGNUP_CODE_INVALID"});
  const passwordHash=await hashPassword(password);
  const tx=await this.db.connect();let open=false;
  try{
   await tx.query("BEGIN");open=true;
   await tx.query(
    "INSERT INTO cg01_public_patient_signup_command(root_realm_id,request_key,request_digest) "+
    "VALUES($1,$2,$3) ON CONFLICT(root_realm_id,request_key) DO NOTHING",
    [root,requestKey,signature]);
   const cmd=await tx.query<Command>(
    "SELECT request_digest,account_id FROM cg01_public_patient_signup_command "+
    "WHERE root_realm_id=$1 AND request_key=$2 FOR UPDATE",
    [root,requestKey]);
   const saved=cmd.rows[0];
   if(!saved||saved.request_digest!==signature)
    throw new ConflictException({code:"CG01_PUBLIC_SIGNUP_CONFLICT"});
   if(saved.account_id){
    await tx.query("COMMIT");open=false;
    return {status:"ACCOUNT_CREATED" as const,
     nextStep:"SIGN_IN_THEN_CREATE_PATIENT_PROFILE" as const};
   }
   const role=await tx.query<{id:string}>(
    "SELECT r.id FROM role r WHERE r.realm_id=$1 "+
    "AND r.normalized_name='careganga patient' AND r.active AND NOT r.is_protected "+
    "AND NOT EXISTS(SELECT 1 FROM role_grant g WHERE g.role_id=r.id) "+
    "FOR SHARE OF r",[root]);
   if(!role.rows[0])throw new ServiceUnavailableException({
    code:"CG01_PUBLIC_SIGNUP_UNAVAILABLE"});
   // Verified SMS proof was obtained before BEGIN. Concurrent requests
   // with the same key are reconciled by the FOR UPDATE replay above.
   const newAccount=await tx.query<{id:string}>(
    "INSERT INTO account(realm_id,display_name,normalized_mobile,"+
    "normalized_email,contact_phone,contact_phone_verified_at,status) "+
    "VALUES($1,$2,$3,$4,$5,now(),'ACTIVE') RETURNING id",
    [root,safeFirst+" "+safeLast,digits,normalizedEmail,"+91"+digits]);
   const id=newAccount.rows[0].id;
   await tx.query(
    "INSERT INTO identity_credential(account_id,password_hash) VALUES($1,$2)",
    [id,passwordHash]);
   await tx.query(
    "INSERT INTO account_role(account_id,role_id,realm_id) VALUES($1,$2,$3)",
    [id,role.rows[0].id,root]);
   await tx.query(
    "UPDATE cg01_public_patient_signup_command SET account_id=$3 "+
    "WHERE root_realm_id=$1 AND request_key=$2",[root,requestKey,id]);
   await tx.query("COMMIT");open=false;
   return {status:"ACCOUNT_CREATED" as const,
    nextStep:"SIGN_IN_THEN_CREATE_PATIENT_PROFILE" as const};
  }catch(error){
   if(open)await tx.query("ROLLBACK");
   if(error&&typeof error==="object"&&"code" in error&&error.code==="23505")
    throw new ConflictException({code:"CG01_PUBLIC_SIGNUP_EXISTS"});
   throw error;
  }finally{tx.release();}
 }
}
