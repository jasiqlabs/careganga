"use client";
import {useCallback,useEffect,useRef,useState,type FormEvent} from "react";
import {DoctorProofUploader} from "./doctor-proof-uploader";

type DoctorForm={fullName:string;registrationJurisdiction:string;
  registrationNumber:string;qualifications:string[];specialties:string[];
  experienceYears:number;publicBio:string;
  portraitRightsStatus:"NONE"|"CONSENT_PENDING"};
type DoctorRow={doctorRef:string;name:string;status:string;version:number;
  specialties:string[]};
type Detail={doctorRef:string;status:string;version:number;doctor:DoctorForm};
type CenterRow={associationRef:string;name:string;status:string;centerStatus:string};
type Files={files:{status:string;cleanVerified:boolean;currentVersion:boolean}[]};
const empty=():DoctorForm=>({
  fullName:"",registrationJurisdiction:"",registrationNumber:"",
  qualifications:[],specialties:[],experienceYears:0,publicBio:"",
  portraitRightsStatus:"NONE"
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
export function DoctorOnboarding({canManage}:{canManage:boolean}){
  const [rows,setRows]=useState<DoctorRow[]>([]);
  const [selected,setSelected]=useState<Detail|null>(null);
  const [form,setForm]=useState<DoctorForm>(empty);
  const [qualifications,setQualifications]=useState("");
  const [specialties,setSpecialties]=useState("");
  const [editing,setEditing]=useState<"none"|"create"|"update">("none");
  const [linked,setLinked]=useState<CenterRow[]>([]);
  const [fileStatus,setFileStatus]=useState<string>("");
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
  const [more,setMore]=useState<number|null>(null),[paging,setPaging]=useState(false);
  const [error,setError]=useState(""),[notice,setNotice]=useState("");
  const [unknown,setUnknown]=useState(false);
  const current=useRef(0),key=useRef("");
  const load=useCallback(async(offset=0)=>{
    const turn=++current.current;
    const data=await request<{doctors:DoctorRow[];nextOffset:number|null}>(
      "?offset="+offset);
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
    setError("");setNotice("");setEditing("none");
    setSelected(null);setLinked([]);setFileStatus("");
    try{
      const item=await request<Detail>("/"+encodeURIComponent(ref));
      setSelected(item);
      if(item.status==="PENDING"){
        const proof=await fetch("/api/documents/doctor-evidence/doctors/"+
          encodeURIComponent(ref),{credentials:"same-origin",cache:"no-store"});
        if(proof.ok){
          const result=await proof.json() as Files;
          const latest=result.files?.find(f=>f.currentVersion&&f.cleanVerified);
          setFileStatus(latest?"Original clean scanned licence is recorded":
            "No current verified private licence is recorded");
        }else setFileStatus("Private licence status could not be verified");
      }
      const associations=await request<{centers:CenterRow[]}>(
        "/"+encodeURIComponent(ref)+"/centers");
      setLinked(Array.isArray(associations.centers)?associations.centers:[]);
    }catch(e){setError(e instanceof Error?e.message:"Doctor registration unavailable.");}
  }
  function edit(existing?:Detail){
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
  return <div className="role-workspace">
    <header className="topbar"><div><h1>Doctors and professional registrations</h1>
      <p>One professional identity can be associated with multiple independently approved centers.</p>
    </div>
      {canManage&&<button type="button" className="primary" onClick={()=>{
        setSelected(null);edit();
      }}>Register doctor</button>}
    </header>
    {loading&&<p role="status">Loading current professional registrations…</p>}
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
          onClick={()=>setEditing("none")}>Cancel</button>
      </div>
    </form>}
    <section className="form-section">
      <h2>Registered professionals</h2>
      {!loading&&rows.length===0&&<p>No doctor registrations have been entered yet.</p>}
      <div className="table-wrap"><table><thead><tr>
        <th>Professional</th><th>Specialties</th><th>Verification</th><th>Action</th>
      </tr></thead><tbody>
        {rows.map(r=><tr key={r.doctorRef}>
          <td>{r.name}</td><td>{r.specialties.length?r.specialties.join(", "):"Not entered"}</td>
          <td>{label(r.status)}</td><td>
            <button type="button" onClick={()=>void show(r.doctorRef)}>
              View registration</button>
          </td>
        </tr>)}
      </tbody></table></div>
      {more!==null&&<button type="button" disabled={paging||loading}
        onClick={()=>{setPaging(true);void load(more).catch(err=>
          setError(err instanceof Error?err.message:"More records unavailable."))
          .finally(()=>setPaging(false));}}>
        {paging?"Loading more…":"Load more professionals"}</button>}
    </section>
    {selected&&editing==="none"&&<section className="form-section">
      <h2>{selected.doctor.fullName}</h2>
      <p>Verification: <strong>{label(selected.status)}</strong>.
        Only an independently approved registration can become eligible for association.</p>
      <p>Registration jurisdiction: {selected.doctor.registrationJurisdiction}</p>
      <p>Registration number: {selected.doctor.registrationNumber}</p>
      <p>Qualifications: {selected.doctor.qualifications.join(", ")||"Not entered"}</p>
      <p>Specialties: {selected.doctor.specialties.join(", ")||"Not entered"}</p>
      <p>Experience: {selected.doctor.experienceYears} years</p>
      {canManage&&selected.status==="PENDING"&&<>
        <div className="toolbar">
          <button type="button" onClick={()=>edit(selected)}>Correct pending draft</button>
        </div>
        <DoctorProofUploader key={selected.doctorRef+":"+selected.version}
          doctorRef={selected.doctorRef} version={selected.version}
          onVerified={()=>setFileStatus("Original clean scanned licence is recorded")}/>
        {!!fileStatus&&<p role="status">{fileStatus}</p>}
      </>}
      <h3>Center associations</h3>
      {linked.length===0?<p>No verified center associations have been approved.</p>:
        <div className="table-wrap"><table><thead><tr><th>Center</th><th>Status</th></tr></thead>
          <tbody>{linked.map(x=><tr key={x.associationRef}>
            <td>{x.name}</td><td>{label(x.status)}</td>
          </tr>)}</tbody>
        </table></div>}
      <p className="muted">Professional review, center association approval and current fees
        require separate authorized workflows. No appointment availability is shown.</p>
    </section>}
  </div>;
}
