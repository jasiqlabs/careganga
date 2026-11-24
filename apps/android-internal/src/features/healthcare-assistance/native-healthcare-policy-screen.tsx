import {useCallback,useEffect,useRef,useState} from "react";
import {ActivityIndicator,Alert,Pressable,ScrollView,StyleSheet,
 Text,TextInput,View} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import * as Crypto from "expo-crypto";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";
import {NativeHealthcarePolicyApproval} from "./native-healthcare-policy-approval";

type Center={centerRef:string;name:string};
type Doctor={doctorRef:string;name:string};
type Kind="CONSULTATION"|"LAB"|"PHARMACY"|"NURSING"|"OT";
const KINDS:readonly Kind[]=["CONSULTATION","LAB","PHARMACY","NURSING","OT"];
type Policy={policyRef:string;revisionRef:string;centerRef:string;
 doctorRef:string|null;serviceKind:Kind;revision:number;
 validFrom:string;validUntil:string;mode:"PERCENT"|"FIXED";
 percentBasisPoints:number|null;fixedMinor:string|null;capMinor:string;
 status:string;current:boolean;reviewCaseRef:string|null;reviewStatus:string|null};
type Props={token:string;canView:boolean;canManage:boolean;canReview:boolean;onExit:()=>void;onExpired:()=>void};
type Attempt={parts:string;body:Record<string,unknown>;success:string};
type ServiceEstimate={state:"NO_APPROVED_SERVICE_POLICY"|"POLICY_ESTIMATE_ONLY";
 grossMinor:string;estimatedSupportMinor:string;estimatedPatientDueMinor:string;
 serviceKind:Kind;centerName:string;estimateOnly:true;caution:string};
type Estimate={state:string;grossMinor?:string;estimatedSupportMinor?:string;
 estimatedPatientDueMinor?:string;actualFeeVersion?:number;
 eligiblePatientVerified:false;caution?:string};
const money=(s:string|null)=>s&&/^\d+$/.test(s)?
 "₹"+(Number(s)/100).toFixed(2):"Not configured";
function paise(v:string){
 if(!/^(0|[1-9]\d{0,7})(?:\.\d{1,2})?$/.test(v))
  throw Error("Enter a valid amount, up to two decimal places.");
 const [major,minor=""]=v.split(".");
 const n=BigInt(major)*100n+BigInt((minor+"00").slice(0,2));
 if(n<1n||n>10000000000n)throw Error("The amount is outside approved policy limits.");
 return n.toString();
}
function basis(v:string){
 if(!/^(?:[0-9]{1,2}(?:\.\d{1,2})?|100(?:\.0{1,2})?)$/.test(v))
  throw Error("Enter a percentage from 0.01 to 100.00.");
 const [whole,part=""]=v.split(".");
 const n=Number(whole)*100+Number((part+"00").slice(0,2));
 if(n<1||n>10000)throw Error("Percentage outside permitted range.");
 return n;
}
const localInput=(value:string)=>{
 const d=new Date(value);
 if(!Number.isFinite(d.getTime()))return "";
 const two=(n:number)=>String(n).padStart(2,"0");
 return String(d.getFullYear())+"-"+two(d.getMonth()+1)+"-"+
  two(d.getDate())+"T"+two(d.getHours())+":"+two(d.getMinutes());
};
function instant(v:string){
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v))
  throw Error("Use local YYYY-MM-DDTHH:mm for start and end.");
 const d=new Date(v);
 if(!Number.isFinite(d.getTime())||localInput(d.toISOString())!==v)
  throw Error("Enter a genuine local date and time.");
 return d.toISOString();
}
async function api<T>(token:string,parts:string,
 method:"GET"|"POST"="GET",body?:object){
 const result=await identityRequest(
  "/api/v1/healthcare-assistance/policies/"+parts,{
   method,cache:"no-store",headers:{Authorization:"Bearer "+token,
    ...(body?{"Content-Type":"application/json"}:{})},
   body:body?JSON.stringify(body):undefined});
 if(!result.ok){
  const body:unknown=await result.json().catch(()=>null);
  const safe=body&&typeof body==="object"&&!Array.isArray(body)?
   body as Record<string,unknown>:null;
  const codes=new Set(["CG14_CENTER_SERVICE_NOT_VERIFIED",
   "ASSISTANCE_POLICY_INVALID","ASSISTANCE_POLICY_DATES_INVALID",
   "ASSISTANCE_POLICY_CAP_INVALID","ASSISTANCE_POLICY_PERCENT_INVALID",
   "ASSISTANCE_POLICY_SOURCE_CHANGED","ASSISTANCE_POLICY_REVISION_CHANGED",
   "ASSISTANCE_POLICY_OVERLAP_OR_REPLAY","ASSISTANCE_APPROVAL_NOT_READY",
   "ASSISTANCE_REVIEW_CHANGED","ASSISTANCE_INDEPENDENT_REVIEW_REQUIRED"]);
  const message=safe&&typeof safe.code==="string"&&codes.has(safe.code)&&
   typeof safe.message==="string"&&safe.message.length>=16&&
   safe.message.length<=220&&!/[<>\r\n]/.test(safe.message)?
   safe.message:null;
  throw Object.assign(new Error(message??
   (result.status===401?"Session expired. Sign in again.":
   result.status===403?"Your role cannot manage healthcare policies.":
   result.status===404?"Current center, doctor or policy is unavailable.":
   result.status===409?"Original policy changed. Refresh the revision before editing.":
   result.status===400?"Check current approved center, dates and support cap.":
   "Policy result is uncertain. Retry the exact original request.")),
   {status:result.status});
 }
 return result.json() as Promise<T>;
}
export function NativeHealthcarePolicyScreen({token,canView,canManage,canReview,
 onExit,onExpired}:Props){
 const [centers,setCenters]=useState<Center[]>([]),[center,setCenter]=useState("");
 const [doctors,setDoctors]=useState<Doctor[]>([]),[doctor,setDoctor]=useState("");
 const [policies,setPolicies]=useState<Policy[]>([]);
 const [estimate,setEstimate]=useState<Estimate|null>(null);
 const [quotedGross,setQuotedGross]=useState(""),
  [serviceEstimate,setServiceEstimate]=useState<ServiceEstimate|null>(null);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [message,setMessage]=useState(""),[uncertain,setUncertain]=useState(false);
 const [revision,setRevision]=useState<Policy|null>(null);
 const [service,setService]=useState<Kind>("CONSULTATION");
 const [mode,setMode]=useState<"PERCENT"|"FIXED">("PERCENT");
 const [percent,setPercent]=useState("50"),[fixed,setFixed]=useState("");
 const [cap,setCap]=useState("500");
 const [from,setFrom]=useState(""),[until,setUntil]=useState("");
 const last=useRef<Attempt|null>(null),seq=useRef(0);
 useEffect(()=>{setEstimate(null)},[center,doctor]);
 useEffect(()=>{setServiceEstimate(null)},[center,service,quotedGross]);
 const error=useCallback((e:unknown)=>{
  if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
  setMessage(e instanceof Error?e.message:"Original healthcare support data unavailable.");
 },[onExpired]);
 const refresh=useCallback(async(c:string)=>{
  const key=++seq.current;
  const result=await api<{policies:Policy[]}>(token,"centers/"+c);
  if(key!==seq.current)return;
  if(!Array.isArray(result.policies)||result.policies.length>100)
   throw Error("Original policy list cannot be verified.");
  setPolicies(result.policies);
 },[token]);
 useEffect(()=>{
  let active=true;setLoading(true);
  if(!canView){setLoading(false);return()=>{active=false};}
  void api<{centers:Center[]}>(token,"centers/eligible").then(v=>{
   if(!active)return;
   if(!Array.isArray(v.centers)||v.centers.length>100)
    throw Error("Verified center list unavailable.");
   setCenters(v.centers);
   if(v.centers.length===1)setCenter(v.centers[0].centerRef);
  }).catch(e=>{if(active)error(e)}).finally(()=>{if(active)setLoading(false)});
  return()=>{active=false;++seq.current};
 },[token,error,canView]);
 useEffect(()=>{
  ++seq.current;setPolicies([]);setDoctors([]);setDoctor("");
  setRevision(null);setUncertain(false);last.current=null;setMessage("");
  if(!center)return;
  setLoading(true);
  void Promise.all([
   refresh(center),
   api<{doctors:Doctor[]}>(token,"centers/"+center+"/doctors")
    .then(x=>setDoctors(x.doctors))
  ]).catch(error).finally(()=>setLoading(false));
 },[center,token,refresh,error]);
 const button=(label:string,press:()=>void,disabled=false,active=false)=>
  <Pressable accessibilityRole="button" accessibilityState={{disabled,selected:active}}
   disabled={disabled} onPress={press}
   style={[s.button,active&&s.active,disabled&&s.disabled]}>
   <Text style={s.buttonLabel}>{label}</Text>
  </Pressable>;
 const input=(label:string,value:string,change:(next:string)=>void)=>
  <View style={s.field}><Text style={s.fieldLabel}>{label}</Text>
   <TextInput accessibilityLabel={label} value={value} onChangeText={change}
    editable={!busy&&!uncertain} style={s.input} placeholderTextColor={t.mutedText}
    autoCapitalize="none"/></View>;
 async function previewPartnerService(){
  if(!center||service==="CONSULTATION"||busy||uncertain)return;
  setBusy(true);setMessage("");setServiceEstimate(null);
  try{
   const grossMinor=paise(quotedGross);
   const result=await api<ServiceEstimate>(token,
    "centers/"+center+"/services/"+service+"/estimate?grossMinor="+grossMinor);
   if(result.estimateOnly!==true||result.serviceKind!==service)
    throw Error("The original partner estimate could not be verified.");
   setServiceEstimate(result);
  }catch(e){error(e);}
  finally{setBusy(false);}
 }
 function reset(){
  setRevision(null);setService("CONSULTATION");setMode("PERCENT");
  setPercent("50");setFixed("");setCap("500");setFrom("");setUntil("");
 }
 function edit(v:Policy){
  if(v.status!=="ACTIVE"||!canManage)return;
  setRevision(v);setService(v.serviceKind);setDoctor(v.doctorRef??"");
  setMode(v.mode);setPercent(v.percentBasisPoints===null?"50":
   (v.percentBasisPoints/100).toFixed(2));
  setFixed(v.fixedMinor?String(Number(v.fixedMinor)/100):"");
  setCap(String(Number(v.capMinor)/100));
  setFrom(localInput(v.validFrom));setUntil(localInput(v.validUntil));
  setMessage("New revision only. Previously accepted amounts stay unchanged.");
 }
 async function preview(){
  if(!center||!doctor||busy||uncertain)return;
  setBusy(true);setEstimate(null);
  try{
   setEstimate(await api<Estimate>(token,
    "centers/"+center+"/doctors/"+doctor+"/estimate"));
  }catch(e){error(e)}finally{setBusy(false);}
 }
 async function submitOriginal(attempt:Attempt,retry=false){
  if(busy||uncertain&&!retry)return;
  setBusy(true);setMessage("");
  try{
   const output=await api<{status:string;warning?:string;replayed?:boolean}>(
    token,attempt.parts,"POST",attempt.body);
   setUncertain(false);last.current=null;
   setMessage(output.status==="PENDING_APPROVAL"?
    output.warning??"Awaiting genuine approval/source. No patient support is effective.":
    attempt.success+(output.replayed?" Original request recovered.":""));
   try{await refresh(center)}catch{setMessage(
    "Policy response recorded, but the current list could not be refreshed.");}
   if(attempt.parts==="submit")reset();
  }catch(e){
   const code=e&&typeof e==="object"&&"status" in e&&
    typeof e.status==="number"?e.status:503;
   setUncertain(code>=500);last.current=code>=500?attempt:null;
   error(e);
  }finally{setBusy(false);}
 }
 function submit(){
  if(!canManage||!center||busy||uncertain)return;
  try{
   const validFrom=instant(from),validUntil=instant(until);
   if(validUntil<=validFrom)throw Error("End time must follow the start time.");
   const body:Record<string,unknown>={
    requestKey:Crypto.randomUUID(),...(revision?{policyRef:revision.policyRef}:{}),
    expectedRevision:revision?.revision??0,centerRef:center,
    doctorRef:doctor||null,serviceKind:service,validFrom,validUntil,
    mode,...(mode==="PERCENT"?{percentBasisPoints:basis(percent)}:
     {fixedMinor:paise(fixed)}),capMinor:paise(cap)
   };
   const attempt={parts:"submit",body,success:"Original policy revision saved."};
   last.current=attempt;void submitOriginal(attempt);
  }catch(e){error(e);}
 }
 function withdraw(v:Policy){
  if(!canManage||v.status!=="ACTIVE"||uncertain)return;
  Alert.alert("Withdraw contribution policy?",
   "This will stop new assistance from this policy. Historical accepted amounts remain.",
   [{text:"Cancel",style:"cancel"},{text:"Withdraw",style:"destructive",onPress:()=>{
    const attempt={parts:v.policyRef+"/withdraw",
     body:{expectedRevision:v.revision},
     success:"Policy withdrawn. Previously accepted amounts remain unchanged."};
    last.current=attempt;void submitOriginal(attempt);
   }}]);
 }
 return <SafeAreaView style={s.page} edges={["left","right"]}>
  <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.container}>
   {button("Back to Foundation home",onExit,busy||uncertain)}
   <Text accessibilityRole="header" style={s.title}>Foundation Contribution Policies</Text>
   <Text style={s.note}>Only current CG14 verified centers and doctors. The 50%
    standard is eligible-policy dependent, not an unconditional patient discount.
    No funds are collected here.</Text>
   {!!message&&<Text accessibilityRole="alert" style={s.notice}>{message}</Text>}
   {loading&&<ActivityIndicator accessibilityLabel="Checking policy source"/>}
   {canView&&!loading&&centers.length===0&&<Text style={s.note}>
    No currently approved provider centers available.</Text>}
   {canView&&centers.map(c=><View key={c.centerRef}>{button(c.name,()=>setCenter(c.centerRef),
    busy||uncertain,center===c.centerRef)}</View>)}
   {uncertain&&<View style={s.panel}>
    <Text style={s.notice}>The last command might have succeeded. Check the
     original revision or retry the exact same command, never a new one.</Text>
    {button("Retry exact original command",()=>{
     if(last.current)void submitOriginal(last.current,true);
    },busy||!last.current)}
    {button("Check existing policy history",()=>void refresh(center).catch(error),busy||!center)}
   </View>}
   {canManage&&canView&&!!center&&!uncertain&&<View style={s.panel}>
    <Text style={s.heading}>{revision?"Revise approved support":"Configure support"}</Text>
    <Text accessibilityRole="header" style={s.heading}>1. Service &amp; eligibility scope</Text>
    <Text style={s.note}>Service type</Text>
    {KINDS.map(k=><View key={k}>{button(k,()=>{
       setService(k);if(k!=="CONSULTATION")setDoctor("");},
     busy||!!revision,service===k)}</View>)}
    {service==="CONSULTATION"&&<Text style={s.note}>Doctor-specific policy (optional)</Text>}
    {service==="CONSULTATION"&&button("Center-wide verified eligibility",()=>setDoctor(""),
     busy||!!revision,doctor==="")}
    {service==="CONSULTATION"&&doctors.map(d=><View key={d.doctorRef}>
     {button(d.name,()=>setDoctor(d.doctorRef),
      busy||!!revision,doctor===d.doctorRef)}</View>)}
    {!!doctor&&<View style={s.panel}>
     <Text style={s.heading}>Current approved fee estimate</Text>
     <Text style={s.note}>Read-only amount from original CG14 approved
      consultation fee plus current effective policy. Not a patient award
      or accepted payment.</Text>
     {button("Check real fee and capped support",
      ()=>void preview(),busy||uncertain)}
     {estimate&&<Text accessibilityRole="alert" style={s.note}>
      {estimate.state==="POLICY_ESTIMATE_ONLY"?
       "Gross "+money(estimate.grossMinor??null)+
       " · estimated Foundation support "+money(estimate.estimatedSupportMinor??null)+
       " · estimated patient due "+money(estimate.estimatedPatientDueMinor??null)+
       ". Patient eligibility NOT verified.":
       estimate.state==="NO_EFFECTIVE_POLICY"?
       "Approved consultation fee exists but no current support policy.":
       "No approved current consultation fee is available."}
     </Text>}
    </View>}
    {service!=="CONSULTATION"&&<View style={s.panel}>
     <Text style={s.heading}>Estimated partner service contribution</Text>
     <Text style={s.note}>Partner-quoted amount only. The original invoice,
      patient consent, completed service and bank collection have not been
      verified. This does not approve any payment or Foundation payable.</Text>
     <Text style={s.fieldLabel}>Partner-quoted gross amount (₹)</Text>
     <TextInput accessibilityLabel="Partner-quoted gross amount in rupees"
      value={quotedGross} onChangeText={setQuotedGross} editable={!busy}
      keyboardType="decimal-pad" maxLength={14} style={s.input}
      placeholder="1000.00" placeholderTextColor={t.mutedText}/>
     {button("Calculate provisional Foundation share",
      ()=>void previewPartnerService(),busy||uncertain||!quotedGross)}
     {serviceEstimate&&<Text accessibilityLiveRegion="polite" style={s.note}>
      {serviceEstimate.state==="POLICY_ESTIMATE_ONLY"?
       "Quoted gross "+money(serviceEstimate.grossMinor)+
       " · estimated Foundation share "+money(serviceEstimate.estimatedSupportMinor)+
       " · estimated patient payable "+money(serviceEstimate.estimatedPatientDueMinor):
       "No active approved contribution. Patient-quoted total "+
        money(serviceEstimate.grossMinor)}.
      {" "}{serviceEstimate.caution}
     </Text>}
    </View>}
    <Text accessibilityRole="header" style={s.heading}>2. Contribution &amp; maximum support</Text>
    <Text style={s.note}>Assistance type</Text>
    {button("Percentage",()=>setMode("PERCENT"),busy,mode==="PERCENT")}
    {button("Fixed rupee support",()=>setMode("FIXED"),busy,mode==="FIXED")}
    {mode==="PERCENT"?input("Foundation support percentage (e.g. 50.00)",
     percent,setPercent):input("Foundation fixed support in rupees",fixed,setFixed)}
    {input("Support cap in rupees",cap,setCap)}
    <Text accessibilityRole="header" style={s.heading}>3. Effective dates</Text>
    <Text style={s.note}>Dates in your local time (YYYY-MM-DDTHH:mm), end exclusive.</Text>
    {input("Valid from (local)",from,setFrom)}
    {input("Valid until (local)",until,setUntil)}
    <Text style={s.note}>Patient-care consent/identity are checked by CG15
     when a service is accepted. All pharmacy, nursing, OT and 100% consultation policies need a
     genuine independent CG03 review and Foundation finalization.
     No unverified service discount
     becomes active from this screen.</Text>
    {button(busy?"Checking original…":revision?"Save policy revision":"Create policy",submit,busy)}
    {revision&&button("Cancel revision",reset,busy)}
   </View>}
   {canView&&!!center&&<View style={s.panel}>
    <Text style={s.heading}>Actual policy revisions</Text>
    {button("Refresh history",()=>void refresh(center).catch(error),busy||uncertain)}
    {policies.length===0&&!loading&&<Text style={s.note}>
     No assistance policy is configured for this center.</Text>}
    {policies.map(p=><View key={p.revisionRef} style={s.row}>
     <Text style={s.heading}>{p.serviceKind} · {p.doctorRef?
      doctors.find(d=>d.doctorRef===p.doctorRef)?.name??"Previously verified doctor":
      "Center-wide"}</Text>
     <Text style={s.note}>{p.mode==="PERCENT"?
      ((p.percentBasisPoints??0)/100)+"%":money(p.fixedMinor)}
      {" · Cap "+money(p.capMinor)}</Text>
     <Text style={s.note}>From {new Date(p.validFrom).toLocaleDateString("en-IN")}
      {" through "+new Date(p.validUntil).toLocaleDateString("en-IN")}</Text>
     <Text style={s.note}>State: {p.status==="ACTIVE"&&p.current?
      "effective (requires patient eligibility)":p.status==="ACTIVE"?
      "approved, outside effective dates":p.status==="PENDING_APPROVAL"?
      "pending — not effective":p.status.toLowerCase().replaceAll("_"," ")}</Text>
     {canManage&&p.status==="ACTIVE"&&<>
      {button("Revise this policy",()=>edit(p),busy||uncertain)}
      {button("Withdraw policy",()=>withdraw(p),busy||uncertain)}
     </>}
    </View>)}
   </View>}
   <NativeHealthcarePolicyApproval token={token} canReview={canReview}
    canManage={canManage} policies={policies} onExpired={onExpired}
    onChanged={async()=>{if(center)await refresh(center);}}/>
  </ScrollView>
 </SafeAreaView>;
}
const s=StyleSheet.create({
 page:{flex:1,backgroundColor:t.adminCanvas},
 container:{padding:16,paddingBottom:110,gap:12},
 title:{fontSize:22,fontWeight:"700",color:t.text},
 heading:{fontSize:16,fontWeight:"700",color:t.text},
 note:{fontSize:13,lineHeight:20,color:t.mutedText},
 notice:{fontSize:13,lineHeight:20,color:t.error},
 panel:{padding:14,gap:10,backgroundColor:t.surface,
  borderRadius:14,borderWidth:1,borderColor:t.border},
 row:{padding:10,gap:8,borderWidth:1,borderRadius:12,borderColor:t.border},
 field:{gap:5},fieldLabel:{fontSize:13,fontWeight:"600",color:t.text},
 input:{minHeight:48,borderColor:t.border,borderWidth:1,
  borderRadius:10,padding:12,color:t.text},
 button:{minHeight:48,padding:11,borderColor:t.border,borderWidth:1,
  borderRadius:10,justifyContent:"center"},
 buttonLabel:{fontSize:14,fontWeight:"600",color:t.text},
 active:{borderColor:t.primary,backgroundColor:t.selectedSurface},
 disabled:{opacity:0.5}
});
