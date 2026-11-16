import {
  BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,
  ServiceUnavailableException,TooManyRequestsException
} from "@nestjs/common";
import {createHmac,randomUUID} from "node:crypto";
import type {Pool} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "./session.service";

type Contact={id:string;realm_id:string;contact_phone:string|null;
  contact_phone_verified_at:Date|null;status:string};
type Challenge={account_id:string;realm_id:string;phone_fingerprint:string;
  request_key:string;attempts:number;requested_at:Date;expires_at:Date;
  verified_at:Date|null;status:string};
const E164=/^\+[1-9][0-9]{7,14}$/;
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
/** Account verified-contact proof remains CG-01-owned. The OTP is generated,
 * sent and checked only by Twilio Verify and never stored in our database.
 * No CG-19 general notification is used for authentication proof.
 */
@Injectable()
export class MobileVerificationService{
  constructor(@Inject(DATABASE)private readonly db:Pool,
    private readonly sessions:SessionService){}
  private config(){
    const sid=process.env.CG01_VERIFY_TWILIO_ACCOUNT_SID?.trim()??"";
    const token=process.env.CG01_VERIFY_TWILIO_AUTH_TOKEN?.trim()??"";
    const verify=process.env.CG01_VERIFY_TWILIO_SERVICE_SID?.trim()??"";
    const hmac=process.env.CG01_MOBILE_PROOF_HMAC_KEY??"";
    if(process.env.CG01_PHONE_VERIFICATION_ENABLED!=="1"||
      !/^AC[a-f0-9]{32}$/i.test(sid)||token.length<20||
      !/^VA[a-f0-9]{32}$/i.test(verify)||hmac.length<32)
      throw new ServiceUnavailableException(
        "Verified mobile contact service is unavailable");
    return {sid,token,verify,hmac};
  }
  private fingerprint(phone:string,key:string){
    return createHmac("sha256",key).update(phone).digest("hex");
  }
  private async person(actor:{accountId:string;realmId:string}){
    const data=await this.db.query<Contact>(`
      SELECT id,realm_id,contact_phone,contact_phone_verified_at,status
      FROM account WHERE id=$1 AND realm_id=$2
    `,[actor.accountId,actor.realmId]);
    const row=data.rows[0];
    if(!row||row.status!=="ACTIVE")throw new ForbiddenException(
      "Current account cannot verify mobile contact");
    return row;
  }
  async status(bearer:string){
    const actor=await this.sessions.verifySession(bearer);
    const row=await this.person(actor);
    const verified=!!row.contact_phone_verified_at;
    return {hasNumber:!!row.contact_phone,verified,
      maskedContact:row.contact_phone?"••••"+row.contact_phone.slice(-4):null,
      verifiedAt:row.contact_phone_verified_at?.toISOString()??null,
      channel:"SMS",providerConfigured:
        process.env.CG01_PHONE_VERIFICATION_ENABLED==="1"};
  }
  private async provider(path:string,body:URLSearchParams){
    const cfg=this.config();
    const response=await fetch(
      "https://verify.twilio.com/v2/Services/"+cfg.verify+"/"+path,{
        method:"POST",signal:AbortSignal.timeout(12000),
        headers:{"Authorization":"Basic "+Buffer.from(
          cfg.sid+":"+cfg.token).toString("base64"),
          "Content-Type":"application/x-www-form-urlencoded"},
        body:body.toString()
      });
    if(response.status===429)throw new TooManyRequestsException(
      "Mobile verification rate limit reached");
    if(!response.ok)throw new ServiceUnavailableException(
      "Mobile proof could not be confirmed by the provider");
    const info:unknown=await response.json();
    if(!info||typeof info!=="object"||!("status" in info)||
      typeof info.status!=="string")
      throw new ServiceUnavailableException("Mobile proof response unavailable");
    return info.status;
  }
  async start(bearer:string){
    const actor=await this.sessions.verifySession(bearer);
    const cfg=this.config();
    const client=await this.db.connect();let open=false;
    let phone:string|null=null;
    try{
      await client.query("BEGIN");open=true;
      const rows=await client.query<Contact>(`
        SELECT id,realm_id,contact_phone,contact_phone_verified_at,status
        FROM account WHERE id=$1 AND realm_id=$2 FOR UPDATE
      `,[actor.accountId,actor.realmId]);
      const person=rows.rows[0];
      if(!person||person.status!=="ACTIVE")throw new ForbiddenException();
      if(person.contact_phone_verified_at){
        await client.query("COMMIT");open=false;
        return {status:"ALREADY_VERIFIED"};
      }
      if(!person.contact_phone||!E164.test(person.contact_phone))
        throw new BadRequestException(
          "A valid Foundation contact number must be recorded first");
      const prior=await client.query<Challenge>(`
        SELECT * FROM cg01_mobile_verification
        WHERE account_id=$1 AND realm_id=$2 FOR UPDATE
      `,[actor.accountId,actor.realmId]);
      const prev=prior.rows[0],now=Date.now();
      if(prev&&now-prev.requested_at.getTime()<90_000){
        await client.query("COMMIT");open=false;
        return {status:"PREVIOUS_REQUEST_PENDING",
          message:"Check your original code before requesting another"};
      }
      if(prev&&prev.attempts>=5&&now-prev.requested_at.getTime()<86400_000)
        throw new TooManyRequestsException("Too many mobile proof attempts");
      const fingerprint=this.fingerprint(person.contact_phone,cfg.hmac);
      await client.query(`
        INSERT INTO cg01_mobile_verification(
          account_id,realm_id,phone_fingerprint,request_key,
          attempts,requested_at,expires_at,verified_at,status)
        VALUES($1,$2,$3,$4,0,now(),now()+interval '10 minutes',NULL,'PENDING')
        ON CONFLICT(account_id) DO UPDATE SET
          phone_fingerprint=EXCLUDED.phone_fingerprint,
          request_key=EXCLUDED.request_key,attempts=0,requested_at=now(),
          expires_at=EXCLUDED.expires_at,verified_at=NULL,status='PENDING',
          revision=cg01_mobile_verification.revision+1
      `,[actor.accountId,actor.realmId,fingerprint,randomUUID()]);
      await client.query(`
        INSERT INTO cg01_mobile_verification_event(realm_id,account_id,action)
        VALUES($1,$2,'REQUESTED')
      `,[actor.realmId,actor.accountId]);
      phone=person.contact_phone;
      await client.query("COMMIT");open=false;
    }catch(e){if(open)try{await client.query("ROLLBACK");}catch{};throw e;}
    finally{client.release();}
    if(!phone)throw new ServiceUnavailableException("Current contact is unavailable");
    try{
      const state=await this.provider("Verifications",
        new URLSearchParams({To:phone,Channel:"sms"}));
      if(state!=="pending")
        throw new ServiceUnavailableException(
          "Mobile verification was not accepted by the provider");
      await this.db.query(`
        INSERT INTO cg01_mobile_verification_event(realm_id,account_id,action)
        VALUES($1,$2,'PROVIDER_ACCEPTED')
      `,[actor.realmId,actor.accountId]);
      return {status:"CODE_REQUESTED_UNCONFIRMED_DELIVERY",
        message:"A code was requested; receipt is not guaranteed"};
    }catch{
      await this.db.query(`
        INSERT INTO cg01_mobile_verification_event(realm_id,account_id,action)
        VALUES($1,$2,'PROVIDER_UNKNOWN')
      `,[actor.realmId,actor.accountId]).catch(()=>undefined);
      return {status:"PROVIDER_UNKNOWN",
        message:"The request outcome is uncertain; wait before requesting again"};
    }
  }
  async confirm(bearer:string,body:unknown){
    const actor=await this.sessions.verifySession(bearer);
    if(!body||typeof body!=="object"||Array.isArray(body)||
      Object.keys(body).some(k=>k!=="code")||
      !("code" in body)||typeof body.code!=="string"||
      !/^\d{4,10}$/.test(body.code))
      throw new BadRequestException("Enter the code received on the verified number");
    const cfg=this.config();
    const client=await this.db.connect();let open=false;
    try{
      await client.query("BEGIN");open=true;
      const rows=await client.query<Contact>(`
        SELECT id,realm_id,contact_phone,contact_phone_verified_at,status
        FROM account WHERE id=$1 AND realm_id=$2 FOR UPDATE
      `,[actor.accountId,actor.realmId]);
      const person=rows.rows[0];
      if(!person||person.status!=="ACTIVE"||!person.contact_phone)
        throw new ForbiddenException();
      if(person.contact_phone_verified_at){
        await client.query("COMMIT");open=false;
        return {status:"VERIFIED"};
      }
      const challenge=await client.query<Challenge>(`
        SELECT * FROM cg01_mobile_verification
        WHERE account_id=$1 AND realm_id=$2 FOR UPDATE
      `,[actor.accountId,actor.realmId]);
      const row=challenge.rows[0];
      if(!row||row.status!=="PENDING"||row.expires_at.getTime()<=Date.now()||
        row.attempts>=5||
        row.phone_fingerprint!==this.fingerprint(person.contact_phone,cfg.hmac))
        throw new ConflictException("The mobile verification request is unavailable");
      await client.query(`
        UPDATE cg01_mobile_verification SET attempts=attempts+1
        WHERE account_id=$1 AND realm_id=$2
      `,[actor.accountId,actor.realmId]);
      let state:string;
      try{state=await this.provider("VerificationCheck",
        new URLSearchParams({To:person.contact_phone,Code:body.code}));}
      catch{
        // Do not claim provider approval or roll back the bounded attempt.
        await client.query("COMMIT");open=false;
        return {status:"PROVIDER_UNKNOWN"};
      }
      if(state!=="approved"){
        await client.query(`
          INSERT INTO cg01_mobile_verification_event(realm_id,account_id,action)
          VALUES($1,$2,'DENIED')
        `,[actor.realmId,actor.accountId]);
        await client.query("COMMIT");open=false;
        return {status:"NOT_VERIFIED"};
      }
      await client.query(`
        UPDATE account SET contact_phone_verified_at=now(),updated_at=now()
        WHERE id=$1 AND realm_id=$2 AND contact_phone=$3
      `,[actor.accountId,actor.realmId,person.contact_phone]);
      await client.query(`
        UPDATE cg01_mobile_verification
        SET status='VERIFIED',verified_at=now()
        WHERE account_id=$1 AND realm_id=$2
      `,[actor.accountId,actor.realmId]);
      await client.query(`
        INSERT INTO cg01_mobile_verification_event(realm_id,account_id,action)
        VALUES($1,$2,'VERIFIED')
      `,[actor.realmId,actor.accountId]);
      await client.query("COMMIT");open=false;
      return {status:"VERIFIED"};
    }catch(e){if(open)try{await client.query("ROLLBACK");}catch{};throw e;}
    finally{client.release();}
  }
}
