"use client";
import {useEffect,useState} from "react";
type Project={title:string;category:string;summary:string;description:string;
 location:string;owner:string;manager:string|null;branch:string|null;status:string};
type Result={kind:"PROJECT"|"GENERAL_FOUNDATION";project:Project|null;note:string;
 teamStatus?:"SOURCE"|"RESTRICTED";assigned?:{name:string;kind:string}[]};
export function CsrFundingProjectContext({proposalRef,mode}:{proposalRef:string;mode:"PROJECT"|"TEAM"}){
 const [value,setValue]=useState<Result|null>(null),[error,setError]=useState("");
 useEffect(()=>{
  let live=true;
  void fetch("/api/csr/funding-proposals/"+proposalRef+"/project-context",{
   cache:"no-store",signal:AbortSignal.timeout(18000)})
   .then(async r=>{if(!r.ok)throw Error("The current project context is unavailable or access is restricted.");
    return await r.json() as Result;})
   .then(v=>{if(live)setValue(v);})
   .catch(e=>{if(live){setValue(null);setError(e instanceof Error?e.message:"Project context unavailable.");}});
  return()=>{live=false;};
 },[proposalRef]);
 return <section aria-label={mode==="PROJECT"?"2. Current CG05 project":"4. Current CG05 team"} style={{display:"grid",gap:12}}>
  {mode==="PROJECT"&&<><h4 style={{margin:0}}>2. Project Details — original CG05</h4>
  {!value&&!error&&<p>Checking original CG05 project…</p>}
  {value?.project?<div>
   <strong>{value.project.title}</strong>
   <p>Category: {value.project.category} · Status: {value.project.status}</p>
   <p>Location: {value.project.location||"Not specified"} · Branch: {value.project.branch??"Foundation"}</p>
   <p>Objectives: {value.project.summary||value.project.description||"Not recorded in CG05"}</p>
  </div>:value&&<p>{value.note}</p>}</>}
  {mode==="TEAM"&&<><h4 style={{margin:0}}>4. Team & Members — original CG05</h4>
  {value?.project?<div>
   <p>Project head: <strong>{value.project.owner}</strong></p>
   <p>Branch manager: <strong>{value.project.manager??"No branch manager recorded"}</strong></p>
   <p>{value.note}</p>
   {value.assigned?.length?<ul>{value.assigned.map((m,i)=>
    <li key={m.name+":"+m.kind+":"+i}>{m.name} — recorded {m.kind.toLowerCase()} task assignee</li>)}</ul>:
    <p>{value.teamStatus==="RESTRICTED"?"Task roster restricted.":
     "No current CG05 task assignees recorded for this project."}</p>}
  </div>:value&&<p>No project team is attached to this general Foundation funding request.</p>}</>}
  {!!error&&<p role="alert">{error}</p>}
 </section>;
}
