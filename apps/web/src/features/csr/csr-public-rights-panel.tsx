"use client";
import {useEffect,useState,type CSSProperties} from "react";
type Release={partnerStatus:string;version:number;state:"AUTHORIZED"|"WITHDRAWN"|"NOT_AUTHORIZED";
 publicSummary:string;approvedAgreementFileRef:string|null};
type Command={url:string;body:Record<string,unknown>};
const field:CSSProperties={width:"100%",boxSizing:"border-box",minHeight:44,padding:10,
 border:"1px solid var(--cg-border)",borderRadius:8,font:"inherit"};
const action:CSSProperties={padding:"10px 15px",border:"1px solid var(--cg-border)",
 borderRadius:8,background:"var(--cg-surface,#fff)",color:"inherit",fontWeight:700,cursor:"pointer"};
async function request<T>(path:string,method:"GET"|"POST"="GET",body?:Record<string,unknown>):Promise<T>{
 const response=await fetch("/api/csr/partners"+path,{
  method,cache:"no-store",headers:body?{"Content-Type":"application/json"}:undefined,
  body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(16000)});
 const value:unknown=await response.json().catch(()=>null);
 if(!response.ok||value===null){
  const message=value&&typeof value==="object"&&"message" in value&&
   typeof value.message==="string"&&value.message.length<230?
   value.message:"This public permission result could not be confirmed.";
  throw Object.assign(Error(message),{status:response.status||503});
 }
 return value as T;
}
/** CG08 legal identity, CG03 approval and CG19 private proof remain protected.
 * This grants public naming permission, not CG18 editorial publication. */
export function CsrPublicRightsPanel({partnerRef,canManage}:{partnerRef:string;canManage:boolean}){
 const [release,setRelease]=useState<Release|null>(null),[loading,setLoading]=useState(true),
  [summary,setSummary]=useState(""),[confirmed,setConfirmed]=useState(false),
  [error,setError]=useState(""),[message,setMessage]=useState(""),
  [pending,setPending]=useState<Command|null>(null),[busy,setBusy]=useState(false),
  [epoch,setEpoch]=useState(0);
 useEffect(()=>{
  let live=true;setLoading(true);setError("");
  void request<Release>("/"+partnerRef+"/public-release").then(value=>{
   if(!live)return;setRelease(value);setSummary(value.publicSummary);setConfirmed(false);
  }).catch(e=>{
   if(!live)return;setRelease(null);
   setError(e instanceof Error?e.message:"Public release authority unavailable.");
  }).finally(()=>{if(live)setLoading(false);});
  return()=>{live=false;};
 },[partnerRef,epoch]);
 const send=async(command:Command)=>{
  if(busy)return;
  setBusy(true);setPending(command);setError("");setMessage("");
  try{
   await request<{ref:string;version:number}>(command.url,"POST",command.body);
   setPending(null);setConfirmed(false);
   setMessage("Original public permission change confirmed. The partner is not automatically published; CG18 independent editorial review is required.");
   setEpoch(v=>v+1);
  }catch(e){
   const code=e&&typeof e==="object"&&"status" in e?Number(e.status):503;
   if(code>0&&code<500)setPending(null);
   setError(code>=500||code===0?
    "The outcome is uncertain. Retry the SAME original request; do not create a different authorization.":
    e instanceof Error?e.message:"Public permission change was rejected.");
  }finally{setBusy(false);}
 };
 const authorize=()=>{
  if(!release||release.partnerStatus!=="APPROVED"||release.state==="AUTHORIZED"||
   !canManage||!confirmed||!release.approvedAgreementFileRef||summary.trim().length<10||
   summary.trim().length>500||pending||busy)return;
  void send({url:"/"+partnerRef+"/public-release",body:{
   requestKey:crypto.randomUUID(),expectedVersion:release.version,
   evidenceFileRef:release.approvedAgreementFileRef,
   publicSummary:summary.trim(),publicRightsConfirmed:true}});
 };
 const withdraw=()=>{
  if(!release||release.state!=="AUTHORIZED"||!canManage||pending||busy||
    !window.confirm("Withdraw this organization's public naming permission? Approved website cards will be hidden immediately when the source is checked."))return;
  void send({url:"/"+partnerRef+"/public-release/withdraw",
   body:{requestKey:crypto.randomUUID(),expectedVersion:release.version}});
 };
 return <section aria-label="Public partner naming permission"
  style={{display:"grid",gap:10,border:"1px solid var(--cg-border)",borderRadius:12,
   marginTop:14,padding:16}}>
  <h3 style={{margin:0}}>Public partnership attribution</h3>
  <p style={{margin:0,fontSize:13}}>The original CSR approval confirms only the private relationship.
   Public names or descriptions require separately documented naming permission and an independently
   approved CG18 website publication. Original signed agreements and contact details remain private.</p>
  {loading&&<p role="status">Checking current naming permission…</p>}
  {!!error&&<p role="alert">{error}</p>}
  {!!message&&<p role="status">{message}</p>}
  {release&&!loading&&<>
   <p role="status">Current naming permission: <strong>{release.state==="AUTHORIZED"?"Authorized for editorial review":
    release.state==="WITHDRAWN"?"Withdrawn — not public":"Not authorized — not public"}</strong></p>
   {release.state==="AUTHORIZED"?<>
    <p>Approved private description: {release.publicSummary}</p>
    {canManage&&<button type="button" style={action} disabled={busy||!!pending} onClick={withdraw}>Withdraw public permission</button>}
   </>:canManage&&release.partnerStatus==="APPROVED"&&<>
    {!release.approvedAgreementFileRef&&<p role="alert">No current clean agreement from the original independent CSR approval was found. Public permission cannot be granted.</p>}
    <label style={{display:"grid",gap:6}}>Public description for independent CMS review
     <textarea value={summary} minLength={10} maxLength={500} style={{...field,minHeight:98}}
      disabled={!release.approvedAgreementFileRef||!!pending||busy}
      onChange={e=>setSummary(e.target.value)}/>
    </label>
    <label style={{display:"flex",gap:8,alignItems:"start"}}>
     <input type="checkbox" checked={confirmed} disabled={!release.approvedAgreementFileRef||!!pending||busy}
      onChange={e=>setConfirmed(e.target.checked)}/>
     I have inspected the original signed, scanner-verified CSR agreement and confirm that it expressly
     permits public use of this organization's name and the description above.
    </label>
    <button type="button" style={action} disabled={!release.approvedAgreementFileRef||
     !confirmed||summary.trim().length<10||summary.trim().length>500||busy||!!pending}
     onClick={authorize}>Authorize for independent website review</button>
   </>}
  </>}
  {pending&&<div role="alert">
   <p>The last request may have succeeded; only retry its original request key.</p>
   <button type="button" style={action} disabled={busy} onClick={()=>void send(pending)}>
    Retry same permission request</button>
  </div>}
  <button type="button" style={action} disabled={busy||!!pending} onClick={()=>setEpoch(v=>v+1)}>
   Refresh permission status</button>
 </section>;
}
