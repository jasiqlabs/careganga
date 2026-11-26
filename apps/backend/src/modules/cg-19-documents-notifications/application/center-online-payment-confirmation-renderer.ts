import {readFile} from "node:fs/promises";
import {ServiceUnavailableException} from "@nestjs/common";
import {PDFDocument,rgb} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
export type VerifiedOnlineConfirmation={
 bookingId:string;centerName:string;patientName:string;doctorName:string;appointmentAt:string;timeZone:string;paymentReference:string;method:string;capturedAt:string;
 grossMinor:string;supportMinor:string;dueMinor:string;capturedMinor:string;
 captureRefundMinor:string;collectedMinor:string;outstandingMinor:string;
 checkedAt:string;
};
const money=(value:string)=>{const n=BigInt(value);return "INR "+(n/100n)+"."+(n%100n).toString().padStart(2,"0");};
/** A current read-only confirmation of a provider-verified original capture.
 * Two patient-carried copies; NOT a newly issued cash receipt, tax invoice,
 * settlement document or claim that the Foundation received money.
 */
export async function renderOnlineConfirmation(s:VerifiedOnlineConfirmation):Promise<Buffer>{
 try{
  const path=process.env.CG19_PDF_FONT_PATH;
  if(!path||!path.startsWith("/")||path.includes("..")||path.length>300)throw Error("Font");
  const bytes=await readFile(path);if(bytes.length<1000||bytes.length>10485760)throw Error("Font");
  const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);
  const font=await pdf.embedFont(bytes,{subset:true});
  pdf.setTitle("CareGanga verified online payment confirmation");
  pdf.setProducer("CareGanga CG19 private documents");
  pdf.setCreationDate(new Date(s.checkedAt));
  const page=pdf.addPage([595,842]),green=rgb(.075,.29,.18),gold=rgb(.98,.88,.53),cream=rgb(.99,.98,.94),ink=rgb(.13,.20,.17),white=rgb(1,1,1);
  const status=BigInt(s.dueMinor)===0n?"NOTHING DUE":BigInt(s.outstandingMinor)===0n?"PAID — VERIFIED CENTER COLLECTION":BigInt(s.collectedMinor)>0n?"PARTIALLY COLLECTED":"DUE";
  const copy=(top:number,label:string)=>{
   page.drawRectangle({x:28,y:top-48,width:539,height:48,color:green});
   page.drawText("CareGanga Foundation",{x:40,y:top-19,font,size:16,color:white});
   page.drawText("Verified online payment confirmation | "+label,{x:40,y:top-36,font,size:10,color:white});
   page.drawRectangle({x:28,y:top-78,width:539,height:25,color:gold});
   page.drawText("Current center balance: "+status,{x:40,y:top-69,font,size:11,color:green});
   const panel=(title:string,fields:[string,string][],x:number,width:number)=>{
    const panelTop=top-84,panelBottom=top-350;
    page.drawRectangle({x,y:panelBottom,width,height:panelTop-panelBottom,color:cream});
    page.drawRectangle({x,y:panelTop-20,width,height:20,color:green});
    page.drawText(title,{x:x+9,y:panelTop-13,font,size:9.5,color:white});
    const makeRows=(size:number)=>fields.map(([label,value])=>{
     const lines:string[]=[];let part="";
     for(const ch of value.replace(/[\u0000-\u001f\u007f]/g," ")){
      if(part&&font.widthOfTextAtSize(part+ch,size)>width-18){lines.push(part);part="";}
      part+=ch;
     }
     if(part)lines.push(part);
     return {label,lines:lines.length?lines:["—"]};
    });
    const options=[9.5,9,8.5].map(size=>({size,rows:makeRows(size)}));
    const fit=options.find(v=>v.rows.reduce((n,row)=>n+12+row.lines.length*(v.size+2),0)<=panelTop-panelBottom-35);
    if(!fit)throw Error("Printable area");
    let y=panelTop-32;
    for(const row of fit.rows){
     page.drawText(row.label,{x:x+9,y,font,size:8,color:green});y-=10;
     for(const line of row.lines){page.drawText(line,{x:x+9,y,font,size:fit.size,color:ink});y-=fit.size+2;}
     y-=2;
    }
   };
   let date=s.appointmentAt;
   try{date=new Date(s.appointmentAt).toLocaleString("en-IN",{timeZone:s.timeZone,dateStyle:"medium",timeStyle:"short"})+" ("+s.timeZone+")";}catch{/* retain original UTC */}
   panel("Booking & verified payment",[
    ["Booking ID",s.bookingId],["Patient",s.patientName],["Doctor",s.doctorName],
    ["Healthcare center",s.centerName],["Appointment",date],
    ["Provider transaction / method",s.paymentReference+" / "+s.method],
    ["Capture recorded (UTC)",s.capturedAt]
   ],28,263);
   panel("Consultation fee & current balance",[
    ["Actual consultation fee",money(s.grossMinor)],["Foundation contribution",money(s.supportMinor)],
    ["Patient amount",money(s.dueMinor)],["Verified online capture",money(s.capturedMinor)],
    ["Refund against capture",money(s.captureRefundMinor)],["Total net center received",money(s.collectedMinor)],
    ["Balance payable",money(s.outstandingMinor)],["Checked (UTC)",s.checkedAt]
   ],301,266);
   page.drawText("Current confirmation only; not a tax invoice or Foundation settlement receipt.",{x:40,y:top-366,font,size:8.5,color:ink});
  };
  copy(818,"Patient copy");copy(405,"Center copy (patient-carried)");
  page.drawLine({start:{x:28,y:420},end:{x:567,y:420},color:ink,thickness:.5,dashArray:[4,4]});
  const output=Buffer.from(await pdf.save({useObjectStreams:false}));
  if(output.length<100||output.length>10485760)throw Error("Size");return output;
 }catch{throw new ServiceUnavailableException({code:"CENTER_ONLINE_CONFIRMATION_UNAVAILABLE"});}
}
