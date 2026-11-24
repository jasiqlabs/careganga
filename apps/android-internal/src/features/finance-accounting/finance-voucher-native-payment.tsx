import {useEffect,useRef,useState} from "react";
import {ActivityIndicator,Pressable,StyleSheet,Text,TextInput,View} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import {File,Paths,UploadType} from "expo-file-system";
import * as Crypto from "expo-crypto";
import * as Sharing from "expo-sharing";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";

type Voucher={voucherRef:string;voucherNumber:string;type:string;version:number;
 status:string;paymentAccountKind:"CASH"|"BANK"|null};
type ProofFile={fileRef:string;fileVersion:number;mime:string};
type Payment={paymentProofRef:string;fileRef:string;fileVersion:number;
 method:"BANK_STATEMENT"|"CASH_RECEIPT";status:string;bankReference:string|null;amountMinor:string;requiresPayrollDestination?:boolean;failedTransfer?:boolean};
type ProviderReadback={externalReference:string;providerState:string;automated:boolean};
type PaymentRead={payment:Payment|null;providerReadback?:ProviderReadback|null;dispatchAvailable?:boolean};
type Picked={uri:string;mime:string;name:string;size:number};
type Pending={key:string;path:string;kind:"REQUEST"|"PROOF"|"VERIFY"|"POST";body:Record<string,unknown>};
type Props={token:string;voucher:Voucher;canManage:boolean;canPost:boolean;
 canUploadProof:boolean;canVerifyPayment:boolean;onUpdated:()=>void;onExpired:()=>void};
const MIME=new Set(["application/pdf","image/jpeg","image/png","image/webp"]);
const money=(v:string)=>{try{const n=BigInt(v),abs=n<0n?-n:n;
 return (n<0n?"−":"")+"₹"+(abs/100n).toLocaleString("en-IN")+"."+
 (abs%100n).toString().padStart(2,"0");}catch{return "Amount unavailable";}};
async function call<T>(token:string,path:string,method:"GET"|"POST"="GET",body?:object):Promise<T>{
 let response:Response;
 try{
  response=await identityRequest(path,{method,cache:"no-store",
   headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},
   ...(body?{body:JSON.stringify(body)}:{})});
 }catch{throw Error("UNKNOWN");}
 if(response.status===401)throw Error("EXPIRED");
 if(!response.ok){
  const raw:unknown=await response.json().catch(()=>null);
  const r=raw&&typeof raw==="object"&&!Array.isArray(raw)?raw as Record<string,unknown>:{};
  if(typeof r.code==="string"&&r.code.startsWith("FINANCE_")&&
    typeof r.message==="string"&&r.message.length<=220)
   throw Error("USER:"+r.message);
  throw Error(response.status===403?"DENIED":response.status===409?"CHANGED":
   response.status===400?"INVALID":"UNKNOWN");
 }
 try{return await response.json() as T;}catch{throw Error("UNKNOWN");}
}
const friendly=(e:unknown)=>{
 const v=e instanceof Error?e.message:"UNKNOWN";
 if(v.startsWith("USER:"))return v.slice(5);
 return v==="EXPIRED"?"Your session expired. Sign in again.":
  v==="DENIED"?"Your current role is not permitted to perform this Finance action.":
  v==="CHANGED"?"The original voucher, bank proof or reviewer status changed. Refresh.":
  v==="INVALID"?"Check the transaction reference and proof file.":
  "The original result cannot be confirmed. Check the same record before retrying.";
};
export function FinanceVoucherNativePayment({token,voucher,canManage,canPost,
 canUploadProof,canVerifyPayment,onUpdated,onExpired}:Props){
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState("");
 const [proofs,setProofs]=useState<ProofFile[]>([]);
 const [selected,setSelected]=useState("");
 const [payment,setPayment]=useState<Payment|null>(null);
 const [provider,setProvider]=useState<ProviderReadback|null>(null),[dispatchAvailable,setDispatchAvailable]=useState(false);
 const generation=useRef(0);
 const [picked,setPicked]=useState<Picked|null>(null);
 const [uploadKey,setUploadKey]=useState("");
 const [intentRef,setIntentRef]=useState("");
 const [bankReference,setBankReference]=useState("");
 const [currentPassword,setCurrentPassword]=useState("");
 const [evidenceHolder,setEvidenceHolder]=useState(""),[evidenceAccount,setEvidenceAccount]=useState(""),[evidenceIfsc,setEvidenceIfsc]=useState("");
 const clearEvidence=()=>{setEvidenceHolder("");setEvidenceAccount("");setEvidenceIfsc("");};
 const evidenceReady=()=>!!evidenceHolder.trim()&&/^[0-9]{6,22}$/.test(evidenceAccount)&&/^[A-Z]{4}0[A-Z0-9]{6}$/.test(evidenceIfsc);
 const [action,setAction]=useState<"VERIFY"|"REJECT"|"CONFIRM_FAILED_TRANSFER">("VERIFY");
 const [pending,setPending]=useState<Pending|null>(null);
 const [retryReady,setRetryReady]=useState(false);
 const url="/api/finance-accounting/vouchers/"+voucher.voucherRef;
 useEffect(()=>{generation.current++;setProofs([]);setSelected("");setPayment(null);setProvider(null);setDispatchAvailable(false);setPicked(null);
  setUploadKey("");setIntentRef("");setBankReference("");setCurrentPassword("");clearEvidence();
  setNotice("");setPending(null);setRetryReady(false);return()=>{generation.current++;};},
  [token,voucher.voucherRef,voucher.version,voucher.status]);
 const method=voucher.paymentAccountKind==="BANK"?"BANK_STATEMENT":"CASH_RECEIPT";
 async function refresh(){
  if(busy)return;setBusy(true);setNotice("");
  const current=generation.current;
  try{
   const result=await call<PaymentRead>(token,url+"/payment-proofs");
   if(current!==generation.current)return;
   setProvider(result.providerReadback??null);setDispatchAvailable(result.dispatchAvailable===true);
   if(result.payment&&(!result.payment.paymentProofRef||
     !["PENDING_REVIEW","VERIFIED","REJECTED"].includes(result.payment.status)))
    throw Error("UNKNOWN");
   setPayment(result.payment);
   setNotice(result.payment?"Original bank/cash verification details loaded.":
    "No payment proof has been submitted for independent review.");
  }catch(e){setPayment(null);setProvider(null);setDispatchAvailable(false);setNotice(friendly(e));
   if(e instanceof Error&&e.message==="EXPIRED")onExpired();}
  finally{setBusy(false);}
 }
 async function loadFiles(){
  if(busy||!canUploadProof)return;
  setBusy(true);setNotice("");
  try{
   const r=await call<{files:ProofFile[]}>(token,
    "/api/documents/finance-voucher-evidence/vouchers/"+voucher.voucherRef+
    "/payment-files?version="+voucher.version);
   if(!Array.isArray(r.files))throw Error("UNKNOWN");
   setProofs(r.files);setSelected(o=>r.files.some(f=>f.fileRef===o)?
    o:r.files[0]?.fileRef??"");
   setNotice(r.files.length?"Original clean payment attachments are available.":
    "Upload a genuine private bank statement or signed cash receipt first.");
  }catch(e){setProofs([]);setSelected("");setNotice(friendly(e));
   if(e instanceof Error&&e.message==="EXPIRED")onExpired();}
  finally{setBusy(false);}
 }
 async function choose(){
  if(busy||pending)return;
  try{
   const response=await DocumentPicker.getDocumentAsync({
    type:["application/pdf","image/jpeg","image/png","image/webp"],
    multiple:false,copyToCacheDirectory:true});
   if(response.canceled)return;
   const file=response.assets?.[0];
   if(!file||!file.mimeType||!MIME.has(file.mimeType)||
    !file.size||file.size<1||file.size>10485760){
    setNotice("Choose an authentic PDF, JPG, PNG or WebP bank/cash proof under 10 MB.");return;}
   setPicked({uri:file.uri,name:file.name,mime:file.mimeType,size:file.size});
   setUploadKey("");setIntentRef("");setNotice("");
  }catch{setNotice("The private file picker cannot be opened. Try again.");}
 }
 async function upload(){
  if(!picked||busy||!canUploadProof)return;
  setBusy(true);setNotice("");
  try{
   const file=new File(picked.uri),checksum=await file.digest("SHA-256");
   if(!/^[0-9a-f]{64}$/.test(checksum))throw Error("UNKNOWN");
   const key=uploadKey||Crypto.randomUUID();setUploadKey(key);
   const intent=await call<{status:string;uploadRef:string;uploadUrl?:string;
    uploadHeaders?:Record<string,string>}>(token,
    "/api/documents/finance-voucher-evidence/intents","POST",{
     voucherRef:voucher.voucherRef,voucherVersion:voucher.version,
     proofPurpose:"PAYMENT",requestKey:key,mime:picked.mime,
     sizeBytes:picked.size,sha256:checksum});
   if(intent.status!=="UPLOAD_READY"||!intent.uploadRef||!intent.uploadUrl||
      !intent.uploadUrl.startsWith("https://")||!intent.uploadHeaders||
      intent.uploadHeaders["Content-Type"]!==picked.mime){
    setNotice("The private upload has not been verified. Check the original request.");return;}
   setIntentRef(intent.uploadRef);
   const job=file.createUploadTask(intent.uploadUrl,{
    httpMethod:"PUT",uploadType:UploadType.BINARY_CONTENT,mimeType:picked.mime,
    headers:intent.uploadHeaders,sessionType:"foreground"});
   let uploaded;
   try{uploaded=await job.uploadAsync();}finally{job.release();}
   if(uploaded.status<200||uploaded.status>=300)throw Error("UNKNOWN");
   const verified=await call<{cleanVerified:boolean;fileRef:string|null;
    fileVersion:number|null}>(token,
    "/api/documents/finance-voucher-evidence/intents/"+intent.uploadRef+"/confirm",
    "POST",{});
   if(!verified.cleanVerified||!verified.fileRef||!verified.fileVersion)
    throw Error("UNKNOWN");
   const result={fileRef:verified.fileRef,fileVersion:verified.fileVersion,mime:picked.mime};
   setProofs([result]);setSelected(result.fileRef);
   setNotice("Original bank/cash proof passed private storage, checksum and malware verification.");
  }catch(e){setNotice(friendly(e));if(e instanceof Error&&e.message==="EXPIRED")onExpired();}
  finally{setBusy(false);}
 }
 async function checkIntent(){
  if(!intentRef||busy)return;
  setBusy(true);setNotice("");
  try{
   const result=await call<{cleanVerified:boolean;fileRef:string|null;
    fileVersion:number|null}>(token,
    "/api/documents/finance-voucher-evidence/intents/"+intentRef);
   if(!result.cleanVerified||!result.fileRef||!result.fileVersion)throw Error("UNKNOWN");
   setProofs([{fileRef:result.fileRef,fileVersion:result.fileVersion,
    mime:picked?.mime??"application/pdf"}]);setSelected(result.fileRef);
   setNotice("Original private evidence is clean and verified.");
  }catch(e){setNotice(friendly(e));if(e instanceof Error&&e.message==="EXPIRED")onExpired();}
  finally{setBusy(false);}
 }
 async function execute(p:Pending){
  if(busy)return;setBusy(true);setNotice("");setRetryReady(false);
  const {currentPassword:initialPassword,...retryBody}=p.body;
  const protectedAction=p.kind==="VERIFY"||retryBody.dispatchPayroll===true;
  const password=typeof initialPassword==="string"?initialPassword:currentPassword;
  if(protectedAction)setCurrentPassword("");
  try{
   const destination=p.kind==="VERIFY"&&p.body.action!=="REJECT"&&payment?.requiresPayrollDestination?{payrollDestinationEvidence:{accountHolder:evidenceHolder,accountNumber:evidenceAccount,ifsc:evidenceIfsc}}:{};
   const result=await call<{confirmed:boolean;status:string}>(token,p.path,"POST",
    {...retryBody,...(protectedAction?{currentPassword:password}:{}),...destination,requestKey:p.key});
   if(!result.confirmed||typeof result.status!=="string")throw Error("UNKNOWN");
   setPending(null);setCurrentPassword("");
   setNotice(p.kind==="REQUEST"?(retryBody.dispatchPayroll===true?"Original bank payout requested. Do not make a separate transfer; verify the original outcome.":"Original voucher is awaiting independently checked payment proof."):
    p.kind==="PROOF"?"Payment proof recorded for a different authorized reviewer.":
    p.kind==="VERIFY"?"Independent payment verification result: "+result.status:
    "Approved voucher posted once in the original balanced ledger.");
   onUpdated();
  }catch(e){setPending({...p,body:retryBody});setNotice(friendly(e));
   if(e instanceof Error&&e.message==="EXPIRED")onExpired();}
  finally{if(p.kind==="VERIFY")clearEvidence();setBusy(false);}
 }
 async function viewOriginalProof(){
  if(!payment||busy)return;
  setBusy(true);setNotice("");
  let temp:File|null=null;
  try{
   const response=await identityRequest("/api/documents/finance-voucher-evidence/files/"+
    payment.fileRef+"/download",{cache:"no-store",
    headers:{Authorization:"Bearer "+token}});
   if(response.status===401){onExpired();return;}
   if(!response.ok)throw Error(response.status===403?"DENIED":"UNKNOWN");
   const mime=response.headers.get("content-type")?.split(";")[0]??"";
   if(!MIME.has(mime))throw Error("UNKNOWN");
   const bytes=new Uint8Array(await response.arrayBuffer());
   if(bytes.length<1||bytes.length>10485760)throw Error("UNKNOWN");
   const ext=mime==="application/pdf"?".pdf":mime==="image/jpeg"?".jpg":
    mime==="image/png"?".png":".webp";
   temp=new File(Paths.cache,"careganga-private-finance-proof-"+Crypto.randomUUID()+ext);
   temp.create();await temp.write(bytes);
   if(!await Sharing.isAvailableAsync())throw Error("UNKNOWN");
   await Sharing.shareAsync(temp.uri,{mimeType:mime,dialogTitle:"Open private Finance payment proof"});
  }catch(e){setNotice(friendly(e));}
  finally{try{temp?.delete();}catch{}setBusy(false);}
 }
 async function checkOriginal(){
  if(!pending||busy)return;setBusy(true);setNotice("");
  try{
   if(pending.kind==="PROOF"||pending.kind==="VERIFY"){
    const found=await call<{payment:Payment|null}>(token,url+"/payment-proofs");
    setPayment(found.payment);
    if(found.payment&&(pending.kind==="PROOF"||found.payment.status!=="PENDING_REVIEW")){
     setPending(null);setNotice("Original money proof has a recorded result.");onUpdated();return;
    }
   }else{
    const result=await call<{confirmed:boolean;status:string|null}>(token,
     "/api/finance-accounting/vouchers/workflow-commands/"+pending.key);
    if(result.confirmed){setPending(null);setNotice("Original voucher action confirmed.");
     onUpdated();return;}
   }
   setRetryReady(true);setNotice("No completed change was found. Retry only the original request.");
  }catch(e){setNotice(friendly(e));if(e instanceof Error&&e.message==="EXPIRED")onExpired();}
  finally{setBusy(false);}
 }
 const isMoney=["PAYMENT","CONTRA"].includes(voucher.type);
 const selectedProof=proofs.find(p=>p.fileRef===selected);
 const posting=canPost&&(voucher.status==="PAID_VERIFIED"||
  voucher.status==="APPROVED"&&!isMoney);
 const button=(caption:string,press:()=>void,disabled=false)=>
  <Pressable accessibilityRole="button" disabled={busy||disabled} style={styles.button}
   onPress={press}><Text style={styles.buttonText}>{caption}</Text></Pressable>;
 return <View style={styles.card}>
  <Text style={styles.title}>Payment proof & controlled posting</Text>
  <Text style={styles.hint}>{voucher.status==="POSTED"?
   "Original double-entry ledger posted. The payment evidence is independently tracked.":
   "Approval is not a cash transfer. Payment requires a separate verified original source."}</Text>
  {isMoney&&voucher.status==="APPROVED"&&canManage&&button(
   "Request independent payment verification",()=>void execute({
    path:url+"/request-payment",kind:"REQUEST",key:Crypto.randomUUID(),
    body:{expectedVersion:voucher.version}}),!!pending)}
  {isMoney&&voucher.status==="APPROVED"&&canManage&&method==="BANK_STATEMENT"&&button("Check configured payroll bank payout",()=>void refresh(),!!pending)}
  {isMoney&&voucher.status==="APPROVED"&&canManage&&dispatchAvailable&&<View style={styles.card}>
   <Text style={styles.bold}>Send approved salary through configured bank</Text>
   <Text style={styles.hint}>This initiates a real bank transfer when live credentials are enabled. Confirm the approved salary and selected bank; do not also transfer manually.</Text>
   <TextInput accessibilityLabel="Current password to authorize bank payout" value={currentPassword} secureTextEntry autoCapitalize="none" autoComplete="current-password" onChangeText={setCurrentPassword} style={styles.input}/>
   {button("Authorize and send original payroll payout",()=>void execute({path:url+"/request-payment",kind:"REQUEST",key:Crypto.randomUUID(),body:{expectedVersion:voucher.version,dispatchPayroll:true}}),!!pending||currentPassword.length<8)}
  </View>}
  {provider&&<View style={styles.card}>
   <Text style={styles.bold}>Original bank status: {provider.providerState.replaceAll("_"," ").toLowerCase()}</Text>
   <Text style={styles.hint}>{provider.automated?"Original protected payout requested through configured bank. Do not send separately.":"Use only the original bank reference; do not create another payout."} Provider status is not final salary settlement.</Text>
   {!provider.automated&&canManage&&<Text selectable style={styles.hint}>Bank payout reference: {provider.externalReference}</Text>}
   {["EXHAUSTED","REVIEW_REQUIRED"].includes(provider.providerState)&&<Text style={styles.hint}>Bank outcome requires independent Finance reconciliation. Do not retry as a new transfer.</Text>}
  </View>}
  {isMoney&&voucher.status==="PAYMENT_REQUESTED"&&<>
   {button("Check original bank status and independent review",()=>void refresh())}
   {canUploadProof&&!payment?.failedTransfer&&<>
    {button("Choose bank/cash statement file",()=>void choose(),!!pending)}
    {picked&&<><Text style={styles.hint}>{picked.name}</Text>
     {button("Upload and scan original proof",()=>void upload(),!!pending)}</>}
    {!!intentRef&&button("Check original private upload",()=>void checkIntent())}
    {button("Choose verified payment attachment",()=>void loadFiles())}
    {proofs.map((f,i)=><Pressable accessibilityRole="radio"
      accessibilityState={{checked:selected===f.fileRef}}
      key={f.fileRef} style={styles.button}
      onPress={()=>setSelected(f.fileRef)}>
      <Text style={styles.buttonText}>Verified file {i+1}
       {selected===f.fileRef?" · Selected":""}</Text></Pressable>)}
    {method==="BANK_STATEMENT"&&<><Text style={styles.hint}>Bank transaction reference *</Text>
     <TextInput style={styles.input} value={bankReference} maxLength={64}
      autoCapitalize="characters" onChangeText={setBankReference}
      placeholder="As shown on bank statement"/></>}
    {selectedProof&&button("Submit original money proof for review",()=>void execute({
     path:url+"/payment-proofs",kind:"PROOF",key:Crypto.randomUUID(),
     body:{expectedVersion:voucher.version,fileRef:selectedProof.fileRef,
      fileVersion:selectedProof.fileVersion,method,
      transactionReference:method==="BANK_STATEMENT"?bankReference.trim():""}}),
      !!pending||(method==="BANK_STATEMENT"&&
        !/^[A-Za-z0-9 /._-]{6,64}$/.test(bankReference.trim())))}
   </>}
  </>}
  {payment&&<View style={styles.card}>
   <Text style={styles.bold}>Payment proof: {payment.failedTransfer?"Verified failed transfer — salary remains due":payment.status.replaceAll("_"," ")}</Text>
   <Text style={styles.hint}>Amount: {money(payment.amountMinor)}</Text>
   <Text style={styles.hint}>Method: {payment.method==="BANK_STATEMENT"?
    "Bank statement":"Cash receipt"}</Text>
   {payment.bankReference&&<Text style={styles.hint}>
    Bank transaction reference: {payment.bankReference}</Text>}
   {button("Review original private statement/receipt",()=>void viewOriginalProof())}
   {canVerifyPayment&&payment.status==="PENDING_REVIEW"&&<>
    <Text style={styles.hint}>Compare this transaction with its original private statement
     or cash receipt before verifying. Self-verification is prohibited. A failed transfer requires original bank advice proving no funds moved; rejected evidence or unknown status is not failure.</Text>
    <View style={styles.actions}>{(["VERIFY","REJECT",...(payment.requiresPayrollDestination?["CONFIRM_FAILED_TRANSFER" as const]:[])] as const).map(k=>
     <Pressable key={k} accessibilityRole="radio"
      accessibilityState={{checked:action===k}} style={styles.button}
      onPress={()=>setAction(k)}><Text style={styles.buttonText}>
       {k==="VERIFY"?"Confirm funds moved":k==="REJECT"?"Reject proof":"Confirm actual failed transfer"}</Text></Pressable>)}</View>
    {payment.requiresPayrollDestination&&(action!=="REJECT"||(pending?.body.action==="CONFIRM_FAILED_TRANSFER"||pending?.body.action==="VERIFY"))&&<><Text style={styles.hint}>Enter the exact beneficiary details from the original bank transfer advice. Stored bank details are not displayed.</Text>
    <TextInput accessibilityLabel="Beneficiary account holder" value={evidenceHolder} maxLength={100} autoComplete="off" onChangeText={setEvidenceHolder} style={styles.input}/>
    <TextInput accessibilityLabel="Beneficiary account number" value={evidenceAccount} maxLength={22} secureTextEntry keyboardType="number-pad" autoComplete="off" onChangeText={setEvidenceAccount} style={styles.input}/>
    <TextInput accessibilityLabel="Beneficiary IFSC" value={evidenceIfsc} maxLength={11} autoCapitalize="characters" autoComplete="off" onChangeText={v=>setEvidenceIfsc(v.toUpperCase())} style={styles.input}/></>}
    <Text style={styles.hint}>Your current password *</Text>
    <TextInput value={currentPassword} secureTextEntry autoCapitalize="none"
     onChangeText={setCurrentPassword} style={styles.input}/>
    {button("Confirm independent review",()=>void execute({
     path:url+"/payment-proofs/"+payment.paymentProofRef+"/verify",
     kind:"VERIFY",key:Crypto.randomUUID(),
     body:{action,currentPassword}}),!!pending||currentPassword.length<8||Boolean(payment.requiresPayrollDestination&&action!=="REJECT"&&!evidenceReady()))}
   </>}
  </View>}
  {posting&&button("Post genuine balanced journal once",()=>void execute({
   path:url+"/post",kind:"POST",key:Crypto.randomUUID(),
   body:{expectedVersion:voucher.version}}),!!pending)}
  {pending&&<>
   <Text style={styles.hint}>Original result is uncertain. Check it before a second attempt.</Text>
   {button("Check original action",()=>void checkOriginal())}
   {retryReady&&(pending.kind==="VERIFY"||pending.body.dispatchPayroll===true)&&<TextInput accessibilityLabel="Re-enter current password for the same request" value={currentPassword} secureTextEntry autoComplete="current-password" autoCapitalize="none" onChangeText={setCurrentPassword} style={styles.input}/>}
   {retryReady&&button("Retry exact original request",()=>void execute(pending),((pending.kind==="VERIFY"||pending.body.dispatchPayroll===true)&&currentPassword.length<8)||Boolean(pending.kind==="VERIFY"&&pending.body.action!=="REJECT"&&payment?.requiresPayrollDestination&&!evidenceReady()))}
  </>}
  {busy&&<ActivityIndicator color={t.primary}/>}
  {!!notice&&<Text accessibilityRole="alert" style={styles.hint}>{notice}</Text>}
 </View>;
}
const styles=StyleSheet.create({
 card:{padding:12,gap:9,backgroundColor:t.surface,borderWidth:1,
  borderColor:t.border,borderRadius:8},
 title:{fontWeight:"700",fontSize:15,color:t.text},
 bold:{fontWeight:"700",fontSize:14,color:t.text},
 hint:{fontSize:13,lineHeight:19,color:t.mutedText},
 actions:{flexDirection:"row",gap:8,flexWrap:"wrap"},
 button:{minHeight:48,paddingHorizontal:12,justifyContent:"center",
  borderWidth:1,borderColor:t.border,borderRadius:8},
 buttonText:{fontWeight:"600",fontSize:13,color:t.primary},
 input:{minHeight:48,paddingHorizontal:11,borderWidth:1,
  borderColor:t.border,borderRadius:8,color:t.text,backgroundColor:t.surface}
});
