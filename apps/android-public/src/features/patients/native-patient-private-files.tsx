import {useCallback,useEffect,useRef,useState} from "react";
import {AppState,Pressable,StyleSheet,Text,View} from "react-native";
import {File,Paths} from "expo-file-system";
import {fetch as expoFetch} from "expo/fetch";
import * as Crypto from "expo-crypto";
import {careGangaPublicTheme as t} from "../../../../../packages/design-tokens/src/index";
import {NativePatientClinicalFileShares} from "./native-patient-clinical-file-shares";

type Kind="PATIENT_PHOTO"|"PATIENT_UPLOADED_PRESCRIPTION"|"PATIENT_MEDICAL_REPORT"|"PATIENT_PARTNER_INVOICE"|"PATIENT_PARTNER_SERVICE_PROOF"|"PATIENT_PARTNER_PAYMENT_PROOF";
type PatientFileItem={fileRef:string;classification:Kind;mime:string;
 sizeBytes:number;version:number;revoked:boolean;createdAt:string};
type Page={files:PatientFileItem[];next:string|null};
type Intent={uploadRef:string;status:string;uploadReady?:boolean;
 uploadUrl?:string;uploadHeaders?:Record<string,string>;
 cleanVerified?:boolean;fileRef?:string|null};
const base=process.env.EXPO_PUBLIC_API_URL;
function endpoint(route:string){
 if(!base||!/^https?:\/\//.test(base)||
  (process.env.NODE_ENV==="production"&&!base.startsWith("https://")))
  throw Error("The secure patient file service is unavailable.");
 return new URL("/api/documents/patient-files/"+route,base).toString();
}
async function source<T>(token:string,route:string,method:"GET"|"POST"="GET",
 input?:object):Promise<T>{
 const r=await expoFetch(endpoint(route),{method,
  signal:AbortSignal.timeout(16000),
  headers:{Authorization:"Bearer "+token,
   ...(method==="POST"?{"Content-Type":"application/json"}:{})},
  body:method==="POST"?JSON.stringify(input??{}):undefined});
 if(!r.ok)throw Error(r.status===401?"Your patient session has expired. Sign in again.":
  r.status===403||r.status===404?
   "Current verified patient identity does not authorize this document.":
  r.status===409?"The original private document was changed. Check its status.":
  "Your private document request could not be confirmed.");
 return await r.json() as T;
}
const formats=["application/pdf","image/jpeg","image/png","image/webp"];
/** Original CG19 malware verified patient-owned scanned files, no generated
 * clinician prescription, no public link and no permission based on phone.
 */
export function NativePatientPrivateFiles({token,consentGranted,onExpired}:{
 token:string;consentGranted:boolean;onExpired:()=>void
}){
 const [rows,setRows]=useState<PatientFileItem[]>([]),[next,setNext]=useState<string|null>(null);
 const [kind,setKind]=useState<Kind>("PATIENT_MEDICAL_REPORT");
 const [selected,setSelected]=useState<File|null>(null),[busy,setBusy]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [intent,setIntent]=useState<string|null>(null),[uncertain,setUncertain]=useState(false);
 const uploadKey=useRef<string|null>(null),preview=useRef<File|null>(null);
 const current=useRef(0);
 const clearPreview=()=>{
  try{preview.current?.delete();}catch{/* OS viewer may own an external copy. */}
  preview.current=null;
 };
 const call=useCallback(async <T,>(route:string,method:"GET"|"POST"="GET",input?:object)=>{
  try{return await source<T>(token,route,method,input);}
  catch(e){if(e instanceof Error&&e.message.includes("session has expired"))
   onExpired();throw e;}
 },[token,onExpired]);
 const load=useCallback(async(after?:string)=>{
  const r=await call<Page>("files"+(after?"?after="+encodeURIComponent(after):""));
  setRows(old=>after?[...old,...r.files]:r.files);
  setNext(r.next);
 },[call]);
 useEffect(()=>{
  let alive=true;const epoch=++current.current;
  setRows([]);setNext(null);
  void load().catch(()=>{if(alive&&epoch===current.current)
   setError("Your verified private document history cannot be checked.");});
  return()=>{alive=false;current.current++;clearPreview();};
 },[load]);
 useEffect(()=>{
  let away=false;
  const sub=AppState.addEventListener("change",state=>{
   if(state!=="active"){away=true;return;}
   if(away){away=false;clearPreview();}
  });
  return()=>{sub.remove();clearPreview();};
 },[]);
 const button=(label:string,fn:()=>void,disabled=false)=>(
  <Pressable accessibilityRole="button" disabled={busy||disabled}
   accessibilityState={{disabled:busy||disabled}}
   onPress={fn} style={[styles.action,(busy||disabled)&&styles.disabled]}>
   <Text style={styles.actionText}>{label}</Text>
  </Pressable>);
 async function choose(){
  if(busy||uncertain)return;
  try{
   const result=await File.pickFileAsync({mimeTypes:formats});
   if(result.canceled||!result.result)return;
   const file=result.result;
   if(file.size<1||file.size>10485760||!formats.includes(file.type)||
    kind==="PATIENT_PHOTO"&&file.type==="application/pdf")
    throw Error("Select one JPG, PNG, WebP or PDF file no larger than 10 MB.");
   uploadKey.current=Crypto.randomUUID();
   setSelected(file);setIntent(null);setError("");setNotice("");
  }catch(e){setError(e instanceof Error?e.message:"Cannot select a private document.");}
 }
 async function upload(){
  if(!selected||busy||uncertain||!consentGranted)return;
  setBusy(true);setError("");setNotice("");
  try{
   if(selected.size<1||selected.size>10485760||!formats.includes(selected.type))
    throw Error("Unsupported private file type or size.");
   const bytes=await selected.bytes();
   if(bytes.byteLength!==selected.size)throw Error("The selected file changed.");
   const digest=new Uint8Array(await Crypto.digest(
    Crypto.CryptoDigestAlgorithm.SHA256,bytes));
   const sha256=Array.from(digest).map(x=>x.toString(16).padStart(2,"0")).join("");
   if(!uploadKey.current)uploadKey.current=Crypto.randomUUID();
   const started=await call<Intent>("intents","POST",{
    requestKey:uploadKey.current,classification:kind,mime:selected.type,
    sizeBytes:selected.size,sha256});
   if(!started.uploadRef)throw Error("Secure upload reference missing.");
   setIntent(started.uploadRef);
   if(!started.uploadReady||!started.uploadUrl||!started.uploadHeaders){
    setUncertain(true);setNotice("Storage or scanner is unavailable. Check the original upload reference.");
    return;
   }
   if(!started.uploadUrl.startsWith("https://")||
    started.uploadHeaders["Content-Type"]!==selected.type)
    throw Error("The secure upload destination could not be verified.");
   const uploaded=await expoFetch(started.uploadUrl,{method:"PUT",
    headers:started.uploadHeaders,body:selected});
   if(!uploaded.ok)throw Error("Upload outcome uncertain. Check the original status.");
   const confirmed=await call<Intent>("intents/"+started.uploadRef+"/confirm","POST",{});
   if(!confirmed.cleanVerified||!confirmed.fileRef){
    setUncertain(true);setNotice("Scanner verification is pending or unavailable.");
    return;
   }
   setSelected(null);setUncertain(false);setIntent(null);uploadKey.current=null;
   setNotice("Your privately scanned patient file was verified.");
   await load();
  }catch(e){
   setUncertain(true);
   setError(e instanceof Error?e.message:"Upload result uncertain; check the original status.");
  }finally{setBusy(false);}
 }
 async function recover(){
  if(!intent||busy)return;
  setBusy(true);setError("");
  try{
   const state=await call<Intent>("intents/"+encodeURIComponent(intent));
   setUncertain(state.status!=="VALIDATED"&&state.status!=="REJECTED");
   setNotice(state.cleanVerified?"Original verified scanned patient file is available.":
    "Original upload status: "+state.status+". Unverified files are not readable.");
   await load();
  }catch(e){setError(e instanceof Error?e.message:"Original upload unavailable.");}
  finally{setBusy(false);}
 }
 async function readFile(row:PatientFileItem){
  if(busy||row.revoked)return;
  setBusy(true);setError("");clearPreview();
  try{
   const reply=await expoFetch(endpoint("files/"+encodeURIComponent(row.fileRef)+
    "/download"),{headers:{Authorization:"Bearer "+token},
    signal:AbortSignal.timeout(16000)});
   if(reply.status===401){onExpired();throw Error("Patient session expired.");}
   if(!reply.ok)throw Error("Your current account cannot read this private file.");
   const mime=reply.headers.get("Content-Type")?.split(";")[0]??"";
   if(mime!==row.mime)throw Error("Verified document type changed.");
   const bytes=await reply.bytes();
   if(bytes.length<1||bytes.length>10485760)
    throw Error("Verified document size is invalid.");
   const ext=mime==="application/pdf"?".pdf":mime==="image/jpeg"?".jpg":
    mime==="image/png"?".png":".webp";
   const file=new File(Paths.cache,"careganga-patient-verified-"+
    Crypto.randomUUID()+ext);
   file.create();await file.write(bytes);preview.current=file;
   if(!await File.canPreview(file,{mimeType:mime}))
    throw Error("No compatible private document viewer is installed.");
   await File.preview(file,{title:"My private patient document",mimeType:mime});
   setNotice("Authorized private document handed to your device viewer.");
  }catch(e){setError(e instanceof Error?e.message:"Private document cannot be viewed.");}
  finally{setBusy(false);}
 }
 async function revoke(row:PatientFileItem){
  if(busy||row.revoked)return;
  setBusy(true);setError("");
  try{
   const r=await call<{status:string}>(
    "files/"+encodeURIComponent(row.fileRef)+"/revoke",
    "POST",{expectedVersion:row.version});
   if(r.status!=="REVOKED")throw Error("Revocation was not confirmed.");
   clearPreview();await load();setNotice("Original patient file access was revoked.");
  }catch(e){setError(e instanceof Error?e.message:"Revocation uncertain.");}
  finally{setBusy(false);}
 }
 return <View style={styles.panel}>
  <Text style={styles.title}>My scanned private health documents</Text>
  <Text style={styles.note}>Your own photo, previously issued prescription copy or
   medical report, partner invoice or completed-service evidence. Files are not approved bills or clinical confirmations. Never a CareGanga-issued clinical prescription. Files are
   unavailable until the original secure scanner verifies them.</Text>
  {!!error&&<Text accessibilityRole="alert" style={styles.note}>{error}</Text>}
  {!!notice&&<Text accessibilityRole="alert" style={styles.note}>{notice}</Text>}
  {consentGranted?<View style={styles.group}>
   <Text style={styles.note}>Document type</Text>
   {(["PATIENT_MEDICAL_REPORT","PATIENT_UPLOADED_PRESCRIPTION","PATIENT_PHOTO",
    "PATIENT_PARTNER_INVOICE","PATIENT_PARTNER_SERVICE_PROOF",
    "PATIENT_PARTNER_PAYMENT_PROOF"] as Kind[]).
    map(k=><Pressable key={k} accessibilityRole="radio"
     accessibilityState={{checked:kind===k}} onPress={()=>{if(!busy&&!uncertain){
      setKind(k);setSelected(null);uploadKey.current=null;}}}
     style={[styles.select,kind===k&&styles.chosen]}>
     <Text style={styles.note}>{k==="PATIENT_PHOTO"?"My photo":
      k==="PATIENT_MEDICAL_REPORT"?"My scanned medical report":
      k==="PATIENT_PARTNER_INVOICE"?"My partner invoice (unverified)":
      k==="PATIENT_PARTNER_SERVICE_PROOF"?"My completed-service document":
      k==="PATIENT_PARTNER_PAYMENT_PROOF"?"My unverified partner payment receipt":
      "My earlier prescription copy"}</Text>
    </Pressable>)}
   {button(selected?"Change selected private file":"Choose a private document",()=>void choose(),uncertain)}
   {selected&&<Text style={styles.note}>{selected.name} ·
    {" "+Math.ceil(selected.size/1024)} KB</Text>}
   {selected&&button("Upload and verify scanned private document",()=>void upload(),uncertain)}
   {intent&&button("Check original upload status",()=>void recover())}
  </View>:<Text style={styles.note}>Patient-care consent is withdrawn. New
   uploads are blocked; you can still access or revoke your existing lawful files.</Text>}
  <Text style={styles.title}>My verified patient files</Text>
  {rows.length===0&&<Text style={styles.note}>No verified scanned patient files to display.</Text>}
  {rows.map(row=><View key={row.fileRef} style={styles.item}>
   <Text style={styles.note}>{row.classification==="PATIENT_PHOTO"?"Patient photo":
    row.classification==="PATIENT_MEDICAL_REPORT"?"Scanned medical report":
    row.classification==="PATIENT_PARTNER_INVOICE"?"Partner invoice (unverified)":
    row.classification==="PATIENT_PARTNER_SERVICE_PROOF"?"Completed-service evidence":
    row.classification==="PATIENT_PARTNER_PAYMENT_PROOF"?"Partner payment receipt (unverified)":
    "Patient-supplied prescription copy"} · {Math.ceil(row.sizeBytes/1024)} KB</Text>
   <Text style={styles.note}>{row.revoked?"Revoked":"Verified"} ·
    {" "+new Date(row.createdAt).toLocaleDateString("en-IN")}</Text>
   {!row.revoked&&<>
    {row.classification!=="PATIENT_PARTNER_INVOICE"&&
     row.classification!=="PATIENT_PARTNER_SERVICE_PROOF"&&
     row.classification!=="PATIENT_PARTNER_PAYMENT_PROOF"&&
     <NativePatientClinicalFileShares token={token} fileRef={row.fileRef}
     consentGranted={consentGranted} onExpired={onExpired}/>}
    {button("View my private file",()=>void readFile(row))}
    {button("Revoke this document",()=>void revoke(row))}
   </>}
  </View>)}
  {!!next&&button("Show older private files",()=>
   void load(next).catch(()=>setError("Older file history unavailable.")))}
 </View>;
}
const styles=StyleSheet.create({
 panel:{padding:12,borderWidth:1,borderColor:t.border,borderRadius:10,
  backgroundColor:t.surface,gap:10},
 title:{fontSize:15,fontWeight:"700",color:t.text},
 note:{fontSize:12,color:t.mutedText},
 group:{gap:8},item:{borderColor:t.border,borderWidth:1,borderRadius:8,padding:10,gap:6},
 select:{padding:10,borderWidth:1,borderRadius:8,borderColor:t.border},
 chosen:{borderWidth:2,borderColor:t.primary},
 action:{borderRadius:8,backgroundColor:t.primary,minHeight:44,
  padding:10,alignItems:"center",justifyContent:"center"},
 actionText:{fontWeight:"600",color:t.primaryText},
 disabled:{opacity:0.5}
});
