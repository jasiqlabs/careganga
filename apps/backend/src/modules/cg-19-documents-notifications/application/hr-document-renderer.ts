import {readFile} from "node:fs/promises";
import {PDFDocument,rgb,type PDFFont,type PDFPage,type PDFImage} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import {createHash,createHmac} from "node:crypto";
import {ServiceUnavailableException} from "@nestjs/common";
import {opaqueAppointmentQr} from "./cg19-appointment-qr";
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
  const front=pdf.addPage([242.65,153.07]),back=pdf.addPage([242.65,153.07]);
  for(const page of [front,back])page.drawRectangle({x:0,y:131,width:243,height:22,color:blue});
  front.drawText("CareGanga Foundation",{x:9,y:138,size:10,font,color:rgb(1,1,1)});
  const image=input.portrait.mime==="image/jpeg"?await pdf.embedJpg(input.portrait.bytes):
   input.portrait.mime==="image/png"?await pdf.embedPng(input.portrait.bytes):null;
  if(!image)throw new ServiceUnavailableException("Approved portrait format unavailable");
  const photo=image.scaleToFit(58,78);
  front.drawImage(image,{x:10+(58-photo.width)/2,y:38+(78-photo.height)/2,width:photo.width,height:photo.height});
  let y=112;y=print(front,fact("recipient"),76,y,10,155);
  y=print(front,fact("designation")+" · "+fact("branch"),76,y,8,155);
  y=print(front,"Employee: "+fact("subjectReference"),76,y,8,155);
  y=print(front,"Expires: "+fact("expiryDate"),76,y,8,155);
  print(front,"Version "+input.issueRevision,76,y,8,155);
  back.drawText("Employee ID verification",{x:9,y:138,size:10,font,color:rgb(1,1,1)});
  if(input.qr&&!input.preview){
  const matrix=opaqueAppointmentQr(input.qr),unit=2.1,origin=9+4*unit,top=119-4*unit;
  for(let row=0;row<matrix.length;row++)for(let col=0;col<matrix.length;col++)if(matrix[row][col])
   back.drawRectangle({x:origin+col*unit,y:top-(row+1)*unit,width:unit,height:unit,color:rgb(0,0,0)});
  print(back,"Scan the opaque code and verify in CareGanga. No personal details in the QR.",88,109,8,144);
  }else print(back,"Verification code and signature appear only on an authorized issued card.",12,110,9,216);
  if(signature&&seal){drawAsset(back,signature,90,39,67,24);drawAsset(back,seal,165,39,52,24);}
  const name=input.signatoryName;const nameSize=Math.min(7,140*7/Math.max(1,font.widthOfTextAtSize(name,7)));
  back.drawText(name,{x:90,y:29,size:nameSize,font,color:grey});
  if(input.qr&&!input.preview)back.drawText(input.qr,{x:9,y:10,size:7,font,color:grey});
 }else{
  const newLetterPage=()=>{const p=pdf.addPage([595,842]);p.drawRectangle({x:0,y:815,width:595,height:27,color:blue});p.drawText("CareGanga Foundation",{x:45,y:771,size:20,font,color:blue});return p;};
  let page=newLetterPage();
  let y=735;y=print(page,input.title,45,y,16,505);y-=8;
  for(const [label,key] of [["Recipient","recipient"],["Designation","designation"],["Branch","branch"],["Department","department"],["Joining date","hireDate"],["Issue date","issueDate"],...(v.kind==="RELIEVING"?[["Last working date","lastWorkingDate"]]:[])]){
   y=print(page,label+": "+fact(key),45,y,11,505);
  }
  y-=12;for(const line of wrap(input.body,font,11,505)){if(y<65){page=newLetterPage();y=735;}if(line)page.drawText(line,{x:45,y,size:11,font,color:grey});y-=16;}y-=12;
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
