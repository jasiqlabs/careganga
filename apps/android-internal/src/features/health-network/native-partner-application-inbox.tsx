import {useEffect,useState} from "react";
import {ActivityIndicator,Alert,BackHandler,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";

type Item={applicationRef:string;reference:string;type:string;name:string;
 contactName:string;phone:string;email:string|null;registrationNumber:string|null;
 address:string;district:string;state:string;pinCode:string;status:string;
 revision:number;receivedAt:string;reviewNote:string|null};
type Option={id:string;label:string};
type Page={applications:Item[];nextOffset:number|null};
async function api<T>(token:string,path:string,method:"GET"|"POST"="GET",body?:object){
 const response=await identityRequest("/api/v1/health-network/"+path,{method,
  cache:"no-store",headers:{Authorization:"Bearer "+token,
   ...(body?{"Content-Type":"application/json"}:{})},
  ...(body?{body:JSON.stringify(body)}:{})});
 if(!response.ok){
  const body:unknown=await response.json().catch(()=>null);
  const safe=new Set(["PARTNER_FIELD_INVALID","PARTNER_VERSION_INVALID",
   "PARTNER_VERSION_CHANGED","PARTNER_REVIEW_CLOSED","PARTNER_SOURCE_MISMATCH",
   "PARTNER_APPLICATION_UNAVAILABLE"]);
  const rec=body&&typeof body==="object"?body as Record<string,unknown>:null;
  const message=rec&&typeof rec.code==="string"&&safe.has(rec.code)&&
   typeof rec.message==="string"&&rec.message.length<=220&&
   !/[<>\r\n]/.test(rec.message)?rec.message:
   response.status===401?"Your session expired. Sign in again.":
   response.status===403?"You cannot review these healthcare applications.":
   response.status===409?"This application changed. Refresh before retrying.":
   response.status===404?"This application could not be found. Refresh the list.":
   response.status===429?"Too many attempts. Try again later.":
   response.status===400?"Check the application fields and review note.":
   "The result could not be confirmed. Refresh the original application.";
  throw Object.assign(new Error(message),{status:response.status});
 }
 const payload:unknown=await response.json();
 if(!payload||typeof payload!=="object"||Array.isArray(payload))
  throw Error("The application response is unavailable. Refresh the list.");
 return payload as T;
}
const nice=(x:string)=>x.toLowerCase().replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase());
export function NativePartnerApplicationInbox({token,canManage,onExit,onExpired}:{
 token:string;canManage:boolean;onExit:()=>void;onExpired:()=>void;
}){
 const [items,setItems]=useState<Item[]>([]),[next,setNext]=useState<number|null>(0);
 const [filter,setFilter]=useState("ALL"),[selected,setSelected]=useState<Item|null>(null);
 const [reason,setReason]=useState(""),[source,setSource]=useState("");
 const [options,setOptions]=useState<Option[]>([]);
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 const [notice,setNotice]=useState("");
 useEffect(()=>{
  const subscription=BackHandler.addEventListener("hardwareBackPress",()=>{
   if(selected)setSelected(null);
   else onExit();
   return true;
  });
  return ()=>subscription.remove();
 },[selected,onExit]);
 function failure(e:unknown){
  if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
  setError(e instanceof Error?e.message:"Original application could not be verified.");
 }
 async function load(status=filter,offset=0){
  setBusy(true);setError("");
  try{
   const r=await api<Page>(token,"partner-applications?status="+status+"&offset="+offset);
   if(!r||!Array.isArray(r.applications))throw Error("Original records unavailable.");
   setItems(v=>offset===0?r.applications:[...v,...r.applications]);
   setNext(r.nextOffset);
   if(offset===0){setSelected(null);setSource("");setOptions([]);}
  }catch(e){failure(e)}finally{setBusy(false);}
 }
 useEffect(()=>{void load("ALL",0);},[token]);
 async function open(app:Item){
  setSelected(app);setError("");setReason("");setSource("");setOptions([]);
  if(!canManage||["LINKED","DECLINED"].includes(app.status))return;
  try{
   if(app.type==="DOCTOR"){
    const r=await api<{doctors:{doctorRef:string;name:string;status:string}[]}>(
     token,"doctors?q="+encodeURIComponent(app.name));
    setOptions(r.doctors.filter(d=>d.name.toLowerCase()===app.name.toLowerCase())
     .map(d=>({id:d.doctorRef,label:d.name+" · "+nice(d.status)})));
   }else{
    const r=await api<{providers:{providerRef:string;name:string;code:string;
     type:string;status:string}[]}>(token,"providers?offset=0&q="+encodeURIComponent(app.name));
    setOptions(r.providers.filter(p=>p.name.toLowerCase()===app.name.toLowerCase()&&
     (app.type==="SURGERY_CENTER"?["HOSPITAL","CLINIC"].includes(p.type):
      p.type===app.type))
     .map(p=>({id:p.providerRef,label:p.name+" · "+p.code+" · "+nice(p.status)})));
   }
  }catch(e){failure(e)}
 }
 async function decide(status:"IN_REVIEW"|"RETURNED"|"DECLINED"){
  if(!selected||busy||!canManage||reason.trim().length<5)return;
  setBusy(true);setError("");setNotice("");
  try{
   await api(token,"partner-applications/"+encodeURIComponent(selected.applicationRef)+
    "/review","POST",{expectedVersion:selected.revision,status,reviewNote:reason.trim()});
   setNotice("Original review updated. No healthcare partner was verified.");
   setBusy(false);await load(filter,0);
  }catch(e){failure(e)}finally{setBusy(false)}
 }
 async function linkOriginal(){
  if(!selected||busy||!canManage||!source)return;
  setBusy(true);setError("");setNotice("");
  try{
   await api(token,"partner-applications/"+encodeURIComponent(selected.applicationRef)+
    "/link-original","POST",{expectedVersion:selected.revision,
     ...(selected.type==="DOCTOR"?{doctorRef:source}:{providerRef:source})});
   setNotice("Linked original CG14 record. Independent approval still required.");
   setBusy(false);await load(filter,0);
  }catch(e){failure(e)}finally{setBusy(false)}
 }
 const button=(title:string,onPress:()=>void,disabled=false)=>(
  <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}
   style={[styles.button,disabled&&{opacity:.5}]}>
   <Text style={styles.buttonText}>{title}</Text></Pressable>
 );
 return <SafeAreaView style={styles.page}>
  <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
   <Text accessibilityRole="header" style={styles.title}>Partner applications</Text>
   <Text style={styles.note}>Public healthcare partner intake.
    An application is not a license, verified provider or approved discount.</Text>
   {button("Back to healthcare providers",onExit,busy)}
   {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
   {!!notice&&<Text accessibilityLiveRegion="polite" style={styles.note}>{notice}</Text>}
   <Text style={styles.label}>Status filter</Text>
   <View style={styles.row}>{["ALL","PENDING","IN_REVIEW","RETURNED","DECLINED","LINKED"]
     .map(v=>button((filter===v?"● ":"")+nice(v),()=>{
      setFilter(v);void load(v,0);},busy))}</View>
   {button("Refresh original application list",()=>void load(filter,0),busy)}
   {busy&&<ActivityIndicator accessibilityLabel="Checking original applications"/>}
   {items.map(app=><View key={app.applicationRef} style={styles.card}>
    <Text style={styles.heading}>{app.name}</Text>
    <Text style={styles.note}>{app.reference} · {nice(app.type)} · {nice(app.status)}</Text>
    {button("Review application",()=>void open(app),busy)}
   </View>)}
   {items.length===0&&!busy&&<Text>No current applications match these filters.</Text>}
   {next!==null&&button("More applications",()=>void load(filter,next),busy)}
   {selected&&<View style={styles.card}>
    <Text accessibilityRole="header" style={styles.heading}>{selected.reference}</Text>
    <Text>{nice(selected.type)} · {nice(selected.status)}</Text>
    <Text>Contact: {selected.contactName}, {selected.phone}</Text>
    {!!selected.email&&<Text>Email: {selected.email}</Text>}
    <Text>Registration: {selected.registrationNumber??"Pending evidence review"}</Text>
    <Text>Location: {selected.address}, {selected.district},
     {selected.state} {selected.pinCode}</Text>
    {!!selected.reviewNote&&<Text>Review note: {selected.reviewNote}</Text>}
    {canManage&&!["LINKED","DECLINED"].includes(selected.status)&&<>
     <Text style={styles.label}>Review note (at least five characters)</Text>
     <TextInput accessibilityLabel="Application review note" value={reason}
      editable={!busy} multiline maxLength={500} onChangeText={setReason}
      style={styles.input}/>
     {button("Mark under review",()=>void decide("IN_REVIEW"),
      busy||reason.trim().length<5)}
     {button("Request corrections",()=>void decide("RETURNED"),
      busy||reason.trim().length<5)}
     {button("Decline application",()=>Alert.alert("Decline application?",
      "A declined application is closed. This is not a change to existing approved providers.",
      [{text:"Cancel",style:"cancel"},{text:"Decline",style:"destructive",
       onPress:()=>void decide("DECLINED")}]),
      busy||reason.trim().length<5)}
     <Text style={styles.note}>Create the matching original pending provider or
      professional and obtain verified license proof before linking.
      Linking does not approve or publish a partner.</Text>
     <Text style={styles.label}>Matching original source</Text>
     <View style={styles.row}>{options.map(o=>
      <Pressable accessibilityRole="radio" key={o.id}
       accessibilityState={{checked:source===o.id}} disabled={busy}
       style={[styles.button,source===o.id&&styles.selected]}
       onPress={()=>setSource(o.id)}><Text>{o.label}</Text></Pressable>)}</View>
     {button("Link original record",()=>void linkOriginal(),busy||!source)}
    </>}
    {button("Close details",()=>setSelected(null),busy)}
   </View>}
  </ScrollView>
 </SafeAreaView>;
}
const styles=StyleSheet.create({
 page:{flex:1,backgroundColor:t.adminCanvas},
 content:{padding:16,paddingBottom:85,gap:12},
 title:{fontSize:22,fontWeight:"700",color:t.text},
 heading:{fontSize:17,fontWeight:"700",color:t.text},
 note:{fontSize:13,lineHeight:19,color:t.mutedText},
 label:{fontSize:13,fontWeight:"600",color:t.text},
 error:{fontSize:13,color:"#A52626"},
 row:{flexDirection:"row",gap:8,flexWrap:"wrap"},
 card:{borderWidth:1,borderColor:t.border,borderRadius:12,
  backgroundColor:t.surface,padding:13,gap:10},
 button:{minHeight:44,borderWidth:1,borderColor:t.border,borderRadius:8,
  padding:12,justifyContent:"center"},
 buttonText:{color:t.text,fontSize:13,fontWeight:"600"},
 selected:{borderWidth:2,borderColor:t.primary},
 input:{minHeight:70,borderWidth:1,borderColor:t.border,
  borderRadius:8,padding:10,color:t.text}
});
