"use client";
import {FormEvent,useEffect,useState} from "react";
type ErrorCopy={key:string;defaultMessage:string;effectiveMessage:string;
 revision:number;customized:boolean};
type Notice={kind:"success"|"error"|"uncertain";message:string};

/** CG-21: edits safe wording only, not auth/validation rules or internal error codes. */
export function SafeErrorMessagesEditor({canEdit}:{canEdit:boolean}){
 const [items,setItems]=useState<ErrorCopy[]>([]);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [active,setActive]=useState<ErrorCopy|null>(null);
 const [wording,setWording]=useState("");
 const [password,setPassword]=useState("");
 const [notice,setNotice]=useState<Notice|null>(null);
 const [unknown,setUnknown]=useState<{key:string;wording:string;revision:number}|null>(null);
 async function reload(){
  setLoading(true);
  try{
   const res=await fetch("/api/platform/error-messages",{cache:"no-store"});
   if(!res.ok)throw Error(res.status===401?"Sign in again to review error messages.":
    res.status===403?"Your role cannot view message settings.":
    "Message settings cannot be loaded. Check your connection and retry.");
   const data=await res.json() as {messages?:ErrorCopy[]};
   if(!Array.isArray(data.messages))throw Error("Message settings could not be confirmed.");
   setItems(data.messages);return data.messages;
  }catch(e){setNotice({kind:"error",message:e instanceof Error?e.message:
    "Message settings cannot be loaded. Please retry."});return null;}
  finally{setLoading(false);}
 }
 useEffect(()=>{void reload();},[]);
 function begin(message:ErrorCopy){
  if(!canEdit||busy||unknown)return;
  setActive(message);setWording(message.effectiveMessage);setPassword("");setNotice(null);
 }
 async function save(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!active||!canEdit||busy||unknown)return;
  const value=wording.trim();
  if(value.length<16||value.length>220||/[<>\r\n\x00-\x1f]/.test(value)||
    !/[.!?]$/.test(value)){
   setNotice({kind:"error",message:
    "Write a clear sentence of 16–220 characters that tells the person what to do next. Use plain text and ending punctuation."});return;
  }
  if(value===active.effectiveMessage){
   setNotice({kind:"error",message:"This wording is already in use. Change the message before saving."});return;
  }
  if(password.length<8){
   setNotice({kind:"error",message:"Enter your current sign-in password to authorize this change."});return;
  }
  setBusy(true);setNotice(null);
  try{
   const res=await fetch("/api/platform/error-messages",{
    method:"PATCH",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({key:active.key,message:value,expectedRevision:active.revision,
      currentPassword:password,requestKey:crypto.randomUUID()})
   });
   if(!res.ok){
    if(res.status>=500)throw Error("UNCONFIRMED");
    const safe:unknown=await res.json().catch(()=>null);
    const exact=safe&&typeof safe==="object"&&!Array.isArray(safe)&&
      "message" in safe&&typeof safe.message==="string"&&safe.message.length<=220?
      safe.message:null;
    setNotice({kind:"error",message:exact??(res.status===409?
     "This wording changed while you edited it. Refresh the list before trying again.":
     res.status===401||res.status===403?
     "Your session or permission cannot authorize this change. Sign in and ask the Foundation Administrator.":
     "Review the replacement sentence and current password, then try again.")});return;
   }
   const updated=await res.json() as {revision?:number};
   if(!Number.isInteger(updated.revision))throw Error("UNCONFIRMED");
   const latest=await reload();
   if(!latest||!latest.some(item=>item.key===active.key&&
      item.effectiveMessage===value&&item.revision>=Number(updated.revision)))
     throw Error("UNCONFIRMED");
   setActive(null);setPassword("");
   setNotice({kind:"success",message:
     "The updated wording was saved. New matching errors will use it after a short cache refresh (up to one minute)."});
  }catch{
   setUnknown({key:active.key,wording:value,revision:active.revision});
   setNotice({kind:"uncertain",message:
    "The save result could not be confirmed. Check the current published wording before making another change."});
  }finally{setBusy(false);}
 }
 async function check(){
  if(!unknown||busy)return;
  const latest=await reload();if(!latest)return;
  const found=latest.find(item=>item.key===unknown.key);
  if(found&&found.effectiveMessage===unknown.wording&&found.revision>unknown.revision){
   setUnknown(null);setActive(null);setPassword("");
   setNotice({kind:"success",message:"The original message update was confirmed."});
  }else setNotice({kind:"uncertain",message:
   "The original change is not confirmed. Do not resubmit blindly; contact your Foundation Administrator if this persists."});
 }
 return <section className="role-pane" aria-label="User-facing error wording">
  <div className="role-pane-heading"><div><h2>User-facing Error Messages</h2>
   <p>Customize clear guidance without changing validation, security or accounting rules.</p></div>
   <button type="button" disabled={loading||busy} onClick={()=>void reload()}>Refresh</button>
  </div>
  {notice&&<p className={"notice "+notice.kind} role={notice.kind==="success"?"status":"alert"}>{notice.message}</p>}
  {unknown&&<div className="permission-group"><p>A prior message change needs confirmation.</p>
   <button type="button" onClick={()=>void check()} disabled={busy}>Check original change</button></div>}
  {loading?<p className="role-detail-content" role="status">Loading approved message wording…</p>:
   <div className="role-detail-content">
    <p>Each message should say what happened and what the person should do next. Account existence, credentials and technical diagnostic details must remain private.</p>
    <div className="cg-fin-table-wrap"><table className="cg-fin-table"><thead><tr>
     <th>User-facing message</th><th>Wording</th><th>Action</th></tr></thead>
     <tbody>{items.map(item=><tr key={item.key}>
      <td><strong>{item.defaultMessage}</strong></td>
      <td><span className={"cg-fin-status "+(item.customized?"is-active":"")}>
       {item.customized?"Customized":"Default"}</span>
       <p>{item.effectiveMessage}</p></td>
      <td>{canEdit?<button type="button" disabled={busy||Boolean(unknown)}
       onClick={()=>begin(item)}>Edit wording</button>:<span>View only</span>}</td>
     </tr>)}</tbody></table></div>
   </div>}
  {active&&<div className="drawer-backdrop" role="presentation">
   <div className="role-drawer cg-fin-drawer" role="dialog" aria-modal="true"
    aria-labelledby="cg-error-editor-title">
    <div className="cg-fin-drawer-header"><h2 id="cg-error-editor-title">Edit User Guidance</h2>
     <button disabled={busy||Boolean(unknown)} type="button" onClick={()=>setActive(null)}
      aria-label="Close editor">×</button></div>
    <p>Original guidance: {active.defaultMessage}</p>
    <form className="cg-fin-form" onSubmit={save}>
     <label className="cg-fin-field">Replacement wording
      <textarea maxLength={220} minLength={16} required rows={4} value={wording}
       onChange={e=>setWording(e.target.value)} />
     </label>
     <p className="cg-fin-help">Make the message specific and helpful. Do not include account identifiers, internal codes, or sensitive information. Editing never changes what the system validates.</p>
     <label className="cg-fin-field">Your current password (required to confirm)
      <input type="password" required minLength={8} autoComplete="current-password"
       value={password} onChange={e=>setPassword(e.target.value)}/>
     </label>
     <div className="cg-fin-form-actions">
      <button type="button" disabled={busy||Boolean(unknown)} onClick={()=>setActive(null)}>Cancel</button>
      <button type="submit" disabled={busy||Boolean(unknown)} className="primary">
       {busy?"Saving…":"Save wording"}</button>
     </div>
    </form>
   </div>
  </div>}
 </section>;
}
