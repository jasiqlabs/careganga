import {readFile} from "node:fs/promises";
import {ServiceUnavailableException} from "@nestjs/common";
import {PDFDocument,rgb} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import {createHash} from "node:crypto";

/** Source-backed private document. Names come exclusively from the CG-03
 * frozen proposal, not from untrusted template placeholders or user input.
 * A real Unicode font must be configured per deployment; otherwise fail.
 */
export type LetterFacts=Readonly<{
  caseNumber:string;accountName:string;roleName:string;
  issuedAt:string;issueNumber:number;title:string;body:string
}>;
export const templateHash=(title:string,body:string)=>createHash("sha256")
  .update(JSON.stringify(["CG19_ACCESS_LETTER_V1",title,body])).digest("hex");
function chunks(value:string,font:{widthOfTextAtSize:(text:string,size:number)=>number},
  size:number,width:number):string[]{
  const lines:string[]=[];
  for(const paragraph of value.split(/\r?\n/)){
    let current="";
    for(const word of paragraph.split(/\s+/)){
      if(!word)continue;
      const candidate=current?current+" "+word:word;
      if(font.widthOfTextAtSize(candidate,size)<=width){current=candidate;continue;}
      if(current)lines.push(current);
      // Long unbroken strings are split, not allowed to escape the PDF page.
      let part="";
      for(const character of [...word]){
        if(part&&font.widthOfTextAtSize(part+character,size)>width){
          lines.push(part);part=character;
        }else part+=character;
      }
      current=part;
    }
    lines.push(current);
  }
  return lines;
}
export async function createAccessLetterPdf(facts:LetterFacts):Promise<Buffer>{
  const path=process.env.CG19_PDF_FONT_PATH;
  if(!path||!path.startsWith("/")||path.includes("..")||path.length>300)
    throw new ServiceUnavailableException("The approved letter font is not configured");
  let fontBytes:Buffer;
  try{fontBytes=await readFile(path);}catch{
    throw new ServiceUnavailableException("The approved letter font is unavailable");
  }
  if(fontBytes.length<1000||fontBytes.length>10*1024*1024)
    throw new ServiceUnavailableException("The approved letter font cannot be validated");
  try{
    const pdf=await PDFDocument.create();
    pdf.registerFontkit(fontkit);
    const font=await pdf.embedFont(fontBytes,{subset:true});
    pdf.setTitle("CareGanga — Private approved access confirmation");
    pdf.setProducer("CareGanga CG-19");
    pdf.setCreationDate(new Date(facts.issuedAt));
    const page=pdf.addPage([595,842]);
    const blue=rgb(0.14,0.3,0.67),grey=rgb(0.35,0.4,0.5);
    page.drawRectangle({x:0,y:817,width:595,height:25,color:blue});
    page.drawText("CareGanga Foundation",{
      x:48,y:770,font,size:18,color:blue});
    page.drawText("Private confirmation — access change",{
      x:48,y:735,font,size:12,color:grey});
    page.drawLine({start:{x:48,y:716},end:{x:547,y:716},
      thickness:1,color:grey});
    let y=685;
    const fields=[
      ["Application",facts.caseNumber],
      ["Account",facts.accountName],
      ["Approved access role",facts.roleName],
      ["Issue revision",String(facts.issueNumber)],
      ["Issued (UTC)",facts.issuedAt]
    ];
    for(const [label,value] of fields){
      const line=chunks(label+": "+value,font,11,485);
      for(const text of line){page.drawText(text,{x:48,y,font,size:11});y-=19;}
      y-=9;
    }
    y-=12;
    for(const text of chunks(facts.title,font,14,485)){
      if(y<185)throw new Error("LETTER_TOO_LONG");
      page.drawText(text,{x:48,y,font,size:14,color:blue});y-=25;
    }
    y-=9;
    const body=chunks(facts.body,font,11,485);
    for(const text of body){
      if(y<135)throw new Error("LETTER_TOO_LONG");
      if(text)page.drawText(text,{x:48,y,font,size:11});
      y-=19;
    }
    page.drawLine({start:{x:48,y:110},end:{x:547,y:110},
      color:grey,thickness:0.5});
    page.drawText("Private document. Verify current access in CareGanga.",{
      x:48,y:88,font,size:9,color:grey});
    // No public QR, third-party URL, account ID or secret is rendered.
    const bytes=Buffer.from(await pdf.save({useObjectStreams:false}));
    if(bytes.length>10*1024*1024)throw new Error("PDF_TOO_LARGE");
    return bytes;
  }catch{
    throw new ServiceUnavailableException("The private approved letter could not be rendered");
  }
}
