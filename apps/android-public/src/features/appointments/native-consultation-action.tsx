import {useEffect,useRef,useState} from "react";
import {BackHandler,Platform,Pressable,StyleSheet,Text,TextInput,View} from "react-native";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import {NativeConsultationContribution} from "./native-consultation-contribution";
import {careGangaTheme as theme} from "../../../../../packages/design-tokens/src/index";
const base=process.env.EXPO_PUBLIC_API_URL;
const KEY="cg_public_patient_only_session";
type Hold={holdRef:string;status:string;expiresAt:string;
 consultationFeeMinor:string;feeVersion:number};
type Booking={bookingRef:string;bookingId:string;doctorRef:string;startAt:string;centerRef:string;version:number;bookingStatus:string;
 consultationFeeMinor:string;collectionStatus:string};
type AppliedReschedule={applied:boolean;bookingId:string;doctorRef:string|null;
 centerRef:string|null;startAt:string|null;currentBooking:Booking};
type Props={doctorRef:string;centerRef:string;doctorName:string;centerName:string;
 startAt:string;endAt:string;feeMinor:string;feeVersion:number;timeZone:string;
 reschedule?:{bookingRef:string;expectedVersion:number}};
async function post<T>(path:string,data:Record<string,unknown>,token:string):Promise<T>{
 if(!base||!/^https?:\/\//.test(base)||
  (process.env.NODE_ENV==="production"&&!base.startsWith("https://")))
  throw Error("CareGanga consultations are not configured.");
 const r=await fetch(new URL("/api/v1/appointments/consultations/"+path,base),{
  method:"POST",cache:"no-store",signal:AbortSignal.timeout(12000),
  headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},
  body:JSON.stringify(data)});
 const result:unknown=await r.json().catch(()=>null);
 if(!r.ok)throw Object.assign(new Error(result&&typeof result==="object"&&"message" in result&&
  typeof result.message==="string"?result.message:
  r.status===401?"Sign in to your patient account to continue.":
  r.status===409?"The selected time or fee changed. Refresh the original schedule.":
  "The reservation outcome is uncertain. Check your appointments."),{status:r.status});
 return result as T;
}
async function original<T>(path:string,token:string):Promise<T|null>{
 if(!base||!/^https?:\/\//.test(base)||
  (process.env.NODE_ENV==="production"&&!base.startsWith("https://")))
  throw Error("CareGanga consultations are not configured.");
 const response=await fetch(new URL("/api/v1/appointments/consultations/"+path,base),{
  method:"GET",cache:"no-store",signal:AbortSignal.timeout(12000),
  headers:{Authorization:"Bearer "+token}});
 if(response.status===404)return null;
 if(!response.ok)throw Error("The original appointment outcome is not confirmed. Check again.");
 return response.json() as Promise<T>;
}
export function NativeConsultationAction(p:Props){
 const [hold,setHold]=useState<Hold|null>(null);
 const [review,setReview]=useState(false);
 const [booking,setBooking]=useState<Booking|null>(null);
 const [busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false);
 const [message,setMessage]=useState("");
 const [reasonForVisit,setReasonForVisit]=useState("");
 const confirmedReason=useRef<string|null>(null);
 const [staffBusy,setStaffBusy]=useState(false);
 const [staffCode,setStaffCode]=useState<{centerRef:string;authorizationCode:string;expiresAt:string}|null>(null);
 const [staffMessage,setStaffMessage]=useState("");
 const holdKey=useRef<string|null>(null),confirmKey=useRef<string|null>(null);
 const slipKey=useRef<string|null>(null);
 // Hardware Back follows the same review-to-edit path as Public Web.
 // While a remote write is pending or uncertain, never silently leave and
 // invite a second reservation with a different idempotency key.
 useEffect(()=>{
  if(Platform.OS!=="android")return;
  const sub=BackHandler.addEventListener("hardwareBackPress",()=>{
   if(busy||uncertain)return true;
   if(review){setReview(false);return true;}
   return false;
  });
  return()=>sub.remove();
 },[busy,uncertain,review]);
 const label=(s:string,run:()=>void)=>(
  <Pressable accessibilityRole="button" disabled={busy||uncertain}
   accessibilityState={{disabled:busy||uncertain}}
   style={[style.button,(busy||uncertain)&&{opacity:0.5}]}
   onPress={run}><Text style={style.buttonText}>{s}</Text></Pressable>
 );
 async function token(){
  const t=await SecureStore.getItemAsync(KEY);
  if(!t)throw Object.assign(new Error("Sign in using My Patient Profile on CareGanga before booking."),{status:401});
  return t;
 }
 /** Best-effort CG19 issue after true CG15 booking commit only.
  * Never expose document bytes or call a patient PDF a payment receipt.
  * Unknown CG19 status does not invalidate or duplicate a confirmed booking.
  */
 async function issuePatientSlip(ref:string,patientToken:string):
  Promise<"ISSUED"|"CHECK_STATUS">{
  if(!base||!/^https?:\/\//.test(base)||!/^[-a-f0-9]{36}$/i.test(ref))
   return "CHECK_STATUS";
  if(process.env.NODE_ENV==="production"&&!base.startsWith("https://"))
   return "CHECK_STATUS";
  const endpoint="/api/v1/appointments/slips/me/"+ref;
  try{
   const current=await fetch(new URL(endpoint+"/status",base),{
    cache:"no-store",signal:AbortSignal.timeout(12000),
    headers:{Authorization:"Bearer "+patientToken}});
   if(!current.ok)return "CHECK_STATUS";
   const status:unknown=await current.json();
   if(status&&typeof status==="object"&&"status" in status&&
    status.status==="ISSUED"&&"canDownload" in status&&
    status.canDownload===true)return "ISSUED";
   if(!status||typeof status!=="object"||!("status" in status)||
    status.status!=="NOT_ISSUED")return "CHECK_STATUS";
   if(!slipKey.current)slipKey.current=Crypto.randomUUID();
   const issued=await fetch(new URL(endpoint+"/issue",base),{
    method:"POST",cache:"no-store",signal:AbortSignal.timeout(12000),
    headers:{Authorization:"Bearer "+patientToken,
     "Content-Type":"application/json"},
    body:JSON.stringify({requestKey:slipKey.current})});
   if(!issued.ok)return "CHECK_STATUS";
   const result:unknown=await issued.json();
   return result&&typeof result==="object"&&"status" in result&&
    result.status==="ISSUED"&&"confirmed" in result&&
    result.confirmed===true?"ISSUED":"CHECK_STATUS";
  }catch{return "CHECK_STATUS";}
 }
 async function reschedule(){
  if(!p.reschedule||busy||uncertain)return;
  setBusy(true);setMessage("");
  if(!confirmKey.current)confirmKey.current=Crypto.randomUUID();
  try{
   const t=await token();
   const result=await post<Booking>("me/"+p.reschedule.bookingRef+"/reschedule",{
    requestKey:confirmKey.current,expectedVersion:p.reschedule.expectedVersion,
    doctorRef:p.doctorRef,centerRef:p.centerRef,startAt:p.startAt,endAt:p.endAt,
    acceptedFeeMinor:p.feeMinor,acceptedFeeVersion:p.feeVersion,
    paymentMode:"PAY_AT_CENTER"},t);
   setBooking(result);setMessage("Your original appointment was rescheduled, with payment due at the center.");
  }catch(e){
   const status=e&&typeof e==="object"&&"status" in e?e.status:null;
   setUncertain(!(typeof status==="number"&&status>=400&&status<500));
   setMessage(e instanceof Error?e.message:
    "The reschedule result is uncertain. Check original booking.");
  }finally{setBusy(false);}
 }
 async function reserve(){
  if(busy||uncertain)return;
  setBusy(true);setMessage("");
  if(!holdKey.current)holdKey.current=Crypto.randomUUID();
  try{
   const t=await token();
   const result=await post<Hold>("holds",{requestKey:holdKey.current,
    doctorRef:p.doctorRef,centerRef:p.centerRef,startAt:p.startAt,endAt:p.endAt,
    acceptedFeeMinor:p.feeMinor,acceptedFeeVersion:p.feeVersion,paymentMode:"PAY_AT_CENTER"},t);
   if(result.status!=="HELD"||Date.parse(result.expiresAt)<=Date.now())
    throw Error("This time is no longer reserved. Refresh the doctor schedule.");
   setHold(result);setReview(false);setUncertain(false);
   setMessage("Time reserved temporarily. Confirm before it expires.");
  }catch(e){
   const status=e&&typeof e==="object"&&"status" in e?e.status:null;
   setUncertain(!(typeof status==="number"&&status>=400&&status<500));
   setMessage(e instanceof Error?e.message:"Reservation status is uncertain.");
  }finally{setBusy(false);}
 }
 async function confirm(){
  if(busy||uncertain||!hold||!review)return;
  if(Date.parse(hold.expiresAt)<=Date.now()){
   setReview(false);setMessage("Temporary reservation expired. Choose a current time.");return;
  }
  setBusy(true);setMessage("");
  if(!confirmKey.current){
   confirmKey.current=Crypto.randomUUID();
   confirmedReason.current=reasonForVisit.trim();
  }
  try{
   const t=await token();
   const result=await post<Booking>("confirm",{
    requestKey:confirmKey.current,holdRef:hold.holdRef,
    acceptedFeeMinor:hold.consultationFeeMinor,acceptedFeeVersion:hold.feeVersion,
    paymentMode:"PAY_AT_CENTER",
    ...(confirmedReason.current?{reasonForVisit:confirmedReason.current}:{})},t);
   setBooking(result);setReview(false);setUncertain(false);
   const slip=await issuePatientSlip(result.bookingRef,t);
   setMessage(slip==="ISSUED"?
    "Appointment confirmed. Your private consultation slip is issued. Pay at your center.":
    "Appointment confirmed. Payment is due at the center. Check My Consultations for private slip status.");
  }catch(e){
   const status=e&&typeof e==="object"&&"status" in e?e.status:null;
   setUncertain(!(typeof status==="number"&&status>=400&&status<500));
   setMessage(e instanceof Error?e.message:"Confirmation is uncertain.");
  }finally{setBusy(false);}
 }
 async function authorizeCenterStaff(){
  if(staffBusy)return;
  setStaffBusy(true);setStaffMessage("");setStaffCode(null);
  try{
   const t=await token();
   if(!t)throw Error("Sign in to your patient account.");
   if(!base||!/^https?:\/\//.test(base)||
    (process.env.NODE_ENV==="production"&&!base.startsWith("https://")))
    throw Error("The secure patient API is not configured.");
    const response=await fetch(new URL("/api/v1/patients/me/assisted-booking-code",base),{
     method:"POST",cache:"no-store",signal:AbortSignal.timeout(12000),
     headers:{Authorization:"Bearer "+t,"Content-Type":"application/json"},
     body:JSON.stringify({centerRef:p.centerRef})});
    const data:unknown=await response.json().catch(()=>null);
    if(!response.ok||!data||typeof data!=="object"||
     !("authorizationCode" in data)||typeof data.authorizationCode!=="string"||
     !("expiresAt" in data)||typeof data.expiresAt!=="string")
     throw Error("The receptionist code cannot be confirmed.");
    setStaffCode({centerRef:p.centerRef,authorizationCode:data.authorizationCode,
     expiresAt:data.expiresAt});
    setStaffMessage("One-time booking consent was issued for this exact center.");
  }catch(e){setStaffMessage(e instanceof Error?e.message:
   "Patient verification or center authorization is unavailable.");}
  finally{setStaffBusy(false);}
 }
 async function recover(){
  if(busy)return;
  setBusy(true);setMessage("");
  try{
   const t=await token();
   if(confirmKey.current&&!p.reschedule){
    const found=await original<Booking>(
     "confirmations/by-request/"+confirmKey.current,t);
    if(found){setBooking(found);setUncertain(false);setHold(null);
     const slip=await issuePatientSlip(found.bookingRef,t);
     setMessage("The original appointment was confirmed: "+found.bookingId+
      (slip==="ISSUED"?". Private slip issued.":
       ". Check My Consultations for private slip status."));return;}
   }
   if(holdKey.current&&!p.reschedule){
    const found=await original<Hold>("holds/by-request/"+holdKey.current,t);
    if(found?.status==="HELD"&&Date.parse(found.expiresAt)>Date.now()){
     setHold(found);setReview(false);setUncertain(false);
     setMessage("The original time is still reserved. Confirm using the same request.");return;
    }
    if(found?.status==="CONSUMED"){
     setMessage("The original hold was used. Check the same booking again before any action.");return;
    }
    if(found?.status==="EXPIRED"||found?.status==="CANCELLED"){
     holdKey.current=null;confirmKey.current=null;setHold(null);setReview(false);setUncertain(false);
     setMessage("Previous hold expired. Select a current time.");return;
    }
    setHold(null);setReview(false);setUncertain(false);
    setMessage("No committed hold was found. Retrying uses the same original request key.");return;
   }
   if(p.reschedule){
    if(!confirmKey.current)throw Error("No original reschedule request key is available.");
    const applied=await original<AppliedReschedule>(
     "me/"+p.reschedule.bookingRef+"/reschedule/by-request/"+confirmKey.current,t);
    if(applied?.applied){
     setBooking(applied.currentBooking);setUncertain(false);
     setMessage("Your original reschedule was accepted. Current booking details are shown.");
     return;
    }
    const current=await original<Booking>("me/"+p.reschedule.bookingRef,t);
    if(current?.bookingStatus==="CONFIRMED"&&
     current.version===p.reschedule.expectedVersion){
     setUncertain(false);
     setMessage("No matching reschedule was recorded. Retrying uses the same original request key.");
     return;
    }
    setMessage("This booking changed without a matching request result. Refresh before taking another action.");
    return;
   }
   setMessage("The original booking reference is unavailable. Refresh the selected time.");
  }catch(e){setMessage(e instanceof Error?e.message:"Original appointment status is uncertain.");}
  finally{setBusy(false);}
 }
 return <View style={style.box}>
  <Text style={style.text}>{p.doctorName} · {p.centerName}</Text>
  <Text style={style.text}>{new Date(p.startAt).toLocaleString("en-IN",{
   timeZone:p.timeZone,dateStyle:"medium",timeStyle:"short"})}</Text>
  <Text style={style.text}>Approved consultation fee ₹{(Number(p.feeMinor)/100).toFixed(2)}.
   Patient due is calculated from an actual assistance policy at review.
   No online payment is collected.</Text>
  {!!message&&<Text accessibilityRole="alert" style={style.text}>{message}</Text>}
  {!booking&&!uncertain&&!p.reschedule&&!review&&<View style={{gap:4}}>
   <Text style={style.text}>Reason for visit (optional, private)</Text>
   <TextInput multiline value={reasonForVisit} maxLength={300}
    editable={!busy&&!confirmKey.current}
    accessibilityLabel="Optional private reason for consultation"
    placeholder="Brief reason, only if you wish" onChangeText={setReasonForVisit}
    style={style.reasonInput}/>
   <Text style={style.text}>Stored with your patient-care consent and encryption,
    not printed on the appointment slip or sent in notifications.</Text>
  </View>}
  {booking?<View style={{gap:10}}>
   <Text accessibilityRole="header" style={style.heading}>
    Confirmed booking: {booking.bookingId}. Payment due at center.</Text>
   <NativeConsultationContribution bookingRef={booking.bookingRef}/>
  </View>:
   uncertain?<View style={{gap:8}}>
    <Text style={style.text}>
     The original action may have succeeded. Check it before making another request.
    </Text>
    <Pressable accessibilityRole="button" disabled={busy}
     style={[style.button,busy&&{opacity:0.5}]}
     onPress={()=>void recover()}>
     <Text style={style.buttonText}>Check original request status</Text>
    </Pressable>
   </View>:
   p.reschedule?label(busy?"Checking…":"Accept fee and reschedule",()=>void reschedule()):
   hold?(review?<View style={{gap:8}}>
    <Text style={style.heading}>Review doctor and appointment before confirming</Text>
    <Text style={style.text}>Doctor: {p.doctorName}</Text>
    <Text style={style.text}>Center: {p.centerName}</Text>
    <Text style={style.text}>Date and time: {new Date(p.startAt).toLocaleString(
     "en-IN",{timeZone:p.timeZone,dateStyle:"medium",timeStyle:"short"})}</Text>
    <Text style={style.text}>Approved consultation fee:
     ₹{(Number(hold.consultationFeeMinor)/100).toFixed(2)}.
     Your patient share depends on the real assistance policy.</Text>
    <NativeConsultationContribution holdRef={hold.holdRef}/>
    <Text style={style.text}>Optional private reason:
     {reasonForVisit.trim()?" Included with this consultation":" Not provided"}</Text>
    {label("Confirm reviewed appointment — pay at center",()=>void confirm())}
    {label("Back to edit the reason",()=>setReview(false))}
    <Text style={style.text}>Your time is held until
     {new Date(hold.expiresAt).toLocaleString("en-IN")}. There is no
     confirmed appointment until the original booking succeeds.</Text>
   </View>:label("Review doctor, center, time and fee",()=>setReview(true))):
   label(busy?"Checking…":"Reserve consultation time",()=>void reserve())}
  <Text style={style.text}>At this healthcare center, you can choose to have
   assigned reception staff book one consultation using a patient-issued code.</Text>
  <Pressable accessibilityRole="button" disabled={staffBusy}
   style={[style.button,staffBusy&&{opacity:0.5}]}
   onPress={()=>void authorizeCenterStaff()}>
   <Text style={style.buttonText}>
    {staffBusy?"Checking…":"Give center one-time booking permission"}</Text>
  </Pressable>
  {!!staffMessage&&<Text accessibilityRole="alert" style={style.text}>{staffMessage}</Text>}
  {staffCode&&staffCode.centerRef===p.centerRef&&
   <Text selectable style={style.text}>Show your Virtual Patient ID
   and code {staffCode.authorizationCode} only to assigned staff at this center.
   Expires {new Date(staffCode.expiresAt).toLocaleTimeString("en-IN")}.</Text>}
 </View>;
}
const style=StyleSheet.create({
 box:{padding:12,gap:8,borderWidth:1,borderColor:theme.border,borderRadius:10,
 backgroundColor:theme.surface},
 text:{fontSize:13,color:theme.text},
 heading:{fontSize:15,fontWeight:"700",color:theme.text},
 reasonInput:{minHeight:64,padding:10,borderRadius:8,borderWidth:1,
  borderColor:theme.border,color:theme.text,textAlignVertical:"top"},
 button:{minHeight:44,backgroundColor:theme.primary,padding:12,borderRadius:8,
 alignItems:"center",justifyContent:"center"},
 buttonText:{fontSize:13,fontWeight:"700",color:theme.primaryText}
});
