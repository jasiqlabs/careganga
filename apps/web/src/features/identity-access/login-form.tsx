"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router=useRouter();
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [totp,setTotp]=useState("");
  const [state,setState]=useState<"idle"|"busy"|"error">("idle");
  const [message,setMessage]=useState("");
  async function signIn(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state==="busy") return;
    setState("busy"); setMessage("");
    try {
      const response=await fetch("/api/session/login",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({email,password,totp})});
      if(!response.ok) {
        setMessage(response.status===429?"Too many attempts. Please try later.":response.status===401?"Account or verification code could not be confirmed.":"Sign-in is unavailable. Please try again.");
        setState("error");return;
      }
      setPassword("");setTotp("");router.replace("/admin");router.refresh();
    } catch {setMessage("Could not reach the sign-in service. Please try again.");setState("error");}
  }
  return <form className="form" onSubmit={signIn}>
    <label className="field">Work email<input autoComplete="username" required type="email" value={email} onChange={e=>setEmail(e.target.value)} maxLength={254}/></label>
    <label className="field">Password<input autoComplete="current-password" required type="password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
    <label className="field">Authenticator code<input autoComplete="one-time-code" required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={totp} onChange={e=>setTotp(e.target.value.replace(/\D/g,""))}/></label>
    {message&&<p role="alert" className="error">{message}</p>}
    <button className="primary" type="submit" disabled={state==="busy"}>{state==="busy"?"Verifying…":"Sign in"}</button>
    <small>Recovery depends on your Foundation's verified email service; contact support if unavailable.</small>
  </form>;
}
