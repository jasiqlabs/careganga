import {readFile} from "node:fs/promises";
import {ServiceUnavailableException} from "@nestjs/common";
import {PDFDocument,rgb} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

/** CG19's original private document renderer: CG16 supplies only existing
 * CG15 patient and actual accepted order-line measurements. No clinical
 * reference ranges, diagnosis or interpretations are ever guessed.
 */
export type LaboratoryReportSource=Readonly<{
 sourceDigest:string;orderNumber:string;centerName:string;
 versionNo:number;corrected:boolean;
 patientName:string;patientDisplayId:string;recordedAt:string;
 results:ReadonlyArray<Readonly<{
  testName:string;value:string;unit:string;observation:string
 }>>
}>;
const clean=(s:string)=>s.replace(/[\u0000-\u001f\u007f]/g," ").trim();
export async function renderLaboratoryReport(source:LaboratoryReportSource):
 Promise<Buffer>{
 const path=process.env.CG19_PDF_FONT_PATH;
 if(!path||!path.startsWith("/")||path.includes("..")||path.length>300)
  throw new ServiceUnavailableException("Private report font is not configured");
 const bytes=await readFile(path).catch(()=>{
  throw new ServiceUnavailableException("Private report font is unavailable");
 });
 if(bytes.length<1000||bytes.length>10485760||source.results.length<1||
  source.results.length>50)
  throw new ServiceUnavailableException("Laboratory report input is unavailable");
 try{
  const pdf=await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font=await pdf.embedFont(bytes,{subset:true});
  const blue=rgb(.14,.3,.67),gray=rgb(.27,.33,.4);
  pdf.setTitle("CareGanga Laboratory Report — "+clean(source.orderNumber));
  pdf.setProducer("CareGanga CG-19 Private Documents");
  pdf.setSubject("CG16-GENERATED-RESULT:"+source.sourceDigest);
  pdf.setCreationDate(new Date(source.recordedAt));
  pdf.setModificationDate(new Date(source.recordedAt));
  let page=pdf.addPage([595,842]),y=0;
  const header=()=>{
   page.drawRectangle({x:0,y:815,width:595,height:27,color:blue});
   page.drawText("CareGanga Healthcare",{x:40,y:778,font,size:18,color:blue});
   page.drawText("Laboratory Test Report",{x:40,y:750,font,size:13,color:gray});
   page.drawLine({start:{x:40,y:733},end:{x:555,y:733},
    thickness:.8,color:gray});
   y=704;
  };
  const next=(height:number)=>{
   if(y-height<80){page=pdf.addPage([595,842]);header();}
  };
  const line=(label:string,value:string,size=10)=>{
   let remaining=clean(label+": "+value);
   do{
    next(18);
    let fragment="";
    for(const ch of [...remaining]){
     if(font.widthOfTextAtSize(fragment+ch,size)>505&&fragment)break;
     fragment+=ch;
    }
    if(!fragment)throw Error("Report field too wide");
    page.drawText(fragment,{x:43,y,font,size,color:gray});
    y-=17;
    remaining=remaining.slice(fragment.length);
   }while(remaining);
  };
  header();
  line("Laboratory center",source.centerName,11);
  line("Patient",source.patientName,11);
  line("Patient ID",source.patientDisplayId,10);
  line("Lab order",source.orderNumber,10);
  line("Report version",String(source.versionNo),10);
  if(source.corrected)
   line("Report status","Corrected version; earlier release preserved",10);
  line("Result recorded (UTC)",source.recordedAt,10);
  y-=11;next(50);
  page.drawText("Recorded test results",{x:43,y,font,size:12,color:blue});y-=27;
  for(let i=0;i<source.results.length;i++){
   const r=source.results[i];
   next(55);
   line(String(i+1)+". Test",r.testName,11);
   line("Result",r.value+(r.unit?" "+r.unit:""),11);
   if(r.observation)line("Observation",r.observation,10);
   y-=11;
  }
  next(75);
  page.drawLine({start:{x:40,y},end:{x:555,y},
   thickness:.8,color:gray});y-=24;
  line("Access","Clinical approval and patient release are verified in CareGanga",9);
  line("Source","Results shown are the values actually recorded in the system",9);
  const buffer=Buffer.from(await pdf.save({useObjectStreams:false}));
  if(buffer.length<100||buffer.length>10485760)
   throw Error("Generated laboratory PDF is outside file limits");
  return buffer;
 }catch{
  throw new ServiceUnavailableException("Laboratory PDF could not be generated");
 }
}
