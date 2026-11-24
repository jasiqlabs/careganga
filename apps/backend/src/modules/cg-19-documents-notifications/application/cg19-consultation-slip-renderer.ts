import {readFile} from "node:fs/promises";
import {ServiceUnavailableException} from "@nestjs/common";
import {PDFDocument,rgb} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type {OriginalConsultationSlip}
 from "../../cg-15-patients-appointments/application/consultation-slip-source.facade";
import {opaqueAppointmentQr} from "./cg19-appointment-qr";

const money=(v:string)=>{
 const n=BigInt(v);return "INR "+(n/100n).toString()+"."+
 (n%100n).toString().padStart(2,"0");
};
export async function renderConsultationSlip(
 source:OriginalConsultationSlip,token:string,issuedAt:string
):Promise<Buffer>{
 const fontPath=process.env.CG19_PDF_FONT_PATH;
 if(!fontPath||!fontPath.startsWith("/")||fontPath.includes("..")||
  fontPath.length>300)
  throw new ServiceUnavailableException({code:"CG19_SLIP_UNAVAILABLE"});
 let bytes:Buffer;
 try{bytes=await readFile(fontPath);}catch{
  throw new ServiceUnavailableException({code:"CG19_SLIP_UNAVAILABLE"});
 }
 if(bytes.length<1000||bytes.length>10485760)
  throw new ServiceUnavailableException({code:"CG19_SLIP_UNAVAILABLE"});
 try{
  const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);
  const font=await pdf.embedFont(bytes,{subset:true});
  pdf.setTitle("CareGanga Consultation — "+source.bookingId);
  pdf.setSubject("CG15-APPOINTMENT:"+source.sourceDigest);
  pdf.setProducer("CareGanga CG-19 Private Documents");
  pdf.setCreationDate(new Date(issuedAt));
  const page=pdf.addPage([595,842]);
  const green=rgb(.075,.29,.18),gold=rgb(.98,.88,.53),cream=rgb(.99,.98,.94),gray=rgb(.22,.29,.26),black=rgb(0,0,0),border=rgb(.77,.83,.79),white=rgb(1,1,1);
  page.drawRectangle({x:0,y:814,width:595,height:28,color:green});
  page.drawRectangle({x:28,y:751,width:539,height:58,color:green});
  page.drawText("CareGanga Foundation",{x:40,y:785,font,size:19,color:white});
  page.drawText("Integrated Healthcare Assistance",{x:40,y:766,font,size:11,color:white});
  page.drawRectangle({x:28,y:716,width:539,height:28,color:gold});
  page.drawText("Appointment confirmation | Private consultation slip",{x:40,y:726,font,size:12,color:green});
  // Only immutable CG15 booking terms are in this document. CG17 assistance
  // and verified collection receipts remain separate original sources.
  const wrap=(text:string,width:number,size:number)=>{
   const lines:string[]=[];let line="";
   for(const ch of text.replace(/[\u0000-\u001f\u007f]/g," ").trim()){
    if(line&&font.widthOfTextAtSize(line+ch,size)>width){lines.push(line);line="";}
    line+=ch;
   }
   if(line)lines.push(line);return lines.length?lines:["—"];
  };
  const panel=(title:string,fields:[string,string][],x:number,top:number,width:number)=>{
   const rows=fields.map(([label,value])=>({label,lines:wrap(value,width-24,10)}));
   const height=25+rows.reduce((n,row)=>n+17+row.lines.length*13,0)+9;
   if(top-height<125)throw Error("Slip fields exceed printable page");
   page.drawRectangle({x,y:top-height,width,height,color:cream,borderColor:border,borderWidth:.7});
   page.drawRectangle({x,y:top-22,width,height:22,color:green});
   page.drawText(title,{x:x+10,y:top-15,font,size:11,color:white});
   let y=top-36;
   for(const row of rows){
    page.drawText(row.label,{x:x+10,y,font,size:9,color:gray});y-=13;
    for(const line of row.lines){page.drawText(line,{x:x+10,y,font,size:10,color:black});y-=13;}
    y-=4;
   }
   return top-height-10;
  };
  let localDate=source.startAt;
  try{localDate=new Date(source.startAt).toLocaleString("en-IN",{timeZone:source.timeZone,dateStyle:"medium",timeStyle:"short"});}catch{/* UTC original retained */}
  const bookingBottom=panel("Booking details",[
   ["Booking ID",source.bookingId],["Patient",source.patientName],
   ["Issued (UTC)",issuedAt]],28,707,365);
  const matrix=opaqueAppointmentQr(token);
  const module=3.2,left=432,top=672;
  // Four-module quiet zone, opaque token and status-only verification.
  page.drawRectangle({x:left-module*4,y:top-module*33,width:module*37,height:module*37,color:white});
  matrix.forEach((row,yi)=>row.forEach((dark,xi)=>{if(dark)page.drawRectangle({x:left+xi*module,y:top-yi*module,width:module,height:module,color:black});}));
  page.drawText("Scan to verify booking",{x:421,y:550,font,size:9,color:green});
  page.drawText(token,{x:418,y:534,font,size:8,color:gray});
  const topDetails=Math.min(bookingBottom,519);
  const leftBottom=panel("Doctor and appointment",[
   ["Doctor",source.doctorName],["Appointment date & time",localDate+" ("+source.timeZone+")"],
   ["Original UTC time",source.startAt]],28,topDetails,263);
  const rightBottom=panel("Healthcare center",[
   ["Center",source.centerName],["Address",source.centerAddress]],301,topDetails,266);
  const financialTop=Math.min(leftBottom,rightBottom);
  if(financialTop<235)throw Error("Slip fields exceed printable page");
  page.drawRectangle({x:28,y:financialTop-75,width:539,height:75,color:gold,borderColor:border,borderWidth:.7});
  page.drawText("Consultation fee & payment instructions",{x:40,y:financialTop-16,font,size:11,color:green});
  page.drawText("Approved consultation fee: "+money(source.consultationFeeMinor),{x:40,y:financialTop-35,font,size:12,color:black});
  page.drawText("Pay-at-center booking. Check current assistance and collection separately.",{x:40,y:financialTop-51,font,size:9,color:gray});
  page.drawText("This slip is not a payment receipt or confirmation of an amount received.",{x:40,y:financialTop-65,font,size:9,color:gray});
  page.drawRectangle({x:28,y:92,width:539,height:60,color:cream,borderColor:border,borderWidth:.7});
  page.drawText("Important instructions",{x:40,y:136,font,size:10,color:green});
  page.drawText("Bring identity proof and keep this private document secure.",{x:40,y:121,font,size:9,color:gray});
  page.drawText("The QR verifies booking status only; it does not disclose identity or clinical data.",{x:40,y:106,font,size:9,color:gray});
  page.drawText("CareGanga Foundation | Health · Service · Humanity",{x:40,y:65,font,size:10,color:green});
  const file=Buffer.from(await pdf.save({useObjectStreams:false}));
  if(file.length<100||file.length>10485760)throw Error("Invalid PDF");
  return file;
 }catch{
  throw new ServiceUnavailableException({code:"CG19_SLIP_UNAVAILABLE"});
 }
}
