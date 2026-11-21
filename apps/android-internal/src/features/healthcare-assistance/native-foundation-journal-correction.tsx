import {useCallback,useEffect,useState} from "react";
import {ActivityIndicator,Alert,Pressable,StyleSheet,Text,TextInput,View}
 from "react-native";
import * as Crypto from "expo-crypto";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Year={yearRef:string;name:string};
type Options={sourcePosted:boolean;canCorrect:boolean;claimAlreadyCreated:boolean;
 originalReversed:boolean;corrected:boolean;postingDate:string;
 financialYears:Year[];complete:boolean};
type Result={status:string;corrected:boolean;replayed?:boolean};
type Props={token:string;centerRef:string;liabilityRef:string;
 onCorrected:()=>Promise<void>;onExpired:()=>void};
async function api(token:string,route:string,body?:object){
 const response=await identityRequest(
  "/api/v1/healthcare-assistance/foundation-journals/"+route,{
   method:body?"POST":"GET",cache:"no-store",
   headers:{Authorization:"Bearer "+token,
    ...(body?{"Content-Type":"application/json"}:{})},
   body:body?JSON.stringify(body):undefined});
 if(!response.ok)throw Object.assign(new Error(
  response.status===401?"Sign in again to access Foundation accounting.":
  response.status===403?"Independent Foundation review permission required.":
  response.status===409?"Correction source changed. Check the original status.":
  "Original CG09 correction is unavailable or uncertain."),
  {status:response.status});
 return response.json() as Promise<unknown>;
}
function valid(v:unknown):v is Options{
 if(!v||typeof v!=="object"||Array.isArray(v))return false;
 const a=v as Partial<Options>;
 return typeof a.sourcePosted==="boolean"&&
  typeof a.canCorrect==="boolean"&&
  typeof a.claimAlreadyCreated==="boolean"&&
  typeof a.corrected==="boolean"&&
  typeof a.postingDate==="string"&&
  Array.isArray(a.financialYears)&&a.financialYears.length<=20&&
  typeof a.complete==="boolean";
}
/** Same authorized CG17/CG09 source as Foundation Web, not a WebView.
 * Unclaimed accrual only. A paid claim is NOT a reversible bank transaction.
 */
export function NativeFoundationJournalCorrection({token,centerRef,liabilityRef,
 onCorrected,onExpired}:Props){
 const base="centers/"+centerRef+"/liabilities/"+liabilityRef+"/";
 const [data,setData]=useState<Options|null>(null);
 const [visible,setVisible]=useState(true);
 const [year,setYear]=useState(""),[postingDate,setPostingDate]=useState("");
 const [reason,setReason]=useState(""),[password,setPassword]=useState("");
 const [requestKey,setRequestKey]=useState(()=>Crypto.randomUUID());
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [uncertain,setUncertain]=useState(false),[message,setMessage]=useState("");
 const load=useCallback(async()=>{
  const v=await api(token,base+"correction-options");
  if(!valid(v))throw Error("Original correction options are incomplete.");
  return v;
 },[token,base]);
 const onError=useCallback((error:unknown)=>{
  if(error&&typeof error==="object"&&"status" in error&&error.status===401)
   onExpired();
  if(error&&typeof error==="object"&&"status" in error&&error.status===403){
   setVisible(false);return;
  }
  setMessage(error instanceof Error?error.message:"Original correction unavailable.");
 },[onExpired]);
 useEffect(()=>{
  let active=true;setLoading(true);setData(null);
  setVisible(true);setYear("");setReason("");setPassword("");
  setUncertain(false);setMessage("");setRequestKey(Crypto.randomUUID());
  void load().then(v=>{if(active){setData(v);setPostingDate(v.postingDate)}})
   .catch(e=>{if(active)onError(e)})
   .finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[load,onError]);
 async function check(){
  if(busy)return;setBusy(true);setMessage("");
  try{
   const v=await load();setData(v);
   if(v.corrected){
    setUncertain(false);setPassword("");
    setMessage("The original CG09 correction was verified.");
    await onCorrected();
   }else setMessage("No actual correction yet. Recheck before retrying the same key.");
  }catch(e){onError(e)}finally{setBusy(false)}
 }
 async function submit(){
  if(busy||uncertain||!data?.canCorrect||!data.complete||
   !ID.test(requestKey)||!ID.test(year)||reason.trim().length<12||
   reason.trim().length>300||password.length<8||
   !/^\d{4}-\d{2}-\d{2}$/.test(postingDate))return;
  setBusy(true);setMessage("");
  try{
   const v=await api(token,base+"reverse",{
    requestKey,financialYearRef:year,postingDate,
    reason:reason.trim(),currentPassword:password}) as Result;
   if(v.status!=="REVERSED"||!v.corrected)
    throw Error("Original CG09 correction was not confirmed.");
   setData(await load());setPassword("");setUncertain(false);
   setMessage("Verified offset journal posted; no bank movement was created.");
   await onCorrected();
  }catch(e){
   const status=e&&typeof e==="object"&&"status" in e&&
    typeof e.status==="number"?e.status:503;
   setUncertain(status>=500);onError(e);
  }finally{setBusy(false)}
 }
 const button=(label:string,action:()=>void,disabled=false)=>
  <Pressable accessibilityRole="button" accessibilityState={{disabled}}
   disabled={disabled} onPress={action}
   style={[styles.button,disabled&&styles.disabled]}>
   <Text style={styles.buttonText}>{label}</Text></Pressable>;
 if(!ID.test(centerRef)||!ID.test(liabilityRef)||!visible)return null;
 return <View style={styles.panel}>
  <Text accessibilityRole="header" style={styles.title}>Correct an original CG09 entry</Text>
  <Text style={styles.note}>Only an independent Foundation reviewer can offset
   an unclaimed liability. Original entries remain immutable; no bank refund is
   inferred or initiated.</Text>
  {loading&&<ActivityIndicator accessibilityLabel="Checking correction permission"/>}
  {!!message&&<Text accessibilityRole="alert" style={styles.note}>{message}</Text>}
  {data?.corrected&&<Text style={styles.note}>A verified independent correction
   already exists. Do not submit another journal.</Text>}
  {data?.claimAlreadyCreated&&!data.corrected&&
   <Text accessibilityRole="alert" style={styles.note}>This liability is
    already in a provider claim. Manual verified accounts reconciliation is
    required; this screen cannot reverse a paid or proposed claim.</Text>}
  {data?.canCorrect&&<>
   <Text style={styles.label}>Original CG09 correction financial year</Text>
   {data.financialYears.map(y=><View key={y.yearRef}>
    {button((year===y.yearRef?"Selected: ":"")+y.name,
     ()=>setYear(y.yearRef),busy||uncertain)}</View>)}
   {!data.complete&&<Text style={styles.note}>
    Financial year options incomplete. Check original Foundation accounts.</Text>}
   <Text style={styles.label}>Correction posting date (YYYY-MM-DD)</Text>
   <TextInput accessibilityLabel="Correction posting date" style={styles.input}
    placeholder="YYYY-MM-DD" value={postingDate}
    onChangeText={setPostingDate} editable={!busy&&!uncertain}/>
   <Text style={styles.label}>Verified correction reason</Text>
   <TextInput accessibilityLabel="Reason for correction" style={styles.input}
    multiline maxLength={300} value={reason} onChangeText={setReason}
    placeholder="Describe the verified source error"
    editable={!busy&&!uncertain}/>
   <Text style={styles.label}>Current Foundation account password</Text>
   <TextInput accessibilityLabel="Confirm current password" style={styles.input}
    secureTextEntry value={password} onChangeText={setPassword}
    editable={!busy&&!uncertain}/>
   {button("Post independent CG09 correction",()=>Alert.alert(
    "Confirm original liability correction",
    "An offsetting CG09 journal will be created. No provider payment or patient refund occurs.",[
     {text:"Cancel",style:"cancel"},
     {text:"Confirm",onPress:()=>void submit()}
    ]),busy||uncertain||!data.complete||!ID.test(year)||
      reason.trim().length<12||password.length<8)}
   {uncertain&&<Text accessibilityRole="alert" style={styles.note}>
    Result uncertain. Check the original status before another attempt.</Text>}
  </>}
  {button("Check original correction status",()=>void check(),busy||loading)}
 </View>;
}
const styles=StyleSheet.create({
 panel:{backgroundColor:t.surface,borderColor:t.border,borderWidth:1,
  borderRadius:12,padding:12,gap:10,marginTop:10},
 title:{fontSize:16,fontWeight:"700",color:t.text},
 label:{fontSize:13,fontWeight:"600",color:t.text},
 note:{fontSize:13,lineHeight:20,color:t.mutedText},
 input:{minHeight:48,borderWidth:1,borderColor:t.border,borderRadius:10,
  paddingHorizontal:10,color:t.text,backgroundColor:t.surface},
 button:{minHeight:46,justifyContent:"center",padding:10,
  borderWidth:1,borderColor:t.border,borderRadius:10},
 buttonText:{fontSize:13,fontWeight:"600",color:t.text},
 disabled:{opacity:0.45}
});
