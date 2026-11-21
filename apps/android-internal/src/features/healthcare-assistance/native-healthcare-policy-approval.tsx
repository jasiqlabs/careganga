import {useCallback,useEffect,useRef,useState} from "react";
import {Alert,Pressable,StyleSheet,Text,TextInput,View} from "react-native";
import * as Crypto from "expo-crypto";
import {careGangaTheme as t}
 from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";
type Case={caseRef:string;reference:string;title:string;
 status:string;revision:number};
type Detail={caseRef:string;reference:string;title:string;status:string;
 revision:number;source:{validFrom:string;validUntil:string;
 capMinor:string;percentBasisPoints:number|null;fixedMinor:string|null;service:string;mode:string;state:string}};
type Policy={revisionRef:string;reviewCaseRef:string|null;
 reviewStatus:string|null;status:string;serviceKind:string;
 capMinor:string;percentBasisPoints:number|null};
type Attempt={url:string;body:Record<string,unknown>;label:string};
type Props={token:string;canManage:boolean;canReview:boolean;
 policies:Policy[];onExpired:()=>void;onChanged:()=>Promise<void>};
function safeError(status:number){
 return status===401?"Session expired. Sign in again.":
 status===403?"Independent protected reviewer or Foundation owner permission is required.":
 status===404?"Original policy review is unavailable.":
 status===409?"CG03 decision, policy revision or reviewer state changed.":
 "Original approval outcome unconfirmed. Check the existing case.";
}
async function api<T>(token:string,url:string,
 method:"GET"|"POST"="GET",body?:object):Promise<T>{
 const result=await identityRequest(url,{method,cache:"no-store",
  headers:{Authorization:"Bearer "+token,
   ...(body?{"Content-Type":"application/json"}:{})},
  body:body?JSON.stringify(body):undefined});
 if(!result.ok)throw Object.assign(new Error(safeError(result.status)),
  {status:result.status});
 return result.json() as Promise<T>;
}
const cash=(minor:string)=>/^\d{1,11}$/.test(minor)?
 "₹"+(Number(minor)/100).toFixed(2):"Unknown";
const base="/api/v1/approvals/healthcare-assistance/cases";
export function NativeHealthcarePolicyApproval({token,canManage,canReview,
 policies,onExpired,onChanged}:Props){
 const [cases,setCases]=useState<Case[]>([]),[detail,setDetail]=useState<Detail|null>(null);
 const [password,setPassword]=useState(""),[remarks,setRemarks]=useState("");
 const [busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false);
 const [message,setMessage]=useState("");
 const last=useRef<Attempt|null>(null);
 const report=useCallback((err:unknown)=>{
  if(err&&typeof err==="object"&&"status" in err&&err.status===401)onExpired();
  setMessage(err instanceof Error?err.message:"Current original approval unavailable.");
 },[onExpired]);
 const refresh=useCallback(async()=>{
  if(!canReview)return;
  const res=await api<{cases:Case[]}>(token,base);
  if(!Array.isArray(res.cases)||res.cases.length>50)
   throw Error("Original protected case list cannot be verified.");
  setCases(res.cases);
 },[token,canReview]);
 useEffect(()=>{
  let active=true;
  if(canReview)void refresh().catch(e=>{if(active)report(e)});
  return()=>{active=false};
 },[canReview,refresh,report]);
 const button=(label:string,fn:()=>void,disabled=false)=>{
  return <Pressable accessibilityRole="button" accessibilityState={{disabled}}
   disabled={disabled} onPress={fn}
   style={[s.button,disabled&&s.disabled]}>
   <Text style={s.buttonText}>{label}</Text>
  </Pressable>;
 };
 async function show(ref:string){
  setBusy(true);setMessage("");
  try{setDetail(await api<Detail>(token,base+"/"+ref));}
  catch(e){report(e)}finally{setBusy(false)}
 }
 async function send(attempt:Attempt,retry=false){
  if(busy||uncertain&&!retry)return;
  setBusy(true);setMessage("");
  try{
   await api(token,attempt.url,"POST",attempt.body);
   last.current=null;setUncertain(false);setPassword("");setRemarks("");
   setDetail(null);setMessage(attempt.label);
   try{await Promise.all([refresh(),onChanged()])}catch{
    setMessage(attempt.label+" Original review list refresh unavailable.");
   }
  }catch(e){
   const status=e&&typeof e==="object"&&"status" in e&&
    typeof e.status==="number"?e.status:503;
   setUncertain(status>=500);if(status<500)last.current=null;
   report(e);
  }finally{setBusy(false);}
 }
 function decide(action:"APPROVE"|"REJECT"){
  if(!canReview||!detail||!["SUBMITTED","IN_REVIEW"].includes(detail.status)||
   password.length<8||busy||uncertain)return;
  Alert.alert("Confirm independent CG03 review",
   action==="APPROVE"?
    "Approve this protected healthcare contribution for separate Foundation finalization?":
    "Reject this protected contribution? No patient award becomes effective.",[
    {text:"Cancel",style:"cancel"},
    {text:action==="APPROVE"?"Approve":"Reject",onPress:()=>{
     if(!detail)return;
     const attempt={url:base+"/"+detail.caseRef+"/decision",
      body:{requestKey:Crypto.randomUUID(),expectedRevision:detail.revision,
       action,remarks:remarks.trim(),currentPassword:password},
      label:action==="APPROVE"?"Independent decision recorded. Owner finalization remains required.":
       "Protected contribution rejected. No unapproved benefit is effective."};
     last.current=attempt;void send(attempt);
    }}
   ]);
 }
 function activate(policy:Policy){
  if(!canManage||!policy.reviewCaseRef||policy.reviewStatus!=="PENDING_OWNER"||
   password.length<8||busy||uncertain)return;
  Alert.alert("Finalize protected healthcare contribution?",
   "This is a separate owner action after a different protected CG03 reviewer. "+
   "Earlier assistance remains until finalization succeeds.",[
    {text:"Cancel",style:"cancel"},
    {text:"Finalize",onPress:()=>{
     if(!policy.reviewCaseRef)return;
     const attempt={url:"/api/v1/healthcare-assistance/policies/cases/"+
      policy.reviewCaseRef+"/activate",body:{currentPassword:password},
      label:"Genuine independently reviewed contribution policy finalized. "+
       "Patient eligibility remains independently required."};
     last.current=attempt;void send(attempt);
    }}
   ]);
 }
 const ready=policies.filter(p=>p.status==="PENDING_APPROVAL"&&
  p.reviewStatus==="PENDING_OWNER"&&p.reviewCaseRef);
 if(!canReview&&!canManage)return null;
 return <View style={s.panel}>
  <Text style={s.heading}>Protected healthcare contribution approval</Text>
  <Text style={s.body}>Full consultation and pharmacy, nursing or OT support
   are not activated by submission. Independent protected CG03 review and separate owner
   finalization are both required.</Text>
  {!!message&&<Text accessibilityRole="alert" style={s.notice}>{message}</Text>}
  <Text style={s.label}>Current account password for protected action</Text>
  <TextInput secureTextEntry autoComplete="current-password"
   accessibilityLabel="Current password for protected healthcare approval"
   value={password} maxLength={1024} editable={!busy&&!uncertain}
   onChangeText={setPassword} style={s.input}/>
  {uncertain&&<View style={s.panel}>
   <Text style={s.notice}>Unknown result. Do not create another decision.</Text>
   {button("Retry exactly the original approval request",()=>{
    if(last.current)void send(last.current,true);
   },busy||!last.current)}
   {button("Check original case status",()=>void refresh().catch(report),busy)}
  </View>}
  {canReview&&<>
   <Text style={s.heading}>Protected independent reviewer inbox</Text>
   {button("Refresh original reviews",()=>void refresh().catch(report),busy||uncertain)}
   {cases.length===0&&<Text style={s.body}>No original exception cases visible.</Text>}
   {cases.map(v=><View key={v.caseRef} style={s.row}>
    <Text style={s.body}>{v.reference} · {v.title}</Text>
    <Text style={s.body}>Original state: {v.status.replaceAll("_"," ")}</Text>
    {button("Inspect original case",()=>void show(v.caseRef),busy||uncertain)}
   </View>)}
   {detail&&<View style={s.row}>
    <Text style={s.heading}>Review {detail.reference}</Text>
    <Text style={s.body}>{detail.source.service} support:
      {" "}{detail.source.mode==="PERCENT"&&detail.source.percentBasisPoints!==null?
       (detail.source.percentBasisPoints/100).toFixed(2)+"%":
       cash(detail.source.fixedMinor)}
     {" · Cap "+cash(detail.source.capMinor)}. Valid
     {" "+new Date(detail.source.validFrom).toLocaleDateString("en-IN")} to
     {" "+new Date(detail.source.validUntil).toLocaleDateString("en-IN")}.</Text>
    <Text style={s.body}>Current source: {detail.status}. You cannot approve
     your own original policy request.</Text>
    {["SUBMITTED","IN_REVIEW"].includes(detail.status)&&<>
     <Text style={s.label}>Review remarks (optional)</Text>
     <TextInput value={remarks} maxLength={500} multiline style={s.input}
      editable={!busy&&!uncertain} onChangeText={setRemarks}/>
     {button("Approve for separate owner finalization",
      ()=>decide("APPROVE"),busy||uncertain||password.length<8)}
     {button("Reject original contribution policy",
      ()=>decide("REJECT"),busy||uncertain||password.length<8)}
    </>}
   </View>}
  </>}
  {canManage&&ready.length>0&&<>
   <Text style={s.heading}>Foundation finalization ready</Text>
   {ready.map(v=><View style={s.row} key={v.revisionRef}>
    <Text style={s.body}>{v.serviceKind} ·
     {" "+(v.percentBasisPoints===null?"—":(v.percentBasisPoints/100)+"%")}
     {" · Cap "+cash(v.capMinor)}. Decision remains
     pending Foundation application.</Text>
    {button("Finalize independent CG03 approval",()=>activate(v),
     busy||uncertain||password.length<8)}
   </View>)}
  </>}
 </View>;
}
const s=StyleSheet.create({
 panel:{backgroundColor:t.surface,borderWidth:1,borderColor:t.border,
  borderRadius:14,padding:12,gap:10},
 row:{borderWidth:1,borderColor:t.border,borderRadius:10,padding:10,gap:8},
 heading:{fontSize:16,fontWeight:"700",color:t.text},
 body:{fontSize:13,lineHeight:20,color:t.text},
 label:{fontSize:13,fontWeight:"600",color:t.text},
 notice:{fontSize:13,lineHeight:20,color:t.error},
 input:{minHeight:48,padding:12,borderWidth:1,borderColor:t.border,
  borderRadius:10,color:t.text},
 button:{minHeight:48,padding:12,justifyContent:"center",
  borderWidth:1,borderColor:t.border,borderRadius:10},
 buttonText:{fontSize:14,fontWeight:"600",color:t.text},
 disabled:{opacity:0.5}
});
