"use client";
import {useCallback,useEffect,useRef,useState} from "react";

type Option={value:string;label:string};
type Assignment={assignmentRef:string;accountRef:string;staffName:string;scopeKind:"BRANCH"|"AREA"|"ALL_BRANCHES";
 scopeName:string;scopeRef:string;reason:string;sourceVersion:number;grantedAt:string;endedAt:string|null};
type Listing={canGrant:boolean;items:Assignment[]};
type Options={accounts:Option[];branches:Option[];areas:Option[]};
const base="/api/foundation/branch-access";
async function request<T>(route:string,method:"GET"|"POST"="GET",payload?:Record<string,unknown>):Promise<T>{
 let response:Response;
 try{response=await fetch(base+route,{method,cache:"no-store",
  ...(payload?{headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)}:{})});}
 catch{throw new Error("The outcome is uncertain. Check current staff assignments before trying again.");}
 let body:unknown=null;
 try{body=await response.json();}catch{ /* safe error below */ }
 if(!response.ok)throw new Error(body&&typeof body==="object"&&"message" in body&&
  typeof body.message==="string"?body.message:
  "Unable to verify the original assignment. Refresh current access.");
 return body as T;
}
/** Current protected role/operator access scope; never a client-side permission grant. */
export function BranchAccessPanel(){
 const [data,setData]=useState<Listing|null>(null),[choices,setChoices]=useState<Options|null>(null);
 const [account,setAccount]=useState(""),[kind,setKind]=useState<"BRANCH"|"AREA"|"ALL_BRANCHES">("BRANCH");
 const [selectedScope,setSelectedScope]=useState(""),[reason,setReason]=useState("");
 const [password,setPassword]=useState(""),[search,setSearch]=useState("");
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [unknown,setUnknown]=useState(false);
 const actionKey=useRef<string|null>(null);
 const refresh=useCallback(async(searchValue="")=>{
  const [current,options]=await Promise.all([
   request<Listing>("/assignments"),request<Options>("/options?search="+encodeURIComponent(searchValue))]);
  setData(current);setChoices(options);setUnknown(false);
 },[]);
 useEffect(()=>{let active=true;void refresh().catch(()=>{if(active)setError(
  "Current staff assignments are not available. Check access before changing staff rights.");});
  return()=>{active=false;};},[refresh]);
 const choose=kind==="BRANCH"?choices?.branches:choices?.areas;
 async function submit(){
  if(!data?.canGrant||busy||unknown||!account||
    (kind!=="ALL_BRANCHES"&&!selectedScope)||reason.trim().length<6||password.length<8)return;
  if(!actionKey.current)actionKey.current=crypto.randomUUID();
  setBusy(true);setError("");setNotice("");
  try{
   const result=await request<{message:string}>("/assignments","POST",{
    requestKey:actionKey.current,accountRef:account,scopeKind:kind,
    ...(kind==="BRANCH"?{branchRef:selectedScope}:
       kind==="AREA"?{areaRef:selectedScope}:{}),
    reason:reason.trim(),currentPassword:password});
   setNotice(result.message);actionKey.current=null;setPassword("");setReason("");setSelectedScope("");
   await refresh(search);
  }catch(e){setUnknown(true);setError(e instanceof Error?e.message:
   "Could not verify the assignment. Refresh original staff rights.");}
  finally{setBusy(false);}
 }
 async function end(ref:string){
  if(!data?.canGrant||busy||unknown||password.length<8)return;
  if(!actionKey.current)actionKey.current=crypto.randomUUID();
  setBusy(true);setError("");setNotice("");
  try{
   const result=await request<{message:string}>("/assignments/"+ref+"/end","POST",
    {requestKey:actionKey.current,currentPassword:password});
   setNotice(result.message);actionKey.current=null;setPassword("");await refresh(search);
  }catch(e){setUnknown(true);setError(e instanceof Error?e.message:
   "Could not verify the access change. Refresh the original assignment.");}
  finally{setBusy(false);}
 }
 return <section className="role-pane" aria-label="Delegated Foundation branch access">
  <header className="toolbar"><div><h3>Staff branch and area access</h3>
   <p>Assign actual branches or geographic areas to existing staff. Their role permissions still apply.</p>
   </div><button type="button" disabled={busy} onClick={()=>{
    void refresh(search).catch(()=>setError("Current staff access cannot be verified."));
   }}>Refresh staff access</button></header>
  {notice&&<p className="notice" role="status">{notice}</p>}
  {error&&<p className="notice" role="alert">{error}</p>}
  {unknown&&<p className="notice" role="alert">An assignment result may be pending.
   Review the current list before another change. Do not repeat the old request.</p>}
  {!data?<p role="status">Loading current staff branch access…</p>:<>
   {!data.canGrant&&<p className="notice">Only a protected Foundation administrator can grant or end staff access.</p>}
   {data.canGrant&&<div className="form">
    <label className="field">Find an eligible staff member
     <input type="search" value={search} maxLength={100}
      placeholder="Staff name" onChange={e=>{setSearch(e.target.value);}}
      onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();
       void refresh(search).catch(()=>setError("Staff search is unavailable."));}}}/></label>
    <button type="button" disabled={busy} onClick={()=>void refresh(search)
      .catch(()=>setError("Eligible staff options are unavailable."))}>Search staff</button>
    <label className="field">Current staff account
     <select value={account} onChange={e=>{setAccount(e.target.value);actionKey.current=null;}}>
      <option value="">Choose an eligible staff member</option>
      {choices?.accounts.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}
     </select></label>
    <label className="field">Access applies to
     <select value={kind} onChange={e=>{setKind(e.target.value as "BRANCH"|"AREA"|"ALL_BRANCHES");
      setSelectedScope("");actionKey.current=null;}}>
      <option value="BRANCH">Specific Foundation branch</option>
      <option value="AREA">State, district, subdivision or block</option>
       <option value="ALL_BRANCHES">All active Foundation branches (not Foundation master)</option>
     </select></label>
    {kind!=="ALL_BRANCHES"&&<label className="field">Current permitted {kind==="BRANCH"?"branch":"geographic area"}
     <select value={selectedScope} onChange={e=>{setSelectedScope(e.target.value);actionKey.current=null;}}>
      <option value="">Choose {kind==="BRANCH"?"active branch":"active area"}</option>
      {choose?.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}
     </select></label>}
    {kind==="ALL_BRANCHES"&&<p role="note">Organization-wide staff branch access covers all active branches, including newly activated ones. Foundation-only legal and financial records remain restricted to protected administrators.</p>}
    <label className="field">Reason for assignment
     <textarea value={reason} maxLength={500} onChange={e=>{setReason(e.target.value);
      actionKey.current=null;}} placeholder="Why does this staff member need this area or branch?"/></label>
    <label className="field">Confirm your current administrator password
     <input type="password" value={password} autoComplete="current-password"
      onChange={e=>setPassword(e.target.value)}/></label>
    <button type="button" className="primary" disabled={busy||unknown||!account||
     (kind!=="ALL_BRANCHES"&&!selectedScope)||reason.trim().length<6||password.length<8} onClick={()=>void submit()>
      Grant restricted staff access</button>
    <p>Granting or ending access signs out the affected staff member. They must sign in again.</p>
   </div>}
   <h4>Current and ended assignments</h4>
   {data.items.length===0?<p role="status">No staff branch or area assignments recorded.</p>:
    <div className="branch-directory-scroll"><table className="role-table">
     <thead><tr><th>Staff</th><th>Authorized area or branch</th><th>Status</th><th>Reason</th><th>Action</th></tr></thead>
     <tbody>{data.items.map(x=><tr key={x.assignmentRef}>
      <td>{x.staffName}</td><td>{x.scopeKind==="ALL_BRANCHES"?"Organization-wide branch access":
        x.scopeKind==="BRANCH"?"Branch":"Geographic area"}: {x.scopeName}</td>
      <td>{x.endedAt?"Ended":"Current"}</td><td>{x.reason}</td>
      <td>{data.canGrant&&!x.endedAt?
       <button type="button" disabled={busy||unknown||password.length<8}
        onClick={()=>void end(x.assignmentRef)}>End staff access</button>:"—"}</td>
     </tr>)}</tbody></table></div>}
  </>}
 </section>;
}
