import {useCallback,useEffect,useRef,useState} from "react";
import {Pressable,StyleSheet,Text,TextInput,View} from "react-native";
import * as Crypto from "expo-crypto";
import {careGangaPublicTheme as t} from "../../../../../packages/design-tokens/src/index";

type Kind="PHARMACY"|"NURSING"|"OT"|"LAB";
type Choice={centerRef:string;centerName:string;kind:Kind};
type PrivateFile={fileRef:string;classification:string;revoked:boolean;createdAt:string};
type Page={files:PrivateFile[];next:string|null};
type Claim={claimCode:string;serviceKind:Kind;invoiceNumber:string;
 serviceDate:string;quotedGrossMinor:string;estimatedFoundationMinor:string;
 estimatedPatientPayableMinor:string;
 state:"PENDING_VERIFICATION"|"PARTNER_ATTESTED"|"APPROVED_AWAITING_FINANCE"|"REJECTED";
 guidance:string};
const base=process.env.EXPO_PUBLIC_API_URL;
const approvedCodes=new Set([
 "CG17_PARTNER_CLAIM_INVALID","CG17_PARTNER_CLAIM_PROOF_REQUIRED",
 "CG17_PARTNER_CLAIM_PATIENT_UNAVAILABLE","CG17_PARTNER_CLAIM_DUPLICATE_INVOICE",
 "CG17_PARTNER_CLAIM_REQUEST_CONFLICT","CG17_PARTNER_CLAIM_POLICY_UNAVAILABLE",
 "CG17_PARTNER_CLAIM_CENTER_UNAVAILABLE","CG17_PARTNER_CLAIM_LIST_LIMIT"
]);
function endpoint(path:string){
 if(!base||!/^https?:\/\//.test(base)||
  (process.env.NODE_ENV==="production"&&!base.startsWith("https://")))
  throw Error("The private CareGanga claim service is unavailable.");
 return new URL(path,base).toString();
}
async function api<T>(token:string,path:string,method:"GET"|"POST"="GET",
 body?:object):Promise<T>{
 const r=await fetch(endpoint(path),{method,cache:"no-store",
  signal:AbortSignal.timeout(15000),
  headers:{Authorization:"Bearer "+token,...(method==="POST"?
   {"Content-Type":"application/json"}:{})},
  body:method==="POST"?JSON.stringify(body??{}):undefined});
 if(!r.ok){
  const v:unknown=await r.json().catch(()=>null);
  const safe=v&&typeof v==="object"&&!Array.isArray(v)?
    v as Record<string,unknown>:null;
  const message=safe&&typeof safe.code==="string"&&
   approvedCodes.has(safe.code)&&typeof safe.message==="string"&&
   safe.message.length<=220&&!/[<>\r\n]/.test(safe.message)?
   safe.message:r.status===401?"Your patient session expired. Sign in again.":
   r.status===403?"Your account cannot access this claim.":
   r.status===409?"The original claim or partner changed. Check your history.":
   r.status===429?"Too many attempts. Try again later.":
   "The claim outcome is uncertain. Check your original history.";
  throw Error(message);
 }
 const result:unknown=await r.json();
 if(!result||typeof result!=="object"||Array.isArray(result))
  throw Error("The source response could not be verified.");
 return result as T;
}
const paise=(value:string)=>{
 const m=/^([1-9][0-9]{0,7})(?:\.([0-9]{1,2}))?$/.exec(value.trim());
 if(!m)throw Error("Enter a valid rupee amount with at most two decimals.");
 const amount=BigInt(m[1])*100n+BigInt((m[2]??"").padEnd(2,"0"));
 if(amount>10000000000n)throw Error("The invoice amount is outside the permitted range.");
 return amount.toString();
};
const currency=(minor:string)=>"₹"+(Number(BigInt(minor))/100).toLocaleString("en-IN",{
 minimumFractionDigits:2,maximumFractionDigits:2});
/** Same original CG17 API and CG19 scanner-owned private evidence as Web.
 * A quoted patient claim is always PENDING, never paid or payable.
 */
export function NativePatientPartnerClaims({token,consentGranted,onExpired}:{
 token:string;consentGranted:boolean;onExpired:()=>void
}){
 const [choices,setChoices]=useState<Choice[]>([]);
 const [files,setFiles]=useState<PrivateFile[]>([]);
 const [next,setNext]=useState<string|null>(null);
 const [claims,setClaims]=useState<Claim[]>([]);
 const [selected,setSelected]=useState(""),[search,setSearch]=useState("");
 const [invoice,setInvoice]=useState(""),[date,setDate]=useState(""),[gross,setGross]=useState("");
 const [invoiceFile,setInvoiceFile]=useState(""),[proofFile,setProofFile]=useState("");
 const [paymentFile,setPaymentFile]=useState("");
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 const [notice,setNotice]=useState(""),[uncertain,setUncertain]=useState(false);
 const request=useRef<{digest:string;key:string}|null>(null);
 const call=useCallback(async <T,>(path:string,method:"GET"|"POST"="GET",body?:object)=>{
  try{return await api<T>(token,path,method,body);}
  catch(e){
   if(e instanceof Error&&e.message.includes("session expired"))onExpired();
   throw e;
  }
 },[token,onExpired]);
 const refresh=useCallback(async()=>{
  const [a,p,c]=await Promise.all([
   call<{services:Choice[]}>("/api/v1/healthcare-assistance/partner-claims/eligible-services"),
   call<Page>("/api/documents/patient-files/files"),
   call<{claims:Claim[]}>("/api/v1/healthcare-assistance/partner-claims/mine")
  ]);
  if(!Array.isArray(a.services)||!Array.isArray(p.files)||!Array.isArray(c.claims))
   throw Error("Current partner claim records could not be verified.");
  setChoices(a.services);setFiles(p.files);setNext(p.next);
  setClaims(c.claims);setUncertain(false);
 },[call]);
 useEffect(()=>{let mounted=true;void refresh().catch(e=>{
  if(mounted)setError(e instanceof Error?e.message:"Claims could not be loaded.");
 });return()=>{mounted=false;};},[refresh]);
 const choice=choices.find(c=>c.centerRef+"|"+c.kind===selected);
 const invoices=files.filter(f=>f.classification==="PATIENT_PARTNER_INVOICE"&&!f.revoked);
 const proofs=files.filter(f=>f.classification==="PATIENT_PARTNER_SERVICE_PROOF"&&!f.revoked);
 const payments=files.filter(f=>f.classification==="PATIENT_PARTNER_PAYMENT_PROOF"&&!f.revoked);
 function changed(fn:(v:string)=>void,value:string){
  if(uncertain||busy)return;
  fn(value);request.current=null;setError("");setNotice("");
 }
 const button=(label:string,act:()=>void,disabled=false,active=false)=>(
  <Pressable accessibilityRole="button" disabled={busy||disabled}
   accessibilityState={{disabled:busy||disabled,selected:active}}
   onPress={act} style={[styles.button,active&&styles.active,
    (busy||disabled)&&styles.disabled]}>
   <Text style={styles.buttonText}>{label}</Text>
  </Pressable>);
 async function more(){
  if(!next||busy)return;setBusy(true);setError("");
  try{
   const p=await call<Page>("/api/documents/patient-files/files?after="+encodeURIComponent(next));
   setFiles(prev=>[...prev,...p.files]);setNext(p.next);
  }catch(e){setError(e instanceof Error?e.message:"Older files are unavailable.");}
  finally{setBusy(false);}
 }
 async function send(){
  if(!consentGranted||!choice||!invoiceFile||busy||uncertain)return;
  setBusy(true);setError("");setNotice("");
  try{
   if(choice.kind!=="PHARMACY"&&!proofFile)
    throw Error("Choose verified scanned evidence that the service was performed.");
   const body={centerRef:choice.centerRef,serviceKind:choice.kind,
    invoiceNumber:invoice.trim(),serviceDate:date,grossMinor:paise(gross),
    invoiceFileRef:invoiceFile,...(choice.kind==="PHARMACY"?{}:{completionFileRef:proofFile}),
    ...(paymentFile?{paymentFileRef:paymentFile}:{})};
   const digest=JSON.stringify(body);
   if(request.current?.digest!==digest)
    request.current={digest,key:Crypto.randomUUID()};
   const saved=await call<Claim>("/api/v1/healthcare-assistance/partner-claims/mine",
    "POST",{...body,requestKey:request.current.key});
   if(saved.state!=="PENDING_VERIFICATION"||!saved.claimCode)
    throw Error("The submitted claim status could not be confirmed.");
   setNotice("Claim "+saved.claimCode+" received for independent review. "+
    "No patient payment or Foundation reimbursement is confirmed.");
   await refresh();setUncertain(false);
  }catch(e){
   setUncertain(true);
   setError(e instanceof Error?e.message:
    "Claim outcome uncertain. Check your own existing claim history.");
  }finally{setBusy(false);}
 }
 return <View style={styles.panel}>
  <Text style={styles.heading}>My pharmacy, lab, nursing and procedure claims</Text>
  <Text style={styles.note}>After an actual purchase or completed nursing/procedure
   service, upload the scanned invoice under My private health documents.
   Lab tests, nursing and procedures also need scanned completed-service evidence.
   A submitted quote is not payment or approved Foundation assistance.</Text>
  {!!error&&<Text accessibilityRole="alert" style={styles.note}>{error}</Text>}
  {!!notice&&<Text accessibilityLiveRegion="polite" style={styles.note}>{notice}</Text>}
  {consentGranted&&<>
   <Text style={styles.label}>Find a verified partner</Text>
   <TextInput accessibilityLabel="Search verified partner by name"
    value={search} editable={!busy&&!uncertain} onChangeText={v=>changed(setSearch,v)}
    style={styles.input} placeholder="Search partner" placeholderTextColor={t.mutedText}/>
   {choices.filter(c=>c.centerName.toLowerCase().includes(search.toLowerCase()))
    .slice(0,20).map(c=>{
     const key=c.centerRef+"|"+c.kind;
     return <View key={key}>{button(c.centerName+" · "+(c.kind==="OT"?"Procedure":c.kind==="LAB"?"Lab / diagnostics":c.kind),
      ()=>changed(setSelected,key),uncertain,selected===key)}</View>;
    })}
   <Text style={styles.label}>Original invoice number</Text>
   <TextInput accessibilityLabel="Invoice number printed by the partner"
    value={invoice} maxLength={60} editable={!busy&&!uncertain}
    onChangeText={v=>changed(setInvoice,v)} style={styles.input}
    placeholder="Invoice number" placeholderTextColor={t.mutedText}/>
   <Text style={styles.label}>Purchase or actual service date (YYYY-MM-DD)</Text>
   <TextInput accessibilityLabel="Service date" value={date} maxLength={10}
    editable={!busy&&!uncertain} onChangeText={v=>changed(setDate,v)}
    style={styles.input} keyboardType="numbers-and-punctuation"
    placeholder="2026-11-21" placeholderTextColor={t.mutedText}/>
   <Text style={styles.label}>Partner invoice total (₹)</Text>
   <TextInput accessibilityLabel="Invoice total in rupees" value={gross}
    editable={!busy&&!uncertain} maxLength={12} keyboardType="decimal-pad"
    onChangeText={v=>changed(setGross,v)} style={styles.input}
    placeholder="1000.00" placeholderTextColor={t.mutedText}/>
   <Text style={styles.label}>Select my scanned partner invoice</Text>
   {invoices.length===0&&<Text style={styles.note}>Upload and scan the original invoice first.</Text>}
   {invoices.map((f,i)=>button("Invoice "+(i+1)+" · "+
     new Date(f.createdAt).toLocaleDateString("en-IN"),()=>
     changed(setInvoiceFile,f.fileRef),uncertain,invoiceFile===f.fileRef))}
   {choice?.kind!=="PHARMACY"&&<>
    <Text style={styles.label}>Scanned proof of completed service</Text>
    {proofs.length===0&&<Text style={styles.note}>Upload the genuine service evidence first.</Text>}
    {proofs.map((f,i)=>button("Completed-service file "+(i+1)+" · "+
     new Date(f.createdAt).toLocaleDateString("en-IN"),()=>
     changed(setProofFile,f.fileRef),uncertain,proofFile===f.fileRef))}
   </>}
   <Text style={styles.label}>Optional scanned payment receipt (required for electronic evidence)</Text>
   {payments.map((f,i)=>button("Payment receipt "+(i+1)+" · "+
    new Date(f.createdAt).toLocaleDateString("en-IN"),()=>
    changed(setPaymentFile,f.fileRef),uncertain,paymentFile===f.fileRef))}
   {!!paymentFile&&button("Clear payment receipt choice",()=>changed(setPaymentFile,""),uncertain)}
   {!!next&&button("Find older verified documents",()=>void more(),uncertain)}
   {button("Submit original evidence for Foundation verification",()=>void send(),
    uncertain||!choice||!invoiceFile||!invoice.trim()||!date||!gross||
    (choice.kind!=="PHARMACY"&&!proofFile))}
   {uncertain&&button("Check my original claim before retrying",
    ()=>void refresh().catch(e=>setError(e instanceof Error?e.message:
     "The original claim status remains unavailable.")))}
  </>}
  {!consentGranted&&<Text style={styles.note}>Grant patient-care consent
   before submitting a new partner-service claim.</Text>}
  <Text style={styles.heading}>My submitted claims</Text>
  {claims.length===0&&<Text style={styles.note}>No submitted partner claims.</Text>}
  {claims.map(c=><View key={c.claimCode} style={styles.item}>
   <Text style={styles.label}>{c.claimCode} · {c.serviceKind} · {c.invoiceNumber}</Text>
   <Text style={styles.note}>{c.serviceDate} · Invoice {currency(c.quotedGrossMinor)}</Text>
   <Text style={styles.note}>Estimated Foundation share:
    {" "+currency(c.estimatedFoundationMinor)}; provisional patient amount:
    {" "+currency(c.estimatedPatientPayableMinor)}</Text>
   <Text style={styles.note}>{c.state==="APPROVED_AWAITING_FINANCE"?
    "Foundation approved; actual bank reimbursement is separate":
    c.state==="REJECTED"?"Not approved":c.state==="PARTNER_ATTESTED"?
    "Partner attested — Foundation review pending":"Awaiting verification"}.
    {" "+c.guidance}</Text>
  </View>)}
 </View>;
}
const styles=StyleSheet.create({
 panel:{padding:12,backgroundColor:t.surface,borderColor:t.border,
  borderWidth:1,borderRadius:10,gap:8},
 heading:{fontSize:16,fontWeight:"700",color:t.text},
 label:{fontSize:13,fontWeight:"600",color:t.text},
 note:{fontSize:12,color:t.mutedText},
 input:{minHeight:44,borderWidth:1,borderColor:t.border,color:t.text,
  backgroundColor:t.surface,borderRadius:8,paddingHorizontal:10},
 button:{backgroundColor:t.primary,borderRadius:8,minHeight:44,padding:10,
  justifyContent:"center"},
 buttonText:{color:t.primaryText,fontSize:12,fontWeight:"600"},
 active:{borderWidth:2,borderColor:t.text},
 disabled:{opacity:0.5},
 item:{padding:10,borderWidth:1,borderColor:t.border,borderRadius:8,gap:4}
});
