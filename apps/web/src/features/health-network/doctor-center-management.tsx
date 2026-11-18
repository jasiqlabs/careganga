"use client";
import {useCallback,useEffect,useRef,useState,type FormEvent} from "react";

type Association={associationRef:string;centerRef:string;name:string;status:string;
  centerStatus:string;version:number};
type Center={centerRef:string;name:string;providerName:string;pinCode:string};
type Fee={feeRef:string;feeKind:"CONSULTATION"|"FOLLOW_UP";
  consultationMode:"IN_PERSON"|"VIDEO";amountMinor:number;status:string;
  effectiveFromUtc:string;effectiveToUtc:string|null;current:boolean;version:number};
type ApiError=Error&{status?:number};
const readable=(s:string)=>s.replaceAll("_"," ").toLowerCase()
  .replace(/\b\w/g,c=>c.toUpperCase());
const currency=(minor:number)=>new Intl.NumberFormat("en-IN",{
  style:"currency",currency:"INR",minimumFractionDigits:0,maximumFractionDigits:2
}).format(minor/100);
async function call<T>(path:string,method:"GET"|"POST"="GET",body?:object):Promise<T>{
  const res=await fetch("/api/health-network/doctors"+path,{
    method,credentials:"same-origin",cache:"no-store",
    ...(body?{headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})
  });
  const result:unknown=await res.json().catch(()=>null);
  if(!res.ok){
    const message=result&&typeof result==="object"&&"message" in result&&
      typeof result.message==="string"?result.message:
      "The center or fee outcome could not be confirmed. Check current records.";
    throw Object.assign(new Error(message),{status:res.status});
  }
  return result as T;
}
const failed=(error:unknown)=>error instanceof Error?error.message:
  "The latest healthcare change could not be confirmed.";
const unknownOutcome=(error:unknown)=>!(error&&typeof error==="object"&&
  "status" in error&&typeof error.status==="number"&&error.status<500);
function amountMinor(value:string){
  if(!/^(0|[1-9]\d{0,7})(?:\.\d{1,2})?$/.test(value.trim()))
    throw new Error("Enter the fee in rupees, with at most two decimal places.");
  const [rupees,paise=""]=value.trim().split(".");
  return Number(rupees)*100+Number(paise.padEnd(2,"0"));
}
const dateUtc=(value:string)=>{
  const d=new Date(value);
  if(!value||!Number.isFinite(d.getTime()))
    throw new Error("Choose a valid fee effective date and time.");
  return d.toISOString();
};

export function DoctorCenterManagement({doctorRef,verified,canManage,canVerify}:{
  doctorRef:string;verified:boolean;canManage:boolean;canVerify:boolean
}){
  const [associations,setAssociations]=useState<Association[]>([]);
  const [options,setOptions]=useState<Center[]>([]);
  const [query,setQuery]=useState("");
  const [chosen,setChosen]=useState("");
  const [active,setActive]=useState<string|null>(null);
  const [fees,setFees]=useState<Fee[]>([]);
  const [feeKind,setFeeKind]=useState<"CONSULTATION"|"FOLLOW_UP">("CONSULTATION");
  const [mode,setMode]=useState<"IN_PERSON"|"VIDEO">("IN_PERSON");
  const [rupees,setRupees]=useState("");
  const [starts,setStarts]=useState("");
  const [ends,setEnds]=useState("");
  const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
  const [error,setError]=useState(""),[notice,setNotice]=useState("");
  const [uncertain,setUncertain]=useState(false);
  const [confirmSuspend,setConfirmSuspend]=useState<string|null>(null);
  const current=useRef(0);
  const feeReadEpoch=useRef(0);
  const keys=useRef<Record<string,string>>({});
  const keyFor=(action:string)=>{
    if(!keys.current[action])keys.current[action]=crypto.randomUUID();
    return keys.current[action];
  };
  const load=useCallback(async()=>{
    const serial=++current.current;
    const result=await call<{centers:Association[]}>(
      "/"+encodeURIComponent(doctorRef)+"/centers");
    if(serial!==current.current)return;
    setAssociations(Array.isArray(result.centers)?result.centers:[]);
  },[doctorRef]);
  const loadFees=useCallback(async(associationRef:string)=>{
    const epoch=++feeReadEpoch.current;
    const result=await call<{fees:Fee[]}>("/"+encodeURIComponent(doctorRef)+
      "/centers/"+encodeURIComponent(associationRef)+"/fees");
    if(epoch===feeReadEpoch.current)
      setFees(Array.isArray(result.fees)?result.fees:[]);
  },[doctorRef]);
  useEffect(()=>{
    ++feeReadEpoch.current;
    setLoading(true);setActive(null);setFees([]);setUncertain(false);
    void load().catch(e=>setError(failed(e))).finally(()=>setLoading(false));
  },[load]);
  async function findCenters(){
    setError("");
    try{
      const result=await call<{centers:Center[]}>("/eligible-centers?q="+
        encodeURIComponent(query.trim()));
      setOptions(Array.isArray(result.centers)?result.centers:[]);
      setChosen("");
    }catch(e){setError(failed(e));}
  }
  async function change(action:string,endpoint:string,body:object,after:()=>Promise<void>){
    if(busy||uncertain)return;
    setBusy(true);setError("");setNotice("");
    try{
      await call(endpoint,"POST",{...body,requestKey:keyFor(action)});
      delete keys.current[action];
      setConfirmSuspend(null);await after();
      setNotice("The original healthcare record was updated. Review its current status below.");
    }catch(e){
      setError(failed(e));
      if(unknownOutcome(e))setUncertain(true);
      else delete keys.current[action];
    }finally{setBusy(false);}
  }
  async function proposeAssociation(){
    if(!chosen||!canManage||!verified)return;
    const action="propose:"+chosen;
    await change(action,"/"+encodeURIComponent(doctorRef)+"/centers",
      {centerRef:chosen},async()=>{
        await load();setChosen("");setOptions([]);
      });
  }
  async function decideAssociation(row:Association,action:"approve"|"suspend"){
    if(!canVerify)return;
    const endpoint="/"+encodeURIComponent(doctorRef)+"/centers/"+
      encodeURIComponent(row.associationRef)+"/"+action;
    await change(action+":"+row.associationRef,endpoint,
      {expectedVersion:row.version},async()=>{
        await load();if(active===row.associationRef)await loadFees(row.associationRef);
      });
  }
  async function openFees(row:Association){
    ++feeReadEpoch.current;
    setError("");setNotice("");setFees([]);setActive(row.associationRef);
    const operation=loadFees(row.associationRef);
    const epoch=feeReadEpoch.current;
    try{await operation;}
    catch(e){if(epoch===feeReadEpoch.current)setError(failed(e));}
  }
  async function proposeFee(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    const row=associations.find(a=>a.associationRef===active);
    if(!row||row.status!=="APPROVED"||!canManage||busy||uncertain)return;
    try{
      const amount=amountMinor(rupees);
      const from=dateUtc(starts),to=ends?dateUtc(ends):null;
      if(to&&new Date(to).getTime()<=new Date(from).getTime())
        throw new Error("The fee end must be after the effective start.");
      const action="fee-propose:"+row.associationRef;
      await change(action,"/"+encodeURIComponent(doctorRef)+"/centers/"+
        encodeURIComponent(row.associationRef)+"/fees",{
          expectedAssociationVersion:row.version,feeKind,consultationMode:mode,
          amountMinor:amount,effectiveFromUtc:from,effectiveToUtc:to
        },async()=>{await loadFees(row.associationRef);setRupees("");setStarts("");setEnds("");});
    }catch(e){setError(failed(e));}
  }
  async function approveFee(row:Association,fee:Fee){
    if(!canVerify||fee.status!=="PROPOSED")return;
    await change("fee-approve:"+fee.feeRef,"/"+encodeURIComponent(doctorRef)+
      "/centers/"+encodeURIComponent(row.associationRef)+"/fees/"+
      encodeURIComponent(fee.feeRef)+"/approve",
      {expectedVersion:fee.version},async()=>await loadFees(row.associationRef));
  }
  const selected=associations.find(a=>a.associationRef===active);
  return <section className="form-section">
    <h3>Doctor at healthcare centers</h3>
    {!verified&&<p role="status">This registration must pass independent doctor
      verification before a center can be assigned.</p>}
    {loading&&<p role="status">Loading approved center associations…</p>}
    {!!error&&<p role="alert" className="notice error">{error}</p>}
    {!!notice&&<p role="status" className="notice">{notice}</p>}
    {uncertain&&<div className="notice" role="alert">
      The last change may have succeeded. Refresh the original associations and fees
      before taking another action.
      <button type="button" onClick={()=>{
        void load().then(async()=>{
          if(active)await loadFees(active);
          setUncertain(false);keys.current={};setError("");
        }).catch(e=>setError(failed(e)));
      }}>Refresh current records</button>
    </div>}
    {verified&&canManage&&<div className="form">
      <h4>Add an approved center</h4>
      <div className="form-grid">
        <label className="field">Find verified center by name
          <input type="search" maxLength={80} value={query} disabled={busy||uncertain}
            onChange={e=>setQuery(e.target.value)}/>
        </label>
        <div className="toolbar"><button type="button" disabled={busy||uncertain}
          onClick={()=>void findCenters()}>Find centers</button></div>
        <label className="field">Healthcare center
          <select value={chosen} disabled={busy||uncertain||options.length===0}
            onChange={e=>setChosen(e.target.value)}>
            <option value="">Select a verified center</option>
            {options.map(c=><option key={c.centerRef} value={c.centerRef}>
              {c.name} — {c.providerName} ({c.pinCode})
            </option>)}
          </select>
        </label>
      </div>
      <button type="button" className="primary" disabled={!chosen||busy||uncertain}
        onClick={()=>void proposeAssociation()}>Propose center association</button>
      <p className="muted">A center association remains pending until separately approved.
        It does not enable booking or publish a doctor.</p>
    </div>}
    {!loading&&associations.length===0&&<p>No healthcare center association is recorded.</p>}
    {associations.length>0&&<div className="table-wrap"><table>
      <thead><tr><th>Healthcare center</th><th>Association</th><th>Actions</th></tr></thead>
      <tbody>{associations.map(row=><tr key={row.associationRef}>
        <td>{row.name}</td><td>{readable(row.status)}</td><td>
          <div className="toolbar">
            {["APPROVED","SUSPENDED"].includes(row.status)&&
              <button type="button" disabled={busy||uncertain}
                onClick={()=>void openFees(row)}>
                {row.status==="SUSPENDED"?"View past fee history":"View center fees"}
              </button>}
            {row.status==="PENDING"&&canVerify&&<button type="button" className="primary"
              disabled={busy||uncertain}
              onClick={()=>void decideAssociation(row,"approve")}>Approve association</button>}
            {row.status==="APPROVED"&&canVerify&&confirmSuspend!==row.associationRef&&
              <button type="button" disabled={busy||uncertain}
                onClick={()=>setConfirmSuspend(row.associationRef)}>Suspend at center</button>}
            {row.status==="APPROVED"&&canVerify&&confirmSuspend===row.associationRef&&<>
              <button type="button" disabled={busy||uncertain}
                onClick={()=>void decideAssociation(row,"suspend")}>Confirm suspension</button>
              <button type="button" disabled={busy}
                onClick={()=>setConfirmSuspend(null)}>Cancel</button>
            </>}
          </div>
        </td>
      </tr>)}</tbody>
    </table></div>}
    {selected&&<section className="form-section">
      <h4>{selected.name} — consultation fees</h4>
      <p>Only this center's approved prices and original proposed history are shown.
        A fee is not an appointment, payment or availability slot.</p>
      {!loading&&fees.length===0&&<p>No consultation fees are recorded for this center.</p>}
      {fees.length>0&&<div className="table-wrap"><table>
        <thead><tr><th>Type</th><th>Mode</th><th>Amount</th>
          <th>Valid from</th><th>Valid until</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>{fees.map(f=><tr key={f.feeRef}>
          <td>{readable(f.feeKind)}</td><td>{readable(f.consultationMode)}</td>
          <td>{currency(f.amountMinor)}</td>
          <td>{new Date(f.effectiveFromUtc).toLocaleString("en-IN")}</td>
          <td>{f.effectiveToUtc?new Date(f.effectiveToUtc).toLocaleString("en-IN"):"Until changed"}</td>
          <td>{f.current?"Current approved":readable(f.status)}</td>
          <td>{f.status==="PROPOSED"&&canVerify&&
            <button type="button" disabled={busy||uncertain}
              onClick={()=>void approveFee(selected,f)}>Approve price</button>}</td>
        </tr>)}</tbody></table></div>}
      {canManage&&selected.status==="APPROVED"&&<form className="form"
        onSubmit={e=>void proposeFee(e)}>
        <h4>Propose a center fee</h4>
        <div className="form-grid">
          <label className="field">Fee type
            <select disabled={busy||uncertain} value={feeKind}
              onChange={e=>setFeeKind(e.target.value as typeof feeKind)}>
              <option value="CONSULTATION">Consultation</option>
              <option value="FOLLOW_UP">Follow-up</option>
            </select>
          </label>
          <label className="field">Consultation mode
            <select disabled={busy||uncertain} value={mode}
              onChange={e=>setMode(e.target.value as typeof mode)}>
              <option value="IN_PERSON">At center</option>
              <option value="VIDEO">Video consultation</option>
            </select>
          </label>
          <label className="field">Fee in rupees (₹)
            <input required inputMode="decimal" placeholder="300.00"
              value={rupees} disabled={busy||uncertain}
              onChange={e=>setRupees(e.target.value)}/>
          </label>
          <label className="field">Effective from (local date and time)
            <input required type="datetime-local" value={starts}
              disabled={busy||uncertain}
              onChange={e=>setStarts(e.target.value)}/>
          </label>
          <label className="field">Valid until (optional)
            <input type="datetime-local" value={ends}
              disabled={busy||uncertain}
              onChange={e=>setEnds(e.target.value)}/>
          </label>
        </div>
        <button type="submit" className="primary" disabled={busy||uncertain}>
          {busy?"Saving fee proposal…":"Save fee proposal"}</button>
        <p className="muted">For a future fee change, choose a start time after the
          current approved price. The earlier amount stays in history.</p>
      </form>}
    </section>}
  </section>;
}
