"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import type {CG03CaseView,CG19UploadStart,CG19UploadStatus} from "@careganga/api-contracts";
import {PrivateLetterPanel} from "./private-letter-panel";

const MIME=new Set(["application/pdf","image/jpeg","image/png","image/webp"]);
type Notice={kind:"error"|"info"|"success";text:string};
type MediaRecord={fileRef:string;revision:number;mime:string;sizeBytes:number;
  createdAt:string;revoked:boolean};
async function json<T>(url:string,method:"GET"|"POST"="GET",body?:unknown):Promise<T>{
  let response:Response;
  try{
    response=await fetch(url,{
      method,cache:"no-store",credentials:"same-origin",
      ...(body?{headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})
    });
  }catch{throw Error(method==="POST"?"UNCERTAIN":"OFFLINE");}
  if(response.status===401)throw Error("EXPIRED");
  if(response.status===403)throw Error("DENIED");
  if(response.status===409)throw Error("CHANGED");
  if(response.status===400)throw Error("INVALID");
  if(!response.ok)throw Error(method==="POST"?"UNCERTAIN":"OFFLINE");
  try{return await response.json() as T;}
  catch{throw Error(method==="POST"?"UNCERTAIN":"OFFLINE");}
}
function safeMessage(error:unknown){
  const code=error instanceof Error?error.message:"UNCERTAIN";
  return code==="EXPIRED"?"Your session expired. Sign in again.":
    code==="DENIED"?"Your current access does not permit this private file.":
    code==="CHANGED"?"The application or original file changed. Refresh before continuing.":
    code==="INVALID"?"Select a supported file smaller than 10 MB.":
    "The file operation is unconfirmed. Check its original status before retrying.";
}
function label(status:string){
  return ({
    UPLOAD_READY:"Upload permission ready (not yet uploaded)",
    INITIATED:"Waiting for private upload",
    VERIFYING:"Verifying file and malware scan",
    VALIDATED:"Verified private evidence",
    UNKNOWN:"Upload or scan outcome unconfirmed",
    STORAGE_UNAVAILABLE:"Private storage is unavailable",
    VERIFICATION_UNAVAILABLE:"File or malware scan could not be verified",
    EXPIRED:"Upload permission expired",
    REJECTED:"File rejected",
    EXPIRED_OR_REJECTED:"Upload expired or rejected"
  } as Record<string,string>)[status]??"Unverified private file";
}
export function PrivateCaseEvidencePanel({canIssue=false,canRevoke=false}:{canIssue?:boolean;canRevoke?:boolean}){
  const [cases,setCases]=useState<CG03CaseView[]>([]);
  const [selected,setSelected]=useState("");
  const [file,setFile]=useState<File|null>(null);
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [status,setStatus]=useState<CG19UploadStatus|CG19UploadStart|null>(null);
  const [media,setMedia]=useState<MediaRecord[]>([]);
  const [mediaLoading,setMediaLoading]=useState(false);
  const [revokeReview,setRevokeReview]=useState<MediaRecord|null>(null);
  const [notice,setNotice]=useState<Notice|null>(null);
  const [uncertain,setUncertain]=useState(false);
  const [requestKey,setRequestKey]=useState("");
  const [uploadRef,setUploadRef]=useState("");
  const generation=useRef(0);
  const mediaGeneration=useRef(0);
  const refresh=useCallback(async()=>{
    const gen=++generation.current;setLoading(true);
    try{
      const result=await json<{cases:CG03CaseView[]}>("/api/approvals/cases?limit=30");
      if(!Array.isArray(result.cases)||result.cases.length>30||
        result.cases.some(c=>typeof c.caseRef!=="string"||
          typeof c.reference!=="string"||!Number.isInteger(c.proposalRevision)))
        throw Error("OFFLINE");
      if(gen===generation.current){
        setCases(result.cases);
        setSelected(old=>result.cases.some(c=>c.caseRef===old)?old:"");
      }
    }catch(e){if(gen===generation.current){setCases([]);setSelected("");setNotice({
      kind:"error",text:safeMessage(e)})}}
    finally{if(gen===generation.current)setLoading(false)}
  },[]);
  useEffect(()=>{void refresh();return()=>{++generation.current}},[refresh]);
  const loadMedia=useCallback(async()=>{
    const request=++mediaGeneration.current;
    if(!selected){setMedia([]);return;}
    setMediaLoading(true);
    try{
      const result=await json<{files:MediaRecord[]}>(
        "/api/documents/files/case/"+encodeURIComponent(selected));
      if(!Array.isArray(result.files)||result.files.length>30||
        result.files.some(file=>typeof file.fileRef!=="string"||
          !Number.isSafeInteger(file.revision)||typeof file.revoked!=="boolean"))
        throw Error("OFFLINE");
      if(request===mediaGeneration.current)setMedia(result.files);
    }catch(e){
      if(request===mediaGeneration.current){
        setMedia([]);
        setNotice({kind:"error",text:safeMessage(e)});
      }
    }finally{
      if(request===mediaGeneration.current)setMediaLoading(false);
    }
  },[selected]);
  useEffect(()=>{void loadMedia();return()=>{++mediaGeneration.current};},[loadMedia]);
  async function revokeMedia(item:MediaRecord){
    if(busy||uncertain||item.revoked)return;
    if(revokeReview?.fileRef!==item.fileRef){setRevokeReview(item);return;}
    setBusy(true);setNotice(null);
    try{
      const result=await json<{revoked:boolean;revision:number}>(
        "/api/documents/files/"+encodeURIComponent(item.fileRef)+"/revoke",
        "POST",{expectedRevision:item.revision});
      if(!result.revoked)throw Error("UNCERTAIN");
      setRevokeReview(null);
      setNotice({kind:"success",text:
        "The private file was revoked. Previous document history is retained."});
      await loadMedia();
    }catch(e){setNotice({kind:"error",text:safeMessage(e)})}
    finally{setBusy(false);}
  }
  function chooseFile(f:File|null){
    if(busy||uncertain)return;
    setFile(f);setRequestKey("");setUploadRef("");setStatus(null);setNotice(null);
  }
  function chooseCase(caseRef:string){
    if(busy||uncertain)return;
    setSelected(caseRef);setFile(null);setRequestKey("");
    setUploadRef("");setStatus(null);setNotice(null);
  }
  async function checkStatus(){
    if(!uploadRef||busy)return;
    setBusy(true);setNotice(null);
    try{
      const saved=await json<CG19UploadStatus>(
        "/api/documents/files/intents/"+encodeURIComponent(uploadRef));
      if(typeof saved.status!=="string"||typeof saved.cleanVerified!=="boolean")
        throw Error("OFFLINE");
      setStatus(saved);
      setUncertain(false);
      setNotice({kind:saved.cleanVerified?"success":"info",
        text:saved.cleanVerified?
          "This file passed the storage and malware checks. It remains private.":
          "Original upload found: "+label(saved.status)+
          ". A new attempt must not be assumed successful."});
    }catch(e){setUncertain(true);setNotice({kind:"error",text:safeMessage(e)})}
    finally{setBusy(false);}
  }
  async function submit(){
    if(busy||uncertain||!file||!selected)return;
    const caseItem=cases.find(c=>c.caseRef===selected);
    if(!caseItem){setNotice({kind:"error",text:"Choose an available application."});return;}
    if(!MIME.has(file.type)||file.size<1||file.size>10*1024*1024){
      setNotice({kind:"error",text:"Choose a PDF, JPG, PNG or WebP file under 10 MB."});return;
    }
    setBusy(true);setNotice(null);
    const key=requestKey||crypto.randomUUID();
    setRequestKey(key);
    try{
      // Hash actual user-selected bytes; never rely on a filename or a supplied
      // metadata digest. The server validates against real stored bytes again.
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest(
        "SHA-256",await file.arrayBuffer()))).map(x=>x.toString(16).padStart(2,"0")).join("");
      const created=await json<CG19UploadStart>("/api/documents/files/initiate","POST",{
        caseRef:caseItem.caseRef,sourceRevision:caseItem.proposalRevision,
        requestKey:key,mime:file.type,sizeBytes:file.size,sha256:hash
      });
      if(typeof created.uploadRef!=="string"||typeof created.status!=="string")
        throw Error("UNCERTAIN");
      setUploadRef(created.uploadRef);setStatus(created);
      if(created.status==="STORAGE_UNAVAILABLE"||!created.uploadUrl){
        setNotice({kind:"info",text:"Private storage is not configured or available. No file was accepted."});
        return;
      }
      const destination=new URL(created.uploadUrl);
      if(destination.protocol!=="https:"||!created.uploadHeaders||
        created.uploadHeaders["Content-Type"]!==file.type)throw Error("UNCERTAIN");
      // The signed PUT is allowed only for the object specified by the
      // server reservation. A PUT response is NOT scan or file acceptance.
      let placed:Response;
      try{
        placed=await fetch(created.uploadUrl,{method:"PUT",
          headers:created.uploadHeaders,body:file,mode:"cors",
          cache:"no-store",credentials:"omit"});
      }catch{throw Error("UNCERTAIN");}
      if(!placed.ok)throw Error("UNCERTAIN");
      const confirmed=await json<CG19UploadStatus>(
        "/api/documents/files/intents/"+encodeURIComponent(created.uploadRef)+"/confirm",
        "POST");
      if(typeof confirmed.cleanVerified!=="boolean")throw Error("UNCERTAIN");
      setStatus(confirmed);
      setNotice({kind:confirmed.cleanVerified?"success":"info",
        text:confirmed.cleanVerified?
          "Your private evidence is verified and stored for this application.":
          "Upload complete, but the original verification remains unconfirmed. Check status."});
      setUncertain(!confirmed.cleanVerified);
    }catch(e){
      setUncertain(true);setNotice({kind:"error",text:safeMessage(e)});
    }finally{setBusy(false)}
  }
  function reset(){
    if(busy||uncertain)return;
    setFile(null);setRequestKey("");setUploadRef("");setStatus(null);setNotice(null);
  }
  const selectedCase=cases.find(c=>c.caseRef===selected);
  const validated=status&&"cleanVerified" in status&&status.cleanVerified;
  return <section className="role-workspace">
    <header className="topbar"><div>
      <h1>Private case documents</h1>
      <p>Protected application evidence and verified file status</p></div>
      <button type="button" onClick={()=>void refresh()} disabled={busy||loading}>
        Refresh applications</button></header>
    <div className="kpi-grid">
      <article className="kpi"><small>Available applications</small>
        <strong>{loading?"—":cases.length}</strong>
        <span>Only cases permitted by your access</span></article>
      <article className="kpi"><small>File verification</small>
        <strong>{validated?"Verified":status?"Pending":"—"}</strong>
        <span>Storage and malware scan required</span></article>
      <article className="kpi"><small>Private sharing</small><strong>Restricted</strong>
        <span>Not published or publicly searchable</span></article>
    </div>
    {notice&&<p role={notice.kind==="success"?"status":"alert"}
      className={"notice "+notice.kind}>{notice.text}</p>}
    {selected&&<section className="role-pane">
      <div className="role-pane-heading"><h2>Verified case media</h2></div>
      <div className="role-detail-content">
        {mediaLoading?<p role="status" className="cg-module-loading">Verifying private case files…</p>:
          !media.length?<p className="cg-module-empty" role="status">No verified media files for this application.</p>:
          <div className="role-table-wrap"><table className="role-table">
            <thead><tr><th>Date</th><th>Type</th><th>Size</th>
              <th>Status</th><th>Action</th></tr></thead>
            <tbody>{media.map(item=><tr key={item.fileRef}>
              <td>{new Date(item.createdAt).toLocaleString()}</td>
              <td>{item.mime}</td><td>{(item.sizeBytes/1024).toFixed(0)} KB</td>
              <td>{item.revoked?"Revoked":"Verified private file"}</td>
              <td><div className="toolbar">
                {!item.revoked&&<a href={"/api/documents/files/"+
                  encodeURIComponent(item.fileRef)+"/download"}>Download</a>}
                {!item.revoked&&<button type="button" disabled={busy||uncertain}
                  onClick={()=>void revokeMedia(item)}>
                  {revokeReview?.fileRef===item.fileRef?"Confirm revoke":"Revoke"}
                </button>}
              </div></td>
            </tr>)}</tbody>
          </table></div>}
        <button type="button" disabled={busy||mediaLoading}
          onClick={()=>void loadMedia()}>Refresh verified media</button>
        {revokeReview&&<p role="status">
          Confirm revocation of the selected file. This permanently blocks
          further authorized downloads, without deleting the audit history.
        </p>}
      </div>
    </section>}
    <section className="role-pane"><div className="role-pane-heading">
      <h2>Attach case evidence</h2></div>
      <div className="role-detail-content">
        <p>Only documents for a real protected application may be attached.
          Files attached after a final decision are archival only and do not
          change the approval.</p>
        <label className="field">Select authorized application
          <select value={selected} disabled={loading||busy||uncertain}
            onChange={e=>chooseCase(e.target.value)}>
            <option value="">Choose an application</option>
            {cases.map(c=><option key={c.caseRef} value={c.caseRef}>
              {c.reference} · {c.accountName} · {c.status.replaceAll("_"," ")}
            </option>)}
          </select></label>
        {selectedCase&&<p role="status">Application {selectedCase.reference},
          revision {selectedCase.proposalRevision}. Any evidence after final
          approval is archival only.</p>}
        <label className="field">Private evidence (PDF, JPEG, PNG or WebP; max 10 MB)
          <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp"
            disabled={!selected||busy||uncertain}
            onChange={e=>chooseFile(e.currentTarget.files?.[0]??null)}/>
        </label>
        {file&&<p>{file.name} · {(file.size/1024/1024).toFixed(2)} MB</p>}
        {status&&<p role="status">Original file status: {label(status.status)}</p>}
        {validated&&"fileRef" in status&&status.fileRef&&
          <a href={"/api/documents/files/"+encodeURIComponent(status.fileRef)+"/download"}>
            Download verified private evidence</a>}
        {uncertain&&<div className="permission-group">
          <strong>Previous write outcome uncertain</strong>
          <p>Do not upload again. Check the original request before any retry.</p>
          <button type="button" onClick={()=>void checkStatus()}
            disabled={busy||!uploadRef}>Check original upload status</button>
          {!uploadRef&&<p>Storage did not confirm a reference.
            Contact Foundation support before attempting a second upload.</p>}
        </div>}
        <div className="toolbar">
          <button type="button" disabled={!file||!selected||busy||uncertain}
            onClick={()=>void submit()}>{busy?"Verifying…":"Upload & verify file"}</button>
          <button type="button" disabled={busy||uncertain} onClick={reset}>Clear</button>
          {uploadRef&&!uncertain&&<button type="button" disabled={busy}
            onClick={()=>void checkStatus()}>Refresh file status</button>}
        </div>
      </div>
    </section>
    {selectedCase&&canIssue&&
      <PrivateLetterPanel key={selectedCase.caseRef}
        caseRef={selectedCase.caseRef} sourceRevision={selectedCase.proposalRevision}
        canIssue={canIssue} canRevoke={canRevoke}/>}
    {!selectedCase&&<section className="role-pane"><div className="role-pane-heading">
      <h2>Approved access letters</h2></div>
      <div className="role-detail-content">
        <p>Choose an authorized application to see its verified private letters.</p>
      </div>
    </section>}
  </section>;
}
