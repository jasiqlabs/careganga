import {useCallback,useEffect,useRef,useState} from "react";
import {ActivityIndicator,Alert,Pressable,StyleSheet,Text,View} from "react-native";
import * as Crypto from "expo-crypto";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";
type Status={resultRef:string;reportDigest:string;releaseState:string;
 patientDownloadAvailable:boolean;
 notificationStates?:{channel:string;state:string}[];
 notificationDelivered?:boolean};
type Props={token:string;centerRef:string;orderRef:string;onExpired:()=>void};
export function NativeLabReportRelease({token,centerRef,orderRef,onExpired}:Props){
 const [status,setStatus]=useState<Status|null>(null);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [message,setMessage]=useState(""),[uncertain,setUncertain]=useState(false);
 const key=useRef<string|null>(null);
 const path="/api/v1/diagnostics/clinical/centers/"+centerRef+
  "/orders/"+orderRef+"/release";
 const request=useCallback(async(body?:object)=>{
  const res=await identityRequest(path,{
   method:body?"POST":"GET",cache:"no-store",
   headers:{Authorization:"Bearer "+token,
    ...(body?{"Content-Type":"application/json"}:{})},
   body:body?JSON.stringify(body):undefined});
  if(!res.ok)throw Object.assign(new Error(res.status===404?
   "Wait for independent approval of this laboratory PDF.":
   res.status===403?"Your current clinician role cannot release this report.":
   "Release status unavailable. Check the original report before retrying."),{
    status:res.status});
  return res.json() as Promise<Status>;
 },[path,token]);
 const error=useCallback((e:unknown)=>{
  if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
  setMessage(e instanceof Error?e.message:"Original report unavailable.");
 },[onExpired]);
 const refresh=useCallback(async()=>{
  const x=await request();
  if(!x||typeof x.resultRef!=="string"||
    !/^[a-f0-9]{64}$/.test(x.reportDigest)||
    typeof x.patientDownloadAvailable!=="boolean")
   throw Error("Original approval cannot be verified.");
  setStatus(x);
  if(x.patientDownloadAvailable){setUncertain(false);key.current=null;}
 },[request]);
 useEffect(()=>{
  let active=true;
  void refresh().catch(e=>{if(active)error(e)})
   .finally(()=>{if(active)setLoading(false)});
  return()=>{active=false;};
 },[refresh,error]);
 async function release(){
  if(busy||uncertain||!status||status.patientDownloadAvailable)return;
  key.current??=Crypto.randomUUID();
  setBusy(true);setMessage("");
  try{
   const result=await request({requestKey:key.current,
    resultRef:status.resultRef,reportDigest:status.reportDigest});
   if(!result.patientDownloadAvailable)
    throw Error("The original release was not confirmed.");
   key.current=null;setUncertain(false);
   setMessage("Approved PDF released to the patient's private reports.");
   await refresh();
  }catch(e){const http=e&&typeof e==="object"&&"status" in e&&
   typeof e.status==="number"?e.status:503;
   setUncertain(http>=500);if(http<500)key.current=null;
   error(e);
  }finally{setBusy(false)}
 }
 const button=(title:string,action:()=>void)=>
  <Pressable accessibilityRole="button" disabled={busy||loading}
   accessibilityState={{disabled:busy||loading}} onPress={action}
   style={styles.button}><Text style={styles.buttonText}>{title}</Text>
  </Pressable>;
 return <View style={styles.panel}>
  <Text style={styles.heading}>Release approved lab report</Text>
  <Text style={styles.note}>Release the original clinician-reviewed PDF
   to the patient's private account. No digital signature required.</Text>
  {loading&&<ActivityIndicator accessibilityLabel="Checking professional approval"/>}
  {!!message&&<Text accessibilityRole="alert" style={styles.note}>{message}</Text>}
  {status?.patientDownloadAvailable?
   <Text style={styles.note}>Report released for private patient download.</Text>:
   status&&!uncertain&&button("Release approved PDF",()=>
    Alert.alert("Release to patient?","This makes the approved laboratory PDF "+
     "available only in the verified patient's account.",[
      {text:"Cancel",style:"cancel"},
      {text:"Release",onPress:()=>void release()}
     ]))}
  {uncertain&&<Text accessibilityRole="alert" style={styles.note}>
   Outcome uncertain. Check the original release status before retrying.</Text>}
  {button("Refresh release status",()=>void refresh().catch(error))}
 </View>;
}
const styles=StyleSheet.create({
 panel:{padding:12,gap:9,borderWidth:1,borderColor:t.border,
  borderRadius:12,backgroundColor:t.surface},
 heading:{fontSize:16,fontWeight:"700",color:t.text},
 note:{fontSize:13,lineHeight:20,color:t.mutedText},
 button:{borderWidth:1,borderColor:t.border,borderRadius:9,
  padding:10,minHeight:48,justifyContent:"center"},
 buttonText:{fontSize:13,color:t.text,fontWeight:"600"}
});
