import {useEffect,useRef,useState} from "react";
import {Pressable,StyleSheet,Text,TextInput,View} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import {File,UploadType} from "expo-file-system";
import * as Crypto from "expo-crypto";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";
export type CmsPlacement={fileRef:string;version:number;role:string;
 altText:string;order:number};
type CmsSection={kind:string;order:number;fields:Record<string,unknown>};
type Props={token:string;pageRef:string;revisionRef:string;kind:string;
 sections:CmsSection[];assets:CmsPlacement[];onChange:(items:CmsPlacement[])=>void;
 onExpired:()=>void;disabled?:boolean};
type Selected={uri:string;name:string;size:number;mime:string};
type Intent={status:string;uploadRef:string;uploadUrl?:string;
 uploadHeaders?:Record<string,string>};
type Verified={cleanVerified:boolean;fileRef:string|null;
 validatedVersion:number|null;status:string};
// Follow the CG18 server's authored-section and media placement rules.
 // Do not offer roles/positions that the existing CMS will reject or hide.
const images=["image/jpeg","image/png","image/webp"];
type Choice={role:string;order:number;mime:string[]};
function placementChoices(sections:CmsSection[]):Choice[]{
 const found:Choice[]=[];
 const add=(role:string,order:number,mime=images)=>{
  if(Number.isSafeInteger(order)&&order>=0&&order<=100&&
   !found.some(c=>c.role===role&&c.order===order))
   found.push({role,order,mime});
 };
 for(const section of sections){
  const f=section.fields;
  if(section.kind==="HERO"){
   add("HERO",section.order);add("MOBILE_HERO",section.order);
  }else if(section.kind==="RICH_TEXT"&&f.variant==="SPLIT")
   add("ABOUT",section.order);
  else if(section.kind==="CTA")add("PROMO",section.order);
  else if(section.kind==="FEATURE_CARDS"&&Array.isArray(f.cards))
   f.cards.slice(0,30).forEach((_,i)=>add("FEATURE",i));
  else if(section.kind==="GALLERY_GRID"&&Array.isArray(f.items))
   f.items.slice(0,30).forEach((item,i)=>{
    const type=item&&typeof item==="object"&&"mediaType" in item?
     item.mediaType:null;
    if(type==="PHOTO")add("GALLERY",i,images);
    else if(type==="VIDEO")add("GALLERY",i,["video/mp4"]);
    else if(type==="PUBLICATION")add("GALLERY",i,["application/pdf"]);
   });
  else if(section.kind==="ARTICLE_BODY")add("ARTICLE",0);
  else if(section.kind==="IMPACT_GROUP")add("IMPACT",section.order);
  else if(section.kind==="CONTACT_INFO")
   [0,1,2].forEach(i=>add("CONTACT",i));
  else if(section.kind==="COMPLIANCE_FACTS"&&Array.isArray(f.documents))
   f.documents.slice(0,30).forEach((_,i)=>add("DOCUMENT",i,
    [...images,"application/pdf"]));
  // TEAM images require an approved real-person source, not manual CMS input.
 }
 return found;
}
const label=(v:string)=>v.replaceAll("_"," ").toLowerCase()
 .replace(/\b\w/g,c=>c.toUpperCase());
async function cms<T>(token:string,path:string,method:"GET"|"POST"="GET",
 payload?:object):Promise<T>{
 const response=await identityRequest("/api/cms/media/"+path,{
  method,cache:"no-store",headers:{Authorization:"Bearer "+token,
   ...(payload?{"Content-Type":"application/json"}:{})},
  ...(payload?{body:JSON.stringify(payload)}:{})});
 if(!response.ok)throw Object.assign(new Error(
  response.status===401?"Sign in again.":
  response.status===403?"Only the authorized Foundation editor can attach this original media.":
  response.status===409?"This original draft revision or file intent changed.":
  "CG19 private media storage or validation could not be confirmed."
 ),{status:response.status});
 return response.json() as Promise<T>;
}
export function NativeCmsMediaUploader({token,pageRef,revisionRef,kind,sections,assets,
 onChange,onExpired,disabled=false}:Props){
 const [picked,setPicked]=useState<Selected|null>(null);
 const [role,setRole]=useState(kind==="ARTICLE"?"ARTICLE":
  kind==="GALLERY"?"GALLERY":kind==="CONTACT"?"CONTACT":
  kind==="IMPACT"?"IMPACT":"HERO");
 const [order,setOrder]=useState("0"),[alt,setAlt]=useState("");
 const [rights,setRights]=useState(false),[busy,setBusy]=useState(false);
 const [uncertain,setUncertain]=useState(false),[intent,setIntent]=useState("");
 const [notice,setNotice]=useState("");
 const key=useRef("");
 const original=useRef<{sha256:string;sizeBytes:number;mime:string}|null>(null);
 useEffect(()=>{
  setPicked(null);setIntent("");setUncertain(false);setRights(false);
  setAlt("");key.current="";original.current=null;
 },[pageRef,revisionRef]);
 const choices=placementChoices(sections);
 const availableRoles=[...new Set(choices.map(c=>c.role))];
 const selectedChoice=choices.find(c=>c.role===role&&c.order===Number(order));
 const mime=selectedChoice?.mime??[];
 useEffect(()=>{
  if(!choices.some(c=>c.role===role)){
   setRole(choices[0]?.role??"");
   setOrder(String(choices[0]?.order??0));
   setPicked(null);setIntent("");setUncertain(false);key.current="";
  }
 },[sections,role]);
 const action=(title:string,fn:()=>void,blocked=false)=>
  <Pressable accessibilityRole="button" disabled={disabled||blocked}
   accessibilityState={{disabled:disabled||blocked}}
   onPress={fn} style={[styles.button,(disabled||blocked)&&styles.disabled]}>
   <Text style={styles.text}>{title}</Text>
  </Pressable>;
 function fail(e:unknown){
  if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
  setNotice(e instanceof Error?e.message:"Original media outcome is uncertain.");
 }
 const attach=(ref:string,version:number)=>{
  if(!selectedChoice){
   setNotice("The original media section changed. Refresh before attaching.");return;
  }
  const index=selectedChoice.order;
  const placement={fileRef:ref,version,role,order:index,altText:alt.trim()};
  onChange([...assets.filter(x=>x.role!==role||x.order!==index),placement]);
  setIntent("");setPicked(null);setRights(false);setAlt("");
  setUncertain(false);key.current="";original.current=null;
  setNotice("Scanned CG19 original attached to unsaved CMS revision. Save before submitting.");
 };
 async function pick(){
  if(disabled||busy||uncertain||!selectedChoice)return;
  try{
   const selected=await DocumentPicker.getDocumentAsync({
    type:mime,multiple:false,copyToCacheDirectory:true});
   if(selected.canceled)return;
   const item=selected.assets?.[0];
   const cap=item?.mimeType==="video/mp4"?26214400:10485760;
   if(!item?.size||item.size<1||item.size>cap||!item.mimeType||
     !mime.includes(item.mimeType)){
    setNotice("Choose a supported original image/PDF (10 MB) or gallery video (25 MB).");
    return;
   }
   setPicked({uri:item.uri,name:item.name,size:item.size,mime:item.mimeType});
   setIntent("");setUncertain(false);key.current="";original.current=null;
  }catch{setNotice("Protected file picker unavailable.")}
 }
 async function status(){
  if(!intent||busy)return;
  setBusy(true);setNotice("");
  try{
   const result=await cms<Verified>(token,encodeURIComponent(intent));
   if(result.cleanVerified&&result.fileRef&&result.validatedVersion){
    attach(result.fileRef,result.validatedVersion);
   }else{
    setUncertain(false);
    setNotice("Original upload not verified: "+result.status+
     ". Do not submit or publish it.");
   }
  }catch(e){setUncertain(true);fail(e)}
  finally{setBusy(false)}
 }
 async function upload(){
  if(busy||uncertain||disabled||!picked||!rights||!selectedChoice||
   !mime.includes(picked.mime)||alt.trim().length<3||
   !/^(0|[1-9]\d{0,2})$/.test(order))return;
  setBusy(true);setNotice("");
  try{
   const file=new File(picked.uri),sha256=await file.digest("SHA-256");
   if(!/^[a-f0-9]{64}$/.test(sha256))
    throw Error("Private source checksum cannot be confirmed.");
   if(original.current&&(original.current.sha256!==sha256||
     original.current.mime!==picked.mime||
     original.current.sizeBytes!==picked.size))
    throw Error("The selected original changed. Check previous upload first.");
   original.current={sha256,sizeBytes:picked.size,mime:picked.mime};
   if(!key.current)key.current=Crypto.randomUUID();
   const started=await cms<Intent>(token,"initiate","POST",{
    pageRef,revisionRef,requestKey:key.current,
    mime:picked.mime,sizeBytes:picked.size,sha256,rightsConfirmed:true});
   if(!started.uploadRef)throw Error("Original CG19 upload intent was not recorded.");
   setIntent(started.uploadRef);
   if(started.status==="VALIDATED"){
    const current=await cms<Verified>(token,
     encodeURIComponent(started.uploadRef));
    if(current.cleanVerified&&current.fileRef&&current.validatedVersion){
     attach(current.fileRef,current.validatedVersion);return;
    }
   }
   if(started.status!=="UPLOAD_READY"||
    !started.uploadUrl||!started.uploadHeaders){
    setUncertain(true);setNotice("Original upload was not ready. Check its status.");
    return;
   }
   const url=new URL(started.uploadUrl);
   if(url.protocol!=="https:"||url.username||url.password||url.hash||
     started.uploadHeaders["Content-Type"]!==picked.mime)
    throw Error("CG19 signed private upload cannot be trusted.");
   const transfer=file.createUploadTask(started.uploadUrl,{
    httpMethod:"PUT",uploadType:UploadType.BINARY_CONTENT,
    mimeType:picked.mime,headers:started.uploadHeaders,
    sessionType:"foreground"});
   let sent;
   try{sent=await transfer.uploadAsync()}finally{transfer.release()}
   if(sent.status<200||sent.status>=300)
    throw Error("Original private file upload is unconfirmed.");
   const verified=await cms<Verified>(token,
    encodeURIComponent(started.uploadRef)+"/confirm","POST",{});
   if(!verified.cleanVerified||!verified.fileRef||
     !verified.validatedVersion){
    setUncertain(true);
    setNotice("Original CG19 scan pending. Check the same uploaded file.");
    return;
   }
   attach(verified.fileRef,verified.validatedVersion);
  }catch(e){setUncertain(true);fail(e)}
  finally{setBusy(false)}
 }
 return <View style={styles.panel}>
  <Text style={styles.heading}>CG19 scanned editorial media</Text>
  <Text style={styles.note}>Only the original page revision can attach a
   clean, authorized private file. No upload automatically publishes a page.</Text>
  {!!notice&&<Text accessibilityRole="alert" style={styles.note}>{notice}</Text>}
  <Text style={styles.heading}>Image or document role</Text>
  <View style={styles.row}>{availableRoles.map(x=><View key={x}>
   {action((role===x?"✓ ":"")+label(x),()=>{
    setRole(x);setOrder(String(choices.find(c=>c.role===x)?.order??0));
    setPicked(null);setIntent("");setUncertain(false);key.current="";
   },busy||uncertain)}
  </View>)}</View>
  {!choices.length&&<Text style={styles.note}>
   Add a supported original media section/item before attaching files.</Text>}
  {!!choices.length&&<Text style={styles.note}>
   Valid positions for {label(role)}: {choices.filter(c=>c.role===role)
    .map(c=>c.order).join(", ")||"None"}.
   Gallery media type follows the selected authored item.</Text>}
  {action(picked?"Chosen: "+picked.name:"Choose original file",()=>void pick(),
   busy||uncertain||!selectedChoice)}
  <TextInput accessibilityLabel="Media accessibility description"
   style={styles.input} value={alt} onChangeText={setAlt}
   maxLength={180} editable={!disabled&&!busy}
   placeholder="Describe this original image or document"/>
  <TextInput accessibilityLabel="Editorial placement order"
   style={styles.input} value={order} onChangeText={setOrder}
   maxLength={3} keyboardType="numeric" editable={!disabled&&!busy}
   placeholder="Placement order"/>
  {action((rights?"✓ ":"")+"Foundation has original publication rights",
   ()=>setRights(x=>!x),busy)}
  {action("Upload, scan and attach to unsaved draft",()=>void upload(),
   busy||uncertain||!selectedChoice||!picked||!rights||
    !mime.includes(picked.mime)||alt.trim().length<3)}
  {!!intent&&action("Check the same original upload",()=>void status(),busy)}
  {!!uncertain&&<Text style={styles.warning}>
   Original upload outcome is uncertain. Check its original intent before retrying.</Text>}
  <Text style={styles.heading}>Media placements on this unpublished revision</Text>
  {assets.map((p,i)=><View key={p.fileRef+"-"+p.role+"-"+i}
   style={styles.panel}>
   <Text style={styles.note}>{label(p.role)} · {p.altText} · order {p.order}</Text>
   {action("Remove from draft placement",()=>
    onChange(assets.filter((_,j)=>j!==i)),busy||uncertain)}
  </View>)}
 </View>;
}
const styles=StyleSheet.create({
 panel:{backgroundColor:t.surface,padding:10,gap:8,borderWidth:1,
  borderColor:t.border,borderRadius:12},
 heading:{fontSize:15,fontWeight:"700",color:t.text},
 text:{fontSize:12,fontWeight:"600",color:t.text},
 note:{fontSize:12,color:t.mutedText,lineHeight:18},
 input:{borderWidth:1,borderColor:t.border,padding:10,
  minHeight:45,borderRadius:9,color:t.text,backgroundColor:t.surface},
 row:{flexDirection:"row",flexWrap:"wrap",gap:5},
 button:{minHeight:44,borderRadius:9,borderWidth:1,
  borderColor:t.border,padding:10,justifyContent:"center"},
 disabled:{opacity:.4},warning:{color:"#9D3131",fontSize:12}
});
