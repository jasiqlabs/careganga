"use client";
import {useState} from "react";
type Checked={fileRef:string;fileVersion:number;name:string};
type Intent={uploadRef:string;uploadUrl?:string;uploadHeaders?:Record<string,string>;
 cleanVerified?:boolean;fileRef?:string;fileVersion?:number;status:string};
type Props={claimRef:string;version:number;onSubmitted:()=>void};
const MIME=new Set(["application/pdf","image/jpeg","image/png","image/webp"]);
async function safe(res:Response):Promise<string>{
 const body:unknown=await res.json().catch(()=>null);
 if(body&&typeof body==="object"&&!Array.isArray(body)&&"message" in body&&
    typeof body.message==="string"&&body.message.length<=300)return body.message;
 return res.status===403?"You are not permitted to attach or submit this private bill.":
  res.status===409?"This claim or bill version changed. Refresh before continuing.":
  "The original file outcome could not be confirmed. Check its status before retrying.";
}
const hex=(buffer:ArrayBuffer)=>[...new Uint8Array(buffer)].map(v=>v.toString(16).padStart(2,"0")).join("");
export function FinanceClaimBillTools({claimRef,version,onSubmitted}:Props){
 const [file,setFile]=useState<File|null>(null);
 const [checked,setChecked]=useState<Checked|null>(null);
 const [intent,setIntent]=useState<string|null>(null);
 const [submissionKey,setSubmissionKey]=useState<string|null>(null);
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState("");
 async function verifyCurrent(ref:string){
  const res=await fetch("/api/finance-claim-bills/intents/"+ref+"/confirm",{method:"POST",
   headers:{"Content-Type":"application/json"},body:JSON.stringify({})});
  if(!res.ok)throw Error(await safe(res));
  const state=await res.json() as Intent;
  if(state.cleanVerified&&state.fileRef&&state.fileVersion)
   return {fileRef:state.fileRef,fileVersion:state.fileVersion};
  throw Error(state.status==="VERIFICATION_UNAVAILABLE"?
   "Secure scanning is temporarily unavailable. Check the original upload status before retrying.":
   "The bill has not passed private file and malware verification. No claim was submitted.");
 }
 async function upload(){
  if(!file||busy)return;
  setBusy(true);setNotice("");setChecked(null);
  try{
   if(!MIME.has(file.type)||file.size<1||file.size>10485760)
    throw Error("Select one PDF or JPG/PNG/WebP bill not exceeding 10 MB.");
   const bytes=await file.arrayBuffer();
   const sha256=hex(await crypto.subtle.digest("SHA-256",bytes));
   const requestKey=crypto.randomUUID();
   const res=await fetch("/api/finance-claim-bills/intents",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({claimRef,claimVersion:version,requestKey,mime:file.type,
     sizeBytes:file.size,sha256})});
   if(!res.ok)throw Error(await safe(res));
   const source=await res.json() as Intent;
   if(!source.uploadRef)throw Error("The original upload reservation is not confirmed.");
   setIntent(source.uploadRef);
   if(source.status==="UPLOAD_READY"&&source.uploadUrl&&source.uploadHeaders){
    if(!source.uploadUrl.startsWith("https://"))
     throw Error("A valid secure private upload destination is unavailable.");
    const sent=await fetch(source.uploadUrl,{method:"PUT",headers:source.uploadHeaders,body:bytes});
    if(!sent.ok)throw Error("The private upload was not confirmed. Check the existing upload status.");
   }else if(source.status!=="VALIDATED")
    throw Error("Private storage is unavailable. The bill has not been verified.");
   const proof=await verifyCurrent(source.uploadRef);
   setChecked({...proof,name:file.name});
   setNotice("Private bill passed actual storage and malware checks. You may submit this claim for review.");
  }catch(e){setNotice(e instanceof Error?e.message:
    "The private bill could not be verified. Check its original status.");}
  finally{setBusy(false);}
 }
 async function check(){
  if(!intent||busy)return;
  setBusy(true);setNotice("");
  try{
   const proof=await verifyCurrent(intent);
   setChecked({...proof,name:file?.name??"Verified bill"});
   setNotice("The original private bill is verified and ready for review submission.");
  }catch(e){setNotice(e instanceof Error?e.message:"Check the original file status.");}
  finally{setBusy(false);}
 }
 async function submit(){
  if(!checked||busy)return;
  const requestKey=submissionKey??crypto.randomUUID();
  setSubmissionKey(requestKey);setBusy(true);setNotice("");
  try{
   const res=await fetch("/api/finance/claims/"+claimRef+"/submit",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({requestKey,expectedVersion:version,
     billFileRef:checked.fileRef,billVersion:checked.fileVersion})});
   if(!res.ok)throw Error(await safe(res));
   const result:unknown=await res.json();
   if(!result||typeof result!=="object"||!("confirmed" in result)||result.confirmed!==true)
    throw Error("The submission result cannot be confirmed. Check the original case.");
   setSubmissionKey(null);
   setNotice("Submitted for protected review. This claim is not yet approved, posted or paid.");
   onSubmitted();
  }catch(e){
   try{
    const prior=await fetch("/api/finance/claims/workflow-commands/"+requestKey,{cache:"no-store"});
    if(prior.ok){
     const info=await prior.json() as {confirmed?:boolean;status?:string};
     if(info.confirmed&&info.status==="SUBMITTED"){
      setSubmissionKey(null);
      setNotice("Original claim submission confirmed. Await a different authorized reviewer.");
      onSubmitted();return;
     }
    }
   }catch{/* Never invent success on an uncertain network response. */}
   setNotice(e instanceof Error?e.message:
    "Submission cannot be confirmed. Check the existing request before retrying.");
  }finally{setBusy(false);}
 }
 return <section className="cg-fin-evidence" aria-label="Original private reimbursement bill">
  <h4>Attach a real expense bill</h4>
  <p className="cg-fin-help">Only a scanned, verified private bill can be submitted for protected review.
   A file upload alone does not approve or pay an expense.</p>
  <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp"
   aria-label="Choose private expense bill"
   onChange={e=>{setFile(e.currentTarget.files?.[0]??null);
    setChecked(null);setIntent(null);setSubmissionKey(null);setNotice("");}}/>
  <div className="cg-fin-toolbar-actions">
   <button type="button" disabled={busy||!file} onClick={()=>void upload()}>
    {busy?"Checking the original bill…":"Upload and verify bill"}</button>
   {intent&&!checked&&<button type="button" disabled={busy}
      onClick={()=>void check()}>Check existing upload status</button>}
   {checked&&<button className="primary" type="button" disabled={busy}
      onClick={()=>void submit()}>Submit this claim for protected approval</button>}
  </div>
  {checked&&<p role="status">Verified private bill: {checked.name}</p>}
  {notice&&<p role="status" className="cg-fin-notice">{notice}</p>}
 </section>;
}
