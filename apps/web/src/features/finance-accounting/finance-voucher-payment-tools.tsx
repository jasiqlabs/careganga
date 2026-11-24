"use client";
import {useEffect,useState} from "react";
import type {VoucherWorkflowRow} from "./finance-voucher-submission-tools";

type ProofFile={fileRef:string;fileVersion:number;mime:string;sizeBytes:string};
type Payment={paymentProofRef:string;fileRef:string;fileVersion:number;
 method:"BANK_STATEMENT"|"CASH_RECEIPT";bankReference:string|null;requiresPayrollDestination?:boolean;failedTransfer?:boolean;
 amountMinor:string;status:"PENDING_REVIEW"|"VERIFIED"|"REJECTED"};
type Uncertain={path:string;body:Record<string,unknown>;key:string;
 kind:"REQUEST"|"PROOF"|"VERIFY"|"POST"};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const allowed=new Set(["application/pdf","image/jpeg","image/png","image/webp"]);
const money=(v:string)=>{try{const n=BigInt(v),u=n<0n?-n:n;
 return(n<0n?"−":"")+"₹"+(u/100n).toLocaleString("en-IN")+"."+
 (u%100n).toString().padStart(2,"0");}catch{return "Amount unavailable";}};
async function explanation(response:Response){
 const raw:unknown=await response.json().catch(()=>null);
 const r=raw&&typeof raw==="object"&&!Array.isArray(raw)?raw as Record<string,unknown>:{};
 return typeof r.code==="string"&&r.code.startsWith("FINANCE_")&&
  typeof r.message==="string"&&r.message.length<=220?r.message:
  response.status===401?"Session expired. Sign in again.":
  response.status===403?"Only a currently authorized Finance user can perform this action.":
  response.status===409?"The original voucher, proof or permission changed. Refresh before continuing.":
  response.status===400?"Check the bank/cash reference and proof details.":
  response.status===429?"Too many confirmation attempts. Try again later.":
  "The original transaction result cannot be confirmed. Check its status before retrying.";
}
async function jsonPost(path:string,value:unknown){
 const response=await fetch(path,{method:"POST",cache:"no-store",
  headers:{"Content-Type":"application/json"},body:JSON.stringify(value)});
 if(!response.ok)throw Error(await explanation(response));
 return response.json() as Promise<Record<string,unknown>>;
}
export function FinanceVoucherPaymentTools({voucher,canManage,canUploadProof,canPost,canVerify,onUpdated}:{
 voucher:VoucherWorkflowRow;canManage:boolean;canUploadProof:boolean;canPost:boolean;canVerify:boolean;
 onUpdated:()=>void
}){
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState("");
 const [payment,setPayment]=useState<Payment|null>(null);
 const [files,setFiles]=useState<ProofFile[]>([]);
 const [chosen,setChosen]=useState("");
 const [picked,setPicked]=useState<File|null>(null);
 const [uploadKey,setUploadKey]=useState("");
 const [intentRef,setIntentRef]=useState("");
 const [reference,setReference]=useState("");
 const [currentPassword,setCurrentPassword]=useState("");
 const [evidenceHolder,setEvidenceHolder]=useState(""),[evidenceAccount,setEvidenceAccount]=useState(""),[evidenceIfsc,setEvidenceIfsc]=useState("");
 const clearEvidence=()=>{setEvidenceHolder("");setEvidenceAccount("");setEvidenceIfsc("");};
 const evidenceReady=()=>!!evidenceHolder.trim()&&/^[0-9]{6,22}$/.test(evidenceAccount)&&/^[A-Z]{4}0[A-Z0-9]{6}$/.test(evidenceIfsc);
 const [reviewAction,setReviewAction]=useState<"VERIFY"|"REJECT"|"CONFIRM_FAILED_TRANSFER">("VERIFY");
 const [pending,setPending]=useState<Uncertain|null>(null);
 const [retryReady,setRetryReady]=useState(false);
 useEffect(()=>{setPayment(null);setFiles([]);setChosen("");setPicked(null);
  setUploadKey("");setIntentRef("");setReference("");setCurrentPassword("");clearEvidence();
  setPending(null);setRetryReady(false);setNotice("");},
  [voucher.voucherRef,voucher.version,voucher.status]);
 const base="/api/finance/vouchers/"+voucher.voucherRef;
 const readPayment=async()=>{
  const response=await fetch(base+"/payment-proofs",{cache:"no-store"});
  if(!response.ok)throw Error(await explanation(response));
  const raw:unknown=await response.json();
  if(!raw||typeof raw!=="object"||!("payment" in raw))
   throw Error("The original payment verification cannot be read.");
  const p=raw.payment;
  if(p===null){setPayment(null);return null;}
  if(typeof p!=="object"||p===null||!("paymentProofRef" in p)||
    typeof p.paymentProofRef!=="string"||!UUID.test(p.paymentProofRef))
   throw Error("The submitted payment evidence could not be verified.");
  setPayment(p as Payment);return p as Payment;
 };
 async function refresh(){
  if(busy)return;setBusy(true);setNotice("");
  try{await readPayment();}catch(e){setPayment(null);setNotice(e instanceof Error?e.message:
   "Payment verification records cannot be checked.");}
  finally{setBusy(false);}
 }
 async function loadFiles(){
  if(busy||!canUploadProof)return;setBusy(true);setNotice("");
  try{
   const response=await fetch("/api/finance-evidence/vouchers/"+voucher.voucherRef+
     "/payment-files?version="+voucher.version,{cache:"no-store"});
   if(!response.ok)throw Error(await explanation(response));
   const raw:unknown=await response.json();
   if(!raw||typeof raw!=="object"||!("files" in raw)||!Array.isArray(raw.files))
    throw Error("Bank or cash receipt attachments could not be verified.");
   const found=(raw.files as ProofFile[]).filter(f=>typeof f.fileRef==="string"&&
    UUID.test(f.fileRef)&&Number.isSafeInteger(f.fileVersion)&&f.fileVersion>0);
   setFiles(found);setChosen(v=>found.some(x=>x.fileRef===v)?v:found[0]?.fileRef??"");
   setNotice(found.length?"Original verified payment attachments are available.":
    "Upload the actual bank statement or cash receipt and verify it first.");
  }catch(e){setFiles([]);setChosen("");setNotice(e instanceof Error?e.message:
    "Cannot read private payment attachments.");}
  finally{setBusy(false);}
 }
 async function upload(){
  if(!picked||busy||!canUploadProof)return;
  setBusy(true);setNotice("");
  try{
   if(!allowed.has(picked.type)||picked.size<1||picked.size>10485760)
    throw Error("Choose a PDF or JPG/PNG/WebP proof file, up to 10 MB.");
   const buffer=await picked.arrayBuffer();
   const sha=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",buffer)))
    .map(n=>n.toString(16).padStart(2,"0")).join("");
   const key=uploadKey||crypto.randomUUID();setUploadKey(key);
   const prepared=await jsonPost("/api/finance-evidence/intents",{
    voucherRef:voucher.voucherRef,voucherVersion:voucher.version,proofPurpose:"PAYMENT",
    mime:picked.type,sizeBytes:picked.size,sha256:sha,requestKey:key});
   if(prepared.status!=="UPLOAD_READY"||typeof prepared.uploadRef!=="string"||
    !UUID.test(prepared.uploadRef)||typeof prepared.uploadUrl!=="string"||
    !prepared.uploadUrl.startsWith("https://")||
    !prepared.uploadHeaders||typeof prepared.uploadHeaders!=="object"||
    Array.isArray(prepared.uploadHeaders))
    throw Error("Private upload reservation is unavailable. No payment has been verified.");
   setIntentRef(prepared.uploadRef);
   const sent=await fetch(prepared.uploadUrl,{method:"PUT",
    headers:prepared.uploadHeaders as Record<string,string>,body:buffer,cache:"no-store"});
   if(!sent.ok)throw Error("The original private upload was not confirmed. Check its status.");
   const verified=await jsonPost("/api/finance-evidence/intents/"+
    prepared.uploadRef+"/confirm",{});
   if(verified.cleanVerified!==true||typeof verified.fileRef!=="string"||
     !UUID.test(verified.fileRef)||!Number.isSafeInteger(verified.fileVersion))
    throw Error("The original bank/cash proof has not passed secure file and malware verification.");
   const proof={fileRef:verified.fileRef,fileVersion:Number(verified.fileVersion),
    mime:picked.type,sizeBytes:String(picked.size)};
   setFiles([proof]);setChosen(proof.fileRef);setPicked(null);
   setNotice("Private payment proof is scanned and ready for independent Finance review.");
  }catch(e){setNotice(e instanceof Error?e.message:
   "The original upload status cannot be confirmed. Check before uploading again.");}
  finally{setBusy(false);}
 }
 async function checkIntent(){
  if(!intentRef||busy)return;
  setBusy(true);setNotice("");
  try{
   const r=await fetch("/api/finance-evidence/intents/"+intentRef,{cache:"no-store"});
   if(!r.ok)throw Error(await explanation(r));
   const raw:unknown=await r.json();
   if(!raw||typeof raw!=="object"||!("cleanVerified" in raw)||
      raw.cleanVerified!==true||!("fileRef" in raw)||
      typeof raw.fileRef!=="string"||!UUID.test(raw.fileRef)||
      !("fileVersion" in raw)||!Number.isSafeInteger(raw.fileVersion))
    throw Error("Original private payment attachment is not yet verified.");
   setFiles([{fileRef:raw.fileRef,fileVersion:Number(raw.fileVersion),
    mime:picked?.type??"application/pdf",sizeBytes:String(picked?.size??0)}]);
   setChosen(raw.fileRef);setNotice("Original payment attachment is securely verified.");
  }catch(e){setNotice(e instanceof Error?e.message:"The original upload cannot be checked.");}
  finally{setBusy(false);}
 }
 async function execute(request:Uncertain){
  if(busy)return;setBusy(true);setNotice("");setRetryReady(false);
  try{
   const destination=request.kind==="VERIFY"&&request.body.action!=="REJECT"&&payment?.requiresPayrollDestination?{payrollDestinationEvidence:{accountHolder:evidenceHolder,accountNumber:evidenceAccount,ifsc:evidenceIfsc}}:{};
   const result=await jsonPost(request.path,{...request.body,...destination,requestKey:request.key});
   if(result.confirmed!==true||typeof result.status!=="string")
    throw Error("Original result is uncertain");
   setPending(null);setCurrentPassword("");
   setNotice(request.kind==="REQUEST"?"Payment verification can now be initiated. Nothing has been paid.":
    request.kind==="PROOF"?"Original bank/cash proof recorded. An independent authorized reviewer must verify it.":
    request.kind==="VERIFY"?"Independent reviewer outcome: "+result.status:
    "Approved balanced voucher posted once. This is not proof of an unverified transfer.");
   onUpdated();
  }catch(e){setPending(request);
   setNotice(e instanceof Error?e.message:"Original outcome uncertain. Check status before retrying.");}
  finally{if(request.kind==="VERIFY")clearEvidence();setBusy(false);}
 }
 async function checkOriginal(){
  if(!pending||busy)return;
  setBusy(true);setNotice("");
  try{
   if(pending.kind==="PROOF"||pending.kind==="VERIFY"){
    const p=await readPayment();
    if(p&&(pending.kind==="PROOF"||p.status!=="PENDING_REVIEW")){
     setPending(null);setNotice("The payment source has a recorded result. Refresh before continuing.");
     onUpdated();return;
    }
   }else{
    const r=await fetch("/api/finance/vouchers/workflow-commands/"+pending.key,
     {cache:"no-store"});
    if(!r.ok)throw Error(await explanation(r));
    const raw=await r.json() as {confirmed:boolean;status:string|null};
    if(raw.confirmed){setPending(null);setNotice("Original Finance action confirmed.");onUpdated();return;}
   }
   setRetryReady(true);
   setNotice("No confirmed original result was found. Retry only the exact same request.");
  }catch(e){setNotice(e instanceof Error?e.message:
   "Original status is unavailable. Do not create a second request.");}
  finally{setBusy(false);}
 }
 const isPayment=["PAYMENT","CONTRA"].includes(voucher.type);
 const paymentStage=isPayment&&voucher.status==="APPROVED";
 const readyForProof=isPayment&&voucher.status==="PAYMENT_REQUESTED";
 const readyForPost=canPost&&(voucher.status==="PAID_VERIFIED"||
  voucher.status==="APPROVED"&&!isPayment);
 const proof=files.find(f=>f.fileRef===chosen);
 const method=voucher.paymentAccountKind==="BANK"?"BANK_STATEMENT":"CASH_RECEIPT";
 return <div className="cg-fin-voucher-actions">
  <p className="cg-fin-help">{voucher.status==="POSTED"?
    "Posted to the audited ledger. Payment verification remains a separate source.":
    voucher.status==="PAID_VERIFIED"?"Independently verified money movement. Posting remains a separate action.":
    voucher.status==="APPROVED"?"Approved by a separate reviewer; no payment has been confirmed.":
    "No bank or cash movement is considered verified until independently reviewed."}</p>
  {paymentStage&&canManage&&<button type="button" disabled={busy||!!pending} onClick={()=>void execute({
   path:base+"/request-payment",key:crypto.randomUUID(),kind:"REQUEST",
   body:{expectedVersion:voucher.version}
  })}>Request payment verification</button>}
  {readyForProof&&<button type="button" disabled={busy} onClick={()=>void refresh()}>
   Check independent payment review</button>}
  {readyForProof&&canManage&&canUploadProof&&!payment?.failedTransfer&&<>
   <label className="cg-fin-voucher-attach">Original {method==="BANK_STATEMENT"?
    "bank statement":"cash receipt"} (privately scanned)
    <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" disabled={busy}
     onChange={e=>{setPicked(e.target.files?.[0]??null);
      setIntentRef("");setUploadKey("");}}/></label>
   {picked&&<button type="button" disabled={busy} onClick={()=>void upload()}>
     Upload and verify bank/cash evidence</button>}
   {intentRef&&<button type="button" disabled={busy} onClick={()=>void checkIntent()}>
     Check original secure upload</button>}
   <button type="button" disabled={busy} onClick={()=>void loadFiles()}>
    Choose verified payment evidence</button>
   {!!files.length&&<label className="cg-fin-voucher-attach">Verified private proof
    <select value={chosen} onChange={e=>setChosen(e.target.value)}>
     {files.map((f,i)=><option key={f.fileRef} value={f.fileRef}>
      Verified payment file {i+1} ({f.mime})</option>)}
    </select></label>}
   {method==="BANK_STATEMENT"&&<label className="cg-fin-voucher-attach">
    Bank transaction reference *
    <input value={reference} maxLength={64} placeholder="As shown on bank statement"
     onChange={e=>setReference(e.target.value)}/></label>}
   {proof&&<button type="button" disabled={busy||!!pending||
    method==="BANK_STATEMENT"&&!/^[A-Za-z0-9 /._-]{6,64}$/.test(reference.trim())}
    onClick={()=>void execute({path:base+"/payment-proofs",kind:"PROOF",
     key:crypto.randomUUID(),body:{expectedVersion:voucher.version,
      fileRef:proof.fileRef,fileVersion:proof.fileVersion,method,
      transactionReference:method==="BANK_STATEMENT"?reference.trim():""}})}>
     Submit actual payment proof for independent verification</button>}
  </>}
  {payment&&<div className="cg-fin-review-summary">
   <p><strong>Payment proof:</strong> {payment.failedTransfer?"Verified failed transfer — salary remains due":payment.status==="PENDING_REVIEW"?
    "Waiting for different authorized reviewer":payment.status==="VERIFIED"?
    "Independently verified": "Rejected — upload a corrected proof"}</p>
   <p><strong>Amount:</strong> {money(payment.amountMinor)}</p>
   <p><strong>Evidence type:</strong> {payment.method==="BANK_STATEMENT"?
    "Bank statement":"Cash receipt"}</p>
   {payment.bankReference&&<p><strong>Bank transaction reference:</strong> {payment.bankReference}</p>}
   <a href={"/api/finance-evidence/files/"+payment.fileRef+"/download"}
    target="_blank" rel="noopener noreferrer">Open original protected payment evidence</a>
   {canVerify&&payment.status==="PENDING_REVIEW"&&<>
    <p>Confirm this transaction against the original bank statement or signed cash receipt.
     You cannot verify a payment you initiated. Confirm a failed transfer only when the original bank advice definitively proves no funds moved; a rejected document or pending/unknown result is not failure.</p>
    <label className="cg-fin-voucher-attach">Independent verification decision
     <select value={reviewAction} onChange={e=>setReviewAction(e.target.value as typeof reviewAction)}>
      <option value="VERIFY">Confirm funds moved</option>
      <option value="REJECT">Reject proof</option>{payment.requiresPayrollDestination&&<option value="CONFIRM_FAILED_TRANSFER">Confirm actual failed bank transfer (no funds moved)</option>}
     </select></label>
    {payment.requiresPayrollDestination&&(reviewAction!=="REJECT"||(pending?.body.action==="CONFIRM_FAILED_TRANSFER"||pending?.body.action==="VERIFY"))&&<div className="cg-fin-review-summary"><p>Compare the original bank transfer advice with the approved payroll recipient. Enter the exact beneficiary details from the original evidence. Stored destination details are never displayed.</p>
    <label>Beneficiary account holder<input autoComplete="off" maxLength={100} value={evidenceHolder} onChange={e=>setEvidenceHolder(e.target.value)}/></label>
    <label>Beneficiary account number<input type="password" inputMode="numeric" autoComplete="off" maxLength={22} value={evidenceAccount} onChange={e=>setEvidenceAccount(e.target.value)}/></label>
    <label>Beneficiary IFSC<input autoComplete="off" maxLength={11} value={evidenceIfsc} onChange={e=>setEvidenceIfsc(e.target.value.toUpperCase())}/></label></div>}
    <label className="cg-fin-voucher-attach">Current password *
     <input type="password" autoComplete="current-password" value={currentPassword}
      onChange={e=>setCurrentPassword(e.target.value)}/></label>
    <button type="button" disabled={busy||!!pending||currentPassword.length<8||Boolean(payment.requiresPayrollDestination&&reviewAction!=="REJECT"&&!evidenceReady())}
     onClick={()=>void execute({path:base+"/payment-proofs/"+
      payment.paymentProofRef+"/verify",kind:"VERIFY",
      key:crypto.randomUUID(),body:{action:reviewAction,currentPassword}})}>
     Confirm independent bank/cash review</button>
   </>}
  </div>}
  {readyForPost&&<button type="button" disabled={busy||!!pending}
   onClick={()=>void execute({path:base+"/post",kind:"POST",
    key:crypto.randomUUID(),body:{expectedVersion:voucher.version}})}>
   Post original balanced journal (once)</button>}
  {pending&&<div className="cg-fin-pending">
   <p>The original action result is uncertain. Check it before attempting again.</p>
   <button type="button" disabled={busy} onClick={()=>void checkOriginal()}>
    Check original action</button>
   {retryReady&&<button type="button" disabled={busy||Boolean(pending.kind==="VERIFY"&&pending.body.action!=="REJECT"&&payment?.requiresPayrollDestination&&!evidenceReady())}
    onClick={()=>void execute(pending)}>Retry exact original request</button>}
  </div>}
  {notice&&<p role="status" className="cg-fin-help">{notice}</p>}
 </div>;
}
