"use client";
import {useCallback,useEffect,useRef,useState,type FormEvent} from "react";
import {LabEquipmentQualityUpload} from "./lab-equipment-quality-upload";

type Center={centerRef:string;name:string};
type Equipment={equipmentRef:string;centerRef:string;code:string;name:string;
 manufacturer:string;model:string;serialNumber:string;status:string;
 readiness:string;effectiveReadiness:string;calibrationDueOn:string|null;
 revision:number;fileRef:string|null};
type Event={eventRef:string;eventType:string;description:string;
 occurredAt:string;fileRef:string|null};
type Evidence={fileRef:string;documentKind:string;scannedAt:string};
type History={equipment:Equipment;events:Event[];files:Evidence[]};
type Attempt={path:string;body:Record<string,unknown>;success:string};
type Props={canView:boolean;canManage:boolean;canUpload:boolean};
const UUID=/^[a-f0-9-]{36}$/i;
async function api<T>(path:string,method:"GET"|"POST"="GET",body?:object):Promise<T>{
 const response=await fetch("/api/lab-equipment/"+path,{
  method,credentials:"same-origin",cache:"no-store",
  ...(body?{headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})
 });
 if(!response.ok){
  const msg=response.status===401?"Your session expired. Sign in again.":
   response.status===403?"Your role or laboratory is not currently authorized.":
   response.status===404?"This original instrument record is unavailable.":
   response.status===409?"This instrument changed. Refresh before modifying it.":
   response.status===400?"Review the equipment details, evidence and service date.":
   "The operation cannot be confirmed. Check the original instrument record.";
  throw Object.assign(new Error(msg),{status:response.status});
 }
 return response.json() as Promise<T>;
}
const status=(e:Equipment)=>e.status==="RETIRED"?"Retired":
 e.effectiveReadiness==="READY"?"Ready (proof verified)":
 e.effectiveReadiness==="CALIBRATION_DUE"?"Calibration due — not ready":
 e.effectiveReadiness==="OUT_OF_SERVICE"?"Out of service":"Not ready";
export function LabEquipmentWorkspace({canView,canManage,canUpload}:Props){
 const [centers,setCenters]=useState<Center[]>([]),[center,setCenter]=useState("");
 const [items,setItems]=useState<Equipment[]>([]),[selected,setSelected]=useState<History|null>(null);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [message,setMessage]=useState(""),[error,setError]=useState("");
 const [uncertain,setUncertain]=useState(false);
 const [code,setCode]=useState(""),[name,setName]=useState(""),[maker,setMaker]=useState("");
 const [model,setModel]=useState(""),[serial,setSerial]=useState("");
 const [action,setAction]=useState<"MAINTENANCE"|"MARK_OUT_OF_SERVICE"|"RETIRED">("MAINTENANCE");
 const [note,setNote]=useState(""),[due,setDue]=useState(""),[proof,setProof]=useState("");
 const latest=useRef<Attempt|null>(null),sequence=useRef(0);
 const load=useCallback(async(c:string)=>{
  const n=++sequence.current;
  const v=await api<{items:Equipment[]}>("centers/"+c+"/items");
  if(n===sequence.current){setItems(v.items);setSelected(null);}
 },[]);
 const show=useCallback(async(c:string,ref:string)=>{
  const n=++sequence.current;
  const v=await api<History>("centers/"+c+"/items/"+ref+"/history");
  if(n===sequence.current)setSelected(v);
 },[]);
 useEffect(()=>{
  let active=true;
  void api<{centers:Center[]}>("centers/eligible").then(v=>{
   if(!active)return;
   setCenters(v.centers);if(v.centers.length===1)setCenter(v.centers[0].centerRef);
  }).catch(e=>{if(active)setError(e instanceof Error?e.message:"No current lab access.");})
   .finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;++sequence.current};
 },[]);
 useEffect(()=>{
  ++sequence.current;setSelected(null);setItems([]);latest.current=null;
  setUncertain(false);setMessage("");setProof("");
  if(!center)return;
  setLoading(true);
  void load(center).catch(e=>setError(e instanceof Error?e.message:"Lab list unavailable."))
   .finally(()=>setLoading(false));
 },[center,load]);
 async function commit(command:Attempt,retry=false){
  if(busy||(!retry&&uncertain))return;
  setBusy(true);setError("");setMessage("");
  try{
   const result=await api<{equipmentRef:string;revision:number}>(
    command.path,"POST",command.body);
   latest.current=null;setUncertain(false);setMessage(command.success);
   if(command.path.endsWith("/items")){
    setCode("");setName("");setMaker("");setModel("");setSerial("");
   }else{setNote("");setDue("");setProof("");}
   try{await load(center);await show(center,result.equipmentRef);}
   catch{setMessage(command.success+
    " The latest equipment list could not be refreshed; refresh manually.");}
  }catch(e){
   const st=e&&typeof e==="object"&&"status" in e&&
    typeof e.status==="number"?e.status:503;
   const unknown=st>=500;
   setUncertain(unknown);latest.current=unknown?command:null;
   setError(e instanceof Error?e.message:"Equipment operation unconfirmed.");
  }finally{setBusy(false);}
 }
 const submit=(e:FormEvent)=>{e.preventDefault();
  if(!canManage||!center||!code.trim()||!name.trim())return;
  const command={path:"centers/"+center+"/items",
   body:{requestKey:crypto.randomUUID(),code:code.trim().toUpperCase(),
    name:name.trim(),manufacturer:maker.trim(),model:model.trim(),
    serialNumber:serial.trim()},
   success:"Instrument registered as NOT READY. No stock or patient record created."};
  latest.current=command;void commit(command);
 };
 function maintenance(e:FormEvent){
  e.preventDefault();
  if(!canManage||!center||!selected||note.trim().length<2)return;
  if(action==="MAINTENANCE"&&(!proof||!due))return;
  if(!window.confirm(action==="MAINTENANCE"?
   "Record verified service and mark this instrument ready? "+
   "Only approved scanned evidence and a current calibration date are accepted.":
   action==="RETIRED"?"Retire this instrument? It will be unavailable.":"Mark out of service?"))return;
  const command={path:"centers/"+center+"/items/"+
    selected.equipment.equipmentRef+"/maintenance",
   body:{requestKey:crypto.randomUUID(),expectedVersion:selected.equipment.revision,
    action,note:note.trim(),
    ...(action==="MAINTENANCE"?{calibrationDueOn:due,evidenceFileRef:proof}:{})},
   success:action==="MAINTENANCE"?"Verified service recorded; check current readiness.":
    "Equipment status updated with its original maintenance history."};
  latest.current=command;void commit(command);
 }
 async function download(equipment:string,ref:string){
  setBusy(true);setError("");
  try{
   const response=await fetch("/api/lab-equipment/centers/"+center+
    "/items/"+equipment+"/evidence/files/"+ref,{credentials:"same-origin",
     cache:"no-store"});
   if(!response.ok||response.headers.get("Content-Type")!=="application/pdf")
    throw Error("The protected original PDF cannot be downloaded.");
   const bytes=await response.arrayBuffer();
   if(bytes.byteLength<5||bytes.byteLength>10485760||
     new TextDecoder().decode(bytes.slice(0,4))!=="%PDF")
    throw Error("Original quality evidence cannot be verified.");
   const object=URL.createObjectURL(new Blob([bytes],{type:"application/pdf"}));
   const anchor=document.createElement("a");anchor.href=object;
   anchor.download="careganga-private-quality.pdf";anchor.click();
   window.setTimeout(()=>URL.revokeObjectURL(object),1500);
   setMessage("Private quality evidence downloaded. Do not share externally.");
  }catch(e){setError(e instanceof Error?e.message:"Evidence download unavailable.");}
  finally{setBusy(false);}
 }
 return <section className="form-section" aria-label="Assigned laboratory equipment">
  <h1>Laboratory Equipment & Quality</h1>
  <p>Only instruments at your currently approved diagnostic laboratory.
   Readiness is separate from CG12 stock, patient testing and NABL accreditation.
   Every verified maintenance proof remains a private CG19 document.</p>
  {!!error&&<p className="notice error" role="alert">{error}</p>}
  {!!message&&<p className="notice" role="status">{message}</p>}
  {loading&&<p role="status">Checking your approved laboratories…</p>}
  {!loading&&centers.length===0&&<p className="cg-module-empty">
   No eligible Laboratory ERP center is currently assigned.</p>}
  <label className="field">Assigned laboratory
   <select value={center} disabled={busy||uncertain} onChange={e=>setCenter(e.target.value)}>
    <option value="">Select a currently assigned lab</option>
    {centers.map(c=><option value={c.centerRef} key={c.centerRef}>{c.name}</option>)}
   </select>
  </label>
  {uncertain&&<div className="notice" role="alert">
   The previous operation might already be saved. Do not create another action.
   <div className="toolbar">
    <button type="button" disabled={busy||!latest.current}
     onClick={()=>{if(latest.current)void commit(latest.current,true);}}>
     Retry the exact original request</button>
    <button type="button" disabled={busy||!center}
     onClick={()=>void load(center).catch(e=>setError(e instanceof Error?e.message:
      "Cannot refresh the original equipment."))}>Check original equipment list</button>
   </div>
  </div>}
  {canManage&&!!center&&!uncertain&&<form className="cg-diagnostics-card" onSubmit={submit}>
   <h2>Register an instrument</h2>
   <div className="form-grid">
    <label className="field">Equipment code
     <input maxLength={32} required value={code} disabled={busy}
      onChange={e=>setCode(e.target.value)} placeholder="Unique within this lab"/>
    </label>
    <label className="field">Equipment name
     <input maxLength={160} required value={name} disabled={busy}
      onChange={e=>setName(e.target.value)}/>
    </label>
    <label className="field">Manufacturer (optional)
     <input maxLength={120} value={maker} disabled={busy}
      onChange={e=>setMaker(e.target.value)}/>
    </label>
    <label className="field">Model (optional)
     <input maxLength={120} value={model} disabled={busy}
      onChange={e=>setModel(e.target.value)}/>
    </label>
    <label className="field">Serial (optional)
     <input maxLength={120} value={serial} disabled={busy}
      onChange={e=>setSerial(e.target.value)}/>
    </label>
   </div>
   <button type="submit" className="primary" disabled={busy||!code.trim()||!name.trim()}>
    Register as not ready</button>
  </form>}
  {canView&&!!center&&<section className="form-section">
   <h2>Equipment and current readiness</h2>
   <button type="button" disabled={busy||uncertain}
    onClick={()=>void load(center).catch(e=>setError(e instanceof Error?e.message:
     "Equipment refresh unavailable."))}>Refresh</button>
   {items.length===0&&!loading?<p className="cg-module-empty">
    No equipment registered at this lab.</p>:
    <div className="table-wrap"><table className="role-table">
     <thead><tr><th>Equipment</th><th>Instrument</th><th>Readiness</th>
      <th>Calibration due</th><th>Record</th></tr></thead>
     <tbody>{items.map(v=><tr key={v.equipmentRef}>
      <td>{v.code}</td><td>{v.name}</td><td>{status(v)}</td>
      <td>{v.calibrationDueOn??"Not recorded"}</td>
      <td><button type="button" disabled={busy||uncertain}
       onClick={()=>void show(center,v.equipmentRef).catch(e=>setError(
        e instanceof Error?e.message:"Equipment history unavailable."))}>View details</button></td>
     </tr>)}</tbody>
    </table></div>}
  </section>}
  {selected&&selected.equipment.centerRef===center&&<section className="form-section">
   <h2>{selected.equipment.name} · {selected.equipment.code}</h2>
   <p>Current readiness: <strong>{status(selected.equipment)}</strong>.
    Last recorded calibration date: {selected.equipment.calibrationDueOn??"not recorded"}.</p>
   {selected.events.length>0&&<div className="cg-diagnostics-card">
    <h3>Original maintenance history</h3>
    <ol>{selected.events.map(v=><li key={v.eventRef}>
     {v.eventType.replaceAll("_"," ").toLowerCase()} ·
     {" "+new Date(v.occurredAt).toLocaleString("en-IN")} · {v.description}</li>)}</ol>
   </div>}
   <div className="cg-diagnostics-card">
    <h3>Private verified quality documents</h3>
    {selected.files.length===0?<p>No scanner-verified evidence yet.</p>:
     selected.files.map(v=><div key={v.fileRef} className="toolbar">
      <span>{v.documentKind.replaceAll("_"," ").toLowerCase()} ·
       {" "+new Date(v.scannedAt).toLocaleDateString("en-IN")}</span>
      <button type="button" disabled={busy}
       onClick={()=>void download(selected.equipment.equipmentRef,v.fileRef)}>
       Read protected PDF</button>
      {canManage&&<button type="button" disabled={busy||uncertain}
       onClick={()=>setProof(v.fileRef)} aria-pressed={proof===v.fileRef}>
       {proof===v.fileRef?"Selected for service":"Use as service evidence"}</button>}
     </div>)}
   </div>
   {canUpload&&selected.equipment.status==="ACTIVE"&&
    <LabEquipmentQualityUpload key={center+":"+selected.equipment.equipmentRef}
     centerRef={center} equipmentRef={selected.equipment.equipmentRef}
     onVerified={async()=>show(center,selected.equipment.equipmentRef)}/>}
   {canManage&&selected.equipment.status==="ACTIVE"&&!uncertain&&
    <form className="cg-diagnostics-card" onSubmit={maintenance}>
     <h3>Record service or change readiness</h3>
     <label className="field">Action
      <select value={action} disabled={busy}
       onChange={e=>setAction(e.target.value as typeof action)}>
       <option value="MAINTENANCE">Record verified maintenance/calibration</option>
       <option value="MARK_OUT_OF_SERVICE">Mark out of service</option>
       <option value="RETIRED">Retire equipment</option>
      </select>
     </label>
     {action==="MAINTENANCE"&&<>
      <label className="field">Valid calibration through
       <input type="date" required value={due} disabled={busy}
        onChange={e=>setDue(e.target.value)}/>
      </label>
      <p role="status">{proof?
       "Scanner-verified private document selected for this service.":
       "Select a verified quality PDF above before recording readiness."}</p>
     </>}
     <label className="field">Maintenance note
      <textarea required minLength={2} maxLength={1000} value={note}
       disabled={busy} onChange={e=>setNote(e.target.value)}/>
     </label>
     <button type="submit" className="primary" disabled={busy||note.trim().length<2||
      action==="MAINTENANCE"&&(!proof||!due)}>
      {action==="MAINTENANCE"?"Record verified maintenance":"Save equipment status"}</button>
    </form>}
  </section>}
 </section>;
}
