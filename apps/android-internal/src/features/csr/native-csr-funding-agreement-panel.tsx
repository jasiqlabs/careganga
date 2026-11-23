import React,{useEffect,useRef,useState} from "react";
import {ActivityIndicator,Pressable,StyleSheet,Text,View} from "react-native";
import * as Crypto from "expo-crypto";
import * as Picker from "expo-document-picker";
import * as Sharing from "expo-sharing";
import {File,Paths,UploadType} from "expo-file-system";
import {identityRequest} from "../identity-access/http-client";

type Proof={fileRef:string;fileVersion:number;sourceVersion:number;mime:string;createdAt:string};
type Upload={uploadRef:string;status:string;uploadUrl?:string;uploadHeaders?:Record<string,string>;
 cleanVerified?:boolean;fileRef?:string|null;fileVersion?:number|null};
type Chosen={uri:string;name:string;mime:string;size:number};
type Command={key:string;hash:string;mime:string;size:number;intent?:string};
type ReviewSubmit={requestKey:string;expectedVersion:number;evidenceFileRef:string};
const MIME=["application/pdf","image/jpeg","image/png","image/webp"];
const base="/api/v1/csr-funding-agreements/";
export function NativeCsrFundingAgreementPanel({token,proposalRef,version,canUpload,canSubmit,onSubmitted,onExpired}:{
 token:string;proposalRef:string;version:number;canUpload:boolean;canSubmit:boolean;
 onSubmitted:()=>void;onExpired:()=>void}){
 const [files,setFiles]=useState<Proof[]|null>(null),
  [loadError,setLoadError]=useState(""),[error,setError]=useState(""),
  [notice,setNotice]=useState(""),[selected,setSelected]=useState<Chosen|null>(null),
  [consent,setConsent]=useState(false),[busy,setBusy]=useState(false),
  [intent,setIntent]=useState(""),[epoch,setEpoch]=useState(0);
 const command=useRef<Command|null>(null),running=useRef(false),cached=useRef<string|null>(null);
 const [selectedProof,setSelectedProof]=useState(""),
  [pendingReview,setPendingReview]=useState<ReviewSubmit|null>(null);
 const clear=()=>{if(cached.current){try{new File(cached.current).delete();}catch{}cached.current=null;}};
 useEffect(()=>()=>{clear();},[]);
 const api=async<T,>(path:string,body?:Record<string,unknown>):Promise<T>=>{
  const r=await identityRequest(base+path,{cache:"no-store",
   headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},
   ...(body?{method:"POST",body:JSON.stringify(body)}:{})});
  if(r.status===401){onExpired();throw Error("Sign in again for private funding documents.");}
  const v:unknown=await r.json().catch(()=>null);
  if(!r.ok||v===null)
   throw Error(r.status===403?"Private document branch or role is not permitted.":
    r.status===409?"Funding source or proof changed. Refresh.":"Original funding proof outcome uncertain.");
  return v as T;
 };
 useEffect(()=>{
  let live=true;setFiles(null);setLoadError("");
  void api<{files:Proof[];currentVersion:number}>("proposals/"+proposalRef).then(v=>{
   if(!live)return;
   if(v.currentVersion!==version){setLoadError("Funding proposal changed. Refresh.");return;}
   setFiles(v.files);
  }).catch(e=>{if(live)setLoadError(e instanceof Error?e.message:"Cannot inspect private funding proof.");});
  return()=>{live=false;};
 },[token,proposalRef,version,epoch]);
 useEffect(()=>{if(!pendingReview)setSelectedProof("");},[proposalRef,version]);
 const submitForReview=async()=>{
  if(!canSubmit||busy||running.current||!files||!(pendingReview||selectedProof))return;
  if(!pendingReview&&!files.some(f=>f.fileRef===selectedProof&&f.sourceVersion===version))return;
  const payload=pendingReview??{requestKey:Crypto.randomUUID(),
   expectedVersion:version,evidenceFileRef:selectedProof};
  setPendingReview(payload);setBusy(true);setError("");
  try{
   const response=await identityRequest("/api/v1/csr/funding-proposals/"+proposalRef+"/submit",{
    method:"POST",cache:"no-store",
    headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},
    body:JSON.stringify(payload)});
   if(response.status===401){onExpired();throw Object.assign(Error("Sign in again."),{status:401});}
   if(!response.ok)throw Object.assign(Error(response.status===409?
    "Original funding proposal or signed evidence changed. Refresh.":
    "Funding review submission outcome uncertain."),{status:response.status||503});
   setPendingReview(null);
   setNotice("Funding request submitted for independent signed review. No cash posted.");
   onSubmitted();
  }catch(e){
   const status=e&&typeof e==="object"&&"status" in e?Number(e.status):503;
   if(status>0&&status<500)setPendingReview(null);
   setError(status>=500||status===0?
    "Submission result uncertain. Check original case history or retry EXACTLY the same request.":
    e instanceof Error?e.message:"Funding submission rejected.");
  }finally{setBusy(false);}
 };
 const verified=(v:Upload)=>{
  if(!v.cleanVerified||!v.fileRef||!v.fileVersion)
   throw Error("Original CG19 scanner has not verified this funding document.");
  command.current=null;setIntent("");clear();setSelected(null);setConsent(false);
  setNotice("Private document scan verified; signed commitment review is separate.");
  setEpoch(x=>x+1);
 };
 const check=async()=>{
  if(!command.current?.intent||running.current)return;
  running.current=true;setBusy(true);setError("");
  try{verified(await api<Upload>("intents/"+command.current.intent+"/confirm",{}));}
  catch(e){setError(e instanceof Error?e.message:"Scanner result unavailable.");}
  finally{setBusy(false);running.current=false;}
 };
 const pick=async()=>{
  if(running.current||loadError)return;
  try{
   const result=await Picker.getDocumentAsync({type:MIME,multiple:false,copyToCacheDirectory:true});
   if(result.canceled)return;
   const file=result.assets[0];
   if(!file||!file.size||file.size>10485760||!file.mimeType||!MIME.includes(file.mimeType)){
    if(file?.uri)try{new File(file.uri).delete();}catch{}
    setError("Choose a signed PDF or image no larger than 10 MB.");return;
   }
   clear();cached.current=file.uri;setSelected({uri:file.uri,name:file.name,
    mime:file.mimeType,size:file.size});command.current=null;setIntent("");setConsent(false);setError("");
  }catch{setError("Private document picker unavailable.");}
 };
 const upload=async()=>{
  if(!selected||!canUpload||!consent||running.current||loadError)return;
  running.current=true;setBusy(true);setError("");setNotice("");
  try{
   const file=new File(selected.uri),hash=await file.digest("SHA-256");
   if(!/^[a-f0-9]{64}$/.test(hash))throw Error("Document checksum unavailable.");
   const prev=command.current,cmd:Command=prev&&prev.hash===hash&&
    prev.mime===selected.mime&&prev.size===selected.size?prev:
    {key:Crypto.randomUUID(),hash,mime:selected.mime,size:selected.size};
   command.current=cmd;
   const response=await api<Upload>("intents",{proposalRef,sourceVersion:version,
    requestKey:cmd.key,mime:cmd.mime,sizeBytes:cmd.size,sha256:cmd.hash});
   cmd.intent=response.uploadRef;setIntent(response.uploadRef);
   if(response.cleanVerified){verified(response);return;}
   if(response.status==="EXPIRED_OR_REJECTED"){
    command.current=null;setIntent("");throw Error("Private upload expired or was rejected.");
   }
   if(response.status!=="UPLOAD_READY"||!response.uploadUrl||!response.uploadHeaders)
    throw Error("Secure storage reservation unavailable.");
   const url=new URL(response.uploadUrl);
   if(url.protocol!=="https:"||url.username||url.password||url.hash||
    response.uploadHeaders["Content-Type"]!==selected.mime)
    throw Error("Invalid private upload reservation.");
   const task=file.createUploadTask(response.uploadUrl,{httpMethod:"PUT",
    uploadType:UploadType.BINARY_CONTENT,mimeType:selected.mime,
    headers:response.uploadHeaders,sessionType:"foreground"});
   let sent;try{sent=await task.uploadAsync();}finally{task.release();}
   if(sent.status<200||sent.status>=300)
    throw Error("Upload result uncertain. Check original scanner status.");
   verified(await api<Upload>("intents/"+response.uploadRef+"/confirm",{}));
  }catch(e){setError(e instanceof Error?e.message:"Private upload outcome uncertain.");}
  finally{setBusy(false);running.current=false;}
 };
 const share=async(proof:Proof)=>{
  if(busy)return;setBusy(true);setError("");
  let temporary:File|null=null;
  try{
   const r=await identityRequest(base+"files/"+proof.fileRef,{cache:"no-store",
    headers:{Authorization:"Bearer "+token}});
   if(r.status===401){onExpired();throw Error("Sign in again.");}
   if(!r.ok||r.headers.get("content-type")?.split(";")[0]!==proof.mime)
    throw Error("Original verified private document unavailable.");
   const bytes=new Uint8Array(await r.arrayBuffer());
   if(!bytes.length||bytes.length>10485760)throw Error("Protected file is invalid.");
   temporary=new File(Paths.cache,"cg08-funding-"+Crypto.randomUUID()+
    (proof.mime==="application/pdf"?".pdf":proof.mime==="image/png"?".png":
     proof.mime==="image/webp"?".webp":".jpg"));
   temporary.create();temporary.write(bytes);
   if(!(await Sharing.isAvailableAsync()))throw Error("Private file sharing unavailable.");
   await Sharing.shareAsync(temporary.uri,{mimeType:proof.mime,
    dialogTitle:"Share private CSR funding agreement"});
  }catch(e){setError(e instanceof Error?e.message:"Protected document unavailable.");}
  finally{try{temporary?.delete();}catch{}setBusy(false);}
 };
 const action=(label:string,cb:()=>void,disabled=false)=><Pressable
  accessibilityRole="button" accessibilityState={{disabled:disabled||busy}}
  disabled={disabled||busy} onPress={cb} style={[styles.button,(disabled||busy)&&{opacity:.4}]}>
  <Text style={styles.action}>{label}</Text></Pressable>;
 return <View style={styles.panel}>
  <Text style={styles.heading}>5. Documents & Agreement</Text>
  <Text style={styles.note}>CG19 protected scanner-verified proposal files. File scan is not
   an independent signature approval or a bank receipt.</Text>
  {loadError?<Text accessibilityRole="alert" style={styles.error}>{loadError}</Text>:
   files===null?<ActivityIndicator accessibilityLabel="Checking original agreement files"/>:
   files.length===0?<Text style={styles.note}>No verified private funding documents yet.</Text>:
   files.map((file,i)=><View key={file.fileRef} style={styles.row}>
    <Text style={styles.note}>Private file {i+1} · {file.sourceVersion===version?
     "Current proposal revision":"Earlier revision"}</Text>
    {action("Download or share privately",()=>void share(file))}
   </View>)}
  {canSubmit&&<View style={styles.panel}>
   <Text style={styles.heading}>Submit for independent funding review</Text>
   <Text style={styles.note}>Choose a scanner-verified document from the current
    proposal revision. A different authorized Foundation reviewer approves
    the signed commitment. This is not bank cash.</Text>
   {files?.filter(f=>f.sourceVersion===version).map((f,i)=><Pressable
    key={f.fileRef} accessibilityRole="radio"
    accessibilityState={{checked:selectedProof===f.fileRef}}
    disabled={busy||!!pendingReview}
    onPress={()=>setSelectedProof(f.fileRef)} style={styles.button}>
    <Text style={styles.action}>{selectedProof===f.fileRef?"◉":"○"} Private document {i+1}</Text>
   </Pressable>)}
   {action("Submit for protected CG03 approval",()=>void submitForReview(),
    !selectedProof||!files?.some(f=>f.fileRef===selectedProof&&f.sourceVersion===version)||!!pendingReview)}
   {pendingReview&&action("Retry exact review submission",()=>void submitForReview())}
  </View>}
  {canUpload&&<>
   {action(selected?"Selected: "+selected.name:"Choose signed funding agreement",
    ()=>void pick(),!!loadError)}
   <Pressable accessibilityRole="checkbox" accessibilityState={{checked:consent}}
    disabled={busy} onPress={()=>setConsent(v=>!v)}>
    <Text style={styles.note}>{consent?"☑":"☐"} Foundation is authorized to
     retain this private document.</Text>
   </Pressable>
   {action("Upload and verify agreement",()=>void upload(),!selected||!consent||!!loadError)}
   {!!intent&&action("Check original scan result",()=>void check())}
  </>}
  {action("Refresh verified documents",()=>setEpoch(v=>v+1))}
  {!!notice&&<Text style={styles.success}>{notice}</Text>}
  {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
 </View>;
}
const styles=StyleSheet.create({
 panel:{borderWidth:1,borderColor:"#CBD5E1",borderRadius:12,padding:12,gap:10,backgroundColor:"#fff"},
 heading:{color:"#0F172A",fontSize:16,fontWeight:"700"},
 note:{color:"#526477",fontSize:13},
 row:{gap:8,flexDirection:"row",flexWrap:"wrap",alignItems:"center"},
 button:{borderWidth:1,borderColor:"#CBD5E1",backgroundColor:"#EFF6FF",padding:11,borderRadius:8},
 action:{fontSize:13,fontWeight:"600",color:"#1D4ED8"},
 error:{color:"#B91C1C",fontSize:13},success:{color:"#166534",fontSize:13}
});
