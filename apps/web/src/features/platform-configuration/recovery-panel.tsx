"use client";
import {FormEvent,useCallback,useEffect,useRef,useState} from "react";
import type {
  CG21RecoveryAvailability,CG21RecoveryOperation,CG21RecoveryOutcome
} from "@careganga/api-contracts";
type Feedback={kind:"error"|"info"|"success";message:string};
async function call<T>(path:string,method="GET",body?:object):Promise<T>{
  let response:Response;
  try{
    response=await fetch("/api/platform/"+path,{
      method,credentials:"same-origin",cache:"no-store",
      ...(body?{headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})
    });
  }catch{throw Error("UNKNOWN");}
  if(response.status===401||response.status===403)throw Error("DENIED");
  if(response.status===400)throw Error("VALIDATION");
  if(response.status===409)throw Error("CONFLICT");
  if(response.status===429)throw Error("RATE_LIMITED");
  if(!response.ok)throw Error("UNKNOWN");
  try{return await response.json() as T;}catch{throw Error("UNKNOWN");}
}
function describe(e:unknown):string{
  const reason=e instanceof Error?e.message:"UNKNOWN";
  return reason==="DENIED"?"Your recovery permissions expired. Sign in again.":
    reason==="VALIDATION"?"Check the secured backup reference and fresh authenticator code.":
    reason==="CONFLICT"?"This recovery request changed. Verify the earlier request.":
    reason==="RATE_LIMITED"?"Too many proof attempts. Try again later.":
    "The recovery request outcome could not be verified. Check its original reference before retrying.";
}
function stateLabel(s:string):string{
  return ({
    REQUESTED:"Request recorded, not executed",
    PRIVILEGED_AUTHORIZED:"Privileged authorization recorded",
    RUNNING:"Execution reported (proof required)",
    VERIFIED_SUCCEEDED:"Independently verified",
    FAILED:"Failed",
    UNKNOWN:"Outcome unconfirmed"
  } as Record<string,string>)[s]??"Unverified recovery status";
}
export function RecoveryPanel(){
  const [availability,setAvailability]=useState<CG21RecoveryAvailability|null>(null);
  const [operations,setOperations]=useState<CG21RecoveryOperation[]>([]);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [unknown,setUnknown]=useState(false);
  const [notice,setNotice]=useState<Feedback|null>(null);
  const [backupReference,setBackupReference]=useState("");
  const [totp,setTotp]=useState("");
  const [review,setReview]=useState(false);
  const [authorization,setAuthorization]=useState<CG21RecoveryOperation|null>(null);
  const [authorizationTotp,setAuthorizationTotp]=useState("");
  const [authorizationReview,setAuthorizationReview]=useState(false);
  const pendingKind=useRef<"REQUEST"|"AUTHORIZE">("REQUEST");
  const requestKey=useRef("");
  const generation=useRef(0);
  const read=useCallback(async()=>{
    const seq=++generation.current;setLoading(true);
    try{
      const [availability,history]=await Promise.all([
        call<CG21RecoveryAvailability>("recovery/availability"),
        call<{operations:CG21RecoveryOperation[]}>("recovery/operations")
      ]);
      if(!["AVAILABLE","NOT_AVAILABLE"].includes(availability.status)||
        !Array.isArray(history.operations)||history.operations.length>30)
        throw Error("UNKNOWN");
      if(seq!==generation.current)return;
      setAvailability(availability);setOperations(history.operations);
    }catch(e){
      if(seq!==generation.current)return;
      setAvailability(null);setOperations([]);
      setNotice({kind:"error",message:describe(e)});
    }finally{if(seq===generation.current)setLoading(false);}
  },[]);
  useEffect(()=>{void read();return()=>{++generation.current;};},[read]);
  async function request(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(saving||unknown||availability?.status!=="AVAILABLE")return;
    if(!/^backupref:[A-Za-z0-9/_-]{6,170}$/.test(backupReference)||
      !/^[0-9]{6}$/.test(totp)){
      setNotice({kind:"error",message:
        "Enter a secured backup reference and fresh six-digit authenticator code."});return;
    }
    if(!review){setReview(true);return;}
    if(!requestKey.current)requestKey.current=crypto.randomUUID();
    pendingKind.current="REQUEST";
    setSaving(true);setNotice(null);
    try{
      const outcome=await call<CG21RecoveryOutcome>("recovery/request","POST",{
        backupReference,expectedVersion:0,requestKey:requestKey.current,totp
      });
      if(outcome.status==="NOT_AVAILABLE"){
        setNotice({kind:"info",message:
          "No independently verified backup is available. No recovery request was created."});
        return;
      }
      if(!["REQUESTED","REPLAY_CONFIRMED"].includes(outcome.status))throw Error("UNKNOWN");
      setBackupReference("");setTotp("");setReview(false);requestKey.current="";
      setNotice({kind:"success",message:
        "Recovery request recorded. No restore has been started or completed."});
      await read();
    }catch(err){
      if(err instanceof Error&&err.message==="UNKNOWN")setUnknown(true);
      setNotice({kind:"error",message:describe(err)});
    }finally{setSaving(false);}
  }
  async function verifyPrevious(){
    if(!unknown||!requestKey.current||saving)return;
    setSaving(true);
    try{
      const endpoint=pendingKind.current==="AUTHORIZE"?
        "recovery/authorization/changes/":"recovery/changes/";
      const result=await call<{status:string;operationStatus?:string}>(
        endpoint+encodeURIComponent(requestKey.current));
      if(result.status==="CONFIRMED"){
        setUnknown(false);requestKey.current="";setReview(false);
        setBackupReference("");setTotp("");setAuthorization(null);
        setAuthorizationTotp("");setAuthorizationReview(false);
        setNotice({kind:"success",message:
          pendingKind.current==="AUTHORIZE"?
            "Authorization was recorded. No restoration was executed.":
            "The original recovery request is confirmed. This does not mean restoration occurred."});
        await read();
      }else setNotice({kind:"info",message:
        "No committed request is visible. Contact Foundation operations before any retry."});
    }catch(e){setNotice({kind:"error",message:describe(e)});}
    finally{setSaving(false);}
  }
  function startAuthorization(row:CG21RecoveryOperation){
    if(saving||unknown||availability?.status!=="AVAILABLE"||row.status!=="REQUESTED")return;
    pendingKind.current="AUTHORIZE";requestKey.current=crypto.randomUUID();
    setAuthorization(row);setAuthorizationTotp("");setAuthorizationReview(false);setNotice(null);
  }
  async function saveAuthorization(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(!authorization||saving||unknown||availability?.status!=="AVAILABLE")return;
    if(!/^[0-9]{6}$/.test(authorizationTotp)){
      setNotice({kind:"error",message:"Enter a fresh six-digit authenticator code."});return;
    }
    if(!authorizationReview){setAuthorizationReview(true);return;}
    setSaving(true);setNotice(null);
    try{
      const result=await call<{status:string;version?:number}>(
        "recovery/operations/"+encodeURIComponent(authorization.operationRef)+"/authorize",
        "POST",{expectedVersion:authorization.version,requestKey:requestKey.current,
          totp:authorizationTotp});
      if(result.status==="NOT_AVAILABLE"){
        setNotice({kind:"info",message:"Backup readiness was not verified. No authorization was recorded."});
        return;
      }
      if(result.status!=="PRIVILEGED_AUTHORIZED"&&result.status!=="REPLAY_CONFIRMED")
        throw Error("UNKNOWN");
      requestKey.current="";setAuthorization(null);setAuthorizationTotp("");
      setAuthorizationReview(false);
      setNotice({kind:"success",message:
        "Authorization recorded under current root access. Restoration has not started."});
      await read();
    }catch(error){
      if(error instanceof Error&&error.message==="UNKNOWN")setUnknown(true);
      setNotice({kind:"error",message:describe(error)});
    }finally{setSaving(false);}
  }
  return <section className="role-workspace">
    <header className="topbar">
      <div><h1>Backup &amp; Restore</h1>
        <p>Restricted recovery readiness and independently authorized operations</p></div>
      <div className="toolbar">
        <button type="button" disabled={saving||loading||unknown}
          onClick={()=>void read()}>Refresh readiness</button>
      </div>
    </header>
    {notice&&<p className={"notice "+notice.kind}
      role={notice.kind==="success"?"status":"alert"}>{notice.message}</p>}
    {unknown&&<div className="permission-group">
      <strong>Previous request outcome is uncertain</strong>
      <p>Never repeat an unconfirmed recovery request or start a second restore.</p>
      <button type="button" disabled={saving}
        onClick={()=>void verifyPrevious()}>
        {saving?"Checking…":"Check previous request"}</button>
    </div>}
    <section className="role-pane" aria-labelledby="recovery-readiness-title">
      <div className="role-pane-heading">
        <h2 id="recovery-readiness-title">Secured backup readiness</h2></div>
      <div className="role-detail-content">
        {loading?<p role="status">Checking verified recovery facility…</p>:
          availability?<div className="permission-group">
            <strong>{availability.status==="AVAILABLE"?
              "Secured facility registered":"Backup & restore unavailable"}</strong>
            <p>{availability.message}</p>
            <p>CareGanga never assumes that an integration reference is a usable backup.
              A production restore requires separate operations authorization,
              isolated recovery drill and independently verified completion evidence.</p>
          </div>:<p role="alert">Readiness cannot be verified. No restore action is available.</p>}
      </div>
    </section>
    {availability?.status==="AVAILABLE"&&!authorization&&<div className="role-pane">
      <div className="role-pane-heading"><h2>Request protected recovery</h2></div>
      <form className="form role-detail-content" onSubmit={e=>void request(e)}>
        <p>Creates a guarded request only. It cannot execute a restore or claim success.</p>
        <label className="field">Verified secured-backup reference
          <input type="password" autoComplete="off" value={backupReference}
            onChange={e=>{setBackupReference(e.target.value);setReview(false);}}
            maxLength={180} placeholder="backupref:..." required/>
        </label>
        <label className="field">Fresh Super Admin authenticator code
          <input inputMode="numeric" autoComplete="one-time-code"
            maxLength={6} pattern="[0-9]{6}" value={totp}
            onChange={e=>{setTotp(e.target.value.replace(/[^0-9]/g,""));setReview(false);}}
            required/></label>
        {review&&<p role="status">Review request: no restore will be executed.
          The request is auditable and subject to independent operations approval.</p>}
        <div className="toolbar">
          <button type="button" disabled={saving} onClick={()=>{setReview(false);setTotp("");}}>
            Cancel review</button>
          <button className="primary" type="submit" disabled={saving||unknown}>
            {saving?"Saving…":review?"Confirm request":"Review request"}</button>
        </div>
      </form>
    </div>}
    <section className="role-pane" aria-labelledby="recovery-requests-title">
      <div className="role-pane-heading"><h2 id="recovery-requests-title">
        Recovery request history</h2></div>
      <div className="role-detail-content">
        {!loading&&!operations.length?<p>No recovery requests recorded. No restore activity is claimed.</p>:
        <div className="role-table-wrap"><table className="role-table">
          <thead><tr><th>Requested</th><th>State</th><th>Revision</th>
            <th>Last updated</th><th>Action</th></tr></thead>
          <tbody>{operations.map(o=><tr key={o.operationRef}>
            <td>{new Date(o.requestedAt).toLocaleString()}</td>
            <td><span className="account-status">{stateLabel(o.status)}</span></td>
            <td>{o.version}</td><td>{new Date(o.updatedAt).toLocaleString()}</td>
            <td>{availability?.status==="AVAILABLE"&&o.status==="REQUESTED"?
              <button type="button" disabled={saving||unknown}
                onClick={()=>startAuthorization(o)}>Review authorization</button>:
              "No action available"}</td>
          </tr>)}</tbody></table></div>}
      </div>
    </section>
    {authorization&&availability?.status==="AVAILABLE"&&<div className="drawer-backdrop" role="presentation">
      <section className="role-drawer" role="dialog" aria-modal="true"
        aria-labelledby="recovery-authorization-title">
        <header className="topbar"><h2 id="recovery-authorization-title">Authorize recovery request</h2>
          <button type="button" disabled={saving||unknown} onClick={()=>{
            setAuthorization(null);setAuthorizationTotp("");setAuthorizationReview(false);
            requestKey.current="";
          }}>Close</button></header>
        <form className="form" onSubmit={e=>void saveAuthorization(e)}>
          <p>Authorization is not a restore command. An independently verified
            operations adapter and successful isolated drill are still required.</p>
          <p>Current request revision: {authorization.version}</p>
          <label className="field">Fresh Super Admin authenticator code
            <input required inputMode="numeric" autoComplete="one-time-code"
              maxLength={6} pattern="[0-9]{6}" value={authorizationTotp}
              onChange={e=>{setAuthorizationTotp(e.target.value.replace(/[^0-9]/g,""));
                setAuthorizationReview(false);}}/>
          </label>
          {authorizationReview&&<p role="status">Review this guarded authorization.
            No backup execution or completion will be claimed.</p>}
          <div className="toolbar">
            <button type="button" disabled={saving||unknown} onClick={()=>{
              setAuthorization(null);requestKey.current="";setAuthorizationReview(false);
            }}>Cancel</button>
            <button type="submit" className="primary" disabled={saving||unknown}>
              {saving?"Saving…":authorizationReview?"Confirm authorization":"Review authorization"}</button>
          </div>
        </form>
      </section>
    </div>}
  </section>;
}
