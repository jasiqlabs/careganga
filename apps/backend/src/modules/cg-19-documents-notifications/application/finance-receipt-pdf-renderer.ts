import {readFile} from "node:fs/promises";
import {ServiceUnavailableException} from "@nestjs/common";
import {PDFDocument,rgb} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type {OriginalReceipt} from "../../cg-09-finance-accounting/application/finance-receipt-source.facade";
const money=(s:string)=>{const n=BigInt(s);return "INR "+(n/100n).toString()+"."+
 (n%100n).toString().padStart(2,"0");};
export async function renderFinanceReceipt(source:OriginalReceipt,issuedAt:string):Promise<Buffer>{
 const fontPath=process.env.CG19_PDF_FONT_PATH;
 if(!fontPath||!fontPath.startsWith("/")||fontPath.includes("..")||fontPath.length>300)
  throw new ServiceUnavailableException("Protected Foundation PDF font not configured");
 let fontBytes:Buffer;
 try{fontBytes=await readFile(fontPath);}catch{
  throw new ServiceUnavailableException("Foundation PDF font unavailable");
 }
 if(fontBytes.length<1000||fontBytes.length>10485760)
  throw new ServiceUnavailableException("Foundation PDF font validation failed");
 try{
  const pdf=await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font=await pdf.embedFont(fontBytes,{subset:true});
  const title="CareGanga Foundation — Payment Receipt "+source.receiptNumber;
  pdf.setTitle(title);pdf.setProducer("CareGanga CG-19 Private Documents");
  pdf.setCreationDate(new Date(issuedAt));
  const page=pdf.addPage([595,842]),blue=rgb(0.14,0.3,0.67),gray=rgb(0.32,0.36,0.43);
  page.drawRectangle({x:0,y:816,width:595,height:26,color:blue});
  page.drawText("CareGanga Foundation",{x:45,y:779,font,size:18,color:blue});
  page.drawText("Financial Receipt — Verified Bank Collection",{x:45,y:750,font,size:12,color:gray});
  page.drawLine({start:{x:45,y:730},end:{x:550,y:730},thickness:0.8,color:gray});
  let y=693;
  const draw=(label:string,value:string)=>{
   const combined=(label+": "+value).replace(/[\u0000-\u001f\u007f]/g," ").trim();
   let part="";
   for(const char of [...combined]){
    if(font.widthOfTextAtSize(part+char,11)>485&&part){
     if(y<100)throw Error("Receipt too long");
     page.drawText(part,{x:46,y,font,size:11,color:gray});y-=18;part="";
    }
    part+=char;
   }
   if(y<100)throw Error("Receipt too long");
   page.drawText(part,{x:46,y,font,size:11,color:gray});y-=31;
  };
  draw("Receipt number",source.receiptNumber);
  draw("Original invoice",source.invoiceNumber);
  draw("Received from",source.counterparty);
  draw("Purpose",source.purpose);
  draw("Category",source.category);
  draw("Verified bank",source.bankName);
  draw("Bank statement date",source.paidDate);
  draw("Verified collection",money(source.amountMinor));
  draw("Receipt issued at (UTC)",issuedAt);
  page.drawLine({start:{x:45,y:151},end:{x:550,y:151},color:gray,thickness:0.8});
  page.drawText("Payment verified against a separately reviewed bank statement item.",{
   x:45,y:128,font,size:9,color:gray});
  page.drawText("Original journal and statement matching records remain in private Finance.",{
   x:45,y:111,font,size:9,color:gray});
  const bytes=Buffer.from(await pdf.save({useObjectStreams:false}));
  if(bytes.length<100||bytes.length>10485760)throw Error("Invalid receipt size");
  return bytes;
 }catch{throw new ServiceUnavailableException("Protected financial receipt cannot be rendered");}
}
