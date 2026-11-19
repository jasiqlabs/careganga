import {useCallback,useEffect,useRef,useState} from "react";
import {
 ActivityIndicator,AppState,BackHandler,Pressable,ScrollView,StyleSheet,
 Text,TextInput,View
} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import {careGangaTheme as theme} from "../../../../../packages/design-tokens/src/index";

const KEY="cg_public_patient_only_session";
const base=process.env.EXPO_PUBLIC_API_URL;
type Patient={virtualPatientId:string;firstName:string;lastName:string;
 dateOfBirth:string|null;profileStatus:string;version:number;
 consentGranted:boolean;consentVersion:string|null};
type Policy={available:boolean;version:string|null;text:string|null};
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
 const [first,setFirst]=useState(""),[last,setLast]=useState(""),[dob,setDob]=useState("");
 const [agreed,setAgreed]=useState(false);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const pendingRegistration=useRef<{digest:string;key:string}|null>(null);
 const load=useCallback(async(auth:string)=>{
  const me=await invoke<{displayName:string}>("/api/identity/me","GET",undefined,auth);
  if(me.status===401)return false;
  const result=await invoke<Patient>("/api/v1/patients/me","GET",undefined,auth);
  if(result.status===401)return false;
  const p=result.data;
  setProfile(p);
  if(p){setFirst(p.firstName);setLast(p.lastName);setDob(p.dateOfBirth??"");}
  return true;
 },[]);
 const clear=useCallback(()=>{
  setToken(null);setProfile(null);setPassword("");setAgreed(false);
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
     {field("Registered mobile number or email",identifier,setIdentifier)}
     {field("Password",password,setPassword,true)}
     {button(busy?"Checking…":"Sign in",signIn,busy||!identifier.trim()||!password)}
     <Text>Use an existing CareGanga password account. New account signup
      is not available here.</Text>
    </View>:<View style={styles.card}>
     {button("Sign out",signOut,busy)}
     {profile?<View>
      <Text style={styles.subtitle}>Virtual Patient ID: {profile.virtualPatientId}</Text>
      <Text>Patient-care consent: {profile.consentGranted?"Granted":"Withdrawn"}</Text>
     </View>:<Text>No patient profile is linked yet. A verified account
       contact and approved patient-care consent are required.</Text>}
     {field("First name",first,setFirst)}
     {field("Last name",last,setLast)}
     {field("Date of birth (YYYY-MM-DD, optional)",dob,setDob)}
     {!profile&&<View style={styles.field}>
      <Text style={styles.subtitle}>Patient-care consent</Text>
      <Text>{policy.available?policy.text:
       "Approved consent details are unavailable. Registration is disabled."}</Text>
      {policy.available&&button(agreed?"Consent selected":"I agree to the consent above",
       ()=>setAgreed(!agreed))}
     </View>}
     {button(busy?"Saving…":profile?"Save details":"Create patient profile",
      profile?save:register,busy||!first.trim()||!last.trim()||
       (!profile&&(!policy.available||!agreed)))}
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
 content:{padding:20,gap:14,width:"100%",maxWidth:680,alignSelf:"center"},
 title:{fontSize:24,fontWeight:"700",color:theme.sidebar},
 subtitle:{fontSize:17,fontWeight:"700",color:theme.text},
 muted:{color:theme.mutedText},
 error:{color:theme.error,padding:12,backgroundColor:theme.surface},
 card:{borderWidth:1,borderColor:theme.border,borderRadius:12,
  padding:16,backgroundColor:theme.surface,gap:14},
 field:{gap:8},label:{color:theme.text,fontWeight:"600"},
 input:{borderWidth:1,borderColor:theme.border,borderRadius:8,minHeight:48,
  padding:12,color:theme.text},
 action:{borderRadius:8,backgroundColor:theme.primary,padding:14,minHeight:48,
  alignItems:"center",justifyContent:"center"},
 actionText:{fontWeight:"700",color:theme.primaryText},
 disabled:{opacity:0.45}
});
