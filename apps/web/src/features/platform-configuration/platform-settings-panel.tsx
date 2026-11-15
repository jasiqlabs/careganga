"use client";
import {FormEvent,useCallback,useEffect,useRef,useState} from "react";
import type {
  CG21SettingView as Setting,
  CG21SettingRevision as History,
  CG21IntegrationView as Connection
} from "@careganga/api-contracts";
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
    k==="VALIDATION"?"Check the permitted values and enter a fresh authenticator code.":
    k==="RETRY_LATER"?"Too many verification attempts. Try again later.":
    "The outcome could not be confirmed. Check the previous change before retrying.";
};
export function PlatformSettingsPanel(){
  const [setting,setSetting]=useState<Setting|null>(null);
  const [history,setHistory]=useState<History[]>([]);
  const [connections,setConnections]=useState<Connection[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState<Notice|null>(null);
  const [edit,setEdit]=useState(false);
  const [review,setReview]=useState(false);
  const [pageSize,setPageSize]=useState("25");
  const [totp,setTotp]=useState("");
  const [unknown,setUnknown]=useState(false);
  const [formProvider,setFormProvider]=useState("");
  const [formPurpose,setFormPurpose]=useState("");
  const [formReference,setFormReference]=useState("");
  const [integrationTotp,setIntegrationTotp]=useState("");
  const [integrationEdit,setIntegrationEdit]=useState(false);
  const [integrationReview,setIntegrationReview]=useState(false);
  const [checking,setChecking]=useState("");
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
  useEffect(()=>{void reload();return()=>{++generation.current;};},[reload]);

  function begin(){
    if(!setting||unknown)return;
    pendingAction.current="SETTING_SAVE";requestKey.current=crypto.randomUUID();
    setPageSize(String(setting.value));setTotp("");setReview(false);
    setEdit(true);setNotice(null);
  }
  async function save(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(!setting||busy||unknown)return;
    const n=Number(pageSize);
    if(!/^\d+$/.test(pageSize)||!Number.isInteger(n)||n<10||n>100||
      n===setting.value){
      setNotice({kind:"error",message:"Choose a different whole-number page size between 10 and 100."});return;
    }
    if(!review){setReview(true);return;}
    if(!/^[0-9]{6}$/.test(totp)){
      setNotice({kind:"error",message:"Enter a fresh six-digit authenticator code."});return;
    }
    setBusy(true);setNotice(null);
    try{
      const ack=await request<{revision:number}>("settings","PATCH",{
        key:"audit.default_page_size",value:n,expectedRevision:setting.revision,
        requestKey:requestKey.current,totp
      });
      if(!Number.isInteger(ack.revision))throw Error("UNCONFIRMED");
      setEdit(false);setReview(false);setTotp("");
      const verified=await reload(ack.revision);
      if(!verified)setUnknown(true);
      setNotice(verified
        ?{kind:"success",message:"Platform setting saved and the effective revision verified."}
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
        if(ok){setEdit(false);setIntegrationEdit(false);setFormReference("");}
      }else{
        setNotice({kind:"uncertain",message:"No committed result is visible. Contact Foundation support before retrying."});
      }
    }catch(e){setNotice({kind:"uncertain",message:message(e)});}
    finally{setBusy(false);}
  }
  function startIntegration(row?:Connection){
    if(unknown)return;
    pendingAction.current="INTEGRATION_REFERENCE";pendingConnection.current=null;
    requestKey.current=crypto.randomUUID();
    setFormProvider(row?.provider??"");setFormPurpose(row?.purpose??"");
    setFormReference("");setIntegrationTotp("");setIntegrationReview(false);
    setIntegrationEdit(true);setNotice(null);
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
    if(!/^[0-9]{6}$/.test(integrationTotp)){
      setNotice({kind:"error",message:"Enter a fresh authenticator code."});return;
    }
    setBusy(true);setNotice(null);
    const existing=connections.find(x=>x.provider===provider&&x.purpose===purpose);
    pendingConnection.current={provider,purpose};
    try{
      const result=await request<{revision:number}>("integrations","POST",{
        provider,purpose,secretReference:formReference,
        expectedRevision:existing?.revision??0,requestKey:requestKey.current,totp:integrationTotp
      });
      if(!Number.isInteger(result.revision))throw Error("UNCONFIRMED");
      const ok=await reload(undefined,{provider,purpose,revision:result.revision});
      if(!ok){setUnknown(true);setNotice({kind:"uncertain",message:
        "Reference was saved but its current revision could not be verified. Check the previous change."});}
      else{
        requestKey.current="";setFormReference("");setIntegrationTotp("");
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

  return <div className="role-workspace">
    <header className="topbar">
      <div><h1>General Settings</h1>
        <p>System Settings &amp; Governance · Foundation operations</p></div>
      <div className="toolbar"><button type="button" disabled={loading||busy||unknown}
        onClick={()=>void reload()}>Refresh verified settings</button></div>
    </header>
    {notice&&<p role={notice.kind==="success"?"status":"alert"} className={"notice "+notice.kind}>
      {notice.message}</p>}
    {unknown&&<section className="permission-group" role="alert">
      <strong>Previous change needs verification</strong>
      <p>Do not submit the same change again until its outcome is confirmed.</p>
      <button type="button" disabled={busy} onClick={()=>void checkOutcome()}>
        {busy?"Checking…":"Check previous change"}</button>
    </section>}
    {loading?<p role="status">Verifying Foundation configuration…</p>:setting&&<>
      <section className="role-pane" aria-label="System parameters">
        <div className="role-pane-heading"><div><h2>System Parameters</h2>
          <p>Operational defaults managed by the Foundation</p></div>
          <button type="button" disabled={busy||unknown||edit} onClick={begin}>Edit setting</button></div>
        <div className="role-detail-content"><p>Default audit page size</p>
          <strong>{setting.value} records per page</strong>
          <p>Server safety limit: 100 records per request</p>
          <p>Current revision: {setting.revision}
            {setting.updatedAt?" · "+new Date(setting.updatedAt).toLocaleString():" · Secure default"}</p>
        </div>
      </section>
      <section className="role-pane" aria-labelledby="config-history-title">
        <div className="role-pane-heading"><h2 id="config-history-title">Setting change history</h2></div>
        <div className="role-detail-content">
          {!history.length?<p>No saved changes yet. The secure default is in effect.</p>:
            <ul>{history.map(h=><li key={h.revision}>
              Revision {h.revision}: {h.value} records · {h.changedBy} ·
              {new Date(h.changedAt).toLocaleString()}</li>)}</ul>}
        </div>
      </section>
      <section className="role-pane" aria-label="Integrations">
        <div className="role-pane-heading"><div><h2>API &amp; Integrations</h2>
          <p>Secured references and verified provider readiness</p></div>
          <button type="button" disabled={busy||unknown} onClick={()=>startIntegration()}>
            Add reference</button></div>
        <div className="role-detail-content">
          {!connections.length?<p>No integration references configured. Optional providers remain unavailable.</p>:
            connections.map(c=><div className="permission-group" key={c.provider+"/"+c.purpose}>
              <strong>{label(c.provider)} · {label(c.purpose)}</strong>
              <p>{c.status==="CONFIGURED_NOT_VERIFIED"?"Configured, not verified":
                c.status==="VERIFIED"?"Verified at last check":
                c.status==="FAILED"?"Verification failed":"Verification unavailable"}</p>
              <p>Credential revision {c.credentialRevision}
                {c.lastCheckedAt?" · Checked "+new Date(c.lastCheckedAt).toLocaleString():" · Not checked"}</p>
              <div className="toolbar"><button type="button" disabled={busy||unknown}
                onClick={()=>startIntegration(c)}>Rotate reference</button>
                <button type="button" disabled={busy||unknown||!!checking}
                  onClick={()=>void checkIntegration(c.provider,c.purpose)}>
                  {checking===c.provider+"/"+c.purpose?"Checking…":"Check readiness"}</button>
              </div>
            </div>)}
        </div>
      </section>
    </>}
    {edit&&setting&&<div className="drawer-backdrop" role="presentation">
      <section className="role-drawer" role="dialog" aria-modal="true"
        aria-labelledby="platform-setting-title">
        <header className="topbar"><h2 id="platform-setting-title">Edit Platform Setting</h2>
          <button type="button" disabled={busy} onClick={()=>{setEdit(false);setReview(false);}}>Close</button></header>
        <form className="form" onSubmit={e=>void save(e)}>
          <label className="field">Audit history records per page
            <input type="number" min={10} max={100} step={1} required value={pageSize}
              onChange={e=>{setPageSize(e.target.value);setReview(false);}}/>
          </label>
          <p>Default 25. Enter a whole number between 10 and 100.</p>
          <label className="field">Fresh authenticator code
            <input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
              autoComplete="one-time-code" value={totp}
              onChange={e=>{setTotp(e.target.value.replace(/[^0-9]/g,""));setReview(false);}}/>
          </label>
          {review&&<p role="status">Confirm changing the default audit page size.
            The change creates a permanent configuration history entry.</p>}
          <div className="toolbar"><button type="button" disabled={busy}
            onClick={()=>setEdit(false)}>Cancel</button>
            <button className="primary" disabled={busy||unknown} type="submit">
              {busy?"Saving…":review?"Confirm and save":"Review change"}</button></div>
        </form>
      </section>
    </div>}
    {integrationEdit&&<div className="drawer-backdrop" role="presentation">
      <section className="role-drawer" role="dialog" aria-modal="true"
        aria-labelledby="integration-title">
        <header className="topbar"><h2 id="integration-title">Secured integration reference</h2>
          <button type="button" disabled={busy} onClick={()=>setIntegrationEdit(false)}>Close</button></header>
        <form className="form" onSubmit={e=>void saveIntegration(e)}>
          <p>Store only a reference to a credential held in a separate secured store.
            No provider verification or payment/message action occurs when you save.</p>
          <label className="field">Provider label
            <input required maxLength={63} pattern="[a-z][a-z0-9_-]{1,62}"
              value={formProvider} onChange={e=>{setFormProvider(e.target.value);setIntegrationReview(false);}}/>
          </label>
          <label className="field">Purpose label
            <input required maxLength={63} pattern="[a-z][a-z0-9_-]{1,62}"
              value={formPurpose} onChange={e=>{setFormPurpose(e.target.value);setIntegrationReview(false);}}/>
          </label>
          <label className="field">Secret-manager reference
            <input required autoComplete="off" maxLength={240} type="password"
              placeholder="secretref:..." value={formReference}
              onChange={e=>{setFormReference(e.target.value);setIntegrationReview(false);}}/>
          </label>
          <label className="field">Fresh authenticator code
            <input required maxLength={6} pattern="[0-9]{6}" inputMode="numeric"
              autoComplete="one-time-code" value={integrationTotp}
              onChange={e=>{setIntegrationTotp(e.target.value.replace(/[^0-9]/g,""));setIntegrationReview(false);}}/>
          </label>
          {integrationReview&&<p role="status">Confirm this reference update. Existing verification
            status will be invalidated, and no secret value is displayed after saving.</p>}
          <div className="toolbar"><button type="button" disabled={busy}
            onClick={()=>setIntegrationEdit(false)}>Cancel</button>
            <button type="submit" className="primary" disabled={busy||unknown}>
              {busy?"Saving…":integrationReview?"Confirm reference":"Review reference"}</button></div>
        </form>
      </section>
    </div>}
  </div>;
}
