"use client";
import {useEffect,useRef,useState} from "react";
import type {CG05ProjectDetail as Detail,CG05PublicEligibility as Eligibility} from "@careganga/api-contracts";
type Command={path:string;body:Record<string,unknown>};
async function api<T>(path:string,body?:Record<string,unknown>):Promise<T>{
 const r=await fetch("/api/project-public-eligibility/"+path,{cache:"no-store",...(body?{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})});
 const v=await r.json().catch(()=>null);if(!r.ok||!v)throw Object.assign(Error(v?.message??"Eligibility unavailable."),{status:r.ok?503:r.status});return v as T;
}
export function ProjectEligibilityPanel({project,canManage}:{project:Detail;canManage:boolean}){
 const [state,setState]=useState<Eligibility|null>(null),[summary,setSummary]=useState(""),[area,setArea]=useState(""),[consent,setConsent]=useState(false),[remark,setRemark]=useState(""),[password,setPassword]=useState(""),[error,setError]=useState(""),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false),[pending,setPending]=useState(false),[epoch,setEpoch]=useState(0);
 const command=useRef<Command|null>(null),running=useRef(false),path="projects/"+project.ref;
 useEffect(()=>{let live=true;setState(null);void api<Eligibility>(path).then(v=>{if(live)setState(v);}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[path,epoch]);
 const perform=async(next?:Command)=>{if(running.current)return;const c=command.current??next;if(!c)return;command.current=c;running.current=true;setBusy(true);setError("");setNotice("");try{
  await api(c.path,c.body);command.current=null;setPending(false);setPassword("");setRemark("");setConsent(false);setNotice("Original eligibility action confirmed. Publication is a separate CMS decision.");setEpoch(x=>x+1);
 }catch(e){const code=(e as {status?:number}).status;setError(e instanceof Error?e.message:"Result unconfirmed.");if(!code||code>=500||code===408||code===429){setPending(true);setState(null);}else{command.current=null;setPending(false);setPassword("");setEpoch(x=>x+1);}}finally{running.current=false;setBusy(false);}};
 const locked=busy||pending,canSubmit=!!state&&state.status==="PRIVATE"&&canManage&&["PLANNED","ACTIVE"].includes(project.status);
 const decision=(action:"APPROVE"|"RETURN"|"REJECT")=>{if(!state?.caseRef||!state.revision)return;void perform({path:"cases/"+state.caseRef+"/decide",body:{requestKey:crypto.randomUUID(),expectedRevision:state.revision,action,remarks:remark,currentPassword:password}});};
 return <section style={{border:"1px solid var(--cg-border)",borderRadius:10,padding:16,display:"grid",gap:8}}>
 <h3>Public Project Eligibility</h3><p>Projects stay private by default. Only reviewed public-safe text may be selected and separately published in Website Content. Private cover images are not released by this action.</p>
 <p role="status">Source review: {state?state.status==="ELIGIBLE_NOT_PUBLISHED"?"Eligible for separate CMS publication":state.status.replaceAll("_"," "):"Not confirmed"}</p>{state?.caseNumber&&<p>Review case: {state.caseNumber}</p>}
 {state?.source&&<div><strong>{state.source.title}</strong><p>{state.source.category} · {state.source.area}</p><p>{state.source.summary}</p><p>{state.source.status}{state.source.launch?" · "+state.source.launch:""}</p></div>}
 {canSubmit&&<fieldset disabled={locked} style={{display:"grid",gap:8}}><legend>Submit public-safe source</legend><p>Title: {project.title} · {project.category} · {project.plannedStart??"No planned start"}</p>
 <label>Public summary<textarea rows={3} maxLength={500} value={summary} onChange={e=>setSummary(e.target.value)}/></label><label>General public area (not private address)<input maxLength={160} value={area} onChange={e=>setArea(e.target.value)}/></label>
 <label><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>I confirm these specific details may be released and contain no private beneficiary, employee, financial, contact or precise location data.</label>
 <button type="button" disabled={!consent||summary.trim().length<3||area.trim().length<2} onClick={()=>void perform({path:path+"/submit",body:{requestKey:crypto.randomUUID(),expectedVersion:project.version,publicSummary:summary,generalArea:area,publicReleaseConfirmed:true}})}>Submit for independent eligibility review</button></fieldset>}
 {state?.canReview&&!pending&&<fieldset disabled={locked} style={{display:"grid",gap:8}}><legend>Independent original CG-03 decision</legend><label>Remarks<textarea maxLength={500} value={remark} onChange={e=>setRemark(e.target.value)}/></label><label>Current password<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{(["APPROVE","RETURN","REJECT"] as const).map(a=><button type="button" key={a} disabled={password.length<8||a!=="APPROVE"&&remark.trim().length<3} onClick={()=>decision(a)}>{a}</button>)}</div></fieldset>}
 {state?.canWithdraw&&!pending&&<fieldset disabled={locked}><legend>Withdraw public eligibility</legend><label>Reason<input maxLength={500} value={remark} onChange={e=>setRemark(e.target.value)}/></label><button type="button" disabled={remark.trim().length<3} onClick={()=>void perform({path:path+"/withdraw",body:{expectedVersion:project.version,reason:remark}})}>Withdraw eligibility</button></fieldset>}
 {pending?<><p role="alert">Original outcome unknown. Retry the same request to confirm it.</p><button type="button" disabled={busy} onClick={()=>void perform()}>Retry original request</button></>:<button type="button" disabled={busy} onClick={()=>{setError("");setEpoch(x=>x+1);}}>Refresh eligibility</button>}
 {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}</section>;
}
