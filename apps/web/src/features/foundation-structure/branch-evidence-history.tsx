"use client";
import {useCallback,useEffect,useState} from "react";
type FileItem={fileRef:string;revision:number;classification:string;mime:string;
  sizeBytes:number;revoked:boolean;status:string;createdAt:string};
const ROOT="/api/documents/branch-evidence";
export function BranchEvidenceHistory({registrationRef,canRevoke}:{registrationRef:string;canRevoke:boolean}){
 const [files,setFiles]=useState<FileItem[]>([]);
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 const [message,setMessage]=useState("");
 const load=useCallback(async()=>{
   const response=await fetch(ROOT+"/registration/"+encodeURIComponent(registrationRef),
     {cache:"no-store"});
   if(!response.ok)throw Error("Protected branch documents cannot be verified.");
   const data=await response.json() as {files:FileItem[]};
   if(!Array.isArray(data.files))throw Error("Protected file history was unavailable.");
   setFiles(data.files);
 },[registrationRef]);
 useEffect(()=>{
   let active=true;
   void load().catch(()=>{if(active){setFiles([]);setError("Verified file history is unavailable.");}});
   return()=>{active=false;};
 },[load]);
 async function revoke(file:FileItem){
   if(busy||file.revoked||!canRevoke)return;
   if(!window.confirm("Revoke access to this private file? This cannot be undone."))return;
   setBusy(true);setError("");setMessage("");
   try{
     const response=await fetch(ROOT+"/files/"+encodeURIComponent(file.fileRef)+"/revoke",{
       method:"POST",headers:{"Content-Type":"application/json"},
       body:JSON.stringify({expectedRevision:file.revision}),cache:"no-store"
     });
     if(!response.ok)throw Error("This private file could not be revoked. Refresh before retrying.");
     await load();setMessage("Private file revoked. Previously approved history is retained.");
   }catch(e){setError(e instanceof Error?e.message:"File revocation could not be confirmed.");}
   finally{setBusy(false);}
 }
 return <section className="form"><div className="toolbar"><h3>Protected registration documents</h3>
   <button type="button" disabled={busy} onClick={()=>void load().catch(
     ()=>setError("File history cannot be verified."))}>Refresh evidence</button></div>
   {error&&<p className="notice" role="alert">{error}</p>}
   {message&&<p className="notice" role="status">{message}</p>}
   {files.length===0?<p>No verified or historical branch files to show.</p>:
     <ul className="branch-draft-list">{files.map(file=><li key={file.fileRef}>
       <div className="toolbar"><span>{file.classification.toLowerCase().replaceAll("_"," ")}
         {" · "}{file.revoked?"Revoked":file.status.toLowerCase().replaceAll("_"," ")}
         {" · "}{new Date(file.createdAt).toLocaleDateString()}</span>
         {!file.revoked&&file.status==="VALIDATED"&&<a
           href={ROOT+"/files/"+encodeURIComponent(file.fileRef)+"/download"}>
           Download privately</a>}
         {canRevoke&&!file.revoked&&<button type="button" disabled={busy}
           onClick={()=>void revoke(file)}>Revoke</button>}
       </div></li>)}</ul>}
 </section>;
}
