"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {safeClientProblem} from "./mis-safe-error";
type Report={ref:string;name:string;version:number};
type Choice={ref:string;name:string};
type Shared=Report&{sourceKey:string};
async function call<T>(path:string,body?:object):Promise<T>{
 const r=await fetch("/api/mis/reports/saved/"+path,{
  method:body?"POST":"GET",cache:"no-store",credentials:"same-origin",
  headers:body?{"Content-Type":"application/json"}:undefined,
  ...(body?{body:JSON.stringify(body)}:{})});
 if(!r.ok)throw new Error(await safeClientProblem(r,
  "This sharing action is unconfirmed. Refresh your saved reports."));
 return r.json() as Promise<T>;
}
/** Same-root colleague grants share definition configuration only.
 * No patient rows, donor data, CG19 file URL, global role links or bulk share.
 */
export function MisSharedDefinitions({selected,canShare,canManage,onChanged}:{
 selected:Report|null;canShare:boolean;canManage:boolean;onChanged:()=>void}){
 const [shared,setShared]=useState<Shared[]>([]);
 const [grants,setGrants]=useState<Choice[]>([]);
 const [people,setPeople]=useState<Choice[]>([]);
 const [search,setSearch]=useState("");
 const [problem,setProblem]=useState(""),[notice,setNotice]=useState("");
 const [busy,setBusy]=useState(false);
 const sharedSeq=useRef(0),grantsSeq=useRef(0);
 const pending=useRef<{payload:string;key:string}|null>(null);
 const refresh=useCallback(async()=>{
  const i=++sharedSeq.current;
  try{
   const page=await call<{items:Shared[]}>("shared-with-me");
   if(i===sharedSeq.current)setShared(page.items??[]);
  }catch(e){if(i===sharedSeq.current){
   setShared([]);setProblem(e instanceof Error?e.message:"Shared definitions unavailable.");
  }}
 },[]);
 const grantList=useCallback(async()=>{
  if(!selected||!canShare){setGrants([]);return;}
  const i=++grantsSeq.current;
  try{
   const r=await call<{people:Choice[]}>(
    encodeURIComponent(selected.ref)+"/grants");
   if(i===grantsSeq.current)setGrants(r.people??[]);
  }catch(e){if(i===grantsSeq.current){
   setGrants([]);setProblem(e instanceof Error?e.message:"Grant list unavailable.");
  }}
 },[selected?.ref,canShare]);
 useEffect(()=>{void refresh();return()=>{sharedSeq.current++};},[refresh]);
 useEffect(()=>{void grantList();},[grantList]);
 useEffect(()=>{
  const hide=()=>{
   if(document.visibilityState==="visible"){
    setProblem("");setPeople([]);setGrants([]);
    pending.current=null;void refresh();void grantList();
   }else{
    sharedSeq.current++;grantsSeq.current++;setShared([]);setPeople([]);setGrants([]);
   }
  };
  document.addEventListener("visibilitychange",hide);
  return()=>document.removeEventListener("visibilitychange",hide);
 },[refresh,grantList]);
 async function findPeople(){
  if(!canShare||search.trim().length<2||busy)return;
  setBusy(true);setProblem("");setPeople([]);
  try{
   const r=await call<{people:Choice[]}>(
    "share-recipients?q="+encodeURIComponent(search.trim()));
   setPeople(r.people??[]);
   if(!r.people?.length)setNotice("No eligible colleague matches that name.");
  }catch(e){setProblem(e instanceof Error?e.message:"Could not check colleagues.");}
  finally{setBusy(false);}
 }
 async function changeGrant(recipient:Choice,active:boolean){
  if(!selected||!canShare||busy)return;
  if(!active&&!window.confirm(
   "Revoke definition copying for "+recipient.name+"? Existing independently saved copies remain private."))return;
  const payload=JSON.stringify({ref:selected.ref,recipient:recipient.ref,
   version:selected.version,active});
  if(pending.current?.payload!==payload)
   pending.current={payload,key:crypto.randomUUID()};
  setBusy(true);setProblem("");setNotice("");
  try{
   const r=await call<{message:string}>(encodeURIComponent(selected.ref)+"/share",{
    recipientRef:recipient.ref,active,expectedVersion:selected.version,
    requestKey:pending.current!.key
   });
   pending.current=null;setNotice(r.message);
   setPeople([]);await grantList();
  }catch(e){setProblem(e instanceof Error?e.message:
   "Sharing outcome unconfirmed. Refresh before retrying.");}
  finally{setBusy(false);}
 }
 async function copy(row:Shared){
  if(!canManage||busy)return;
  setBusy(true);setProblem("");setNotice("");
  try{
   const name=("Copy of "+row.name).slice(0,100);
   await call(encodeURIComponent(row.ref)+"/copy",{
    name,requestKey:crypto.randomUUID()});
   setNotice("Copied an eligible report definition into your own private reports.");
   onChanged();await refresh();
  }catch(e){setProblem(e instanceof Error?e.message:
   "This colleague's report is no longer available to your current source role.");}
  finally{setBusy(false);}
 }
 return <section aria-label="Private report definition sharing" style={{
  marginTop:18,paddingTop:16,borderTop:"1px solid var(--cg-border)"}}>
  <h3 style={{fontSize:"1rem"}}>Shared report definitions</h3>
  <p style={{fontSize:".82rem",color:"var(--cg-muted)"}}>
   Sharing permits an eligible colleague to copy the report settings only.
   Original financial/health records, downloads and schedules are never shared.</p>
  {!!problem&&<p role="alert">{problem}</p>}
  {!!notice&&<p role="status">{notice}</p>}
  <button type="button" disabled={busy} onClick={()=>void refresh()}>
   Refresh definitions shared with me</button>
  {shared.length===0&&<p role="status">No colleagues have shared report settings with you.</p>}
  {shared.map(row=><div key={row.ref} style={{
   marginTop:8,padding:10,border:"1px solid var(--cg-border)",borderRadius:9}}>
   <strong>{row.name}</strong>
   <p style={{margin:"4px 0",fontSize:".78rem"}}>Copy requires your current source permission.</p>
   {canManage&&<button type="button" disabled={busy} onClick={()=>void copy(row)}>
    Make my private copy</button>}
  </div>)}
  {selected&&canShare&&<div style={{display:"grid",gap:9,marginTop:14}}>
   <h4 style={{fontSize:".9rem"}}>Allow a colleague to copy “{selected.name}”</h4>
   <label>Colleague's name <input value={search} maxLength={60}
    onChange={e=>{setSearch(e.target.value);setPeople([]);}}
    placeholder="Search at least two letters"/></label>
   <button type="button" disabled={busy||search.trim().length<2}
    onClick={()=>void findPeople()}>Find eligible colleagues</button>
   {people.map(person=><div key={person.ref}>
    {person.name} · <button type="button" disabled={busy}
     onClick={()=>void changeGrant(person,true)}>Allow private definition copy</button>
   </div>)}
   <strong>Colleagues currently allowed</strong>
   {grants.length===0&&<p>No active individual grants for this report.</p>}
   {grants.map(person=><div key={person.ref}>
    {person.name} · <button type="button" disabled={busy}
     onClick={()=>void changeGrant(person,false)}>Revoke copy access</button>
   </div>)}
  </div>}
 </section>;
}
