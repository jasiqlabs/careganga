import {readFile} from "node:fs/promises";
import {PDFDocument,rgb,type PDFFont,type PDFPage} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import {createHash,createHmac} from "node:crypto";
import {ServiceUnavailableException} from "@nestjs/common";
import {opaqueAppointmentQr} from "./cg19-appointment-qr";
export const hrTemplateHash=(kind:string,title:string,body:string)=>createHash("sha256").update(JSON.stringify(["CG19_HR_TEMPLATE_V1",kind,title,body])).digest("hex");
export function employeeCardToken(realm:string,document:string,digest:string){
 const key=Buffer.from(process.env.CG19_EMPLOYEE_CARD_QR_KEY??"","base64");
 if(key.length!==32)throw new ServiceUnavailableException("Employee card verification is not configured");
 return "CGV-"+createHmac("sha256",key).update("CG19-HR-CARD-V1:"+realm+":"+document+":"+digest).digest("hex").slice(0,24).toUpperCase();
}
function wrap(value:string,font:PDFFont,size:number,width:number){
 const lines:string[]=[];
 for(const paragraph of value.split(/\r?\n/)){
  let line="";
  for(const ch of paragraph){
   if(line&&font.widthOfTextAtSize(line+ch,size)>width){lines.push(line.trimEnd());line="";}
   line+=ch;
  }
  lines.push(line);
 }
 return lines;
}
export async function renderHrDocument(input:{snapshot:Record<string,unknown>;title:string;body:string;reference:string;sourceDigest:string;documentRef:string;issueRevision:number;createdAt:Date;qr:string|null}){
 const path=process.env.CG19_PDF_FONT_PATH;
 if(!path||!path.startsWith("/")||path.includes(".."))throw new ServiceUnavailableException("The letter font is unavailable");
 const bytes=await readFile(path);
 if(bytes.length<1000||bytes.length>10*1024*1024)throw new ServiceUnavailableException("The letter font is unavailable");
 const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);
 const font=await pdf.embedFont(bytes,{subset:true}),blue=rgb(.12,.28,.6),grey=rgb(.34,.39,.46);
 pdf.setTitle("CareGanga private employee document");
 pdf.setSubject("CG19-HR:"+input.documentRef+":"+input.sourceDigest+":"+input.issueRevision);
 pdf.setCreationDate(input.createdAt);pdf.setModificationDate(input.createdAt);
 const v=input.snapshot;
 const fact=(key:string)=>typeof v[key]==="string"?String(v[key]):"Not applicable";
 const print=(page:PDFPage,text:string,x:number,y:number,size:number,width:number)=>{
  for(const line of wrap(text,font,size,width)){
   if(y<35)throw new Error("Document content exceeds approved page");
   if(line)page.drawText(line,{x,y,size,font,color:grey});y-=size+5;
  }
  return y;
 };
 if(v.kind==="EMPLOYEE_ID"){
  if(!input.qr)throw new ServiceUnavailableException("Card verification unavailable");
  const front=pdf.addPage([242.65,153.07]),back=pdf.addPage([242.65,153.07]);
  for(const page of [front,back])page.drawRectangle({x:0,y:131,width:243,height:22,color:blue});
  front.drawText("CareGanga Foundation",{x:9,y:138,size:10,font,color:rgb(1,1,1)});
  let y=112;y=print(front,fact("recipient"),10,y,11,221);
  y=print(front,fact("designation")+" · "+fact("branch"),10,y,8,221);
  y=print(front,"Employee: "+fact("subjectReference"),10,y,8,221);
  y=print(front,"Expires: "+fact("expiryDate"),10,y,8,221);
  print(front,"Version "+input.issueRevision,10,y,8,221);
  back.drawText("Employee ID verification",{x:9,y:138,size:10,font,color:rgb(1,1,1)});
  const matrix=opaqueAppointmentQr(input.qr),unit=2.1,origin=9+4*unit,top=119-4*unit;
  for(let row=0;row<matrix.length;row++)for(let col=0;col<matrix.length;col++)if(matrix[row][col])
   back.drawRectangle({x:origin+col*unit,y:top-(row+1)*unit,width:unit,height:unit,color:rgb(0,0,0)});
  print(back,"Scan the opaque code and verify in CareGanga. No personal details in the QR.",88,109,8,144);
  back.drawText(input.qr,{x:9,y:22,size:7,font,color:grey});
 }else{
  const page=pdf.addPage([595,842]);page.drawRectangle({x:0,y:815,width:595,height:27,color:blue});
  page.drawText("CareGanga Foundation",{x:45,y:771,size:20,font,color:blue});
  let y=735;y=print(page,input.title,45,y,16,505);y-=8;
  for(const [label,key] of [["Recipient","recipient"],["Designation","designation"],["Branch","branch"],["Department","department"],["Joining date","hireDate"],["Issue date","issueDate"],...(v.kind==="RELIEVING"?[["Last working date","lastWorkingDate"]]:[])]){
   y=print(page,label+": "+fact(key),45,y,11,505);
  }
  y-=12;y=print(page,input.body,45,y,11,505);y-=12;
  const date=fact("issueDate"),year=Number(date.slice(0,4)),start=Number(date.slice(5,7))>=4?year:year-1;
  y=print(page,"Financial year: "+start+"–"+(start+1)+" · "+input.reference+" · Version "+input.issueRevision,45,y,9,505);
  print(page,"Approved private document. No payroll or payment confirmation is implied.",45,y-6,9,505);
 }
 return Buffer.from(await pdf.save({useObjectStreams:false}));
}
