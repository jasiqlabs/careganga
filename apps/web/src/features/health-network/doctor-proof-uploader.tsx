"use client";
import {useRef,useState} from "react";
type UploadStart={uploadRef:string;status:string;uploadUrl?:string;
  uploadHeaders?:Record<string,string>};
type UploadStatus={uploadRef:string;status:string;fileRef:string|null;
  fileVersion:number|null;cleanVerified:boolean};
const ROOT="/api/documents/doctor-evidence";
async function request<T>(route:string,method:"GET"|"POST"="GET",body?:object):Promise<T>{
  const res=await fetch(ROOT+route,{method,credentials:"same-origin",cache:"no-store",
    ...(body?{headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})});
  const json:unknown=await res.json().catch(()=>null);
  if(!res.ok)throw new Error(json&&typeof json==="object"&&"message" in json&&
    typeof json.message==="string"?json.message:"The original private upload is unavailable.");
  return json as T;
}
export function DoctorProofUploader({doctorRef,version,onVerified,classification="HEALTH_DOCTOR_LICENSE"}:{
  doctorRef:string;version:number;onVerified?:(ref:string,fileVersion:number)=>void;
  classification?:"HEALTH_DOCTOR_LICENSE"|"HEALTH_DOCTOR_PORTRAIT"
}){
  const portrait=classification==="HEALTH_DOCTOR_PORTRAIT";
  const [file,setFile]=useState<File|null>(null);
  const [busy,setBusy]=useState(false);
  const [unknown,setUnknown]=useState(false);
  const [intentRef,setIntentRef]=useState("");
  const [verified,setVerified]=useState(false);
  const [notice,setNotice]=useState("");
  const key=useRef("");
  function choose(chosen:File|null){
    if(busy)return;
    setFile(chosen);setIntentRef("");setVerified(false);setUnknown(false);
    setNotice("");key.current=crypto.randomUUID();
  }
  async function refreshOriginal(ref:string){
    const result=await request<UploadStatus>("/intents/"+encodeURIComponent(ref));
    setUnknown(false);
    if(result.cleanVerified&&result.fileRef&&result.fileVersion){
      setVerified(true);onVerified?.(result.fileRef,result.fileVersion);
      setNotice(portrait?"Private portrait was securely scanned. Publishing consent is not verified.":
        "Private doctor license passed original secure scanning.");
    }else{
      setVerified(false);
      setNotice("Original upload status: "+result.status.replaceAll("_"," ").toLowerCase()+
        ". No verified private file has been accepted yet.");
    }
  }
  async function upload(){
    if(!file||busy||unknown||verified)return;
    if(!(portrait?["image/jpeg","image/png","image/webp"]:
      ["application/pdf","image/jpeg","image/png","image/webp"]).includes(file.type)||
      file.size<1||file.size>10485760){
      setNotice(portrait?"Choose a JPG, PNG or WebP portrait under 10 MB.":
        "Choose a PDF, JPG, PNG or WebP file under 10 MB.");return;
    }
    setBusy(true);setNotice("");
    try{
      const bytes=await file.arrayBuffer();
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)))
        .map(byte=>byte.toString(16).padStart(2,"0")).join("");
      if(!key.current)key.current=crypto.randomUUID();
      const original=await request<UploadStart>("/intents","POST",{
        doctorRef,sourceVersion:version,requestKey:key.current,
        mime:file.type,sizeBytes:file.size,sha256:hash,classification
      });
      if(!original.uploadRef)throw new Error("Original secure upload intent is unavailable.");
      setIntentRef(original.uploadRef);
      if(!original.uploadUrl||!original.uploadHeaders){
        setNotice("Secure upload or malware scanning is unavailable. Check the original intent.");
        setUnknown(true);return;
      }
      if(!original.uploadUrl.startsWith("https://")||
        original.uploadHeaders["Content-Type"]!==file.type)
        throw new Error("The private upload permission cannot be verified.");
      const transfer=await fetch(original.uploadUrl,{
        method:"PUT",body:file,headers:original.uploadHeaders,
        credentials:"omit",mode:"cors",cache:"no-store"
      });
      if(!transfer.ok)throw new Error("The upload outcome is uncertain. Check original status.");
      const result=await request<UploadStatus>(
        "/intents/"+encodeURIComponent(original.uploadRef)+"/confirm","POST");
      if(result.cleanVerified&&result.fileRef&&result.fileVersion){
        setVerified(true);setUnknown(false);
        onVerified?.(result.fileRef,result.fileVersion);
        setNotice(portrait?"Private portrait securely scanned. It cannot be published without separate verified rights.":
          "The doctor license is securely scanned and private. Professional approval is separate.");
      }else{
        setUnknown(true);
        setNotice("File verification is incomplete. Check the original upload status.");
      }
    }catch(e){
      setUnknown(true);
      setNotice(e instanceof Error?e.message:"The upload outcome is uncertain. Check the original record.");
    }finally{setBusy(false);}
  }
  return <section className="form-section">
    <h3>{portrait?"Optional private professional portrait":"Private professional registration evidence"}</h3>
    <p>{portrait?"A scanned portrait remains private and does not grant public image rights.":
      "Upload the real licence only. It is not public, and uploading does not verify a doctor."}</p>
    <label className="field">{portrait?"Professional portrait":"Professional licence or registration document"}
      <input type="file" accept={portrait?".jpg,.jpeg,.png,.webp":".pdf,.jpg,.jpeg,.png,.webp"}
        disabled={busy||unknown||verified} onChange={e=>choose(e.target.files?.[0]??null)}/>
    </label>
    <div className="toolbar">
      <button type="button" disabled={!file||busy||unknown||verified}
        onClick={()=>void upload()}>{busy?"Checking secure file…":"Upload privately"}</button>
      {!!intentRef&&<button type="button" disabled={busy}
        onClick={()=>{setBusy(true);
          void refreshOriginal(intentRef).catch(e=>{
            setUnknown(true);
            setNotice(e instanceof Error?e.message:"Original file status unavailable.");
          }).finally(()=>setBusy(false));}}>Check original upload</button>}
      {unknown&&<button type="button" disabled={busy} onClick={()=>{
        setUnknown(false);
        setNotice("Retry the same original file request; do not create a duplicate.");
      }}>Retry same request</button>}
    </div>
    {!!notice&&<p className="notice" role={unknown?"alert":"status"}>{notice}</p>}
  </section>;
}
