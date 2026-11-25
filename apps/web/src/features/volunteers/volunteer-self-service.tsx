"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import type {CG04VolunteerApplication,CG04VolunteerOptions,CG04VolunteerProfile} from "@careganga/api-contracts";
import {CommunityAuth} from "../membership/community-auth";
import {PublicRewardsCatalogue} from "../referrals/public-rewards-catalogue";
import {PublicReferralCode} from "../referrals/public-referral-code";
import {ReferralCodeCheck} from "../referrals/referral-code-check";
import {VolunteerEvidencePanel} from "./volunteer-evidence-panel";
import {PublicVolunteerVerification} from "./public-volunteer-verification";
import {VolunteerOwnCard} from "./volunteer-own-card";

type Form={
 firstName:string;lastName:string;dateOfBirth:string;gender:string;bloodGroup:string;
 address:string;city:string;village:string;pinCode:string;stateRef:string;districtRef:string;
 branchRef:string;departmentRef:string;availability:string;skills:string;experience:string;referral:string;consent:boolean
};
const blank=():Form=>({firstName:"",lastName:"",dateOfBirth:"",gender:"",bloodGroup:"",address:"",city:"",village:"",pinCode:"",
 stateRef:"",districtRef:"",branchRef:"",departmentRef:"",availability:"PART_TIME",skills:"",experience:"",referral:"",consent:false});
const steps=["Personal information","Contact and address","Volunteer interests","Review and submit"] as const;
const base="/api/community/volunteers";
const display=(value:string)=>value.replaceAll("_"," ").toLowerCase().replace(/\b[a-z]/g,x=>x.toUpperCase());
type Pending={path:string;method:"POST"|"PATCH";body:Record<string,unknown>;digest:string};
async function api<T>(path:string,method:"GET"|"POST"|"PATCH"="GET",body?:Record<string,unknown>):Promise<T>{
 const r=await fetch(path,{method,cache:"no-store",signal:AbortSignal.timeout(16000),
  headers:body?{"Content-Type":"application/json"}:undefined,body:body?JSON.stringify(body):undefined});
 const d:unknown=await r.json().catch(()=>null);
 if(!r.ok||!d||typeof d!=="object")throw Object.assign(new Error(typeof (d as {message?:unknown}|null)?.message==="string"?(d as {message:string}).message:
  "The volunteer result could not be confirmed. Refresh your current application."),{status:r.status});
 return d as T;
}
function toForm(a:CG04VolunteerApplication):Form{
 return {firstName:a.firstName,lastName:a.lastName,dateOfBirth:a.dateOfBirth,gender:a.gender,bloodGroup:a.bloodGroup??"",
  address:a.address,city:a.city,village:a.village,pinCode:a.pinCode,stateRef:a.stateRef,districtRef:a.districtRef,
  branchRef:a.branchRef??"",departmentRef:a.departmentRef,availability:a.availability,
  skills:a.skills.join(", "),experience:a.experience,referral:a.referral,consent:true};
}
import type {PublicIntro} from "../cms-public-content/cms-public-source";
export function VolunteerSelfService({intro}:{intro?:PublicIntro|null}={}){
 const [tab,setTab]=useState<"APPLICATION"|"VERIFY">("APPLICATION");
 const [signed,setSigned]=useState<boolean|null>(null),[verified,setVerified]=useState(false),[loading,setLoading]=useState(true);
 const [apps,setApps]=useState<CG04VolunteerApplication[]>([]),[selected,setSelected]=useState<CG04VolunteerApplication|null>(null);
 const [profile,setProfile]=useState<CG04VolunteerProfile|null>(null),[options,setOptions]=useState<CG04VolunteerOptions|null>(null);
 const [form,setForm]=useState<Form>(blank),[step,setStep]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState(""),[note,setNote]=useState("");
 const seq=useRef(0),pending=useRef<Pending|null>(null),previousRef=useRef<string|null>(null);
 const fill=(key:keyof Form,value:string|boolean)=>setForm(f=>({...f,[key]:value}));
 const refresh=useCallback(async()=>{
  const current=++seq.current;setLoading(true);
  try{
   const status=await api<{verified:boolean}>("/api/community/mobile/status");
   if(current!==seq.current)return;
   setSigned(true);setVerified(status.verified===true);
   if(!status.verified){setApps([]);setSelected(null);setProfile(null);return;}
   const [listed,own]=await Promise.all([api<{items:CG04VolunteerApplication[]}>(base+"/applications"),api<CG04VolunteerProfile>(base+"/me")]);
   if(current!==seq.current||document.visibilityState!=="visible")return;
   setApps(listed.items);setProfile(own);
   setSelected(old=>listed.items.find(x=>x.ref===old?.ref)??listed.items.find(x=>["DRAFT","RETURNED","SUBMITTED"].includes(x.status))??listed.items[0]??null);
  }catch(e){if(current===seq.current){const code=e&&typeof e==="object"&&"status" in e?Number(e.status):0;
   if(code===401){setSigned(false);setVerified(false);setApps([]);setSelected(null);setProfile(null);}
   else setError(e instanceof Error?e.message:"Volunteer status could not be verified.");
  }}finally{if(current===seq.current)setLoading(false);}
 },[]);
 useEffect(()=>{void refresh();return()=>{seq.current++;};},[refresh]);
 useEffect(()=>{
  const incoming=new URLSearchParams(window.location.search).get("ref")??"";
  if(/^[A-Za-z0-9_-]{32}$/.test(incoming))
   setForm(current=>({...current,referral:current.referral||incoming}));
 },[]);
 useEffect(()=>{
  const onHide=()=>{if(document.visibilityState!=="visible"){seq.current++;setApps([]);setSelected(null);setProfile(null);setOptions(null);setForm(blank());setError("");setLoading(true);}
    else void refresh();};
  document.addEventListener("visibilitychange",onHide);
  return()=>document.removeEventListener("visibilitychange",onHide);
 },[refresh]);
 useEffect(()=>{if(!selected){if(previousRef.current){setForm(blank());setStep(0);}previousRef.current=null;return;}
  if(selected.ref!==previousRef.current||form.firstName===""){
   previousRef.current=selected.ref;setForm(toForm(selected));setStep(0);
  }
 },[selected?.ref,selected?.version]);
 useEffect(()=>{
  if(!signed||!verified)return;
  let active=true;
  const params=new URLSearchParams({stateRef:form.stateRef,branchRef:form.branchRef});
  void api<CG04VolunteerOptions>(base+"/applications/options?"+params).then(x=>{if(active&&document.visibilityState==="visible")setOptions(x);}).catch(()=>{if(active)setOptions(null);});
  return()=>{active=false;};
 },[signed,verified,form.stateRef,form.branchRef]);
 const action=async(work:()=>Promise<void>)=>{
  if(busy)return;setBusy(true);setError("");setNote("");
  try{await work();}catch(e){setError(e instanceof Error?e.message:"This result cannot be verified. Refresh and retry the original command.");}
  finally{setBusy(false);}
 };
 const save=()=>void action(async()=>{
  if(!verified)throw Error("Verify your actual mobile number before saving the volunteer application.");
  const fields={firstName:form.firstName.trim(),lastName:form.lastName.trim(),dateOfBirth:form.dateOfBirth,
   gender:form.gender.trim(),bloodGroup:form.bloodGroup||null,address:form.address.trim(),city:form.city.trim(),
   village:form.village.trim(),pinCode:form.pinCode,stateRef:form.stateRef,districtRef:form.districtRef,
   branchRef:form.branchRef||null,departmentRef:form.departmentRef,availability:form.availability,
   skills:form.skills.split(",").map(x=>x.trim()).filter(Boolean),experience:form.experience.trim(),referral:form.referral.trim(),consent:form.consent};
  if(!fields.consent)throw Error("Confirm the original volunteer consent before saving.");
  const ref=selected&&["DRAFT","RETURNED"].includes(selected.status)?selected:null;
  const path=base+"/applications"+(ref?"/"+ref.ref:""),method=ref?"PATCH" as const:"POST" as const;
  const data={...fields,...(ref?{expectedVersion:ref.version}:{}),requestKey:crypto.randomUUID()};
  const digest=JSON.stringify([path,fields,ref?.version]);
  if(!pending.current||pending.current.digest!==digest)pending.current={path,method,body:data,digest};
  const saved=await api<{record:CG04VolunteerApplication}>(pending.current.path,pending.current.method,pending.current.body);
  pending.current=null;setSelected(saved.record);previousRef.current=saved.record.ref;setApps(old=>[saved.record,...old.filter(x=>x.ref!==saved.record.ref)]);
  setNote("Volunteer draft saved. Verify your original identity document before submitting.");
  setStep(3);
 });
 const submit=()=>void action(async()=>{
  if(!selected||!["DRAFT","RETURNED"].includes(selected.status))throw Error("Only an editable volunteer draft can be submitted.");
  const path=base+"/applications/"+selected.ref+"/submit",data={expectedVersion:selected.version,requestKey:crypto.randomUUID()},
   digest=JSON.stringify([path,selected.version]);
  if(!pending.current||pending.current.digest!==digest)pending.current={path,method:"POST",body:data,digest};
  await api(pending.current.path,"POST",pending.current.body);
  pending.current=null;await refresh();setNote("Volunteer application submitted for the Foundation's independent review. Approval is not automatic.");
 });
 const activate=()=>void action(async()=>{
  if(!selected||selected.reviewStatus!=="PENDING_OWNER")throw Error("Independent Foundation approval is not confirmed.");
  const path=base+"/applications/"+selected.ref+"/activate",digest=JSON.stringify([path,selected.version]);
  if(!pending.current||pending.current.digest!==digest)pending.current={path,method:"POST",body:{requestKey:crypto.randomUUID()},digest};
  await api(pending.current.path,"POST",pending.current.body);pending.current=null;await refresh();
  setNote("Original approved volunteer identity confirmed. No employee role or automatic task assignment was created.");
 });
 const changeApplication=(ref:string)=>{
  pending.current=null;
  const app=apps.find(x=>x.ref===ref)??null;setSelected(app);setForm(app?toForm(app):blank());setStep(0);setError("");setNote("");
  previousRef.current=app?.ref??null;
 };
 const field=(label:string,name:keyof Form,type="text",maxLength=120)=><label>{label}<input type={type} value={String(form[name])} maxLength={maxLength}
  disabled={busy||!!selected&&!["DRAFT","RETURNED"].includes(selected.status)} onChange={e=>fill(name,e.target.value)}/></label>;
 const canEdit=!selected||["DRAFT","RETURNED"].includes(selected.status);
 return <section className="cg04-public cg04-volunteer" aria-label="Original Foundation volunteer enrolment">
  <div className="cg04-volunteer-hero">{intro?.eyebrow&&<small>{intro.eyebrow}</small>}<h1>{intro?.heading??"Volunteer registration"}</h1>
   {intro?.body&&<p>{intro.body}</p>}{intro?.highlights.length? <ol>{intro.highlights.map((line,i)=><li key={i}>{line}</li>)}</ol>:null}<p>Your application and evidence remain private until independently reviewed.</p></div>
  <div className="cg04-public-tabs" role="tablist" aria-label="Volunteer application and original issued-card verification">
   <button type="button" role="tab" aria-selected={tab==="APPLICATION"} onClick={()=>setTab("APPLICATION")}>Application Form</button>
   <button type="button" role="tab" aria-selected={tab==="VERIFY"} onClick={()=>setTab("VERIFY")}>Verify Volunteer</button>
  </div>
  {tab==="VERIFY"?<PublicVolunteerVerification/>:<div role="tabpanel" aria-label="Volunteer application">
  {error&&<p role="alert" className="cg04-error">{error}</p>}{note&&<p role="status">{note}</p>}
  {loading&&<p role="status">Confirming your original volunteer account…</p>}
  {!loading&&signed===false&&<CommunityAuth onSignedIn={async()=>{await refresh();}}/>}
  {signed&&(!verified?<p className="cg04-panel">Verify your current mobile contact to access a volunteer application. Your existing CareGanga account is reused.</p>:<>
   <div className="cg04-panel"><h2>Your volunteer applications</h2>
    <div className="cg04-buttons"><button type="button" disabled={busy} onClick={()=>changeApplication("")}>New volunteer application</button>
     {apps.map(a=><button key={a.ref} type="button" aria-pressed={selected?.ref===a.ref} onClick={()=>changeApplication(a.ref)}>{a.applicationNumber} · {display(a.status)}</button>)}
     <button type="button" disabled={busy} onClick={()=>void refresh()}>Refresh current status</button>
     <button type="button" disabled={busy} onClick={()=>void action(async()=>{await api("/api/community/logout","POST",{});seq.current++;setSigned(false);setApps([]);setSelected(null);setProfile(null);})}>Sign out</button>
    </div>
    {profile?.volunteer&&<p role="status"><strong>Approved volunteer:</strong> {profile.volunteer.volunteerNumber} · {profile.volunteer.name} · {display(profile.volunteer.status)} · {profile.volunteer.department}</p>}
    {selected&&<p>Current application: <strong>{selected.applicationNumber} · {display(selected.status)}</strong>{selected.reviewReference?" · Foundation review "+selected.reviewReference:""}{selected.reviewRemarks?" · Reviewer feedback: "+selected.reviewRemarks:""}</p>}
   </div>
   {profile?.volunteer&&<VolunteerOwnCard current={profile.volunteer.volunteerNumber}/>}
    <PublicRewardsCatalogue/>
 <PublicReferralCode/>
   {canEdit&&<section className="cg04-panel">
    <h2>Volunteer application</h2><nav className="cg04-volunteer-steps" aria-label="Four application steps">
     {steps.map((title,i)=><button type="button" aria-label={`Step ${i+1}: ${title}`} aria-current={step===i?"step":undefined} key={title} disabled={busy} onClick={()=>setStep(i)}><span className="cg04-volunteer-step-number" aria-hidden="true">{i+1}</span><span>{title}</span></button>)}
    </nav>
    {step===0&&<div className="cg04-document-grid">{field("First name","firstName")}{field("Last name","lastName")}{field("Date of birth","dateOfBirth","date",10)}
     {field("Gender","gender")}<label>Blood group (optional)<select value={form.bloodGroup} onChange={e=>fill("bloodGroup",e.target.value)}>
       <option value="">Prefer not to provide</option>{["A+","A-","B+","B-","AB+","AB-","O+","O-"].map(g=><option key={g}>{g}</option>)}
     </select></label><p className="cg04-muted">Your verified account supplies your current mobile and email; no separate unverified identity is created.</p></div>}
    {step===1&&<div className="cg04-document-grid">{field("Street and building address","address","text",1000)}{field("City","city")}
     {field("Village (optional)","village")}{field("Six-digit PIN","pinCode","text",6)}
     <label>State<select value={form.stateRef} onChange={e=>setForm(old=>({...old,stateRef:e.target.value,districtRef:""}))}>
      <option value="">Choose state</option>{options?.states.map(x=><option value={x.value} key={x.value}>{x.label}</option>)}</select></label>
     <label>District<select value={form.districtRef} onChange={e=>fill("districtRef",e.target.value)}>
      <option value="">Choose district</option>{options?.districts.map(x=><option value={x.value} key={x.value}>{x.label}</option>)}</select></label></div>}
    {step===2&&<div className="cg04-document-grid">
     <label>Preferred Foundation branch<select value={form.branchRef} onChange={e=>setForm(old=>({...old,branchRef:e.target.value,departmentRef:""}))}>
      <option value="">Foundation-wide</option>{options?.branches.map(x=><option value={x.value} key={x.value}>{x.label}</option>)}</select></label>
     <label>Volunteer department<select value={form.departmentRef} onChange={e=>fill("departmentRef",e.target.value)}>
      <option value="">Choose current department</option>{options?.departments.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></label>
     <label>Availability<select value={form.availability} onChange={e=>fill("availability",e.target.value)}>
      {(["FULL_TIME","PART_TIME","WEEKENDS","FLEXIBLE"] as const).map(x=><option key={x} value={x}>{display(x)}</option>)}</select></label>
     {field("Skills and interests (comma-separated)","skills","text",1500)}
     <label className="cg04-volunteer-span">Relevant experience<textarea maxLength={1000} value={form.experience} onChange={e=>fill("experience",e.target.value)}/></label></div>}
    {step===3&&<div className="cg04-document-grid">{field("Referral (optional)","referral","text",100)}
  <ReferralCodeCheck code={form.referral}/>
     <label className="cg04-volunteer-span"><input type="checkbox" checked={form.consent} onChange={e=>fill("consent",e.target.checked)}/>
      I consent to the Foundation processing my submitted volunteer application and secure identity evidence for enrollment review.</label>
     <p className="cg04-muted cg04-volunteer-span">Check your original application details, save the draft, then verify an identity document. A reviewer must approve the submitted version before any volunteer number is created.</p></div>}
    <div className="cg04-buttons"><button type="button" disabled={busy||step===0} onClick={()=>setStep(x=>Math.max(0,x-1))}>Previous</button>
     <button type="button" disabled={busy||step===3} onClick={()=>setStep(x=>Math.min(3,x+1))}>Next step</button>
     <button type="button" className="cg04-primary" disabled={busy||!form.consent} onClick={save}>Save original volunteer draft</button></div>
   </section>}
   {selected&&<VolunteerEvidencePanel applicationRef={selected.ref} version={selected.version} editable={canEdit} onChange={()=>void refresh()}/>}
   {selected&&canEdit&&<div className="cg04-panel"><h3>Submit for independent review</h3>
    <p>Submission requires one original CG-19 scan-verified identity document. Pending upload, missing review policy or stale selections will block submission without marking you approved.</p>
    <button type="button" className="cg04-primary" disabled={busy} onClick={submit}>Submit original application</button></div>}
   {selected?.status==="SUBMITTED"&&<div className="cg04-panel"><h3>Foundation approval status</h3>
    <p>{selected.reviewStatus?display(selected.reviewStatus):"Submitted; awaiting original Foundation review."}</p>
    {selected.reviewStatus==="PENDING_OWNER"&&<button type="button" disabled={busy} className="cg04-primary" onClick={activate}>Confirm approved volunteer registration</button>}
   </div>}
  </>)}
 </div>}
 </section>;
}
