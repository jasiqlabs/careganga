import {useEffect,useRef,useState} from "react";
import {AppState,Pressable,StyleSheet,Text,View} from "react-native";
import {fetch as expoFetch} from "expo/fetch";
import {File,Paths} from "expo-file-system";
import * as Crypto from "expo-crypto";
import * as Sharing from "expo-sharing";
import * as Print from "expo-print";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";

const base=process.env.EXPO_PUBLIC_API_URL;
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
type Status={status:string;canDownload:boolean};
type Issue={status:string;confirmed:boolean};
/** Original CG-19 status and PDF bytes for authorized CG15 center staff only.
 * Never make a public share link, store a patient PDF persistently, or reuse
 * an unverified old document after the patient withdrew consent.
 */
export function NativeCenterConsultationSlip({token,bookingRef,bookingStatus,onExpired}:{
 token:string;bookingRef:string;bookingStatus:string;onExpired:()=>void
}){
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false);
 const [uncertain,setUncertain]=useState(false),[message,setMessage]=useState("");
 const [current,setCurrent]=useState<Status|null>(null);
 const key=useRef<string|null>(null),cached=useRef<File|null>(null);
 const path="/api/v1/appointments/slips/staff/"+bookingRef;
 useEffect(()=>{
  let away=false;
  const remove=()=>{
   try{cached.current?.delete();}catch{/* best effort OS cache deletion */}
   cached.current=null;
  };
  const sub=AppState.addEventListener("change",state=>{
   if(state!=="active"){away=true;return;}
   if(away){away=false;remove();}
  });
  return()=>{sub.remove();remove();};
 },[]);
 async function call(route:string,method:"GET"|"POST"="GET",data?:object){
  if(!base||!/^https?:\/\//.test(base)||
   (process.env.NODE_ENV==="production"&&!base.startsWith("https://")))
   throw Error("Secure private consultation files are unavailable.");
  const response=await expoFetch(new URL(route,base).toString(),{
   method,signal:AbortSignal.timeout(15000),
   headers:{Authorization:"Bearer "+token,
    ...(data?{"Content-Type":"application/json"}:{})},
   body:data?JSON.stringify(data):undefined});
  if(!response.ok){
   if(response.status===401)onExpired();
   const raw:unknown=await response.json().catch(()=>null);
   const text=raw&&typeof raw==="object"&&"message" in raw&&
    typeof raw.message==="string"&&raw.message.length<=220?raw.message:
    response.status===403||response.status===404?
     "This consultation is not accessible at your assigned center.":
     "The original consultation slip cannot be confirmed.";
   throw new Error(text);
  }
  return response;
 }
 async function preview(){
  const response=await call(path+"/file");
  if(!response.headers.get("Content-Type")?.includes("application/pdf"))
   throw Error("The private file is not a verified PDF.");
  const bytes=await response.bytes();
  if(bytes.length<100||bytes.length>10485760||
   bytes[0]!==37||bytes[1]!==80||bytes[2]!==68||bytes[3]!==70)
   throw Error("Original private PDF content failed validation.");
  try{cached.current?.delete();}catch{/* replace prior private cached copy */}
  const file=new File(Paths.cache,"careganga-center-consultation-"+Crypto.randomUUID()+".pdf");
  file.create();await file.write(bytes);cached.current=file;
  if(!await File.canPreview(file,{mimeType:"application/pdf"}))
   throw Error("This device has no secure PDF viewer.");
  await File.preview(file,{title:"Private center consultation slip",mimeType:"application/pdf"});
 }
 async function status(){
  if(busy)return;
  setBusy(true);setMessage("");
  try{
   const reply=await call(path+"/status");
   const data=await reply.json() as Status;
   setCurrent(data);setUncertain(data.status==="UNKNOWN"||data.status==="PENDING");
   setMessage(data.canDownload?"Original private appointment PDF is ready.":
    data.status==="NOT_ISSUED"?"No appointment slip has been issued.":
     "The slip is not currently issued. Check original status before any further action.");
  }catch(e){setUncertain(true);setMessage(e instanceof Error?e.message:
   "Original slip status cannot be checked.");}
  finally{setBusy(false);}
 }
 async function issue(){
  if(busy||uncertain||current?.status!=="NOT_ISSUED")return;
  if(!key.current)key.current=Crypto.randomUUID();
  setBusy(true);setMessage("");
  try{
   const response=await call(path+"/issue","POST",{requestKey:key.current});
   const result=await response.json() as Issue;
   const statusResponse=await call(path+"/status");
   const record=await statusResponse.json() as Status;
   setCurrent(record);
   if(result.confirmed&&result.status==="ISSUED"&&record.canDownload){
    await preview();setUncertain(false);
    setMessage("The original private consultation PDF was opened.");
   }else{
    setUncertain(true);setMessage("Slip publication remains uncertain. Check original document status.");
   }
  }catch(e){setUncertain(true);setMessage(e instanceof Error?e.message:
   "Original document issue is uncertain. Do not issue a second document.");}
  finally{setBusy(false);}
 }
 /** Always recheck original CG19 staff center grant/consent and
  * issued document before opening a device share or print dialog.
  * A dispatched copy is an explicit external disclosure, never a new
  * public document URL or an assumed delivery receipt.
  */
 async function nativeAuthorizedPdf(mode:"SHARE"|"PRINT"){
  if(busy||!current?.canDownload)return;
  setBusy(true);setMessage("");
  let temporary:File|null=null;
  try{
   const statusReply=await call(path+"/status");
   const record=await statusReply.json() as Status;
   if(record.status!=="ISSUED"||!record.canDownload)
    throw Error("This original consultation slip is no longer authorized.");
   const fileResponse=await call(path+"/file");
   if(!fileResponse.headers.get("Content-Type")?.includes("application/pdf"))
    throw Error("Private consultation document type is invalid.");
   const data=await fileResponse.bytes();
   if(data.length<100||data.length>10485760||
    data[0]!==37||data[1]!==80||data[2]!==68||data[3]!==70)
    throw Error("Original private consultation PDF could not be verified.");
   temporary=new File(Paths.cache,"careganga-staff-action-"+
    Crypto.randomUUID()+".pdf");
   temporary.create();await temporary.write(data);
   if(mode==="SHARE"){
    if(!await Sharing.isAvailableAsync())
     throw Error("Device sharing is unavailable.");
    await Sharing.shareAsync(temporary.uri,{mimeType:"application/pdf",
     dialogTitle:"Share current private center consultation PDF"});
    setMessage("Share sheet closed. CareGanga cannot verify which recipient received a copy.");
   }else{
    await Print.printAsync({uri:temporary.uri});
    setMessage("Print dialog closed. Printing is not independently confirmed.");
   }
  }catch(e){
   setUncertain(true);
   setMessage(e instanceof Error?e.message:"Private PDF share or print unavailable.");
  }finally{
   try{temporary?.delete();}catch{/* OS dispatch owns external copy. */}
   setBusy(false);
  }
 }
 async function openIssued(){
  if(busy||!current?.canDownload)return;
  setBusy(true);setMessage("");
  try{await preview();setMessage("The original private consultation PDF was opened.");}
  catch(e){setUncertain(true);setMessage(e instanceof Error?e.message:
   "Private PDF could not be opened. Check original status.");}
  finally{setBusy(false);}
 }
 const button=(label:string,onClick:()=>void,disabled=false)=>(
  <Pressable accessibilityRole="button" disabled={busy||disabled}
   accessibilityState={{disabled:busy||disabled}} onPress={onClick}
   style={[styles.button,(busy||disabled)&&styles.disabled]}>
   <Text style={styles.text}>{label}</Text>
  </Pressable>);
 if(!ID.test(bookingRef)||["CANCELLED","NO_SHOW"].includes(bookingStatus))return null;
 return <View style={styles.container}>
  {button(open?"Hide consultation slip":"Consultation slip",()=>{
   setOpen(!open);if(!open)void status();
  })}
  {open&&<View style={styles.panel}>
   <Text style={styles.note}>Current consent and your assigned center are verified
    by the backend for every private PDF read. This is not a payment receipt.</Text>
   {!!message&&<Text accessibilityRole="alert" style={styles.note}>{message}</Text>}
   {button("Check original slip status",()=>void status())}
   {current?.canDownload&&button("Open private PDF",()=>void openIssued())}
   {current?.canDownload&&!uncertain&&<>
    {button("Print current private consultation PDF",()=>void nativeAuthorizedPdf("PRINT"))}
    {button("Share private PDF outside CareGanga",()=>void nativeAuthorizedPdf("SHARE"))}
    <Text style={styles.note}>Only share with an authorized recipient.
     The app cannot revoke a printed or externally shared copy.</Text>
   </>}
   {current?.status==="NOT_ISSUED"&&!uncertain&&
    button("Issue original consultation slip",()=>void issue())}
   {uncertain&&<Text style={styles.note}>Keep the original issue reference.
    Do not create a different slip until its status is confirmed.</Text>}
  </View>}
 </View>;
}
const styles=StyleSheet.create({
 container:{gap:8},
 panel:{padding:10,borderWidth:1,borderColor:t.border,borderRadius:10,gap:8},
 button:{minHeight:44,padding:10,borderWidth:1,borderColor:t.border,
  borderRadius:8,justifyContent:"center"},
 text:{fontSize:13,fontWeight:"600",color:t.text},
 note:{fontSize:12,color:t.mutedText},
 disabled:{opacity:0.45}
});
