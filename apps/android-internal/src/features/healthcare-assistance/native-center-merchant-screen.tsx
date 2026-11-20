import {useCallback,useEffect,useRef,useState} from "react";
import {ActivityIndicator,Alert,Pressable,ScrollView,StyleSheet,
 Text,TextInput,View} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";
type Center={centerRef:string;centerName:string};
type Binding={bindingRef?:string;revision?:number;merchantRef?:string;
 verificationState:"NOT_CONFIGURED"|"PENDING_VERIFICATION"|"VERIFIED"|"REVOKED";
 onlineAvailable:boolean;credentialProvisioned?:boolean;canAcceptOnline?:boolean;
 verifiedAt?:string|null};
type Props={token:string;canPropose:boolean;canVerify:boolean;
 onExit:()=>void;onExpired:()=>void};
type Attempt={path:string;body:Record<string,unknown>;message:string};
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const origin="/api/v1/healthcare-assistance/merchant/staff/centers/";
async function api<T>(token:string,path:string,
 method:"GET"|"POST"="GET",body?:object){
 const response=await identityRequest(origin+path,{
  method,cache:"no-store",headers:{Authorization:"Bearer "+token,
   ...(body?{"Content-Type":"application/json"}:{})},
  body:body?JSON.stringify(body):undefined});
 if(!response.ok)throw Object.assign(new Error(response.status===401?
  "Your session expired. Sign in again.":
  response.status===403?"Your current role or center is not authorized.":
  response.status===404?"This verified healthcare center is unavailable.":
  response.status===409?"Merchant verification or ownership changed. Refresh the original source.":
  "Actual merchant status cannot be verified. Check the original record."),
  {status:response.status});
 return response.json() as Promise<T>;
}
export function NativeCenterMerchantScreen({token,canPropose,canVerify,
 onExit,onExpired}:Props){
 const [centers,setCenters]=useState<Center[]>([]),[center,setCenter]=useState("");
 const [current,setCurrent]=useState<Binding|null>(null);
 const [merchantRef,setMerchantRef]=useState("");
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [uncertain,setUncertain]=useState(false),[message,setMessage]=useState("");
 const prior=useRef<Attempt|null>(null),generation=useRef(0);
 const fail=useCallback((e:unknown)=>{
  if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
  setMessage(e instanceof Error?e.message:"Merchant evidence source is unavailable.");
 },[onExpired]);
 const button=(label:string,run:()=>void,disabled=false,selected=false)=>
  <Pressable accessibilityRole="button"
   accessibilityState={{disabled,selected}} disabled={disabled} onPress={run}
   style={[s.button,selected&&s.selected,disabled&&s.disabled]}>
   <Text style={s.buttonText}>{label}</Text>
  </Pressable>;
 const refresh=useCallback(async(c:string)=>{
  if(!ID.test(c))throw Error("Current assigned center is unavailable.");
  const result=await api<Binding>(token,c+"/binding");
  if(!result||!["NOT_CONFIGURED","PENDING_VERIFICATION","VERIFIED","REVOKED"]
   .includes(result.verificationState))
   throw Error("Original merchant binding is not verifiable.");
  setCurrent(result);return result;
 },[token]);
 useEffect(()=>{
  let active=true;setLoading(true);
  void api<{centers:Center[]}>(token,"eligible").then(v=>{
   if(!active)return;
   if(!Array.isArray(v.centers)||v.centers.length>50||
    v.centers.some(x=>!ID.test(x.centerRef)||
     typeof x.centerName!=="string"))
    throw Error("Current verified center list cannot be confirmed.");
   setCenters(v.centers);
   if(v.centers.length===1)setCenter(v.centers[0].centerRef);
  }).catch(e=>{if(active)fail(e)}).finally(()=>{if(active)setLoading(false)});
  return()=>{active=false;++generation.current};
 },[token,fail]);
 useEffect(()=>{
  const n=++generation.current;setCurrent(null);
  setMerchantRef("");setUncertain(false);setMessage("");prior.current=null;
  if(!center)return;
  setLoading(true);
  void refresh(center).catch(e=>{if(n===generation.current)fail(e)})
   .finally(()=>{if(n===generation.current)setLoading(false)});
 },[center,refresh,fail]);
 async function commit(attempt:Attempt,retry=false){
  if(busy||uncertain&&!retry)return;
  setBusy(true);setMessage("");
  try{
   const result=await api<Binding>(token,attempt.path,"POST",attempt.body);
   if(!result.verificationState)
    throw Error("Original verified merchant result is unavailable.");
   prior.current=null;setUncertain(false);setCurrent(result);
   setMessage(attempt.message);
   try{await refresh(center)}catch{
    setMessage(attempt.message+" Refresh the current merchant history.");
   }
  }catch(e){
   const status=e&&typeof e==="object"&&"status" in e&&
    typeof e.status==="number"?e.status:503;
   setUncertain(status>=500);
   if(status<500)prior.current=null;
   fail(e);
  }finally{setBusy(false)}
 }
 function propose(){
  if(!canPropose||busy||uncertain||!center)return;
  if(!/^[A-Za-z0-9_-]{6,80}$/.test(merchantRef.trim())){
   setMessage("Enter the actual center-owned merchant account reference.");
   return;
  }
  const request={path:center+"/binding/propose",
   body:{merchantRef:merchantRef.trim()},
   message:"Merchant request recorded, pending verification by an independent reviewer."};
  prior.current=request;void commit(request);
 }
 function review(action:"verify"|"revoke"){
  if(!canVerify||!current||!Number.isSafeInteger(current.revision)||
   busy||uncertain)return;
  Alert.alert(action==="verify"?"Verify actual center merchant?":"Revoke merchant?",
   action==="verify"?
   "Only independent verification of the center-owned provider credentials "+
   "can enable online checkout. No Foundation merchant is used.":
   "New center online checkout will be disabled; original history remains.",
   [{text:"Cancel",style:"cancel"},
    {text:action==="verify"?"Verify center ownership":"Revoke merchant",
     style:action==="revoke"?"destructive":"default",
     onPress:()=>{
      const request={path:center+"/binding/"+action,
       body:{expectedRevision:current.revision},
       message:action==="verify"?
        "The original center merchant was independently verified.":
        "The merchant is revoked. Existing payment history remains."};
      prior.current=request;void commit(request);
     }}]);
 }
 return <SafeAreaView style={s.page} edges={["left","right"]}>
  <ScrollView contentContainerStyle={s.body}>
   {button("Back to staff home",onExit,busy||uncertain)}
   <Text accessibilityRole="header" style={s.title}>Center online payment settings</Text>
   <Text style={s.note}>These are the original CG14 verified centers assigned
    to your account. Razorpay credentials are provisioned only on the server.
    The Foundation merchant is never a fallback for patient collections.</Text>
   {loading&&<ActivityIndicator accessibilityLabel="Checking merchant sources"/>}
   {centers.length===0&&!loading&&<Text style={s.note}>
    No approved center is assigned for this merchant permission.</Text>}
   {centers.map(c=><View key={c.centerRef}>
    {button(c.centerName,()=>setCenter(c.centerRef),
     busy||uncertain,c.centerRef===center)}</View>)}
   {!!message&&<Text accessibilityRole="alert" style={s.alert}>{message}</Text>}
   {current&&<View style={s.panel}>
    <Text style={s.heading}>Original center merchant</Text>
    <Text style={s.note}>Provider: Razorpay</Text>
    <Text style={s.note}>Reference: {current.merchantRef??"Not configured"}</Text>
    <Text style={s.note}>Status: {current.verificationState.replaceAll("_"," ")}</Text>
    <Text style={s.note}>Secure center credentials:
     {current.credentialProvisioned?" Provisioned":" Not available"}</Text>
    <Text style={s.note}>Online checkout:
     {current.canAcceptOnline?" Enabled for this center":
      " Unavailable — pay at center is still supported"}</Text>
    {current.verifiedAt&&<Text style={s.note}>Independently verified:
     {" "+new Date(current.verifiedAt).toLocaleString("en-IN")}</Text>}
    {canPropose&&current.verificationState==="NOT_CONFIGURED"&&<>
     <Text style={s.label}>Actual center-owned merchant reference</Text>
     <TextInput accessibilityLabel="Merchant account reference"
      style={s.input} autoCapitalize="none" value={merchantRef}
      onChangeText={setMerchantRef} maxLength={80}
      editable={!busy&&!uncertain} placeholder="Original provider reference"/>
     {button("Request independent merchant verification",propose,busy||uncertain)}
    </>}
    {canVerify&&current.verificationState==="PENDING_VERIFICATION"&&
     button("Independently verify original provider",()=>review("verify"),busy||uncertain)}
    {canVerify&&["PENDING_VERIFICATION","VERIFIED"].includes(
     current.verificationState)&&
     button("Revoke center merchant",()=>review("revoke"),busy||uncertain)}
   </View>}
   {uncertain&&<View style={s.panel}>
    <Text style={s.alert}>Last command may already have been accepted.
     Do not submit different credentials before checking the original state.</Text>
    {button("Retry exact original request",()=>{
     if(prior.current)void commit(prior.current,true);
    },busy||!prior.current)}
    {button("Check current center merchant",()=>{
     if(center)void refresh(center).catch(fail);
    },busy||!center)}
   </View>}
   {center&&button("Refresh merchant binding",()=>{
    void refresh(center).catch(fail);
   },busy||uncertain)}
  </ScrollView>
 </SafeAreaView>;
}
const s=StyleSheet.create({
 page:{flex:1,backgroundColor:t.adminCanvas},
 body:{padding:16,paddingBottom:100,gap:12},
 panel:{padding:14,gap:12,backgroundColor:t.surface,borderRadius:14,
  borderColor:t.border,borderWidth:1},
 title:{fontSize:22,fontWeight:"700",color:t.text},
 heading:{fontSize:16,fontWeight:"700",color:t.text},
 label:{fontSize:13,fontWeight:"600",color:t.text},
 note:{fontSize:13,lineHeight:20,color:t.mutedText},
 alert:{fontSize:13,lineHeight:20,color:t.error},
 input:{minHeight:48,padding:12,borderRadius:10,color:t.text,
  borderWidth:1,borderColor:t.border},
 button:{minHeight:48,padding:12,borderRadius:10,borderWidth:1,
  borderColor:t.border,justifyContent:"center"},
 buttonText:{fontSize:14,fontWeight:"600",color:t.text},
 selected:{borderColor:t.primary,backgroundColor:t.selectedSurface},
 disabled:{opacity:0.5}
});
