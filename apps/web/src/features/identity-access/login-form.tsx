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
  const [fieldError,setFieldError]=useState<"identifier"|"password"|null>(null);
  async function signIn(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(state==="busy")return;
    setState("busy");setMessage("");setFieldError(null);
    try{
      const response=await fetch("/api/session/login",{
        method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({identifier:identifier.trim(),password,rememberMe})
      });
      if(!response.ok){
        const payload:unknown=response.status===400?await response.json().catch(()=>null):null;
        const safe=payload&&typeof payload==="object"&&!Array.isArray(payload)?
          payload as Record<string,unknown>:{};
        const target=response.status===400&&
          (safe.field==="identifier"||safe.field==="password")?safe.field:null;
        setFieldError(target);
        setMessage(response.status===400&&typeof safe.message==="string"&&
          typeof safe.code==="string"&&safe.code.startsWith("IDENTITY_")&&safe.message.length<=220?
          safe.message:response.status===429?"Too many login attempts. Please try again later.":
          response.status===401?"Mobile number/email or password is incorrect.":
          response.status===400?"Check the mobile number/email and password fields before signing in.":
          "Sign-in cannot be confirmed right now. Check your connection and retry.");
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
        autoCapitalize="none" autoComplete="username"
        aria-invalid={fieldError==="identifier"}
        aria-describedby={fieldError==="identifier"?"cg-login-identifier-error":undefined}/></div>
    {fieldError==="identifier"&&<p className="cg-login-error" id="cg-login-identifier-error" role="alert">{message}</p>}
    <label htmlFor="cg-password">PASSWORD</label>
    <div className="cg-login-control"><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none">
        <rect x="5" y="10" width="14" height="11" rx="2" stroke="currentColor" strokeWidth="2"/>
        <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="2"/>
      </svg>
      <input id="cg-password" type={visible?"text":"password"} value={password}
        onChange={e=>setPassword(e.target.value)} autoComplete="current-password"
        placeholder="Enter your password" required maxLength={1024}
        aria-invalid={fieldError==="password"}
        aria-describedby={fieldError==="password"?"cg-login-password-error":undefined}/>
      <button type="button" className="cg-password-toggle"
        onClick={()=>setVisible(v=>!v)} aria-label={visible?"Hide password":"Show password"}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" stroke="currentColor" strokeWidth="2"/>
          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
          {visible&&<path d="M3 21 21 3" stroke="currentColor" strokeWidth="2"/>}
        </svg></button>
    </div>
    {fieldError==="password"&&<p className="cg-login-error" id="cg-login-password-error" role="alert">{message}</p>}
    <div className="cg-login-helpers">
      <label><input type="checkbox" checked={rememberMe}
        onChange={e=>setRememberMe(e.target.checked)}/> Remember Me</label>
      <Link href="/admin/recovery">Forgot Password?</Link>
    </div>
    {message&&!fieldError&&<p className="cg-login-error" role="alert">{message}</p>}
    <button className="cg-login-submit" type="submit" disabled={state==="busy"}>
      {state==="busy"?"Signing in…":"SIGN IN"}</button>
  </form>;
}
