import {readFile} from "node:fs/promises";
import {ServiceUnavailableException} from "@nestjs/common";
import {PDFDocument,rgb} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
export type VerifiedOnlineConfirmation={
 bookingId:string;centerName:string;paymentReference:string;method:string;capturedAt:string;
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
  const status=BigInt(s.dueMinor)===0n?"NOTHING DUE":BigInt(s.outstandingMinor)===0n?"COLLECTED":BigInt(s.collectedMinor)>0n?"PARTIALLY COLLECTED":"DUE";
  const copy=(top:number,label:string)=>{
   page.drawRectangle({x:28,y:top-48,width:539,height:48,color:green});
   page.drawText("CareGanga Foundation",{x:40,y:top-19,font,size:16,color:white});
   page.drawText("Verified online payment confirmation | "+label,{x:40,y:top-36,font,size:10,color:white});
   page.drawRectangle({x:28,y:top-78,width:539,height:25,color:gold});
   page.drawText("Current center balance: "+status,{x:40,y:top-69,font,size:11,color:green});
   page.drawRectangle({x:28,y:top-350,width:539,height:267,color:cream});
   let y=top-97;
   const line=(label:string,value:string)=>{
    let str=(label+": "+value).replace(/[\u0000-\u001f\u007f]/g," "),part="";
    for(const ch of str){if(part&&font.widthOfTextAtSize(part+ch,9)>510){if(y<top-335)throw Error("Printable area");page.drawText(part,{x:40,y,font,size:9,color:ink});y-=11;part="";}part+=ch;}
    if(y<top-335)throw Error("Printable area");page.drawText(part,{x:40,y,font,size:9,color:ink});y-=16;
   };
   line("Booking",s.bookingId);line("Healthcare center",s.centerName);
   line("Provider reference",s.paymentReference);line("Payment method",s.method);
   line("Verified capture (UTC)",s.capturedAt);
   line("Consultation fee / Foundation share",money(s.grossMinor)+" / "+money(s.supportMinor));
   line("Patient amount",money(s.dueMinor));line("This verified capture",money(s.capturedMinor));
   line("Refunds against this capture",money(s.captureRefundMinor));
   line("Total net verified center collection",money(s.collectedMinor));
   line("Outstanding",money(s.outstandingMinor));line("Balance checked (UTC)",s.checkedAt);
   page.drawText("Current confirmation only; not a tax invoice or Foundation settlement receipt.",{x:40,y:top-366,font,size:8.5,color:ink});
  };
  copy(818,"Patient copy");copy(405,"Center copy (patient-carried)");
  page.drawLine({start:{x:28,y:420},end:{x:567,y:420},color:ink,thickness:.5,dashArray:[4,4]});
  const output=Buffer.from(await pdf.save({useObjectStreams:false}));
  if(output.length<100||output.length>10485760)throw Error("Size");return output;
 }catch{throw new ServiceUnavailableException({code:"CENTER_ONLINE_CONFIRMATION_UNAVAILABLE"});}
}
