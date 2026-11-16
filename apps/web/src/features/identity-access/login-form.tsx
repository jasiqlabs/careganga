"use client";
import { FormEvent,useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
export function LoginForm(){
  const router=useRouter();
  const [identifier,setIdentifier]=useState("");
  const [password,setPassword]=useState("");
  const [visible,setVisible]=useState(false);
  const [rememberMe,setRememberMe]=useState(false);
  const [state,setState]=useState<"idle"|"busy"|"error">("idle");
  const [message,setMessage]=useState("");
  async function signIn(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(state==="busy")return;
    setState("busy");setMessage("");
    try{
      const response=await fetch("/api/session/login",{
        method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({identifier:identifier.trim(),password,rememberMe})
      });
      if(!response.ok){
        setMessage(response.status===429?"Too many login attempts. Please try again later.":
          response.status===401?"Mobile number/email or password is incorrect.":
          "Sign-in is temporarily unavailable.");
        setState("error");return;
      }
      setPassword("");router.replace("/admin");router.refresh();
    }catch{setMessage("Cannot reach the sign-in service. Please try again.");setState("error");}
  }
  return <form className="cg-login-form" onSubmit={signIn}>
    <label htmlFor="cg-identifier">MOBILE NUMBER OR EMAIL</label>
    <div className="cg-login-control"><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2"/>
        <path d="M4 21c0-5 3-8 8-8s8 3 8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      </svg>
      <input id="cg-identifier" value={identifier} onChange={e=>setIdentifier(e.target.value)}
        placeholder="Enter mobile number or email" required maxLength={254}
        autoCapitalize="none" autoComplete="username"/></div>
    <label htmlFor="cg-password">PASSWORD</label>
    <div className="cg-login-control"><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none">
        <rect x="5" y="10" width="14" height="11" rx="2" stroke="currentColor" strokeWidth="2"/>
        <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="2"/>
      </svg>
      <input id="cg-password" type={visible?"text":"password"} value={password}
        onChange={e=>setPassword(e.target.value)} autoComplete="current-password"
        placeholder="Enter your password" required maxLength={1024}/>
      <button type="button" className="cg-password-toggle"
        onClick={()=>setVisible(v=>!v)} aria-label={visible?"Hide password":"Show password"}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" stroke="currentColor" strokeWidth="2"/>
          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
          {visible&&<path d="M3 21 21 3" stroke="currentColor" strokeWidth="2"/>}
        </svg></button>
    </div>
    <div className="cg-login-helpers">
      <label><input type="checkbox" checked={rememberMe}
        onChange={e=>setRememberMe(e.target.checked)}/> Remember Me</label>
      <Link href="/admin/recovery">Forgot Password?</Link>
    </div>
    {message&&<p className="cg-login-error" role="alert">{message}</p>}
    <button className="cg-login-submit" type="submit" disabled={state==="busy"}>
      {state==="busy"?"Signing in…":"SIGN IN"}</button>
  </form>;
}
