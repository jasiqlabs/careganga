import React,{useEffect,useRef,useState} from "react";
import {ActivityIndicator,Pressable,StyleSheet,Text,View} from "react-native";
import * as Crypto from "expo-crypto";
import * as Picker from "expo-document-picker";
import * as Sharing from "expo-sharing";
import {File,Paths,UploadType} from "expo-file-system";
import {identityRequest} from "../identity-access/http-client";

type Proof={fileRef:string;fileVersion:number;sourceVersion:number;mime:string;createdAt:string};
type Upload={uploadRef:string;status:string;uploadUrl?:string;uploadHeaders?:Record<string,string>;cleanVerified?:boolean;fileRef?:string|null;fileVersion?:number|null};
type Picked={uri:string;name:string;mime:string;size:number};
type Command={key:string;hash:string;mime:string;size:number;intent?:string};
type ReviewSubmit={requestKey:string;expectedVersion:number;evidenceFileRef:string};
const allowed=["application/pdf","image/jpeg","image/png","image/webp"];
const endpoint="/api/v1/csr-agreements/";
export function NativeCsrAgreementPanel({token,partnerRef,version,canUpload,canSubmit,onSubmitted,onExpired}:{
 token:string;partnerRef:string;version:number;canUpload:boolean;canSubmit:boolean;onSubmitted:()=>void;onExpired:()=>void;
}){
 const [files,setFiles]=useState<Proof[]|null>(null),[chosen,setChosen]=useState<Picked|null>(null),
  [consent,setConsent]=useState(false),[busy,setBusy]=useState(false),
  [error,setError]=useState(""),[message,setMessage]=useState(""),
  [intent,setIntent]=useState(""),[epoch,setEpoch]=useState(0);
 const command=useRef<Command|null>(null),running=useRef(false),cache=useRef<string|null>(null),mounted=useRef(true);
 const [selectedProof,setSelectedProof]=useState(""),[pendingReview,setPendingReview]=useState<ReviewSubmit|null>(null);
 const clear=()=>{if(cache.current){try{new File(cache.current).delete();}catch{}cache.current=null;}};
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;clear();};},[]);
 const api=async<T,>(path:string,body?:Record<string,unknown>)=>{
  const r=await identityRequest(endpoint+path,{cache:"no-store",
   headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},
   ...(body?{method:"POST",body:JSON.stringify(body)}:{})});
  if(r.status===401){onExpired();throw Error("Sign in again to access the private CSR agreement.");}
  const v:unknown=await r.json().catch(()=>null);
  if(!r.ok||v===null)throw Error(r.status===403?"Your current role or branch cannot access this document.":
   r.status===409?"CSR agreement or draft changed. Refresh before continuing.":
   "Original private agreement status is unavailable.");
  return v as T;
 };
 useEffect(()=>{let live=true;setFiles(null);
  void api<{files:Proof[];currentVersion:number}>("partners/"+partnerRef).then(v=>{
   if(!live)return;
   if(v.currentVersion!==version){setError("CSR draft changed. Refresh before uploading.");return;}
   setFiles(v.files);
  }).catch(e=>{if(live)setError(e instanceof Error?e.message:"Private agreement proof is unavailable.");});
  return()=>{live=false;};
 },[token,partnerRef,version,epoch]);
 const submitForReview=async()=>{
  if(!canSubmit||busy||running.current||!(pendingReview||selectedProof))return;
  if(!pendingReview&&!files?.some(f=>f.fileRef===selectedProof&&f.sourceVersion===version))return;
  const cmd=pendingReview??{requestKey:Crypto.randomUUID(),expectedVersion:version,evidenceFileRef:selectedProof};
  setPendingReview(cmd);setBusy(true);setError("");
  try{
   const r=await identityRequest("/api/v1/csr/partners/"+partnerRef+"/submit",{method:"POST",cache:"no-store",
    headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify(cmd)});
   if(r.status===401){onExpired();throw Error("Sign in again to submit CSR review.");}
   if(!r.ok){
    const v:unknown=await r.json().catch(()=>null);
    const message=v&&typeof v==="object"&&"message" in v&&typeof v.message==="string"?v.message:"CSR submission not confirmed.";
    throw Object.assign(Error(message),{status:r.status});
   }
   setPendingReview(null);setMessage("Application submitted to an independent Foundation reviewer.");onSubmitted();
  }catch(e){
   const code=e&&typeof e==="object"&&"status" in e?Number(e.status):503;
   if(code>0&&code<500)setPendingReview(null);
   setError(e instanceof Error?e.message:"CSR submission uncertain. Check original review history before retrying.");
  }finally{setBusy(false);}
 };
 const pick=async()=>{
  if(running.current)return;
  try{const r=await Picker.getDocumentAsync({type:allowed,multiple:false,copyToCacheDirectory:true});
   if(r.canceled)return;const f=r.assets[0];
   if(!f||!f.size||f.size>10485760||!f.mimeType||!allowed.includes(f.mimeType)){
    if(f?.uri)try{new File(f.uri).delete();}catch{}
    setError("Choose a PDF or image agreement up to 10 MB.");return;
   }
   clear();cache.current=f.uri;setChosen({uri:f.uri,name:f.name,mime:f.mimeType,size:f.size});
   command.current=null;setIntent("");setConsent(false);setError("");
  }catch{setError("Secure document picker is unavailable.");}
 };
 const accepted=(v:Upload)=>{
  if(!v.cleanVerified||!v.fileRef||!v.fileVersion)throw Error("CG19 has not verified the original agreement scan.");
  command.current=null;if(mounted.current){
   clear();setChosen(null);setIntent("");setConsent(false);setMessage("Agreement verified by the private scanner. Independent CSR approval is still required.");setEpoch(n=>n+1);
  }
 };
 const confirm=async()=>{
  if(!command.current?.intent||running.current)return;
  running.current=true;setBusy(true);setError("");
  try{accepted(await api<Upload>("intents/"+command.current.intent+"/confirm",{}));}
  catch(e){setError(e instanceof Error?e.message:"Scanner proof is unavailable.");}
  finally{running.current=false;setBusy(false);}
 };
 const upload=async()=>{
  if(!chosen||!canUpload||!consent||running.current)return;
  running.current=true;setBusy(true);setError("");setMessage("");
  try{
   const file=new File(chosen.uri),sha=await file.digest("SHA-256");
   if(!/^[0-9a-f]{64}$/.test(sha))throw Error("The file checksum could not be verified.");
   const previous=command.current,cmd:Command=previous&&previous.hash===sha&&previous.mime===chosen.mime&&previous.size===chosen.size?
    previous:{key:Crypto.randomUUID(),hash:sha,mime:chosen.mime,size:chosen.size};
   command.current=cmd;
   const r=await api<Upload>("intents",{partnerRef,sourceVersion:version,requestKey:cmd.key,mime:cmd.mime,sizeBytes:cmd.size,sha256:cmd.hash});
   cmd.intent=r.uploadRef;setIntent(r.uploadRef);
   if(r.cleanVerified){accepted(r);return;}
   if(r.status==="EXPIRED_OR_REJECTED"){command.current=null;setIntent("");throw Error("Agreement intent expired or was rejected.");}
   if(r.status!=="UPLOAD_READY"||!r.uploadUrl||!r.uploadHeaders)throw Error("Secure upload is unavailable. No agreement is verified.");
   const url=new URL(r.uploadUrl);
   if(url.protocol!=="https:"||url.username||url.password||url.hash||r.uploadHeaders["Content-Type"]!==chosen.mime)throw Error("Private upload reservation is invalid.");
   const task=file.createUploadTask(r.uploadUrl,{httpMethod:"PUT",uploadType:UploadType.BINARY_CONTENT,
    mimeType:chosen.mime,headers:r.uploadHeaders,sessionType:"foreground"});
   let sent;try{sent=await task.uploadAsync();}finally{task.release();}
   if(sent.status<200||sent.status>=300)throw Error("Upload outcome uncertain. Check original scanner status.");
   accepted(await api<Upload>("intents/"+r.uploadRef+"/confirm",{}));
  }catch(e){setError(e instanceof Error?e.message:"Secure agreement upload failed.");}
  finally{running.current=false;setBusy(false);}
 };
 const share=async(p:Proof)=>{
  if(busy)return;setBusy(true);setError("");
  let local:File|null=null;
  try{
   const r=await identityRequest(endpoint+"files/"+p.fileRef,{headers:{Authorization:"Bearer "+token},cache:"no-store"});
   if(r.status===401){onExpired();throw Error("Sign in again.");}
   if(!r.ok||r.headers.get("content-type")?.split(";")[0]!==p.mime)throw Error("Verified private agreement download unavailable.");
   const content=new Uint8Array(await r.arrayBuffer());
   if(content.length<1||content.length>10485760)throw Error("Private agreement download is invalid.");
   local=new File(Paths.cache,"cg08-agreement-"+Crypto.randomUUID()+(p.mime==="application/pdf"?".pdf":p.mime==="image/png"?".png":p.mime==="image/webp"?".webp":".jpg"));
   local.create();local.write(content);
   if(!(await Sharing.isAvailableAsync()))throw Error("Private file sharing is not supported on this device.");
   await Sharing.shareAsync(local.uri,{mimeType:p.mime,dialogTitle:"Share verified CSR agreement"});
  }catch(e){setError(e instanceof Error?e.message:"Private agreement unavailable.");}
  finally{try{local?.delete();}catch{}setBusy(false);}
 };
 const action=(title:string,cb:()=>void,disabled=false)=><Pressable accessibilityRole="button"
  accessibilityState={{disabled:busy||disabled}} disabled={busy||disabled} onPress={cb} style={[styles.action,(busy||disabled)&&{opacity:.4}]}>
  <Text style={styles.actionText}>{title}</Text></Pressable>;
 return <View style={styles.section}>
  <Text style={styles.title}>Private CSR agreement</Text>
  <Text style={styles.muted}>Signed PDF or image, maximum 10 MB. Private storage and malware scan required. Never an approval or payment.</Text>
  {files===null?<ActivityIndicator accessibilityLabel="Checking original scanned files"/>:
   files.length===0?<Text style={styles.muted}>No verified private agreement yet.</Text>:
   files.map((p,i)=><View key={p.fileRef} style={styles.row}><Text style={styles.muted}>Scanner-verified agreement {i+1} · {p.sourceVersion===version?"Current draft":"Earlier draft: upload a new signed agreement"}</Text>
    {canSubmit&&p.sourceVersion===version&&<Pressable accessibilityRole="radio" accessibilityState={{checked:selectedProof===p.fileRef}} disabled={busy||!!pendingReview} onPress={()=>setSelectedProof(p.fileRef)}><Text style={styles.actionText}>{selectedProof===p.fileRef?"◉ Selected for review":"○ Select for review"}</Text></Pressable>}
    {action("Download / share privately",()=>void share(p))}
   </View>)}
  {canSubmit&&<View style={styles.section}>
   <Text style={styles.title}>Independent CSR partner review</Text>
   <Text style={styles.muted}>Select an original scanner-verified agreement; uploading alone does not approve a partner.</Text>
   {action("Submit for independent review",()=>void submitForReview(),!selectedProof||!files?.some(f=>f.fileRef===selectedProof&&f.sourceVersion===version)||!!pendingReview)}
   {!!pendingReview&&action("Retry exact review submission",()=>void submitForReview())}
  </View>}
  {canUpload&&<>
   {action(chosen?"Selected: "+chosen.name:"Choose agreement",()=>void pick())}
   <Pressable accessibilityRole="checkbox" accessibilityState={{checked:consent}} style={styles.row}
    onPress={()=>setConsent(v=>!v)}>
    <Text style={styles.muted}>{consent?"☑":"☐"} I confirm the Foundation may securely retain this private CSR agreement.</Text>
   </Pressable>
   {action(busy?"Checking scan…":"Upload and verify agreement",()=>void upload(),!chosen||!consent)}
   {!!intent&&action("Check original scan result",()=>void confirm())}
  </>}
  {action("Refresh verified agreements",()=>setEpoch(n=>n+1))}
  {!!message&&<Text style={styles.success}>{message}</Text>}
  {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
 </View>;
}
const styles=StyleSheet.create({
 section:{borderWidth:1,borderColor:"#CBD5E1",borderRadius:12,padding:12,gap:9,backgroundColor:"#FFFFFF"},
 title:{fontSize:16,fontWeight:"700",color:"#0F172A"},muted:{fontSize:13,color:"#64748B"},
 row:{flexDirection:"row",alignItems:"center",gap:8,flexWrap:"wrap"},
 action:{borderWidth:1,borderRadius:8,borderColor:"#CBD5E1",padding:11,backgroundColor:"#EFF6FF"},
 actionText:{fontSize:13,fontWeight:"600",color:"#1D4ED8"},
 success:{fontSize:13,color:"#166534"},error:{fontSize:13,color:"#B91C1C"}
});
