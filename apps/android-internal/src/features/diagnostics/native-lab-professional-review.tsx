import {useEffect,useRef,useState} from "react";
import {ActivityIndicator,Alert,AppState,Pressable,StyleSheet,Text,TextInput,View} from "react-native";
import {File,Paths} from "expo-file-system";
import * as Crypto from "expo-crypto";
import {fetch as expoFetch} from "expo/fetch";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";

type Current={resultRef:string;resultVersion:number;reportDigest:string;
 hasReview:boolean;reviewDecision:string|null;patientRelease:string;notificationDelivery:string};
type Decision={requestKey:string;resultRef:string;expectedVersion:number;
 reportDigest:string;decision:"APPROVE"|"REJECT";decisionNote:string;currentPassword:string};
type Props={token:string;centerRef:string;orderRef:string;onExpired:()=>void};
const apiBase=process.env.EXPO_PUBLIC_API_URL;
function url(path:string){
 if(!apiBase||!/^https?:\/\//.test(apiBase)||
  (process.env.NODE_ENV==="production"&&!apiBase.startsWith("https://")))
  throw Error("The protected clinical report service is unavailable.");
 return new URL("/api/v1/diagnostics/clinical/"+path,apiBase).toString();
}
function errorText(status:number){
 return status===401?"Clinical session expired. Sign in again.":
  status===403?"Current clinical qualifications, center or consent deny this request.":
  status===404?"An original scanner-verified report is not ready for review.":
  status===409?"The original report was changed or already reviewed. Refresh before retrying.":
  "The review outcome is uncertain. Check the original protected source first.";
}
export function NativeLabProfessionalReview({token,centerRef,orderRef,onExpired}:Props){
 const [current,setCurrent]=useState<Current|null>(null);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [note,setNote]=useState(""),[password,setPassword]=useState("");
 const [fileRead,setFileRead]=useState(false),[attested,setAttested]=useState(false);
 const [uncertain,setUncertain]=useState(false),[message,setMessage]=useState("");
 const original=useRef<Decision|null>(null),previewFile=useRef<File|null>(null);
 const mounted=useRef(true);
 const base="centers/"+centerRef+"/orders/"+orderRef;
 function cleanup(){
  try{previewFile.current?.delete()}catch{/* OS may hold a viewer copy */}
  previewFile.current=null;
 }
 useEffect(()=>{
  mounted.current=true;
  setCurrent(null);setFileRead(false);setAttested(false);setPassword("");
  original.current=null;setUncertain(false);setMessage("");setLoading(true);
  void refresh().catch(e=>{if(mounted.current)setMessage(
   e instanceof Error?e.message:"Clinician report access unavailable.")})
   .finally(()=>{if(mounted.current)setLoading(false)});
  return()=>{mounted.current=false;cleanup();};
 },[token,centerRef,orderRef,onExpired]);
 useEffect(()=>{
  let switched=false;
  const listener=AppState.addEventListener("change",s=>{
   if(s!=="active")switched=true;
   else if(switched){switched=false;cleanup();}
  });
  return()=>{listener.remove();cleanup()};
 },[]);
 async function request<T>(path:string,method:"GET"|"POST"="GET",body?:object):Promise<T>{
  const res=await identityRequest("/api/v1/diagnostics/clinical/"+path,{
   method,cache:"no-store",headers:{Authorization:"Bearer "+token,
    ...(body?{"Content-Type":"application/json"}:{})},
   body:body?JSON.stringify(body):undefined
  });
  if(!res.ok){
   if(res.status===401)onExpired();
   throw Object.assign(new Error(errorText(res.status)),{status:res.status});
  }
  return await res.json() as T;
 }
 async function refresh(){
  const result=await request<Current>(base+"/reviews/current");
  if(!result||typeof result.resultRef!=="string"||
    !/^[a-f0-9]{64}$/.test(result.reportDigest)||
    !Number.isSafeInteger(result.resultVersion))
   throw Error("Protected review source cannot be validated.");
  if(!mounted.current)return;
  setCurrent(result);
  if(result.hasReview){
   setMessage("Independent review recorded ("+result.reviewDecision+
    "). The patient report "+(result.patientRelease==="RELEASED"?"is released privately.":"awaits separate release."));
   original.current=null;setPassword("");setUncertain(false);
  }
 }
 async function read(){
  if(!current||busy)return;
  setBusy(true);setMessage("");setFileRead(false);setAttested(false);cleanup();
  try{
   const res=await expoFetch(url(base+"/reports/reviewer-file"),{
    method:"GET",cache:"no-store",headers:{Authorization:"Bearer "+token},
    signal:AbortSignal.timeout(20000)
   });
   if(!res.ok){
    if(res.status===401)onExpired();
    throw Error(errorText(res.status));
   }
   if(res.headers.get("Content-Type")?.split(";")[0]!=="application/pdf")
    throw Error("Original document type is not verified.");
   const bytes=await res.bytes();
   if(bytes.length<5||bytes.length>10485760||
      String.fromCharCode(...bytes.subarray(0,4))!=="%PDF")
    throw Error("The original private PDF did not pass validation.");
   const file=new File(Paths.cache,"careganga-review-"+Crypto.randomUUID()+".pdf");
   file.create();await file.write(bytes);previewFile.current=file;
   if(!await File.canPreview(file,{mimeType:"application/pdf"}))
    throw Error("No compatible PDF viewer is available on this device.");
   await File.preview(file,{title:"Private laboratory clinical review",mimeType:"application/pdf"});
   if(!mounted.current)return;
   setFileRead(true);
   setMessage("Private original PDF opened for review. Inspect patient, specimen and test "+
    "details before independently recording a decision. Do not share externally.");
  }catch(e){
   if(mounted.current)setMessage(e instanceof Error?e.message:
    "Original private report could not be opened.");
  }finally{if(mounted.current)setBusy(false)}
 }
 async function decide(action:"APPROVE"|"REJECT",retry=false){
  if(!current||current.hasReview||busy||(!retry&&uncertain))return;
  if(!retry&&(!fileRead||!attested||note.trim().length<12||password.length<8)){
   setMessage("Review the original PDF, confirm your inspection and enter "+
    "a clinical rationale and current password.");return;
  }
  const saved=original.current;
  const command=retry&&saved?saved:{
   requestKey:Crypto.randomUUID(),resultRef:current.resultRef,
   expectedVersion:current.resultVersion,reportDigest:current.reportDigest,
   decision:action,decisionNote:note.trim(),currentPassword:password
  };
  if(retry&&!saved)return;
  if(!retry)original.current=command;
  setBusy(true);setMessage("");
  try{
   const response=await request<{professionallyReviewed:boolean;patientReleased:boolean}>(
    base+"/reviews","POST",command);
   if(!response.professionallyReviewed||response.patientReleased)
    throw Error("The source response cannot confirm a protected clinical review.");
   original.current=null;setPassword("");setUncertain(false);
   setMessage("Professional "+action.toLowerCase()+" decision recorded. "+
    "No report has been issued or delivered to the patient.");
   try{await refresh()}catch{setMessage("Decision accepted, but refresh failed. "+
    "Check original review state before any new action.");}
  }catch(e){
   const status=e&&typeof e==="object"&&"status" in e&&
    typeof e.status==="number"?e.status:503;
   setUncertain(status>=500);
   if(status<500){original.current=null;setPassword("");}
   setMessage(e instanceof Error?e.message:"Decision unknown. Retry original request.");
  }finally{if(mounted.current)setBusy(false)}
 }
 const button=(name:string,act:()=>void,disabled=false)=>(
  <Pressable accessibilityRole="button" accessibilityState={{disabled}}
   disabled={disabled} onPress={act} style={[s.button,disabled&&s.disabled]}>
   <Text style={s.buttonText}>{name}</Text>
  </Pressable>
 );
 return <View style={s.card}>
  <Text style={s.heading}>Independent licensed clinical review</Text>
  <Text style={s.info}>Only your current professionally verified CG14 identity,
   same lab affiliation, patient consent and clinical permission qualify.
   Reviewing is separate from releasing a report to the patient.</Text>
  {loading&&<ActivityIndicator accessibilityLabel="Checking clinician authorization"/>}
  {!!message&&<Text accessibilityRole="alert" style={s.info}>{message}</Text>}
  {current?.hasReview?<Text style={s.info}>
   Professional decision: {current.reviewDecision}. Patient report: {current.patientRelease==="RELEASED"?"Released privately":"Awaiting release"}.
  </Text>:current&&<>
   {button("Open original private PDF for clinical inspection",()=>void read(),busy)}
   {fileRead&&<Pressable accessibilityRole="checkbox"
    accessibilityState={{checked:attested}} onPress={()=>setAttested(x=>!x)}
    style={s.button}><Text style={s.buttonText}>
    {attested?"☑":"☐"} I inspected the original report and its clinical details</Text>
   </Pressable>}
   <Text style={s.label}>Clinical assessment and rationale</Text>
   <TextInput style={s.input} multiline value={note} maxLength={1000}
    editable={!busy&&!uncertain} onChangeText={setNote}
    accessibilityLabel="Clinical review rationale" placeholderTextColor={t.mutedText}
    placeholder="At least 12 characters describing the reviewed PDF"/>
   <Text style={s.label}>Current clinician password</Text>
   <TextInput style={s.input} secureTextEntry value={password} maxLength={1024}
    editable={!busy&&!uncertain} onChangeText={setPassword}
    accessibilityLabel="Current clinician password"/>
   {uncertain?<View style={s.items}>
    {button("Check original decision",()=>void refresh().catch(e=>
     setMessage(e instanceof Error?e.message:"Protected review not available")),busy)}
    {button("Retry exactly the original review",()=>{
     if(original.current)void decide(original.current.decision,true);
    },busy||!original.current)}
   </View>:<View style={s.items}>
    {button("Record independent approval",()=>Alert.alert(
     "Review the exact original PDF?","This does not sign or release a patient report.",[
      {text:"Cancel",style:"cancel"},{text:"Record review",onPress:()=>void decide("APPROVE")}
     ]),busy||!fileRead||!attested||note.trim().length<12||password.length<8)}
    {button("Reject report evidence",()=>Alert.alert(
     "Reject current report?","The original evidence will remain securely auditable.",[
      {text:"Cancel",style:"cancel"},
      {text:"Reject",style:"destructive",onPress:()=>void decide("REJECT")}
     ]),busy||!fileRead||!attested||note.trim().length<12||password.length<8)}
   </View>}
  </>}
 </View>;
}
const s=StyleSheet.create({
 card:{padding:12,gap:10,borderWidth:1,borderColor:t.border,
  backgroundColor:t.surface,borderRadius:12},
 heading:{fontSize:16,color:t.text,fontWeight:"700"},
 info:{fontSize:13,color:t.mutedText,lineHeight:20},
 label:{fontSize:13,fontWeight:"600",color:t.text},
 input:{minHeight:48,padding:12,borderWidth:1,borderColor:t.border,
  borderRadius:10,color:t.text},
 items:{gap:8},button:{padding:12,borderColor:t.border,borderWidth:1,
  borderRadius:10,minHeight:48,justifyContent:"center"},
 buttonText:{color:t.text,fontSize:14,fontWeight:"600"},
 disabled:{opacity:0.45}
});
