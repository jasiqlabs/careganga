"use client";
import {useCallback,useEffect,useRef,useState} from "react";

type Template={configured:boolean;version:number;title?:string;body?:string;status:string};
type Letter={documentRef:string;state:string;issueRevision:number;templateVersion:number;
  issuedAt:string|null;canDownload:boolean;canReconcile:boolean};
type LetterListResponse={letters:Letter[];caseNumber:string};

async function request<T>(path:string,method:"GET"|"POST"="GET",body?:object):Promise<T>{
  let response:globalThis.Response;
  try{
    response=await fetch("/api/documents/letters/"+path,{
      method,credentials:"same-origin",cache:"no-store",
      ...(body?{headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})
    });
  }catch{throw Error("UNKNOWN");}
  if(response.status===401||response.status===403)throw Error("DENIED");
  if(response.status===409)throw Error("CONFLICT");
  if(response.status===400)throw Error("INVALID");
  if(!response.ok)throw Error("UNKNOWN");
  try{return await response.json() as T;}catch{throw Error("UNKNOWN")}
}

type Notice={kind:"error"|"success"|"info";text:string};

function message(e:unknown){
  const code=e instanceof Error?e.message:"UNKNOWN";
  return code==="DENIED"?"Your protected letter permission is no longer verified.":
    code==="CONFLICT"?"The original letter changed. Refresh before continuing.":
    code==="INVALID"?"Check the template and current password.":
    "The letter action outcome could not be confirmed. Check the same request before retrying.";
}

function label(s:string){
  return ({
    PENDING:"Request recorded, PDF not yet issued",
    VERIFYING:"Verifying private PDF",
    ISSUED:"Private PDF issued and verified",
    UNKNOWN:"Outcome unconfirmed — reconcile before retry",
    FAILED:"Private PDF not issued",
    REVOKED:"Revoked — download blocked"
  } as Record<string,string>)[s]??"Private document unverified";
}

function badgeClass(s:string){
  switch(s){
    case "ISSUED": return "cg19-badge cg19-badge-success";
    case "PENDING": return "cg19-badge cg19-badge-warning";
    case "VERIFYING": return "cg19-badge cg19-badge-info";
    case "REVOKED":
    case "FAILED": return "cg19-badge cg19-badge-danger";
    case "UNKNOWN": return "cg19-badge cg19-badge-warning";
    default: return "cg19-badge cg19-badge-neutral";
  }
}

export function PrivateLetterPanel({caseRef,sourceRevision,canIssue,canRevoke}:{
  caseRef:string;sourceRevision:number;canIssue:boolean;canRevoke:boolean
}){
  const [template,setTemplate]=useState<Template|null>(null);
  const [letters,setLetters]=useState<Letter[]>([]);
  const [caseNumber,setCaseNumber]=useState("");
  const [title,setTitle]=useState("Protected access confirmation");
  const [body,setBody]=useState(
    "This letter confirms that the specified CareGanga Foundation access change was approved and applied. Access remains subject to current permissions and may be revoked.");
  const [templatePassword,setTemplatePassword]=useState("");
  const [issuePassword,setIssuePassword]=useState("");
  const [revokePassword,setRevokePassword]=useState("");
  const [review,setReview]=useState<"TEMPLATE"|"ISSUE"|"REVOKE"|null>(null);
  const [revokeRef,setRevokeRef]=useState("");
  const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
  const [unknown,setUnknown]=useState(false);
  const [notice,setNotice]=useState<Notice|null>(null);
  const [showPreview,setShowPreview]=useState(true);
  const templateKey=useRef(""),issueKey=useRef("");
  const generation=useRef(0);

  const refresh=useCallback(async()=>{
    const seq=++generation.current;setLoading(true);
    try{
      const [t,l]=await Promise.all([
        request<Template>("template"),
        request<LetterListResponse>("case/"+encodeURIComponent(caseRef))
      ]);
      if(!t||!Number.isInteger(t.version)||!Array.isArray(l.letters)||
        l.letters.length>20)throw Error("UNKNOWN");
      if(seq!==generation.current)return;
      setTemplate(t);setLetters(l.letters);
      if(typeof l.caseNumber==="string"&&l.caseNumber)setCaseNumber(l.caseNumber);
      if(t.configured&&t.title&&t.body){
        setTitle(t.title);setBody(t.body);
      }
    }catch(e){
      if(seq!==generation.current)return;
      setTemplate(null);setLetters([]);setNotice({kind:"error",text:message(e)});
    }finally{if(seq===generation.current)setLoading(false);}
  },[caseRef]);

  useEffect(()=>{
    setUnknown(false);setNotice(null);issueKey.current="";
    templateKey.current="";setReview(null);setRevokeRef("");
    void refresh();
    return()=>{++generation.current};
  },[refresh,sourceRevision]);

  async function approveTemplate(){
    if(busy||unknown||!canIssue)return;
    if((templatePassword.length<8||templatePassword.length>1024)){
      setNotice({kind:"error",text:"Enter a current password."});return;
    }
    if(review!=="TEMPLATE"){setReview("TEMPLATE");return;}
    setBusy(true);setNotice(null);
    if(!templateKey.current)templateKey.current=crypto.randomUUID();
    try{
      const result=await request<{version:number;status:string}>("template/approve","POST",{
        title,body,expectedVersion:template?.version??0,
        requestKey:templateKey.current,currentPassword:templatePassword
      });
      if(!Number.isInteger(result.version))throw Error("UNKNOWN");
      templateKey.current="";setReview(null);setTemplatePassword("");
      setNotice({kind:"success",text:
        "A new private letter template version was approved."});
      await refresh();
    }catch(e){
      if(e instanceof Error&&e.message==="UNKNOWN")setUnknown(true);
      setNotice({kind:"error",text:message(e)});
    }finally{setBusy(false);}
  }

  async function issue(){
    if(busy||unknown||!canIssue)return;
    if((issuePassword.length<8||issuePassword.length>1024)){
      setNotice({kind:"error",text:"Enter a current password."});return;
    }
    if(review!=="ISSUE"){setReview("ISSUE");return;}
    setBusy(true);setNotice(null);
    if(!issueKey.current)issueKey.current=crypto.randomUUID();
    try{
      const result=await request<Letter>("issue","POST",{
        caseRef,sourceRevision,requestKey:issueKey.current,currentPassword:issuePassword
      });
      if(!result||typeof result.state!=="string"||
        typeof result.documentRef!=="string")throw Error("UNKNOWN");
      issueKey.current="";setIssuePassword("");setReview(null);
      setNotice({kind:result.state==="ISSUED"?"success":"info",
        text:result.state==="ISSUED"?
          "Private PDF issued and verified.":
          "Request recorded, but PDF is not confirmed: "+label(result.state)});
      await refresh();
    }catch(e){
      if(e instanceof Error&&e.message==="UNKNOWN")setUnknown(true);
      setNotice({kind:"error",text:message(e)});
    }finally{setBusy(false);}
  }

  async function findOriginal(){
    if(!issueKey.current||busy)return;
    setBusy(true);
    try{
      const result=await request<{status:string;letter:Letter|null}>(
        "requests/"+encodeURIComponent(issueKey.current));
      setUnknown(result.status!=="CONFIRMED");
      setNotice({kind:result.status==="CONFIRMED"?"info":"error",
        text:result.status==="CONFIRMED"?
          "Original request located: "+label(result.letter?.state??"UNKNOWN"):
          "No verified original request is visible. Contact Foundation operations before retrying."});
      await refresh();
    }catch(e){setNotice({kind:"error",text:message(e)})}
    finally{setBusy(false);}
  }

  async function reconcile(ref:string){
    if(busy||unknown)return;
    setBusy(true);setNotice(null);
    try{
      const result=await request<Letter>(encodeURIComponent(ref)+"/reconcile","POST");
      setNotice({kind:result.state==="ISSUED"?"success":"info",
        text:label(result.state)});
      await refresh();
    }catch(e){setNotice({kind:"error",text:message(e)})}
    finally{setBusy(false);}
  }

  async function revoke(){
    if(!canRevoke||busy||unknown||!revokeRef)return;
    if((revokePassword.length<8||revokePassword.length>1024)){
      setNotice({kind:"error",text:"Enter a current password."});return;
    }
    if(review!=="REVOKE"){setReview("REVOKE");return;}
    setBusy(true);setNotice(null);
    try{
      const result=await request<Letter>(
        encodeURIComponent(revokeRef)+"/revoke","POST",{currentPassword:revokePassword});
      setReview(null);setRevokeRef("");setRevokePassword("");
      setNotice({kind:result.state==="REVOKED"?"success":"info",
        text:result.state==="REVOKED"?
          "The private letter is revoked and cannot be downloaded.":
          "The letter status requires verification."});
      await refresh();
    }catch(e){
      if(e instanceof Error&&e.message==="UNKNOWN")setUnknown(true);
      setNotice({kind:"error",text:message(e)});
    }finally{setBusy(false);}
  }

  const latestIssued=letters.find(l=>l.state==="ISSUED");

  return <section className="role-pane" aria-labelledby="letters-title">
    <div className="role-pane-heading">
      <h2 id="letters-title">Private approved-access letters</h2>
      <div className="toolbar">
        <button type="button" aria-pressed={showPreview}
          onClick={()=>setShowPreview(p=>!p)}>
          {showPreview?"Hide letterhead preview":"Show letterhead preview (B38)"}
        </button>
      </div>
    </div>
    <div className="role-detail-content">
      {notice&&<p className={"notice "+notice.kind}
        role={notice.kind==="success"?"status":"alert"}>{notice.text}</p>}
      {unknown&&<div className="permission-group">
        <strong>Previous write outcome is uncertain</strong>
        <p>Never issue another letter or approve another template until the
          original status is verified.</p>
        <button type="button" disabled={busy||!issueKey.current}
          onClick={()=>void findOriginal()}>Check original issue request</button>
        <p>For an uncertain template or revoke request, contact Foundation operations
          and refresh the verified status before continuing.</p>
      </div>}
      {loading?<p role="status" className="cg-module-loading">Verifying approved letter history…</p>:
      <>
        {/* B38 Official A4 Letterhead Preview Sheet */}
        {showPreview&&<article className="cg19-letter-sheet" aria-label="B38 Live Official Letterhead Preview">
          <div className="cg19-letter-top-stripe" />
          <header className="cg19-letter-header">
            <h3 className="cg19-letter-brand">CareGanga Foundation</h3>
            <p className="cg19-letter-sub">Private confirmation — access change</p>
          </header>
          <div className="cg19-letter-meta-grid">
            <div className="cg19-letter-meta-item">
              <strong>Application Ref</strong>
              <span>{caseNumber||caseRef.slice(0,8)}</span>
            </div>
            <div className="cg19-letter-meta-item">
              <strong>Approved Revision</strong>
              <span>Revision {sourceRevision}</span>
            </div>
            <div className="cg19-letter-meta-item">
              <strong>Template Status</strong>
              <span>
                {template?.configured&&template.status==="APPROVED"?
                  `Approved v${template.version}`:"Template Draft"}
              </span>
            </div>
            <div className="cg19-letter-meta-item">
              <strong>Latest Document</strong>
              <span className={latestIssued?badgeClass(latestIssued.state):"cg19-badge cg19-badge-neutral"}>
                {latestIssued?label(latestIssued.state):"Not yet issued"}
              </span>
            </div>
          </div>
          <div className="cg19-letter-content">
            <h4 className="cg19-letter-title">{title||"Official Access Notice"}</h4>
            <div className="cg19-letter-body">
              {body||"Letter body content preview."}
            </div>
            <aside className="cg19-letter-terms">
              <strong>Terms & Conditions:</strong> Access remains subject to current role
              grants and security policy. This confirmation is cryptographically issued
              and may be revoked at any time by authorized Foundation leadership.
            </aside>
            <div className="cg19-letter-sign-block">
              <div className="cg19-letter-seal" aria-hidden="true">
                Official<br/>CareGanga<br/>Seal
              </div>
              <div className="cg19-letter-signatory">
                <strong>Super Admin / Operations</strong>
                <span>CareGanga Foundation</span>
                <small style={{display:"block",color:"#64748B"}}>Cryptographically Verified</small>
              </div>
            </div>
          </div>
          <footer className="cg19-letter-footer">
            Private document. Verify current access in CareGanga.
          </footer>
        </article>}

        <div className="permission-group">
          <strong>Approved template</strong>
          <p>{template?.configured&&template.status==="APPROVED"?
            "Version "+template.version+" is approved for private PDF issuance.":
            "No active approved template. PDF issuance is unavailable."}</p>
          {canIssue&&<div className="form">
            <label className="field">Letter heading
              <input value={title} maxLength={100} disabled={busy||unknown}
                onChange={e=>{setTitle(e.target.value);setReview(null);templateKey.current=""}}/>
            </label>
            <label className="field">Approved letter wording
              <textarea rows={4} value={body} maxLength={1200}
                disabled={busy||unknown}
                onChange={e=>{setBody(e.target.value);setReview(null);templateKey.current=""}}/>
            </label>
            <label className="field">Confirm Super Admin password for template approval
              <input type="password" autoComplete="current-password" minLength={8} maxLength={1024}
                value={templatePassword} disabled={busy||unknown}
                onChange={e=>{setTemplatePassword(e.target.value);
                  setReview(null);}}/>
            </label>
            {review==="TEMPLATE"&&<p role="status">
              Confirm approval of a new immutable template version.
              Previous letters remain private under their original versions.</p>}
            <button type="button" disabled={busy||unknown} onClick={()=>void approveTemplate()}>
              {review==="TEMPLATE"?"Confirm template approval":"Review template approval"}</button>
          </div>}
        </div>

        {canIssue&&<div className="permission-group">
          <strong>Issue verified access letter</strong>
          <p>Only a completed CG-01 approved-role effect can be confirmed.
            Issuance requires the current frozen application revision and
            a current password. No public QR will be generated.</p>
          <label className="field">Confirm Super Admin password
            <input type="password" autoComplete="current-password" minLength={8} maxLength={1024}
              value={issuePassword} disabled={busy||unknown}
              onChange={e=>{setIssuePassword(e.target.value);
                setReview(null);}}/>
          </label>
          {review==="ISSUE"&&<p role="status">
            Review this confirmed-grant issue request. Private storage and PDF
            validation must succeed before it is labelled issued.</p>}
          <button type="button" disabled={busy||unknown||
            !template?.configured||template.status!=="APPROVED"}
            onClick={()=>void issue()}>
            {review==="ISSUE"?"Confirm letter issue":"Review letter issue"}
          </button>
        </div>}

        <div className="role-table-wrap"><table className="role-table">
          <thead><tr><th>Issue</th><th>Template</th><th>Status</th>
            <th>Issued</th><th>Actions</th></tr></thead>
          <tbody>{letters.length?letters.map(item=><tr key={item.documentRef}>
            <td>Revision {item.issueRevision}</td>
            <td>Version {item.templateVersion}</td>
            <td>
              <span className={badgeClass(item.state)}>
                {label(item.state)}
              </span>
            </td>
            <td>{item.issuedAt?new Date(item.issuedAt).toLocaleString():"Not issued"}</td>
            <td><div className="toolbar">
              {item.canDownload&&<a href={"/api/documents/letters/"+
                encodeURIComponent(item.documentRef)+"/download"}>Download PDF</a>}
              {item.state==="ISSUED"&&<button type="button"
                onClick={()=>window.print()}>Print</button>}
              {item.canReconcile&&canIssue&&<button type="button" disabled={busy||unknown}
                onClick={()=>void reconcile(item.documentRef)}>Check issue</button>}
              {item.state==="ISSUED"&&canRevoke&&
                <button type="button" disabled={busy||unknown}
                  onClick={()=>{setRevokeRef(item.documentRef);setReview(null)}}>
                  Revoke</button>}
            </div></td>
          </tr>):<tr><td colSpan={5} className="cg-module-empty">No verified private letters issued for this application.</td></tr>}</tbody>
        </table></div>

        {revokeRef&&canRevoke&&<div className="permission-group">
          <strong>Revoke this confirmed private letter</strong>
          <p>Revoking prevents future authorized retrieval. The audit and
            original issued revision remain immutable.</p>
          <label className="field">Confirm Super Admin password
            <input type="password" autoComplete="current-password" minLength={8} maxLength={1024}
              value={revokePassword} disabled={busy||unknown}
              onChange={e=>{setRevokePassword(e.target.value);
                setReview(null);}}/>
          </label>
          {review==="REVOKE"&&<p role="status">Confirm permanent revoke for this
            issued revision. Reissuing creates a new auditable revision.</p>}
          <div className="toolbar">
            <button type="button" disabled={busy||unknown}
              onClick={()=>void revoke()}>{review==="REVOKE"?
                "Confirm revoke":"Review revocation"}</button>
            <button type="button" disabled={busy} onClick={()=>{
              setRevokeRef("");setRevokePassword("");setReview(null);}}>Cancel</button>
          </div>
        </div>}
        <button type="button" disabled={busy}
          onClick={()=>void refresh()}>Refresh verified letters</button>
      </>}
    </div>
  </section>;
}
