"use client";
import {useCallback,useEffect,useRef,useState,type FormEvent} from "react";
import {HrEvidenceUploader} from "./hr-evidence-uploader";

type Choice={label:string;branchRef?:string;departmentRef?:string};
type Application={applicationRef:string;reference:string;name:string;designation:string;
 employmentType:string;branchRef:string;departmentRef:string|null;
 hireDate:string;revision:number;status:string};
type Draft={name:string;designation:string;employmentType:string;
 branchRef:string;departmentRef:string;hireDate:string};
const blank=():Draft=>({name:"",designation:"",employmentType:"FULL_TIME",
 branchRef:"",departmentRef:"",hireDate:""});
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
export function HrEnrollmentWorkspace({canManage,canViewEmployees}:{
  canManage:boolean;canViewEmployees:boolean}){
 const [apps,setApps]=useState<Application[]>([]);
 const [branches,setBranches]=useState<Choice[]>([]);
 const [departments,setDepartments]=useState<Choice[]>([]);
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
 const enrollmentKeys=useRef(new Map<string,string>());
 const load=useCallback(async(page=0)=>{
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
 },[]);
 useEffect(()=>{void load(0);},[load]);
 useEffect(()=>{
  let active=true;
  setDepartments([]);
  if(!form.branchRef)return;
  void request("departments?branch="+encodeURIComponent(form.branchRef))
   .then(v=>{if(active&&isChoices(v))setDepartments(v.items);})
   .catch(()=>{if(active)setStatus({message:"Department options are unavailable.",error:true});});
  return()=>{active=false;};
 },[form.branchRef]);
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
 const loadEmployees=async()=>{
  if(!canViewEmployees)return;
  setStaffError("");
  try{
   const res=await request("employees?offset=0");
   if(!res||typeof res!=="object"||!("items" in res)||!Array.isArray(res.items))
    throw Error("The approved employee directory is unavailable");
   setStaff(res.items as typeof staff);
  }catch(e){
   setStaff([]);setStaffError(e instanceof Error?e.message:
    "Employee directory cannot be verified.");
  }
 };

 const change=(field:keyof Draft,value:string)=>{
  setForm(v=>({...v,[field]:value,...(field==="branchRef"?{departmentRef:""}:{})}));
  setAttempt(null);setRequestKey(crypto.randomUUID());
 };
 const beginEdit=(app:Application)=>{
  if(!canManage||!["DRAFT","RETURNED"].includes(app.status))return;
  setSelected(app);
  setForm({name:app.name,designation:app.designation,
   employmentType:app.employmentType,branchRef:app.branchRef,
   departmentRef:app.departmentRef??"",hireDate:app.hireDate});
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
   departmentRef:form.departmentRef||null,hireDate:form.hireDate,accountRef:null,
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
  {canManage&&<form onSubmit={e=>void save(e)} style={{border:"1px solid #E2E8F0",
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
     </select></label>
    <label style={fieldStyle}>Department (optional)
     <select style={inputStyle} value={form.departmentRef}
      onChange={e=>change("departmentRef",e.target.value)}>
      <option value="">Not assigned</option>
      {departments.map(v=><option key={v.departmentRef} value={v.departmentRef}>{v.label}</option>)}
     </select></label>
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
  <section aria-label="Employee draft list" style={{background:"#fff",
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
  </section>
  {fileApplication&&canManage&&<section style={{border:"1px solid #CBD5E1",
   padding:16,borderRadius:14,background:"#fff",display:"grid",gap:14}}>
   <header style={{display:"flex",justifyContent:"space-between",gap:8}}>
    <h2 style={{margin:0,fontSize:"1.1rem"}}>Original enrollment — {fileApplication.name}</h2>
    <button type="button" onClick={()=>{setFileApplication(null);setCaseStatus(null);}}
     style={{...buttonStyle,background:"#E2E8F0",color:"#0F172A"}}>Close</button>
   </header>
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
      <button type="button" onClick={()=>void loadEmployees()}
       style={{...buttonStyle,background:"#E2E8F0",color:"#0F172A"}}>Refresh directory</button>
    </div>
    {staffError&&<p role="alert" style={{color:"#991B1B"}}>{staffError}</p>}
    <ul style={{paddingLeft:18}}>
     {staff.map(row=><li key={row.reference} style={{padding:6}}>
       <strong>{row.name}</strong> — {row.designation} · {row.branch}
       <small style={{display:"block",color:"#64748B"}}>
        {row.reference} · {row.status.replaceAll("_"," ")}
       </small>
      </li>)}
    </ul>
  </section>}
 </div>;
}
