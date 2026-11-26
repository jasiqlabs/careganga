import {useCallback,useEffect,useRef,useState} from "react";
import {ActivityIndicator,Alert,Pressable,StyleSheet,Text,TextInput,View}
 from "react-native";
import {File,Paths} from "expo-file-system";
import * as Crypto from "expo-crypto";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";

type InboxCase={caseRef:string;number:string;title:string;status:string;revision:number};
type Media={fileRef:string;role:string;altText:string;order:number;
 current:boolean;mime:string|null;bundled?:boolean};
type Detail={caseRef:string;caseNumber:string;status:string;revision:number;
 source:{title:string;kind:string;slug:string;seoTitle:string;
 seoDescription:string;
 navigation:{loginDesired:boolean;memberJoinDesired:boolean;
  volunteerJoinDesired:boolean}|null;
 sections:{kind:string;order:number;fields:Record<string,unknown>}[];
 assets:Media[]}};
type Decision="APPROVE"|"RETURN"|"REJECT";
type Pending={ref:string;key:string;version:number;kind:Decision;
 remarks:string;password:string};
type Props={token:string;onExpired:()=>void;onDone:()=>Promise<void>};
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const tag=(x:string)=>x.replaceAll("_"," ").toLowerCase()
 .replace(/\b\w/g,a=>a.toUpperCase());
// Keep internal entity identifiers out of original CMS review copy.
const safeDetails=(v:unknown)=>JSON.stringify(v,(k,x)=>
 /^(?:id|.*_id|.*Ref|.*_ref)$/i.test(k)?undefined:x)?.slice(0,760)??
 "Not specified";
async function api<T>(token:string,path:string,body?:object):Promise<T>{
 let response:Response;
 try{
  response=await identityRequest("/api/cms/"+path,{
   method:body?"POST":"GET",cache:"no-store",
   headers:{Authorization:"Bearer "+token,
    ...(body?{"Content-Type":"application/json"}:{})},
   ...(body?{body:JSON.stringify(body)}:{})
  });
 }catch{throw Object.assign(new Error("Original review status unconfirmed."),{status:503})}
 if(!response.ok)throw Object.assign(new Error(
  response.status===401?"Sign in again to review the original page.":
  response.status===403?"Only an independently permitted Foundation reviewer may decide.":
  response.status===409?"Original review changed. Refresh before a new decision.":
  response.status===400?"Check review reason, current password and revision.":
  "Original CG03 review status is unavailable or uncertain."
 ),{status:response.status});
 try{return await response.json() as T}
 catch{throw Object.assign(new Error("Original review reply unconfirmed."),{status:503})}
}
const button=(label:string,fn:()=>void,blocked=false)=>
 <Pressable accessibilityRole="button" disabled={blocked}
  accessibilityState={{disabled:blocked}} onPress={fn}
  style={[styles.button,blocked&&styles.disabled]}>
  <Text style={styles.buttonText}>{label}</Text>
 </Pressable>;
/** CG18 Web role-parity, original CG03 approver+CG19 private media owner.
 * No second approval record, public preview, fabricated media or WebView.
 */
export function NativeCmsReviewer({token,onExpired,onDone}:Props){
 const [open,setOpen]=useState(false);
 const [items,setItems]=useState<InboxCase[]>([]);
 const [nextOffset,setNextOffset]=useState<number|null>(null);
 const [detail,setDetail]=useState<Detail|null>(null);
 const [reason,setReason]=useState(""),[password,setPassword]=useState("");
 const [pending,setPending]=useState<Pending|null>(null);
 const [uncertain,setUncertain]=useState(false);
 const [busy,setBusy]=useState(false),[mediaBusy,setMediaBusy]=useState(false);
 const [loading,setLoading]=useState(false),[message,setMessage]=useState("");
 const revision=useRef(0);
 const fail=useCallback((e:unknown)=>{
  if(e&&typeof e==="object"&&"status" in e&&e.status===401)
   onExpired();
  setMessage(e instanceof Error?e.message:"Original review outcome is unavailable.");
 },[onExpired]);
 useEffect(()=>()=>{revision.current++},[]);
 const load=useCallback(async(offset:number,append:boolean)=>{
  const current=++revision.current;setLoading(true);setMessage("");
  try{
   const page=await api<{cases:InboxCase[];nextOffset:number|null}>(
    token,"reviews?offset="+offset);
   if(!Array.isArray(page.cases)||page.cases.length>40||
      page.cases.some(v=>!ID.test(v.caseRef)||
       !Number.isSafeInteger(v.revision))||
      !(page.nextOffset===null||
       Number.isSafeInteger(page.nextOffset)&&page.nextOffset>=0))
    throw Error("Original CMS reviewer inbox is incomplete.");
   if(current!==revision.current)return;
   setItems(old=>append?[...old.filter(o=>!page.cases.some(v=>v.caseRef===o.caseRef)),
    ...page.cases]:page.cases);
   setNextOffset(page.nextOffset);
  }catch(e){if(current===revision.current)fail(e)}
  finally{if(current===revision.current)setLoading(false)}
 },[token,fail]);
 async function openReview(caseRef:string){
  if(busy||loading||uncertain||!ID.test(caseRef))return;
  setBusy(true);setMessage("");
  try{
   const x=await api<Detail>(token,"reviews/"+encodeURIComponent(caseRef));
   if(!x||x.caseRef!==caseRef||!Number.isInteger(x.revision)||
     !x.source||!Array.isArray(x.source.sections)||
     !Array.isArray(x.source.assets)||x.source.assets.length>60)
    throw Error("Original submitted page is incomplete.");
   setDetail(x);setPassword("");setReason("");setPending(null);
  }catch(e){fail(e)}finally{setBusy(false)}
 }
 async function media(ref:string){
  const release=/^release-([a-z-]{1,45})$/.exec(ref);
  if(mediaBusy||(!ID.test(ref)&&!release))return;
  setMediaBusy(true);setMessage("");
  let temporary:File|null=null;
  try{
   const response=await identityRequest(release?"/api/cms/release-media/preview/"+release[1]:"/api/cms/media/preview/"+
    encodeURIComponent(ref),{
     method:"GET",cache:"no-store",headers:{Authorization:"Bearer "+token}
    });
   if(response.status===401){onExpired();return;}
   if(!response.ok)throw Error("Original private media is unavailable.");
   const mime=response.headers.get("content-type")?.split(";")[0]?.trim();
   if(!mime||!["image/jpeg","image/png","image/webp",
     "application/pdf","video/mp4"].includes(mime))
    throw Error("Protected media type unverified.");
   const max=mime==="video/mp4"?26214400:10485760;
   const sizeHeader=response.headers.get("content-length");
   const declared=sizeHeader===null?null:Number(sizeHeader);
   if(declared!==null&&(!Number.isSafeInteger(declared)||
     declared<1||declared>max))
    throw Error("Protected media size unavailable.");
   const bytes=new Uint8Array(await response.arrayBuffer());
   if(bytes.length<1||bytes.length>max||
     declared!==null&&bytes.length!==declared)
    throw Error("Private media bytes are not verified.");
   const suffix=mime==="video/mp4"?".mp4":
    mime==="application/pdf"?".pdf":mime==="image/png"?".png":
    mime==="image/webp"?".webp":".jpg";
   temporary=new File(Paths.cache,"careganga-cms-review-"+Crypto.randomUUID()+suffix);
   temporary.create();await temporary.write(bytes);
   await temporary.preview({title:"Original protected CMS media"});
  }catch(e){fail(e)}
  finally{try{temporary?.delete()}catch{}setMediaBusy(false)}
 }
 async function decide(kind:Decision,replay:Pending|null=null){
  if(busy||!detail||(!replay&&uncertain)||password.length<8&& !replay)return;
  const op=replay??{ref:detail.caseRef,key:Crypto.randomUUID(),
   version:detail.revision,kind,remarks:reason.trim(),password};
  if(!replay&&kind==="APPROVE"&&detail.source.assets.some(asset=>!asset.current)){
   setMessage("One or more private assets are no longer verified. Return to editor.");
   return;
  }
  if(!ID.test(op.ref)||!ID.test(op.key))return;
  setBusy(true);setMessage("");setPending(op);
  try{
   const data=await api<{confirmed:boolean;status:string}>(
    token,"reviews/"+encodeURIComponent(op.ref)+"/decide",{
     requestKey:op.key,expectedRevision:op.version,
     action:op.kind,remarks:op.remarks,currentPassword:op.password});
   if(data.confirmed!==true)throw Object.assign(
    new Error("Original CG03 review was not confirmed."),{status:503});
   setPending(null);setUncertain(false);setDetail(null);setPassword("");setReason("");
   setMessage(kind==="APPROVE"?
    "Original approved by CG03. Publisher must still publish.":
    "Original review decision confirmed. Author may update draft.");
   await load(0,false);
   try{await onDone()}catch{
    setMessage("Original CG03 reviewer decision is CONFIRMED. "+
     "The page list refresh is unavailable; refresh it separately.");
   }
  }catch(e){
   if(e&&typeof e==="object"&&"status" in e&&
     typeof e.status==="number"&&e.status<500){
     setPending(null);setUncertain(false);setDetail(null);
     void load(0,false);
   }else setUncertain(true);
   fail(e);
  }finally{setBusy(false)}
 }
 async function checkPrevious(){
  if(!pending||busy)return;
  setBusy(true);setMessage("");
  try{
   const status=await api<Detail>(token,"reviews/"+pending.ref);
   if(!Number.isInteger(status.revision))throw Error("Original review unavailable.");
   if(status.revision!==pending.version){
    // Read alone cannot prove OUR write won; safely re-submit only
    // the SAME idempotency key to obtain the original confirmed effect.
    setMessage("Original review changed. Retry the same request key "+
      "to determine whether your decision was recorded.");
   }else setMessage("No committed review change visible yet. Retry the "+
    "same original request key only; do not create another decision.");
   setDetail(status);
  }catch(e){fail(e)}finally{setBusy(false)}
 }
 if(!open)return button("Open independent CMS review queue",()=>{
  setOpen(true);void load(0,false)});
 const disabled=busy||loading||uncertain;
 return <View style={styles.card}>
  <Text accessibilityRole="header" style={styles.heading}>Independent page review</Text>
  <Text style={styles.note}>Only an original CG03 reviewer may approve,
   return or reject the existing CMS revision. No page is published here.</Text>
  {!!message&&<Text accessibilityRole="alert" style={styles.note}>{message}</Text>}
  {loading&&<ActivityIndicator accessibilityLabel="Loading original CMS reviews"/>}
  {uncertain&&<View style={styles.panel}>
   <Text accessibilityRole="alert" style={styles.error}>
    Original reviewer outcome uncertain. Do not create a second key.</Text>
   {pending&&button("Check original review status",()=>void checkPrevious(),busy)}
   {pending&&button("Retry exact original request",()=>void decide(pending.kind,pending),
    busy||!detail)}
   {!pending&&<Text style={styles.note}>Contact Foundation operations.</Text>}
  </View>}
  {button("Refresh original review queue",()=>void load(0,false),busy||uncertain)}
  {items.length===0&&!loading&&<Text style={styles.note}>
   No currently authorized original CMS reviews.</Text>}
  {items.map(item=><View key={item.caseRef} style={styles.panel}>
   <Text style={styles.label}>{item.title}</Text>
   <Text style={styles.note}>Original review: {tag(item.status)}</Text>
   {button("Inspect original submitted revision",
    ()=>void openReview(item.caseRef),disabled)}
  </View>)}
  {nextOffset!==null&&
   button("Load more original reviews",()=>void load(nextOffset,true),disabled)}
  {detail&&<View style={styles.panel}>
   <Text style={styles.heading}>{detail.source.title}</Text>
   <Text style={styles.note}>Submitted page: {tag(detail.source.kind)} · {
    tag(detail.status)}.</Text>
   {!!detail.source.seoTitle&&<Text style={styles.note}>
    Public search title: {detail.source.seoTitle}</Text>}
   {!!detail.source.seoDescription&&<Text style={styles.note}>
    Search description: {detail.source.seoDescription}</Text>}
   {detail.source.navigation&&<Text style={styles.note}>
    Public navigation: staff login {
     detail.source.navigation.loginDesired?"requested":"hidden"}; member {
     detail.source.navigation.memberJoinDesired?"requested":"hidden"}; volunteer {
     detail.source.navigation.volunteerJoinDesired?"requested":"hidden"}.
   </Text>}
   {detail.source.sections.map((section,i)=><View key={i} style={styles.group}>
    <Text style={styles.label}>{tag(section.kind)}</Text>
    {Object.entries(section.fields).filter(([k])=>
     !/^(?:id|.*_id|.*Ref|.*_ref)$/i.test(k)).slice(0,30)
     .map(([k,value])=><Text key={k} style={styles.note}>
      {tag(k)}: {typeof value==="string"?value.slice(0,480):
       safeDetails(value)}
     </Text>)}
   </View>)}
   {!detail.source.assets.length&&
    <Text style={styles.note}>No private media attached.</Text>}
   {detail.source.assets.map((asset,i)=><View key={asset.fileRef+"-"+i}
    style={styles.group}>
    <Text style={styles.label}>{tag(asset.role)}: {asset.altText}</Text>
    <Text style={asset.current?styles.note:styles.error}>{
     asset.current?(asset.bundled?"Verified bundled illustration":"CG19 currently verified"):"Not verified; approval blocked"}</Text>
    {button("Preview original protected media",()=>void media(asset.fileRef),
     mediaBusy||!asset.current)}
   </View>)}
   {["SUBMITTED","IN_REVIEW"].includes(detail.status)&&<>
    <Text style={styles.label}>Reviewer reason</Text>
    <TextInput accessibilityLabel="Independent CMS review remarks"
     style={[styles.input,styles.multiline]} multiline value={reason}
     maxLength={500} editable={!disabled} onChangeText={setReason}/>
    <Text style={styles.label}>Current Foundation reviewer password</Text>
    <TextInput accessibilityLabel="Confirm CMS review password"
     style={styles.input} secureTextEntry value={password}
     editable={!disabled} onChangeText={setPassword}/>
    {(["APPROVE","RETURN","REJECT"] as const).map(kind=>
     <View key={kind}>{button(kind==="APPROVE"?
      "Approve original for publisher review":kind==="RETURN"?
      "Return original to editor":"Reject original submission",()=>Alert.alert(
      tag(kind)+" original CMS revision",
      "This makes an independently protected CG03 decision. "+
      "It does not automatically publish website content.",[
       {text:"Cancel",style:"cancel"},
       {text:"Confirm",onPress:()=>void decide(kind)}
      ]),disabled||password.length<8||
       kind==="APPROVE"&&detail.source.assets.some(a=>!a.current))}
     </View>)}
   </>}
  </View>}
  {button("Close reviewer queue",()=>{setOpen(false);setDetail(null)},busy||uncertain)}
 </View>;
}
const styles=StyleSheet.create({
 card:{backgroundColor:t.surface,borderColor:t.border,borderWidth:1,
  borderRadius:12,padding:13,gap:12},
 panel:{borderColor:t.border,borderWidth:1,borderRadius:10,padding:12,gap:9},
 group:{padding:9,gap:7,borderLeftWidth:2,borderLeftColor:t.border},
 heading:{fontWeight:"700",fontSize:16,color:t.text},
 label:{fontWeight:"600",fontSize:13,color:t.text},
 note:{fontSize:13,lineHeight:19,color:t.mutedText},
 error:{fontSize:13,color:t.error},
 input:{borderColor:t.border,borderWidth:1,borderRadius:9,
  minHeight:46,paddingHorizontal:11,paddingVertical:8,color:t.text},
 multiline:{minHeight:75,textAlignVertical:"top"},
 button:{borderWidth:1,borderColor:t.border,borderRadius:9,
  paddingHorizontal:11,paddingVertical:10,minHeight:46,justifyContent:"center"},
 buttonText:{fontSize:13,color:t.text,fontWeight:"600"},
 disabled:{opacity:0.45}
});
