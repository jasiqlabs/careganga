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
 startAt:string;endAt:string;feeMinor:string;feeVersion:number;timeZone:string};
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
 return <View style={style.box}>
  <Text style={style.text}>{p.doctorName} · {p.centerName}</Text>
  <Text style={style.text}>{new Date(p.startAt).toLocaleString("en-IN",{
   timeZone:p.timeZone,dateStyle:"medium",timeStyle:"short"})}</Text>
  <Text style={style.text}>Consultation ₹{(Number(p.feeMinor)/100).toFixed(2)}.
   Payment due at center. No online payment.</Text>
  {!!message&&<Text accessibilityRole="alert" style={style.text}>{message}</Text>}
  {booking?<Text accessibilityRole="header" style={style.heading}>
   Confirmed booking: {booking.bookingId}. Payment due at center.</Text>:
   uncertain?<Text style={style.text}>
    Check My Patient Profile → My Consultations before retrying the original action.
    A second request is disabled until status is verified.</Text>:
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
