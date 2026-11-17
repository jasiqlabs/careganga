import {readFile} from "node:fs/promises";
import {ServiceUnavailableException} from "@nestjs/common";
import {PDFDocument,rgb} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

/** CG-19 private invoice correction PDF. Numbers come only from immutable
 * CG-09 posted and protected credit-note facts, never client-supplied HTML.
 * This is not the CG-07 donor donation receipt/certificate layout.
 */
export type FinanceCreditNotePdfSource={
 noteNumber:string;invoiceNumber:string;invoiceDate:string;creditDate:string;
 counterparty:string;reason:string;totalMinor:string;collectedMinor:string;
 incomeMinor:string;taxMinor:string;currency:"INR";
};
const money=(v:string)=>{
 const n=BigInt(v),a=n<0n?-n:n;
 return (n<0n?"-":"")+"INR "+(a/100n).toString()+"."+
  (a%100n).toString().padStart(2,"0");
};
const clean=(v:string)=>v.replace(/[\u0000-\u001f\u007f]/g," ").trim();
export async function renderOriginalFinanceCreditNote(x:FinanceCreditNotePdfSource):Promise<Buffer>{
 const path=process.env.CG19_PDF_FONT_PATH;
 if(!path||!path.startsWith("/")||path.includes("..")||path.length>300)
  throw new ServiceUnavailableException("Foundation PDF font is not configured");
 let bytes:Buffer;
 try{bytes=await readFile(path);}catch{
  throw new ServiceUnavailableException("Foundation PDF font is not available");
 }
 if(bytes.length<1000||bytes.length>10*1024*1024)
  throw new ServiceUnavailableException("Foundation PDF font is invalid");
 const doc=await PDFDocument.create();
 doc.registerFontkit(fontkit);
 const font=await doc.embedFont(bytes,{subset:true});
 const page=doc.addPage([595,842]);
 const blue=rgb(0.08,0.25,0.61),grey=rgb(0.28,0.32,0.39);
 page.drawRectangle({x:0,y:818,width:595,height:24,color:blue});
 page.drawText("CareGanga Foundation",{x:42,y:777,font,size:19,color:blue});
 page.drawText("CREDIT NOTE — ISSUED INVOICE CORRECTION",
  {x:42,y:750,font,size:13,color:blue});
 page.drawLine({start:{x:42,y:737},end:{x:552,y:737},thickness:0.8,color:grey});
 let y=703;
 const row=(name:string,value:string)=>{
  const line=clean(name+": "+value);
  // Long original explanations wrap without exposing an extra private PDF page.
  const tokens=line.split(/\s+/);let current="";
  for(const token of tokens){
   const test=current?current+" "+token:token;
   if(font.widthOfTextAtSize(test,10)>495&&current){
    page.drawText(current,{x:43,y,font,size:10,color:grey});y-=19;current=token;
   }else current=test;
  }
  if(current)page.drawText(current,{x:43,y,font,size:10,color:grey});
  y-=23;
 };
 row("Credit note number",x.noteNumber);
 row("Original invoice number",x.invoiceNumber);
 row("Original invoice date",x.invoiceDate);
 row("Credit note date",x.creditDate);
 row("Original billed counterparty",x.counterparty);
 row("Correction reason",x.reason);
 y-=14;row("Approved invoice amount",money(x.totalMinor));
 row("Income adjustment",money(x.incomeMinor));
 row("Tax adjustment (original value only)",money(x.taxMinor));
 row("Previously verified collection",money(x.collectedMinor));
 row("Receivable removed",money((BigInt(x.totalMinor)-BigInt(x.collectedMinor)).toString()));
 row("Separate refund payable",money(x.collectedMinor));
 y-=14;
 row("Total credit note",money(x.totalMinor));
 y-=35;
 row("This credit note preserves the issued original invoice and its payment history.");
 row("A refund, if applicable, requires its own approval and verified bank evidence.");
 row("This document does not itself confirm a refund or create a new donor 80G receipt.");
 doc.setTitle("CareGanga Foundation credit note "+x.noteNumber);
 doc.setSubject("Original invoice "+x.invoiceNumber);
 doc.setProducer("CareGanga CG-19 Protected Finance Documents");
 const result=Buffer.from(await doc.save({useObjectStreams:false}));
 if(result.length<100||result.length>10485760)
  throw new ServiceUnavailableException("Credit note could not be safely rendered");
 return result;
}
