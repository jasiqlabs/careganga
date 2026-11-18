"use client";
import {useEffect,useRef,useState} from "react";

type Class="HEALTH_PROVIDER_REGISTRATION"|"HEALTH_CENTER_LICENSE"|"HEALTH_BANK_PROOF";
type Props={providerRef:string;centerRef?:string;sourceVersion:number;classification:Class;
 onVerified?:(fileRef:string,version:number)=>void;disabled?:boolean};
type Intent={uploadRef:string;status:string;uploadUrl?:string;
 uploadHeaders?:Record<string,string>};
type Verified={fileRef:string|null;fileVersion:number|null;cleanVerified:boolean;status:string};
const route="/api/documents/health-draft";
const labels:Record<Class,string>={
  HEALTH_PROVIDER_REGISTRATION:"Provider registration or licence",
  HEALTH_CENTER_LICENSE:"Center licence or supporting certificate",
  HEALTH_BANK_PROOF:"Protected bank proof"
};
async function request<T>(path:string,method:"GET"|"POST"="GET",body?:object):Promise<T>{
  const response=await fetch(route+path,{
    method,cache:"no-store",credentials:"same-origin",
    ...(body?{headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})
  });
  const raw:unknown=await response.json().catch(()=>null);
  if(!response.ok)throw Error(
    raw&&typeof raw==="object"&&"message" in raw&&typeof raw.message==="string"?
      raw.message:"Secure file operation unavailable.");
  return raw as T;
}
export function HealthEvidenceUploader({
  providerRef,centerRef,sourceVersion,classification,onVerified,disabled=false
}:Props){
  const [file,setFile]=useState<File|null>(null);
  const [busy,setBusy]=useState(false);
  const [uploadRef,setUploadRef]=useState("");
  const [confirmed,setConfirmed]=useState(false);
  const [uncertain,setUncertain]=useState(false);
  const [notice,setNotice]=useState("");
  const [fileRefresh,setFileRefresh]=useState(0);
  const requestKey=useRef("");
  const title=labels[classification];
  function choose(f:File|null){
    if(busy||uncertain)return;
    setFile(f);setUploadRef("");setConfirmed(false);setNotice("");
    requestKey.current=crypto.randomUUID();
  }
  async function verifyOriginal(ref:string){
    const result=await request<Verified>("/intents/"+encodeURIComponent(ref));
    if(result.cleanVerified&&result.fileRef&&result.fileVersion){
      setUncertain(false);setConfirmed(true);
      onVerified?.(result.fileRef,result.fileVersion);
      setFileRefresh(x=>x+1);
      setNotice(title+" securely verified. It remains private.");
    }else{
      setUncertain(false);setConfirmed(false);
      setNotice("Original file status: "+result.status.replaceAll("_"," ").toLowerCase()+
        ". Do not treat this as a verified document.");
    }
  }
  async function upload(){
    if(disabled||busy||uncertain||!file)return;
    if(!["application/pdf","image/jpeg","image/png","image/webp"].includes(file.type)||
      file.size<1||file.size>10485760){
      setNotice("Choose a PDF, JPG, PNG or WebP under 10 MB.");return;
    }
    setBusy(true);setNotice("");
    try{
      const digest=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",await file.arrayBuffer())))
        .map(byte=>byte.toString(16).padStart(2,"0")).join("");
      const response=await request<Intent>("/intents","POST",{
        providerRef,centerRef:centerRef??null,sourceVersion,
        classification,requestKey:requestKey.current||crypto.randomUUID(),
        mime:file.type,sizeBytes:file.size,sha256:digest
      });
      if(!response.uploadRef)throw Error("The original file intent was not recorded.");
      setUploadRef(response.uploadRef);
      if(!response.uploadUrl||!response.uploadHeaders){
        setNotice("Private storage or malware scanning is not available. No document was verified.");
        return;
      }
      if(!response.uploadUrl.startsWith("https://")||
        response.uploadHeaders["Content-Type"]!==file.type)
        throw Error("The secure storage permission could not be verified.");
      const put=await fetch(response.uploadUrl,{
        method:"PUT",body:file,headers:response.uploadHeaders,
        credentials:"omit",mode:"cors",cache:"no-store"
      });
      if(!put.ok)throw Error("The upload outcome is unknown. Check the original upload.");
      const original=await request<Verified>(
        "/intents/"+encodeURIComponent(response.uploadRef)+"/confirm","POST");
      if(!original.cleanVerified||!original.fileRef||!original.fileVersion){
        setUncertain(true);setNotice("File or malware verification is incomplete. Check original status.");
        return;
      }
      setConfirmed(true);setUncertain(false);
      onVerified?.(original.fileRef,original.fileVersion);
      setFileRefresh(x=>x+1);
      setNotice(title+" securely verified and private.");
    }catch(e){
      setUncertain(true);
      setNotice(e instanceof Error?e.message:"The upload is uncertain. Check original status.");
    }finally{setBusy(false);}
  }
  return <div className="form">
    <label className="field">{title}
      <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp"
        disabled={disabled||busy||uncertain}
        onChange={e=>choose(e.target.files?.[0]??null)}/>
    </label>
    <div className="toolbar">
      <button type="button" disabled={disabled||busy||uncertain||!file||confirmed}
        onClick={()=>void upload()}>{busy?"Verifying...":"Upload privately"}</button>
      {!!uploadRef&&<button type="button" disabled={busy}
        onClick={()=>{setBusy(true);void verifyOriginal(uploadRef).catch(error=>{
          setUncertain(true);setNotice(error instanceof Error?error.message:
            "Original upload status unavailable.");
        }).finally(()=>setBusy(false));}}>Check original upload</button>}
      {uncertain&&<button type="button" disabled={busy} onClick={()=>{
        setUncertain(false);
        setNotice("Use the same original upload request or check its status before retrying.");
      }}>Review retry</button>}
    </div>
    {!!notice&&<p className="notice" role={uncertain?"alert":"status"}>{notice}</p>}
    {classification!=="HEALTH_BANK_PROOF"&&<HealthFileList
      providerRef={providerRef} centerRef={centerRef} refresh={fileRefresh}/>}
  </div>;
}


type ProtectedItem={fileRef:string;classification:string;status:string;
 currentVersion:boolean;fileVersion:number};
function HealthFileList({providerRef,centerRef,refresh}:{
  providerRef:string;centerRef?:string;refresh:number
}){
  const [files,setFiles]=useState<ProtectedItem[]>([]);
  const [notice,setNotice]=useState("");
  const [working,setWorking]=useState(false);
  const [revision,setRevision]=useState(0);
  useEffect(()=>{
    let live=true;
    const params=centerRef?new URLSearchParams({centerRef}).toString():"";
    void request<{files:ProtectedItem[]}>(
      "/providers/"+encodeURIComponent(providerRef)+(params?"?"+params:""))
      .then(data=>{if(live)setFiles(Array.isArray(data.files)?data.files:[]);})
      .catch(()=>{if(live)setNotice("Current private file list is unavailable.");});
    return()=>{live=false;};
  },[providerRef,centerRef,refresh,revision]);
  async function revoke(file:ProtectedItem){
    if(working)return;
    setWorking(true);setNotice("");
    try{
      await request("/files/"+encodeURIComponent(file.fileRef)+"/revoke",
        "POST",{expectedRevision:file.fileVersion});
      setRevision(x=>x+1);
      setNotice("The original private proof was withdrawn.");
    }catch(e){
      setNotice(e instanceof Error?e.message:"File withdrawal cannot be confirmed.");
    }finally{setWorking(false);}
  }
  return <div className="form-section">
    <h4>Current private supporting files</h4>
    {!!notice&&<p role="status" className="notice">{notice}</p>}
    {files.length===0&&<p>No verified supporting files recorded yet.</p>}
    {files.map(file=><div key={file.fileRef} className="toolbar">
      <span>{file.classification==="HEALTH_CENTER_LICENSE"?
        "Center licence":"Provider registration"} · {file.status==="VALIDATED"&&file.currentVersion?
        "Verified, current":"Not currently eligible"}</span>
      {file.status==="VALIDATED"&&file.currentVersion&&<>
        <a href={"/api/documents/health-draft/files/"+
          encodeURIComponent(file.fileRef)+"/download"}>View private proof</a>
        <button type="button" disabled={working} onClick={()=>void revoke(file)}>
          Revoke proof</button>
      </>}
    </div>)}
  </div>;
}
