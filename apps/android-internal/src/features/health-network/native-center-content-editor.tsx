import {useCallback,useEffect,useRef,useState} from "react";
import {ActivityIndicator,Alert,Pressable,StyleSheet,Text,TextInput,View}
 from "react-native";
import * as Crypto from "expo-crypto";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";
import {NativeCenterPhotoUploader} from "./native-center-photo-uploader";
type Content={description:string;services:string[];facilities:string[];
 hoursNote:string;publicEmail:string;
 faqs:{question:string;answer:string}[];media:string[]};
type Snapshot={centerRef:string;version:number;state:string;content:Content;
 reviewCaseRef:string|null;reviewStatus:string|null;
 approvedPresentationPublished:boolean;publicSlug:string|null};
type Props={token:string;centerRef:string;onExpired:()=>void;canManage:boolean};
const clean=(v:string,max:number)=>v.split("\n").map(x=>x.trim())
 .filter(Boolean).slice(0,max);
const empty:Content={description:"",services:[],facilities:[],hoursNote:"",
 publicEmail:"",faqs:[],media:[]};
async function api<T>(token:string,path:string,method:"GET"|"POST"|"PATCH"="GET",
 body?:object){
 const response=await identityRequest("/api/v1/health-network/my-centers/"+path,{
  method,cache:"no-store",headers:{Authorization:"Bearer "+token,
   ...(body?{"Content-Type":"application/json"}:{})},
  ...(body?{body:JSON.stringify(body)}:{})});
 if(!response.ok)throw Object.assign(new Error(
  response.status===401?"Sign in again.":
  response.status===403?"Your current center cannot edit or submit this presentation.":
  response.status===409?"The original presentation changed. Refresh it before retry.":
  "The center presentation outcome cannot be verified."
 ),{status:response.status});
 return response.json() as Promise<T>;
}
export function NativeCenterContentEditor({token,centerRef,onExpired,
 canManage}:Props){
 const [snapshot,setSnapshot]=useState<Snapshot|null>(null);
 const [content,setContent]=useState<Content>(empty);
 const [services,setServices]=useState(""),[facilities,setFacilities]=useState("");
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [uncertain,setUncertain]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const requestKey=useRef(""),submitKey=useRef(""),seq=useRef(0);
 const fail=useCallback((e:unknown)=>{
  if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
  if(!(e&&typeof e==="object"&&"status" in e&&
   typeof e.status==="number"&&e.status<500))setUncertain(true);
  setError(e instanceof Error?e.message:"Original center content unavailable.");
 },[onExpired]);
 const load=useCallback(async()=>{
  const n=++seq.current;
  const result=await api<Snapshot>(token,encodeURIComponent(centerRef)+"/content");
  if(n===seq.current){
   if(!result?.content||!Array.isArray(result.content.faqs))
    throw Error("The original center presentation is incomplete.");
   setSnapshot(result);setContent(result.content);
   setServices(result.content.services.join("\n"));
   setFacilities(result.content.facilities.join("\n"));
   setUncertain(false);
   requestKey.current="";submitKey.current="";
  }
 },[token,centerRef]);
 useEffect(()=>{
  let live=true;setLoading(true);
  void load().catch(e=>{if(live)fail(e)})
   .finally(()=>{if(live)setLoading(false)});
  return()=>{live=false;seq.current++};
 },[load,fail]);
 const button=(label:string,fn:()=>void,disabled=false)=>
  <Pressable accessibilityRole="button" disabled={disabled}
   accessibilityState={{disabled}} onPress={fn}
   style={[styles.button,disabled&&styles.disabled]}>
   <Text style={styles.text}>{label}</Text>
  </Pressable>;
 const field=(label:string,v:string,onChange:(x:string)=>void,max=250,
  multiline=false)=><View style={styles.field}>
   <Text style={styles.note}>{label}</Text>
   <TextInput accessibilityLabel={label} style={styles.input} value={v}
    maxLength={max} multiline={multiline} onChangeText={onChange}
    editable={canManage&&!busy&&!uncertain}/>
  </View>;
 const change=(update:Partial<Content>)=>{
  requestKey.current="";submitKey.current="";
  setContent(x=>({...x,...update}));
 };
 const updated={...content,services:clean(services,24),facilities:clean(facilities,24)};
 const dirty=snapshot&&JSON.stringify(updated)!==JSON.stringify(snapshot.content);
 async function save(){
  if(!snapshot||!canManage||snapshot.state==="SUBMITTED"||busy||uncertain)return;
  if(!requestKey.current)requestKey.current=Crypto.randomUUID();
  setBusy(true);setError("");setNotice("");
  try{
   const reply=await api<{version:number;message:string}>(token,
    encodeURIComponent(centerRef)+"/content","PATCH",{
     requestKey:requestKey.current,expectedVersion:snapshot.version,content:updated
    });
   await load();setNotice(reply.message||"Original center presentation saved.");
  }catch(e){fail(e)}finally{setBusy(false)}
 }
 async function submit(){
  if(!snapshot||dirty||busy||uncertain||!canManage||
   !["DRAFT","RETURNED"].includes(snapshot.state))return;
  if(!submitKey.current)submitKey.current=Crypto.randomUUID();
  setBusy(true);setError("");setNotice("");
  try{
   await api(token,encodeURIComponent(centerRef)+"/content/submit","POST",{
    requestKey:submitKey.current,expectedVersion:snapshot.version
   });
   await load();setNotice("Saved original presentation submitted to independent Foundation review.");
  }catch(e){fail(e)}finally{setBusy(false)}
 }
 async function reopen(){
  if(!snapshot?.reviewCaseRef||busy||uncertain)return;
  setBusy(true);setError("");setNotice("");
  try{
   await api(token,encodeURIComponent(centerRef)+"/content/reviews/"+
    encodeURIComponent(snapshot.reviewCaseRef)+"/reopen","POST");
   await load();setNotice("Returned original presentation draft reopened.");
  }catch(e){fail(e)}finally{setBusy(false)}
 }
 const faq=(i:number,field:"question"|"answer",v:string)=>{
  change({faqs:content.faqs.map((x,j)=>i===j?{...x,[field]:v}:x)});
 };
 return <View style={styles.panel}>
  <Text style={styles.heading}>Center public presentation</Text>
  <Text style={styles.note}>Authorized center staff edit a draft, not the public
   listing. Foundation reviewers separately approve the published presentation.</Text>
  {loading&&<ActivityIndicator accessibilityLabel="Checking original center content"/>}
  {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
  {!!notice&&<Text accessibilityRole="alert" style={styles.note}>{notice}</Text>}
  {uncertain&&<Text style={styles.error}>Last change may already exist.
   Check the same original center before making another change.</Text>}
  {!!snapshot&&<Text style={styles.note}>Draft {snapshot.state} ·
   Review {snapshot.reviewStatus??"Not submitted"} ·
   {snapshot.approvedPresentationPublished?"Publicly approved":"Not public"}</Text>}
  {button("Refresh original center presentation",()=>{
   setLoading(true);void load().catch(fail).finally(()=>setLoading(false));
  },busy)}
  {!!snapshot&&snapshot.state!=="SUBMITTED"&&<>
   {field("Center introduction",content.description,
    x=>change({description:x}),4000,true)}
   {field("Declared public services (one per line)",services,x=>{
    setServices(x);requestKey.current="";submitKey.current="";
   },1900,true)}
   {field("Facility features (one per line)",facilities,x=>{
    setFacilities(x);requestKey.current="";submitKey.current="";
   },1900,true)}
   {field("Operating hours explanation",content.hoursNote,
    x=>change({hoursNote:x}),600,true)}
   {field("Public center email",content.publicEmail,
    x=>change({publicEmail:x}),180)}
   <Text style={styles.heading}>Frequently asked questions</Text>
   {content.faqs.map((item,i)=><View key={i} style={styles.panel}>
    {field("Question "+(i+1),item.question,v=>faq(i,"question",v),320)}
    {field("Answer "+(i+1),item.answer,v=>faq(i,"answer",v),1200,true)}
    {button("Remove question",()=>change({faqs:content.faqs.filter((_,j)=>i!==j)}),
     busy||!canManage)}
   </View>)}
   {content.faqs.length<12&&button("Add question",()=>
    change({faqs:[...content.faqs,{question:"",answer:""}]}),
    busy||!canManage)}
   <NativeCenterPhotoUploader token={token} centerRef={centerRef}
    version={snapshot.version} media={content.media} disabled={!canManage||busy}
    onChange={media=>change({media})} onExpired={onExpired}/>
   {canManage&&button("Save original unpublished center presentation",()=>
    Alert.alert("Save pending center content?","No unapproved text or photo becomes public.",[
     {text:"Cancel",style:"cancel"},
     {text:"Save",onPress:()=>void save()}
    ]),busy||uncertain||!dirty)}
   {canManage&&["DRAFT","RETURNED"].includes(snapshot.state)&&
    button("Submit saved center content for independent approval",()=>
     Alert.alert("Submit for Foundation approval?",
      "Public release stays unavailable until independent approval.",[
       {text:"Cancel",style:"cancel"},
       {text:"Submit",onPress:()=>void submit()}
      ]),busy||uncertain||!!dirty)}
  </>}
  {!!snapshot?.reviewCaseRef&&snapshot.state==="RETURNED"&&canManage&&
   button("Reopen returned original review",()=>void reopen(),busy||uncertain)}
 </View>;
}
const styles=StyleSheet.create({
 panel:{backgroundColor:t.surface,borderWidth:1,borderColor:t.border,
  borderRadius:12,padding:12,gap:9},
 heading:{fontSize:16,fontWeight:"700",color:t.text},
 text:{color:t.text,fontSize:13,fontWeight:"600"},
 note:{color:t.mutedText,fontSize:13,lineHeight:19},
 input:{borderWidth:1,borderColor:t.border,borderRadius:9,
  backgroundColor:t.surface,color:t.text,padding:10,minHeight:45},
 field:{gap:5},
 button:{borderWidth:1,borderColor:t.border,borderRadius:9,
  minHeight:46,padding:10,justifyContent:"center"},
 disabled:{opacity:.4},error:{color:"#A52626",fontSize:13}
});
