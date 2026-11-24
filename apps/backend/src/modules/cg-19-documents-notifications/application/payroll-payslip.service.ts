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
 constructor(@Inject(DATABASE)private readonly db:Pool,private readonly source:PayrollPayslipSourceFacade,private readonly storage:PrivateObjectStorage){}
 async own(token:string){return this.source.own(token);}
 async issue(token:string,line:string){
  const {actor,data}=await this.source.source(token,line);
  const tx=await this.db.connect();let d:Document;
  try{await tx.query("BEGIN");await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[actor.realmId+":payslip:"+data.lineRef+":"+data.sourceDigest]);
   const existing=(await tx.query<Document>("SELECT * FROM cg19_payroll_payslip WHERE root_realm_id=$1 AND line_ref=$2 AND source_digest=$3 FOR UPDATE",[actor.realmId,data.lineRef,data.sourceDigest])).rows[0];
   d=existing??(await tx.query<Document>("INSERT INTO cg19_payroll_payslip(root_realm_id,line_ref,source_digest,issued_by,object_key) VALUES($1,$2,$3,$4,$5) RETURNING *",[actor.realmId,data.lineRef,data.sourceDigest,actor.accountId,"careganga/private/cg19/"+actor.realmId+"/payslips/"+randomUUID()])).rows[0];
   await tx.query("COMMIT");
  }catch(e){await tx.query("ROLLBACK");throw e;}finally{tx.release();}
  if(d.status==="ISSUED")return {documentRef:d.id,status:"ISSUED",confirmed:true};
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
   const current=await this.source.source(token,line);if(current.data.sourceDigest!==data.sourceDigest)throw new ConflictException("Payroll source changed; regenerate current payslip");
   await this.db.query("UPDATE cg19_payroll_payslip SET status='ISSUED',object_version=$3,content_sha256=$4,content_length=$5,issued_at=now(),updated_at=now() WHERE root_realm_id=$1 AND id=$2 AND status IN('PENDING','UNKNOWN')",[actor.realmId,d.id,version,digest,bytes.length]);
   return {documentRef:d.id,status:"ISSUED",confirmed:true};
  }catch{
   await this.db.query("UPDATE cg19_payroll_payslip SET status='UNKNOWN',updated_at=now() WHERE root_realm_id=$1 AND id=$2 AND status='PENDING'",[actor.realmId,d.id]).catch(()=>undefined);
   return {documentRef:d.id,status:"UNAVAILABLE",confirmed:false};
  }
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
