import {ConflictException,Inject,Injectable,NotFoundException,ServiceUnavailableException} from "@nestjs/common";
import {createHash,randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import {PDFDocument,rgb} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type {Pool} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {PayrollPayslipSourceFacade} from "../../cg-11-payroll-compensation/application/payroll-payslip-source.facade";
import {PrivateObjectStorage} from "../infrastructure/private-object-storage";
import {id} from "../../cg-11-payroll-compensation/domain/payroll-input";
import {CommunicationRecipientSource} from "../../cg-01-identity-access/application/communication-recipient-source.service";
import {NotificationService} from "./notification.service";
type Source=Awaited<ReturnType<PayrollPayslipSourceFacade["source"]>>["data"];
type Document={id:string;line_ref:string;source_digest:string;status:string;object_key:string;object_version:string|null;content_sha256:string|null;content_length:number|null;created_at:Date};
const hash=(b:Buffer)=>createHash("sha256").update(b).digest("hex");
const money=(s:string)=>{const n=BigInt(s);return "INR "+(n/100n).toString()+"."+(n%100n).toString().padStart(2,"0");};
async function render(s:Source,at:Date){
 const path=process.env.CG19_PDF_FONT_PATH;
 if(!path||!path.startsWith("/")||path.includes("..")||path.length>300)throw new ServiceUnavailableException("Approved PDF font unavailable");
 const fontBytes=await readFile(path);if(fontBytes.length<1000||fontBytes.length>10485760)throw new ServiceUnavailableException("Approved PDF font unavailable");
 const doc=await PDFDocument.create();doc.registerFontkit(fontkit);const font=await doc.embedFont(fontBytes,{subset:true});
 doc.setTitle("CareGanga Foundation — Private payslip");doc.setSubject("CG11-PAYSLIP:"+s.sourceDigest);doc.setCreationDate(at);doc.setProducer("CareGanga CG-19 Protected Documents");
 let page=doc.addPage([595,842]),y=780;const navy=rgb(.08,.16,.31),grey=rgb(.23,.29,.36);
 const write=(value:string,size=11)=>{let line="";for(const c of value.replace(/[\u0000-\u001f\u007f]/g," ")){if(font.widthOfTextAtSize(line+c,size)>500&&line){if(y<65){page=doc.addPage([595,842]);y=780;}page.drawText(line,{x:45,y,font,size,color:grey});y-=19;line="";}line+=c;}if(y<65){page=doc.addPage([595,842]);y=780;}page.drawText(line,{x:45,y,font,size,color:size>15?navy:grey});y-=size>15?32:20;};
 write("CareGanga Foundation",20);write("Confidential salary statement",15);write("Payroll period: "+s.period);write("Payroll reference: "+s.reference);write("Employee: "+s.name+" · "+s.employeeCode);write("Designation: "+s.designation);y-=12;
 for(const [label,value] of [["Basic salary",s.baseMinor],["Allowances",s.allowanceMinor],["Bonus",s.bonusMinor],["Arrears",s.arrearsMinor],["Gross salary",s.grossMinor],["Deductions",s.deductionMinor],["Statutory withholding (included in deductions)",s.statutoryMinor],["Net salary",s.netMinor],["Employer contribution (not employee net)",s.employerMinor],["Verified settled amount",s.paidMinor],["Outstanding",String(BigInt(s.netMinor)-BigInt(s.paidMinor))]])write(label+": "+money(value));
 y-=10;write("Payment status: "+s.paymentStatus.replaceAll("_"," "));write("Original approved salary; payment is confirmed only from verified finance records.");write("Issued UTC: "+at.toISOString(),9);
 const bytes=Buffer.from(await doc.save({useObjectStreams:false}));if(bytes.length<100||bytes.length>10485760)throw new ServiceUnavailableException("Private payslip exceeds document limits");return bytes;
}
@Injectable()
export class PayrollPayslipService{
 constructor(@Inject(DATABASE)private readonly db:Pool,private readonly source:PayrollPayslipSourceFacade,private readonly storage:PrivateObjectStorage,private readonly recipients:CommunicationRecipientSource,private readonly notifications:NotificationService){}
 async own(token:string){return this.source.own(token);}
 async issue(token:string,line:string){
  return this.issueFrom(await this.source.source(token,line),()=>this.source.source(token,line));
 }
 async issueApprovedEvent(root:string,event:string,claim:string){
  const current=()=>this.source.approvedEventSource(root,event,claim);
  const result=await this.issueFrom(await current(),current);
  if(result.confirmed){
   const original=await current();
   const d=(await this.db.query<Document>("SELECT * FROM cg19_payroll_payslip WHERE root_realm_id=$1 AND id=$2 AND line_ref=$3 AND source_digest=$4 AND status='ISSUED'",[root,result.documentRef,original.data.lineRef,original.data.sourceDigest])).rows[0];
   if(!d?.object_version||!d.content_length||!d.content_sha256)throw new ConflictException("Original payslip unavailable");
   const bytes=await this.storage.readVerifiedPrivateObject({objectKey:d.object_key,objectVersion:d.object_version,maxBytes:d.content_length});
   if(bytes.length!==d.content_length||hash(bytes)!==d.content_sha256)throw new ConflictException("Original payslip unavailable");
   const live=await current();if(live.data.sourceDigest!==original.data.sourceDigest)throw new ConflictException("Original payslip changed");
  }
  return result;
 }
 private async issueFrom({actor,data}:{actor:{realmId:string;accountId:string};data:Source},currentSource:()=>Promise<{data:Source}>){
  const tx=await this.db.connect();let d:Document;
  try{await tx.query("BEGIN");await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[actor.realmId+":payslip:"+data.lineRef+":"+data.sourceDigest]);
   const existing=(await tx.query<Document>("SELECT * FROM cg19_payroll_payslip WHERE root_realm_id=$1 AND line_ref=$2 AND source_digest=$3 FOR UPDATE",[actor.realmId,data.lineRef,data.sourceDigest])).rows[0];
   d=existing??(await tx.query<Document>("INSERT INTO cg19_payroll_payslip(root_realm_id,line_ref,source_digest,issued_by,object_key) VALUES($1,$2,$3,$4,$5) RETURNING *",[actor.realmId,data.lineRef,data.sourceDigest,actor.accountId,"careganga/private/cg19/"+actor.realmId+"/payslips/"+randomUUID()])).rows[0];
   await tx.query("COMMIT");
  }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
  if(d.status==="ISSUED"){const live=await currentSource();if(live.data.sourceDigest!==data.sourceDigest)throw new ConflictException("Payroll source changed; regenerate current payslip");return {documentRef:d.id,status:"ISSUED",confirmed:true};}
  try{
   let bytes:Buffer,version:string,digest:string;
   try{
    const stored=await this.storage.reconcileIssuedPrivateDocument({objectKey:d.object_key,maxBytes:10485760});
    bytes=await this.storage.readVerifiedPrivateObject({objectKey:d.object_key,objectVersion:stored.objectVersion,maxBytes:stored.sizeBytes});
    digest=hash(bytes);if(digest!==stored.sha256||bytes.length!==stored.sizeBytes||(await PDFDocument.load(bytes,{updateMetadata:false})).getSubject()!=="CG11-PAYSLIP:"+data.sourceDigest)throw new Error("Original private object not verified");
    version=stored.objectVersion;
   }catch{
    bytes=await render(data,d.created_at);digest=hash(bytes);
    const written=await this.storage.writeVerifiedPrivateDocument({objectKey:d.object_key,bytes,sha256:digest});
    if(written.sha256!==digest||!written.objectVersion)throw new Error("Private write not confirmed");version=written.objectVersion;
   }
   const current=await currentSource();if(current.data.sourceDigest!==data.sourceDigest)throw new ConflictException("Payroll source changed; regenerate current payslip");
   const done=await this.db.query("UPDATE cg19_payroll_payslip SET status='ISSUED',object_version=$3,content_sha256=$4,content_length=$5,issued_at=now(),updated_at=now() WHERE root_realm_id=$1 AND id=$2 AND status IN('PENDING','UNKNOWN') RETURNING id",[actor.realmId,d.id,version,digest,bytes.length]);
   if(!done.rowCount){const latest=await this.db.query("SELECT id FROM cg19_payroll_payslip WHERE root_realm_id=$1 AND id=$2 AND status='ISSUED' AND content_sha256=$3 AND object_version=$4",[actor.realmId,d.id,digest,version]);if(!latest.rowCount)throw new ConflictException("Original issuance outcome unconfirmed");}
   return {documentRef:d.id,status:"ISSUED",confirmed:true};
  }catch{
   await this.db.query("UPDATE cg19_payroll_payslip SET status='UNKNOWN',updated_at=now() WHERE root_realm_id=$1 AND id=$2 AND status='PENDING'",[actor.realmId,d.id]).catch(()=>undefined);
   return {documentRef:d.id,status:"UNAVAILABLE",confirmed:false};
  }
 }
 /** Explicit employee/admin request to the current linked employee only. No salary amounts, attachments or bearer links in ordinary email. */
 async email(token:string,line:string){
  await this.source.source(token,line,true);
  const issued=await this.issue(token,line);
  if(!issued.confirmed)return {status:"UNAVAILABLE"};
  await this.download(token,line,issued.documentRef);
  const tx=await this.db.connect();
  try{
   await tx.query("BEGIN");
   const {actor,data}=await this.source.emailSource(tx,token,line);
   const recipient=(await tx.query<{account_ref:string}>(`SELECT e.account_ref FROM hr_employee e JOIN cg19_payroll_payslip d ON d.root_realm_id=e.root_realm_id
    WHERE e.root_realm_id=$1 AND e.id=$2 AND d.id=$3 AND d.source_digest=$4
    AND cg19_payroll_notice_matches($1,d.id,e.account_ref) FOR SHARE OF e`,[actor.realmId,data.employeeRef,issued.documentRef,data.sourceDigest])).rows[0]?.account_ref;
   if(!recipient)throw new ConflictException("Current employee recipient unavailable");
   const person=await this.recipients.get(tx,actor.realmId,recipient);
   if(!person?.active||!person.email||!await this.notifications.hasConsent(tx,actor.realmId,recipient,"EMAIL","TRANSACTIONAL"))throw new ConflictException("Verified employee email or consent unavailable");
   const subject="Your private CareGanga document is available",body="Sign in to the CareGanga employee portal or Internal Android app and open My Pay to view the current confidential salary statement. This notice does not confirm payment.";
   await tx.query(`INSERT INTO cg19_message_template(realm_id,kind,channel,version,subject,body,status,origin)
    VALUES($1,'CG11_PAYSLIP_READY','EMAIL',1,$2,$3,'APPROVED','SYSTEM') ON CONFLICT(realm_id,kind,channel,version) DO NOTHING`,[actor.realmId,subject,body]);
   const template=(await tx.query<{id:string;version:number}>(`SELECT id,version FROM cg19_message_template WHERE realm_id=$1 AND kind='CG11_PAYSLIP_READY' AND channel='EMAIL' AND version=1 AND status='APPROVED' AND subject=$2 AND body=$3`,[actor.realmId,subject,body])).rows[0];
   if(!template)throw new ConflictException("Private notification template unavailable");
   const result=await tx.query<{id:string;state:string}>(`INSERT INTO cg19_notification(realm_id,source_kind,source_key,payroll_payslip_ref,recipient_id,template_id,template_version,channel,subject_snapshot,body_snapshot,purpose,state,due_at,expires_at)
    VALUES($1,'CG11_PAYSLIP_READY',$2,$2,$3,$4,$5,'EMAIL',$6,$7,'TRANSACTIONAL','QUEUED',now(),now()+interval '30 days') ON CONFLICT DO NOTHING RETURNING id,state`,[actor.realmId,issued.documentRef,recipient,template.id,template.version,subject,body]);
   const row=result.rows[0]??(await tx.query<{id:string;state:string}>(`SELECT id,state FROM cg19_notification WHERE realm_id=$1 AND payroll_payslip_ref=$2 AND recipient_id=$3 AND channel='EMAIL' AND source_kind='CG11_PAYSLIP_READY'`,[actor.realmId,issued.documentRef,recipient])).rows[0];
   if(!row)throw new ConflictException("Email outcome unconfirmed");
   if(result.rowCount)await tx.query("INSERT INTO cg19_communication_event(realm_id,notification_id,actor_id,kind) VALUES($1,$2,$3,'SOURCE_CAPTURED')",[actor.realmId,row.id,actor.accountId]);
   await tx.query("COMMIT");return {status:row.state};
  }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
 }
 async download(token:string,line:string,ref:string){
  const {actor,data}=await this.source.source(token,line);
  const d=(await this.db.query<Document>("SELECT * FROM cg19_payroll_payslip WHERE root_realm_id=$1 AND id=$2 AND line_ref=$3 AND source_digest=$4 AND status='ISSUED'",[actor.realmId,id(ref),data.lineRef,data.sourceDigest])).rows[0];
  if(!d||!d.object_version||!d.content_length||!d.content_sha256)throw new NotFoundException("Current private payslip unavailable");
  const bytes=await this.storage.readVerifiedPrivateObject({objectKey:d.object_key,objectVersion:d.object_version,maxBytes:d.content_length});
  if(bytes.length!==d.content_length||hash(bytes)!==d.content_sha256)throw new ConflictException("Private payslip unavailable");
  const live=await this.source.source(token,line);if(live.data.sourceDigest!==data.sourceDigest)throw new ConflictException("Payroll source changed; regenerate current payslip");
  return bytes;
 }
}
