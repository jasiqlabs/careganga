import {useEffect,useRef,useState} from "react";
import {AppState,Pressable,StyleSheet,Text,View} from "react-native";
import {fetch as expoFetch} from "expo/fetch";
import {File,Paths} from "expo-file-system";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";

const base=process.env.EXPO_PUBLIC_API_URL;
const KEY="cg_public_patient_only_session";
type SlipState={status:string;canDownload:boolean};
type Issue={status:"ISSUED"|"UNKNOWN";confirmed:boolean};
type Kind="pdf"|"calendar";
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function url(route:string){
 if(!base||!/^https?:\/\//.test(base)||
  (process.env.NODE_ENV==="production"&&!base.startsWith("https://")))
  throw Error("Secure appointment documents are unavailable.");
 return new URL(route,base).toString();
}
async function authorized(path:string,method:"GET"|"POST"="GET",input?:object){
 const key=await SecureStore.getItemAsync(KEY);
 if(!key)throw Error("Sign in to your CareGanga patient account.");
 const r=await expoFetch(url(path),{
  method,cache:"no-store",signal:AbortSignal.timeout(15000),
  headers:{Authorization:"Bearer "+key,...(input?{"Content-Type":"application/json"}:{})},
  body:input?JSON.stringify(input):undefined});
 if(!r.ok){
  const json:unknown=await r.json().catch(()=>null);
  throw Error(json&&typeof json==="object"&&"message" in json&&
   typeof json.message==="string"?json.message:
   r.status===401?"Your patient session expired. Please sign in again.":
   r.status===404?"The private file has not been issued or is no longer current.":
   "Your private document result could not be verified. Check its status.");
 }
 return r;
}
export function NativeAppointmentDocuments({
 bookingRef,bookingStatus
}:{bookingRef:string;bookingStatus:string}){
 const [busy,setBusy]=useState(false),[unknown,setUnknown]=useState(false);
 const [message,setMessage]=useState("");
 const issueKey=useRef<string|null>(null);
 const cached=useRef<File|null>(null);
 useEffect(()=>{
  // Private files are ephemeral app-cache copies, not public/CDN downloads.
  // Remove them after the user returns to the app from a native viewer,
  // as well as when navigating away from this patient's history.
  let wasAway=false;
  const sub=AppState.addEventListener("change",state=>{
   if(state!=="active"){wasAway=true;return;}
   if(wasAway){
    wasAway=false;
    try{cached.current?.delete();}catch{/* OS cache cleanup is best-effort. */}
    cached.current=null;
   }
  });
  return()=>{
   sub.remove();
   try{cached.current?.delete();}catch{/* cache cleanup best-effort */}
   cached.current=null;
  };
 },[]);
 async function previewFile(kind:Kind){
  const route=kind==="pdf"?
   "/api/v1/appointments/slips/me/"+bookingRef+"/file":
   "/api/v1/appointments/consultations/me/"+bookingRef+"/calendar.ics";
  const response=await authorized(route);
  const type=response.headers.get("Content-Type")??"";
  if(kind==="pdf"&&!type.includes("application/pdf")||
   kind==="calendar"&&!type.includes("text/calendar"))
   throw Error("The original appointment file type could not be verified.");
  const bytes=await response.bytes();
  if(bytes.length<60||bytes.length>10485760||
   kind==="pdf"&&(bytes[0]!==37||bytes[1]!==80||bytes[2]!==68||bytes[3]!==70))
   throw Error("The original appointment file is invalid.");
  if(cached.current){
   try{cached.current.delete();}catch{/* new private copy replaces stale cache */}
  }
  const file=new File(Paths.cache,"careganga-private-"+Crypto.randomUUID()+
   (kind==="pdf"?".pdf":".ics"));
  file.create();
  await file.write(bytes);
  cached.current=file;
  try{
   if(!await File.canPreview(file,{mimeType:kind==="pdf"?
    "application/pdf":"text/calendar"}))
    throw Error("No compatible private file viewer is installed.");
   await File.preview(file,{title:kind==="pdf"?
    "Private CareGanga Appointment":"CareGanga Calendar",
    mimeType:kind==="pdf"?"application/pdf":"text/calendar"});
  }catch{
   throw Error(kind==="pdf"?
    "A PDF viewer is not available on this device. The private file was not shared.":
    "A compatible calendar file viewer is not available on this device.");
  }
 }
 async function viewSlip(){
  if(busy||unknown||!ID.test(bookingRef))return;
  setBusy(true);setMessage("");
  try{
   const state=await authorized("/api/v1/appointments/slips/me/"+bookingRef+"/status");
   const existing=await state.json() as SlipState;
   if(existing.status==="ISSUED"&&existing.canDownload){
    await previewFile("pdf");setMessage("Your verified private appointment PDF was opened.");
    return;
   }
   if(bookingStatus==="CANCELLED"||bookingStatus==="NO_SHOW")
    throw Error("There is no current slip for this cancelled or missed appointment.");
   if(!issueKey.current)issueKey.current=Crypto.randomUUID();
   const response=await authorized("/api/v1/appointments/slips/me/"+bookingRef+
    "/issue","POST",{requestKey:issueKey.current});
   const result=await response.json() as Issue;
   if(result.status!=="ISSUED"||!result.confirmed){
    setUnknown(true);
    setMessage("The original PDF issue was not confirmed. Check current status before retrying.");
    return;
   }
   await previewFile("pdf");
   setMessage("Your verified private appointment PDF was opened.");
  }catch(e){
   setUnknown(true);
   setMessage(e instanceof Error?e.message:"The document result is uncertain. Check status.");
  }finally{setBusy(false);}
 }
 async function recover(){
  if(busy)return;
  setBusy(true);setMessage("");
  try{
   const res=await authorized("/api/v1/appointments/slips/me/"+bookingRef+"/status");
   const current=await res.json() as SlipState;
   if(current.status==="ISSUED"&&current.canDownload){
    setUnknown(false);await previewFile("pdf");
    setMessage("Original issued PDF is available.");
   }else if(current.status==="NOT_ISSUED"){
    setUnknown(false);
    setMessage("No issued PDF was found. You can try the original request again.");
   }else{
    setMessage("The original PDF is still pending or unavailable. Do not reissue with a new key.");
   }
  }catch(e){setMessage(e instanceof Error?e.message:"Slip status cannot be verified.");}
  finally{setBusy(false);}
 }
 async function calendar(){
  if(busy)return;
  setBusy(true);setMessage("");
  try{await previewFile("calendar");setMessage("Original consultation calendar file opened.");}
  catch(e){setMessage(e instanceof Error?e.message:"The calendar could not be opened.");}
  finally{setBusy(false);}
 }
 const action=(label:string,fn:()=>void,disabled=false)=>(
  <Pressable accessibilityRole="button" accessibilityState={{disabled:busy||disabled}}
   disabled={busy||disabled} onPress={fn}
   style={[styles.button,(busy||disabled)&&styles.disabled]}>
   <Text style={styles.buttonText}>{label}</Text>
  </Pressable>
 );
 return <View style={styles.panel}>
  <Text style={styles.label}>Original consultation documents</Text>
  <Text style={styles.note}>A real CG-19 patient-only PDF and status-only QR can
   be viewed with a device PDF viewer. It is not a payment receipt.</Text>
  {!!message&&<Text accessibilityRole="alert" style={styles.note}>{message}</Text>}
  {unknown?action("Check original slip status",()=>void recover()):
   action("Open / issue my private PDF & QR",()=>void viewSlip(),
    bookingStatus==="CANCELLED"||bookingStatus==="NO_SHOW")}
  {["CONFIRMED","ARRIVED","WAITING","IN_CONSULTATION"].includes(bookingStatus)&&
   action("Open original calendar file",()=>void calendar())}
 </View>;
}
const styles=StyleSheet.create({
 panel:{gap:8,padding:12,borderWidth:1,borderRadius:10,
  borderColor:t.border,backgroundColor:t.surface},
 label:{fontSize:14,fontWeight:"700",color:t.text},
 note:{fontSize:13,color:t.mutedText},
 button:{padding:12,minHeight:44,borderRadius:8,borderWidth:1,
  borderColor:t.border,justifyContent:"center"},
 buttonText:{fontSize:13,color:t.text,fontWeight:"600"},
 disabled:{opacity:0.45}
});
