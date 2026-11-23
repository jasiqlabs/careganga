"use client";
import {useCallback,useEffect,useRef,useState,type CSSProperties} from "react";
type ReviewItem={caseRef:string;reference:string;status:string;revision:number;title:string;canDecide:boolean;submittedAt:string};
type Details={caseRef:string;reference:string;status:string;revision:number;source:{legalName:string;supportSummary:string;contactName:string;contactEmail:string|null;contactMobile:string|null};canDecide:boolean;history:{action:string;remarks:string;at:string;actor:string}[]};
type List={items:ReviewItem[];hasMore:boolean};
type Policy={configured:boolean;version:number};
type Decision={requestKey:string;expectedRevision:number;action:"APPROVE"|"RETURN"|"REJECT";remarks:string;currentPassword:string};
const card:CSSProperties={background:"var(--cg-surface,#fff)",border:"1px solid var(--cg-border)",padding:16,borderRadius:12,display:"grid",gap:10};
const btn:CSSProperties={border:"1px solid var(--cg-border)",borderRadius:8,padding:"10px 13px",background:"var(--cg-surface,#fff)",color:"inherit",cursor:"pointer"};
const field:CSSProperties={width:"100%",padding:10,border:"1px solid var(--cg-border)",borderRadius:8};
async function request<T>(path:string,body?:Record<string,unknown>):Promise<T>{
 const r=await fetch("/api/csr/reviews"+path,{cache:"no-store",...(body?{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})});
 const value:unknown=await r.json().catch(()=>null);
 if(!r.ok||value===null)throw Object.assign(Error(value&&typeof value==="object"&&"message" in value&&typeof value.message==="string"?value.message:"CSR review unavailable."),{status:r.status||503});
 return value as T;
}
export function CsrReviewWorkspace({canConfigure}:{canConfigure:boolean}){
 const [rows,setRows]=useState<List>({items:[],hasMore:false}),[policy,setPolicy]=useState<Policy|null>(null);
 const [detail,setDetail]=useState<Details|null>(null),[query,setQuery]=useState(""),[offset,setOffset]=useState(0),[epoch,setEpoch]=useState(0);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [password,setPassword]=useState(""),[remarks,setRemarks]=useState(""),[action,setAction]=useState<Decision["action"]>("APPROVE");
 const [pending,setPending]=useState<{caseRef:string;body:Decision}|null>(null),current=useRef(0);
 const refresh=useCallback(()=>setEpoch(v=>v+1),[]);
 useEffect(()=>{let live=true;const n=++current.current;setLoading(true);
  const params=new URLSearchParams({offset:String(offset),q:query.trim().slice(0,80)});
  void Promise.all([request<List>("?"+params),request<Policy>("/policy")]).then(([list,config])=>{
   if(live&&n===current.current){setRows(list);setPolicy(config);setError("");}
  }).catch(e=>{if(live&&n===current.current){setRows({items:[],hasMore:false});setError(e instanceof Error?e.message:"CSR review unavailable.");}})
   .finally(()=>{if(live&&n===current.current)setLoading(false);});
  return()=>{live=false;};
 },[query,offset,epoch]);
 const inspect=async(id:string)=>{if(busy)return;setError("");setNotice("");
  try{setDetail(await request<Details>("/"+id));setRemarks("");setAction("APPROVE");setPassword("");setPending(null);}
  catch(e){setError(e instanceof Error?e.message:"Protected CSR review unavailable.");}
 };
 const configure=async()=>{if(!canConfigure||busy||!password)return;
  setBusy(true);setError("");
  try{await request("/policy",{currentPassword:password});setNotice("Original protected CSR review configured.");setPassword("");refresh();}
  catch(e){setError(e instanceof Error?e.message:"CSR reviewer configuration unavailable.");}
  finally{setBusy(false);}
 };
 const decide=async(force=false)=>{
  if(!detail||busy||!detail.canDecide)return;
  if(!force&&pending)return;
  const data=pending?.body??{requestKey:crypto.randomUUID(),expectedRevision:detail.revision,action,remarks,currentPassword:password};
  const target=pending?.caseRef??detail.caseRef;
  setPending({caseRef:target,body:data});setBusy(true);setError("");
  try{await request("/"+target+"/decide",data);setPending(null);setPassword("");setDetail(null);setNotice("Independent CSR decision saved. Refresh the partner list to see its current state.");refresh();}
  catch(e){const code=e&&typeof e==="object"&&"status" in e?Number(e.status):503;
   if(code>0&&code<500){setPending(null);setPassword("");setError(e instanceof Error?e.message:"CSR decision rejected.");}
   else setError("Decision result uncertain. Check original review state or retry the exact command.");
  }finally{setBusy(false);}
 };
 return <section style={card} aria-label="Independent CSR review">
  <h2 style={{margin:0}}>Independent CSR reviews</h2>
  <p style={{margin:0,fontSize:13}}>Requires protected Foundation reviewer permission and current password. A reviewer cannot approve their own application. No public listing or financial posting occurs here.</p>
  {error&&<p role="alert" style={{color:"#b91c1c"}}>{error}</p>}
  {notice&&<p role="status" style={{color:"#166534"}}>{notice}</p>}
  {policy&&!policy.configured&&<div style={card}>
   <p>Original CSR reviewer policy is not configured. Drafts remain private.</p>
   {canConfigure&&<><label>Current password<input style={field} type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
    <button style={btn} type="button" onClick={()=>void configure()} disabled={busy||password.length<8}>Configure protected CSR review</button></>}
  </div>}
  <div style={{display:"flex",gap:9,flexWrap:"wrap",alignItems:"end"}}>
   <label style={{flex:"1 1 180px"}}>Find CSR application<input style={field} value={query} maxLength={80} onChange={e=>{setOffset(0);setQuery(e.target.value);}}/></label>
   <button style={btn} type="button" onClick={refresh}>Refresh</button>
  </div>
  {loading?<p role="status">Checking protected reviews…</p>:rows.items.length===0?<p>No matching CSR reviews.</p>:
   <div style={{display:"grid",gap:8}}>{rows.items.map(r=><div key={r.caseRef} style={{display:"flex",gap:8,justifyContent:"space-between",alignItems:"center",flexWrap:"wrap"}}>
    <span>{r.title} · {r.status.replaceAll("_"," ").toLowerCase()} · {r.reference}</span>
    <button style={btn} type="button" disabled={busy} onClick={()=>void inspect(r.caseRef)}>Review details</button></div>)}</div>}
  <div style={{display:"flex",gap:8,justifyContent:"end"}}><button style={btn} type="button" disabled={loading||offset===0} onClick={()=>setOffset(v=>Math.max(0,v-25))}>Previous</button>
   <span>Page {1+Math.floor(offset/25)}</span><button style={btn} type="button" disabled={loading||!rows.hasMore} onClick={()=>setOffset(v=>v+25)}>Next</button></div>
  {detail&&<div style={card}>
   <h3 style={{margin:0}}>{detail.source.legalName} — {detail.reference}</h3>
   <p>Proposed support: {detail.source.supportSummary}</p>
   <p>Contact: {detail.source.contactName} {detail.source.contactEmail??detail.source.contactMobile??""}</p>
   <p>Current review: {detail.status.replaceAll("_"," ").toLowerCase()}</p>
   {detail.history.length>0&&<div>{detail.history.map((e,i)=><p key={i} style={{fontSize:12,margin:0}}>{e.actor}: {e.action} {e.remarks}</p>)}</div>}
   {detail.canDecide&&<><label>Decision<select style={field} value={action} disabled={!!pending} onChange={e=>setAction(e.target.value as Decision["action"])}>
     <option value="APPROVE">Approve</option><option value="RETURN">Return for correction</option><option value="REJECT">Reject</option>
    </select></label>
    <label>Remarks<textarea style={field} value={remarks} maxLength={500} disabled={!!pending} onChange={e=>setRemarks(e.target.value)}/></label>
    <label>Current password<input type="password" autoComplete="current-password" style={field} value={password} disabled={!!pending} onChange={e=>setPassword(e.target.value)}/></label>
    <button style={btn} type="button" disabled={busy||password.length<8||action!=="APPROVE"&&remarks.trim().length<3} onClick={()=>void decide()}>{busy?"Saving decision…":"Confirm independent decision"}</button>
    {pending&&<button type="button" style={btn} disabled={busy} onClick={()=>void decide(true)}>Retry exact decision</button>}
   </>}
   <button style={btn} type="button" disabled={busy} onClick={()=>{setDetail(null);setPassword("");setPending(null);}}>Close details</button>
  </div>}
 </section>;
}
