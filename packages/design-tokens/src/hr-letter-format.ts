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

export function appendLetterBlock(body:string,kind:HrLetterKind){
 const next=body+(body&&!body.endsWith("\n")?"\n":"")+marker[kind];
 return next.length<=1200?next:body;
}
export function updateLetterBlock(body:string,index:number,kind:HrLetterKind,text:string){
 const lines=body.split(/\r?\n/);if(index<0||index>=lines.length)return body;
 lines[index]=marker[kind]+text.replace(/[\r\n]/g," ");
 const next=lines.join("\n");return next.length<=1200?next:body;
}
export function setHrCardField(body:string,field:HrCardField,shown:boolean){
 const selected=new Set(hrCardVisibleFields(body));if(shown)selected.add(field);else selected.delete(field);
 const content=body.split(/\r?\n/).filter(l=>!l.startsWith(cardMarker)).join("\n");
 const next=cardMarker+hrCardFields.filter(k=>selected.has(k)).join(",")+"\n"+content;
 return next.length<=1200?next:body;
}
