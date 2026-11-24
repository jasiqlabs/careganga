import {BadRequestException,Inject,Injectable,ServiceUnavailableException} from "@nestjs/common";
import {createCipheriv,createHmac,randomBytes,randomInt,randomUUID,timingSafeEqual} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {CommunicationProviders} from "../infrastructure/channel-providers";
import {SupportService} from "./support.service";

type Action="SUBSCRIBE"|"WITHDRAW";
type State="SUBSCRIBED"|"WITHDRAWN";
type Challenge={id:string;code_digest:string;withdrawal_digest:string|null;consent_version:number;attempt_count:number;
 consumed_at:Date|null;confirmed_revision:number|null;expired:boolean};
type Subscription={state:State;revision:number;withdrawal_digest:string|null};
const CONSENT_VERSION=1;
function protectedKey(purpose:string){
 const key=Buffer.from(process.env.IDENTITY_ENCRYPTION_KEY??"","base64");
 if(key.length!==32)throw new ServiceUnavailableException({code:"NEWSLETTER_UNAVAILABLE"});
 return createHmac("sha256",key).update("cg19-newsletter-v1:"+purpose).digest();
}
const digest=(purpose:string,value:string)=>createHmac("sha256",protectedKey(purpose)).update(value).digest("hex");
const equal=(a:string,b:string)=>/^[0-9a-f]{64}$/.test(a)&&/^[0-9a-f]{64}$/.test(b)&&timingSafeEqual(Buffer.from(a,"hex"),Buffer.from(b,"hex"));
function sealEmail(email:string){
 const iv=randomBytes(12),cipher=createCipheriv("aes-256-gcm",protectedKey("email-encryption"),iv);
 const data=Buffer.concat([cipher.update(email,"utf8"),cipher.final()]);
 return Buffer.concat([iv,cipher.getAuthTag(),data]);
}
function parse(raw:unknown,allowed:string[]){
 if(!raw||typeof raw!=="object"||Array.isArray(raw)||Object.keys(raw).some(k=>!allowed.includes(k)))
  throw new BadRequestException({code:"NEWSLETTER_INVALID"});
 return raw as Record<string,unknown>;
}
function emailInput(raw:unknown){
 if(typeof raw!=="string"||raw.length>254||!/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(raw.trim()))
  throw new BadRequestException({code:"NEWSLETTER_INVALID"});
 return raw.trim().toLowerCase();
}
function actionInput(value:unknown):Action{
 if(value!=="SUBSCRIBE"&&value!=="WITHDRAW")throw new BadRequestException({code:"NEWSLETTER_INVALID"});
 return value;
}
@Injectable()
export class NewsletterConsentService{
 constructor(@Inject(DATABASE)private readonly db:Pool,private readonly providers:CommunicationProviders,private readonly support:SupportService){}
 private async root(){
  const x=await this.db.query<{id:string}>("SELECT id FROM access_realm WHERE realm_key='FOUNDATION_ROOT' LIMIT 2");
  if(x.rows.length!==1)throw new ServiceUnavailableException({code:"NEWSLETTER_UNAVAILABLE"});
  return x.rows[0].id;
 }
 private async transaction<T>(work:(tx:PoolClient)=>Promise<T>){
  const tx=await this.db.connect();
  try{await tx.query("BEGIN");await tx.query("SET LOCAL statement_timeout='8s'");await tx.query("SET LOCAL lock_timeout='3s'");
   const out=await work(tx);await tx.query("COMMIT");return out;
  }catch(e){try{await tx.query("ROLLBACK");}catch{}throw e;}finally{tx.release();}
 }
 private async lock(tx:PoolClient,root:string,mail:string){
  await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[root+":newsletter:"+mail]);
 }
 private async subscription(tx:PoolClient,root:string,mail:string){
  return (await tx.query<Subscription>("SELECT state,revision,withdrawal_digest FROM cg19_newsletter_subscription WHERE root_realm_id=$1 AND email_digest=$2 FOR UPDATE",[root,mail])).rows[0];
 }
 private async change(tx:PoolClient,root:string,mail:string,state:State,email:string,withdrawal:string|null,version:number){
  const row=(await tx.query<{revision:number}>(`INSERT INTO cg19_newsletter_subscription(root_realm_id,email_digest,state,email_encrypted,withdrawal_digest,consent_version,subscribed_at,withdrawn_at)
   VALUES($1,$2,$3,$4,$5,$6,CASE WHEN $3='SUBSCRIBED' THEN now() ELSE NULL END,CASE WHEN $3='WITHDRAWN' THEN now() ELSE NULL END)
   ON CONFLICT(root_realm_id,email_digest) DO UPDATE SET state=excluded.state,email_encrypted=excluded.email_encrypted,
    withdrawal_digest=CASE WHEN excluded.state='WITHDRAWN' THEN cg19_newsletter_subscription.withdrawal_digest ELSE excluded.withdrawal_digest END,
    consent_version=excluded.consent_version,revision=cg19_newsletter_subscription.revision+1,
    subscribed_at=CASE WHEN excluded.state='SUBSCRIBED' THEN now() ELSE cg19_newsletter_subscription.subscribed_at END,
    withdrawn_at=excluded.withdrawn_at,updated_at=now() RETURNING revision`,
   [root,mail,state,state==="SUBSCRIBED"?sealEmail(email):null,withdrawal,version])).rows[0];
  await tx.query("INSERT INTO cg19_newsletter_consent_event(id,root_realm_id,email_digest,state,consent_version,revision) VALUES($1,$2,$3,$4,$5,$6)",
   [randomUUID(),root,mail,state,version,row.revision]);
  return row.revision;
 }
 async start(address:string,raw:unknown){
  const x=parse(raw,["email","action","consent"]),email=emailInput(x.email),action=actionInput(x.action);
  if(action==="SUBSCRIBE"&&x.consent!==true||action==="WITHDRAW"&&x.consent!==undefined)
   throw new BadRequestException({code:"NEWSLETTER_INVALID"});
  const mail=digest("email-index",email);
  await this.support.newsletterThrottle(address,mail,"start");
  if(!this.providers.configured("EMAIL","TRANSACTIONAL"))throw new ServiceUnavailableException({code:"NEWSLETTER_UNAVAILABLE"});
  const root=await this.root(),id=randomUUID(),code=String(randomInt(0,100000000)).padStart(8,"0");
  const key=action==="SUBSCRIBE"?randomBytes(32).toString("base64url"):null;
  const stored=await this.transaction(async tx=>{
   await this.lock(tx,root,mail);
   const prior=(await tx.query<{fresh:boolean}>(`SELECT created_at>now()-interval '60 seconds' AS fresh
    FROM cg19_newsletter_challenge WHERE root_realm_id=$1 AND email_digest=$2 AND action=$3`,[root,mail,action])).rows[0];
   if(prior?.fresh)return false;
   await tx.query(`INSERT INTO cg19_newsletter_challenge(root_realm_id,email_digest,action,id,code_digest,withdrawal_digest,consent_version,expires_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,now()+interval '15 minutes')
    ON CONFLICT(root_realm_id,email_digest,action) DO UPDATE SET id=excluded.id,code_digest=excluded.code_digest,
     withdrawal_digest=excluded.withdrawal_digest,consent_version=excluded.consent_version,created_at=now(),expires_at=excluded.expires_at,
     attempt_count=0,consumed_at=NULL,confirmed_revision=NULL`,
    [root,mail,action,id,digest("challenge",id+":"+code),key?digest("withdrawal",key):null,CONSENT_VERSION]);
   // Bounded removal of expired challenge proof, not consent history.
   await tx.query(`DELETE FROM cg19_newsletter_challenge WHERE id IN
    (SELECT id FROM cg19_newsletter_challenge WHERE expires_at<now()-interval '24 hours' ORDER BY expires_at LIMIT 50)`);
   return true;
  });
  if(!stored)return {state:"CHECK_EXISTING_CODE"};
  // Existing verified CG19 email provider; only a requested verification,
  // never an unsolicited newsletter or claim of recipient delivery.
  const send=await this.providers.send({notificationRef:id,attemptRef:id,channel:"EMAIL",to:email,
   subject:"CareGanga newsletter verification",purpose:"TRANSACTIONAL",
   body:"Your CareGanga newsletter "+(action==="SUBSCRIBE"?"subscription":"withdrawal")+" code is "+code+". It expires in 15 minutes. Enter it only if you requested this action."+
    (key?" Keep this private withdrawal key to unsubscribe without another email: "+key+".":"")+" Ignore this message if you did not request it."});
  return {state:send.state==="ACCEPTED"?"CHECK_EMAIL":"SEND_UNCONFIRMED"};
 }
 async confirm(address:string,raw:unknown){
  const x=parse(raw,["email","action","code"]),email=emailInput(x.email),action=actionInput(x.action);
  if(typeof x.code!=="string"||!/^\d{8}$/.test(x.code))throw new BadRequestException({code:"NEWSLETTER_INVALID"});
  const code=x.code,mail=digest("email-index",email);
  await this.support.newsletterThrottle(address,mail,"confirm");
  const root=await this.root(),state:State=action==="SUBSCRIBE"?"SUBSCRIBED":"WITHDRAWN";
  const result=await this.transaction(async tx=>{
   await this.lock(tx,root,mail);
   const c=(await tx.query<Challenge>(`SELECT id,code_digest,withdrawal_digest,consent_version,attempt_count,consumed_at,confirmed_revision,expires_at<=now() AS expired
    FROM cg19_newsletter_challenge WHERE root_realm_id=$1 AND email_digest=$2 AND action=$3 FOR UPDATE`,[root,mail,action])).rows[0];
   if(!c||c.expired||c.attempt_count>=5)return null;
   if(!equal(c.code_digest,digest("challenge",c.id+":"+code))){
    await tx.query("UPDATE cg19_newsletter_challenge SET attempt_count=attempt_count+1 WHERE id=$1",[c.id]);return null;
   }
   if(c.consumed_at){
    const current=await this.subscription(tx,root,mail);
    return current?.state===state&&current.revision===c.confirmed_revision?state:null;
   }
   // A verified consent change invalidates any outstanding opposite action.
   const revision=await this.change(tx,root,mail,state,email,c.withdrawal_digest,c.consent_version);
   await tx.query("UPDATE cg19_newsletter_challenge SET consumed_at=now(),confirmed_revision=$2 WHERE id=$1",[c.id,revision]);
   await tx.query("DELETE FROM cg19_newsletter_challenge WHERE root_realm_id=$1 AND email_digest=$2 AND action<>$3",[root,mail,action]);
   return state;
  });
  if(!result)throw new BadRequestException({code:"NEWSLETTER_CODE_INVALID"});
  return {state:result};
 }
 async withdraw(address:string,raw:unknown){
  const x=parse(raw,["email","key"]),email=emailInput(x.email);
  if(typeof x.key!=="string"||!/^[A-Za-z0-9_-]{43}$/.test(x.key))throw new BadRequestException({code:"NEWSLETTER_INVALID"});
  const key=x.key,mail=digest("email-index",email);
  await this.support.newsletterThrottle(address,mail,"confirm");
  const root=await this.root();
  const valid=await this.transaction(async tx=>{
   await this.lock(tx,root,mail);
   const row=await this.subscription(tx,root,mail);
   if(!row?.withdrawal_digest||!equal(row.withdrawal_digest,digest("withdrawal",key)))return false;
   if(row.state==="SUBSCRIBED")await this.change(tx,root,mail,"WITHDRAWN",email,null,CONSENT_VERSION);
   await tx.query("DELETE FROM cg19_newsletter_challenge WHERE root_realm_id=$1 AND email_digest=$2",[root,mail]);
   return true;
  });
  if(!valid)throw new BadRequestException({code:"NEWSLETTER_CODE_INVALID"});
  return {state:"WITHDRAWN"};
 }
}
