"use client";
import {useEffect,useState} from "react";
type Person={affiliationRef:string;name:string;status:string;version:number};
export function CenterRepresentatives({centerRef,refresh=0,canRevoke}:{
  centerRef:string;refresh?:number;canRevoke:boolean
}){
  const [people,setPeople]=useState<Person[]>([]);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [busy,setBusy]=useState(false);
  useEffect(()=>{
    let live=true;
    setPeople([]);setError("");
    void fetch("/api/health-network/centers/"+encodeURIComponent(centerRef)+"/representatives",{
      credentials:"same-origin",cache:"no-store"
    }).then(async r=>{
      if(!r.ok)throw Error("The current representative list is unavailable.");
      return r.json() as Promise<{representatives:Person[]}>;
    }).then(result=>{if(live)setPeople(Array.isArray(result.representatives)?result.representatives:[]);})
      .catch(e=>{if(live)setError(e instanceof Error?e.message:"Representatives unavailable.");});
    return()=>{live=false;};
  },[centerRef,refresh]);
  async function revoke(row:Person){
    if(!canRevoke||busy)return;
    setBusy(true);setError("");setNotice("");
    try{
      const r=await fetch("/api/health-network/centers/"+encodeURIComponent(centerRef)+
        "/representatives/"+encodeURIComponent(row.affiliationRef)+"/revoke",{
        method:"POST",cache:"no-store",credentials:"same-origin",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({requestKey:crypto.randomUUID(),expectedVersion:row.version})
      });
      const info:unknown=await r.json().catch(()=>null);
      if(!r.ok)throw Error(info&&typeof info==="object"&&"message" in info&&
        typeof info.message==="string"?info.message:"Assignment change cannot be confirmed.");
      setPeople(prev=>prev.map(p=>p.affiliationRef===row.affiliationRef?{
        ...p,status:"REVOKED",version:p.version+1}:p));
      setNotice(row.name+" no longer has edit access to this pending center.");
    }catch(e){setError(e instanceof Error?e.message:"Revocation outcome uncertain.");}
    finally{setBusy(false);}
  }
  return <section className="form-section">
    <h4>Center representatives</h4>
    {!!error&&<p role="alert" className="notice error">{error}</p>}
    {!!notice&&<p role="status" className="notice">{notice}</p>}
    {people.length===0&&<p>No representatives have been assigned yet.</p>}
    {people.map(person=><div key={person.affiliationRef} className="toolbar">
      <span>{person.name} — {person.status==="REVOKED"?"Access revoked":"Pending draft editor"}</span>
      {canRevoke&&person.status!=="REVOKED"&&<button type="button"
        disabled={busy} onClick={()=>void revoke(person)}>Revoke edit access</button>}
    </div>)}
  </section>;
}
