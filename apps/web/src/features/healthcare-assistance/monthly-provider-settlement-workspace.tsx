"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {VerifiedProviderPayoutPanel} from "./verified-provider-payout-panel";
type Center={centerRef:string;name:string};
type Summary={month:string;state:string;settlementRef?:string;revision?:number;
 postedLiabilities?:number;eligibleAccruedMinor?:string;proposedClaimMinor?:string;
 approvedFoundationMinor:string;actualPaidMinor:string;
 centerGrossServicesMinor?:string;patientPayableMinor?:string;
 patientCollectedVerifiedMinor?:string;patientRefundedMinor?:string;
 partnerPatientCollectedAttestedMinor?:string;
 foundationApprovedLiabilityMinor?:string;
 originalApprovedFoundationMinor?:string;
 effectiveState?:string;originalClaimState?:string;adjustedFoundationMinor?:string;
 grossFoundationPaidMinor?:string;verifiedProviderRecoveryMinor?:string;
 collectionsScope?:"VERIFIED_TO_DATE_FOR_COMPLETED_SERVICES";
 outstandingMinor:string;currency?:string;independentlyApproved?:boolean;
 paidVerified:boolean;patientCollectionNotFoundationIncome:true};
type Props={canPropose:boolean;canReview:boolean;canPay:boolean};
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const MONTH=/^20[2-9]\d-(0[1-9]|1[0-2])$/;
const money=(v:string|undefined)=>typeof v==="string"&&/^-?\d+$/.test(v)&&Number.isSafeInteger(Number(v))?new Intl.NumberFormat("en-IN",{
 style:"currency",currency:"INR",maximumFractionDigits:2}).format(Number(v)/100):"Not available";
const root="/api/healthcare-assistance/provider-settlements/";
async function api<T>(path:string,body?:object):Promise<T>{
 const reply=await fetch(root+path,{credentials:"same-origin",cache:"no-store",
  method:body?"POST":"GET",...(body?{
   headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})});
 const data:unknown=await reply.json().catch(()=>null);
 if(!reply.ok)throw Object.assign(new Error(data&&typeof data==="object"&&
  "message" in data&&typeof data.message==="string"?data.message:
  "Original settlement claim source unavailable."),{status:reply.status});
 if(!data||typeof data!=="object"||Array.isArray(data))
  throw Error("Original monthly source was not verified.");
 return data as T;
}
function verified(x:Summary){
 return typeof x.month==="string"&&typeof x.state==="string"&&
  typeof x.approvedFoundationMinor==="string"&&
  typeof x.actualPaidMinor==="string"&&
  typeof x.outstandingMinor==="string"&&typeof x.paidVerified==="boolean"&&
  x.patientCollectionNotFoundationIncome===true;
}
/** Uses CG14/CG15/CG17/CG09 originals. Nothing here executes a bank transfer.
 * Approval is explicitly independent from proposal and later actual payout.
 */
export function MonthlyProviderSettlementWorkspace({canPropose,canReview,canPay}:Props){
 const [centers,setCenters]=useState<Center[]>([]);
 const [center,setCenter]=useState(""),[month,setMonth]=useState("");
 const [data,setData]=useState<Summary|null>(null);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [uncertain,setUncertain]=useState(false);
 const attempt=useRef<{kind:"propose"|"review";center:string;month:string;
  key:string;revision:number}|null>(null);
 const revision=useRef(0);
 useEffect(()=>{
  let live=true;
  void api<{centers:Center[]}>("centers/eligible").then(v=>{
   if(!live)return;
   if(!Array.isArray(v.centers)||v.centers.length>50)
    throw Error("Original verified center options are unavailable.");
   setCenters(v.centers.filter(x=>ID.test(x.centerRef)&&x.name));
   if(v.centers.length===1)setCenter(v.centers[0].centerRef);
  }).catch(e=>{if(live)setError(e instanceof Error?e.message:
   "Foundation centers unavailable.")})
   .finally(()=>{if(live)setLoading(false)});
  return()=>{live=false};
 },[]);
 const load=useCallback(async(c:string,m:string)=>{
  if(!ID.test(c)||!MONTH.test(m))
   throw Error("Select a verified healthcare center and calendar month.");
  const v=await api<Summary>("centers/"+c+"/months/"+m);
  if(!verified(v)||v.month!==m)throw Error("Original monthly posting status is incomplete.");
  return v;
 },[]);
 useEffect(()=>{
  const nonce=++revision.current;
  setData(null);setError("");setNotice("");setUncertain(false);
  attempt.current=null;
  if(!ID.test(center)||!MONTH.test(month)){setLoading(false);return;}
  setLoading(true);
  void load(center,month).then(v=>{
   if(nonce===revision.current)setData(v);
  }).catch(e=>{if(nonce===revision.current)
   setError(e instanceof Error?e.message:"Original settlement unavailable.");})
   .finally(()=>{if(nonce===revision.current)setLoading(false)});
 },[center,month,load]);
 async function refresh(){
  if(busy||!ID.test(center)||!MONTH.test(month))return;
  setBusy(true);setError("");setNotice("");
  try{
   const v=await load(center,month);setData(v);setUncertain(false);
   if(v.state!=="NOT_PREPARED")attempt.current=null;
  }catch(e){setUncertain(true);setError(e instanceof Error?e.message:"Original claim unavailable.");}
  finally{setBusy(false);}
 }
 async function execute(kind:"propose"|"review"){
  if(busy||!data||uncertain||!ID.test(center)||!MONTH.test(month))return;
  if(kind==="propose"&&(!canPropose||data.state!=="NOT_PREPARED"||
    !data.postedLiabilities))return;
  if(kind==="review"&&(!canReview||data.state!=="PROPOSED"||
    !Number.isSafeInteger(data.revision)))return;
  const prompt=kind==="review"?
   "Independently approve this source-backed Foundation provider claim? "+
   "This does not send money or mark a bank transfer as paid.":
   "Prepare an original monthly claim only from already recorded "+
   "Foundation obligations? No patient money will be collected.";
  if(!window.confirm(prompt))return;
  const expectedRevision=kind==="review"?data.revision!:1;
  if(!attempt.current||attempt.current.kind!==kind||
   attempt.current.center!==center||attempt.current.month!==month)
   attempt.current={kind,center,month,key:crypto.randomUUID(),
    revision:expectedRevision};
  setBusy(true);setError("");setNotice("");
  try{
   const payload=kind==="review"?
    {requestKey:attempt.current.key,expectedRevision:attempt.current.revision}:
    {requestKey:attempt.current.key};
   const v=await api<Summary>("centers/"+center+"/months/"+month+"/"+
    (kind==="review"?"review":"propose"),payload);
   if(!verified(v)||v.state!==(kind==="review"?"APPROVED":"PROPOSED"))
    throw Error("The original claim outcome could not be confirmed.");
   setData(v);setUncertain(false);attempt.current=null;
   try{setData(await load(center,month));}catch{/* Original mutation confirmed; UI can refresh later. */}
   setNotice(kind==="review"?
    "Independent monthly claim approval recorded. No provider bank payment has occurred.":
    "Source-backed monthly claim prepared. Independent approval is required.");
  }catch(e){
   const status=e&&typeof e==="object"&&"status" in e&&
    typeof e.status==="number"?e.status:503;
   setUncertain(status>=500);
   if(status<500)attempt.current=null;
   setError(e instanceof Error?e.message:
    "Original settlement claim outcome uncertain. Refresh before retrying.");
  }finally{setBusy(false);}
 }
 return <section className="form-section" aria-label="Monthly Foundation provider settlements">
  <h1>Healthcare Provider Settlements</h1>
  <p>These claims use approved completed services and the original posted
   Foundation accounting obligations. Center-collected patient money is never
   Foundation income. A reviewed claim does not prove provider payment.</p>
  {loading&&<p role="status">Checking original monthly sources…</p>}
  {!!error&&<p role="alert" className="notice error">{error}</p>}
  {!!notice&&<p role="status" className="notice">{notice}</p>}
  <label className="field">Verified healthcare center
   <select value={center} disabled={busy||uncertain} onChange={e=>setCenter(e.target.value)}>
    <option value="">Select a center</option>
    {centers.map(c=><option key={c.centerRef} value={c.centerRef}>{c.name}</option>)}
   </select>
  </label>
  <label className="field">Original liability month
   <input type="month" min="2020-01" value={month} disabled={busy||uncertain}
    onChange={e=>setMonth(e.target.value)}/>
  </label>
  {data&&<section className="cg-diagnostics-card">
   <h2>Settlement overview — {data.month}</h2>
   <div className="cg-health-kpi-grid" aria-label="Source-backed settlement totals">
    <div className="cg-diagnostics-card"><span>Verified patient collections</span><h3>{data.collectionsScope==="VERIFIED_TO_DATE_FOR_COMPLETED_SERVICES"?money(data.patientCollectedVerifiedMinor):"Not available"}</h3></div>
    <div className="cg-diagnostics-card"><span>Foundation claim status</span><h3>{(data.effectiveState??data.state).replaceAll("_"," ")}</h3></div>
    <div className="cg-diagnostics-card"><span>Verified provider payout</span><h3>{money(data.actualPaidMinor)}</h3></div>
    <div className="cg-diagnostics-card"><span>Outstanding approved claim</span><h3>{["APPROVED","PARTIALLY_SETTLED","SETTLED"].includes(data.state)?money(data.outstandingMinor):"Not yet approved"}</h3></div>
   </div>
   {data.collectionsScope==="VERIFIED_TO_DATE_FOR_COMPLETED_SERVICES"&&
    data.centerGrossServicesMinor!==undefined&&<section
     aria-label="Original H17 service and contribution breakdown">
     <h3>Completed eligible services in this month</h3>
     <dl>
      <dt>Eligible center gross service value</dt>
      <dd>{money(data.centerGrossServicesMinor)}</dd>
      <dt>Patient due from eligible original charges</dt>
      <dd>{money(data.patientPayableMinor)}</dd>
      <dt>Center patient collections verified to date for these services</dt>
      <dd>{money(data.patientCollectedVerifiedMinor)}</dd>
      <dt>Partner-attested patient collections for approved pharmacy/nursing/OT</dt>
      <dd>{money(data.partnerPatientCollectedAttestedMinor)}</dd>
      <dt>Center patient refunds/corrections to date</dt>
      <dd>{money(data.patientRefundedMinor)}</dd>
      <dt>Original approved Foundation liability</dt>
      <dd>{money(data.foundationApprovedLiabilityMinor)}</dd>
     </dl>
     <p>Actual center receipts are verified money received by the
      center, not Foundation income. Collections and refunds can occur
      after the original service month.</p>
    </section>}
   <dl>
    <dt>Original monthly claim</dt><dd>{data.state.replaceAll("_"," ")}</dd>
    {data.effectiveState&&data.effectiveState!==data.state&&<>
     <dt>Current verified payable status</dt>
     <dd>{data.effectiveState.replaceAll("_"," ")}</dd></>}
    <dt>{data.state==="NOT_PREPARED"?"Eligible posted liabilities":
     data.state==="PROPOSED"?"Prepared claim awaiting independent approval":
     "Approved monthly Foundation claim"}</dt>
    <dd>{money(data.state==="NOT_PREPARED"?data.eligibleAccruedMinor:
     data.state==="PROPOSED"?data.proposedClaimMinor:
     data.approvedFoundationMinor)}</dd>
    {data.adjustedFoundationMinor&&BigInt(data.adjustedFoundationMinor)>0n&&<>
     <dt>Historical original approved claim</dt>
     <dd>{money(data.originalApprovedFoundationMinor)}</dd>
     <dt>Verified Foundation liability corrections</dt>
     <dd>{money(data.adjustedFoundationMinor)}</dd>
     <dt>Original gross bank payout</dt>
     <dd>{money(data.grossFoundationPaidMinor)}</dd>
     <dt>Actual verified returned bank money</dt>
     <dd>{money(data.verifiedProviderRecoveryMinor)}</dd>
    </>}
    <dt>Verified actual provider payout</dt>
    <dd>{money(data.actualPaidMinor)}</dd>
    <dt>Outstanding approved claim</dt>
    <dd>{["APPROVED","PARTIALLY_SETTLED","SETTLED"].includes(data.state)?
     money(data.outstandingMinor):"Not yet approved"}</dd>
   </dl>
   <p>Patient collection is excluded. Provider payment remains unverified
    unless a separate verified bank reconciliation confirms it.</p>
   {data.state==="NOT_PREPARED"&&canPropose&&
    <button type="button" className="primary" disabled={busy||uncertain||
     !data.postedLiabilities} onClick={()=>void execute("propose")}>
     Prepare source-backed monthly claim</button>}
   {data.state==="PROPOSED"&&canReview&&
    <button type="button" className="primary" disabled={busy||uncertain}
     onClick={()=>void execute("review")}>
     Independently approve original claim</button>}
   {canPay&&!uncertain&&["APPROVED","PARTIALLY_SETTLED"].includes(data.state)&&
    <VerifiedProviderPayoutPanel key={data.settlementRef}
     centerRef={center} month={month} onApplied={refresh}/>}
   {uncertain&&<p role="alert">
    The last outcome may have succeeded. Refresh the original claim before retrying
    rather than creating a different request.</p>}
   <button type="button" disabled={busy} onClick={()=>void refresh()}>
    {busy?"Checking…":"Refresh original monthly status"}</button>
  </section>}
 </section>;
}
