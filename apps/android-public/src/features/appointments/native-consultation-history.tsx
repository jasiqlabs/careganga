import {useCallback,useEffect,useRef,useState} from "react";
import {Alert,BackHandler,Platform,Pressable,StyleSheet,Text,View} from "react-native";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import {careGangaTheme as theme} from "../../../../../packages/design-tokens/src/index";
import {PublicHealthcareDirectory} from "../health-network/public-healthcare-directory";
import {NativeAppointmentDocuments} from "./native-appointment-documents";
import {NativeConsultationContribution} from "./native-consultation-contribution";
const base=process.env.EXPO_PUBLIC_API_URL;
const KEY="cg_public_patient_only_session";
type Booking={bookingRef:string;bookingId:string;doctorRef:string;doctorName:string;
 centerRef:string;centerName:string;centerAddress?:string;startAt:string;endAt:string;timeZone:string;
 consultationFeeMinor:string;bookingStatus:string;canPatientChange:boolean;paymentMode:string;
 collectionStatus:string;version:number};
async function api<T>(path:string,method="GET",body?:Record<string,unknown>):Promise<T>{
 if(!base||!/^https?:\/\//.test(base)||
  (process.env.NODE_ENV==="production"&&!base.startsWith("https://")))
  throw Error("Private patient bookings are unavailable.");
 const token=await SecureStore.getItemAsync(KEY);
 if(!token)throw Error("Sign in to your CareGanga patient account to view bookings.");
 const r=await fetch(new URL("/api/v1/appointments/consultations/"+path,base),{
  method,cache:"no-store",signal:AbortSignal.timeout(11000),
  headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},
  body:body?JSON.stringify(body):undefined});
 const raw:unknown=await r.json().catch(()=>null);
 if(!r.ok)throw Error(raw&&typeof raw==="object"&&"message" in raw&&
  typeof raw.message==="string"?raw.message:
  "The appointment result is uncertain. Refresh before retrying.");
 return raw as T;
}
export function NativeConsultationHistory(){
 const [items,setItems]=useState<Booking[]>([]);
 const [statusFilter,setStatusFilter]=useState("");
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [nextCursor,setNextCursor]=useState<string|null>(null);
 const [moreBusy,setMoreBusy]=useState(false);
 const [uncertain,setUncertain]=useState(false),[error,setError]=useState("");
 const [reschedule,setReschedule]=useState<Booking|null>(null);
 const [selectedRef,setSelectedRef]=useState<string|null>(null);
 const [detail,setDetail]=useState<Booking|null>(null);
 const [detailBusy,setDetailBusy]=useState(false);
 const [detailError,setDetailError]=useState("");
 const detailSeq=useRef(0);
 const keys=useRef<Map<string,string>>(new Map());
 const refresh=useCallback(async()=>{
  const result=await api<{items:Booking[];next:string|null}>(
   "me?limit=20"+(statusFilter?"&status="+encodeURIComponent(statusFilter):""));
  setItems(result.items);setNextCursor(result.next);setUncertain(false);
 },[statusFilter]);
 useEffect(()=>{
  let alive=true;
  setLoading(true);setItems([]);setNextCursor(null);
  void refresh().catch(e=>{if(alive)setError(e instanceof Error?e.message:
   "Current patient appointments cannot be confirmed.");})
   .finally(()=>{if(alive)setLoading(false);});
  return()=>{alive=false;};
 },[refresh]);
 useEffect(()=>{
  if(Platform.OS!=="android"||(!reschedule&&!selectedRef))return;
  const sub=BackHandler.addEventListener("hardwareBackPress",()=>{
   if(reschedule){setReschedule(null);void refresh();return true;}
   detailSeq.current++;setSelectedRef(null);setDetail(null);
   setDetailError("");return true;
  });
  return()=>sub.remove();
 },[reschedule,selectedRef,refresh]);
 async function toggleDetail(book:Booking){
  if(selectedRef===book.bookingRef){
   detailSeq.current++;setSelectedRef(null);setDetail(null);
   setDetailError("");return;
  }
  const seq=++detailSeq.current;
  setSelectedRef(book.bookingRef);setDetail(null);setDetailError("");
  setDetailBusy(true);
  try{
   const current=await api<Booking>("me/"+encodeURIComponent(book.bookingRef));
   if(seq!==detailSeq.current)return;
   if(current.bookingRef!==book.bookingRef)
    throw Error("The exact original appointment could not be verified.");
   setDetail(current);
  }catch(e){if(seq===detailSeq.current)setDetailError(e instanceof Error?
   e.message:"The appointment details could not be verified.");}
  finally{if(seq===detailSeq.current)setDetailBusy(false);}
 }
 async function more(){
  if(busy||moreBusy||!nextCursor)return;
  setMoreBusy(true);setError("");
  try{
   const page=await api<{items:Booking[];next:string|null}>(
    "me?limit=20&after="+encodeURIComponent(nextCursor)+
    (statusFilter?"&status="+encodeURIComponent(statusFilter):""));
   setItems(current=>{
    const known=new Set(current.map(x=>x.bookingRef));
    return [...current,...page.items.filter(x=>!known.has(x.bookingRef))];
   });
   setNextCursor(page.next);
  }catch(e){setError(e instanceof Error?e.message:"Older consultations are unavailable.");}
  finally{setMoreBusy(false);}
 }
 async function cancel(book:Booking){
  if(busy||uncertain)return;
  const reference=book.bookingRef+":"+book.version+":cancel";
  if(!keys.current.has(reference))keys.current.set(reference,Crypto.randomUUID());
  setBusy(true);setError("");
  try{
   await api("me/"+book.bookingRef+"/cancel","POST",{
    requestKey:keys.current.get(reference),
    expectedVersion:book.version,reason:"PATIENT_REQUEST"
   });
   keys.current.delete(reference);await refresh();
   setError("Appointment cancelled. No CareGanga payment is recorded.");
  }catch(e){
   setUncertain(true);setError((e instanceof Error?e.message:
    "The cancellation status is uncertain.")+" Check original booking before retrying.");
  }finally{setBusy(false);}
 }
 function confirmation(book:Booking){
  Alert.alert("Cancel appointment?",
   "Your time will be released; payment was due at the center.",[
    {text:"Keep appointment",style:"cancel"},
    {text:"Cancel appointment",style:"destructive",onPress:()=>void cancel(book)}
   ]);
 }
 const button=(text:string,action:()=>void,disabled=false)=>
  <Pressable accessibilityRole="button" disabled={disabled} onPress={action}
   style={[styles.button,disabled&&styles.disabled]}>
   <Text style={styles.buttonText}>{text}</Text></Pressable>;
 if(reschedule)return <View style={styles.page}>
  {button("Back to my appointments",()=>{setReschedule(null);setSelectedRef(null);
   setDetail(null);void refresh();})}
  <Text style={styles.heading}>Choose a new consultation</Text>
  <PublicHealthcareDirectory onExit={()=>{setReschedule(null);
   setSelectedRef(null);setDetail(null);void refresh();}}
   reschedule={{bookingRef:reschedule.bookingRef,expectedVersion:reschedule.version}}/>
 </View>;
 return <View style={styles.page}>
  <Text accessibilityRole="header" style={styles.heading}>My Consultations</Text>
  <Text style={styles.note}>Only appointments linked to this signed-in patient are shown.
   Pay at the healthcare center; no online payment is recorded here.</Text>
  <Text style={styles.note}>Filter appointments by current status</Text>
  <View style={styles.filters} accessibilityLabel="Patient appointment status filters">
   {([
    ["","All"],["CONFIRMED","Confirmed"],["ARRIVED","Checked in"],
    ["WAITING","Waiting"],["IN_CONSULTATION","In consultation"],
    ["COMPLETED","Completed"],["NO_SHOW","Not attended"],
    ["CANCELLED","Cancelled"]
   ] as const).map(([value,label])=>
    <Pressable key={value} accessibilityRole="button"
     accessibilityLabel={"Show "+label+" appointments"}
     accessibilityState={{selected:statusFilter===value,disabled:busy||uncertain}}
     disabled={busy||uncertain} onPress={()=>{if(value!==statusFilter)setStatusFilter(value);}}
     style={[styles.filterChip,statusFilter===value&&styles.filterSelected]}>
     <Text style={styles.filterText}>{label}</Text>
    </Pressable>)}
  </View>
  {loading&&<Text>Checking current appointments…</Text>}
  {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
  {button("Refresh my consultations",()=>{
   setLoading(true);void refresh().catch(e=>setError(String(e)))
    .finally(()=>setLoading(false));
  },busy)}
  {!loading&&items.length===0&&<Text>No appointments match the selected status.</Text>}
  {items.map(x=><View key={x.bookingRef} style={styles.card}>
   <Text style={styles.heading}>Booking: {x.bookingId}</Text>
   <Text>{x.doctorName} · {x.centerName}</Text>
   <Text>{new Date(x.startAt).toLocaleString("en-IN",{
    timeZone:x.timeZone,dateStyle:"medium",timeStyle:"short"})}</Text>
   <Text>Status: {x.bookingStatus.replaceAll("_"," ")}</Text>
   <Text>Consultation: ₹{(Number(x.consultationFeeMinor)/100).toFixed(2)}</Text>
   <Text>Payment: {x.collectionStatus.replaceAll("_"," ")}</Text>
   {button(selectedRef===x.bookingRef?"Close appointment details":
    "View appointment details",()=>void toggleDetail(x),busy||uncertain)}
   {selectedRef===x.bookingRef&&<>
    {detailBusy&&<Text>Checking the current private appointment…</Text>}
    {!!detailError&&<Text accessibilityRole="alert" style={styles.error}>{detailError}</Text>}
    {detail?.bookingRef===x.bookingRef&&<View style={styles.details}
     accessibilityLabel="Verified private appointment details">
     <Text style={styles.heading}>Current booking: {detail.bookingId}</Text>
     <Text>Doctor: {detail.doctorName}</Text>
     <Text>Healthcare center: {detail.centerName}</Text>
     {!!detail.centerAddress&&<Text>{detail.centerAddress}</Text>}
     <Text>{new Date(detail.startAt).toLocaleString("en-IN",{
      timeZone:detail.timeZone,dateStyle:"full",timeStyle:"short"})}
      {" ("+detail.timeZone+")"}</Text>
     <Text>Status: {detail.bookingStatus.replaceAll("_"," ")}</Text>
     <Text>Full consultation: ₹{(Number(detail.consultationFeeMinor)/100).toFixed(2)}</Text>
     <Text>Payment: {detail.collectionStatus.replaceAll("_"," ")}
      {" · "+detail.paymentMode.replaceAll("_"," ")}</Text>
     <Text>CareGanga has not verified a payment or issued a receipt for
      this pay-at-center consultation.</Text>
     <NativeConsultationContribution bookingRef={detail.bookingRef}/>
     <NativeAppointmentDocuments bookingRef={detail.bookingRef}
      bookingStatus={detail.bookingStatus}/>
     {detail.canPatientChange===true&&<View style={styles.actions}>
      {button("Reschedule this appointment",()=>setReschedule(detail),busy||uncertain)}
      {button("Cancel this appointment",()=>confirmation(detail),busy||uncertain)}
     </View>}
    </View>}
   </>}
  </View>)}
  {nextCursor&&button(moreBusy?"Loading older consultations…":"Load older consultations",
   ()=>void more(),busy||moreBusy)}
  {uncertain&&<Text style={styles.note}>
   The original write may have completed. Refresh the source before another action.
  </Text>}
 </View>;
}
const styles=StyleSheet.create({
 page:{gap:12,paddingVertical:14},
 heading:{fontSize:16,fontWeight:"700",color:theme.text},
 note:{fontSize:13,color:theme.mutedText},
 error:{color:theme.error,fontSize:13},
 card:{padding:14,borderWidth:1,borderRadius:12,borderColor:theme.border,
  backgroundColor:theme.surface,gap:7},
 details:{gap:10,padding:12,borderWidth:1,borderRadius:10,
  borderColor:theme.border,backgroundColor:theme.background},
 filters:{flexDirection:"row",flexWrap:"wrap",gap:8},
 filterChip:{paddingHorizontal:12,paddingVertical:9,borderRadius:9,
  borderWidth:1,borderColor:theme.border,backgroundColor:theme.surface},
 filterSelected:{borderColor:theme.primary,borderWidth:2},
 filterText:{fontSize:13,color:theme.text},
 actions:{flexDirection:"row",gap:12,flexWrap:"wrap"},
 button:{minHeight:46,padding:11,borderRadius:9,backgroundColor:theme.primary,
  justifyContent:"center",alignItems:"center"},
 disabled:{opacity:0.4},
 buttonText:{fontSize:13,fontWeight:"700",color:theme.primaryText}
});
