"use client";
import { FormEvent,useState } from "react";
export function InvitationActivationForm(){
  const [stage,setStage]=useState<"proof"|"setup"|"done">("proof");
  const [email,setEmail]=useState("");
  const [token,setToken]=useState("");
  const [secret,setSecret]=useState("");
  const [password,setPassword]=useState("");
  const [totp,setTotp]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [uncertain,setUncertain]=useState(false);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(busy||uncertain)return;
    setBusy(true);setMessage("");
    const path=stage==="proof"?"enroll":"confirm";
    const body=stage==="proof"?{email,token}:{email,token,password,totp};
    try{
      const response=await fetch("/api/invitation/"+path,{
        method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},
        body:JSON.stringify(body)
      });
      if(!response.ok){
        const data=await response.json() as {message?:string};
        setMessage(response.status===429?"Too many attempts. Try again later.":
          data.message??"Your invitation could not be confirmed.");
        if(stage==="setup"&&response.status>=500)setUncertain(true);
        return;
      }
      const result:unknown=await response.json();
      if(stage==="proof"){
        if(!result||typeof result!=="object"||!("enrollmentSecret" in result)||
          typeof result.enrollmentSecret!=="string")throw new Error("UNCONFIRMED");
        setSecret(result.enrollmentSecret);setStage("setup");
        setMessage("Set up your authenticator using this private key, then enter a current code.");
      }else{
        setStage("done");setSecret("");setToken("");setPassword("");setTotp("");
        setMessage("Account activated. Sign in using a fresh authenticator code.");
      }
    }catch{
      setMessage("We could not confirm the outcome. Check before retrying.");
      if(stage==="setup")setUncertain(true);
    }finally{setBusy(false);}
  }
  return <form className="form" onSubmit={submit}>
    {stage!=="done"&&<>
      <label className="field">Invited work email
        <input required type="email" maxLength={254} value={email} autoComplete="email"
          disabled={stage!=="proof"} onChange={event=>setEmail(event.target.value)}/>
      </label>
      <label className="field">Invitation code
        <input required autoComplete="off" minLength={40} maxLength={100}
          value={token} disabled={stage!=="proof"} onChange={event=>setToken(event.target.value)}/>
      </label>
    </>}
    {stage==="setup"&&<>
      <section aria-label="Authenticator enrollment">
        <h2>Set up your authenticator</h2>
        <p>In your authenticator app, add an account manually and enter this private setup key. Do not share it.</p>
        <output className="mfa-secret" aria-label="Authenticator setup key">{secret}</output>
        <p>This key is shown only during the invitation process. It will not be emailed.</p>
      </section>
      <label className="field">Create password (14 characters minimum)
        <input required minLength={14} type="password" autoComplete="new-password"
          value={password} onChange={event=>setPassword(event.target.value)}/>
      </label>
      <label className="field">Current authenticator code
        <input required inputMode="numeric" maxLength={6} pattern="[0-9]{6}"
          autoComplete="one-time-code" value={totp}
          onChange={event=>setTotp(event.target.value.replace(/\D/g,""))}/>
      </label>
    </>}
    {!!message&&<p role="status" className={uncertain?"error":undefined}>{message}</p>}
    {stage!=="done"&&!uncertain&&<button className="primary" type="submit"
      disabled={busy||stage==="setup"&&(password.length<14||totp.length!==6)}>
      {busy?"Verifying…":stage==="proof"?"Verify invitation":"Activate staff account"}
    </button>}
    {uncertain&&<p>The result could have been committed. Try signing in with your new password
      and a fresh authenticator code before requesting further help.</p>}
    <a href="/admin/login">Return to staff sign in</a>
  </form>;
}
