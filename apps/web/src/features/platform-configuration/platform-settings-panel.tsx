"use client";
import "./general-settings.css";
import {FormEvent,useCallback,useEffect,useRef,useState} from "react";
import {motion,AnimatePresence,useReducedMotion} from "framer-motion";
import type {
  CG21SettingView as Setting,
  CG21SettingRevision as History,
  CG21IntegrationView as Connection
} from "@careganga/api-contracts";
import {
  SlidersIcon,
  HistoryIcon,
  PlugIcon,
  MessageSquareIcon,
  RefreshCwIcon,
  PencilIcon,
  CheckIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
  AlertTriangleIcon,
  EyeIcon,
  EyeOffIcon,
  XIcon,
  LayersIcon,
  ChevronRightIcon,
  KeyIcon,
  InfoIcon
} from "./general-settings-icons";

type Notice={kind:"success"|"error"|"uncertain";message:string};
const label=(v:string)=>v.replace(/[_-]+/g," ").replace(/\b\w/g,c=>c.toUpperCase());
const referencePattern=/^secretref:[A-Za-z0-9/_-]{10,230}$/;

async function request<T>(path:string,method="GET",payload?:object):Promise<T>{
  let response:Response;
  try{
    response=await fetch("/api/platform/"+path,{
      method,credentials:"same-origin",cache:"no-store",
      ...(payload?{headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)}:{})
    });
  }catch{throw Error("UNCONFIRMED");}
  if(!response.ok){
    if(response.status===401||response.status===403)throw Error("ACCESS_DENIED");
    if(response.status===409)throw Error("CONFLICT");
    if(response.status===400)throw Error("VALIDATION");
    if(response.status===429)throw Error("RETRY_LATER");
    throw Error("UNCONFIRMED");
  }
  try{return await response.json() as T;}catch{throw Error("UNCONFIRMED");}
}

function isSetting(x:unknown):x is Setting{
  if(!x||typeof x!=="object"||Array.isArray(x))return false;
  const s=x as Record<string,unknown>;
  return s.key==="audit.default_page_size"&&Number.isInteger(s.value)&&
    Number(s.value)>=10&&Number(s.value)<=100&&Number.isInteger(s.revision)&&
    Number(s.revision)>=0&&(s.updatedAt===null||typeof s.updatedAt==="string");
}

const message=(e:unknown)=>{
  const k=e instanceof Error?e.message:"UNCONFIRMED";
  return k==="CONFLICT"?"This setting changed elsewhere. Refresh before saving.":
    k==="ACCESS_DENIED"?"Your Foundation access is no longer verified. Sign in again.":
    k==="VALIDATION"?"Check the permitted values and enter a fresh current password.":
    k==="RETRY_LATER"?"Too many verification attempts. Try again later.":
    "The outcome could not be confirmed. Check the previous change before retrying.";
};

export type PlatformSettingsPanelProps = {
  canEdit?: boolean;
};

export function PlatformSettingsPanel({ canEdit = false }: PlatformSettingsPanelProps){
  const [setting,setSetting]=useState<Setting|null>(null);
  const [history,setHistory]=useState<History[]>([]);
  const [connections,setConnections]=useState<Connection[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState<Notice|null>(null);
  const [edit,setEdit]=useState(false);
  const [review,setReview]=useState(false);
  const [pageSize,setPageSize]=useState("25");
  const [pageSizeError,setPageSizeError]=useState<string|null>(null);
  const [currentPassword,setCurrentPassword]=useState("");
  const [showAuditPassword,setShowAuditPassword]=useState(false);
  const [unknown,setUnknown]=useState(false);
  const [formProvider,setFormProvider]=useState("");
  const [formPurpose,setFormPurpose]=useState("");
  const [formReference,setFormReference]=useState("");
  const [integrationPassword,setIntegrationPassword]=useState("");
  const [integrationEdit,setIntegrationEdit]=useState(false);
  const [integrationReview,setIntegrationReview]=useState(false);
  const [showIntegrationSecret,setShowIntegrationSecret]=useState(false);
  const [showIntegrationPassword,setShowIntegrationPassword]=useState(false);
  const [checking,setChecking]=useState("");
  const [activeTab,setActiveTab]=useState<"parameters"|"history"|"integrations"|"errors">("parameters");
  const prefersReducedMotion=useReducedMotion();
  const requestKey=useRef("");
  const pendingAction=useRef<"SETTING_SAVE"|"INTEGRATION_REFERENCE">("SETTING_SAVE");
  const pendingConnection=useRef<{provider:string;purpose:string}|null>(null);
  const generation=useRef(0);

  const reload=useCallback(async(expectedRevision?:number,
    expectedConnection?:{provider:string;purpose:string;revision:number}):Promise<boolean>=>{
    const seq=++generation.current;setLoading(true);
    try{
      const [s,h,c]=await Promise.all([
        request<unknown>("settings"),
        request<{events:History[]}>("settings/history?limit=20"),
        request<{connections:Connection[]}>("integrations")
      ]);
      if(!isSetting(s)||!Array.isArray(h.events)||!Array.isArray(c.connections))
        throw Error("UNCONFIRMED");
      if(seq!==generation.current)return false;
      setSetting(s);setHistory(h.events);setConnections(c.connections);
      setPageSize(String(s.value));
      const matchedSetting=expectedRevision===undefined||s.revision>=expectedRevision;
      const savedConnection=expectedConnection?c.connections.find(x=>
        x.provider===expectedConnection.provider&&x.purpose===expectedConnection.purpose):null;
      const matchedConnection=!expectedConnection||
        (savedConnection!==null&&savedConnection!==undefined&&
          savedConnection.revision>=expectedConnection.revision);
      const matched=matchedSetting&&matchedConnection;
      if(matched&&(expectedRevision!==undefined||expectedConnection!==undefined)){
        setUnknown(false);requestKey.current="";
      }
      return matched;
    }catch(e){
      if(seq!==generation.current)return false;
      setSetting(null);setHistory([]);setConnections([]);
      setNotice({kind:"error",message:message(e)});
      return false;
    }finally{if(seq===generation.current)setLoading(false);}
  },[]);

  useEffect(()=>{
    void reload();
    return()=>{++generation.current;};
  },[reload]);

  useEffect(()=>{
    function handleKeyDown(e:KeyboardEvent){
      if(e.key==="Escape"){
        if(edit&&!busy){setEdit(false);setReview(false);setPageSizeError(null);}
        if(integrationEdit&&!busy)setIntegrationEdit(false);
      }
    }
    window.addEventListener("keydown",handleKeyDown);
    return()=>window.removeEventListener("keydown",handleKeyDown);
  },[edit,integrationEdit,busy]);

  function handleTabClick(tab:"parameters"|"history"|"integrations"|"errors"){
    setActiveTab(tab);
    if(tab==="errors"){
      const errorSection=document.getElementById("error-messages-section");
      if(errorSection){
        errorSection.scrollIntoView({behavior:prefersReducedMotion?"auto":"smooth",block:"start"});
      }
      return;
    }
    const targetId=
      tab==="parameters"?"system-parameters-section":
      tab==="history"?"setting-history-section":
      "api-integrations-section";
    const el=document.getElementById(targetId);
    if(el){
      el.scrollIntoView({behavior:prefersReducedMotion?"auto":"smooth",block:"start"});
    }
  }

  function begin(){
    if(!setting||unknown||busy||integrationEdit||!canEdit)return;
    pendingAction.current="SETTING_SAVE";requestKey.current=crypto.randomUUID();
    setPageSize(String(setting.value));setPageSizeError(null);
    setCurrentPassword("");setShowAuditPassword(false);setReview(false);
    setEdit(true);setNotice(null);
  }

  function cancelEdit(){
    if(busy)return;
    setEdit(false);setReview(false);setCurrentPassword("");setPageSizeError(null);
    if(setting)setPageSize(String(setting.value));
  }

  function handlePageSizeChange(val:string){
    setPageSize(val);setReview(false);
    const trimmed=val.trim();
    if(trimmed===""){
      setPageSizeError("Required field — enter a whole number between 10 and 100.");
      return;
    }
    if(!/^\d+$/.test(trimmed)){
      setPageSizeError("Numeric whole numbers only.");
      return;
    }
    const n=Number(trimmed);
    if(n<10){
      setPageSizeError("Minimum is 10 records per page.");
      return;
    }
    if(n>100){
      setPageSizeError("Maximum is 100 records per page.");
      return;
    }
    setPageSizeError(null);
  }

  async function save(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(!setting||busy||unknown||!canEdit)return;
    const n=Number(pageSize.trim());
    if(!/^\d+$/.test(pageSize.trim())||!Number.isInteger(n)||n<10||n>100||n===setting.value){
      setNotice({kind:"error",message:"Choose a different whole-number page size between 10 and 100."});
      setPageSizeError("Choose a different whole-number page size between 10 and 100.");
      return;
    }
    if(!review){setReview(true);return;}
    if(currentPassword.length<8||currentPassword.length>1024){
      setNotice({kind:"error",message:"Enter a fresh current password (at least 8 characters)."});
      return;
    }
    setBusy(true);setNotice(null);
    try{
      const ack=await request<{revision:number}>("settings","PATCH",{
        key:"audit.default_page_size",value:n,expectedRevision:setting.revision,
        requestKey:requestKey.current,currentPassword
      });
      if(!Number.isInteger(ack.revision))throw Error("UNCONFIRMED");
      setEdit(false);setReview(false);setCurrentPassword("");setPageSizeError(null);
      const verified=await reload(ack.revision);
      if(!verified)setUnknown(true);
      setNotice(verified
        ?{kind:"success",message:`Audit Default Page Size updated to ${n} (revision ${ack.revision}) successfully.`}
        :{kind:"uncertain",message:"The write was acknowledged but could not be reread. Check the previous change."});
    }catch(err){
      if(err instanceof Error&&err.message==="UNCONFIRMED")setUnknown(true);
      setNotice({kind:"error",message:message(err)});
    }finally{setBusy(false);}
  }

  async function checkOutcome(){
    if(!unknown||!requestKey.current||busy)return;
    setBusy(true);
    try{
      const result=await request<{status:string;revision:number|null}>(
        "changes/"+pendingAction.current+"/"+encodeURIComponent(requestKey.current));
      if(result.status==="CONFIRMED"&&Number.isInteger(result.revision)){
        const ref=pendingConnection.current;
        const ok=pendingAction.current==="SETTING_SAVE"
          ?await reload(Number(result.revision))
          :ref?await reload(undefined,{...ref,revision:Number(result.revision)}):false;
        if(!ok)setUnknown(true);
        setNotice(ok?{kind:"success",message:"Previously submitted change confirmed."}:
          {kind:"uncertain",message:"Recorded change has not been reverified. Check again."});
        if(ok){setEdit(false);setIntegrationEdit(false);setFormReference("");setShowIntegrationSecret(false);setShowIntegrationPassword(false);}
      }else{
        setNotice({kind:"uncertain",message:"No committed result is visible. Contact Foundation support before retrying."});
      }
    }catch(e){setNotice({kind:"uncertain",message:message(e)});}
    finally{setBusy(false);}
  }

  function startIntegration(row?:Connection){
    if(unknown||busy||edit)return;
    pendingAction.current="INTEGRATION_REFERENCE";pendingConnection.current=null;
    requestKey.current=crypto.randomUUID();
    setFormProvider(row?.provider??"");setFormPurpose(row?.purpose??"");
    setFormReference("");setIntegrationPassword("");
    setShowIntegrationSecret(false);setShowIntegrationPassword(false);
    setIntegrationReview(false);
    setIntegrationEdit(true);setNotice(null);
  }

  function cancelIntegration(){
    if(busy)return;
    setIntegrationEdit(false);setIntegrationReview(false);
    setFormReference("");setIntegrationPassword("");
    setShowIntegrationSecret(false);setShowIntegrationPassword(false);
  }

  async function saveIntegration(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(busy||unknown)return;
    const provider=formProvider.trim().toLowerCase();
    const purpose=formPurpose.trim().toLowerCase();
    if(!/^[a-z][a-z0-9_-]{1,62}$/.test(provider)||
      !/^[a-z][a-z0-9_-]{1,62}$/.test(purpose)||
      !referencePattern.test(formReference)){
      setNotice({kind:"error",message:
        "Enter a valid provider, purpose and secured reference. Do not enter a password or token."});return;
    }
    if(!integrationReview){setIntegrationReview(true);return;}
    if((integrationPassword.length<8||integrationPassword.length>1024)){
      setNotice({kind:"error",message:"Enter a fresh current password."});return;
    }
    setBusy(true);setNotice(null);
    const existing=connections.find(x=>x.provider===provider&&x.purpose===purpose);
    pendingConnection.current={provider,purpose};
    try{
      const result=await request<{revision:number}>("integrations","POST",{
        provider,purpose,secretReference:formReference,
        expectedRevision:existing?.revision??0,requestKey:requestKey.current,currentPassword:integrationPassword
      });
      if(!Number.isInteger(result.revision))throw Error("UNCONFIRMED");
      const ok=await reload(undefined,{provider,purpose,revision:result.revision});
      if(!ok){setUnknown(true);setNotice({kind:"uncertain",message:
        "Reference was saved but its current revision could not be verified. Check the previous change."});}
      else{
        requestKey.current="";setFormReference("");setIntegrationPassword("");
        setShowIntegrationSecret(false);setShowIntegrationPassword(false);
        setIntegrationEdit(false);setNotice({kind:"success",message:
          "Reference saved. Provider verification has not been performed."});
      }
    }catch(e){
      if(e instanceof Error&&e.message==="UNCONFIRMED")setUnknown(true);
      setNotice({kind:"error",message:message(e)});
    }finally{setBusy(false);}
  }

  async function checkIntegration(provider:string,purpose:string){
    if(busy||unknown)return;
    setChecking(provider+"/"+purpose);
    try{
      const result=await request<{status:string;verified:boolean}>(
        "integrations/"+encodeURIComponent(provider)+"/"+encodeURIComponent(purpose)+"/check","POST");
      setNotice({kind:result.verified?"success":"uncertain",message:result.verified?
        "This integration was independently verified.":
        result.status==="NOT_CONFIGURED"?"No integration reference exists.":
        "Verification is unavailable. No provider connection was claimed."});
    }catch(e){setNotice({kind:"error",message:message(e)});}
    finally{setChecking("");}
  }

  return (
    <div className="cg-gs-container">
      {/* Page Header */}
      <header className="cg-gs-header">
        <div className="cg-gs-header-left">
          <div className="cg-gs-title-row">
            <h1 className="cg-gs-title">General Settings</h1>
            <span className="cg-gs-verified-badge" title="Verified Foundation Control Panel">
              <CheckIcon size={12} />
            </span>
          </div>
          <p className="cg-gs-subtitle">System Settings &amp; Governance · Foundation operations</p>
        </div>
        <div className="cg-gs-header-actions">
          <button
            type="button"
            className="cg-gs-btn-refresh"
            disabled={loading || busy || unknown || edit || integrationEdit}
            onClick={() => void reload()}
            title="Refresh verified settings"
          >
            <RefreshCwIcon size={16} className={loading ? "cg-gs-spin" : undefined} />
            <span>Refresh</span>
          </button>
        </div>
      </header>

      {/* Section Navigation Tabs */}
      <nav className="cg-gs-nav-tabs" aria-label="Settings section navigation" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "parameters"}
          className={`cg-gs-tab-btn ${activeTab === "parameters" ? "is-active" : ""}`}
          onClick={() => handleTabClick("parameters")}
        >
          <SlidersIcon size={16} />
          <span>System Parameters</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "history"}
          className={`cg-gs-tab-btn ${activeTab === "history" ? "is-active" : ""}`}
          onClick={() => handleTabClick("history")}
        >
          <HistoryIcon size={16} />
          <span>Revision History</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "integrations"}
          className={`cg-gs-tab-btn ${activeTab === "integrations" ? "is-active" : ""}`}
          onClick={() => handleTabClick("integrations")}
        >
          <PlugIcon size={16} />
          <span>API &amp; Integrations</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "errors"}
          className={`cg-gs-tab-btn ${activeTab === "errors" ? "is-active" : ""}`}
          onClick={() => handleTabClick("errors")}
        >
          <MessageSquareIcon size={16} />
          <span>Error Messages</span>
        </button>
      </nav>

      {/* Notices */}
      {notice && (
        <div
          role={notice.kind === "success" ? "status" : "alert"}
          className={`cg-gs-banner cg-gs-banner-${notice.kind}`}
        >
          <span className="cg-gs-banner-icon">
            {notice.kind === "success" && <CheckCircle2Icon size={18} />}
            {notice.kind === "error" && <AlertCircleIcon size={18} />}
            {notice.kind === "uncertain" && <AlertTriangleIcon size={18} />}
          </span>
          <div className="cg-gs-banner-content">{notice.message}</div>
        </div>
      )}

      {/* Recovery Banner for Uncertain State */}
      {unknown && (
        <section className="cg-gs-recovery-banner" role="alert" aria-live="polite">
          <div className="cg-gs-recovery-text">
            <strong>Previous change needs verification</strong>
            <p>Do not submit the same change again until its outcome is confirmed by the server.</p>
          </div>
          <button
            type="button"
            className="cg-gs-btn-check-recovery"
            disabled={busy}
            onClick={() => void checkOutcome()}
            aria-busy={busy}
          >
            {busy ? <RefreshCwIcon size={16} className="cg-gs-spin" /> : <RefreshCwIcon size={16} />}
            <span>{busy ? "Checking previous change…" : "Check previous change"}</span>
          </button>
        </section>
      )}

      {/* Main Content Area */}
      {loading ? (
        <p className="cg-module-loading" role="status">Verifying Foundation configuration…</p>
      ) : setting && (
        <>
          {/* Section 1: System Parameters Card */}
          <section
            className="cg-gs-card"
            id="system-parameters-section"
            aria-labelledby="system-parameters-heading"
          >
            <div className="cg-gs-card-header">
              <div className="cg-gs-card-header-left">
                <span className="cg-gs-card-icon-wrap">
                  <SlidersIcon size={18} />
                </span>
                <div className="cg-gs-card-title-group">
                  <h2 id="system-parameters-heading">System Parameters</h2>
                  <p>Operational defaults managed by the Foundation</p>
                </div>
              </div>
            </div>

            <div className="cg-gs-card-body">
              <div className="cg-gs-param-item-box">
                <div className="cg-gs-param-left">
                  <span className="cg-gs-param-icon-badge">
                    <LayersIcon size={22} />
                  </span>
                  <div className="cg-gs-param-meta">
                    <h3 className="cg-gs-param-name">Audit Default Page Size</h3>
                    <code className="cg-gs-param-key">{setting.key}</code>
                  </div>
                </div>

                <div className="cg-gs-param-center">
                  <span className="cg-gs-param-label">Current effective value</span>
                  <div className="cg-gs-param-value-row">
                    <span className="cg-gs-param-value-text">{setting.value} records per page</span>
                    <span className="cg-gs-pill-revision">Revision {setting.revision}</span>
                  </div>
                  <p className="cg-gs-param-subtext">
                    {setting.revision === 0
                      ? "Default value (no saved override exists) · Server safety limit: 100 records per request"
                      : `Updated: ${setting.updatedAt ? new Date(setting.updatedAt).toLocaleString() : "Recently"} · Server safety limit: 100 records per request`}
                  </p>
                </div>

                {canEdit && (
                  <button
                    type="button"
                    className="cg-gs-btn-edit"
                    disabled={busy || unknown || integrationEdit}
                    onClick={begin}
                    title="Edit Audit Default Page Size"
                  >
                    <PencilIcon size={14} />
                    <span>Edit</span>
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* Section 2: Setting Change History Card */}
          <section
            className="cg-gs-card"
            id="setting-history-section"
            aria-labelledby="setting-history-heading"
          >
            <div className="cg-gs-card-header">
              <div className="cg-gs-card-header-left">
                <span className="cg-gs-card-icon-wrap">
                  <HistoryIcon size={18} />
                </span>
                <div className="cg-gs-card-title-group">
                  <h2 id="setting-history-heading">Setting Change History</h2>
                  <p>Immutable audit trail of versioned configuration changes</p>
                </div>
              </div>
            </div>

            <div className="cg-gs-card-body">
              {!history.length ? (
                <p className="cg-module-empty" role="status">
                  No saved changes yet. The secure default is in effect.
                </p>
              ) : (
                <>
                  {/* Desktop / Tablet Table */}
                  <div className="cg-gs-table-wrap">
                    <table className="cg-gs-table" aria-label="Setting change history">
                      <thead>
                        <tr>
                          <th scope="col">Revision</th>
                          <th scope="col">Setting Key</th>
                          <th scope="col">Previous Value</th>
                          <th scope="col">New Value</th>
                          <th scope="col">Changed By</th>
                          <th scope="col">Timestamp</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.map((h, index) => {
                          const prevItem = history.find((p) => p.revision === h.revision - 1);
                          const prevValueText =
                            h.revision === 1
                              ? "25 records per page"
                              : prevItem
                                ? `${prevItem.value} records per page`
                                : "—";
                          const isLatest = index === 0;
                          return (
                            <tr key={h.revision}>
                              <td>
                                <span className={`cg-gs-table-rev-pill ${isLatest ? "is-latest" : "is-muted"}`}>
                                  Revision {h.revision}
                                </span>
                              </td>
                              <td>
                                <code className="cg-gs-table-key-code">
                                  {setting?.key ?? "audit.default_page_size"}
                                </code>
                              </td>
                              <td>
                                <span className="cg-gs-table-prev-value">{prevValueText}</span>
                              </td>
                              <td>
                                <span className="cg-gs-table-new-value">{h.value} records per page</span>
                              </td>
                              <td>{h.changedBy}</td>
                              <td>
                                <span className="cg-gs-table-timestamp">
                                  {new Date(h.changedAt).toLocaleString()}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Cards List */}
                  <div className="cg-gs-history-cards-list" aria-label="Setting change history mobile view">
                    {history.map((h, index) => {
                      const prevItem = history.find((p) => p.revision === h.revision - 1);
                      const prevValueNum = h.revision === 1 ? 25 : prevItem?.value;
                      const isLatest = index === 0;
                      return (
                        <div key={h.revision} className="cg-gs-history-card-item">
                          <div className="cg-gs-history-card-left">
                            <span className={`cg-gs-table-rev-pill ${isLatest ? "is-latest" : "is-muted"}`}>
                              Rev {h.revision}
                            </span>
                            <span className="cg-gs-history-card-transition">
                              {prevValueNum !== undefined ? `${prevValueNum} → ` : ""}{h.value} records
                            </span>
                          </div>
                          <div className="cg-gs-history-card-right">
                            <span className="cg-gs-history-card-time">
                              {new Date(h.changedAt).toLocaleDateString()} {new Date(h.changedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                            <ChevronRightIcon size={14} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </section>

          {/* Section 3: API & Integrations */}
          <section className="cg-gs-card" id="api-integrations-section" aria-label="API & Integrations">
            <div className="cg-gs-card-header">
              <div className="cg-gs-card-header-left">
                <div className="cg-gs-card-icon-wrap">
                  <PlugIcon size={18} />
                </div>
                <div className="cg-gs-card-title-group">
                  <h2>API &amp; Integrations</h2>
                  <p>Secured references and verified provider readiness</p>
                </div>
              </div>
              <button
                type="button"
                className="cg-gs-btn-primary"
                style={{ height: "2.125rem", fontSize: "0.8125rem", padding: "0 0.875rem" }}
                disabled={busy || unknown || edit || integrationEdit || !canEdit}
                onClick={() => startIntegration()}
              >
                + Add reference
              </button>
            </div>
            <div className="cg-gs-card-body">
              {!connections.length ? (
                <div className="cg-gs-empty-state" role="status">
                  <PlugIcon size={32} className="cg-gs-empty-icon" />
                  <p className="cg-gs-empty-title">No integration references configured</p>
                  <p className="cg-gs-empty-desc">
                    Optional providers remain unavailable until a secured reference is configured.
                  </p>
                </div>
              ) : (
                <div className="cg-gs-providers-grid">
                  {connections.map(c => {
                    const statusText =
                      c.status === "CONFIGURED_NOT_VERIFIED"
                        ? "Not Configured"
                        : c.status === "VERIFIED"
                          ? "Verified"
                          : c.status === "FAILED"
                            ? "Failed"
                            : "Unavailable";
                    const statusClass =
                      c.status === "CONFIGURED_NOT_VERIFIED"
                        ? "is-not-verified"
                        : c.status === "VERIFIED"
                          ? "is-verified"
                          : c.status === "FAILED"
                            ? "is-failed"
                            : "is-unavailable";
                    const statusDetail =
                      c.status === "CONFIGURED_NOT_VERIFIED"
                        ? "Configured, not verified"
                        : c.status === "VERIFIED"
                          ? "Verified at last check"
                          : c.status === "FAILED"
                            ? "Verification failed"
                            : "Verification unavailable";
                    const isCheckingThis = checking === c.provider + "/" + c.purpose;

                    return (
                      <div className="cg-gs-provider-card" key={c.provider + "/" + c.purpose}>
                        <div className="cg-gs-provider-top">
                          <div className="cg-gs-provider-left">
                            <div className="cg-gs-provider-icon-wrap">
                              <MessageSquareIcon size={18} />
                            </div>
                            <div className="cg-gs-provider-title-group">
                              <h3>{label(c.provider)} — {label(c.purpose)}</h3>
                              <p>{statusDetail}</p>
                            </div>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.25rem" }}>
                            <span className="cg-gs-pill-revision">Rev {c.credentialRevision}</span>
                            <span className={`cg-gs-status-badge ${statusClass}`}>{statusText}</span>
                          </div>
                        </div>

                        <div className="cg-gs-provider-meta">
                          {c.lastCheckedAt
                            ? `Last checked: ${new Date(c.lastCheckedAt).toLocaleDateString()} ${new Date(c.lastCheckedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                            : "Last checked: Not checked yet"}
                        </div>

                        <div className="cg-gs-provider-actions">
                          <button
                            type="button"
                            className="cg-gs-provider-btn"
                            disabled={busy || unknown || edit || integrationEdit || !canEdit}
                            onClick={() => startIntegration(c)}
                          >
                            <RefreshCwIcon size={14} />
                            <span>Rotate reference</span>
                          </button>
                          <button
                            type="button"
                            className="cg-gs-provider-btn"
                            disabled={busy || unknown || Boolean(checking)}
                            onClick={() => void checkIntegration(c.provider, c.purpose)}
                          >
                            {isCheckingThis ? (
                              <>
                                <RefreshCwIcon size={14} className="cg-gs-spin" />
                                <span>Checking…</span>
                              </>
                            ) : (
                              <>
                                <CheckIcon size={14} />
                                <span>Check readiness</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {/* Slide-out Right Drawer: Update Audit Page Size */}
      <AnimatePresence>
        {edit && (
          <motion.div
            className="cg-gs-drawer-backdrop"
            role="presentation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
            onClick={(e) => {
              if (e.target === e.currentTarget && !busy) cancelEdit();
            }}
          >
            <motion.section
              className="cg-gs-drawer"
              role="dialog"
              aria-modal="true"
              aria-labelledby="audit-page-size-drawer-title"
              initial={prefersReducedMotion ? { x: 0 } : { x: "100%" }}
              animate={{ x: 0 }}
              exit={prefersReducedMotion ? { x: 0 } : { x: "100%" }}
              transition={prefersReducedMotion ? { duration: 0 } : { type: "tween", duration: 0.25, ease: "easeOut" }}
            >
              <header className="cg-gs-drawer-header">
                <div className="cg-gs-drawer-header-left">
                  <div className="cg-gs-drawer-icon-wrap">
                    <SlidersIcon size={18} />
                  </div>
                  <div className="cg-gs-drawer-title-wrap">
                    <h2 id="audit-page-size-drawer-title" className="cg-gs-drawer-title">
                      Update Audit Page Size
                    </h2>
                    <p className="cg-gs-drawer-desc">
                      Configure default pagination limit for system audit events
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="cg-gs-btn-close-drawer"
                  disabled={busy}
                  onClick={cancelEdit}
                  aria-label="Close drawer"
                  title="Close drawer (Esc)"
                >
                  <XIcon size={18} />
                </button>
              </header>

              <form className="cg-gs-drawer-form" onSubmit={e => void save(e)} noValidate>
                <div className="cg-gs-drawer-content">
                  <div className="cg-gs-form-group">
                    <div className="cg-gs-form-label-row">
                      <label className="cg-gs-label" htmlFor="audit-page-size-input">
                        New page size (10 - 100) *
                      </label>
                      <span className="cg-gs-badge-subtle">System Limit</span>
                    </div>
                    <div className="cg-gs-input-wrap">
                      <input
                        id="audit-page-size-input"
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        value={pageSize}
                        disabled={busy}
                        onChange={e => handlePageSizeChange(e.target.value)}
                        aria-invalid={Boolean(pageSizeError)}
                        aria-describedby={pageSizeError ? "audit-page-size-error" : "audit-page-size-help"}
                        className="cg-gs-input"
                      />
                    </div>
                    {pageSizeError ? (
                      <p id="audit-page-size-error" role="alert" className="cg-gs-field-error">
                        {pageSizeError}
                      </p>
                    ) : (
                      <p id="audit-page-size-help" className="cg-gs-helper-text">
                        Enter a whole number between 10 and 100. Default is 25 records.
                      </p>
                    )}
                  </div>

                  <div className="cg-gs-form-group">
                    <label className="cg-gs-label" htmlFor="current-password-input">
                      Current password *
                    </label>
                    <div className="cg-gs-input-wrap">
                      <input
                        id="current-password-input"
                        required
                        type={showAuditPassword ? "text" : "password"}
                        minLength={8}
                        maxLength={1024}
                        autoComplete="current-password"
                        value={currentPassword}
                        disabled={busy}
                        onChange={e => setCurrentPassword(e.target.value)}
                        placeholder="Enter your current password"
                        className="cg-gs-input cg-gs-input-with-toggle"
                      />
                      <button
                        type="button"
                        className="cg-gs-btn-toggle-password"
                        onClick={() => setShowAuditPassword(!showAuditPassword)}
                        aria-label={showAuditPassword ? "Hide password" : "Show password"}
                        title={showAuditPassword ? "Hide password" : "Show password"}
                      >
                        {showAuditPassword ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                      </button>
                    </div>
                    <p className="cg-gs-helper-text">
                      Required for privileged Foundation configuration changes.
                    </p>
                  </div>
                </div>

                <footer className="cg-gs-drawer-footer">
                  <button
                    type="button"
                    className="cg-gs-btn-cancel"
                    disabled={busy}
                    onClick={cancelEdit}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="cg-gs-btn-primary"
                    disabled={busy || unknown || Boolean(pageSizeError) || !pageSize.trim() || currentPassword.length < 8}
                  >
                    {busy ? <RefreshCwIcon size={16} className="cg-gs-spin" /> : <CheckIcon size={16} />}
                    <span>{busy ? "Saving…" : "Save Changes"}</span>
                  </button>
                </footer>
              </form>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slide-out Drawer: Secured Integration Reference */}
      <AnimatePresence>
        {integrationEdit && (
          <motion.div
            className="cg-gs-drawer-backdrop"
            role="presentation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
            onClick={e => {
              if (e.target === e.currentTarget && !busy) cancelIntegration();
            }}
          >
            <motion.section
              className="cg-gs-drawer"
              role="dialog"
              aria-modal="true"
              aria-labelledby="integration-title"
              initial={prefersReducedMotion ? { x: 0 } : { x: "100%" }}
              animate={{ x: 0 }}
              exit={prefersReducedMotion ? { x: 0 } : { x: "100%" }}
              transition={prefersReducedMotion ? { duration: 0 } : { type: "tween", duration: 0.25, ease: "easeOut" }}
            >
              <header className="cg-gs-drawer-header">
                <div className="cg-gs-drawer-header-left">
                  <div className="cg-gs-drawer-icon-wrap">
                    <KeyIcon size={18} />
                  </div>
                  <div className="cg-gs-drawer-title-wrap">
                    <h2 id="integration-title" className="cg-gs-drawer-title">
                      Secured Integration Reference
                    </h2>
                    <p className="cg-gs-drawer-desc">
                      Store only a reference held in a secure vault
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="cg-gs-btn-close-drawer"
                  disabled={busy}
                  onClick={cancelIntegration}
                  aria-label="Close drawer"
                  title="Close drawer (Esc)"
                >
                  <XIcon size={18} />
                </button>
              </header>

              <form className="cg-gs-drawer-form" onSubmit={e => void saveIntegration(e)} noValidate>
                <div className="cg-gs-drawer-content">
                  {/* Security Policy Card */}
                  <div className="cg-gs-info-card">
                    <div className="cg-gs-info-card-icon">
                      <InfoIcon size={18} />
                    </div>
                    <div className="cg-gs-info-card-body">
                      <h4 className="cg-gs-info-card-title">Secured Reference Policy</h4>
                      <p className="cg-gs-info-card-text">
                        Store only a reference to a credential held in a separate secured store.
                        No provider verification or payment/message action occurs when you save.
                      </p>
                    </div>
                  </div>

                  <div className="cg-gs-form-group">
                    <label htmlFor="integration-provider" className="cg-gs-label">
                      Provider label *
                    </label>
                    <div className="cg-gs-input-wrap">
                      <input
                        id="integration-provider"
                        required
                        maxLength={63}
                        pattern="[a-z][a-z0-9_-]{1,62}"
                        value={formProvider}
                        placeholder="e.g. test-sms-provider"
                        className="cg-gs-input"
                        onChange={e => {
                          setFormProvider(e.target.value);
                          setIntegrationReview(false);
                        }}
                      />
                    </div>
                    <p className="cg-gs-helper-text">
                      Lowercase alphanumeric with dashes/underscores (1–63 chars).
                    </p>
                  </div>

                  <div className="cg-gs-form-group">
                    <label htmlFor="integration-purpose" className="cg-gs-label">
                      Purpose label *
                    </label>
                    <div className="cg-gs-input-wrap">
                      <input
                        id="integration-purpose"
                        required
                        maxLength={63}
                        pattern="[a-z][a-z0-9_-]{1,62}"
                        value={formPurpose}
                        placeholder="e.g. transactional-sms"
                        className="cg-gs-input"
                        onChange={e => {
                          setFormPurpose(e.target.value);
                          setIntegrationReview(false);
                        }}
                      />
                    </div>
                    <p className="cg-gs-helper-text">
                      Functional purpose for this integration (1–63 chars).
                    </p>
                  </div>

                  <div className="cg-gs-form-group">
                    <label htmlFor="integration-reference" className="cg-gs-label">
                      Secret-manager reference *
                    </label>
                    <div className="cg-gs-input-wrap">
                      <input
                        id="integration-reference"
                        required
                        autoComplete="off"
                        maxLength={240}
                        type={showIntegrationSecret ? "text" : "password"}
                        placeholder="secretref:provider=vault-key"
                        value={formReference}
                        className="cg-gs-input cg-gs-input-with-toggle"
                        onChange={e => {
                          setFormReference(e.target.value);
                          setIntegrationReview(false);
                        }}
                      />
                      <button
                        type="button"
                        className="cg-gs-btn-toggle-password"
                        onClick={() => setShowIntegrationSecret(!showIntegrationSecret)}
                        aria-label={showIntegrationSecret ? "Hide secret reference" : "Show secret reference"}
                        title={showIntegrationSecret ? "Hide secret reference" : "Show secret reference"}
                      >
                        {showIntegrationSecret ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                      </button>
                    </div>
                    <p className="cg-gs-helper-text">
                      Format: <code>secretref:path</code>. Raw API keys or secrets are strictly forbidden.
                    </p>
                  </div>

                  <div className="cg-gs-form-group">
                    <label htmlFor="integration-current-password" className="cg-gs-label">
                      Current password *
                    </label>
                    <div className="cg-gs-input-wrap">
                      <input
                        id="integration-current-password"
                        required
                        maxLength={1024}
                        type={showIntegrationPassword ? "text" : "password"}
                        minLength={8}
                        autoComplete="current-password"
                        value={integrationPassword}
                        placeholder="Enter your current password"
                        className="cg-gs-input cg-gs-input-with-toggle"
                        onChange={e => {
                          setIntegrationPassword(e.target.value);
                          setIntegrationReview(false);
                        }}
                      />
                      <button
                        type="button"
                        className="cg-gs-btn-toggle-password"
                        onClick={() => setShowIntegrationPassword(!showIntegrationPassword)}
                        aria-label={showIntegrationPassword ? "Hide password" : "Show password"}
                        title={showIntegrationPassword ? "Hide password" : "Show password"}
                      >
                        {showIntegrationPassword ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                      </button>
                    </div>
                    <p className="cg-gs-helper-text">
                      Required for privileged Foundation configuration changes.
                    </p>
                  </div>

                  {integrationReview && (
                    <div className="cg-gs-notice-banner warning">
                      <AlertTriangleIcon size={16} />
                      <div>
                        <strong>Confirm reference update:</strong> Existing verification status will be invalidated, and no secret value is displayed after saving.
                      </div>
                    </div>
                  )}
                </div>

                <footer className="cg-gs-drawer-footer">
                  <button
                    type="button"
                    className="cg-gs-btn-cancel"
                    disabled={busy}
                    onClick={cancelIntegration}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="cg-gs-btn-primary"
                    disabled={
                      busy ||
                      unknown ||
                      !formProvider.trim() ||
                      !formPurpose.trim() ||
                      !formReference.trim() ||
                      integrationPassword.length < 8
                    }
                  >
                    {busy ? (
                      <>
                        <RefreshCwIcon size={16} className="cg-gs-spin" />
                        <span>Saving…</span>
                      </>
                    ) : (
                      <>
                        <CheckIcon size={16} />
                        <span>{integrationReview ? "Confirm reference" : "Review reference"}</span>
                      </>
                    )}
                  </button>
                </footer>
              </form>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
