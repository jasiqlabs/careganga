"use client";
import {useCallback,useEffect,useRef,useState} from "react";
type Item={caseRef:string;reference:string;status:string;revision:number;title:string;campaign:string;canDecide:boolean;submittedAt:string};
type Page={items:Item[];offset:number;hasMore:boolean};
type Policy={configured:boolean;version:number};
type Frozen={title:string;category:string;goalMinor:string|null;startAt:string|null;endAt:string|null;
 projectRef:string|null;eventRef:string|null;steps:Record<string,unknown>};
type Case={caseRef:string;reference:string;status:string;revision:number;canDecide:boolean;source:Frozen;
 history:{action:string;remarks:string;at:string;actor:string}[]};
type Decision="APPROVE"|"RETURN"|"REJECT";
const entry={minHeight:42,padding:"10px 12px",borderRadius:8,border:"1px solid var(--cg-border)",background:"var(--cg-surface,#fff)",color:"inherit"} as const;
const panel={padding:16,border:"1px solid var(--cg-border)",borderRadius:12,background:"var(--cg-surface,#fff)"} as const;
const row={display:"flex",flexWrap:"wrap" as const,alignItems:"center" as const,gap:9};
async function request<T>(path:string,method:"GET"|"POST"="GET",body?:Record<string,unknown>):Promise<T>{
 const r=await fetch("/api/campaign-reviews"+(path.startsWith("?")?path:path?"/"+path:""),{method,cache:"no-store",
  headers:body?{"Content-Type":"application/json"}:undefined,body:body?JSON.stringify(body):undefined,
  signal:AbortSignal.timeout(16000)});
 const v:unknown=await r.json().catch(()=>null);
 if(!r.ok||v===null)throw Object.assign(Error(v&&typeof v==="object"&&"message" in v&&typeof v.message==="string"?
   v.message:"Cannot confirm current campaign review."),{status:r.status});
 return v as T;
}
const rupees=(minor:string|null)=>{try{
 if(minor===null||!/^[0-9]+$/.test(minor))return "Not entered";
 const v=BigInt(minor);return "₹"+(v/100n).toLocaleString("en-IN")+"."+(v%100n).toString().padStart(2,"0");
 }catch{return "Not available";}};
export function CampaignReviewWorkspace({canConfigure}:{canConfigure:boolean}){
 const [list,setList]=useState<Item[]>([]),[caseData,setCaseData]=useState<Case|null>(null);
 const [policy,setPolicy]=useState<Policy|null>(null),[filter,setFilter]=useState("ALL");
 const [q,setQ]=useState(""),[search,setSearch]=useState(""),[offset,setOffset]=useState(0),[more,setMore]=useState(false);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(false);
 const [notice,setNotice]=useState(""),[error,setError]=useState("");
 const [action,setAction]=useState<Decision>("APPROVE"),[remarks,setRemarks]=useState(""),
  [password,setPassword]=useState(""),[setupPassword,setSetupPassword]=useState("");
 const seq=useRef(0),pending=useRef<{key:string;ref:string;revision:number;action:Decision;remarks:string}|null>(null);
 const refresh=useCallback(async()=>{
  const i=++seq.current;setLoading(true);
  try{
   const result=await request<Page>("?"+new URLSearchParams({status:filter,q:search,offset:String(offset)}));
   if(i===seq.current){setList(result.items);setMore(result.hasMore);setError("");}
  }catch(e){if(i===seq.current){setList([]);setError(e instanceof Error?e.message:"Review queue unavailable.");}}
  finally{if(i===seq.current)setLoading(false);}
 },[filter,search,offset]);
 useEffect(()=>{void refresh();void request<Policy>("policy").then(setPolicy).catch(()=>setPolicy(null));
  return()=>{seq.current++;};
 },[refresh]);
 const open=async(c:Item)=>{
  if(busy||pending.current)return;setLoading(true);setError("");setNotice("");
  try{const x=await request<Case>(c.caseRef);setCaseData(x);setAction("APPROVE");setRemarks("");setPassword("");}
  catch(e){setError(e instanceof Error?e.message:"Review details unavailable.");}
  finally{setLoading(false);}
 };
 const configure=async()=>{
  if(busy||!canConfigure||!setupPassword)return;setBusy(true);setError("");
  try{const p=await request<Policy>("policy","POST",{currentPassword:setupPassword});
   setPolicy(p);setSetupPassword("");setNotice("Original independent CG-03 campaign review policy configured.");
  }catch(e){setError(e instanceof Error?e.message:"Campaign review configuration not confirmed.");}
  finally{setBusy(false);}
 };
 const decide=async()=>{
  if(busy||!caseData||!caseData.canDecide||!password)return;setBusy(true);setError("");
  if(!pending.current)pending.current={key:crypto.randomUUID(),ref:caseData.caseRef,
   revision:caseData.revision,action,remarks:remarks.trim()};
  const cmd=pending.current;
  try{
   await request(cmd.ref+"/decide","POST",{requestKey:cmd.key,expectedRevision:cmd.revision,
    action:cmd.action,remarks:cmd.remarks,currentPassword:password});
   pending.current=null;setPassword("");setRemarks("");
   setNotice("Independent review confirmed. Campaign publication remains a separate authorized process.");
   const x=await request<Case>(cmd.ref);setCaseData(x);void refresh();
  }catch(e){
   const status=e&&typeof e==="object"&&"status" in e?Number(e.status):0;
   if(status>0&&status<500&&![408,429].includes(status))pending.current=null;
   setError(e instanceof Error?e.message:"Review outcome uncertain. Check the original case and retry the same key.");
  }finally{setBusy(false);}
 };
 return <section style={{display:"grid",gap:14}} aria-label="Independent campaign approval">
  <header><h2>Campaign verification</h2><p>Independent protected CG-03 decisions. Approval does not publish a campaign or receive a donation.</p></header>
  {policy&&!policy.configured&&<div style={panel}>
   <p>Original campaign review is not configured. A Foundation administrator must configure it before drafts can be submitted.</p>
   {canConfigure&&<div style={row}><label>Current password <input style={entry} type="password" autoComplete="current-password"
      value={setupPassword} onChange={e=>setSetupPassword(e.target.value)}/></label>
      <button type="button" disabled={busy||setupPassword.length<8} onClick={()=>void configure()}>Configure review policy</button></div>}
  </div>}
  <div style={{...row,...panel}}>
   <label>Case status <select style={entry} value={filter} onChange={e=>{setFilter(e.target.value);setOffset(0);}}>
    {["ALL","SUBMITTED","RETURNED","REJECTED","OWNER_COMPLETED"].map(v=><option key={v} value={v}>{v.replaceAll("_"," ")}</option>)}
   </select></label>
   <label>Search campaign <input style={entry} value={q} maxLength={80} onChange={e=>setQ(e.target.value)}/></label>
   <button type="button" disabled={busy} onClick={()=>{setOffset(0);setSearch(q.trim());}}>Search</button>
   <button type="button" disabled={busy} onClick={()=>void refresh()}>Refresh</button>
  </div>
  {loading&&<p role="status">Verifying campaign approvals…</p>}
  {!loading&&!list.length&&<p>No permitted review cases match the current filters.</p>}
  <div style={{display:"grid",gap:9}}>
   {list.map(c=><article key={c.caseRef} style={panel}>
    <div style={row}><strong>{c.title}</strong><span>{c.reference}</span><span>{c.status.replaceAll("_"," ")}</span>
     <button type="button" disabled={busy||!!pending.current} onClick={()=>void open(c)}>{c.canDecide?"Review":"View history"}</button>
    </div></article>)}
  </div>
  <div style={row}>{offset>0&&<button onClick={()=>setOffset(v=>Math.max(0,v-25))}>Previous</button>}
   {more&&<button onClick={()=>setOffset(v=>v+25)}>Next</button>}</div>
  {caseData&&<article style={panel}>
   <div style={row}><h3>{caseData.reference}</h3>
    <button type="button" disabled={busy||!!pending.current} onClick={()=>setCaseData(null)}>Close</button></div>
   <p><strong>Campaign:</strong> {caseData.source.title} · {caseData.source.category}</p>
   <p><strong>Planned target:</strong> {rupees(caseData.source.goalMinor)} (not money received)</p>
   <p><strong>Campaign dates:</strong> {caseData.source.startAt||"Not set"} to {caseData.source.endAt||"Not set"}</p>
   <p><strong>Review status:</strong> {caseData.status.replaceAll("_"," ")}</p>
   {caseData.canDecide&&<div style={{display:"grid",gap:10}}>
    <label>Decision <select style={entry} value={action} disabled={busy||!!pending.current}
      onChange={e=>setAction(e.target.value as Decision)}>
     <option value="APPROVE">Approve campaign source</option><option value="RETURN">Return for correction</option><option value="REJECT">Reject campaign</option>
    </select></label>
    <label>Remarks <textarea style={{...entry,width:"100%",minHeight:78}} value={remarks} maxLength={500}
      disabled={busy||!!pending.current} onChange={e=>setRemarks(e.target.value)}/></label>
    <label>Confirm current password <input style={entry} type="password" autoComplete="current-password"
      disabled={busy} value={password} onChange={e=>setPassword(e.target.value)}/></label>
    <button type="button" disabled={busy||password.length<8||action!=="APPROVE"&&remarks.trim().length<3}
     onClick={()=>void decide()}>{pending.current?"Retry same protected decision":"Confirm independent decision"}</button>
    <p>Decisions require a different authorized reviewer; the server revalidates the frozen source and current password.</p>
   </div>}
   <h4>Decision history</h4>
   {caseData.history.map((h,i)=><p key={i}>{h.action.replaceAll("_"," ")} · {h.actor} · {new Date(h.at).toLocaleString("en-IN")} {h.remarks?"— "+h.remarks:""}</p>)}
  </article>}
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  {pending.current&&<p role="alert">The previous decision may have reached the server. Retry with its original request key; do not create a second decision.</p>}
 </section>;
}
