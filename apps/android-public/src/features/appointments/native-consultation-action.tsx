import {useRef,useState} from "react";
import {Pressable,StyleSheet,Text,View} from "react-native";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import {careGangaTheme as theme} from "../../../../../packages/design-tokens/src/index";
const base=process.env.EXPO_PUBLIC_API_URL;
const KEY="cg_public_patient_only_session";
type Hold={holdRef:string;status:string;expiresAt:string;
 consultationFeeMinor:string;feeVersion:number};
type Booking={bookingId:string;startAt:string;bookingStatus:string;
 consultationFeeMinor:string;collectionStatus:string};
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
 if(!r.ok)throw Error(result&&typeof result==="object"&&"message" in result&&
  typeof result.message==="string"?result.message:
  r.status===401?"Sign in to your patient account to continue.":
  "The reservation outcome is uncertain. Check your appointments.");
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
 const [booking,setBooking]=useState<Booking|null>(null);
 const [busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false);
 const [message,setMessage]=useState("");
 const holdKey=useRef<string|null>(null),confirmKey=useRef<string|null>(null);
 const label=(s:string,run:()=>void)=>(
  <Pressable accessibilityRole="button" disabled={busy||uncertain}
   accessibilityState={{disabled:busy||uncertain}}
   style={[style.button,(busy||uncertain)&&{opacity:0.5}]}
   onPress={run}><Text style={style.buttonText}>{s}</Text></Pressable>
 );
 async function token(){
  const t=await SecureStore.getItemAsync(KEY);
  if(!t)throw Error("Sign in using My Patient Profile on CareGanga before booking.");
  return t;
 }
 async function reschedule(){
  if(!p.reschedule||busy||uncertain)return;
  setBusy(true);setMessage("");
  if(!confirmKey.current)confirmKey.current=Crypto.randomUUID();
  try{
   const t=await token();
   const result=await post<Booking>("me/"+p.reschedule.bookingRef+"/reschedule",{
    requestKey:confirmKey.current,expectedVersion:p.reschedule.expectedVersion,
    centerRef:p.centerRef,startAt:p.startAt,endAt:p.endAt,
    acceptedFeeMinor:p.feeMinor,acceptedFeeVersion:p.feeVersion,
    paymentMode:"PAY_AT_CENTER"},t);
   setBooking(result);setMessage("Your original appointment was rescheduled, with payment due at the center.");
  }catch(e){
   setUncertain(true);setMessage(e instanceof Error?e.message:
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
   setHold(result);setUncertain(false);
   setMessage("Time reserved temporarily. Confirm before it expires.");
  }catch(e){
   setUncertain(true);setMessage(e instanceof Error?e.message:"Reservation status is uncertain.");
  }finally{setBusy(false);}
 }
 async function confirm(){
  if(busy||uncertain||!hold)return;
  if(Date.parse(hold.expiresAt)<=Date.now()){
   setMessage("Temporary reservation expired. Choose a current time.");return;
  }
  setBusy(true);setMessage("");
  if(!confirmKey.current)confirmKey.current=Crypto.randomUUID();
  try{
   const t=await token();
   const result=await post<Booking>("confirm",{
    requestKey:confirmKey.current,holdRef:hold.holdRef,
    acceptedFeeMinor:hold.consultationFeeMinor,acceptedFeeVersion:hold.feeVersion,
    paymentMode:"PAY_AT_CENTER"},t);
   setBooking(result);setMessage("Appointment confirmed. Pay at your healthcare center.");
  }catch(e){
   setUncertain(true);setMessage(e instanceof Error?e.message:"Confirmation is uncertain.");
  }finally{setBusy(false);}
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
     setMessage("The original appointment was confirmed: "+found.bookingId+".");return;}
   }
   if(holdKey.current&&!p.reschedule){
    const found=await original<Hold>("holds/by-request/"+holdKey.current,t);
    if(found?.status==="HELD"&&Date.parse(found.expiresAt)>Date.now()){
     setHold(found);setUncertain(false);
     setMessage("The original time is still reserved. Confirm using the same request.");return;
    }
    if(found?.status==="CONSUMED"){
     setMessage("The original hold was used. Check the same booking again before any action.");return;
    }
    if(found?.status==="EXPIRED"||found?.status==="CANCELLED"){
     holdKey.current=null;confirmKey.current=null;setHold(null);setUncertain(false);
     setMessage("Previous hold expired. Select a current time.");return;
    }
    setHold(null);setUncertain(false);
    setMessage("No committed hold was found. Retrying uses the same original request key.");return;
   }
   if(p.reschedule){
    // Rescheduling is identified by the original booking ref; never infer
    // its outcome from a different doctor's appointment or a cached list.
    const current=await original<Booking>("me/"+p.reschedule.bookingRef,t);
    if(current&&current.startAt===p.startAt){
     setBooking(current);setMessage("Your original booking reflects the selected new time.");
     setUncertain(false);return;
    }
    setMessage("The original booking does not yet show the new time. Check again before retrying.");
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
  <Text style={style.text}>Consultation ₹{(Number(p.feeMinor)/100).toFixed(2)}.
   Payment due at center. No online payment.</Text>
  {!!message&&<Text accessibilityRole="alert" style={style.text}>{message}</Text>}
  {booking?<Text accessibilityRole="header" style={style.heading}>
   Confirmed booking: {booking.bookingId}. Payment due at center.</Text>:
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
   hold?label(busy?"Checking…":"Confirm pay-at-center appointment",()=>void confirm()):
   label(busy?"Checking…":"Reserve consultation time",()=>void reserve())}
 </View>;
}
const style=StyleSheet.create({
 box:{padding:12,gap:8,borderWidth:1,borderColor:theme.border,borderRadius:10,
 backgroundColor:theme.surface},
 text:{fontSize:13,color:theme.text},
 heading:{fontSize:15,fontWeight:"700",color:theme.text},
 button:{minHeight:44,backgroundColor:theme.primary,padding:12,borderRadius:8,
 alignItems:"center",justifyContent:"center"},
 buttonText:{fontSize:13,fontWeight:"700",color:theme.primaryText}
});
