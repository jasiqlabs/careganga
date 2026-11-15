"use client";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

type Role={
  roleRef:string;name:string;description:string;colorKey:string|null;
  protected:boolean;active:boolean;revision:number;assignedCount:number;actionKeys:string[]
};
type Capability={key:string;businessLabel:string;group:string;assignable:boolean;sensitive:boolean};
type Group={group:string;actions:Capability[]};
type RoleList={roles:Role[];total:number;offset:number;limit:number};
type AuditEvent={occurredAt:string;actorDisplay:string;actionLabel:string;targetDisplay:string;outcome:string};
type FormMode="create"|"edit"|"copy";
type RoleStatus="all"|"active"|"retired";
type Notice={text:string;kind:"error"|"success"|"uncertain"};

async function read<T>(path:string):Promise<T>{
  const response=await fetch("/api/access/"+path,{cache:"no-store",credentials:"same-origin"});
  if(!response.ok)throw new Error(response.status===401?"Your session expired. Sign in again."
    :response.status===403?"You don't have permission to view this information."
    :"The information is unavailable. Try refreshing.");
  return response.json() as Promise<T>;
}
export function RolesPanel(){
  const [roles,setRoles]=useState<Role[]>([]);
  const [groups,setGroups]=useState<Group[]>([]);
  const [actions,setActions]=useState<string[]>([]);
  const [search,setSearch]=useState("");
  const [appliedSearch,setAppliedSearch]=useState("");
  const [tab,setTab]=useState<RoleStatus>("all");
  const [total,setTotal]=useState(0);
  const [offset,setOffset]=useState(0);
  const [loading,setLoading]=useState(true);
  const [notice,setNotice]=useState<Notice|null>(null);
  const [editor,setEditor]=useState<{mode:FormMode;source?:Role}|null>(null);
  const [pendingRetire,setPendingRetire]=useState<Role|null>(null);
  const [selected,setSelected]=useState<string[]>([]);
  const [name,setName]=useState("");
  const [description,setDescription]=useState("");
  const [saving,setSaving]=useState(false);
  const [history,setHistory]=useState<AuditEvent[]|null>(null);
  const [historyCursor,setHistoryCursor]=useState<string|null>(null);
  const searchInput=useRef<HTMLInputElement>(null);
  const requestKey=useRef("");
  const latestRead=useRef(0); // Older overlapping responses must never restore revoked role content.

  const load=useCallback(async(searchText:string,skip:number,status:RoleStatus="all")=>{
    const generation=++latestRead.current;
    setLoading(true);setNotice(null);
    try{
      const params=new URLSearchParams({search:searchText,limit:"30",offset:String(skip),status});
      const [list,catalog,effective]=await Promise.all([
        read<RoleList>("roles?"+params),
        read<{groups:Group[]}>("capabilities"),
        read<{actions:{key:string}[]}>("effective")
      ]);
      if(generation!==latestRead.current)return;
      setRoles(list.roles);setGroups(catalog.groups);
      setActions(effective.actions.map(x=>x.key));setTotal(list.total);
      setOffset(skip);
    }catch(e){
      if(generation!==latestRead.current)return;
      // Fail closed after revalidation failure: do not leave restricted role/audit content cached.
      setRoles([]);setGroups([]);setActions([]);setHistory(null);setHistoryCursor(null);
      setEditor(null);setPendingRetire(null);
      setNotice({kind:"error",text:e instanceof Error?e.message:"Information unavailable."});
    }finally{if(generation===latestRead.current)setLoading(false);}
  },[]);

  useEffect(()=>{void load("",0);},[load]);
  // Revalidate on focus/resume without a background polling loop.
  useEffect(()=>{
    const onFocus=()=>{if(document.visibilityState==="visible")void load(appliedSearch,offset,tab);};
    window.addEventListener("focus",onFocus);
    document.addEventListener("visibilitychange",onFocus);
    return()=>{window.removeEventListener("focus",onFocus);
      document.removeEventListener("visibilitychange",onFocus);};
  },[load,appliedSearch,offset,tab]);
  useEffect(()=>{
    const shortcut=(event:KeyboardEvent)=>{
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="k"){
        event.preventDefault();searchInput.current?.focus();
      }
    };
    document.addEventListener("keydown",shortcut);
    return()=>document.removeEventListener("keydown",shortcut);
  },[]);

  function open(mode:FormMode,source?:Role){
    if(!actions.includes("roles.manage"))return;
    if(source?.protected)return;
    setEditor({mode,source});
    setName(mode==="copy"?(source?source.name+" copy":""):source?.name??"");
    setDescription(source?.description??"");
    const allowed=new Set(groups.flatMap(x=>x.actions.filter(a=>a.assignable).map(a=>a.key)));
    setSelected(source?.actionKeys.filter(k=>allowed.has(k))??[]);
    requestKey.current=crypto.randomUUID();
    setNotice(null);
  }
  const canManage=actions.includes("roles.manage");
  const canAudit=actions.includes("access.audit.view");
  const shown=roles; // Filtering is authoritative server-side, before pagination.
  const allAssignable=groups.flatMap(g=>g.actions).filter(c=>c.assignable);

  async function mutate(path:string,method:"POST"|"PATCH",body:unknown){
    let result:Response;
    try {
      result=await fetch("/api/access/"+path,{
        method,headers:{"Content-Type":"application/json"},credentials:"same-origin",
        body:JSON.stringify(body)
      });
    } catch {
      // A dropped connection after commit is not a rejected write.
      throw new Error("UNCERTAIN");
    }
    if(!result.ok){
      if(result.status===503)throw new Error("UNCERTAIN");
      if(result.status===409){
        const data=await result.json() as {code?:string};
        const message:Record<string,string>={
          DUPLICATE_ROLE:"A role with this name already exists. Choose another name.",
          STALE_ROLE:"This role changed elsewhere. Refresh before saving.",
          ROLE_RETIRED:"This role was already retired.",
          ROLE_ASSIGNED:"Reassign assigned accounts before retiring this role.",
          REPLAY_CONFLICT:"This request reference was already used. Refresh before retrying."
        };
        throw new Error(data.code&&message[data.code]?message[data.code]:
          "This role changed elsewhere. Refresh before retrying.");
      }
      if(result.status===403)throw new Error("You don't have permission for this action.");
      if(result.status===401)throw new Error("Your session expired. Sign in again.");
      throw new Error("Check your changes and try again.");
    }
  }
  async function save(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!editor||saving)return;
    setSaving(true);setNotice(null);
    const source=editor.source;
    const payload={name:name.trim(),description:description.trim(),colorKey:"default",
      actionKeys:selected,requestKey:requestKey.current,
      ...(editor.mode!=="create"&&source?{expectedRevision:source.revision}:{})};
    const path=editor.mode==="edit"&&source?"roles/"+source.roleRef:
      editor.mode==="copy"&&source?"roles/"+source.roleRef+"/copy":"roles";
    const method=editor.mode==="edit"?"PATCH":"POST";
    try{
      await mutate(path,method,payload);
      setEditor(null);requestKey.current="";
      await load(appliedSearch,offset,tab);
      setNotice({kind:"success",text:"Role change saved."});
    }catch(error){
      if(error instanceof Error&&(error.message.includes("session expired")||error.message.includes("permission"))){
        // Permission loss invalidates all protected list and audit content.
        setRoles([]);setGroups([]);setActions([]);setHistory(null);setHistoryCursor(null);
        setEditor(null);setPendingRetire(null);
      }
      if(error instanceof Error&&error.message==="UNCERTAIN"){
        setNotice({kind:"uncertain",text:"The result could not be confirmed. Refresh the list before submitting another change."});
      }else setNotice({kind:"error",text:error instanceof Error?error.message:"Unable to save the role."});
    }finally{setSaving(false);}
  }
  async function retire(role:Role){
    if(!canManage||role.protected||role.assignedCount>0||!role.active)return;
    setSaving(true);setNotice(null);
    try{
      await mutate("roles/"+role.roleRef+"/retire","POST",{
        expectedRevision:role.revision,requestKey:crypto.randomUUID()
      });
      await load(appliedSearch,offset,tab);
      setPendingRetire(null);
      setNotice({kind:"success",text:"Role retired."});
    }catch(error){
      setNotice({kind:"error",text:error instanceof Error&&error.message==="UNCERTAIN"?
        "Could not confirm retirement. Refresh the list before retrying.":
        error instanceof Error?error.message:"Role could not be retired."});
    }finally{setSaving(false);}
  }
  async function audit(){
    setHistory(null);setNotice(null);
    try{
      const result=await read<{events:AuditEvent[];nextCursor:string|null}>("audit?limit=30");
      setHistory(result.events);setHistoryCursor(result.nextCursor);
    }catch(error){
      setNotice({kind:"error",text:error instanceof Error?error.message:"History unavailable."});
    }
  }

  async function moreHistory(){
    if(!historyCursor)return;
    try{
      const result=await read<{events:AuditEvent[];nextCursor:string|null}>(
        "audit?limit=30&cursor="+encodeURIComponent(historyCursor));
      setHistory(old=>[...(old??[]),...result.events]);
      setHistoryCursor(result.nextCursor);
    }catch{
      setNotice({kind:"error",text:"More security history could not be confirmed."});
    }
  }

  return <div className="role-workspace">
    <header className="topbar">
      <div><h1>Roles & permissions</h1><p>Foundation staff access</p></div>
      <div className="toolbar"><Link href="/admin">My account</Link><Link href="/">View site</Link></div>
    </header>
    <section aria-label="Role summary" className="kpi-grid">
      <div className="kpi"><small>Matching roles</small><strong>{total}</strong></div>
      <div className="kpi"><small>Active on this page</small><strong>{roles.filter(r=>r.active).length}</strong></div>
      <div className="kpi"><small>Protected roles</small><strong>{roles.filter(r=>r.protected).length}</strong></div>
    </section>
    <div className="toolbar">
      <form onSubmit={e=>{e.preventDefault();setAppliedSearch(search);void load(search,0,tab);}}
        className="search-row">
        <label htmlFor="role-search">Find roles</label>
        <input id="role-search" ref={searchInput} value={search} maxLength={80}
          placeholder="Search by role name (Ctrl+K)" onChange={e=>setSearch(e.target.value)}/>
        <button type="submit" disabled={loading}>Search</button>
      </form>
      {canManage&&<button type="button" className="primary" onClick={()=>open("create")}>Create role</button>}
      {canAudit&&<button type="button" onClick={()=>void audit()}>Access history</button>}
    </div>
    <div className="toolbar" role="group" aria-label="Filter roles">
      {(["all","active","retired"] as const).map(k=><button key={k} type="button"
        aria-pressed={tab===k} onClick={()=>{setTab(k);void load(appliedSearch,0,k);}}>
        {k==="all"?"All roles":k==="active"?"Active":"Retired"}</button>)}
    </div>
    {notice&&<p className={notice.kind==="error"?"error":"notice"} role={notice.kind==="error"?"alert":"status"}>{notice.text}</p>}
    {loading?<p role="status">Loading verified roles…</p>:
      !roles.length?<p>There are no matching roles available for this account.</p>:
      <div className="role-table-wrap"><table className="role-table"><thead><tr>
        <th scope="col">Role</th><th scope="col">Status</th><th scope="col">Assigned accounts</th>
        <th scope="col">Permissions</th><th scope="col">Actions</th>
      </tr></thead><tbody>{shown.map(role=><tr key={role.roleRef}>
        <td><strong>{role.name}</strong><p>{role.description}</p></td>
        <td>{role.protected?"Protected":role.active?"Active":"Retired"}</td>
        <td>{role.assignedCount}</td>
        <td>{role.protected?"Protected Foundation access":role.actionKeys.length+" allowed actions"}</td>
        <td><div className="toolbar">{canManage&&!role.protected&&role.active&&<>
          <button type="button" onClick={()=>open("edit",role)}>Edit</button>
          <button type="button" onClick={()=>open("copy",role)}>Copy</button>
          <button type="button" disabled={role.assignedCount>0||saving}
            title={role.assignedCount>0?"Reassign accounts before retiring":undefined}
            onClick={()=>setPendingRetire(role)}>Retire</button>
        </>}</div></td>
      </tr>)}</tbody></table></div>
    }
    {!loading&&total>30&&<div className="toolbar">
      <button disabled={offset<=0} onClick={()=>void load(appliedSearch,Math.max(0,offset-30),tab)}>Previous</button>
      <span>{offset+1}–{Math.min(offset+30,total)} of {total}</span>
      <button disabled={offset+30>=total} onClick={()=>void load(appliedSearch,offset+30,tab)}>Next</button>
    </div>}
    {history&&<section aria-labelledby="history-title">
      <h2 id="history-title">Foundation access history</h2>
      {!history.length?<p>No recent security events.</p>:<ul>{history.map((event,i)=>
        <li key={event.occurredAt+"-"+i}>
          <strong>{event.actionLabel}</strong> — {event.targetDisplay} ({event.outcome}).
          <small> {new Date(event.occurredAt).toLocaleString()} · {event.actorDisplay}</small>
        </li>)}</ul>}
      {historyCursor&&<button type="button" onClick={()=>void moreHistory()}>Load more history</button>}
    </section>}
    {pendingRetire&&<div className="drawer-backdrop" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="retire-role-title" className="role-drawer">
        <h2 id="retire-role-title">Retire {pendingRetire.name}?</h2>
        <p>The role will no longer be available for new assignments.</p>
        <p>Any existing assignments must be reassigned before retirement is permitted.</p>
        <div className="toolbar">
          <button type="button" disabled={saving} onClick={()=>setPendingRetire(null)}>Cancel</button>
          <button type="button" className="primary" disabled={saving}
            onClick={()=>void retire(pendingRetire)}>{saving?"Retiring…":"Confirm retirement"}</button>
        </div>
      </section>
    </div>}
    {editor&&<div className="drawer-backdrop" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="role-editor-title" className="role-drawer">
        <header className="topbar">
          <h2 id="role-editor-title">{editor.mode==="create"?"Create role":editor.mode==="edit"?"Edit role":"Copy role"}</h2>
          <button type="button" disabled={saving} onClick={()=>setEditor(null)} aria-label="Close role editor">Close</button>
        </header>
        <form className="form" onSubmit={e=>void save(e)}>
          <label className="field">Role name<input required minLength={2} maxLength={80}
            value={name} onChange={e=>setName(e.target.value)}/></label>
          <label className="field">Description<textarea maxLength={350}
            value={description} onChange={e=>setDescription(e.target.value)} rows={3}/></label>
          <p>Color: CareGanga theme default. Additional options will follow verified brand tokens.</p>
          {editor.mode==="copy"&&<p>Only permitted role actions are copied. No people or special administrator rights are copied.</p>}
          {groups.map(group=><fieldset key={group.group} className="permission-group">
            <legend>{group.group}</legend>
            {group.actions.map(cap=><label key={cap.key} className="permission-row">
              <input type="checkbox" disabled={!cap.assignable||editor.mode==="copy"}
                checked={cap.assignable&&selected.includes(cap.key)}
                onChange={e=>setSelected(prev=>e.target.checked?[...prev,cap.key]:prev.filter(k=>k!==cap.key))}/>
              <span>{cap.businessLabel}{!cap.assignable?" — Protected action":""}</span>
            </label>)}
          </fieldset>)}
          <p>{selected.filter(k=>allAssignable.some(c=>c.key===k)).length} permitted actions selected</p>
          <div className="toolbar">
            <button type="button" disabled={saving} onClick={()=>setEditor(null)}>Cancel</button>
            <button className="primary" type="submit" disabled={saving||!name.trim()}>
              {saving?"Saving…":"Save role"}
            </button>
          </div>
        </form>
      </section>
    </div>}
  </div>;
}
