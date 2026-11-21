import {useCallback,useEffect,useRef,useState} from "react";
import {ActivityIndicator,Alert,Pressable,StyleSheet,Text,TextInput,View}
 from "react-native";
import {File,Paths} from "expo-file-system";
import * as Crypto from "expo-crypto";
import {identityRequest} from "../identity-access/http-client";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
type Case={caseRef:string;reference:string;title:string;status:string;revision:number};
type Original={description:string;services:string[];facilities:string[];
 hoursNote:string;publicEmail:string;faqs:{question:string;answer:string}[];
 media:string[]};
type Detail={caseRef:string;reference:string;title:string;centerRef:string;
 status:string;revision:number;content:Original|null;
 isCurrentPublished:boolean;publicationGeneration:number|null;
 approvedRevisionRef:string|null;requiresIndependentReviewer:boolean};
type Decision="APPROVE"|"RETURN"|"REJECT";
type Pending={caseRef:string;requestKey:string;revision:number;
 action:Decision;remarks:string};
type Props={token:string;onExpired:()=>void};
async function read<T>(token:string,path:string,body?:object):Promise<T>{
 let response:Response;
 try{response=await identityRequest("/api/health/content-reviews/"+path,{
  method:body?"POST":"GET",cache:"no-store",
  headers:{Authorization:"Bearer "+token,
   ...(body?{"Content-Type":"application/json"}:{})},
  ...(body?{body:JSON.stringify(body)}:{})
 })}catch{throw Object.assign(new Error("Original review outcome unconfirmed."),{status:503})}
 if(!response.ok)throw Object.assign(new Error(
  response.status===401?"Sign in again to review center content.":
  response.status===403?"Independent Foundation content-review permission required.":
  response.status===409?"Submitted content changed. Recheck the original review.":
  response.status===400?"Check original revision, remarks and current password.":
  "Center-content review could not be verified."),
  {status:response.status});
 try{return await response.json() as T}
 catch{throw Object.assign(new Error("Center-content review response unconfirmed."),{status:503})}
}
const title=(s:string)=>s.replaceAll("_"," ").toLowerCase()
 .replace(/\b\w/g,c=>c.toUpperCase());
const button=(label:string,fn:()=>void,disabled=false)=>
 <Pressable accessibilityRole="button" accessibilityState={{disabled}}
  disabled={disabled} onPress={fn}
  style={[styles.button,disabled&&styles.disabled]}>
  <Text style={styles.buttonText}>{label}</Text></Pressable>;
/** Original CG03 immutable center-content case: exact reviewer Web parity.
 * Foundation publisher uses the separate existing CG14 native publisher.
 */
export function NativeCenterContentReview({token,onExpired}:Props){
 const [open,setOpen]=useState(false),[cases,setCases]=useState<Case[]>([]);
 const [detail,setDetail]=useState<Detail|null>(null);
 const [action,setAction]=useState<Decision>("APPROVE");
 const [remarks,setRemarks]=useState(""),[password,setPassword]=useState("");
 const [busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false);
 const [loading,setLoading]=useState(false),[previewBusy,setPreviewBusy]=useState(false);
 const [notice,setNotice]=useState(""),[pending,setPending]=useState<Pending|null>(null);
 const generation=useRef(0);
 const fail=useCallback((e:unknown)=>{
  if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
  setNotice(e instanceof Error?e.message:"Original center-content review unavailable.");
 },[onExpired]);
 const load=useCallback(async()=>{
  const i=++generation.current;setLoading(true);
  try{
   const data=await read<{cases:Case[]}>(token,"");
   if(!Array.isArray(data.cases)||data.cases.length>100||
      data.cases.some(x=>!ID.test(x.caseRef)||!Number.isInteger(x.revision)))
    throw Error("Original independent center-content queue unavailable.");
   if(i===generation.current)setCases(data.cases);
  }catch(e){if(i===generation.current)fail(e)}
  finally{if(i===generation.current)setLoading(false)}
 },[token,fail]);
 useEffect(()=>()=>{generation.current++},[]);
 async function select(ref:string){
  if(busy||loading||uncertain||!ID.test(ref))return;
  setBusy(true);setNotice("");
  try{
   const row=await read<Detail>(token,encodeURIComponent(ref));
   if(!row||row.caseRef!==ref||!Number.isInteger(row.revision)||
    (row.content!==null&&(!Array.isArray(row.content.services)||
      !Array.isArray(row.content.facilities)||
      !Array.isArray(row.content.faqs)||!Array.isArray(row.content.media))))
    throw Error("Original center content review record is incomplete.");
   setDetail(row);setRemarks("");setPassword("");setPending(null);setAction("APPROVE");
  }catch(e){fail(e)}finally{setBusy(false)}
 }
 async function preview(ref:string){
  if(previewBusy||!ID.test(ref)||!detail)return;
  setPreviewBusy(true);setNotice("");let file:File|null=null;
  try{
   const response=await identityRequest("/api/documents/health-center-content/reviews/"+
    encodeURIComponent(detail.caseRef)+"/photos/"+encodeURIComponent(ref),{
    method:"GET",cache:"no-store",headers:{Authorization:"Bearer "+token}
   });
   if(response.status===401){onExpired();return;}
   if(!response.ok)throw Error("Original scanner-verified private review image unavailable.");
   const mime=response.headers.get("content-type")?.split(";")[0]?.trim();
   if(!mime||!["image/jpeg","image/png","image/webp"].includes(mime))
    throw Error("Private original image type not verified.");
   const max=10485760,declared=response.headers.get("content-length");
   if(declared!==null&&(!Number.isSafeInteger(Number(declared))||
    Number(declared)<1||Number(declared)>max))
    throw Error("Original private image size is invalid.");
   const bytes=new Uint8Array(await response.arrayBuffer());
   if(bytes.length<1||bytes.length>max||
     declared!==null&&bytes.length!==Number(declared))
    throw Error("Original private image bytes not verified.");
   const extension=mime==="image/png"?".png":mime==="image/webp"?".webp":".jpg";
   file=new File(Paths.cache,"careganga-center-content-review-"+Crypto.randomUUID()+extension);
   file.create();await file.write(bytes);
   await file.preview({title:"Original protected center content"});
  }catch(e){fail(e)}
  finally{try{file?.delete()}catch{}setPreviewBusy(false)}
 }
 async function decide(replay:Pending|null=null){
  if(!detail||busy||password.length<8||(!replay&&uncertain))return;
  const op=replay??{caseRef:detail.caseRef,requestKey:Crypto.randomUUID(),
   revision:detail.revision,action,remarks:remarks.trim()};
  setBusy(true);setNotice("");setPending(op);
  try{
   const result=await read<{status:string}>(token,
    encodeURIComponent(op.caseRef)+"/decide",{
     requestKey:op.requestKey,expectedRevision:op.revision,
     action:op.action,remarks:op.remarks,currentPassword:password});
   if(!result||typeof result.status!=="string")
    throw Object.assign(new Error("Original independent CG03 review unconfirmed."),{status:503});
   // Only exact statuses supplied by original CG03 reviewer owner are success.
   if(!["PENDING_OWNER","RETURNED","REJECTED","PREVIOUSLY_CONFIRMED"].includes(
    result.status))
    throw Object.assign(new Error("Original reviewer outcome unconfirmed."),{status:503});
   setNotice(result.status==="PENDING_OWNER"?
    "Independently approved; Foundation must separately publish. No publication performed.":
    "Original reviewer decision confirmed. Existing content and history retained.");
   setPassword("");setUncertain(false);setPending(null);setDetail(null);
   await load();
  }catch(e){
   setPassword("");
   if(!e||typeof e!=="object"||!("status" in e)||
     typeof e.status!=="number"||e.status>=500)setUncertain(true);
   else{setPending(null);setUncertain(false);}
   fail(e);
  }finally{setBusy(false)}
 }
 function begin(){
  setOpen(true);void load();
 }
 if(!open)return button("Review original submitted center presentations",begin);
 return <View style={styles.panel}>
  <Text accessibilityRole="header" style={styles.heading}>
   Independent center-content review</Text>
  <Text style={styles.note}>Same CG03 original case as Foundation Web.
   A verified decision does not publish a center or verify its registration.</Text>
  {!!notice&&<Text accessibilityRole="alert" style={styles.note}>{notice}</Text>}
  {loading&&<ActivityIndicator accessibilityLabel="Checking center-content reviews"/>}
  {uncertain&&<View style={styles.group}>
   <Text accessibilityRole="alert" style={styles.error}>
    Original reviewer outcome unknown. Never create another request key.</Text>
   {pending&&<Text style={styles.note}>
    Re-enter current password to retry the SAME original decision.</Text>}
   {pending&&button("Refresh original center-content queue",()=>void load(),busy)}
   {pending&&button("Retry exact original reviewer request",()=>void decide(pending),
    busy||password.length<8||!detail)}
  </View>}
  {button("Refresh center-content review queue",()=>void load(),busy||uncertain)}
  {!cases.length&&!loading&&<Text style={styles.note}>
   No independently reviewable center presentations currently recorded.</Text>}
  {cases.map(item=><View key={item.caseRef} style={styles.group}>
   <Text style={styles.label}>{item.title}</Text>
   <Text style={styles.note}>{title(item.status)}</Text>
   {button("Inspect original submitted center revision",()=>void select(item.caseRef),
    busy||uncertain)}
  </View>)}
  {detail&&<View style={styles.group}>
   <Text style={styles.heading}>{detail.title}</Text>
   <Text style={styles.note}>Original decision: {title(detail.status)}</Text>
   {detail.content&&<>
    <Text style={styles.note}>Presentation: {detail.content.description}</Text>
    {detail.content.services.map((x,i)=>
     <Text key={"s"+i} style={styles.note}>Service: {x}</Text>)}
    {detail.content.facilities.map((x,i)=>
     <Text key={"f"+i} style={styles.note}>Facility: {x}</Text>)}
    <Text style={styles.note}>Opening hours: {detail.content.hoursNote}</Text>
    <Text style={styles.note}>Public email: {detail.content.publicEmail}</Text>
    {detail.content.faqs.map((x,i)=><View key={"q"+i}>
     <Text style={styles.label}>{x.question}</Text>
     <Text style={styles.note}>{x.answer}</Text>
    </View>)}
    {detail.content.media.map((ref,i)=><View key={ref}>
     {button("Preview verified center photo "+(i+1),
      ()=>void preview(ref),busy||previewBusy)}
    </View>)}
   </>}
   {["SUBMITTED","IN_REVIEW"].includes(detail.status)&&<>
    <Text style={styles.label}>Independent reviewer decision</Text>
    {(["APPROVE","RETURN","REJECT"] as const).map(x=>
     button((action===x?"Selected: ":"")+title(x),()=>{
      setAction(x);setPending(null);setUncertain(false);
     },busy||uncertain))}
    <Text style={styles.label}>Reviewer note</Text>
    <TextInput accessibilityLabel="Original center-content review notes"
     multiline maxLength={500} value={remarks} editable={!busy&&!uncertain}
     onChangeText={setRemarks} style={styles.input}/>
    <Text style={styles.label}>Current Foundation reviewer password</Text>
    <TextInput accessibilityLabel="Confirm independent reviewer password"
     secureTextEntry value={password} editable={!busy} onChangeText={setPassword}
     style={styles.input}/>
    {button("Confirm original independent decision",()=>Alert.alert(
     "Confirm "+title(action)+" original center content",
     "The original CG03 review will be recorded; this does not publish a center.",[
      {text:"Cancel",style:"cancel"},
      {text:"Confirm",onPress:()=>void decide()}
     ]),busy||uncertain||password.length<8)}
   </>}
  </View>}
  {button("Close center-content reviews",()=>{setOpen(false);setDetail(null);
   setUncertain(false);setPending(null);setPassword("");},busy||uncertain)}
 </View>;
}
const styles=StyleSheet.create({
 panel:{backgroundColor:t.surface,borderRadius:12,borderColor:t.border,
  borderWidth:1,padding:12,gap:10},
 group:{borderWidth:1,borderColor:t.border,padding:10,borderRadius:10,gap:8},
 heading:{fontWeight:"700",fontSize:16,color:t.text},
 label:{fontWeight:"600",fontSize:13,color:t.text},
 note:{color:t.mutedText,fontSize:13,lineHeight:19},
 error:{color:t.error,fontSize:13},
 input:{minHeight:46,borderColor:t.border,borderWidth:1,borderRadius:9,
  color:t.text,padding:10,textAlignVertical:"top"},
 button:{borderColor:t.border,borderWidth:1,borderRadius:9,
  minHeight:44,justifyContent:"center",padding:10},
 buttonText:{color:t.text,fontSize:13,fontWeight:"600"},
 disabled:{opacity:0.45}
});
