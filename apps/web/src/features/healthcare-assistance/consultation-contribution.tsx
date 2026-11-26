"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {CenterCollectionWorkspace} from "./center-collection-workspace";
import {PatientCenterCollectionSummary} from "./patient-center-collection-summary";
import {CenterMerchantCheckout} from "./center-merchant-checkout";
type Contribution={state:string;accepted?:boolean;replayed?:boolean;
 chargeRef?:string;
 bookingRef?:string;holdRef?:string;expiresAt?:string;
 grossMinor?:string;foundationSupportMinor?:string;patientPayableMinor?:string;
 feeVersion?:number;sourceVersion?:number;policyRevisionRef?:string|null;currency?:string;
 collectionVerified?:boolean;foundationLiabilityCreated?:boolean;
 patientCollectionVerified?:boolean;message?:string};
type Props={holdRef?:string;bookingRef?:string;centerRef?:string;
 canAccept?:boolean;canViewCollections?:boolean;
 canRecordCollections?:boolean;canRefundCollections?:boolean};
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const pretty=(s:string)=>"₹"+(Number(s)/100).toLocaleString("en-IN",{
 minimumFractionDigits:2,maximumFractionDigits:2});
function valid(v:Contribution){
 return /^(0|[1-9]\d{0,10})$/.test(v.grossMinor??"")&&
  /^(0|[1-9]\d{0,10})$/.test(v.foundationSupportMinor??"")&&
  /^(0|[1-9]\d{0,10})$/.test(v.patientPayableMinor??"")&&
  BigInt(v.grossMinor!)===BigInt(v.foundationSupportMinor!)+
   BigInt(v.patientPayableMinor!)&&v.currency==="INR";
}
/** Web patient/authorized center copy of original CG15 → CG17 pricing;
 * this does not verify collected payment, award a future liability or tax.
 */
export function ConsultationContribution({holdRef,bookingRef,centerRef,canAccept=true,
 canViewCollections=false,canRecordCollections=false,canRefundCollections=false}:Props){
 const [quote,setQuote]=useState<Contribution|null>(null);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [uncertain,setUncertain]=useState(false);
 const key=useRef<string|null>(null),seq=useRef(0);
 const authorized=!centerRef||ID.test(centerRef);
 const path=bookingRef&&ID.test(bookingRef)?
  (centerRef?"staff/centers/"+centerRef+"/appointments/"+
   bookingRef:"me/appointments/"+bookingRef):
  holdRef&&ID.test(holdRef)?
   (centerRef?"staff/centers/"+centerRef+"/holds/"+holdRef+
    "/quote":"me/holds/"+holdRef+"/quote"):"";
 const fetchSource=useCallback(async()=>{
  if(!path||!authorized)throw Error("Original consultation reference unavailable.");
  const response=await fetch("/api/healthcare-assistance/consultation-charges/"+path,{
   cache:"no-store",credentials:"same-origin"});
  if(!response.ok)throw Object.assign(new Error(response.status===401?
   "Sign in to view your private consultation contribution.":
   response.status===403?"You are not assigned to this consultation.":
   response.status===404?"This consultation is no longer available.":
   "Actual contribution amount cannot be verified."),
   {status:response.status});
  const raw:unknown=await response.json();
  if(!raw||typeof raw!=="object"||Array.isArray(raw))
   throw Error("Current consultation contribution unavailable.");
  const value=raw as Contribution;
  if(value.state!=="NOT_COLLECTIBLE"&&!valid(value))
   throw Error("Original fee split cannot be verified.");
  return value;
 },[path,authorized]);
 useEffect(()=>{
  let active=true;const n=++seq.current;
  setLoading(true);setQuote(null);setNotice("");setError("");
  setUncertain(false);key.current=null;
  void fetchSource().then(x=>{if(active&&n===seq.current)setQuote(x)})
   .catch(e=>{if(active&&n===seq.current)setError(e instanceof Error?e.message:
    "Original appointment contribution is unavailable.")})
   .finally(()=>{if(active&&n===seq.current)setLoading(false)});
  return()=>{active=false;++seq.current};
 },[fetchSource]);
 async function refresh(){
  setBusy(true);setError("");setNotice("");
  try{const next=await fetchSource();setQuote(next);setUncertain(false);
   if(next.accepted)key.current=null;
  }catch(e){setError(e instanceof Error?e.message:"Original amount unavailable.");}
  finally{setBusy(false)}
 }
 async function accept(){
  if(!bookingRef||!ID.test(bookingRef)||!quote||!valid(quote)||
    quote.accepted||busy||uncertain||
    !Number.isSafeInteger(quote.sourceVersion))return;
  setBusy(true);setError("");setNotice("");
  if(!key.current)key.current=crypto.randomUUID();
  const body={requestKey:key.current,grossMinor:quote.grossMinor!,
   supportMinor:quote.foundationSupportMinor!,
   dueMinor:quote.patientPayableMinor!,
   feeVersion:quote.feeVersion!,sourceVersion:quote.sourceVersion!,
   policyRevisionRef:quote.policyRevisionRef??null};
  try{
   const response=await fetch("/api/healthcare-assistance/consultation-charges/"+
    path+"/accept",{method:"POST",credentials:"same-origin",cache:"no-store",
     headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
   if(!response.ok){
    const status=response.status;
    throw Object.assign(new Error(status===409?
     "The original fee or support changed. Check current contribution before accepting.":
     status===403?"This account is not authorized to accept the consultation.":
     "The acceptance outcome is uncertain. Check original status."),
     {status});
   }
   const saved:unknown=await response.json();
   if(!saved||typeof saved!=="object"||!valid(saved as Contribution)||
     (saved as Contribution).accepted!==true)
    throw Error("The original accepted amount has not been confirmed.");
   setQuote(saved as Contribution);key.current=null;setUncertain(false);
   setNotice("Consultation contribution recorded. Patient payment remains "+
    "due at the center. No Foundation transfer has been made.");
  }catch(e){
   const status=e&&typeof e==="object"&&"status" in e&&
    typeof e.status==="number"?e.status:503;
   setUncertain(status>=500);setError(e instanceof Error?e.message:
    "Acceptance cannot be confirmed. Check original amount.");
  }finally{setBusy(false)}
 }
 if(!path||!authorized)return null;
 return <section className="form-section"
  aria-label="Original consultation contribution">
  <h3>Consultation contribution</h3>
  {loading&&<p role="status">Checking approved consultation fee and policy…</p>}
  {!!error&&<p role="alert">{error}</p>}
  {!!notice&&<p role="status">{notice}</p>}
  {quote&&quote.state==="NOT_COLLECTIBLE"?
   <p>This consultation is not eligible for a new payable contribution.</p>:
   quote&&valid(quote)&&<>
    <dl className="cg-diagnostics-summary cg-health-quote">
     <div><dt>Actual consultation fee</dt><dd>{pretty(quote.grossMinor!)}</dd></div>
     <div><dt>Applicable Foundation share</dt>
      <dd>{pretty(quote.foundationSupportMinor!)}</dd></div>
     <div className="cg-health-amount"><dt>Amount due from patient</dt>
      <dd>{pretty(quote.patientPayableMinor!)}</dd></div>
    </dl>
    <p>{quote.state==="NO_EFFECTIVE_ASSISTANCE"?
     "No approved support policy applies; full consultation fee remains due.":
     quote.state==="SERVICE_NO_SHOW_REVIEW_REQUIRED"?
     "Original accepted amount retained. The visit was not completed; center review is required before any financial follow-up.":
     quote.state==="SOURCE_CANCELLED"?
     "This historical split is retained, but the appointment was cancelled.":
     quote.state==="SOURCE_CHANGED_REVIEW_REQUIRED"?
     "Original amount retained. Appointment has changed; ask the center to review.":
     quote.accepted?
     "Accepted historical split. Actual patient collection has not been verified.":
     "Fee/policy quote only. Your booking and support are not yet financially accepted."}</p>
    <p>Only the approved consultation fee is shown. Tax is not estimated here.
     Payment and Foundation settlement are confirmed separately.</p>
    {canAccept&&!!bookingRef&&!quote.accepted&&
     !["SOURCE_CANCELLED","SERVICE_NO_SHOW_REVIEW_REQUIRED","SOURCE_CHANGED_REVIEW_REQUIRED"].includes(quote.state)&&
     <button type="button" disabled={busy||uncertain} onClick={()=>void accept()}>
      {busy?"Checking original amount…":"Accept verified fee and contribution split"}
     </button>}
   </>}
  {(!!bookingRef||uncertain)&&<button type="button" disabled={busy}
   onClick={()=>void refresh()}>
   {busy?"Checking…":"Check original contribution status"}
  </button>}
  {bookingRef&&quote?.accepted===true&&!!quote.chargeRef&&centerRef&&
   canViewCollections&&<CenterCollectionWorkspace key={quote.chargeRef}
    centerRef={centerRef} chargeRef={quote.chargeRef}
    canRecord={canRecordCollections} canRefund={canRefundCollections}/>}
  {bookingRef&&quote?.accepted===true&&!centerRef&&
   <PatientCenterCollectionSummary bookingRef={bookingRef}/>}
  {bookingRef&&quote?.accepted===true&&
   !["SOURCE_CANCELLED","SERVICE_NO_SHOW_REVIEW_REQUIRED",
    "SOURCE_CHANGED_REVIEW_REQUIRED"].includes(quote.state)&&
   <CenterMerchantCheckout key={bookingRef+":"+(centerRef??"patient")}
    bookingRef={bookingRef} centerRef={centerRef}
    canInitiate={!centerRef||canRecordCollections}/>}
  {uncertain&&<p role="alert">The previous acceptance may have succeeded.
   Check this same booking before attempting any new request. Retrying checks the same request without creating a new acceptance.</p>}
 </section>;
}
