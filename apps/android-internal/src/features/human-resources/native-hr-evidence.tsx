import {useCallback,useEffect,useRef,useState} from "react";
import {Pressable,StyleSheet,Text,View} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import {File,UploadType} from "expo-file-system";
import * as Crypto from "expo-crypto";
import {identityRequest} from "../identity-access/http-client";
type Kind="HR_IDENTITY_PROOF"|"HR_QUALIFICATION"|"HR_PORTRAIT";
type Picked={uri:string;name:string;size:number;mime:string};
type Intent={uploadRef:string;status:string;uploadUrl?:string;
 uploadHeaders?:Record<string,string>};
export type HrFile={fileRef:string;fileVersion:number;classification:Kind;
 sourceVersion:number;cleanVerified:boolean;status:string};
type Status={uploadRef:string;status:string;fileRef:string|null;
 fileVersion:number|null;cleanVerified:boolean};
async function request<T>(token:string,path:string,
 method:"GET"|"POST"="GET",body?:object):Promise<T>{
 const response=await identityRequest("/api/documents/hr"+path,{
  method,cache:"no-store",headers:{Authorization:"Bearer "+token,
   ...(body?{"Content-Type":"application/json"}:{})},
  ...(body?{body:JSON.stringify(body)}:{})});
 if(!response.ok)throw Object.assign(new Error(
  response.status===401?"Your session expired. Sign in again.":
  response.status===403?"Current role cannot access this private HR file.":
  response.status===409?"Original employee application or evidence changed.":
  "The original private upload or malware scan result is uncertain."
 ),{status:response.status});
 return response.json() as Promise<T>;
}
const title=(x:string)=>x.replaceAll("_"," ").toLowerCase()
 .replace(/\b\w/g,c=>c.toUpperCase());
export function NativeHrEvidence({token,applicationRef,revision,onExpired,onFiles}:{
 token:string;applicationRef:string;revision:number;onExpired:()=>void;
 onFiles?:(files:HrFile[])=>void;
}){
 const [kind,setKind]=useState<Kind>("HR_IDENTITY_PROOF");
 const [picked,setPicked]=useState<Picked|null>(null);
 const [intent,setIntent]=useState("");
 const [items,setItems]=useState<HrFile[]>([]);
 const [busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false);
 const [message,setMessage]=useState("");
 const [generation,setGeneration]=useState(0);
 const original=useRef<{requestKey:string;mime:string;sizeBytes:number;
  sha256:string}|null>(null);
 const failure=useCallback((e:unknown)=>{
  if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
  setMessage(e instanceof Error?e.message:"Original evidence cannot be confirmed.");
 },[onExpired]);
 const refresh=useCallback(async()=>{
  try{
   const x=await request<{files:HrFile[]}>(token,
    "/applications/"+encodeURIComponent(applicationRef));
   if(!x||!Array.isArray(x.files))
    throw Error("Private employee evidence list is unavailable.");
   setItems(x.files);onFiles?.(x.files);
  }catch(e){setItems([]);onFiles?.([]);failure(e);}
 },[token,applicationRef,onFiles,failure]);
 useEffect(()=>{
  setIntent("");setPicked(null);setUncertain(false);
  original.current=null;setItems([]);
  void refresh();
 },[applicationRef,revision,generation]); // current-source change resets pending file, not privileges
 const choose=async()=>{
  if(busy)return;
  try{
   const pickedFile=await DocumentPicker.getDocumentAsync({
    type:["application/pdf","image/jpeg","image/png","image/webp"],
    multiple:false,copyToCacheDirectory:true});
   if(pickedFile.canceled)return;
   const file=pickedFile.assets?.[0];
   if(!file||!file.size||file.size<1||file.size>10485760||
      !file.mimeType||!["application/pdf","image/jpeg","image/png","image/webp"].includes(file.mimeType)){
    setMessage("Select one original PDF or image smaller than 10 MB.");return;
   }
   setPicked({uri:file.uri,name:file.name,size:file.size,mime:file.mimeType});
   original.current=null;setIntent("");setUncertain(false);setMessage("");
  }catch{setMessage("The private file picker is unavailable.");}
 };
 const check=async()=>{
  if(!intent||busy)return;
  setBusy(true);setMessage("");
  try{
   const result=await request<Status>(token,
     "/intents/"+encodeURIComponent(intent));
   if(result.cleanVerified&&result.fileRef&&result.fileVersion){
    setUncertain(false);setMessage("Original HR evidence scanner-verified.");
    setGeneration(n=>n+1);
   }else setMessage("Original status: "+title(result.status)+". Not yet approved.");
  }catch(e){setUncertain(true);failure(e);}
  finally{setBusy(false);}
 };
 const upload=async()=>{
  if(!picked||busy||uncertain)return;
  setBusy(true);setMessage("");
  try{
   const file=new File(picked.uri);
   const sha256=await file.digest("SHA-256");
   if(!/^[a-f0-9]{64}$/.test(sha256))
    throw Error("Original private file checksum is unavailable.");
   const prev=original.current;
   const x=prev??{requestKey:Crypto.randomUUID(),mime:picked.mime,
    sizeBytes:picked.size,sha256};
   if(x.mime!==picked.mime||x.sha256!==sha256||x.sizeBytes!==picked.size)
    throw Error("Chosen document changed. Check the original upload before trying again.");
   original.current=x;
   const grant=await request<Intent>(token,"/intents","POST",{
    applicationRef,sourceVersion:revision,classification:kind,...x
   });
   if(!grant.uploadRef)throw Error("The original upload intent was not recorded.");
   setIntent(grant.uploadRef);
   if(!grant.uploadUrl||!grant.uploadHeaders){
    setUncertain(true);
    throw Error("Secure storage or malware scanner unavailable. No proof accepted.");
   }
   const url=new URL(grant.uploadUrl);
   if(url.protocol!=="https:"||url.username||url.password||url.hash||
      grant.uploadHeaders["Content-Type"]!==picked.mime)
    throw Error("Secure upload permission is invalid.");
   const task=file.createUploadTask(grant.uploadUrl,{
    httpMethod:"PUT",uploadType:UploadType.BINARY_CONTENT,
    mimeType:picked.mime,headers:grant.uploadHeaders,sessionType:"foreground"});
   let transferred;
   try{transferred=await task.uploadAsync();}
   finally{task.release();}
   if(transferred.status<200||transferred.status>=300)
    throw Error("Original secure document transfer is unconfirmed.");
   const result=await request<Status>(token,
    "/intents/"+encodeURIComponent(grant.uploadRef)+"/confirm","POST");
   if(!result.cleanVerified||!result.fileRef||!result.fileVersion){
    setUncertain(true);
    throw Error("Malware scanning has not verified the uploaded file.");
   }
   setUncertain(false);setPicked(null);original.current=null;
   setMessage("Original employee evidence verified. HR approval remains separate.");
   setGeneration(v=>v+1);
  }catch(e){setUncertain(true);failure(e);}
  finally{setBusy(false);}
 };
 const revoke=async(item:HrFile)=>{
  if(busy||!item.cleanVerified||item.sourceVersion!==revision)return;
  setBusy(true);setMessage("");
  try{
   const result=await request<{revoked:boolean;revision:number}>(token,
    "/files/"+encodeURIComponent(item.fileRef)+"/revoke","POST",{
     expectedRevision:item.fileVersion});
   if(result.revoked!==true)
    throw Error("Original file revocation was not confirmed.");
   setGeneration(v=>v+1);
   setMessage("Unused private evidence revoked. Original audit is retained.");
  }catch(e){setUncertain(true);failure(e);}
  finally{setBusy(false);}
 };
 const chip=(label:string,fn:()=>void,active=false)=>(
  <Pressable accessibilityRole="button" accessibilityState={{selected:active}}
   onPress={fn} style={[styles.chip,active&&styles.active]}>
   <Text style={[styles.chipText,active&&styles.activeText]}>{label}</Text>
  </Pressable>
 );
 return <View style={styles.card}>
  <Text style={styles.heading}>Private enrollment evidence</Text>
  <Text style={styles.hint}>Original scanned identity evidence is required.
   No file is public or approved until the CG-19 scanner and CG-03 reviewer confirm it.</Text>
  {!!message&&<Text accessibilityRole="alert" style={styles.hint}>{message}</Text>}
  <View style={styles.choices}>
   {(["HR_IDENTITY_PROOF","HR_QUALIFICATION","HR_PORTRAIT"] as Kind[]).map(k=>
    <View key={k}>{chip(title(k),()=>{
     setKind(k);setPicked(null);setIntent("");setUncertain(false);original.current=null;
    },kind===k)}</View>)}
  </View>
  <Pressable accessibilityRole="button" style={styles.action}
   onPress={()=>void choose()} disabled={busy}>
   <Text style={styles.actionText}>{picked?"Chosen: "+picked.name:"Choose original document"}</Text>
  </Pressable>
  {!!picked&&<Pressable accessibilityRole="button" style={styles.primary}
   onPress={()=>void upload()} disabled={busy||uncertain}>
   <Text style={styles.primaryText}>{busy?"Checking evidence…":"Upload and verify"}</Text>
  </Pressable>}
  {!!intent&&<Pressable accessibilityRole="button" onPress={()=>void check()}
   style={styles.action} disabled={busy}>
   <Text style={styles.actionText}>Check original upload status</Text>
  </Pressable>}
  <Pressable accessibilityRole="button" style={styles.action}
   onPress={()=>void refresh()} disabled={busy}>
   <Text style={styles.actionText}>Refresh verified files</Text>
  </Pressable>
  {items.map(f=><View key={f.fileRef} style={styles.item}>
   <Text style={styles.label}>{title(f.classification)}</Text>
   <Text style={styles.hint}>{f.cleanVerified?"Scanner verified":
    title(f.status)}{f.sourceVersion!==revision?" (prior draft)":""}</Text>
   {f.cleanVerified&&f.sourceVersion===revision&&
    <Pressable accessibilityRole="button" style={styles.action} disabled={busy||uncertain}
     onPress={()=>void revoke(f)}>
     <Text style={styles.actionText}>Revoke unused proof</Text>
    </Pressable>}
  </View>)}
 </View>;
}
const styles=StyleSheet.create({
 card:{padding:14,borderRadius:14,backgroundColor:"#fff",
  borderColor:"#CBD5E1",borderWidth:1,gap:9},
 heading:{fontSize:17,color:"#0F172A",fontWeight:"700"},
 hint:{fontSize:13,color:"#64748B",lineHeight:19},
 label:{fontSize:14,color:"#334155",fontWeight:"600"},
 choices:{flexDirection:"row",flexWrap:"wrap",gap:7},
 chip:{paddingHorizontal:10,paddingVertical:8,borderRadius:9,
  borderColor:"#CBD5E1",borderWidth:1,backgroundColor:"#fff"},
 active:{backgroundColor:"#0369A1",borderColor:"#0369A1"},
 chipText:{fontSize:12,color:"#334155"},activeText:{color:"#fff",fontWeight:"700"},
 action:{padding:10,borderRadius:9,backgroundColor:"#F1F5F9",alignSelf:"flex-start"},
 actionText:{color:"#0F172A",fontWeight:"600",fontSize:13},
 primary:{padding:12,borderRadius:9,backgroundColor:"#087F8C",alignSelf:"flex-start"},
 primaryText:{color:"#fff",fontWeight:"700"},
 item:{borderTopWidth:1,borderColor:"#E2E8F0",paddingTop:8}
});
