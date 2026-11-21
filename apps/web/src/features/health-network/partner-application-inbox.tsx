"use client";
import {useEffect,useState} from "react";
type Application={
 applicationRef:string;reference:string;type:string;name:string;
 contactName:string;phone:string;email:string|null;
 registrationNumber:string|null;address:string;district:string;state:string;
 pinCode:string;status:string;revision:number;receivedAt:string;
 reviewNote:string|null;linkedProviderRef:string|null;linkedDoctorRef:string|null;
};
type Page={applications:Application[];nextOffset:number|null};
type Option={id:string;label:string};
async function call<T>(path:string,method:"GET"|"POST"="GET",body?:unknown):Promise<T>{
 const res=await fetch("/api/health-network/"+path,{method,cache:"no-store",
  headers:body?{"Content-Type":"application/json"}:undefined,
  body:body===undefined?undefined:JSON.stringify(body)});
 const result:unknown=await res.json().catch(()=>null);
 if(!res.ok){
  const msg=result&&typeof result==="object"&&"message" in result&&
   typeof result.message==="string"?result.message:"Action not confirmed. Refresh before retrying.";
  throw new Error(msg);
 }
 return result as T;
}
const stateName=(status:string)=>status.replaceAll("_"," ").toLowerCase()
 .replace(/\b[a-z]/g,c=>c.toUpperCase());
export function PartnerApplicationInbox({canManage}:{canManage:boolean}){
 const [list,setList]=useState<Application[]>([]);
 const [offset,setOffset]=useState<number|null>(0);
 const [filter,setFilter]=useState("ALL");
 const [selected,setSelected]=useState<Application|null>(null);
 const [comment,setComment]=useState(""),[link,setLink]=useState("");
 const [options,setOptions]=useState<Option[]>([]);
 const [loading,setLoading]=useState(false),[busy,setBusy]=useState(false);
 const [message,setMessage]=useState(""),[error,setError]=useState("");
 async function refresh(status="ALL",position=0){
  if(loading)return;
  setLoading(true);setError("");
  try{
   const r=await call<Page>("partner-applications?status="+status+"&offset="+position);
   setList(prev=>position===0?r.applications:[...prev,...r.applications]);
   setOffset(r.nextOffset);
   if(position===0){setSelected(null);setLink("");setOptions([]);}
  }catch(e){setError(e instanceof Error?e.message:"Unable to read applications.");}
  finally{setLoading(false);}
 }
 useEffect(()=>{void refresh("ALL",0);},[]);
 async function choose(app:Application){
  setSelected(app);setComment("");setLink("");setOptions([]);setMessage("");setError("");
  if(!canManage||app.status==="LINKED"||app.status==="DECLINED")return;
  try{
   if(app.type==="DOCTOR"){
    const r=await call<{doctors:{doctorRef:string;name:string;status:string}[]}>("doctors");
    setOptions(r.doctors.filter(v=>v.name.toLowerCase()===app.name.toLowerCase())
      .map(v=>({id:v.doctorRef,label:v.name+" · "+stateName(v.status)})));
   }else{
    const r=await call<{providers:{providerRef:string;name:string;code:string;
      type:string;status:string}[]}>("providers?offset=0&q="+encodeURIComponent(app.name));
    setOptions(r.providers.filter(v=>v.name.toLowerCase()===app.name.toLowerCase()&&
     (app.type==="SURGERY_CENTER"?["HOSPITAL","CLINIC"].includes(v.type):
      v.type===app.type))
      .map(v=>({id:v.providerRef,label:v.name+" · "+v.code+
        " · "+stateName(v.status)})));
   }
  }catch{setOptions([]);} // The existing original record can still be created from the provider screen.
 }
 async function decision(status:"IN_REVIEW"|"RETURNED"|"DECLINED"){
  if(!selected||busy||!canManage||comment.trim().length<5)return;
  setBusy(true);setError("");setMessage("");
  try{
   await call("partner-applications/"+encodeURIComponent(selected.applicationRef)+
    "/review","POST",{status,reviewNote:comment.trim(),
      expectedVersion:selected.revision});
   setMessage("Review outcome saved. This does not verify or publish a partner.");
   await refresh(filter,0);
  }catch(e){setError(e instanceof Error?e.message:"Refresh original application status.");}
  finally{setBusy(false);}
 }
 async function linkOriginal(){
  if(!selected||!link||busy||!canManage)return;
  setBusy(true);setError("");setMessage("");
  try{
   await call("partner-applications/"+encodeURIComponent(selected.applicationRef)+
    "/link-original","POST",{expectedVersion:selected.revision,
     ...(selected.type==="DOCTOR"?{doctorRef:link}:{providerRef:link})});
   setMessage("Linked to original CG14 record. Verification and publication still required.");
   await refresh(filter,0);
  }catch(e){setError(e instanceof Error?e.message:"Refresh original application before retrying.");}
  finally{setBusy(false);}
 }
 return <div className="role-workspace" style={{display:"grid",gap:18}}>
  <header className="topbar"><div><h1>Partner applications</h1>
   <p>Review pending healthcare partner requests before creating or linking
    an original CG14 provider/doctor record. No automatic verification.</p></div></header>
  {message&&<p role="status" className="notice">{message}</p>}
  {error&&<p role="alert" className="notice error">{error}</p>}
  <div className="toolbar">
   <label>Application status <select value={filter} disabled={loading}
    onChange={e=>{setFilter(e.target.value);void refresh(e.target.value,0);}}>
    {["ALL","PENDING","IN_REVIEW","RETURNED","DECLINED","LINKED"].map(v=>
     <option value={v} key={v}>{stateName(v)}</option>)}
   </select></label>
   <button type="button" disabled={loading||busy} onClick={()=>void refresh(filter,0)}>
    Refresh original records</button>
  </div>
  {loading&&<p role="status">Loading verified application records…</p>}
  <div style={{display:"grid",gap:9}}>
   {list.map(a=><article className="form-section" key={a.applicationRef}>
    <strong>{a.name}</strong> · {stateName(a.type)} · {stateName(a.status)}
    <div style={{fontSize:13,color:"var(--cg-muted, #667)"}}>
     Application {a.reference} · {new Date(a.receivedAt).toLocaleDateString("en-IN")}</div>
    <button type="button" disabled={busy} onClick={()=>void choose(a)}>
     View application</button>
   </article>)}
   {!loading&&!list.length&&<p role="status">No applications match these filters.</p>}
   {offset!==null&&<button type="button" disabled={loading||busy}
     onClick={()=>void refresh(filter,offset)}>Load more</button>}
  </div>
  {selected&&<section className="form-section" style={{display:"grid",gap:12}}>
   <h2>Application {selected.reference}</h2>
   <p>Status: <strong>{stateName(selected.status)}</strong>.
    This application is not partner verification.</p>
   <p>Contact: {selected.contactName} · {selected.phone}
    {selected.email?" · "+selected.email:""}</p>
   <p>Registration: {selected.registrationNumber??"Evidence requested on review"}</p>
   <p>Location: {selected.address}, {selected.district}, {selected.state},
    PIN {selected.pinCode}</p>
   {selected.reviewNote&&<p>Review note: {selected.reviewNote}</p>}
   {canManage&&!["LINKED","DECLINED"].includes(selected.status)&&<>
    <label>Internal review note (required, minimum 5 characters)
     <textarea maxLength={500} rows={2} value={comment} disabled={busy}
      onChange={e=>setComment(e.target.value)}/></label>
    <div className="toolbar">
     <button type="button" disabled={busy||comment.trim().length<5}
      onClick={()=>void decision("IN_REVIEW")}>Mark under review</button>
     <button type="button" disabled={busy||comment.trim().length<5}
      onClick={()=>void decision("RETURNED")}>Request corrections</button>
     <button type="button" disabled={busy||comment.trim().length<5}
      onClick={()=>void decision("DECLINED")}>Decline application</button>
    </div>
    <p>Register the matching original provider or doctor from the existing
     Healthcare Providers screen first. That source requires real geography,
     private documents and independent verification.</p>
    <label>Link to matching original pending/verified source
     <select value={link} disabled={busy}
      onChange={e=>setLink(e.target.value)}>
      <option value="">Choose existing matching original record</option>
      {options.map(o=><option key={o.id} value={o.id}>{o.label}</option>)}
     </select></label>
    <button type="button" disabled={!link||busy} onClick={()=>void linkOriginal()}>
     Link original record (does not approve)</button>
   </>}
   <button type="button" onClick={()=>{setSelected(null);setOptions([]);}}>
    Close application details</button>
  </section>}
 </div>;
}
