"use client";
import {useCallback,useEffect,useRef,useState,type FormEvent} from "react";
import {HrEvidenceUploader} from "./hr-evidence-uploader";
import {HrPrivateDetails} from "./hr-private-details";

type Choice={label:string;branchRef?:string;departmentRef?:string;managerRef?:string;accountRef?:string;geography?:string};
type RoleChoice={value:string;label:string;context:string};
type Application={applicationRef:string;reference:string;name:string;designation:string;
 employmentType:string;branchRef:string;departmentRef:string|null;
 managerRef:string|null;roleRef:string|null;accountRef:string|null;
 hireDate:string;revision:number;status:string};
type Draft={name:string;designation:string;employmentType:string;
 branchRef:string;departmentRef:string;managerRef:string;roleRef:string;accountRef:string;hireDate:string};
const blank=():Draft=>({name:"",designation:"",employmentType:"FULL_TIME",
 branchRef:"",departmentRef:"",managerRef:"",roleRef:"",accountRef:"",hireDate:""});
type Result={message:string;error:boolean};
const fieldStyle={display:"grid",gap:".35rem",fontWeight:600,fontSize:".91rem"} as const;
const inputStyle={padding:".78rem",border:"1px solid #CBD5E1",borderRadius:"10px",
 fontSize:"1rem",background:"#fff",width:"100%",minWidth:0} as const;
const buttonStyle={border:0,borderRadius:"10px",padding:".85rem 1.15rem",
 background:"#087F8C",color:"#fff",fontWeight:700,cursor:"pointer"} as const;
async function request(path:string,init?:RequestInit):Promise<unknown>{
 const response=await fetch("/api/hr/"+path,{...init,cache:"no-store",credentials:"same-origin",
  headers:{"Content-Type":"application/json",...init?.headers}});
 const obj:unknown=await response.json().catch(()=>null);
 if(!response.ok){
  const text=obj&&typeof obj==="object"&&"message" in obj&&
    typeof obj.message==="string"?obj.message:"Employee information cannot be confirmed.";
  throw Error(text);
 }
 return obj;
}
function isApps(x:unknown):x is {items:Application[];hasMore:boolean}{
 return Boolean(x)&&typeof x==="object"&&"items" in x&&
  Array.isArray((x as {items:unknown}).items);
}
function isChoices(x:unknown):x is {items:Choice[]} {
 return Boolean(x)&&typeof x==="object"&&"items" in x&&
  Array.isArray((x as {items:unknown}).items);
}
export function HrEnrollmentWorkspace({canViewApps,canManage,canViewEmployees,canSelectAccounts,canSelectRoles,canViewPrivate,canManagePrivate}:{
  canViewApps:boolean;canManage:boolean;canViewEmployees:boolean;canSelectAccounts:boolean;
  canSelectRoles:boolean;canViewPrivate:boolean;canManagePrivate:boolean}){
 const [apps,setApps]=useState<Application[]>([]);
 const [branches,setBranches]=useState<Choice[]>([]);
 const [departments,setDepartments]=useState<Choice[]>([]);
 const [managers,setManagers]=useState<Choice[]>([]);
 const [accounts,setAccounts]=useState<Choice[]>([]);
 const [roles,setRoles]=useState<RoleChoice[]>([]);
 const [form,setForm]=useState<Draft>(blank);
 const [selected,setSelected]=useState<Application|null>(null);
 const [status,setStatus]=useState<Result|null>(null);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [offset,setOffset]=useState(0);
 const [hasMore,setHasMore]=useState(false);
 const [requestKey,setRequestKey]=useState(()=>crypto.randomUUID());
 const [attempt,setAttempt]=useState<string|null>(null);
 const [fileApplication,setFileApplication]=useState<Application|null>(null);
 const [caseStatus,setCaseStatus]=useState<{status:string;caseRef:string|null;reference:string|null}|null>(null);
 const [staff,setStaff]=useState<Array<{reference:string;name:string;designation:string;
  branch:string;status:string}>>([]);
 const [staffError,setStaffError]=useState("");
 const [employeeDetail,setEmployeeDetail]=useState<{reference:string;name:string;designation:string;
  employmentType:string;branch:string;department:string|null;manager:string|null;
  status:string;effectiveFrom:string;effectiveTo:string|null}|null>(null);
 const [detailBusy,setDetailBusy]=useState(false);
 const [headcounts,setHeadcounts]=useState<{total:number;statuses:Record<string,number>}|null>(null);
 const [empBranches,setEmpBranches]=useState<Choice[]>([]);
 const [empDepartments,setEmpDepartments]=useState<Choice[]>([]);
 const [empFilter,setEmpFilter]=useState({q:"",status:"ALL",branch:"",department:""});
 const [empOffset,setEmpOffset]=useState(0);
 const [empMore,setEmpMore]=useState(false);
 const enrollmentKeys=useRef(new Map<string,string>());
 const load=useCallback(async(page=0)=>{
  if(!canViewApps){setLoading(false);setApps([]);return;}
  setLoading(true);
  try{
   const [records,opts]=await Promise.all([
    request("applications?offset="+page),
    request("branch-options")
   ]);
   if(!isApps(records)||!isChoices(opts))throw Error("Employee data format is unavailable.");
   setApps(records.items);setHasMore(records.hasMore);setBranches(opts.items);
   setOffset(page);setStatus(null);
  }catch(e){
   setApps([]);setHasMore(false);setBranches([]);
   setStatus({message:e instanceof Error?e.message:"Employee data cannot be loaded",error:true});
  }finally{setLoading(false);}
 },[canViewApps]);
 useEffect(()=>{if(canViewApps)void load(0);},[load,canViewApps]);
 useEffect(()=>{
  let active=true;
  setDepartments([]);setManagers([]);
  if(!canViewApps||!form.branchRef)return;
  void Promise.all([request("departments?branch="+encodeURIComponent(form.branchRef)),
    request("managers?branch="+encodeURIComponent(form.branchRef))])
   .then(([d,m])=>{if(active){if(isChoices(d))setDepartments(d.items);
     if(isChoices(m))setManagers(m.items);}})
   .catch(()=>{if(active)setStatus({message:"Department options are unavailable.",error:true});});
  return()=>{active=false;};
 },[form.branchRef,canViewApps]);
 useEffect(()=>{
  if(!canViewApps||!canSelectAccounts||!canManage)return;
  let live=true;
  void request("account-options?search=").then(v=>{
   if(live&&isChoices(v))setAccounts(v.items);
  }).catch(()=>{if(live)setAccounts([]);});
  return()=>{live=false;};
 },[canViewApps,canSelectAccounts,canManage]);
 useEffect(()=>{
  if(!canViewApps||!canManage||!canSelectRoles)return;
  let alive=true;
  void request("role-options?search=").then(v=>{
   if(alive&&v&&typeof v==="object"&&"options" in v&&Array.isArray(v.options))
    setRoles(v.options as RoleChoice[]);
  }).catch(()=>{if(alive)setRoles([]);});
  return()=>{alive=false;};
 },[canViewApps,canManage,canSelectRoles]);
 const review=useCallback(async(app:Application)=>{
  setFileApplication(app);setCaseStatus(null);setStatus(null);
  try{
   const current=await request("applications/"+app.applicationRef+"/review");
   if(!current||typeof current!=="object"||!("status" in current)||
    typeof current.status!=="string")
    throw Error("Original enrollment status could not be confirmed.");
   setCaseStatus(current as {status:string;caseRef:string|null;reference:string|null});
  }catch(e){
   setStatus({error:true,message:e instanceof Error?e.message:
    "Original enrollment status is unavailable."});
  }
 },[]);
 const submit=async(app:Application)=>{
  if(busy||!canManage)return;
  setBusy(true);setStatus(null);
  const key=enrollmentKeys.current.get(app.applicationRef)??crypto.randomUUID();
  enrollmentKeys.current.set(app.applicationRef,key);
  try{
   const list=await fetch("/api/hr-evidence/applications/"+app.applicationRef,{
    credentials:"same-origin",cache:"no-store"}).then(async r=>{
     if(!r.ok)throw Error("Original private evidence cannot be verified.");
     return r.json() as Promise<unknown>;
    });
   const items=list&&typeof list==="object"&&"files" in list&&Array.isArray(list.files)?
    list.files as Array<{fileRef:string;fileVersion:number;classification:string;
      sourceVersion:number;cleanVerified:boolean}>:[];
   const proof=items.filter(x=>x.cleanVerified&&x.sourceVersion===app.revision);
   if(proof.filter(x=>x.classification==="HR_IDENTITY_PROOF").length!==1)
    throw Error("Exactly one original clean identity proof is required.");
   const result=await request("applications/"+app.applicationRef+"/submit",{
    method:"POST",body:JSON.stringify({requestKey:key,expectedRevision:app.revision,
     files:proof.map(x=>({fileRef:x.fileRef,fileVersion:x.fileVersion,
       classification:x.classification}))})});
   if(!result||typeof result!=="object"||!("reference" in result)||
    typeof result.reference!=="string")
    throw Error("Enrollment submission could not be confirmed.");
   enrollmentKeys.current.delete(app.applicationRef);
   await load(0);
   setFileApplication(null);setCaseStatus(null);
   setStatus({error:false,message:"Original enrollment submitted for independent "+
    "Foundation approval — "+result.reference+". Not yet an active employee."});
  }catch(e){
   setStatus({error:true,message:e instanceof Error?e.message:
    "Submission result is uncertain. Refresh the original review before retrying."});
  }finally{setBusy(false);}
 };
 const finalize=async(app:Application)=>{
  if(busy||!canManage)return;
  setBusy(true);setStatus(null);
  try{
   const current=await request("applications/"+app.applicationRef+"/review");
   if(!current||typeof current!=="object"||!("status" in current)||
     current.status!=="PENDING_OWNER"||!("caseRef" in current)||
     typeof current.caseRef!=="string")
    throw Error("An independent final approval has not been confirmed.");
   const result=await request("applications/"+app.applicationRef+"/finalize",{
    method:"POST",body:JSON.stringify({caseRef:current.caseRef})});
   if(!result||typeof result!=="object"||!("reference" in result)||
    typeof result.reference!=="string")
    throw Error("Approved employee activation is not confirmed.");
   await load(0);setFileApplication(null);setCaseStatus(null);
   setStatus({error:false,message:"Employment confirmed — "+result.reference+
    ". Account access is separate and never auto-granted."});
  }catch(e){setStatus({error:true,message:e instanceof Error?e.message:
   "Employee activation result is uncertain. Check the original employee directory."});}
  finally{setBusy(false);}
 };
 const viewEmployee=async(reference:string)=>{
  setDetailBusy(true);setStaffError("");setEmployeeDetail(null);
  try{
   const value=await request("employees/"+encodeURIComponent(reference));
   if(!value||typeof value!=="object"||!("reference" in value)||
     typeof value.reference!=="string"||!("name" in value)||
     typeof value.name!=="string")
    throw Error("Original employee details cannot be verified.");
   setEmployeeDetail(value as NonNullable<typeof employeeDetail>);
  }catch(e){setStaffError(e instanceof Error?e.message:
    "Selected employee is outside your current permitted branches.");}
  finally{setDetailBusy(false);}
 };
 const loadHeadcounts=async()=>{
  if(!canViewEmployees)return;
  try{
   const value=await request("summary");
   if(!value||typeof value!=="object"||!("statuses" in value)||
    !("total" in value)||typeof value.total!=="number")
    throw Error("Approved staff summary unavailable.");
   setHeadcounts(value as {total:number;statuses:Record<string,number>});
  }catch(e){setHeadcounts(null);
    setStaffError(e instanceof Error?e.message:
      "Approved employee headcounts cannot be confirmed.");}
 };
 const loadEmployees=async(page=0)=>{
  if(!canViewEmployees)return;
  setStaffError("");
  try{
   const opts=new URLSearchParams({offset:String(page),status:empFilter.status,
     q:empFilter.q.trim()});
   if(empFilter.branch)opts.set("branch",empFilter.branch);
   if(empFilter.department)opts.set("department",empFilter.department);
   const res=await request("employees?"+opts.toString());
   if(!res||typeof res!=="object"||!("items" in res)||!Array.isArray(res.items))
    throw Error("The approved employee directory is unavailable");
   setStaff(res.items as typeof staff);
   setEmpMore("hasMore" in res&&res.hasMore===true);setEmpOffset(page);
  }catch(e){
   setStaff([]);setEmpMore(false);setStaffError(e instanceof Error?e.message:
    "Employee directory cannot be verified.");
  }
 };

 useEffect(()=>{
  if(!canViewEmployees)return;
  let active=true;
  void request("employee-branches").then(v=>{
   if(active&&isChoices(v))setEmpBranches(v.items);
  }).catch(()=>{if(active)setEmpBranches([]);});
  return()=>{active=false;};
 },[canViewEmployees]);
 useEffect(()=>{
  if(!canViewEmployees||!empFilter.branch){setEmpDepartments([]);return;}
  let active=true;
  void request("employee-departments?branch="+encodeURIComponent(empFilter.branch))
   .then(v=>{if(active&&isChoices(v))setEmpDepartments(v.items);})
   .catch(()=>{if(active)setEmpDepartments([]);});
  return()=>{active=false;};
 },[canViewEmployees,empFilter.branch]);

 const change=(field:keyof Draft,value:string)=>{
  setForm(v=>({...v,[field]:value,
   ...(field==="branchRef"?{departmentRef:"",managerRef:""}:{})}));
  setAttempt(null);setRequestKey(crypto.randomUUID());
 };
 const beginEdit=(app:Application)=>{
  if(!canManage||!["DRAFT","RETURNED"].includes(app.status))return;
  setSelected(app);
  setForm({name:app.name,designation:app.designation,
   employmentType:app.employmentType,branchRef:app.branchRef,
   departmentRef:app.departmentRef??"",managerRef:app.managerRef??"",
   accountRef:app.accountRef??"",roleRef:app.roleRef??"",hireDate:app.hireDate});
  setAttempt(null);setRequestKey(crypto.randomUUID());setStatus(null);
 };
 const reset=()=>{setSelected(null);setForm(blank());setRequestKey(crypto.randomUUID());setAttempt(null);};
 const save=async(e:FormEvent)=>{
  e.preventDefault();if(!canManage||busy)return;
  if(!form.branchRef||!form.hireDate){
   setStatus({message:"Choose an active branch and joining date.",error:true});return;
  }
  setBusy(true);
  const key=requestKey;
  const payload={requestKey:key,name:form.name,designation:form.designation,
   employmentType:form.employmentType,branchRef:form.branchRef,
   departmentRef:form.departmentRef||null,managerRef:form.managerRef||null,
   hireDate:form.hireDate,accountRef:form.accountRef||null,roleRef:form.roleRef||null,
   ...(selected?{expectedRevision:selected.revision}:{})};
  setAttempt(key);
  try{
   const result=await request(selected?"applications/"+selected.applicationRef:"applications",{
    method:selected?"PATCH":"POST",body:JSON.stringify(payload)});
   if(!result||typeof result!=="object"||!("applicationRef" in result))
    throw Error("The save confirmation is not available.");
   const ref="reference" in result&&typeof result.reference==="string"?
    result.reference:selected?.reference??"";
   reset();await load(offset);
   setStatus({message:(selected?"Draft updated":"Draft created")+
    (ref?" — "+ref:"")+". This is not an approved employee.",error:false});
  }catch(e){
   // Do NOT rotate the original key automatically after an unknown write.
   // Same payload+key is safe to retry after list reconciliation.
   setStatus({message:e instanceof Error?e.message:"Save status cannot be confirmed.",error:true});
  }finally{setBusy(false);}
 };
 return <div style={{display:"grid",gap:"1.3rem"}}>
  <div style={{padding:"1rem 1.2rem",background:"#F1F5F9",borderRadius:12,color:"#334155"}}>
   <strong>Employee applications</strong>
   <p style={{margin:".35rem 0 0"}}>
    Saving a draft does not create a staff account, grant permissions or activate employment.
    Submission requires original scanned evidence and an independent Foundation review. An approved application must still be finalized before employment becomes active.
   </p>
  </div>
  {status&&<p role={status.error?"alert":"status"} style={{borderRadius:10,
   background:status.error?"#FEF2F2":"#ECFDF5",
   color:status.error?"#991B1B":"#166534",padding:".85rem 1rem",margin:0}}>
   {status.message}{status.error&&attempt?" If your connection failed, refresh the draft list before retrying.":""}
  </p>}
  {canViewApps&&canManage&&<form onSubmit={e=>void save(e)} style={{border:"1px solid #E2E8F0",
   borderRadius:16,padding:"1.1rem",display:"grid",gap:15,background:"#fff"}}>
   <header><h2 style={{margin:0,fontSize:"1.15rem"}}>{selected?"Edit draft":"New employee draft"}</h2>
    <p style={{color:"#64748B",margin:"5px 0 0"}}>Personal and employment basics. Private identity and bank documents are not collected here.</p></header>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(215px,1fr))",gap:13}}>
    <label style={fieldStyle}>Employee name
     <input style={inputStyle} value={form.name} maxLength={160} required
      autoComplete="name" onChange={e=>change("name",e.target.value)}/></label>
    <label style={fieldStyle}>Designation
     <input style={inputStyle} value={form.designation} maxLength={120} required
      onChange={e=>change("designation",e.target.value)}/></label>
    <label style={fieldStyle}>Employment type
     <select style={inputStyle} value={form.employmentType}
      onChange={e=>change("employmentType",e.target.value)}>
      {["FULL_TIME","PART_TIME","CONTRACT","VOLUNTEER_STAFF"].map(v=>
       <option key={v} value={v}>{v.replaceAll("_"," ")}</option>)}
     </select></label>
    <label style={fieldStyle}>Active Foundation branch
     <select style={inputStyle} required value={form.branchRef}
      onChange={e=>change("branchRef",e.target.value)}>
      <option value="">Choose branch</option>
      {branches.map(v=><option key={v.branchRef} value={v.branchRef}>{v.label}</option>)}
     </select>
     {form.branchRef&&<span style={{fontSize:12,color:"#475569",fontWeight:400}}>
      Verified location: {branches.find(b=>b.branchRef===form.branchRef)?.geography||
       "Location unavailable from current Foundation branch"}
     </span>}</label>
    <label style={fieldStyle}>Department (optional)
     <select style={inputStyle} value={form.departmentRef}
      onChange={e=>change("departmentRef",e.target.value)}>
      <option value="">Not assigned</option>
      {departments.map(v=><option key={v.departmentRef} value={v.departmentRef}>{v.label}</option>)}
     </select></label>
    <label style={fieldStyle}>Reporting manager (optional)
     <select style={inputStyle} value={form.managerRef}
      onChange={e=>change("managerRef",e.target.value)}>
      <option value="">No reporting manager assigned</option>
      {managers.map(x=><option value={x.managerRef} key={x.managerRef}>{x.label}</option>)}
     </select></label>
    {canSelectAccounts&&<label style={fieldStyle}>Existing staff login (optional)
     <select style={inputStyle} value={form.accountRef}
      onChange={e=>change("accountRef",e.target.value)}>
      <option value="">No login linked — employment only</option>
      {accounts.map(x=><option value={x.accountRef} key={x.accountRef}>{x.label}</option>)}
     </select></label>}
    {canSelectRoles&&<label style={fieldStyle}>Proposed staff role (no login grant)
     <select style={inputStyle} value={form.roleRef}
      onChange={e=>change("roleRef",e.target.value)}>
      <option value="">No system role proposed</option>
      {roles.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}
     </select></label>}
    <label style={fieldStyle}>Joining date
     <input type="date" style={inputStyle} required value={form.hireDate}
      onChange={e=>change("hireDate",e.target.value)}/></label>
   </div>
   <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
    <button type="submit" style={buttonStyle} disabled={busy}>
     {busy?"Saving draft…":selected?"Save corrected draft":"Save draft"}</button>
    {selected&&<button type="button" onClick={reset}
     style={{...buttonStyle,background:"#E2E8F0",color:"#0F172A"}}>Cancel edit</button>}
   </div>
  </form>}
  {canViewApps&&<section aria-label="Employee draft list" style={{background:"#fff",
   border:"1px solid #E2E8F0",borderRadius:16,padding:"1rem"}}>
   <header style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
    <h2 style={{margin:0,fontSize:"1.15rem"}}>Current applications</h2>
    <button type="button" onClick={()=>void load(offset)} disabled={loading}
     style={{...buttonStyle,background:"#E2E8F0",color:"#0F172A"}}>Refresh</button>
   </header>
   {loading?<p role="status">Checking current HR records…</p>:
    apps.length===0?<p>No applications found in your permitted branches.</p>:
    <ul style={{padding:0,listStyle:"none",display:"grid",gap:9}}>
     {apps.map(app=><li key={app.applicationRef}
      style={{border:"1px solid #E2E8F0",padding:13,borderRadius:10}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
       <span><strong>{app.name}</strong> · {app.designation}
        <small style={{display:"block",color:"#64748B"}}>{app.reference}</small></span>
       <span style={{fontWeight:600,color:"#475569"}}>{app.status.replaceAll("_"," ")}</span>
      </div>
      {canManage&&<button type="button" onClick={()=>void review(app)}
       style={{marginTop:8,marginRight:8,...buttonStyle,padding:".45rem .7rem",
        background:"#EFF6FF",color:"#1D4ED8"}}>
        {["DRAFT","RETURNED"].includes(app.status)?"Manage private evidence":"Review status"}
       </button>}
      {canManage&&["DRAFT","RETURNED"].includes(app.status)&&
       <button type="button" onClick={()=>beginEdit(app)}
        style={{marginTop:8,...buttonStyle,padding:".45rem .7rem"}}>Edit draft</button>}
     </li>)}
    </ul>}
   <div style={{display:"flex",gap:8}}>
    {offset>0&&<button type="button" style={{...buttonStyle,background:"#E2E8F0",color:"#0F172A"}}
      onClick={()=>void load(Math.max(0,offset-25))}>Previous</button>}
    {hasMore&&<button type="button" style={{...buttonStyle,background:"#E2E8F0",color:"#0F172A"}}
      onClick={()=>void load(offset+25)}>Next</button>}
   </div>
  </section>}
  {canViewApps&&fileApplication&&canManage&&<section style={{border:"1px solid #CBD5E1",
   padding:16,borderRadius:14,background:"#fff",display:"grid",gap:14}}>
   <header style={{display:"flex",justifyContent:"space-between",gap:8}}>
    <h2 style={{margin:0,fontSize:"1.1rem"}}>Original enrollment — {fileApplication.name}</h2>
    <button type="button" onClick={()=>{setFileApplication(null);setCaseStatus(null);}}
     style={{...buttonStyle,background:"#E2E8F0",color:"#0F172A"}}>Close</button>
   </header>
   {canViewPrivate&&<HrPrivateDetails key={fileApplication.applicationRef}
     applicationRef={fileApplication.applicationRef} canView={canViewPrivate}
     canManage={canManagePrivate&&["DRAFT","RETURNED"].includes(fileApplication.status)}/>}
   {caseStatus&&<p role="status">Review state: {caseStatus.status.replaceAll("_"," ")}
    {caseStatus.reference?" · "+caseStatus.reference:""}</p>}
   {["DRAFT","RETURNED"].includes(fileApplication.status)&&<>
    <HrEvidenceUploader applicationRef={fileApplication.applicationRef}
      revision={fileApplication.revision} canManage={canManage}/>
    <button type="button" onClick={()=>void submit(fileApplication)} disabled={busy}
      style={buttonStyle}>Submit original verified enrollment</button>
   </>}
   {fileApplication.status==="FINAL_APPROVED_PENDING_ACTIVATION"&&
    <button type="button" onClick={()=>void finalize(fileApplication)} disabled={busy}
      style={buttonStyle}>Complete approved enrollment</button>}
   <p style={{color:"#64748B",fontSize:13,margin:0}}>
    Only an original CG-03 independent decision and current CG-19 clean scan can activate employment.
   </p>
  </section>}
  {canViewEmployees&&<section style={{padding:16,border:"1px solid #E2E8F0",
    borderRadius:14,background:"#fff"}}>
    <div style={{display:"flex",justifyContent:"space-between",gap:10}}>
      <h2 style={{margin:0,fontSize:"1.1rem"}}>Approved employee directory</h2>
      <button type="button" onClick={()=>void loadHeadcounts()}
        style={{...buttonStyle,background:"#E2E8F0",color:"#0F172A"}}>
        Refresh actual headcount</button>
      <button type="button" onClick={()=>void loadEmployees()}
       style={{...buttonStyle,background:"#E2E8F0",color:"#0F172A"}}>Refresh directory</button>
    </div>
    {headcounts&&<div role="status" style={{display:"flex",gap:10,flexWrap:"wrap",
     color:"#334155",fontSize:13}}>
     {Object.entries(headcounts.statuses).map(([key,count])=>
      <span key={key} style={{padding:9,borderRadius:9,background:"#F1F5F9"}}>
       <strong>{count}</strong> {key.replaceAll("_"," ").toLowerCase()}
      </span>)}
     <strong style={{padding:9}}>Total {headcounts.total}</strong>
    </div>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(175px,1fr))",
      gap:10,margin:"12px 0"}}>
      <label style={fieldStyle}>Search employees
       <input style={inputStyle} value={empFilter.q} maxLength={80}
        placeholder="Name or designation"
        onChange={e=>setEmpFilter(x=>({...x,q:e.target.value}))}/></label>
      <label style={fieldStyle}>Status
       <select style={inputStyle} value={empFilter.status}
        onChange={e=>setEmpFilter(x=>({...x,status:e.target.value}))}>
        {["ALL","ACTIVE","PROBATION","ON_HOLD","PENDING_ACCESS","EXITED"].map(v=>
         <option value={v} key={v}>{v.replaceAll("_"," ")}</option>)}
       </select></label>
      <label style={fieldStyle}>Branch
       <select style={inputStyle} value={empFilter.branch}
        onChange={e=>setEmpFilter(x=>({...x,branch:e.target.value,department:""}))}>
        <option value="">My permitted branches</option>
        {empBranches.map(v=><option key={v.branchRef} value={v.branchRef}>{v.label}</option>)}
       </select></label>
      {empFilter.branch&&<label style={fieldStyle}>Department
       <select style={inputStyle} value={empFilter.department}
        onChange={e=>setEmpFilter(x=>({...x,department:e.target.value}))}>
        <option value="">All departments</option>
        {empDepartments.map(v=><option key={v.departmentRef} value={v.departmentRef}>
         {v.label}</option>)}
       </select></label>}
    </div>
    <button type="button" onClick={()=>void loadEmployees(0)}
      style={{...buttonStyle,background:"#0369A1"}}>Apply directory filters</button>
    {staffError&&<p role="alert" style={{color:"#991B1B"}}>{staffError}</p>}
    <ul style={{paddingLeft:18}}>
     {staff.map(row=><li key={row.reference} style={{padding:6}}>
       <strong>{row.name}</strong> — {row.designation} · {row.branch}
       <small style={{display:"block",color:"#64748B"}}>
        {row.reference} · {row.status.replaceAll("_"," ")}
       </small>
       <button type="button" onClick={()=>void viewEmployee(row.reference)}
         disabled={detailBusy}
         style={{...buttonStyle,background:"#E2E8F0",color:"#0F172A",
           padding:".4rem .7rem",marginTop:7}}>View employment</button>
      </li>)}
    </ul>
    {employeeDetail&&<section aria-label="Current approved employee detail"
      style={{border:"1px solid #CBD5E1",borderRadius:12,padding:14,
       display:"grid",gap:9,marginTop:12}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:10}}>
       <h3 style={{margin:0}}>{employeeDetail.name}</h3>
       <button type="button" onClick={()=>setEmployeeDetail(null)}
        style={{...buttonStyle,background:"#E2E8F0",color:"#0F172A"}}>
        Close</button>
      </div>
      <p style={{margin:0}}>{employeeDetail.reference} · {employeeDetail.status.replaceAll("_"," ")}</p>
      <dl style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",
        gap:10}}>
       {([["Designation",employeeDetail.designation],
         ["Branch",employeeDetail.branch],["Department",employeeDetail.department??"Not assigned"],
         ["Reporting manager",employeeDetail.manager??"Not assigned"],
         ["Employment type",employeeDetail.employmentType.replaceAll("_"," ")],
         ["Effective from",employeeDetail.effectiveFrom],
         ["Effective to",employeeDetail.effectiveTo??"Current"]] as const).map(([label,value])=>
         <div key={label}><dt style={{color:"#64748B",fontSize:12}}>{label}</dt>
          <dd style={{margin:0}}>{value}</dd></div>)}
      </dl>
      <p style={{margin:0,color:"#64748B",fontSize:13}}>
       Employment edits require an authorized personnel change review.
       Sensitive personal and bank data are never included in this directory.
      </p>
     </section>}
    <div style={{display:"flex",gap:8}}>
     {empOffset>0&&<button type="button" onClick={()=>void loadEmployees(Math.max(0,empOffset-25))}
       style={{...buttonStyle,background:"#E2E8F0",color:"#0F172A"}}>Previous employees</button>}
     {empMore&&<button type="button" onClick={()=>void loadEmployees(empOffset+25)}
       style={{...buttonStyle,background:"#E2E8F0",color:"#0F172A"}}>Next employees</button>}
    </div>
  </section>}
 </div>;
}
