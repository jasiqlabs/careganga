"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {CenterEditor,type CenterDraft} from "./center-editor";
import {HealthEvidenceUploader} from "./health-evidence-uploader";

type Row={centerRef:string;name:string;providerName:string;version:number;status:string};
type Detail={centerRef:string;providerRef:string;version:number;center:CenterDraft;status:string};
async function get<T>(path:string):Promise<T>{
  const r=await fetch("/api/health-network/"+path,{cache:"no-store",credentials:"same-origin"});
  const result:unknown=await r.json().catch(()=>null);
  if(!r.ok)throw Error(result&&typeof result==="object"&&"message" in result&&
    typeof result.message==="string"?result.message:"Pending center unavailable");
  return result as T;
}
export function CenterDraftPortal(){
  const [centers,setCenters]=useState<Row[]>([]);
  const [active,setActive]=useState<Detail|null>(null);
  const [draft,setDraft]=useState<CenterDraft|null>(null);
  const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
  const [error,setError]=useState(""),[notice,setNotice]=useState("");
  const [uncertain,setUncertain]=useState(false);
  const requestKey=useRef("");
  const loadList=useCallback(async()=>{
    const r=await get<{centers:Row[]}>("my-centers");
    if(!Array.isArray(r.centers))throw Error("Assigned center list is incomplete");
    setCenters(r.centers);
  },[]);
  useEffect(()=>{
    let alive=true;
    void get<{centers:Row[]}>("my-centers")
      .then(r=>{if(alive)setCenters(r.centers);})
      .catch(e=>{if(alive)setError(e instanceof Error?e.message:"Center access unavailable");})
      .finally(()=>{if(alive)setLoading(false);});
    return()=>{alive=false;};
  },[]);
  async function choose(ref:string){
    setError("");setNotice("");setActive(null);setDraft(null);
    try{
      const record=await get<Detail>("my-centers/"+encodeURIComponent(ref));
      if(!record.center)throw Error("Center draft unavailable.");
      setActive(record);setDraft(record.center);requestKey.current="";setUncertain(false);
    }catch(e){setError(e instanceof Error?e.message:"Center access unavailable.");}
  }
  async function save(){
    if(!active||!draft||saving||uncertain)return;
    setSaving(true);setError("");setNotice("");
    if(!requestKey.current)requestKey.current=crypto.randomUUID();
    try{
      const r=await fetch("/api/health-network/my-centers/"+encodeURIComponent(active.centerRef),{
        method:"PATCH",credentials:"same-origin",cache:"no-store",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({requestKey:requestKey.current,
          expectedVersion:active.version,center:draft})
      });
      const payload:unknown=await r.json().catch(()=>null);
      if(!r.ok){
        const message=payload&&typeof payload==="object"&&"message" in payload&&
          typeof payload.message==="string"?payload.message:"Save could not be confirmed.";
        if(r.status>=500)setUncertain(true);
        throw Error(message);
      }
      requestKey.current="";
      await choose(active.centerRef);
      await loadList();
      setNotice("Your pending center draft was saved. Foundation approval is still required.");
    }catch(e){setError(e instanceof Error?e.message:"Save outcome uncertain.");}
    finally{setSaving(false);}
  }
  return <div className="role-workspace">
    <header className="topbar"><div><h1>My healthcare center</h1>
      <p>Update your assigned pending location. Approval and public listing are controlled by the Foundation.</p>
    </div></header>
    {loading&&<p role="status">Checking your current center assignment…</p>}
    {!!error&&<p className="notice error" role="alert">{error}</p>}
    {!!notice&&<p className="notice" role="status">{notice}</p>}
    {uncertain&&<p role="alert">Your last save is uncertain. Refresh the original center before making another change.
      <button type="button" onClick={()=>{setUncertain(false);if(active)void choose(active.centerRef);}}>
        Refresh original center</button></p>}
    {!loading&&centers.length===0&&
      <p>No pending center is assigned to your account. Contact your Foundation administrator.</p>}
    <div className="toolbar">
      {centers.map(x=><button type="button" key={x.centerRef}
        onClick={()=>void choose(x.centerRef)} aria-pressed={active?.centerRef===x.centerRef}>
        {x.providerName} — {x.name}</button>)}
    </div>
    {active&&draft&&<section className="form-section">
      <h2>{draft.displayName}</h2>
      <p>Pending verification. You cannot approve this registration or activate a public listing.</p>
      <CenterEditor value={draft} identityLocked disabled={saving} onChange={setDraft}/>
      <div className="toolbar">
        <button type="button" className="primary" disabled={saving||uncertain}
          onClick={()=>void save()}>{saving?"Saving…":"Save pending details"}</button>
        <button type="button" disabled={saving}
          onClick={()=>void choose(active.centerRef)}>Discard unsaved changes</button>
      </div>
      <h3>Private center licence</h3>
      <HealthEvidenceUploader providerRef={active.providerRef}
        centerRef={active.centerRef} sourceVersion={active.version}
        classification="HEALTH_CENTER_LICENSE"/>
    </section>}
  </div>;
}
