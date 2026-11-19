import {useCallback,useEffect,useRef,useState} from "react";
import {ActivityIndicator,BackHandler,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import * as Crypto from "expo-crypto";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";
type Center={centerRef:string;centerName:string};
type Item={appointmentRef:string;bookingId:string;doctorRef:string;patientName:string;
 startAt:string;bookingStatus:string;bookingVersion:number;visitRef:string|null;
 visitStatus:string|null;visitVersion:number|null;queueToken:string|null};
type Props={token:string;onExit:()=>void;onExpired:()=>void};
type VerifiedSlip={valid:boolean;bookingId?:string;patientName?:string;
 bookingStatus?:string;startAt?:string;timeZone?:string;canCheckIn?:boolean};
const dateAt=(offset:number)=>{
 const d=new Date();const x=new Date(d.getFullYear(),d.getMonth(),d.getDate()+offset);
 return x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0")+"-"+
  String(x.getDate()).padStart(2,"0");
};
async function request<T>(token:string,path:string,method="GET",body?:object):Promise<T>{
 const response=await identityRequest("/api/v1/appointments/queue/"+path,{
  method,cache:"no-store",
  headers:{Authorization:"Bearer "+token,
   ...(body?{"Content-Type":"application/json"}:{})},
  body:body?JSON.stringify(body):undefined
 });
 if(!response.ok){
  const raw:unknown=await response.json().catch(()=>null);
  const error=raw&&typeof raw==="object"&&"message" in raw&&
   typeof raw.message==="string"&&raw.message.length<=220?
   raw.message:response.status===401?"Session expired. Sign in again.":
   response.status===403?"Your current role cannot manage this center's queue.":
   response.status===409?"Visit status changed. Refresh this queue.":
   "The visit action cannot be confirmed.";
  throw Object.assign(new Error(error),{status:response.status});
 }
 return await response.json() as T;
}
export function NativeCenterVisitQueue({token,onExit,onExpired}:Props){
 const [centers,setCenters]=useState<Center[]>([]);
 const [center,setCenter]=useState(""),[offset,setOffset]=useState(0);
 const [items,setItems]=useState<Item[]>([]);
 const [qrToken,setQrToken]=useState(""),[verifiedSlip,setVerifiedSlip]=useState<VerifiedSlip|null>(null);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [message,setMessage]=useState(""),[uncertain,setUncertain]=useState(false);
 const commands=useRef<Map<string,string>>(new Map()),seq=useRef(0);
 const fail=useCallback((e:unknown)=>{
  if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
  setMessage(e instanceof Error?e.message:"Protected queue is unavailable.");
 },[onExpired]);
 const load=useCallback(async(c:string,day:string)=>{
  const stamp=++seq.current;
  if(!c){setItems([]);return;}
  try{
   const data=await request<{items:Item[]}>(token,
    "my-centers/"+encodeURIComponent(c)+"?date="+encodeURIComponent(day));
   if(stamp!==seq.current)return;
   setItems(data.items);setUncertain(false);
  }catch(e){if(stamp===seq.current){setItems([]);fail(e);}}
 },[token,fail]);
 useEffect(()=>{
  let live=true;
  void request<{centers:Center[]}>(token,"my-centers")
   .then(data=>{
    if(!live)return;
    setCenters(data.centers);
    if(data.centers.length===1)setCenter(data.centers[0].centerRef);
   }).catch(e=>{if(live)fail(e);})
   .finally(()=>{if(live)setLoading(false);});
  return()=>{live=false;};
 },[token,fail]);
 useEffect(()=>{
  void load(center,dateAt(offset));
  return()=>{seq.current++;};
 },[center,offset,load]);
 useEffect(()=>{
  const back=BackHandler.addEventListener("hardwareBackPress",()=>{
   onExit();return true;
  });
  return()=>back.remove();
 },[onExit]);
 async function verifySlip(){
  if(busy||uncertain||!center||!/^CGV-[A-F0-9]{24}$/.test(qrToken))return;
  setBusy(true);setMessage("");setVerifiedSlip(null);
  try{
   const result=await request<VerifiedSlip>(token,
    "my-centers/"+encodeURIComponent(center)+"/verify-slip","POST",{token:qrToken});
   if(!result.valid){
    setMessage("This slip is not a current appointment at your assigned center.");
   }else{
    setVerifiedSlip(result);
    setMessage("The slip matches a real consultation at your own center. Check in from the current date queue.");
   }
  }catch(e){fail(e);}
  finally{setBusy(false);}
 }
 async function change(item:Item,next:"CHECK_IN"|"WAITING"|"IN_CONSULTATION"|"COMPLETED"|"NO_SHOW"){
  if(busy||uncertain)return;
  const reference=item.appointmentRef+":"+next+":"+(item.visitVersion??item.bookingVersion);
  if(!commands.current.has(reference))commands.current.set(reference,Crypto.randomUUID());
  setBusy(true);setMessage("");
  try{
   if(next==="CHECK_IN"){
    await request(token,"my-centers/"+encodeURIComponent(center)+"/check-in","POST",{
     requestKey:commands.current.get(reference),appointmentRef:item.appointmentRef,
     expectedVersion:item.bookingVersion
    });
   }else{
    if(!item.visitRef||!item.visitVersion)throw Error("Current visit could not be confirmed.");
    await request(token,"my-centers/"+encodeURIComponent(center)+"/visits/"+
     encodeURIComponent(item.visitRef)+"/transition","POST",{
      requestKey:commands.current.get(reference),
      expectedVersion:item.visitVersion,nextState:next
     });
   }
   commands.current.delete(reference);
   await load(center,dateAt(offset));
   setMessage("Original visit status saved.");
  }catch(e){fail(e);setUncertain(true);}
  finally{setBusy(false);}
 }
 const button=(name:string,onClick:()=>void,disabled=false)=>(
  <Pressable accessibilityRole="button" onPress={onClick}
   disabled={disabled} accessibilityState={{disabled}}
   style={[styles.button,disabled&&styles.disabled]}>
   <Text style={styles.buttonLabel}>{name}</Text>
  </Pressable>);
 return <SafeAreaView style={styles.page}>
  <ScrollView contentContainerStyle={styles.content}>
   {button("Back to my Foundation account",onExit,busy)}
   <Text accessibilityRole="header" style={styles.title}>My Consultation Queue</Text>
   <Text style={styles.help}>Only current, assigned verified healthcare centers are shown.
    Use real booked appointments; no private clinical reports.</Text>
   {loading&&<ActivityIndicator accessibilityLabel="Checking assigned queue centers"/>}
   {!!message&&<Text accessibilityRole="alert" style={styles.error}>{message}</Text>}
   {uncertain&&<View style={styles.card}>
    <Text style={styles.error}>The last action may have been recorded. Refresh its
     original state before taking any further action.</Text>
    {button("Refresh original queue",()=>void load(center,dateAt(offset)),busy)}
   </View>}
   <Text style={styles.help}>Assigned healthcare center</Text>
   <View style={styles.row}>{centers.map(c=>
    <Pressable key={c.centerRef} accessibilityRole="button"
     accessibilityState={{selected:center===c.centerRef}}
     style={[styles.button,center===c.centerRef&&styles.selected]}
     onPress={()=>{setCenter(c.centerRef);setUncertain(false);}}>
     <Text style={styles.buttonLabel}>{c.centerName}</Text>
    </Pressable>)}</View>
   {center&&<View style={styles.card}>
    <Text style={styles.title}>Verify my center's consultation QR</Text>
    <Text style={styles.help}>Enter the status-only QR code from the patient's
     actual slip. A different center's code cannot reveal their patient data.</Text>
    <TextInput accessibilityLabel="Original appointment QR status code"
     autoCapitalize="characters" maxLength={28} value={qrToken}
     onChangeText={value=>{setQrToken(value.toUpperCase());setVerifiedSlip(null);}}
     placeholder="CGV-XXXXXXXXXXXXXXXXXXXXXXXX" style={styles.input}/>
    {button("Verify only at this center",()=>void verifySlip(),
     busy||!/^CGV-[A-F0-9]{24}$/.test(qrToken))}
    {verifiedSlip?.valid&&<Text style={styles.help}>
     Booking {verifiedSlip.bookingId}, {verifiedSlip.patientName},
     {verifiedSlip.bookingStatus}. Select the source row below to check in.</Text>}
   </View>}
   <Text style={styles.help}>Consultation date: {dateAt(offset)}</Text>
   <View style={styles.row}>
    {button("Previous day",()=>setOffset(n=>Math.max(-14,n-1)),busy||offset<=-14)}
    {button("Next day",()=>setOffset(n=>Math.min(30,n+1)),busy||offset>=30)}
   </View>
   {!items.length&&!loading&&<Text style={styles.help}>No consultations are currently shown for this date.</Text>}
   {items.map(a=><View key={a.appointmentRef} style={styles.card}>
    <Text style={styles.title}>{a.patientName}</Text>
    <Text style={styles.help}>{a.bookingId} · {new Date(a.startAt).toLocaleString("en-IN")}</Text>
    <Text style={styles.help}>Current state: {a.bookingStatus} · Queue: {a.queueToken??"Not checked in"}</Text>
    <View style={styles.row}>
     {a.bookingStatus==="CONFIRMED"&&button("Check in",()=>void change(a,"CHECK_IN"),busy||uncertain)}
     {a.visitStatus==="ARRIVED"&&button("Waiting",()=>void change(a,"WAITING"),busy||uncertain)}
     {a.visitStatus==="WAITING"&&button("In consultation",()=>void change(a,"IN_CONSULTATION"),busy||uncertain)}
     {a.visitStatus==="IN_CONSULTATION"&&button("Complete",()=>void change(a,"COMPLETED"),busy||uncertain)}
     {["ARRIVED","WAITING"].includes(a.visitStatus??"")&&
      button("No show",()=>void change(a,"NO_SHOW"),busy||uncertain)}
    </View>
   </View>)}
  </ScrollView>
 </SafeAreaView>;
}
const styles=StyleSheet.create({
 page:{flex:1,backgroundColor:t.background},
 content:{padding:16,paddingBottom:55,gap:12},
 title:{fontSize:17,fontWeight:"700",color:t.text},
 help:{fontSize:13,color:t.mutedText},
 error:{fontSize:13,color:t.error},
 row:{flexDirection:"row",flexWrap:"wrap",gap:8},
 card:{padding:12,borderColor:t.border,borderWidth:1,borderRadius:10,
  backgroundColor:t.surface,gap:8},
 input:{borderColor:t.border,borderWidth:1,borderRadius:8,padding:12,
  minHeight:46,color:t.text,backgroundColor:t.surface},
 button:{borderColor:t.border,borderWidth:1,borderRadius:8,minHeight:46,
  padding:12,justifyContent:"center"},
 selected:{borderColor:t.primary,backgroundColor:t.surface},
 buttonLabel:{color:t.text,fontSize:13,fontWeight:"600"},
 disabled:{opacity:0.4}
});
