import {useCallback,useEffect,useState} from "react";
import {ActivityIndicator,Alert,Pressable,StyleSheet,Text,TextInput,View}
 from "react-native";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";
type Candidate={accountRef:string;displayName:string};
type Assignment={linkRef:string;status:string;accountName:string};
type Proposal={linkRef:string;doctorName:string};
type ReviewerProps={token:string;doctorRef:string;onExpired:()=>void};
type AcceptanceProps={token:string;onExpired:()=>void};
async function source<T>(token:string,path:string,method:"GET"|"POST"="GET",
 body?:object):Promise<T>{
 const response=await identityRequest(
  "/api/v1/health-network/clinician-accounts/"+path,{
   method,cache:"no-store",headers:{Authorization:"Bearer "+token,
    ...(method==="POST"?{"Content-Type":"application/json"}:{})},
   ...(method==="POST"?{body:JSON.stringify(body??{})}:{})
  });
 if(!response.ok)throw Object.assign(new Error(
  response.status===401?"Sign in again to verify your original account.":
  response.status===403?"Current professional identity or Foundation role denies this link.":
  response.status===409?"The clinician-account match changed. Refresh the original record.":
  "Current protected clinician account source is unavailable."
 ),{status:response.status});
 return response.json() as Promise<T>;
}
const control=(label:string,fn:()=>void,disabled=false)=>
 <Pressable accessibilityRole="button" accessibilityState={{disabled}}
  disabled={disabled} onPress={fn}
  style={[styles.button,disabled&&styles.disabled]}>
  <Text style={styles.text}>{label}</Text>
 </Pressable>;
export function NativeClinicianAccountLinkReviewer({token,doctorRef,
 onExpired}:ReviewerProps){
 const [assignment,setAssignment]=useState<Assignment|null>(null);
 const [candidates,setCandidates]=useState<Candidate[]>([]);
 const [search,setSearch]=useState(""),[chosen,setChosen]=useState("");
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [uncertain,setUncertain]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const fail=(e:unknown)=>{
  if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
  setError(e instanceof Error?e.message:"Clinician account state unavailable.");
 };
 const refresh=useCallback(async()=>{
  const value=await source<{link:Assignment|null}>(token,
   "doctors/"+encodeURIComponent(doctorRef));
  setAssignment(value.link);setUncertain(false);
 },[token,doctorRef]);
 useEffect(()=>{
  let live=true;setLoading(true);setAssignment(null);
  setCandidates([]);setChosen("");setError("");setNotice("");
  void refresh().catch(e=>{if(live)fail(e)})
   .finally(()=>{if(live)setLoading(false)});
  return()=>{live=false};
 },[refresh]);
 async function lookup(){
  if(busy||uncertain||search.trim().length<2)return;
  setBusy(true);setError("");setCandidates([]);setChosen("");
  try{
   const result=await source<{options:Candidate[]}>(token,
    "account-options?search="+encodeURIComponent(search.trim()));
   if(!Array.isArray(result.options))
    throw Error("Original eligible staff accounts cannot be verified.");
   setCandidates(result.options);
  }catch(e){fail(e)}finally{setBusy(false)}
 }
 async function propose(){
  if(busy||uncertain||assignment||
   !candidates.some(x=>x.accountRef===chosen))return;
  setBusy(true);setError("");setNotice("");
  try{
   await source(token,"doctors/"+encodeURIComponent(doctorRef)+"/propose",
    "POST",{accountRef:chosen});
   await refresh();setChosen("");setCandidates([]);
   setNotice("Original proposal recorded. Doctor must personally accept "+
     "from their own signed-in account before any clinical access.");
  }catch(e){setUncertain(true);fail(e)}
  finally{setBusy(false)}
 }
 async function revoke(){
  if(!assignment||busy||uncertain)return;
  setBusy(true);setError("");setNotice("");
  try{
   await source(token,encodeURIComponent(assignment.linkRef)+"/revoke",
    "POST",{});
   await refresh();setNotice("The original doctor login assignment was revoked.");
  }catch(e){setUncertain(true);fail(e)}
  finally{setBusy(false)}
 }
 return <View style={styles.panel}>
  <Text style={styles.heading}>Verified doctor login assignment</Text>
  <Text style={styles.note}>Only an original Foundation CG14 reviewer can
   propose or revoke this account match. A staff name or contact alone is not
   proof of professional identity; doctor acceptance is mandatory.</Text>
  {loading&&<ActivityIndicator accessibilityLabel="Checking clinician account"/>}
  {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
  {!!notice&&<Text accessibilityRole="alert" style={styles.note}>{notice}</Text>}
  {!!assignment?<View style={styles.panel}>
   <Text style={styles.text}>Assigned account: {assignment.accountName}</Text>
   <Text style={styles.note}>State: {assignment.status==="ACTIVE"?
    "Personally accepted":"Awaiting doctor's own acceptance"}</Text>
   {control("Revoke original clinician account link",()=>Alert.alert(
    "Revoke this doctor's login assignment?",
    "Existing professional and appointment records remain; current access changes.",[
     {text:"Keep assignment",style:"cancel"},
     {text:"Revoke",style:"destructive",onPress:()=>void revoke()}
    ]),busy||uncertain)}
  </View>:<>
   <TextInput accessibilityLabel="Find verified doctor's registered staff account"
    style={styles.input} value={search} onChangeText={setSearch}
    maxLength={80} editable={!busy&&!uncertain}
    placeholder="Search eligible staff account by name"/>
   {control("Find eligible staff accounts",()=>void lookup(),
    busy||uncertain||search.trim().length<2)}
   {candidates.map(c=><View key={c.accountRef}>
    {control((chosen===c.accountRef?"✓ ":"")+c.displayName,
     ()=>setChosen(c.accountRef),busy||uncertain)}
   </View>)}
   {control("Propose original doctor account match",()=>Alert.alert(
    "Request the doctor's own account acceptance?",
    "The proposed match cannot open clinical records until the doctor accepts.",[
     {text:"Cancel",style:"cancel"},
     {text:"Propose",onPress:()=>void propose()}
    ]),busy||uncertain||!chosen)}
  </>}
  {uncertain&&<Text style={styles.error}>The last change may have committed.
   Recheck the original assignment rather than submitting another request.</Text>}
  {control("Refresh original doctor login assignment",()=>{
   setBusy(true);void refresh().catch(fail).finally(()=>setBusy(false));
  },busy)}
 </View>;
}
export function NativeClinicianAccountAcceptance({token,
 onExpired}:AcceptanceProps){
 const [proposal,setProposal]=useState<Proposal|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 const [unknown,setUnknown]=useState(false);
 const reload=useCallback(async()=>{
  const result=await source<{proposal:Proposal|null}>(token,"me/pending");
  setProposal(result.proposal);setUnknown(false);
 },[token]);
 useEffect(()=>{
  let active=true;
  void source<{proposal:Proposal|null}>(token,"me/pending")
   .then(value=>{if(active)setProposal(value.proposal)})
   .catch(()=>{if(active)setProposal(null)});
  return()=>{active=false};
 },[token]);
 if(!proposal)return null;
 async function accept(){
  if(busy||unknown||!proposal)return;
  setBusy(true);setError("");
  try{
   const response=await source<{status:string}>(token,"me/"+
    encodeURIComponent(proposal.linkRef)+"/accept","POST",{});
   if(response.status!=="ACTIVE")
    throw Error("Original personal clinician acceptance was not confirmed.");
   await reload();
  }catch(e){
   setUnknown(true);
   if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
   setError(e instanceof Error?e.message:
    "Recheck your original clinician account assignment after signing in.");
  }finally{setBusy(false)}
 }
 return <View style={styles.panel}>
  <Text style={styles.heading}>Confirm your doctor account</Text>
  <Text style={styles.note}>A Foundation reviewer proposed linking your
   own signed-in account to verified professional {proposal.doctorName}.
   Accept only if this is your own original doctor registration.</Text>
  {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
  {control("Accept my own verified doctor account",()=>Alert.alert(
   "Are you the verified doctor?",
   "A recent password sign-in is required. This does not grant new roles or unrelated patient access.",[
    {text:"Not me",style:"cancel"},
    {text:"I am this doctor",onPress:()=>void accept()}
   ]),busy||unknown)}
  {unknown&&control("Recheck my original assignment",()=>{
   setBusy(true);void reload().catch(e=>
    setError(e instanceof Error?e.message:"Recheck failed."))
    .finally(()=>setBusy(false));
  },busy)}
 </View>;
}
const styles=StyleSheet.create({
 panel:{padding:11,gap:9,backgroundColor:t.surface,borderWidth:1,
  borderColor:t.border,borderRadius:12},
 heading:{fontSize:16,fontWeight:"700",color:t.text},
 text:{fontSize:13,fontWeight:"600",color:t.text},
 note:{fontSize:13,color:t.mutedText,lineHeight:19},
 error:{color:"#A52626",fontSize:13},
 input:{backgroundColor:t.surface,color:t.text,padding:10,
  minHeight:44,borderWidth:1,borderColor:t.border,borderRadius:9},
 button:{minHeight:44,borderWidth:1,borderColor:t.border,
  borderRadius:9,padding:10,justifyContent:"center"},
 disabled:{opacity:.5}
});
