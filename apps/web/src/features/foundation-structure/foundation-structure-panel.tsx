"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Profile={legalName:string;officialContact:string;postalAddress:string;registrationRef:string|null;
  registrationAuthority:string|null;registrationDate:string|null;version:number;updatedAt:string};
type Area={areaRef:string;level:string;name:string;parentRef:string|null;code:string|null;status:string;version:number};
type Dept={departmentRef:string;name:string;kind:string;description:string;active:boolean;version:number;
  scope:string;openingDate:string|null;parentRef:string|null;geographyRef:string|null;headAccountRef:string|null;headDisplayName:string|null};
type DeptSummary={total:number;active:number;inactive:number;committees:number};
type Officeholder={value:string;label:string};
type Participant={participationRef:string;accountRef:string;displayName:string|null;officeRole:string;activeUntil:string|null};
type Pending={method:"PATCH"|"POST";url:string;action:string;body:Record<string,unknown>;requestKey:string};
type Tab="profile"|"geography"|"departments";
const endpoint="/api/foundation";
async function json<T>(path:string,options?:RequestInit):Promise<T>{
  const response=await fetch(endpoint+path,{cache:"no-store",...options});
  const raw:unknown=await response.json().catch(()=>null);
  if(!response.ok){
    if(raw&&typeof raw==="object"&&"message" in raw&&typeof raw.message==="string")
      throw Object.assign(new Error(raw.message),{status:response.status});
    throw Object.assign(new Error("The Foundation service is unavailable."),{status:response.status});
  }
  return raw as T;
}
const requestKey=()=>crypto.randomUUID();
const initialProfile={legalName:"",officialContact:"",postalAddress:"",registrationRef:"",
  registrationAuthority:"",registrationDate:""};
const levels=["STATE","DISTRICT","SUBDIVISION","BLOCK"];
const parentLevels:Record<string,string[]>={
  STATE:[],DISTRICT:["STATE"],SUBDIVISION:["DISTRICT"],BLOCK:["DISTRICT","SUBDIVISION"]
};

export function FoundationStructurePanel({actions}:{actions:string[]}){
  const can=(permission:string)=>actions.includes(permission);
  const available:Tab[]=[
    ...(can("foundation.profile.view")?["profile" as const]:[]),
    ...(can("foundation.geography.view")?["geography" as const]:[]),
    ...(can("foundation.departments.view")?["departments" as const]:[])
  ];
  const [tab,setTab]=useState<Tab>(available[0]??"profile");
  const [profile,setProfile]=useState<Profile|null>(null);
  const [form,setForm]=useState(initialProfile);
  const [areas,setAreas]=useState<Area[]>([]);
  const [areaNextOffset,setAreaNextOffset]=useState<number|null>(null);
  const [departments,setDepartments]=useState<Dept[]>([]);
  const [departmentNextOffset,setDepartmentNextOffset]=useState<number|null>(null);
  const [departmentSummary,setDepartmentSummary]=useState<DeptSummary|null>(null);
  const [departmentEditorOpen,setDepartmentEditorOpen]=useState(false);
  const departmentDialogRef=useRef<HTMLDialogElement>(null);
  const [officeholders,setOfficeholders]=useState<Officeholder[]>([]);
  const [participants,setParticipants]=useState<Participant[]>([]);
  const [focusedDept,setFocusedDept]=useState<string|null>(null);
  const [areaRef,setAreaRef]=useState<string|null>(null);
  const [areaName,setAreaName]=useState("");
  const [areaLevel,setAreaLevel]=useState("STATE");
  const [areaParent,setAreaParent]=useState("");
  const [areaCode,setAreaCode]=useState("");
  const [areaStatus,setAreaStatus]=useState("ACTIVE");
  const [areaVersion,setAreaVersion]=useState(0);
  const [deptRef,setDeptRef]=useState<string|null>(null);
  const [deptName,setDeptName]=useState("");
  const [deptKind,setDeptKind]=useState("DEPARTMENT");
  const [deptDescription,setDeptDescription]=useState("");
  const [deptArea,setDeptArea]=useState("");
  const [deptParent,setDeptParent]=useState("");
  const [deptHead,setDeptHead]=useState("");
  const [deptOpening,setDeptOpening]=useState("");
  const [deptActive,setDeptActive]=useState(true);
  const [deptVersion,setDeptVersion]=useState(0);
  const [participantAccount,setParticipantAccount]=useState("");
  const [participantRole,setParticipantRole]=useState("");
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [notice,setNotice]=useState("");
  const [error,setError]=useState("");
  const [pending,setPending]=useState<Pending|null>(null);
  const [audit,setAudit]=useState<{title:string;events:{action:string;version:number;recordedAt:string}[]}|null>(null);
  const [exportOffset,setExportOffset]=useState<Record<string,number>>({AREAS:0,DEPARTMENTS:0});
  const [search,setSearch]=useState("");
  const [departmentKindFilter,setDepartmentKindFilter]=useState("ALL");
  const [departmentStatusFilter,setDepartmentStatusFilter]=useState("ALL");

  const reload=useCallback(async()=>{
    setLoading(true);setError("");
    const work:Promise<void>[]=[];
    if(can("foundation.profile.view"))work.push(json<{profile:Profile|null}>("/profile").then(x=>{
      setProfile(x.profile);
      setForm(x.profile?{
        legalName:x.profile.legalName,officialContact:x.profile.officialContact,
        postalAddress:x.profile.postalAddress,registrationRef:x.profile.registrationRef??"",
        registrationAuthority:x.profile.registrationAuthority??"",
        registrationDate:x.profile.registrationDate??""
      }:initialProfile);
    }).catch(error=>{setProfile(null);setForm(initialProfile);throw error;}));
    if(can("foundation.geography.view"))work.push(json<{areas:Area[];nextOffset:number|null}>("/geography")
      .then(x=>{setAreas(x.areas);setAreaNextOffset(x.nextOffset);})
      .catch(error=>{setAreas([]);setAreaNextOffset(null);throw error;}));
    if(can("foundation.departments.view"))work.push(json<{departments:Dept[];summary:DeptSummary;nextOffset:number|null}>("/departments")
      .then(x=>{setDepartments(x.departments);setDepartmentSummary(x.summary);setDepartmentNextOffset(x.nextOffset);})
      .catch(error=>{setDepartments([]);setDepartmentSummary(null);setDepartmentNextOffset(null);setFocusedDept(null);throw error;}));
    if(can("foundation.departments.assign"))work.push(json<{options:Officeholder[]}>("/officeholders/options")
      .then(x=>setOfficeholders(x.options))
      .catch(error=>{setOfficeholders([]);throw error;}));
    const results=await Promise.allSettled(work);
    if(results.some(x=>x.status==="rejected"))
      setError("Some Foundation information could not be verified. Try refreshing the section.");
    setLoading(false);
  },[actions.join(",")]);
  useEffect(()=>{void reload();},[reload]);
  useEffect(()=>{
    if(!focusedDept||!can("foundation.departments.view")){setParticipants([]);return;}
    let active=true;
    void json<{participants:Participant[]}>("/departments/"+encodeURIComponent(focusedDept)+"/participants")
      .then(result=>{if(active)setParticipants(result.participants);})
      .catch(()=>{if(active){setParticipants([]);setError("Officeholder history cannot be verified.");}});
    return()=>{active=false;};
  },[focusedDept,notice,actions.join(",")]);
  // The native modal supplies keyboard focus containment and Escape handling.
  useEffect(()=>{
    const dialog=departmentDialogRef.current;
    if(!dialog)return;
    if(departmentEditorOpen&&!dialog.open)dialog.showModal();
    if(!departmentEditorOpen&&dialog.open)dialog.close();
  },[departmentEditorOpen]);
  const eligibleParents=useMemo(()=>areas.filter(x=>parentLevels[areaLevel]?.includes(x.level)&&x.status==="ACTIVE"&&x.areaRef!==areaRef),[areas,areaLevel,areaRef]);
  const selectedDept=departments.find(x=>x.departmentRef===focusedDept);
  const label=(ref:string|null)=>ref?(officeholders.find(x=>x.value===ref)?.label??"Previously assigned account"):"None";
  const visibleAreas=areas.filter(x=>x.name.toLowerCase().includes(search.toLowerCase()));
  const visibleDepartments=departments.filter(x=>
    x.name.toLowerCase().includes(search.toLowerCase())&&
    (departmentKindFilter==="ALL"||x.kind===departmentKindFilter)&&
    (departmentStatusFilter==="ALL"||(x.active?"ACTIVE":"INACTIVE")===departmentStatusFilter));
  async function send(write:Pending){
    setBusy(true);setNotice("");setError("");setPending(write);
    try{
      await json<{status:string}>(write.url,{
        method:write.method,headers:{"Content-Type":"application/json"},body:JSON.stringify(write.body)
      });
      setPending(null);setNotice("Change confirmed.");
      if(write.action==="AREA_CREATE"||write.action==="AREA_UPDATE")resetArea();
      if(write.action==="DEPARTMENT_CREATE"||write.action==="DEPARTMENT_UPDATE")resetDepartment();
      if(write.action==="PARTICIPANT_ADD"){setParticipantAccount("");setParticipantRole("");}
      await reload();
    }catch(e){
      const status=e&&typeof e==="object"&&"status" in e?Number(e.status):503;
      setError(e instanceof Error?e.message:"The result cannot be confirmed.");
      if(status!==503)setPending(null);
    }finally{setBusy(false);}
  }
  function save(method:"POST"|"PATCH",url:string,action:string,data:Record<string,unknown>){
    if(pending||busy)return;
    const key=requestKey();
    void send({method,url,action,requestKey:key,body:{...data,requestKey:key}});
  }
  async function checkPending(){
    if(!pending)return;
    setBusy(true);setError("");
    try{
      const x=await json<{status:string}>(`/changes/${pending.action}/${pending.requestKey}`);
      if(x.status==="CONFIRMED"){
        setPending(null);setNotice("Your previous change is confirmed.");await reload();
      }else setNotice("Not confirmed. You may retry the same original request.");
    }catch(e){setError(e instanceof Error?e.message:"Confirmation is unavailable.");}
    finally{setBusy(false);}
  }
  async function loadMoreAreas(){
    if(areaNextOffset===null||busy)return;
    setBusy(true);setError("");
    try{
      const next=await json<{areas:Area[];nextOffset:number|null}>("/geography?offset="+areaNextOffset);
      setAreas(previous=>{
        const prior=new Set(previous.map(x=>x.areaRef));
        return [...previous,...next.areas.filter(x=>!prior.has(x.areaRef))];
      });
      setAreaNextOffset(next.nextOffset);
    }catch(e){setError(e instanceof Error?e.message:"Additional areas could not be loaded.");}
    finally{setBusy(false);}
  }
  async function loadMoreDepartments(){
    if(departmentNextOffset===null||busy)return;
    setBusy(true);setError("");
    try{
      const data=await json<{departments:Dept[];nextOffset:number|null}>(
        "/departments?offset="+departmentNextOffset);
      setDepartments(previous=>{
        const seen=new Set(previous.map(x=>x.departmentRef));
        return [...previous,...data.departments.filter(x=>!seen.has(x.departmentRef))];
      });
      setDepartmentNextOffset(data.nextOffset);
    }catch(e){setError(e instanceof Error?e.message:"Additional departments could not be loaded.");}
    finally{setBusy(false);}
  }
  async function showHistory(kind:"PROFILE"|"AREA"|"DEPARTMENT",ref:string,title:string){
    setError("");setAudit(null);
    try{
      const result=await json<{events:{action:string;version:number;recordedAt:string}[]}>(
        "/history/"+kind+"/"+encodeURIComponent(ref));
      setAudit({title,events:result.events});
    }catch{setError("This Foundation history cannot be verified.");}
  }
  async function downloadPage(kind:"AREAS"|"DEPARTMENTS"){
    if(busy)return;
    setBusy(true);setError("");
    try{
      const data=await json<{csv:string;filename:string;count:number;nextOffset:number|null}>(
        "/export?kind="+kind+"&offset="+exportOffset[kind]);
      const objectUrl=URL.createObjectURL(new Blob([data.csv],{type:"text/csv;charset=utf-8"}));
      const element=document.createElement("a");
      element.href=objectUrl;element.download=kind==="AREAS"?"Foundation-areas.csv":"Foundation-departments.csv";
      document.body.appendChild(element);element.click();element.remove();
      URL.revokeObjectURL(objectUrl);
      setExportOffset(old=>({...old,[kind]:data.nextOffset??0}));
      setNotice(data.nextOffset===null?
        "Exported the final page of source records.":"Exported one page. More verified records can be exported in the next page.");
    }catch{setError("Cannot confirm the Foundation export. Please try again.");}
    finally{setBusy(false);}
  }
  function resetArea(){
    setAreaRef(null);setAreaName("");setAreaLevel("STATE");setAreaParent("");setAreaCode("");setAreaStatus("ACTIVE");setAreaVersion(0);
  }
  function editArea(x:Area){
    setAreaRef(x.areaRef);setAreaName(x.name);setAreaLevel(x.level);setAreaParent(x.parentRef??"");
    setAreaCode(x.code??"");setAreaStatus(x.status);setAreaVersion(x.version);
  }
  function resetDepartment(){
    setDeptRef(null);setDeptName("");setDeptKind("DEPARTMENT");setDeptDescription("");setDeptArea("");
    setDeptParent("");setDeptHead("");setDeptOpening("");setDeptActive(true);setDeptVersion(0);
    setDepartmentEditorOpen(false);
  }
  function editDepartment(x:Dept){
    setDeptRef(x.departmentRef);setDeptName(x.name);setDeptKind(x.kind);
    setDeptDescription(x.description);setDeptArea(x.geographyRef??"");
    setDeptParent(x.parentRef??"");setDeptHead(x.headAccountRef??"");setDeptOpening(x.openingDate??"");
    setDeptActive(x.active);setDeptVersion(x.version);setFocusedDept(x.departmentRef);
    setDepartmentEditorOpen(true);
  }
  const setProfileField=(name:keyof typeof initialProfile,value:string)=>{
    setForm(previous=>({...previous,[name]:value}));
  };

  return <div className="role-workspace">
    <header className="topbar">
      <div><h1>Foundation Structure</h1><p>Official profile, geography, departments and committees</p></div>
      <button type="button" onClick={()=>void reload()} disabled={loading||busy}>Refresh actual records</button>
    </header>
    <div className="toolbar" role="tablist" aria-label="Foundation structure sections">
      {available.map(key=><button key={key} type="button" role="tab"
        aria-selected={tab===key} onClick={()=>{setTab(key);setError("");}}>
        {key==="profile"?"Foundation Profile":key==="geography"?"Geography":"Departments & Committees"}
      </button>)}
    </div>
    {loading&&<p role="status">Checking current Foundation records…</p>}
    {notice&&<p className="notice" role="status">{notice}</p>}
    {error&&<p className="error" role="alert">{error}</p>}
    {audit&&<section className="role-pane" style={{padding:"1rem"}} aria-label="Foundation change history">
      <div className="toolbar"><h2>{audit.title} — history</h2>
        <button type="button" onClick={()=>setAudit(null)}>Close history</button></div>
      <ol>{audit.events.map((event,i)=><li key={event.action+"-"+event.recordedAt+"-"+i}>
        {event.action.replaceAll("_"," ").toLowerCase()} · version {event.version} ·
        {" "}{new Date(event.recordedAt).toLocaleString()}
      </li>)}</ol>
      {audit.events.length===0&&<p>No recorded changes yet.</p>}
    </section>}
    {pending&&<div className="notice" role="status">
      <p>The previous save is not confirmed. Do not submit a different request yet.</p>
      <button type="button" disabled={busy} onClick={()=>void checkPending()}>Check original request</button>
      <button type="button" disabled={busy} onClick={()=>void send(pending)}>Retry the same request</button>
    </div>}

    {tab==="profile"&&can("foundation.profile.view")&&<section className="role-pane">
      <div className="role-pane-heading"><div><h2>Official Foundation profile</h2><p>Private records; publication is controlled separately.</p></div></div>
      <form className="form" style={{padding:"1rem"}} onSubmit={event=>{
        event.preventDefault();
        save("PATCH","/profile","PROFILE_SAVE",{
          ...form,registrationRef:form.registrationRef||null,
          registrationAuthority:form.registrationAuthority||null,
          registrationDate:form.registrationDate||null,expectedVersion:profile?.version??0
        });
      }}>
        <label className="field">Legal Foundation name <input required minLength={2} maxLength={180}
          disabled={!can("foundation.profile.manage")||busy||Boolean(pending)}
          value={form.legalName} onChange={e=>setProfileField("legalName",e.target.value)}/></label>
        <label className="field">Official contact <input maxLength={180}
          disabled={!can("foundation.profile.manage")||busy||Boolean(pending)}
          value={form.officialContact} onChange={e=>setProfileField("officialContact",e.target.value)}/></label>
        <label className="field">Postal address <textarea maxLength={700}
          disabled={!can("foundation.profile.manage")||busy||Boolean(pending)}
          value={form.postalAddress} onChange={e=>setProfileField("postalAddress",e.target.value)}/></label>
        <label className="field">Registration reference <input maxLength={120}
          disabled={!can("foundation.profile.manage")||busy||Boolean(pending)}
          value={form.registrationRef} onChange={e=>setProfileField("registrationRef",e.target.value)}/></label>
        <label className="field">Registration authority <input maxLength={180}
          disabled={!can("foundation.profile.manage")||busy||Boolean(pending)}
          value={form.registrationAuthority} onChange={e=>setProfileField("registrationAuthority",e.target.value)}/></label>
        <label className="field">Registration date <input type="date"
          disabled={!can("foundation.profile.manage")||busy||Boolean(pending)}
          value={form.registrationDate} onChange={e=>setProfileField("registrationDate",e.target.value)}/></label>
        {profile&&<small>Last verified update: {new Date(profile.updatedAt).toLocaleDateString()}</small>}
        {profile&&<button type="button" onClick={()=>void showHistory("PROFILE","self","Foundation profile")}>View change history</button>}
        {can("foundation.profile.manage")&&<button className="primary" disabled={busy||Boolean(pending)}>Save official profile</button>}
      </form>
    </section>}

    {tab==="geography"&&can("foundation.geography.view")&&<section className="role-workspace">
      <div className="role-table-wrap"><div className="role-pane-heading">
        <div><h2>State, district and local areas</h2><p>Only real Foundation geography records are listed.</p></div>
      </div>
      <div className="search-row" style={{padding:"1rem"}}><label>Search areas <input
        value={search} onChange={e=>setSearch(e.target.value)} placeholder="Name"/></label></div>
      <table className="role-table"><thead><tr><th>Area</th><th>Level</th><th>Parent</th><th>Status</th><th>Action</th></tr></thead>
      <tbody>{visibleAreas.map(x=><tr key={x.areaRef}>
        <td>{x.name}</td><td>{x.level.toLowerCase()}</td>
        <td>{areas.find(a=>a.areaRef===x.parentRef)?.name??"Foundation"}</td><td>{x.status}</td>
        <td>{can("foundation.geography.manage")&&<button type="button" onClick={()=>editArea(x)}>Edit</button>} <button type="button" onClick={()=>void showHistory("AREA",x.areaRef,x.name)}>History</button></td>
      </tr>)}</tbody></table>
      {visibleAreas.length===0&&<p style={{padding:"1rem"}}>No recorded areas match the loaded filter.</p>}
      <div className="toolbar" style={{padding:"1rem"}}>
        {areaNextOffset!==null&&<button type="button" disabled={busy}
          onClick={()=>void loadMoreAreas()}>Load more verified areas</button>}
        <button type="button" disabled={busy} onClick={()=>void downloadPage("AREAS")}>
          Download verified areas {exportOffset.AREAS?"(next page)":""}</button>
      </div>
      </div>
      {can("foundation.geography.manage")&&<form className="role-pane form" style={{padding:"1rem"}} onSubmit={e=>{
        e.preventDefault();
        const body={name:areaName,level:areaLevel,parentRef:areaParent||null,code:areaCode||null,
          ...(areaRef?{status:areaStatus,expectedVersion:areaVersion}:{})};
        save(areaRef?"PATCH":"POST",areaRef?"/geography/"+areaRef:"/geography",
          areaRef?"AREA_UPDATE":"AREA_CREATE",body);
      }}>
        <h2>{areaRef?"Edit area":"Add real geography"}</h2>
        <label className="field">Level <select value={areaLevel} disabled={Boolean(areaRef)||busy||Boolean(pending)}
          onChange={e=>{setAreaLevel(e.target.value);setAreaParent("");}}>
          {levels.map(l=><option key={l} value={l}>{l.toLowerCase()}</option>)}</select></label>
        <label className="field">Area name <input required minLength={2} maxLength={100}
          value={areaName} onChange={e=>setAreaName(e.target.value)} disabled={busy||Boolean(pending)}/></label>
        {areaLevel!=="STATE"&&<label className="field">Parent location
          <select value={areaParent} required onChange={e=>setAreaParent(e.target.value)}
            disabled={busy||Boolean(pending)}>
            <option value="">Choose existing parent</option>
            {eligibleParents.map(a=><option key={a.areaRef} value={a.areaRef}>{a.name} · {a.level.toLowerCase()}</option>)}
          </select></label>}
        <label className="field">Local code (optional) <input maxLength={24}
          value={areaCode} onChange={e=>setAreaCode(e.target.value)} disabled={busy||Boolean(pending)}/></label>
        {areaRef&&<label className="field">Status <select value={areaStatus} disabled={busy||Boolean(pending)}
          onChange={e=>setAreaStatus(e.target.value)}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label>}
        <div className="toolbar"><button className="primary" disabled={busy||Boolean(pending)}>{areaRef?"Save changes":"Add area"}</button>
          {areaRef&&<button type="button" onClick={resetArea}>Cancel editing</button>}</div>
      </form>}
    </section>}

    {tab==="departments"&&can("foundation.departments.view")&&<section className="role-workspace">
      <div className="role-table-wrap"><div className="role-pane-heading"><div>
        <h2>Foundation departments & committees</h2><p>Foundation-wide records only; branch management belongs to a later stage.</p>
      </div>{can("foundation.departments.manage")&&
        <button type="button" onClick={()=>{resetDepartment();setDepartmentEditorOpen(true);}}>
          Add department / committee
        </button>}</div>
      {departmentSummary&&<div className="kpi-grid foundation-overview" aria-label="Foundation department overview">
        <div className="kpi"><span>Total records</span><strong>{departmentSummary.total}</strong></div>
        <div className="kpi"><span>Active</span><strong>{departmentSummary.active}</strong></div>
        <div className="kpi"><span>Inactive</span><strong>{departmentSummary.inactive}</strong></div>
        <div className="kpi"><span>Committees</span><strong>{departmentSummary.committees}</strong></div>
      </div>}
      <div className="search-row" style={{padding:"1rem"}}>
        <label>Search loaded departments <input
          value={search} onChange={e=>setSearch(e.target.value)} placeholder="Name"/></label>
        <label>Type <select value={departmentKindFilter} onChange={e=>setDepartmentKindFilter(e.target.value)}>
          <option value="ALL">All types</option><option value="DEPARTMENT">Departments</option>
          <option value="COMMITTEE">Committees</option></select></label>
        <label>Status <select value={departmentStatusFilter} onChange={e=>setDepartmentStatusFilter(e.target.value)}>
          <option value="ALL">All statuses</option><option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option></select></label>
      </div>
      <table className="role-table"><thead><tr><th>Name</th><th>Type</th><th>Head</th><th>Status</th><th>Action</th></tr></thead>
      <tbody>{visibleDepartments.map(x=><tr key={x.departmentRef}>
        <td>{x.name}</td><td>{x.kind.toLowerCase()}</td><td>{x.headDisplayName??(x.headAccountRef?"Previously assigned account":"Unassigned")}</td>
        <td>{x.active?"Active":"Inactive"}</td><td>
          <button type="button" onClick={()=>setFocusedDept(x.departmentRef)}>Officeholders</button>{" "}
          {can("foundation.departments.manage")&&<button type="button" onClick={()=>editDepartment(x)}>Edit</button>}
          <button type="button" onClick={()=>void showHistory("DEPARTMENT",x.departmentRef,x.name)}>History</button>
        </td>
      </tr>)}</tbody></table>
      {visibleDepartments.length===0&&<p style={{padding:"1rem"}}>No recorded departments match the loaded filter.</p>}
      <div className="toolbar" style={{padding:"1rem"}}>
        {departmentNextOffset!==null&&<button type="button" disabled={busy}
          onClick={()=>void loadMoreDepartments()}>Load more verified departments</button>}
        <button type="button" disabled={busy} onClick={()=>void downloadPage("DEPARTMENTS")}>
          Download verified departments {exportOffset.DEPARTMENTS?"(next page)":""}</button>
      </div></div>
      {can("foundation.departments.manage")&&
      <dialog ref={departmentDialogRef} className="role-drawer foundation-department-dialog"
        aria-labelledby="foundation-department-editor-title"
        onCancel={e=>{if(busy||pending)e.preventDefault();}}
        onClose={()=>resetDepartment()}>
      <form className="form" onSubmit={e=>{
        e.preventDefault();
        const existing=departments.find(x=>x.departmentRef===deptRef);
        const body={name:deptName,kind:deptKind,description:deptDescription,openingDate:deptOpening||null,
          geographyRef:deptArea||null,parentRef:deptParent||null,
          headAccountRef:can("foundation.departments.assign")?deptHead||null:existing?.headAccountRef??null,
          ...(deptRef?{expectedVersion:deptVersion,active:deptActive}:{})};
        save(deptRef?"PATCH":"POST",deptRef?"/departments/"+deptRef:"/departments",
          deptRef?"DEPARTMENT_UPDATE":"DEPARTMENT_CREATE",body);
      }}>
        <h2 id="foundation-department-editor-title">{deptRef?"Edit Foundation record":"Add Foundation department / committee"}</h2>
        <label className="field">Record type <select value={deptKind} onChange={e=>setDeptKind(e.target.value)} disabled={busy||Boolean(pending)}>
          <option value="DEPARTMENT">Department</option><option value="COMMITTEE">Committee</option></select></label>
        <label className="field">Name <input required minLength={2} maxLength={100} value={deptName}
          onChange={e=>setDeptName(e.target.value)} disabled={busy||Boolean(pending)}/></label>
        <label className="field">Description <textarea value={deptDescription} maxLength={800}
          onChange={e=>setDeptDescription(e.target.value)} disabled={busy||Boolean(pending)}/></label>
        <label className="field">Opening date <input type="date" value={deptOpening} onChange={e=>setDeptOpening(e.target.value)} disabled={busy||Boolean(pending)}/></label>
        {can("foundation.geography.view")&&<label className="field">Foundation area (optional)
          <select value={deptArea} onChange={e=>setDeptArea(e.target.value)} disabled={busy||Boolean(pending)}>
            <option value="">No specific area</option>{areas.filter(x=>x.status==="ACTIVE").map(x=><option key={x.areaRef} value={x.areaRef}>{x.name} · {x.level.toLowerCase()}</option>)}
          </select></label>}
        <label className="field">Parent department (optional)
          <select value={deptParent} onChange={e=>setDeptParent(e.target.value)} disabled={busy||Boolean(pending)}>
            <option value="">Foundation top level</option>{departments.filter(x=>x.active&&x.departmentRef!==deptRef).map(x=>
              <option key={x.departmentRef} value={x.departmentRef}>{x.name}</option>)}</select></label>
        {can("foundation.departments.assign")&&<label className="field">Head officeholder (optional)
          <select value={deptHead} onChange={e=>setDeptHead(e.target.value)} disabled={busy||Boolean(pending)}>
            <option value="">Unassigned</option>{officeholders.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></label>}
        {deptRef&&<label className="field">Status
          <select value={deptActive?"ACTIVE":"INACTIVE"} onChange={e=>setDeptActive(e.target.value==="ACTIVE")}
            disabled={busy||Boolean(pending)}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label>}
        <div className="toolbar"><button className="primary" disabled={busy||Boolean(pending)}>{deptRef?"Save department":"Add department / committee"}</button>
          <button type="button" onClick={resetDepartment} disabled={busy||Boolean(pending)}>Cancel</button></div>
      </form></dialog>}
      {focusedDept&&selectedDept&&<section className="role-pane" style={{padding:"1rem"}}>
        <h2>Officeholders — {selectedDept.name}</h2>
        <ul>{participants.map(p=><li key={p.participationRef}>{p.displayName??"Previously assigned account"} — {p.officeRole}
          {p.activeUntil?" (former)":" (active)"}
          {!p.activeUntil&&can("foundation.departments.assign")&&
            <button type="button" disabled={busy||Boolean(pending)} onClick={()=>save(
              "POST","/departments/"+focusedDept+"/participants/"+p.participationRef+"/end",
              "PARTICIPANT_END",{})}>End assignment</button>}</li>)}</ul>
        {participants.length===0&&<p>No officeholders have been recorded.</p>}
        {can("foundation.departments.assign")&&selectedDept.active&&<form className="form" onSubmit={e=>{
          e.preventDefault();save("POST","/departments/"+focusedDept+"/participants",
            "PARTICIPANT_ADD",{accountRef:participantAccount,officeRole:participantRole});
        }}>
          <label className="field">Eligible Foundation account
            <select required value={participantAccount} onChange={e=>setParticipantAccount(e.target.value)}>
              <option value="">Choose current staff account</option>
              {officeholders.map(a=><option key={a.value} value={a.value}>{a.label}</option>)}
            </select></label>
          <label className="field">Officeholder responsibility
            <input required minLength={2} maxLength={80} value={participantRole}
              onChange={e=>setParticipantRole(e.target.value)} placeholder="Chairperson, Secretary…" /></label>
          <button className="primary" disabled={busy||Boolean(pending)}>Assign officeholder</button>
        </form>}
      </section>}
    </section>}
  </div>;
}
