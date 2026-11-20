import {useCallback,useEffect,useRef,useState} from "react";
import {ActivityIndicator,BackHandler,KeyboardAvoidingView,Platform,Pressable,
 ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import * as Crypto from "expo-crypto";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";

type Case={caseRef:string;reference:string;title:string;status:string;revision:number};
type Detail=Case&{doctorName?:string;startAt?:string;endAt?:string;reason?:string};
type Props={token:string;onExit:()=>void;onExpired:()=>void};
type ResultError=Error&{status?:number};
async function read<T>(token:string,path:string,method:"GET"|"POST"="GET",body?:object){
 let r:Response;
 try{
  r=await identityRequest("/api/health/doctor-leave-reviews"+path,{
   method,cache:"no-store",
   headers:{Authorization:"Bearer "+token,
    ...(body?{"Content-Type":"application/json"}:{})},
   ...(body?{body:JSON.stringify(body)}:{})
  });
 }catch{throw Object.assign(new Error("Network result is uncertain. Refresh the original case."),
  {status:503});}
 if(!r.ok){
  const data:unknown=await r.json().catch(()=>null);
  const message=data&&typeof data==="object"&&"message" in data&&
   typeof data.message==="string"&&data.message.length<=220?data.message:
   r.status===401?"Session expired. Please sign in again.":
   r.status===403?"Your current role cannot review doctor leave.":
   r.status===409?"The original doctor leave request changed. Refresh before deciding.":
   "The reviewer request could not be verified.";
  throw Object.assign(new Error(message),{status:r.status});
 }
 return await r.json() as T;
}
const pretty=(x:string)=>x.replaceAll("_"," ").toLowerCase()
 .replace(/\b\w/g,c=>c.toUpperCase());
const when=(x:string)=>new Date(x).toLocaleString("en-IN");
export function DoctorLeaveNativeReview({token,onExit,onExpired}:Props){
 const [cases,setCases]=useState<Case[]>([]),[selected,setSelected]=useState<Detail|null>(null);
 const [action,setAction]=useState<"APPROVE"|"RETURN"|"REJECT">("APPROVE");
 const [remarks,setRemarks]=useState(""),[password,setPassword]=useState("");
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [uncertain,setUncertain]=useState(false);
 const key=useRef(""),seq=useRef(0);
 const handle=useCallback((e:unknown)=>{
  if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
  setError(e instanceof Error?e.message:"The original protected case is unavailable.");
 },[onExpired]);
 const refresh=useCallback(async()=>{
  const n=++seq.current;
  try{
   const q=await read<{cases:Case[]}>(token,"");
   if(n!==seq.current)return;
   if(!Array.isArray(q.cases)||q.cases.length>50)
    throw Error("The original reviewer queue was not valid.");
   setCases(q.cases);setUncertain(false);setError("");
  }catch(e){if(n===seq.current)handle(e);}
  finally{if(n===seq.current)setLoading(false);}
 },[token,handle]);
 useEffect(()=>{void refresh();return()=>{seq.current++;};},[refresh]);
 useEffect(()=>{
  const b=BackHandler.addEventListener("hardwareBackPress",()=>{
   if(busy||uncertain)return true;
   if(selected)setSelected(null);else onExit();
   return true;
  });
  return()=>b.remove();
 },[busy,uncertain,selected,onExit]);
 async function open(ref:string){
  setError("");setNotice("");setPassword("");setRemarks("");
  const n=++seq.current;
  try{
   const d=await read<Detail>(token,"/"+encodeURIComponent(ref));
   if(n===seq.current){setSelected(d);key.current="";setUncertain(false);}
  }catch(e){if(n===seq.current)handle(e);}
 }
 async function decide(){
  if(!selected||busy||uncertain||password.length<8||
    !["SUBMITTED","IN_REVIEW"].includes(selected.status))return;
  if(!key.current)key.current=Crypto.randomUUID();
  setBusy(true);setError("");setNotice("");
  try{
   await read(token,"/"+encodeURIComponent(selected.caseRef)+"/decide","POST",{
    requestKey:key.current,expectedRevision:selected.revision,
    action,remarks,currentPassword:password
   });
   key.current="";setPassword("");await refresh();await open(selected.caseRef);
   setNotice("Independent reviewer decision recorded. Foundation application remains separate.");
  }catch(e){
   setPassword("");handle(e);
   if(!(e&&typeof e==="object"&&"status" in e&&
    typeof e.status==="number"&&e.status<500))setUncertain(true);
   else key.current="";
  }finally{setBusy(false);}
 }
 return <SafeAreaView style={styles.page} edges={["left","right"]}>
  <KeyboardAvoidingView style={styles.page}
   behavior={Platform.OS==="ios"?"padding":undefined}>
   <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
    <View style={styles.row}>
     <Pressable accessibilityRole="button" style={styles.button}
      disabled={busy||uncertain}
      onPress={()=>{if(selected)setSelected(null);else onExit();}}>
      <Text style={styles.link}>Back</Text></Pressable>
     <Text style={styles.title} accessibilityRole="header">Doctor Leave Reviews</Text>
    </View>
    <Text style={styles.hint}>Original independent CG-03 doctor-leave decisions.
     This screen never creates a schedule or cancels an appointment.</Text>
    {loading&&<ActivityIndicator color={t.primary}/>}
    {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    {!!notice&&<Text accessibilityRole="summary" style={styles.hint}>{notice}</Text>}
    {uncertain&&<View style={styles.card}>
     <Text style={styles.error}>This decision may already have been recorded.
      Check the original case before another action.</Text>
     <Pressable accessibilityRole="button" style={styles.button}
      disabled={busy} onPress={()=>void refresh()}>
      <Text style={styles.link}>Refresh original cases</Text>
     </Pressable>
    </View>}
    {!selected&&<>
     <Pressable accessibilityRole="button" style={styles.button}
      disabled={busy} onPress={()=>void refresh()}>
      <Text style={styles.link}>Refresh reviewer queue</Text>
     </Pressable>
     {!loading&&cases.length===0&&<Text style={styles.hint}>
      No permitted doctor leave requests are available.</Text>}
     {cases.map(c=><Pressable key={c.caseRef} accessibilityRole="button"
       style={styles.card} disabled={busy||uncertain}
       onPress={()=>void open(c.caseRef)}>
      <Text style={styles.bold}>{c.reference} · {c.title}</Text>
      <Text style={styles.label}>{pretty(c.status)}</Text>
      <Text style={styles.link}>View source-bound leave</Text>
     </Pressable>)}
    </>}
    {selected&&<View style={styles.card}>
     <Text style={styles.bold}>{selected.reference} · {selected.title}</Text>
     <Text style={styles.hint}>{pretty(selected.status)}</Text>
     {selected.startAt&&selected.endAt&&<>
      <Text style={styles.label}>Doctor: {selected.doctorName}</Text>
      <Text style={styles.label}>From {when(selected.startAt)} to {when(selected.endAt)}</Text>
      <Text style={styles.label}>Protected leave reason: {selected.reason}</Text>
     </>}
     {["SUBMITTED","IN_REVIEW"].includes(selected.status)&&<>
      <Text style={styles.bold}>Independent decision</Text>
      <View style={styles.row}>
       {(["APPROVE","RETURN","REJECT"] as const).map(a=>
        <Pressable key={a} accessibilityRole="button"
         accessibilityState={{selected:action===a}} style={styles.button}
         disabled={busy||uncertain} onPress={()=>{setAction(a);key.current="";}}>
         <Text style={styles.link}>{pretty(a)}</Text>
        </Pressable>)}
      </View>
      <Text style={styles.hint}>Reviewer remarks (optional)</Text>
      <TextInput style={styles.input} value={remarks} multiline maxLength={500}
       onChangeText={v=>{setRemarks(v);key.current="";}}
       accessibilityLabel="Doctor leave reviewer remarks"/>
      <Text style={styles.hint}>Current Foundation password</Text>
      <TextInput style={styles.input} value={password} secureTextEntry
       autoCapitalize="none" accessibilityLabel="Current Foundation password"
       onChangeText={v=>{setPassword(v);key.current="";}}/>
      <Pressable accessibilityRole="button" style={[styles.button,styles.primary]}
       disabled={busy||uncertain||password.length<8} onPress={()=>void decide()}>
       <Text style={styles.primaryText}>Record independent review decision</Text>
      </Pressable>
     </>}
    </View>}
   </ScrollView>
  </KeyboardAvoidingView>
 </SafeAreaView>;
}
const styles=StyleSheet.create({
 page:{flex:1,backgroundColor:t.adminCanvas},
 content:{padding:18,paddingBottom:60,gap:14,width:"100%",maxWidth:760,alignSelf:"center"},
 row:{flexDirection:"row",alignItems:"center",gap:10,flexWrap:"wrap"},
 title:{fontSize:23,fontWeight:"800",color:t.sidebar,flexShrink:1},
 card:{backgroundColor:t.surface,borderColor:t.border,borderWidth:1,
  borderRadius:14,padding:16,gap:12},
 bold:{fontSize:15,fontWeight:"700",color:t.text},
 label:{fontSize:14,lineHeight:20,color:t.text},
 hint:{fontSize:13,lineHeight:19,color:t.mutedText},
 error:{fontSize:14,color:t.error},
 button:{borderWidth:1,borderColor:t.border,minHeight:48,borderRadius:10,
  paddingHorizontal:12,paddingVertical:8,justifyContent:"center"},
 primary:{backgroundColor:t.primary,borderColor:t.primary},
 primaryText:{fontSize:14,fontWeight:"700",color:t.primaryText},
 link:{fontSize:14,fontWeight:"600",color:t.primary},
 input:{borderWidth:1,borderColor:t.border,borderRadius:10,
  backgroundColor:t.surface,color:t.text,minHeight:48,padding:11}
});
