"use client";
import {useEffect,useRef,useState,type ChangeEvent} from "react";

type Current={exists:boolean;uploadRef?:string;status?:string;cleanVerified:boolean;
 original?:{requestKey:string;sizeBytes:number;sha256:string;mime:string;
 documentKind:string}};
type Prepare={uploadRef:string;status:string;uploadReady:boolean;
 uploadUrl?:string;uploadHeaders?:Record<string,string>;message?:string};
type State={uploadRef:string;status:string;cleanVerified:boolean;
 verifiedFileRef?:string|null};
type Original={requestKey:string;sizeBytes:number;sha256:string;mime:string;
 documentKind:string};
type Props={centerRef:string;equipmentRef:string;onVerified:()=>Promise<void>};
const pdf=(x:File|null):x is File=>!!x&&x.size>0&&x.size<=10485760&&
 x.name.toLowerCase().endsWith(".pdf")&&
 (x.type===""||x.type==="application/pdf");
async function api<T>(route:string,method:"GET"|"POST"="GET",data?:unknown):Promise<T>{
 const result=await fetch("/api/lab-equipment/"+route,{
  method,credentials:"same-origin",cache:"no-store",
  ...(data?{headers:{"Content-Type":"application/json"},body:JSON.stringify(data)}:{})
 });
 if(!result.ok)throw Object.assign(new Error(
  result.status===401?"Session expired. Sign in again.":
  result.status===403?"This laboratory/equipment action is not authorized.":
  result.status===409?"The original quality upload changed. Check its status.":
  "Secure evidence upload cannot be confirmed. Check the original state."),{
   status:result.status});
 return result.json() as Promise<T>;
}
export function LabEquipmentQualityUpload({centerRef,equipmentRef,onVerified}:Props){
 const [file,setFile]=useState<File|null>(null);
 const [kind,setKind]=useState<Original["documentKind"]>("CALIBRATION");
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [error,setError]=useState(""),[message,setMessage]=useState("");
 const [state,setState]=useState("NOT_UPLOADED");
 const [blocked,setBlocked]=useState(false);
 const intent=useRef(""),original=useRef<Original|null>(null);
 const base="centers/"+centerRef+"/items/"+equipmentRef+"/evidence";
 useEffect(()=>{
  let active=true;setLoading(true);setBlocked(false);intent.current="";
  original.current=null;
  void api<Current>(base+"/current").then(v=>{
   if(!active)return;
   if(v.exists&&v.original&&v.uploadRef){
    setState(v.status??"UNKNOWN");
    if(v.cleanVerified){setMessage("Previous quality PDF scanner-verified. "+
     "A new document can be uploaded separately.");return;}
    intent.current=v.uploadRef;original.current=v.original;
    setKind(v.original.documentKind);
    setMessage("An earlier PDF upload is unfinished. Select the exact same PDF "+
     "and verify its scanner status; do not start a duplicate.");
   }
  }).catch(e=>{if(active){setBlocked(true);setError(e instanceof Error?e.message:
   "Existing original evidence cannot be checked.");}})
   .finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[base]);
 async function scanStatus(){
  if(!intent.current)return;
  setBusy(true);setError("");
  try{
   const v=await api<State>(base+"/"+intent.current+"/status");
   setState(v.status);
   if(v.cleanVerified){
    setMessage("Private PDF uploaded and scanner-verified. Equipment is NOT "+
     "automatically cleared for use; authorize maintenance/readiness separately.");
    intent.current="";original.current=null;setFile(null);
    try{await onVerified()}catch{setError("Verified but the file list could not refresh.");}
   }else setMessage("PDF has not passed the original CG19 scan. "+
    "Check or retry only this original upload.");
  }catch(e){setError(e instanceof Error?e.message:"Scan status cannot be confirmed.");}
  finally{setBusy(false);}
 }
 async function upload(){
  if(!pdf(file)||busy||loading||blocked)return;
  setBusy(true);setError("");setMessage("");
  try{
   const bytes=await file.arrayBuffer();
   const sha256=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),
    v=>v.toString(16).padStart(2,"0")).join("");
   const payload=original.current??{requestKey:crypto.randomUUID(),
    sizeBytes:file.size,sha256,mime:"application/pdf",documentKind:kind};
   if(payload.sha256!==sha256||payload.sizeBytes!==file.size)
    throw Error("Only the same original PDF may resume an unfinished upload.");
   original.current=payload;
   const reserved=await api<Prepare>(base+"/prepare","POST",payload);
   intent.current=reserved.uploadRef;setState(reserved.status);
   if(!reserved.uploadReady||!reserved.uploadUrl||!reserved.uploadHeaders){
    setMessage(reserved.message??"Private storage unavailable; document unverified.");
    return;
   }
   const target=new URL(reserved.uploadUrl);
   if(target.protocol!=="https:"||target.username||target.password||
      target.hash||reserved.uploadHeaders["Content-Type"]!=="application/pdf")
    throw Error("Private quality upload destination cannot be verified.");
   const transfer=await fetch(target.toString(),{method:"PUT",body:file,
    cache:"no-store",redirect:"error",credentials:"omit",mode:"cors",
    headers:reserved.uploadHeaders});
   if(!transfer.ok)throw Error("PDF transfer not confirmed. Check original upload.");
   const checked=await api<State>(base+"/"+reserved.uploadRef+"/confirm","POST");
   setState(checked.status);
   if(checked.cleanVerified){
    setMessage("Original quality PDF passed private storage and malware scan. "+
     "Instrument readiness requires its separate maintenance action.");
    intent.current="";original.current=null;setFile(null);
    try{await onVerified()}catch{setError("Verified, but file list refresh failed.");}
   }else setMessage("Original scan not verified. The equipment is not marked ready.");
  }catch(e){setError(e instanceof Error?e.message:"Original upload outcome uncertain.");}
  finally{setBusy(false);}
 }
 const choose=(e:ChangeEvent<HTMLInputElement>)=>{
  const next=e.target.files?.[0]??null;
  if(next&&!pdf(next)){setError("Choose a PDF no larger than 10 MB.");return;}
  setFile(next);setError("");
 };
 return <div className="cg-diagnostics-card" aria-label="Private equipment quality evidence">
  <h3>Upload original quality or service proof</h3>
  <p>CG19 private PDF and malware verification only. A scanned document never
   implies NABL accreditation, clinical qualification or equipment readiness.</p>
  {loading?<p role="status">Checking existing quality upload…</p>:<>
   <div className="toolbar" role="group" aria-label="Quality document type">
    {(["CALIBRATION","MAINTENANCE","QUALITY_CERTIFICATE"] as const).map(v=>
     <button key={v} type="button" disabled={busy||blocked||!!intent.current}
      aria-pressed={kind===v} onClick={()=>setKind(v)}>
      {v.replaceAll("_"," ").toLowerCase()}</button>)}
   </div>
   <label className="field">Original private PDF
    <input type="file" accept=".pdf,application/pdf" onChange={choose}
     disabled={busy||blocked}/>
   </label>
   <div className="toolbar">
    <button type="button" className="primary" onClick={()=>void upload()}
     disabled={busy||blocked||!pdf(file)||["VALIDATED","REJECTED"].includes(state)&&!!intent.current}>
     {busy?"Checking protected PDF…":intent.current?"Retry same original PDF":"Upload & scan original PDF"}
    </button>
    {!!intent.current&&<button type="button" disabled={busy}
     onClick={()=>void scanStatus()}>Check existing scan</button>}
   </div>
  </>}
  <p role="status">Document state: {state.replaceAll("_"," ").toLowerCase()}.
   Equipment state changes only after a separately authorized maintenance record.</p>
  {!!message&&<p className="notice" role="status">{message}</p>}
  {!!error&&<p className="notice error" role="alert">{error}</p>}
 </div>;
}
