import {readFile} from "node:fs/promises";
import {PDFDocument,rgb,type PDFFont,type PDFPage,type PDFImage} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import {createHash,createHmac} from "node:crypto";
import {ServiceUnavailableException} from "@nestjs/common";
import {opaqueAppointmentQr} from "./cg19-appointment-qr";
export type HrLetterKind="heading"|"bullet"|"paragraph"|"numbered"|"center"|"underline";
export type HrLetterBlock={kind:HrLetterKind;text:string};
/** No HTML or executable formatting. The exact serialized body is approved and hashed. */
const marker:Record<HrLetterKind,string>={heading:"# ",bullet:"- ",paragraph:"",numbered:"[numbered] ",center:"[center] ",underline:"[underline] "};
export function hrLetterBlocks(body:string):HrLetterBlock[]{
 return body.split(/\r?\n/).map(line=>{
  for(const kind of ["heading","bullet","numbered","center","underline"] as const){
   const prefix=marker[kind];
   if(line.startsWith(prefix)&&(line.slice(prefix.length).trim()||kind!=="heading"&&kind!=="bullet"))return {kind,text:line.slice(prefix.length).trim()};
  }
  return {kind:"paragraph",text:line};
 });
}
export const hrCardFields=["designation","branch","issueDate"] as const;
export type HrCardField=typeof hrCardFields[number];
const cardMarker="[card-fields] ";
export function hrCardVisibleFields(body:string):HrCardField[]{
 const config=body.split(/\r?\n/).find(line=>line.startsWith(cardMarker));
 if(!config)return [...hrCardFields];
 const selected=new Set(config.slice(cardMarker.length).split(",").map(x=>x.trim()));
 return hrCardFields.filter(k=>selected.has(k));
}

export const hrTemplateHash=(kind:string,title:string,body:string,assets?:{signatoryName:string;signatureSha256:string;sealSha256:string})=>createHash("sha256").update(JSON.stringify(assets?["CG19_HR_TEMPLATE_V2",kind,title,body,assets.signatoryName,assets.signatureSha256,assets.sealSha256]:["CG19_HR_TEMPLATE_V1",kind,title,body])).digest("hex");
export function employeeCardToken(realm:string,document:string,digest:string){
 const key=Buffer.from(process.env.CG19_EMPLOYEE_CARD_QR_KEY??"","base64");
 if(key.length!==32)throw new ServiceUnavailableException("Employee card verification is not configured");
 return "CGV-"+createHmac("sha256",key).update("CG19-HR-CARD-V1:"+realm+":"+document+":"+digest).digest("hex").slice(0,24).toUpperCase();
}
function wrap(value:string,font:PDFFont,size:number,width:number){
 const lines:string[]=[];
 for(const paragraph of value.split(/\r?\n/)){
  let line="";
  for(const ch of paragraph){
   if(line&&font.widthOfTextAtSize(line+ch,size)>width){lines.push(line.trimEnd());line="";}
   line+=ch;
  }
  lines.push(line);
 }
 return lines;
}
export async function renderHrDocument(input:{snapshot:Record<string,unknown>;title:string;body:string;reference:string;sourceDigest:string;documentRef:string;issueRevision:number;createdAt:Date;qr:string|null;portrait?:{bytes:Buffer;mime:string};signature?:{bytes:Buffer;mime:string};seal?:{bytes:Buffer;mime:string};signatoryName:string;preview?:boolean}){
 const path=process.env.CG19_PDF_FONT_PATH;
 if(!path||!path.startsWith("/")||path.includes(".."))throw new ServiceUnavailableException("The letter font is unavailable");
 const bytes=await readFile(path);
 if(bytes.length<1000||bytes.length>10*1024*1024)throw new ServiceUnavailableException("The letter font is unavailable");
 const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);
 const font=await pdf.embedFont(bytes,{subset:true}),blue=rgb(.12,.28,.6),grey=rgb(.34,.39,.46);
 pdf.setTitle("CareGanga private employee document");
 pdf.setSubject((input.preview?"CG19-HR-DRAFT:":"CG19-HR:")+input.documentRef+":"+input.sourceDigest+":"+input.issueRevision);
 pdf.setCreationDate(input.createdAt);pdf.setModificationDate(input.createdAt);
 const v=input.snapshot;
 const loadImage=async(f:{bytes:Buffer;mime:string})=>f.mime==="image/jpeg"?pdf.embedJpg(f.bytes):f.mime==="image/png"?pdf.embedPng(f.bytes):Promise.reject(new ServiceUnavailableException("Approved signatory asset format unavailable"));
 if(!input.preview&&(!input.signature||!input.seal))throw new ServiceUnavailableException("Approved signature and seal unavailable");
 const signature=!input.preview&&input.signature?await loadImage(input.signature):null,seal=!input.preview&&input.seal?await loadImage(input.seal):null;
 const drawAsset=(page:PDFPage,image:PDFImage,x:number,y:number,width:number,height:number)=>{const fit=image.scaleToFit(width,height);page.drawImage(image,{x:x+(width-fit.width)/2,y:y+(height-fit.height)/2,width:fit.width,height:fit.height});};
 const fact=(key:string)=>typeof v[key]==="string"?String(v[key]):"Not applicable";
 const print=(page:PDFPage,text:string,x:number,y:number,size:number,width:number)=>{
  for(const line of wrap(text,font,size,width)){
   if(y<35)throw new Error("Document content exceeds approved page");
   if(line)page.drawText(line,{x,y,size,font,color:grey});y-=size+5;
  }
  return y;
 };
 if(v.kind==="EMPLOYEE_ID"){
  if((!input.preview&&!input.qr)||!input.portrait)throw new ServiceUnavailableException("Card verification or approved portrait unavailable");
  const W=153.07,H=242.65,margin=12,gap=10;
  const previewSheet=input.preview?pdf.addPage([W*2+margin*2+gap,H+margin*2+20]):null;
  const front=previewSheet??pdf.addPage([W,H]),back=previewSheet??pdf.addPage([W,H]);
  const y0=input.preview?margin+20:0,x1=input.preview?margin:0,x2=input.preview?margin+W+gap:0;
  const navy=rgb(.055,.16,.31),green=rgb(.08,.43,.32),pale=rgb(.95,.97,.98),white=rgb(1,1,1);
  const rect=(page:PDFPage,x:number,y:number,width:number,height:number,color:ReturnType<typeof rgb>)=>page.drawRectangle({x,y:y+y0,width,height,color});
  const fit=(page:PDFPage,value:string,x:number,y:number,width:number,size:number,color=grey)=>{
   const one=value.replace(/\s+/g," ").trim()||"Not specified";
   const actual=Math.min(size,width*size/Math.max(1,font.widthOfTextAtSize(one,size)));
   page.drawText(one,{x,y:y+y0,size:actual,font,color});
  };
  for(const [page,x] of [[front,x1],[back,x2]] as const){
   rect(page,x,0,W,H,pale);rect(page,x,H-27,W,27,navy);rect(page,x,0,W,17,navy);
   fit(page,"CAREGANGA FOUNDATION",x+8,H-15,W-16,10,white);
   fit(page,"EMPLOYEE IDENTIFICATION",x+8,H-24,W-16,6.5,white);
  }
  const photo=await loadImage(input.portrait);
  drawAsset(front,photo,x1+42,y0+142,69,69);
  fit(front,fact("recipient"),x1+9,129,W-18,12,navy);
  const visible=hrCardVisibleFields(input.body);
  if(visible.includes("designation"))fit(front,fact("designation"),x1+9,115,W-18,8,green);
  for(const [label,k,y] of [["Employee","subjectReference",95],["Branch","branch",77],["Issue date","issueDate",59],["Valid until","expiryDate",41]] as const){
   if((k==="branch"||k==="issueDate")&&!visible.includes(k))continue;
   fit(front,label,x1+9,y+7,W-18,6.5,grey);fit(front,fact(k),x1+9,y-1,W-18,8.5,navy);
  }
  fit(front,input.preview?"DRAFT - NOT VALID":"Version "+input.issueRevision,x1+9,7,W-18,7,white);
  fit(back,"VERIFY EMPLOYEE CARD",x2+9,H-43,W-18,10,navy);
  if(input.qr&&!input.preview){
   const matrix=opaqueAppointmentQr(input.qr),unit=74/(matrix.length+8),origin=x2+(W-74)/2+4*unit,top=H-54-4*unit;
   rect(back,x2+(W-74)/2,H-54-74,74,74,white);
   for(let row=0;row<matrix.length;row++)for(let col=0;col<matrix.length;col++)if(matrix[row][col])
    rect(back,origin+col*unit,top-(row+1)*unit,unit,unit,rgb(0,0,0));
   fit(back,input.qr,x2+8,102,W-16,6,grey);
   fit(back,"Verify the opaque code in CareGanga.",x2+9,89,W-18,7,grey);
   if(signature&&seal){drawAsset(back,signature,x2+9,y0+43,70,32);drawAsset(back,seal,x2+83,y0+39,60,39);}
  }else{
   rect(back,x2+39,H-126,75,68,white);
   fit(back,"QR withheld",x2+47,H-95,59,9,grey);
   fit(back,"Signature and seal only after issue.",x2+9,88,W-18,7,grey);
  }
  fit(back,input.signatoryName,x2+9,29,W-18,8,navy);
  fit(back,"Authorized signatory",x2+9,20,W-18,6.5,grey);
  fit(back,input.preview?"DRAFT - NOT VALID":"CareGanga Foundation",x2+9,7,W-18,7,white);
 }else{
  const newLetterPage=()=>{const p=pdf.addPage([595,842]);p.drawRectangle({x:0,y:816,width:595,height:26,color:rgb(.055,.16,.31)});p.drawRectangle({x:0,y:810,width:595,height:6,color:rgb(.08,.43,.32)});p.drawText("CareGanga Foundation",{x:45,y:774,size:20,font,color:blue});p.drawLine({start:{x:45,y:755},end:{x:550,y:755},thickness:1.5,color:rgb(.08,.43,.32)});return p;};
  let page=newLetterPage();
  let y=735;y=print(page,input.title,45,y,16,505);y-=8;
  for(const [label,key] of [["Recipient","recipient"],["Designation","designation"],["Branch","branch"],["Department","department"],["Joining date","hireDate"],["Issue date","issueDate"],...(v.kind==="RELIEVING"?[["Last working date","lastWorkingDate"]]:[])]){
   y=print(page,label+": "+fact(key),45,y,11,505);
  }
  y-=12;
  let listNumber=0;
  for(const block of hrLetterBlocks(input.body)){
   if(block.kind==="numbered")listNumber++;else listNumber=0;
   const size=block.kind==="heading"?14:11,x=block.kind==="bullet"||block.kind==="numbered"?65:45,width=550-x;
   const lines=wrap(block.text,font,size,width);
   if(block.kind==="heading")y-=5;
   for(let index=0;index<lines.length;index++){
    if(y<65){page=newLetterPage();y=735;}
    const line=lines[index];
    if(block.kind==="bullet"&&index===0)page.drawCircle({x:49,y:y+4,size:2,color:grey});
    if(block.kind==="numbered"&&index===0)page.drawText(String(listNumber)+".",{x:45,y,size,font,color:grey});
    const drawX=block.kind==="center"?45+(505-font.widthOfTextAtSize(line,size))/2:x;
    if(line){page.drawText(line,{x:drawX,y,size,font,color:block.kind==="heading"?blue:grey});if(block.kind==="underline")page.drawLine({start:{x:drawX,y:y-2},end:{x:drawX+font.widthOfTextAtSize(line,size),y:y-2},thickness:.6,color:grey});}
    y-=size+5;
   }
  }
  y-=12;
  if(y<185){page=newLetterPage();y=735;}
  const date=fact("issueDate"),year=Number(date.slice(0,4)),start=Number(date.slice(5,7))>=4?year:year-1;
  y=print(page,"Financial year: "+start+"–"+(start+1)+" · "+input.reference+" · Version "+input.issueRevision,45,y,9,505);
  y=print(page,input.preview?"Draft preview only. Not valid for official use.":"Approved private document. No payroll or payment confirmation is implied.",45,y-6,9,505);
  const signPage=y>=140?page:newLetterPage(),signY=y>=140?Math.min(y-82,110):650;
  if(signature&&seal){drawAsset(signPage,signature,45,signY,150,45);drawAsset(signPage,seal,245,signY,90,65);}
  else print(signPage,"Signature and seal withheld until protected issuance",45,signY+30,10,505);
  print(signPage,input.signatoryName+" · Authorized signatory",45,signY-10,10,505);
 }
 if(input.preview)for(const page of pdf.getPages()){const width=page.getWidth();page.drawRectangle({x:0,y:0,width,height:20,color:rgb(.6,.1,.1)});page.drawText("DRAFT - NOT VALID",{x:10,y:6,size:9,font,color:rgb(1,1,1)});}
 return Buffer.from(await pdf.save({useObjectStreams:false}));
}
