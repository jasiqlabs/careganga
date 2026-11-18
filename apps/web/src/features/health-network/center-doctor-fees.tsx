"use client";
import {useCallback,useEffect,useRef,useState,type FormEvent} from "react";
type Doctor={associationRef:string;doctorRef:string;name:string;specialties:string[];version:number;status:string};
type Candidate={doctorRef:string;name:string;specialties:string[]};
type Fee={feeRef:string;feeKind:string;consultationMode:string;amountMinor:number;
  status:string;current:boolean;effectiveFromUtc:string;effectiveToUtc:string|null};
const label=(v:string)=>v.replaceAll("_"," ").toLowerCase()
  .replace(/\b\w/g,x=>x.toUpperCase());
const money=(n:number)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR"}).format(n/100);
const cents=(s:string)=>{
  if(!/^(0|[1-9]\d{0,7})(?:\.\d{1,2})?$/.test(s.trim()))
    throw Error("Enter the price in rupees, with up to two decimal places.");
  const [a,b=""]=s.trim().split(".");
  return Number(a)*100+Number(b.padEnd(2,"0"));
};
async function call<T>(path:string,method:"GET"|"POST"="GET",body?:object):Promise<T>{
  const response=await fetch("/api/health-network/"+path,{
    method,credentials:"same-origin",cache:"no-store",
    ...(body?{headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})
  });
  const data:unknown=await response.json().catch(()=>null);
  if(!response.ok)throw Object.assign(new Error(data&&typeof data==="object"&&
    "message" in data&&typeof data.message==="string"?data.message:
      "The original center record cannot be confirmed."),{status:response.status});
  return data as T;
}
export function CenterDoctorFees({centerRef}:{centerRef:string}){
  const path="my-centers/"+encodeURIComponent(centerRef)+"/doctors";
  const [doctors,setDoctors]=useState<Doctor[]>([]);
  const [selected,setSelected]=useState<Doctor|null>(null);
  const [fees,setFees]=useState<Fee[]>([]);
  const [candidates,setCandidates]=useState<Candidate[]>([]);
  const [search,setSearch]=useState("");
  const [candidate,setCandidate]=useState("");
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
  const [error,setError]=useState(""),[notice,setNotice]=useState("");
  const [uncertain,setUncertain]=useState(false);
  const [feeKind,setFeeKind]=useState("CONSULTATION");
  const [mode,setMode]=useState("IN_PERSON");
  const [amount,setAmount]=useState("");
  const [start,setStart]=useState("");
  const [end,setEnd]=useState("");
  const requestKey=useRef("");
  const assignmentKey=useRef("");
  const feeReadEpoch=useRef(0);
  const feePath=selected?path+"/"+encodeURIComponent(selected.doctorRef)+
    "/associations/"+encodeURIComponent(selected.associationRef)+"/fees":"";
  const load=useCallback(async()=>{
    const r=await call<{doctors:Doctor[]}>(path);
    setDoctors(Array.isArray(r.doctors)?r.doctors:[]);
  },[path]);
  const loadFees=useCallback(async(route:string)=>{
    const epoch=++feeReadEpoch.current;
    const r=await call<{fees:Fee[]}>(route);
    // Never show another professional's prices beneath this selected name.
    if(epoch===feeReadEpoch.current)
      setFees(Array.isArray(r.fees)?r.fees:[]);
  },[]);
  useEffect(()=>{
    let alive=true;
    ++feeReadEpoch.current;
    setDoctors([]);setSelected(null);setFees([]);
    setLoading(true);setError("");setUncertain(false);
    void load().catch(e=>{if(alive)setError(e instanceof Error?e.message:
      "Assigned professionals cannot be verified.");})
      .finally(()=>{if(alive)setLoading(false);});
    return()=>{alive=false;};
  },[load]);
  async function choose(ref:string){
    const doctor=doctors.find(d=>d.associationRef===ref)??null;
    ++feeReadEpoch.current;
    setSelected(doctor);setFees([]);setError("");setNotice("");
    if(doctor?.status==="APPROVED"){
      const operation=loadFees(path+"/"+encodeURIComponent(doctor.doctorRef)+
        "/associations/"+encodeURIComponent(doctor.associationRef)+"/fees");
      const epoch=feeReadEpoch.current;
      try{await operation;}
      catch(e){if(epoch===feeReadEpoch.current)
        setError(e instanceof Error?e.message:"Fee history is unavailable.");}
    }
  }
  async function searchCandidates(){
    if(busy||uncertain)return;
    setError("");setCandidates([]);setCandidate("");
    try{
      const found=await call<{doctors:Candidate[]}>(
        "my-centers/"+encodeURIComponent(centerRef)+"/eligible-doctors?q="+
        encodeURIComponent(search.trim()));
      setCandidates(Array.isArray(found.doctors)?found.doctors:[]);
    }catch(e){setError(e instanceof Error?e.message:"Eligible doctors cannot be verified.");}
  }
  async function proposeDoctor(){
    if(!candidate||busy||uncertain)return;
    setBusy(true);setError("");setNotice("");
    if(!assignmentKey.current)assignmentKey.current=crypto.randomUUID();
    try{
      await call(path,"POST",{requestKey:assignmentKey.current,doctorRef:candidate});
      assignmentKey.current="";setCandidate("");setCandidates([]);
      await load();
      setNotice("Association submitted for Foundation approval. The doctor is not active at this center yet.");
    }catch(e){
      setError(e instanceof Error?e.message:"Association outcome could not be confirmed.");
      if(!(e&&typeof e==="object"&&"status" in e&&
        typeof e.status==="number"&&e.status<500))setUncertain(true);
      else assignmentKey.current="";
    }finally{setBusy(false);}
  }
  async function propose(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!selected||selected.status!=="APPROVED"||busy||uncertain)return;
    try{
      const minor=cents(amount);
      const from=new Date(start),to=end?new Date(end):null;
      if(!start||!Number.isFinite(from.getTime())||
        (to&&(!Number.isFinite(to.getTime())||to.getTime()<=from.getTime())))
        throw Error("Choose a valid future effective time and optional later end time.");
      const body={
        requestKey:requestKey.current||crypto.randomUUID(),
        expectedAssociationVersion:selected.version,feeKind,
        consultationMode:mode,amountMinor:minor,
        effectiveFromUtc:from.toISOString(),effectiveToUtc:to?.toISOString()??null
      };
      requestKey.current=body.requestKey;
      setBusy(true);setError("");setNotice("");
      await call(feePath,"POST",body);
      requestKey.current="";
      await loadFees(feePath);
      setAmount("");setStart("");setEnd("");
      setNotice("Fee proposed for this center. Foundation approval is required before it becomes current.");
    }catch(e){
      setError(e instanceof Error?e.message:"Fee proposal could not be confirmed.");
      if(!(e&&typeof e==="object"&&"status" in e&&
        typeof e.status==="number"&&e.status<500))setUncertain(true);
      else requestKey.current="";
    }finally{setBusy(false);}
  }
  return <section className="form-section">
    <h3>Doctors and fees at this center</h3>
    <p>Only your active center's doctor associations appear here. The Foundation separately approves assignments and prices.</p>
    {loading&&<p role="status">Loading assigned doctors…</p>}
    {!!error&&<p role="alert" className="notice error">{error}</p>}
    {!!notice&&<p role="status" className="notice">{notice}</p>}
    {uncertain&&<div className="notice" role="alert">
      A doctor assignment or fee proposal may already have been saved.
      Refresh current records before making another change.
      <button type="button" onClick={()=>{
        void load().then(async()=>{
          if(selected?.status==="APPROVED")await loadFees(feePath);
          setUncertain(false);requestKey.current="";assignmentKey.current="";
          setError("");
        }).catch(e=>setError(e instanceof Error?e.message:"Current records unavailable."));
      }}>Check current records</button>
    </div>
    <div className="form">
      <h4>Request a doctor for this center</h4>
      <p>Find a verified professional by name. Their private registration
        details and licence are not shared with center operators.</p>
      <div className="form-grid">
        <label className="field">Doctor name
          <input type="search" maxLength={80} value={search} disabled={busy||uncertain}
            onChange={e=>setSearch(e.target.value)}/>
        </label>
        <div className="toolbar">
          <button type="button" disabled={busy||uncertain}
            onClick={()=>void searchCandidates()}>Find verified doctors</button>
        </div>
        {candidates.length>0&&<label className="field">Professional
          <select value={candidate} disabled={busy||uncertain}
            onChange={e=>setCandidate(e.target.value)}>
            <option value="">Select a verified professional</option>
            {candidates.map(d=><option key={d.doctorRef} value={d.doctorRef}>
              {d.name} — {d.specialties.join(", ")||"Specialty not recorded"}
            </option>)}
          </select>
        </label>}
      </div>
      <button type="button" disabled={!candidate||busy||uncertain}
        onClick={()=>void proposeDoctor()}>
        {busy?"Sending association…":"Request center association"}</button>
    </div>
    {!loading&&doctors.length===0&&<p>No doctors have been assigned to this center yet.</p>}
    {doctors.length>0&&<label className="field">Doctors at this center
      <select value={selected?.associationRef??""} disabled={busy||uncertain}
        onChange={e=>void choose(e.target.value)}>
        <option value="">Select a doctor</option>
        {doctors.map(d=><option key={d.associationRef} value={d.associationRef}>
          {d.name} — {d.specialties.join(", ")||"Specialty not recorded"} ({label(d.status)})
        </option>)}
      </select>
    </label>}
    {selected?.status==="PENDING"&&<p role="status">This association is awaiting separate Foundation approval. Consultation fees cannot be proposed yet.</p>}
    {selected?.status==="APPROVED"&&<>
      <h4>{selected.name} — this center's fee history</h4>
      {fees.length===0&&<p>No previous fee proposal or approved price exists.</p>}
      {fees.length>0&&<div className="table-wrap"><table>
        <thead><tr><th>Fee</th><th>Mode</th><th>Price</th><th>From</th><th>Until</th>
          <th>Status</th></tr></thead><tbody>{fees.map(f=><tr key={f.feeRef}>
          <td>{label(f.feeKind)}</td><td>{label(f.consultationMode)}</td>
          <td>{money(f.amountMinor)}</td>
          <td>{new Date(f.effectiveFromUtc).toLocaleString("en-IN")}</td>
          <td>{f.effectiveToUtc?new Date(f.effectiveToUtc).toLocaleString("en-IN"):"Until changed"}</td>
          <td>{f.current?"Current approved":label(f.status)}</td>
        </tr>)}</tbody>
      </table></div>}
      <form className="form" onSubmit={e=>void propose(e)}>
        <h4>Propose a consultation fee</h4>
        <div className="form-grid">
          <label className="field">Fee type
            <select value={feeKind} disabled={busy||uncertain}
              onChange={e=>setFeeKind(e.target.value)}>
              <option value="CONSULTATION">Consultation</option>
              <option value="FOLLOW_UP">Follow-up</option>
            </select>
          </label>
          <label className="field">Consultation mode
            <select value={mode} disabled={busy||uncertain}
              onChange={e=>setMode(e.target.value)}>
              <option value="IN_PERSON">At center</option>
              <option value="VIDEO">Video consultation</option>
            </select>
          </label>
          <label className="field">Fee (₹)
            <input required inputMode="decimal" value={amount} disabled={busy||uncertain}
              onChange={e=>setAmount(e.target.value)} placeholder="300.00"/>
          </label>
          <label className="field">Effective from
            <input type="datetime-local" required value={start} disabled={busy||uncertain}
              onChange={e=>setStart(e.target.value)}/>
          </label>
          <label className="field">Valid until (optional)
            <input type="datetime-local" value={end} disabled={busy||uncertain}
              onChange={e=>setEnd(e.target.value)}/>
          </label>
        </div>
        <button type="submit" className="primary" disabled={busy||uncertain}>
          {busy?"Saving proposed fee…":"Submit fee proposal"}</button>
        <p className="muted">The Foundation controls approval. No booking, patient charge
          or verified medical claim is created here.</p>
      </form>
    </>}
  </section>;
}
