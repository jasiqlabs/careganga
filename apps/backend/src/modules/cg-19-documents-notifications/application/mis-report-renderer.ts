import {readFile} from "node:fs/promises";
import {deflateRawSync} from "node:zlib";
import {ServiceUnavailableException} from "@nestjs/common";
import {PDFDocument,rgb} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

export type ReportFormat="PDF"|"XLSX"|"CSV";
export type ReportData=Readonly<{
 label:string;scopeLabel:string;sourceReadAt:string;sourceAsOf?:string;
 sourceDigest:string;
 columns:ReadonlyArray<{key:string;label:string;unit?:string}>;
 rows:ReadonlyArray<Readonly<Record<string,string>>>
}>;
const MIMES:Record<ReportFormat,string>={
 PDF:"application/pdf",
 XLSX:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
 CSV:"text/csv"
};
export const reportMime=(f:ReportFormat)=>MIMES[f];
const clean=(text:string)=>text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g," ")
 .slice(0,1500).trim();
const money=(minor:string)=>{
 if(!/^-?\d{1,16}$/.test(minor))return "Not confirmed";
 const n=BigInt(minor),abs=n<0n?-n:n;
 return (n<0n?"-":"")+(abs/100n).toString()+"."+
  (abs%100n).toString().padStart(2,"0");
};
const field=(value:string|undefined,unit?:string)=>{
 const str=typeof value==="string"?value:"";
 return clean(unit==="INR_MINOR"?money(str):str);
};
const excelText=(s:string)=>{
 // Spreadsheet software must NEVER interpret a source-owned text value as
 // a formula, command or external link (also neutralize initial tabs/CR).
 const v=clean(s);
 return /^[\s]*[=+\-@\t\r]/.test(v)?"'"+v:v;
};
const quote=(v:string)=>'"'+excelText(v).replace(/"/g,'""')+'"';
const xml=(s:string)=>s.replace(/&/g,"&amp;").replace(/</g,"&lt;")
 .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");
function validate(data:ReportData){
 if(data.columns.length<1||data.columns.length>12||data.rows.length>50||
  !/^[a-f0-9]{64}$/.test(data.sourceDigest)||data.label.length>120||
  data.scopeLabel.length>150||data.columns.some(c=>
   c.label.length>100||!/^[a-zA-Z][a-zA-Z0-9]{0,45}$/.test(c.key))||
  data.rows.some(r=>data.columns.some(c=>
   typeof r[c.key]!=="string"||r[c.key].length>1500)))
  throw new ServiceUnavailableException("The protected report exceeds safe output limits");
}
export function csvReport(data:ReportData):Buffer{
 validate(data);
 const rows=[
  ["CareGanga Foundation report",data.label],
  ["Permitted scope",data.scopeLabel],
  ["Original source read",data.sourceAsOf??data.sourceReadAt],
  [],
  data.columns.map(c=>c.label+(c.unit==="INR_MINOR"?" (₹)":"")),
  ...data.rows.map(row=>data.columns.map(c=>field(row[c.key],c.unit)))
 ];
 const csv="\ufeff"+rows.map(r=>r.map(quote).join(",")).join("\r\n")+"\r\n";
 const b=Buffer.from(csv,"utf8");
 if(b.length>5242880)throw new ServiceUnavailableException("Report too large");
 return b;
}
// Real Excel workbook with inlineStr and numerical amounts, not renamed CSV.
// Fixed, known package entries prevent external relationships/macros/formulas.
const crc32=(bytes:Buffer)=>{
 let crc=0xffffffff;
 for(const b of bytes){
  crc^=b;
  for(let n=0;n<8;n++)crc=crc&1?(crc>>>1)^0xedb88320:crc>>>1;
 }
 return (crc^0xffffffff)>>>0;
};
const zip=(entries:ReadonlyArray<{path:string;bytes:Buffer}>)=>{
 const local:Buffer[]=[],central:Buffer[]=[];
 let offset=0;
 for(const item of entries){
  const name=Buffer.from(item.path,"utf8");
  const compressed=deflateRawSync(item.bytes,{level:6});
  const checksum=crc32(item.bytes);
  const head=Buffer.alloc(30);
  head.writeUInt32LE(0x04034b50,0);head.writeUInt16LE(20,4);
  head.writeUInt16LE(0x0800,6);head.writeUInt16LE(8,8);
  head.writeUInt32LE(checksum,14);
  head.writeUInt32LE(compressed.length,18);
  head.writeUInt32LE(item.bytes.length,22);
  head.writeUInt16LE(name.length,26);
  local.push(head,name,compressed);
  const entry=Buffer.alloc(46);
  entry.writeUInt32LE(0x02014b50,0);
  entry.writeUInt16LE(20,4);entry.writeUInt16LE(20,6);
  entry.writeUInt16LE(0x0800,8);entry.writeUInt16LE(8,10);
  entry.writeUInt32LE(checksum,16);
  entry.writeUInt32LE(compressed.length,20);
  entry.writeUInt32LE(item.bytes.length,24);
  entry.writeUInt16LE(name.length,28);
  entry.writeUInt32LE(offset,42);
  central.push(entry,name);
  offset+=head.length+name.length+compressed.length;
 }
 const cd=Buffer.concat(central),end=Buffer.alloc(22);
 end.writeUInt32LE(0x06054b50,0);
 end.writeUInt16LE(entries.length,8);
 end.writeUInt16LE(entries.length,10);
 end.writeUInt32LE(cd.length,12);end.writeUInt32LE(offset,16);
 return Buffer.concat([...local,cd,end]);
};
const colName=(index:number)=>{
 let x=index+1,name="";
 while(x){x--;name=String.fromCharCode(65+x%26)+name;x=Math.floor(x/26);}
 return name;
};
export function xlsxReport(data:ReportData):Buffer{
 validate(data);
 const records=[
  ["CareGanga Foundation report",data.label],
  ["Permitted scope",data.scopeLabel],
  ["Original source read",data.sourceAsOf??data.sourceReadAt],
  [],
  data.columns.map(c=>c.label+(c.unit==="INR_MINOR"?" (₹)":"")),
  ...data.rows.map(r=>data.columns.map(c=>field(r[c.key],c.unit)))
 ];
 const sheetRows=records.map((values,index)=>{
  const cells=values.map((value,c)=>{
   const address=colName(c)+(index+1);
   const reportCol=index>4?data.columns[c]:undefined;
   const numeric=reportCol?.unit==="INR_MINOR"||reportCol?.unit==="COUNT";
   if(numeric&&/^-?\d{1,15}(?:\.\d{1,2})?$/.test(value))
    return `<c r="${address}"><v>${value}</v></c>`;
   return `<c r="${address}" t="inlineStr"><is><t xml:space="preserve">${xml(excelText(value))}</t></is></c>`;
  }).join("");
  return `<row r="${index+1}">${cells}</row>`;
 }).join("");
 const sheet=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
 <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
 <sheetData>${sheetRows}</sheetData></worksheet>`;
 const entries=[
  {path:"[Content_Types].xml",bytes:Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
 <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
 <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
 <Default Extension="xml" ContentType="application/xml"/>
 <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
 <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
 </Types>`)},
  {path:"_rels/.rels",bytes:Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
 <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
 <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
 </Relationships>`)},
  {path:"xl/workbook.xml",bytes:Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
 <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
 <sheets><sheet name="CareGanga Report" sheetId="1" r:id="rId1"/></sheets></workbook>`)},
  {path:"xl/_rels/workbook.xml.rels",bytes:Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
 <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
 <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
 </Relationships>`)},
  {path:"xl/worksheets/sheet1.xml",bytes:Buffer.from(sheet)}
 ];
 const result=zip(entries);
 if(result.length>5242880)throw new ServiceUnavailableException("Report too large");
 return result;
}
export async function pdfReport(data:ReportData):Promise<Buffer>{
 validate(data);
 const fontPath=process.env.CG19_PDF_FONT_PATH;
 if(!fontPath||!fontPath.startsWith("/")||fontPath.includes("..")||
  fontPath.length>300)
  throw new ServiceUnavailableException("Private report PDF font is unavailable");
 const fontBytes=await readFile(fontPath).catch(()=>{
  throw new ServiceUnavailableException("Private PDF font is unavailable");
 });
 if(fontBytes.length<1000||fontBytes.length>10485760)
  throw new ServiceUnavailableException("Private PDF font is unavailable");
 const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);
 const font=await pdf.embedFont(fontBytes,{subset:true});
 const blue=rgb(.13,.31,.69),dark=rgb(.13,.19,.28);
 pdf.setTitle("CareGanga "+clean(data.label));
 pdf.setSubject("CG20-REPORT:"+data.sourceDigest);
 pdf.setProducer("CareGanga CG-19 Protected Report");
 let page=pdf.addPage([595,842]),y=775;
 const header=()=>{
  page.drawRectangle({x:0,y:810,width:595,height:32,color:blue});
  page.drawText("CareGanga Foundation",{x:38,y:772,size:15,font,color:blue});
  y=739;
 };
 const next=(height=20)=>{
  if(y-height<50){page=pdf.addPage([595,842]);header();}
 };
 const line=(value:string,size=9)=>{
  let remaining=clean(value).replace(/[\r\n]+/g," ");
  if(!remaining){next();y-=14;return;}
  while(remaining.length){
   next(22);
   let part="";
   for(const ch of remaining){
    if(font.widthOfTextAtSize(part+ch,size)>505&&part)break;
    part+=ch;
   }
   if(!part)throw new ServiceUnavailableException("Report line cannot be rendered");
   page.drawText(part,{x:40,y,size,font,color:dark});y-=15;
   remaining=remaining.slice(part.length);
  }
 };
 header();line(data.label,12);line(data.scopeLabel);
 line("Original source read: "+(data.sourceAsOf??data.sourceReadAt));y-=8;
 if(data.rows.length===0)line("No authorized source records match these filters.");
 for(let i=0;i<data.rows.length;i++){
  next(70);line("Entry "+String(i+1),10);
  for(const c of data.columns)
   line(c.label+": "+field(data.rows[i][c.key],c.unit),9);
  y-=7;
 }
 const bytes=Buffer.from(await pdf.save({useObjectStreams:false}));
 if(bytes.length<100||bytes.length>5242880)
  throw new ServiceUnavailableException("Protected PDF is outside file limits");
 return bytes;
}
export async function renderMisReport(format:ReportFormat,data:ReportData){
 return format==="PDF"?pdfReport(data):format==="CSV"?csvReport(data):xlsxReport(data);
}
