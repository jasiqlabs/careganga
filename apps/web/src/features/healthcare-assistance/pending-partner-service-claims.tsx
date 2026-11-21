"use client";
import {useCallback,useEffect,useState} from "react";
type Claim={claimCode:string;serviceKind:string;invoiceNumber:string;
 serviceDate:string;quotedGrossMinor:string;estimatedFoundationMinor:string;
 estimatedPatientPayableMinor:string;state:"PENDING_VERIFICATION"};
type List={claims:Claim[];pendingCount:number;approvedFoundationMinor:"0";
 reimbursableFoundationMinor:"0";paidFoundationMinor:"0";
 foundationPaymentVerified:false;guidance:string};
type Props={centerRef:string;mode:"foundation"|"partner"};
const money=(minor:string)=>"₹"+(Number(BigInt(minor))/100).toLocaleString("en-IN",{
 minimumFractionDigits:2,maximumFractionDigits:2});
/** A quote/evidence intake register, not an approved settlement statement.
 * Visible to the real Foundation finance reviewer or current assigned center.
 */
export function PendingPartnerServiceClaims({centerRef,mode}:Props){
 const [data,setData]=useState<List|null>(null),[error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 const load=useCallback(async()=>{
  if(!centerRef){setData(null);return;}
  const response=await fetch(
   "/api/healthcare-assistance/partner-claims/"+mode+"/centers/"+
    encodeURIComponent(centerRef),{cache:"no-store",credentials:"same-origin"});
  if(!response.ok)throw Error(response.status===401?"Sign in to see your claims.":
   response.status===403||response.status===404?
   "This partner's private claim list is unavailable to your role.":
   "Current partner submissions could not be verified. Refresh.");
  const value:unknown=await response.json();
  if(!value||typeof value!=="object"||Array.isArray(value)||
   !("claims" in value)||!Array.isArray(value.claims)||
   !("foundationPaymentVerified" in value)||
   value.foundationPaymentVerified!==false)
   throw Error("The original partner claim status could not be confirmed.");
  return value as List;
 },[centerRef,mode]);
 useEffect(()=>{
  let alive=true;setError("");setData(null);
  void load().then(v=>{if(alive)setData(v??null);})
   .catch(e=>{if(alive)setError(e instanceof Error?e.message:
    "Pending partner claims are unavailable.");});
  return()=>{alive=false};
 },[load]);
 const refresh=async()=>{
  if(busy)return;setBusy(true);setError("");
  try{setData(await load()??null)}
  catch(e){setError(e instanceof Error?e.message:"Pending claims unavailable.");}
  finally{setBusy(false);}
 };
 if(!centerRef)return null;
 return <section className="cg-diagnostics-card"
  aria-label="Scanned partner service claims awaiting verification">
  <h3>Partner invoices awaiting verification</h3>
  <p>Patient-submitted pharmacy, nursing and procedure evidence is shown
   separately from the original approved Foundation payable and bank statement.
   A scanned invoice is not proof of payment or completed care.</p>
  {!!error&&<p role="alert" className="notice error">{error}</p>}
  <button type="button" disabled={busy} onClick={()=>void refresh()}>
   {busy?"Checking original claims…":"Refresh pending partner invoices"}</button>
  {data&&<><p role="status">{data.pendingCount} patient-submitted claims
   awaiting independent review. <strong>₹0 approved or paid</strong> from
   these pending submissions.</p>
   {data.claims.length===0?<p>No pending partner-service submissions.</p>:
    <div className="table-responsive"><table className="role-table">
     <thead><tr><th>Claim code</th><th>Service</th><th>Partner invoice</th>
      <th>Service date</th><th>Unverified quote</th>
      <th>Provisional Foundation share</th><th>Review status</th></tr></thead>
     <tbody>{data.claims.map(c=><tr key={c.claimCode}>
      <td>{c.claimCode}</td><td>{c.serviceKind}</td>
      <td>{c.invoiceNumber}</td><td>{c.serviceDate}</td>
      <td>{money(c.quotedGrossMinor)}</td>
      <td>{money(c.estimatedFoundationMinor)}</td>
      <td>Awaiting independent verification</td>
     </tr>)}</tbody>
    </table></div>}
   <p>{data.guidance}</p>
  </>}
 </section>;
}
