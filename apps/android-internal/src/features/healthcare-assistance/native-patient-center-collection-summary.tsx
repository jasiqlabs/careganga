import {useCallback,useEffect,useRef,useState} from "react";
import {ActivityIndicator,Pressable,StyleSheet,Text,View} from "react-native";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";
import {File,Paths} from "expo-file-system";
import {fetch as expoFetch} from "expo/fetch";
import * as Crypto from "expo-crypto";
type Statement={state:string;currency?:"INR";patientDueMinor?:string;collectedMinor?:string;
 outstandingMinor?:string;pendingElectronicMinor?:string;refundedOrCorrectedMinor?:string;
 foundationIncomeRecorded?:false;foundationLiabilityCreated?:false;
 outstandingSince?:string|null;outstandingAgeDays?:number;
 collections?:Array<{collectionRef:string;method:string;state:string;
 receiptPdfState:string}>};
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
 const privatePreview=useRef<File|null>(null);
 useEffect(()=>()=>{try{privatePreview.current?.delete()}catch{}},[]);
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
 async function openOriginalReceipt(collectionRef:string){
  if(loading||!ID.test(collectionRef))return;
  setLoading(true);setError("");
  try{
   const host=process.env.EXPO_PUBLIC_API_URL;
   if(!host||(!host.startsWith("https://")&&!host.startsWith("http://"))||
     (process.env.NODE_ENV==="production"&&!host.startsWith("https://")))
    throw Error("Private patient receipt service is not available.");
   const url=new URL("/api/v1/healthcare-assistance/center-receipts/"+
    "me/appointments/"+bookingRef+"/collections/"+collectionRef+"/pdf",host);
   const response=await expoFetch(url.toString(),{
    method:"GET",cache:"no-store",
    headers:{Authorization:"Bearer "+token},signal:AbortSignal.timeout(20000)});
   if(!response.ok){
    if(response.status===401)onExpired?.();
    throw Error("The original private receipt cannot be opened.");
   }
   if(response.headers.get("Content-Type")?.split(";")[0]!=="application/pdf")
    throw Error("Private patient receipt type could not be verified.");
   const bytes=await response.bytes();
   if(bytes.length<100||bytes.length>10485760||
     String.fromCharCode(...bytes.subarray(0,4))!=="%PDF")
    throw Error("The private cash receipt file could not be verified.");
   try{privatePreview.current?.delete()}catch{}
   const f=new File(Paths.cache,"careganga-patient-cash-"+Crypto.randomUUID()+".pdf");
   f.create();await f.write(bytes);privatePreview.current=f;
   if(!await File.canPreview(f,{mimeType:"application/pdf"}))
    throw Error("A secure PDF preview is not supported on this device.");
   await File.preview(f,{title:"Original center cash receipt",
    mimeType:"application/pdf"});
  }catch(e){setError(e instanceof Error?e.message:
    "Private receipt preview is unavailable.");}
  finally{setLoading(false);}
 }
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
  {data?.collections?.filter(c=>c.method==="CASH"&&
   c.state==="VERIFIED_CASH"&&c.receiptPdfState==="ISSUED"&&
   ID.test(c.collectionRef)).map((c,i)=>
   <Pressable key={c.collectionRef} accessibilityRole="button"
    disabled={loading} accessibilityState={{disabled:loading}}
    style={s.button} onPress={()=>void openOriginalReceipt(c.collectionRef)}>
    <Text style={s.value}>Open original cash receipt {i+1}</Text>
   </Pressable>)}
  {data?.outstandingSince&&<Text style={s.note}>Outstanding since accepted charge {
   new Date(data.outstandingSince).toLocaleDateString("en-IN")}. No late fee assumed.</Text>}
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
