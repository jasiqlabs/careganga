"use client";
import {useEffect,useState} from "react";
type Case={
 caseRef:string;reference:string;branchName:string;registrationRef:string;
 submissionRevision:number;status:string;revision:number;submittedAt:string
};
type Detail={caseRef:string;reference:string;registrationRef:string;
 submissionRevision:number;status:string;revision:number;
 canDecide:boolean;history:{action:string;remarks:string;at:string}[]};
const api="/api/foundation/branch-workflow";
async function request<T>(path:string,method:"GET"|"POST"="GET",body?:object):Promise<T>{
 const response=await fetch(api+path,{method,cache:"no-store",
   ...(body?{headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})});
 const raw:unknown=await response.json().catch(()=>null);
 if(!response.ok){
   const message=raw&&typeof raw==="object"&&"message" in raw&&typeof raw.message==="string"
     ?raw.message:"The original branch decision cannot be verified.";
   throw Object.assign(new Error(message),{status:response.status});
 }
 return raw as T;
}
export function BranchApprovalInbox(){
 const [cases,setCases]=useState<Case[]>([]);
 const [processConfigured,setProcessConfigured]=useState<boolean|null>(null);
 const [selected,setSelected]=useState<Detail|null>(null);
 const [action,setAction]=useState<"APPROVE"|"RETURN"|"REJECT">("APPROVE");
 const [remarks,setRemarks]=useState(""),[totp,setTotp]=useState("");
 const [key,setKey]=useState("");
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [message,setMessage]=useState(""),[error,setError]=useState("");
 async function checkProcess(){
   const result=await request<{configured:boolean}>("/approval-process");
   setProcessConfigured(result.configured);
 }
 async function initializeProcess(){
   setBusy(true);setError("");setMessage("");
   try{
     const result=await request<{configured:boolean}>("/approval-process/initialize","POST");
     setProcessConfigured(result.configured);
     setMessage(result.configured?"Branch approval review is now available.":
       "The approval route is not ready.");
   }catch(e){setError(e instanceof Error?e.message:"The approval route could not be initialized.");}
   finally{setBusy(false);}
 }
 async function refresh(){
   await checkProcess();
   const list=await request<{cases:Case[]}>("/cases");
   if(!Array.isArray(list.cases))throw Error("Review inbox unavailable");
   setCases(list.cases);
   if(selected){
     const same=list.cases.find(x=>x.caseRef===selected.caseRef);
     if(same)await open(same.caseRef);
     else setSelected(null);
   }
 }
 useEffect(()=>{
   let active=true;
   void checkProcess().catch(()=>{if(active)setProcessConfigured(null);});
   void request<{cases:Case[]}>("/cases").then(result=>{
     if(active)setCases(result.cases);
   }).catch(()=>{if(active){setCases([]);setError("Branch approvals cannot be verified.");}})
    .finally(()=>{if(active)setLoading(false);});
   return()=>{active=false;};
 },[]);
 async function open(ref:string){
   setBusy(true);setError("");setMessage("");setTotp("");setKey("");
   try{setSelected(await request<Detail>("/cases/"+encodeURIComponent(ref)));}
   catch(e){setSelected(null);setError(e instanceof Error?e.message:"Review unavailable");}
   finally{setBusy(false);}
 }
 async function decide(){
   if(!selected||!selected.canDecide||busy||totp.length!==6)return;
   const requestKey=key||crypto.randomUUID();
   setKey(requestKey);setBusy(true);setMessage("");setError("");
   try{
     const state=await request<{status:string;message?:string}>(
       "/cases/"+encodeURIComponent(selected.caseRef)+"/decide","POST",{
         action,remarks,expectedRevision:selected.revision,requestKey,totp
       });
     setKey("");setTotp("");
     setMessage(state.message??"The decision was recorded. Verify the resulting branch status.");
     await refresh();
   }catch(e){
     const definite=e&&typeof e==="object"&&"status" in e&&
       typeof e.status==="number"&&[400,401,403,404,409,429].includes(e.status);
     if(definite)setKey("");
     setError(e instanceof Error?e.message:"The decision result is unknown.");
   }finally{setBusy(false);}
 }
 async function reconcile(){
   if(!selected||busy)return;
   setBusy(true);setMessage("");setError("");
   try{
     const result=await request<{status:string;message?:string}>(
       "/cases/"+encodeURIComponent(selected.caseRef)+"/reconcile","POST");
     setMessage(result.message??"The original decision was rechecked.");
     await refresh();
   }catch(e){setError(e instanceof Error?e.message:"The original decision is not yet synchronized.");}
   finally{setBusy(false);}
 }
 async function finalize(){
   if(!selected||busy)return;
   setBusy(true);setMessage("");setError("");
   try{
     const result=await request<{status:string;message:string}>(
       "/cases/"+encodeURIComponent(selected.caseRef)+"/finalize","POST");
     setMessage(result.message??"Branch activation needs status verification.");
     await refresh();
   }catch(e){setError(e instanceof Error?e.message:"Activation cannot be confirmed.");}
   finally{setBusy(false);}
 }
 return <section className="role-pane branch-review-inbox">
   <header className="toolbar"><h2>Super Admin branch approvals</h2>
     <button type="button" disabled={busy} onClick={()=>void refresh().catch(
       ()=>setError("Current approvals could not be loaded."))}>Refresh</button></header>
   {processConfigured===false&&<div className="notice">
     Branch approvals require an authorized one-time Super Admin setup.
     <button type="button" disabled={busy} onClick={()=>void initializeProcess()}>
       Enable Foundation branch approvals</button></div>}
   {processConfigured===true&&<p role="status" className="notice">
     The approved branch-review process is configured.</p>}
   {loading?<p role="status">Checking branch applications...</p>:null}
   {!!error&&<p role="alert" className="notice">{error}</p>}
   {!!message&&<p role="status" className="notice">{message}</p>}
   {cases.length===0&&!loading?<p>No permitted branch applications.</p>:
     <ul className="branch-draft-list">{cases.map(c=><li key={c.caseRef}>
       <button type="button" disabled={busy} aria-current={selected?.caseRef===c.caseRef?"true":undefined}
         onClick={()=>void open(c.caseRef)}>
         <strong>{c.branchName}</strong>
         <span>{c.reference} · {c.status.replaceAll("_"," ")}</span>
       </button></li>)}</ul>}
   {selected&&<div className="form">
     <h3>{selected.reference} · {selected.status.replaceAll("_"," ")}</h3>
     <ol>{selected.history.map((h,i)=><li key={i}>{h.action.replaceAll("_"," ")}
       {h.remarks?": "+h.remarks:""} · {new Date(h.at).toLocaleDateString()}</li>)}</ol>
     {selected.canDecide&&<>
       <label className="field">Decision<select value={action}
         onChange={e=>setAction(e.target.value as typeof action)}>
         <option value="APPROVE">Approve</option><option value="RETURN">Return for correction</option>
         <option value="REJECT">Reject</option></select></label>
       <label className="field">Reason / remarks<textarea maxLength={500}
         value={remarks} onChange={e=>setRemarks(e.target.value)}/></label>
       <label className="field">Fresh Super Admin authenticator code
         <input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
           value={totp} onChange={e=>setTotp(e.target.value.replace(/\D/g,""))}/></label>
       <button type="button" className="primary" disabled={busy||totp.length!==6}
         onClick={()=>void decide()}>Record current decision</button>
       {key&&<p className="notice">A decision request remains unconfirmed.
         Check the current review before starting a different request.</p>}
     </>}
     {["RETURNED","REJECTED","PENDING_OWNER"].includes(selected.status)&&
       <button type="button" disabled={busy} onClick={()=>void reconcile()}>
         Recheck original decision status</button>}
     {selected.status==="PENDING_OWNER"&&<button type="button" className="primary"
       disabled={busy} onClick={()=>void finalize()}>Verify and activate approved branch</button>}
   </div>}
 </section>;
}
