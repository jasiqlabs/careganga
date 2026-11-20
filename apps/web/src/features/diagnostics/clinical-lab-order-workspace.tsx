"use client";
import {useCallback,useEffect,useRef,useState,type FormEvent} from "react";
type Center={centerRef:string;name:string};
type Patient={patientRef:string;virtualPatientId:string;name:string;
 careSourceKind:"CENTER_INTAKE"|"CONSULTATION";careSourceRef:string};
type Item={mappingRef:string;name:string;code:string;kind:"TEST"|"PACKAGE";
 currentPatientPriceMinor:string;currency:"INR"};
type Order={orderRef:string;displayOrderRef:string;status:string;
 quotedTotalMinor:string;createdAt:string};
type Detail={order:Order;lines:{name:string;code:string;sampleType:string;
 quantity:number;quotedLineTotalMinor:string}[];
 samples:{label:string;sampleType:string;status:string}[]};
const money=(n:string)=>/^\d{1,11}$/.test(n)&&Number.isSafeInteger(Number(n))?
 new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR"})
  .format(Number(n)/100):"Price unavailable";
async function api<T>(path:string,method:"GET"|"POST"="GET",body?:object):Promise<T>{
 const response=await fetch("/api/lab-clinical/"+path,{
  method,cache:"no-store",credentials:"same-origin",
  ...(body?{headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})
 });
 const result:unknown=await response.json().catch(()=>null);
 if(!response.ok){
  const message=result&&typeof result==="object"&&"message" in result&&
   typeof result.message==="string"?result.message:
   "The current clinical record cannot be confirmed.";
  const err=Object.assign(new Error(message),{status:response.status});
  throw err;
 }
 return result as T;
}
type Selection={mappingRef:string;quantity:number};
type Submission={requestKey:string;patientRef:string;
 careSource:{kind:"CENTER_INTAKE"|"CONSULTATION";ref:string};
 selections:Selection[]};
export function ClinicalLabOrderWorkspace({canCreate,canView}:{
 canCreate:boolean;canView:boolean
}){
 const [centers,setCenters]=useState<Center[]>([]),[center,setCenter]=useState("");
 const [patients,setPatients]=useState<Patient[]>([]),[catalog,setCatalog]=useState<Item[]>([]);
 const [orders,setOrders]=useState<Order[]>([]),[selected,setSelected]=useState<Detail|null>(null);
 const [patientKey,setPatientKey]=useState(""),[itemKey,setItemKey]=useState("");
 const [quantity,setQuantity]=useState(1),[cart,setCart]=useState<Selection[]>([]);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [uncertain,setUncertain]=useState(false);
 const replay=useRef<Submission|null>(null);
 const epoch=useRef(0);
 const reloadCenters=useCallback(async()=>{
  const result=await api<{centers:Center[]}>("centers/eligible");
  setCenters(result.centers??[]);
 },[]);
 const reloadCenter=useCallback(async(ref:string)=>{
  const n=++epoch.current;
  if(!ref){setPatients([]);setCatalog([]);setOrders([]);return;}
  const [patientsResult,catalogResult,orderResult]=await Promise.all([
   canCreate?api<{patients:Patient[]}>("centers/"+ref+"/patients/eligible"):
    Promise.resolve({patients:[]}),
   canCreate?api<{items:Item[]}>("centers/"+ref+"/catalog/eligible"):
    Promise.resolve({items:[]}),
   canView?api<{orders:Order[]}>("centers/"+ref+"/orders"):
    Promise.resolve({orders:[]})
  ]);
  if(n===epoch.current){
   setPatients(patientsResult.patients??[]);
   setCatalog(catalogResult.items??[]);
   setOrders(orderResult.orders??[]);
  }
 },[canCreate,canView]);
 useEffect(()=>{
  let active=true;
  void reloadCenters().catch(e=>{if(active)setError(e instanceof Error?e.message:
   "Your assigned laboratory cannot be checked.");}).finally(()=>{
    if(active)setLoading(false);
   });
  return()=>{active=false;++epoch.current;};
 },[reloadCenters]);
 useEffect(()=>{
  setPatients([]);setCatalog([]);setOrders([]);setSelected(null);
  setPatientKey("");setCart([]);setItemKey("");
  if(!center)return;
  setLoading(true);setError("");
  void reloadCenter(center).catch(e=>setError(e instanceof Error?e.message:
   "Current lab orders are unavailable.")).finally(()=>setLoading(false));
 },[center,reloadCenter]);
 const patientOptions=patients.map((p,i)=>({key:String(i),value:p}));
 const availableItems=catalog.filter(x=>!cart.some(c=>c.mappingRef===x.mappingRef));
 function addItem(){
  if(!itemKey||!Number.isSafeInteger(quantity)||quantity<1||quantity>20)return;
  if(!availableItems.some(x=>x.mappingRef===itemKey))return;
  setCart(old=>[...old,{mappingRef:itemKey,quantity}]);
  setItemKey("");setQuantity(1);
 }
 async function send(original:Submission){
  if(!center||busy)return;
  setBusy(true);setError("");setNotice("");
  try{
   const result=await api<{orderRef:string;displayOrderRef:string;
    status:string;replayed:boolean}>("centers/"+center+"/orders","POST",original);
   replay.current=null;setUncertain(false);
   setNotice("Lab order "+result.displayOrderRef+" confirmed. No payment or report was recorded.");
   setCart([]);setPatientKey("");
   if(canView)try{await reloadCenter(center);}
   catch{setError("Order confirmed, but the latest list could not be refreshed.");}
  }catch(e){
   const status=e&&typeof e==="object"&&"status" in e&&
    typeof e.status==="number"?e.status:503;
   setError(e instanceof Error?e.message:"The order outcome cannot be confirmed.");
   if(status>=500){replay.current=original;setUncertain(true);}
   else{replay.current=null;setUncertain(false);}
  }finally{setBusy(false);}
 }
 function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();
  if(!canCreate||uncertain||!center||!cart.length)return;
  const p=patientOptions.find(x=>x.key===patientKey)?.value;
  if(!p){setError("Select a currently authorized patient and care visit.");return;}
  const payload:Submission={requestKey:crypto.randomUUID(),patientRef:p.patientRef,
   careSource:{kind:p.careSourceKind,ref:p.careSourceRef},selections:cart};
  replay.current=payload;
  void send(payload);
 }
 async function show(orderRef:string){
  setError("");setSelected(null);
  try{const d=await api<Detail>("centers/"+center+"/orders/"+orderRef);
   setSelected(d);
  }catch(e){setError(e instanceof Error?e.message:"This order cannot be viewed.");}
 }
 return <section className="cg-health-workspace cg-diagnostics"
  aria-label="Clinical laboratory orders">
  <header className="topbar"><div><h1>Lab Orders & Samples</h1>
   <p>Authorized internal clinical orders only. The Lab ERP must be enabled,
    clinically approved and active for your assigned verified laboratory.</p>
  </div></header>
  {!!error&&<p className="notice error" role="alert">{error}</p>}
  {!!notice&&<p className="notice" role="status">{notice}</p>}
  {uncertain&&<div className="notice" role="alert">
   This order might already exist. Do not start a new order or change its
   selection until the original result is confirmed.
   <div className="toolbar">
    <button type="button" disabled={busy} onClick={()=>
     void reloadCenter(center).then(()=>setNotice("Current orders refreshed."))
      .catch(e=>setError(e instanceof Error?e.message:"Records cannot be checked."))}>
     Check original orders</button>
    <button type="button" disabled={busy||!replay.current}
     onClick={()=>{if(replay.current)void send(replay.current);}}>
     Retry the same request safely</button>
   </div>
  </div>}
  {loading&&<p role="status">Checking your current assigned laboratory access…</p>}
  {!loading&&centers.length===0&&<p className="cg-module-empty">
   No currently approved Lab ERP center is available for your clinical role.</p>}
  {!!centers.length&&<label className="field">Your clinical laboratory
   <select value={center} disabled={busy||uncertain}
    onChange={e=>setCenter(e.target.value)}>
    <option value="">Select an approved assigned lab</option>
    {centers.map(c=><option key={c.centerRef} value={c.centerRef}>{c.name}</option>)}
   </select>
  </label>}
  {canCreate&&center&&<section className="form-section">
   <h2>Create Internal Lab Order</h2>
   <p>Choose the patient’s actual same-center consented intake or visit.
    The current commercial quote is frozen on acceptance; it is not a receipt.</p>
   <form onSubmit={submit}>
    <div className="form-grid">
     <label className="field">Consented patient and center-care record
      <select required value={patientKey} disabled={busy||uncertain}
       onChange={e=>setPatientKey(e.target.value)}>
       <option value="">Select a verified patient from this center</option>
       {patientOptions.map(p=><option key={p.key} value={p.key}>
        {p.value.name} · {p.value.virtualPatientId} ·
        {p.value.careSourceKind==="CENTER_INTAKE"?" Center intake":" Consultation"}
       </option>)}
      </select>
     </label>
     <label className="field">Approved test or package
      <select value={itemKey} disabled={busy||uncertain}
       onChange={e=>setItemKey(e.target.value)}>
       <option value="">Select a current reviewed offer</option>
       {availableItems.map(item=><option key={item.mappingRef} value={item.mappingRef}>
        {item.name} · {item.kind==="PACKAGE"?"Package":"Test"} ·
        {money(item.currentPatientPriceMinor)}
       </option>)}
      </select>
     </label>
     <label className="field">Quantity
      <input type="number" min={1} max={20} step={1} value={quantity}
       disabled={busy||uncertain}
       onChange={e=>setQuantity(Number(e.target.value))}/>
     </label>
    </div>
    <button type="button" disabled={busy||uncertain||!itemKey}
     onClick={addItem}>Add selected test</button>
    <div className="table-wrap">
     <table className="role-table"><thead><tr><th>Selected test</th><th>Qty</th><th>Quoted total</th><th>Action</th></tr></thead>
      <tbody>{cart.map(item=>{
       const src=catalog.find(c=>c.mappingRef===item.mappingRef);
       return <tr key={item.mappingRef}>
        <td>{src?.name??"Current offer unavailable"}</td>
        <td>{item.quantity}</td>
        <td>{src&&/^\d{1,10}$/.test(src.currentPatientPriceMinor)?
         money(String(Number(src.currentPatientPriceMinor)*item.quantity)):
         "Refresh required"}</td>
        <td><button type="button" disabled={busy||uncertain}
         onClick={()=>setCart(old=>old.filter(c=>c.mappingRef!==item.mappingRef))}>
         Remove</button></td>
       </tr>;
      })}</tbody>
     </table>
    </div>
    <div className="toolbar">
     <button type="submit" className="primary" disabled={busy||uncertain||
      !cart.length||!patientKey||!catalog.length}>
      {busy?"Saving original order…":"Create clinical lab order"}</button>
     <button type="button" disabled={busy||uncertain} onClick={()=>{
      setCart([]);setPatientKey("");setItemKey("");
     }}>Clear form</button>
    </div>
   </form>
  </section>}
  {canView&&center&&<section className="form-section">
   <h2>Latest Clinical Orders</h2>
   {!orders.length?<p className="cg-module-empty">
    No clinical lab orders are available for this verified center.</p>:
    <div className="table-wrap"><table className="role-table">
     <thead><tr><th>Order</th><th>Quoted total</th><th>Clinical status</th><th>Details</th></tr></thead>
     <tbody>{orders.map(o=><tr key={o.orderRef}>
      <td>{o.displayOrderRef}</td><td>{money(o.quotedTotalMinor)}</td>
      <td>{o.status.replaceAll("_"," ").toLowerCase()}</td>
      <td><button type="button" onClick={()=>void show(o.orderRef)}>View</button></td>
     </tr>)}</tbody>
    </table></div>}
   <p className="cg-diagnostics-note">Showing at most 30 current-source orders.
    This screen does not mark payment collected or medical reports delivered.</p>
  </section>}
  {selected&&<section className="form-section">
   <h2>{selected.order.displayOrderRef}</h2>
   <p>Accepted lab total: {money(selected.order.quotedTotalMinor)}.
    No verified payment or report delivery has been recorded.</p>
   {selected.lines.map((line,i)=><p key={i}>
    {line.name} ({line.code}) · Qty {line.quantity} ·
    {" "+money(line.quotedLineTotalMinor)}</p>)}
   <h3>Original Sample Labels</h3>
   {!selected.samples.length?<p>No sample collection is required for this test.</p>:
    selected.samples.map(item=><p key={item.label}>
     {item.label} · {item.sampleType.replaceAll("_"," ")} ·
     {item.status.replaceAll("_"," ")}</p>)}
   <p>Sample custody and professional report release require their
    separately authorized clinical workflows. A created order is not a released report.</p>
  </section>}
 </section>;
}
