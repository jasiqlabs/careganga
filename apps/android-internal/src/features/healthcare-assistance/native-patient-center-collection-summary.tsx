import {useCallback,useEffect,useState} from "react";
import {ActivityIndicator,Pressable,StyleSheet,Text,View} from "react-native";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";
type Statement={state:string;currency?:"INR";patientDueMinor?:string;collectedMinor?:string;
 outstandingMinor?:string;pendingElectronicMinor?:string;refundedOrCorrectedMinor?:string;
 foundationIncomeRecorded?:false;foundationLiabilityCreated?:false};
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const minor=(v:unknown)=>typeof v==="string"&&/^(0|[1-9]\d{0,10})$/.test(v);
const money=(v:string)=>"₹"+(Number(v)/100).toFixed(2);
function valid(v:unknown):v is Statement{
 if(!v||typeof v!=="object"||Array.isArray(v))return false;
 const x=v as Statement;
 if(x.state==="NO_ACCEPTED_CHARGE")return true;
 return x.currency==="INR"&&[x.patientDueMinor,x.collectedMinor,x.outstandingMinor,
  x.pendingElectronicMinor,x.refundedOrCorrectedMinor].every(minor)&&
  BigInt(x.patientDueMinor!)===BigInt(x.collectedMinor!)+BigInt(x.outstandingMinor!)&&
  x.foundationIncomeRecorded===false&&x.foundationLiabilityCreated===false;
}
/** CG17 original patient statement, same CG15 patient session guard as Web.
 * Never allows staff collection or treats an unverified reference as paid. */
export function NativePatientCenterCollectionSummary({token,bookingRef,onExpired}:{
 token:string;bookingRef:string;onExpired?:()=>void}){
 const [data,setData]=useState<Statement|null>(null);
 const [loading,setLoading]=useState(true),[error,setError]=useState("");
 const refresh=useCallback(async()=>{
  if(!ID.test(bookingRef))throw Error("Invalid consultation reference.");
  const response=await identityRequest(
   "/api/v1/healthcare-assistance/center-collections/me/appointments/"+bookingRef,{
    method:"GET",cache:"no-store",headers:{Authorization:"Bearer "+token}});
  if(!response.ok)throw Object.assign(new Error(response.status===401?
   "Sign in again to check your private payment.":
   "The healthcare center payment status cannot be confirmed."),{status:response.status});
  const v:unknown=await response.json();
  if(!valid(v))throw Error("Original patient payment balance is unavailable.");
  return v;
 },[token,bookingRef]);
 const check=useCallback(async()=>{
  setLoading(true);setError("");
  try{setData(await refresh());}
  catch(e){
   if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired?.();
   setError(e instanceof Error?e.message:"Patient payment status unavailable.");
  }finally{setLoading(false);}
 },[refresh,onExpired]);
 useEffect(()=>{void check();},[check]);
 if(!ID.test(bookingRef))return null;
 return <View style={s.panel}>
  <Text accessibilityRole="header" style={s.heading}>Payment at your healthcare center</Text>
  {loading&&<ActivityIndicator accessibilityLabel="Checking patient collection"/>}
  {!!error&&<Text accessibilityRole="alert" style={s.note}>{error}</Text>}
  {data?.state==="NO_ACCEPTED_CHARGE"&&
   <Text style={s.note}>No original contribution has been accepted yet.</Text>}
  {data&&data.state!=="NO_ACCEPTED_CHARGE"&&<>
   <Text style={s.value}>Patient payable: {money(data.patientDueMinor!)}</Text>
   <Text style={s.value}>Center actually received: {money(data.collectedMinor!)}</Text>
   <Text style={s.value}>Still due: {money(data.outstandingMinor!)}</Text>
   <Text style={s.note}>Electronic verification pending (not paid): {
    money(data.pendingElectronicMinor!)}</Text>
  </>}
  <Text style={s.note}>Only original verified center collections count as received.
   Foundation assistance is recorded separately.</Text>
  <Pressable accessibilityRole="button" disabled={loading}
   accessibilityState={{disabled:loading}} onPress={()=>void check()} style={s.button}>
   <Text style={s.value}>Refresh actual payment status</Text>
  </Pressable>
 </View>;
}
const s=StyleSheet.create({
 panel:{padding:12,gap:9,borderWidth:1,borderColor:t.border,
  backgroundColor:t.surface,borderRadius:12},
 heading:{color:t.text,fontWeight:"700",fontSize:16},
 note:{color:t.mutedText,fontSize:13,lineHeight:19},
 value:{color:t.text,fontWeight:"600",fontSize:14},
 button:{minHeight:48,padding:10,borderWidth:1,borderColor:t.border,
  borderRadius:9,justifyContent:"center"}
});
