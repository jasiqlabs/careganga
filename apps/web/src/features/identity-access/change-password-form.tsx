"use client";
import {FormEvent,useState} from "react";
import {useRouter} from "next/navigation";
export function ChangePasswordForm(){
  const router=useRouter();
  const [oldPassword,setOldPassword]=useState("");
  const [newPassword,setNewPassword]=useState("");
  const [confirm,setConfirm]=useState("");
  const [visible,setVisible]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(busy)return;
    if(newPassword!==confirm){setMessage("New passwords do not match.");return;}
    if(newPassword===oldPassword){setMessage("Choose a different new password.");return;}
    setBusy(true);setMessage("");
    try{
      const response=await fetch("/api/session/password/change",{
        method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({currentPassword:oldPassword,newPassword})
      });
      const outcome=await response.json() as {message?:string};
      if(!response.ok){setMessage(outcome.message??"Password change could not be confirmed.");return;}
      setOldPassword("");setNewPassword("");setConfirm("");
      router.replace("/admin/login");router.refresh();
    }catch{setMessage("The result is uncertain. Sign out and check your new password before retrying.");}
    finally{setBusy(false);}
  }
  return <form className="form" onSubmit={submit} style={{maxWidth:"28rem"}}>
    <label className="field">Current password
      <input required type={visible?"text":"password"} autoComplete="current-password"
        value={oldPassword} onChange={e=>setOldPassword(e.target.value)}/></label>
    <label className="field">New password
      <input required type={visible?"text":"password"} autoComplete="new-password"
        minLength={8} maxLength={1024}
        value={newPassword} onChange={e=>setNewPassword(e.target.value)}/></label>
    <label className="field">Confirm new password
      <input required type={visible?"text":"password"} autoComplete="new-password"
        minLength={8} maxLength={1024}
        value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>
    <label><input type="checkbox" checked={visible} onChange={e=>setVisible(e.target.checked)}/> Show passwords</label>
    {message&&<p role="alert">{message}</p>}
    <button type="submit" className="primary" disabled={busy||newPassword.length<8||newPassword!==confirm}>
      {busy?"Changing password…":"Change password"}</button>
    <p>After changing your password, all existing sessions will be signed out.</p>
  </form>;
}
