import {useEffect,useRef,useState} from "react";
import {AppState,Pressable,StyleSheet,Text,View} from "react-native";
import {File,Paths} from "expo-file-system";
import * as Crypto from "expo-crypto";
import {fetch as expoFetch} from "expo/fetch";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";

type Item={fileRef:string;classification:string;mime:string;
 sizeBytes:number;createdAt:string};
type Result={bookingRef:string;files:Item[]};
const base=process.env.EXPO_PUBLIC_API_URL;
function endpoint(route:string){
 if(!base||!/^https?:\/\//.test(base)||
  (process.env.NODE_ENV==="production"&&!base.startsWith("https://")))
  throw Error("Private patient document service is unavailable.");
 return new URL("/api/documents/patient-clinical/"+route,base).toString();
}
/** Real CG01 clinician, current CG14 doctor/center, checked-in patient
 * and original CG19 patient-granted file authorization always backend-owned.
 * No signed GET URLs and no public file shares.
 */
export function NativeClinicianSharedPatientFiles({
 token,centerRef,bookingRef,onExpired
}:{
 token:string;centerRef:string;bookingRef:string;onExpired:()=>void
}){
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false);
 const [items,setItems]=useState<Item[]>([]),[message,setMessage]=useState("");
 const file=useRef<File|null>(null),serial=useRef(0);
 const route="centers/"+encodeURIComponent(centerRef)+"/bookings/"+
  encodeURIComponent(bookingRef)+"/files";
 function cleanup(){
  try{file.current?.delete();}catch{/* viewer has already received a copy */}
  file.current=null;
 }
 useEffect(()=>{
  serial.current++;cleanup();setOpen(false);setItems([]);setMessage("");
  return()=>{serial.current++;cleanup();};
 },[centerRef,bookingRef,token]);
 useEffect(()=>{
  let external=false;
  const sub=AppState.addEventListener("change",s=>{
   if(s!=="active")external=true;
   else if(external){external=false;cleanup();}
  });
  return()=>{sub.remove();cleanup();};
 },[]);
 async function get(path:string){
  const r=await expoFetch(endpoint(path),{method:"GET",
   cache:"no-store",signal:AbortSignal.timeout(17000),
   headers:{Authorization:"Bearer "+token}});
  if(r.status===401){onExpired();throw Error("Clinical session expired.");}
  if(!r.ok)throw Error(r.status===403||r.status===404?
   "Current clinician, patient consent, appointment or file grant denies access.":
   "Original patient-shared file status could not be confirmed.");
  return r;
 }
 async function refresh(){
  const key=++serial.current;setBusy(true);setMessage("");
  try{
   const response=await get(route);
   const data=await response.json() as Result;
   if(key!==serial.current||data.bookingRef!==bookingRef)return;
   setItems(data.files);
  }catch(e){
   if(key===serial.current){setItems([]);
    setMessage(e instanceof Error?e.message:"Patient clinical document unavailable.");}
  }finally{if(key===serial.current)setBusy(false);}
 }
 async function read(item:Item){
  const key=++serial.current;setBusy(true);setMessage("");cleanup();
  try{
   const response=await get(route+"/"+encodeURIComponent(item.fileRef)+"/download");
   const mime=response.headers.get("Content-Type")?.split(";")[0]??"";
   if(mime!==item.mime)throw Error("Protected file type was changed.");
   const bytes=await response.bytes();
   if(bytes.length<1||bytes.length>10485760)
    throw Error("Original private file length is invalid.");
   if(key!==serial.current)return;
   const suffix=mime==="application/pdf"?".pdf":mime==="image/jpeg"?".jpg":
    mime==="image/png"?".png":mime==="image/webp"?".webp":"";
   if(!suffix)throw Error("The current private file format cannot be opened.");
   const current=new File(Paths.cache,"careganga-clinical-shared-"+
    Crypto.randomUUID()+suffix);
   current.create();await current.write(bytes);file.current=current;
   if(!await File.canPreview(current,{mimeType:mime}))
    throw Error("No compatible secure file viewer is available.");
   await File.preview(current,{title:"Patient-shared scanned copy",mimeType:mime});
   if(key===serial.current)
    setMessage("The explicitly authorized patient-provided copy was handed to your device viewer. Avoid sharing it externally.");
  }catch(e){
   if(key===serial.current)
    setMessage(e instanceof Error?e.message:"Patient file cannot be opened.");
  }finally{if(key===serial.current)setBusy(false);}
 }
 const button=(label:string,fn:()=>void)=>(
  <Pressable accessibilityRole="button" disabled={busy} onPress={fn}
   style={[styles.button,busy&&styles.disabled]}>
   <Text style={styles.label}>{label}</Text>
  </Pressable>);
 return <View style={styles.panel}>
  {button(open?"Hide patient-shared reports":"Patient-shared scanned reports",()=>{
   if(open){serial.current++;cleanup();setOpen(false);setItems([]);setMessage("");setBusy(false);}
   else{setOpen(true);void refresh();}
  })}
  {open&&<>
   <Text style={styles.note}>Only this booked verified doctor's current
    consented, checked-in appointment files. These are patient-supplied
    copies, not clinician-issued prescriptions.</Text>
   {!!message&&<Text accessibilityRole="alert" style={styles.note}>{message}</Text>}
   {busy&&<Text style={styles.note}>Rechecking current clinical permission…</Text>}
   {!busy&&items.length===0&&
    <Text style={styles.note}>No currently patient-approved files.</Text>}
   {items.map(item=><View style={styles.item} key={item.fileRef}>
    <Text style={styles.note}>{item.classification.replaceAll("_"," ")} ·
     {" "+Math.ceil(item.sizeBytes/1024)} KB</Text>
    {button("View patient's authorized scanned copy",()=>void read(item))}
   </View>)}
   {button("Refresh patient permissions",()=>void refresh())}
  </>}
 </View>;
}
const styles=StyleSheet.create({
 panel:{padding:10,borderRadius:8,borderWidth:1,borderColor:t.border,gap:8},
 item:{padding:8,borderWidth:1,borderColor:t.border,borderRadius:8,gap:7},
 button:{minHeight:44,borderRadius:8,borderWidth:1,borderColor:t.border,
  padding:9,justifyContent:"center"},
 label:{color:t.text,fontSize:13,fontWeight:"600"},
 note:{fontSize:12,color:t.mutedText},
 disabled:{opacity:0.4}
});
