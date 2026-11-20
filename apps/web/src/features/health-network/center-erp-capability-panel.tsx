"use client";
import {useCallback,useEffect,useRef,useState} from "react";

type Cap="LAB_ERP"|"PHARMACY_ERP"|"NURSING_ERP"|"OT_ERP";
type Current={capability:Cap;state:string;version:number;reviewStatus:string|null;
 deployment:"OFF"|"NOT_AVAILABLE";requestedGlobal:boolean;
 effective:false;canUseOperations:false;message:string};
type Response={capabilities:Current[]};
const names:Record<Cap,string>={LAB_ERP:"Lab operations",PHARMACY_ERP:"Pharmacy operations",
 NURSING_ERP:"Nursing operations",OT_ERP:"Operation theatre operations"};
async function request<T>(path:string,init?:RequestInit):Promise<T>{
 const r=await fetch("/api/health-network/erp-grants/"+path,{
  ...init,cache:"no-store",credentials:"same-origin"});
 const data:unknown=await r.json().catch(()=>null);
 if(!r.ok)throw Error(data&&typeof data==="object"&&
  "message" in data&&typeof data.message==="string"?data.message:
  "The original optional capability status could not be confirmed.");
 return data as T;
}
/** Optional ERP is never made available by this UI. Center staff may only
 * submit an independent approval request for their own verified center. */
export function CenterErpCapabilityPanel({centerRef}:{centerRef:string}){
 const [rows,setRows]=useState<Current[]>([]),[selected,setSelected]=useState<Cap>("PHARMACY_ERP");
 const [from,setFrom]=useState(""),[until,setUntil]=useState("");
 const [busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const key=useRef(""),epoch=useRef(0);
 const load=useCallback(async()=>{
  const i=++epoch.current;
  try{
   const data=await request<Response>("my-centers/"+encodeURIComponent(centerRef));
   if(i===epoch.current){setRows(data.capabilities);setUncertain(false);setError("");}
  }catch(e){if(i===epoch.current)setError(e instanceof Error?
    e.message:"Current capability status unavailable.");}
 },[centerRef]);
 useEffect(()=>{setRows([]);setUncertain(false);key.current="";
  void load();return()=>{epoch.current++;};},[load]);
 const item=rows.find(x=>x.capability===selected);
 const locked=item?.state==="APPROVED"||item?.state==="SUSPENDED"||
  item?.state==="REQUESTED"&&
   !["RETURNED","REJECTED"].includes(item.reviewStatus??"");
 const canSubmit=!!from&&!busy&&!uncertain&&!locked&&!!item&&
  (!until||until>from);
 async function submit(){
  if(!canSubmit||!item)return;
  if(!key.current)key.current=crypto.randomUUID();
  setBusy(true);setError("");setNotice("");
  try{
   const response=await request<{message:string;replayed:boolean}>(
    "my-centers/"+encodeURIComponent(centerRef),{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({requestKey:key.current,capability:selected,
      expectedVersion:item.version,
      effectiveFrom:new Date(from+"T00:00:00.000Z").toISOString(),
      effectiveUntil:until?new Date(until+"T00:00:00.000Z").toISOString():null})
   });
   key.current="";await load();
   setNotice(response.replayed?"Your earlier request was found.":response.message);
  }catch(e){setUncertain(true);setError(e instanceof Error?e.message:
   "Request outcome uncertain. Recheck the original center before retrying.");}
  finally{setBusy(false);}
 }
 return <section className="form-section" aria-labelledby="center-optional-erp">
  <h2 id="center-optional-erp">Optional center operations</h2>
  <p>CareGanga’s normal healthcare directory, professional consultations,
   approved fees and Foundation support work without any ERP.
   Lab, pharmacy, nursing and operation theatre ERP are separate optional modules.
   Requesting or even approving permission does not install or enable them.</p>
  {!!error&&<p role="alert" className="notice error">{error}</p>}
  {!!notice&&<p role="status" className="notice">{notice}</p>}
  <div className="toolbar"><button type="button" disabled={busy}
   onClick={()=>void load()}>Refresh actual permissions</button></div>
  {rows.length===0?<p role="status">No optional operational permission confirmed.</p>:<>
   <ul>{rows.map(row=><li key={row.capability}>
    <strong>{names[row.capability]}</strong>: {row.state.replaceAll("_"," ")}.
    Independent review: {(row.reviewStatus??"Not submitted").replaceAll("_"," ")}.
    Deployment: {row.deployment.replaceAll("_"," ")}.
    {row.message}
   </li>)}</ul>
   <div className="form-grid">
    <label>Optional capability to request
     <select value={selected} disabled={busy} onChange={e=>{
      setSelected(e.target.value as Cap);key.current="";}}>
      {(Object.keys(names) as Cap[]).map(value=>
       <option key={value} value={value}>{names[value]}</option>)}
     </select></label>
    <label>Requested start date (UTC)
     <input type="date" value={from} disabled={busy||locked}
      onChange={e=>{setFrom(e.target.value);key.current="";}}/></label>
    <label>Optional end date (UTC)
     <input type="date" value={until} disabled={busy||locked}
      onChange={e=>{setUntil(e.target.value);key.current="";}}/></label>
   </div>
   {locked&&<p role="status">This permission already has an active review or approved
    record. A new request cannot bypass independent Foundation approval.</p>}
   <button type="button" disabled={!canSubmit} onClick={()=>void submit()}>
    {busy?"Submitting…":"Request independent Foundation approval"}</button>
   {uncertain&&<p role="alert">The request may already have been received.
    Refresh its original status before creating a different request.</p>}
  </>}
 </section>;
}
