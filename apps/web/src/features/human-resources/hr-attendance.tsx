"use client";
import {useCallback,useEffect,useRef,useState} from "react";
type Day={date:string;status:string;checkInAt:string;checkOutAt:string|null;workedMinutes:number|null};
type Self={status:string;canCheckOut?:boolean;shift?:{label:string;timeZone:string;start:string;end:string;weeklyOffDays:number[]}|null;days:Day[]};
type Branch={branchRef:string;label:string};
type Employee={reference:string;name:string;designation:string};
type Rule={policyRef:string;label:string;timeZone:string;start:string;end:string;effectiveFrom:string};
type Matrix={month:string;items:Array<{employeeName:string;designation:string;
 days:Array<{date:string;status:string}>}>;hasMore:boolean;offset:number};
const inputStyle={padding:10,border:"1px solid #CBD5E1",borderRadius:9,width:"100%",minWidth:0} as const;
const btn={padding:"10px 13px",border:0,borderRadius:9,color:"#fff",background:"#087F8C",fontWeight:700,cursor:"pointer"} as const;
async function api(path:string,init?:RequestInit){
 const result=await fetch("/api/hr/"+path,{...init,cache:"no-store",credentials:"same-origin",
  headers:{"Content-Type":"application/json",...init?.headers}});
 const payload:unknown=await result.json().catch(()=>null);
 if(!result.ok)throw Error(payload&&typeof payload==="object"&&"message" in payload&&
  typeof payload.message==="string"?payload.message:"Attendance could not be confirmed");
 return payload;
}
const today=()=>new Date().toISOString().slice(0,10); // Admin policy effective date input, not attendance clock.
type LeaveRule={policyRef:string;leaveType:string;annualHalfDays:number;allowHalfDays:boolean;
 countWeeklyOff:boolean;effectiveFrom:string;effectiveTo:string|null;version:number};
function HrLeavePolicies(){
 const [items,setItems]=useState<LeaveRule[]>([]),[more,setMore]=useState(false);
 const [form,setForm]=useState({leaveType:"",annualDays:"",allowHalfDays:false,
  countWeeklyOff:false,effectiveFrom:today()});
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const key=useRef<string|null>(null);
 const refresh=useCallback(async()=>{
  setLoading(true);
  try{const v=await api("leave-policies");
   if(!v||typeof v!=="object"||!("items" in v)||!Array.isArray(v.items))
    throw Error("Leave policies could not be confirmed");
   setItems(v.items as LeaveRule[]);setMore("hasMore" in v&&v.hasMore===true);setError("");
  }catch(e){setItems([]);setMore(false);setError(e instanceof Error?e.message:"Leave policies unavailable");}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{void refresh();},[refresh]);
 const update=<K extends keyof typeof form,>(field:K,value:(typeof form)[K])=>{
  key.current=null;setForm(x=>({...x,[field]:value}));
 };
 const save=async()=>{
  if(busy)return;setBusy(true);setNotice("");setError("");
  const requestKey=key.current??crypto.randomUUID();key.current=requestKey;
  try{const v=await api("leave-policies",{method:"POST",body:JSON.stringify({
   requestKey,leaveType:form.leaveType,annualHalfDays:Number(form.annualDays)*2,
   allowHalfDays:form.allowHalfDays,countWeeklyOff:form.countWeeklyOff,effectiveFrom:form.effectiveFrom})});
   if(!v||typeof v!=="object"||!("saved" in v)||v.saved!==true)throw Error("Leave policy save could not be confirmed");
   key.current=null;setNotice("Leave policy version saved.");await refresh();
  }catch(e){setError(e instanceof Error?e.message:"Save result uncertain. Refresh before retrying.");}
  finally{setBusy(false);}
 };
 return <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:15,padding:18,display:"grid",gap:12}}>
  <h2 style={{margin:0}}>Leave policies</h2>
  <p style={{margin:0,color:"#64748B"}}>Set Foundation-wide annual entitlement. A newer effective date creates a new version of the same leave type.</p>
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  <fieldset disabled={busy} style={{border:0,padding:0,display:"grid",gap:10}}>
   <label>Leave type<input style={inputStyle} maxLength={80} value={form.leaveType}
    onChange={e=>update("leaveType",e.target.value)}/></label>
   <label>Annual entitlement (days)<input style={inputStyle} type="number" min={0.5} max={366}
    step={form.allowHalfDays?0.5:1} value={form.annualDays} onChange={e=>update("annualDays",e.target.value)}/></label>
   <label>Effective date<input style={inputStyle} type="date" value={form.effectiveFrom}
    onChange={e=>update("effectiveFrom",e.target.value)}/></label>
   <label><input type="checkbox" checked={form.allowHalfDays} onChange={e=>update("allowHalfDays",e.target.checked)}/> Allow half-day leave</label>
   <label><input type="checkbox" checked={form.countWeeklyOff} onChange={e=>update("countWeeklyOff",e.target.checked)}/> Count weekly days off within leave</label>
   <button type="button" style={btn} disabled={!form.leaveType.trim()||!form.annualDays||!form.effectiveFrom}
    onClick={()=>void save()}>Save leave policy</button>
  </fieldset>
  <button type="button" disabled={busy||loading} onClick={()=>void refresh()}>Refresh policies</button>
  {loading?<p>Loading leave policies…</p>:!error&&!items.length?<p>No leave policy configured.</p>:null}
  {items.map(x=><div key={x.policyRef} style={{borderTop:"1px solid #E2E8F0",paddingTop:8}}>
   <strong>{x.leaveType}</strong> · {x.annualHalfDays/2} days annually · Version {x.version}
   <p style={{margin:0}}>From {x.effectiveFrom}{x.effectiveTo?" until "+x.effectiveTo+" (exclusive)":""} · {x.allowHalfDays?"Half-days allowed":"Full days only"} · {x.countWeeklyOff?"Weekly off counted":"Weekly off excluded"}</p>
  </div>)}
  {more&&<p>Showing the latest 100 policy versions.</p>}
 </div>;
}
export function HrAttendance({canConfigure=false,canManageLeave=false}:{canConfigure?:boolean;canManageLeave?:boolean}){
 const [mine,setMine]=useState<Self|null>(null),[loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [branches,setBranches]=useState<Branch[]>([]),[branch,setBranch]=useState("");
 const [employees,setEmployees]=useState<Employee[]>([]),[staffOffset,setStaffOffset]=useState(0);
 const [policies,setPolicies]=useState<Rule[]>([]),[selectedEmployee,setSelectedEmployee]=useState("");
 const [selectedPolicy,setSelectedPolicy]=useState("");
 const [policy,setPolicy]=useState({name:"",timeZone:"",start:"09:00",end:"17:00",
  graceMinutes:"0",breakMinutes:"0",effectiveFrom:today(),weeklyOffDays:[] as number[]});
 const [assignFrom,setAssignFrom]=useState(today());
 const [month,setMonth]=useState(today().slice(0,7)),[matrix,setMatrix]=useState<Matrix|null>(null);
 const [matrixOffset,setMatrixOffset]=useState(0),[matrixBusy,setMatrixBusy]=useState(false);
 const checkKey=useRef<string|null>(null),checkoutKey=useRef<string|null>(null),policyKey=useRef<string|null>(null),assignKey=useRef<string|null>(null);
 const refresh=useCallback(async()=>{
  setLoading(true);
  try{
   const value=await api("me/attendance");
   if(!value||typeof value!=="object"||!("status" in value)||!("days" in value)||
    !Array.isArray(value.days))throw Error("Employee attendance response unavailable");
   setMine(value as Self);setError("");
  }catch(e){setMine(null);setError(e instanceof Error?e.message:"Unable to read attendance");}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{void refresh();},[refresh]);
 useEffect(()=>{if(!canConfigure)return;let live=true;
  void api("employee-branches").then(v=>{
   if(live&&v&&typeof v==="object"&&"items" in v&&Array.isArray(v.items))
    setBranches(v.items as Branch[]);
  }).catch(()=>{if(live)setBranches([]);});
  return()=>{live=false;};
 },[canConfigure]);
 useEffect(()=>{if(!canConfigure||!branch){setEmployees([]);setPolicies([]);return;}
  let live=true;
  void Promise.all([api("employees?branch="+encodeURIComponent(branch)+"&offset="+staffOffset),
   api("shift-policies?branch="+encodeURIComponent(branch))]).then(([e,p])=>{
   if(!live)return;
   setEmployees(e&&typeof e==="object"&&"items" in e&&Array.isArray(e.items)?e.items as Employee[]:[]);
   setPolicies(p&&typeof p==="object"&&"items" in p&&Array.isArray(p.items)?p.items as Rule[]:[]);
  }).catch(x=>{if(live){setEmployees([]);setPolicies([]);
   setError(x instanceof Error?x.message:"Shift options unavailable");}});
  return()=>{live=false;};
 },[canConfigure,branch,staffOffset]);
 useEffect(()=>{if(!canConfigure||!branch){setMatrix(null);return;}
  let live=true;setMatrixBusy(true);
  void api("attendance/matrix?branch="+encodeURIComponent(branch)+
   "&month="+encodeURIComponent(month)+"&offset="+matrixOffset)
   .then(x=>{if(live&&x&&typeof x==="object"&&"items" in x&&Array.isArray(x.items))
    setMatrix(x as Matrix);})
   .catch(e=>{if(live){setMatrix(null);setError(e instanceof Error?e.message:
    "Branch attendance cannot be confirmed");}})
   .finally(()=>{if(live)setMatrixBusy(false);});
  return()=>{live=false;};
 },[canConfigure,branch,month,matrixOffset]);
 const checkIn=async()=>{if(busy)return;setBusy(true);setError("");setNotice("");
  const key=checkKey.current??crypto.randomUUID();checkKey.current=key;
  try{const r=await api("me/attendance/check-in",{method:"POST",body:JSON.stringify({requestKey:key})});
   if(!r||typeof r!=="object"||!("recorded" in r)||r.recorded!==true)
    throw Error("Your check-in could not be confirmed");
   checkKey.current=null;setNotice("Check-in confirmed. Your shift record has been updated.");
   await refresh();
  }catch(e){setError(e instanceof Error?e.message:"Check-in result uncertain. Refresh before retrying.");}
  finally{setBusy(false);}
 };
 const checkOut=async()=>{if(busy)return;setBusy(true);setError("");setNotice("");
  const key=checkoutKey.current??crypto.randomUUID();checkoutKey.current=key;
  try{
   const r=await api("me/attendance/check-out",{method:"POST",
    body:JSON.stringify({requestKey:key})});
   if(!r||typeof r!=="object"||!("recorded" in r)||r.recorded!==true)
    throw Error("Check-out could not be confirmed");
   checkoutKey.current=null;setNotice("Check-out confirmed from server time.");
   await refresh();
  }catch(e){setError(e instanceof Error?e.message:"Check-out result uncertain. Refresh before retrying.");}
  finally{setBusy(false);}
 };
 const savePolicy=async()=>{if(busy||!branch)return;setBusy(true);setError("");setNotice("");
  const key=policyKey.current??crypto.randomUUID();policyKey.current=key;
  try{await api("shift-policies",{method:"POST",body:JSON.stringify({
   requestKey:key,branchRef:branch,name:policy.name,timeZone:policy.timeZone,
   start:policy.start,end:policy.end,graceMinutes:Number(policy.graceMinutes),
   breakMinutes:Number(policy.breakMinutes),weeklyOffDays:policy.weeklyOffDays,effectiveFrom:policy.effectiveFrom})});
   policyKey.current=null;setNotice("Shift policy saved for the selected branch.");
   const p=await api("shift-policies?branch="+encodeURIComponent(branch));
   if(p&&typeof p==="object"&&"items" in p&&Array.isArray(p.items))setPolicies(p.items as Rule[]);
  }catch(e){setError(e instanceof Error?e.message:"Shift save uncertain. Refresh before retrying.");}
  finally{setBusy(false);}
 };
 const assign=async()=>{if(busy||!selectedPolicy||!selectedEmployee)return;
  setBusy(true);setError("");setNotice("");
  const key=assignKey.current??crypto.randomUUID();assignKey.current=key;
  try{await api("shift-assignments",{method:"POST",body:JSON.stringify({
   requestKey:key,employeeReference:selectedEmployee,policyRef:selectedPolicy,validFrom:assignFrom})});
   assignKey.current=null;setNotice("Selected employee's shift assignment confirmed.");
  }catch(e){setError(e instanceof Error?e.message:"Shift assignment result uncertain.");}
  finally{setBusy(false);}
 };
 const change=(name:keyof typeof policy,value:string|number[])=>{
  setPolicy(v=>({...v,[name]:value}));policyKey.current=null;
 };
 return <section aria-label="My attendance and branch shifts"
  style={{display:"grid",gap:14,marginTop:18}}>
  <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:15,padding:18}}>
   <h2 style={{margin:"0 0 8px"}}>My attendance</h2>
   {loading&&<p>Checking your current approved shift…</p>}
   {error&&<p role="alert" style={{color:"#991B1B"}}>{error}</p>}
   {notice&&<p role="status" style={{color:"#166534"}}>{notice}</p>}
   {mine?.status==="NOT_LINKED"&&<p>No active approved employment is linked to this account.</p>}
   {mine?.status==="NO_CURRENT_SHIFT"&&<p>HR has not assigned an active branch shift to you.</p>}
   {mine?.shift&&<>
    <p><strong>{mine.shift.label}</strong> — {mine.shift.start} to {mine.shift.end}
     {" "}({mine.shift.timeZone})</p>
    <button type="button" style={btn} disabled={busy} onClick={()=>void checkIn()}>
     {busy?"Checking…":"Check in using server time"}</button>
    {mine.canCheckOut&&<button type="button" disabled={busy}
     style={{...btn,marginLeft:10}} onClick={()=>void checkOut()}>
     Check out using server time</button>}
   </>}
   <button type="button" onClick={()=>void refresh()} disabled={busy}
    style={{...btn,background:"#E2E8F0",color:"#0F172A",marginLeft:10}}>Refresh</button>
   {!!mine?.days.length&&<div style={{overflowX:"auto",marginTop:12}}>
    <table style={{width:"100%",borderCollapse:"collapse"}}>
     <thead><tr><th scope="col">Shift date</th><th scope="col">Result</th>
      <th scope="col">Check-in</th><th scope="col">Check-out</th><th scope="col">Worked time</th></tr></thead>
     <tbody>{mine.days.map(d=><tr key={d.date}><td>{d.date}</td><td>{d.status}</td>
      <td>{new Date(d.checkInAt).toLocaleString()}</td>
      <td>{d.checkOutAt?new Date(d.checkOutAt).toLocaleString():"Pending"}</td>
      <td>{d.workedMinutes===null?"—":Math.floor(d.workedMinutes/60)+"h "+d.workedMinutes%60+"m"}</td>
     </tr>)}</tbody>
    </table></div>}
  </div>
  {canConfigure&&<div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:15,padding:18,display:"grid",gap:14}}>
   <h2 style={{margin:0}}>Staff shifts</h2>
   <p style={{color:"#64748B",margin:0}}>Configure a real shift and assign it to an approved employee at the same Foundation branch.</p>
   <label>Active Foundation branch<select style={inputStyle} value={branch}
     onChange={e=>{setBranch(e.target.value);setSelectedEmployee("");setSelectedPolicy("");setStaffOffset(0);}}>
     <option value="">Choose branch</option>
     {branches.map(x=><option key={x.branchRef} value={x.branchRef}>{x.label}</option>)}
    </select></label>
   {branch&&<>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:10}}>
     <label>Shift name<input style={inputStyle} maxLength={100} value={policy.name}
      onChange={e=>change("name",e.target.value)}/></label>
     <label>IANA timezone<input style={inputStyle} value={policy.timeZone}
      placeholder="e.g. Asia/Kolkata" onChange={e=>change("timeZone",e.target.value)}/></label>
     <label>Start (24-hour)<input style={inputStyle} type="time" value={policy.start}
      onChange={e=>change("start",e.target.value)}/></label>
     <label>End (24-hour)<input style={inputStyle} type="time" value={policy.end}
      onChange={e=>change("end",e.target.value)}/></label>
     <label>Grace minutes<input style={inputStyle} type="number" min={0} max={180}
      value={policy.graceMinutes} onChange={e=>change("graceMinutes",e.target.value)}/></label>
     <label>Break minutes<input style={inputStyle} type="number" min={0} max={720}
      value={policy.breakMinutes} onChange={e=>change("breakMinutes",e.target.value)}/></label>
     <label>Effective date<input style={inputStyle} type="date" value={policy.effectiveFrom}
      onChange={e=>change("effectiveFrom",e.target.value)}/></label>
    </div>
    <fieldset style={{border:"1px solid #E2E8F0",borderRadius:10}}>
     <legend>Weekly days off (optional)</legend>
     {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((label,n)=><label key={label}
      style={{display:"inline-flex",gap:5,marginRight:14}}>
      <input type="checkbox" checked={policy.weeklyOffDays.includes(n)}
       onChange={e=>change("weeklyOffDays",e.target.checked?
        [...policy.weeklyOffDays,n]:policy.weeklyOffDays.filter(x=>x!==n))}/>{label}
     </label>)}
    </fieldset>
    <button type="button" style={btn} disabled={busy||!policy.name||!policy.timeZone}
     onClick={()=>void savePolicy()}>Save shift</button>
    <label>Approved employee<select style={inputStyle} value={selectedEmployee}
     onChange={e=>{setSelectedEmployee(e.target.value);assignKey.current=null;}}>
     <option value="">Choose employee</option>
     {employees.map(x=><option value={x.reference} key={x.reference}>{x.name} — {x.designation}</option>)}
    </select></label>
    {staffOffset>0&&<button type="button" onClick={()=>setStaffOffset(Math.max(0,staffOffset-25))}>Previous employees</button>}
    {employees.length===25&&<button type="button" onClick={()=>setStaffOffset(v=>v+25)}>Next employees</button>}
    <label>Shift to assign<select style={inputStyle} value={selectedPolicy}
     onChange={e=>{setSelectedPolicy(e.target.value);assignKey.current=null;}}>
     <option value="">Choose saved shift</option>
     {policies.map(x=><option key={x.policyRef} value={x.policyRef}>
      {x.label} ({x.start}–{x.end}; {x.timeZone}; from {x.effectiveFrom})</option>)}
    </select></label>
    <label>Assignment starts<input style={inputStyle} type="date" value={assignFrom}
     onChange={e=>{setAssignFrom(e.target.value);assignKey.current=null;}}/></label>
    <button type="button" style={btn} disabled={busy||!selectedEmployee||!selectedPolicy}
     onClick={()=>void assign()}>Assign shift</button>
    <div style={{borderTop:"1px solid #E2E8F0",paddingTop:12,display:"grid",gap:9}}>
     <h3 style={{margin:0}}>Branch attendance</h3>
     <p style={{margin:0,color:"#64748B"}}>Only recorded check-ins are shown. A missing record is not proof of absence or approved leave.</p>
     <label>Month<input style={inputStyle} type="month" value={month}
      onChange={e=>{setMonth(e.target.value);setMatrixOffset(0);}}/></label>
     {matrixBusy&&<p>Loading attendance records…</p>}
     {matrix&&<div style={{overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse"}}>
       <thead><tr><th scope="col">Employee</th><th scope="col">Verified day records</th></tr></thead>
       <tbody>{matrix.items.map((x,i)=><tr key={x.employeeName+"-"+i}>
        <td>{x.employeeName} — {x.designation}</td>
        <td>{x.days.length?x.days.map(d=>d.date+": "+d.status).join("; "):
          "No check-in recorded for this month"}</td>
       </tr>)}</tbody>
      </table></div>}
     {matrixOffset>0&&<button type="button"
      onClick={()=>setMatrixOffset(v=>Math.max(0,v-25))}>Previous page</button>}
     {matrix?.hasMore&&<button type="button"
      onClick={()=>setMatrixOffset(v=>v+25)}>Next page</button>}
    </div>
   </>}
  </div>}
  {canManageLeave&&<HrLeavePolicies/>}
 </section>;
}
