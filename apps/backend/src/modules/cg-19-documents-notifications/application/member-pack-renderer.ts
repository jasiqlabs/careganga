import {readFile} from "node:fs/promises";
import {PDFDocument,rgb,type PDFFont,type PDFPage,type PDFImage} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import {ServiceUnavailableException} from "@nestjs/common";
import {opaqueAppointmentQr} from "./cg19-appointment-qr";

export type MemberDocumentKind="CARD"|"CERTIFICATE"|"WELCOME";
export type MemberPackSource={
 memberNumber:string;name:string;plan:string;category:string;branch:string|null;
 startsOn:string;expiresOn:string|null;feeMinor:string;currency:"INR";
};
export type VerifiedMemberBrand={
 displayName:string;signatoryName:string;
 logo:{bytes:Buffer;mime:string};signature:{bytes:Buffer;mime:string};seal:{bytes:Buffer;mime:string};
};
const navy=rgb(.055,.16,.31),gold=rgb(.78,.59,.2),blue=rgb(.13,.31,.69),grey=rgb(.28,.34,.42),white=rgb(1,1,1);
function fit(font:PDFFont,value:string,size:number,maxWidth:number){
 const text=value.replace(/[\u0000-\u001f\u007f]/g," ").trim();
 if(!text)return {text:"",size};
 const actual=Math.min(size,Math.max(5,size*maxWidth/Math.max(maxWidth,font.widthOfTextAtSize(text,size))));
 return {text,size:actual};
}
function line(page:PDFPage,font:PDFFont,body:string,x:number,y:number,size:number,width:number,color=grey){
 const v=fit(font,body,size,width);
 if(v.text)page.drawText(v.text,{x,y,size:v.size,font,color});return y-size-7;
}
function qr(page:PDFPage,token:string,x:number,y:number,length:number){
 const matrix=opaqueAppointmentQr(token),moduleSize=length/(matrix.length+8);
 page.drawRectangle({x,y,width:length,height:length,color:white});
 for(let row=0;row<matrix.length;row++)for(let col=0;col<matrix.length;col++)
  if(matrix[row][col])page.drawRectangle({x:x+(col+4)*moduleSize,y:y+(matrix.length+4-row-1)*moduleSize,width:moduleSize,height:moduleSize,color:rgb(0,0,0)});
}
async function embed(pdf:PDFDocument,asset:{bytes:Buffer;mime:string}){
 if(asset.bytes.length<1||asset.bytes.length>2097152)throw new ServiceUnavailableException("Approved Foundation brand file unavailable");
 if(asset.mime==="image/png")return pdf.embedPng(asset.bytes);
 if(asset.mime==="image/jpeg")return pdf.embedJpg(asset.bytes);
 throw new ServiceUnavailableException("Approved Foundation branding type is unavailable");
}
function image(page:PDFPage,picture:PDFImage,x:number,y:number,width:number,height:number){
 const size=picture.scaleToFit(width,height);page.drawImage(picture,{x:x+(width-size.width)/2,y:y+(height-size.height)/2,width:size.width,height:size.height});
}
export async function renderMemberPackDocument(input:{
 kind:MemberDocumentKind;source:MemberPackSource;brand:VerifiedMemberBrand;
 token:string;packRef:string;sourceDigest:string;issueRevision:number;createdAt:Date
}):Promise<Buffer>{
 if(!/^CGV-[A-F0-9]{24}$/.test(input.token))throw new ServiceUnavailableException("Private member verification is unavailable");
 const path=process.env.CG19_PDF_FONT_PATH;
 if(!path?.startsWith("/")||path.includes(".."))throw new ServiceUnavailableException("Approved document font is not configured");
 const file=await readFile(path);
 if(file.length<1000||file.length>10*1024*1024)throw new ServiceUnavailableException("Approved document font unavailable");
 const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);
 const font=await pdf.embedFont(file,{subset:true});
 const {source:s,brand}=input;
 if(!s.memberNumber||!s.name||!s.plan||!s.category||!brand.signatoryName||!brand.displayName)throw new ServiceUnavailableException("Verified membership details are incomplete");
 const [logo,signature,seal]=await Promise.all([embed(pdf,brand.logo),embed(pdf,brand.signature),embed(pdf,brand.seal)]);
 const validity=s.expiresOn??"Lifetime";
 const metadata="CG19-MEMBER:"+input.packRef+":"+input.sourceDigest+":"+input.kind;
 pdf.setTitle("CareGanga private issued "+input.kind.toLowerCase());
 pdf.setSubject(metadata);pdf.setCreationDate(input.createdAt);pdf.setModificationDate(input.createdAt);
 const mark=(page:PDFPage,x:number,y:number)=>{image(page,signature,x,y,145,42);image(page,seal,x+160,y-8,82,62);};
 const note=(page:PDFPage,text:string,x:number,y:number,width:number)=>line(page,font,text,x,y,9,width);
 if(input.kind==="CARD"){
  const W=242,H=153;
  const front=pdf.addPage([W,H]),back=pdf.addPage([W,H]);
  for(const p of [front,back]){p.drawRectangle({x:0,y:0,width:W,height:H,color:white});p.drawRectangle({x:0,y:H-35,width:W,height:35,color:navy});p.drawRectangle({x:0,y:0,width:W,height:8,color:navy});}
  image(front,logo,8,H-32,27,27);
  line(front,font,brand.displayName,39,H-17,10,W-45,white);
  line(front,font,"OFFICIAL MEMBERSHIP CARD",39,H-28,7,W-45,white);
  line(front,font,s.name,14,98,15,W-26,navy);
  line(front,font,s.memberNumber,14,82,9,W-26,grey);
  line(front,font,"Tier: "+s.plan+" ("+s.category+")",14,66,8,W-26,navy);
  line(front,font,"Valid through: "+validity,14,49,8,W-26,grey);
  line(front,font,"Branch: "+(s.branch??"Foundation"),14,32,8,W-26,grey);
  line(back,font,"VERIFY CURRENT MEMBER STATUS",12,104,10,W-24,navy);
  qr(back,input.token,14,24,71);
  line(back,font,input.token,95,78,8,W-104,navy);
  line(back,font,"Current membership must be",95,64,7,W-104,grey);
  line(back,font,"confirmed using this opaque code.",95,54,7,W-104,grey);
  image(back,signature,98,20,70,24);image(back,seal,173,13,53,40);
  line(back,font,brand.signatoryName,98,12,6,W-104,navy);
 }else if(input.kind==="CERTIFICATE"){
  const page=pdf.addPage([842,595]),W=842,H=595;
  page.drawRectangle({x:18,y:18,width:W-36,height:H-36,borderColor:gold,borderWidth:3});
  page.drawRectangle({x:29,y:29,width:W-58,height:H-58,borderColor:navy,borderWidth:1});
  page.drawRectangle({x:34,y:H-126,width:W-68,height:91,color:navy});
  image(page,logo,49,H-117,71,71);
  line(page,font,brand.displayName,130,H-80,24,650,white);
  line(page,font,"CERTIFICATE OF MEMBERSHIP",130,H-105,15,650,white);
  line(page,font,"This confirms the current registered membership of",72,402,15,700,grey);
  line(page,font,s.name,72,350,30,700,navy);
  line(page,font,"Member number: "+s.memberNumber,72,304,13,690,navy);
  line(page,font,"Membership: "+s.plan+" ("+s.category+")",72,277,13,690,grey);
  line(page,font,"Effective from: "+s.startsOn+"   Valid through: "+validity,72,252,12,690,grey);
  line(page,font,"Branch: "+(s.branch??"Foundation"),72,228,12,690,grey);
  qr(page,input.token,67,73,110);note(page,"Verify current eligibility using the opaque code.",66,62,310);
  mark(page,560,101);line(page,font,brand.signatoryName+" · Authorized signatory",550,82,10,255,navy);
 }else{
  const page=pdf.addPage([595,842]),W=595,H=842;
  page.drawRectangle({x:0,y:H-118,width:W,height:118,color:navy});
  image(page,logo,35,H-105,80,80);
  line(page,font,brand.displayName,130,H-64,22,420,white);
  line(page,font,"MEMBERSHIP WELCOME LETTER",130,H-91,12,420,white);
  let y=690;
  y=line(page,font,"Dear "+s.name+",",43,y,15,509,navy)-15;
  y=line(page,font,"Your approved membership has been recorded in the Foundation.",43,y,11,509)-10;
  y=line(page,font,"Membership number: "+s.memberNumber,43,y,11,509,navy);
  y=line(page,font,"Plan and category: "+s.plan+" ("+s.category+")",43,y,11,509);
  y=line(page,font,"Membership starts: "+s.startsOn,43,y,11,509);
  y=line(page,font,"Valid through: "+validity,43,y,11,509);
  y=line(page,font,"Branch: "+(s.branch??"Foundation"),43,y,11,509);
  y=line(page,font,"Accepted joining fee: "+s.currency+" "+(BigInt(s.feeMinor)/100n).toString()+"."+String(BigInt(s.feeMinor)%100n).padStart(2,"0"),43,y,11,509);
  y-=25;
  y=line(page,font,"Your ongoing membership status can change after issue.",43,y,11,509);
  y=line(page,font,"Please verify the current status using the code below.",43,y,11,509);
  qr(page,input.token,45,153,126);
  line(page,font,input.token,189,230,11,365,navy);
  line(page,font,"Keep this letter private and do not share the verification code",189,208,9,365);
  line(page,font,"unless a trusted recipient needs to check membership status.",189,192,9,365);
  mark(page,335,70);line(page,font,brand.signatoryName,335,53,10,218,navy);
  note(page,"This is a membership letter, not a tax exemption or payment receipt.",42,27,520);
 }
 const result=Buffer.from(await pdf.save({useObjectStreams:false}));
 if(result.length>10*1024*1024)throw new ServiceUnavailableException("Member document exceeds private storage limit");
 return result;
}
