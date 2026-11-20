import {useCallback,useEffect,useRef,useState} from "react";
import {ActivityIndicator,Alert,Pressable,ScrollView,StyleSheet,Text,View}
 from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";
import {NativeFoundationJournalPanel} from "./native-foundation-journal-panel";
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
type Center={centerRef:string;name:string};
type Appointment={appointmentRef:string;bookingLabel:string;centerName:string;
 doctorName:string;completedAt:string;approvedSupportMinor:string;state:string};
type Status={state:string;liabilityRef?:string;amountMinor?:string;postingState?:string;
 foundationJournalPosted:boolean;providerSettled:boolean};
type Options={appointments:Appointment[];complete:boolean};
type Props={token:string;canManage:boolean;canPost:boolean;onExit:()=>void;onExpired:()=>void};
const money=(v:string)=>"₹"+(Number(v)/100).toFixed(2);
const path="api/v1/healthcare-assistance/foundation-liabilities/";
async function api(token:string,tail:string,body?:{requestKey:string}){
 const response=await identityRequest("/"+path+tail,{
  method:body?"POST":"GET",cache:"no-store",
  headers:{Authorization:"Bearer "+token,
   ...(body?{"Content-Type":"application/json"}:{})},
  body:body?JSON.stringify(body):undefined});
 if(!response.ok)throw Object.assign(new Error(
  response.status===401?"Sign in again to view Foundation healthcare obligations.":
  response.status===403?"Your role cannot access this Foundation obligation.":
  response.status===404?"Verified center or completed consultation unavailable.":
  response.status===409?"Original completion or support changed. Refresh its source.":
  "Foundation obligation outcome is uncertain. Check the original service."),
  {status:response.status});
 return response.json() as Promise<unknown>;
}
function statusValid(v:unknown):v is Status{
 if(!v||typeof v!=="object"||Array.isArray(v))return false;
 const x=v as Partial<Status>;
 return typeof x.state==="string"&&
  typeof x.foundationJournalPosted==="boolean"&&
  typeof x.providerSettled==="boolean";
}
/** Existing source-authorized Foundation staff only: no patient payment
 * collection, fabricated posted journal, bank transfer or duplicate visits.
 */
export function NativeCompletedConsultationLiabilities({token,canManage,canPost,
 onExit,onExpired}:Props){
 const [centers,setCenters]=useState<Center[]>([]),[center,setCenter]=useState("");
 const [options,setOptions]=useState<Appointment[]>([]);
 const [selected,setSelected]=useState<Appointment|null>(null);
 const [status,setStatus]=useState<Status|null>(null);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [complete,setComplete]=useState(true),[uncertain,setUncertain]=useState(false);
 const [message,setMessage]=useState("");
 const serial=useRef(0);
 const report=useCallback((error:unknown)=>{
  if(error&&typeof error==="object"&&"status" in error&&error.status===401)
   onExpired();
  setMessage(error instanceof Error?error.message:"Original Foundation source unavailable.");
 },[onExpired]);
 const list=useCallback(async(c:string):Promise<Options>=>{
  if(!ID.test(c))throw Error("Select an existing verified healthcare center.");
  const v=await api(token,"centers/"+c+"/completed-options");
  if(!v||typeof v!=="object"||Array.isArray(v)||
    !("appointments" in v)||!Array.isArray(v.appointments)||
    v.appointments.length>50||!("complete" in v)||
    typeof v.complete!=="boolean")
   throw Error("Original completed consultation list cannot be verified.");
  return v as Options;
 },[token]);
 const refresh=useCallback(async(c:string,booking:string):Promise<Status>=>{
  if(!ID.test(c)||!ID.test(booking))
   throw Error("Choose a completed original appointment.");
  const v=await api(token,"centers/"+c+"/appointments/"+booking);
  if(!statusValid(v))throw Error("Foundation obligation status is incomplete.");
  return v;
 },[token]);
 useEffect(()=>{
  let live=true;setLoading(true);setMessage("");
  void api(token,"centers/eligible").then(raw=>{
   if(!live)return;
   if(!raw||typeof raw!=="object"||Array.isArray(raw)||
     !("centers" in raw)||!Array.isArray(raw.centers)||raw.centers.length>50)
    throw Error("Verified healthcare center list is unavailable.");
   const source=raw.centers.filter((c:unknown):c is Center=>!!c&&
    typeof c==="object"&&"centerRef" in c&&typeof c.centerRef==="string"&&
    ID.test(c.centerRef)&&"name" in c&&typeof c.name==="string");
   setCenters(source);if(source.length===1)setCenter(source[0].centerRef);
  }).catch(e=>{if(live)report(e)})
   .finally(()=>{if(live)setLoading(false)});
  return()=>{live=false;};
 },[token,report]);
 useEffect(()=>{
  const revision=++serial.current;
  setOptions([]);setSelected(null);setStatus(null);
  setMessage("");setUncertain(false);
  if(!center)return;
  setLoading(true);
  void list(center).then(v=>{
   if(serial.current!==revision)return;
   setOptions(v.appointments.filter(x=>ID.test(x.appointmentRef)&&
    typeof x.bookingLabel==="string"&&typeof x.doctorName==="string"));
   setComplete(v.complete);
  }).catch(e=>{if(serial.current===revision)report(e)})
   .finally(()=>{if(serial.current===revision)setLoading(false)});
  return()=>{serial.current++;};
 },[center,list,report]);
 const open=async(x:Appointment)=>{
  if(busy||loading)return;
  setSelected(x);setStatus(null);setMessage("");setUncertain(false);
  setBusy(true);
  try{setStatus(await refresh(center,x.appointmentRef))}
  catch(e){report(e)}finally{setBusy(false);}
 };
 const check=async()=>{
  if(!selected||busy)return;
  setBusy(true);setMessage("");
  try{
   setStatus(await refresh(center,selected.appointmentRef));
   const original=await list(center);
   setOptions(original.appointments);setComplete(original.complete);
   setUncertain(false);
  }catch(e){report(e)}finally{setBusy(false)}
 };
 const save=async()=>{
  if(!canManage||busy||uncertain||!selected||
    status?.state!=="NOT_RECOGNIZED"||
    selected.state!=="READY_TO_RECOGNIZE")return;
  setBusy(true);setMessage("");
  try{
   const result=await api(token,"centers/"+center+
    "/appointments/"+selected.appointmentRef+"/recognize",{
    requestKey:selected.appointmentRef});
   if(!statusValid(result)||result.state!=="APPROVED_LIABILITY"||
    result.foundationJournalPosted)
    throw Error("Original liability state could not be confirmed.");
   setStatus(result);setUncertain(false);
   const current=await list(center);
   setOptions(current.appointments);setComplete(current.complete);
   setMessage("Source-approved Foundation obligation recorded. "+
    "CG09 journal and provider payment are still pending.");
  }catch(e){
   const code=e&&typeof e==="object"&&"status" in e&&
    typeof e.status==="number"?e.status:503;
   setUncertain(code>=500);report(e);
  }finally{setBusy(false);}
 };
 const btn=(title:string,press:()=>void,disabled=false)=>
  <Pressable accessibilityRole="button" accessibilityState={{disabled}}
   disabled={disabled} onPress={press}
   style={[styles.button,disabled&&styles.disabled]}>
   <Text style={styles.buttonText}>{title}</Text>
  </Pressable>;
 return <SafeAreaView edges={["left","right"]} style={styles.page}>
  <ScrollView contentContainerStyle={styles.content}>
   {btn("Back to Foundation home",onExit,busy)}
   <Text accessibilityRole="header" style={styles.title}>
    Foundation Healthcare Obligations</Text>
   <Text style={styles.note}>The Foundation share is recognized only after
    an original clinician-completed consultation and approved patient
    contribution. Money collected at the center is not Foundation revenue.</Text>
   {loading&&<ActivityIndicator accessibilityLabel="Checking completed services"/>}
   {!!message&&<Text accessibilityRole="alert" style={styles.note}>{message}</Text>}
   <Text style={styles.heading}>Verified healthcare center</Text>
   <View style={styles.options}>{centers.map(c=><View key={c.centerRef}>
    {btn(c.name,()=>setCenter(c.centerRef),busy||loading||uncertain)}
   </View>)}</View>
   {center&&!loading&&options.length===0&&
    <Text style={styles.note}>No approved support from a completed
     consultation is ready for recognition at this center.</Text>}
   {center&&!complete&&
    <Text style={styles.note}>Only the first 50 original completed
     consultations are displayed. No older liabilities are assumed.</Text>}
   {options.map(x=><View style={styles.card} key={x.appointmentRef}>
    <Text style={styles.heading}>{x.bookingLabel}</Text>
    <Text style={styles.note}>Doctor: {x.doctorName}</Text>
    <Text style={styles.note}>Completed: {
     new Date(x.completedAt).toLocaleDateString("en-IN")}</Text>
    <Text style={styles.amount}>Approved Foundation share: {
     money(x.approvedSupportMinor)}</Text>
    <Text style={styles.note}>{
     x.state==="APPROVED_LIABILITY"?"Already recognized":
     "Awaiting approved obligation"}</Text>
    {btn("Review original service",()=>void open(x),busy||loading)}
   </View>)}
   {selected&&<View style={styles.card}>
    <Text style={styles.heading}>Original service: {selected.bookingLabel}</Text>
    <Text style={styles.amount}>Approved Foundation share: {
     money(selected.approvedSupportMinor)}</Text>
    {status&&<Text style={styles.note}>Liability: {status.state.replaceAll("_"," ")}.
     CG09 posting: {status.foundationJournalPosted?"Posted":"Not confirmed"}.
     Provider settlement: {status.providerSettled?"Settled":"Not settled"}.</Text>}
    {canManage&&status?.state==="NOT_RECOGNIZED"&&
     selected.state==="READY_TO_RECOGNIZE"&&!uncertain&&
     btn("Recognize approved Foundation liability",()=>
      Alert.alert("Recognize genuine completed service?",
       "This records the approved Foundation share only. "+
       "It does not collect patient money or pay the healthcare center.",[
        {text:"Cancel",style:"cancel"},
        {text:"Recognize",onPress:()=>void save()}]),busy)}
    {canPost&&status?.state==="APPROVED_LIABILITY"&&
     status.foundationJournalPosted!==true&&status.liabilityRef&&
     ID.test(status.liabilityRef)&&
     <NativeFoundationJournalPanel key={status.liabilityRef}
      token={token} centerRef={center} liabilityRef={status.liabilityRef}
      onPosted={check} onExpired={onExpired}/>}
    {btn("Check original obligation state",()=>void check(),busy)}
    {uncertain&&<Text accessibilityRole="alert" style={styles.note}>
     Outcome uncertain. Check this original appointment before retrying;
     do not create a second obligation.</Text>}
   </View>}
  </ScrollView>
 </SafeAreaView>;
}
const styles=StyleSheet.create({
 page:{flex:1,backgroundColor:t.background},
 content:{padding:16,gap:12,paddingBottom:36},
 title:{fontSize:22,fontWeight:"700",color:t.text},
 heading:{fontSize:15,fontWeight:"700",color:t.text},
 note:{fontSize:13,lineHeight:20,color:t.mutedText},
 amount:{fontSize:14,fontWeight:"600",color:t.text},
 options:{flexDirection:"row",flexWrap:"wrap",gap:8},
 card:{backgroundColor:t.surface,borderWidth:1,borderColor:t.border,
  padding:12,borderRadius:12,gap:8},
 button:{minHeight:48,justifyContent:"center",padding:10,
  borderWidth:1,borderColor:t.border,borderRadius:10},
 buttonText:{fontSize:13,color:t.text,fontWeight:"600"},
 disabled:{opacity:0.45}
});
