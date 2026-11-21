"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {MisSavedReports} from "./mis-saved-reports";
import {MisReportExports} from "./mis-report-exports";
type Kind="FINANCE_POSTED_LEDGER"|"FINANCE_POSTED_SUMMARY"|
 "FINANCE_POSTED_TREND"|"APPOINTMENT_STATUS";
type View="TABLE"|"SUMMARY"|"CHART";
type Option={ref:string;name:string};
type Template={kind:Kind;label:string;views:View[];description:string};
type Catalog={
 templates:Template[];
 finance:{ready:boolean;years:Option[];branches:Option[];allBranches:boolean};
 appointments:{ready:boolean;centers:Option[];complete:boolean};
 capabilities:{manage:boolean;export:boolean;schedule:boolean}
};
export type ReportRequest={kind:Kind;view:View;yearRef?:string;branchRef?:string;
 centerRef?:string;fromDay?:string;untilDay?:string;status?:string;offset:number};
export type ReportPreview={
 state:"READY"|"EMPTY"|"SUPPRESSED";kind:Kind;view:View;label:string;
 columns:{key:string;label:string;unit?:string}[];
 rows:Record<string,string>[];nextOffset:number|null;
 sourceAsOf?:string;sourceReadAt:string;sourceCutoffKind:string;
 explanation:string;scopeLabel:string
};
const statuses:{key:string;label:string}[]=[
 {key:"",label:"All statuses"},
 {key:"CONFIRMED",label:"Confirmed"},{key:"ARRIVED",label:"Arrived"},
 {key:"WAITING",label:"Waiting"},{key:"IN_CONSULTATION",label:"In consultation"},
 {key:"COMPLETED",label:"Completed"},{key:"NO_SHOW",label:"No show"},
 {key:"CANCELLED",label:"Cancelled"}
];
function labelMoney(value:string){
 try{const n=BigInt(value),a=n<0n?-n:n;
  return (n<0n?"−":"")+"₹"+(a/100n).toLocaleString("en-IN")+"."+
   (a%100n).toString().padStart(2,"0");
 }catch{return "Not confirmed";}
}
function cell(value:string|undefined,unit?:string){
 if(value===undefined)return "Not confirmed";
 if(unit==="INR_MINOR")return labelMoney(value);
 return value;
}
async function request<T>(path:string,body?:object):Promise<T>{
 const r=await fetch("/api/mis/reports/"+path,{cache:"no-store",
  credentials:"same-origin",method:body?"POST":"GET",
  headers:body?{"Content-Type":"application/json"}:undefined,
  body:body?JSON.stringify(body):undefined});
 if(!r.ok)throw Error(r.status===401?"Sign in again to see private reports.":
  r.status===403?"Your current role or location cannot view this report.":
  r.status===400?"Choose valid report filters and a supported format.":
  "The original report could not be checked. Refresh and try again.");
 return await r.json() as T;
}
/** Original C44/C46/C47 report cards. Only genuinely registered owner
 * source filters/actions are available; no screenshot demo rows or raw refs.
 */
export function MisReportsWorkspace(){
 const [catalog,setCatalog]=useState<Catalog|null>(null);
 const [kind,setKind]=useState<Kind|null>(null);
 const [year,setYear]=useState(""),[branch,setBranch]=useState("");
 const [center,setCenter]=useState(""),[from,setFrom]=useState("");
 const [until,setUntil]=useState(""),[status,setStatus]=useState("");
 const [result,setResult]=useState<ReportPreview|null>(null);
 const [problem,setProblem]=useState(""),[loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState("");
 const seq=useRef(0);
 const load=useCallback(async()=>{
  const i=++seq.current;setLoading(true);setProblem("");setResult(null);
  try{
   const c=await request<Catalog>("templates");
   if(!Array.isArray(c.templates))throw Error("Current report catalog could not be verified.");
   if(i===seq.current){setCatalog(c);
    setBranch(c.finance.allBranches?"":c.finance.branches[0]?.ref??"");
    setKind(old=>c.templates.some(x=>x.kind===old)?
    old:c.templates[0]?.kind??null);}
  }catch(e){if(i===seq.current){setCatalog(null);setKind(null);
   setProblem(e instanceof Error?e.message:"Report source unavailable.");}}
  finally{if(i===seq.current)setLoading(false);}
 },[]);
 useEffect(()=>{void load();return()=>{seq.current++};},[load]);
 useEffect(()=>{
  const recheck=()=>{
   seq.current++;setCatalog(null);setResult(null);setKind(null);
   setYear("");setBranch("");setCenter("");setFrom("");setUntil("");
   setStatus("");void load();
  };
  const onVisible=()=>{if(document.visibilityState==="visible")recheck();
   else{seq.current++;setCatalog(null);setResult(null);}};
  document.addEventListener("visibilitychange",onVisible);
  return()=>document.removeEventListener("visibilitychange",onVisible);
 },[load]);
 const selected=catalog?.templates.find(t=>t.kind===kind);
 const finance=kind?.startsWith("FINANCE_");
 const ledger=kind==="FINANCE_POSTED_LEDGER";
 function input(offset=0):ReportRequest|null{
  if(!kind||!selected)return null;
  return {kind,view:selected.views[0],
   ...(finance?{
    ...(year?{yearRef:year}:{}),...(branch?{branchRef:branch}:{})}:{
    ...(center?{centerRef:center}:{}),
    ...(status?{status}:{}),
   }),
   ...((ledger||!finance)&&from?{fromDay:from,untilDay:until}:{},
   offset};
 }
 async function preview(offset=0){
  const q=input(offset);if(!q||busy)return;
  setBusy(true);setProblem("");setNotice("");setResult(null);
  try{
   const v=await request<ReportPreview>("preview",q);
   if(!v||!Array.isArray(v.columns)||!Array.isArray(v.rows))
    throw Error("The original report response could not be verified.");
   setResult(v);
   setNotice(v.state==="EMPTY"?"No matching posted business records.":
    v.state==="SUPPRESSED"?"This result cannot be shown without exposing a small private group.":
    "Report loaded from authorized original records.");
  }catch(e){setProblem(e instanceof Error?e.message:"Could not verify the report.");}
  finally{setBusy(false);}
 }
 return <section aria-labelledby="mis-standard-reports"
  style={{marginTop:"2rem",borderTop:"1px solid var(--cg-border)",paddingTop:"1.3rem"}}>
  <h2 id="mis-standard-reports" style={{fontSize:"1.1rem"}}>
   Reports &amp; MIS · Standard reports</h2>
  <p style={{fontSize:".83rem",color:"var(--cg-muted)"}}>
   Select a real source, apply permitted filters and preview verified rows.
   Saved reports and protected exports appear only when enabled for your role.</p>
  {loading&&<p role="status">Checking available report sources…</p>}
  {!!problem&&<p role="alert">{problem}</p>}
  {!loading&&catalog?.templates.length===0&&
   <p role="status">No original report source is available for your current permissions.</p>}
  {!!catalog?.templates.length&&<>
   <div role="group" aria-label="Choose source-backed report"
    style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(14rem,1fr))",gap:10}}>
    {catalog.templates.map(t=><button type="button" key={t.kind}
     aria-pressed={kind===t.kind} onClick={()=>{
      setKind(t.kind);setResult(null);setProblem("");setNotice("");
      setYear("");setBranch("");setCenter("");setFrom("");setUntil("");setStatus("");
     }} style={{textAlign:"left",border:"1px solid var(--cg-border)",borderRadius:10,
      padding:14,minHeight:84,background:kind===t.kind?"var(--cg-canvas)":"var(--cg-surface)"}}>
     <strong style={{display:"block",color:"var(--cg-text)"}}>{t.label}</strong>
     <small style={{color:"var(--cg-muted)"}}>{t.description}</small>
    </button>)}
   </div>
   {selected&&<div style={{marginTop:16,display:"grid",gap:12}}>
    <p role="status">Available output: {selected.views.map(v=>v.toLowerCase()).join(" or ")}.
     Unsupported pivots and confidential fields are not included.</p>
    <div style={{display:"flex",flexWrap:"wrap",gap:12}}>
     {finance&&<>
      <label>Financial year <select value={year} onChange={e=>setYear(e.target.value)}>
       <option value="">All permitted years</option>
       {catalog.finance.years.map(o=><option key={o.ref} value={o.ref}>{o.name}</option>)}
      </select></label>
      {!!catalog.finance.branches.length&&<label>Branch <select value={branch}
       onChange={e=>setBranch(e.target.value)}>
       {catalog.finance.allBranches&&<option value="">All permitted branches</option>}
       {catalog.finance.branches.map(o=><option key={o.ref} value={o.ref}>{o.name}</option>)}
      </select></label>}
     </>}
     {!finance&&catalog.appointments.ready&&<>
      {!!catalog.appointments.centers.length&&<label>Healthcare center
       <select value={center} onChange={e=>setCenter(e.target.value)}>
        <option value="">All permitted centers</option>
        {catalog.appointments.centers.map(o=><option key={o.ref} value={o.ref}>{o.name}</option>)}
       </select></label>}
      <label>Appointment status <select value={status} onChange={e=>setStatus(e.target.value)}>
       {statuses.map(x=><option key={x.key} value={x.key}>{x.label}</option>)}
      </select></label>
     </>}
     {(ledger||!finance)&&<>
      <label>Start date <input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>
      <label>End date <input type="date" value={until} onChange={e=>setUntil(e.target.value)}/></label>
     </>}
    </div>
    <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
     <button type="button" className="primary" disabled={busy} onClick={()=>void preview()}>
      {busy?"Checking report…":"Run permitted report"}</button>
    </div>
   </div>}
  </>}
  {!!notice&&<p role="status">{notice}</p>}
  {result&&<div style={{marginTop:16}}>
   <h3 style={{fontSize:"1rem"}}>{result.label}</h3>
   <p style={{fontSize:".8rem",color:"var(--cg-muted)"}}>
    {result.scopeLabel} · {result.sourceAsOf?
     "Database snapshot "+new Date(result.sourceAsOf).toLocaleString("en-IN"):
     "Source read completed "+new Date(result.sourceReadAt).toLocaleString("en-IN")}
   </p>
   <p style={{fontSize:".8rem",color:"var(--cg-muted)"}}>{result.explanation}</p>
   {result.state==="READY"&&<>
    {result.view==="CHART"&&<div style={{display:"grid",gap:9,margin:"1rem 0"}}>
     {result.rows.map((row,i)=><div key={i} style={{background:"var(--cg-surface)",
      border:"1px solid var(--cg-border)",padding:10,borderRadius:9}}>
      {result.columns.map(c=><span key={c.key} style={{display:"inline-block",marginRight:18,
       fontSize:".82rem"}}><strong>{c.label}:</strong> {cell(row[c.key],c.unit)}</span>)}
     </div>)}
    </div>}
    <div style={{overflowX:"auto"}}>
     <table style={{width:"100%",borderCollapse:"collapse",fontSize:".84rem"}}>
      <thead><tr>{result.columns.map(c=><th scope="col" key={c.key}
       style={{textAlign:"left",padding:10,borderBottom:"1px solid var(--cg-border)"}}>
       {c.label}</th>)}</tr></thead>
      <tbody>{result.rows.map((row,i)=><tr key={i}>
       {result.columns.map(c=><td key={c.key}
        style={{padding:9,borderBottom:"1px solid var(--cg-border)"}}>
        {cell(row[c.key],c.unit)}</td>)}
      </tr>)}</tbody>
     </table>
    </div>
    {result.nextOffset!==null&&<button type="button"
     disabled={busy} onClick={()=>void preview(result.nextOffset!)}>
     Next page of posted entries</button>}
   </>}
   {result.state==="EMPTY"&&<p role="status">No original records match the selected filters.</p>}
   {result.state==="SUPPRESSED"&&<p role="status">
    The result contains too few people to display safely.</p>}
  </div>}
  {catalog?.capabilities?.export===true&&
   <MisReportExports allowed request={input(0)}/>}
  {catalog&&<MisSavedReports canManage={catalog.capabilities?.manage===true}
   currentRequest={input(0)}
   onRestore={q=>{
    setKind(q.kind);setYear(q.yearRef??"");setBranch(q.branchRef??"");
    setCenter(q.centerRef??"");setFrom(q.fromDay??"");
    setUntil(q.untilDay??"");setStatus(q.status??"");
    setResult(null);setProblem("");setNotice("");
   }}/>}
 </section>;
}
