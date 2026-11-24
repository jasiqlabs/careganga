"use client";
import {useCallback,useEffect,useRef,useState,type FormEvent} from "react";
import {DoctorProofUploader} from "./doctor-proof-uploader";
import {DoctorCenterManagement} from "./doctor-center-management";
import {ClinicianAccountLinkReviewer} from "./clinician-account-link";

type DoctorForm={fullName:string;registrationJurisdiction:string;
  registrationNumber:string;qualifications:string[];specialties:string[];
  experienceYears:number;publicBio:string;
  portraitRightsStatus:"NONE"|"CONSENT_PENDING";
  professionalLicenseValidThrough:string|null};
type DoctorRow={doctorRef:string;name:string;status:string;version:number;
  specialties:string[]};
type Detail={doctorRef:string;status:string;version:number;doctor:DoctorForm};
type Files={files:{fileRef:string;status:string;cleanVerified:boolean;currentVersion:boolean;
  classification:string}[]};
const empty=():DoctorForm=>({
  fullName:"",registrationJurisdiction:"",registrationNumber:"",
  qualifications:[],specialties:[],experienceYears:0,publicBio:"",
  portraitRightsStatus:"NONE",professionalLicenseValidThrough:null
});
const label=(s:string)=>s.replaceAll("_"," ").toLowerCase()
  .replace(/\b\w/g,c=>c.toUpperCase());
async function request<T>(path:string,method:"GET"|"POST"|"PATCH"="GET",
  body?:object):Promise<T>{
  const response=await fetch("/api/health-network/doctors"+path,{
    method,credentials:"same-origin",cache:"no-store",
    ...(body?{headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})
  });
  const data:unknown=await response.json().catch(()=>null);
  if(!response.ok)throw Object.assign(new Error(data&&typeof data==="object"&&
    "message" in data&&typeof data.message==="string"?data.message:
      "The doctor registration outcome cannot be verified."),{status:response.status});
  return data as T;
}
export function DoctorOnboarding({canManage,canVerify}:{canManage:boolean;canVerify:boolean}){
  const [rows,setRows]=useState<DoctorRow[]>([]);
  const [search,setSearch]=useState(""),[statusFilter,setStatusFilter]=useState("");
  const applied=useRef({q:"",status:""}),detailTurn=useRef(0);
  const [detailLoading,setDetailLoading]=useState(false);
  const [selected,setSelected]=useState<Detail|null>(null);
  const [form,setForm]=useState<DoctorForm>(empty);
  const [qualifications,setQualifications]=useState("");
  const [specialties,setSpecialties]=useState("");
  const [editing,setEditing]=useState<"none"|"create"|"update">("none");
  const [fileStatus,setFileStatus]=useState<string>("");
  const [proofFileRef,setProofFileRef]=useState("");
  const submitKey=useRef("");
  const suspendKey=useRef("");
  const actionDoctor=useRef("");
  const [suspendConfirm,setSuspendConfirm]=useState(false);
  const [suspendPassword,setSuspendPassword]=useState("");
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
  const [more,setMore]=useState<number|null>(null),[paging,setPaging]=useState(false);
  const [error,setError]=useState(""),[notice,setNotice]=useState("");
  const [unknown,setUnknown]=useState(false);
  const current=useRef(0),key=useRef("");
  const load=useCallback(async(offset=0)=>{
    const turn=++current.current;
    const query=new URLSearchParams({offset:String(offset),q:applied.current.q,status:applied.current.status});
    const data=await request<{doctors:DoctorRow[];nextOffset:number|null}>("?"+query.toString());
    if(turn!==current.current)return;
    if(!Array.isArray(data.doctors))throw Error("Doctor list response is incomplete.");
    if(offset===0)setRows(data.doctors);
    else setRows(prev=>{
      const known=new Set(prev.map(x=>x.doctorRef));
      return [...prev,...data.doctors.filter(x=>!known.has(x.doctorRef))];
    });
    setMore(Number.isSafeInteger(data.nextOffset)?data.nextOffset:null);
  },[]);
  useEffect(()=>{
    void load().catch(e=>setError(e instanceof Error?e.message:"Doctor registrations unavailable."))
      .finally(()=>setLoading(false));
  },[load]);
  async function show(ref:string){
    const turn=++detailTurn.current;
    if(actionDoctor.current!==ref){submitKey.current="";suspendKey.current="";actionDoctor.current=ref;}
    setDetailLoading(true);setError("");setNotice("");setEditing("none");
    setSelected(null);setFileStatus("");setProofFileRef("");
    setSuspendConfirm(false);setSuspendPassword("");
    try{
      const item=await request<Detail>("/"+encodeURIComponent(ref));
      if(turn!==detailTurn.current)return;
      setSelected(item);
      if(item.status==="PENDING"){
        const proof=await fetch("/api/documents/doctor-evidence/doctors/"+
          encodeURIComponent(ref),{credentials:"same-origin",cache:"no-store"});
        if(proof.ok){
          const result=await proof.json() as Files;
          if(turn!==detailTurn.current)return;
          const latest=result.files?.find(f=>f.currentVersion&&f.cleanVerified&&
            f.classification==="HEALTH_DOCTOR_LICENSE");
          setProofFileRef(latest?.fileRef??"");
          setFileStatus(latest?"Original clean scanned licence is recorded":
            "No current verified private licence is recorded");
        }else if(turn===detailTurn.current)setFileStatus("Private licence status could not be verified");
      }
    }catch(e){if(turn===detailTurn.current)setError(e instanceof Error?e.message:"Doctor registration unavailable.");}
    finally{if(turn===detailTurn.current)setDetailLoading(false);}
  }
  async function submitForReview(){
    if(!selected||selected.status!=="PENDING"||!canManage||!proofFileRef||busy||unknown)return;
    if(!submitKey.current)submitKey.current=crypto.randomUUID();
    setBusy(true);setError("");setNotice("");
    try{
      await request("/"+encodeURIComponent(selected.doctorRef)+"/submit","POST",{
        requestKey:submitKey.current,expectedVersion:selected.version,proofFileRef
      });
      submitKey.current="";setUnknown(false);
      const ref=selected.doctorRef;
      await load();await show(ref);
      setNotice("Doctor registration submitted for independent Foundation review. It is not yet verified.");
    }catch(e){
      setError(e instanceof Error?e.message:"Doctor submission could not be confirmed.");
      if(!(e&&typeof e==="object"&&"status" in e&&
        typeof e.status==="number"&&e.status<500))setUnknown(true);
    }finally{setBusy(false);}
  }
  async function suspendDoctor(){
    if(!selected||selected.status!=="VERIFIED"||!canVerify||busy||unknown||
      suspendPassword.length<8)return;
    if(!suspendKey.current)suspendKey.current=crypto.randomUUID();
    setBusy(true);setError("");setNotice("");
    const ref=selected.doctorRef;
    try{
      await request("/"+encodeURIComponent(ref)+"/suspend","POST",{
        requestKey:suspendKey.current,expectedVersion:selected.version,
        currentPassword:suspendPassword
      });
      suspendKey.current="";setSuspendConfirm(false);setSuspendPassword("");
      setUnknown(false);
      await load();await show(ref);
      setNotice("Doctor suspended across all centers. Existing consultation fee history remains unchanged.");
    }catch(e){
      setSuspendPassword("");
      setError(e instanceof Error?e.message:"Doctor suspension could not be confirmed.");
      if(!(e&&typeof e==="object"&&"status" in e&&
        typeof e.status==="number"&&e.status<500))setUnknown(true);
      else suspendKey.current="";
    }finally{setBusy(false);}
  }
  function edit(existing?:Detail){
    detailTurn.current++;setDetailLoading(false);
    key.current="";setUnknown(false);setError("");setNotice("");
    const d=existing?.doctor??empty();
    setForm({...d});
    setQualifications(d.qualifications.join(", "));
    setSpecialties(d.specialties.join(", "));
    setEditing(existing?"update":"create");
  }
  async function save(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(busy||unknown||!canManage)return;
    setBusy(true);setError("");setNotice("");
    if(!key.current)key.current=crypto.randomUUID();
    const parse=(s:string)=>s.split(",").map(x=>x.trim()).filter(Boolean);
    const body={
      requestKey:key.current,
      ...(editing==="update"?{expectedVersion:selected?.version}:{}),
      doctor:{...form,qualifications:parse(qualifications),
        specialties:parse(specialties)}
    };
    try{
      const result=editing==="update"&&selected?
        await request<{doctorRef:string}>("/"+encodeURIComponent(selected.doctorRef),
          "PATCH",body):
        await request<{doctorRef:string}>("","POST",body);
      if(!result.doctorRef)throw Error("Original doctor save could not be confirmed.");
      key.current="";
      setEditing("none");setUnknown(false);
      await load();await show(result.doctorRef);
      setNotice("Doctor draft saved. A scanned licence and independent verification are still required.");
    }catch(err){
      setError(err instanceof Error?err.message:"Doctor save outcome could not be confirmed.");
      if(!(err&&typeof err==="object"&&"status" in err&&
        typeof err.status==="number"&&err.status<500))setUnknown(true);
    }finally{setBusy(false);}
  }
  function applySearch(q:string,status:string){
    applied.current={q:q.trim(),status};setRows([]);setMore(null);setLoading(true);setError("");
    void load().catch(e=>setError(e instanceof Error?e.message:"Doctor list unavailable."))
      .finally(()=>setLoading(false));
  }
  const displayedTurn=detailTurn.current;
  return <div className="role-workspace">
    <header className="topbar"><div><h1>Doctors and professional registrations</h1>
      <p>One professional identity can be associated with multiple independently approved centers.</p>
    </div>
      <div className="toolbar cg-module-header-actions">
      {canManage&&<button type="button" className="primary" disabled={busy||unknown||detailLoading||editing!=="none"} onClick={()=>{
        setSelected(null);edit();
      }}>Register doctor</button>}
      </div>
    </header>
    {loading&&<p role="status" className="cg-module-loading">Loading current professional registrations…</p>}
    {!!error&&<p role="alert" className="notice error">{error}</p>}
    {!!notice&&<p role="status" className="notice">{notice}</p>}
    {unknown&&<div role="alert" className="notice">
      The original save may have succeeded. Check existing doctor registrations before retrying.
      <button type="button" onClick={()=>{
        setUnknown(false);void load();
      }}>Refresh original registrations</button>
    </div>}
    {editing!=="none"&&canManage&&<form className="form" onSubmit={e=>void save(e)}>
      <h2>{editing==="create"?"New professional registration":"Correct pending doctor draft"}</h2>
      <div className="form-grid">
        <label className="field">Doctor's full name
          <input required minLength={2} maxLength={160} value={form.fullName}
            disabled={busy} onChange={e=>setForm({...form,fullName:e.target.value})}/>
        </label>
        <label className="field">Registration jurisdiction
          <input required minLength={2} maxLength={80}
            placeholder="E.g. MAHARASHTRA"
            value={form.registrationJurisdiction} disabled={busy}
            onChange={e=>setForm({...form,registrationJurisdiction:e.target.value.toUpperCase()})}/>
        </label>
        <label className="field">Professional registration number
          <input required minLength={3} maxLength={80}
            value={form.registrationNumber} disabled={busy}
            onChange={e=>setForm({...form,registrationNumber:e.target.value})}/>
        </label>
        <label className="field">Professional licence valid through (if stated on the original licence)
          <input type="date" value={form.professionalLicenseValidThrough??""}
           disabled={busy} onChange={e=>setForm({...form,
            professionalLicenseValidThrough:e.target.value||null})}/>
          <small>Independent Foundation review must verify this date against
           the original protected licence. Missing or expired validity means
           this professional cannot sign laboratory reports.</small>
        </label>
        <label className="field">Experience in years
          <input type="number" min={0} max={70} step={1} required
            value={form.experienceYears} disabled={busy}
            onChange={e=>setForm({...form,experienceYears:Number(e.target.value)})}/>
        </label>
        <label className="field">Qualifications (separate with commas)
          <input maxLength={1000} value={qualifications} disabled={busy}
            placeholder="E.g. MBBS, MD"
            onChange={e=>setQualifications(e.target.value)}/>
        </label>
        <label className="field">Specialties (separate with commas)
          <input maxLength={1000} value={specialties} disabled={busy}
            placeholder="E.g. General medicine"
            onChange={e=>setSpecialties(e.target.value)}/>
        </label>
        <label className="field">Portrait rights
          <select disabled={busy} value={form.portraitRightsStatus}
            onChange={e=>setForm({...form,
              portraitRightsStatus:e.target.value as DoctorForm["portraitRightsStatus"]})}>
            <option value="NONE">No portrait approved</option>
            <option value="CONSENT_PENDING">Consent evidence pending verification</option>
          </select>
        </label>
      </div>
      <label className="field">Short professional biography (optional)
        <textarea maxLength={2000} rows={3} disabled={busy}
          value={form.publicBio}
          onChange={e=>setForm({...form,publicBio:e.target.value})}/>
      </label>
      <p className="muted">Nothing on this form approves a doctor, a fee, an appointment or a public profile.</p>
      <div className="toolbar">
        <button className="primary" type="submit" disabled={busy||unknown}>
          {busy?"Saving pending draft…":"Save pending registration"}</button>
        <button type="button" disabled={busy}
          onClick={()=>{if(window.confirm("Discard unsaved registration changes?"))setEditing("none");}}>Cancel</button>
      </div>
    </form>}
    <div className="cg-diagnostics-layout">
    <section className="form-section">
      <h2>Registered professionals</h2>
      <form className="form" onSubmit={e=>{e.preventDefault();applySearch(search,statusFilter);}}>
        <label className="field">Find a doctor<input type="search" maxLength={80} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Name, registration number or specialty"/></label>
        <label className="field">Verification status<select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="">All statuses</option><option value="PENDING">Pending</option><option value="VERIFIED">Verified</option><option value="SUSPENDED">Suspended</option></select></label>
        <div className="toolbar"><button type="submit" disabled={loading||paging||busy||unknown||editing!=="none"}>Search</button><button type="button" disabled={loading||paging||busy||unknown||editing!=="none"} onClick={()=>{setSearch("");setStatusFilter("");applySearch("","");}}>Reset</button></div>
      </form>
      {!loading&&rows.length===0&&!error&&<p className="cg-module-empty" role="status">No matching doctor registrations.</p>}
      <div className="table-wrap"><table><thead><tr>
        <th>Professional</th><th>Specialties</th><th>Verification</th><th>Action</th>
      </tr></thead><tbody>
        {rows.map(r=><tr key={r.doctorRef}>
          <td>{r.name}</td><td>{r.specialties.length?r.specialties.join(", "):"Not entered"}</td>
          <td>{label(r.status)}</td><td>
            <button type="button" aria-pressed={selected?.doctorRef===r.doctorRef} disabled={busy||unknown||detailLoading||editing!=="none"} onClick={()=>void show(r.doctorRef)}>
              View registration</button>
          </td>
        </tr>)}
      </tbody></table></div>
      {more!==null&&<button type="button" disabled={paging||loading||busy||unknown||editing!=="none"}
        onClick={()=>{setPaging(true);void load(more).catch(err=>
          setError(err instanceof Error?err.message:"More records unavailable."))
          .finally(()=>setPaging(false));}}>
        {paging?"Loading more…":"Load more professionals"}</button>}
    </section>
    {editing==="none"&&<section className="form-section cg-diagnostics-detail">
      {detailLoading?<p role="status">Loading doctor profile…</p>:!selected?<p className="cg-module-empty">Select a doctor to view their registration.</p>:<>
      <h2>{selected.doctor.fullName}</h2>
      <p>Professional verification: <strong>{label(selected.status)}</strong>.
        Only an independently approved registration can become eligible for association.</p>
      <p>Public directory: <strong>Not published by this workflow</strong>.
        This professional registration and private portrait are not a public doctor listing.</p>
      <h3>Professional profile</h3><dl className="cg-diagnostics-facts">
      <dt>Registration jurisdiction</dt><dd>{selected.doctor.registrationJurisdiction}</dd>
      <dt>Registration number</dt><dd>{selected.doctor.registrationNumber}</dd>
      <dt>Qualifications</dt><dd>{selected.doctor.qualifications.join(", ")||"Not entered"}</dd>
      <dt>Specialties</dt><dd>{selected.doctor.specialties.join(", ")||"Not entered"}</dd>
      <dt>Experience</dt><dd>{selected.doctor.experienceYears} years</dd></dl>
      {canManage&&selected.status==="PENDING"&&<>
        <div className="toolbar">
          <button type="button" onClick={()=>edit(selected)}>Correct pending draft</button>
        </div>
        <DoctorProofUploader key={selected.doctorRef+":"+selected.version}
          doctorRef={selected.doctorRef} version={selected.version}
          onVerified={(ref)=>{if(displayedTurn===detailTurn.current){setProofFileRef(ref);
            setFileStatus("Scanned licence verified");}}}/>
        {selected.doctor.portraitRightsStatus==="CONSENT_PENDING"&&
          <DoctorProofUploader key={selected.doctorRef+":"+selected.version+":portrait"}
            classification="HEALTH_DOCTOR_PORTRAIT"
            doctorRef={selected.doctorRef} version={selected.version}/>}
        {!!proofFileRef&&<div className="toolbar">
          <button type="button" className="primary" disabled={busy||unknown}
            onClick={()=>void submitForReview()}>
            {busy?"Submitting for review…":"Submit registration for verification"}
          </button>
        </div>}
        {!!fileStatus&&<p role="status">{fileStatus}</p>}
      </>}
      {canVerify&&selected.status==="VERIFIED"&&<div className="form-section">
        {!suspendConfirm&&<button type="button" disabled={busy||unknown}
          onClick={()=>setSuspendConfirm(true)}>Suspend professional registration</button>}
        {suspendConfirm&&<div className="form">
          <p>This will suspend this doctor's eligibility at every associated center.
            It will not delete previously approved fee history.</p>
          <label className="field">Confirm with your current password
            <input type="password" autoComplete="current-password"
              value={suspendPassword} minLength={8} disabled={busy||unknown}
              onChange={e=>setSuspendPassword(e.target.value)}/>
          </label>
          <div className="toolbar">
            <button type="button" disabled={busy||unknown||suspendPassword.length<8}
              onClick={()=>void suspendDoctor()}>
              {busy?"Confirming suspension…":"Confirm doctor suspension"}</button>
            <button type="button" disabled={busy} onClick={()=>{
              setSuspendConfirm(false);setSuspendPassword("");
            }}>Cancel</button>
          </div>
        </div>}
      </div>}
      <DoctorCenterManagement doctorRef={selected.doctorRef}
        verified={selected.status==="VERIFIED"} canManage={canManage} canVerify={canVerify}/>
      {canVerify&&selected.status==="VERIFIED"&&
       <ClinicianAccountLinkReviewer key={selected.doctorRef} doctorRef={selected.doctorRef}/>}
      <p className="muted">No appointment availability, patient payment or benefit is implied by a verified registration.</p>
      </>}
    </section>}
    </div>
  </div>;
}
