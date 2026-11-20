import {useCallback,useEffect,useRef,useState} from "react";
import {ActivityIndicator,Pressable,StyleSheet,Text,View} from "react-native";
import * as Crypto from "expo-crypto";
import {careGangaTheme as t}
 from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";
import {NativeCenterCollectionWorkspace} from "./native-center-collection-workspace";
type Split={state:string;accepted?:boolean;replayed?:boolean;chargeRef?:string;
 grossMinor?:string;foundationSupportMinor?:string;
 patientPayableMinor?:string;feeVersion?:number;sourceVersion?:number;
 policyRevisionRef?:string|null;currency?:string};
type Props={holdRef?:string;bookingRef?:string;centerRef?:string;
 staffToken?:string;canAccept?:boolean;onExpired?:()=>void;
 canViewCollections?:boolean;canRecordCollections?:boolean;canRefundCollections?:boolean};
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const money=(minor:string)=>"₹"+(Number(minor)/100).toFixed(2);
const valid=(x:Split)=>["grossMinor","foundationSupportMinor",
 "patientPayableMinor"].every(k=>{
  const v=x[k as keyof Split];
  return typeof v==="string"&&/^(0|[1-9]\d{0,10})$/.test(v);
 })&&x.currency==="INR"&&
 Number(x.grossMinor)===Number(x.foundationSupportMinor)+
  Number(x.patientPayableMinor);
async function remote<T>(path:string,method:"GET"|"POST",
 token:string,body?:object):Promise<T>{
 const res=await identityRequest(
  "/api/v1/healthcare-assistance/consultation-charges/"+path,{
   method,cache:"no-store",headers:{Authorization:"Bearer "+token,
    ...(body?{"Content-Type":"application/json"}:{})},
   body:body?JSON.stringify(body):undefined});
 if(!res.ok)throw Object.assign(new Error(
  res.status===401?"Sign in again to see your consultation.":
  res.status===403?"You are not authorized at this healthcare center.":
  res.status===404?"The original consultation is unavailable.":
  res.status===409?"Approved fee or support changed. Refresh the original amount.":
  "The contribution outcome is uncertain. Check the original appointment."),
  {status:res.status});
 return res.json() as Promise<T>;
}
/** Shared Public Android and Internal Android presentation, one protected
 * backend source. Private doctor/patient details never persist in device store.
 */
export function NativeConsultationContribution({holdRef,bookingRef,centerRef,
 staffToken,canAccept=true,onExpired,canViewCollections=false,
 canRecordCollections=false,canRefundCollections=false}:Props){
 const [value,setValue]=useState<Split|null>(null);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [uncertain,setUncertain]=useState(false),[message,setMessage]=useState("");
 const originalKey=useRef<string|null>(null),epoch=useRef(0);
 const route=bookingRef&&ID.test(bookingRef)?
  (centerRef?"staff/centers/"+centerRef+"/appointments/"+bookingRef:
   "me/appointments/"+bookingRef):
  holdRef&&ID.test(holdRef)?
   (centerRef?"staff/centers/"+centerRef+"/holds/"+holdRef+"/quote":
    "me/holds/"+holdRef+"/quote"):"";
 const activeRoute=route&&(!centerRef||ID.test(centerRef));
 const access=async()=>{
  const t=staffToken;
  if(!t)throw Object.assign(new Error("Sign in to view this private consultation."),
   {status:401});
  return t;
 };
 const report=useCallback((e:unknown)=>{
  if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired?.();
  setMessage(e instanceof Error?e.message:"Original contribution unavailable.");
 },[onExpired]);
 const refresh=useCallback(async()=>{
  if(!activeRoute)throw Error("The consultation reference is invalid.");
  const token=await access();
  const result=await remote<Split>(route,"GET",token);
  if(result.state!=="NOT_COLLECTIBLE"&&!valid(result))
   throw Error("Original contribution split could not be verified.");
  return result;
 },[activeRoute,route,staffToken]);
 useEffect(()=>{
  let active=true;const serial=++epoch.current;
  setLoading(true);setValue(null);setMessage("");setUncertain(false);
  originalKey.current=null;
  void refresh().then(v=>{if(active&&serial===epoch.current)setValue(v)})
   .catch(e=>{if(active&&serial===epoch.current)report(e)})
   .finally(()=>{if(active&&serial===epoch.current)setLoading(false)});
  return()=>{active=false;++epoch.current};
 },[refresh,report]);
 async function check(){
  if(busy)return;setBusy(true);setMessage("");
  try{const v=await refresh();setValue(v);setUncertain(false);
   if(v.accepted)originalKey.current=null;
  }catch(e){report(e)}finally{setBusy(false)}
 }
 async function accept(){
  if(!bookingRef||!ID.test(bookingRef)||!activeRoute||!value||
   !valid(value)||value.accepted||busy||uncertain||!canAccept||
   !Number.isSafeInteger(value.sourceVersion))return;
  setBusy(true);setMessage("");
  if(!originalKey.current)originalKey.current=Crypto.randomUUID();
  try{
   const token=await access();
   const saved=await remote<Split>(route+"/accept","POST",token,{
    requestKey:originalKey.current,grossMinor:value.grossMinor,
    supportMinor:value.foundationSupportMinor,dueMinor:value.patientPayableMinor,
    feeVersion:value.feeVersion,sourceVersion:value.sourceVersion,
    policyRevisionRef:value.policyRevisionRef??null});
   if(!saved.accepted||!valid(saved))
    throw Error("Original accepted contribution could not be confirmed.");
   originalKey.current=null;setValue(saved);setUncertain(false);
   setMessage("Original consultation split accepted. Patient collection and "+
    "Foundation settlement are NOT verified.");
  }catch(e){
   const st=e&&typeof e==="object"&&"status" in e&&
    typeof e.status==="number"?e.status:503;
   setUncertain(st>=500);report(e);
  }finally{setBusy(false)}
 }
 const btn=(title:string,press:()=>void,disabled=false)=>
  <Pressable accessibilityRole="button" accessibilityState={{disabled}}
   disabled={disabled} onPress={press}
   style={[s.button,disabled&&s.disabled]}>
   <Text style={s.buttonText}>{title}</Text>
  </Pressable>;
 if(!activeRoute)return null;
 return <View style={s.panel}>
  <Text accessibilityRole="header" style={s.title}>Consultation contribution</Text>
  {loading&&<ActivityIndicator accessibilityLabel="Checking approved contribution"/>}
  {!!message&&<Text accessibilityRole="alert" style={s.note}>{message}</Text>}
  {value?.state==="NOT_COLLECTIBLE"&&
   <Text style={s.note}>No new patient contribution applies to this appointment.</Text>}
  {value&&valid(value)&&<View style={s.rows}>
   <Text style={s.amount}>Actual consultation fee: {money(value.grossMinor!)}</Text>
   <Text style={s.amount}>Applicable Foundation share: {
    money(value.foundationSupportMinor!)}</Text>
   <Text style={s.amount}>Patient due at center: {money(value.patientPayableMinor!)}</Text>
   <Text style={s.note}>{value.state==="NO_EFFECTIVE_ASSISTANCE"?
    "No active approved assistance; full fee is patient due.":
    value.state==="SERVICE_NO_SHOW_REVIEW_REQUIRED"?
     "Original amount retained. Visit was not completed; center review required.":
    value.state==="SOURCE_CANCELLED"?"Original historical split. Booking cancelled.":
    value.state==="SOURCE_CHANGED_REVIEW_REQUIRED"?
     "Original split preserved; booking changed and needs center review.":
    value.accepted?"Original accepted split; payment remains unverified.":
     "Quote only. Not an accepted charge or patient payment."}</Text>
   <Text style={s.note}>No tax amount has been invented. CG17 does not
    collect the patient payment or create a Foundation liability here.</Text>
   {canAccept&&bookingRef&&!value.accepted&&
    !["SOURCE_CANCELLED","SERVICE_NO_SHOW_REVIEW_REQUIRED","SOURCE_CHANGED_REVIEW_REQUIRED"].includes(value.state)&&
    btn("Accept original contribution split",()=>void accept(),busy||uncertain)}
  </View>}
  {staffToken&&centerRef&&ID.test(centerRef)&&value?.accepted&&
   value.chargeRef&&ID.test(value.chargeRef)&&canViewCollections&&
   <NativeCenterCollectionWorkspace key={value.chargeRef}
    token={staffToken} centerRef={centerRef} chargeRef={value.chargeRef}
    canRecord={canRecordCollections} canRefund={canRefundCollections}
    onExpired={onExpired??(()=>undefined)}/>}
  {bookingRef&&btn("Check original contribution status",()=>void check(),busy)}
  {uncertain&&<Text style={s.note}>Last acceptance may have succeeded.
   Do not generate another request. Checking uses this original appointment.</Text>}
 </View>;
}
const s=StyleSheet.create({
 panel:{padding:12,gap:10,borderWidth:1,borderColor:t.border,
  borderRadius:12,backgroundColor:t.surface},
 title:{fontSize:16,fontWeight:"700",color:t.text},
 rows:{gap:9},
 amount:{fontSize:14,fontWeight:"600",color:t.text,lineHeight:20},
 note:{fontSize:13,lineHeight:20,color:t.mutedText},
 button:{minHeight:48,padding:12,justifyContent:"center",
  borderWidth:1,borderColor:t.border,borderRadius:10},
 buttonText:{fontSize:14,fontWeight:"600",color:t.text},
 disabled:{opacity:0.5}
});
