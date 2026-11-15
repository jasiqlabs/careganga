"use client";
import { FormEvent,useCallback,useEffect,useRef,useState } from "react";
import type { CG01AccountList,CG01AccountView,CG01AccountOption } from "@careganga/api-contracts";
type RoleOption={value:string;label:string;context:string};
type Notice={kind:"success"|"error"|"uncertain";text:string};
type Pending={kind:"assign"|"revoke"|"status"|"resend";target:CG01AccountView;status?:"ACTIVE"|"SUSPENDED"|"DEACTIVATED"};
type Editor="invite"|"detail"|null;

async function read<T>(path:string):Promise<T>{
  const response=await fetch("/api/access/"+path,{cache:"no-store",credentials:"same-origin"});
  if(!response.ok)throw new Error(response.status===401?"Session expired":
    response.status===403?"Permission denied":"Account information is temporarily unavailable");
  return response.json() as Promise<T>;
}
async function change(path:string,method:string,payload:object):Promise<unknown>{
  let response:Response;
  try{response=await fetch("/api/access/"+path,{
    method,headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify(payload)
  });}catch{throw new Error("UNKNOWN");}
  if(!response.ok){
    let info:unknown=null;try{info=await response.json();}catch{}
    const code=info&&typeof info==="object"&&"code" in info?String(info.code):"";
    if(response.status===409)throw new Error(code==="STALE_ACCOUNT"?"Account changed elsewhere. Refresh before saving.":
      code==="DUPLICATE_ACCOUNT_OR_ASSIGNMENT"?"This account or assignment already exists.":
      "This request conflicts with the current account state.");
    if(response.status===401||response.status===403)throw new Error("Permission denied or session expired");
    if(response.status===400)throw new Error("Check your entry or selected role.");
    throw new Error("UNKNOWN");
  }
  try{return await response.json() as unknown;}catch{throw new Error("UNKNOWN");}
}
export function AccountsPanel(){
  const [list,setList]=useState<CG01AccountList|null>(null);
  const [actions,setActions]=useState<string[]>([]);
  const [roles,setRoles]=useState<RoleOption[]>([]);
  const [history,setHistory]=useState<Array<{eventRef:string;occurredAt:string;actionLabel:string;outcome:string;actorDisplay:string}>|null>(null);
  const [filter,setFilter]=useState("all");
  const [query,setQuery]=useState("");
  const [applied,setApplied]=useState("");
  const [offset,setOffset]=useState(0);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState<Notice|null>(null);
  const [editor,setEditor]=useState<Editor>(null);
  const [target,setTarget]=useState<CG01AccountView|null>(null);
  const [pending,setPending]=useState<Pending|null>(null);
  const [fullName,setFullName]=useState("");
  const [email,setEmail]=useState("");
  const [phone,setPhone]=useState("");
  const [roleRef,setRoleRef]=useState("");
  const [uncertain,setUncertain]=useState(false);
  const [searchRole,setSearchRole]=useState("");
  const requestKey=useRef("");
  const generation=useRef(0);
  const roleRead=useRef(0);
  const historyRead=useRef(0);

  const purge=useCallback((message:string)=>{
    ++generation.current;++roleRead.current;++historyRead.current;setList(null);setRoles([]);setActions([]);setHistory(null);setTarget(null);
    setPending(null);setEditor(null);setLoading(false);
    setNotice({kind:"error",text:message});
  },[]);
  const load=useCallback(async(search:string,skip:number,status:string)=>{
    const seq=++generation.current;
    setLoading(true);
    try{
      const params=new URLSearchParams({search,offset:String(skip),limit:"20",status});
      const [listResponse,access]=await Promise.all([
        read<CG01AccountList>("accounts?"+params.toString()),
        read<{actions:{key:string}[]}>("effective")
      ]);
      if(seq!==generation.current)return;
      if(!listResponse||!Array.isArray(listResponse.accounts)||!access||
        !Array.isArray(access.actions))throw new Error("Invalid account response");
      setList(listResponse);setActions(access.actions.map(x=>x.key));setApplied(search);
      setOffset(skip);setFilter(status);
      setTarget(old=>listResponse.accounts.find(x=>x.accountRef===old?.accountRef)??null);
    }catch(e){
      if(seq!==generation.current)return;
      purge(e instanceof Error?e.message:"Accounts unavailable");
    }finally{if(seq===generation.current)setLoading(false);}
  },[purge]);
  useEffect(()=>{void load("",0,"all");},[load]);
  useEffect(()=>{
    const onFocus=()=>{if(document.visibilityState==="visible")void load(applied,offset,filter);};
    window.addEventListener("focus",onFocus);
    return()=>window.removeEventListener("focus",onFocus);
  },[load,applied,offset,filter]);
  const canInvite=actions.includes("accounts.invite")&&actions.includes("roles.assign");
  const canAssign=actions.includes("roles.assign");
  const canStatus=actions.includes("accounts.status.manage");
  async function roleSearch(value:string){
    const generationBefore=generation.current,request=++roleRead.current;
    try{
      const params=new URLSearchParams({search:value});
      const result=await read<{options:RoleOption[]}>("roles/options?"+params.toString());
      if(request!==roleRead.current||generationBefore!==generation.current)return;
      if(!Array.isArray(result.options))throw new Error("Invalid role response");
      setRoles(result.options.filter(x=>x.context==="Foundation"));
    }catch(e){
      if(request!==roleRead.current||generationBefore!==generation.current)return;
      setRoles([]);
      if(e instanceof Error&&/session expired|permission denied/i.test(e.message))purge(e.message);
      else setNotice({kind:"error",text:"Eligible roles are temporarily unavailable."});
    }
  }
  function openInvite(){
    ++roleRead.current;++historyRead.current;
    setEditor("invite");setPending(null);setHistory(null);setFullName("");setEmail("");setPhone("");setRoleRef("");
    setSearchRole("");setNotice(null);requestKey.current=crypto.randomUUID();
    void roleSearch("");
  }
  function openAccount(row:CG01AccountView){
    ++roleRead.current;++historyRead.current;
    setEditor("detail");setTarget(row);setHistory(null);setPending(null);setRoleRef(row.roleRef??"");
    setNotice(null);requestKey.current=crypto.randomUUID();
    if(canAssign)void roleSearch("");
  }
  async function loadAccountHistory(accountRef:string){
    if(!actions.includes("access.audit.view"))return;
    const generationBefore=generation.current,request=++historyRead.current;
    try{
      const result=await read<{events:{eventRef:string;occurredAt:string;actionLabel:string;outcome:string;actorDisplay:string}[]}>(
        "audit?limit=30&targetRef="+encodeURIComponent(accountRef));
      if(request!==historyRead.current||generationBefore!==generation.current)return;
      if(!Array.isArray(result.events))throw new Error("Invalid history response");
      setHistory(result.events);
    }catch(error){
      if(request!==historyRead.current||generationBefore!==generation.current)return;
      setHistory(null);
      if(error instanceof Error&&/session expired|permission denied/i.test(error.message))
        purgeProtectedHistory(error.message);
      else setNotice({kind:"error",text:"Access history could not be verified."});
    }
  }
  function purgeProtectedHistory(message:string){purge(message);}
  async function submitInvite(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(!canInvite||busy||uncertain||!roleRef)return;
    setBusy(true);setNotice(null);
    try{
      await change("invitations","POST",{displayName:fullName.trim(),email:email.trim().toLowerCase(),
        phone:phone.trim(),roleRef,requestKey:requestKey.current});
      setEditor(null);setNotice({kind:"success",text:
        "Invitation saved. Email delivery is not guaranteed; check the account's delivery status."});
      requestKey.current="";await load(applied,0,filter);
    }catch(e){
      if(e instanceof Error&&e.message==="UNKNOWN")setUncertain(true);
      if(e instanceof Error&&/session expired|permission denied/i.test(e.message))purge(e.message);
      else setNotice({kind:e instanceof Error&&e.message==="UNKNOWN"?"uncertain":"error",
        text:e instanceof Error&&e.message==="UNKNOWN"?"The invitation result is unknown. Refresh before another attempt.":
          e instanceof Error?e.message:"Invitation could not be confirmed."});
    }finally{setBusy(false);}
  }
  async function submitChange(){
    if(!pending||busy||uncertain)return;
    const choice=pending;setBusy(true);setNotice(null);
    const key=requestKey.current||crypto.randomUUID();requestKey.current=key;
    try{
      const path="accounts/"+choice.target.accountRef;
      if(choice.kind==="assign"){
        if(!roleRef)return;
        await change(path+"/role","PUT",{roleRef,expectedRevision:choice.target.revision,requestKey:key});
      }else if(choice.kind==="resend"){
        await change(path+"/invitation/resend","POST",{expectedRevision:choice.target.revision,requestKey:key});
      }else if(choice.kind==="revoke"){
        await change(path+"/role","DELETE",{expectedRevision:choice.target.revision,requestKey:key});
      }else if(choice.status){
        await change(path+"/status","PATCH",{status:choice.status,
          expectedRevision:choice.target.revision,requestKey:key});
      }
      setPending(null);setEditor(null);setNotice({kind:"success",text:"Account change confirmed."});
      requestKey.current="";await load(applied,offset,filter);
    }catch(e){
      if(e instanceof Error&&e.message==="UNKNOWN")setUncertain(true);
      if(e instanceof Error&&/session expired|permission denied/i.test(e.message))purge(e.message);
      else setNotice({kind:e instanceof Error&&e.message==="UNKNOWN"?"uncertain":"error",
        text:e instanceof Error&&e.message==="UNKNOWN"?"Could not confirm the result. Refresh before retrying.":
          e instanceof Error?e.message:"Account change could not be confirmed."});
    }finally{setBusy(false);}
  }
  const stats=list?.summary;
  const values=[
    ["Total Accounts",stats?.total],["Active",stats?.active],
    ["Invited",stats?.invited],["Suspended",stats?.suspended],
    ["Deactivated",stats?.deactivated],["Assigned Roles",stats?.assigned]
  ] as const;
  return <div className="role-workspace">
    <header className="topbar"><div><h1>Users Management</h1>
      <p>Foundation staff accounts and verified access</p></div>
      <div className="toolbar">{canInvite&&<button type="button" className="primary"
        onClick={openInvite}>Add staff</button>}</div>
    </header>
    <form className="search-row" onSubmit={event=>{
      event.preventDefault();void load(query.trim(),0,filter);
    }}>
      <label htmlFor="account-search">Search accounts</label>
      <input id="account-search" value={query} onChange={event=>setQuery(event.target.value)}
        maxLength={80} placeholder="Name or email" autoComplete="off"/>
      <button type="submit" disabled={loading}>Search</button>
      <button type="button" disabled={loading} onClick={()=>{
        setQuery("");void load("",0,"all");
      }}>Clear filters</button>
    </form>
    <section className="kpi-grid" aria-label="Current Foundation staff accounts">
      {values.map(([label,value])=><div className="kpi" key={label}>
        <small>{label}</small><strong>{value??"—"}</strong>
      </div>)}
    </section>
    <div className="toolbar" role="group" aria-label="Account status">
      {(["all","ACTIVE","INVITED","SUSPENDED","DEACTIVATED"] as const).map(s=>
        <button type="button" aria-pressed={filter===s} key={s} disabled={loading}
          onClick={()=>void load(applied,0,s)}>{s==="all"?"All":s==="ACTIVE"?"Active":
          s==="INVITED"?"Invited":s==="SUSPENDED"?"Suspended":"Deactivated"}</button>)}
    </div>
    {notice&&<p role={notice.kind==="success"?"status":"alert"} className={"notice "+notice.kind}>
      {notice.text}</p>}
    {uncertain&&<button type="button" onClick={()=>{
      setUncertain(false);setPending(null);setEditor(null);void load(applied,offset,filter);
    }}>Refresh account status before trying again</button>}
    {loading?<p role="status">Verifying staff accounts…</p>:
      list&&!list.accounts.length?<section className="role-empty"><h2>No accounts match</h2>
        <p>Try another search or status. No sample staff records are shown.</p></section>:
      list&&<section className="role-table-wrap" aria-label="Foundation staff directory">
        <table className="role-table">
          <thead><tr><th>Name and contact</th><th>Current role</th><th>Status</th>
            <th>Invitation delivery</th><th>Actions</th></tr></thead>
          <tbody>{list.accounts.map(row=><tr key={row.accountRef}>
            <td><strong>{row.displayName}</strong><p>{row.email}</p></td>
            <td>{row.roleName??"Not assigned"}</td>
            <td><span className={"account-status "+row.status.toLowerCase()}>{row.status[0]+row.status.slice(1).toLowerCase()}</span></td>
            <td>{row.deliveryStatus??"Not applicable"}</td>
            <td><button type="button" onClick={()=>openAccount(row)}>View details</button></td>
          </tr>)}</tbody>
        </table>
      </section>}
    {list&&list.total>20&&<div className="toolbar" aria-label="Account pages">
      <button type="button" disabled={loading||offset===0}
        onClick={()=>void load(applied,Math.max(0,offset-20),filter)}>Previous</button>
      <span>Showing {offset+1}–{Math.min(offset+20,list.total)} of {list.total}</span>
      <button type="button" disabled={loading||offset+20>=list.total}
        onClick={()=>void load(applied,offset+20,filter)}>Next</button>
    </div>}
    {(editor||pending)&&<div className="drawer-backdrop" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="account-drawer-title"
        className="role-drawer">
        <header className="topbar"><h2 id="account-drawer-title">
          {editor==="invite"?"Add New Staff Account":pending?"Confirm account change":"Account details"}
        </h2><button type="button" disabled={busy} onClick={()=>{
          setEditor(null);setPending(null);
        }}>Close</button></header>
        {editor==="invite"&&<form className="form" onSubmit={event=>void submitInvite(event)}>
          <label className="field">Full name<input required maxLength={160}
            value={fullName} onChange={event=>setFullName(event.target.value)}/></label>
          <label className="field">Work email<input required type="email" maxLength={254}
            value={email} onChange={event=>setEmail(event.target.value)}/></label>
          <label className="field">Phone (optional, unverified)
            <input type="tel" placeholder="+91..." value={phone} maxLength={16}
              onChange={event=>setPhone(event.target.value)}/>
          </label>
          <p>Area level: Foundation (organization-wide)</p>
          <label className="field">Find an eligible role<input value={searchRole} maxLength={80}
            onChange={event=>setSearchRole(event.target.value)}/></label>
          <button type="button" onClick={()=>void roleSearch(searchRole)}>Find roles</button>
          <label className="field">Assign role<select value={roleRef} required
            onChange={event=>setRoleRef(event.target.value)}>
            <option value="">Choose a role explicitly</option>
            {roles.map(role=><option key={role.value} value={role.value}>{role.label}</option>)}
          </select></label>
          <p>No temporary password is emailed. The invited person sets up their own password and authenticator.</p>
          <div className="toolbar"><button type="button" onClick={()=>setEditor(null)}>Cancel</button>
            <button type="submit" className="primary" disabled={busy||uncertain||!roleRef}>
              {busy?"Saving…":"Create invitation"}
            </button></div>
        </form>}
        {editor==="detail"&&target&&!pending&&<div className="form">
          <h3>{target.displayName}</h3><p>{target.email}</p>
          {target.phone&&<p>Phone (unverified): {target.phone}</p>}
          <p>Status: {target.status}</p>
          <p>Current role: {target.roleName??"Not assigned"}</p>
          <p>Foundation scope · Invitation: {target.deliveryStatus??"Not applicable"}</p>
          {actions.includes("access.audit.view")&&<button type="button"
            onClick={()=>void loadAccountHistory(target.accountRef)}>View access history</button>}
          {history&&<section aria-label="Account access history">
            <h3>Recent access history</h3>
            {!history.length&&<p>No account access events found in the selected period.</p>}
            {history.map(e=><p key={e.eventRef}>
              {e.actionLabel} · {e.outcome} · {e.actorDisplay} · {new Date(e.occurredAt).toLocaleString()}
            </p>)}
          </section>}
          {target.roleProtected?<p>This protected administrator cannot be changed here.</p>:<>
            {target.status==="INVITED"&&canInvite&&<button type="button" onClick={()=>{
              requestKey.current=crypto.randomUUID();setPending({kind:"resend",target});
            }}>Resend invitation</button>}
            {canAssign&&<div className="form">
              <label className="field">Find eligible roles<input maxLength={80}
                value={searchRole} onChange={event=>setSearchRole(event.target.value)}/></label>
              <button type="button" onClick={()=>void roleSearch(searchRole)}>Find roles</button>
              <label className="field">Role<select value={roleRef}
                onChange={event=>setRoleRef(event.target.value)}>
                <option value="">Choose a custom role</option>
                {roles.map(role=><option key={role.value} value={role.value}>{role.label}</option>)}
              </select></label>
              <button type="button" disabled={!roleRef||roleRef===target.roleRef} onClick={()=>{
                setPending({kind:"assign",target});requestKey.current=crypto.randomUUID();
              }}>Assign chosen role</button>
              {target.roleRef&&<button type="button" onClick={()=>{
                setPending({kind:"revoke",target});requestKey.current=crypto.randomUUID();
              }}>Revoke current role</button>}
            </div>}
            {canStatus&&target.status!=="INVITED"&&target.status!=="DEACTIVATED"&&<div className="toolbar">
              {target.status==="ACTIVE"?<button type="button" onClick={()=>{
                setPending({kind:"status",target,status:"SUSPENDED"});requestKey.current=crypto.randomUUID();
              }}>Suspend account</button>:<button type="button" onClick={()=>{
                setPending({kind:"status",target,status:"ACTIVE"});requestKey.current=crypto.randomUUID();
              }}>Reactivate account</button>}
              <button type="button" onClick={()=>{
                setPending({kind:"status",target,status:"DEACTIVATED"});requestKey.current=crypto.randomUUID();
              }}>Deactivate account</button>
            </div>}
          </>}
        </div>}
        {pending&&<div className="form">
          <p>Confirm the {pending.kind==="assign"?"role assignment":
            pending.kind==="revoke"?"role revocation":pending.kind==="resend"?"invitation resend":"account status change"} for {pending.target.displayName}.</p>
          {pending.kind==="assign"&&<p>Selected role: {roles.find(r=>r.value===roleRef)?.label??"Please choose a role"}</p>}
          {pending.kind==="status"&&<p>New status: {pending.status}</p>}
          <p>This will invalidate previously issued sessions if access changes.</p>
          <div className="toolbar"><button type="button" disabled={busy} onClick={()=>setPending(null)}>Back</button>
            <button type="button" className="primary" disabled={busy||uncertain}
              onClick={()=>void submitChange()}>{busy?"Saving…":"Confirm change"}</button>
          </div>
        </div>}
      </section>
    </div>}
  </div>;
}
