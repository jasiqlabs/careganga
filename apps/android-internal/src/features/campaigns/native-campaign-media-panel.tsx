import React,{useEffect,useRef,useState} from "react";
import {ActivityIndicator,Image,Pressable,StyleSheet,Text,View} from "react-native";
import * as Crypto from "expo-crypto";
import * as Picker from "expo-document-picker";
import {File,Paths,UploadType} from "expo-file-system";
import {identityRequest} from "../identity-access/http-client";
import {careGangaTheme as theme} from "../../../../../packages/design-tokens/src/index";

const images=["image/jpeg","image/png","image/webp"];
const endpoint="/api/v1/campaign-media/";
type FileRow={fileRef:string;fileVersion:number;mime:string;classification:string;size:string;createdAt:string};
type Upload={uploadRef:string;status:string;uploadUrl?:string;uploadHeaders?:Record<string,string>;
 cleanVerified?:boolean;fileRef?:string|null;fileVersion?:number|null};
type Picked={uri:string;name:string;mime:string;size:number};
type Command={key:string;hash:string;mime:string;size:number;intent?:string};

/** Native equivalent of original A13/A15 private file controls.
 * Uploading is never an approval, donor payment or public publication. */
export function NativeCampaignMediaPanel({campaignRef,version,token,onExpired,canUpload,kind,attached,onChange}:{
 campaignRef:string;version:number;token:string;onExpired:()=>void;canUpload:boolean;
 kind:"BANNER"|"DOCUMENT";attached:string[];onChange:(next:string[])=>void;
}){
 const allow=kind==="BANNER"?images:[...images,"application/pdf"];
 const limit=kind==="BANNER"?2097152:10485760;
 const label=kind==="BANNER"?"Campaign Banner":"Supporting Documents";
 const classification=kind==="BANNER"?"CAMPAIGN_BANNER":"CAMPAIGN_DOCUMENT";
 const [files,setFiles]=useState<FileRow[]|null>(null),[picked,setPicked]=useState<Picked|null>(null),
  [consent,setConsent]=useState(false),[busy,setBusy]=useState(false),
  [error,setError]=useState(""),[notice,setNotice]=useState(""),[epoch,setEpoch]=useState(0),
  [intent,setIntent]=useState(""),[preview,setPreview]=useState("");
 const running=useRef(false),command=useRef<Command|null>(null),
  attachedRef=useRef(attached),cachedPicked=useRef<string|null>(null);
 attachedRef.current=attached;
 const clearPicked=()=>{if(cachedPicked.current){try{new File(cachedPicked.current).delete();}catch{}cachedPicked.current=null;}};
 useEffect(()=>()=>clearPicked(),[]);
 const api=async<T,>(route:string,body?:Record<string,unknown>)=>{
  const r=await identityRequest(endpoint+route,{cache:"no-store",
   headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},
   ...(body?{method:"POST",body:JSON.stringify(body)}:{})});
  if(r.status===401){onExpired();throw Error("Sign in again to access original campaign media.");}
  const data:unknown=await r.json().catch(()=>null);
  if(!r.ok||!data)throw Error(r.status===403?"Your role or campaign does not permit this action.":
   r.status===409?"Campaign or private media changed. Refresh its draft.":"Current campaign file status unavailable.");
  return data as T;
 };
 useEffect(()=>{let live=true;setFiles(null);
  void api<{files:FileRow[];campaignVersion:number}>("campaigns/"+campaignRef).then(v=>{
   if(!live)return;if(v.campaignVersion!==version){setError("Campaign changed. Refresh the original draft.");return;}
   setFiles(v.files.filter(f=>f.classification===classification));
  }).catch(e=>{if(live)setError(e instanceof Error?e.message:"Private media unavailable.");});
  return()=>{live=false;};
 },[token,campaignRef,version,kind,epoch]);
 useEffect(()=>{let live=true;let cached:File|null=null;setPreview("");
  if(kind!=="BANNER"||!attached.length)return;
  const file=files?.find(f=>f.fileRef===attached[0]);
  if(!file||!images.includes(file.mime))return;
  void (async()=>{try{
   const r=await identityRequest(endpoint+"files/"+file.fileRef,{cache:"no-store",headers:{Authorization:"Bearer "+token}});
   if(r.status===401){onExpired();throw Error("Sign in again.");}
   if(!r.ok||!images.includes(r.headers.get("content-type")?.split(";")[0]??""))
    throw Error("Verified banner preview is unavailable.");
   const bytes=new Uint8Array(await r.arrayBuffer());
   if(bytes.length<1||bytes.length>10485760)throw Error("Verified banner preview is unavailable.");
   if(!live)return;
   cached=new File(Paths.cache,"cg07-banner-"+Crypto.randomUUID()+
    (file.mime==="image/png"?".png":file.mime==="image/webp"?".webp":".jpg"));
   cached.create();cached.write(bytes);if(live)setPreview(cached.uri);
  }catch(e){if(live)setError(e instanceof Error?e.message:"Private banner preview unavailable.");}})();
  return()=>{live=false;try{cached?.delete();}catch{};};
 },[token,campaignRef,kind,files,attached[0]]);
 const pick=async()=>{if(running.current)return;
  try{
   const v=await Picker.getDocumentAsync({type:allow,multiple:false,copyToCacheDirectory:true});
   if(v.canceled)return;
   const a=v.assets[0];
   if(!a?.size||a.size>limit||!a.mimeType||!allow.includes(a.mimeType)){
    if(a?.uri)try{new File(a.uri).delete();}catch{}
    setError("Choose an allowed "+(kind==="BANNER"?"image up to 2 MB.":"file up to 10 MB."));return;
   }
   clearPicked();cachedPicked.current=a.uri;
   setPicked({uri:a.uri,name:a.name,mime:a.mimeType,size:a.size});setConsent(false);
   command.current=null;setIntent("");setError("");
  }catch{setError("Private file picker unavailable.");}
 };
 const accepted=(v:Upload)=>{
  if(!v.cleanVerified||!v.fileRef||!v.fileVersion)throw Error("Original CG19 scanner has not verified this file.");
  const prior=attachedRef.current;
  if(kind==="BANNER")onChange([v.fileRef]);
  else if(!prior.includes(v.fileRef)){if(prior.length>=6)throw Error("Maximum six documents.");onChange([...prior,v.fileRef]);}
  setNotice("File scanner-verified. Save the six-step draft to attach it privately.");
  clearPicked();setPicked(null);setConsent(false);setIntent("");command.current=null;setEpoch(n=>n+1);
 };
 const confirm=async()=>{if(!command.current?.intent||running.current)return;
  running.current=true;setBusy(true);setError("");
  try{accepted(await api<Upload>("intents/"+command.current.intent+"/confirm",{}));}
  catch(e){setError(e instanceof Error?e.message:"Original verification unavailable.");}
  finally{running.current=false;setBusy(false);}
 };
 const upload=async()=>{if(!canUpload||!picked||!consent||running.current||(kind==="DOCUMENT"&&attached.length>=6))return;
  running.current=true;setBusy(true);setError("");setNotice("");
  try{
   const bytes=new File(picked.uri),hash=await bytes.digest("SHA-256");
   if(!/^[a-f0-9]{64}$/.test(hash))throw Error("Original file checksum unavailable.");
   const old=command.current,cmd:Command=old??{key:Crypto.randomUUID(),hash,mime:picked.mime,size:picked.size};
   if(cmd.hash!==hash||cmd.mime!==picked.mime||cmd.size!==picked.size)throw Error("Selected file has changed.");
   command.current=cmd;
   const v=await api<Upload>("intents",{campaignRef,campaignVersion:version,requestKey:cmd.key,
    mime:cmd.mime,sizeBytes:cmd.size,sha256:cmd.hash,kind,rightsConfirmed:true});
   cmd.intent=v.uploadRef;setIntent(v.uploadRef);
   if(v.cleanVerified){accepted(v);return;}
   if(v.status==="EXPIRED_OR_REJECTED"){command.current=null;setIntent("");throw Error("File upload expired or was rejected.");}
   if(v.status!=="UPLOAD_READY"||!v.uploadUrl||!v.uploadHeaders)throw Error("Secure private storage unavailable.");
   const url=new URL(v.uploadUrl);
   if(url.protocol!=="https:"||url.username||url.password||url.hash||v.uploadHeaders["Content-Type"]!==cmd.mime)
    throw Error("Original storage reservation is invalid.");
   const task=bytes.createUploadTask(v.uploadUrl,{httpMethod:"PUT",uploadType:UploadType.BINARY_CONTENT,
    mimeType:picked.mime,headers:v.uploadHeaders,sessionType:"foreground"});
   let result;try{result=await task.uploadAsync();}finally{task.release();}
   if(result.status<200||result.status>=300)throw Error("Upload outcome unconfirmed. Verify original intent.");
   accepted(await api<Upload>("intents/"+v.uploadRef+"/confirm",{}));
  }catch(e){setError(e instanceof Error?e.message:"Original private upload failed.");}
  finally{running.current=false;setBusy(false);}
 };
 const button=(text:string,onPress:()=>void,disabled=false)=><Pressable accessibilityRole="button"
  accessibilityState={{disabled:disabled||busy}} disabled={disabled||busy}
  onPress={onPress} style={[styles.button,(disabled||busy)&&{opacity:.5}]}>
  <Text style={styles.buttonText}>{text}</Text></Pressable>;
 return <View style={styles.card}>
  <Text style={styles.title}>{label} (optional)</Text>
  <Text style={styles.muted}>{kind==="BANNER"?"JPG/PNG/WebP, 2 MB maximum.":"Up to six verified image/PDF documents, 10 MB each."} Original files stay private; public publication requires separate approval.</Text>
  {files===null?<ActivityIndicator accessibilityLabel="Checking scanner-verified campaign files"/>:
   attached.length===0?<Text style={styles.muted}>No verified file attached.</Text>:
   attached.map((ref,i)=>{const file=files.find(f=>f.fileRef===ref);return <View key={ref} style={styles.row}>
    <Text style={styles.muted}>{file?"Verified file "+(i+1):"Selected file verification unavailable"}</Text>
    {canUpload&&button("Remove",()=>onChange(attached.filter(x=>x!==ref)))}
   </View>;})}
  {!!preview&&<Image source={{uri:preview}} style={{width:"100%",height:200,borderRadius:8}} resizeMode="contain" accessibilityLabel="Private scanner-verified campaign banner"/>}
  {canUpload&&(kind==="BANNER"||attached.length<6)&&<>
   {button(picked?"Chosen: "+picked.name:"Choose file",()=>void pick())}
   <Pressable accessibilityRole="checkbox" accessibilityState={{checked:consent,disabled:busy}}
    style={styles.button} disabled={busy} onPress={()=>setConsent(v=>!v)}>
    <Text style={styles.buttonText}>{consent?"✓ ":""}I have permission to retain this private campaign file.</Text>
   </Pressable>
   {button(busy?"Verifying…":"Upload & verify file",()=>void upload(),!picked||!consent)}
   {!!intent&&button("Verify original upload",()=>void confirm())}
  </>}
  {button("Refresh verified media",()=>{setError("");setEpoch(n=>n+1);})}
  {!!notice&&<Text accessibilityRole="alert" style={styles.muted}>{notice}</Text>}
  {!!error&&<Text accessibilityRole="alert" style={{color:theme.error}}>{error}</Text>}
 </View>;
}
const styles=StyleSheet.create({
 card:{borderColor:theme.border,borderWidth:1,borderRadius:12,padding:12,gap:9,backgroundColor:theme.surface},
 title:{fontSize:15,fontWeight:"700",color:theme.text},
 muted:{fontSize:12,color:theme.mutedText},
 row:{flexDirection:"row",alignItems:"center",gap:8,flexWrap:"wrap"},
 button:{padding:10,borderRadius:8,borderColor:theme.border,borderWidth:1},
 buttonText:{color:theme.text,fontWeight:"600",fontSize:12}
});
