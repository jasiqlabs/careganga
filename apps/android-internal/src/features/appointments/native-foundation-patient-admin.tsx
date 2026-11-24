import {useCallback,useEffect,useRef,useState} from "react";
import {ActivityIndicator,Alert,Pressable,ScrollView,StyleSheet,
 Text,TextInput,View} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import * as Print from "expo-print";
import * as Crypto from "expo-crypto";
import {NativeFoundationDuplicateReviews} from "./native-foundation-duplicate-reviews";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";

type Booking={bookingRef:string;bookingId:string;virtualPatientId:string;
 patientName:string;patientProfileStatus:string;patientConsentGranted:boolean|null;
 doctorName:string;centerName:string;bookingStatus:string;bookingVersion:number;
 startAt:string;timeZone:string;createdAt:string;collectionStatus:string;
 consultationFeeMinor:string};
type Center={centerRef:string;centerName:string;stateRef:string;
 districtRef:string;centerType:string};
type Region={stateRef:string;stateName:string};
type District={districtRef:string;districtName:string;stateRef:string};
type Data={items:Booking[];next:string|null;metrics:{
 totalPatients:number;activePatients:number;totalBookings:number;
 todayBookings:number;completed:number;pending:number};
 centerChoices:Center[];states:Region[];districts:District[];
 centerTypes:string[];centerChoicesComplete:boolean;geographyComplete:boolean};
type Part={status:string|null;startAt:string|null;endAt:string|null;
 consultationFeeMinor:string|null;centerName:string|null;reason:string|null}|null;
type Event={action:string;revision:number;when:string;by:string;
 before:Part;after:Part};
type History={bookingId:string|null;items:Event[];next:number|null};
type Props={token:string;onExit:()=>void;onExpired:()=>void;canOverride:boolean};
type Filter={status:string;centerRef:string;stateRef:string;
 districtRef:string;centerType:string;search:string;centerSearch:string;
 fromDay:string;untilDay:string;after:string};
const empty=():Filter=>({status:"",centerRef:"",stateRef:"",districtRef:"",
 centerType:"",search:"",centerSearch:"",fromDay:"",untilDay:"",after:""});
const statuses=["CONFIRMED","ARRIVED","WAITING","IN_CONSULTATION",
 "COMPLETED","NO_SHOW","CANCELLED"];
const title=(s:string)=>s.replaceAll("_"," ").toLowerCase()
 .replace(/\b\w/g,c=>c.toUpperCase());
const money=(minor:string)=>/^\d{1,12}$/.test(minor)?
 "₹"+(Number(minor)/100).toFixed(2):"Unavailable";
const date=(s:string,zone?:string)=>{
 try{return new Intl.DateTimeFormat("en-IN",{dateStyle:"medium",timeStyle:"short",
  ...(zone?{timeZone:zone}:{})}).format(new Date(s));}
 catch{return "Date unavailable";}
};
const escapeHtml=(v:unknown)=>String(v??"").replace(/[&<>"']/g,
 c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]??c));
async function request<T>(token:string,path:string,method:"GET"|"POST"="GET",
 body?:unknown):Promise<T>{
 const r=await identityRequest("/api/v1/appointments/admin/patients"+path,{
  method,cache:"no-store",headers:{Authorization:"Bearer "+token,
   ...(body?{"Content-Type":"application/json"}:{})},
  ...(body?{body:JSON.stringify(body)}:{})});
 if(!r.ok){
  const data:unknown=await r.json().catch(()=>null);
  const msg=data&&typeof data==="object"&&"message" in data&&
   typeof data.message==="string"&&data.message.length<180?data.message:
   r.status===401?"Session expired. Sign in again.":
   r.status===403?"Your role cannot view these protected patient records.":
   "Current patient records or authorization cannot be verified.";
  throw Object.assign(new Error(msg),{status:r.status});
 }
 return r.json() as Promise<T>;
}
const button=(caption:string,action:()=>void,disabled=false)=>
 <Pressable accessibilityRole="button" disabled={disabled}
  accessibilityState={{disabled}} onPress={action}
  style={[styles.button,disabled&&styles.disabled]}>
  <Text style={styles.buttonText}>{caption}</Text>
 </Pressable>;
export function NativeFoundationPatientAdmin({token,onExit,onExpired,canOverride}:Props){
 const [filters,setFilters]=useState<Filter>(empty);
 const [searchDraft,setSearchDraft]=useState("");
 const [centerSearchDraft,setCenterSearchDraft]=useState("");
 const [fromDraft,setFromDraft]=useState("");
 const [untilDraft,setUntilDraft]=useState("");
 const [overridePassword,setOverridePassword]=useState("");
 const [overrideConfirmed,setOverrideConfirmed]=useState(false);
 const [overrideUncertain,setOverrideUncertain]=useState(false);
 const overrideKey=useRef("");
 const [result,setResult]=useState<Data|null>(null);
 const [selected,setSelected]=useState("");
 const [history,setHistory]=useState<History|null>(null);
 const [busy,setBusy]=useState(false),[historyBusy,setHistoryBusy]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const serial=useRef(0),historySerial=useRef(0);
 const fail=useCallback((err:unknown)=>{
  if(err&&typeof err==="object"&&"status" in err&&err.status===401)
   onExpired();
  setError(err instanceof Error?err.message:"Original records unavailable.");
 },[onExpired]);
 const load=useCallback(async(query:Filter)=>{
  const params=new URLSearchParams();
  for(const [key,val] of Object.entries(query))if(val)params.set(key,val);
  params.set("limit","20");
  const data=await request<Data>(token,"?"+params.toString());
  if(!data||!Array.isArray(data.items)||!Array.isArray(data.centerChoices)||
   !Array.isArray(data.states)||!Array.isArray(data.districts)||
   !Array.isArray(data.centerTypes)||!data.metrics)
   throw Error("The patient list could not be verified. Refresh and try again.");
  return data;
 },[token]);
 useEffect(()=>{
  const rev=++serial.current;setBusy(true);setError("");setHistory(null);
  void load(filters).then(data=>{
   if(serial.current!==rev)return;
   setResult(data);setOverrideUncertain(false);
   setSelected(prev=>data.items.some(x=>x.bookingRef===prev)?prev:
    data.items[0]?.bookingRef??"");
  }).catch(e=>{if(serial.current===rev){setResult(null);fail(e);}})
   .finally(()=>{if(serial.current===rev)setBusy(false);});
  return()=>{serial.current++};
 },[filters,load,fail]);
 const current=result?.items.find(x=>x.bookingRef===selected);
 useEffect(()=>{
  const rev=++historySerial.current;setHistory(null);
  if(!current)return;
  setHistoryBusy(true);
  void request<History>(token,"/"+encodeURIComponent(current.bookingRef)+"/history")
   .then(x=>{if(historySerial.current===rev&&x.bookingId===current.bookingId)
    setHistory(x);})
   .catch(e=>{if(historySerial.current===rev)fail(e)})
   .finally(()=>{if(historySerial.current===rev)setHistoryBusy(false);});
  return()=>{historySerial.current++};
 },[token,current?.bookingRef,current?.bookingId,fail]);
 const change=(partial:Partial<Filter>)=>{if(!busy&&!overrideUncertain)setFilters(f=>({...f,...partial,after:""}));};
 useEffect(()=>{setOverridePassword("");setOverrideConfirmed(false);
  setOverrideUncertain(false);overrideKey.current="";},[selected]);
 async function moreHistory(){
  if(!current||!history?.next||historyBusy)return;
  const rev=++historySerial.current;setHistoryBusy(true);
  try{
   const x=await request<History>(token,"/"+encodeURIComponent(current.bookingRef)+
    "/history?before="+history.next);
   if(historySerial.current===rev&&x.bookingId===history.bookingId)
    setHistory({...history,items:[...history.items,...x.items],next:x.next});
  }catch(e){if(historySerial.current===rev)fail(e)}
  finally{if(historySerial.current===rev)setHistoryBusy(false);}
 }
 async function cancelWithFoundationProof(){
  if(!canOverride||!current||current.bookingStatus!=="CONFIRMED"||
   new Date(current.startAt).getTime()<=Date.now()||
   !Number.isSafeInteger(current.bookingVersion)||current.bookingVersion<1||
   !overrideConfirmed||overridePassword.length<8||overrideUncertain||busy)return;
  const key=overrideKey.current||Crypto.randomUUID();overrideKey.current=key;
  setBusy(true);setError("");setNotice("");
  try{
   const response=await identityRequest(
    "/api/v1/appointments/consultations/admin/bookings/"+
      encodeURIComponent(current.bookingRef)+"/cancel-override",{
     method:"POST",cache:"no-store",
     headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},
     body:JSON.stringify({requestKey:key,expectedVersion:current.bookingVersion,
      reason:"FOUNDATION_OVERRIDE",currentPassword:overridePassword})
    }).catch(e=>{setOverrideUncertain(true);throw e;});
   const raw:unknown=await response.json().catch(()=>null);
   if(!response.ok){
    if([400,401,403,404,409,429].includes(response.status)){
     overrideKey.current="";setOverrideUncertain(false);
    }else setOverrideUncertain(true);
    if(response.status===401)onExpired();
    throw Error(raw&&typeof raw==="object"&&"message" in raw&&
     typeof raw.message==="string"?raw.message:
     "Original cancellation could not be verified. Refresh before retry.");
   }
   if(!raw||typeof raw!=="object"||!("bookingStatus" in raw)||
     raw.bookingStatus!=="CANCELLED"){
    setOverrideUncertain(true);
    throw Error("Outcome uncertain. Refresh the original appointment first.");
   }
   overrideKey.current="";setOverrideUncertain(false);
   setNotice("Protected cancellation committed. Original appointment audit updated.");
   const refreshed=await load(filters);
   setResult(refreshed);
  }catch(e){fail(e)}
  finally{setOverridePassword("");setOverrideConfirmed(false);setBusy(false)}
 }
 async function printHistory(){
  if(!current||!history||history.bookingId!==current.bookingId||
   history.next||busy||historyBusy||overrideUncertain)return;
  setBusy(true);setNotice("");
  try{
   const proof=await request<{authorized:boolean;bookingId:string;bookingVersion:number}>(
    token,"/"+encodeURIComponent(current.bookingRef)+"/print-authorization",
    "POST",{expectedVersion:current.bookingVersion,purpose:"BOOKING_HISTORY"});
   if(!proof.authorized||proof.bookingId!==current.bookingId||
      proof.bookingVersion!==current.bookingVersion)
    throw Error("Original booking print authorization did not match current revision.");
   if(selected!==current.bookingRef)
    throw Error("Selected booking changed. Reload the history before printing.");
   const rows=history.items.map(e=>"<tr><td>"+escapeHtml(date(e.when))+
    "</td><td>"+escapeHtml(e.action)+"</td><td>"+escapeHtml(e.revision)+
    "</td><td>"+escapeHtml(e.by)+"</td></tr>").join("");
   const html="<html><head><meta name='viewport' content='width=device-width'>"+
    "<style>body{font-family:Arial;padding:20px;color:#26333f}"+
    "table{border-collapse:collapse;width:100%}td,th{border:1px solid #aaa;"+
    "padding:8px;text-align:left}</style></head><body><h2>CareGanga consultation history</h2>"+
    "<p>Patient: "+escapeHtml(current.patientName)+"</p>"+
    "<p>Virtual Patient ID: "+escapeHtml(current.virtualPatientId)+"</p>"+
    "<p>Booking: "+escapeHtml(current.bookingId)+"</p>"+
    "<p>Center: "+escapeHtml(current.centerName)+"</p>"+
    "<p>Status: "+escapeHtml(current.bookingStatus)+"</p>"+
    "<table><tr><th>When</th><th>Action</th><th>Revision</th><th>Recorded by</th></tr>"+
    rows+"</table></body></html>";
   await Print.printAsync({html});
   setNotice("Printing requested for the authorized complete original booking history.");
  }catch(e){fail(e)}
  finally{setBusy(false)}
 }
 const filtersVisible=result?.centerChoices.filter(c=>
  (!filters.stateRef||c.stateRef===filters.stateRef)&&
  (!filters.districtRef||c.districtRef===filters.districtRef)&&
  (!filters.centerType||c.centerType===filters.centerType))??[];
 const option=(caption:string,value:string,selectedValue:string,fn:()=>void)=>
  button((value===selectedValue?"✓ ":"")+caption,fn,busy||overrideUncertain);
 return <SafeAreaView style={styles.page}>
  <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
   <Text accessibilityRole="header" style={styles.title}>Foundation patient management</Text>
   <Text style={styles.note}>Protected original patient and consultation records.
    Only authorized Foundation staff can view this information.</Text>
   {button("Back to dashboard",onExit)}
   {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
   {!!notice&&<Text accessibilityRole="alert" style={styles.note}>{notice}</Text>}
   {!!result&&<View style={styles.panel}>
    <Text style={styles.heading}>Foundation-wide metrics</Text>
    <Text style={styles.text}>Patients: {result.metrics.totalPatients} · Active: {result.metrics.activePatients}</Text>
    <Text style={styles.text}>Consultations: {result.metrics.totalBookings} · Today: {result.metrics.todayBookings}</Text>
    <Text style={styles.text}>Completed: {result.metrics.completed} · Pending: {result.metrics.pending}</Text>
   </View>}
   <View style={styles.panel}>
    <Text style={styles.heading}>Find protected consultations</Text>
    <TextInput accessibilityLabel="Search patient name, virtual patient ID or booking ID"
     placeholder="Name, virtual patient ID or booking" style={styles.input}
     maxLength={80} value={searchDraft} onChangeText={setSearchDraft}/>
    {button("Search",()=>{if(searchDraft.trim().length===1){setError("Use at least two characters.");return}
     change({search:searchDraft.trim()});},busy||overrideUncertain)}
    <Text style={styles.text}>Status</Text>
    <View style={styles.row}>
     {option("All","",filters.status,()=>change({status:""}))}
     {statuses.map(x=><View key={x}>{option(title(x),x,filters.status,
      ()=>change({status:x}))}</View>)}
    </View>
    <Text style={styles.text}>State</Text>
    <View style={styles.row}>
     {option("All states","",filters.stateRef,()=>change({stateRef:"",districtRef:"",centerRef:""}))}
     {result?.states.map(x=><View key={x.stateRef}>{option(x.stateName,x.stateRef,
      filters.stateRef,()=>change({stateRef:x.stateRef,districtRef:"",centerRef:""}))}</View>)}
    </View>
    <Text style={styles.text}>District</Text>
    <View style={styles.row}>
     {option("All districts","",filters.districtRef,()=>change({districtRef:"",centerRef:""}))}
     {result?.districts.filter(x=>!filters.stateRef||x.stateRef===filters.stateRef)
      .map(x=><View key={x.districtRef}>{option(x.districtName,x.districtRef,
       filters.districtRef,()=>change({districtRef:x.districtRef,centerRef:""}))}</View>)}
    </View>
    <Text style={styles.text}>Facility type</Text>
    <View style={styles.row}>
     {option("All types","",filters.centerType,()=>change({centerType:"",centerRef:""}))}
     {result?.centerTypes.map(x=><View key={x}>{option(title(x),x,filters.centerType,
      ()=>change({centerType:x,centerRef:""}))}</View>)}
    </View>
    <TextInput accessibilityLabel="Search healthcare centers" style={styles.input}
     placeholder="Healthcare center name" maxLength={60}
     value={centerSearchDraft} onChangeText={setCenterSearchDraft}/>
    {button("Filter centers",()=>change({centerSearch:centerSearchDraft.trim(),centerRef:""}),busy||overrideUncertain)}
    <Text style={styles.text}>Healthcare center</Text>
    <View style={styles.row}>
     {option("All centers","",filters.centerRef,()=>change({centerRef:""}))}
     {filtersVisible.map(x=><View key={x.centerRef}>{option(x.centerName,x.centerRef,
      filters.centerRef,()=>change({centerRef:x.centerRef}))}</View>)}
    </View>
    {!result?.centerChoicesComplete&&result&&<Text style={styles.note}>
     More centers exist. Narrow the center or location filters.</Text>}
    <Text style={styles.text}>Date from / through (YYYY-MM-DD)</Text>
    <TextInput accessibilityLabel="First consultation date" style={styles.input}
     placeholder="YYYY-MM-DD" maxLength={10} value={fromDraft}
     onChangeText={setFromDraft}/>
    <TextInput accessibilityLabel="Last consultation date" style={styles.input}
     placeholder="YYYY-MM-DD" maxLength={10} value={untilDraft}
     onChangeText={setUntilDraft}/>
    {button("Apply date range",()=>{
     const valid=(v:string)=>!v||(/^\d{4}-\d{2}-\d{2}$/.test(v)&&
      Number.isFinite(Date.parse(v+"T00:00:00Z"))&&
      new Date(v+"T00:00:00Z").toISOString().slice(0,10)===v);
     if(!valid(fromDraft)||!valid(untilDraft)||
      !!(fromDraft&&untilDraft&&fromDraft>untilDraft)){
      setError("Choose a valid date range (YYYY-MM-DD).");return;
     }
     setError("");change({fromDay:fromDraft,untilDay:untilDraft});
    },busy)}
    {button("Reset all filters",()=>{setFilters(empty());setSearchDraft("");
     setCenterSearchDraft("");setFromDraft("");setUntilDraft("");},busy||overrideUncertain)}
   </View>
   {busy&&<ActivityIndicator accessibilityLabel="Loading protected patient consultations"/>}
   <Text style={styles.heading}>Consultation records</Text>
   {!busy&&result?.items.length===0&&<Text style={styles.note}>No matching consultations.</Text>}
   {result?.items.map(x=><View key={x.bookingRef}>
    {button((selected===x.bookingRef?"✓ ":"")+x.bookingId+" · "+title(x.bookingStatus)+
     "\n"+x.patientName+" · "+x.centerName+"\n"+date(x.startAt,x.timeZone),
     ()=>{setSelected(x.bookingRef);setError("");},busy||overrideUncertain)}
   </View>)}
   {!!result?.next&&button("Next 20 consultations",()=>setFilters(f=>({...f,
    after:result.next??""})),busy||overrideUncertain)}
   {!!filters.after&&button("First page",()=>setFilters(f=>({...f,after:""})),busy||overrideUncertain)}
   {current&&<View style={styles.panel}>
    <Text style={styles.heading}>Selected patient and booking</Text>
    <Text style={styles.text}>Patient: {current.patientName}</Text>
    <Text style={styles.text}>Virtual Patient ID: {current.virtualPatientId}</Text>
    <Text style={styles.text}>Profile: {title(current.patientProfileStatus)}</Text>
    <Text style={styles.text}>Consent: {current.patientConsentGranted===true?
     "Granted":current.patientConsentGranted===false?"Not granted":"Not verified"}</Text>
    <Text style={styles.text}>Doctor: {current.doctorName}</Text>
    <Text style={styles.text}>Center: {current.centerName}</Text>
    <Text style={styles.text}>Booked for: {date(current.startAt,current.timeZone)}</Text>
    <Text style={styles.text}>Status: {title(current.bookingStatus)}</Text>
    <Text style={styles.text}>Patient collection: {title(current.collectionStatus)}</Text>
    <Text style={styles.text}>Original fee: {money(current.consultationFeeMinor)}</Text>
    <Text style={styles.heading}>Original audit history</Text>
    {historyBusy&&<ActivityIndicator accessibilityLabel="Loading original booking history"/>}
    {!historyBusy&&history?.items.length===0&&<Text style={styles.note}>No audit events found.</Text>}
    {history?.bookingId===current.bookingId&&history.items.map((e,i)=>
     <View key={String(e.revision)+"-"+i} style={styles.history}>
      <Text style={styles.text}>{title(e.action)} · Revision {e.revision}</Text>
      <Text style={styles.note}>{date(e.when)} · {e.by}</Text>
      {e.after?.status&&<Text style={styles.note}>Result: {title(e.after.status)}</Text>}
     </View>)}
    {history?.next&&button("More original audit events",()=>void moreHistory(),historyBusy)}
    {canOverride&&current.bookingStatus==="CONFIRMED"&&
     new Date(current.startAt).getTime()>Date.now()&&<View style={styles.history}>
      <Text style={styles.heading}>Restricted Foundation cancellation</Text>
      <Text style={styles.note}>Only an authorized Foundation administrator can
       cancel a future confirmed appointment using current password proof.</Text>
      {button((overrideConfirmed?"✓ ":"")+
       "Confirm exceptional cancellation purpose",()=>setOverrideConfirmed(v=>!v),
       busy||overrideUncertain)}
      <TextInput accessibilityLabel="Current Foundation password for cancellation"
       style={styles.input} secureTextEntry value={overridePassword}
       onChangeText={setOverridePassword} editable={!busy&&!overrideUncertain}
       placeholder="Current Foundation password"/>
      {overrideUncertain&&<Text style={styles.error}>Outcome uncertain.
       Refresh the original appointment before another request.</Text>}
      {button("Cancel future appointment with protected proof",()=>Alert.alert(
       "Cancel this confirmed appointment?","This creates an original audit event.",[
        {text:"Keep appointment",style:"cancel"},
        {text:"Confirm cancellation",style:"destructive",
         onPress:()=>void cancelWithFoundationProof()}
       ]),busy||overrideUncertain||!overrideConfirmed||overridePassword.length<8)}
     </View>}
    {button("Print authorized complete booking history",()=>Alert.alert(
     "Print protected patient history?",
     "A printed or saved copy cannot be revoked. Print only for an authorized purpose.",[
      {text:"Cancel",style:"cancel"},
      {text:"Print",onPress:()=>void printHistory()}
     ]),busy||overrideUncertain||historyBusy||!history||!!history.next)}
   </View>}
   <NativeFoundationDuplicateReviews token={token} onExpired={onExpired}/>
   {button(overrideUncertain?"Recheck original cancellation":"Refresh current records",()=>setFilters(f=>({...f})),busy)}
  </ScrollView>
 </SafeAreaView>;
}
const styles=StyleSheet.create({
 page:{flex:1,backgroundColor:t.adminCanvas},
 content:{padding:16,paddingBottom:96,gap:12},
 title:{fontSize:21,fontWeight:"700",color:t.text},
 heading:{fontSize:17,fontWeight:"700",color:t.text,marginVertical:5},
 text:{fontSize:13,color:t.text,lineHeight:19},
 note:{fontSize:12,color:t.mutedText,lineHeight:18},
 error:{fontSize:13,color:t.error},
 input:{borderWidth:1,borderColor:t.border,backgroundColor:t.surface,
  color:t.text,padding:10,borderRadius:9,minHeight:45},
 panel:{backgroundColor:t.surface,padding:12,gap:8,borderWidth:1,
  borderColor:t.border,borderRadius:12},
 row:{flexDirection:"row",flexWrap:"wrap",gap:6},
 button:{borderWidth:1,borderColor:t.border,padding:10,borderRadius:9,
  backgroundColor:t.surface,minHeight:44,justifyContent:"center"},
 buttonText:{fontSize:13,color:t.text,fontWeight:"600"},
 history:{paddingVertical:6,borderBottomWidth:1,borderColor:t.border},
 disabled:{opacity:.45}
});
