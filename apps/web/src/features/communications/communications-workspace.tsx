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
export function CommunicationsWorkspace({
  mayManage,mayApprove,mayProcess,mayRead,mayViewDelivery,mayChooseAccounts,mayChooseRoles
}:{
  mayManage:boolean;mayApprove:boolean;mayProcess:boolean;mayRead:boolean;
  mayViewDelivery:boolean;mayChooseAccounts:boolean;mayChooseRoles:boolean;
}){
  const [tab,setTab]=useState<"NOTICES"|"INBOX">(
    mayManage?"NOTICES":"INBOX");
  const [notices,setNotices]=useState<Notice[]>([]);
  const [inbox,setInbox]=useState<InboxItem[]>([]);
  const [providers,setProviders]=useState<Providers|null>(null);
  const [phoneProof,setPhoneProof]=useState<PhoneProof|null>(null);
  const [phoneCode,setPhoneCode]=useState("");
  const [options,setOptions]=useState<Option[]>([]);
  const [search,setSearch]=useState("");
  const [statusFilter,setStatusFilter]=useState("ALL");
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
  const shown=notices.filter(x=>
    (statusFilter==="ALL"||x.state===statusFilter)&&
    (x.title+" "+x.state+" "+x.priority).toLowerCase().includes(search.toLowerCase()));
  return <section className="role-workspace">
    <header className="topbar"><div><h1>Foundation communications</h1>
      <p>Notification delivery, notice approval and own-account updates</p></div>
      <button type="button" onClick={()=>void reload()} disabled={busy||loading}>Refresh</button>
    </header>
    <div className="kpi-grid">
      <article className="kpi"><small>Visible notice drafts</small>
        <strong>{notices.filter(x=>x.state==="DRAFT").length}</strong>
        <span>Not sent</span></article>
      <article className="kpi"><small>Visible active notices</small>
        <strong>{notices.filter(x=>x.state==="ACTIVE").length}</strong>
        <span>From permitted current records</span></article>
      <article className="kpi"><small>Your unread notifications</small>
        <strong>{inbox.filter(x=>!x.read).length}</strong>
        <span>No provider receipt required for in-app notices</span></article>
    </div>
    {alert&&<p className={"notice "+alert.kind}
      role={alert.kind==="success"?"status":"alert"}>{alert.message}</p>}
    <div className="toolbar">
      {mayManage&&<button type="button" onClick={()=>setTab("NOTICES")}
        aria-pressed={tab==="NOTICES"}>Notices & broadcasts</button>}
      {mayRead&&<button type="button" onClick={()=>setTab("INBOX")}
        aria-pressed={tab==="INBOX"}>My notifications</button>}
      {mayProcess&&<button type="button" onClick={()=>void runRecovery("recover-decisions")}
        disabled={busy}>Recover committed approvals</button>}
      {mayProcess&&<button type="button" onClick={()=>void runRecovery("process-due")}
        disabled={busy}>Process due messages</button>}
    </div>
    {mayViewDelivery&&providers&&<section className="role-pane">
      <div className="role-pane-heading"><h2>External channel readiness</h2></div>
      <div className="role-detail-content">
        {providers.channels.map(c=><p key={c.channel}><strong>{c.channel}</strong>:
          {" "}{c.state.replaceAll("_"," ")}.
          {c.configured?" Provider response and signed receipt still required.":
            " In-app messages work independently."}</p>)}
      </div>
    </section>}
    {tab==="NOTICES"&&mayManage&&<>
      <section className="role-pane"><div className="role-pane-heading">
        <h2>Draft new notice</h2></div>
        <div className="role-detail-content">
          <p>A draft freezes its real CG-01 audience. Only a protected
            approver with fresh MFA can activate or schedule it.</p>
          <label className="field">Notice title
            <input value={title} maxLength={120} disabled={busy||unknown}
              onChange={e=>setTitle(e.target.value)}/>
          </label>
          <label className="field">Message
            <textarea rows={4} value={body} maxLength={480}
              disabled={busy||unknown} onChange={e=>setBody(e.target.value)}/>
          </label>
          <div className="toolbar">
            <label>Priority <select value={priority} disabled={busy||unknown}
              onChange={e=>setPriority(e.target.value)}>
              <option value="NORMAL">General</option>
              <option value="IMPORTANT">Important</option>
            </select></label>
            <label>Purpose <select value={purpose} disabled={busy||unknown}
              onChange={e=>setPurpose(e.target.value)}>
              <option value="TRANSACTIONAL">Service notice</option>
              <option value="PROMOTIONAL">Optional campaign (consent required)</option>
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
            <label><input type="checkbox" checked readOnly/> In-app (always)</label>
            <label><input type="checkbox" checked={email} disabled={busy||unknown}
              onChange={e=>setEmail(e.target.checked)}/> Email (verified and opted in)</label>
            <label><input type="checkbox" checked={sms} disabled={busy||unknown}
              onChange={e=>setSms(e.target.checked)}/> SMS (verified and opted in)</label>
          </fieldset>
          <label className="field">Schedule (optional)
            <input type="datetime-local" value={schedule} disabled={busy||unknown}
              onChange={e=>setSchedule(e.target.value)}/></label>
          <label className="field">Expires
            <input type="datetime-local" value={expiry} disabled={busy||unknown}
              onChange={e=>setExpiry(e.target.value)}/></label>
          <label className="field">CareGanga internal action link (optional)
            <input value={href} placeholder="/admin/approvals" maxLength={180}
              disabled={busy||unknown} onChange={e=>setHref(e.target.value)}/></label>
          {unknown&&<div className="permission-group">
            <strong>Draft outcome unconfirmed</strong>
            <p>Do not create another notice until the original request is checked.</p>
            <button type="button" disabled={busy} onClick={()=>void findOriginal()}>
              Check original draft request</button>
          </div>}
          <button type="button" disabled={busy||unknown||!expiry||!title||!body||
            (audienceKind!=="ALL_ACTIVE"&&!audienceRef)}
            onClick={()=>void create()}>{busy?"Saving…":"Save frozen audience draft"}</button>
        </div>
      </section>
      <section className="role-pane"><div className="role-pane-heading">
        <h2>Notices and bulletins</h2></div>
        <div className="role-detail-content">
          <div className="toolbar">
            <label>Search <input value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="Search current notices"/></label>
            <label>Status <select value={statusFilter}
              onChange={e=>setStatusFilter(e.target.value)}>
              {["ALL","ACTIVE","SCHEDULED","DRAFT","EXPIRED","CANCELLED"].map(x=>
                <option key={x} value={x}>{x.replaceAll("_"," ")}</option>)}
            </select></label>
          </div>
          {loading?<p>Verifying notices…</p>:!shown.length?<p>No matching notices.</p>:
            <div className="role-table-wrap"><table className="role-table">
              <thead><tr><th>Notice</th><th>Audience</th>
                <th>Priority</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>{shown.map(x=><tr key={x.noticeRef}>
                <td><strong>{x.title}</strong><p>{x.body}</p></td>
                <td>{x.audienceCount} frozen recipients</td>
                <td>{x.priority}</td><td>{x.state.replaceAll("_"," ")}</td>
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
          {delivery&&<div className="permission-group">
            <h3>Delivery evidence for selected notice</h3>
            {delivery.counts.length?delivery.counts.map(c=>
              <p key={c.channel+c.status}>{c.channel} · {c.status.replaceAll("_"," ")}:
                {" "}{c.count}</p>):<p>No channel attempts recorded.</p>}
          </div>}
          {review&&<div className="permission-group">
            {unknown&&reviewKey&&<div role="alert">
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
            <label>Current password
              <input type="password" minLength={8} maxLength={1024} autoComplete="current-password" value={currentPassword}
                onChange={e=>setCurrentPassword(e.target.value)}/></label>
            <button type="button" disabled={busy||unknown}
              onClick={()=>void decide()}>Confirm {review.action.toLowerCase()}</button>
            <button type="button" disabled={busy||unknown}
              onClick={()=>{setReview(null);setReviewKey("");setCurrentPassword("");}}>
              Cancel
            </button>
          </div>}
        </div>
      </section>
    </>}
    {tab==="INBOX"&&mayRead&&<section className="role-pane">
      <div className="role-pane-heading"><h2>My verified mobile contact</h2></div>
      <div className="role-detail-content">
        {!phoneProof?<p>Mobile verification status unavailable.</p>:
          phoneProof.verified?<p role="status">Verified CG-01 mobile
            {" "}{phoneProof.maskedContact}. SMS still requires purpose-specific consent.</p>:
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
            <button type="button" disabled={busy||phoneCode.length<4}
              onClick={()=>void confirmPhoneProof()}>Verify recorded mobile</button>
          </div>}
      </div>
    </section>}
    {tab==="INBOX"&&mayRead&&<section className="role-pane">
      <div className="role-pane-heading"><h2>My verified notifications</h2></div>
      <div className="role-detail-content">
        {!inbox.length?<p>No notifications for your current account.</p>:
          inbox.map(item=><article className="permission-group" key={item.notificationRef}>
            <h3>{item.title}</h3><p>{item.body}</p>
            <p>Channel: {item.channel} · {item.status.replaceAll("_"," ")} ·
              {" "}{new Date(item.receivedAt).toLocaleString()}</p>
            {!item.read&&<button type="button" disabled={busy}
              onClick={()=>void markRead(item.notificationRef)}>Mark as read</button>}
          </article>)}
      </div></section>}
  </section>;
}
