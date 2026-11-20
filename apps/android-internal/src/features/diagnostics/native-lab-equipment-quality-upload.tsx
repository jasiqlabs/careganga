import {useEffect,useRef,useState} from "react";
import {Pressable,StyleSheet,Text,View} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import {File,UploadType} from "expo-file-system";
import * as Crypto from "expo-crypto";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";

type Current={exists:boolean;uploadRef?:string;status?:string;cleanVerified:boolean;
 expiresAt?:string;
 original?:{requestKey:string;sizeBytes:number;sha256:string;mime:string;documentKind:string}};
type Reservation={uploadRef:string;status:string;uploadReady:boolean;
 uploadUrl?:string;uploadHeaders?:Record<string,string>;message?:string};
type Verified={uploadRef:string;status:string;cleanVerified:boolean;
 verifiedFileRef?:string|null};
type Original={requestKey:string;sizeBytes:number;sha256:string;mime:string;documentKind:string};
type Picked={uri:string;size:number;name:string};
type Props={token:string;centerRef:string;equipmentRef:string;
 onVerified:()=>Promise<void>;onExpired:()=>void};
const TYPES=["CALIBRATION","MAINTENANCE","QUALITY_CERTIFICATE"] as const;
async function api<T>(token:string,path:string,method:"GET"|"POST"="GET",data?:object){
 const result=await identityRequest("/api/v1/diagnostics/equipment/"+path,{
  method,cache:"no-store",headers:{Authorization:"Bearer "+token,
   ...(data?{"Content-Type":"application/json"}:{})},
  body:data?JSON.stringify(data):undefined});
 if(!result.ok)throw Object.assign(new Error(
  result.status===401?"Your session expired.":
  result.status===403?"Not authorized to upload this laboratory evidence.":
  result.status===409?"This original quality upload has changed.":
  "Protected quality upload cannot be confirmed. Check the original status."
 ),{status:result.status});
 return result.json() as Promise<T>;
}
export function NativeLabEquipmentQualityUpload({token,centerRef,equipmentRef,
 onVerified,onExpired}:Props){
 const [selected,setSelected]=useState<Picked|null>(null);
 const [kind,setKind]=useState<(typeof TYPES)[number]>("CALIBRATION");
 const [busy,setBusy]=useState(false),[checking,setChecking]=useState(true);
 const [blocked,setBlocked]=useState(false),[status,setStatus]=useState("NOT_UPLOADED");
 const [canRestart,setCanRestart]=useState(false);
 const [message,setMessage]=useState("");
 const original=useRef<Original|null>(null),uploadRef=useRef("");
 const base="centers/"+centerRef+"/items/"+equipmentRef+"/evidence";
 useEffect(()=>{
  let active=true;setChecking(true);setBlocked(false);setCanRestart(false);setStatus("NOT_UPLOADED");
  original.current=null;uploadRef.current="";setMessage("");
  void api<Current>(token,base+"/current").then(v=>{
   if(!active)return;
   if(v.exists&&v.uploadRef&&v.original){
    setStatus(v.status??"UNKNOWN");
    if(v.cleanVerified){setMessage("Previous document scanner-verified. "+
     "You can create another original upload.");return;}
    original.current=v.original;uploadRef.current=v.uploadRef;
    setCanRestart(v.status==="REJECTED"||
     !!v.expiresAt&&Date.parse(v.expiresAt)<=Date.now());
    setKind(v.original.documentKind as (typeof TYPES)[number]);
    setMessage("An earlier upload is unfinished. Re-select the same PDF "+
     "or check the original scanner status.");
   }
  }).catch(e=>{
   if(!active)return;setBlocked(true);
   if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
   setMessage(e instanceof Error?e.message:"Original source could not be checked.");
  }).finally(()=>{if(active)setChecking(false)});
  return()=>{active=false};
 },[token,base,onExpired]);
 async function choose(){
  if(busy||checking||blocked)return;
  try{
   const picked=await DocumentPicker.getDocumentAsync({type:"application/pdf",
    multiple:false,copyToCacheDirectory:true});
   if(picked.canceled)return;
   const f=picked.assets?.[0];
   if(!f||!f.size||f.size<1||f.size>10485760||
     f.mimeType!=="application/pdf"||!f.name.toLowerCase().endsWith(".pdf")){
    setMessage("Select one PDF smaller than 10 MB.");return;
   }
   setSelected({uri:f.uri,size:f.size,name:f.name});setMessage("");
  }catch{setMessage("The private PDF picker could not open.");}
 }
 async function check(){
  if(!uploadRef.current||busy)return;
  setBusy(true);setMessage("");
  try{
   const v=await api<Verified>(token,base+"/"+uploadRef.current+"/status");
   setStatus(v.status);
   if(v.cleanVerified){
    setMessage("Private evidence scanner-verified. Instrument is not automatically READY.");
    original.current=null;uploadRef.current="";setSelected(null);setCanRestart(false);
    try{await onVerified()}catch{setMessage("Verified but history refresh failed.");}
   }else setMessage("Original quality scan is not complete. Do not use it for readiness.");
  }catch(e){
   if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
   setMessage(e instanceof Error?e.message:"Original scanner unavailable.");
  }finally{setBusy(false);}
 }
 async function upload(){
  if(busy||checking||blocked||!selected)return;
  setBusy(true);setMessage("");
  try{
   const file=new File(selected.uri),sha256=await file.digest("SHA-256");
   if(!/^[a-f0-9]{64}$/.test(sha256))
    throw Error("PDF checksum cannot be verified.");
   const payload=original.current??{requestKey:Crypto.randomUUID(),
    sizeBytes:selected.size,sha256,mime:"application/pdf",documentKind:kind};
   if(payload.sha256!==sha256||payload.sizeBytes!==selected.size)
    throw Error("Only the same original PDF can resume this upload.");
   original.current=payload;
   const reserved=await api<Reservation>(token,base+"/prepare","POST",payload);
   uploadRef.current=reserved.uploadRef;setStatus(reserved.status);
   if(!reserved.uploadReady||!reserved.uploadUrl||!reserved.uploadHeaders){
    setMessage(reserved.message??"Secure scanner unavailable. No readiness recorded.");
    return;
   }
   const target=new URL(reserved.uploadUrl);
   if(target.protocol!=="https:"||target.username||target.password||
      target.hash||reserved.uploadHeaders["Content-Type"]!=="application/pdf")
    throw Error("Secure upload destination cannot be verified.");
   const transfer=file.createUploadTask(reserved.uploadUrl,{
    httpMethod:"PUT",uploadType:UploadType.BINARY_CONTENT,
    mimeType:"application/pdf",headers:reserved.uploadHeaders,sessionType:"foreground"
   });
   const completed=await transfer.uploadAsync();transfer.release();
   if(completed.status<200||completed.status>=300)
    throw Error("Private PDF transfer cannot be confirmed.");
   const done=await api<Verified>(token,base+"/"+reserved.uploadRef+"/confirm","POST");
   setStatus(done.status);
   if(done.cleanVerified){
    original.current=null;uploadRef.current="";setSelected(null);
    setMessage("Scanned clean and stored privately. Maintenance readiness is a separate action.");
    try{await onVerified()}catch{setMessage("Scanner verified; file list refresh unavailable.");}
   }else setMessage("Scan is not verified. Equipment readiness unchanged.");
  }catch(e){
   if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
   setMessage(e instanceof Error?e.message:"Upload outcome uncertain. Check original status.");
  }finally{setBusy(false);}
 }
 const button=(label:string,fn:()=>void,disabled=false,active=false)=>
  <Pressable accessibilityRole="button" accessibilityState={{disabled,selected:active}}
   disabled={disabled} style={[s.button,disabled&&s.disabled,active&&s.active]} onPress={fn}>
   <Text style={s.body}>{label}</Text>
  </Pressable>;
 return <View style={s.panel}>
  <Text style={s.title}>Private quality / calibration PDF</Text>
  <Text style={s.body}>CG19 malware-verified original file only.
   This is not lab accreditation or permission to treat patients.</Text>
  {checking?<Text style={s.body}>Checking original upload…</Text>:<>
   {canRestart&&!!uploadRef.current&&button(
    "Start a new PDF after rejected/expired original",()=>{
     original.current=null;uploadRef.current="";setSelected(null);
     setCanRestart(false);setStatus("NOT_UPLOADED");
     setMessage("Previous original retained for audit; choose a new PDF.");
    },busy)}
   <View style={s.row}>{TYPES.map(v=>
    <View key={v}>{button(v.replaceAll("_"," ").toLowerCase(),
     ()=>setKind(v),busy||blocked||!!uploadRef.current,kind===v)}</View>)}</View>
   {button(selected?selected.name:"Choose private PDF (up to 10 MB)",
    ()=>void choose(),busy||blocked)}
   {!!selected&&button(uploadRef.current?"Retry original PDF":"Upload and scan original PDF",
    ()=>void upload(),busy||blocked||["REJECTED"].includes(status))}
   {!!uploadRef.current&&button("Check original upload scanner status",
    ()=>void check(),busy||blocked)}
  </>}
  <Text style={s.body}>Evidence: {status.replaceAll("_"," ")}.
   Readiness requires separate authorized maintenance evidence.</Text>
  {!!message&&<Text accessibilityRole="alert" style={s.hint}>{message}</Text>}
 </View>;
}
const s=StyleSheet.create({
 panel:{padding:12,gap:9,borderRadius:12,borderWidth:1,
  borderColor:t.border,backgroundColor:t.surface},
 title:{fontWeight:"700",fontSize:16,color:t.text},
 body:{fontSize:13,lineHeight:20,color:t.text},
 hint:{fontSize:13,lineHeight:19,color:t.mutedText},
 row:{flexDirection:"row",flexWrap:"wrap",gap:6},
 button:{minHeight:48,padding:11,borderRadius:10,borderWidth:1,
  borderColor:t.border,justifyContent:"center"},
 active:{borderColor:t.primary,backgroundColor:t.selectedSurface},
 disabled:{opacity:0.5}
});
