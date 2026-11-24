"use client";
import {useCallback,useEffect,useState} from "react";
type Actual={state:string;patientDueMinor?:string;collectedMinor?:string;
 outstandingMinor?:string;pendingElectronicMinor?:string;
 refundedOrCorrectedMinor?:string;currency?:string;
 outstandingSince?:string|null;outstandingAgeDays?:number;
 foundationIncomeRecorded?:boolean;foundationLiabilityCreated?:boolean;
 collections?:Array<{collectionRef:string;method:string;state:string;
 receiptPdfState:string}>};
const amount=(v:unknown)=>typeof v==="string"&&
 /^(0|[1-9]\d{0,10})$/.test(v)&&Number.isSafeInteger(Number(v));
const valid=(v:unknown):v is Actual=>{
 if(!v||typeof v!=="object"||Array.isArray(v))return false;
 const x=v as Actual;
 if(x.state==="NO_ACCEPTED_CHARGE")return true;
 return ["patientDueMinor","collectedMinor","outstandingMinor",
  "pendingElectronicMinor","refundedOrCorrectedMinor"].every(k=>
    amount(x[k as keyof Actual]))&&x.currency==="INR"&&
    BigInt(x.patientDueMinor!)===BigInt(x.collectedMinor!)+
     BigInt(x.outstandingMinor!)&&x.foundationIncomeRecorded===false&&
     x.foundationLiabilityCreated===false;
};
const money=(v:string)=>new Intl.NumberFormat("en-IN",{
 style:"currency",currency:"INR",maximumFractionDigits:2}).format(Number(v)/100);
/** Patient self-view: original CG15 authorization in CG17 backend, no staff
 * collection or Foundation account source. Never implies pending=received.
 */
export function PatientCenterCollectionSummary({bookingRef}:{bookingRef:string}){
 const [data,setData]=useState<Actual|null>(null),[error,setError]=useState("");
 const [checking,setChecking]=useState(true);
 const refresh=useCallback(async()=>{
  const res=await fetch("/api/healthcare-assistance/center-collections/me/appointments/"+
   bookingRef,{credentials:"same-origin",cache:"no-store"});
  if(!res.ok)throw Error(res.status===401?
   "Sign in to see your private payment balance.":
   "Your actual verified center payment status cannot be checked.");
  const original:unknown=await res.json();
  if(!valid(original))throw Error("Actual patient balance is unavailable.");
  return original;
 },[bookingRef]);
 useEffect(()=>{
  let active=true;setChecking(true);setData(null);setError("");
  void refresh().then(v=>{if(active)setData(v)}).catch(e=>{
   if(active)setError(e instanceof Error?e.message:"Payment status unavailable");
  }).finally(()=>{if(active)setChecking(false)});
  return()=>{active=false};
 },[refresh]);
 if(!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(bookingRef))
  return null;
 return <section className="cg-diagnostics-card"
  aria-label="Verified patient payment status">
  <h4>Payment recorded at your healthcare center</h4>
  {checking&&<p role="status">Checking the actual center receipt history…</p>}
  {!!error&&<p role="alert">{error}</p>}
  {data&&data.state==="NO_ACCEPTED_CHARGE"&&
   <p>No original contribution has been accepted yet.</p>}
  {data&&data.state!=="NO_ACCEPTED_CHARGE"&&
   <dl className="cg-diagnostics-summary">
    <div><dt>Patient amount</dt><dd>{money(data.patientDueMinor!)}</dd></div>
    <div><dt>Verified center received</dt><dd>{money(data.collectedMinor!)}</dd></div>
    <div className="cg-health-amount"><dt>Still due</dt><dd>{money(data.outstandingMinor!)}</dd></div>
    <div><dt>Electronic verification pending (not paid)</dt>
     <dd>{money(data.pendingElectronicMinor!)}</dd></div>
   </dl>}
  {data?.collections?.some(c=>c.method==="CASH"&&c.state==="VERIFIED_CASH"&&
   c.receiptPdfState==="ISSUED")&&<section>
   <h5>Issued private center cash receipts</h5>
   {data.collections.filter(c=>c.method==="CASH"&&
    c.state==="VERIFIED_CASH"&&c.receiptPdfState==="ISSUED").map((c,i)=>
    <p key={c.collectionRef}><a href={
     "/api/healthcare-assistance/center-receipts/me/appointments/"+
     bookingRef+"/collections/"+c.collectionRef+"/pdf"}>
     Download cash receipt {i+1}</a></p>)}
  </section>}
  {!checking&&!error&&data?.collections?.filter(c=>c.state==="VERIFIED_PROVIDER"&&["UPI","CARD","BANK"].includes(c.method)&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(c.collectionRef)).map((c,i)=><p key={c.collectionRef}><a href={"/api/healthcare-assistance/center-receipts/me/appointments/"+bookingRef+"/collections/"+c.collectionRef+"/online-pdf"}>Download verified online payment confirmation {i+1} (two copies)</a></p>)}
  {data?.outstandingSince&&<p>Outstanding since accepted charge on {
   new Date(data.outstandingSince).toLocaleDateString("en-IN")}.
   No late charge is assumed.</p>}
  <p>Only verified center collections are counted. An entered UPI/card
   reference does not confirm payment; Foundation assistance is separate.</p>
  <button type="button" disabled={checking}
   onClick={()=>{setChecking(true);setError("");void refresh().then(setData)
    .catch(e=>setError(e instanceof Error?e.message:"Status unavailable."))
    .finally(()=>setChecking(false));}}>
   {checking?"Checking original…":"Refresh my payment status"}</button>
 </section>;
}
