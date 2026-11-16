"use client";
import {useState} from "react";
const MIME=new Set(["application/pdf","image/jpeg","image/png","image/webp"]);
type NewUpload={uploadRef:string;status:string;uploadUrl?:string;
 uploadHeaders?:Record<string,string>;expiresAt?:string};
type UploadStatus={uploadRef:string;status:string;fileRef:string|null;
 fileVersion:number|null;cleanVerified:boolean};
type Props={branchRef:string;branchVersion:number;
 classification:"BRANCH_PHOTO"|"BRANCH_LOGO"|"REGISTRATION_PROOF"|"AGREEMENT";
 onVerified:(fileRef:string)=>void;disabled?:boolean};
const route="/api/documents/active-branch-files";
async function request<T>(path:string,method:"GET"|"POST"="GET",body?:object):Promise<T>{
 let response:Response;
 try{
   response=await fetch(route+path,{method,cache:"no-store",
     ...(body?{headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})});
 }catch{throw Error("The original file operation is uncertain. Check its upload status.");}
 if(!response.ok){
   const value:unknown=await response.json().catch(()=>null);
   const message=value&&typeof value==="object"&&"message" in value&&
     typeof value.message==="string"?value.message:"Private file verification is unavailable.";
   throw Error(message);
 }
 return response.json() as Promise<T>;
}
export function ActiveBranchEvidenceUploader({branchRef,branchVersion,classification,onVerified,disabled=false}:Props){
 const [file,setFile]=useState<File|null>(null);
 const [busy,setBusy]=useState(false),[intent,setIntent]=useState("");
 const [key,setKey]=useState("");
 const [verified,setVerified]=useState(false);
 const [uncertain,setUncertain]=useState(false);
 const [notice,setNotice]=useState("");
 const name=({BRANCH_PHOTO:"Branch photograph",BRANCH_LOGO:"Branch logo",
   REGISTRATION_PROOF:"Registration proof",AGREEMENT:"Signed agreement"} as Record<string,string>)[classification];
 function choose(file:File|null){
   if(busy||uncertain)return;
   setFile(file);setIntent("");setKey("");setVerified(false);setNotice("");
 }
 async function status(){
   if(!intent||busy)return;
   setBusy(true);
   try{
     const original=await request<UploadStatus>("/intents/"+encodeURIComponent(intent));
     if(original.cleanVerified&&original.fileRef){
       onVerified(original.fileRef);setVerified(true);setUncertain(false);
       setNotice(name+" is securely verified.");
     }else{
       setUncertain(false);setNotice("The upload is not yet verified: "+
         original.status.toLowerCase().replaceAll("_"," ")+".");
     }
   }catch(e){setUncertain(true);setNotice(e instanceof Error?e.message:"File status unavailable.");}
   finally{setBusy(false);}
 }
 async function upload(){
   if(disabled||busy||uncertain||!file)return;
   if(!MIME.has(file.type)||file.size<1||file.size>10485760){
     setNotice("Choose a PDF, JPG, PNG or WebP file under 10 MB.");return;
   }
   setBusy(true);setNotice("");
   const originalKey=key||crypto.randomUUID();setKey(originalKey);
   try{
     const digest=Array.from(new Uint8Array(await crypto.subtle.digest(
       "SHA-256",await file.arrayBuffer()))).map(byte=>byte.toString(16).padStart(2,"0")).join("");
     const started=await request<NewUpload>("/intents","POST",{
       branchRef,branchVersion,classification,requestKey:originalKey,
       mime:file.type,sizeBytes:file.size,sha256:digest
     });
     if(!started.uploadRef)throw Error("File upload response was not confirmed.");
     setIntent(started.uploadRef);
     if(started.status==="STORAGE_UNAVAILABLE"||!started.uploadUrl){
       setNotice("Private storage and scanning are unavailable. No file was verified.");
       return;
     }
     if(!started.uploadUrl.startsWith("https://")||!started.uploadHeaders||
       started.uploadHeaders["Content-Type"]!==file.type)
       throw Error("The secure upload authorization could not be verified.");
     const placed=await fetch(started.uploadUrl,{method:"PUT",headers:started.uploadHeaders,
       body:file,mode:"cors",cache:"no-store",credentials:"omit"});
     if(!placed.ok)throw Error("Upload outcome is uncertain; check the original request.");
     const confirmed=await request<UploadStatus>("/intents/"+encodeURIComponent(started.uploadRef)+"/confirm","POST");
     if(!confirmed.cleanVerified||!confirmed.fileRef){
       setUncertain(true);
       setNotice("The server could not confirm safe file storage and malware scan.");
       return;
     }
     setVerified(true);setUncertain(false);
     onVerified(confirmed.fileRef);
     setNotice(name+" verified. Save the current operating branch profile to include the replacement.");
   }catch(e){setUncertain(true);setNotice(e instanceof Error?e.message:"File upload is unconfirmed.");}
   finally{setBusy(false);}
 }
 return <div className="branch-upload form">
   <label className="field">{name}
     <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" disabled={disabled||busy||uncertain}
       onChange={e=>choose(e.target.files?.[0]??null)}/></label>
   <div className="toolbar">
     <button type="button" onClick={()=>void upload()}
       disabled={disabled||busy||uncertain||!file||verified}>
       {busy?"Verifying...":"Upload privately"}</button>
     {!!intent&&<button type="button" onClick={()=>void status()} disabled={busy}>
       Check original upload</button>}
     {uncertain&&<button type="button" onClick={()=>{setUncertain(false);setNotice(
       "Only retry the same upload key or confirm its original status before a new upload.");}}
       disabled={busy}>Review retry</button>}
   </div>
   {!!notice&&<p className="notice" role={uncertain?"alert":"status"}>{notice}</p>}
 </div>;
}
