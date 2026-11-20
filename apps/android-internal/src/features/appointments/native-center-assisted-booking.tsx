import {useCallback,useEffect,useRef,useState} from "react";
import {ActivityIndicator,BackHandler,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import * as Crypto from "expo-crypto";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";
import {NativeConsultationContribution} from "../healthcare-assistance/native-consultation-contribution";

type Props={token:string;onExit:()=>void;onExpired:()=>void;
 canViewCharge:boolean;canAcceptCharge:boolean};
type Center={centerRef:string;centerName:string;providerName:string;timeZone:string};
type Doctor={doctorRef:string;doctorName:string};
type Slot={startAt:string;endAt:string;startLocal:string;endLocal:string;bookable:boolean};
type Daily={status:string;doctorName:string;centerName:string;consultationFeeMinor:string|null;
 consultationFeeVersion:number|null;timeZone:string;slots:Slot[]};
type Hold={holdRef:string;status:string;expiresAt:string;consultationFeeMinor:string;feeVersion:number};
type Booking={bookingRef:string;bookingId:string;bookingStatus:string;collectionStatus:string;
 consultationFeeMinor:string};
type Attempt={signature:string;key:string;body:Record<string,unknown>};
const VIRTUAL=/^CGP-[A-F0-9]{16}$/;
const CODE=/^CGB-[A-F0-9]{24}$/;
const TODAY=(offset:number,zone:string)=>{
 try{
  const parts=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{
   timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit"
  }).formatToParts(new Date()).map(x=>[x.type,x.value]));
  return new Date(Date.UTC(Number(parts.year),Number(parts.month)-1,
   Number(parts.day)+offset)).toISOString().slice(0,10);
 }catch{return "";}
};
async function api<T>(token:string,path:string,method="GET",data?:Record<string,unknown>):Promise<T>{
 const r=await identityRequest("/api/v1/appointments/consultations/staff/"+path,{
  method,cache:"no-store",
  headers:{Authorization:"Bearer "+token,
   ...(data?{"Content-Type":"application/json"}:{})},
  body:data?JSON.stringify(data):undefined
 });
 if(!r.ok){
  const body:unknown=await r.json().catch(()=>null);
  const message=body&&typeof body==="object"&&"message" in body&&
   typeof body.message==="string"&&body.message.length<=220?body.message:
   r.status===401?"Your session expired. Sign in again.":
   r.status===403?"This healthcare center is not assigned to your account.":
   r.status===409?"The patient authorization or time changed. Check the original request.":
   "The consultation request cannot be confirmed.";
  throw Object.assign(new Error(message),{status:r.status});
 }
 return await r.json() as T;
}
const money=(minor:string)=>"₹"+(Number(minor)/100).toFixed(2);
/** Staff-mobile counterpart of CG15 Web center-assisted booking.
 * No independent booking master; same original center-scoped staff API,
 * person-specific one-time proof, global doctor hold, and private actor.
 */
export function NativeCenterAssistedBooking({token,onExit,onExpired,
 canViewCharge,canAcceptCharge}:Props){
 const [centers,setCenters]=useState<Center[]>([]),[center,setCenter]=useState("");
 const [doctors,setDoctors]=useState<Doctor[]>([]),[doctor,setDoctor]=useState("");
 const [offset,setOffset]=useState(0),[day,setDay]=useState<Daily|null>(null);
 const [patientId,setPatientId]=useState(""),[code,setCode]=useState("");
 const [hold,setHold]=useState<Hold|null>(null),[booking,setBooking]=useState<Booking|null>(null);
 const [chosenSlot,setChosenSlot]=useState<Slot|null>(null);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [uncertain,setUncertain]=useState(false),[message,setMessage]=useState("");
 const [phase,setPhase]=useState<"HOLD"|"CONFIRM"|null>(null);
 const holdAttempt=useRef<Attempt|null>(null),confirmAttempt=useRef<Attempt|null>(null);
 const slipKey=useRef<string|null>(null);
 const serial=useRef(0);
 const expired=useCallback((e:unknown)=>{
  if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
  setMessage(e instanceof Error?e.message:"This center booking cannot be confirmed.");
 },[onExpired]);
 const button=(label:string,run:()=>void,disabled=false)=>(
  <Pressable accessibilityRole="button" onPress={run} disabled={disabled}
   accessibilityState={{disabled}} style={[styles.button,disabled&&styles.disabled]}>
   <Text style={styles.buttonText}>{label}</Text>
  </Pressable>);
 const clear=()=>{
  setPatientId("");setCode("");setHold(null);setBooking(null);setChosenSlot(null);
  setUncertain(false);setPhase(null);setMessage("");
  holdAttempt.current=null;confirmAttempt.current=null;slipKey.current=null;
 };
 useEffect(()=>{
  const sub=BackHandler.addEventListener("hardwareBackPress",()=>{
   onExit();return true;
  });return()=>sub.remove();
 },[onExit]);
 useEffect(()=>{
  let active=true;
  void identityRequest("/api/v1/appointments/patients/my-centers/intake-options",{
   headers:{Authorization:"Bearer "+token},cache:"no-store"
  }).then(async response=>{
   if(!response.ok)throw Object.assign(new Error("Assigned reception centers cannot be confirmed."),
    {status:response.status});
   return await response.json() as {centers:Center[]};
  }).then(data=>{
   if(!active)return;
   const valid=Array.isArray(data.centers)?data.centers.filter(x=>
    typeof x.centerRef==="string"&&typeof x.centerName==="string"&&
    typeof x.timeZone==="string"&&x.timeZone.length>2):[];
   setCenters(valid);if(valid.length===1)setCenter(valid[0].centerRef);
  }).catch(e=>{if(active)expired(e);})
   .finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;serial.current++;};
 },[token,expired]);
 useEffect(()=>{
  const stamp=++serial.current;setDoctors([]);setDoctor("");setDay(null);clear();
  if(!center)return;
  void api<{doctors:Doctor[];complete:boolean}>(token,
   "centers/"+encodeURIComponent(center)+"/doctors").then(data=>{
    if(serial.current!==stamp)return;
    setDoctors(data.doctors);
    if(!data.complete)setMessage("This center's roster is too large. Use the Web center portal.");
  }).catch(e=>{if(serial.current===stamp)expired(e);});
 },[token,center,expired]);
 const centerZone=centers.find(c=>c.centerRef===center)?.timeZone??"";
 const preview=useCallback(async(d:string,step:number)=>{
  if(!d||!center||busy||uncertain)return;
  const stamp=++serial.current;setDay(null);
  setBusy(true);setMessage("");
  try{
   if(!centerZone)throw Error("Current center time zone could not be confirmed.");
   const date=TODAY(step,centerZone);
   if(!date)throw Error("The current center date cannot be calculated.");
   const result=await api<Daily>(token,"centers/"+encodeURIComponent(center)+
    "/doctor/"+encodeURIComponent(d)+"/slots?date="+encodeURIComponent(date));
   if(serial.current!==stamp)return;
   if(result.timeZone!==centerZone)
    throw Error("The center time zone changed. Refresh your center assignment.");
   setDay(result);
  }catch(e){if(serial.current===stamp)expired(e);}
  finally{if(serial.current===stamp)setBusy(false);}
 },[token,center,centerZone,busy,uncertain,expired]);
 const attemptFor=(slot:Slot)=>{
  if(!day?.consultationFeeMinor||!day.consultationFeeVersion)return null;
  const body={doctorRef:doctor,centerRef:center,startAt:slot.startAt,endAt:slot.endAt,
   acceptedFeeMinor:day.consultationFeeMinor,
   acceptedFeeVersion:day.consultationFeeVersion,paymentMode:"PAY_AT_CENTER",
   virtualPatientId:patientId,authorizationCode:code};
  const signature=JSON.stringify(body);
  if(holdAttempt.current?.signature!==signature)
   holdAttempt.current={signature,key:Crypto.randomUUID(),body};
  return holdAttempt.current;
 };
 async function reserve(slot:Slot,retry=false){
  if(busy||(!retry&&uncertain)||hold||booking)return;
  if(!VIRTUAL.test(patientId)||!CODE.test(code)){
   setMessage("Ask the verified patient for their Virtual Patient ID and original one-time center code.");
   return;
  }
  const attempt=attemptFor(slot);if(!attempt)return;
  setChosenSlot(slot);setPhase("HOLD");setBusy(true);setMessage("");
  try{
   const result=await api<Hold>(token,"holds","POST",{
    ...attempt.body,requestKey:attempt.key});
   setHold(result);setUncertain(false);
   setMessage("Doctor time held for the verified patient. Confirm before expiry.");
  }catch(e){
   if(e&&typeof e==="object"&&"status" in e&&typeof e.status==="number"&&e.status<500){
    setUncertain(false);expired(e);
   }else{
    setUncertain(true);expired(e);
   }
  }finally{setBusy(false);}
 }
 /** One original private CG19 slip after actual committed staff booking.
  * A failed document issue never undoes or misrepresents the appointment.
  * Recover original slip status before reusing the same issue key.
  */
 async function issueCurrentSlip(ref:string):Promise<boolean>{
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(ref))return false;
  const uri="/api/v1/appointments/slips/staff/"+encodeURIComponent(ref);
  try{
   const statusReply=await identityRequest(uri+"/status",{
    cache:"no-store",headers:{Authorization:"Bearer "+token}});
   if(!statusReply.ok){if(statusReply.status===401)onExpired();return false;}
   const status:unknown=await statusReply.json().catch(()=>null);
   if(!status||typeof status!=="object"||!("status" in status))return false;
   if(status.status==="ISSUED"&&"canDownload" in status&&status.canDownload===true)
    return true;
   if(status.status!=="NOT_ISSUED")return false;
   if(!slipKey.current)slipKey.current=Crypto.randomUUID();
   const issuedReply=await identityRequest(uri+"/issue",{
    method:"POST",cache:"no-store",
    headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},
    body:JSON.stringify({requestKey:slipKey.current})
   });
   if(!issuedReply.ok){if(issuedReply.status===401)onExpired();return false;}
   const data:unknown=await issuedReply.json().catch(()=>null);
   return !!data&&typeof data==="object"&&"status" in data&&
    data.status==="ISSUED"&&"confirmed" in data&&data.confirmed===true;
  }catch{return false;}
 }
 async function confirm(retry=false){
  if(busy||(!retry&&uncertain)||!hold||booking)return;
  if(Date.parse(hold.expiresAt)<=Date.now()){
   setMessage("This temporary hold expired. Start a new patient-authorized reservation.");return;
  }
  if(!confirmAttempt.current){
   const body={holdRef:hold.holdRef,acceptedFeeMinor:hold.consultationFeeMinor,
    acceptedFeeVersion:hold.feeVersion,paymentMode:"PAY_AT_CENTER"};
   confirmAttempt.current={signature:JSON.stringify(body),key:Crypto.randomUUID(),body};
  }
  const attempt=confirmAttempt.current;
  setPhase("CONFIRM");setBusy(true);setMessage("");
  try{
   const result=await api<Booking>(token,"confirm","POST",{
    ...attempt.body,requestKey:attempt.key});
   setBooking(result);setUncertain(false);
   const slip=await issueCurrentSlip(result.bookingRef);
   setMessage(slip?
    "Consultation confirmed. The original private slip is issued. Payment is due at this center.":
    "Consultation confirmed. Payment is due at this center. Check the private center slip before giving the patient a document.");
  }catch(e){
   if(e&&typeof e==="object"&&"status" in e&&typeof e.status==="number"&&e.status<500){
    setUncertain(false);expired(e);
   }else{setUncertain(true);expired(e);}
  }finally{setBusy(false);}
 }
 async function check(){
  if(busy||!phase)return;
  setBusy(true);setMessage("");
  try{
   if(phase==="CONFIRM"&&confirmAttempt.current){
    const record=await api<Booking>(token,"confirmations/by-request/"+
     confirmAttempt.current.key);
    setBooking(record);setUncertain(false);
    const slip=await issueCurrentSlip(record.bookingRef);
    setMessage(slip?
     "Original consultation confirmed. Its private slip is issued.":
     "Original consultation confirmed. Check its original private slip status.");
   }else if(phase==="HOLD"&&holdAttempt.current){
    const record=await api<Hold>(token,"holds/by-request/"+
     holdAttempt.current.key);
    setHold(record);setUncertain(false);
    setMessage("The original reservation was located.");
   }
  }catch(e){expired(e);setUncertain(true);}
  finally{setBusy(false);}
 }
 const date=centerZone?TODAY(offset,centerZone):"";
 return <SafeAreaView style={styles.page} edges={["left","right"]}>
  <ScrollView contentContainerStyle={styles.content}>
   {button("Back to Foundation home",onExit,busy)}
   <Text accessibilityRole="header" style={styles.pageTitle}>Authorized Patient Booking</Text>
   <Text style={styles.note}>Use only your assigned center. A signed-in, independently
    verified patient must issue a fresh 15-minute one-time code to authorize
    one hold. Full consultation fees are due at the center.</Text>
   {loading&&<ActivityIndicator/>}
   {!!message&&<Text accessibilityRole="alert" style={styles.error}>{message}</Text>}
   <Text style={styles.note}>Assigned healthcare center</Text>
   <View style={styles.row}>{centers.map(c=><View key={c.centerRef}>
    {button(c.centerName,()=>{clear();setDay(null);setCenter(c.centerRef);setOffset(0);},
     busy||uncertain)}</View>)}</View>
   {center&&<Text style={styles.note}>Select approved doctor</Text>}
   <View style={styles.row}>{doctors.map(d=><View key={d.doctorRef}>
    {button(d.doctorName,()=>{setDoctor(d.doctorRef);setDay(null);clear();},
     busy||uncertain||!!hold)}</View>)}</View>
   {center&&doctor&&<>
    <Text style={styles.note}>Consultation day: {date}</Text>
    <View style={styles.row}>
     {button("Previous day",()=>{setOffset(n=>Math.max(0,n-1));setDay(null);clear();},
      busy||uncertain||offset===0||!!hold)}
     {button("Next day",()=>{setOffset(n=>Math.min(30,n+1));setDay(null);clear();},
      busy||uncertain||offset>=30||!!hold)}
     {button("Check current doctor times",()=>void preview(doctor,offset),
      busy||uncertain||!!hold)}
    </View>
   </>}
   {day&&<View style={styles.card}>
    <Text style={styles.title}>{day.doctorName} — {day.centerName}</Text>
    <Text style={styles.note}>Local zone: {day.timeZone}. Consultation:
     {day.consultationFeeMinor!==null?money(day.consultationFeeMinor):" unavailable"}</Text>
    <TextInput style={styles.input} accessibilityLabel="Patient Virtual ID"
     placeholder="CGP-XXXXXXXXXXXXXXXX" autoCapitalize="characters" maxLength={20}
     value={patientId} editable={!busy&&!uncertain&&!hold}
     onChangeText={v=>{setPatientId(v.trim().toUpperCase());holdAttempt.current=null;}}/>
    <TextInput style={styles.input} accessibilityLabel="Patient one-time center code"
     placeholder="CGB-XXXXXXXXXXXXXXXXXXXXXXXX" autoCapitalize="characters" maxLength={28}
     value={code} editable={!busy&&!uncertain&&!hold}
     onChangeText={v=>{setCode(v.trim().toUpperCase());holdAttempt.current=null;}}/>
    <View style={styles.row}>
     {day.slots.filter(s=>s.bookable).map(s=><View key={s.startAt}>
      {button(s.startLocal+"–"+s.endLocal+" Reserve",
       ()=>void reserve(s),busy||uncertain||!!hold||
       !VIRTUAL.test(patientId)||!CODE.test(code))}</View>)}
    </View>
    {!day.slots.some(s=>s.bookable)&&
     <Text style={styles.note}>No current approved consultation time is available.</Text>}
   </View>}
   {hold&&<View style={styles.card}>
    <Text style={styles.title}>Reserved time</Text>
    <Text style={styles.note}>{chosenSlot?.startLocal??"Selected consultation"}.
     Hold expires {new Date(hold.expiresAt).toLocaleTimeString("en-IN")}.
     Consultation: {money(hold.consultationFeeMinor)} — pay at center.</Text>
    {canViewCharge&&<NativeConsultationContribution
     key={hold.holdRef} holdRef={hold.holdRef} centerRef={center}
     staffToken={token} canAccept={false} onExpired={onExpired}/>}
    {button("Confirm this patient-authorized appointment",
     ()=>void confirm(),busy||uncertain||Date.parse(hold.expiresAt)<=Date.now())}
    {!uncertain&&Date.parse(hold.expiresAt)<=Date.now()&&
     button("Start a new authorized booking",clear,busy)}
   </View>}
   {booking&&<View style={styles.card}>
    <Text style={styles.title}>Confirmed: {booking.bookingId}</Text>
    <Text style={styles.note}>Appointment {booking.bookingStatus}, payment
     {booking.collectionStatus}; consultation {money(booking.consultationFeeMinor)}.</Text>
    <Text style={styles.note}>Your current authorized center may reopen this
     booking in Consultation Check-In to review its original private slip.</Text>
    {canViewCharge&&<NativeConsultationContribution
     key={booking.bookingRef} bookingRef={booking.bookingRef}
     centerRef={center} staffToken={token} canAccept={canAcceptCharge}
     onExpired={onExpired}/>}
    {button("Book another patient",clear,busy)}
   </View>}
   {uncertain&&<View style={styles.card}>
    <Text style={styles.error}>The original write may have completed. Check
     it before creating any new booking.</Text>
    {button("Check original request",()=>void check(),busy)}
    {phase==="HOLD"&&chosenSlot&&
     button("Retry same hold",()=>void reserve(chosenSlot,true),busy)}
    {phase==="CONFIRM"&&hold&&
     button("Retry same confirmation",()=>void confirm(true),busy)}
   </View>}
  </ScrollView>
 </SafeAreaView>;
}
const styles=StyleSheet.create({
 page:{flex:1,backgroundColor:t.adminCanvas},
 content:{padding:18,paddingBottom:56,gap:14,width:"100%",maxWidth:760,alignSelf:"center"},
 pageTitle:{fontSize:23,fontWeight:"800",color:t.sidebar,marginBottom:4},
 title:{fontSize:18,fontWeight:"700",color:t.text},
 note:{fontSize:13,lineHeight:19,color:t.mutedText},
 error:{fontSize:13,color:t.error},
 row:{flexDirection:"row",flexWrap:"wrap",gap:8},
 card:{padding:16,borderWidth:1,borderColor:t.border,borderRadius:14,
  backgroundColor:t.surface,gap:12,
    shadowColor:t.sidebar,shadowOpacity:0.045,
    shadowOffset:{width:0,height:2},shadowRadius:8,elevation:1},
 input:{borderWidth:1,borderColor:t.border,borderRadius:10,
  minHeight:48,padding:12,color:t.text,backgroundColor:t.surface},
 button:{minHeight:48,borderRadius:10,padding:12,
  backgroundColor:t.primary,justifyContent:"center"},
 buttonText:{color:t.primaryText,fontWeight:"700",fontSize:13},
 disabled:{opacity:0.45}
});
