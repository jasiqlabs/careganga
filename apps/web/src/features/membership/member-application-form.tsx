"use client";
import {useEffect,useRef,useState,type FormEvent} from "react";
import type {CG04Application,CG04ApplicantOptions,CG04PublicTier} from "@careganga/api-contracts";
import {priceText,durationLabel} from "./tier-display";
import {ReferralCodeCheck} from "../referrals/referral-code-check";
type Draft={address:string;city:string;pinCode:string;stateRef:string;districtRef:string;branchRef:string;referral:string;consent:boolean};
const blank=():Draft=>({address:"",city:"",pinCode:"",stateRef:"",districtRef:"",branchRef:"",referral:"",consent:false});
type Command={path:string;method:"POST"|"PATCH";body:Record<string,unknown>};
export function MemberApplicationForm({application,plans,onSaved}:{application:CG04Application|null;plans:CG04PublicTier[];onSaved:()=>Promise<void>}){
 const [draft,setDraft]=useState<Draft>(blank),[offer,setOffer]=useState(""),[options,setOptions]=useState<CG04ApplicantOptions|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const pending=useRef<Command|null>(null);
 useEffect(()=>{setOffer(application?.planCode??new URLSearchParams(window.location.search).get("plan")??"");const incoming=new URLSearchParams(window.location.search).get("ref")??"";
 const referral=/^[A-Za-z0-9_-]{32}$/.test(incoming)?incoming:"";
 setDraft(application?{address:application.address,city:application.city,pinCode:application.pinCode,stateRef:application.stateRef,districtRef:application.districtRef,branchRef:application.branchRef??"",referral:application.referral,consent:false}:{...blank(),referral});},[application?.ref,application?.version]);
 useEffect(()=>{if(!offer&&!application&&!new URLSearchParams(window.location.search).get("plan")&&plans.length)setOffer(plans[0].planCode);},[offer,application,plans]);
 const chosenPlan=plans.find(x=>x.planCode===offer);
 const planAvailable=!!chosenPlan||!!application&&application.planCode===offer;
 const selectedRevision=chosenPlan?.offerRevision??(application?.planCode===offer?application.offerRevision:undefined);
 useEffect(()=>{setDraft(d=>({...d,consent:false}));},[offer,selectedRevision]);
 useEffect(()=>{let active=true;setOptions(null);const url="/api/community/applications/options"+(draft.stateRef?"?stateRef="+encodeURIComponent(draft.stateRef):"");void fetch(url,{cache:"no-store",signal:AbortSignal.timeout(10000)}).then(async r=>{if(!r.ok)throw Error();return r.json() as Promise<CG04ApplicantOptions>}).then(v=>{if(active)setOptions(v)}).catch(()=>{if(active)setOptions(null)});return()=>{active=false;};},[draft.stateRef]);
 const update=(k:keyof Draft,v:string|boolean)=>setDraft(d=>({...d,[k]:v}));
 const send=async(cmd:Command)=>{if(busy)return;setBusy(true);setError("");setNotice("");
  try{const r=await fetch("/api/community"+cmd.path,{method:cmd.method,headers:{"Content-Type":"application/json"},body:JSON.stringify(cmd.body),cache:"no-store",signal:AbortSignal.timeout(15000)});
   const v=await r.json().catch(()=>null);if(!r.ok||!v)throw Error(typeof v?.message==="string"?v.message:"The result could not be confirmed. Refresh before retrying.");
   pending.current=null;await onSaved();setNotice("Application saved. Upload and verify your identity proof before submission.");
  }catch(e){setError(e instanceof Error?e.message:"Save result uncertain. Check your application status before retrying.");}
  finally{setBusy(false);}
 };
 const submit=(e:FormEvent)=>{e.preventDefault();if(busy||pending.current||!draft.consent||!options||!planAvailable)return;
  const valid=chosenPlan??(application?.planCode===offer?{planCode:offer,offerRevision:application.offerRevision}:null);
  if(!valid){setError("Choose an available membership plan.");return;}
  const body={...draft,branchRef:draft.branchRef||null,planCode:valid.planCode,offerRevision:valid.offerRevision,requestKey:crypto.randomUUID(),...(application?{expectedVersion:application.version}:{})};
  const cmd={path:application?"/applications/"+application.ref:"/applications",method:application?"PATCH" as const:"POST" as const,body};pending.current=cmd;void send(cmd);
 };
 return <form className="cg04-panel cg04-enroll-form" onSubmit={submit}>
 <h2>{application?"Correct membership application":"Apply for membership"}</h2>
 {error&&<p className="cg04-error" role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
 <fieldset className="cg04-enroll-fields" disabled={busy||!!pending.current}>
 <label>Membership plan<select required value={planAvailable?offer:""} onChange={e=>setOffer(e.target.value)}>
 <option value="">Choose an available membership plan</option>
 {application&&!plans.some(x=>x.planCode===application.planCode)&&<option value={application.planCode}>{application.plan} — previously accepted offer</option>}
 {plans.map(x=><option value={x.planCode} key={x.planCode}>{x.name} — {priceText(x.feeMinor)} / {durationLabel(x)}</option>)}</select></label>
 {offer&&!planAvailable&&<p role="status">The selected plan is not currently available. Choose a current plan.</p>}
 <label>Street address<textarea value={draft.address} required maxLength={1000} onChange={e=>update("address",e.target.value)}/></label>
 <label>City<input value={draft.city} maxLength={120} required onChange={e=>update("city",e.target.value)}/></label>
 <label>PIN code<input value={draft.pinCode} required maxLength={6} inputMode="numeric" pattern="[1-9][0-9]{5}" onChange={e=>update("pinCode",e.target.value)}/></label>
 <label>State<select value={draft.stateRef} required onChange={e=>{setOptions(null);setDraft(x=>({...x,stateRef:e.target.value,districtRef:""}));}}><option value="">Select state</option>{options?.states.map(x=><option value={x.value} key={x.value}>{x.label}</option>)}</select></label>
 <label>District<select value={draft.districtRef} required disabled={!options||!draft.stateRef} onChange={e=>update("districtRef",e.target.value)}><option value="">Select district</option>{options?.districts.map(x=><option value={x.value} key={x.value}>{x.label}</option>)}</select></label>
 <label>Branch preference<select value={draft.branchRef} onChange={e=>update("branchRef",e.target.value)}><option value="">None</option>{options?.branches.map(x=><option value={x.value} key={x.value}>{x.label}</option>)}</select></label>
 <label>Referral (optional)<input value={draft.referral} maxLength={100} onChange={e=>update("referral",e.target.value)}/></label>
  <ReferralCodeCheck code={draft.referral}/>
 <label><input type="checkbox" checked={draft.consent} onChange={e=>update("consent",e.target.checked)}/> I agree to processing of my membership application and protected evidence.</label>
 </fieldset>
 <button className="cg04-primary" disabled={busy||!options||!planAvailable||!draft.consent||!!pending.current}>{busy?"Saving…":"Save application"}</button>
 {pending.current&&!busy&&<div className="cg04-enroll-retry" role="status"><p>Save result uncertain. Refresh your applications before retrying the same request.</p><button type="button" disabled={busy} onClick={()=>void onSaved()}>Refresh applications</button><button type="button" disabled={busy} onClick={()=>void send(pending.current!)}>Retry the original request</button></div>}
 </form>;
}
