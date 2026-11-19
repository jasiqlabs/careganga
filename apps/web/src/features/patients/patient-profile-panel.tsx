"use client";
import {useCallback,useEffect,useRef,useState} from "react";

type Profile={virtualPatientId:string;firstName:string;lastName:string;
 dateOfBirth:string|null;profileStatus:string;version:number;
 consentGranted:boolean;consentVersion:string|null};
type Consent={available:boolean;version:string|null;text:string|null};
type Contact={hasNumber:boolean;verified:boolean;providerConfigured:boolean;maskedContact:string|null};
type Verification={status:string;message?:string};
type ApiError={message?:string};
async function request<T>(path:string,method="GET",body?:Record<string,unknown>):Promise<T>{
 const response=await fetch("/api/patients/"+path,{method,cache:"no-store",
  headers:body?{"Content-Type":"application/json"}:undefined,
  body:body?JSON.stringify(body):undefined});
 const data:unknown=await response.json().catch(()=>null);
 if(!response.ok){
  const msg=data&&typeof data==="object"&&"message" in data?
   (data as ApiError).message:null;
  throw Error(typeof msg==="string"?msg:"Patient information cannot be confirmed.");
 }
 return data as T;
}
export function PatientProfilePanel(){
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [signedIn,setSignedIn]=useState(false);
 const [profile,setProfile]=useState<Profile|null>(null);
 const [policy,setPolicy]=useState<Consent>({available:false,version:null,text:null});
 const [identifier,setIdentifier]=useState(""),[password,setPassword]=useState("");
 const [first,setFirst]=useState(""),[last,setLast]=useState("");
 const [dob,setDob]=useState(""),[agree,setAgree]=useState(false);
 const [message,setMessage]=useState("");
 const [contact,setContact]=useState<Contact|null>(null);
 const [verificationCode,setVerificationCode]=useState("");
 const pendingRegistration=useRef<{digest:string;key:string}|null>(null);
 const refresh=useCallback(async()=>{
  const response=await fetch("/api/patients/me",{cache:"no-store"});
  if(response.status===401){setSignedIn(false);setProfile(null);setContact(null);return;}
  const status=await request<Contact>("mobile/status");
  setContact(status);
  setSignedIn(true);
  if(response.status===404){setProfile(null);return;}
  if(!response.ok)throw Error("Your patient profile could not be checked. Try again.");
  const current=await response.json() as Profile;
  setProfile(current);setFirst(current.firstName);setLast(current.lastName);
  setDob(current.dateOfBirth??"");
 },[]);
 useEffect(()=>{
  let active=true;
  void Promise.all([request<Consent>("policy"),refresh()])
   .then(([p])=>{if(active)setPolicy(p);})
   .catch(e=>{if(active)setMessage(e instanceof Error?e.message:
    "Patient information is unavailable.");})
   .finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[refresh]);
 async function act(work:()=>Promise<void>){
  if(busy)return;
  setBusy(true);setMessage("");
  try{await work();}
  catch(e){setMessage(e instanceof Error?e.message:"The result could not be confirmed.");}
  finally{setBusy(false);}
 }
 async function login(){
  await act(async()=>{
   await request<{signedIn:boolean}>("login","POST",{identifier,password});
   setPassword("");pendingRegistration.current=null;await refresh();
   setMessage("Signed in. Your private patient information is available.");
  });
 }
 async function logout(){
  await act(async()=>{
   await request<{signedOut:boolean}>("logout","POST");
   setSignedIn(false);setProfile(null);setContact(null);setPassword("");setAgree(false);
   pendingRegistration.current=null;
   setMessage("Signed out of your patient profile.");
  });
 }
 async function startVerification(){
  await act(async()=>{
   const result=await request<Verification>("mobile/start","POST",{});
   setMessage(result.status==="ALREADY_VERIFIED"?"Your mobile contact is verified.":
    result.status==="CODE_REQUESTED_UNCONFIRMED_DELIVERY"?
    "A verification code was requested. Delivery is not guaranteed; check your phone.":
    "The verification request outcome is uncertain. Check before retrying.");
   await refresh();
  });
 }
 async function confirmVerification(){
  await act(async()=>{
   if(!/^\d{4,10}$/.test(verificationCode))
    throw Error("Enter the verification code received on your phone.");
   const result=await request<Verification>("mobile/confirm","POST",{code:verificationCode});
   if(result.status!=="VERIFIED"){
    setMessage(result.status==="NOT_VERIFIED"?
     "That code could not be verified. Check the code and try again.":
     "Verification status is uncertain. Check current contact status before retrying.");
    return;
   }
   setVerificationCode("");await refresh();
   setMessage("Your account mobile contact is verified.");
  });
 }
 async function register(){
  await act(async()=>{
   const payload={firstName:first,lastName:last,
    dateOfBirth:dob||null,consentVersion:policy.version,consentAccepted:agree};
   const digest=JSON.stringify(payload);
   if(pendingRegistration.current?.digest!==digest)
    pendingRegistration.current={digest,key:crypto.randomUUID()};
   const result=await request<Profile>("registration","POST",{
    requestKey:pendingRegistration.current.key,...payload
   });
   pendingRegistration.current=null;setProfile(result);setMessage("Your CareGanga patient profile has been created.");
  });
 }
 async function save(){
  if(!profile)return;
  await act(async()=>{
   const result=await request<Profile>("me","PATCH",{
    expectedVersion:profile.version,firstName:first,lastName:last,
    dateOfBirth:dob||null
   });
   setProfile(result);setMessage("Your patient profile was updated.");
  });
 }
 async function changeConsent(granted:boolean){
  if(!profile)return;
  await act(async()=>{
   const result=await request<Profile>("me/consent","POST",{
    expectedVersion:profile.version,granted,
    consentVersion:granted?policy.version:profile.consentVersion
   });
   setProfile(result);
   setMessage(granted?"Your consent is recorded.":"Your consent withdrawal is recorded.");
  });
 }
 return <section className="cg-public-section">
  <p className="cg-eyebrow">CareGanga · Private patient information</p>
  <h1>My patient profile</h1>
  <p>Use your existing CareGanga password account. Your Virtual Patient ID is
   a CareGanga reference, not an ABHA or government health ID.</p>
  {!!message&&<p role="alert" aria-live="polite">{message}</p>}
  {loading?<p>Checking your current account…</p>:!signedIn?
   <form onSubmit={e=>{e.preventDefault();void login();}}
    style={{display:"grid",gap:12,maxWidth:500}}>
    <label>Registered mobile number or email
     <input type="text" autoComplete="username" required value={identifier}
      onChange={e=>setIdentifier(e.target.value)} maxLength={254}/></label>
    <label>Password
     <input type="password" autoComplete="current-password" required
      value={password} onChange={e=>setPassword(e.target.value)}/></label>
    <button disabled={busy||!identifier.trim()||!password} type="submit">
     {busy?"Checking…":"Sign in"}</button>
    <p>New password-account signup is not available on this page.
     A previously registered CareGanga account is required.</p>
   </form>:
   <div style={{display:"grid",gap:16,maxWidth:700}}>
    <div style={{display:"flex",justifyContent:"flex-end"}}>
     <button type="button" disabled={busy} onClick={()=>void logout()}>Sign out</button>
    </div>
    {profile&&<aside style={{border:"1px solid #d7dfdb",borderRadius:12,padding:16}}>
     <strong>Your Virtual Patient ID: {profile.virtualPatientId}</strong>
     <p>Profile: {profile.profileStatus==="PROVISIONAL"?"Contact-verified; identity verification pending":profile.profileStatus} · Patient-care consent:
      {profile.consentGranted?" Granted":" Withdrawn"}</p>
    </aside>}
    {!profile&&<p>You do not yet have a CareGanga patient profile.
     Verified contact and approved patient-care consent are required to create one.</p>}
    {!profile&&<section aria-label="Verify registered account contact"
     style={{border:"1px solid #d7dfdb",borderRadius:12,padding:16}}>
     <h2>Verify your account mobile contact</h2>
     {contact?.verified?<p>Your existing CareGanga contact is verified.</p>:
      !contact?.hasNumber?<p>Your existing account does not have a verification contact recorded.
       Ask CareGanga Foundation to update your registered contact before creating a patient profile.</p>:
      !contact?.providerConfigured?<p>Mobile verification is not configured yet.
       Patient registration is unavailable until the Foundation enables verification.</p>:
      <div style={{display:"grid",gap:12}}>
       <p>A code will be sent to your account's saved contact
        {contact.maskedContact?" ending "+contact.maskedContact:""}.
        This does not grant access to another family member's patient profile.</p>
       <button type="button" disabled={busy} onClick={()=>void startVerification()}>
        Request verification code</button>
       <label>One-time code
        <input inputMode="numeric" autoComplete="one-time-code" value={verificationCode}
         onChange={e=>setVerificationCode(e.target.value)} maxLength={10}/></label>
       <button type="button" disabled={busy||!/^\d{4,10}$/.test(verificationCode)}
        onClick={()=>void confirmVerification()}>Verify code</button>
      </div>}
    </section>}
    <form onSubmit={e=>{e.preventDefault();void (profile?save():register());}}
     style={{display:"grid",gap:12}}>
     <label>First name
      <input required value={first} maxLength={100}
       onChange={e=>setFirst(e.target.value)}/></label>
     <label>Last name
      <input required value={last} maxLength={100}
       onChange={e=>setLast(e.target.value)}/></label>
     <label>Date of birth (optional)
      <input type="date" value={dob} onChange={e=>setDob(e.target.value)}
       max={new Date().toISOString().slice(0,10)}/></label>
     {!profile&&<div style={{border:"1px solid #d7dfdb",padding:16,borderRadius:12}}>
      <h2>Patient-care consent</h2>
      {policy.available?<><p style={{whiteSpace:"pre-wrap"}}>{policy.text}</p>
       <label><input type="checkbox" checked={agree}
        onChange={e=>setAgree(e.target.checked)}/>
        {" "}I have read and agree to the patient-care consent above.</label>
       </>:<p role="alert">Approved patient-consent text is not configured.
        Registration is temporarily unavailable.</p>}
     </div>}
     <button type="submit" disabled={busy||(!profile&&(!policy.available||!agree||!contact?.verified))}>
      {busy?"Saving…":profile?"Save patient details":"Create my patient profile"}
     </button>
    </form>
    {profile&&<section aria-label="Manage patient-care consent">
     <h2>My consent</h2>
     <p>You can withdraw your permission for new patient-care information sharing.
      Past legally retained records remain protected.</p>
     {!profile.consentGranted&&policy.available&&
      <p style={{whiteSpace:"pre-wrap"}}>{policy.text}</p>}
     <button type="button" disabled={busy||(!policy.available&&!profile.consentGranted)}
      onClick={()=>void changeConsent(!profile.consentGranted)}>
      {profile.consentGranted?"Withdraw patient-care consent":"Grant patient-care consent"}
     </button>
    </section>}
   </div>}
 </section>;
}
