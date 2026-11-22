"use client";
import {useCallback,useEffect,useRef,useState} from "react";
type Scores={goal:number;competency:number;attendance:number};
type Item=Scores&{reference:string;periodStart:string;periodEnd:string;status:string;employeeReference:string;employeeName:string;revision:number};
type Detail=Item&{strengths:string;improvement:string};
type Person={employeeReference:string;employeeName:string};
type Form=Scores&{employeeReference:string;periodStart:string;periodEnd:string;strengths:string;improvement:string};
type Summary={total:number;draft:number;submitted:number;released:number;averageScore:number|null;outstanding:number};
// B26 displays an unweighted average on a five-point scale; persisted scores stay 0..100.
const five=(value:number)=>Number((value/20).toFixed(2)).toString();
const overall=(value:{goal:number;competency:number;attendance:number})=>five((value.goal+value.competency+value.attendance)/3);
const scoreSummary=(value:{total:number;draft:number;submitted:number;released:number;averageScore:number|null;outstanding:number})=>[
 {label:"Total reviews",value:String(value.total)},{label:"Submitted (including released)",value:String(value.submitted+value.released)},
 {label:"Average score",value:value.averageScore===null?"—":value.averageScore.toFixed(2)+" / 5"},{label:"Perfect score (5/5)",value:String(value.outstanding)}
];
const statusOptions=[{value:"ALL",label:"All status"},{value:"DRAFT",label:"Draft"},{value:"SUBMITTED",label:"Submitted"},{value:"RELEASED",label:"Released"}] as const;

const blank=():Form=>({employeeReference:"",periodStart:"",periodEnd:"",goal:0,competency:0,attendance:0,strengths:"",improvement:""});
const captions=[["goal","Goal & delivery"],["competency","Competency"],["attendance","Attendance & conduct"]] as const;
const statusLabel=(v:string)=>({DRAFT:"Draft",SUBMITTED:"Submitted",RELEASED:"Released"} as Record<string,string>)[v]??"Unavailable";
const field={width:"100%",border:"1px solid var(--cg-border)",borderRadius:9,padding:10,boxSizing:"border-box"} as const;
const card={border:"1px solid var(--cg-border)",borderRadius:14,padding:16,background:"#fff",display:"grid",gap:10} as const;
async function api<T>(path:string,body?:object):Promise<T>{
 const response=await fetch("/api/hr/"+path,{credentials:"same-origin",cache:"no-store",
  ...(body?{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})});
 const data=await response.json().catch(()=>null);
 if(!response.ok)throw Object.assign(new Error(typeof data?.message==="string"?data.message:"Appraisal result unavailable"),{status:response.status});
 if(!data||typeof data!=="object")throw Error("Appraisal result unavailable");
 return data as T;
}
const message=(e:unknown)=>e instanceof Error?e.message:"The result is uncertain. Refresh before retrying.";
const known=(e:unknown)=>!!e&&typeof e==="object"&&"status" in e&&typeof e.status==="number"&&e.status>=400&&e.status<500;
type MineItem=Pick<Item,"reference"|"periodStart"|"periodEnd"|"goal"|"competency"|"attendance"|"status">;
export function HrMyAppraisals(){
 const [items,setItems]=useState<MineItem[]>([]),[linked,setLinked]=useState<boolean|null>(null),[error,setError]=useState(""),[loading,setLoading]=useState(true);
 const sequence=useRef(0);
 const refresh=useCallback(async()=>{const read=++sequence.current;setLoading(true);setError("");setItems([]);setLinked(null);
  try{const v=await api<{linked:boolean;items:MineItem[]}>("me/appraisals");
   if(typeof v.linked!=="boolean"||!Array.isArray(v.items))throw Error("My appraisals are unavailable");
   if(read===sequence.current){setItems(v.items);setLinked(v.linked);}
  }catch(e){if(read===sequence.current)setError(message(e));}finally{if(read===sequence.current)setLoading(false);}
 },[]);
 useEffect(()=>{void refresh();return()=>{sequence.current++;};},[refresh]);
 return <section style={card} aria-label="My performance">
  <h2 style={{margin:0}}>My performance</h2><button type="button" disabled={loading} onClick={()=>void refresh()}>Refresh</button>
  {loading&&<p>Loading released appraisals…</p>}{error&&<p role="alert">{error}</p>}
  {linked===false&&<p>No current approved employment is linked to your account.</p>}
  {linked===true&&!items.length&&<p>No appraisal has been released to you.</p>}
  {items.map(x=><article key={x.reference} style={{borderTop:"1px solid var(--cg-border)",paddingTop:10}}>
   <strong>{x.periodStart} – {x.periodEnd}</strong>
   <p>{captions.map(([k,label])=>label+": "+five(x[k])+"/5").join(" · ")}</p><small>Overall {overall(x)}/5 · {statusLabel(x.status)}</small>
  </article>)}
 </section>;
}
export function HrAppraisalWorkspace(){
 const [items,setItems]=useState<Item[]>([]),[summary,setSummary]=useState<Summary|null>(null),[offset,setOffset]=useState(0),[more,setMore]=useState(false);
 const [status,setStatus]=useState("ALL");
 const [people,setPeople]=useState<Person[]>([]),[search,setSearch]=useState(""),[optionsError,setOptionsError]=useState("");
 const [form,setForm]=useState<Form>(blank),[selected,setSelected]=useState<Detail|null>(null);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const pending=useRef<{path:string;body:object;action:string}|null>(null);
 const [locked,setLocked]=useState(false);
 const read=useRef(0),peopleRead=useRef(0),running=useRef(false);
 const refresh=useCallback(async()=>{const seq=++read.current;setLoading(true);setError("");setItems([]);setSummary(null);setMore(false);
  try{const v=await api<{items:Item[];summary:Summary;hasMore:boolean}>("appraisals?offset="+offset+"&status="+encodeURIComponent(status));
   if(!Array.isArray(v.items)||!v.summary)throw Error("Performance list unavailable");
   if(seq===read.current){setItems(v.items);setSummary(v.summary);setMore(v.hasMore===true);}
  }catch(e){if(seq===read.current)setError(message(e));}finally{if(seq===read.current)setLoading(false);}
 },[offset,status]);
 useEffect(()=>{void refresh();return()=>{read.current++;};},[refresh]);
 const options=useCallback(async(q:string)=>{const seq=++peopleRead.current;setOptionsError("");setPeople([]);
  try{const v=await api<{items:Person[]}>("appraisals/options?search="+encodeURIComponent(q));
   if(!Array.isArray(v.items))throw Error("Employee options unavailable");
   if(seq===peopleRead.current)setPeople(v.items);
  }catch(e){if(seq===peopleRead.current)setOptionsError(message(e));}
 },[]);
 useEffect(()=>{void options("");return()=>{peopleRead.current++;};},[options]);
 const open=async(x:Item)=>{
  if(running.current||busy||locked)return;running.current=true;setBusy(true);setError("");setSelected(null);setForm(blank());setNotice("");
  try{const v=await api<Detail>("appraisals/"+encodeURIComponent(x.reference));
   if(v.reference!==x.reference||typeof v.strengths!=="string"||typeof v.improvement!=="string")throw Error("Original appraisal unavailable");
   setSelected(v);setForm({employeeReference:v.employeeReference,periodStart:v.periodStart,periodEnd:v.periodEnd,goal:v.goal,
    competency:v.competency,attendance:v.attendance,strengths:v.strengths,improvement:v.improvement});
  }catch(e){setError(message(e));}finally{running.current=false;setBusy(false);}
 };
 const submit=async(action:"save"|"submit"|"release")=>{
  if(running.current||busy)return;
  const v=selected,ref=v?encodeURIComponent(v.reference):"";
  let cmd=pending.current;
  if(!cmd){
   if(action==="save"&&(!form.employeeReference||!form.periodStart||!form.periodEnd||form.periodStart>form.periodEnd))return;
   if(action!=="save"&&!v)return;
   const requestKey=crypto.randomUUID(),scores={goal:form.goal,competency:form.competency,attendance:form.attendance,
    strengths:form.strengths,improvement:form.improvement};
   cmd=action==="save"?v?{path:"appraisals/"+ref+"/edit",body:{requestKey,expectedRevision:v.revision,...scores},action}:
    {path:"appraisals",body:{requestKey,...form},action}:
    {path:"appraisals/"+ref+"/"+action,body:{requestKey,expectedRevision:v!.revision},action};
   pending.current=cmd;
  }
  running.current=true;setBusy(true);setNotice("");setError("");
  try{
   const result=await api<Item>(cmd.path,cmd.body);
   if(!result.reference||!Number.isInteger(result.revision)||!["DRAFT","SUBMITTED","RELEASED"].includes(result.status))throw Error("Appraisal result is uncertain");
   pending.current=null;setLocked(false);
   const notes={strengths:form.strengths.trim(),improvement:form.improvement.trim()};
   setSelected({...result,...notes});setForm({employeeReference:result.employeeReference,periodStart:result.periodStart,periodEnd:result.periodEnd,goal:result.goal,competency:result.competency,attendance:result.attendance,...notes});await refresh();
   setNotice(statusLabel(result.status)+" · "+result.reference);
  }catch(e){setError(message(e));if(!locked&&known(e)){pending.current=null;setLocked(false);}else setLocked(true);}
  finally{running.current=false;setBusy(false);}
 };
 const reset=()=>{if(running.current||locked)return;setSelected(null);setForm(blank());setError("");setNotice("");};
 const editable=!selected||selected.status==="DRAFT";
 const changed=!!selected&&(selected.goal!==form.goal||selected.competency!==form.competency||selected.attendance!==form.attendance||selected.strengths!==form.strengths||selected.improvement!==form.improvement);
 const set=<K extends keyof Form,>(k:K,v:Form[K])=>setForm(x=>({...x,[k]:v}));
 return <section style={card} aria-label="Performance management">
  <h2 style={{margin:0}}>Performance management</h2>
  {summary&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,145px),1fr))",gap:10}}>{scoreSummary(summary).map(x=><article key={x.label} style={{...card,padding:12}}><small style={{color:"var(--cg-muted)"}}>{x.label}</small><strong style={{fontSize:"1.35rem"}}>{x.value}</strong></article>)}</div>}
  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button disabled={busy||locked} onClick={reset}>New appraisal</button>
   <button disabled={busy||locked||loading} onClick={()=>void refresh()}>Refresh list</button></div>
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}{loading&&<p>Loading…</p>}
  <style>{`.cg-hr-appraisal-layout{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:12px;align-items:start}.cg-hr-appraisal-layout>section{min-width:0}@media(max-width:1100px){.cg-hr-appraisal-layout{grid-template-columns:1fr}}`}</style>
  <div className="cg-hr-appraisal-layout"><section style={card} aria-label="Performance reviews"><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"wrap"}}><h3 style={{margin:0}}>Performance reviews</h3><label>Review status <select disabled={busy||locked} value={status} onChange={e=>{setStatus(e.target.value);setOffset(0);}}>{statusOptions.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></label></div><small>Overall is the average of the three component scores.</small>
  {!loading&&!error&&!items.length&&<p>No appraisals match this status in your current reviewer scope.</p>}
  <div style={{overflowX:"auto"}}><table style={{width:"100%",textAlign:"left"}}><thead><tr><th>Employee</th><th>Period</th><th>Goal</th><th>Competency</th><th>Attendance</th><th>Overall / 5</th><th>Status</th><th>Action</th></tr></thead><tbody>
   {items.map(x=><tr key={x.reference}><td>{x.employeeName}</td><td>{x.periodStart} – {x.periodEnd}</td><td>{five(x.goal)}</td><td>{five(x.competency)}</td><td>{five(x.attendance)}</td><td><div style={{display:"flex",alignItems:"center",gap:7}}><div aria-hidden="true" style={{height:6,width:42,background:"var(--cg-border)",borderRadius:5,overflow:"hidden"}}><div style={{height:"100%",background:"var(--cg-accent)",width:((x.goal+x.competency+x.attendance)/3)+"%"}}/></div><strong>{overall(x)}</strong></div>{x.goal===100&&x.competency===100&&x.attendance===100&&<small>Outstanding · 5/5</small>}</td><td>{statusLabel(x.status)}</td><td><button disabled={busy||locked} onClick={()=>void open(x)}>View</button></td></tr>)}
  </tbody></table></div>
  <div style={{display:"flex",gap:8}}>{offset>0&&<button disabled={busy||locked} onClick={()=>setOffset(x=>Math.max(0,x-25))}>Previous</button>}{more&&<button disabled={busy||locked} onClick={()=>setOffset(x=>x+25)}>Next</button>}</div>
  </section><section style={card} aria-label="Appraisal editor"><h3 style={{margin:0}}>{selected?selected.employeeName+" · "+statusLabel(selected.status):"New appraisal"}</h3>
  <fieldset disabled={busy||locked||!editable} style={{display:"grid",gap:10,border:0,padding:0}}>
   {!selected?<><label>Find employee<input style={field} value={search} maxLength={80} onChange={e=>setSearch(e.target.value)}/></label><button type="button" onClick={()=>void options(search)}>Search permitted employees</button>
    {optionsError&&<p role="alert">{optionsError}</p>}
    <label>Employee<select style={field} value={form.employeeReference} onChange={e=>set("employeeReference",e.target.value)}><option value="">Choose employee</option>{people.map(x=><option key={x.employeeReference} value={x.employeeReference}>{x.employeeName}</option>)}</select></label>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:8}}>
     <label>Period start<input type="date" style={field} value={form.periodStart} onChange={e=>set("periodStart",e.target.value)}/></label>
     <label>Period end<input type="date" style={field} value={form.periodEnd} onChange={e=>set("periodEnd",e.target.value)}/></label>
    </div></>:<p>{form.periodStart} – {form.periodEnd}</p>}
   {captions.map(([k,label])=><label key={k}>{label}: {five(form[k])}/5<input aria-label={label+" score"} aria-valuetext={five(form[k])+" out of 5"} style={{width:"100%",accentColor:"var(--cg-accent)"}} type="range" min={0} max={100} value={form[k]} onChange={e=>set(k,Number(e.target.value))}/></label>)}
   <label>Strengths (private reviewer notes)<textarea style={field} rows={3} maxLength={1000} value={form.strengths} onChange={e=>set("strengths",e.target.value)}/></label>
   <label>Areas to improve (private reviewer notes)<textarea style={field} rows={3} maxLength={1000} value={form.improvement} onChange={e=>set("improvement",e.target.value)}/></label>
   <div style={{display:"flex",justifyContent:"space-between",background:"#F8FAFC",border:"1px solid var(--cg-border)",padding:10,borderRadius:8}}><strong>Overall score</strong><strong>{overall(form)} / 5</strong></div><small>Equal average of three components. Only the confirmed perfect-score rating is labeled; other rating bands are not assumed.</small>
  </fieldset>
  {locked?<><p role="alert">The previous result is uncertain. Retry the exact same command.</p><button disabled={busy} onClick={()=>void submit("save")}>Retry original command</button></>:
   <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
    {editable&&<button disabled={busy||!form.employeeReference||!form.periodStart||!form.periodEnd||form.periodStart>form.periodEnd} onClick={()=>void submit("save")}>Save draft</button>}
    {selected?.status==="DRAFT"&&<button disabled={busy||changed} onClick={()=>void submit("submit")}>Submit saved appraisal</button>}
    {selected?.status==="SUBMITTED"&&<button disabled={busy} onClick={()=>void submit("release")}>Release scores to employee</button>}
    {changed&&<small>Save changes before submitting.</small>}
   </div>}
 </section></div>
 </section>;
}
