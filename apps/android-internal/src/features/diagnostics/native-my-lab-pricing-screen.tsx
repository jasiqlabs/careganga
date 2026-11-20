import {useCallback,useEffect,useState} from "react";
import {ActivityIndicator,Pressable,ScrollView,StyleSheet,Text,View} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {diagnosticRequest,type Center} from "./native-diagnostics-api";
import {NativeLabPricingPanel} from "./native-lab-pricing-panel";

type Props={token:string;canManage:boolean;onExit:()=>void;onExpired:()=>void};
/** Native assigned-center scope, never Foundation-wide global catalogue editing. */
export function NativeMyLabPricingScreen({token,canManage,onExit,onExpired}:Props){
 const [centers,setCenters]=useState<Center[]>([]),[current,setCurrent]=useState("");
 const [loading,setLoading]=useState(true),[message,setMessage]=useState("");
 const refresh=useCallback(async()=>{
  setLoading(true);setMessage("");
  try{
   const data=await diagnosticRequest<{centers:Center[]}>(token,"my-centers/eligible");
   if(!Array.isArray(data.centers)||data.centers.length>100)
    throw Error("Assigned laboratory list could not be verified.");
   setCenters(data.centers);
   setCurrent(v=>data.centers.some(c=>c.centerRef===v)?v:
    data.centers.length===1?data.centers[0].centerRef:"");
  }catch(e){
   setCenters([]);setCurrent("");
   if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
   setMessage(e instanceof Error?e.message:"Assigned labs are unavailable.");
  }finally{setLoading(false);}
 },[token,onExpired]);
 useEffect(()=>{void refresh()},[refresh]);
 return <SafeAreaView edges={["left","right"]} style={s.page}>
  <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
   <Pressable accessibilityRole="button" onPress={onExit} style={s.button}>
    <Text style={s.text}>Back to Foundation home</Text></Pressable>
   <Text accessibilityRole="header" style={s.title}>My Lab Pricing</Text>
   <Text style={s.note}>Only currently assigned eligible lab locations. Your
    proposal is not an approved published price or a patient payment.</Text>
   {loading&&<ActivityIndicator accessibilityLabel="Loading assigned laboratories"/>}
   {!!message&&<Text accessibilityRole="alert" style={s.message}>{message}</Text>}
   {!loading&&centers.length===0&&<Text style={s.note}>
    No approved diagnostic laboratory is currently assigned to your role.</Text>}
   <Pressable style={s.button} accessibilityRole="button"
    disabled={loading} onPress={()=>void refresh()}>
    <Text style={s.text}>Refresh assigned laboratories</Text></Pressable>
   {centers.map(c=><Pressable accessibilityRole="button"
    accessibilityState={{selected:current===c.centerRef}} key={c.centerRef}
    style={[s.button,current===c.centerRef&&s.selected]}
    onPress={()=>setCurrent(c.centerRef)}>
    <Text style={s.text}>{c.name} · {c.providerName}</Text>
    <Text style={s.note}>{c.publicationState==="PUBLISHED"?
     "Current public profile is published; only approved rates appear publicly.":
     "Not yet publicly published; private proposals are not public offers."}</Text>
   </Pressable>)}
   {!!current&&<NativeLabPricingPanel key={current}
    token={token} centerRef={current} own
    canMap={canManage} canPropose={canManage} canApprove={false}
    onExpired={onExpired}/>}
  </ScrollView>
 </SafeAreaView>;
}
const s=StyleSheet.create({
 page:{flex:1,backgroundColor:t.adminCanvas},
 content:{padding:16,gap:12,paddingBottom:110},
 title:{fontSize:22,fontWeight:"700",color:t.text},
 text:{fontSize:14,fontWeight:"600",color:t.text},
 note:{fontSize:13,lineHeight:19,color:t.mutedText},
 message:{fontSize:13,color:t.error},
 button:{borderWidth:1,borderColor:t.border,borderRadius:12,
  minHeight:48,padding:12,justifyContent:"center",gap:5,backgroundColor:t.surface},
 selected:{backgroundColor:t.selectedSurface,borderColor:t.primary}
});
