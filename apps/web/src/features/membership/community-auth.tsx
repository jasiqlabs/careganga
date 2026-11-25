"use client";
import {useRef,useState,type FormEvent} from "react";
type Mode="login"|"signup";
async function call(path:string,body:Record<string,unknown>){
 const r=await fetch("/api/community/"+path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),cache:"no-store",signal:AbortSignal.timeout(15000)});
 const v=await r.json().catch(()=>null) as {message?:string;status?:string}|null;
 if(!r.ok||!v)throw new Error(v?.message??"Account action was not confirmed.");
 return v;
}
export function CommunityAuth({onSignedIn,heading="Membership account"}:{onSignedIn:()=>Promise<void>;heading?:string}){
 const [mode,setMode]=useState<Mode>("login"),[id,setId]=useState(""),[password,setPassword]=useState("");
 const [first,setFirst]=useState(""),[last,setLast]=useState(""),[mobile,setMobile]=useState(""),[email,setEmail]=useState("");
 const [signupPassword,setSignupPassword]=useState(""),[code,setCode]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
 const pending=useRef<{key:string;digest:string}|null>(null);
 const act=async(run:()=>Promise<void>)=>{if(busy)return;setBusy(true);setMessage("");setError("");try{await run();}catch(e){setError(e instanceof Error?e.message:"The result is uncertain. Check before trying again.");}finally{setBusy(false);}};
 const login=(e:FormEvent)=>{e.preventDefault();void act(async()=>{await call("login",{identifier:id,password});setPassword("");await onSignedIn();});};
 const requestCode=()=>void act(async()=>{if(!/^[6-9][0-9]{9}$/.test(mobile))throw new Error("Enter a valid 10-digit Indian mobile number.");await call("signup/start",{mobile});setMessage("Verification code requested. Delivery is not guaranteed; use the code you receive.");});
 const signup=(e:FormEvent)=>{e.preventDefault();void act(async()=>{
  const payload={firstName:first.trim(),lastName:last.trim(),mobile,email:email.trim()||null,password:signupPassword,code};
  const digest=JSON.stringify(payload);if(pending.current?.digest!==digest)pending.current={digest,key:crypto.randomUUID()};
  const result=await call("signup",{...payload,requestKey:pending.current.key});
  if(result.status!=="ACCOUNT_CREATED")throw new Error("Account creation could not be confirmed.");
  pending.current=null;setId(email.trim()||mobile);setSignupPassword("");setCode("");setMode("login");
  setMessage("Account created with your verified contact. Sign in to continue.");
 });};
 return <section className="cg04-panel cg04-auth">
 <h2>{heading}</h2><div className="cg04-buttons"><button type="button" disabled={busy} aria-pressed={mode==="login"} onClick={()=>{setSignupPassword("");setCode("");setMode("login");}}>Sign in</button><button type="button" disabled={busy} aria-pressed={mode==="signup"} onClick={()=>{setPassword("");setMode("signup");}}>Create account</button></div>
 {error&&<p role="alert" className="cg04-error">{error}</p>}{message&&<p role="status">{message}</p>}
 {mode==="login"?<form onSubmit={login}><label>Mobile or email<input required autoComplete="username" value={id} onChange={e=>setId(e.target.value)} maxLength={254}/></label><label>Password<input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="cg04-primary" disabled={busy}>Sign in</button></form>:
 <form onSubmit={signup}>
 <label>First name<input required autoComplete="given-name" value={first} onChange={e=>setFirst(e.target.value)} maxLength={100}/></label><label>Last name<input required autoComplete="family-name" value={last} onChange={e=>setLast(e.target.value)} maxLength={100}/></label>
 <label>Indian mobile number<input required autoComplete="tel" value={mobile} onChange={e=>setMobile(e.target.value)} maxLength={10} inputMode="tel"/></label>
 <label>Email (optional)<input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} maxLength={254}/></label>
 <label>Choose a password<input type="password" autoComplete="new-password" required minLength={8} value={signupPassword} onChange={e=>setSignupPassword(e.target.value)}/></label>
 <button type="button" disabled={busy} onClick={requestCode}>Request mobile verification code</button>
 <label>Received verification code<input required autoComplete="one-time-code" value={code} onChange={e=>setCode(e.target.value)} maxLength={10} inputMode="numeric"/></label>
 <button className="cg04-primary" disabled={busy}>Create verified account</button></form>}
 </section>;
}
