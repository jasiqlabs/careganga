"use client";
import {useCallback,useEffect,useState,type FormEvent} from "react";

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
export function HrEnrollmentWorkspace({canManage}:{canManage:boolean}){
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
   setStatus({message:(selected?"Draft updated":"Draft created")+
    (ref?" — "+ref:"")+". This is not an approved employee.",error:false});
   reset();await load(offset);
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
    Protected submission and approval will be available after the HR review workflow is connected.
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
 </div>;
}
