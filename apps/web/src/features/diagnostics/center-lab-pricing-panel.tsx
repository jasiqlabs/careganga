"use client";
import {useCallback,useEffect,useRef,useState,type FormEvent} from "react";
import {
 diagnosticsCall,writeUncertain,moneyMinor,formatRupees,
 localDateTimeToUtc,type DiagnosticItem,type DiagnosticMapping,type DiagnosticPrice
} from "./diagnostic-api";
type Props={centerRef:string;canManage:boolean};
export function CenterLabPricingPanel({centerRef,canManage}:Props){
 const [items,setItems]=useState<DiagnosticItem[]>([]);
 const [mappings,setMappings]=useState<DiagnosticMapping[]>([]);
 const [prices,setPrices]=useState<DiagnosticPrice[]>([]);
 const priceFilter=useRef({status:"",offset:0});
 const [nextPriceOffset,setNextPriceOffset]=useState<number|null>(null),[priceLoading,setPriceLoading]=useState(false);
 const [kind,setKind]=useState<"TEST"|"PACKAGE">("TEST");
 const [itemRef,setItemRef]=useState(""),[mappingRef,setMappingRef]=useState("");
 const [base,setBase]=useState(""),[patient,setPatient]=useState("");
 const [from,setFrom]=useState(""),[to,setTo]=useState("");
 const [reason,setReason]=useState("");
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [uncertain,setUncertain]=useState(false);
 const keys=useRef<Record<string,string>>({});
 const prefix="my-centers/"+encodeURIComponent(centerRef);
 const epoch=useRef(0);
 const reload=useCallback(async()=>{
  const n=++epoch.current,filter=priceFilter.current;
  setPrices([]);setNextPriceOffset(null);setPriceLoading(true);
  try{const [options,current,rates]=await Promise.all([
   diagnosticsCall<{items:DiagnosticItem[]}>(prefix+"/eligible-items"),
   diagnosticsCall<{mappings:DiagnosticMapping[]}>(prefix+"/tests"),
   diagnosticsCall<{prices:DiagnosticPrice[];nextOffset:number|null}>(prefix+"/test-prices?"+new URLSearchParams({priceStatus:filter.status,offset:String(filter.offset)}).toString())
  ]);
  if(n===epoch.current){
   setItems(options.items??[]);setMappings(current.mappings??[]);
   setPrices(rates.prices??[]);setNextPriceOffset(rates.nextOffset??null);
  }}finally{if(n===epoch.current)setPriceLoading(false);}
 },[prefix]);
 useEffect(()=>{
  let alive=true;setLoading(true);
  priceFilter.current={status:"",offset:0};setNextPriceOffset(null);setItems([]);setMappings([]);setPrices([]);
  setError("");setNotice("");setUncertain(false);
  keys.current={};
  void reload().catch(e=>{if(alive)setError(e instanceof Error?e.message:
   "Your current lab pricing cannot be verified.");}).finally(()=>{
    if(alive)setLoading(false);
   });
  return()=>{alive=false;++epoch.current;};
 },[reload]);
 function filterPrices(status:string,offset=0){
  if(busy||uncertain||loading||priceLoading)return;
  priceFilter.current={status,offset};setError("");void reload().catch(e=>setError(e instanceof Error?e.message:"Current lab prices unavailable."));
 }
 async function save(operation:string,path:string,fields:Record<string,unknown>,message:string){
  if(busy||uncertain)return;
  const key=keys.current[operation]??crypto.randomUUID();
  keys.current[operation]=key;
  setBusy(true);setError("");setNotice("");
  try{
   await diagnosticsCall(path,"POST",{requestKey:key,...fields});
   delete keys.current[operation];
   setNotice(message);
   try{await reload();}
   catch{setError("The change was saved, but the current lab list could not "+
    "be refreshed. Check the original lab record before another change.");}
  }catch(e){
   setError(e instanceof Error?e.message:"This lab proposal could not be confirmed.");
   if(writeUncertain(e))setUncertain(true);
   else delete keys.current[operation];
  }finally{setBusy(false);}
 }
 function mapTest(e:FormEvent<HTMLFormElement>){
  e.preventDefault();
  if(!itemRef||!canManage)return;
  void save("mapping",prefix+"/tests",{kind,itemRef},
   "Test mapping saved at your verified lab. Foundation price approval is separate.");
 }
 function propose(e:FormEvent<HTMLFormElement>){
  e.preventDefault();
  const found=mappings.find(m=>m.mappingRef===mappingRef);
  if(!canManage||!found||found.status!=="ACTIVE"){
   setError("Select an active test mapping.");return;
  }
  try{
   const basePriceMinor=moneyMinor(base),patientPriceMinor=moneyMinor(patient);
   if(patientPriceMinor>basePriceMinor)
    throw Error("The proposed patient price cannot exceed the base price.");
   const effectiveFromUtc=localDateTimeToUtc(from,"effective start");
   const effectiveToUtc=to?localDateTimeToUtc(to,"effective end"):null;
   if(effectiveToUtc&&effectiveToUtc<=effectiveFromUtc)
    throw Error("Effective end must be later than the start.");
   void save("price",prefix+"/test-prices",
    {mappingRef,expectedMappingVersion:found.revision,
     effectiveFromUtc,effectiveToUtc,basePriceMinor,patientPriceMinor,
     currency:"INR",discountReason:reason},
    "Price proposal sent. A different authorized Foundation reviewer must approve it.");
  }catch(e){setError(e instanceof Error?e.message:"Check the proposed price.");}
 }
 return <section className="form-section cg-diagnostics" aria-label="My lab tests and pricing">
  <h3>Lab Tests & Commercial Pricing</h3>
  <p>Manage tests offered at this approved lab location. These are commercial prices, not patient payments or Foundation assistance.</p>
  {loading&&<p role="status" className="cg-module-loading">Checking current approved lab tests…</p>}
  {!!error&&<p role="alert" className="notice error">{error}</p>}
  {!!notice&&<p role="status" className="notice">{notice}</p>}
  {uncertain&&<div role="alert" className="notice">
   A proposal may already be saved. Refresh original records before trying again.
   <button type="button" disabled={busy} onClick={()=>void reload().then(()=>{
    keys.current={};setUncertain(false);setError("");
    setNotice("Original lab records refreshed. Review current proposals before continuing.");
   }).catch(e=>setError(e instanceof Error?e.message:"Current records unavailable."))}>
    Check current lab records</button>
  </div>}
  <div className="cg-diagnostics-layout">
   <div><h4>Tests offered here</h4>
    {!loading&&!mappings.length&&<p className="cg-module-empty">No tests mapped to this lab yet.</p>}
    {!!mappings.length&&<div className="table-wrap"><table>
     <thead><tr><th>Test or package</th><th>Status</th></tr></thead>
     <tbody>{mappings.map(m=><tr key={m.mappingRef}>
      <td>{m.name} ({m.code})</td><td>{m.status==="ACTIVE"?"Active":"Inactive"}</td>
     </tr>)}</tbody></table></div>}
    {canManage&&<form onSubmit={mapTest}>
     <div className="form-grid">
      <label className="field">Offer type<select value={kind}
       onChange={e=>{setKind(e.target.value as "TEST"|"PACKAGE");setItemRef("");}}>
       <option value="TEST">Individual test</option><option value="PACKAGE">Diagnostic package</option>
      </select></label>
      <label className="field">Active test or package<select required value={itemRef}
       onChange={e=>setItemRef(e.target.value)}>
       <option value="">Select an approved test</option>
       {items.filter(x=>x.kind===kind&&!mappings.some(m=>
        m.testRef===x.itemRef||m.packageRef===x.itemRef)).map(x=>
        <option value={x.itemRef} key={x.itemRef}>{x.name} ({x.code})</option>)}
      </select></label>
     </div>
     <button type="submit" className="primary" disabled={!itemRef||busy||uncertain}>
      Map to this lab</button>
    </form>}
   </div>
   <div><h4>Price proposals and approved offers</h4>
    <label className="field">Price status<select value={priceFilter.current.status} disabled={busy||uncertain||loading||priceLoading} onChange={e=>filterPrices(e.target.value)}><option value="">All statuses</option><option value="PROPOSED">Pending review</option><option value="APPROVED">Approved (all dates)</option><option value="CURRENT">Approved, currently effective</option><option value="UPCOMING">Approved, upcoming</option><option value="EXPIRED">Approved, expired</option><option value="REJECTED">Rejected</option></select></label>
    {priceLoading&&<p role="status">Checking prices…</p>}
    {!loading&&!priceLoading&&!prices.length&&<p className="cg-module-empty">No prices match the current filter.</p>}
    {!!prices.length&&<div className="table-wrap"><table>
     <thead><tr><th>Test</th><th>Patient price</th><th>Status</th></tr></thead>
     <tbody>{prices.map(p=><tr key={p.priceRef}>
      <td>{mappings.find(m=>m.mappingRef===p.mappingRef)?.name??"Mapped test"}</td>
      <td>{formatRupees(p.patientPriceMinor)}<div>
       Base {formatRupees(p.basePriceMinor)}</div></td>
      <td>{p.status==="APPROVED"?"Approved":p.status==="REJECTED"?"Rejected":p.status==="PROPOSED"?"Pending review":p.status.replaceAll("_"," ")}<div>{new Date(p.effectiveFromUtc).toLocaleDateString("en-IN")}{p.effectiveToUtc?" – "+new Date(p.effectiveToUtc).toLocaleDateString("en-IN"):" onward"}</div></td>
     </tr>)}</tbody></table></div>}
    <div className="toolbar"><button type="button" disabled={busy||uncertain||loading||priceLoading||priceFilter.current.offset===0} onClick={()=>filterPrices(priceFilter.current.status,Math.max(0,priceFilter.current.offset-100))}>Previous prices</button><button type="button" disabled={busy||uncertain||loading||priceLoading||nextPriceOffset===null} onClick={()=>{if(nextPriceOffset!==null)filterPrices(priceFilter.current.status,nextPriceOffset);}}>Next prices</button></div>
    {canManage&&<form onSubmit={propose}>
     <h4>Propose a commercial price</h4>
     <div className="form-grid">
      <label className="field">Mapped test<select required value={mappingRef}
       onChange={e=>setMappingRef(e.target.value)}>
       <option value="">Select a mapped test</option>
       {mappings.filter(m=>m.status==="ACTIVE").map(m=>
        <option key={m.mappingRef} value={m.mappingRef}>{m.name} ({m.code})</option>)}
      </select></label>
      <label className="field">Base price (₹)<input required inputMode="decimal"
       value={base} onChange={e=>setBase(e.target.value)}/></label>
      <label className="field">Patient price (₹)<input required inputMode="decimal"
       value={patient} onChange={e=>setPatient(e.target.value)}/></label>
      <label className="field">Effective from<input required type="datetime-local"
       value={from} onChange={e=>setFrom(e.target.value)}/></label>
      <label className="field">Effective until (optional)<input type="datetime-local"
       value={to} onChange={e=>setTo(e.target.value)}/></label>
      <label className="field">Discount reason (optional)<input maxLength={240}
       value={reason} onChange={e=>setReason(e.target.value)}/></label>
     </div>
     <button type="submit" className="primary" disabled={busy||uncertain}>
      Propose price for Foundation review</button>
    </form>}
   </div>
  </div>
  <p className="cg-diagnostics-note">Lab ERP is separate and remains disabled by default. No patient specimen, clinical report or billing record is created here.</p>
 </section>;
}
