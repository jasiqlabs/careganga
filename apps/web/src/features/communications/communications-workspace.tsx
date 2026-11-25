"use client";
import {useCallback,useEffect,useState} from "react";

type Option={value:string;label:string};
type Channel="IN_APP"|"EMAIL"|"SMS";
type Notice={noticeRef:string;title:string;body:string;priority:string;
  state:string;purpose:string;revision:number;audienceCount:number;
  audienceKind:string;channels:Channel[];targetHref:string|null;
  scheduledAt:string|null;expiresAt:string;createdAt:string};
type InboxItem={notificationRef:string;title:string;body:string;
  status:string;channel:Channel;receivedAt:string;read:boolean};
type Providers={channels:Array<{channel:string;state:string;configured:boolean}>};
type NoticeCounts={counts:Array<{channel:Channel;status:string;count:number}>};
type PhoneProof={hasNumber:boolean;verified:boolean;maskedContact:string|null;
  verifiedAt:string|null;providerConfigured:boolean};
type Alert={kind:"error"|"success"|"info";message:string};
type ClientEmailReference={code:string;title:string;owner:string;trigger:string;
  recipient:string;subject:string;body:string;attachmentRule:string;
  placeholders:string[];state:string;deliveryEnabled:false};

async function req<T>(path:string,method:"GET"|"POST"="GET",body?:object){
  let response:Response;
  try{response=await fetch("/api/communications/"+path,{
    method,cache:"no-store",credentials:"same-origin",
    ...(body?{headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})
  });}catch{throw Error("UNKNOWN")}
  if(response.status===401)throw Error("LOGIN");
  if(response.status===403)throw Error("DENIED");
  if(response.status===409)throw Error("CONFLICT");
  if(response.status===400)throw Error("INVALID");
  if(!response.ok)throw Error("UNKNOWN");
  try{return await response.json() as T;}catch{throw Error("UNKNOWN")}
}

async function mobile<T>(path:string,method:"GET"|"POST"="GET",body?:object){
  const options:RequestInit={method,credentials:"same-origin",cache:"no-store",
    ...(body?{headers:{"Content-Type":"application/json"},
      body:JSON.stringify(body)}:{})};
  let res:Response;
  try{res=await fetch("/api/mobile-verification/"+path,options);}
  catch{throw Error("UNKNOWN")}
  if(!res.ok)throw Error(res.status===401?"LOGIN":
    res.status===403?"DENIED":"UNKNOWN");
  try{return await res.json() as T;}catch{throw Error("UNKNOWN")}
}

const explain=(e:unknown)=>{
  const code=e instanceof Error?e.message:"UNKNOWN";
  return code==="DENIED"?"Your current role does not permit this action.":
    code==="LOGIN"?"Your session expired. Sign in again.":
    code==="CONFLICT"?"The notice was changed. Refresh before continuing.":
    code==="INVALID"?"Check the audience, message and schedule.":
    "This action could not be confirmed. Check the original status before retrying.";
};

function stateBadgeClass(state:string){
  switch(state){
    case "ACTIVE": return "cg19-badge cg19-badge-success";
    case "SCHEDULED": return "cg19-badge cg19-badge-info";
    case "DRAFT": return "cg19-badge cg19-badge-warning";
    case "EXPIRED": return "cg19-badge cg19-badge-neutral";
    case "CANCELLED": return "cg19-badge cg19-badge-danger";
    default: return "cg19-badge cg19-badge-neutral";
  }
}

function priorityBadgeClass(priority:string){
  return priority==="IMPORTANT"
    ? "cg19-badge cg19-badge-danger"
    : "cg19-badge cg19-badge-info";
}

function channelBadgeClass(channel:string){
  switch(channel){
    case "IN_APP": return "cg19-badge cg19-badge-neutral";
    case "EMAIL": return "cg19-badge cg19-badge-teal";
    case "SMS": return "cg19-badge cg19-badge-purple";
    default: return "cg19-badge cg19-badge-neutral";
  }
}

export function CommunicationsWorkspace({
  mayManage,mayApprove,mayProcess,mayRead,mayViewDelivery,mayChooseAccounts,mayChooseRoles
}:{
  mayManage:boolean;mayApprove:boolean;mayProcess:boolean;mayRead:boolean;
  mayViewDelivery:boolean;mayChooseAccounts:boolean;mayChooseRoles:boolean;
}){
  const [tab,setTab]=useState<"NOTICES"|"INBOX"|"EMAIL_TEMPLATES">(
    mayManage?"NOTICES":"INBOX");
  const [notices,setNotices]=useState<Notice[]>([]);
  const [inbox,setInbox]=useState<InboxItem[]>([]);
  const [providers,setProviders]=useState<Providers|null>(null);
  const [phoneProof,setPhoneProof]=useState<PhoneProof|null>(null);
  const [phoneCode,setPhoneCode]=useState("");
  const [options,setOptions]=useState<Option[]>([]);
  const [search,setSearch]=useState("");
  const [statusFilter,setStatusFilter]=useState("ALL");
  const [priorityFilter,setPriorityFilter]=useState("ALL");
  const [purposeFilter,setPurposeFilter]=useState("ALL");
  const [audienceFilter,setAudienceFilter]=useState("ALL");
  const [composerOpen,setComposerOpen]=useState(false);
  const [title,setTitle]=useState("");
  const [body,setBody]=useState("");
  const [priority,setPriority]=useState("NORMAL");
  const [purpose,setPurpose]=useState("TRANSACTIONAL");
  const [audienceKind,setAudienceKind]=useState("ALL_ACTIVE");
  const [audienceRef,setAudienceRef]=useState("");
  const [email,setEmail]=useState(false),[sms,setSms]=useState(false);
  const [schedule,setSchedule]=useState("");
  const [expiry,setExpiry]=useState("");
  const [href,setHref]=useState("");
  const [currentPassword,setCurrentPassword]=useState("");
  const [review,setReview]=useState<{id:string;action:"APPROVE"|"CANCEL";
    revision:number}|null>(null);
  const [pendingKey,setPendingKey]=useState("");
  const [reviewKey,setReviewKey]=useState("");
  const [unknown,setUnknown]=useState(false);
  const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
  const [alert,setAlert]=useState<Alert|null>(null);
  const [delivery,setDelivery]=useState<NoticeCounts|null>(null);
  const [deliveryRef,setDeliveryRef]=useState("");
  const [emailReferences,setEmailReferences]=useState<ClientEmailReference[]>([]);
  const [emailSearch,setEmailSearch]=useState("");
  const [emailLoading,setEmailLoading]=useState(false);

  const reload=useCallback(async()=>{
    setLoading(true);
    try{
      const result=await Promise.all([
        mayManage?req<{notices:Notice[]}>("notices?limit=30"):Promise.resolve({notices:[]}),
        mayRead?req<{items:InboxItem[]}>("inbox?limit=30"):Promise.resolve({items:[]}),
        mayViewDelivery?req<Providers>("providers/status"):Promise.resolve(null),
        mayRead?mobile<PhoneProof>("status"):Promise.resolve(null)
      ]);
      if(result[0].notices.length>30||result[1].items.length>30)
        throw Error("UNKNOWN");
      setNotices(result[0].notices);setInbox(result[1].items);
      setProviders(result[2]);setPhoneProof(result[3]);
    }catch(e){setAlert({kind:"error",message:explain(e)})}
    finally{setLoading(false);}
  },[mayManage,mayRead,mayViewDelivery]);

  useEffect(()=>{void reload();},[reload]);

  useEffect(()=>{
    setOptions([]);setAudienceRef("");
    if(audienceKind==="ALL_ACTIVE"||!mayManage)return;
    const controller=new AbortController();
    const path=audienceKind==="ROLE"?"roles":"accounts";
    if((path==="roles"&&!mayChooseRoles)||
      (path==="accounts"&&!mayChooseAccounts))return;
    void (async()=>{
      try{
        const res=await fetch("/api/access/"+path+"/options?search=",{
          credentials:"same-origin",signal:controller.signal,cache:"no-store"});
        if(!res.ok)throw Error();
        const data=await res.json() as {options?:Option[]};
        if(!controller.signal.aborted&&Array.isArray(data.options)&&
          data.options.length<=30)setOptions(data.options);
      }catch{if(!controller.signal.aborted)
        setAlert({kind:"error",message:"Authorized audience options unavailable."})}
    })();
    return()=>controller.abort();
  },[audienceKind,mayManage,mayChooseAccounts,mayChooseRoles]);

  async function create(){
    if(!mayManage||busy||unknown)return;
    setBusy(true);setAlert(null);
    const key=pendingKey||crypto.randomUUID();
    setPendingKey(key);
    try{
      if(!expiry)throw Error("INVALID");
      const data=await req<Notice&{result:string}>("notices","POST",{
        title,body,priority,purpose,channels:[
          "IN_APP",...(email?["EMAIL"]:[]),...(sms?["SMS"]:[])
        ],audienceKind,audienceRef:audienceKind==="ALL_ACTIVE"?null:audienceRef,
        scheduledAt:schedule?new Date(schedule).toISOString():null,
        expiresAt:new Date(expiry).toISOString(),requestKey:key,
        targetHref:href||null
      });
      if(!data.noticeRef||!Number.isInteger(data.revision))
        throw Error("UNKNOWN");
      setPendingKey("");setUnknown(false);
      setAlert({kind:"success",message:
        "Notice draft saved with its frozen permitted audience. It has not been sent."});
      setTitle("");setBody("");setSchedule("");setHref("");
      setComposerOpen(false);
      await reload();
    }catch(e){
      if(e instanceof Error&&e.message==="UNKNOWN")setUnknown(true);
      setAlert({kind:"error",message:explain(e)});
    }finally{setBusy(false);}
  }

  async function findOriginal(){
    if(!pendingKey||busy)return;
    setBusy(true);setAlert(null);
    try{
      const x=await req<{status:string;notice:Notice|null}>(
        "notices/requests/"+encodeURIComponent(pendingKey));
      setUnknown(x.status!=="CONFIRMED");
      setAlert({kind:x.status==="CONFIRMED"?"success":"info",
        message:x.status==="CONFIRMED"?
          "Original draft located: "+x.notice?.title:
          "No confirmed draft found. Keep the original request key and contact Foundation operations."});
      if(x.status==="CONFIRMED"){setPendingKey("");await reload();}
    }catch(e){setAlert({kind:"error",message:explain(e)})}
    finally{setBusy(false);}
  }

  async function decide(){
    if(!review||!mayApprove||busy||unknown)return;
    if((currentPassword.length<8||currentPassword.length>1024)){
      setAlert({kind:"error",message:"Enter a fresh current password."});return;
    }
    setBusy(true);setAlert(null);
    const requestKey=reviewKey||crypto.randomUUID();
    setReviewKey(requestKey);
    try{
      const result=await req<{status:string;revision:number}>(
        "notices/"+encodeURIComponent(review.id)+"/decision","POST",{
          action:review.action,expectedRevision:review.revision,
          requestKey,currentPassword
        });
      if(!Number.isInteger(result.revision))throw Error("UNKNOWN");
      setReview(null);setReviewKey("");setCurrentPassword("");
      setAlert({kind:"success",message:"Notice status confirmed: "+result.status});
      await reload();
    }catch(e){
      if(e instanceof Error&&e.message==="UNKNOWN")setUnknown(true);
      setAlert({kind:"error",message:explain(e)});
    }finally{setBusy(false);}
  }

  async function checkOriginalDecision(){
    if(!review||!reviewKey||busy)return;
    setBusy(true);setAlert(null);
    try{
      const state=await req<{status:string;action:string|null;revision:number|null}>(
        "notices/"+encodeURIComponent(review.id)+"/requests/"+
        encodeURIComponent(reviewKey));
      if(state.status!=="CONFIRMED"||!Number.isInteger(state.revision)){
        setAlert({kind:"error",message:
          "The original approval is not confirmed. Keep the request key; contact Foundation operations."});
        return;
      }
      setUnknown(false);setReview(null);setReviewKey("");setCurrentPassword("");
      setAlert({kind:"success",message:"Original notice command confirmed: "+state.action});
      await reload();
    }catch(e){setAlert({kind:"error",message:explain(e)})}
    finally{setBusy(false);}
  }

  async function startPhoneProof(){
    if(busy||!mayRead||!phoneProof?.hasNumber)return;
    setBusy(true);setAlert(null);
    try{
      const result=await mobile<{status:string}>("verify/start","POST");
      setAlert({kind:result.status==="CODE_REQUESTED_UNCONFIRMED_DELIVERY"?
        "info":"error",message:result.status==="CODE_REQUESTED_UNCONFIRMED_DELIVERY"?
        "Verification code was requested for your recorded mobile number. Delivery is not guaranteed.":
        "Original code request: "+result.status.replaceAll("_"," ")});
    }catch(e){setAlert({kind:"error",message:explain(e)})}
    finally{setBusy(false);}
  }

  async function confirmPhoneProof(){
    if(busy||!mayRead||!/^\d{4,10}$/.test(phoneCode))return;
    setBusy(true);setAlert(null);
    try{
      const result=await mobile<{status:string}>("verify/confirm",
        "POST",{code:phoneCode});
      if(result.status==="VERIFIED"){setPhoneCode("");await reload();}
      setAlert({kind:result.status==="VERIFIED"?"success":"error",
        message:result.status==="VERIFIED"?
          "Your mobile contact was verified by its original proof provider.":
          "Code has not been verified: "+result.status.replaceAll("_"," ")});
    }catch(e){setAlert({kind:"error",message:explain(e)})}
    finally{setBusy(false);}
  }

  async function counts(id:string){
    setDeliveryRef(id);setDelivery(null);
    try{
      const result=await req<NoticeCounts>(
        "notices/"+encodeURIComponent(id)+"/counts");
      setDelivery(result);
    }catch(e){setAlert({kind:"error",message:explain(e)})}
  }

  async function markRead(ref:string){
    if(busy)return;
    setBusy(true);
    try{
      await req("inbox/"+encodeURIComponent(ref)+"/read","POST");
      await reload();
    }catch(e){setAlert({kind:"error",message:explain(e)})}
    finally{setBusy(false);}
  }

  async function runRecovery(kind:"recover-decisions"|"process-due"){
    if(!mayProcess||busy)return;
    setBusy(true);setAlert(null);
    try{
      await req(kind,"POST");
      setAlert({kind:"info",message:
        "The bounded original-source recovery was requested. Refresh for verified status."});
      await reload();
    }catch(e){setAlert({kind:"error",message:explain(e)})}
    finally{setBusy(false);}
  }

  async function loadEmailReferences(){
    if(!mayManage)return;
    setEmailLoading(true);
    try{
      const data=await req<{templates:ClientEmailReference[];total:number;deliveryEnabled:false}>(
        "client-email-templates");
      if(!Array.isArray(data.templates)||data.total!==52||data.deliveryEnabled!==false)
        throw Error("UNKNOWN");
      setEmailReferences(data.templates);
    }catch(e){setAlert({kind:"error",message:explain(e)})}
    finally{setEmailLoading(false)}
  }

  async function importClientDrafts(){
    if(!mayManage||busy)return;
    setBusy(true);
    try{
      const result=await req<{imported:number;alreadyPresent:number;deliveryEnabled:false}>(
        "client-email-templates/import-drafts","POST");
      if(result.deliveryEnabled!==false)throw Error("UNKNOWN");
      setAlert({kind:"success",message:
        `${result.imported} email references imported as disabled drafts. `+
        `${result.alreadyPresent} already existed. No messages were sent.`});
      await loadEmailReferences();
    }catch(e){
      setAlert({kind:"error",message:
        e instanceof Error&&e.message==="CONFLICT"?
          "A saved client email reference differs from this source version. "+
          "Review the original template before importing again; no emails were sent.":
          explain(e)});
    }
    finally{setBusy(false)}
  }

  const activeCount=notices.filter(x=>x.state==="ACTIVE").length;
  const scheduledCount=notices.filter(x=>x.state==="SCHEDULED").length;
  const draftCount=notices.filter(x=>x.state==="DRAFT").length;
  const expiredCount=notices.filter(x=>x.state==="EXPIRED").length;
  const cancelledCount=notices.filter(x=>x.state==="CANCELLED").length;
  const unreadInboxCount=inbox.filter(x=>!x.read).length;

  const shown=notices.filter(x=>
    (statusFilter==="ALL"||x.state===statusFilter)&&
    (priorityFilter==="ALL"||x.priority===priorityFilter)&&
    (purposeFilter==="ALL"||x.purpose===purposeFilter)&&
    (audienceFilter==="ALL"||x.audienceKind===audienceFilter)&&
    (x.title+" "+x.state+" "+x.priority+" "+x.body).toLowerCase().includes(search.toLowerCase()));

  const selectedNotice=notices.find(n=>n.noticeRef===deliveryRef);

  return <section className="role-workspace">
    <header className="topbar"><div><h1>Foundation communications</h1>
      <p>Notification delivery, notice approval and own-account updates (C15–C18)</p></div>
      <div className="toolbar">
        {mayManage&&<button type="button" className="primary" onClick={()=>setComposerOpen(p=>!p)}>
          {composerOpen?"Close composer":"+ Draft New Notice (C16)"}
        </button>}
        <button type="button" onClick={()=>void reload()} disabled={busy||loading}>Refresh</button>
      </div>
    </header>

    {/* C15 Notifications KPI Dashboard */}
    <div className="kpi-grid" aria-label="Notifications status overview (C15)">
      <article className="kpi"><small>Active Notices</small>
        <strong>{activeCount}</strong>
        <span>Currently live broadcasts</span></article>
      <article className="kpi"><small>Scheduled Notices</small>
        <strong>{scheduledCount}</strong>
        <span>Pending upcoming release</span></article>
      <article className="kpi"><small>Draft Notices</small>
        <strong>{draftCount}</strong>
        <span>Not yet approved</span></article>
      <article className="kpi"><small>Expired Notices</small>
        <strong>{expiredCount}</strong>
        <span>Passed expiry date</span></article>
      <article className="kpi"><small>Cancelled Notices</small>
        <strong>{cancelledCount}</strong>
        <span>Revoked before delivery</span></article>
      <article className="kpi"><small>Your Unread Notifications</small>
        <strong>{unreadInboxCount}</strong>
        <span>In-app recipient inbox</span></article>
    </div>

    {alert&&<p className={"notice "+alert.kind}
      role={alert.kind==="success"?"status":"alert"}>{alert.message}</p>}

    <div className="toolbar">
      {mayManage&&<button type="button" onClick={()=>setTab("NOTICES")}
        aria-pressed={tab==="NOTICES"}>Notices &amp; broadcasts (C15/C17)</button>}
      {mayRead&&<button type="button" onClick={()=>setTab("INBOX")}
        aria-pressed={tab==="INBOX"}>My notifications ({unreadInboxCount})</button>}
      {mayManage&&<button type="button" onClick={()=>{setTab("EMAIL_TEMPLATES");
        void loadEmailReferences();}} aria-pressed={tab==="EMAIL_TEMPLATES"}>
        Email reference templates (52)</button>}
      {mayProcess&&<button type="button" onClick={()=>void runRecovery("recover-decisions")}
        disabled={busy}>Recover committed approvals</button>}
      {mayProcess&&<button type="button" onClick={()=>void runRecovery("process-due")}
        disabled={busy}>Process due messages</button>}
    </div>

    {mayViewDelivery&&providers&&<section className="role-pane">
      <div className="role-pane-heading"><h2>External channel readiness</h2></div>
      <div className="role-detail-content">
        <div className="toolbar">
          {providers.channels.map(c=><span key={c.channel} className={c.configured?"cg19-badge cg19-badge-success":"cg19-badge cg19-badge-warning"}>
            <strong>{c.channel}</strong>: {c.state.replaceAll("_"," ")}
            {c.configured?" (Configured)":" (Unavailable)"}
          </span>)}
        </div>
        <small style={{display:"block",marginTop:"0.5rem",color:"var(--cg-muted)"}}>
          In-app notifications deliver independently of external SMS or Email provider availability.
        </small>
      </div>
    </section>}

    {tab==="EMAIL_TEMPLATES"&&mayManage&&<section className="role-pane">
      <div className="role-pane-heading"><h2>Client transactional email templates (52)</h2></div>
      <div className="role-detail-content">
        <p>These are the client-approved reference words and attachment requirements.
          Importing creates <strong>disabled source drafts only</strong>. They do not
          send email or create membership, donation, HR or payroll records.
          Each business trigger, recipient and approved PDF pack must first
          be implemented and verified by its owning module.</p>
        <div className="toolbar">
          <button type="button" className="primary" disabled={busy||emailLoading}
            onClick={()=>void importClientDrafts()}>
            Import missing references as disabled drafts</button>
          <button type="button" disabled={busy||emailLoading}
            onClick={()=>void loadEmailReferences()}>Refresh references</button>
        </div>
        <label className="field" style={{marginTop:"0.75rem"}}>Find a template
          <input value={emailSearch} maxLength={80}
            onChange={e=>setEmailSearch(e.target.value)}
            placeholder="Template ID, name or module (e.g. CG-MEM, CG-DON, CG-SUP)"/></label>
        {emailLoading&&<p role="status" className="cg-module-loading">Checking current template references…</p>}
        {!emailLoading&&emailReferences.length===0&&<p role="status" className="cg-module-empty">
          Select Refresh references to view the client catalog.</p>}
        {emailReferences.filter(t=>(t.code+" "+t.title+" "+t.owner)
          .toLowerCase().includes(emailSearch.trim().toLowerCase()))
          .map(t=><details key={t.code} className="permission-group">
            <summary style={{cursor:"pointer",fontWeight:600}}>
              <strong>{t.code}</strong> · {t.title} · <span className="cg19-badge cg19-badge-neutral">{t.state.replaceAll("_"," ")}</span>
            </summary>
            <p><strong>Source trigger:</strong> {t.trigger}</p>
            <p><strong>Recipient:</strong> {t.recipient||"Verify the recipient from the owning source"}</p>
            <p><strong>Approved document requirement:</strong> {t.attachmentRule}</p>
            <p><strong>Required fields:</strong> {t.placeholders.join(", ")||"None"}</p>
            <p><strong>Subject preview (placeholders only)</strong></p>
            <pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",background:"#F8FAFC",padding:"0.5rem",borderRadius:"0.25rem"}}>{t.subject}</pre>
            <p><strong>Email body preview (placeholders only)</strong></p>
            <pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",background:"#F8FAFC",padding:"0.5rem",borderRadius:"0.25rem"}}>{t.body}</pre>
            <small style={{color:"var(--cg-muted)"}}>
              Delivery unavailable until the source event, permission and every
              required approved document are verified.
            </small>
          </details>)}
      </div>
    </section>}

    {tab==="NOTICES"&&mayManage&&<>
      {/* C16 Send Notification Form */}
      {composerOpen&&<section className="role-pane" aria-label="Draft New Notice (C16)">
        <div className="role-pane-heading">
          <h2>Draft new notice (C16)</h2>
          <button type="button" onClick={()=>setComposerOpen(false)}>Close</button>
        </div>
        <div className="role-detail-content">
          <p>A draft freezes its real CG-01 audience. Only a protected
            authorized approver who confirms their current password can activate or schedule it.</p>
          <label className="field">Notice title ({title.length}/120)
            <input value={title} maxLength={120} disabled={busy||unknown}
              placeholder="Notice headline (min 5 characters)"
              onChange={e=>setTitle(e.target.value)}/>
          </label>
          <label className="field">Message ({body.length}/480)
            <textarea rows={4} value={body} maxLength={480}
              placeholder="Announcement message content (min 10 characters)"
              disabled={busy||unknown} onChange={e=>setBody(e.target.value)}/>
          </label>
          <div className="toolbar">
            <label>Priority <select value={priority} disabled={busy||unknown}
              onChange={e=>setPriority(e.target.value)}>
              <option value="NORMAL">General (Normal)</option>
              <option value="IMPORTANT">Important</option>
            </select></label>
            <label>Purpose <select value={purpose} disabled={busy||unknown}
              onChange={e=>setPurpose(e.target.value)}>
              <option value="TRANSACTIONAL">Service notice (Transactional)</option>
              <option value="PROMOTIONAL">Optional campaign (Consent required)</option>
            </select></label>
          </div>
          <label className="field">Audience
            <select value={audienceKind} disabled={busy||unknown}
              onChange={e=>setAudienceKind(e.target.value)}>
              <option value="ALL_ACTIVE">All active Foundation accounts</option>
              {mayChooseRoles&&<option value="ROLE">One current role</option>}
              {mayChooseAccounts&&<option value="INDIVIDUAL">One active person</option>}
            </select></label>
          {audienceKind!=="ALL_ACTIVE"&&<label className="field">
            {audienceKind==="ROLE"?"Select current role":"Select current account"}
            <select value={audienceRef} disabled={busy||unknown}
              onChange={e=>setAudienceRef(e.target.value)}>
              <option value="">Choose actual recipient</option>
              {options.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}
            </select></label>}
          <fieldset className="permission-group"><legend>Delivery channels</legend>
            <label><input type="checkbox" checked readOnly/> In-app (always delivered)</label>
            <label><input type="checkbox" checked={email} disabled={busy||unknown}
              onChange={e=>setEmail(e.target.checked)}/> Email (verified and opted-in)</label>
            <label><input type="checkbox" checked={sms} disabled={busy||unknown}
              onChange={e=>setSms(e.target.checked)}/> SMS (verified and opted-in)</label>
          </fieldset>
          <div className="toolbar">
            <label className="field" style={{flex:1}}>Schedule (optional)
              <input type="datetime-local" value={schedule} disabled={busy||unknown}
                onChange={e=>setSchedule(e.target.value)}/></label>
            <label className="field" style={{flex:1}}>Expires (required)
              <input type="datetime-local" value={expiry} disabled={busy||unknown}
                onChange={e=>setExpiry(e.target.value)}/></label>
          </div>
          <label className="field">CareGanga internal action link (optional)
            <input value={href} placeholder="/admin/approvals" maxLength={180}
              disabled={busy||unknown} onChange={e=>setHref(e.target.value)}/></label>
          {unknown&&<div className="permission-group">
            <strong>Draft outcome unconfirmed</strong>
            <p>Do not create another notice until the original request is checked.</p>
            <button type="button" disabled={busy} onClick={()=>void findOriginal()}>
              Check original draft request</button>
          </div>}
          <div className="toolbar">
            <button type="button" className="primary" disabled={busy||unknown||!expiry||!title||!body||
              (audienceKind!=="ALL_ACTIVE"&&!audienceRef)}
              onClick={()=>void create()}>{busy?"Saving…":"Save frozen audience draft"}</button>
            <button type="button" disabled={busy} onClick={()=>setComposerOpen(false)}>Cancel</button>
          </div>
        </div>
      </section>}

      {/* C17/C18 Notices & Bulletins Management */}
      <section className="role-pane"><div className="role-pane-heading">
        <h2>Notices and bulletins (C17/C18)</h2>
        <div className="toolbar">
          {!composerOpen&&<button type="button" className="primary" onClick={()=>setComposerOpen(true)}>
            + Draft New Notice
          </button>}
        </div>
      </div>
        <div className="role-detail-content">
          {/* C15 Status filter tabs */}
          <div className="cg19-filter-tabs" role="tablist" aria-label="Notice status filter tabs">
            {([
              {key:"ALL",label:"All Notices",count:notices.length},
              {key:"ACTIVE",label:"Active",count:activeCount},
              {key:"SCHEDULED",label:"Scheduled",count:scheduledCount},
              {key:"DRAFT",label:"Drafts",count:draftCount},
              {key:"EXPIRED",label:"Expired",count:expiredCount},
              {key:"CANCELLED",label:"Cancelled",count:cancelledCount}
            ] as const).map(tabItem=>
              <button key={tabItem.key} type="button"
                className={`cg19-tab-btn ${statusFilter===tabItem.key?"is-active":""}`}
                aria-pressed={statusFilter===tabItem.key}
                onClick={()=>setStatusFilter(tabItem.key)}>
                <span>{tabItem.label}</span>
                <span className="cg19-tab-count">{tabItem.count}</span>
              </button>)}
          </div>

          {/* Filter Bar */}
          <div className="toolbar" style={{marginBottom:"0.75rem"}}>
            <label style={{flex:1,minWidth:"14rem"}}>Search{" "}
              <input value={search} onChange={e=>setSearch(e.target.value)}
                placeholder="Search notice title, body or status"/></label>
            <label>Priority{" "}
              <select value={priorityFilter} onChange={e=>setPriorityFilter(e.target.value)}>
                <option value="ALL">All priorities</option>
                <option value="IMPORTANT">Important</option>
                <option value="NORMAL">Normal</option>
              </select>
            </label>
            <label>Purpose{" "}
              <select value={purposeFilter} onChange={e=>setPurposeFilter(e.target.value)}>
                <option value="ALL">All purposes</option>
                <option value="TRANSACTIONAL">Service (Transactional)</option>
                <option value="PROMOTIONAL">Campaign (Promotional)</option>
              </select>
            </label>
            <label>Audience{" "}
              <select value={audienceFilter} onChange={e=>setAudienceFilter(e.target.value)}>
                <option value="ALL">All audience types</option>
                <option value="ALL_ACTIVE">All Accounts</option>
                <option value="ROLE">Specific Role</option>
                <option value="INDIVIDUAL">Individual Account</option>
              </select>
            </label>
            {(search||statusFilter!=="ALL"||priorityFilter!=="ALL"||purposeFilter!=="ALL"||audienceFilter!=="ALL")&&
              <button type="button" onClick={()=>{
                setSearch("");setStatusFilter("ALL");setPriorityFilter("ALL");
                setPurposeFilter("ALL");setAudienceFilter("ALL");
              }}>Reset filters</button>}
          </div>

          {loading?<p role="status" className="cg-module-loading">Verifying notices…</p>:!shown.length?<p className="cg-module-empty" role="status">No matching notices.</p>:
            <div className="role-table-wrap"><table className="role-table">
              <thead><tr><th>Notice</th><th>Audience</th>
                <th>Channels</th><th>Priority</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>{shown.map(x=><tr key={x.noticeRef}>
                <td>
                  <strong>{x.title}</strong>
                  <p>{x.body}</p>
                  <small style={{color:"var(--cg-muted)"}}>
                    {x.scheduledAt?`Scheduled: ${new Date(x.scheduledAt).toLocaleString()} · `:""}
                    Expires: {new Date(x.expiresAt).toLocaleDateString()}
                  </small>
                </td>
                <td>
                  <strong>{x.audienceCount} recipients</strong>
                  <p style={{fontSize:"0.8rem",color:"var(--cg-muted)"}}>
                    {x.audienceKind.replaceAll("_"," ")}
                  </p>
                </td>
                <td>
                  <div style={{display:"flex",gap:"0.25rem",flexWrap:"wrap"}}>
                    {x.channels.map(c=><span key={c} className={channelBadgeClass(c)}>{c}</span>)}
                  </div>
                </td>
                <td>
                  <span className={priorityBadgeClass(x.priority)}>
                    {x.priority}
                  </span>
                </td>
                <td>
                  <span className={stateBadgeClass(x.state)}>
                    {x.state.replaceAll("_"," ")}
                  </span>
                </td>
                <td><div className="toolbar">
                  {mayApprove&&x.state==="DRAFT"&&<button type="button"
                    disabled={busy||unknown}
                    onClick={()=>setReview({id:x.noticeRef,action:"APPROVE",
                      revision:x.revision})}>Review approval</button>}
                  {mayApprove&&!["EXPIRED","CANCELLED"].includes(x.state)&&
                    <button type="button" disabled={busy||unknown}
                      onClick={()=>setReview({id:x.noticeRef,action:"CANCEL",
                        revision:x.revision})}>Review cancellation</button>}
                  {mayViewDelivery&&<button type="button"
                    onClick={()=>void counts(x.noticeRef)}>Delivery counts</button>}
                </div></td>
              </tr>)}</tbody>
            </table></div>}

          {/* Delivery counts breakdown dialog */}
          {delivery&&<div className="permission-group" style={{marginTop:"1rem"}} role="region" aria-label="Delivery Counts Breakdown">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <h3>Delivery evidence: {selectedNotice?.title||deliveryRef}</h3>
              <button type="button" onClick={()=>setDelivery(null)}>Close</button>
            </div>
            {delivery.counts.length?<div className="kpi-grid" style={{gridTemplateColumns:"repeat(auto-fit, minmax(10rem, 1fr))"}}>
              {delivery.counts.map(c=>
                <article key={c.channel+c.status} className="kpi">
                  <small>{c.channel}</small>
                  <strong>{c.count}</strong>
                  <span><span className={stateBadgeClass(c.status)}>{c.status.replaceAll("_"," ")}</span></span>
                </article>)}
            </div>:<p className="cg-module-empty">No delivery attempts recorded for this notice yet.</p>}
          </div>}

          {/* Review Modal for Approval / Cancellation */}
          {review&&<div className="permission-group" style={{marginTop:"1rem"}} role="alert">
            {unknown&&reviewKey&&<div role="alert" className="notice error">
              <p>Previous notice approval result uncertain. Do not repeat as
                a new request. Check the original command first.</p>
              <button type="button" disabled={busy}
                onClick={()=>void checkOriginalDecision()}>
                Check original notice command
              </button>
            </div>}
            <strong>{review.action==="APPROVE"?
              "Confirm activation of frozen notice":"Confirm notice cancellation"}</strong>
            <p>The request must use a current Foundation Super Admin password.</p>
            <label className="field">Current password
              <input type="password" minLength={8} maxLength={1024} autoComplete="current-password" value={currentPassword}
                onChange={e=>setCurrentPassword(e.target.value)}/></label>
            <div className="toolbar">
              <button type="button" className="primary" disabled={busy||unknown}
                onClick={()=>void decide()}>Confirm {review.action.toLowerCase()}</button>
              <button type="button" disabled={busy||unknown}
                onClick={()=>{setReview(null);setReviewKey("");setCurrentPassword("");}}>
                Cancel
              </button>
            </div>
          </div>}
        </div>
      </section>
    </>}

    {/* In-app recipient inbox */}
    {tab==="INBOX"&&mayRead&&<section className="role-pane">
      <div className="role-pane-heading"><h2>My verified mobile contact</h2></div>
      <div className="role-detail-content">
        {!phoneProof?<p>Mobile verification status unavailable.</p>:
          phoneProof.verified?<p role="status">
            <span className="cg19-badge cg19-badge-success">Verified CG-01 mobile: {phoneProof.maskedContact}</span>{" "}
            SMS delivery still requires purpose-specific consent.
          </p>:
          !phoneProof.hasNumber?<p>No mobile number is recorded in your Foundation
            account. The CG-01 account owner must record it first.</p>:
          <div className="permission-group">
            <p>Recorded mobile: {phoneProof.maskedContact} (not verified).</p>
            <p>This verification uses CG-01 identity proof, not a general CG-19 message.</p>
            <button type="button" disabled={busy||!phoneProof.providerConfigured}
              onClick={()=>void startPhoneProof()}>Request SMS verification code</button>
            <label className="field">Verification code
              <input value={phoneCode} inputMode="numeric" maxLength={10}
                disabled={busy} onChange={e=>
                  setPhoneCode(e.target.value.replace(/[^0-9]/g,""))}/>
            </label>
            <button type="button" className="primary" disabled={busy||phoneCode.length<4}
              onClick={()=>void confirmPhoneProof()}>Verify recorded mobile</button>
          </div>}
      </div>
    </section>}

    {tab==="INBOX"&&mayRead&&<section className="role-pane">
      <div className="role-pane-heading"><h2>My verified notifications ({inbox.length})</h2></div>
      <div className="role-detail-content">
        {!inbox.length?<p className="cg-module-empty">No notifications for your current account.</p>:
          inbox.map(item=><article className="permission-group" key={item.notificationRef}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div>
                <h3 style={{margin:"0 0 0.25rem 0"}}>{item.title}</h3>
                <p style={{margin:"0 0 0.5rem 0"}}>{item.body}</p>
              </div>
              <div>
                {!item.read&&<span className="cg19-badge cg19-badge-warning">Unread</span>}
              </div>
            </div>
            <div className="toolbar" style={{fontSize:"0.8rem",color:"var(--cg-muted)"}}>
              <span className={channelBadgeClass(item.channel)}>{item.channel}</span>
              <span>{item.status.replaceAll("_"," ")}</span>
              <span>{new Date(item.receivedAt).toLocaleString()}</span>
              {!item.read&&<button type="button" disabled={busy}
                onClick={()=>void markRead(item.notificationRef)}>Mark as read</button>}
            </div>
          </article>)}
      </div></section>}
  </section>;
}
