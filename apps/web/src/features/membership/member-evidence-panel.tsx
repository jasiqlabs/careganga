"use client";
import {useCallback,useEffect,useState} from "react";
import type {CG04MembershipEvidenceList,CG04MembershipEvidenceStatus} from "@careganga/api-contracts";
const base="/api/community/documents";
async function api<T>(path:string,body?:Record<string,unknown>):Promise<T>{
 const r=await fetch(base+path,{method:body?"POST":"GET",headers:body?{"Content-Type":"application/json"}:undefined,body:body?JSON.stringify(body):undefined,cache:"no-store",signal:AbortSignal.timeout(15000)});
 const value=await r.json().catch(()=>null);
 if(!r.ok||!value)throw new Error(typeof value?.message==="string"?value.message:"Your protected document result is not confirmed.");
 return value as T;
}
export function MemberEvidencePanel({applicationRef,version,editable,onChange}:{applicationRef:string;version:number;editable:boolean;onChange:()=>void}){
 const [list,setList]=useState<CG04MembershipEvidenceList|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(""),[note,setNote]=useState("");
 const refresh=useCallback(async()=>{const x=await api<CG04MembershipEvidenceList>("/applications/"+applicationRef+"/files");setList(x);},[applicationRef]);
 useEffect(()=>{let alive=true;void api<CG04MembershipEvidenceList>("/applications/"+applicationRef+"/files").then(v=>{if(alive)setList(v);}).catch(()=>{if(alive)setError("Original secure documents could not be confirmed. Refresh before submitting.");});return()=>{alive=false;};},[applicationRef,version]);
 const upload=async(file:File,classification:"MEMBER_IDENTITY_PROOF"|"MEMBER_PORTRAIT")=>{
  if(busy||!editable)return;setBusy(true);setError("");setNote("");
  try{
   if(file.size<1||file.size>10485760||!["application/pdf","image/jpeg","image/png","image/webp"].includes(file.type)||classification==="MEMBER_PORTRAIT"&&file.type==="application/pdf")throw new Error("Choose a supported image or PDF under 10 MB.");
   const checksum=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",await file.arrayBuffer()))).map(b=>b.toString(16).padStart(2,"0")).join("");
   const intent=await api<CG04MembershipEvidenceStatus>("/intents",{applicationRef,applicationVersion:version,requestKey:crypto.randomUUID(),classification,mime:file.type,sizeBytes:file.size,sha256:checksum});
   if(intent.status!=="UPLOAD_READY"||!intent.uploadUrl||!intent.uploadHeaders)throw new Error("Secure storage is not ready. Refresh the original upload status before retrying.");
   const stored=await fetch(intent.uploadUrl,{method:"PUT",headers:intent.uploadHeaders,body:file,signal:AbortSignal.timeout(20000)});
   if(!stored.ok)throw new Error("The document transfer could not be confirmed. Refresh its status.");
   const verified=await api<CG04MembershipEvidenceStatus>("/intents/"+intent.uploadRef+"/confirm",{});
   if(!verified.cleanVerified)throw new Error("The document has not passed its security verification yet.");
   await refresh();onChange();setNote("Document verified securely.");
  }catch(e){setError(e instanceof Error?e.message:"The protected file result is uncertain.");}finally{setBusy(false);}
 };
 const revoke=async(fileRef:string,fileVersion:number)=>{if(busy)return;setBusy(true);setError("");try{await api("/files/"+fileRef+"/revoke",{expectedVersion:fileVersion});await refresh();onChange();setNote("The previous document was revoked.");}catch(e){setError(e instanceof Error?e.message:"Revocation could not be confirmed.");}finally{setBusy(false);}};
 return <section className="cg04-panel"><h3>Secure application documents</h3><p className="cg04-muted">Identity evidence must pass private malware scanning before submission. Your proof is not public.</p>
 {error&&<p role="alert" className="cg04-error">{error}</p>}{note&&<p role="status">{note}</p>}
 {editable&&<><label>Identity document (PDF or image) <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={busy} onChange={e=>{const f=e.target.files?.[0];if(f)void upload(f,"MEMBER_IDENTITY_PROOF");e.target.value="";}}/></label><label>Photo (optional) <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e=>{const f=e.target.files?.[0];if(f)void upload(f,"MEMBER_PORTRAIT");e.target.value="";}}/></label></>}
 {list?.files.map(f=><div className="cg04-buttons" key={f.fileRef}><strong>{f.classification==="MEMBER_IDENTITY_PROOF"?"Verified identity document":"Verified photo"}</strong><a href={base+"/files/"+f.fileRef+"/download"}>Download privately</a>{editable&&<button type="button" disabled={busy} onClick={()=>void revoke(f.fileRef,f.fileVersion)}>Revoke</button>}</div>)}
 {!!list?.pending.length&&<p role="status">An upload is pending. Refresh its original status before submission; a pending file is not verified.</p>}
 <div className="cg04-buttons"><button disabled={busy} type="button" onClick={()=>void refresh().catch(()=>setError("Documents cannot be confirmed."))}>Refresh documents</button></div>
 <small>{list?.files.some(f=>f.classification==="MEMBER_IDENTITY_PROOF")&&!list.pending.length?"Identity proof verified. You may submit the application.":"Verify one identity proof before submitting."}</small>
 </section>;
}
