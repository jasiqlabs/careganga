import {useEffect,useRef,useState} from "react";
import {Pressable,StyleSheet,Text,View} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import {File,UploadType} from "expo-file-system";
import * as Crypto from "expo-crypto";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";
type Kind="HEALTH_DOCTOR_LICENSE"|"HEALTH_DOCTOR_PORTRAIT";
type Props={token:string;doctorRef:string;version:number;classification:Kind;
 onVerified:(ref:string,fileVersion:number)=>void;onExpired:()=>void};
type Picked={uri:string;name:string;size:number;mime:string};
type Intent={uploadRef:string;status:string;uploadUrl?:string;
 uploadHeaders?:Record<string,string>};
type Status={status:string;fileRef:string|null;fileVersion:number|null;
 cleanVerified:boolean};
type Item={fileRef:string;fileVersion:number;classification:string;
 cleanVerified:boolean;currentVersion:boolean;status:string};
async function request<T>(token:string,path:string,
 method:"GET"|"POST"="GET",body?:object):Promise<T>{
 const response=await identityRequest("/api/documents/doctor-evidence"+path,{
  method,cache:"no-store",headers:{Authorization:"Bearer "+token,
   ...(body?{"Content-Type":"application/json"}:{})},
  ...(body?{body:JSON.stringify(body)}:{})});
 if(!response.ok)throw Object.assign(new Error(
  response.status===401?"Sign in again.":
  response.status===403?"Current doctor and protected file permission denied.":
  response.status===409?"Original doctor revision or upload has changed.":
  "Doctor licence storage or scanning outcome is uncertain."
 ),{status:response.status});
 return response.json() as Promise<T>;
}
export function NativeDoctorEvidenceUploader({token,doctorRef,version,classification,
 onVerified,onExpired}:Props){
 const [picked,setPicked]=useState<Picked|null>(null);
 const [busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false);
 const [notice,setNotice]=useState(""),[intent,setIntent]=useState("");
 const [verified,setVerified]=useState(false),[files,setFiles]=useState<Item[]>([]);
 const [refresh,setRefresh]=useState(0);
 const original=useRef<{requestKey:string;mime:string;sizeBytes:number;
  sha256:string}|null>(null);
 const portrait=classification==="HEALTH_DOCTOR_PORTRAIT";
 const types=portrait?["image/jpeg","image/png","image/webp"]:
  ["application/pdf","image/jpeg","image/png","image/webp"];
 useEffect(()=>{
  let live=true;setPicked(null);setIntent("");setUncertain(false);
  original.current=null;setVerified(false);
  void request<{files:Item[]}>(token,"/doctors/"+encodeURIComponent(doctorRef))
   .then(data=>{
    if(!live)return;
    const list=Array.isArray(data.files)?data.files:[];
    setFiles(list);
    const current=list.find(x=>x.classification===classification&&
     x.currentVersion&&x.cleanVerified);
    if(current?.fileRef&&current.fileVersion)
     onVerified(current.fileRef,current.fileVersion);
   }).catch(e=>{
    if(live)setNotice(e instanceof Error?e.message:
     "Original doctor evidence unavailable.");
   });
  return()=>{live=false};
 },[token,doctorRef,version,classification,refresh]);
 const button=(label:string,fn:()=>void,disabled=false)=>
  <Pressable accessibilityRole="button" disabled={disabled}
   accessibilityState={{disabled}} onPress={fn}
   style={[styles.button,disabled&&styles.disabled]}>
   <Text style={styles.text}>{label}</Text>
  </Pressable>;
 function fail(e:unknown){
  if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
  setNotice(e instanceof Error?e.message:"Private doctor evidence is uncertain.");
 }
 async function choose(){
  if(busy||uncertain)return;
  try{
   const item=await DocumentPicker.getDocumentAsync({
    type:types,multiple:false,copyToCacheDirectory:true});
   if(item.canceled)return;
   const file=item.assets?.[0];
   if(!file?.size||file.size<1||file.size>10485760||
    !file.mimeType||!types.includes(file.mimeType)){
    setNotice("Select a supported PDF or image smaller than 10 MB.");return;
   }
   setPicked({uri:file.uri,name:file.name,size:file.size,mime:file.mimeType});
   original.current=null;setIntent("");setVerified(false);setNotice("");
  }catch{setNotice("Original private file picker unavailable.")}
 }
 async function check(){
  if(!intent||busy)return;
  setBusy(true);setNotice("");
  try{
   const status=await request<Status>(token,"/intents/"+encodeURIComponent(intent));
   setUncertain(false);
   if(status.cleanVerified&&status.fileRef&&status.fileVersion){
    setVerified(true);setRefresh(x=>x+1);
    onVerified(status.fileRef,status.fileVersion);
    setNotice("Original private doctor evidence is scanner-verified.");
   }else setNotice("Not yet verified: "+status.status.replaceAll("_"," ")+
    ". No professional approval or public image rights are implied.");
  }catch(e){setUncertain(true);fail(e)}finally{setBusy(false)}
 }
 async function upload(){
  if(!picked||busy||uncertain||verified)return;
  setBusy(true);setNotice("");
  try{
   const file=new File(picked.uri);
   const digest=await file.digest("SHA-256");
   if(!/^[a-f0-9]{64}$/.test(digest))
    throw Error("Private licence checksum cannot be confirmed.");
   const source=original.current??{requestKey:Crypto.randomUUID(),
    mime:picked.mime,sizeBytes:picked.size,sha256:digest};
   if(source.sha256!==digest||source.sizeBytes!==picked.size||
    source.mime!==picked.mime)
    throw Error("Original selected proof changed. Check the prior upload.");
   original.current=source;
   const reservation=await request<Intent>(token,"/intents","POST",{
    doctorRef,sourceVersion:version,classification,...source
   });
   if(!reservation.uploadRef)throw Error("Original upload intent is not recorded.");
   setIntent(reservation.uploadRef);
   if(!reservation.uploadUrl||!reservation.uploadHeaders){
    setNotice("Private storage or malware scanner unavailable; no proof verified.");
    return;
   }
   const url=new URL(reservation.uploadUrl);
   if(url.protocol!=="https:"||url.username||url.password||url.hash||
    reservation.uploadHeaders["Content-Type"]!==picked.mime)
    throw Error("Signed private storage permission is unverified.");
   const task=file.createUploadTask(reservation.uploadUrl,{
    httpMethod:"PUT",uploadType:UploadType.BINARY_CONTENT,
    mimeType:picked.mime,headers:reservation.uploadHeaders,
    sessionType:"foreground"});
   let uploaded;
   try{uploaded=await task.uploadAsync()}finally{task.release()}
   if(uploaded.status<200||uploaded.status>=300)
    throw Error("Private doctor evidence transfer is unconfirmed.");
   const done=await request<Status>(token,
    "/intents/"+encodeURIComponent(reservation.uploadRef)+"/confirm","POST");
   if(!done.cleanVerified||!done.fileRef||!done.fileVersion){
    setUncertain(true);
    throw Error("Malware scan remains pending. Recheck original upload.");
   }
   setVerified(true);setUncertain(false);
   onVerified(done.fileRef,done.fileVersion);setRefresh(x=>x+1);
   setNotice(portrait?"Private portrait scanned; public rights still separate.":
    "Actual private doctor licence scanner-verified; Foundation approval is separate.");
  }catch(e){setUncertain(true);fail(e)}finally{setBusy(false)}
 }
 return <View style={styles.panel}>
  <Text style={styles.heading}>{portrait?"Optional professional portrait":
   "Private professional licence evidence"}</Text>
  <Text style={styles.note}>Uploading a file does not approve the doctor.
   Only clean verified original evidence can be submitted.</Text>
  {!!notice&&<Text accessibilityRole="alert" style={styles.note}>{notice}</Text>}
  {button(picked?"Chosen: "+picked.name:"Choose original proof",()=>void choose(),
   busy||uncertain)}
  {button("Upload private proof",()=>void upload(),
   busy||uncertain||!picked||verified)}
  {!!intent&&button("Check same original upload",()=>void check(),busy)}
  {files.filter(x=>x.classification===classification).map(x=>
   <View key={x.fileRef}>
    <Text style={styles.note}>{x.status.replaceAll("_"," ")}</Text>
    {x.cleanVerified&&x.currentVersion&&
     button("Use current verified evidence",()=>onVerified(x.fileRef,x.fileVersion))}
   </View>)}
  {uncertain&&<Text style={styles.note}>Outcome uncertain. Recheck the original
   intent before attempting another upload.</Text>}
 </View>;
}
const styles=StyleSheet.create({
 panel:{padding:12,borderWidth:1,borderColor:t.border,
  backgroundColor:t.surface,borderRadius:12,gap:8},
 heading:{fontSize:15,fontWeight:"700",color:t.text},
 note:{fontSize:13,color:t.mutedText,lineHeight:19},
 text:{fontSize:13,color:t.text,fontWeight:"600"},
 button:{minHeight:45,borderWidth:1,borderColor:t.border,
  borderRadius:9,padding:10,justifyContent:"center"},
 disabled:{opacity:.4}
});
