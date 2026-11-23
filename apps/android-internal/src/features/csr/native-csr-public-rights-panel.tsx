import React,{useEffect,useState} from "react";
import {ActivityIndicator,Alert,Pressable,StyleSheet,Text,TextInput,View} from "react-native";
import * as Crypto from "expo-crypto";
import {identityRequest} from "../identity-access/http-client";

type Release={partnerStatus:string;version:number;state:"AUTHORIZED"|"WITHDRAWN"|"NOT_AUTHORIZED";
 publicSummary:string;approvedAgreementFileRef:string|null};
type Command={url:string;body:Record<string,unknown>};
async function request<T,>(token:string,url:string,method:"GET"|"POST"="GET",body?:Record<string,unknown>):Promise<T>{
 const response=await identityRequest("/api/v1/csr/partners"+url,{
  method,headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},
  body:body?JSON.stringify(body):undefined});
 if(response.status===401)throw Object.assign(Error("Sign in again to manage public partner rights."),{status:401});
 const parsed:unknown=await response.json().catch(()=>null);
 if(!response.ok||parsed===null)throw Object.assign(Error(
  response.status===403?"Current permission or branch does not allow this CSR change.":
  response.status===409?"The approved agreement or public rights have changed; refresh.":
  "This CSR public permission outcome cannot be confirmed."),{status:response.status||503});
 return parsed as T;
}
/** Only existing CG08 source, CG03 protected case and CG19 original proof. */
export function NativeCsrPublicRightsPanel({token,partnerRef,canManage,onExpired}:{
 token:string;partnerRef:string;canManage:boolean;onExpired:()=>void}){
 const [current,setCurrent]=useState<Release|null>(null),[summary,setSummary]=useState(""),
  [consent,setConsent]=useState(false),[loading,setLoading]=useState(true),
  [busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState(""),
  [pending,setPending]=useState<Command|null>(null),[epoch,setEpoch]=useState(0);
 useEffect(()=>{
  let live=true;setLoading(true);setError("");
  void request<Release>(token,"/"+partnerRef+"/public-release").then(result=>{
   if(!live)return;
   setCurrent(result);setSummary(result.publicSummary);setConsent(false);
  }).catch(e=>{
   if(!live)return;setCurrent(null);
   if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
   setError(e instanceof Error?e.message:"Cannot confirm original publicity rights.");
  }).finally(()=>{if(live)setLoading(false);});
  return()=>{live=false;};
 },[token,partnerRef,epoch,onExpired]);
 const send=async(command:Command)=>{
  if(busy)return;setBusy(true);setPending(command);setError("");setMessage("");
  try{
   await request<{ref:string;version:number}>(token,command.url,"POST",command.body);
   setPending(null);setConsent(false);
   setMessage("Public naming rights change confirmed. Actual CG18 website publication still requires an independent approval.");
   setEpoch(v=>v+1);
  }catch(e){
   const code=e&&typeof e==="object"&&"status" in e?Number(e.status):503;
   if(code===401)onExpired();
   if(code>0&&code<500)setPending(null);
   setError(code>=500||code===0?
    "Outcome uncertain: retry exactly the same request, not a new permission.":
    e instanceof Error?e.message:"Public naming permission was rejected.");
  }finally{setBusy(false);}
 };
 const authorize=()=>{
  if(!current||!canManage||current.partnerStatus!=="APPROVED"||
   current.state==="AUTHORIZED"||!current.approvedAgreementFileRef||!consent||
   summary.trim().length<10||summary.trim().length>500||pending||busy)return;
  void send({url:"/"+partnerRef+"/public-release",
   body:{requestKey:Crypto.randomUUID(),expectedVersion:current.version,
    evidenceFileRef:current.approvedAgreementFileRef,publicSummary:summary.trim(),
    publicRightsConfirmed:true}});
 };
 const withdraw=()=>{
  if(!current||!canManage||current.state!=="AUTHORIZED"||busy||pending)return;
  Alert.alert("Withdraw public display permission?",
   "The partner's public name and logo must be hidden when current rights are checked.",
   [{text:"Keep permission",style:"cancel"},
    {text:"Withdraw",style:"destructive",onPress:()=>void send({
     url:"/"+partnerRef+"/public-release/withdraw",
     body:{requestKey:Crypto.randomUUID(),expectedVersion:current.version}})}]);
 };
 const action=(name:string,cb:()=>void,disabled=false)=><Pressable accessibilityRole="button"
  accessibilityState={{disabled:disabled||busy}} disabled={disabled||busy}
  onPress={cb} style={styles.action}><Text style={styles.actionLabel}>{name}</Text></Pressable>;
 return <View style={styles.section}>
  <Text style={styles.title}>Public partnership attribution</Text>
  <Text style={styles.help}>Private CSR approval is not public marketing permission. Only an
   explicitly authorized name and description can be selected for independent website approval.
   Private signed documents and contact details are never published.</Text>
  {loading&&<ActivityIndicator accessibilityLabel="Checking current public rights"/>}
  {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
  {!!message&&<Text style={styles.success}>{message}</Text>}
  {current&&!loading&&<>
   <Text style={styles.help}>Current status: {current.state==="AUTHORIZED"?
    "Authorized for editorial approval":current.state==="WITHDRAWN"?
    "Withdrawn; not public":"Not authorized; not public"}</Text>
   {current.state==="AUTHORIZED"?<>
    <Text style={styles.help}>Original authorized description: {current.publicSummary}</Text>
    {canManage&&action("Withdraw public naming permission",withdraw,!!pending)}
   </>:canManage&&current.partnerStatus==="APPROVED"&&<>
    {!current.approvedAgreementFileRef&&
     <Text accessibilityRole="alert" style={styles.error}>No current clean agreement from
      independent CSR approval. Permission cannot be granted.</Text>}
    <Text style={styles.label}>Public description (for separate editorial review)</Text>
    <TextInput value={summary} maxLength={500} multiline textAlignVertical="top"
     style={styles.textarea} editable={!busy&&!pending&&!!current.approvedAgreementFileRef}
     placeholder="Describe the verified collaboration" onChangeText={setSummary}/>
    <Pressable accessibilityRole="checkbox" accessibilityState={{checked:consent}}
     disabled={!current.approvedAgreementFileRef||busy||!!pending}
     onPress={()=>setConsent(v=>!v)} style={styles.check}>
     <Text style={styles.help}>{consent?"☑":"☐"} I inspected the original scanner-verified,
      signed agreement. It expressly allows public use of this organization's name and description.</Text>
    </Pressable>
    {action("Authorize name for website review",authorize,
     !current.approvedAgreementFileRef||!consent||summary.trim().length<10||
     summary.trim().length>500||!!pending)}
   </>}
  </>}
  {pending&&<View style={styles.section}>
   <Text accessibilityRole="alert" style={styles.error}>A prior command outcome is uncertain.
    Retry the same original command only.</Text>
   {action("Retry original rights request",()=>void send(pending))}
  </View>}
  {action("Refresh original permission",()=>setEpoch(v=>v+1),!!pending)}
 </View>;
}
const styles=StyleSheet.create({
 section:{padding:13,borderWidth:1,borderRadius:12,borderColor:"#CBD5E1",backgroundColor:"#FFFFFF",gap:10},
 title:{fontSize:17,fontWeight:"700",color:"#0F172A"},
 label:{fontSize:13,fontWeight:"600",color:"#334155"},
 help:{color:"#475569",fontSize:13,lineHeight:19},
 textarea:{borderColor:"#CBD5E1",borderWidth:1,borderRadius:8,minHeight:96,padding:10,
  backgroundColor:"#FFFFFF",color:"#0F172A"},
 action:{borderColor:"#B9C7E8",borderWidth:1,padding:12,borderRadius:8,backgroundColor:"#EFF6FF"},
 actionLabel:{color:"#1D4ED8",fontWeight:"700"},
 check:{padding:9,backgroundColor:"#F8FAFC",borderRadius:8},
 error:{color:"#B91C1C",fontSize:13},success:{color:"#166534",fontSize:13}
});
