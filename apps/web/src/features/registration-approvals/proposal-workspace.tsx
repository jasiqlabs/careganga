"use client";
import {FormEvent,useCallback,useEffect,useRef,useState} from "react";
import type {
  CG03CaseView,CG03CaseDetail,CG03CaseOutcome,CG03Lookup,CG03OwnerOutcome,
  CG03Option,CG03ProcessView
} from "@careganga/api-contracts";

type Feedback={kind:"error"|"info"|"success";message:string};
const humanStatus=(v:string):string=>({
  SUBMITTED:"Submitted for review",IN_REVIEW:"In review",RETURNED:"Returned for correction",
  REJECTED:"Rejected",FINAL_APPROVED:"Final decision recorded",
  PENDING_OWNER:"Applying approved access",OWNER_COMPLETED:"Access change confirmed",
  OWNER_BLOCKED:"Access changed; new review required",
  OWNER_FAILED_RETRYABLE:"Access change not confirmed"
} as Record<string,string>)[v]??"Pending verification";

async function api<T>(path:string,method="GET",body?:object):Promise<T>{
  let response:Response;
  try{
    response=await fetch("/api/approvals/"+path,{
      method,cache:"no-store",credentials:"same-origin",
      ...(body?{headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})
    });
  }catch{throw Error(method==="POST"?"UNKNOWN":"UNAVAILABLE");}
  if(response.status===401)throw Error("EXPIRED");
  if(response.status===403)throw Error("DENIED");
  if(response.status===400)throw Error("INVALID");
  if(response.status===409){
    try{
      const value:unknown=await response.json();
      if(value&&typeof value==="object"&&"code" in value&&
        typeof value.code==="string")throw Error(value.code);
    }catch(e){if(e instanceof Error&&e.message!=="CONFLICT"&&e.message!=="UNKNOWN")throw e;}
    throw Error("CONFLICT");
  }
  if(!response.ok)throw Error(method==="POST"?"UNKNOWN":"UNAVAILABLE");
  try{return await response.json() as T;}
  catch{throw Error(method==="POST"?"UNKNOWN":"UNAVAILABLE");}
}
function explanation(error:unknown){
  const reason=error instanceof Error?error.message:"UNKNOWN";
  return reason==="EXPIRED"?"Your session expired. Sign in again.":
    reason==="DENIED"?"Your current Foundation access does not permit this action.":
    reason==="INVALID"?"Choose an eligible account and role before submitting.":
    reason==="REVIEWER_REQUIRED"?"A second active Foundation Super Admin is required to review this request.":
    reason==="CORRECTION_REQUIRES_RETURN"?"Only a returned request can be corrected. Refresh its status.":
    reason==="ACTIVE_CASE_EXISTS"?"An active request already exists for this account. View the earlier application.":
    reason==="APPROVAL_REPLAY_CONFLICT"?"This request was already used for another change. Refresh before editing.":
    reason==="CONFLICT"?"An application or role changed elsewhere. Refresh before trying again.":
    "The result could not be confirmed. Check the original request before any retry.";
}
function validCase(x:unknown):x is CG03CaseView{
  if(!x||typeof x!=="object"||Array.isArray(x))return false;
  const v=x as Record<string,unknown>;
  return typeof v.caseRef==="string"&&typeof v.reference==="string"&&
    typeof v.accountName==="string"&&typeof v.roleName==="string"&&
    typeof v.status==="string"&&Number.isInteger(v.revision);
}
export function ProposalWorkspace({mayConfigure,mayPropose,mayReview}:{mayConfigure:boolean;mayPropose:boolean;mayReview:boolean}){
  const [cases,setCases]=useState<CG03CaseView[]>([]);
  const [process,setProcess]=useState<CG03ProcessView|null>(null);
  const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
  const [message,setMessage]=useState<Feedback|null>(null);
  const [creating,setCreating]=useState(false);
  const [editingProcess,setEditingProcess]=useState(false);
  const [accountQuery,setAccountQuery]=useState("");
  const [roleQuery,setRoleQuery]=useState("");
  const [accounts,setAccounts]=useState<CG03Option[]>([]);
  const [roles,setRoles]=useState<CG03Option[]>([]);
  const [account,setAccount]=useState("");
  const [role,setRole]=useState("");
  const [previousCase,setPreviousCase]=useState<string|null>(null);
  const [detail,setDetail]=useState<CG03CaseDetail|null>(null);
  const [detailBusy,setDetailBusy]=useState(false);
  const [ownerOutcome,setOwnerOutcome]=useState<CG03OwnerOutcome|null>(null);
  const [ownerBusy,setOwnerBusy]=useState(false);
  const [decisionAction,setDecisionAction]=useState<"APPROVE"|"RETURN"|"REJECT"|"FORWARD"|null>(null);
  const [decisionRemarks,setDecisionRemarks]=useState("");
  const [decisionPassword,setDecisionPassword]=useState("");
  const [decisionReview,setDecisionReview]=useState(false);
  const [decisionUnknown,setDecisionUnknown]=useState(false);
  const decisionKey=useRef("");
  const [firstReviewer,setFirstReviewer]=useState<"NONE"|"ACCESS_MANAGER">("NONE");
  const [currentPassword,setCurrentPassword]=useState("");
  const [unknown,setUnknown]=useState(false);
  const [pendingKind,setPendingKind]=useState<"CASE"|"PROCESS">("CASE");
  const key=useRef(""),generation=useRef(0),detailSeq=useRef(0);
  const refresh=useCallback(async()=>{
    const seq=++generation.current;setLoading(true);
    try{
      const [records,route]=await Promise.all([
        api<{cases:unknown[]}>("cases?limit=30"),
        api<CG03ProcessView>("process")
      ]);
      if(!Array.isArray(records.cases)||!records.cases.every(validCase)||
        !route||typeof route.version!=="number")throw Error("UNAVAILABLE");
      if(seq!==generation.current)return;
      setCases(records.cases);setProcess(route);
    }catch(e){
      if(seq!==generation.current)return;
      setCases([]);setProcess(null);
      setMessage({kind:"error",message:explanation(e)});
    }finally{if(seq===generation.current)setLoading(false);}
  },[]);
  useEffect(()=>{void refresh();return()=>{++generation.current;++detailSeq.current;};},[refresh]);
  async function search(kind:"account"|"role",q:string){
    if(q.length>70)return;
    try{
      const data=await api<{options:CG03Option[]}>(
        "options/"+kind+"?search="+encodeURIComponent(q));
      if(!Array.isArray(data.options)||data.options.length>30)throw Error("UNAVAILABLE");
      if(kind==="account")setAccounts(data.options);else setRoles(data.options);
    }catch(e){
      if(kind==="account")setAccounts([]);else setRoles([]);
      setMessage({kind:"error",message:explanation(e)});
    }
  }
  function begin(previous?:CG03CaseView){
    if(busy||unknown||!mayPropose)return;
    key.current=crypto.randomUUID();setPendingKind("CASE");
    setPreviousCase(previous?.caseRef??null);
    setAccount("");setRole("");setAccounts([]);setRoles([]);
    setAccountQuery(previous?.accountName??"");setRoleQuery("");
    setCreating(true);setMessage(null);
    void search("account","");void search("role","");
  }
  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(busy||unknown||!account||!role)return;
    setBusy(true);setMessage(null);
    try{
      const result=await api<CG03CaseOutcome>("cases","POST",{
        targetAccountRef:account,targetRoleRef:role,requestKey:key.current,
        ...(previousCase?{previousCaseRef:previousCase}:{})
      });
      if(!validCase(result))throw Error("UNKNOWN");
      setCreating(false);key.current="";setPreviousCase(null);
      setMessage({kind:"success",message:
        result.reference+" submitted for protected review. No access was granted."});
      await refresh();
    }catch(error){
      if(error instanceof Error&&error.message==="UNKNOWN")setUnknown(true);
      setMessage({kind:"error",message:explanation(error)});
    }finally{setBusy(false);}
  }
  async function resolve(){
    if(!key.current||!unknown||busy)return;
    setBusy(true);
    try{
      if(pendingKind==="CASE"){
        const result=await api<CG03Lookup>(
          "cases/requests/"+encodeURIComponent(key.current));
        if(result.status==="CONFIRMED"&&result.case){
          setUnknown(false);setCreating(false);key.current="";
          setMessage({kind:"success",message:
            result.case.reference+" is recorded. No access change has been applied."});
          await refresh();
        }else setMessage({kind:"info",message:
          "No committed result is visible. Ask Foundation support before sending another request."});
      }else{
        const prior=await api<{status:string;version:number|null}>(
          "process/changes/"+encodeURIComponent(key.current));
        if(prior.status==="CONFIRMED"&&Number.isInteger(prior.version)){
          const active=await api<CG03ProcessView>("process");
          if(active.version<Number(prior.version))throw Error("UNAVAILABLE");
          setProcess(active);setUnknown(false);setEditingProcess(false);key.current="";
          setMessage({kind:"success",message:
            "The original process change is confirmed. Older cases keep their pinned route."});
        }else setMessage({kind:"info",message:
          "No committed process change is visible. Ask Foundation support before a new attempt."});
      }
    }catch(e){setMessage({kind:"error",message:explanation(e)});}
    finally{setBusy(false);}
  }
  async function viewCase(entry:CG03CaseView){
    const seq=++detailSeq.current;setDetailBusy(true);setDetail(null);
    setOwnerOutcome(null);
    setDecisionAction(null);setDecisionRemarks("");setDecisionPassword("");
    setDecisionReview(false);
    try{
      const data=await api<CG03CaseDetail>(
        "cases/"+encodeURIComponent(entry.caseRef));
      if(seq!==detailSeq.current)return;
      if(!validCase(data)||!Array.isArray(data.history)||
        !Array.isArray(data.allowedDecisions))throw Error("UNAVAILABLE");
      setDetail(data);
      if(["PENDING_OWNER","OWNER_COMPLETED","OWNER_BLOCKED"].includes(data.status)){
        try{
          const status=await api<CG03OwnerOutcome>("cases/"+
            encodeURIComponent(data.caseRef)+"/owner-status");
          if(seq===detailSeq.current&&
            ["PENDING_OWNER","OWNER_COMPLETED","OWNER_BLOCKED"].includes(status.status))
            setOwnerOutcome(status);
        }catch{
          if(seq===detailSeq.current)setMessage({kind:"info",message:
            "The actual access effect could not be verified. No grant is claimed."});
        }
      }
    }catch(e){
      if(seq===detailSeq.current)setMessage({kind:"error",message:explanation(e)});
    }finally{if(seq===detailSeq.current)setDetailBusy(false);}
  }
  function chooseDecision(action:"APPROVE"|"RETURN"|"REJECT"|"FORWARD"){
    if(!detail||!detail.allowedDecisions.includes(action)||decisionUnknown||busy)return;
    setDecisionAction(action);setDecisionRemarks("");setDecisionPassword("");
    setDecisionReview(false);decisionKey.current=crypto.randomUUID();setMessage(null);
  }
  async function commitDecision(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!detail||!decisionAction||!detail.allowedDecisions.includes(decisionAction)||
      decisionUnknown||busy)return;
    if(detail.requiresCurrentPassword&&(decisionPassword.length<8||decisionPassword.length>1024)){
      setMessage({kind:"error",message:"A current password is required for the final decision."});
      return;
    }
    if(!decisionReview){setDecisionReview(true);return;}
    setBusy(true);setMessage(null);
    try{
      const result=await api<{status:string;revision:number}>(
        "cases/"+encodeURIComponent(detail.caseRef)+"/decisions","POST",{
          action:decisionAction,remarks:decisionRemarks.trim(),expectedRevision:detail.revision,
          requestKey:decisionKey.current,currentPassword:decisionPassword
        });
      if(!Number.isInteger(result.revision))throw Error("UNKNOWN");
      const selected=detail;
      setDecisionAction(null);setDecisionReview(false);setDecisionPassword("");
      decisionKey.current="";
      setMessage({kind:"success",message:humanStatus(result.status)+
        ". This records a review decision; access changes are verified separately."});
      await refresh();await viewCase(selected);
    }catch(error){
      if(error instanceof Error&&error.message==="UNKNOWN")setDecisionUnknown(true);
      setMessage({kind:"error",message:explanation(error)});
    }finally{setBusy(false);}
  }
  async function verifyDecision(){
    if(!detail||!decisionUnknown||!decisionKey.current||busy)return;
    setBusy(true);
    try{
      const result=await api<{status:string;revision:number|null}>(
        "cases/"+encodeURIComponent(detail.caseRef)+"/decisions/requests/"+
          encodeURIComponent(decisionKey.current));
      if(result.status==="CONFIRMED"&&Number.isInteger(result.revision)){
        const original=detail;
        setDecisionUnknown(false);setDecisionAction(null);decisionKey.current="";
        setMessage({kind:"success",message:"Original review decision confirmed. No duplicate was submitted."});
        await refresh();await viewCase(original);
      }else setMessage({kind:"info",message:
        "No decision is confirmed. Contact Foundation support before retrying."});
    }catch(error){setMessage({kind:"error",message:explanation(error)});}
    finally{setBusy(false);}
  }
  async function retryOwner(){
    if(!detail||!mayReview||!ownerOutcome?.canRetry||ownerBusy)return;
    setOwnerBusy(true);
    try{
      const result=await api<{status:string}>("cases/"+
        encodeURIComponent(detail.caseRef)+"/retry-owner","POST");
      const original=detail;
      setMessage({kind:result.status==="OWNER_COMPLETED"?"success":"info",
        message:result.status==="OWNER_COMPLETED"?
          "The original CG-01 role assignment is confirmed.":
          result.status==="OWNER_BLOCKED"?
          "Source revisions changed. A new proposal and review are required.":
          "The original access effect is still unconfirmed. No second grant was attempted."});
      await refresh();await viewCase(original);
    }catch(e){setMessage({kind:"error",message:explanation(e)});}
    finally{setOwnerBusy(false);}
  }
  async function saveProcess(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(busy||unknown)return;
    if((currentPassword.length<8||currentPassword.length>1024)){
      setMessage({kind:"error",message:"Enter a current password."});return;
    }
    if(!key.current)key.current=crypto.randomUUID();
    setPendingKind("PROCESS");setBusy(true);
    try{
      await api<{version:number}>("process/versions","POST",{
        firstReviewerCapability:firstReviewer==="NONE"?null:"roles.assign",
        requestKey:key.current,currentPassword
      });
      setEditingProcess(false);setCurrentPassword("");key.current="";
      setMessage({kind:"success",message:
        "The new review process version is active. Earlier applications keep their original route."});
      await refresh();
    }catch(error){
      if(error instanceof Error&&error.message==="UNKNOWN")setUnknown(true);
      setMessage({kind:"error",message:explanation(error)});
    }finally{setBusy(false);}
  }
  return <section className="role-workspace">
    <header className="topbar"><div><h1>Registration &amp; Approval</h1>
      <p>Protected Foundation access requests</p></div>
      <div className="toolbar">
        <button type="button" disabled={busy||loading||unknown}
          onClick={()=>void refresh()}>Refresh verified applications</button>
        {mayPropose&&<button className="primary" type="button" disabled={busy||unknown}
          onClick={()=>begin()}>Request protected role access</button>}
      </div></header>
    {message&&<p className={"notice "+message.kind}
      role={message.kind==="success"?"status":"alert"}>{message.message}</p>}
    {unknown&&<section className="permission-group" role="alert">
      <strong>Previous submission needs checking</strong>
      <p>A timed-out request may have been saved. Do not send a replacement.</p>
      <button type="button" disabled={busy} onClick={()=>void resolve()}>
        {busy?"Checking…":"Check previous submission"}</button>
    </section>}
    <div className="kpi-grid">
      <article className="kpi"><small>Visible applications</small><strong>{cases.length}</strong>
        <span>Only cases you may access</span></article>
      <article className="kpi"><small>Awaiting review</small>
        <strong>{cases.filter(x=>["SUBMITTED","IN_REVIEW"].includes(x.status)).length}</strong>
        <span>Within the currently visible list</span></article>
      <article className="kpi"><small>Current process</small><strong>{process?.version??"—"}</strong>
        <span>Versioned Foundation approval route</span></article>
    </div>
    <section className="role-pane">
      <div className="role-pane-heading"><div><h2>Approval process</h2>
        <p>Final review requires a different Foundation Super Admin and current password confirmation</p></div>
        {mayConfigure&&<button type="button" disabled={busy||unknown}
          onClick={()=>{setEditingProcess(true);key.current=crypto.randomUUID();
            setCurrentPassword("");setFirstReviewer(process?.firstReviewer?"ACCESS_MANAGER":"NONE");}}>
            Version process</button>}</div>
      <div className="role-detail-content">
        {process?<p>{process.active?
          "Current route: "+(process.firstReviewer?process.firstReviewer+" → ":"")+
          process.finalReviewer:
          "The verified Foundation route will be created with its first eligible application."}</p>:
          <p className="cg-module-loading" role="status">Checking process authority…</p>}
      </div>
    </section>
    <section className="role-pane" aria-label="Protected access applications">
      <div className="role-pane-heading"><h2>Applications</h2>
        <p>Current Foundation scope only; no documents or payments are required</p></div>
      <div className="role-table-wrap"><table className="role-table">
        <thead><tr><th>Application</th><th>Account</th><th>Proposed role</th>
          <th>Status</th><th>Submitted</th><th>Review</th></tr></thead>
        <tbody aria-busy={loading}>{loading?<tr><td colSpan={6}><span className="cg-module-loading" role="status">Verifying applications…</span></td></tr>:
          !cases.length?<tr><td colSpan={6}>No protected access applications found.</td></tr>:
          cases.map(entry=><tr key={entry.caseRef}>
            <td><strong>{entry.reference}</strong></td>
            <td>{entry.accountName}</td><td>{entry.roleName}</td>
            <td>{humanStatus(entry.status)}</td>
            <td>{new Date(entry.submittedAt).toLocaleString()}</td>
            <td><div className="toolbar"><button type="button"
              onClick={()=>void viewCase(entry)}>View</button>
              {mayPropose&&entry.status==="RETURNED"&&<button type="button"
                disabled={busy||unknown} onClick={()=>begin(entry)}>
                  Submit correction</button>}</div></td>
          </tr>)}
        </tbody></table></div>
    </section>
    {creating&&<div className="drawer-backdrop" role="presentation">
      <section className="role-drawer" role="dialog" aria-modal="true"
        aria-labelledby="cg03-proposal-title">
        <header className="topbar"><h2 id="cg03-proposal-title">
          {previousCase?"Correct returned request":"Request protected role access"}</h2>
          <button type="button" disabled={busy||unknown}
            onClick={()=>setCreating(false)}>Close</button></header>
        <form className="form" onSubmit={e=>void submit(e)}>
          <p>Approval is required. This request does not give anyone new access.</p>
          <label className="field">Search active Foundation account
            <input value={accountQuery} maxLength={70}
              onChange={e=>{setAccountQuery(e.target.value);setAccount("");
                void search("account",e.target.value);}}
              placeholder="Search by staff name"/>
          </label>
          <label className="field">Account
            <select required value={account} onChange={e=>setAccount(e.target.value)}>
              <option value="">Choose an eligible staff account</option>
              {accounts.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}
            </select></label>
          <label className="field">Search protected custom role
            <input value={roleQuery} maxLength={70}
              onChange={e=>{setRoleQuery(e.target.value);setRole("");
                void search("role",e.target.value);}}
              placeholder="Search role by name"/></label>
          <label className="field">Proposed role
            <select required value={role} onChange={e=>setRole(e.target.value)}>
              <option value="">Choose a role requiring approval</option>
              {roles.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}
            </select></label>
          <p>Current account and role revisions are frozen securely when submitted.
            Corrections create a new application; earlier decisions are kept.</p>
          <div className="toolbar">
            <button type="button" disabled={busy||unknown} onClick={()=>setCreating(false)}>
              Cancel</button>
            <button className="primary" disabled={busy||unknown||!account||!role}
              type="submit">{busy?"Submitting…":"Submit for approval"}</button>
          </div>
        </form>
      </section></div>}
    {editingProcess&&mayConfigure&&<div className="drawer-backdrop" role="presentation">
      <section className="role-drawer" role="dialog" aria-modal="true"
        aria-labelledby="cg03-route-title">
        <header className="topbar"><h2 id="cg03-route-title">Version reviewer route</h2>
          <button type="button" disabled={busy||unknown}
            onClick={()=>setEditingProcess(false)}>Close</button></header>
        <form className="form" onSubmit={e=>void saveProcess(e)}>
          <label className="field">Initial review step
            <select value={firstReviewer} onChange={e=>setFirstReviewer(
              e.target.value==="ACCESS_MANAGER"?"ACCESS_MANAGER":"NONE")}>
              <option value="NONE">Final Foundation Super Admin only</option>
              <option value="ACCESS_MANAGER">Access manager, then Super Admin</option>
            </select></label>
          <p>Existing applications keep their pinned reviewer steps.</p>
          <label className="field">Current password
            <input required type="password" minLength={8} maxLength={1024}
              autoComplete="current-password" value={currentPassword}
              onChange={e=>setCurrentPassword(e.target.value)}/></label>
          <div className="toolbar"><button type="button" disabled={busy||unknown}
            onClick={()=>setEditingProcess(false)}>Cancel</button>
            <button type="submit" className="primary" disabled={busy||unknown}>
              {busy?"Saving…":"Create new process version"}</button></div>
        </form></section></div>}
    {(detail||detailBusy)&&<div className="drawer-backdrop" role="presentation">
      <section className="role-drawer" role="dialog" aria-modal="true"
        aria-labelledby="cg03-case-title">
        <header className="topbar"><h2 id="cg03-case-title">
          {detail?.reference??"Verifying application"}</h2>
          <button type="button" onClick={()=>{++detailSeq.current;setDetail(null);
            setDetailBusy(false);}}>Close</button></header>
        {detail?<div className="role-detail-content">
          <p>Account: <strong>{detail.accountName}</strong></p>
          <p>Proposed role: <strong>{detail.roleName}</strong></p>
          <p>State: <strong>{humanStatus(detail.status)}</strong></p>
          <p>Proposal revision {detail.proposalRevision} · Process version {detail.processVersion}</p>
          <p>Frozen account access revision {detail.sourceAccountAccessRevision}
            · Frozen role revision {detail.sourceRoleRevision}</p>
          <h3>Approval history</h3>
          {!detail.history.length?<p>No decisions have been recorded.</p>:
            <ol>{detail.history.map((e,i)=><li key={i}>
              {e.action} by {e.by} · {new Date(e.at).toLocaleString()}
              {e.remarks?" — "+e.remarks:""}
            </li>)}</ol>}
          <p>Approval is not an access grant. The account source applies changes only
            after a verified final decision.</p>
          {["PENDING_OWNER","OWNER_COMPLETED","OWNER_BLOCKED"].includes(detail.status)&&
            <section className="permission-group" aria-label="Verified account effect">
              <strong>CG-01 access effect</strong>
              <p>{ownerOutcome?.status==="OWNER_COMPLETED"?
                "One approved role assignment was confirmed in the original account ledger.":
                ownerOutcome?.status==="OWNER_BLOCKED"?
                "The account or role changed; this approval cannot grant access.":
                "The account change is pending verification. Approval alone does not grant access."}</p>
              {mayReview&&ownerOutcome?.canRetry&&
                <button type="button" disabled={ownerBusy||busy}
                  onClick={()=>void retryOwner()}>
                  {ownerBusy?"Checking…":"Recheck original owner effect"}</button>}
            </section>}
          {decisionUnknown&&<div className="permission-group" role="alert">
            <strong>Review outcome needs verification</strong>
            <p>Do not send another approval or rejection until the original result is known.</p>
            <button type="button" disabled={busy} onClick={()=>void verifyDecision()}>
              Check previous decision</button>
          </div>}
          {!decisionUnknown&&detail.allowedDecisions.length>0&&<section
            className="permission-group" aria-label="Permitted reviewer decisions">
            <h3>Current review action</h3>
            <div className="toolbar">
              {detail.allowedDecisions.map(action=><button type="button" key={action}
                disabled={busy} aria-pressed={decisionAction===action}
                onClick={()=>chooseDecision(action)}>
                {action==="APPROVE"?"Approve":action==="RETURN"?"Send back":
                  action==="REJECT"?"Reject":"Forward"}</button>)}
            </div>
            {decisionAction&&<form className="form" onSubmit={e=>void commitDecision(e)}>
              <label className="field">Reviewer remarks
                <textarea maxLength={500} value={decisionRemarks}
                  onChange={e=>{setDecisionRemarks(e.target.value);setDecisionReview(false);}}
                  placeholder="Explain the decision and next step"/></label>
              {detail.requiresCurrentPassword&&<label className="field">
                Current password
                <input required type="password" minLength={8} maxLength={1024}
                  autoComplete="current-password" value={decisionPassword}
                  onChange={e=>{setDecisionPassword(e.target.value);
                    setDecisionReview(false);}}/>
              </label>}
              {decisionReview&&<p role="status">Confirm your {decisionAction.toLowerCase()}
                decision for {detail.reference}. A permanent reviewer entry will be recorded.</p>}
              <div className="toolbar">
                <button type="button" disabled={busy} onClick={()=>setDecisionAction(null)}>
                  Cancel</button>
                <button type="submit" className="primary" disabled={busy}>
                  {busy?"Recording…":decisionReview?"Confirm decision":"Review decision"}</button>
              </div>
            </form>}
          </section>}
        </div>:<p role="status">Verifying case details…</p>}
      </section></div>}
  </section>;
}
