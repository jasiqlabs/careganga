import {readFile} from "node:fs/promises";
import {PDFDocument,rgb,type PDFFont,type PDFPage,type PDFImage} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import {ServiceUnavailableException} from "@nestjs/common";
import {opaqueAppointmentQr} from "./cg19-appointment-qr";
export type VolunteerCardSource={volunteerNumber:string;name:string;branch:string|null;department:string;joinedOn:string};
export type VerifiedVolunteerBrand={displayName:string;signatoryName:string;logo:{bytes:Buffer;mime:string};signature:{bytes:Buffer;mime:string};seal:{bytes:Buffer;mime:string}};
const navy=rgb(.055,.16,.31),green=rgb(.11,.34,.23),grey=rgb(.28,.34,.42),white=rgb(1,1,1);
function line(p:PDFPage,f:PDFFont,v:string,x:number,y:number,size:number,width:number,color=grey){
 const clean=v.replace(/[\u0000-\u001f\u007f]/g," ").trim();
 if(!clean)return;
 const textSize=Math.max(5,Math.min(size,size*width/Math.max(width,f.widthOfTextAtSize(clean,size))));
 p.drawText(clean,{x,y,size:textSize,font:f,color});
}
function drawQr(p:PDFPage,code:string,x:number,y:number,length:number){
 const matrix=opaqueAppointmentQr(code),step=length/(matrix.length+8);
 p.drawRectangle({x,y,width:length,height:length,color:white});
 for(let i=0;i<matrix.length;i++)for(let j=0;j<matrix.length;j++)
  if(matrix[i][j])p.drawRectangle({x:x+(j+4)*step,y:y+(matrix.length+4-i-1)*step,width:step,height:step,color:rgb(0,0,0)});
}
async function embed(pdf:PDFDocument,part:{bytes:Buffer;mime:string}):Promise<PDFImage>{
 if(part.bytes.length<1||part.bytes.length>2097152)throw new ServiceUnavailableException("Actual verified Foundation brand asset unavailable");
 if(part.mime==="image/png")return pdf.embedPng(part.bytes);
 if(part.mime==="image/jpeg")return pdf.embedJpg(part.bytes);
 throw new ServiceUnavailableException("Actual approved Foundation brand format unavailable");
}
function image(page:PDFPage,picture:PDFImage,x:number,y:number,width:number,height:number){
 const size=picture.scaleToFit(width,height);
 page.drawImage(picture,{x:x+(width-size.width)/2,y:y+(height-size.height)/2,width:size.width,height:size.height});
}
export async function renderVolunteerCard(input:{
 source:VolunteerCardSource;brand:VerifiedVolunteerBrand;code:string;
 cardRef:string;sourceDigest:string;createdAt:Date
}):Promise<Buffer>{
 const {source,brand}=input;
 if(!/^CGV-[A-F0-9]{24}$/.test(input.code)||!source.volunteerNumber||!source.name||!source.department||!brand.displayName||!brand.signatoryName)
  throw new ServiceUnavailableException("Current original approved volunteer and Foundation details are incomplete.");
 const path=process.env.CG19_PDF_FONT_PATH;
 if(!path?.startsWith("/")||path.includes(".."))throw new ServiceUnavailableException("Approved document font is not configured.");
 const fontFile=await readFile(path);
 if(fontFile.length<1000||fontFile.length>10*1024*1024)throw new ServiceUnavailableException("Approved document font unavailable");
 const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);
 const font=await pdf.embedFont(fontFile,{subset:true});
 const [logo,signature,seal]=await Promise.all([embed(pdf,brand.logo),embed(pdf,brand.signature),embed(pdf,brand.seal)]);
 const W=242,H=153,front=pdf.addPage([W,H]),back=pdf.addPage([W,H]);
 for(const page of [front,back]){
  page.drawRectangle({x:0,y:0,width:W,height:H,color:white});
  page.drawRectangle({x:0,y:H-36,width:W,height:36,color:navy});
  page.drawRectangle({x:0,y:0,width:W,height:8,color:green});
 }
 image(front,logo,8,H-33,29,29);
 line(front,font,brand.displayName,42,H-18,9,W-50,white);
 line(front,font,"OFFICIAL VOLUNTEER CARD",42,H-29,7,W-50,white);
 line(front,font,source.name,14,99,14,W-24,navy);
 line(front,font,source.volunteerNumber,14,83,9,W-24,grey);
 line(front,font,"Department: "+source.department,14,67,8,W-24,navy);
 line(front,font,"Branch: "+(source.branch??"Foundation"),14,52,8,W-24,grey);
 line(front,font,"Joined: "+source.joinedOn,14,37,8,W-24,grey);
 line(back,font,"VERIFY CURRENT VOLUNTEER STATUS",12,103,9,W-25,navy);
 drawQr(back,input.code,14,23,72);
 line(back,font,input.code,94,79,8,W-105,navy);
 line(back,font,"Current affiliation and identity",94,64,7,W-105,grey);
 line(back,font,"must be checked before relying",94,54,7,W-105,grey);
 line(back,font,"on this official card.",94,44,7,W-105,grey);
 image(back,signature,97,17,72,23);image(back,seal,173,11,52,44);
 line(back,font,brand.signatoryName,97,12,6,W-106,navy);
 pdf.setTitle("CareGanga original issued volunteer card");
 pdf.setSubject("CG19-VOLUNTEER:"+input.cardRef+":"+input.sourceDigest+":CARD");
 pdf.setCreationDate(input.createdAt);pdf.setModificationDate(input.createdAt);
 return Buffer.from(await pdf.save({useObjectStreams:false}));
}
