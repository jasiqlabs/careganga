"use client";
import {useCallback,useEffect,useRef,useState} from "react";
type Policy={policyRef:string;leaveType:string;annualDays:number;usedDays:number;availableDays:number;allowHalfDays:boolean;countWeeklyOff:boolean;effectiveFrom:string;effectiveTo:string|null};
type Request={reference:string;leaveType:string;startDate:string;endDate:string;days:number;status:string;caseStatus:string};
type Mine={linked:boolean;year:string;policies:Policy[];requests:Request[]};
type Review=Request&{caseRef:string;employeeName:string;revision:number;canReview:boolean;reason?:string;date?:string;originalStatus?:string;proposedStatus?:string;original?:{status:string;checkInAt?:string|null;checkOutAt?:string|null};proposed?:{status:string;checkInAt?:string|null;checkOutAt?:string|null}};
const blank=()=>({policyRef:"",startDate:"",endDate:"",halfDay:false,reason:""});
const label=(status:string)=>(({SUBMITTED:"Pending review",IN_REVIEW:"In review",APPROVED:"Approved",OWNER_COMPLETED:"Approved",RETURNED:"Returned",REJECTED:"Rejected"} as Record<string,string>)[status]??"Review status unavailable");
const failure=(e:unknown)=>e instanceof Error?e.message:"Could not confirm the result. Refresh before retrying.";
const known=(e:unknown)=>e&&typeof e==="object"&&"status" in e&&typeof e.status==="number"&&e.status>=400&&e.status<500;

const field={width:"100%",border:"1px solid #CBD5E1",borderRadius:9,padding:10,boxSizing:"border-box"} as const;
const button={border:0,borderRadius:9,padding:"10px 14px",background:"var(--cg-primary,#087F8C)",color:"#fff",fontWeight:700} as const;
const card={border:"1px solid #E2E8F0",borderRadius:14,padding:16,display:"grid",gap:10,background:"#fff"} as const;
async function api<T>(path:string,body?:object):Promise<T>{
 const res=await fetch("/api/hr/"+path,{credentials:"same-origin",cache:"no-store",
  ...(body?{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})});
 const data=await res.json().catch(()=>null);
 if(!res.ok)throw Object.assign(new Error(typeof data?.message==="string"?data.message:"Leave result unavailable"),{status:res.status});
 if(!data||typeof data!=="object")throw Error("Leave result unavailable");
 return data as T;
}
export function HrMyLeave({onChanged}:{onChanged:()=>void}){
 const [year,setYear]=useState(String(new Date().getFullYear())),[yearInput,setYearInput]=useState(year);
 const [data,setData]=useState<Mine|null>(null),[form,setForm]=useState(blank);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[locked,setLocked]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const key=useRef<string|null>(null);
 const refresh=useCallback(async()=>{
  setLoading(true);setError("");
  try{const v=await api<Mine>("me/leave?year="+encodeURIComponent(year));
   if(typeof v.linked!=="boolean"||!Array.isArray(v.requests)||!Array.isArray(v.policies))throw Error("Leave history is unavailable");
   setData(v);
  }catch(e){setData(null);setError(failure(e));}finally{setLoading(false);}
 },[year]);
 useEffect(()=>{void refresh();},[refresh]);
 const change=<K extends keyof typeof form,>(name:K,value:(typeof form)[K])=>setForm(x=>({...x,[name]:value}));
 const selected=data?.policies.find(x=>x.policyRef===form.policyRef);
 const submit=async()=>{
  if(busy||!data?.linked)return;
  setBusy(true);setError("");setNotice("");
  const requestKey=key.current??crypto.randomUUID();key.current=requestKey;
  try{
   const v=await api<{submitted:boolean;reference:string;caseStatus:string}>("me/leave",{requestKey,...form});
   if(v.submitted!==true||typeof v.reference!=="string")throw Error("Leave result is uncertain");
   key.current=null;setLocked(false);setForm(blank());setNotice(v.reference+" · "+label(v.caseStatus));await refresh();onChanged();
  }catch(e){setError(failure(e));if(known(e)){key.current=null;setLocked(false);}else setLocked(true);}
  finally{setBusy(false);}
 };
 return <section aria-label="My leave" style={card}>
  <h2 style={{margin:0}}>My leave</h2>
  <div style={{display:"flex",gap:8,alignItems:"end",flexWrap:"wrap"}}>
   <label>Leave year<input style={field} value={yearInput} inputMode="numeric" maxLength={4} disabled={busy||locked}
    onChange={e=>setYearInput(e.target.value)}/></label>
   <button type="button" disabled={busy||locked||!/^20\d{2}$/.test(yearInput)} onClick={()=>{setForm(blank());if(year===yearInput)void refresh();else setYear(yearInput);}}>View year</button>
   <button type="button" disabled={busy||loading} onClick={()=>void refresh()}>Refresh</button>
  </div>
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  {loading&&<p>Loading leave balances…</p>}
  {data&&!data.linked&&<p>No current approved employment is linked to this account.</p>}
  {data?.linked&&<>
   {data.policies.length===0?<p>No effective leave policy is configured for this year.</p>:<>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:8}}>
     {data.policies.map(x=><div key={x.policyRef} style={{border:"1px solid #E2E8F0",padding:10,borderRadius:9}}>
      <strong>{x.leaveType}</strong><p style={{margin:0}}>{x.availableDays} available · {x.usedDays} approved</p>
      <small>{x.effectiveFrom}{x.effectiveTo?" to before "+x.effectiveTo:" onward"}</small>
     </div>)}
    </div>
    <fieldset disabled={busy||locked||loading} style={{border:0,padding:0,display:"grid",gap:10}}>
     <legend>Apply for leave</legend>
     <label>Leave type<select style={field} value={form.policyRef} onChange={e=>setForm(x=>({...x,policyRef:e.target.value,halfDay:false}))}>
      <option value="">Choose leave type</option>{data.policies.map(x=><option key={x.policyRef} value={x.policyRef}>{x.leaveType} · from {x.effectiveFrom}</option>)}</select></label>
     <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:8}}>
      <label>Start date<input type="date" style={field} value={form.startDate} onChange={e=>change("startDate",e.target.value)}/></label>
      <label>End date<input type="date" style={field} value={form.endDate} onChange={e=>change("endDate",e.target.value)}/></label>
     </div>
     {selected?.allowHalfDays&&<label><input type="checkbox" checked={form.halfDay} onChange={e=>change("halfDay",e.target.checked)}/> Half day (one date)</label>}
     <label>Private reason<textarea style={field} rows={3} maxLength={500} value={form.reason} onChange={e=>change("reason",e.target.value)}/></label>
    </fieldset>
    {locked&&<p role="status">The previous submission is uncertain. Retry the same request or refresh the history; do not send a new application.</p>}
    <button style={button} disabled={busy||loading||!form.policyRef||!form.startDate||!form.endDate||form.reason.trim().length<2}
     onClick={()=>void submit()}>{busy?"Submitting…":locked?"Retry same leave request":"Submit for review"}</button>
   </>}
   <h3 style={{margin:0}}>Leave history</h3>
   {!data.requests.length&&<p>No leave requests in this year.</p>}
   {data.requests.map(x=><div key={x.reference} style={{borderTop:"1px solid #E2E8F0",paddingTop:8}}>
    <strong>{x.leaveType} · {label(x.status)}</strong><p style={{margin:0}}>{x.startDate} – {x.endDate} · {x.days} days</p>
    <small>{x.reference}</small>
   </div>)}
  </>}
 </section>;
}
const snapshot=(v:Review["original"])=>v?v.status+" · In: "+(v.checkInAt??"—")+" · Out: "+(v.checkOutAt??"—"):"—";
export function HrLeaveReviews({onChanged,kind="leave"}:{onChanged:()=>void;kind?:"leave"|"correction"}){
 const route=kind==="leave"?"leave-reviews":"attendance-correction-reviews";
 const [items,setItems]=useState<Review[]>([]),[selected,setSelected]=useState<Review|null>(null);
 const [status,setStatus]=useState("SUBMITTED"),[offset,setOffset]=useState(0),[more,setMore]=useState(false);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [password,setPassword]=useState(""),[action,setAction]=useState("APPROVE"),[locked,setLocked]=useState(false);
 const key=useRef<string|null>(null);
 const refresh=useCallback(async()=>{
  setLoading(true);setError("");
  try{const v=await api<{items:Review[];hasMore:boolean}>(route+"?status="+status+"&offset="+offset);
   if(!Array.isArray(v.items))throw Error("Review list unavailable");
   setItems(v.items);setMore(v.hasMore===true);
  }catch(e){setItems([]);setMore(false);setSelected(null);setError(failure(e));}finally{setLoading(false);}
 },[status,offset,route]);
 useEffect(()=>{void refresh();},[refresh]);
 const open=async(x:Review)=>{
  if(busy||locked)return;setBusy(true);setError("");setSelected(null);setPassword("");setAction("APPROVE");key.current=null;
  try{const v=await api<Review>(route+"/"+encodeURIComponent(x.caseRef));
   if(v.reference!==x.reference)throw Error("Original review changed");setSelected(v);
  }catch(e){setError(failure(e));}finally{setBusy(false);}
 };
 const decide=async()=>{
  if(busy||!selected?.canReview)return;
  setBusy(true);setError("");setNotice("");
  const requestKey=key.current??crypto.randomUUID();key.current=requestKey;
  try{
   const v=await api<{confirmed:boolean;status:string;reference:string}>(route+"/"+encodeURIComponent(selected.caseRef)+"/decide",
    {requestKey,expectedRevision:selected.revision,action,currentPassword:password});
   if(v.confirmed!==true)throw Error("Decision result uncertain");
   key.current=null;setLocked(false);setPassword("");setSelected(null);setNotice(v.reference+" · "+label(v.status));
   await refresh();onChanged();
  }catch(e){setPassword("");setError(failure(e));if(known(e)){key.current=null;setLocked(false);}else setLocked(true);}
  finally{setBusy(false);}
 };
 return <section style={card} aria-label="Employee leave reviews">
  <h2 style={{margin:0}}>{kind==="leave"?"Leave requests":"Attendance correction requests"}</h2>
  <label>Review status<select style={field} disabled={busy||locked} value={status}
   onChange={e=>{setStatus(e.target.value);setOffset(0);setSelected(null);setPassword("");}}>
   <option value="SUBMITTED">Pending</option><option value="OWNER_COMPLETED">Approved</option>
   <option value="RETURNED">Returned</option><option value="REJECTED">Rejected</option><option value="ALL">All</option>
  </select></label>
  <button type="button" disabled={busy||loading||locked} onClick={()=>void refresh()}>Refresh reviews</button>
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  {loading&&<p>Loading leave reviews…</p>}{!loading&&!error&&!items.length&&<p>No matching requests.</p>}
  {items.map(x=><div key={x.caseRef} style={{borderTop:"1px solid #E2E8F0",paddingTop:8,display:"grid",gap:4}}>
   <strong>{x.employeeName} · {kind==="leave"?x.leaveType:"Attendance correction"}</strong><span>{kind==="leave"?x.startDate+" – "+x.endDate+" · "+x.days+" days":x.date+" · "+x.originalStatus+" → "+x.proposedStatus} · {label(x.status)}</span>
   <button type="button" disabled={busy||locked} onClick={()=>void open(x)}>View request</button>
  </div>)}
  {offset>0&&<button disabled={busy||locked} onClick={()=>{setSelected(null);setOffset(v=>Math.max(0,v-25));}}>Previous</button>}
  {more&&<button disabled={busy||locked} onClick={()=>{setSelected(null);setOffset(v=>v+25);}}>Next</button>}
  {selected&&<div style={{...card,background:"#F8FAFC"}}>
   <strong>{selected.employeeName} · {kind==="leave"?selected.leaveType:"Attendance correction"}</strong>
   <span>{selected.reference} · {kind==="leave"?selected.startDate+" – "+selected.endDate+" · "+selected.days+" days":snapshot(selected.original)+" → "+snapshot(selected.proposed)}</span>
   <p style={{whiteSpace:"pre-wrap",margin:0}}>Private reason: {selected.reason}</p>
   {selected.canReview?<><label>Decision<select style={field} value={action} disabled={busy||locked} onChange={e=>setAction(e.target.value)}>
    <option value="APPROVE">Approve</option><option value="RETURN">Return for correction</option><option value="REJECT">Reject</option>
   </select></label>
    <label>Current password<input style={field} type="password" autoComplete="current-password" value={password} disabled={busy} onChange={e=>setPassword(e.target.value)}/></label>
    {locked&&<p>Decision outcome uncertain. Re-enter your password to retry the same decision.</p>}
    <button style={button} disabled={busy||password.length<8} onClick={()=>void decide()}>{busy?"Confirming…":"Confirm decision"}</button>
   </>:<p>{label(selected.status)} · A different authorized reviewer is required for your own request.</p>}
   <button disabled={busy||locked} onClick={()=>{setSelected(null);setPassword("");key.current=null;}}>Close request</button>
  </div>}
 </section>;
}

export type CorrectionDay={date:string;status:string;version:number;timeZone:string;checkInLocal:string|null;checkOutLocal:string|null;leaveDays:number};
export type CorrectionPerson={employeeReference:string;employeeName:string;days:CorrectionDay[]};
type CorrectionHistory={reference:string;status:string;caseStatus:string;original:Review["original"];proposed:Review["proposed"]};
const correctionBlank=()=>({date:"",expectedVersion:0,timeZone:"",result:"WORKED",checkInLocal:"",checkOutLocal:"",reason:""});
const fromDay=(d:CorrectionDay)=>({date:d.date,expectedVersion:d.version,timeZone:d.timeZone,result:d.status==="ABSENT"?"ABSENT":d.status==="WEEKLY_OFF"?"WEEKLY_OFF":"WORKED",checkInLocal:d.checkInLocal??"",checkOutLocal:d.checkOutLocal??"",reason:""});

export function HrAttendanceCorrections({days,staff,onChanged}:{days:CorrectionDay[];staff:CorrectionPerson[];onChanged:()=>void}){
 const [target,setTarget]=useState(""),[form,setForm]=useState(correctionBlank),[history,setHistory]=useState<CorrectionHistory[]>([]);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[locked,setLocked]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [linked,setLinked]=useState(false);
 const key=useRef<string|null>(null);
 
 const person=staff.find(x=>x.employeeReference===target),authorized=!target||!!person;
 const available=(target?person?.days??[]:days).filter(d=>d.version>0&&d.leaveDays<1);
 const refresh=useCallback(async()=>{
  setLoading(true);setError("");setHistory([]);setLinked(false);
  try{const v=await api<{linked:boolean;items:CorrectionHistory[]}>("attendance-corrections"+(target?"?employeeReference="+encodeURIComponent(target):""));
   if(!Array.isArray(v.items)||typeof v.linked!=="boolean")throw Error("Correction history unavailable");
   setHistory(v.items);setLinked(v.linked);
  }catch(e){setError(failure(e));}finally{setLoading(false);}
 },[target]);
 useEffect(()=>{if(authorized)void refresh();else{setHistory([]);setLinked(false);}},[refresh,authorized]);
 const selectTarget=(v:string)=>{setTarget(v);setForm(correctionBlank());key.current=null;setHistory([]);setLinked(false);setNotice("");};
 const change=<K extends keyof typeof form,>(k:K,v:(typeof form)[K])=>setForm(x=>({...x,[k]:v}));
 const valid=!!form.date&&form.expectedVersion>0&&form.reason.trim().length>=2&&(form.result!=="WORKED"||!!form.checkInLocal&&!!form.checkOutLocal);
 const submit=async()=>{
  if(busy||!authorized||(!locked&&!linked)||!valid)return;
  setBusy(true);setError("");setNotice("");
  const requestKey=key.current??crypto.randomUUID();key.current=requestKey;
  try{const v=await api<{submitted:boolean;reference:string;caseStatus:string}>("attendance-corrections",{
   requestKey,...(target?{employeeReference:target}:{}),date:form.date,expectedVersion:form.expectedVersion,
   result:form.result,checkInLocal:form.result==="WORKED"?form.checkInLocal:null,checkOutLocal:form.result==="WORKED"?form.checkOutLocal:null,reason:form.reason});
   if(v.submitted!==true||typeof v.reference!=="string")throw Error("Correction submission uncertain");
   key.current=null;setLocked(false);setForm(correctionBlank());setNotice(v.reference+" · "+label(v.caseStatus));await refresh();onChanged();
  }catch(e){setError(failure(e));if(known(e)){key.current=null;setLocked(false);}else setLocked(true);}
  finally{setBusy(false);}
 };

 return <section style={card} aria-label="Attendance corrections">
  <h2 style={{margin:0}}>Attendance corrections</h2>
  <label>Employee<select style={field} value={target} disabled={busy||locked} onChange={e=>selectTarget(e.target.value)}>
   <option value="">My attendance</option>{staff.map(x=><option value={x.employeeReference} key={x.employeeReference}>{x.employeeName}</option>)}
  </select></label>
  {!authorized&&<p>Selected employee is no longer in the current attendance view. Select a permitted employee.</p>}
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  {loading&&<p>Loading correction history…</p>}
  {authorized&&(linked||locked)&&<><fieldset disabled={busy||locked||loading} style={{border:0,padding:0,display:"grid",gap:8}}>
   <label>Recorded day<select style={field} value={form.date} onChange={e=>{const d=available.find(x=>x.date===e.target.value);setForm(d?fromDay(d):correctionBlank());}}>
    <option value="">Choose recorded day</option>{available.map(d=><option key={d.date} value={d.date}>{d.date} · {d.status}</option>)}
   </select></label>
   {form.date&&<><p>Shift timezone: {form.timeZone}</p>
    <label>Proposed result<select style={field} value={form.result} onChange={e=>change("result",e.target.value)}>
     <option value="WORKED">Worked</option><option value="ABSENT">Absent</option><option value="WEEKLY_OFF">Weekly off</option>
    </select></label>
    {form.result==="WORKED"&&<><label>Local check-in<input style={field} type="datetime-local" value={form.checkInLocal} onChange={e=>change("checkInLocal",e.target.value)}/></label>
     <label>Local check-out<input style={field} type="datetime-local" value={form.checkOutLocal} onChange={e=>change("checkOutLocal",e.target.value)}/></label></>}
    <label>Private reason<textarea style={field} value={form.reason} maxLength={500} onChange={e=>change("reason",e.target.value)}/></label>
   </>}
  </fieldset>{locked&&<p>Outcome uncertain. Retry the original request without changing its details.</p>}
  <button style={button} disabled={busy||loading||!valid} onClick={()=>void submit()}>{locked?"Retry original correction":"Submit correction for review"}</button></>}
  <button disabled={busy||locked||loading||!authorized} onClick={()=>void refresh()}>Refresh correction history</button>
  <h3 style={{margin:0}}>Correction history</h3>
  {authorized&&history.map(x=><div key={x.reference}><strong>{x.reference} · {label(x.status)}</strong><p>{snapshot(x.original)} → {snapshot(x.proposed)}</p></div>)}
 </section>;
}
