"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {PendingPartnerServiceClaims} from "./pending-partner-service-claims";

type Summary={
 month:string;state:string;
 eligibleAccruedMinor?:string;
 approvedFoundationMinor:string;actualPaidMinor:string;
 outstandingMinor:string;paidVerified:boolean;
 centerGrossServicesMinor?:string;patientPayableMinor?:string;
 patientCollectedVerifiedMinor?:string;patientRefundedMinor?:string;
 partnerPatientCollectedAttestedMinor?:string;
 foundationApprovedLiabilityMinor?:string;
 originalApprovedFoundationMinor?:string;
 effectiveState?:string;adjustedFoundationMinor?:string;
 grossFoundationPaidMinor?:string;verifiedProviderRecoveryMinor?:string;
 patientCollectionNotFoundationIncome:true
};
const monthNow=()=>{
 const date=new Date();
 return String(date.getFullYear())+"-"+String(date.getMonth()+1).padStart(2,"0");
};
const money=(value:string|undefined)=>{
 if(typeof value!=="string"||!/^-?[0-9]{1,14}$/.test(value))
  return "Not yet confirmed";
 const amt=BigInt(value),abs=amt<0n?-amt:amt;
 return (amt<0n?"−":"")+"₹"+(abs/100n).toLocaleString("en-IN")+"."+
  (abs%100n).toString().padStart(2,"0");
};
const MONTH=/^20[2-9]\d-(0[1-9]|1[0-2])$/;
type Props={centerRef:string};
/** CG14 restricts to assigned center, CG17 reads original CG09-posted
 * liability and payment ledger. Read-only: no invented payout or bank UI.
 */
export function CenterMonthlySettlementSummary({centerRef}:Props){
 const [month,setMonth]=useState(monthNow);
 const [data,setData]=useState<Summary|null>(null);
 const [loading,setLoading]=useState(true);
 const [exporting,setExporting]=useState(false);
 const [exportNotice,setExportNotice]=useState("");
 const [error,setError]=useState("");
 const requestVersion=useRef(0);
 const load=useCallback(async()=>{
  if(!MONTH.test(month))throw Error("Select a valid settlement month.");
  const response=await fetch(
   "/api/healthcare-assistance/provider-settlements/my-centers/"+
    encodeURIComponent(centerRef)+"/months/"+encodeURIComponent(month),{
    cache:"no-store",credentials:"same-origin"});
  if(!response.ok)throw Error(response.status===403?
   "Your account cannot view this center's Foundation contributions.":
   response.status===404?"Your assigned healthcare center is unavailable.":
   "The verified Foundation settlement statement is unavailable.");
  const body:unknown=await response.json();
  if(!body||typeof body!=="object"||Array.isArray(body)||
   !("approvedFoundationMinor" in body)||
   !("patientCollectionNotFoundationIncome" in body)||
   body.patientCollectionNotFoundationIncome!==true)
   throw Error("Original settlement statement could not be verified.");
  return body as Summary;
 },[centerRef,month]);
 useEffect(()=>{
  const version=++requestVersion.current;
  setLoading(true);setError("");setData(null);
  void load().then(result=>{
   if(version===requestVersion.current)setData(result);
  }).catch(e=>{
   if(version===requestVersion.current)
    setError(e instanceof Error?e.message:
     "Your center's settlement status could not be verified.");
  }).finally(()=>{
   if(version===requestVersion.current)setLoading(false);
  });
  return()=>{requestVersion.current++};
 },[load]);
 // Browser visibility is not an authorization grant. Old CG17 monetary
 // data must be discarded while hidden and rechecked after returning.
 useEffect(()=>{
  const recheck=()=>{
   const version=++requestVersion.current;
   setData(null);
   if(document.visibilityState!=="visible"){
    setLoading(false);return;
   }
   setLoading(true);setError("");
   void load().then(result=>{
    if(version===requestVersion.current)setData(result);
   }).catch(error=>{
    if(version===requestVersion.current)setError(error instanceof Error?
     error.message:"Current center settlement access could not be verified.");
   }).finally(()=>{
    if(version===requestVersion.current)setLoading(false);
   });
  };
  document.addEventListener("visibilitychange",recheck);
  return()=>document.removeEventListener("visibilitychange",recheck);
 },[load]);
 async function exportCurrentStatement(){
  if(loading||exporting||!data||!MONTH.test(month))return;
  setExporting(true);setExportNotice("");
  try{
   // The server rechecks the ORIGINAL CG14 current center and CG17 monthly
   // statement on every download; a displayed Web summary never grants bytes.
   const response=await fetch(
    "/api/healthcare-assistance/provider-settlements/my-centers/"+
    encodeURIComponent(centerRef)+"/months/"+encodeURIComponent(month)+
    "/export.csv",{cache:"no-store",credentials:"same-origin"});
   if(!response.ok||response.headers.get("content-type")?.split(";")[0]!=="text/csv")
    throw Error("Your current center statement cannot be exported. Refresh your permissions.");
   const bytes=await response.arrayBuffer();
   if(bytes.byteLength<30||bytes.byteLength>65536)
    throw Error("Your protected center statement file could not be verified.");
   const blob=new Blob([bytes],{type:"text/csv;charset=utf-8"});
   const url=URL.createObjectURL(blob);
   try{
    const link=document.createElement("a");
    link.href=url;link.download="CareGanga-Center-Settlement-"+month+".csv";
    document.body.append(link);link.click();link.remove();
    setExportNotice("The current verified center statement is ready in your downloads.");
   }finally{window.setTimeout(()=>URL.revokeObjectURL(url),1000);}
  }catch(e){setExportNotice(e instanceof Error?e.message:
   "This center statement could not be verified for export.");
  }finally{setExporting(false);}
 }
 const approved=data&&["APPROVED","PARTIALLY_SETTLED","SETTLED"].includes(data.state);
 return <section className="cg-health-route-intro" aria-label="My Foundation settlement">
  <h3>My Foundation contribution and settlement</h3>
  <p>Only amounts for this approved healthcare center are shown.
   Patient payments belong to the center, not to the Foundation.</p>
  <div className="toolbar">
   <label htmlFor={"center-settlement-month-"+centerRef}>Settlement month</label>
   <input id={"center-settlement-month-"+centerRef} type="month"
    min="2020-01" max={monthNow()} value={month}
    onChange={e=>setMonth(e.target.value)}/>
   <button type="button" disabled={loading}
    onClick={()=>{
     const version=++requestVersion.current;
     setLoading(true);setData(null);setError("");
     void load().then(result=>{
      if(version===requestVersion.current)setData(result);
     }).catch(e=>{
      if(version===requestVersion.current)
       setError(e instanceof Error?e.message:"Unable to refresh.");
     }).finally(()=>{
      if(version===requestVersion.current)setLoading(false);
     });
    }}>Refresh statement</button>
  </div>
  {!!data&&<button type="button" disabled={loading||exporting}
   onClick={()=>void exportCurrentStatement()}>
   {exporting?"Verifying current center statement…":"Export my center statement (CSV)"}
  </button>}
  {!!exportNotice&&<p role="status">{exportNotice}</p>}
  {loading&&<p role="status">Checking original completed services…</p>}
  {!!error&&<p role="alert">{error}</p>}
  {data&&<div>
   <p role="status">Foundation settlement: <strong>{data.state==="NOT_PREPARED"?
    "Monthly claim not yet prepared":(data.effectiveState??data.state).replaceAll("_"," ")}</strong></p>
   {data.effectiveState&&data.effectiveState!==data.state&&
    <p>Original recorded claim state: {data.state.replaceAll("_"," ")}.</p>}
   <dl>
    <dt>Eligible completed healthcare-service value (gross)</dt>
    <dd>{money(data.centerGrossServicesMinor)}</dd>
    <dt>Patient due for these eligible services</dt>
    <dd>{money(data.patientPayableMinor)}</dd>
    <dt>Verified center collections (net of recorded refunds)</dt>
    <dd>{money(data.patientCollectedVerifiedMinor)}</dd>
    <dt>Partner-attested patient collections for approved pharmacy/nursing/OT services</dt>
    <dd>{money(data.partnerPatientCollectedAttestedMinor)}</dd>
    <dt>Verified center refunds/corrections to date</dt>
    <dd>{money(data.patientRefundedMinor)}</dd>
    <dt>Foundation liability from completed eligible services</dt>
    <dd>{money(data.foundationApprovedLiabilityMinor)}</dd>
    {approved?<><dt>Approved monthly Foundation claim</dt>
     <dd>{money(data.approvedFoundationMinor)}</dd>
     {data.adjustedFoundationMinor&&/^[0-9]{1,14}$/.test(data.adjustedFoundationMinor)&&
     BigInt(data.adjustedFoundationMinor)>0n&&<>
      <dt>Original Foundation claim before correction</dt>
      <dd>{money(data.originalApprovedFoundationMinor)}</dd>
      <dt>Verified original claim adjustments</dt>
      <dd>{money(data.adjustedFoundationMinor)}</dd>
      <dt>Original gross bank payout</dt>
      <dd>{money(data.grossFoundationPaidMinor)}</dd>
      <dt>Verified provider money returned to Foundation</dt>
      <dd>{money(data.verifiedProviderRecoveryMinor)}</dd>
     </>}
     <dt>Verified Foundation payout to partner</dt>
     <dd>{money(data.actualPaidMinor)}</dd>
     <dt>Foundation payout outstanding</dt>
     <dd>{money(data.outstandingMinor)}</dd></>:
     <><dt>{data.state==="PROPOSED"?
       "Proposed Foundation claim (not approved)":
       "Posted Foundation accrual before monthly claim"}</dt>
       <dd>{money(data.eligibleAccruedMinor)}</dd></>}
   </dl>
   <p>{approved?
    "Only independently reconciled bank payments count as paid.":
    data?.state==="PROPOSED"?
    "A monthly claim has been prepared but is awaiting independent Foundation approval.":
    "The Foundation has not yet prepared a monthly payout claim for this period."}</p>
  </div>}
  <PendingPartnerServiceClaims centerRef={centerRef} mode="partner"/>
 </section>;
}
