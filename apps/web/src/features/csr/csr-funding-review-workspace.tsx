"use client";
import {useEffect,useRef,useState,type CSSProperties} from "react";
type Item={caseRef:string;reference:string;status:string;revision:number;title:string;canDecide:boolean};
type Source={purpose:string;amountMinor:string;csrRequestedMinor:string;
 foundationRequestedMinor:string;csrShareBps:number;foundationShareBps:number;
 fundType:string;projectRef:string|null;branchRef:string|null;currency:string};
type Detail={caseRef:string;reference:string;status:string;revision:number;
 canDecide:boolean;source:Source;history:{action:string;remarks:string;at:string;actor:string}[]};
type Policy={configured:boolean;version:number};
type List={items:Item[];hasMore:boolean};
type Action="APPROVE"|"RETURN"|"REJECT";
type Decision={requestKey:string;expectedRevision:number;action:Action;remarks:string;currentPassword:string};
const panel:CSSProperties={padding:16,border:"1px solid var(--cg-border)",
 borderRadius:12,background:"var(--cg-surface,#fff)",display:"grid",gap:11};
const input:CSSProperties={width:"100%",minHeight:44,padding:10,
 border:"1px solid var(--cg-border)",borderRadius:8};
const button:CSSProperties={padding:"10px 13px",border:"1px solid var(--cg-border)",
 borderRadius:8,background:"var(--cg-surface,#fff)",color:"inherit"};
const amount=(s:string)=>{try{const v=BigInt(s);return "₹"+(v/100n).toLocaleString("en-IN")+
 "."+(v%100n).toString().padStart(2,"0");}catch{return "Amount unavailable";}};
async function request<T>(path:string,body?:Record<string,unknown>):Promise<T>{
 const r=await fetch("/api/csr/funding-reviews"+path,{cache:"no-store",
  ...(body?{method:"POST",headers:{"Content-Type":"application/json"},
   body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(18000)});
 const v:unknown=await r.json().catch(()=>null);
 if(!r.ok||v===null)throw Object.assign(Error(
  v&&typeof v==="object"&&"message" in v&&typeof v.message==="string"?
  v.message:"Independent funding review result cannot be confirmed."),
  {status:r.status||503});
 return v as T;
}
export function CsrFundingReviewWorkspace({canConfigure}:{canConfigure:boolean}){
 const [items,setItems]=useState<List>({items:[],hasMore:false});
 const [policy,setPolicy]=useState<Policy|null>(null),[detail,setDetail]=useState<Detail|null>(null);
 const [q,setQ]=useState(""),[offset,setOffset]=useState(0),[epoch,setEpoch]=useState(0);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [password,setPassword]=useState(""),[remarks,setRemarks]=useState("");
 const [action,setAction]=useState<Action>("APPROVE");
 const [pending,setPending]=useState<{caseRef:string;data:Decision}|null>(null);
 const listSeq=useRef(0),detailSeq=useRef(0);
 const clear=()=>{detailSeq.current++;setDetail(null);setPassword("");setRemarks("");setPending(null);};
 const refresh=()=>{clear();setEpoch(n=>n+1);};
 useEffect(()=>{
  let live=true;const current=++listSeq.current;setLoading(true);
  const query=new URLSearchParams({q:q.trim().slice(0,80),offset:String(offset)});
  void Promise.all([request<List>("?"+query),request<Policy>("/policy")])
   .then(([list,p])=>{if(live&&listSeq.current===current){
    setItems(list);setPolicy(p);setError("");}})
   .catch(e=>{if(live&&listSeq.current===current){
    setItems({items:[],hasMore:false});
    setError(e instanceof Error?e.message:"Protected funding reviews unavailable.");}})
   .finally(()=>{if(live&&listSeq.current===current)setLoading(false);});
  return()=>{live=false;};
 },[q,offset,epoch]);
 const inspect=async(id:string)=>{
  if(busy||pending)return;
  const current=++detailSeq.current;setDetail(null);setBusy(true);setError("");
  try{
   const value=await request<Detail>("/"+id);
   if(current!==detailSeq.current)return;
   setDetail(value);setRemarks("");setAction("APPROVE");setPassword("");
  }catch(e){if(current===detailSeq.current)setError(
    e instanceof Error?e.message:"Funding case is no longer available.");}
  finally{setBusy(false);}
 };
 const configure=async()=>{
  if(busy||!canConfigure||password.length<8)return;
  setBusy(true);setError("");
  try{
   await request("/policy",{currentPassword:password});
   setPassword("");setNotice("Protected funding review policy configured.");refresh();
  }catch(e){setError(e instanceof Error?e.message:"Review configuration unavailable.");}
  finally{setBusy(false);}
 };
 const decide=async(retry=false)=>{
  if(!detail||busy||!detail.canDecide||!retry&&!!pending)return;
  const payload=pending?.data??{
   requestKey:crypto.randomUUID(),expectedRevision:detail.revision,
   action,remarks,currentPassword:password};
  const target=pending?.caseRef??detail.caseRef;
  setPending({caseRef:target,data:payload});setBusy(true);setError("");
  try{
   await request("/"+target+"/decide",payload);
   setNotice("Independent funding decision recorded. This is not received cash.");
   refresh();
  }catch(e){
   const status=e&&typeof e==="object"&&"status" in e?Number(e.status):503;
   if(status>0&&status<500){setPending(null);setPassword("");}
   setError(status>=500||status===0?
    "Decision outcome uncertain. Refresh the original case or retry exactly the same request.":
    e instanceof Error?e.message:"Funding decision rejected.");
  }finally{setBusy(false);}
 };
 return <section aria-label="Independent CSR funding reviews" style={panel}>
  <h2 style={{margin:0}}>Independent Funding Approvals</h2>
  <p style={{fontSize:13,margin:0}}>Only a distinct current Foundation protected reviewer can
   validate signed funding terms. A signed commitment never posts a CG09 bank receipt.</p>
  {!!error&&<p role="alert" style={{color:"#B91C1C"}}>{error}</p>}
  {!!notice&&<p role="status" style={{color:"#166534"}}>{notice}</p>}
  {policy&&!policy.configured&&<div style={panel}>
   <p>Independent funding review must be configured before a proposal can be submitted.</p>
   {canConfigure&&<><label>Current password<input style={input} type="password"
    autoComplete="current-password" value={password}
    onChange={e=>setPassword(e.target.value)}/></label>
    <button type="button" style={button} disabled={busy||password.length<8}
     onClick={()=>void configure()}>Configure protected funding review</button></>}
  </div>}
  <div style={{display:"flex",gap:9,flexWrap:"wrap",alignItems:"end"}}>
   <label style={{flex:"1 1 180px"}}>Search real funding cases
    <input style={input} maxLength={80} value={q} disabled={!!pending||busy}
     onChange={e=>{clear();setOffset(0);setQ(e.target.value);}}/></label>
   <button type="button" style={button} disabled={busy||!!pending}
    onClick={refresh}>Refresh reviews</button>
  </div>
  {loading?<p role="status">Checking protected funding review cases…</p>:
   items.items.length===0?<p>No real funding cases match your current access.</p>:
   <div style={{display:"grid",gap:9}}>{items.items.map(x=>
    <div key={x.caseRef} style={{display:"flex",justifyContent:"space-between",gap:9,flexWrap:"wrap"}}>
     <span>{x.title} · {x.reference} · {x.status.replaceAll("_"," ")}</span>
     <button type="button" style={button} disabled={busy||!!pending}
      onClick={()=>void inspect(x.caseRef)}>Review signed terms</button>
    </div>)}</div>}
  <div style={{display:"flex",gap:9,justifyContent:"end",alignItems:"center"}}>
   <button type="button" style={button} disabled={loading||busy||!!pending||offset===0}
    onClick={()=>{clear();setOffset(x=>Math.max(0,x-25));}}>Previous</button>
   Page {Math.floor(offset/25)+1}
   <button type="button" style={button} disabled={loading||busy||!!pending||!items.hasMore}
    onClick={()=>{clear();setOffset(x=>x+25);}}>Next</button>
  </div>
  {detail&&<div style={panel}>
   <h3 style={{margin:0}}>{detail.source.purpose} · {detail.reference}</h3>
   <p><strong>Proposed total:</strong> {amount(detail.source.amountMinor)}</p>
   <p><strong>CSR commitment:</strong> {amount(detail.source.csrRequestedMinor)}
    {" "}({detail.source.csrShareBps/100}%)</p>
   <p><strong>Foundation commitment:</strong> {amount(detail.source.foundationRequestedMinor)}
    {" "}({detail.source.foundationShareBps/100}%)</p>
   <p><strong>Review status:</strong> {detail.status.replaceAll("_"," ")}.
    No bank receipt, allocation or utilization is implied.</p>
   {detail.status==="SUBMITTED"&&<a href={"/api/csr/funding-reviews/"+detail.caseRef+"/agreement"}
    download>Download private scanner-verified funding agreement</a>}
   {detail.history.map((x,i)=><p key={i} style={{margin:0,fontSize:12}}>
    {x.actor}: {x.action} · {x.remarks}</p>)}
   {detail.canDecide&&<div style={{display:"grid",gap:9}}>
    <label>Independent decision<select style={input} value={action} disabled={busy||!!pending}
     onChange={e=>setAction(e.target.value as Action)}>
     <option value="APPROVE">Approve signed commitment</option>
     <option value="RETURN">Return for correction</option>
     <option value="REJECT">Reject proposal</option>
    </select></label>
    <label>Review remarks<textarea style={input} maxLength={500} value={remarks}
     disabled={busy||!!pending} onChange={e=>setRemarks(e.target.value)}/></label>
    <label>Current password<input type="password" autoComplete="current-password"
     style={input} value={password} disabled={busy||!!pending}
     onChange={e=>setPassword(e.target.value)}/></label>
    <button type="button" style={button}
     disabled={busy||!!pending||password.length<8||action!=="APPROVE"&&remarks.trim().length<3}
     onClick={()=>void decide()}>Confirm independent funding decision</button>
    {pending&&<button type="button" style={button} disabled={busy}
     onClick={()=>void decide(true)}>Retry exact original decision</button>}
   </div>}
   <button type="button" style={button} disabled={busy||!!pending}
    onClick={clear}>Close review</button>
  </div>}
 </section>;
}
