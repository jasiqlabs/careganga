"use client";
import {useEffect,useState} from "react";

export type VoucherWorkflowRow={voucherRef:string;voucherNumber:string;version:number;
 status:string;approvalCaseRef:string|null};
type Proof={fileRef:string;fileVersion:number;mime:string;sizeBytes:string};
type Unconfirmed={requestKey:string;method:"submit"|"settle";payload:Record<string,unknown>};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const allowed=new Set(["application/pdf","image/jpeg","image/png","image/webp"]);
async function message(res:Response){
 const raw:unknown=await res.json().catch(()=>null);
 const x=raw&&typeof raw==="object"&&!Array.isArray(raw)?raw as Record<string,unknown>:{};
 return typeof x.code==="string"&&x.code.startsWith("FINANCE_")&&
  typeof x.message==="string"&&x.message.length<=300?x.message:
  res.status===403?"This action needs current voucher and private-file permissions.":
  res.status===409?"The file, voucher or review changed. Refresh the original records.":
  res.status===401?"Session expired. Sign in again.":
  "The original result cannot be confirmed. Check before repeating the action.";
}
function typedUpload(raw:unknown){
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return null;
 const x=raw as Record<string,unknown>;
 if(x.status!=="UPLOAD_READY"||typeof x.uploadRef!=="string"||!UUID.test(x.uploadRef)||
   typeof x.uploadUrl!=="string"||!x.uploadUrl.startsWith("https://")||
   !x.uploadHeaders||typeof x.uploadHeaders!=="object"||Array.isArray(x.uploadHeaders))
  return null;
 return {uploadRef:x.uploadRef,uploadUrl:x.uploadUrl,
  uploadHeaders:x.uploadHeaders as Record<string,string>};
}
export function FinanceVoucherSubmissionTools({voucher,canViewEvidence,canUploadEvidence,
 onUpdated}:{voucher:VoucherWorkflowRow;canViewEvidence:boolean;canUploadEvidence:boolean;
 onUpdated:()=>void}){
 const [files,setFiles]=useState<Proof[]>([]);
 const [selected,setSelected]=useState("");
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState("");
 const [pending,setPending]=useState<Unconfirmed|null>(null);
 const [confirmNoResult,setConfirmNoResult]=useState(false);
 const [intentRef,setIntentRef]=useState("");
 const [uploadKey,setUploadKey]=useState("");
 const [file,setFile]=useState<File|null>(null);
 const selectable=files.find(f=>f.fileRef===selected);
 useEffect(()=>{setFiles([]);setSelected("");setFile(null);setIntentRef("");setUploadKey("");
  setPending(null);setNotice("");setConfirmNoResult(false);},
  [voucher.voucherRef,voucher.version]);
 async function checkFiles(){
  if(!canViewEvidence||busy)return;
  setBusy(true);setNotice("");
  try{
   const r=await fetch("/api/finance-evidence/vouchers/"+voucher.voucherRef+
    "/files?version="+voucher.version,{cache:"no-store"});
   if(!r.ok)throw Error(await message(r));
   const value:unknown=await r.json();
   if(!value||typeof value!=="object"||!("files" in value)||!Array.isArray(value.files))
    throw Error("Verified voucher attachments are unavailable. Check again.");
   const found=(value.files as Proof[]).filter(f=>typeof f.fileRef==="string"&&UUID.test(f.fileRef)&&
    Number.isSafeInteger(f.fileVersion)&&f.fileVersion>0);
   setFiles(found);setSelected(s=>found.some(f=>f.fileRef===s)?s:found[0]?.fileRef??"");
   setNotice(found.length?found.length+" currently verified file(s) for this voucher revision.":
    "No verified voucher attachment exists. Upload and verify one before submitting.");
  }catch(e){setFiles([]);setSelected("");setNotice(
   e instanceof Error?e.message:"Could not confirm private evidence.");}
  finally{setBusy(false);}
 }
 async function confirm(ref:string){
  const r=await fetch("/api/finance-evidence/intents/"+ref+"/confirm",{
   method:"POST",headers:{"Content-Type":"application/json"},body:"{}",cache:"no-store"});
  if(!r.ok)throw Error(await message(r));
  const value:unknown=await r.json();
  if(!value||typeof value!=="object"||!("cleanVerified" in value)||
    value.cleanVerified!==true||!("fileRef" in value)||
    typeof value.fileRef!=="string"||!UUID.test(value.fileRef)||
    !("fileVersion" in value)||!Number.isSafeInteger(value.fileVersion))
   throw Error("The upload has not passed complete file and malware verification.");
  return value as {fileRef:string;fileVersion:number};
 }
 async function upload(){
  if(!canUploadEvidence||!file||busy)return;
  setBusy(true);setNotice("");
  try{
   if(!allowed.has(file.type)||file.size<1||file.size>10485760)
    throw Error("Select a PDF, JPEG, PNG or WebP file of no more than 10 MB.");
   const content=await file.arrayBuffer();
   const sha=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",content)))
    .map(byte=>byte.toString(16).padStart(2,"0")).join("");
   const requestKey=uploadKey||crypto.randomUUID();setUploadKey(requestKey);
   const r=await fetch("/api/finance-evidence/intents",{
    method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store",
    body:JSON.stringify({voucherRef:voucher.voucherRef,voucherVersion:voucher.version,
     mime:file.type,sizeBytes:file.size,sha256:sha,requestKey})});
   if(!r.ok)throw Error(await message(r));
   const request=typedUpload(await r.json());
   if(!request)throw Error("Secure file upload is not available. No attachment was verified.");
   setIntentRef(request.uploadRef);
   const sent=await fetch(request.uploadUrl,{method:"PUT",headers:request.uploadHeaders,
    body:content,cache:"no-store"});
   if(!sent.ok)throw Error("Private file storage did not confirm the upload. Check the original file verification.");
   const verified=await confirm(request.uploadRef);
   setSelected(verified.fileRef);setFile(null);setUploadKey("");
   setFiles([{
    fileRef:verified.fileRef,fileVersion:verified.fileVersion,mime:file.type,
    sizeBytes:String(file.size)}]);
   setNotice("Private attachment verified by storage, checksum and malware scan. Ready for finance review.");
  }catch(e){setNotice(e instanceof Error?e.message:
   "The original file upload cannot be verified. Recheck the same upload before retrying.");}
  finally{setBusy(false);}
 }
 async function checkExistingUpload(){
  if(!intentRef||busy)return;
  setBusy(true);setNotice("");
  try{
   const verified=await confirm(intentRef);
   setSelected(verified.fileRef);
   setFiles([{fileRef:verified.fileRef,fileVersion:verified.fileVersion,
    mime:file?.type??"application/pdf",sizeBytes:String(file?.size??0)}]);
   setNotice("Original private attachment passed verification.");
  }catch(e){setNotice(e instanceof Error?e.message:
   "The original upload is not verified. Try checking again.");}
  finally{setBusy(false);}
 }
 async function send(action:Unconfirmed){
  setBusy(true);setNotice("");setConfirmNoResult(false);
  const path=action.method==="submit"?
    "/api/finance/vouchers/drafts/"+voucher.voucherRef+"/submit":
    "/api/finance/vouchers/"+voucher.voucherRef+"/settle";
  try{
   const response=await fetch(path,{method:"POST",cache:"no-store",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({...action.payload,requestKey:action.requestKey})});
   if(!response.ok){setPending(response.status>=500?action:null);
    setNotice(await message(response));return;}
   const result:unknown=await response.json();
   if(!result||typeof result!=="object"||!("confirmed" in result)||
      result.confirmed!==true||!("status" in result)||typeof result.status!=="string")
    throw Error("UNKNOWN");
   setPending(null);setNotice(
    result.status==="SUBMITTED"?"Voucher submitted for genuine CG-03 review. Not posted or paid.":
    "Confirmed Finance reviewer outcome: "+result.status+". No payment has been made.");
   onUpdated();
  }catch{setPending(action);
   setNotice("The original voucher action result is unconfirmed. Check it before retrying.");}
  finally{setBusy(false);}
 }
 function submit(){
  if(voucher.status!=="DRAFT"||!selectable||busy||pending)return;
  void send({method:"submit",requestKey:crypto.randomUUID(),
   payload:{expectedVersion:voucher.version,
    proofFileRef:selectable.fileRef,proofVersion:selectable.fileVersion}});
 }
 function settle(){
  if(voucher.status!=="SUBMITTED"||!voucher.approvalCaseRef||busy||pending)return;
  void send({method:"settle",requestKey:crypto.randomUUID(),
   payload:{caseRef:voucher.approvalCaseRef}});
 }
 async function checkOriginal(){
  if(!pending||busy)return;
  setBusy(true);setNotice("");
  try{
   const r=await fetch("/api/finance/vouchers/workflow-commands/"+pending.requestKey,
    {cache:"no-store"});
   if(!r.ok)throw Error(await message(r));
   const result:unknown=await r.json();
   if(!result||typeof result!=="object"||!("confirmed" in result)||
      typeof result.confirmed!=="boolean")throw Error("Outcome unverified");
   if(result.confirmed){setPending(null);setNotice("Original voucher action confirmed.");
    onUpdated();return;}
   setConfirmNoResult(true);
   setNotice("The original change has not completed. Retry that same request only.");
  }catch(e){setNotice(e instanceof Error?e.message:
   "Original action status cannot be checked. Keep this request for retry.");}
  finally{setBusy(false);}
 }
 const editable=voucher.status==="DRAFT";
 return <div className="cg-fin-voucher-actions">
  {editable&&canViewEvidence&&<button type="button" disabled={busy}
    onClick={()=>void checkFiles()}>Check verified attachments</button>}
  {editable&&canUploadEvidence&&<label className="cg-fin-voucher-attach">
   Add private voucher evidence (PDF or image)
   <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
    disabled={busy} onChange={e=>{setFile(e.target.files?.[0]??null);setUploadKey("");setIntentRef("");}}/>
  </label>}
  {editable&&canUploadEvidence&&file&&<button type="button"
    disabled={busy} onClick={()=>void upload()}>Upload & verify attachment</button>}
  {editable&&intentRef&&<button type="button" disabled={busy}
    onClick={()=>void checkExistingUpload()}>Check original file verification</button>}
  {editable&&files.length>0&&<label className="cg-fin-voucher-attach">
   Choose currently verified attachment
   <select value={selected} disabled={busy} onChange={e=>setSelected(e.target.value)}>
    {files.map((f,i)=><option key={f.fileRef} value={f.fileRef}>
     Verified attachment {i+1} ({f.mime})</option>)}
   </select>
  </label>}
  {editable&&<button type="button" disabled={busy||!selectable||Boolean(pending)}
    onClick={submit}>Submit for actual approval</button>}
  {voucher.status==="SUBMITTED"&&<button type="button"
    disabled={busy||!voucher.approvalCaseRef||Boolean(pending)}
    onClick={settle}>Check & apply reviewer outcome</button>}
  {pending&&<div role="status" className="cg-fin-pending">
   <p>The last voucher action has an unconfirmed result. Avoid a second action.</p>
   <button type="button" disabled={busy} onClick={()=>void checkOriginal()}>
    Check original action</button>
   {confirmNoResult&&<button type="button" disabled={busy}
    onClick={()=>void send(pending)}>Retry exact original request</button>}
  </div>}
  {notice&&<p role="status" className="cg-fin-help">{notice}</p>}
  {editable&&!canUploadEvidence&&<p className="cg-fin-help">To submit a voucher,
   an Administrator must grant the required private-evidence permissions.</p>}
 </div>;
}
