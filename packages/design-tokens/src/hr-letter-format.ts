export type HrLetterBlock={kind:"heading"|"bullet"|"paragraph";text:string};
/** Conservative line-based formatting. No HTML, scripts, URLs, or executable input. */
export function hrLetterBlocks(body:string):HrLetterBlock[]{
 return body.split(/\r?\n/).map(line=>{
  if(line.startsWith("# ")&&line.slice(2).trim())return {kind:"heading",text:line.slice(2).trim()};
  if(line.startsWith("- ")&&line.slice(2).trim())return {kind:"bullet",text:line.slice(2).trim()};
  return {kind:"paragraph",text:line};
 });
}

export function appendLetterBlock(body:string,kind:"heading"|"bullet"){
 const next=body+(body&&!body.endsWith("\n")?"\n":"")+(kind==="heading"?"# ":"- ");
 return next.length<=1200?next:body;
}
