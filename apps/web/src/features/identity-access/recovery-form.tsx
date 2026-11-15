"use client";
import { FormEvent, useRef, useState } from "react";

export function RecoveryForm() {
  const [step,setStep]=useState<"request"|"confirm">("request");
  const [email,setEmail]=useState("");
  const [token,setToken]=useState("");
  const [totp,setTotp]=useState("");
  const [password,setPassword]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [done,setDone]=useState(false);
  const [uncertain,setUncertain]=useState(false);
  const requestKey=useRef("");
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();if(busy)return;
    if(step==="request"&&!requestKey.current)requestKey.current=crypto.randomUUID();
    setBusy(true);setMessage("");setUncertain(false);
    const path=step==="request"?"/api/session/recovery/request":"/api/session/recovery/confirm";
    const body=step==="request"?{email,requestKey:requestKey.current}:{email,token,totp,password};
    try{
      const response=await fetch(path,{
        method:"POST",credentials:"same-origin",
        headers:{"Content-Type":"application/json"},body:JSON.stringify(body)
      });
      const data=await response.json() as {message?:string};
      if(!response.ok){
        setMessage(response.status===429?"Too many attempts. Try again later.":
          data.message??"Recovery cannot be confirmed.");
        if(step==="confirm"&&response.status>=500)setUncertain(true);
      }else{
        setMessage(data.message??"Recovery request processed.");
        if(step==="request")setStep("confirm");
        else {setDone(true);setPassword("");setToken("");setTotp("");}
      }
    }catch{
      setMessage("We couldn't confirm the outcome. Check before submitting again.");
      if(step==="confirm")setUncertain(true);
    }finally{setBusy(false);}
  }
  return <form className="form" onSubmit={submit}>
    <label className="field">Work email
      <input required type="email" autoComplete="email" maxLength={254} value={email}
       onChange={e=>setEmail(e.target.value)} disabled={done}/>
    </label>
    {step==="confirm"&&!done&&<>
      <p>Enter your emailed recovery code and a fresh authenticator code.</p>
      <label className="field">Recovery code
        <input required autoComplete="off" value={token} onChange={e=>setToken(e.target.value)}
          minLength={40} maxLength={100}/>
      </label>
      <label className="field">Authenticator code
        <input required autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}"
          maxLength={6} value={totp} onChange={e=>setTotp(e.target.value.replace(/\D/g,""))}/>
      </label>
      <label className="field">New password
        <input required autoComplete="new-password" type="password" minLength={14}
          value={password} onChange={e=>setPassword(e.target.value)}/>
      </label>
    </>}
    {!!message&&<p role="status" className={uncertain?"error":undefined}>{message}</p>}
    {!done&&<button className="primary" type="submit" disabled={busy||uncertain}>
      {busy?"Checking…":step==="request"?"Request recovery":"Confirm recovery"}
    </button>}
    {uncertain&&<p>Try signing in with your new password or contact Foundation support before attempting another reset.</p>}
    {done&&<a href="/admin/login">Return to sign in</a>}
  </form>;
}
