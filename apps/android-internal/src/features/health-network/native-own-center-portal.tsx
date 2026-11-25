import {useCallback,useEffect,useRef,useState} from "react";
import {ActivityIndicator,Alert,Pressable,ScrollView,StyleSheet,Text,View}
 from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import * as Crypto from "expo-crypto";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";
import {NativeHealthCenterEditor,type CenterDraft} from "./native-health-center-editor";
import {NativeHealthEvidenceUploader} from "./native-health-evidence-uploader";
import {NativeDoctorCenterFees} from "./native-doctor-center-fees";
import {NativeCenterContentEditor} from "./native-center-content-editor";
import {NativePartnerPublicOffers} from "./native-partner-public-offers";
import {NativeOwnCenterMis} from "../mis-reporting/native-own-center-mis";
type Row={centerRef:string;name:string;providerName:string;version:number;status:string};
type Detail={centerRef:string;providerRef:string;version:number;center:CenterDraft;
 status:string;providerStatus:string;accessState:string;
 publicationState:string;publicSlug:string|null};
type Props={token:string;onExit:()=>void;onExpired:()=>void;canViewSettlements?:boolean};
async function request<T>(token:string,path:string,
 method:"GET"|"PATCH"|"POST"="GET",body?:object):Promise<T>{
 const res=await identityRequest("/api/v1/health-network/my-centers"+path,{
  method,cache:"no-store",headers:{Authorization:"Bearer "+token,
   ...(body?{"Content-Type":"application/json"}:{})},
  ...(body?{body:JSON.stringify(body)}:{})});
 if(!res.ok)throw Object.assign(new Error(
  res.status===401?"Sign in again.":
  res.status===403?"Your current center assignment does not allow this change.":
  res.status===409?"Center draft changed. Reload before editing.":
  "Current center update is unconfirmed. Check original source."
 ),{status:res.status});
 return res.json() as Promise<T>;
}
export function NativeOwnCenterPortal({token,onExit,onExpired,canViewSettlements=false}:Props){
 const [centers,setCenters]=useState<Row[]>([]);
 const [active,setActive]=useState<Detail|null>(null);
 const [draft,setDraft]=useState<CenterDraft|null>(null);
 const [proof,setProof]=useState("");
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [uncertain,setUncertain]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const saveKey=useRef(""),submitKey=useRef("");
 const selectionSeq=useRef(0),selectedRef=useRef("");
 const fail=useCallback((e:unknown)=>{
  if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
  if(!e||typeof e!=="object"||!("status" in e)||
   typeof e.status!=="number"||e.status>=500)setUncertain(true);
  setError(e instanceof Error?e.message:"Original assigned center unavailable.");
 },[onExpired]);
 const list=useCallback(async()=>{
  const response=await request<{centers:Row[]}>(token,"");
  if(!response||!Array.isArray(response.centers))
   throw Error("Your assigned centers cannot be verified.");
  setCenters(response.centers);
 },[token]);
 const choose=useCallback(async(ref:string)=>{
  const turn=++selectionSeq.current;selectedRef.current=ref;
  setActive(null);setDraft(null);setProof("");
  const current=await request<Detail>(token,"/"+encodeURIComponent(ref));
  if(turn!==selectionSeq.current)return;
  if(!current?.center||current.centerRef!==ref)
   throw Error("Original assigned center changed.");
  setActive(current);setDraft(current.center);setProof("");
  saveKey.current="";submitKey.current="";
  setUncertain(false);
 },[token]);
 useEffect(()=>{
  let live=true;setLoading(true);
  void list().catch(e=>{if(live)fail(e)})
   .finally(()=>{if(live)setLoading(false)});
  return()=>{live=false;selectionSeq.current++;};
 },[list,fail]);
 const button=(label:string,go:()=>void,disabled=false)=>
  <Pressable accessibilityRole="button" disabled={disabled}
   accessibilityState={{disabled}} style={[styles.button,disabled&&styles.disabled]}
   onPress={go}><Text style={styles.text}>{label}</Text></Pressable>;
 async function open(ref:string){
  if(busy||uncertain&&selectedRef.current!==ref)return;
  setBusy(true);setError("");setNotice("");
  try{await choose(ref)}catch(e){fail(e)}
  finally{setBusy(false)}
 }
 async function save(){
  if(!active||!draft||busy||uncertain||active.status!=="PENDING")return;
  if(!saveKey.current)saveKey.current=Crypto.randomUUID();
  setBusy(true);setError("");setNotice("");
  try{
   await request(token,"/"+encodeURIComponent(active.centerRef),"PATCH",{
    requestKey:saveKey.current,expectedVersion:active.version,center:draft
   });
   saveKey.current="";await choose(active.centerRef);await list();
   setNotice("Original pending center saved. Independent verification remains separate.");
  }catch(e){fail(e)}
  finally{setBusy(false)}
 }
 async function submit(){
  if(!active||!proof||busy||uncertain||active.status!=="PENDING"||
   active.providerStatus!=="VERIFIED")return;
  if(!submitKey.current)submitKey.current=Crypto.randomUUID();
  setBusy(true);setError("");setNotice("");
  try{
   await request(token,"/"+encodeURIComponent(active.centerRef)+"/submit","POST",{
    requestKey:submitKey.current,expectedVersion:active.version,proofFileRef:proof});
   submitKey.current="";await choose(active.centerRef);await list();
   setNotice("Original verified licence submitted. Foundation approval is required.");
  }catch(e){fail(e)}finally{setBusy(false)}
 }
 const renderedSelection=selectionSeq.current;
 function selectCenter(ref:string){
  if(busy||uncertain)return;
  if(active&&draft&&JSON.stringify(active.center)!==JSON.stringify(draft)){
   Alert.alert("Discard unsaved center changes?","Saved details will not change.",[{text:"Keep editing",style:"cancel"},{text:"Discard",style:"destructive",onPress:()=>void open(ref)}]);return;
  }
  void open(ref);
 }
 return <SafeAreaView style={styles.page}>
  <ScrollView contentContainerStyle={styles.content}>
   <Text accessibilityRole="header" style={styles.title}>My healthcare center</Text>
   <Text style={styles.note}>Only your assigned center can be edited.
    The Foundation separately approves registration and publication.</Text>
   {button("Back to dashboard",onExit)}
   {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
   {!!notice&&<Text accessibilityRole="alert" style={styles.note}>{notice}</Text>}
   {uncertain&&<Text style={styles.error}>The last change may have committed.
    Recheck the original center before attempting a different request.</Text>}
   {loading&&<ActivityIndicator accessibilityLabel="Checking assigned centers"/>}
   {!loading&&!centers.length&&<Text style={styles.note}>
    No currently assigned center is available.</Text>}
   {centers.map(c=><View key={c.centerRef}>
    {button(c.name+" · "+c.providerName+" · "+c.status.replaceAll("_"," "),()=>selectCenter(c.centerRef),
     busy||uncertain)}
   </View>)}
   {active&&draft&&<View style={styles.panel}>
    {canViewSettlements&&active.status==="VERIFIED"&&active.accessState==="ENABLED"&&
      <NativeOwnCenterMis key={active.centerRef} token={token}
       centerRef={active.centerRef} onExpired={onExpired}/>}
    <Text style={styles.heading}>{draft.displayName}</Text>
    <Text style={styles.note}>Provider: {active.providerStatus} ·
     Center: {active.status} · Access: {active.accessState} ·
     Publication: {active.publicationState}</Text>
    {active.status==="PENDING"&&<>
     <NativeHealthCenterEditor token={token} value={draft}
      identityLocked disabled={busy||uncertain}
      onChange={setDraft}/>
     {button("Save original pending center",()=>void save(),busy||uncertain)}
     <NativeHealthEvidenceUploader key={active.centerRef+":"+active.version} token={token}
      providerRef={active.providerRef} centerRef={active.centerRef}
      sourceVersion={active.version} classification="HEALTH_CENTER_LICENSE"
      onVerified={fileRef=>{if(renderedSelection===selectionSeq.current)setProof(fileRef);}}
      onExpired={onExpired} disabled={busy||uncertain}/>
     {active.providerStatus==="VERIFIED"&&
      button("Submit verified center licence for independent review",()=>
       Alert.alert("Submit original center evidence?","Approval does not activate this center.",[
        {text:"Cancel",style:"cancel"},
        {text:"Submit",onPress:()=>void submit()}
       ]),busy||uncertain||!proof)}
    </>}
    {active.status==="VERIFIED"&&active.accessState==="ENABLED"&&
     <NativePartnerPublicOffers token={token} mode="partner"
      centerRef={active.centerRef} onExpired={onExpired}/>}
    {active.status==="VERIFIED"&&active.accessState==="ENABLED"&&
      <NativeCenterContentEditor token={token} centerRef={active.centerRef}
       canManage onExpired={onExpired}/>}
    {active.status==="VERIFIED"&&active.accessState==="ENABLED"&&
      <NativeDoctorCenterFees token={token} centerRef={active.centerRef}
       canManage canVerify={false} onExpired={onExpired}/>}
    {active.status!=="PENDING"&&<Text style={styles.note}>
     This center is not an editable pending draft. Current confirmed information
     remains read-only; contact the Foundation for a new approved change.</Text>}
   </View>}
   {uncertain&&selectedRef.current&&button("Recheck current center",()=>void open(selectedRef.current),busy)}
   {button("Refresh assigned centers",()=>{
    setLoading(true);void list().catch(fail).finally(()=>setLoading(false));
   },busy||uncertain&&!!selectedRef.current)}
  </ScrollView>
 </SafeAreaView>;
}
const styles=StyleSheet.create({
 page:{flex:1,backgroundColor:t.adminCanvas},
 content:{padding:15,gap:12,paddingBottom:100},
 title:{fontSize:21,fontWeight:"700",color:t.text},
 heading:{fontSize:17,fontWeight:"700",color:t.text},
 note:{fontSize:13,color:t.mutedText,lineHeight:19},
 text:{fontSize:13,color:t.text,fontWeight:"600"},
 panel:{borderWidth:1,borderColor:t.border,backgroundColor:t.surface,
  borderRadius:12,padding:12,gap:10},
 button:{borderWidth:1,borderColor:t.border,borderRadius:10,
  padding:12,minHeight:46,justifyContent:"center"},
 disabled:{opacity:.4},error:{color:t.error,fontSize:13}
});
