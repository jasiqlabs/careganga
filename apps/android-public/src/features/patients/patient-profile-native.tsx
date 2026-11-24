import {useCallback,useEffect,useRef,useState} from "react";
import {
 ActivityIndicator,AppState,BackHandler,Platform,Pressable,ScrollView,StyleSheet,
 Text,TextInput,View
} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import {NativeConsultationHistory} from "../appointments/native-consultation-history";
import {NativePatientPrivateDetails} from "./native-patient-private-details";
import {NativePatientDatePicker} from "./native-patient-date-picker";
import {NativePatientPrivateFiles} from "./native-patient-private-files";
import {NativePatientPartnerClaims} from "./native-patient-partner-claims";
import {NativeMyLabReports} from "./native-my-lab-reports";
import {careGangaTheme as theme} from "../../../../../packages/design-tokens/src/index";

const KEY="cg_public_patient_only_session";
const base=process.env.EXPO_PUBLIC_API_URL;
type Patient={virtualPatientId:string;firstName:string;lastName:string;
 dateOfBirth:string|null;profileStatus:string;version:number;canLinkAnotherAccount?:boolean;
 consentGranted:boolean;consentVersion:string|null};
type Policy={available:boolean;version:string|null;text:string|null};
type Contact={hasNumber:boolean;verified:boolean;providerConfigured:boolean;maskedContact:string|null};
type Verification={status:string;message?:string};
function endpoint(path:string){
 if(!base||!/^https?:\/\//.test(base)||
  (process.env.NODE_ENV==="production"&&!base.startsWith("https://")))
  throw Error("CareGanga patient records are not configured.");
 return new URL(path,base).toString();
}
async function invoke<T>(path:string,method="GET",body?:Record<string,unknown>,
 token?:string|null):Promise<{status:number;data:T|null}>{
 const r=await fetch(endpoint(path),{method,cache:"no-store",
  signal:AbortSignal.timeout(10000),
  headers:{...(token?{Authorization:"Bearer "+token}:{}),
   ...(body?{"Content-Type":"application/json"}:{})},
  body:body?JSON.stringify(body):undefined});
 if(r.status===401)return {status:401,data:null};
 if(r.status===404)return {status:404,data:null};
 if(!r.ok){
  const value:unknown=await r.json().catch(()=>null);
  const message=value&&typeof value==="object"&&"message" in value&&
   typeof value.message==="string"&&value.message.length<220?
   value.message:"Patient information could not be confirmed. Try again.";
  throw Error(message);
 }
 return {status:r.status,data:await r.json() as T};
}
export function PatientProfileNative({onExit}:{onExit:()=>void}){
 const [token,setToken]=useState<string|null>(null);
 const [policy,setPolicy]=useState<Policy>({available:false,version:null,text:null});
 const [profile,setProfile]=useState<Patient|null>(null);
 const [identifier,setIdentifier]=useState(""),[password,setPassword]=useState("");
 const [signupOpen,setSignupOpen]=useState(false);
 const [signupFirst,setSignupFirst]=useState(""),[signupLast,setSignupLast]=useState("");
 const [signupMobile,setSignupMobile]=useState(""),[signupEmail,setSignupEmail]=useState("");
 const [signupPassword,setSignupPassword]=useState("");
 const [signupCode,setSignupCode]=useState("");
 const [signupRequestedMobile,setSignupRequestedMobile]=useState("");
 const [first,setFirst]=useState(""),[last,setLast]=useState(""),[dob,setDob]=useState("");
 const [agreed,setAgreed]=useState(false);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const [contact,setContact]=useState<Contact|null>(null);
 const [verificationCode,setVerificationCode]=useState("");
 const [identityProof,setIdentityProof]=useState<{verificationCode:string;expiresAt:string}|null>(null);
 const [claimDisplay,setClaimDisplay]=useState(""),[claimCode,setClaimCode]=useState("");
 const [claimAgree,setClaimAgree]=useState(false);
 const [otherLogin,setOtherLogin]=useState("");
 const [otherLink,setOtherLink]=useState<{authorizationCode:string;expiresAt:string}|null>(null);
 const [secondLinkCode,setSecondLinkCode]=useState("");
 const [secondConfirmed,setSecondConfirmed]=useState(false);
 const pendingRegistration=useRef<{digest:string;key:string}|null>(null);
 const signupCommand=useRef<{digest:string;key:string}|null>(null);
 const load=useCallback(async(auth:string)=>{
  const me=await invoke<{displayName:string}>("/api/identity/me","GET",undefined,auth);
  if(me.status===401)return false;
  const result=await invoke<Patient>("/api/v1/patients/me","GET",undefined,auth);
  if(result.status===401)return false;
  const p=result.data;
  const status=await invoke<Contact>("/api/identity/mobile/status","GET",undefined,auth);
  if(status.status===401)return false;
  setContact(status.data);
  setProfile(p);
  if(p?.profileStatus!=="PROVISIONAL")setIdentityProof(null);
  if(p){setFirst(p.firstName);setLast(p.lastName);setDob(p.dateOfBirth??"");}
  return true;
 },[]);
 const clear=useCallback(()=>{
  setToken(null);setProfile(null);setContact(null);setIdentityProof(null);setPassword("");setAgreed(false);
  setOtherLink(null);setSecondLinkCode("");setSecondConfirmed(false);
  pendingRegistration.current=null;
  void SecureStore.deleteItemAsync(KEY).catch(()=>undefined);
 },[]);
 useEffect(()=>{
  let active=true;
  void (async()=>{
   try{
    const p=await invoke<Policy>("/api/v1/patients/consent-policy");
    if(active&&p.data)setPolicy(p.data);
    const saved=await SecureStore.getItemAsync(KEY);
    if(saved&&active){
     const valid=await load(saved);
     if(!active)return;
     if(valid)setToken(saved);else clear();
    }
   }catch{if(active)setMessage("Patient details could not be checked. Try again.");}
   finally{if(active)setLoading(false);}
  })();
  return()=>{active=false;};
 },[clear,load]);
 useEffect(()=>{
  if(Platform.OS!=="android")return;
  const sub=BackHandler.addEventListener("hardwareBackPress",()=>{onExit();return true;});
  return()=>sub.remove();
 },[onExit]);
 useEffect(()=>{
  if(!token)return;
  const sub=AppState.addEventListener("change",state=>{
   if(state!=="active")return;
   void load(token).then(ok=>{if(!ok)clear();}).catch(()=>{
    setProfile(null);setMessage("Current patient access could not be verified.");
   });
  });
  return()=>sub.remove();
 },[token,load,clear]);
 async function run(work:()=>Promise<void>){
  if(busy)return;
  setBusy(true);setMessage("");
  try{await work();}
  catch(e){setMessage(e instanceof Error?e.message:
   "The result is uncertain. Refresh before retrying.");}
  finally{setBusy(false);}
 }
 function requestSignupCode(){
  void run(async()=>{
   const mobile=signupMobile.trim();
   if(!/^[6-9][0-9]{9}$/.test(mobile))
    throw Error("Enter a valid 10-digit Indian mobile number.");
   const response=await invoke<{status:string}>("/api/identity/patients/start",
    "POST",{mobile});
   if(response.data?.status!=="CODE_REQUESTED_UNCONFIRMED_DELIVERY")
    throw Error("The SMS code request could not be verified.");
   setSignupRequestedMobile(mobile);
   setMessage("A code was requested. Delivery is not guaranteed; enter the received SMS code.");
  });
 }
 function signup(){
  void run(async()=>{
   const payload={firstName:signupFirst.trim(),lastName:signupLast.trim(),
    mobile:signupMobile.trim(),email:signupEmail.trim()||null,
    password:signupPassword,code:signupCode.trim()};
   const signature=JSON.stringify(payload);
   if(signupCommand.current?.digest!==signature)
    signupCommand.current={digest:signature,key:Crypto.randomUUID()};
   const r=await invoke<{status:string;nextStep:string}>(
    "/api/identity/patients/register","POST",{
     requestKey:signupCommand.current.key,...payload
    });
   if(r.data?.status!=="ACCOUNT_CREATED")
    throw Error("Account registration could not be confirmed.");
   signupCommand.current=null;setSignupPassword("");setSignupCode("");setPassword("");
   setIdentifier(payload.email||payload.mobile);setSignupOpen(false);
   setMessage("Patient account created with verified contact. Sign in using your email (if provided) or your mobile login and password. A shared phone does not link private patient records.");
  });
 }
 function signIn(){
  void run(async()=>{
   const r=await invoke<{sessionToken:string;expiresAt:string}>("/api/identity/login","POST",
    {identifier,password,deviceLabel:"CareGanga Patient Android"});
   const issued=r.data?.sessionToken;
   if(!issued||Date.parse(r.data?.expiresAt??"")<=Date.now())
    throw Error("The account or password could not be confirmed.");
   const valid=await load(issued);
   if(!valid)throw Error("Your password session could not be confirmed.");
   await SecureStore.setItemAsync(KEY,issued);
   setToken(issued);setPassword("");pendingRegistration.current=null;
   setMessage("Signed in to your private patient profile.");
  });
 }
 function signOut(){
  if(!token)return;
  void run(async()=>{
   const response=await invoke<{signedOut:boolean}>("/api/identity/logout","POST",{},token);
   if(!response.data?.signedOut)throw Error("Sign-out was not confirmed. Please retry.");
   clear();setMessage("Signed out of your patient profile.");
  });
 }
 function startVerification(){
  if(!token)return;
  void run(async()=>{
   const r=await invoke<Verification>("/api/identity/mobile/verify/start","POST",{},token);
   setMessage(r.data?.status==="CODE_REQUESTED_UNCONFIRMED_DELIVERY"?
    "A code was requested. Receipt is not guaranteed. Check your phone.":
    r.data?.status==="ALREADY_VERIFIED"?"Your account contact is verified.":
    "Verification request status is uncertain. Check status before retrying.");
   await load(token);
  });
 }
 function confirmVerification(){
  if(!token)return;
  void run(async()=>{
   if(!/^\d{4,10}$/.test(verificationCode))throw Error("Enter the verification code.");
   const r=await invoke<Verification>("/api/identity/mobile/verify/confirm","POST",
    {code:verificationCode},token);
   if(r.data?.status!=="VERIFIED"){
    setMessage(r.data?.status==="NOT_VERIFIED"?
     "That code could not be verified. Check your entry.":
     "Mobile verification result is uncertain. Check status before retrying.");
    return;
   }
   setVerificationCode("");await load(token);
   setMessage("Your account contact is verified.");
  });
 }
 function register(){
  if(!token)return;
  void run(async()=>{
   const payload={firstName:first,lastName:last,dateOfBirth:dob||null,
    consentVersion:policy.version,consentAccepted:agreed};
   const digest=JSON.stringify(payload);
   if(pendingRegistration.current?.digest!==digest)
    pendingRegistration.current={digest,key:Crypto.randomUUID()};
   const r=await invoke<Patient>("/api/v1/patients/registration","POST",{
    requestKey:pendingRegistration.current.key,...payload
   },token);
   if(!r.data)throw Error("Registration could not be confirmed.");
   pendingRegistration.current=null;setProfile(r.data);setMessage("Your Virtual Patient ID was created.");
  });
 }
 function save(){
  if(!profile||!token)return;
  void run(async()=>{
   const r=await invoke<Patient>("/api/v1/patients/me","PATCH",{
    expectedVersion:profile.version,firstName:first,lastName:last,
    dateOfBirth:dob||null
   },token);
   if(!r.data)throw Error("Profile update could not be confirmed.");
   setProfile(r.data);setMessage("Patient details saved.");
  });
 }
 function consent(){
  if(!profile||!token)return;
  void run(async()=>{
   const granted=!profile.consentGranted;
   const r=await invoke<Patient>("/api/v1/patients/me/consent","POST",{
    expectedVersion:profile.version,granted,
    consentVersion:granted?policy.version:profile.consentVersion
   },token);
   if(!r.data)throw Error("Consent change could not be confirmed.");
   setProfile(r.data);setMessage(granted?"Consent was recorded.":"Consent withdrawal was recorded.");
  });
 }
 function claimClinicIntake(){
  if(!token)return;
  void run(async()=>{
   if(!contact?.verified||!policy.available||!claimAgree)
    throw Error("Verify your account and accept the current patient-care consent.");
   const r=await invoke<Patient>("/api/v1/patients/me/claim-intake","POST",{
    virtualPatientId:claimDisplay,claimCode,
    consentAccepted:claimAgree,consentVersion:policy.version},token);
   if(!r.data)throw Error("The original center claim could not be verified.");
   setProfile(r.data);setFirst(r.data.firstName);setLast(r.data.lastName);
   setDob(r.data.dateOfBirth??"");setClaimCode("");setClaimAgree(false);
   setMessage("Your original clinic patient record was linked to this verified account.");
  });
 }
 function issueIdentityProof(){
  if(!token||!profile||profile.profileStatus!=="PROVISIONAL")return;
  void run(async()=>{
   const r=await invoke<{verificationCode:string;expiresAt:string}>(
    "/api/v1/patients/me/identity-verification","POST",{},token);
   if(!r.data)throw Error("The identity verification code was not issued.");
   setIdentityProof(r.data);
   setMessage("Show this one-time code and your identity document to authorized center staff. Expires in 15 minutes.");
  });
 }
 function issueSecondLoginLink(){
  if(!token||!profile?.canLinkAnotherAccount)return;
  void run(async()=>{
   const r=await invoke<{authorizationCode:string;expiresAt:string}>(
    "/api/v1/patients/me/second-account-link-code","POST",{
     recipientIdentifier:otherLogin.trim(),personallyConfirmed:true},token);
   if(!r.data)throw Error("A private account link code could not be confirmed.");
   setOtherLink(r.data);
   setMessage("The code is only for your other named login. Share it privately; family members must use their own patient profiles.");
  });
 }
 function acceptSecondLoginLink(){
  if(!token)return;
  void run(async()=>{
   if(!secondConfirmed||!contact?.verified)
    throw Error("Verify your account and confirm this is your own patient identity.");
   const r=await invoke<Patient>("/api/v1/patients/me/accept-second-account",
    "POST",{authorizationCode:secondLinkCode.trim().toUpperCase(),
     personallyConfirmed:true},token);
   if(!r.data)throw Error("The original patient link result could not be verified.");
   setProfile(r.data);setFirst(r.data.firstName);setLast(r.data.lastName);
   setDob(r.data.dateOfBirth??"");
   setSecondLinkCode("");setSecondConfirmed(false);
   setMessage("Your second personal login was linked to your original verified patient profile. No staff permissions were copied.");
  });
 }
 function checkIdentityStatus(){
  if(!token)return;
  void run(async()=>{
   const ok=await load(token);
   if(!ok)throw Error("Your account is no longer authorized.");
   setMessage("Your current patient identity status was refreshed.");
  });
 }
 const button=(label:string,onPress:()=>void,disabled=false)=>(
  <Pressable accessibilityRole="button" accessibilityState={{disabled}}
   disabled={disabled} style={[styles.action,disabled&&styles.disabled]}
   onPress={onPress}><Text style={styles.actionText}>{label}</Text></Pressable>
 );
 const field=(label:string,value:string,set:(s:string)=>void,secure=false)=>(
  <View style={styles.field}><Text style={styles.label}>{label}</Text>
   <TextInput accessibilityLabel={label} value={value} onChangeText={set}
    secureTextEntry={secure} autoCapitalize="none"
    style={styles.input}/></View>
 );
 return <SafeAreaView style={styles.page}>
  <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
   {button("Back to CareGanga",onExit)}
   <Text accessibilityRole="header" style={styles.title}>My Patient Profile</Text>
   <Text style={styles.muted}>Your CareGanga Virtual Patient ID is not a
    government health ID. Only your own linked account can view these details.</Text>
   {!!message&&<Text accessibilityRole="alert" style={styles.error}>{message}</Text>}
   {loading?<ActivityIndicator accessibilityLabel="Checking your current session"/>:
    !token?<View style={styles.card}>
     {signupOpen?<>
      <Text style={styles.subtitle}>Create a patient account</Text>
      {field("First name",signupFirst,setSignupFirst)}
      {field("Last name",signupLast,setSignupLast)}
      {field("Registered mobile (10 digits)",signupMobile,v=>{setSignupMobile(v);setSignupRequestedMobile("");setSignupCode("");})}
      {field("Email (optional)",signupEmail,setSignupEmail)}
      {field("Choose a password (at least eight characters)",
       signupPassword,setSignupPassword,true)}
       <Text>Prove you own this mobile before creating an account.
        This does not verify clinical identity.</Text>
       {button("Send SMS verification code",requestSignupCode,
        busy||!/^[6-9][0-9]{9}$/.test(signupMobile))}
       {signupRequestedMobile===signupMobile.trim()&&
        field("Received SMS code (4–10 digits)",signupCode,setSignupCode)}
       <Text>Ordinary sign-in still uses your mobile and password only.</Text>
      {button(busy?"Checking…":"Create patient account",signup,
       busy||signupFirst.trim().length<2||!signupLast.trim()||
       !/^[6-9][0-9]{9}$/.test(signupMobile)||signupPassword.length<8||
        signupRequestedMobile!==signupMobile.trim()||!/^[0-9]{4,10}$/.test(signupCode))}
      {button("Already registered? Sign in",()=>setSignupOpen(false),busy)}
     </>:<>
      {field("Registered mobile number or email",identifier,setIdentifier)}
      {field("Password",password,setPassword,true)}
      {button(busy?"Checking…":"Sign in",signIn,busy||!identifier.trim()||!password)}
      {button("New patient? Create an account",()=>setSignupOpen(true),busy)}
     </>}
    </View>:<View style={styles.card}>
     {button("Sign out",signOut,busy)}
     {profile?<View>
      <Text style={styles.subtitle}>Virtual Patient ID: {profile.virtualPatientId}</Text>
      <Text>{profile.profileStatus==="PROVISIONAL"?"Contact-verified profile; identity verification pending":profile.profileStatus}</Text>
      <Text>Patient-care consent: {profile.consentGranted?"Granted":"Withdrawn"}</Text>
     </View>:<Text>No patient profile is linked yet. A verified account
       contact and approved patient-care consent are required.</Text>}
     {profile?.profileStatus==="PROVISIONAL"&&<View style={styles.field}>
      <Text style={styles.subtitle}>Verify patient identity at a healthcare center</Text>
      <Text>Mobile verification confirms the account, not clinical identity.
       Visit an approved center with an identity document and show your
       Virtual Patient ID and this one-time code to assigned staff.</Text>
      {button("Get one-time clinic verification code",issueIdentityProof,
       busy||!profile.consentGranted)}
      {identityProof&&<Text selectable style={styles.subtitle}>
       {identityProof.verificationCode}</Text>}
      {identityProof&&<Text>Expires {new Date(identityProof.expiresAt).toLocaleTimeString("en-IN")}</Text>}
      {button("Check current identity status",checkIdentityStatus,busy)}
     </View>}
     {!profile&&<View style={styles.field}>
      <Text style={styles.subtitle}>Link your other personal login</Text>
      <Text>Use a private recipient-specific code issued while you were signed
       in to your original verified patient account. A shared family phone
       does not make two people the same patient.</Text>
      {field("One-time link code",secondLinkCode,
       v=>setSecondLinkCode(v.trim().toUpperCase()))}
      {button(secondConfirmed?"Same person confirmed":
       "I am the same individually verified patient",()=>setSecondConfirmed(!secondConfirmed),
       busy)}
      {button("Link this second personal account",acceptSecondLoginLink,
       busy||!contact?.verified||!secondConfirmed||
        !/^CGL-[A-F0-9]{32}$/.test(secondLinkCode))}
     </View>}
     {!profile&&<View style={styles.field}>
      <Text style={styles.subtitle}>Verify account mobile contact</Text>
      {contact?.verified?<Text>Your CareGanga contact is verified.</Text>:
       !contact?.hasNumber?<Text>Your existing account has no verification contact.
        Ask CareGanga Foundation to record your contact first.</Text>:
       !contact?.providerConfigured?<Text>Mobile verification is not configured.
        Patient registration is unavailable for now.</Text>:
       <View style={styles.field}>
        <Text>The code is sent only to the saved contact
         {contact.maskedContact?" ending "+contact.maskedContact:""}.
         A shared family phone does not give access to other patients.</Text>
        {button("Request verification code",startVerification,busy)}
        {field("One-time code",verificationCode,setVerificationCode)}
        {button("Verify code",confirmVerification,
         busy||!/^\d{4,10}$/.test(verificationCode))}
       </View>}
     </View>}
     {!profile&&<View style={styles.field}>
      <Text style={styles.subtitle}>Already registered at a clinic?</Text>
      <Text>Ask the authorized receptionist to check your identity document
       and give you the one-time claim code. Your mobile number alone never
       claims or merges another person's patient record.</Text>
      {field("Existing Virtual Patient ID",claimDisplay,v=>setClaimDisplay(v.trim().toUpperCase()))}
      {field("One-time claim code from clinic",claimCode,v=>setClaimCode(v.trim().toUpperCase()))}
      <Text>{policy.available?policy.text:
       "Approved patient consent is not configured for account claims."}</Text>
      {policy.available&&button(claimAgree?"Consent accepted":"I accept patient-care consent",
       ()=>setClaimAgree(!claimAgree),busy)}
      {button("Claim my existing clinic patient record",claimClinicIntake,
       busy||!contact?.verified||!policy.available||!claimAgree||
        !/^CGP-[A-F0-9]{16}$/.test(claimDisplay)||!/^CGC-[A-F0-9]{24}$/.test(claimCode))}
     </View>}
     {field("First name",first,setFirst)}
     {field("Last name",last,setLast)}
     <NativePatientDatePicker value={dob} onChange={setDob}
      disabled={busy}/>
     {!profile&&<View style={styles.field}>
      <Text style={styles.subtitle}>Patient-care consent</Text>
      <Text>{policy.available?policy.text:
       "Approved consent details are unavailable. Registration is disabled."}</Text>
      {policy.available&&button(agreed?"Consent selected":"I agree to the consent above",
       ()=>setAgreed(!agreed))}
     </View>}
     {button(busy?"Saving…":profile?"Save details":"Create patient profile",
      profile?save:register,busy||!first.trim()||!last.trim()||
       (!profile&&(!policy.available||!agreed||!contact?.verified)))}
     {profile?.profileStatus==="VERIFIED"&&profile.consentGranted&&
      profile.canLinkAnotherAccount&&token&&<View style={styles.field}>
       <Text style={styles.subtitle}>Use your patient profile from another account</Text>
       <Text>Only authorize another account personally controlled by you,
        the same verified person. Never grant your records to a different family
        member. No staff or volunteer permissions are transferred.</Text>
       {field("Second account's own email or mobile login",otherLogin,
        v=>{setOtherLogin(v);setOtherLink(null);})}
       {button("Issue recipient-specific 15-minute link code",issueSecondLoginLink,
        busy||otherLogin.trim().length<6)}
       {otherLink&&<Text selectable style={styles.subtitle}>
        Private code: {otherLink.authorizationCode}</Text>}
       {otherLink&&<Text>Expires {new Date(otherLink.expiresAt).toLocaleTimeString("en-IN")}.
        Sign into that exact second account to accept.</Text>}
      </View>}
     {profile?.profileStatus==="VERIFIED"&&token&&
      <NativePatientPrivateDetails token={token}
       consentGranted={profile.consentGranted} onExpired={clear}/>}
     {profile?.profileStatus==="VERIFIED"&&token&&profile.consentGranted&&
      <NativeMyLabReports token={token} onExpired={clear}/>}
     {profile&&<NativeConsultationHistory/>}
     {profile?.profileStatus==="VERIFIED"&&token&&
      <NativePatientPrivateFiles token={token}
       consentGranted={profile.consentGranted} onExpired={clear}/>}
     {profile?.profileStatus==="VERIFIED"&&token&&
      <NativePatientPartnerClaims token={token}
       consentGranted={profile.consentGranted} onExpired={clear}/>}
     {profile&&<View style={styles.field}>
      <Text style={styles.subtitle}>Manage patient-care consent</Text>
      {!profile.consentGranted&&policy.available&&<Text>{policy.text}</Text>}
      {button(profile.consentGranted?"Withdraw consent":"Grant consent",
       consent,busy||(!profile.consentGranted&&!policy.available))}
     </View>}
    </View>}
  </ScrollView>
 </SafeAreaView>;
}
const styles=StyleSheet.create({
 page:{flex:1,backgroundColor:theme.background},
 content:{padding:18,paddingBottom:48,gap:16,width:"100%",maxWidth:720,alignSelf:"center"},
 title:{fontSize:24,fontWeight:"800",color:theme.sidebar},
 subtitle:{fontSize:17,fontWeight:"700",color:theme.text},
 muted:{color:theme.mutedText},
 error:{color:theme.error,padding:12,backgroundColor:theme.surface},
 card:{borderWidth:1,borderColor:theme.border,borderRadius:16,
  padding:18,backgroundColor:theme.surface,gap:16},
 field:{gap:8},label:{color:theme.text,fontWeight:"600"},
 input:{borderWidth:1,borderColor:theme.border,borderRadius:10,minHeight:48,
  padding:12,color:theme.text,backgroundColor:theme.surface},
 action:{borderRadius:10,backgroundColor:theme.primary,padding:14,minHeight:48,
  alignItems:"center",justifyContent:"center"},
 actionText:{fontWeight:"700",color:theme.primaryText},
 disabled:{opacity:0.45}
});
