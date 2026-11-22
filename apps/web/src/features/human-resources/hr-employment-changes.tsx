"use client";
import {useCallback,useEffect,useRef,useState} from "react";
type Mode="own"|"manage"|"review";
type Kind="TRANSFER"|"PROMOTION"|"DEPUTATION"|"RESIGNATION"|"EXIT";
type Position={branch:string;designation:string;department?:string|null;manager?:string|null;role?:string|null};
type Item={reference:string;caseRef?:string;caseReference?:string|null;employeeName?:string;employeeReference?:string;kind:Kind;status:string;caseStatus?:string;effectiveDate:string;lastWorkingDate?:string|null;revision:number;current?:Position;proposed?:Position|null;reason?:string;proposedSalaryMinor?:number|null;canEdit?:boolean;canWithdraw?:boolean;canReview?:boolean;canApply?:boolean;canRecordClearance?:boolean;effectIssue?:string|null;form?:Partial<Form>;clearance?:{items:{kind:string;status:string}[];financeStatus:string;salaryAndDuesStatus:string}|null};
type Form={employeeReference:string;kind:Kind;effectiveDate:string;lastWorkingDate:string;branchRef:string;departmentRef:string;managerRef:string;designation:string;roleRef:string;salary:string;reason:string};
type Option={value:string;label:string};
type Employee={employeeReference:string;name:string;current:Position;hasStaffAccount:boolean};
const labels:Record<string,string>={DRAFT:"Draft",SUBMITTED:"Awaiting review",APPROVED_PENDING_EFFECT:"Approved – application pending",APPLIED:"Applied",RETURNED:"Returned",REJECTED:"Rejected",WITHDRAWN:"Withdrawn",PENDING_OWNER:"Approved – application pending",OWNER_COMPLETED:"Applied",CONFIRMED:"Confirmed",PENDING:"Pending",NOT_VERIFIED:"Not verified",NOT_AVAILABLE:"Not available"};
const kinds:Kind[]=["TRANSFER","PROMOTION","DEPUTATION","RESIGNATION","EXIT"];
const exit=(k:Kind)=>k==="EXIT"||k==="RESIGNATION";
const label=(v:string)=>labels[v]??v.toLowerCase().replaceAll("_"," ");
const blank=(mode:Mode):Form=>({employeeReference:"",kind:mode==="own"?"RESIGNATION":"TRANSFER",effectiveDate:"",lastWorkingDate:"",branchRef:"",departmentRef:"",managerRef:"",designation:"",roleRef:"",salary:"",reason:""});
const card={border:"1px solid var(--cg-border)",borderRadius:14,background:"#fff",padding:16,display:"grid",gap:12} as const;
const field={width:"100%",border:"1px solid var(--cg-border)",borderRadius:8,padding:9,boxSizing:"border-box"} as const;
const known=(e:unknown)=>!!e&&typeof e==="object"&&"status" in e&&typeof e.status==="number"&&e.status>=400&&e.status<500;
const message=(e:unknown)=>e instanceof Error?e.message:"The outcome is uncertain. Retry the same request.";
async function api<T>(path:string,body?:object):Promise<T>{
 const r=await fetch("/api/hr/"+path,{cache:"no-store",credentials:"same-origin",...(body?{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})});
 const v=await r.json().catch(()=>null);if(!r.ok)throw Object.assign(new Error(typeof v?.message==="string"?v.message:"Employment request unavailable"),{status:r.status});if(!v||typeof v!=="object")throw Error("Employment outcome not confirmed");return v as T;
}
function Options({name,value,options,onChange,empty="Select"}:{name:string;value:string;options:Option[];onChange:(v:string)=>void;empty?:string}){
 return <label>{name}<select style={field} value={value} onChange={e=>onChange(e.target.value)}><option value="">{empty}</option>{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>;
}
function PositionCard({name,value}:{name:string;value:Position}){
 return <div style={{border:"1px solid var(--cg-border)",borderRadius:9,padding:12}}><strong>{name}</strong><p>{value.designation} · {value.branch}</p>{value.department&&<p>Department: {value.department}</p>}{value.manager&&<p>Manager: {value.manager}</p>}{value.role&&<p>Role: {value.role}</p>}</div>;
}
export function HrEmploymentChanges({mode,canSelectRoles=false}:{mode:Mode;canSelectRoles?:boolean}){
 const route=mode==="own"?"me/changes":mode==="review"?"employment-change-reviews":"employment-changes";
 const [items,setItems]=useState<Item[]>([]),[linked,setLinked]=useState<boolean|null>(null),[offset,setOffset]=useState(0),[more,setMore]=useState(false);
 const [selected,setSelected]=useState<Item|null>(null),[form,setForm]=useState<Form>(()=>blank(mode)),[editing,setEditing]=useState(false);
 const [people,setPeople]=useState<Employee[]>([]),[branches,setBranches]=useState<Option[]>([]),[departments,setDepartments]=useState<Option[]>([]),[managers,setManagers]=useState<Option[]>([]),[roles,setRoles]=useState<Option[]>([]);
 const [search,setSearch]=useState(""),[roleSearch,setRoleSearch]=useState(""),[password,setPassword]=useState(""),[note,setNote]=useState(""),[clearance,setClearance]=useState("HR");
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[locked,setLocked]=useState(false);
 const pending=useRef<{path:string;body:Record<string,unknown>;decision?:boolean}|null>(null),read=useRef(0),destRead=useRef(0),peopleRead=useRef(0),roleRead=useRef(0),inflight=useRef(false);
 const update=<K extends keyof Form,>(k:K,v:Form[K])=>setForm(old=>({...old,[k]:v}));
 const refresh=useCallback(async()=>{
  const seq=++read.current;setItems([]);setError("");
  try{const x=await api<{items:Item[];linked?:boolean;hasMore?:boolean}>(route+"?offset="+offset);
   if(!Array.isArray(x.items))throw Error("Employment history unavailable");
   if(seq===read.current){setItems(x.items);setLinked(x.linked??null);setMore(x.hasMore===true);}
  }catch(e){if(seq===read.current)setError(message(e));}
 },[route,offset]);
 useEffect(()=>{void refresh();return()=>{read.current++;};},[refresh]);
 const loadPeople=useCallback(async(q:string)=>{const seq=++peopleRead.current;try{const v=await api<{items:Employee[]}>("employment-change-options/employees?search="+encodeURIComponent(q));if(seq===peopleRead.current)setPeople(v.items);}catch(e){if(seq===peopleRead.current)setError(message(e));}},[]);
 const loadRoles=useCallback(async(q:string)=>{const seq=++roleRead.current;if(!canSelectRoles)return;try{const v=await api<{options:Option[]}>("employment-change-options/roles?search="+encodeURIComponent(q));if(seq===roleRead.current)setRoles(v.options);}catch(e){if(seq===roleRead.current)setError(message(e));}},[canSelectRoles]);
 useEffect(()=>{if(mode!=="manage")return;void loadPeople("");void loadRoles("");let live=true;
  api<{items:{branchRef:string;label:string}[]}>("employment-change-options/branches").then(v=>{if(live)setBranches(v.items.map(o=>({value:o.branchRef,label:o.label})));}).catch(e=>{if(live)setError(message(e));});
  return()=>{live=false;peopleRead.current++;roleRead.current++;};
 },[mode,loadPeople,loadRoles]);
 useEffect(()=>{const seq=++destRead.current;setDepartments([]);setManagers([]);if(mode!=="manage"||!form.branchRef)return;
  api<{departments:{departmentRef:string;label:string}[];managers:{managerRef:string;label:string}[]}>("employment-change-options/destination?branchRef="+encodeURIComponent(form.branchRef)).then(v=>{if(seq===destRead.current){setDepartments(v.departments.map(o=>({value:o.departmentRef,label:o.label})));setManagers(v.managers.map(o=>({value:o.managerRef,label:o.label})));}}).catch(e=>{if(seq===destRead.current)setError(message(e));});
  return()=>{destRead.current++;};
 },[mode,form.branchRef]);
 const open=async(item:Item)=>{
  if(locked||inflight.current)return;inflight.current=true;setBusy(true);setSelected(null);setEditing(false);setError("");setNotice("");setPassword("");setNote("");
  try{const ref=mode==="review"?item.caseRef:item.reference;if(!ref)throw Error("Original request unavailable");
   const v=await api<Item>(route+"/"+encodeURIComponent(ref));if(v.reference!==item.reference)throw Error("Original request changed");setSelected(v);}
  catch(e){setError(message(e));}finally{inflight.current=false;setBusy(false);}
 };
 const start=()=>{if(locked||busy)return;setSelected(null);setForm(blank(mode));setEditing(true);setError("");setNotice("");};
 const edit=()=>{if(!selected?.canEdit||locked)return;const x=selected;setForm({...blank(mode),...x.form,employeeReference:x.employeeReference??"",kind:x.kind,effectiveDate:x.effectiveDate,lastWorkingDate:x.lastWorkingDate??"",branchRef:x.form?.branchRef??"",departmentRef:x.form?.departmentRef??"",managerRef:x.form?.managerRef??"",designation:x.form?.designation??"",roleRef:x.form?.roleRef??"",salary:x.proposedSalaryMinor==null?"":String(x.proposedSalaryMinor/100),reason:x.reason??""});setEditing(true);};
 const run=async(path?:string,body?:Record<string,unknown>,decision=false)=>{
  if(inflight.current)return;let cmd=pending.current;if(!cmd){if(!path||!body)return;cmd={path,body,decision};pending.current=cmd;}
  if(cmd.decision&&!password){setError("Confirm with your current password.");return;}
  inflight.current=true;setBusy(true);setError("");setNotice("");
  try{const v=await api<Record<string,unknown>>(cmd.path,{...cmd.body,...(cmd.decision?{currentPassword:password}:{})});
   if(!v.reference&&v.withdrawn!==true&&v.recorded!==true&&v.applied!==true&&v.confirmed!==true)throw Error("Outcome not confirmed");
   pending.current=null;setLocked(false);setPassword("");setNote("");setSelected(null);setEditing(false);setForm(blank(mode));await refresh();setNotice("Request updated. Current status is shown in the list.");
  }catch(e){setError(message(e));setPassword("");if(known(e)){pending.current=null;setLocked(false);}else setLocked(true);}
  finally{inflight.current=false;setBusy(false);}
 };
 const save=()=>{
  if(!form.reason.trim()||!form.effectiveDate||(mode==="manage"&&!form.employeeReference)||(!exit(form.kind)&&(!form.branchRef||!form.designation.trim()))||(exit(form.kind)&&!form.lastWorkingDate)){setError("Complete the required employment details.");return;}
  const amount=form.salary.trim()?Math.round(Number(form.salary)*100):null;
  if(amount!==null&&(!Number.isSafeInteger(amount)||amount<=0)){setError("Enter a valid proposed salary.");return;}
  const payload={requestKey:crypto.randomUUID(),kind:form.kind,effectiveDate:form.effectiveDate,reason:form.reason,
   ...(mode==="manage"?{employeeReference:form.employeeReference}:{}),
   ...(exit(form.kind)?{lastWorkingDate:form.lastWorkingDate}:{branchRef:form.branchRef,departmentRef:form.departmentRef||null,managerRef:form.managerRef||null,designation:form.designation,roleRef:form.roleRef||null,proposedSalaryMinor:amount}),
   ...(selected?{expectedRevision:selected.revision}:{})};
  void run(selected?"employment-changes/"+encodeURIComponent(selected.reference)+"/edit":"employment-changes",payload);
 };
 const employee=people.find(x=>x.employeeReference===form.employeeReference);
 const chooseEmployee=(v:string)=>{const e=people.find(x=>x.employeeReference===v);setForm(x=>({...x,employeeReference:v,designation:e?.current.designation??"",branchRef:"",departmentRef:"",managerRef:"",roleRef:""}));};
 const action=(name:string)=>selected&&void run("employment-changes/"+encodeURIComponent(selected.reference)+"/"+name,{requestKey:crypto.randomUUID(),expectedRevision:selected.revision});
 return <section style={card} aria-label={mode==="own"?"My employment changes":mode==="manage"?"Employment changes":"Employment change approvals"}>
  <h2 style={{margin:0}}>{mode==="own"?"My employment changes":mode==="manage"?"Transfer, promotion & exit":"Employment change approvals"}</h2>
  <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><button disabled={busy||locked} onClick={()=>void refresh()}>Refresh</button>
   {mode!=="review"&&(mode!=="own"||linked===true)&&<button disabled={busy||locked} onClick={start}>{mode==="own"?"Request resignation":"New change"}</button>}</div>
  {mode==="own"&&linked===false&&<p>No current employment is linked to this account.</p>}
  {error&&<p role="alert" style={{color:"#991B1B"}}>{error}</p>}{notice&&<p role="status">{notice}</p>}
  {!items.length&&<p>No employment changes in this view.</p>}
  {items.map(x=><div key={x.reference} style={{borderTop:"1px solid var(--cg-border)",paddingTop:10,display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"wrap"}}><div><strong>{x.employeeName??label(x.kind)} · {x.reference}</strong><p style={{margin:"4px 0"}}>{label(x.kind)} · {x.effectiveDate} · {label(x.status)}</p></div><button disabled={busy||locked} onClick={()=>void open(x)}>View</button></div>)}
  {mode!=="own"&&<div style={{display:"flex",gap:8}}>{offset>0&&<button disabled={busy||locked} onClick={()=>setOffset(v=>Math.max(0,v-25))}>Previous</button>}{more&&<button disabled={busy||locked} onClick={()=>setOffset(v=>v+25)}>Next</button>}</div>}
  {selected&&<div style={card}>
   <strong>{selected.reference} · {label(selected.status)}</strong>
   <p>{label(selected.kind)} · Effective {selected.effectiveDate}{selected.lastWorkingDate?" · Last working "+selected.lastWorkingDate:""}</p>
   {selected.current&&<PositionCard name="Current position" value={selected.current}/>}
   {selected.proposed&&<PositionCard name="Proposed position" value={selected.proposed}/>}
   {selected.reason&&<p>Reason: {selected.reason}</p>}
   {selected.proposedSalaryMinor!=null&&<p>Confidential proposed salary: ₹{(selected.proposedSalaryMinor/100).toLocaleString("en-IN")} (proposal only, not applied to payroll)</p>}
   {selected.effectIssue&&<p role="status">{selected.effectIssue}</p>}
   {selected.clearance&&<div><h3>Exit clearance</h3>{selected.clearance.items.map(c=><p key={c.kind}>{label(c.kind)}: {label(c.status)}</p>)}<p>Finance: {label(selected.clearance.financeStatus)} · Salary and dues: {label(selected.clearance.salaryAndDuesStatus)}</p></div>}
   {!editing&&mode!=="review"&&<div style={{display:"flex",flexWrap:"wrap",gap:8}}>{selected.canEdit&&<><button disabled={busy||locked} onClick={edit}>Edit draft</button><button disabled={busy||locked} onClick={()=>action("submit")}>Submit for review</button></>}{selected.canWithdraw&&<button disabled={busy||locked} onClick={()=>action("withdraw")}>Withdraw pending request</button>}</div>}
   {mode==="manage"&&selected.canRecordClearance&&<fieldset disabled={busy||locked} style={{border:0,padding:0,display:"grid",gap:8}}>
    <Options name="Clearance" value={clearance} options={(selected.clearance?.items??[]).filter(c=>c.status!=="CONFIRMED").map(c=>({value:c.kind,label:label(c.kind)}))} onChange={setClearance}/>
    <label>Actual evidence / handover note<textarea style={field} maxLength={1000} value={note} onChange={e=>setNote(e.target.value)}/></label>
    <button disabled={note.trim().length<2||!clearance} onClick={()=>void run("employment-changes/"+encodeURIComponent(selected.reference)+"/clearance",{requestKey:crypto.randomUUID(),kind:clearance,evidenceNote:note})}>Confirm clearance</button></fieldset>}
   {mode==="review"&&selected.canReview&&<div style={{display:"grid",gap:8}}><label>Current password<input type="password" autoComplete="current-password" style={field} disabled={busy} value={password} onChange={e=>setPassword(e.target.value)}/></label><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{["APPROVE","RETURN","REJECT"].map(a=><button key={a} disabled={busy||locked||!password} onClick={()=>void run(route+"/"+selected.caseRef+"/decide",{requestKey:crypto.randomUUID(),expectedRevision:selected.revision,action:a},true)}>{label(a)}</button>)}</div></div>}
   {mode==="review"&&selected.canApply&&<button disabled={busy||locked} onClick={()=>void run(route+"/"+selected.caseRef+"/apply",{})}>{exit(selected.kind)?"Complete approved exit":"Apply approved change"}</button>}
  </div>}
  {editing&&<fieldset disabled={busy||locked} style={{...card,minWidth:0}}><legend>{selected?"Edit draft":mode==="own"?"Resignation request":"Employment change request"}</legend>
   {mode==="manage"&&<><label>Find employee<input style={field} value={search} onChange={e=>setSearch(e.target.value)} maxLength={80}/></label><button onClick={()=>void loadPeople(search)}>Search employees</button>
   <Options name="Employee" value={form.employeeReference} options={selected?[{value:form.employeeReference,label:selected.employeeName??"Selected employee"}]:people.map(e=>({value:e.employeeReference,label:e.name}))} onChange={v=>{if(!selected)chooseEmployee(v);}}/>{employee&&<PositionCard name="Current position" value={employee.current}/>}
   {!selected&&<Options name="Change type" value={form.kind} options={kinds.map(k=>({value:k,label:label(k)}))} onChange={v=>{if(kinds.includes(v as Kind))update("kind",v as Kind);}}/>}</>}
   <label>Effective date<input type="date" style={field} value={form.effectiveDate} onChange={e=>update("effectiveDate",e.target.value)}/></label>
   {exit(form.kind)?<label>Last working date<input type="date" style={field} value={form.lastWorkingDate} onChange={e=>update("lastWorkingDate",e.target.value)}/></label>:<>
    <Options name="Destination branch" value={form.branchRef} options={branches} onChange={v=>setForm(f=>({...f,branchRef:v,departmentRef:"",managerRef:""}))}/>
    <Options name="Department" value={form.departmentRef} options={departments} onChange={v=>update("departmentRef",v)} empty="None"/>
    <Options name="Manager" value={form.managerRef} options={managers} onChange={v=>update("managerRef",v)} empty="None"/>
    <label>Proposed designation<input style={field} maxLength={120} value={form.designation} onChange={e=>update("designation",e.target.value)}/></label>
    {canSelectRoles&&<><label>Find staff role<input style={field} value={roleSearch} onChange={e=>setRoleSearch(e.target.value)} maxLength={80}/></label><button onClick={()=>void loadRoles(roleSearch)}>Search roles</button><Options name="Proposed role (required for linked staff)" value={form.roleRef} options={roles} onChange={v=>update("roleRef",v)} empty="No linked staff role"/></>}
    <label>Confidential monthly salary proposal (₹, optional)<input style={field} type="number" min="0" step="0.01" value={form.salary} onChange={e=>update("salary",e.target.value)}/></label>
    <small>Salary proposals are not approved payroll changes.</small></>}
   <label>Reason<textarea style={field} rows={3} maxLength={1000} value={form.reason} onChange={e=>update("reason",e.target.value)}/></label><button onClick={save}>Save draft</button><button onClick={()=>setEditing(false)}>Close form</button>
  </fieldset>}
  {locked&&<div role="alert"><p>Outcome not confirmed. Retry the same request; do not create a duplicate.</p>{pending.current?.decision&&<label>Current password<input style={field} type="password" value={password} autoComplete="current-password" onChange={e=>setPassword(e.target.value)}/></label>}<button disabled={busy||(pending.current?.decision&&!password)} onClick={()=>void run()}>Retry original request</button></div>}
 </section>;
}
