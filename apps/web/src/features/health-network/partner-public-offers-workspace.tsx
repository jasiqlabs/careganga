"use client";
import {useCallback,useEffect,useRef,useState} from "react";
type Offer={offerCode:string;serviceKind:"PHARMACY"|"NURSING"|"OT";
 name:string;description:string;indicativePriceMinor:string|null;status:string;
 guidance:string};
type Center={centerRef:string;centerName?:string;centerNameOther?:string;name?:string};
type Props={mode:"partner"|"foundation";centerRef?:string};
const kindOptions=["PHARMACY","NURSING","OT"] as const;
const money=(value:string|null)=>value===null?"Price on enquiry":
 "₹"+(Number(BigInt(value))/100).toLocaleString("en-IN",{
  minimumFractionDigits:2,maximumFractionDigits:2});
const paise=(v:string)=>{if(!v.trim())return null;
 const x=/^([1-9][0-9]{0,7})(?:\.([0-9]{1,2}))?$/.exec(v.trim());
 if(!x)throw Error("Enter a valid indicative price in rupees or leave it empty.");
 return (BigInt(x[1])*100n+BigInt((x[2]??"").padEnd(2,"0"))).toString();
};
async function req<T>(p:string,body?:object):Promise<T>{
 const res=await fetch("/api/health-network/partner-offers/"+p,{
  method:body?"POST":"GET",credentials:"same-origin",cache:"no-store",
  ...(body?{headers:{"Content-Type":"application/json"},
   body:JSON.stringify(body)}:{})});
 const v:unknown=await res.json().catch(()=>null);
 if(!res.ok)throw Error(v&&typeof v==="object"&&"message" in v&&
  typeof v.message==="string"?v.message:
  "The original approved partner offer could not be confirmed.");
 return v as T;
}
/** Minimal CG14 original offers: no prescription, billing, stock or ERP.
 * Each partner may propose, only a distinct protected Foundation officer
 * independently approves publication. UI never requests technical IDs.
 */
export function PartnerPublicOffersWorkspace({mode,centerRef}:Props){
 const [centers,setCenters]=useState<Center[]>([]);
 const [center,setCenter]=useState(centerRef??"");
 const [records,setRecords]=useState<Offer[]>([]);
 const [kind,setKind]=useState<"PHARMACY"|"NURSING"|"OT">("PHARMACY");
 const [name,setName]=useState(""),[description,setDescription]=useState("");
 const [price,setPrice]=useState(""),[reason,setReason]=useState("");
 const [password,setPassword]=useState("");
 const [busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const original=useRef<{hash:string;key:string}|null>(null);
 const load=useCallback(async(c:string)=>{
  if(!c){setRecords([]);return;}
  const p=mode==="partner"?"my-centers/"+encodeURIComponent(c):
   "foundation/centers/"+encodeURIComponent(c);
  const v=await req<{offers:Offer[]}>(p);
  if(!v||!Array.isArray(v.offers)||v.offers.length>50)
   throw Error("The original center's reviewed service offers are unavailable.");
  setRecords(v.offers);
 },[mode]);
 useEffect(()=>{setCenter(centerRef??"");},[centerRef]);
 useEffect(()=>{
  let active=true;if(centerRef)return;
  const p=mode==="partner"?"my-centers/eligible":"foundation/centers";
  void req<{centers:Center[]}>(p).then(x=>{
   if(!active)return;
   if(!Array.isArray(x.centers)||x.centers.length>50)
    throw Error("Verified center options are unavailable.");
   setCenters(x.centers);
   if(x.centers.length===1)setCenter(x.centers[0].centerRef);
  }).catch(e=>{if(active)setError(e instanceof Error?e.message:
   "Approved center list unavailable.");});
  return()=>{active=false;};
 },[centerRef,mode]);
 useEffect(()=>{let alive=true;setRecords([]);setError("");
  void load(center).catch(e=>{if(alive)setError(e instanceof Error?e.message:
   "Current approved offers are unavailable.");});
  return()=>{alive=false;};
 },[center,load]);
 function changed(fn:(v:string)=>void,value:string){
  if(busy||uncertain)return;
  fn(value);original.current=null;setNotice("");setError("");
 }
 async function refresh(){
  if(busy)return;setBusy(true);setError("");
  try{await load(center);setUncertain(false);}
  catch(e){setError(e instanceof Error?e.message:
   "Current source is unavailable.");}
  finally{setBusy(false);}
 }
 async function commit(action:"PROPOSE"|"APPROVE"|"REJECT"|"WITHDRAW",offer?:Offer){
  if(busy||uncertain||!center)return;
  setBusy(true);setError("");setNotice("");
  try{
   const payload=action==="PROPOSE"?
    {serviceKind:kind,name:name.trim(),description:description.trim(),
     indicativePriceMinor:paise(price)}:
    {action,reason:reason.trim(),currentPassword:password};
   if(action!=="PROPOSE"&&(reason.trim().length<12||password.length<8))
    throw Error("Explain the review decision and confirm your current password.");
   const digest=JSON.stringify([action,center,offer?.offerCode??"",payload]);
   if(original.current?.hash!==digest)
    original.current={hash:digest,key:crypto.randomUUID()};
   const path=action==="PROPOSE"?"my-centers/"+encodeURIComponent(center):
    "foundation/centers/"+encodeURIComponent(center)+"/offers/"+
    encodeURIComponent(offer?.offerCode??"")+"/decision";
   const result=await req<Offer>(path,{...payload,requestKey:original.current.key});
   if(!result||typeof result.offerCode!=="string")
    throw Error("Original partner service result cannot be verified.");
   original.current=null;setPassword("");
   await load(center);setUncertain(false);
   setNotice(action==="PROPOSE"?
    "Partner listing submitted for independent Foundation review; not public yet.":
    "Independent protected publication decision recorded.");
  }catch(e){setUncertain(true);
   setError(e instanceof Error?e.message:
    "Original action result is uncertain. Check the saved service before retrying.");
  }finally{setBusy(false);}
 }
 return <section className="cg-diagnostics-card" aria-label="Partner service information">
  <h3>{mode==="partner"?"My medicine, nursing and procedure information":
   "Approve partner medicine, nursing and procedure listings"}</h3>
  <p>Basic indicative service names and prices only. No inventory, prescribing,
   stock, theatre management, booking, actual invoice or automatic discount.</p>
  {!centerRef?<label>Verified center
   <select disabled={busy||uncertain} value={center}
    onChange={e=>{setCenter(e.target.value);original.current=null;}}>
    <option value="">Choose a verified center</option>
    {centers.map(c=><option key={c.centerRef} value={c.centerRef}>
     {c.centerName??c.name??"Verified center"}</option>)}
   </select>
  </label>:null}
  {!!error&&<p role="alert" className="notice error">{error}</p>}
  {!!notice&&<p role="status" className="notice">{notice}</p>}
  {center&&<button type="button" disabled={busy}
   onClick={()=>void refresh()}>Refresh original offers</button>}
  {mode==="partner"&&!!center&&!uncertain&&<div className="form-grid">
   <label>Category
    <select value={kind} disabled={busy} onChange={e=>{if(!busy&&!uncertain){setKind(e.target.value as typeof kind);
     original.current=null;setNotice("");setError("");}}}>
     {kindOptions.map(k=><option key={k} value={k}>{k==="OT"?"Procedure / OT":k}</option>)}
    </select></label>
   <label>Medicine or service name
    <input value={name} maxLength={120} disabled={busy}
     onChange={e=>changed(setName,e.target.value)}/></label>
   <label>Description (optional)
    <textarea value={description} maxLength={500} disabled={busy}
     onChange={e=>changed(setDescription,e.target.value)}/></label>
   <label>Indicative price in ₹ (optional)
    <input inputMode="decimal" value={price} maxLength={13}
     disabled={busy} onChange={e=>changed(setPrice,e.target.value)}/></label>
   <button type="button" disabled={busy||name.trim().length<3}
    onClick={()=>void commit("PROPOSE")}>Submit information for Foundation approval</button>
  </div>}
  {mode==="foundation"&&!!center&&!uncertain&&<div className="form-grid">
   <label>Independent review reason
    <textarea value={reason} maxLength={500} disabled={busy}
     onChange={e=>changed(setReason,e.target.value)}
     placeholder="Review original medicine or service and indicative price"/></label>
   <label>Current protected Foundation password
    <input type="password" autoComplete="current-password" value={password}
     disabled={busy} onChange={e=>changed(setPassword,e.target.value)}/></label>
  </div>}
  {!!center&&records.length===0&&<p>No partner information has been submitted.</p>}
  {records.map(row=><div className="notice" key={row.offerCode}>
   <strong>{row.name}</strong> · {row.serviceKind==="OT"?"Procedure":row.serviceKind}
   <p>{row.description} · {money(row.indicativePriceMinor)}
    {" · "+row.status.replaceAll("_"," ").toLowerCase()}</p>
   {mode==="foundation"&&<>
    {row.status==="PENDING_REVIEW"&&<div className="toolbar">
     <button type="button" disabled={busy||uncertain||password.length<8||
      reason.trim().length<12} onClick={()=>void commit("APPROVE",row)}>
      Approve and publish</button>
     <button type="button" disabled={busy||uncertain||password.length<8||
      reason.trim().length<12} onClick={()=>void commit("REJECT",row)}>
      Reject unsupported information</button>
    </div>}
    {row.status==="APPROVED"&&<button type="button"
     disabled={busy||uncertain||password.length<8||reason.trim().length<12}
     onClick={()=>void commit("WITHDRAW",row)}>Withdraw published information</button>}
   </>}
  </div>)}
  {uncertain&&<p role="alert">The previous change may have succeeded.
   Refresh original status before submitting any new request.</p>}
 </section>;
}
