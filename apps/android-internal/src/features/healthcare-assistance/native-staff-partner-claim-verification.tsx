import {useCallback,useEffect,useRef,useState} from "react";
import {AppState,Pressable,StyleSheet,Text,TextInput,View} from "react-native";
import {File,Paths} from "expo-file-system";
import {fetch as expoFetch} from "expo/fetch";
import * as Crypto from "expo-crypto";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";
type Mode="foundation"|"partner";
type Detail={claimCode:string;serviceKind:string;serviceDate:string;
 quotedGrossMinor:string;estimatedFoundationMinor:string;
 estimatedPatientPayableMinor:string;foundationApprovedMinor:string;
 state:string;partnerPaymentBasis:string|null;paymentEvidenceSubmitted:boolean;
 canAttest:boolean;canDecide:boolean;caution:string};
type Props={token:string;centerRef:string;claimCode:string;mode:Mode;
 onExpired:()=>void;onChanged:()=>Promise<void>};
const base=process.env.EXPO_PUBLIC_API_URL;
const path=(mode:Mode,c:string,code:string,tail="")=>
 "/api/v1/healthcare-assistance/partner-verification/"+mode+"/centers/"+
 encodeURIComponent(c)+"/claims/"+encodeURIComponent(code)+tail;
const money=(minor:string)=>"₹"+(Number(BigInt(minor))/100).toFixed(2);
const rupees=(minor:string)=>(Number(BigInt(minor))/100).toFixed(2);
const paise=(v:string)=>{
 const m=/^(0|[1-9][0-9]{0,7})(?:\.([0-9]{1,2}))?$/.exec(v.trim());
 if(!m)throw Error("Enter the actual amount collected in rupees.");
 return (BigInt(m[1])*100n+BigInt((m[2]??"").padEnd(2,"0"))).toString();
};
async function call<T>(token:string,url:string,body?:object):Promise<T>{
 const r=await identityRequest(url,{method:body?"POST":"GET",cache:"no-store",
  headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},
  ...(body?{body:JSON.stringify(body)}:{})});
 if(!r.ok)throw Object.assign(new Error(r.status===401?"Staff session expired. Sign in again.":
  r.status===403?"This protected action is unavailable to your current role.":
  r.status===409?"The original evidence or claim was changed. Refresh first.":
  "The original partner claim result could not be confirmed."),{status:r.status});
 const v:unknown=await r.json();
 if(!v||typeof v!=="object"||Array.isArray(v))
  throw Error("Original claim response is unavailable.");
 return v as T;
}
export function NativeStaffPartnerClaimVerification({token,centerRef,claimCode,
 mode,onExpired,onChanged}:Props){
 const [detail,setDetail]=useState<Detail|null>(null),[error,setError]=useState("");
 const [notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
 const [uncertain,setUncertain]=useState(false);
 const [collected,setCollected]=useState(""),[method,setMethod]=useState("CASH_ATTESTED");
 const [reason,setReason]=useState(""),[password,setPassword]=useState("");
 const [seen,setSeen]=useState<string[]>([]);
 const original=useRef<{signature:string;key:string}|null>(null);
 const downloaded=useRef<File[]>([]);
 const dispose=()=>{for(const f of downloaded.current)try{f.delete();}catch{}
  downloaded.current=[];};
 const load=useCallback(async()=>{
  try{
   const v=await call<Detail>(token,path(mode,centerRef,claimCode));
   if(v.claimCode!==claimCode||typeof v.canAttest!=="boolean"||
    typeof v.canDecide!=="boolean")
    throw Error("Current claim status could not be verified.");
   setDetail(v);return v;
  }catch(e){
   if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
   throw e;
  }
 },[token,mode,centerRef,claimCode,onExpired]);
 useEffect(()=>{
  let active=true;setDetail(null);setError("");setNotice("");setSeen([]);
  setUncertain(false);original.current=null;dispose();
  void load().then(v=>{if(active)setCollected(rupees(v.estimatedPatientPayableMinor));})
   .catch(e=>{if(active)setError(e instanceof Error?e.message:
    "The original claim is unavailable.");});
  return()=>{active=false;dispose();};
 },[load]);
 useEffect(()=>{
  const sub=AppState.addEventListener("change",state=>{
   if(state!=="active")dispose();
  });
  return()=>sub.remove();
 },[]);
 const button=(label:string,onPress:()=>void,disabled=false)=>(
  <Pressable accessibilityRole="button" disabled={busy||disabled}
   accessibilityState={{disabled:busy||disabled}}
   onPress={onPress} style={[styles.button,(busy||disabled)&&styles.disabled]}>
   <Text style={styles.buttonText}>{label}</Text>
  </Pressable>);
 const refresh=async()=>{
  if(busy)return;setBusy(true);setError("");
  try{await load();setUncertain(false);await onChanged();}
  catch(e){setError(e instanceof Error?e.message:
   "Current claim status could not be checked.");}
  finally{setBusy(false);}
 };
 async function inspect(kind:"invoice"|"completion"|"payment"){
  if(busy||!detail||mode!=="foundation")return;
  setBusy(true);setError("");dispose();
  try{
   if(!base||!/^https?:\/\//.test(base)||
    (process.env.NODE_ENV==="production"&&!base.startsWith("https://")))
    throw Error("Secure evidence service is unavailable.");
   const url=new URL(path("foundation",centerRef,claimCode,
    "/evidence/"+kind),base).toString();
   const res=await expoFetch(url,{method:"GET",
    headers:{Authorization:"Bearer "+token},signal:AbortSignal.timeout(18000)});
   if(res.status===401){onExpired();throw Error("Staff session expired.");}
   if(!res.ok)throw Error("This private original evidence is unavailable.");
   const mime=res.headers.get("Content-Type")?.split(";")[0]??"";
   if(!["application/pdf","image/jpeg","image/png","image/webp"].includes(mime))
    throw Error("Verified source file format is unavailable.");
   const bytes=await res.bytes();
   if(bytes.length<1||bytes.length>10485760)
    throw Error("Verified source file size is invalid.");
   const ext=mime==="application/pdf"?".pdf":mime==="image/jpeg"?".jpg":
    mime==="image/png"?".png":".webp";
   const file=new File(Paths.cache,"careganga-review-"+Crypto.randomUUID()+ext);
   file.create();await file.write(bytes);downloaded.current.push(file);
   if(!await File.canPreview(file,{mimeType:mime}))
    throw Error("Install a compatible document viewer to review this evidence.");
   await File.preview(file,{title:"CareGanga original protected evidence",mimeType:mime});
   setSeen(v=>v.includes(kind)?v:[...v,kind]);
   setNotice("Original "+kind+" source presented for inspection. "+
    "Confirm its accuracy before a Foundation decision.");
  }catch(e){setError(e instanceof Error?e.message:
   "Private evidence could not be read.");}
  finally{setBusy(false);}
 }
 async function submit(action:"ATTEST"|"APPROVE"|"REJECT"){
  if(busy||uncertain||!detail)return;
  setBusy(true);setError("");setNotice("");
  try{
   const payload=action==="ATTEST"?
    {collectedMinor:paise(collected),paymentMethod:method,
     invoiceChecked:true,servicePerformed:true}:
    {action,reason:reason.trim(),currentPassword:password};
   if(action==="ATTEST"&&"collectedMinor" in payload&&
    payload.collectedMinor!==detail.estimatedPatientPayableMinor)
    throw Error("Partner amount differs from the original patient payable.");
   if(action!=="ATTEST"&&(reason.trim().length<12||password.length<8))
    throw Error("Enter the review reason and current Foundation password.");
   const signature=JSON.stringify([mode,centerRef,claimCode,action,payload]);
   if(original.current?.signature!==signature)
    original.current={signature,key:Crypto.randomUUID()};
   const endpoint=path(mode,centerRef,claimCode,
    action==="ATTEST"?"/attest":"/decide");
   const r=await call<Detail>(token,endpoint,{
    ...payload,requestKey:original.current.key
   });
   if(r.claimCode!==claimCode||typeof r.state!=="string")
    throw Error("The original decision was not confirmed.");
   await load();setPassword("");original.current=null;
   setUncertain(false);await onChanged();
   setNotice(action==="ATTEST"?"Partner payment attested; Foundation review pending.":
    action==="APPROVE"?
    "Independently verified source accepted. Bank reimbursement is separate.":
    "Claim rejected; no Foundation liability created.");
  }catch(e){
   setUncertain(true);
   if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
   setError(e instanceof Error?e.message:
    "Original outcome uncertain; check current claim status before retrying.");
  }finally{setBusy(false);}
 }
 if(!detail)return <View style={styles.panel}>
  {!!error&&<Text accessibilityRole="alert" style={styles.note}>{error}</Text>}
  {button("Check current original claim",()=>void refresh())}
 </View>;
 const review=mode==="foundation"&&detail.canDecide&&
  detail.state==="PARTNER_ATTESTED";
 const seenAll=seen.includes("invoice")&&
  (detail.serviceKind==="PHARMACY"||seen.includes("completion"))&&
  (detail.partnerPaymentBasis!=="ELECTRONIC_EVIDENCE"||seen.includes("payment"));
 return <View style={styles.panel}>
  <Text style={styles.heading}>Original claim {claimCode}</Text>
  <Text style={styles.note}>{detail.serviceKind} · {detail.serviceDate} ·
   bill {money(detail.quotedGrossMinor)} · patient amount
   {" "+money(detail.estimatedPatientPayableMinor)}</Text>
  <Text style={styles.note}>Foundation approved amount:
   {" "+money(detail.foundationApprovedMinor)} · Status:
   {" "+detail.state.replaceAll("_"," ").toLowerCase()}</Text>
  <Text style={styles.note}>{detail.caution}</Text>
  {!!error&&<Text accessibilityRole="alert" style={styles.note}>{error}</Text>}
  {!!notice&&<Text accessibilityLiveRegion="polite" style={styles.note}>{notice}</Text>}
  {mode==="partner"&&detail.canAttest&&detail.state==="PENDING_VERIFICATION"&&<>
   <Text style={styles.note}>Confirm your actual invoice and service. Attest
    only the patient amount actually received by your center.</Text>
   <Text style={styles.label}>Patient amount actually received (₹)</Text>
   <TextInput accessibilityLabel="Received rupees" value={collected}
    editable={!busy&&!uncertain} onChangeText={setCollected}
    keyboardType="decimal-pad" style={styles.input}/>
   {button("Cash paid to partner",()=>setMethod("CASH_ATTESTED"),
    uncertain)}
   {detail.paymentEvidenceSubmitted&&button(
    "Electronic payment with scanned proof",()=>setMethod("ELECTRONIC_EVIDENCE"),
    uncertain)}
   <Text style={styles.note}>Chosen: {
    method==="CASH_ATTESTED"?"Cash partner-attested":"Electronic proof to verify"}</Text>
   {button("Attest original payment and performed service",
    ()=>void submit("ATTEST"),uncertain)}
  </>}
  {review&&<>
   <Text style={styles.note}>An independent protected Foundation reviewer must
    inspect the original scanned documents before approving any support.
    Current password confirmation is required.</Text>
   {button("Inspect original scanned invoice",()=>void inspect("invoice"))}
   {detail.serviceKind!=="PHARMACY"&&
    button("Inspect original completed-service proof",()=>void inspect("completion"))}
   {detail.partnerPaymentBasis==="ELECTRONIC_EVIDENCE"&&
    button("Inspect original patient payment receipt",()=>void inspect("payment"))}
   <Text style={styles.label}>Independent review reason</Text>
   <TextInput accessibilityLabel="Decision justification" multiline
    value={reason} maxLength={500} editable={!busy&&!uncertain}
    onChangeText={setReason} style={styles.input}/>
   <Text style={styles.label}>Current protected Foundation password</Text>
   <TextInput accessibilityLabel="Protected reviewer password" secureTextEntry
    value={password} editable={!busy&&!uncertain}
    onChangeText={setPassword} style={styles.input}/>
   {button("Approve genuine original claim and recognize Foundation liability",
    ()=>void submit("APPROVE"),
    uncertain||!seenAll||reason.trim().length<12||password.length<8)}
   {button("Reject unsupported claim",()=>void submit("REJECT"),
    uncertain||reason.trim().length<12||password.length<8)}
  </>}
  {uncertain&&<Text accessibilityRole="alert" style={styles.note}>
   The previous write might have succeeded. Check its original status,
   then retry only the same request. Do not create another claim.</Text>}
  {button("Refresh original partner claim",()=>void refresh())}
 </View>;
}
const styles=StyleSheet.create({
 panel:{padding:12,borderWidth:1,borderColor:t.border,borderRadius:10,
  backgroundColor:t.surface,gap:10},
 heading:{fontSize:15,fontWeight:"700",color:t.text},
 note:{fontSize:12,lineHeight:19,color:t.mutedText},
 label:{fontSize:13,fontWeight:"600",color:t.text},
 input:{minHeight:44,borderWidth:1,borderColor:t.border,borderRadius:8,
  paddingHorizontal:12,paddingVertical:8,color:t.text},
 button:{minHeight:44,borderWidth:1,borderColor:t.border,borderRadius:8,
  justifyContent:"center",padding:10},
 buttonText:{fontSize:13,color:t.text,fontWeight:"600"},
 disabled:{opacity:0.45}
});
