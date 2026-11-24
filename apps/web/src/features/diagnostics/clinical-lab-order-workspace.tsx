"use client";
import {useCallback,useEffect,useRef,useState,type FormEvent} from "react";
import {ClinicalLabResultEntry} from "./clinical-lab-result-entry";
import {ClinicalLabProfessionalReviewPanel} from "./clinical-lab-professional-review-panel";
import {ClinicalLabReleasePanel} from "./clinical-lab-release-panel";
type Center={centerRef:string;name:string};
type Patient={patientRef:string;virtualPatientId:string;name:string;
 careSourceKind:"CENTER_INTAKE"|"CONSULTATION";careSourceRef:string};
type Item={mappingRef:string;name:string;code:string;kind:"TEST"|"PACKAGE";
 currentPatientPriceMinor:string;currency:"INR"};
type Order={orderRef:string;displayOrderRef:string;status:string;
 quotedTotalMinor:string;createdAt:string};
type Detail={order:Order;lines:{name:string;code:string;sampleType:string;
 quantity:number;quotedLineTotalMinor:string}[];
 samples:{sampleRef:string;label:string;sampleType:string;status:string;revision:number}[];
 report:{state:string}|null};
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
type CustodyAction="collect"|"receive"|"start-processing"|"reject"|"recollect";
type CustodyRequest={centerRef:string;orderRef:string;sampleRef:string;
 action:CustodyAction;requestKey:string;expectedVersion:number};
const nextAction:Partial<Record<string,{action:CustodyAction;label:string}>>={
 PENDING_COLLECTION:{action:"collect",label:"Record collection"},
 COLLECTED:{action:"receive",label:"Mark received"},
 RECEIVED:{action:"start-processing",label:"Start processing"},
 REJECTED:{action:"recollect",label:"Create recollection label"}
};
export function ClinicalLabOrderWorkspace({canCreate,canView,canManageSamples,canRecordResults,canReview,canRelease}:{
 canCreate:boolean;canView:boolean;canManageSamples:boolean;canRecordResults:boolean;
 canReview:boolean;canRelease:boolean
}){
 const [centers,setCenters]=useState<Center[]>([]),[center,setCenter]=useState("");
 const [patients,setPatients]=useState<Patient[]>([]),[catalog,setCatalog]=useState<Item[]>([]);
 const [orders,setOrders]=useState<Order[]>([]),[selected,setSelected]=useState<Detail|null>(null);
 const [selectedCenter,setSelectedCenter]=useState("");
 const [patientKey,setPatientKey]=useState(""),[itemKey,setItemKey]=useState("");
 const [quantity,setQuantity]=useState(1),[cart,setCart]=useState<Selection[]>([]);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [uncertain,setUncertain]=useState(false);
 const replay=useRef<Submission|null>(null);
 const custodyReplay=useRef<CustodyRequest|null>(null);
 const [custodyUncertain,setCustodyUncertain]=useState(false);
 const [rejectSampleRef,setRejectSampleRef]=useState("");
 const [custodyBusy,setCustodyBusy]=useState(false);
 const epoch=useRef(0),detailEpoch=useRef(0);
 const [orderQuery,setOrderQuery]=useState("");
 const orderFilter=useRef({q:"",offset:0});
 const [nextOrderOffset,setNextOrderOffset]=useState<number|null>(null);
 const [detailLoading,setDetailLoading]=useState(false);
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
   canView?api<{orders:Order[];nextOffset:number|null}>("centers/"+ref+"/orders?"+new URLSearchParams({q:orderFilter.current.q,offset:String(orderFilter.current.offset)})):
    Promise.resolve({orders:[],nextOffset:null})
  ]);
  if(n===epoch.current){
   setPatients(patientsResult.patients??[]);
   setCatalog(catalogResult.items??[]);
   setOrders(orderResult.orders??[]);setNextOrderOffset(orderResult.nextOffset??null);
  }
 },[canCreate,canView]);
 useEffect(()=>{
  let active=true;
  void reloadCenters().catch(e=>{if(active)setError(e instanceof Error?e.message:
   "Your assigned laboratory cannot be checked.");}).finally(()=>{
    if(active)setLoading(false);
   });
  return()=>{active=false;++epoch.current;++detailEpoch.current;};
 },[reloadCenters]);
 useEffect(()=>{
  ++detailEpoch.current;setDetailLoading(false);setOrderQuery("");orderFilter.current={q:"",offset:0};setNextOrderOffset(null);
  setPatients([]);setCatalog([]);setOrders([]);setSelected(null);
  custodyReplay.current=null;setCustodyUncertain(false);setRejectSampleRef("");
  setPatientKey("");setCart([]);setItemKey("");
  if(!center)return;
  setLoading(true);setError("");
  void reloadCenter(center).catch(e=>setError(e instanceof Error?e.message:
   "Current lab orders are unavailable.")).finally(()=>setLoading(false));
 },[center,reloadCenter]);
 async function searchOrders(q:string,offset=0){
  if(!center||busy||loading||custodyBusy||custodyUncertain||uncertain||detailLoading)return;
  orderFilter.current={q:q.trim(),offset};setOrders([]);setNextOrderOffset(null);setSelected(null);setSelectedCenter("");++detailEpoch.current;
  setLoading(true);setError("");
  try{await reloadCenter(center);}catch(e){setError(e instanceof Error?e.message:"Orders could not be checked.");}finally{setLoading(false);}
 }
 const patientOptions=patients.map(p=>({key:p.patientRef+"|"+p.careSourceKind+"|"+p.careSourceRef,value:p}));
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
  if(!canCreate||busy||loading||uncertain||!center||!cart.length)return;
  if(cart.some(c=>!catalog.some(o=>o.mappingRef===c.mappingRef))){setError("A selected test is no longer available. Remove it and choose a current test.");return;}
  const p=patientOptions.find(x=>x.key===patientKey)?.value;
  if(!p){setError("Select a currently authorized patient and care visit.");return;}
  const payload:Submission={requestKey:crypto.randomUUID(),patientRef:p.patientRef,
   careSource:{kind:p.careSourceKind,ref:p.careSourceRef},selections:cart};
  replay.current=payload;
  void send(payload);
 }
 async function show(orderRef:string){
  const requestedCenter=center,request=++detailEpoch.current;
  setDetailLoading(true);setError("");setSelected(null);setSelectedCenter("");setRejectSampleRef("");
  try{
   const detail=await api<Detail>("centers/"+requestedCenter+"/orders/"+orderRef);
   // The UI cannot reuse a previous center's patient/clinical data after
   // the user switches the selected lab while a private request is pending.
   if(request!==detailEpoch.current)return;
   if(detail?.order?.orderRef!==orderRef)throw Error("The selected order is unavailable.");
   setSelectedCenter(requestedCenter);
   setSelected(detail);
  }catch(e){if(request===detailEpoch.current)setError(e instanceof Error?e.message:"This order cannot be viewed.");}
  finally{if(request===detailEpoch.current)setDetailLoading(false);}
 }
 async function custodySend(original:CustodyRequest){
  if(!canManageSamples||!canView||custodyBusy||original.centerRef!==center)return;
  setCustodyBusy(true);setError("");setNotice("");
  try{
   const result=await api<{status:string;revision:number;replayed:boolean;
    replacementLabel?:string}>("centers/"+original.centerRef+
    "/orders/"+original.orderRef+"/samples/"+original.sampleRef+
    "/"+original.action,"POST",{
     requestKey:original.requestKey,expectedVersion:original.expectedVersion
    });
   custodyReplay.current=null;setCustodyUncertain(false);setRejectSampleRef("");
   setNotice(result.replacementLabel?
    "Replacement label "+result.replacementLabel+" created. Collect a new sample.":
    "Original specimen custody step recorded.");
   // The write is already committed. A later read/refresh failure must
   // never be reported as an uncertain write or send a second new action.
   await show(original.orderRef);
   try{await reloadCenter(center);}
   catch{setError("Custody saved, but the order list could not be refreshed. Check again.");}
  }catch(e){
   const status=e&&typeof e==="object"&&"status" in e&&
    typeof e.status==="number"?e.status:503;
   setError(e instanceof Error?e.message:"Specimen outcome could not be confirmed.");
   if(status>=500){custodyReplay.current=original;setCustodyUncertain(true);}
   else{
    custodyReplay.current=null;setCustodyUncertain(false);
    try{await show(original.orderRef);}catch{}
   }
  }finally{setCustodyBusy(false);}
 }
 function custodyStart(sample:Detail["samples"][number],action:CustodyAction){
  if(!selected||selectedCenter!==center||custodyUncertain||custodyBusy||busy)return;
  const permitted=(action==="reject"&&["COLLECTED","RECEIVED","PROCESSING"].includes(sample.status))||
   nextAction[sample.status]?.action===action;
  if(!permitted||!Number.isSafeInteger(sample.revision)||sample.revision<1)return;
  const payload:CustodyRequest={centerRef:center,orderRef:selected.order.orderRef,
   sampleRef:sample.sampleRef,action,expectedVersion:sample.revision,
   requestKey:crypto.randomUUID()};
  custodyReplay.current=payload;
  void custodySend(payload);
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
   <select value={center} disabled={busy||uncertain||custodyBusy||custodyUncertain}
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
   <h2>Clinical Orders</h2>
   <form className="toolbar" onSubmit={e=>{e.preventDefault();void searchOrders(orderQuery);}}>
    <label className="field">Find orders<input maxLength={80} value={orderQuery} onChange={e=>setOrderQuery(e.target.value)} placeholder="Order number or clinical status"/></label>
    <button type="submit" disabled={busy||loading||custodyBusy||custodyUncertain||uncertain||detailLoading}>Search</button>
    <button type="button" disabled={busy||loading||custodyBusy||custodyUncertain||uncertain||detailLoading} onClick={()=>{setOrderQuery("");void searchOrders("");}}>Reset</button>
   </form>
   {detailLoading&&<p role="status">Checking order details…</p>}
   {loading?<p role="status">Checking orders…</p>:!orders.length?<p className="cg-module-empty">
    No clinical lab orders are available for this verified center.</p>:
    <div className="table-wrap"><table className="role-table">
     <thead><tr><th>Order</th><th>Quoted total</th><th>Clinical status</th><th>Details</th></tr></thead>
     <tbody>{orders.map(o=><tr key={o.orderRef}>
      <td>{o.displayOrderRef}</td><td>{money(o.quotedTotalMinor)}</td>
      <td>{o.status.replaceAll("_"," ").toLowerCase()}</td>
      <td><button type="button" disabled={busy||custodyBusy||custodyUncertain||uncertain} onClick={()=>void show(o.orderRef)}>View</button></td>
     </tr>)}</tbody>
    </table></div>}
   <div className="toolbar">
    <button type="button" disabled={loading||busy||custodyBusy||custodyUncertain||uncertain||detailLoading||orderFilter.current.offset===0} onClick={()=>void searchOrders(orderFilter.current.q,Math.max(0,orderFilter.current.offset-30))}>Previous page</button>
    <button type="button" disabled={loading||busy||custodyBusy||custodyUncertain||uncertain||detailLoading||nextOrderOffset===null} onClick={()=>{if(nextOrderOffset!==null)void searchOrders(orderFilter.current.q,nextOrderOffset);}}>Next page</button>
   </div>
   <p className="cg-diagnostics-note">Up to 30 authorized orders per page. Payment and report delivery are verified separately.</p>
  </section>}
  {custodyUncertain&&<div className="notice" role="alert">
   The specimen action may already be saved. Avoid another action until
   the original result is confirmed.
   <div className="toolbar">
    <button type="button" disabled={custodyBusy||!custodyReplay.current}
     onClick={()=>{if(custodyReplay.current)void custodySend(custodyReplay.current);}}>
     Retry the same custody request</button>
    <span>Retrying the same request does not create another specimen event.
     Refreshing alone cannot confirm that the first action was saved.</span>
   </div>
  </div>}
  {selected&&selectedCenter===center&&<section className="form-section">
   <div className="toolbar"><h2>{selected.order.displayOrderRef}</h2><button type="button" disabled={custodyBusy||custodyUncertain} onClick={()=>{++detailEpoch.current;setSelected(null);}}>Close details</button></div>
   <p>Clinical status: {selected.order.status.replaceAll("_"," ")}</p>
   <p>Accepted lab total: {money(selected.order.quotedTotalMinor)}.
    No verified payment or report delivery has been recorded.</p>
   <h3>1. Accepted tests</h3>
   {selected.lines.map((line,i)=><p key={i}>
    {line.name} ({line.code}) · Qty {line.quantity} ·
    {" "+money(line.quotedLineTotalMinor)}</p>)}
   <h3>2. Specimen collection & custody</h3>
   {!selected.samples.length?<p role="status">No approved specimen custody
    path exists for these tests. The order cannot be advanced until
    the required clinical handling policy has been reviewed.</p>:
    selected.samples.map(item=><article className="cg-diagnostics-card" key={item.sampleRef}>
     <p><strong>{item.label}</strong> · {item.sampleType.replaceAll("_"," ")} ·
      {item.status.replaceAll("_"," ").toLowerCase()}</p>
     {canManageSamples&&<div className="toolbar">
      {nextAction[item.status]&&
       <button type="button" disabled={busy||custodyBusy||custodyUncertain}
        onClick={()=>custodyStart(item,nextAction[item.status]!.action)}>
        {nextAction[item.status]!.label}</button>}
      {["COLLECTED","RECEIVED","PROCESSING"].includes(item.status)&&
       (rejectSampleRef===item.sampleRef?<>
        <span>Reject this sample? Its original custody history will remain.</span>
        <button type="button" disabled={busy||custodyBusy||custodyUncertain}
         onClick={()=>custodyStart(item,"reject")}>Confirm rejection</button>
        <button type="button" disabled={custodyBusy}
         onClick={()=>setRejectSampleRef("")}>Cancel</button>
       </>:<button type="button" disabled={busy||custodyBusy||custodyUncertain}
        onClick={()=>setRejectSampleRef(item.sampleRef)}>Reject sample…</button>)}
     </div>}
    </article>)}
   <p>Each custody action requires current assigned-center access. Rejected
    specimens need new collection labels. A collected sample does not mean
    a medical report is reviewed or released.</p>
   <h3>3. Result entry, review & release</h3>
   {canRelease&&selected.report?.state==="RESULT_READY"&&
    <ClinicalLabReleasePanel key={"release:"+center+":"+selected.order.orderRef}
     centerRef={center} orderRef={selected.order.orderRef}/>}
   {canReview&&selected.report?.state==="RESULT_READY"&&
    <ClinicalLabProfessionalReviewPanel key={center+":"+selected.order.orderRef}
     centerRef={center} orderRef={selected.order.orderRef}/>}
   {selected.report?.state==="RESULT_READY"?
    <>
     <p className="notice" role="status">Report PDF is ready for
      clinician review. Patient access requires authorized release.</p>
     {canRecordResults&&<details>
      <summary>Correct previously released lab report</summary>
      <ClinicalLabResultEntry key={"correction:"+center+":"+selected.order.orderRef}
       centerRef={center} orderRef={selected.order.orderRef}
       onVerified={async()=>{await show(selected.order.orderRef);}}/>
     </details>}
    </>:
    canRecordResults&&(
     selected.order.status==="RESULT_READY"&&
     selected.report?.state==="DRAFT"||
     selected.order.status==="PROCESSING"&&
     selected.samples.length>0&&
     selected.samples.every(s=>s.status==="PROCESSING"))?
    <ClinicalLabResultEntry key={"entry:"+center+":"+selected.order.orderRef}
     centerRef={center} orderRef={selected.order.orderRef}
     onVerified={async()=>{await show(selected.order.orderRef);}}/>:null}
  </section>}
 </section>;
}
