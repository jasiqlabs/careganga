import {useCallback,useEffect,useRef,useState} from "react";
import {ActivityIndicator,Alert,Pressable,StyleSheet,Text,TextInput,View}
 from "react-native";
import * as Crypto from "expo-crypto";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";
type Association={associationRef:string;centerRef?:string;doctorRef?:string;
 name:string;status:string;version:number;centerStatus?:string;
 specialties?:string[]};
type Candidate={centerRef?:string;doctorRef?:string;name:string;
 providerName?:string;pinCode?:string;specialties?:string[]};
type Fee={feeRef:string;feeKind:string;consultationMode:string;amountMinor:number;
 status:string;effectiveFromUtc:string;effectiveToUtc:string|null;
 current:boolean;version:number};
type Props={token:string;onExpired:()=>void;doctorRef?:string;centerRef?:string;
 canManage:boolean;canVerify:boolean};
const money=(x:number)=>"₹"+(x/100).toLocaleString("en-IN",{
 minimumFractionDigits:2,maximumFractionDigits:2});
const feeAmount=(x:string)=>{
 if(!/^(0|[1-9]\d{0,7})(?:\.\d{1,2})?$/.test(x.trim()))
  throw Error("Enter a nonnegative fee in rupees, with at most two decimals.");
 const [rupees,paise=""]=x.trim().split(".");
 return Number(rupees)*100+Number(paise.padEnd(2,"0"));
};
const textLabel=(x:string)=>x.replaceAll("_"," ").toLowerCase()
 .replace(/\b\w/g,c=>c.toUpperCase());
async function api<T>(token:string,path:string,method:"GET"|"POST"="GET",
 body?:object){
 const res=await identityRequest("/api/v1/health-network/"+path,{
  method,cache:"no-store",headers:{Authorization:"Bearer "+token,
   ...(body?{"Content-Type":"application/json"}:{})},
  ...(body?{body:JSON.stringify(body)}:{})});
 if(!res.ok)throw Object.assign(new Error(
  res.status===401?"Sign in again.":
  res.status===403?"Your current clinician or center permission denies this action.":
  res.status===409?"Current association or fee version changed; refresh.":
  "The original professional fee source is unavailable."
 ),{status:res.status});
 return res.json() as Promise<T>;
}
export function NativeDoctorCenterFees({token,onExpired,doctorRef,centerRef,
 canManage,canVerify}:Props){
 const own=!!centerRef&&!doctorRef;
 const base=own?"my-centers/"+encodeURIComponent(centerRef??"")+"/doctors":
  "doctors/"+encodeURIComponent(doctorRef??"")+"/centers";
 const [links,setLinks]=useState<Association[]>([]);
 const [options,setOptions]=useState<Candidate[]>([]);
 const [query,setQuery]=useState(""),[candidate,setCandidate]=useState("");
 const [active,setActive]=useState("");
 const [fees,setFees]=useState<Fee[]>([]);
 const [kind,setKind]=useState("CONSULTATION"),[mode,setMode]=useState("IN_PERSON");
 const [rupees,setRupees]=useState(""),[from,setFrom]=useState("");
 const [until,setUntil]=useState("");
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [uncertain,setUncertain]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const key=useRef<Record<string,string>>({});
 const epoch=useRef(0);
 const report=useCallback((error:unknown)=>{
  if(error&&typeof error==="object"&&"status" in error&&error.status===401)
   onExpired();
  if(!(error&&typeof error==="object"&&"status" in error&&
   typeof error.status==="number"&&error.status<500))
   setUncertain(true);
  setError(error instanceof Error?error.message:"Original fee status unavailable.");
 },[onExpired]);
 const load=useCallback(async()=>{
  const result=await api<{centers?:Association[];doctors?:Association[]}>(token,base);
  const list=own?result.doctors:result.centers;
  if(!Array.isArray(list))throw Error("Original doctor association list unavailable.");
  setLinks(list);
 },[token,base,own]);
 const feeRoute=(link:Association)=>own?
  base+"/"+encodeURIComponent(link.doctorRef??"")+
   "/associations/"+encodeURIComponent(link.associationRef)+"/fees":
  base+"/"+encodeURIComponent(link.associationRef)+"/fees";
 const loadFees=useCallback(async(path:string)=>{
  const turn=++epoch.current;
  const result=await api<{fees:Fee[]}>(token,path);
  if(turn===epoch.current){
   if(!Array.isArray(result.fees))throw Error("Original fee history unavailable.");
   setFees(result.fees);
  }
 },[token]);
 useEffect(()=>{
  let live=true;setLoading(true);setLinks([]);setActive("");
  setFees([]);setUncertain(false);++epoch.current;
  void load().catch(e=>{if(live)report(e)})
   .finally(()=>{if(live)setLoading(false)});
  return()=>{live=false;++epoch.current};
 },[load,report]);
 const button=(label:string,act:()=>void,disabled=false)=>
  <Pressable accessibilityRole="button" disabled={disabled}
   accessibilityState={{disabled}} onPress={act}
   style={[styles.button,disabled&&styles.disabled]}>
   <Text style={styles.text}>{label}</Text>
  </Pressable>;
 const input=(name:string,value:string,onChange:(s:string)=>void,max=120)=>
  <View style={styles.field}>
   <Text style={styles.note}>{name}</Text>
   <TextInput accessibilityLabel={name} style={styles.input} value={value}
    maxLength={max} onChangeText={onChange} editable={!busy&&!uncertain}/>
  </View>;
 async function candidates(){
  if(busy||uncertain)return;
  setBusy(true);setError("");setOptions([]);setCandidate("");
  const url=own?
   "my-centers/"+encodeURIComponent(centerRef??"")+
    "/eligible-doctors?q="+encodeURIComponent(query.trim()):
   "doctors/eligible-centers?q="+encodeURIComponent(query.trim());
  try{
   const result=await api<{centers?:Candidate[];doctors?:Candidate[]}>(token,url);
   const items=own?result.doctors:result.centers;
   if(!Array.isArray(items))throw Error("No currently verified candidates available.");
   setOptions(items);
  }catch(e){report(e)}finally{setBusy(false)}
 }
 async function write(op:string,path:string,payload:object,after:()=>Promise<void>){
  if(busy||uncertain)return;
  setBusy(true);setError("");setNotice("");
  if(!key.current[op])key.current[op]=Crypto.randomUUID();
  try{
   await api(token,path,"POST",{...payload,requestKey:key.current[op]});
   delete key.current[op];setUncertain(false);
   await after();
   setNotice("Original doctor and center source updated. Approval remains separate.");
  }catch(e){
   if(e&&typeof e==="object"&&"status" in e&&
    typeof e.status==="number"&&e.status<500)delete key.current[op];
   report(e);
  }finally{setBusy(false)}
 }
 async function proposeAssociation(){
  if(!canManage||!candidate)return;
  const ref=own?"my-centers/"+encodeURIComponent(centerRef??"")+"/doctors":
   "doctors/"+encodeURIComponent(doctorRef??"")+"/centers";
  await write("link:"+candidate,ref,own?{doctorRef:candidate}:{centerRef:candidate},
   async()=>{setCandidate("");setOptions([]);await load()});
 }
 async function changeAssociation(item:Association,action:"approve"|"suspend"){
  if(own||!canVerify)return;
  const path=base+"/"+encodeURIComponent(item.associationRef)+"/"+action;
  await write(action+":"+item.associationRef,path,{expectedVersion:item.version},
   async()=>{await load();if(active===item.associationRef)await loadFees(feeRoute(item))});
 }
 async function select(item:Association){
  setActive(item.associationRef);setFees([]);setError("");++epoch.current;
  if(item.status!=="APPROVED")return;
  try{await loadFees(feeRoute(item))}catch(e){report(e)}
 }
 async function proposeFee(item:Association){
  if(!canManage||item.status!=="APPROVED")return;
  try{
   const amount=feeAmount(rupees),start=new Date(from);
   const end=until?new Date(until):null;
   if(!from||!Number.isFinite(start.getTime())||
    (end&&(!Number.isFinite(end.getTime())||end.getTime()<=start.getTime())))
    throw Error("Choose valid fee effective date/time and later optional end.");
   await write("propose-fee:"+item.associationRef,feeRoute(item),{
    expectedAssociationVersion:item.version,feeKind:kind,
    consultationMode:mode,amountMinor:amount,
    effectiveFromUtc:start.toISOString(),effectiveToUtc:end?.toISOString()??null
   },async()=>{
    await loadFees(feeRoute(item));setRupees("");setFrom("");setUntil("");
   });
  }catch(e){report(e)}
 }
 async function approveFee(item:Association,fee:Fee){
  if(own||!canVerify||fee.status!=="PROPOSED")return;
  await write("approve-fee:"+fee.feeRef,feeRoute(item)+"/"+
   encodeURIComponent(fee.feeRef)+"/approve",{expectedVersion:fee.version},
   async()=>await loadFees(feeRoute(item)));
 }
 const selected=links.find(x=>x.associationRef===active);
 return <View style={styles.panel}>
  <Text style={styles.heading}>{own?"Doctors at this center":
   "Doctor's approved center associations"}</Text>
  <Text style={styles.note}>Only current verified clinicians and centers may
   be assigned. Proposed fees never become active without independent approval.</Text>
  {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
  {!!notice&&<Text accessibilityRole="alert" style={styles.note}>{notice}</Text>}
  {loading&&<ActivityIndicator accessibilityLabel="Loading original doctor associations"/>}
  {uncertain&&<Text style={styles.error}>Last action may have succeeded.
   Refresh the original source and fees before another request.</Text>}
  {button("Refresh original doctor associations",()=>{
   setUncertain(false);key.current={};setLoading(true);
   void load().catch(report).finally(()=>setLoading(false));
  },busy)}
  {canManage&&<View style={styles.panel}>
   <Text style={styles.heading}>{own?"Find verified doctors":
    "Find verified healthcare centers"}</Text>
   {input("Search eligible name",query,setQuery,80)}
   {button("Search current verified options",()=>void candidates(),busy||uncertain)}
   {options.map(item=>{
    const ref=own?item.doctorRef:item.centerRef;
    if(!ref)return null;
    return <View key={ref}>{button((candidate===ref?"✓ ":"")+item.name,
     ()=>setCandidate(ref),busy||uncertain)}</View>;
   })}
   {button("Propose original association for Foundation review",()=>Alert.alert(
    "Request this clinician-center association?",
    "Association is pending and no unapproved clinical or fee access is granted.",[
     {text:"Cancel",style:"cancel"},
     {text:"Propose",onPress:()=>void proposeAssociation()}
    ]),busy||uncertain||!candidate)}
  </View>}
  {links.map(item=><View key={item.associationRef} style={styles.panel}>
   <Text style={styles.heading}>{item.name} · {textLabel(item.status)}</Text>
   {button("Show original fee history",()=>void select(item),busy||uncertain)}
   {!own&&canVerify&&item.status==="PENDING"&&
    button("Independently approve this center association",()=>Alert.alert(
     "Approve verified association?","This is not a fee approval.",[
      {text:"Cancel",style:"cancel"},
      {text:"Approve",onPress:()=>void changeAssociation(item,"approve")}
     ]),busy||uncertain)}
   {!own&&canVerify&&item.status==="APPROVED"&&
    button("Suspend this doctor-center association",()=>Alert.alert(
     "Suspend clinician at this center?","Previously recorded fees stay in history.",[
      {text:"Cancel",style:"cancel"},
      {text:"Suspend",style:"destructive",
       onPress:()=>void changeAssociation(item,"suspend")}
     ]),busy||uncertain)}
  </View>)}
  {selected&&selected.status==="APPROVED"&&<View style={styles.panel}>
   <Text style={styles.heading}>Original center fee history</Text>
   {fees.map(f=><View key={f.feeRef} style={styles.panel}>
    <Text style={styles.note}>{textLabel(f.feeKind)} · {textLabel(f.consultationMode)}
     · {money(f.amountMinor)}</Text>
    <Text style={styles.note}>{textLabel(f.status)} ·
     {f.current?"Current":"Historical/proposed"} ·
     Effective {new Date(f.effectiveFromUtc).toLocaleDateString("en-IN")}</Text>
    {!own&&canVerify&&f.status==="PROPOSED"&&
     button("Independently approve fee version",()=>Alert.alert(
      "Approve original clinician fee?",
      "Approved fee effective dates follow original CG14 source rules.",[
       {text:"Cancel",style:"cancel"},
       {text:"Approve",onPress:()=>void approveFee(selected,f)}
      ]),busy||uncertain)}
   </View>)}
   {canManage&&<>
    <Text style={styles.heading}>Propose fee (not yet approved)</Text>
    {button("Consultation"+(kind==="CONSULTATION"?" ✓":""),()=>setKind("CONSULTATION"),
     busy||uncertain)}
    {button("Follow-up"+(kind==="FOLLOW_UP"?" ✓":""),()=>setKind("FOLLOW_UP"),
     busy||uncertain)}
    {button("In-person"+(mode==="IN_PERSON"?" ✓":""),()=>setMode("IN_PERSON"),
     busy||uncertain)}
    {button("Video"+(mode==="VIDEO"?" ✓":""),()=>setMode("VIDEO"),
     busy||uncertain)}
    {input("Fee in rupees",rupees,setRupees,12)}
    {input("Effective from (ISO date-time)",from,setFrom,36)}
    {input("Effective until (ISO date-time, optional)",until,setUntil,36)}
    {button("Submit proposed fee for independent review",()=>Alert.alert(
     "Propose this original clinic fee?",
     "The prior approved fee remains current until separate approval.",[
      {text:"Cancel",style:"cancel"},
      {text:"Propose",onPress:()=>void proposeFee(selected)}
     ]),busy||uncertain||!rupees||!from)}
   </>}
  </View>}
 </View>;
}
const styles=StyleSheet.create({
 panel:{backgroundColor:t.surface,borderWidth:1,borderColor:t.border,
  borderRadius:12,padding:10,gap:9},
 heading:{fontSize:15,fontWeight:"700",color:t.text},
 text:{color:t.text,fontSize:13,fontWeight:"600"},
 note:{color:t.mutedText,fontSize:12,lineHeight:18},
 input:{backgroundColor:t.surface,borderColor:t.border,borderWidth:1,
  borderRadius:9,color:t.text,padding:10,minHeight:44},
 field:{gap:4},
 button:{borderColor:t.border,borderWidth:1,borderRadius:9,
  padding:10,minHeight:45,justifyContent:"center"},
 disabled:{opacity:.4},error:{color:"#A52626",fontSize:13}
});
