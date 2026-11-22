"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import type {CG04Application,CG04Member,CG04MembershipFee,CG04PublicTier,CG04PublicTierPage} from "@careganga/api-contracts";
import {CommunityAuth} from "./community-auth";
import {MemberApplicationForm} from "./member-application-form";
import {MemberEvidencePanel} from "./member-evidence-panel";
import {priceText} from "./tier-display";
type Command={url:string;body:{requestKey:string;expectedVersion?:number}};
async function api<T>(path:string,method:"GET"|"POST"="GET",body?:Record<string,unknown>):Promise<T>{
 const r=await fetch("/api/community"+path,{method,headers:body?{"Content-Type":"application/json"}:undefined,
  body:body?JSON.stringify(body):undefined,cache:"no-store",signal:AbortSignal.timeout(15000)});
 const v=await r.json().catch(()=>null);
 if(!r.ok||v===null)throw Object.assign(new Error(typeof v?.message==="string"?v.message:"The result could not be confirmed."),{status:r.status});
 return v as T;
}
export function MemberDashboard(){
 const [signed,setSigned]=useState(false),[loading,setLoading]=useState(true),[verified,setVerified]=useState(false);
 const [apps,setApps]=useState<CG04Application[]>([]),[selected,setSelected]=useState<string|null>(null),[member,setMember]=useState<CG04Member|null>(null);
 const [plans,setPlans]=useState<CG04PublicTier[]>([]),[fee,setFee]=useState<CG04MembershipFee|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[note,setNote]=useState(""),[otp,setOtp]=useState("");
 const seq=useRef(0),pending=useRef<Command|null>(null);
 const record=apps.find(x=>x.ref===selected)??null;
 const editable=record===null||["DRAFT","RETURNED"].includes(record.status);
 const refresh=useCallback(async()=>{
  const n=++seq.current;
  const verify=await api<{verified:boolean}>("/mobile/status");
  if(n!==seq.current)return;
  setVerified(verify.verified);setSigned(true);
  if(!verify.verified){setApps([]);setMember(null);setSelected(null);return;}
  const [applications,profile]=await Promise.all([api<{items:CG04Application[]}>("/applications"),api<{member:CG04Member|null}>("/me")]);
  if(n!==seq.current)return;
  setApps(applications.items);setMember(profile.member);
  setSelected(current=>applications.items.some(x=>x.ref===current)?current:
   applications.items.find(x=>["DRAFT","RETURNED","SUBMITTED"].includes(x.status))?.ref??applications.items[0]?.ref??null);
 },[]);
 useEffect(()=>{
  let active=true;
  void refresh().catch(e=>{if(active){setSigned(false);if((e as {status?:number}).status!==401)setError("Membership account cannot be checked. Refresh to retry.");}})
   .finally(()=>{if(active)setLoading(false);});
  void fetch("/api/public/membership/tiers",{cache:"no-store",signal:AbortSignal.timeout(12000)})
   .then(async r=>{if(!r.ok)throw Error();return r.json() as Promise<CG04PublicTierPage>})
   .then(v=>{if(active&&Array.isArray(v.items))setPlans(v.items)})
   .catch(()=>{if(active)setError("Current membership plans cannot be confirmed. Refresh before applying.");});
  return()=>{active=false;seq.current++;};
 },[refresh]);
 useEffect(()=>{
  if(!record){setFee(null);return;}
  let active=true;
  void api<CG04MembershipFee>("/applications/"+record.ref+"/fee").then(v=>{if(active)setFee(v);})
   .catch(()=>{if(active)setFee(null);});
  return()=>{active=false;};
 },[record?.ref,record?.version]);
 const act=async(fn:()=>Promise<void>)=>{
  if(busy)return;setBusy(true);setError("");setNote("");
  try{await fn();}catch(e){setError(e instanceof Error?e.message:"The result is uncertain. Refresh before retrying.");}finally{setBusy(false);}
 };
 const send=(cmd:Command)=>void act(async()=>{
  pending.current=cmd;
  await api(cmd.url,"POST",cmd.body);
  pending.current=null;await refresh();setNote("Action confirmed. Review the current membership status.");
 });
 const change=(kind:"submit"|"cancel"|"activate")=>{
  if(!record||busy||pending.current)return;
  send({url:"/applications/"+record.ref+"/"+kind,
   body:{requestKey:crypto.randomUUID(),...(kind==="activate"?{}:{expectedVersion:record.version})}});
 };
 const requestCode=()=>void act(async()=>{const r=await api<{status:string}>("/mobile/start","POST",{});setNote(r.status==="ALREADY_VERIFIED"?"Mobile contact verified.":"Verification code requested. Delivery is not guaranteed.");await refresh();});
 const confirm=()=>void act(async()=>{const r=await api<{status:string}>("/mobile/confirm","POST",{code:otp});if(r.status!=="VERIFIED")throw Error("The contact has not been verified.");setOtp("");await refresh();});
 const logout=()=>void act(async()=>{await api("/logout","POST",{});pending.current=null;setSigned(false);setVerified(false);setApps([]);setSelected(null);setMember(null);setFee(null);});
 return <section className="cg04-public cg04-member-flow">
  <header className="cg04-public-title"><h1>Become a Member</h1><p>Apply, renew or check your own membership with a verified CareGanga account.</p></header>
  {!!error&&<p className="cg04-error" role="alert">{error}</p>}{!!note&&<p className="cg04-panel" role="status">{note}</p>}
  {loading?<p role="status">Checking membership account…</p>:!signed?<CommunityAuth onSignedIn={refresh}/>:
  <>
   <section className="cg04-panel"><h2>My membership account</h2><button type="button" disabled={busy} onClick={()=>void logout()}>Sign out</button>
    {member?<p><strong>{member.memberNumber}</strong> · {member.plan} · {member.status} · Valid until {member.expiresOn??"lifetime"}</p>:<p>No approved member identity yet.</p>}
   </section>
   {!verified?<section className="cg04-panel"><h2>Mobile verification required</h2><p>Confirm your own mobile number before applying for membership.</p>
    <button type="button" disabled={busy} onClick={requestCode}>Request verification code</button>
    <label>Received code<input value={otp} maxLength={10} onChange={e=>setOtp(e.target.value)}/></label>
    <button type="button" disabled={busy||!otp.trim()} onClick={confirm}>Verify mobile contact</button>
   </section>:
   <>
    <section className="cg04-panel"><h2>My applications</h2><div className="cg04-buttons">
     {apps.map(v=><button key={v.ref} type="button" aria-pressed={selected===v.ref} onClick={()=>{setSelected(v.ref);setNote("");}}>{v.applicationNumber} · {v.status}</button>)}
     <button type="button" disabled={busy||apps.some(x=>["DRAFT","RETURNED","SUBMITTED"].includes(x.status))}
      onClick={()=>{setSelected(null);setFee(null);}}>New membership / renewal</button>
    </div></section>
    {editable&&<MemberApplicationForm key={record?.ref??"new"} application={record} plans={plans} onSaved={refresh}/>}
    {record&&<section className="cg04-panel"><h2>Application {record.applicationNumber}</h2><p>{record.status} · {record.plan} · {priceText(record.feeMinor)}</p>
     {record.reviewReference&&<p>Review: {record.reviewReference} · {record.reviewStatus}</p>}
     {record.reviewRemarks&&<p role="status">Reviewer remarks: {record.reviewRemarks}</p>}
     <p>Payment: {fee?.paymentStatus.replaceAll("_"," ")??"Not confirmed"}. A posted journal is not verified payment.</p>
     {editable&&<><MemberEvidencePanel applicationRef={record.ref} version={record.version} editable onChange={()=>void refresh()}/>
      <div className="cg04-buttons"><button type="button" className="cg04-primary" disabled={busy||!!pending.current} onClick={()=>change("submit")}>Submit for Foundation review</button>
      <button type="button" disabled={busy||!!pending.current} onClick={()=>change("cancel")}>Cancel draft</button></div></>}
     {record.status==="SUBMITTED"&&record.reviewStatus==="PENDING_OWNER"&&fee&&["VERIFIED","NOT_DUE"].includes(fee.paymentStatus)&&
      <button type="button" className="cg04-primary" disabled={busy||!!pending.current} onClick={()=>change("activate")}>Complete approved membership</button>}
    </section>}
    {pending.current&&<section className="cg04-panel" role="status"><p>Action result uncertain. Refresh the actual status, or retry the exact original request. Do not create another payment.</p>
      <button type="button" disabled={busy} onClick={()=>void refresh()}>Refresh current status</button>
      <button type="button" disabled={busy} onClick={()=>send(pending.current!)}>Retry original request</button>
    </section>}
    <button type="button" disabled={busy} onClick={()=>void act(refresh)}>Refresh membership status</button>
   </>}
  </>}
 </section>;
}
