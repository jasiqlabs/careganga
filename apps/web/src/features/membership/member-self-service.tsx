"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import type {CG04Application,CG04Member,CG04MembershipFee,CG04PublicTier,CG04PublicTierPage} from "@careganga/api-contracts";
import {CommunityAuth} from "./community-auth";
import {MemberApplicationForm} from "./member-application-form";
import {MemberEvidencePanel} from "./member-evidence-panel";
import {priceText} from "./tier-display";
type Pending={path:string;body:Record<string,unknown>};
async function api<T>(path:string,method:"GET"|"POST"="GET",body?:Record<string,unknown>):Promise<T>{
 const r=await fetch("/api/community"+path,{method,headers:body?{"Content-Type":"application/json"}:undefined,body:body?JSON.stringify(body):undefined,cache:"no-store",signal:AbortSignal.timeout(15000)});
 const data=await r.json().catch(()=>null);
 if(!r.ok||data===null)throw new Error(typeof data?.message==="string"?data.message:"The membership outcome could not be confirmed. Refresh before retrying.");
 return data as T;
}
export function MemberSelfService(){
 const [signed,setSigned]=useState(false),[verified,setVerified]=useState(false),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [apps,setApps]=useState<CG04Application[]>([]),[chosen,setChosen]=useState<CG04Application|null>(null),[member,setMember]=useState<CG04Member|null>(null),[fee,setFee]=useState<CG04MembershipFee|null>(null),[plans,setPlans]=useState<CG04PublicTier[]>([]),[code,setCode]=useState("");
 const pending=useRef<Pending|null>(null),sequence=useRef(0);
 const refresh=useCallback(async()=>{
  const n=++sequence.current;
  let phone:{verified:boolean};
  try{phone=await api<{verified:boolean}>("/mobile/status");}catch(e){if(n===sequence.current){setSigned(false);setVerified(false);setApps([]);setChosen(null);setMember(null);setFee(null);}throw e;}
  if(n!==sequence.current)return;
  setSigned(true);setVerified(phone.verified);
  if(!phone.verified){setApps([]);setChosen(null);setMember(null);return;}
  const [list,self]=await Promise.all([api<{items:CG04Application[]}>("/applications"),api<{member:CG04Member|null}>("/me")]);
  if(n!==sequence.current)return;
  setApps(list.items);setMember(self.member);
  setChosen(old=>list.items.find(x=>x.ref===old?.ref)??list.items.find(x=>["DRAFT","RETURNED","SUBMITTED"].includes(x.status))??list.items[0]??null);
 },[]);
 useEffect(()=>{
  let live=true;
  void refresh().catch(()=>{if(live)setSigned(false);}).finally(()=>{if(live)setLoading(false);});
  void (async()=>{const all:CG04PublicTier[]=[];let cursor="";for(let i=0;i<4;i++){
   const r=await fetch("/api/public/membership/tiers?"+new URLSearchParams({cursor}),{cache:"no-store",signal:AbortSignal.timeout(10000)});
   if(!r.ok)throw Error();const v=await r.json() as CG04PublicTierPage;if(!Array.isArray(v.items))throw Error();all.push(...v.items);if(!v.nextCursor)break;cursor=v.nextCursor;
  }if(live)setPlans(all);})().catch(()=>{if(live)setError("Current membership plans are unavailable. Refresh before choosing a plan.");});
  return()=>{live=false;sequence.current++;};
 },[refresh]);
 useEffect(()=>{
  const onVisibility=()=>{
   if(document.visibilityState!=="visible"){sequence.current++;setApps([]);setChosen(null);setMember(null);setFee(null);setVerified(false);setLoading(true);setCode("");}
   else void refresh().catch(()=>setError("Private membership status could not be confirmed. Retry.")).finally(()=>setLoading(false));
  };
  document.addEventListener("visibilitychange",onVisibility);
  return()=>document.removeEventListener("visibilitychange",onVisibility);
 },[refresh]);
 useEffect(()=>{if(!chosen){setFee(null);return;}let active=true;void api<CG04MembershipFee>("/applications/"+chosen.ref+"/fee").then(x=>{if(active&&document.visibilityState==="visible")setFee(x);}).catch(()=>{if(active&&document.visibilityState==="visible")setFee(null);});return()=>{active=false;};},[chosen?.ref,chosen?.version]);
 const act=async(job:()=>Promise<void>)=>{if(busy)return;setBusy(true);setError("");setNotice("");try{await job();}catch(e){setError(e instanceof Error?e.message:"Outcome uncertain. Refresh before retrying.");}finally{setBusy(false);}};
 const send=(cmd:Pending)=>void act(async()=>{pending.current=cmd;await api(cmd.path,"POST",cmd.body);pending.current=null;await refresh();setNotice("The original action has been confirmed. Review the updated status.");});
 const action=(kind:"submit"|"cancel"|"activate")=>{if(!chosen||busy||pending.current)return;send({path:"/applications/"+chosen.ref+"/"+kind,body:{requestKey:crypto.randomUUID(),...(kind==="activate"?{}:{expectedVersion:chosen.version})}});};
 const logout=()=>void act(async()=>{await api("/logout","POST",{});pending.current=null;setSigned(false);setVerified(false);setChosen(null);setApps([]);setMember(null);setFee(null);});
 const verify=()=>void act(async()=>{await api("/mobile/start","POST",{});setNotice("Verification code requested. Delivery is not guaranteed.");});
 const confirm=()=>void act(async()=>{const r=await api<{status:string}>("/mobile/confirm","POST",{code});if(r.status!=="VERIFIED")throw new Error("Mobile verification was not confirmed.");setCode("");await refresh();});
 return <section className="cg04-public cg04-self-service"><header className="cg04-public-title"><h1>Membership Application</h1><p>Apply, renew or check the original Foundation review and payment status.</p></header>
 {error&&<p className="cg04-error" role="alert">{error}</p>}{notice&&<p role="status" className="cg04-panel">{notice}</p>}
 {loading?<p role="status">Checking membership account…</p>:!signed?<CommunityAuth onSignedIn={refresh}/>:
 <><div className="cg04-panel cg04-buttons"><strong>Your private membership account</strong><button disabled={busy} onClick={logout}>Sign out</button></div>
 {!verified?<section className="cg04-panel"><h2>Verify contact</h2><p>Verify the mobile number on your account before submitting an application.</p><button disabled={busy} onClick={verify}>Request verification code</button><label>Received code<input value={code} onChange={e=>setCode(e.target.value)} maxLength={10}/></label><button disabled={busy||!code} onClick={confirm}>Verify code</button></section>:
 <>
 <section className="cg04-panel"><h2>Current membership</h2>{member?<p>{member.memberNumber} · {member.plan} · {member.status} · Valid {member.expiresOn?"until "+member.expiresOn:"for lifetime"}</p>:<p>No active membership identity has been issued yet.</p>}</section>
 <section className="cg04-panel"><h2>Applications and renewal</h2><div className="cg04-buttons">
 {apps.map(a=><button type="button" key={a.ref} aria-pressed={chosen?.ref===a.ref} onClick={()=>setChosen(a)}>{a.applicationNumber} · {a.status}</button>)}
 <button type="button" disabled={busy||apps.some(a=>["DRAFT","RETURNED","SUBMITTED"].includes(a.status))} onClick={()=>setChosen(null)}>New application / renewal</button>
 </div></section>
 {(!chosen||["DRAFT","RETURNED"].includes(chosen.status))&&<MemberApplicationForm application={chosen} plans={plans} onSaved={refresh}/>}
 {chosen&&<section className="cg04-panel"><h2>Application {chosen.applicationNumber}</h2><p>Status: <strong>{chosen.status}</strong>. Plan: {chosen.plan}. Accepted fee: {priceText(chosen.feeMinor)}.</p>
 {chosen.reviewReference&&<p>Review {chosen.reviewReference} · {chosen.reviewStatus}</p>}
 {chosen.reviewRemarks&&<p role="status">Reviewer notes: {chosen.reviewRemarks}</p>}
 <p>Payment: <strong>{fee?.paymentStatus.replaceAll("_"," ")??"Not confirmed"}</strong>. A posted bank entry is not verified payment.</p>
 {["DRAFT","RETURNED"].includes(chosen.status)&&<><MemberEvidencePanel applicationRef={chosen.ref} version={chosen.version} editable onChange={refresh}/><div className="cg04-buttons"><button className="cg04-primary" disabled={busy||!!pending.current} onClick={()=>action("submit")}>Submit for approval</button><button disabled={busy||!!pending.current} onClick={()=>action("cancel")}>Cancel draft</button></div></>}
 {chosen.status==="SUBMITTED"&&chosen.reviewStatus==="PENDING_OWNER"&&fee&&["NOT_DUE","VERIFIED"].includes(fee.paymentStatus)&&<button className="cg04-primary" disabled={busy||!!pending.current} onClick={()=>action("activate")}>Complete approved membership</button>}
 </section>}
 {pending.current&&<section role="status" className="cg04-panel"><p>Outcome uncertain. Refresh the current record first, then retry the original request. Do not create a second transaction.</p><div className="cg04-buttons"><button disabled={busy} onClick={()=>void act(refresh)}>Refresh</button><button disabled={busy} onClick={()=>send(pending.current!)}>Retry same request</button></div></section>}
 <div className="cg04-buttons"><button disabled={busy} onClick={()=>void act(refresh)}>Refresh membership status</button><a href="/membership">Back to plans</a></div>
 </>}
 </>}</section>;
}
