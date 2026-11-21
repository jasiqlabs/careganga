import {useCallback,useEffect,useState} from "react";
import {ActivityIndicator,Pressable,SafeAreaView,ScrollView,StyleSheet,Text,View}
 from "react-native";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";

type Assignment={doctorRef:string;doctorName:string;centerRef:string;
 centerName:string;timeZone:string};
type Summary={centerRef:string;doctorRef:string;day:string;
 confirmed:number;waiting:number;inConsultation:number;
 completed:number;cancelled:number;noShow:number;
 containsPatientDetails:false;paymentNotIncluded:true};
type Props={token:string;onExit:()=>void;onExpired:()=>void};
const today=(zone:string)=>{
 try{
  const x=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{
   timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit"
  }).formatToParts(new Date()).map(p=>[p.type,p.value]));
  return x.year+"-"+x.month+"-"+x.day;
 }catch{return new Date().toISOString().slice(0,10);}
};
const valid=(x:unknown):x is Assignment=>
 !!x&&typeof x==="object"&&
 "doctorRef" in x&&typeof x.doctorRef==="string"&&
 "centerRef" in x&&typeof x.centerRef==="string"&&
 "doctorName" in x&&typeof x.doctorName==="string"&&
 "centerName" in x&&typeof x.centerName==="string"&&
 "timeZone" in x&&typeof x.timeZone==="string";
export function NativeMyClinicianActivity({token,onExit,onExpired}:Props){
 const [assignments,setAssignments]=useState<Assignment[]>([]);
 const [selected,setSelected]=useState("");
 const [data,setData]=useState<Summary|null>(null);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const call=useCallback(async(path:string)=>{
  const r=await identityRequest("/api/v1/appointments/queue/"+path,{
   method:"GET",cache:"no-store",
   headers:{Authorization:"Bearer "+token}});
  if(r.status===401){onExpired();throw Error("Please sign in again.");}
  if(!r.ok)throw Error(r.status===403?
   "Your current doctor registration or center access cannot be verified.":
   "Your original consultation activity is unavailable.");
  return r.json() as Promise<unknown>;
 },[token,onExpired]);
 useEffect(()=>{
  let live=true;
  void call("my-clinician/assignments").then(x=>{
   if(!live)return;
   if(!x||typeof x!=="object"||!("assignments" in x)||
    !Array.isArray(x.assignments)||x.assignments.length>50)
    throw Error("Original professional assignment list unavailable.");
   const list=x.assignments.filter(valid);setAssignments(list);
   if(list[0])setSelected(list[0].doctorRef+"|"+list[0].centerRef);
  }).catch(e=>{if(live)setMessage(e instanceof Error?e.message:
   "The clinician account could not be verified.");})
   .finally(()=>{if(live)setLoading(false)});
  return()=>{live=false};
 },[call]);
 const chosen=assignments.find(x=>x.doctorRef+"|"+x.centerRef===selected);
 const refresh=useCallback(async()=>{
  if(!chosen)return;
  const day=today(chosen.timeZone);
  const raw=await call("my-clinician/centers/"+chosen.centerRef+
   "/doctors/"+chosen.doctorRef+"/summary?date="+day);
  if(!raw||typeof raw!=="object"||
   !("doctorRef" in raw)||raw.doctorRef!==chosen.doctorRef||
   !("centerRef" in raw)||raw.centerRef!==chosen.centerRef||
   !("day" in raw)||raw.day!==day||
   !("containsPatientDetails" in raw)||raw.containsPatientDetails!==false)
   throw Error("Own consultation activity source changed.");
  setData(raw as Summary);
 },[chosen?.centerRef,chosen?.doctorRef,chosen?.timeZone,call]);
 useEffect(()=>{
  let live=true;setData(null);
  if(!chosen)return;
  setBusy(true);setMessage("");
  void refresh().catch(e=>{if(live)setMessage(e instanceof Error?e.message:
   "Current consultations unavailable.");})
   .finally(()=>{if(live)setBusy(false)});
  return()=>{live=false};
 },[refresh]);
 const button=(label:string,onPress:()=>void,disabled=false)=>
  <Pressable accessibilityRole="button" disabled={disabled}
   accessibilityState={{disabled}} onPress={onPress}
   style={[styles.button,disabled&&styles.disabled]}>
   <Text style={styles.buttonText}>{label}</Text>
  </Pressable>;
 return <SafeAreaView style={styles.page}>
  <ScrollView contentContainerStyle={styles.content}>
   <Text accessibilityRole="header" style={styles.title}>My consultations</Text>
   <Text style={styles.note}>Only your verified clinician assignments
    and own completed/remaining consultation counts appear here.</Text>
   {button("Back to dashboard",onExit)}
   {loading&&<ActivityIndicator accessibilityLabel="Checking doctor access"/>}
   {!!message&&<Text accessibilityRole="alert" style={styles.note}>{message}</Text>}
   {!loading&&!assignments.length&&<Text style={styles.note}>
    Your current doctor account has no approved center assignment.
    Please contact your Foundation administrator.</Text>}
   {assignments.map(x=>button(x.doctorName+" · "+x.centerName,
    ()=>setSelected(x.doctorRef+"|"+x.centerRef),busy))}
   {chosen&&<View style={styles.panel}>
    <Text style={styles.label}>{chosen.doctorName}</Text>
    <Text style={styles.note}>{chosen.centerName} · Today {today(chosen.timeZone)}</Text>
    {busy&&<ActivityIndicator accessibilityLabel="Checking original activity"/>}
    {data&&([
     ["Confirmed",data.confirmed],["Waiting",data.waiting],
     ["With doctor",data.inConsultation],["Completed",data.completed],
     ["Cancelled",data.cancelled],["No-show",data.noShow]
    ] as const).map(([label,n])=><View key={label} style={styles.item}>
     <Text style={styles.note}>{label}</Text>
     <Text style={styles.count}>{n}</Text>
    </View>)}
    {button("Refresh my activity",()=>{setBusy(true);setMessage("");
     void refresh().catch(e=>setMessage(e instanceof Error?e.message:
      "Unable to refresh.")).finally(()=>setBusy(false));},busy)}
   </View>}
  </ScrollView>
 </SafeAreaView>;
}
const styles=StyleSheet.create({
 page:{flex:1,backgroundColor:t.adminCanvas},
 content:{padding:15,paddingBottom:90,gap:12},
 title:{color:t.text,fontSize:21,fontWeight:"700"},
 label:{color:t.text,fontSize:16,fontWeight:"700"},
 note:{color:t.mutedText,fontSize:13,lineHeight:20},
 panel:{backgroundColor:t.surface,borderColor:t.border,borderWidth:1,
  borderRadius:13,padding:13,gap:10},
 item:{flexDirection:"row",justifyContent:"space-between",paddingVertical:6,
  borderBottomWidth:1,borderColor:t.border},
 count:{color:t.text,fontSize:15,fontWeight:"700"},
 button:{borderWidth:1,borderRadius:10,borderColor:t.border,minHeight:47,
  padding:11,justifyContent:"center",backgroundColor:t.surface},
 buttonText:{color:t.text,fontSize:13,fontWeight:"600"},
 disabled:{opacity:.5}
});
