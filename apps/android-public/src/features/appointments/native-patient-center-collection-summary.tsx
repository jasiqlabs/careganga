import {useCallback,useEffect,useRef,useState} from "react";
import {ActivityIndicator,Pressable,StyleSheet,Text,View} from "react-native";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import {File,Paths} from "expo-file-system";
import {fetch as expoFetch} from "expo/fetch";
import {careGangaPublicTheme as t} from "../../../../../packages/design-tokens/src/index";

type Collection={collectionRef:string;method:string;state:string;
 receiptPdfState:string};
type Statement={state:string;currency?:string;patientDueMinor?:string;
 collectedMinor?:string;outstandingMinor?:string;pendingElectronicMinor?:string;
 refundedOrCorrectedMinor?:string;foundationIncomeRecorded?:boolean;
 foundationLiabilityCreated?:boolean;collections?:Collection[];
 outstandingSince?:string|null;outstandingAgeDays?:number};
type Props={bookingRef:string;onExpired?:()=>void};
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const minor=(v:unknown)=>typeof v==="string"&&/^(0|[1-9]\d{0,10})$/.test(v);
const money=(v:string)=>"₹"+(Number(v)/100).toFixed(2);
function valid(raw:unknown):raw is Statement{
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return false;
 const x=raw as Statement;
 if(x.state==="NO_ACCEPTED_CHARGE")return true;
 return x.currency==="INR"&&[x.patientDueMinor,x.collectedMinor,
  x.outstandingMinor,x.pendingElectronicMinor,x.refundedOrCorrectedMinor].every(minor)&&
  BigInt(x.patientDueMinor!)===BigInt(x.collectedMinor!)+BigInt(x.outstandingMinor!)&&
  x.foundationIncomeRecorded===false&&x.foundationLiabilityCreated===false&&
  Array.isArray(x.collections)&&x.collections.length<=50;
}
const root=process.env.EXPO_PUBLIC_API_URL;
function target(path:string){
 if(!root||(!root.startsWith("https://")&&!root.startsWith("http://"))||
   (process.env.NODE_ENV==="production"&&!root.startsWith("https://")))
  throw Error("Protected patient receipt service is unavailable.");
 return new URL("/api/v1/healthcare-assistance/"+path,root).toString();
}
async function token(){
 const auth=await SecureStore.getItemAsync("cg_public_patient_only_session");
 if(!auth)throw Object.assign(new Error("Sign in again to see your payment."),{status:401});
 return auth;
}
/** Exact CG15 own-patient authorization lives on the existing backend.
 * Never expose staff payment controls or infer payment from a pending UPI.
 */
export function NativePatientCenterCollectionSummary({bookingRef,onExpired}:Props){
 const [data,setData]=useState<Statement|null>(null);
 const [loading,setLoading]=useState(true),[message,setMessage]=useState("");
 const preview=useRef<File|null>(null);
 useEffect(()=>()=>{try{preview.current?.delete()}catch{}},[]);
 const report=useCallback((e:unknown)=>{
  if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired?.();
  setMessage(e instanceof Error?e.message:"The original patient amount is unavailable.");
 },[onExpired]);
 const refresh=useCallback(async()=>{
  if(!ID.test(bookingRef))throw Error("The original consultation is invalid.");
  const res=await fetch(target("center-collections/me/appointments/"+bookingRef),{
   method:"GET",cache:"no-store",headers:{Authorization:"Bearer "+await token()},
   signal:AbortSignal.timeout(14000)});
  if(!res.ok)throw Object.assign(new Error(res.status===401?
   "Sign in again to see your private collection status.":
   "The original center receipt status could not be checked."),{status:res.status});
  const v:unknown=await res.json();
  if(!valid(v))throw Error("The original patient collection is incomplete.");
  return v;
 },[bookingRef]);
 const check=useCallback(async()=>{
  setLoading(true);setMessage("");
  try{setData(await refresh())}catch(e){report(e)}finally{setLoading(false)}
 },[refresh,report]);
 useEffect(()=>{void check()},[check]);
 async function openReceipt(collectionRef:string,online=false){
  if(loading||!ID.test(collectionRef))return;
  setLoading(true);setMessage("");
  try{
   const res=await expoFetch(target("center-receipts/me/appointments/"+bookingRef+
    "/collections/"+collectionRef+(online?"/online-pdf":"/pdf")),{
    method:"GET",headers:{Authorization:"Bearer "+await token()},
    signal:AbortSignal.timeout(20000)});
   if(!res.ok)throw Object.assign(new Error(
    "Your verified private center receipt could not be opened."),{status:res.status});
   if(res.headers.get("Content-Type")?.split(";")[0]!=="application/pdf")
    throw Error("The original protected document is not a PDF.");
   const bytes=await res.bytes();
   if(bytes.length<100||bytes.length>10485760||
    String.fromCharCode(...bytes.subarray(0,4))!=="%PDF")
    throw Error("The original protected receipt cannot be verified.");
   try{preview.current?.delete()}catch{}
   const f=new File(Paths.cache,"careganga-patient-receipt-"+Crypto.randomUUID()+".pdf");
   f.create();await f.write(bytes);preview.current=f;
   if(!await File.canPreview(f,{mimeType:"application/pdf"}))
    throw Error("A compatible private PDF viewer is not available.");
   await File.preview(f,{title:online?"Verified online payment confirmation":"My healthcare center cash receipt",
    mimeType:"application/pdf"});
  }catch(e){report(e)}finally{setLoading(false)}
 }
 if(!ID.test(bookingRef))return null;
 return <View style={styles.panel}>
  <Text accessibilityRole="header" style={styles.title}>Center payment status</Text>
  {loading&&<ActivityIndicator accessibilityLabel="Checking patient collection"/>}
  {!!message&&<Text accessibilityRole="alert" style={styles.note}>{message}</Text>}
  {data?.state==="NO_ACCEPTED_CHARGE"&&
   <Text style={styles.note}>No accepted patient contribution yet.</Text>}
  {data&&data.state!=="NO_ACCEPTED_CHARGE"&&<>
   <Text style={styles.amount}>Original patient amount: {money(data.patientDueMinor!)}</Text>
   <Text style={styles.amount}>Center verified received: {money(data.collectedMinor!)}</Text>
   <Text style={styles.amount}>Still due: {money(data.outstandingMinor!)}</Text>
   <Text style={styles.note}>Electronic reference pending (not paid): {
    money(data.pendingElectronicMinor!)}</Text>
   {data.outstandingSince&&<Text style={styles.note}>
    Outstanding since accepted charge {new Date(data.outstandingSince)
     .toLocaleDateString("en-IN")}. No late fee is assumed.</Text>}
   {!loading&&!message&&data.collections?.filter(x=>x.state==="VERIFIED_PROVIDER"&&["UPI","CARD","BANK"].includes(x.method)&&ID.test(x.collectionRef)).map((x,i)=><Pressable key={x.collectionRef} accessibilityRole="button" style={styles.button} onPress={()=>void openReceipt(x.collectionRef,true)}><Text style={styles.buttonText}>Open verified online payment confirmation {i+1} (two copies)</Text></Pressable>)}
   {data.collections?.filter(x=>x.method==="CASH"&&
     x.state==="VERIFIED_CASH"&&x.receiptPdfState==="ISSUED"&&
     ID.test(x.collectionRef)).map((x,i)=>
    <Pressable key={x.collectionRef} accessibilityRole="button"
     disabled={loading} accessibilityState={{disabled:loading}}
     style={styles.button} onPress={()=>void openReceipt(x.collectionRef)}>
     <Text style={styles.buttonText}>Open original cash receipt {i+1}</Text>
    </Pressable>)}
  </>}
  <Text style={styles.note}>A submitted UPI or card reference is not proof of
   payment. The Foundation share is a separate amount.</Text>
  <Pressable accessibilityRole="button" disabled={loading}
   accessibilityState={{disabled:loading}} style={styles.button}
   onPress={()=>void check()}>
   <Text style={styles.buttonText}>Refresh my actual center balance</Text>
  </Pressable>
 </View>;
}
const styles=StyleSheet.create({
 panel:{padding:12,gap:10,borderWidth:1,borderColor:t.border,
  backgroundColor:t.surface,borderRadius:12},
 title:{fontSize:16,fontWeight:"700",color:t.text},
 amount:{fontSize:14,fontWeight:"600",color:t.text},
 note:{fontSize:13,lineHeight:19,color:t.mutedText},
 button:{minHeight:48,padding:10,borderWidth:1,borderColor:t.border,
  borderRadius:9,justifyContent:"center"},
 buttonText:{fontSize:13,fontWeight:"600",color:t.text}
});
