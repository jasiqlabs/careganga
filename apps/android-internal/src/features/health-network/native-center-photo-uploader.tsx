import {useEffect,useRef,useState} from "react";
import {Pressable,StyleSheet,Text,TextInput,View} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import {File,UploadType} from "expo-file-system";
import * as Crypto from "expo-crypto";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";
type Photo={fileRef:string;fileVersion:number;rightsVersion:number|null;
 classification:string;sourceVersion:number;rights:string;altText:string|null;
 status:string};
type Started={uploadRef:string;uploadUrl?:string;
 uploadHeaders?:Record<string,string>};
type Verified={uploadRef:string;status:string;cleanVerified:boolean;
 fileRef:string|null;fileVersion:number|null};
type Props={token:string;centerRef:string;version:number;
 media:string[];onChange:(refs:string[])=>void;disabled:boolean;
 onExpired:()=>void};
type PhotoFile={uri:string;name:string;size:number;mime:string};
async function api<T>(token:string,path:string,method:"GET"|"POST"="GET",
 body?:object):Promise<T>{
 const response=await identityRequest(
  "/api/documents/health-center-content"+path,{
   method,cache:"no-store",headers:{Authorization:"Bearer "+token,
    ...(body?{"Content-Type":"application/json"}:{})},
   ...(body?{body:JSON.stringify(body)}:{})});
 if(!response.ok)throw Object.assign(new Error(
  response.status===401?"Sign in again.":
  response.status===403?"The original center or file rights are not authorized.":
  "Private center photo scanner or storage cannot be verified."
 ),{status:response.status});
 return response.json() as Promise<T>;
}
export function NativeCenterPhotoUploader({token,centerRef,version,media,
 onChange,disabled,onExpired}:Props){
 const [photos,setPhotos]=useState<Photo[]>([]);
 const [picked,setPicked]=useState<PhotoFile|null>(null);
 const [alt,setAlt]=useState(""),[holder,setHolder]=useState("");
 const [basis,setBasis]=useState<"OWNED_ORIGINAL"|"DOCUMENTED_CONSENT">(
  "OWNED_ORIGINAL");
 const [uploadRef,setUploadRef]=useState("");
 const [busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false);
 const [notice,setNotice]=useState("");
 const key=useRef("");
 const [refresh,setRefresh]=useState(0);
 useEffect(()=>{
  let live=true;setPhotos([]);
  void api<{files:Photo[]}>(token,"/centers/"+
   encodeURIComponent(centerRef)+"/files")
   .then(x=>{if(live)setPhotos(Array.isArray(x.files)?x.files:[])})
   .catch(e=>{if(live)setNotice(e instanceof Error?e.message:
    "Original photo evidence unavailable.")});
  return()=>{live=false};
 },[token,centerRef,refresh]);
 const button=(label:string,fn:()=>void,blocked=false)=>
  <Pressable accessibilityRole="button" disabled={disabled||blocked}
   accessibilityState={{disabled:disabled||blocked}}
   onPress={fn} style={[styles.button,disabled||blocked?styles.disabled:null]}>
   <Text style={styles.text}>{label}</Text>
  </Pressable>;
 function fail(e:unknown){
  if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
  setNotice(e instanceof Error?e.message:"Original private photo operation is uncertain.");
 }
 async function choose(){
  if(busy||uncertain)return;
  try{
   const choice=await DocumentPicker.getDocumentAsync({
    type:["image/jpeg","image/png"],multiple:false,copyToCacheDirectory:true});
   if(choice.canceled)return;
   const file=choice.assets?.[0];
   if(!file?.size||file.size<1||file.size>3145728||
    !file.mimeType||!["image/jpeg","image/png"].includes(file.mimeType)){
    setNotice("Choose a JPG or PNG smaller than 3 MB.");return;
   }
   setPicked({uri:file.uri,name:file.name,size:file.size,mime:file.mimeType});
   key.current="";setUploadRef("");setUncertain(false);setNotice("");
  }catch{setNotice("Private photo picker unavailable.")}
 }
 async function verify(ref:string){
  const found=await api<Verified>(token,"/intents/"+encodeURIComponent(ref));
  if(!found.cleanVerified||!found.fileRef)
   throw Error("The original private image has not passed malware scanning.");
  await api(token,"/files/"+encodeURIComponent(found.fileRef)+"/attest","POST",{
   rightsBasis:basis,rightsHolder:holder.trim(),altText:alt.trim()});
  if(!media.includes(found.fileRef)&&media.length<8)
   onChange([...media,found.fileRef]);
  setRefresh(v=>v+1);setUncertain(false);setPicked(null);
  setUploadRef("");key.current="";
  setNotice("Original private photo and documented publication rights verified.");
 }
 async function upload(){
  if(disabled||busy||uncertain||version<1||!picked)return;
  if(alt.trim().length<5||holder.trim().length<3){
   setNotice("Enter the photo description and real owner/permission holder.");return;
  }
  setBusy(true);setNotice("");
  try{
   const file=new File(picked.uri);
   const sha256=await file.digest("SHA-256");
   if(!/^[a-f0-9]{64}$/.test(sha256))
    throw Error("Photo checksum not available.");
   if(!key.current)key.current=Crypto.randomUUID();
   const started=await api<Started>(token,"/intents","POST",{
    centerRef,sourceVersion:version,requestKey:key.current,
    classification:"HEALTH_CENTER_PHOTO",mime:picked.mime,
    sizeBytes:picked.size,sha256});
   if(!started.uploadRef)throw Error("Original photo intent not confirmed.");
   setUploadRef(started.uploadRef);
   if(!started.uploadUrl||!started.uploadHeaders)
    throw Error("Private scanner or storage unavailable.");
   const url=new URL(started.uploadUrl);
   if(url.protocol!=="https:"||url.username||url.password||url.hash||
    started.uploadHeaders["Content-Type"]!==picked.mime)
    throw Error("Private upload signature cannot be trusted.");
   const job=file.createUploadTask(started.uploadUrl,{
    httpMethod:"PUT",uploadType:UploadType.BINARY_CONTENT,
    mimeType:picked.mime,headers:started.uploadHeaders,sessionType:"foreground"});
   let transferred;
   try{transferred=await job.uploadAsync()}finally{job.release()}
   if(transferred.status<200||transferred.status>=300)
    throw Error("Original private photo transfer unconfirmed.");
   const done=await api<Verified>(token,
    "/intents/"+encodeURIComponent(started.uploadRef)+"/confirm","POST");
   if(!done.cleanVerified)
    throw Error("Private photo scan incomplete; do not publish.");
   await verify(started.uploadRef);
  }catch(e){setUncertain(true);fail(e)}finally{setBusy(false)}
 }
 async function revoke(item:Photo,rightsOnly:boolean){
  if(busy)return;
  const v=rightsOnly?item.rightsVersion:item.fileVersion;
  if(!v||v<1)return;
  setBusy(true);setNotice("");
  try{
   await api(token,"/files/"+encodeURIComponent(item.fileRef)+
    (rightsOnly?"/revoke-rights":"/revoke"),"POST",{expectedVersion:v});
   if(media.includes(item.fileRef))onChange(media.filter(x=>x!==item.fileRef));
   setRefresh(x=>x+1);
   setNotice("Original image/consent revocation recorded.");
  }catch(e){setUncertain(true);fail(e)}finally{setBusy(false)}
 }
 return <View style={styles.panel}>
  <Text style={styles.heading}>Private center photos and publication rights</Text>
  <Text style={styles.note}>Only scanner-verified, rights-attested center
   photos may be included in an approved public presentation.</Text>
  {!!notice&&<Text accessibilityRole="alert" style={styles.note}>{notice}</Text>}
  {button(picked?"Selected: "+picked.name:"Choose JPG/PNG center photo",
   ()=>void choose(),busy||uncertain)}
  <TextInput accessibilityLabel="Accessible photo description" style={styles.input}
   placeholder="Photo description" value={alt} onChangeText={setAlt}
   maxLength={180} editable={!disabled&&!busy}/>
  <TextInput accessibilityLabel="Original owner or consenting person"
   style={styles.input} placeholder="Original owner or consent holder"
   value={holder} onChangeText={setHolder} maxLength={120}
   editable={!disabled&&!busy}/>
  {button((basis==="OWNED_ORIGINAL"?"✓ ":"")+"Center owns original photo",
   ()=>setBasis("OWNED_ORIGINAL"),busy)}
  {button((basis==="DOCUMENTED_CONSENT"?"✓ ":"")+"Documented permission to publish",
   ()=>setBasis("DOCUMENTED_CONSENT"),busy)}
  {button("Upload, scan and record publication rights",()=>void upload(),
   busy||uncertain||!picked||version<1)}
  {!!uploadRef&&button("Check same original upload and attest",()=>{
   setBusy(true);void verify(uploadRef).catch(e=>{setUncertain(true);fail(e)})
    .finally(()=>setBusy(false));
  },busy)}
  <Text style={styles.heading}>Original photos</Text>
  {photos.map(item=><View key={item.fileRef} style={styles.panel}>
   <Text style={styles.note}>{item.altText??"Original facility photograph"} ·
    {item.status==="VALIDATED"?"Scanner-verified":"Not verified"}</Text>
   <Text style={styles.note}>Publication rights: {item.rights}</Text>
   {item.status==="VALIDATED"&&item.rights==="CONFIRMED"&&
    button((media.includes(item.fileRef)?"✓ ":"")+"Include in saved presentation",
     ()=>onChange(media.includes(item.fileRef)?
      media.filter(x=>x!==item.fileRef):media.length<8?[...media,item.fileRef]:media))}
   {item.rights==="CONFIRMED"&&!!item.rightsVersion&&
    button("Withdraw publication permission",()=>void revoke(item,true),busy)}
   {item.status==="VALIDATED"&&
    button("Revoke private original file",()=>void revoke(item,false),busy)}
  </View>)}
  {uncertain&&<Text style={styles.error}>Outcome uncertain. Recheck
   the original upload and rights before creating another request.</Text>}
 </View>;
}
const styles=StyleSheet.create({
 panel:{backgroundColor:t.surface,borderWidth:1,borderColor:t.border,
  borderRadius:12,padding:10,gap:8},
 heading:{fontSize:16,fontWeight:"700",color:t.text},
 note:{fontSize:12,lineHeight:18,color:t.mutedText},
 text:{fontSize:13,fontWeight:"600",color:t.text},
 input:{borderWidth:1,borderColor:t.border,borderRadius:8,
  backgroundColor:t.surface,color:t.text,minHeight:44,padding:10},
 button:{borderWidth:1,borderColor:t.border,borderRadius:9,
  padding:10,minHeight:44,justifyContent:"center"},
 disabled:{opacity:.4},error:{color:"#A52626",fontSize:13}
});
