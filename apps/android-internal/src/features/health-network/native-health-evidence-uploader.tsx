import {useEffect,useRef,useState} from "react";
import {Pressable,StyleSheet,Text,View} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import {File,UploadType} from "expo-file-system";
import * as Crypto from "expo-crypto";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";
type Kind="HEALTH_PROVIDER_REGISTRATION"|"HEALTH_CENTER_LICENSE"|"HEALTH_BANK_PROOF";
type Props={token:string;providerRef:string;centerRef?:string;
 sourceVersion:number;classification:Kind;onVerified:(ref:string,version:number)=>void;
 onExpired:()=>void;disabled?:boolean};
type Pick={uri:string;name:string;size:number;mime:string};
type Intent={uploadRef:string;uploadUrl?:string;uploadHeaders?:Record<string,string>;status:string};
type Status={fileRef:string|null;fileVersion:number|null;cleanVerified:boolean;status:string};
type Evidence={fileRef:string;classification:Kind;status:string;
 currentVersion:boolean;fileVersion:number};
const allowed=new Set(["application/pdf","image/jpeg","image/png","image/webp"]);
async function req<T>(token:string,path:string,method:"GET"|"POST"="GET",body?:unknown){
 const r=await identityRequest("/api/documents/health-draft"+path,{
  method,cache:"no-store",headers:{Authorization:"Bearer "+token,
   ...(body?{"Content-Type":"application/json"}:{})},
  ...(body?{body:JSON.stringify(body)}:{})});
 if(!r.ok)throw Object.assign(new Error(
  r.status===401?"Sign in again.":
  r.status===403?"Current provider and center do not permit this private proof.":
  r.status===409?"The original proof changed; recheck before retry.":
  "Private evidence or malware scan could not be confirmed."
 ),{status:r.status});
 return r.json() as Promise<T>;
}
export function NativeHealthEvidenceUploader({token,providerRef,centerRef,
 sourceVersion,classification,onVerified,onExpired,disabled=false}:Props){
 const [picked,setPicked]=useState<Pick|null>(null);
 const [intent,setIntent]=useState(""),[requestKey,setRequestKey]=useState("");
 const [busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false);
 const [notice,setNotice]=useState("");
 const [files,setFiles]=useState<Evidence[]>([]);
 const [refresh,setRefresh]=useState(0);
 const original=useRef<{requestKey:string;mime:string;sha256:string;sizeBytes:number}|null>(null);
 const endpoint=providerRef+(centerRef?"/"+centerRef:"")+"/"+classification;
 useEffect(()=>{
  let live=true;setFiles([]);
  const q=centerRef?"?centerRef="+encodeURIComponent(centerRef):"";
  void req<{files:Evidence[]}>(token,"/providers/"+encodeURIComponent(providerRef)+q)
   .then(data=>{if(live)setFiles(Array.isArray(data.files)?data.files:[])})
   .catch(()=>{if(live)setNotice("Current protected proof history is unavailable.")});
  return()=>{live=false};
 },[token,providerRef,centerRef,refresh]);
 useEffect(()=>{
  setPicked(null);setIntent("");setRequestKey("");setUncertain(false);
  original.current=null;
 },[endpoint,sourceVersion]);
 const button=(label:string,action:()=>void,blocked=false)=>
  <Pressable accessibilityRole="button" disabled={disabled||blocked}
   accessibilityState={{disabled:disabled||blocked}} onPress={action}
   style={[styles.button,(disabled||blocked)&&styles.disabled]}>
   <Text style={styles.text}>{label}</Text>
  </Pressable>;
 async function choose(){
  if(disabled||busy||uncertain)return;
  try{
   const found=await DocumentPicker.getDocumentAsync({
    type:["application/pdf","image/jpeg","image/png","image/webp"],
    copyToCacheDirectory:true,multiple:false
   });
   if(found.canceled)return;
   const file=found.assets?.[0];
   if(!file||!file.size||file.size<1||file.size>10485760||
    !file.mimeType||!allowed.has(file.mimeType)){
    setNotice("Choose a PDF, JPG, PNG or WebP under 10 MB.");return;
   }
   setPicked({uri:file.uri,size:file.size,name:file.name,mime:file.mimeType});
   setIntent("");setRequestKey(Crypto.randomUUID());
   original.current=null;setNotice("");
  }catch{setNotice("The protected file picker is unavailable.")}
 }
 async function check(){
  if(!intent||busy)return;
  setBusy(true);
  try{
   const x=await req<Status>(token,"/intents/"+encodeURIComponent(intent));
   setUncertain(false);
   if(x.cleanVerified&&x.fileRef&&x.fileVersion){
    onVerified(x.fileRef,x.fileVersion);setRefresh(v=>v+1);
    setNotice("Current original provider proof is scanner-verified.");
   }else setNotice("Not verified: "+x.status.replaceAll("_"," ")+
    ". Do not submit this document for review.");
  }catch(e){setUncertain(true);handle(e)}
  finally{setBusy(false)}
 }
 function handle(e:unknown){
  if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
  setNotice(e instanceof Error?e.message:"Private upload status unknown.");
 }
 async function upload(){
  if(!picked||disabled||busy||uncertain)return;
  setBusy(true);setNotice("");
  try{
   const file=new File(picked.uri),sha256=await file.digest("SHA-256");
   if(!/^[a-f0-9]{64}$/.test(sha256))
    throw Error("Selected private evidence checksum unavailable.");
   const evidence=original.current??{
    requestKey:requestKey||Crypto.randomUUID(),
    mime:picked.mime,sha256,sizeBytes:picked.size
   };
   if(evidence.sha256!==sha256||evidence.mime!==picked.mime||
    evidence.sizeBytes!==picked.size)
    throw Error("The original file changed; check its previous upload.");
   original.current=evidence;
   const saved=await req<Intent>(token,"/intents","POST",{
    providerRef,centerRef:centerRef??null,sourceVersion,
    classification,...evidence
   });
   if(!saved.uploadRef)throw Error("Original file upload was not recorded.");
   setIntent(saved.uploadRef);
   if(!saved.uploadUrl||!saved.uploadHeaders){
    setNotice("Private storage or scanner is unavailable. No document is verified.");return;
   }
   const target=new URL(saved.uploadUrl);
   if(target.protocol!=="https:"||target.username||target.password||target.hash||
    saved.uploadHeaders["Content-Type"]!==picked.mime)
    throw Error("The signed private upload permission is invalid.");
   const transfer=file.createUploadTask(saved.uploadUrl,{
    httpMethod:"PUT",uploadType:UploadType.BINARY_CONTENT,
    mimeType:picked.mime,headers:saved.uploadHeaders,sessionType:"foreground"
   });
   let uploaded;
   try{uploaded=await transfer.uploadAsync()}
   finally{transfer.release()}
   if(uploaded.status<200||uploaded.status>=300)
    throw Error("Original private file transfer is unconfirmed.");
   const confirmed=await req<Status>(token,
    "/intents/"+encodeURIComponent(saved.uploadRef)+"/confirm","POST");
   if(!confirmed.cleanVerified||!confirmed.fileRef||!confirmed.fileVersion){
    setUncertain(true);
    throw Error("Malware scan or storage verification is not complete. Check original upload.");
   }
   onVerified(confirmed.fileRef,confirmed.fileVersion);
   setRefresh(v=>v+1);setNotice("Private original evidence verified.");
   setUncertain(false);
  }catch(e){setUncertain(true);handle(e)}
  finally{setBusy(false)}
 }
 const label=classification==="HEALTH_PROVIDER_REGISTRATION"?
  "Provider registration evidence":classification==="HEALTH_CENTER_LICENSE"?
   "Center licence evidence":"Protected bank evidence";
 return <View style={styles.panel}>
  <Text style={styles.heading}>{label}</Text>
  <Text style={styles.note}>Only a clean, verified original file can be submitted.</Text>
  {!!notice&&<Text accessibilityRole="alert" style={styles.note}>{notice}</Text>}
  {button(picked?"Chosen: "+picked.name:"Choose private proof",()=>void choose(),
   busy||uncertain)}
  {button("Upload and scan original evidence",()=>void upload(),
   busy||uncertain||!picked)}
  {!!intent&&button("Check original upload status",()=>void check(),busy)}
  {files.filter(x=>x.classification===classification).map(file=>
   <View key={file.fileRef}>
    <Text style={styles.note}>{file.status.replaceAll("_"," ")}</Text>
    {file.status==="VALIDATED"&&file.currentVersion&&
     button("Use current verified proof",()=>onVerified(file.fileRef,file.fileVersion))}
   </View>)}
  {uncertain&&<Text style={styles.note}>The last upload may have committed.
   Check its original status; do not create a second proof.</Text>}
 </View>;
}
const styles=StyleSheet.create({
 panel:{backgroundColor:t.surface,borderWidth:1,borderColor:t.border,
  padding:12,borderRadius:12,gap:8},
 heading:{color:t.text,fontSize:15,fontWeight:"700"},
 note:{color:t.mutedText,fontSize:13,lineHeight:19},
 text:{color:t.text,fontSize:13,fontWeight:"600"},
 button:{padding:10,borderRadius:9,borderWidth:1,
  borderColor:t.border,minHeight:44,justifyContent:"center"},
 disabled:{opacity:.5}
});
