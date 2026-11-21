import {useCallback,useEffect,useRef,useState} from "react";
import {
 ActivityIndicator,Alert,Pressable,StyleSheet,Text,TextInput,View
} from "react-native";
import * as Crypto from "expo-crypto";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";

type Template={configured:boolean;version:number;title?:string;body?:string;status:string};
type Letter={documentRef:string;state:string;issueRevision:number;templateVersion:number;
 issuedAt:string|null;canDownload:boolean;canReconcile:boolean};
type Props={token:string;caseRef:string;sourceRevision:number;
 canIssue:boolean;canRevoke:boolean;onExpired:()=>void;
 onPreview:(documentRef:string)=>Promise<void>};
type Review="TEMPLATE"|"ISSUE"|"REVOKE"|null;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const status=(v:string)=>({
 PENDING:"Request recorded, PDF not yet issued",
 VERIFYING:"Verifying original private PDF",
 ISSUED:"Private PDF issued and verified",
 UNKNOWN:"Issue uncertain; check the original request",
 FAILED:"Private PDF not issued",
 REVOKED:"Revoked; private download blocked"
} as Record<string,string>)[v]??"Private document unverified";

async function api<T>(token:string,path:string,body?:object):Promise<T>{
 let response:Response;
 try{
  response=await identityRequest("/api/documents/letters/"+path,{
   method:body?"POST":"GET",cache:"no-store",
   headers:{Authorization:"Bearer "+token,
    ...(body?{"Content-Type":"application/json"}:{})},
   ...(body?{body:JSON.stringify(body)}:{})
  });
 }catch{throw Object.assign(new Error("Original letter outcome unconfirmed."),{status:503});}
 if(!response.ok){
  const message=response.status===401?"Sign in again to manage private letters.":
   response.status===403?"Current private letter permission is unavailable.":
   response.status===409?"Original letter or template changed. Refresh first.":
   response.status===400?"Check the current password and original revision.":
   "Original private letter outcome unconfirmed.";
  throw Object.assign(new Error(message),{status:response.status});
 }
 try{return await response.json() as T}
 catch{throw Object.assign(new Error("Original letter response unconfirmed."),{status:503})}
}
/** CG19 native counterpart to the original protected Web PrivateLetterPanel.
 * Backend owns private PDF generation, versions, revocation and verification.
 * Never print source identifiers as labels or treat HTTP upload as issued.
 */
export function NativePrivateLetterPanel({token,caseRef,sourceRevision,
 canIssue,canRevoke,onExpired,onPreview}:Props){
 const [template,setTemplate]=useState<Template|null>(null);
 const [letters,setLetters]=useState<Letter[]>([]);
 const [heading,setHeading]=useState("Protected access confirmation");
 const [body,setBody]=useState("This letter confirms that the specified CareGanga "+
  "Foundation access change was approved and applied. Access remains subject "+
  "to current permissions and may be revoked.");
 const [password,setPassword]=useState(""),[issuePassword,setIssuePassword]=useState("");
 const [revokePassword,setRevokePassword]=useState("");
 const [revokeRef,setRevokeRef]=useState("");
 const [review,setReview]=useState<Review>(null);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [uncertain,setUncertain]=useState<Review>(null);
 const [message,setMessage]=useState("");
 const requestVersion=useRef(0),templateKey=useRef(""),issueKey=useRef("");
 const handleError=useCallback((error:unknown)=>{
  if(error&&typeof error==="object"&&"status" in error&&error.status===401)
   onExpired();
  setMessage(error instanceof Error?error.message:
   "Original private document could not be verified.");
 },[onExpired]);
 const refresh=useCallback(async()=>{
  const v=++requestVersion.current;
  setLoading(true);
  try{
   const [tpl,list]=await Promise.all([
    api<Template>(token,"template"),
    api<{letters:Letter[];caseNumber:string}>(token,
     "case/"+encodeURIComponent(caseRef))
   ]);
   if(!tpl||!Number.isInteger(tpl.version)||!Array.isArray(list.letters)||
    list.letters.length>20||list.letters.some(x=>
     !UUID.test(x.documentRef)||typeof x.state!=="string"||
     !Number.isInteger(x.issueRevision)))throw Error("Private source unavailable.");
   if(v!==requestVersion.current)return;
   setTemplate(tpl);setLetters(list.letters);
   if(tpl.configured&&tpl.title&&tpl.body){
    setHeading(tpl.title);setBody(tpl.body);
   }
  }catch(e){
   if(v!==requestVersion.current)return;
   setTemplate(null);setLetters([]);handleError(e);
  }finally{if(v===requestVersion.current)setLoading(false)}
 },[token,caseRef,handleError]);
 useEffect(()=>{
  setTemplate(null);setLetters([]);setReview(null);setMessage("");
  setPassword("");setIssuePassword("");setRevokePassword("");
  setUncertain(null);setRevokeRef("");
  templateKey.current="";issueKey.current="";
  void refresh();
  return()=>{requestVersion.current++};
 },[refresh,sourceRevision]);
 function failure(e:unknown,kind:Review){
  if(e&&typeof e==="object"&&"status" in e&&
   (typeof e.status!=="number"||e.status>=500))setUncertain(kind);
  else if(!(e&&typeof e==="object"&&"status" in e))setUncertain(kind);
  handleError(e);
 }
 function button(label:string,click:()=>void,disabled=false){
  return <Pressable accessibilityRole="button"
   accessibilityState={{disabled}} disabled={disabled} onPress={click}
   style={[styles.button,disabled&&styles.disabled]}>
    <Text style={styles.buttonText}>{label}</Text>
   </Pressable>;
 }
 async function approve(){
  if(!canIssue||busy||uncertain||!template||password.length<8||
    password.length>1024||heading.trim().length<10||heading.length>100||
    body.trim().length<20||body.length>1200)return;
  setBusy(true);setMessage("");
  if(!templateKey.current)templateKey.current=Crypto.randomUUID();
  try{
   const result=await api<{version:number;status:string}>(
    token,"template/approve",{
     title:heading,body,expectedVersion:template.version,
     requestKey:templateKey.current,currentPassword:password});
   if(!Number.isInteger(result.version))throw Error("Unknown template result.");
   templateKey.current="";setReview(null);setPassword("");
   setMessage("New protected letter template version approved.");
   await refresh();
  }catch(e){failure(e,"TEMPLATE")}finally{setBusy(false)}
 }
 async function issue(){
  if(!canIssue||busy||uncertain||!template?.configured||
    template.status!=="APPROVED"||issuePassword.length<8||
    issuePassword.length>1024||!UUID.test(caseRef))return;
  setBusy(true);setMessage("");
  if(!issueKey.current)issueKey.current=Crypto.randomUUID();
  try{
   const item=await api<Letter>(token,"issue",{
    caseRef,sourceRevision,requestKey:issueKey.current,
    currentPassword:issuePassword
   });
   if(!item||!UUID.test(item.documentRef)||typeof item.state!=="string")
    throw Error("Original letter issue status unknown.");
   issueKey.current="";setIssuePassword("");setReview(null);
   setMessage(status(item.state));await refresh();
  }catch(e){failure(e,"ISSUE")}finally{setBusy(false)}
 }
 async function checkOriginal(){
  if(!issueKey.current||busy)return;
  setBusy(true);setMessage("");
  try{
   const result=await api<{status:string;letter:Letter|null}>(
    token,"requests/"+encodeURIComponent(issueKey.current));
   if(result.status!=="CONFIRMED"){
    setMessage("No verified original issue status. Do not resubmit.");return;
   }
   setUncertain(null);issueKey.current="";
   setMessage("Original request confirmed: "+status(result.letter?.state??"UNKNOWN"));
   await refresh();
  }catch(e){handleError(e)}finally{setBusy(false)}
 }
 async function reconcile(ref:string){
  if(!canIssue||busy||uncertain||!UUID.test(ref))return;
  setBusy(true);setMessage("");
  try{
   const item=await api<Letter>(token,encodeURIComponent(ref)+"/reconcile",{});
   if(!item||typeof item.state!=="string")throw Error("Issue unconfirmed.");
   setMessage(status(item.state));await refresh();
  }catch(e){handleError(e)}finally{setBusy(false)}
 }
 async function revoke(){
  if(!canRevoke||busy||uncertain||!UUID.test(revokeRef)||
    revokePassword.length<8||revokePassword.length>1024)return;
  setBusy(true);setMessage("");
  try{
   const item=await api<Letter>(token,
    encodeURIComponent(revokeRef)+"/revoke",{currentPassword:revokePassword});
   if(item.state!=="REVOKED")throw Error("Revocation not confirmed.");
   setRevokeRef("");setReview(null);setRevokePassword("");
   setMessage("Verified letter revoked. Original issuance remains in audit.");
   await refresh();
  }catch(e){failure(e,"REVOKE")}finally{setBusy(false)}
 }
 if(!canIssue&&!canRevoke||!UUID.test(caseRef))return null;
 const locked=busy||!!uncertain;
 return <View style={styles.card}>
  <Text style={styles.title} accessibilityRole="header">
   Verified private access letters</Text>
  <Text style={styles.note}>The server generates the protected PDF.
   Only a verified issued letter can be privately previewed.
   Revoking retains its original audit history.</Text>
  {!!message&&<Text accessibilityRole="alert" style={styles.message}>{message}</Text>}
  {loading?<ActivityIndicator accessibilityLabel="Verifying private letters"/>:
   <Text style={styles.note}>{template?.configured&&template.status==="APPROVED"?
    "Approved template version "+template.version:
    "No active approved private letter template."}</Text>}
  {uncertain&&<View style={styles.group}>
   <Text accessibilityRole="alert" style={styles.message}>
    A previous {uncertain.toLowerCase()} outcome is uncertain.
    Do not submit another operation with a new request key.</Text>
   {uncertain==="ISSUE"&&
    button("Check original issue request",()=>void checkOriginal(),
     busy||!issueKey.current)}
   {uncertain!=="ISSUE"&&
    <Text style={styles.note}>Contact Foundation operations and verify
     the original template or revocation status before another write.</Text>}
  </View>}
  {canIssue&&<View style={styles.group}>
   <Text style={styles.subtitle}>Approved template</Text>
   <Text style={styles.label}>Private letter heading</Text>
   <TextInput accessibilityLabel="Private letter heading"
    style={styles.field} value={heading} maxLength={100}
    editable={!locked} onChangeText={x=>{
     setHeading(x);setReview(null);templateKey.current="";
    }}/>
   <Text style={styles.label}>Private letter wording</Text>
   <TextInput accessibilityLabel="Private letter wording" multiline
    style={[styles.field,styles.multiline]} maxLength={1200}
    value={body} editable={!locked} onChangeText={x=>{
     setBody(x);setReview(null);templateKey.current="";
    }}/>
   <Text style={styles.label}>Current Foundation password</Text>
   <TextInput accessibilityLabel="Confirm template approval password"
    style={styles.field} secureTextEntry value={password}
    editable={!locked} onChangeText={setPassword}/>
   {button("Review and approve template",()=>Alert.alert(
    "Approve private template version",
    "A new immutable template version will be approved. Old private letters remain unchanged.",[
     {text:"Cancel",style:"cancel"},
     {text:"Approve",onPress:()=>void approve()}
    ]),locked||loading||heading.trim().length<10||
    body.trim().length<20||password.length<8)}
  </View>}
  {canIssue&&<View style={styles.group}>
   <Text style={styles.subtitle}>Issue from verified approved access</Text>
   <Text style={styles.note}>Only the frozen, currently approved case
    revision may produce a new private PDF.</Text>
   <Text style={styles.label}>Current Foundation password</Text>
   <TextInput accessibilityLabel="Confirm private letter issue password"
    secureTextEntry style={styles.field} value={issuePassword}
    editable={!locked} onChangeText={setIssuePassword}/>
   {button("Review and issue verified PDF",()=>Alert.alert(
    "Issue private verified letter",
    "This uses the original authorized case and current approval revision. "+
    "Issuance is not confirmed until the server verifies its private PDF.",[
     {text:"Cancel",style:"cancel"},
     {text:"Issue",onPress:()=>void issue()}
    ]),locked||loading||!template?.configured||
    template.status!=="APPROVED"||issuePassword.length<8)}
  </View>}
  <View style={styles.group}>
   <Text style={styles.subtitle}>Original issued-letter history</Text>
   {!letters.length&&<Text style={styles.note}>
    No private verified access letters exist for this application.</Text>}
   {letters.map(item=><View key={item.documentRef} style={styles.entry}>
    <Text style={styles.label}>Issue {item.issueRevision} ·
     Template {item.templateVersion}</Text>
    <Text style={styles.note}>{status(item.state)}</Text>
    {!!item.issuedAt&&<Text style={styles.note}>
     Issued: {new Date(item.issuedAt).toLocaleString()}</Text>}
    {item.canDownload&&
     button("Preview verified private PDF",
      ()=>void onPreview(item.documentRef),busy)}
    {item.canReconcile&&canIssue&&
     button("Check original issue status",
      ()=>void reconcile(item.documentRef),locked)}
    {item.state==="ISSUED"&&canRevoke&&
     button("Review private letter revocation",()=>{
      setReview("REVOKE");setRevokeRef(item.documentRef);
      setRevokePassword("");
     },locked)}
   </View>)}
   {review==="REVOKE"&&canRevoke&&<View style={styles.group}>
    <Text style={styles.label}>Confirm revocation with current password</Text>
    <TextInput accessibilityLabel="Confirm private letter revocation password"
     secureTextEntry style={styles.field} value={revokePassword}
     editable={!locked} onChangeText={setRevokePassword}/>
    {button("Confirm permanent revoke",()=>Alert.alert(
     "Revoke verified private letter",
     "Its authorized download will be blocked; the original audit stays unchanged.",[
      {text:"Cancel",style:"cancel"},
      {text:"Revoke",style:"destructive",onPress:()=>void revoke()}
     ]),locked||revokePassword.length<8)}
    {button("Cancel revocation",()=>{setReview(null);setRevokeRef("");
     setRevokePassword("")},busy)}
   </View>}
  </View>
  {button("Refresh verified private letters",()=>void refresh(),busy)}
 </View>;
}
const styles=StyleSheet.create({
 card:{backgroundColor:t.surface,borderColor:t.border,borderWidth:1,
  borderRadius:12,padding:14,gap:12},
 group:{gap:10,paddingVertical:6},
 entry:{borderColor:t.border,borderWidth:1,borderRadius:10,
  padding:12,gap:8},
 title:{fontSize:17,fontWeight:"700",color:t.text},
 subtitle:{fontWeight:"700",fontSize:14,color:t.text},
 note:{fontSize:13,lineHeight:19,color:t.mutedText},
 label:{fontSize:13,fontWeight:"600",color:t.text},
 field:{borderColor:t.border,borderWidth:1,borderRadius:9,
  color:t.text,backgroundColor:t.surface,minHeight:46,
  paddingHorizontal:12,paddingVertical:9},
 multiline:{minHeight:92,textAlignVertical:"top"},
 message:{fontSize:13,color:t.error},
 button:{borderColor:t.border,borderWidth:1,borderRadius:10,
  minHeight:46,justifyContent:"center",paddingHorizontal:12,paddingVertical:10},
 buttonText:{fontSize:13,fontWeight:"600",color:t.text},
 disabled:{opacity:0.45}
});
