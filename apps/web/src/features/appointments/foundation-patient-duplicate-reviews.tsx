"use client";
import {useCallback,useEffect,useRef,useState} from "react";
type Review={reviewRef:string;status:"PENDING"|"APPROVED"|"REJECTED";version:number;
 sourceVirtualPatientId:string;canonicalVirtualPatientId:string;
 proposedByCurrentAccount:boolean;proposedAt:string;decidedAt:string|null};
type List={items:Review[];limit:number;message:string};
const VIRTUAL=/^CGP-[A-F0-9]{16}$/;
const endpoint="/api/appointments/admin/patients/duplicate-reviews";
async function source<T>(path:string,method:"GET"|"POST"="GET",payload?:object):Promise<T>{
 const response=await fetch(path,{method,cache:"no-store",credentials:"same-origin",
  ...(payload?{headers:{"Content-Type":"application/json"},
   body:JSON.stringify(payload)}:{})});
 const raw:unknown=await response.json().catch(()=>null);
 if(!response.ok)throw Error(raw&&typeof raw==="object"&&"message" in raw&&
  typeof raw.message==="string"?raw.message:
  "This protected review could not be confirmed. Check its current status.");
 return raw as T;
}
export function FoundationPatientDuplicateReviews(){
 const [rows,setRows]=useState<Review[]>([]);
 const [sourceDisplay,setSourceDisplay]=useState("");
 const [canonicalDisplay,setCanonicalDisplay]=useState("");
 const [confirmed,setConfirmed]=useState(false);
 const [selected,setSelected]=useState("");
 const [password,setPassword]=useState("");
 const [evidenceReviewed,setEvidenceReviewed]=useState(false);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [uncertain,setUncertain]=useState(false);
 const request=useRef<{signature:string;key:string}|null>(null);
 const refresh=useCallback(async()=>{
  const result=await source<List>(endpoint);
  setRows(result.items);
  setUncertain(false);
  return result;
 },[]);
 useEffect(()=>{
  let live=true;
  void refresh().catch(e=>{if(live)setError(e instanceof Error?e.message:
   "Current duplicate review inbox cannot be checked.");})
   .finally(()=>{if(live)setLoading(false);});
  return()=>{live=false;};
 },[refresh]);
 async function propose(){
  if(busy||uncertain||!confirmed||!VIRTUAL.test(sourceDisplay)||
   !VIRTUAL.test(canonicalDisplay)||sourceDisplay===canonicalDisplay)return;
  setBusy(true);setError("");setNotice("");
  const signature=sourceDisplay+"|"+canonicalDisplay;
  if(request.current?.signature!==signature)
   request.current={signature,key:crypto.randomUUID()};
  try{
   const result=await source<{status:string}>(endpoint,"POST",{
    requestKey:request.current.key,sourceVirtualPatientId:sourceDisplay,
    canonicalVirtualPatientId:canonicalDisplay,
    possibleDuplicateConfirmed:true});
   request.current=null;setConfirmed(false);setSourceDisplay("");setCanonicalDisplay("");
   await refresh();
   setNotice(result.status==="PENDING"?
    "Restricted possible-duplicate review recorded. No patient data was merged.":
    "Original review request found. No patient data was changed.");
  }catch(e){
   setUncertain(true);setError(e instanceof Error?e.message:
    "The review proposal is uncertain. Check the inbox before retrying.");
  }finally{setBusy(false);}
 }
 async function decide(decision:"APPROVE"|"REJECT"){
  const current=rows.find(x=>x.reviewRef===selected);
  if(busy||uncertain||!current||current.status!=="PENDING"||
   current.proposedByCurrentAccount||password.length<8||
   (decision==="APPROVE"&&!evidenceReviewed))return;
  setBusy(true);setError("");setNotice("");
  try{
   const result=await source<{status:string;message:string}>(
    endpoint+"/"+encodeURIComponent(current.reviewRef)+"/decision","POST",{
    decision,expectedVersion:current.version,currentPassword:password,
    samePersonEvidenceReviewed:decision==="APPROVE"&&evidenceReviewed});
   setPassword("");setEvidenceReviewed(false);setSelected("");
   await refresh();setNotice(result.message);
  }catch(e){
   setPassword("");setEvidenceReviewed(false);setUncertain(true);
   setError(e instanceof Error?e.message:
    "The protected decision outcome is uncertain. Refresh before another action.");
  }finally{setBusy(false);}
 }
 const item=rows.find(r=>r.reviewRef===selected);
 return <section className="form-section" aria-label="Restricted duplicate patient identity review">
  <h2>Possible duplicate patient review</h2>
  <p>For authorized Foundation identity review only. A shared family phone,
   matching name or Virtual Patient ID is not proof that two people are the
   same patient. No automatic merge or access transfer occurs.</p>
  {!!error&&<p role="alert" className="notice error">{error}</p>}
  {!!notice&&<p role="status" className="notice">{notice}</p>}
  {uncertain&&<p role="alert">The last request could have succeeded. Review the
   original inbox before taking another action.</p>}
  <button type="button" disabled={busy} onClick={()=>{
   setLoading(true);setError("");
   void refresh().catch(e=>setError(e instanceof Error?e.message:
    "The current original inbox is unavailable.")).finally(()=>setLoading(false));
  }}>Refresh original identity reviews</button>
  <form onSubmit={e=>{e.preventDefault();void propose();}}
   style={{display:"grid",gap:12,maxWidth:600}}>
   <h3>Flag possible duplicate</h3>
   <label>Existing source Virtual Patient ID
    <input required value={sourceDisplay} maxLength={20} disabled={busy||uncertain}
     placeholder="CGP-XXXXXXXXXXXXXXXX"
     onChange={e=>{setSourceDisplay(e.target.value.trim().toUpperCase());
      request.current=null;}}/></label>
   <label>Proposed canonical Virtual Patient ID
    <input required value={canonicalDisplay} maxLength={20} disabled={busy||uncertain}
     placeholder="CGP-XXXXXXXXXXXXXXXX"
     onChange={e=>{setCanonicalDisplay(e.target.value.trim().toUpperCase());
      request.current=null;}}/></label>
   <label><input type="checkbox" checked={confirmed} disabled={busy||uncertain}
    onChange={e=>setConfirmed(e.target.checked)}/>
    {" "}I am flagging a possible identity duplicate for independent review,
    not granting access or merging medical histories.</label>
   <button type="submit" disabled={busy||uncertain||!confirmed||
    !VIRTUAL.test(sourceDisplay)||!VIRTUAL.test(canonicalDisplay)||
    sourceDisplay===canonicalDisplay}>
    {busy?"Checking…":"Submit independent duplicate review"}</button>
  </form>
  <h3>Current protected review inbox</h3>
  {loading&&<p role="status">Checking original patient identity reviews…</p>}
  {!loading&&!rows.length&&<p>No source-backed duplicate reviews recorded.</p>}
  <div className="role-table-wrap"><table className="role-table">
   <thead><tr><th>Source patient</th><th>Proposed canonical patient</th>
    <th>Status</th><th>Proposed</th><th>Review</th></tr></thead>
   <tbody>{rows.map(review=><tr key={review.reviewRef}>
    <td>{review.sourceVirtualPatientId}</td>
    <td>{review.canonicalVirtualPatientId}</td>
    <td>{review.status}</td>
    <td>{new Date(review.proposedAt).toLocaleString("en-IN")}</td>
    <td>{review.status==="PENDING"&&!review.proposedByCurrentAccount?
     <button type="button" disabled={busy||uncertain} onClick={()=>{
      setSelected(review.reviewRef);setPassword("");setEvidenceReviewed(false);
     }}>Review identity evidence</button>:
     review.status==="PENDING"?"Independent reviewer required":"Decision recorded"}</td>
   </tr>)}</tbody>
  </table></div>
  {item?.status==="PENDING"&&!item.proposedByCurrentAccount&&
   <div className="form-section" aria-label="Independent duplicate review decision">
    <h3>Independent decision</h3>
    <p>Source: <strong>{item.sourceVirtualPatientId}</strong> and proposed
     canonical: <strong>{item.canonicalVirtualPatientId}</strong>.</p>
    <p>Approval records an administrative same-person alias only. Both
     original patient records, booked appointments, document permissions,
     consent histories and account ownership remain unchanged.
     No patient account can read another record through this alias.</p>
    <label><input type="checkbox" checked={evidenceReviewed}
     disabled={busy||uncertain}
     onChange={e=>setEvidenceReviewed(e.target.checked)}/>
     {" "}I independently reviewed legitimate person-specific identity
     evidence for BOTH verified patients and confirmed they are the same person.</label>
    <label>Confirm your current protected Foundation password
     <input type="password" value={password} disabled={busy||uncertain}
      autoComplete="current-password" maxLength={1024}
      onChange={e=>setPassword(e.target.value)}/></label>
    <div className="toolbar">
     <button type="button" disabled={busy||uncertain||!evidenceReviewed||
      password.length<8} onClick={()=>void decide("APPROVE")}>
      Approve reviewed administrative alias</button>
     <button type="button" disabled={busy||uncertain||password.length<8}
      onClick={()=>void decide("REJECT")}>Reject possible duplicate</button>
     <button type="button" disabled={busy}
      onClick={()=>{setSelected("");setPassword("");setEvidenceReviewed(false);}}>
      Cancel review</button>
    </div>
   </div>}
  <p>This shows at most the latest 30 protected reviews. Approved aliases
   preserve original source keys. No patient list, clinical content or CG-19
   files can be searched or downloaded from this review.</p>
 </section>;
}
