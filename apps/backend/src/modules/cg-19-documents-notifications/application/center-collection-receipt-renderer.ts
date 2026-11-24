import {readFile} from "node:fs/promises";
import {ServiceUnavailableException} from "@nestjs/common";
import {PDFDocument,rgb} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

/** Source-owned original CG17 cash collection projected to a single CG19
 * private receipt. Never states that the Foundation received this money.
 */
export type OriginalCenterCashReceipt={
 receiptNumber:string;centerName:string;amountMinor:string;
 collectionDate:string;issuedAt:string;sourceDigest:string;
};
const money=(s:string)=>{
 const n=BigInt(s);
 return "INR "+(n/100n).toString()+"."+(n%100n).toString().padStart(2,"0");
};
export async function renderCenterCashReceipt(
 source:OriginalCenterCashReceipt):Promise<Buffer>{
 const path=process.env.CG19_PDF_FONT_PATH;
 if(!path||!path.startsWith("/")||path.includes("..")||path.length>300)
  throw new ServiceUnavailableException("Protected receipt font is not configured");
 let bytes:Buffer;
 try{bytes=await readFile(path);}catch{
  throw new ServiceUnavailableException("Protected receipt font unavailable");
 }
 if(bytes.length<1000||bytes.length>10485760)
  throw new ServiceUnavailableException("Receipt font cannot be verified");
 try{
  const pdf=await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font=await pdf.embedFont(bytes,{subset:true});
  pdf.setTitle("CareGanga Healthcare Center Cash Receipt");
  pdf.setProducer("CareGanga CG-19 Private Documents");
  pdf.setSubject("CG17-CENTER-CASH-RECEIPT:"+source.sourceDigest);
  pdf.setCreationDate(new Date(source.issuedAt));
  const page=pdf.addPage([595,842]);
  const accent=rgb(.075,.29,.18),body=rgb(.22,.29,.26),gold=rgb(.98,.88,.53),cream=rgb(.99,.98,.94),white=rgb(1,1,1);
  page.drawRectangle({x:0,y:816,width:595,height:26,color:accent});
  page.drawRectangle({x:28,y:736,width:539,height:73,color:accent});
  page.drawText("CareGanga Foundation",{x:45,y:778,font,size:18,color:white});
  page.drawText("Healthcare Center — Cash Collection Receipt",{
   x:45,y:749,font,size:12,color:white});
  page.drawLine({start:{x:45,y:730},end:{x:550,y:730},thickness:0.8,color:body});
  page.drawRectangle({x:28,y:675,width:539,height:48,color:gold});
  page.drawText("Verified cash received: "+money(source.amountMinor),{x:42,y:692,font,size:15,color:accent});
  page.drawRectangle({x:28,y:178,width:539,height:484,color:cream});
  let y=637;
  const draw=(label:string,value:string)=>{
   const str=(label+": "+value).replace(/[\u0000-\u001f\u007f]/g," ").trim();
   let line="";
   for(const char of [...str]){
    if(font.widthOfTextAtSize(line+char,11)>485&&line){
     if(y<190)throw Error("Receipt fields exceed printable page");
     page.drawText(line,{x:46,y,font,size:11,color:body});
     y-=19;line="";
    }
    line+=char;
   }
   if(y<130)throw Error("Receipt fields exceed printable page");
   page.drawText(line,{x:46,y,font,size:11,color:body});y-=32;
  };
  draw("Receipt number",source.receiptNumber);
  draw("Healthcare center",source.centerName);
  draw("Payment method","Cash (verified by authorized center cashier)");
  draw("Cash amount received",money(source.amountMinor));
  draw("Original collection timestamp (UTC)",source.collectionDate);
  draw("Private receipt issued timestamp (UTC)",source.issuedAt);
  page.drawLine({start:{x:45,y:165},end:{x:550,y:165},thickness:0.8,color:body});
  page.drawText("This confirms only the specified healthcare center's cash collection.",{
   x:45,y:139,font,size:9,color:body});
  page.drawText("It is not a receipt for Foundation income or provider settlement.",{
   x:45,y:123,font,size:9,color:body});
  const output=Buffer.from(await pdf.save({useObjectStreams:false}));
  if(output.length<100||output.length>10485760)
   throw Error("Original generated receipt has invalid size");
  return output;
 }catch{
  throw new ServiceUnavailableException("Protected center receipt cannot be rendered");
 }
}
