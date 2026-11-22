"use client";
import {useEffect,useRef,useState} from "react";
type Row={firstName:string;lastName:string;mobile:string;city:string;alreadyImported:boolean};
type Preview={rows:Row[];rowCount:number;newCount:number;alreadyImported:number;message:string};
type Imported={confirmed:boolean;replayed:boolean;rowCount:number;importedCount:number;skippedCount:number};
const base="/api/volunteers/roster/intake";
const empty=()=>({firstName:"",lastName:"",mobile:"",city:""});
async function api<T>(url:string,body?:Record<string,unknown>):Promise<T>{
 const r=await fetch(url,{method:body?"POST":"GET",cache:"no-store",
  headers:body?{"Content-Type":"application/json"}:undefined,
  body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(18000)});
 const result:unknown=await r.json().catch(()=>null);
 if(!r.ok||!result)throw Error(result&&typeof result==="object"&&"message" in result&&
  typeof result.message==="string"?result.message:"Volunteer intake status is uncertain. Check existing drafts.");
 return result as T;
}
export function VolunteerStaffIntake(){
 const [mode,setMode]=useState<"SINGLE"|"CSV">("SINGLE"),[person,setPerson]=useState(empty),[csv,setCsv]=useState("");
 const [preview,setPreview]=useState<Preview|null>(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState(""),
  [drafts,setDrafts]=useState<{firstName:string;lastName:string;mobile:string;city:string;ref:string}[]>([]);
 const pending=useRef<{requestKey:string;body:Record<string,unknown>}|null>(null),seq=useRef(0);
 const clear=()=>{seq.current++;setPerson(empty());setCsv("");setPreview(null);setDrafts([]);setNotice("");pending.current=null;};
 useEffect(()=>{const hide=()=>{if(document.visibilityState!=="visible")clear();};
  document.addEventListener("visibilitychange",hide);
  return()=>{document.removeEventListener("visibilitychange",hide);seq.current++;};
 },[]);
 const load=async()=>{const n=++seq.current;const r=await api<{items:typeof drafts}>(base+"/drafts");
  if(n===seq.current&&document.visibilityState==="visible")setDrafts(r.items);};
 const content=()=>mode==="CSV"?{csv}:{rows:[person]};
 const showPreview=async()=>{if(busy)return;setBusy(true);setNotice("");setPreview(null);pending.current=null;
  try{const p=await api<Preview>(base+"/preview",content());setPreview(p);setNotice("Preview only; nobody has been registered or approved.");}
  catch(e){setNotice(e instanceof Error?e.message:"Check the CSV or volunteer details.");}finally{setBusy(false);}
 };
 const commit=async()=>{if(busy||!preview)return;
  if(!pending.current)pending.current={requestKey:crypto.randomUUID(),body:content()};
  setBusy(true);setNotice("");
  try{
   const r=await api<Imported>(base,{...pending.current.body,requestKey:pending.current.requestKey});
   if(!r.confirmed)throw Error("The original import is not confirmed.");
   pending.current=null;setPreview(null);setCsv("");setPerson(empty());
   setNotice(r.importedCount+" unverified draft candidates saved; "+r.skippedCount+" existing contacts skipped. Ask each candidate to register independently with consent.");
   await load();
  }catch(e){setNotice(e instanceof Error?e.message:"Import outcome unknown. Retry the same request before starting another.");}
  finally{setBusy(false);}
 };
 return <section className="cg04-panel" aria-label="Original U14 unverified volunteer staff intake">
  <h3>Add volunteer candidate / import CSV (U14)</h3>
  <p className="cg04-muted">This is an unverified staff intake, not volunteer registration or approval. The person must use their own verified contact and give consent before CG-03 review.</p>
  <div className="cg04-buttons">
   <button type="button" disabled={busy||!!pending.current} onClick={()=>{clear();setMode("SINGLE");}}>Add candidate</button>
   <button type="button" disabled={busy||!!pending.current} onClick={()=>{clear();setMode("CSV");}}>Import CSV</button>
  </div>
  {mode==="SINGLE"?<div className="cg04-review-details">
   {(["firstName","lastName","mobile","city"] as const).map(k=><label key={k}>{({firstName:"First name",lastName:"Last name",mobile:"Mobile number",city:"City (optional)"})[k]}
    <input value={person[k]} maxLength={k==="mobile"?16:120} disabled={busy||!!preview||!!pending.current}
     onChange={e=>setPerson(v=>({...v,[k]:e.target.value}))}/></label>)}
  </div>:<div className="cg04-panel">
   <p>CSV columns: First Name, Last Name, Mobile, City. Maximum 200 candidates, 100 KB.</p>
   <input type="file" accept=".csv,text/csv" aria-label="Select unverified volunteer candidates CSV" disabled={busy||!!pending.current}
    onChange={e=>{const f=e.target.files?.[0];setPreview(null);
     if(!f)return;if(f.size>100000){setNotice("Select a CSV under 100 KB.");return;}
     void f.text().then(text=>setCsv(text)).catch(()=>setNotice("Cannot read the selected CSV."));}}/>
   <p>{csv?"CSV loaded for validation. No contact was imported yet.":"No CSV selected."}</p>
  </div>}
  {!preview&&<button type="button" className="cg04-primary" disabled={busy||(!csv&&mode==="CSV")} onClick={()=>void showPreview()}>Validate and preview</button>}
  {preview&&<div className="cg04-panel">
   <h4>Preview: {preview.rowCount} rows · {preview.newCount} new · {preview.alreadyImported} already present</h4>
   <div className="cg04-review-details">{preview.rows.slice(0,200).map((v,i)=><p key={i}>
    {v.firstName} {v.lastName} · {v.mobile}{v.city?" · "+v.city:""} · {v.alreadyImported?"Existing draft":"New unverified candidate"}
   </p>)}</div>
   <p>No account, consent, staff permission, review case, payment or official volunteer card will be created.</p>
   <button type="button" className="cg04-primary" disabled={busy} onClick={()=>void commit()}>
    {pending.current?"Retry same import request":"Confirm draft-only intake"}</button>
  </div>}
  {notice&&<p role="status">{notice}</p>}
  <button type="button" disabled={busy} onClick={()=>void load().catch(()=>setNotice("Current intake list unavailable."))}>Refresh staff intake list</button>
  {!!drafts.length&&<div className="cg04-panel"><h4>Awaiting independent self-registration</h4>
   {drafts.map(v=><p key={v.ref}>{v.firstName} {v.lastName} · {v.mobile} · Unverified candidate</p>)}
  </div>}
 </section>;
}
