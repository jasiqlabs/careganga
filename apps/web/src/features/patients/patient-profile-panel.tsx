"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {MyConsultationHistory} from "../appointments/my-consultation-history";
import {PatientPrivateFilesPanel} from "./patient-private-files-panel";
import {PatientPartnerClaims} from "./patient-partner-claims";
import {PatientPrivateDetailsPanel} from "./patient-private-details-panel";

type Profile={virtualPatientId:string;firstName:string;lastName:string;
 dateOfBirth:string|null;profileStatus:string;version:number;canLinkAnotherAccount?:boolean;
 consentGranted:boolean;consentVersion:string|null};
type Consent={available:boolean;version:string|null;text:string|null};
type Contact={hasNumber:boolean;verified:boolean;providerConfigured:boolean;maskedContact:string|null};
type Verification={status:string;message?:string};
type ApiError={message?:string};
async function request<T>(path:string,method="GET",body?:Record<string,unknown>):Promise<T>{
 const response=await fetch("/api/patients/"+path,{method,cache:"no-store",
  headers:body?{"Content-Type":"application/json"}:undefined,
  body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
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
 const [signupMode,setSignupMode]=useState(false);
 const [signupFirst,setSignupFirst]=useState(""),[signupLast,setSignupLast]=useState("");
 const [signupMobile,setSignupMobile]=useState(""),[signupEmail,setSignupEmail]=useState("");
 const [signupPassword,setSignupPassword]=useState("");
 const [signupCode,setSignupCode]=useState("");
 const [signupRequestedMobile,setSignupRequestedMobile]=useState("");
 const [first,setFirst]=useState(""),[last,setLast]=useState("");
 const [dob,setDob]=useState(""),[agree,setAgree]=useState(false);
 const [message,setMessage]=useState("");
 const [contact,setContact]=useState<Contact|null>(null);
 const [verificationCode,setVerificationCode]=useState("");
 const [identityProof,setIdentityProof]=useState<{verificationCode:string;expiresAt:string}|null>(null);
 const [claimDisplay,setClaimDisplay]=useState(""),[claimCode,setClaimCode]=useState("");
 const [claimAgree,setClaimAgree]=useState(false);
 const [secondLogin,setSecondLogin]=useState("");
 const [secondCode,setSecondCode]=useState<{authorizationCode:string;expiresAt:string}|null>(null);
 const [secondAcceptCode,setSecondAcceptCode]=useState("");
 const [secondConfirmed,setSecondConfirmed]=useState(false);
 const pendingRegistration=useRef<{digest:string;key:string}|null>(null);
 const signupCommand=useRef<{digest:string;key:string}|null>(null);
 const clearPrivate=useCallback(()=>{
  setSignedIn(false);setProfile(null);setContact(null);setIdentityProof(null);
  setFirst("");setLast("");setDob("");setAgree(false);setPassword("");
  setVerificationCode("");setClaimDisplay("");setClaimCode("");setClaimAgree(false);
  setSecondLogin("");setSecondCode(null);setSecondAcceptCode("");setSecondConfirmed(false);
  pendingRegistration.current=null;
 },[]);
 const refresh=useCallback(async()=>{
  try{
   const response=await fetch("/api/patients/me",{cache:"no-store",signal:AbortSignal.timeout(15000)});
   if(response.status===401){clearPrivate();return false;}
   if(!response.ok&&response.status!==404)throw Error("Your patient profile could not be checked. Try again.");
   const status=await request<Contact>("mobile/status");
   if(!status||typeof status.verified!=="boolean"||typeof status.hasNumber!=="boolean"||typeof status.providerConfigured!=="boolean")
    throw Error("Your account contact status could not be confirmed.");
   if(response.status===404){clearPrivate();setContact(status);setSignedIn(true);return true;}
   const current=await response.json() as Profile;
   if(!current||typeof current.virtualPatientId!=="string"||!current.virtualPatientId||
    typeof current.firstName!=="string"||typeof current.lastName!=="string"||
    !["PROVISIONAL","VERIFIED"].includes(current.profileStatus)||
    !Number.isSafeInteger(current.version)||typeof current.consentGranted!=="boolean")
    throw Error("Your patient profile could not be confirmed.");
   setContact(status);setSignedIn(true);setProfile(current);
   if(current.profileStatus!=="PROVISIONAL")setIdentityProof(null);
   setFirst(current.firstName);setLast(current.lastName);setDob(current.dateOfBirth??"");
   return true;
  }catch(e){clearPrivate();throw e;}
 },[clearPrivate]);
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
 async function requestSignupCode(){
  await act(async()=>{
   const mobile=signupMobile.trim();
   if(!/^[6-9][0-9]{9}$/.test(mobile))
    throw Error("Enter a valid 10-digit Indian mobile number.");
   const result=await request<{status:string}>("signup/start","POST",{mobile});
   if(result.status!=="CODE_REQUESTED_UNCONFIRMED_DELIVERY")
    throw Error("The code request could not be confirmed. Please retry.");
   setSignupRequestedMobile(mobile);
   setMessage("A mobile verification code was requested. Delivery is not guaranteed. Enter the received code before creating an account.");
  });
 }
 async function createAccount(){
  await act(async()=>{
   const payload={firstName:signupFirst.trim(),lastName:signupLast.trim(),
    mobile:signupMobile.trim(),email:signupEmail.trim()||null,
    password:signupPassword,code:signupCode.trim()};
   const signature=JSON.stringify(payload);
   if(signupCommand.current?.digest!==signature)
    signupCommand.current={digest:signature,key:crypto.randomUUID()};
   const result=await request<{status:string;nextStep:string}>("signup","POST",{
    requestKey:signupCommand.current.key,...payload
   });
   if(result.status!=="ACCOUNT_CREATED")
    throw Error("Your account could not be confirmed. Please check the original request.");
   signupCommand.current=null;setSignupPassword("");setSignupCode("");setPassword("");
   setIdentifier(payload.email||payload.mobile);setSignupMode(false);
   setMessage("Your CareGanga account was created with a verified contact number. Sign in using your email (if provided) or your own mobile login and password. A shared family phone never links patient records automatically.");
  });
 }
 async function login(){
  await act(async()=>{
   const result=await request<{signedIn:boolean}>("login","POST",{identifier,password});
   setPassword("");pendingRegistration.current=null;
   if(result?.signedIn!==true||!await refresh())throw Error("Sign-in could not be confirmed. Please try again.");
   setMessage("Signed in. Your private patient information is available.");
  });
 }
 async function logout(){
  await act(async()=>{
   try{
    const result=await request<{signedOut:boolean}>("logout","POST");
    if(result?.signedOut!==true)throw Error("Sign-out could not be confirmed. Close this page if using a shared device.");
   }finally{clearPrivate();}
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
   setVerificationCode("");if(!await refresh())throw Error("Sign in again to check your contact status.");
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
 async function claimClinicIntake(){
  await act(async()=>{
   if(!policy.available||!claimAgree||!contact?.verified)
    throw Error("Verify your account contact and accept the patient-care consent.");
   const current=await request<Profile>("me/claim-intake","POST",{
    virtualPatientId:claimDisplay,claimCode,
    consentAccepted:claimAgree,consentVersion:policy.version});
   setProfile(current);setFirst(current.firstName);setLast(current.lastName);
   setDob(current.dateOfBirth??"");setClaimCode("");setClaimAgree(false);
   setMessage("Your clinic-created patient record is now linked to your own verified account.");
  });
 }
 async function issueSecondLoginLink(){
  await act(async()=>{
   if(!profile?.canLinkAnotherAccount||!profile.consentGranted)
    throw Error("Your current verified patient account cannot issue a second-login link.");
   const data=await request<{authorizationCode:string;expiresAt:string}>(
    "me/second-account-link-code","POST",{
     recipientIdentifier:secondLogin.trim(),personallyConfirmed:true});
   setSecondCode(data);
   setMessage("A one-time code was issued only for the specific second account login. Share it privately, not by public message.");
  });
 }
 async function acceptSecondLoginLink(){
  await act(async()=>{
   if(!secondConfirmed||!contact?.verified)
    throw Error("Verify your own account contact and confirm this is your patient identity.");
   const linked=await request<Profile>("me/accept-second-account","POST",{
    authorizationCode:secondAcceptCode.trim().toUpperCase(),
    personallyConfirmed:secondConfirmed});
   setProfile(linked);setFirst(linked.firstName);setLast(linked.lastName);
   setDob(linked.dateOfBirth??"");setSecondAcceptCode("");setSecondConfirmed(false);
   setMessage("Your other personal login was linked to your existing verified patient profile. Staff permissions have not changed.");
  });
 }
 async function issueIdentityProof(){
  await act(async()=>{
   const result=await request<{verificationCode:string;expiresAt:string}>(
    "me/identity-verification","POST",{});
   setIdentityProof(result);
   setMessage("Show this one-time code with a valid identity document to assigned healthcare-center staff. The code expires in 15 minutes.");
  });
 }
 return <section className="cg-public-section cg-health-patient-profile">
  <p className="cg-eyebrow">CareGanga · Private patient information</p>
  <h1>My patient profile</h1>
  <p>Create a patient account or use your registered CareGanga password account. Your Virtual Patient ID is
   a CareGanga reference, not an ABHA or government health ID.</p>
  {!!message&&<p role="alert" aria-live="polite">{message}</p>}
  {loading?<p>Checking your current account…</p>:!signedIn?
   signupMode?<form onSubmit={e=>{e.preventDefault();void createAccount();}}
    style={{display:"grid",gap:12,maxWidth:500}}>
    <h2>Create a patient account</h2>
    <label>First name <input required value={signupFirst} maxLength={100}
     autoComplete="given-name" onChange={e=>setSignupFirst(e.target.value)}/></label>
    <label>Last name <input required value={signupLast} maxLength={100}
     autoComplete="family-name" onChange={e=>setSignupLast(e.target.value)}/></label>
    <label>Registered mobile number (10 digits)
     <input required inputMode="numeric" pattern="[6-9][0-9]{9}" value={signupMobile}
      maxLength={10} autoComplete="tel" onChange={e=>{setSignupMobile(e.target.value);setSignupRequestedMobile("");setSignupCode("");}}/></label>
    <label>Email (optional)
     <input type="email" value={signupEmail} maxLength={254}
      autoComplete="email" onChange={e=>setSignupEmail(e.target.value)}/></label>
    <label>Choose a password (at least eight characters)
     <input type="password" required minLength={8} maxLength={1024}
      autoComplete="new-password" value={signupPassword}
      onChange={e=>setSignupPassword(e.target.value)}/></label>
    <p>Prove this mobile number belongs to you before creating an account.
     This does not establish a verified clinical identity or create an appointment.</p>
    <button type="button" disabled={busy||!/^[6-9][0-9]{9}$/.test(signupMobile)}
     onClick={()=>void requestSignupCode()}>
     {busy?"Checking…":"Send mobile verification code"}</button>
    {!!signupRequestedMobile&&signupRequestedMobile===signupMobile.trim()&&<label>Verification code received
     <input type="text" required inputMode="numeric" pattern="[0-9]{4,10}"
      maxLength={10} autoComplete="one-time-code" value={signupCode}
      onChange={e=>setSignupCode(e.target.value)}/></label>}
    <p>After signup, sign in with your usual mobile and password.
     Ordinary login does not require an extra verification factor.</p>
    <button type="submit" disabled={busy||!signupFirst.trim()||!signupLast.trim()||
     !/^[6-9][0-9]{9}$/.test(signupMobile)||signupPassword.length<8||
      signupRequestedMobile!==signupMobile.trim()||!/^[0-9]{4,10}$/.test(signupCode)}>
     {busy?"Checking…":"Create patient account"}</button>
    <button type="button" disabled={busy} onClick={()=>{setSignupPassword("");setSignupCode("");setSignupMode(false);}}>
     Already registered? Sign in</button>
   </form>:
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
    <button type="button" disabled={busy} onClick={()=>setSignupMode(true)}>
     New patient? Create a CareGanga account</button>
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
    {profile&&<MyConsultationHistory key={profile.virtualPatientId}/>}
    {profile?.profileStatus==="PROVISIONAL"&&<section
     aria-label="Verify your patient identity at a healthcare center"
     style={{border:"1px solid #d7dfdb",borderRadius:12,padding:16}}>
     <h2>Verify patient identity</h2>
     <p>Your mobile number verifies your account, not a patient's clinical identity.
      Visit an approved CareGanga healthcare center with an identity document.
      Show an authorized receptionist your Virtual Patient ID and one-time code.</p>
     <button type="button" disabled={busy||!profile.consentGranted}
      onClick={()=>void issueIdentityProof()}>
      {busy?"Checking…":"Get in-person verification code"}</button>
     {identityProof&&<p role="status">
      Your code: <strong style={{fontFamily:"monospace",letterSpacing:1}}>
       {identityProof.verificationCode}</strong>
      <span> · Expires {new Date(identityProof.expiresAt).toLocaleTimeString("en-IN")}</span>
     </p>}
     <button type="button" disabled={busy}
      onClick={()=>void act(async()=>{if(!await refresh())throw Error("Sign in again to check your patient profile.");setMessage("Current identity status refreshed.");})}>
      Check current verification status</button>
    </section>}
    {!profile&&<p>You do not yet have a CareGanga patient profile.
     Verified contact and approved patient-care consent are required to create one.</p>}
    {!profile&&<section aria-label="Claim your clinic-created patient record"
     style={{padding:16,border:"1px solid #d7dfdb",borderRadius:12}}>
     <h2>Already registered at a healthcare center?</h2>
     <p>If clinic staff created your provisional patient record, ask them for
      the private one-time claim code after they check your identity document.
      This does not use or merge records based on a shared family mobile number.</p>
     <form onSubmit={e=>{e.preventDefault();void claimClinicIntake();}}
      style={{display:"grid",gap:10}}>
      <label>CareGanga Virtual Patient ID
       <input type="text" required maxLength={20} value={claimDisplay}
        onChange={e=>setClaimDisplay(e.target.value.trim().toUpperCase())}
        placeholder="CGP-XXXXXXXXXXXXXXXX"/></label>
      <label>One-time code from your healthcare center
       <input type="text" required maxLength={28} value={claimCode}
        onChange={e=>setClaimCode(e.target.value.trim().toUpperCase())}
        placeholder="CGC-XXXXXXXXXXXXXXXXXXXXXXXX"/></label>
      {policy.available?<><h3>Patient-care consent</h3>
       <p style={{whiteSpace:"pre-wrap"}}>{policy.text}</p>
       <label><input type="checkbox" checked={claimAgree}
        onChange={e=>setClaimAgree(e.target.checked)}/>
        {" "}I accept the current patient-care consent and am the person verified at the center.</label>
      </>:<p role="alert">Approved patient-care consent is not configured.</p>}
      <button type="submit" disabled={busy||!policy.available||!claimAgree||
       !contact?.verified||!/^CGP-[A-F0-9]{16}$/.test(claimDisplay)||
       !/^CGC-[A-F0-9]{24}$/.test(claimCode)}>Claim my patient record</button>
     </form>
    </section>}
    {!profile&&<section aria-label="Use approved second account for same verified patient"
     style={{padding:16,border:"1px solid #d7dfdb",borderRadius:12}}>
     <h2>Already have a patient profile under another personal login?</h2>
     <p>Sign in to your original verified patient account first and create a
      recipient-specific one-time link code for this account's email or mobile login.
      Sharing a family phone never links two different people automatically.</p>
     <label>One-time code from your original patient login
      <input type="text" value={secondAcceptCode} maxLength={36}
       onChange={e=>setSecondAcceptCode(e.target.value.trim().toUpperCase())}
       placeholder="CGL-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"/></label>
     <label><input type="checkbox" checked={secondConfirmed}
      onChange={e=>setSecondConfirmed(e.target.checked)}/>
      {" "}This second login belongs to me, the same individually verified patient;
      I understand this links my existing private patient records.</label>
     <button type="button" disabled={busy||!contact?.verified||!secondConfirmed||
      !/^CGL-[A-F0-9]{32}$/.test(secondAcceptCode)}
      onClick={()=>void acceptSecondLoginLink()}>
      Link this second personal account</button>
    </section>}
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
     <h2>Personal information</h2>
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
    {profile?.profileStatus==="VERIFIED"&&profile.consentGranted&&
     profile.canLinkAnotherAccount&&<section aria-label="Link another personal account"
      style={{padding:16,border:"1px solid #d7dfdb",borderRadius:12}}>
      <h2>Use this patient profile from another account you own</h2>
      <p>Only link a second CareGanga login belonging to you, the same verified
       person. Enter its unique login email or mobile number. Other family
       members must have their own patient identity; no staff role or membership
       permission is copied.</p>
      <label>Other personal account's login
       <input type="text" maxLength={254} value={secondLogin}
        autoComplete="off" onChange={e=>{setSecondLogin(e.target.value);setSecondCode(null);}}
        placeholder="Second account's email or mobile"/></label>
      <button type="button" disabled={busy||secondLogin.trim().length<6}
       onClick={()=>void issueSecondLoginLink()}>Issue private one-time link code</button>
      {secondCode&&<p role="status">Only enter this code when signed in to that
       exact second account: <strong style={{fontFamily:"monospace"}}>
       {secondCode.authorizationCode}</strong>.
       Expires {new Date(secondCode.expiresAt).toLocaleTimeString("en-IN")}.
       This is not permission for another person or a family member.</p>}
     </section>}
    {profile?.profileStatus==="VERIFIED"&&
     <PatientPrivateDetailsPanel key={profile.virtualPatientId+":details"}
      consentGranted={profile.consentGranted}/>}
    {profile?.profileStatus==="VERIFIED"&&
     <PatientPrivateFilesPanel key={profile.virtualPatientId}
      consentGranted={profile.consentGranted}/>}
    {profile?.profileStatus==="VERIFIED"&&
     <PatientPartnerClaims key={profile.virtualPatientId+":claims"}
      consentGranted={profile.consentGranted}/>}
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
