import {useCallback,useEffect,useRef,useState} from "react";
import {ActivityIndicator,Alert,Pressable,StyleSheet,Text,TextInput,View} from "react-native";
import * as Crypto from "expo-crypto";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";
type Row={reviewRef:string;status:string;version:number;
 sourceVirtualPatientId:string;canonicalVirtualPatientId:string;
 proposedByCurrentAccount:boolean;proposedAt:string};
type Person={virtualPatientId:string;firstName:string;lastName:string;
 dateOfBirth:string|null;profileStatus:string;identityCheckedInPerson:boolean;
 verificationRecordedAt:string|null;originalVerificationCenter:string|null};
type Evidence={source:Person;proposedCanonical:Person;message:string};
type Props={token:string;onExpired:()=>void};
const id=/^CGP-[A-F0-9]{16}$/;
async function api<T>(token:string,path:string,method:"GET"|"POST"="GET",
 body?:object):Promise<T>{
 const response=await identityRequest(
  "/api/v1/appointments/admin/patients/duplicate-reviews"+path,{
   method,cache:"no-store",headers:{Authorization:"Bearer "+token,
    ...(body?{"Content-Type":"application/json"}:{})},
   ...(body?{body:JSON.stringify(body)}:{})});
 if(!response.ok){
  const data:unknown=await response.json().catch(()=>null);
  throw Object.assign(new Error(data&&typeof data==="object"&&
   "message" in data&&typeof data.message==="string"?
    data.message:response.status===401?"Sign in again.":
    "Current independent identity review could not be confirmed."),{status:response.status});
 }
 return response.json() as Promise<T>;
}
export function NativeFoundationDuplicateReviews({token,onExpired}:Props){
 const [rows,setRows]=useState<Row[]>([]);
 const [source,setSource]=useState(""),[canonical,setCanonical]=useState("");
 const [confirmed,setConfirmed]=useState(false);
 const [selected,setSelected]=useState("");
 const [evidence,setEvidence]=useState<Evidence|null>(null);
 const [reviewed,setReviewed]=useState(false),[password,setPassword]=useState("");
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(false);
 const [uncertain,setUncertain]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const req=useRef<{pair:string;key:string}|null>(null);
 const fail=useCallback((e:unknown)=>{
  if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
  setError(e instanceof Error?e.message:"The original identity review is unavailable.");
 },[onExpired]);
 const refresh=useCallback(async()=>{
  const data=await api<{items:Row[]}>(token,"");
  if(!data||!Array.isArray(data.items)||data.items.length>30)
   throw Error("Original protected review list could not be verified.");
  setRows(data.items);setUncertain(false);
 },[token]);
 useEffect(()=>{
  let live=true;setLoading(true);
  void refresh().catch(e=>{if(live)fail(e)})
   .finally(()=>{if(live)setLoading(false)});
  return()=>{live=false};
 },[refresh,fail]);
 const button=(label:string,run:()=>void,disabled=false)=>
  <Pressable accessibilityRole="button" disabled={disabled}
   accessibilityState={{disabled}} onPress={run}
   style={[styles.button,disabled&&styles.disabled]}>
   <Text style={styles.text}>{label}</Text>
  </Pressable>;
 async function propose(){
  const pair=source+"|"+canonical;
  if(busy||uncertain||!confirmed||!id.test(source)||!id.test(canonical)||
   source===canonical)return;
  if(req.current?.pair!==pair)
   req.current={pair,key:Crypto.randomUUID()};
  setBusy(true);setError("");setNotice("");
  try{
   await api(token,"","POST",{requestKey:req.current.key,
    sourceVirtualPatientId:source,canonicalVirtualPatientId:canonical,
    possibleDuplicateConfirmed:true});
   await refresh();req.current=null;setSource("");setCanonical("");
   setConfirmed(false);setNotice("Possible duplicate submitted for independent review. No record was merged.");
  }catch(e){setUncertain(true);fail(e)}
  finally{setBusy(false)}
 }
 async function open(ref:string){
  if(busy||uncertain)return;
  setSelected(ref);setEvidence(null);setReviewed(false);setPassword("");
  setLoading(true);setError("");
  try{
   const data=await api<Evidence>(token,"/"+encodeURIComponent(ref)+"/evidence");
   if(!data.source||!data.proposedCanonical)
    throw Error("Original identity proof is incomplete.");
   setEvidence(data);
  }catch(e){fail(e)}
  finally{setLoading(false)}
 }
 async function decide(decision:"APPROVE"|"REJECT"){
  const item=rows.find(x=>x.reviewRef===selected);
  if(!item||item.status!=="PENDING"||item.proposedByCurrentAccount||
   !evidence||password.length<8||(decision==="APPROVE"&&!reviewed)||
   busy||uncertain)return;
  setBusy(true);setNotice("");setError("");
  try{
   const res=await api<{message:string}>(token,"/"+encodeURIComponent(selected)+
    "/decision","POST",{decision,expectedVersion:item.version,
    currentPassword:password,samePersonEvidenceReviewed:decision==="APPROVE"&&reviewed});
   setSelected("");setEvidence(null);setReviewed(false);setPassword("");
   await refresh();setNotice(res.message);
  }catch(e){setPassword("");setReviewed(false);setUncertain(true);fail(e)}
  finally{setBusy(false)}
 }
 const person=(label:string,p:Person)=><View style={styles.evidence}>
  <Text style={styles.heading}>{label}</Text>
  <Text style={styles.text}>{p.virtualPatientId} · {p.firstName} {p.lastName}</Text>
  <Text style={styles.note}>DOB: {p.dateOfBirth??"Not recorded"} · {p.profileStatus}</Text>
  <Text style={styles.note}>In-person verification: {
   p.identityCheckedInPerson?"Recorded":"Not verified"}</Text>
  {!!p.originalVerificationCenter&&<Text style={styles.note}>
   Verified center: {p.originalVerificationCenter}</Text>}
 </View>;
 return <View style={styles.wrap}>
  <Text style={styles.heading}>Restricted duplicate patient identity reviews</Text>
  <Text style={styles.note}>A shared name or family contact does not prove two
   patients are the same person. Nothing here merges records or clinical access.</Text>
  {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
  {!!notice&&<Text accessibilityRole="alert" style={styles.note}>{notice}</Text>}
  {uncertain&&<Text style={styles.error}>An outcome may have committed.
   Refresh the original review inbox before another action.</Text>}
  {button("Refresh protected reviews",()=>{setLoading(true);setError("");
   void refresh().catch(fail).finally(()=>setLoading(false));},busy)}
  {loading&&<ActivityIndicator accessibilityLabel="Loading original identity reviews"/>}
  <Text style={styles.heading}>Flag possible duplicate</Text>
  <TextInput accessibilityLabel="Source Virtual Patient ID" style={styles.input}
   value={source} placeholder="CGP-XXXXXXXXXXXXXXXX" maxLength={20}
   onChangeText={v=>{setSource(v.trim().toUpperCase());req.current=null;}}
   editable={!busy&&!uncertain} autoCapitalize="characters"/>
  <TextInput accessibilityLabel="Proposed canonical Virtual Patient ID"
   style={styles.input} value={canonical} placeholder="CGP-XXXXXXXXXXXXXXXX"
   maxLength={20} onChangeText={v=>{setCanonical(v.trim().toUpperCase());req.current=null;}}
   editable={!busy&&!uncertain} autoCapitalize="characters"/>
  {button((confirmed?"✓ ":"")+"Only flag for independent identity review",
   ()=>setConfirmed(v=>!v),busy||uncertain)}
  {button("Submit duplicate review",()=>Alert.alert(
   "Request independent identity review?",
   "This creates no account or medical-record merge.",[
    {text:"Cancel",style:"cancel"},{text:"Submit",onPress:()=>void propose()}
   ]),busy||uncertain||!confirmed||!id.test(source)||!id.test(canonical)||
    source===canonical)}
  <Text style={styles.heading}>Current original reviews</Text>
  {!rows.length&&!loading&&<Text style={styles.note}>No original identity reviews recorded.</Text>}
  {rows.map(x=><View key={x.reviewRef} style={styles.evidence}>
   <Text style={styles.text}>{x.sourceVirtualPatientId} → {x.canonicalVirtualPatientId}</Text>
   <Text style={styles.note}>Status: {x.status} · {new Date(x.proposedAt).toLocaleDateString("en-IN")}</Text>
   {x.status==="PENDING"&&!x.proposedByCurrentAccount?
    button("Review original verified evidence",()=>void open(x.reviewRef),
     busy||uncertain||loading):
    <Text style={styles.note}>{x.proposedByCurrentAccount?
     "Independent reviewer required":"Decision already recorded"}</Text>}
  </View>)}
  {!!evidence&&<View style={styles.evidence}>
   <Text style={styles.heading}>Independent identity decision</Text>
   <Text style={styles.note}>{evidence.message}</Text>
   {person("Source original",evidence.source)}
   {person("Proposed canonical original",evidence.proposedCanonical)}
   <Text style={styles.note}>Approve only after independently checking both
    verified people. A same-person administrative alias does not transfer
    account, consent, booking or document permissions.</Text>
   {button((reviewed?"✓ ":"")+"I independently checked both person-specific identities",
    ()=>setReviewed(v=>!v),busy||uncertain)}
   <TextInput style={styles.input} accessibilityLabel="Current Foundation password"
    secureTextEntry value={password} onChangeText={setPassword}
    editable={!busy&&!uncertain} placeholder="Current password"/>
   {button("Approve same-person administrative alias",()=>Alert.alert(
    "Approve verified identity alias?","Independent proof required.",[
     {text:"Cancel",style:"cancel"},
     {text:"Approve",onPress:()=>void decide("APPROVE")}
    ]),busy||uncertain||!reviewed||password.length<8)}
   {button("Reject possible duplicate",()=>Alert.alert(
    "Reject this duplicate proposal?","Original patients will remain separate.",[
     {text:"Cancel",style:"cancel"},{text:"Reject",onPress:()=>void decide("REJECT")}
    ]),busy||uncertain||password.length<8)}
   {button("Cancel review",()=>{setSelected("");setEvidence(null);
    setPassword("");setReviewed(false);})}
  </View>}
 </View>;
}
const styles=StyleSheet.create({
 wrap:{backgroundColor:t.surface,borderColor:t.border,borderWidth:1,
  borderRadius:12,padding:12,gap:9},
 heading:{fontSize:16,fontWeight:"700",color:t.text},
 text:{fontSize:13,color:t.text,lineHeight:19},
 note:{fontSize:12,color:t.mutedText,lineHeight:19},
 input:{borderWidth:1,borderColor:t.border,borderRadius:9,
  backgroundColor:t.surface,color:t.text,padding:10,minHeight:45},
 evidence:{padding:9,backgroundColor:t.surface,borderWidth:1,
  borderColor:t.border,borderRadius:9,gap:7},
 button:{padding:10,borderWidth:1,borderColor:t.border,
  minHeight:46,justifyContent:"center",borderRadius:9},
 disabled:{opacity:.4},
 error:{color:"#9F2A2A",fontSize:13}
});
