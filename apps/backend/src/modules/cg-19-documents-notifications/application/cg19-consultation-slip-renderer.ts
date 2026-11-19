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
  const navy=rgb(0.12,0.21,0.44),gray=rgb(0.28,0.35,0.44),black=rgb(0,0,0);
  page.drawRectangle({x:0,y:814,width:595,height:28,color:navy});
  page.drawText("CareGanga Foundation",{x:43,y:780,font,size:19,color:navy});
  page.drawText("Consultation Appointment — Patient Copy",{x:43,y:750,font,size:12,color:gray});
  page.drawText("Pay at center. No online payment or Foundation aid is recorded.",{
   x:43,y:725,font,size:10,color:gray});
  page.drawLine({start:{x:42,y:708},end:{x:550,y:708},color:gray,thickness:0.7});
  let y=678;
  const field=(heading:string,value:string)=>{
   const txt=(heading+": "+value).replace(/[\u0000-\u001f\u007f]/g," ").trim();
   let line="";
   for(const c of txt){
    if(font.widthOfTextAtSize(line+c,10.5)>345&&line){
     if(y<220)throw Error("Slip exceeded single page");
     page.drawText(line,{x:43,y,font,size:10.5,color:gray});
     line="";y-=17;
    }
    line+=c;
   }
   if(y<220)throw Error("Slip exceeded single page");
   page.drawText(line,{x:43,y,font,size:10.5,color:gray});y-=33;
  };
  field("Booking ID",source.bookingId);
  field("Patient",source.patientName);
  field("Doctor",source.doctorName);
  field("Center",source.centerName);
  field("Address",source.centerAddress);
  field("Date and time (UTC)",source.startAt);
  field("Local time zone",source.timeZone);
  field("Consultation fee",money(source.consultationFeeMinor));
  field("Payment method","PAY AT CENTER — AMOUNT DUE");
  field("Issued (UTC)",issuedAt);
  page.drawText("Scan only for booking-status verification.",{
   x:365,y:637,font,size:9.5,color:gray});
  const matrix=opaqueAppointmentQr(token);
  const module=3.25,left=400,top=608;
  // White margin: four modules of quiet zone all around a valid 29x29 QR.
  page.drawRectangle({x:left-module*4,y:top-module*33,
   width:module*37,height:module*37,color:rgb(1,1,1)});
  matrix.forEach((row,yi)=>row.forEach((dark,xi)=>{
   if(dark)page.drawRectangle({
    x:left+xi*module,y:top-yi*module,width:module,height:module,color:black});
  }));
  page.drawText(token,{x:395,y:478,font,size:8,color:gray});
  page.drawLine({start:{x:43,y:172},end:{x:552,y:172},color:gray,thickness:0.6});
  page.drawText("Keep your slip private. A QR proves only status, not identity or clinical access.",{
   x:43,y:147,font,size:9,color:gray});
  page.drawText("This is NOT a payment receipt. Bring identity proof to the healthcare center.",{
   x:43,y:129,font,size:9,color:gray});
  const file=Buffer.from(await pdf.save({useObjectStreams:false}));
  if(file.length<100||file.length>10485760)throw Error("Invalid PDF");
  return file;
 }catch{
  throw new ServiceUnavailableException({code:"CG19_SLIP_UNAVAILABLE"});
 }
}
