"use client";
import {FormEvent,useCallback,useEffect,useRef,useState} from "react";
type Values={maxSessionAgeSeconds:number;idleTimeoutSeconds:number;failedAttemptWindowSeconds:number;maxFailedAttempts:number;rootMfaRequired:true};
type View=Values&{revision:number;updatedAt:string|null};
type Draft={maxSessionMinutes:number;idleMinutes:number;attemptWindowMinutes:number;maxFailedAttempts:number};
type Notice={kind:"success"|"error"|"uncertain";message:string};
const controls:{key:keyof Draft;name:string;min:number;max:number;hint:string}[]=[
  {key:"maxSessionMinutes",name:"Maximum session age",min:15,max:480,hint:"15 minutes to 8 hours"},
  {key:"idleMinutes",name:"Idle session timeout",min:5,max:60,hint:"5 to 60 minutes"},
  {key:"attemptWindowMinutes",name:"Failed-attempt window",min:5,max:60,hint:"5 to 60 minutes"},
  {key:"maxFailedAttempts",name:"Allowed failed attempts",min:3,max:10,hint:"3 to 10 attempts"}
];
function draft(p:View):Draft{return{
  maxSessionMinutes:p.maxSessionAgeSeconds/60,
  idleMinutes:p.idleTimeoutSeconds/60,
  attemptWindowMinutes:p.failedAttemptWindowSeconds/60,
  maxFailedAttempts:p.maxFailedAttempts
};}
function valid(p:unknown):p is View{
  if(!p||typeof p!=="object")return false;
  const d=p as Record<string,unknown>;
  return d.rootMfaRequired===true&&Number.isInteger(d.revision)&&Number(d.revision)>=0&&
    controls.every(c=>{
      const seconds=c.key==="maxSessionMinutes"?d.maxSessionAgeSeconds:
        c.key==="idleMinutes"?d.idleTimeoutSeconds:
        c.key==="attemptWindowMinutes"?d.failedAttemptWindowSeconds:d.maxFailedAttempts;
      const n=c.key==="maxFailedAttempts"?seconds:Number(seconds)/60;
      return Number.isInteger(n)&&Number(n)>=c.min&&Number(n)<=c.max;
    })&&Number(d.idleTimeoutSeconds)<=Number(d.maxSessionAgeSeconds)&&
    (d.updatedAt===null||typeof d.updatedAt==="string");
}
export function SecurityPolicyPanel(){
  const [policy,setPolicy]=useState<View|null>(null);
  const [values,setValues]=useState<Draft|null>(null);
  const [editing,setEditing]=useState(false);
  const [review,setReview]=useState(false);
  const [totp,setTotp]=useState("");
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [checkingOutcome,setCheckingOutcome]=useState(false);
  const [notice,setNotice]=useState<Notice|null>(null);
  const [uncertain,setUncertain]=useState(false);
  const requestKey=useRef("");
  const readGeneration=useRef(0);
  const dialog=useRef<HTMLElement|null>(null);
  const saveBusy=useRef(false);
  const read=useCallback(async(expectedRevision?:number):Promise<boolean>=>{
    const gen=++readGeneration.current;setLoading(true);
    try{
      const resp=await fetch("/api/session/security-policy",{cache:"no-store",credentials:"same-origin"});
      if(!resp.ok)throw Error(resp.status===401?"Your session expired. Sign in again.":
        resp.status===403?"Only the Foundation Super Admin may access this policy.":
        "The current policy cannot be verified.");
      const body:unknown=await resp.json();
      if(!valid(body))throw Error("The policy response could not be verified.");
      if(gen!==readGeneration.current)return false;
      const matched=expectedRevision===undefined||body.revision>=expectedRevision;
      setPolicy(body);setValues(draft(body));setEditing(false);setReview(false);setTotp("");
      // A stale replica/cached read is not proof the acknowledged revision took effect.
      // Retain the idempotency key so the exact committed command can be checked again.
      if(matched){setUncertain(false);setNotice(null);requestKey.current="";}
      else{setUncertain(true);setNotice({kind:"uncertain",
        message:"The saved revision is not visible yet. Check the previous change before retrying."});}
      return matched;
    }catch(e){
      if(gen!==readGeneration.current)return false;
      // Denied or unverified data must not remain cached in a protected screen.
      setPolicy(null);setValues(null);setEditing(false);setReview(false);
      setNotice({kind:"error",message:e instanceof Error?e.message:"Security policy is unavailable."});
      return false;
    }finally{if(gen===readGeneration.current)setLoading(false);}
  },[]);
  useEffect(()=>{void read();return()=>{++readGeneration.current;};},[read]);
  useEffect(()=>{
    if(editing||uncertain)return;
    const onFocus=()=>{if(document.visibilityState==="visible")void read();};
    window.addEventListener("focus",onFocus);
    return()=>window.removeEventListener("focus",onFocus);
  },[read,editing,uncertain]);
  useEffect(()=>{
    if(!editing)return;
    const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
    dialog.current?.querySelector<HTMLInputElement>("input")?.focus();
    const key=(event:KeyboardEvent)=>{
      if(event.key==="Escape"&&!saveBusy.current){
        setEditing(false);setReview(false);setTotp("");
        return;
      }
      if(event.key!=="Tab")return;
      const all=Array.from(dialog.current?.querySelectorAll<HTMLElement>(
        'input:not([disabled]),button:not([disabled])')??[]).filter(el=>el.getClientRects().length>0);
      if(!all.length)return;
      if(event.shiftKey&&document.activeElement===all[0]){event.preventDefault();all[all.length-1].focus();}
      if(!event.shiftKey&&document.activeElement===all[all.length-1]){event.preventDefault();all[0].focus();}
    };
    document.addEventListener("keydown",key);
    return()=>{document.removeEventListener("keydown",key);previous?.focus();};
  },[editing]);
  async function checkOutcome(){
    if(!uncertain||!requestKey.current||checkingOutcome)return;
    setCheckingOutcome(true);
    try{
      const result=await fetch("/api/session/security-policy/changes/"+
        encodeURIComponent(requestKey.current),{cache:"no-store",credentials:"same-origin"});
      if(result.status===401||result.status===403){
        setPolicy(null);setEditing(false);
        setNotice({kind:"error",message:"Protected access expired. Sign in again to check the change."});
        return;
      }
      if(!result.ok)throw Error("No confirmation");
      const value=await result.json() as {status?:string;revision?:number|null};
      if(value.status==="CONFIRMED"&&Number.isInteger(value.revision)){
        const verified=await read(Number(value.revision));
        setUncertain(!verified);
        setNotice(verified
          ?{kind:"success",message:"The previously submitted security change was confirmed and reloaded."}
          :{kind:"uncertain",message:"The change was recorded, but its effective revision needs another verification."});
      }else{
        setNotice({kind:"uncertain",message:
          "No committed result is visible for that request yet. Check again or contact Foundation support before retrying."});
      }
    }catch{
      setNotice({kind:"uncertain",message:"The result remains unconfirmed. Check again before making another change."});
    }finally{setCheckingOutcome(false);}
  }
  function start(){
    if(!policy)return;
    requestKey.current=crypto.randomUUID();
    setValues(draft(policy));setReview(false);setTotp("");setNotice(null);
    setUncertain(false);setEditing(true);
  }
  function change(key:keyof Draft,value:string){
    setValues(before=>before?{...before,[key]:value.trim()===""?NaN:Number(value)}:before);
    setReview(false);
  }
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!policy||!values||busy||uncertain)return;
    if(!controls.every(c=>Number.isInteger(values[c.key])&&values[c.key]>=c.min&&values[c.key]<=c.max)
       ||values.idleMinutes>values.maxSessionMinutes){
      setNotice({kind:"error",message:"Use permitted whole-number limits. Idle time cannot exceed session age."});
      return;
    }
    if(!review){setReview(true);return;}
    if(!/^[0-9]{6}$/.test(totp))return;
    saveBusy.current=true;setBusy(true);setNotice(null);
    const payload={maxSessionAgeSeconds:values.maxSessionMinutes*60,
      idleTimeoutSeconds:values.idleMinutes*60,
      failedAttemptWindowSeconds:values.attemptWindowMinutes*60,
      maxFailedAttempts:values.maxFailedAttempts,
      rootMfaRequired:true,expectedRevision:policy.revision,
      idempotencyKey:requestKey.current,totp};
    try{
      const resp=await fetch("/api/session/security-policy",{method:"PATCH",
        headers:{"Content-Type":"application/json"},credentials:"same-origin",
        body:JSON.stringify(payload)});
      if(!resp.ok){
        if(resp.status>=500){
          setUncertain(true);setNotice({kind:"uncertain",message:"The outcome could not be confirmed. Refresh to check before retrying."});
        }else if(resp.status===401||resp.status===403){
          setPolicy(null);setEditing(false);
          setNotice({kind:"error",message:"Your protected access is no longer verified."});
        }else if(resp.status===409){
          setNotice({kind:"error",message:"This policy changed elsewhere. Keep your values and refresh before saving."});
        }else{
          const message=resp.status===429?"Too many code attempts. Try again later.":
            "Policy change was not accepted. Verify the limits and enter a fresh code.";
          setReview(false);setNotice({kind:"error",message});
        }
        return;
      }
      const ack:unknown=await resp.json();
      if(!ack||typeof ack!=="object"||!("revision" in ack)||
        !Number.isInteger(ack.revision))throw Error("Unconfirmed result");
      setEditing(false);setReview(false);setTotp("");requestKey.current="";
      const verified=await read(Number(ack.revision));
      setNotice(verified
        ?{kind:"success",message:"Security policy saved and verified. Existing staff sessions follow the updated limits."}
        :{kind:"uncertain",message:"The server acknowledged the change, but the current policy could not be reverified. Refresh before another edit."});
    }catch{
      setUncertain(true);setNotice({kind:"uncertain",message:
        "The result may already have been saved. Refresh the effective policy before another attempt."});
    }finally{setBusy(false);saveBusy.current=false;}
  }
  return <section className="role-workspace">
    <header className="topbar"><div><h1>Security Policy</h1>
      <p>Foundation Super Admin · Authentication and session security</p></div>
      <div className="toolbar">
        <button type="button" disabled={loading||busy||uncertain} onClick={()=>void read()}>Refresh</button>
        {policy&&!editing&&<button type="button" className="primary" onClick={start}>Edit policy</button>}
      </div>
    </header>
    {notice&&<p className={"notice "+notice.kind} role={notice.kind==="success"?"status":"alert"}>{notice.message}</p>}
    {uncertain&&<div className="permission-group">
      <p role="alert">Do not submit the same change again until its saved outcome is checked.</p>
      <button type="button" disabled={checkingOutcome}
        onClick={()=>void checkOutcome()}>{checkingOutcome?"Checking…":"Check previous change"}</button>
    </div>}
    {loading?<p role="status">Verifying policy…</p>:policy&&<>
      <div className="policy-grid">{controls.map(c=><article className="kpi" key={c.key}>
        <small>{c.name}</small>
        <strong>{draft(policy)[c.key]} {c.key==="maxFailedAttempts"?"attempts":"minutes"}</strong>
        <span>{c.hint}</span>
      </article>)}
      <article className="kpi"><small>Super Admin MFA</small><strong>Required</strong>
        <span>Cannot be turned off.</span></article></div>
      <p>Last updated: {policy.updatedAt?new Date(policy.updatedAt).toLocaleString():"Secure Foundation defaults"}</p>
    </>}
    {editing&&policy&&values&&<div className="drawer-backdrop" role="presentation">
      <section className="role-drawer" role="dialog" aria-modal="true"
        aria-labelledby="security-policy-title" ref={dialog}>
        <header className="topbar"><h2 id="security-policy-title">Edit security policy</h2>
          <button type="button" disabled={busy} onClick={()=>{setEditing(false);setReview(false);setTotp("");}}>Close</button></header>
        <form className="form" onSubmit={e=>void submit(e)}>
          {controls.map(c=><label className="field" key={c.key}>{c.name}
            <input required type="number" min={c.min} max={c.max} step={1}
              value={Number.isFinite(values[c.key])?values[c.key]:""}
              onChange={e=>change(c.key,e.target.value)}/>
            <small>{c.hint} · {c.key==="maxFailedAttempts"?"attempts":"minutes"}</small>
          </label>)}
          <p>Super Admin MFA: <strong>Required</strong> (not editable)</p>
          <label className="field">Fresh authenticator code
            <input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
              autoComplete="one-time-code" value={totp}
              onChange={e=>{setTotp(e.target.value.replace(/[^0-9]/g,""));setReview(false);}}/>
          </label>
          {review&&<div className="permission-group" role="status">
            <strong>Review security policy change</strong>
            <p>Existing sessions may expire immediately when limits are shortened. This change is audited.</p>
          </div>}
          {notice&&<p role="alert">{notice.message}</p>}
          <div className="toolbar">
            <button type="button" disabled={busy} onClick={()=>{setEditing(false);setReview(false);}}>Cancel</button>
            <button className="primary" type="submit" disabled={busy||uncertain||totp.length!==6}>
              {busy?"Saving…":review?"Confirm and save":"Review change"}</button>
          </div>
        </form>
      </section>
    </div>}
  </section>;
}
