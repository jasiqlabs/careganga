"use client";
import {useState,type ReactNode} from "react";
import {careGangaTheme as theme} from "../../../../../packages/design-tokens/src/index";
type Section={id:string;label:string;content:ReactNode};
/** Mount on first visit and preserve in-progress forms and uncertain command keys. */
export function HrWorkspaceNavigation({sections}:{sections:Section[]}){
 const [current,setCurrent]=useState(sections[0]?.id??"profile");
 const [visited,setVisited]=useState<string[]>([sections[0]?.id??"profile"]);
 const active=sections.some(x=>x.id===current)?current:sections[0]?.id;
 const choose=(id:string)=>{setCurrent(id);setVisited(old=>old.includes(id)?old:[...old,id]);};
 return <div style={{display:"grid",gap:16,minWidth:0}}>
  <nav aria-label="Human resources workflows" style={{display:"flex",flexWrap:"wrap",gap:8,padding:12,border:"1px solid "+theme.border,borderRadius:12,background:theme.surface}}>
   {sections.map(s=><button key={s.id} type="button" aria-current={active===s.id?"page":undefined} onClick={()=>choose(s.id)}
    style={{border:"1px solid "+(active===s.id?theme.primary:theme.border),background:active===s.id?theme.primary:theme.surface,color:active===s.id?theme.primaryText:theme.text,borderRadius:9,minHeight:44,padding:"8px 13px",fontWeight:600}}>{s.label}</button>)}
  </nav>
  {sections.filter(s=>visited.includes(s.id)||active===s.id).map(s=><section key={s.id} id={"hr-section-"+s.id} aria-label={s.label} hidden={active!==s.id} style={active===s.id?{display:"grid",gap:18,minWidth:0}:{display:"none"}}>{s.content}</section>)}
 </div>;
}
