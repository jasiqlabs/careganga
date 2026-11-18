"use client";
import {useCallback,useEffect,useRef,useState} from "react";
type Content={description:string;services:string[];facilities:string[];
 hoursNote:string;publicEmail:string;faqs:{question:string;answer:string}[]};
type Snapshot={centerRef:string;version:number;state:string;content:Content};
const EMPTY:Content={description:"",services:[],facilities:[],
 hoursNote:"",publicEmail:"",faqs:[]};
async function api<T>(ref:string,init?:RequestInit):Promise<T>{
 const r=await fetch("/api/health-network/my-centers/"+encodeURIComponent(ref)+"/content",{
  ...init,cache:"no-store",credentials:"same-origin"});
 const body:unknown=await r.json().catch(()=>null);
 if(!r.ok)throw Error(body&&typeof body==="object"&&"message" in body&&
  typeof body.message==="string"?body.message:
  "The center content version could not be confirmed.");
 return body as T;
}
const lines=(value:string,limit:number)=>value.split("\n").map(s=>s.trim())
 .filter(Boolean).slice(0,limit);
export function CenterContentEditor({centerRef}:{centerRef:string}){
 const [snapshot,setSnapshot]=useState<Snapshot|null>(null);
 const [content,setContent]=useState<Content>(EMPTY);
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 const [notice,setNotice]=useState(""),[uncertain,setUncertain]=useState(false);
 const key=useRef(""),epoch=useRef(0);
 const load=useCallback(async()=>{
  const n=++epoch.current;setError("");
  try{
   const data=await api<Snapshot>(centerRef);
   if(n!==epoch.current)return;
   setSnapshot(data);setContent(data.content);key.current="";
   setUncertain(false);
  }catch(e){if(n===epoch.current)setError(
   e instanceof Error?e.message:"Current content could not be checked.");}
 },[centerRef]);
 useEffect(()=>{void load();return()=>{epoch.current++};},[load]);
 const change=(patch:Partial<Content>)=>{key.current="";setContent(s=>({...s,...patch}));};
 async function save(){
  if(!snapshot||busy||uncertain||snapshot.state==="SUBMITTED")return;
  if(!key.current)key.current=crypto.randomUUID();
  setBusy(true);setError("");setNotice("");
  try{
   const result=await api<{version:number;message:string}>(centerRef,{
    method:"PATCH",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({requestKey:key.current,
     expectedVersion:snapshot.version,content})
   });
   await load();setNotice(result.message);
  }catch(e){setUncertain(true);setError(e instanceof Error?e.message:
    "This save may already exist. Check the original version before retrying.");}
  finally{setBusy(false);}
 }
 return <section className="form-section" aria-labelledby="center-presentation-heading">
  <h2 id="center-presentation-heading">My center presentation</h2>
  <p>Describe services, facilities and center-specific FAQs. Drafts are private.
   No change affects verified licensing, doctor fees, appointments or support policy.</p>
  {!!error&&<p role="alert" className="notice error">{error}</p>}
  {!!notice&&<p role="status" className="notice">{notice}</p>}
  {!snapshot?<button type="button" onClick={()=>void load()}>Recheck current content</button>:<>
   <p>Draft: {snapshot.state.replaceAll("_"," ")} (version {snapshot.version}).</p>
   <div className="form-grid">
    <label>Center description
     <textarea value={content.description} rows={5} maxLength={1600}
      disabled={busy||snapshot.state==="SUBMITTED"}
      onChange={e=>change({description:e.target.value})}/></label>
    <label>Services offered (one per line, maximum 20)
     <textarea value={content.services.join("\n")} rows={5} maxLength={2100}
      disabled={busy||snapshot.state==="SUBMITTED"}
      onChange={e=>change({services:lines(e.target.value,20)})}/></label>
    <label>Available facilities (one per line, maximum 20)
     <textarea value={content.facilities.join("\n")} rows={5} maxLength={2100}
      disabled={busy||snapshot.state==="SUBMITTED"}
      onChange={e=>change({facilities:lines(e.target.value,20)})}/></label>
    <label>Working hours note (subject to Foundation verification)
     <textarea value={content.hoursNote} rows={2} maxLength={320}
      disabled={busy||snapshot.state==="SUBMITTED"}
      onChange={e=>change({hoursNote:e.target.value})}/></label>
    <label>Public email address (optional)
     <input type="email" value={content.publicEmail} maxLength={180}
      disabled={busy||snapshot.state==="SUBMITTED"}
      onChange={e=>change({publicEmail:e.target.value})}/></label>
   </div>
   <h3>Center-specific questions and answers</h3>
   {content.faqs.map((faq,i)=><div className="form-grid" key={i}>
    <label>Question {i+1}
     <input value={faq.question} maxLength={160}
      disabled={busy||snapshot.state==="SUBMITTED"}
      onChange={e=>change({faqs:content.faqs.map((f,j)=>
       i===j?{...f,question:e.target.value}:f)})}/></label>
    <label>Answer
     <textarea value={faq.answer} rows={3} maxLength={800}
      disabled={busy||snapshot.state==="SUBMITTED"}
      onChange={e=>change({faqs:content.faqs.map((f,j)=>
       i===j?{...f,answer:e.target.value}:f)})}/></label>
    <button type="button" disabled={busy||snapshot.state==="SUBMITTED"}
     onClick={()=>change({faqs:content.faqs.filter((_,j)=>i!==j)})}>
     Remove question</button>
   </div>)}
   <div className="toolbar">
    <button type="button" disabled={busy||snapshot.state==="SUBMITTED"||content.faqs.length>=15}
     onClick={()=>change({faqs:[...content.faqs,{question:"",answer:""}]})}>
     Add question</button>
    <button type="button" disabled={busy||uncertain||snapshot.state==="SUBMITTED"}
     className="primary" onClick={()=>void save()}>{busy?"Saving…":"Save private draft"}</button>
    <button type="button" disabled={busy} onClick={()=>void load()}>Reload saved version</button>
   </div>
   <p>Only an approved independent Foundation review can make a future version public.
    No photo is published without scanned media and verified publication rights.</p>
  </>}
 </section>;
}
