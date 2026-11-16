"use client";
import { FormEvent,useRef,useState } from "react";
import Link from "next/link";

export function RecoveryForm(){
  const [step,setStep]=useState<"request"|"confirm">("request");
  const [identifier,setIdentifier]=useState("");
  const [channel,setChannel]=useState<"email"|"sms">("sms");
  const [otp,setOtp]=useState("");
  const [newPassword,setNewPassword]=useState("");
  const [busy,setBusy]=useState(false);
  const [done,setDone]=useState(false);
  const [uncertain,setUncertain]=useState(false);
  const [message,setMessage]=useState("");
  const requestKey=useRef("");
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(busy)return;
    if(step==="request"&&!requestKey.current)requestKey.current=crypto.randomUUID();
    setBusy(true);setMessage("");setUncertain(false);
    const endpoint=step==="request"?"/api/session/recovery/request":"/api/session/recovery/confirm";
    const body=step==="request"?{identifier:identifier.trim(),channel,requestKey:requestKey.current}:
      {identifier:identifier.trim(),otp,newPassword};
    try{
      const response=await fetch(endpoint,{method:"POST",credentials:"same-origin",
        headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      if(!response.ok){
        setMessage(response.status===429?"Too many attempts. Please try later.":
          response.status===400?"Check the OTP and password.":
          "Password recovery is temporarily unavailable.");
        if(step==="confirm"&&response.status>=500)setUncertain(true);
      }else if(step==="request"){
        setStep("confirm");
        setMessage("If this account exists, a reset code will be sent to its registered contact when delivery is available.");
      }else{
        setDone(true);setOtp("");setNewPassword("");
        setMessage("Password changed. Please sign in again.");
      }
    }catch{
      setMessage("We could not confirm the result. Check before submitting again.");
      if(step==="confirm")setUncertain(true);
    }finally{setBusy(false);}
  }
  return <form className="form" onSubmit={submit}>
    <label className="field">Registered mobile number or email
      <input required maxLength={254} autoComplete="username" value={identifier}
        onChange={e=>{setIdentifier(e.target.value);setChannel(e.target.value.includes("@")?"email":"sms");}} disabled={done||step==="confirm"}/>
    </label>
    {step==="request"&&<label className="field">Receive reset OTP by
      <select value={channel} onChange={e=>setChannel(e.target.value as "email"|"sms")}>
        <option value="sms">SMS</option><option value="email">Email</option>
      </select>
    </label>}
    {step==="confirm"&&!done&&<>
      <p>Enter the six-digit OTP sent to your registered contact. Codes expire in 10 minutes.</p>
      <label className="field">Reset OTP
        <input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
          autoComplete="one-time-code" value={otp}
          onChange={e=>setOtp(e.target.value.replace(/[^0-9]/g,"").slice(0,6))}/>
      </label>
      <label className="field">New password
        <input required type="password" minLength={8} maxLength={1024}
          autoComplete="new-password" value={newPassword}
          onChange={e=>setNewPassword(e.target.value)}/>
      </label>
    </>}
    {message&&<p role="status" className={uncertain?"error":undefined}>{message}</p>}
    {!done&&<button type="submit" className="primary"
      disabled={busy||uncertain||(step==="confirm"&&(otp.length!==6||newPassword.length<8))}>
      {busy?"Checking…":step==="request"?"Send reset OTP":"Reset password"}
    </button>}
    {step==="confirm"&&!done&&<button type="button" disabled={busy}
      onClick={()=>{setStep("request");setOtp("");setNewPassword("");
        requestKey.current="";setMessage("You can request another OTP after the resend cooldown.");}}>
      Request another OTP
    </button>}
    <Link href="/admin/login">Return to sign in</Link>
  </form>;
}
