import {readFile} from "node:fs/promises";
import {ServiceUnavailableException} from "@nestjs/common";
import {PDFDocument,rgb} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
type Item={description:string;quantity:number;lineTotalMinor:string;unitRateMinor:string};
export type InvoicePdfSource=Readonly<{
 invoiceNumber:string;date:string;due:string;counterparty:string;address:string|null;
 purpose:string;category:string;items:readonly Item[];
 grossMinor:string;taxMinor:string;chargesMinor:string;totalMinor:string;
 terms:string;notes:string|null;postedAt:string;issueAt:string
}>;
const currency=(v:string)=>{
 const n=BigInt(v),abs=n<0n?-n:n;
 return (n<0n?"-":"")+"INR "+(abs/100n).toString()+"."+
  (abs%100n).toString().padStart(2,"0");
};
function safeText(s:string){return s.replace(/[\u0000-\u001f\u007f]/g," ").trim();}
function lines(value:string,font:{widthOfTextAtSize:(s:string,n:number)=>number},
 size:number,width:number){
 const result:string[]=[];
 for(const paragraph of value.split(/\r?\n/)){
  let line="";
  for(const part of paragraph.split(/\s+/)){
   if(!part)continue;
   if(font.widthOfTextAtSize(line?line+" "+part:part,size)>width&&line){
    result.push(line);line="";
   }
   let partText="";
   for(const char of [...part]){
    if(font.widthOfTextAtSize(partText+char,size)>width&&partText){
     if(line){result.push(line);line="";}
     result.push(partText);partText="";
    }
    partText+=char;
   }
   line=line?line+" "+partText:partText;
  }
  result.push(line);
 }
 return result;
}
export async function renderOriginalFinanceInvoice(input:InvoicePdfSource):Promise<Buffer>{
 const fontPath=process.env.CG19_PDF_FONT_PATH;
 if(!fontPath||!fontPath.startsWith("/")||fontPath.includes("..")||fontPath.length>300)
  throw new ServiceUnavailableException("The approved Foundation PDF font is not configured");
 let bytes:Buffer;
 try{bytes=await readFile(fontPath);}catch{
  throw new ServiceUnavailableException("The approved Foundation PDF font is unavailable");
 }
 if(bytes.length<1000||bytes.length>10*1024*1024)
  throw new ServiceUnavailableException("The Foundation PDF font could not be verified");
 try{
  const doc=await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font=await doc.embedFont(bytes,{subset:true});
  doc.setTitle("CareGanga Foundation — Invoice "+input.invoiceNumber);
  doc.setProducer("CareGanga CG-19 Protected Documents");
  doc.setCreationDate(new Date(input.issueAt));
  const navy=rgb(0.14,0.3,0.67),grey=rgb(0.3,0.35,0.43);
  let p=doc.addPage([595,842]),y=790;
  const top=()=>{
   p.drawRectangle({x:0,y:818,width:595,height:24,color:navy});
   p.drawText("CareGanga Foundation",{x:44,y:786,font,size:18,color:navy});
   p.drawText("Financial Invoice — Original protected copy",{
    x:44,y:764,font,size:10,color:grey});
   p.drawLine({start:{x:44,y:753},end:{x:551,y:753},thickness:0.7,color:grey});
   y=730;
  };
  const next=()=>{p=doc.addPage([595,842]);top();};
  const write=(str:string,size:number=10,gap:number=17)=>{
   for(const line of lines(safeText(str),font,size,490)){
    if(y<95)next();
    if(line)p.drawText(line,{x:46,y,font,size,color:grey});
    y-=gap;
   }
  };
  top();
  for(const [name,value] of [
   ["Invoice No.",input.invoiceNumber],["Invoice Date",input.date],
   ["Due Date",input.due],["Counterparty",input.counterparty],
   ["Address",input.address??"Not provided"],["Category",input.category],
   ["Purpose",input.purpose],["Approved journal recorded (UTC)",input.postedAt]
  ])write(name+": "+value,10,19);
  y-=12;
  write("Items and Amounts",13,24);
  for(let i=0;i<input.items.length;i++){
   const line=input.items[i];
   write(String(i+1)+". "+line.description,10,17);
   write("Qty "+String(line.quantity)+"  |  Rate "+currency(line.unitRateMinor)+
    "  |  Total "+currency(line.lineTotalMinor),9,16);
  }
  y-=10;
  for(const [name,value] of [
   ["Subtotal",input.grossMinor],["Tax",input.taxMinor],
   ["Other charges",input.chargesMinor],["Invoice total",input.totalMinor]
  ])write(name+": "+currency(value),11,21);
  write("Terms: "+input.terms,10,19);
  if(input.notes)write("Notes: "+input.notes,9,17);
  y-=5;
  write("Issue timestamp (UTC): "+input.issueAt,9,16);
  write("This PDF confirms approved invoice issuance only. It is not a payment receipt.",9,16);
  const buffer=Buffer.from(await doc.save({useObjectStreams:false}));
  if(buffer.length<100||buffer.length>10485760)
   throw new ServiceUnavailableException("Issued invoice PDF exceeds document limits");
  return buffer;
 }catch{
  throw new ServiceUnavailableException("A valid private invoice PDF could not be rendered");
 }
}
