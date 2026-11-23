"use client";
import {useCallback,useEffect,useRef,useState} from "react";
type Programme={ref:string;name:string;status:string};
type RewardEvent={ref:string;type:"DIGITAL"|"PHYSICAL";
 kind:"MEMBER"|"VOLUNTEER";name:string;productName:string;
 pointsCost:string;status:string;requestedAt:string};
type Result={items:RewardEvent[];hasMore:boolean;page:number;notice:string};
const styles={
 control:{minHeight:42,padding:"8px 11px",border:"1px solid var(--cg-border,#CBD5E1)",
  borderRadius:9,background:"var(--cg-surface,#fff)",color:"inherit",maxWidth:"100%"},
 button:{minHeight:44,padding:"9px 14px",border:"1px solid var(--cg-border,#CBD5E1)",
  borderRadius:9,background:"var(--cg-surface,#fff)",color:"inherit"}
} as const;
const niceStatus=(state:string)=>state==="HELD"?"Points reserved — pending delivery":
 state==="CANCELLED"?"Cancelled — points released":
 state==="FULFILLED"?"Delivered and verified":
 state==="ISSUED_AWAITING_HANDOVER"?"Warehouse issued — recipient handover pending":
 state==="FULFILLMENT_PENDING"?"Awaiting genuine fulfillment":"Unavailable";
export function AdminRedemptionsTable({programme,programmes,onProgrammeChange,refreshEpoch,
 canIssueStock}:{
 programme:string;programmes:Programme[];onProgrammeChange:(value:string)=>void;
 refreshEpoch:number;canIssueStock:boolean
}){
 const [items,setItems]=useState<RewardEvent[]>([]);
 const [status,setStatus]=useState("ALL"),[search,setSearch]=useState("");
 const [appliedSearch,setAppliedSearch]=useState("");
 const [from,setFrom]=useState(""),[to,setTo]=useState("");
 const [category,setCategory]=useState("");
 const [categories,setCategories]=useState<string[]>([]);
 const [categoryError,setCategoryError]=useState("");
 const [page,setPage]=useState(2),[more,setMore]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const sequence=useRef(0);
 useEffect(()=>{
  const task=setTimeout(()=>setAppliedSearch(search.trim()),350);
  return()=>clearTimeout(task);
 },[search]);
 const load=useCallback(async(target=1,append=false)=>{
  const seq=++sequence.current;
  setBusy(true);setError("");
  if(!programme){setItems([]);setMore(false);setBusy(false);return;}
  if(from&&to&&from>to){
   setItems([]);setMore(false);setBusy(false);
   setError("The start date must not be later than the end date.");return;
  }
  try{
   const params=new URLSearchParams({page:String(target),status});
   if(appliedSearch)params.set("q",appliedSearch);
   if(category)params.set("category",category);
   if(from)params.set("from",from);
   if(to)params.set("to",to);
   const response=await fetch("/api/referrals/programmes/"+
    encodeURIComponent(programme)+"/redemptions?"+params,{
    cache:"no-store",credentials:"same-origin",signal:AbortSignal.timeout(16000)
   });
   if(!response.ok)throw Error(response.status===403?
    "Your current role cannot view these reward requests.":
    "Verified redemption history is unavailable. Refresh the original records.");
   const data=await response.json() as Result;
   if(!Array.isArray(data.items)||typeof data.hasMore!=="boolean")
    throw Error("The verified redemption history is unavailable.");
   if(seq!==sequence.current)return;
   setItems(old=>append?[...old,...data.items]:data.items);
   setMore(data.hasMore);setPage(target+1);
  }catch(e){
   if(seq===sequence.current)setError(e instanceof Error?e.message:
    "Cannot confirm the current reward history.");
  }finally{if(seq===sequence.current)setBusy(false);}
 },[programme,status,appliedSearch,category,from,to]);
 useEffect(()=>{
  const current=new AbortController();
  // Category choices are original reward_product values under the same
  // CG02 permitted-store visibility as the B15 redemption results.
  setCategory("");setCategories([]);setCategoryError("");
  if(programme){
   void fetch("/api/referrals/programmes/"+encodeURIComponent(programme)+
    "/categories",{cache:"no-store",credentials:"same-origin",signal:current.signal})
    .then(async response=>{
     if(!response.ok)throw Error("Current permitted reward categories are unavailable.");
     return response.json() as Promise<{items:string[];hasMore:boolean}>;
    }).then(result=>{
     if(!current.signal.aborted&&Array.isArray(result.items))
      setCategories(result.items.filter(x=>typeof x==="string"&&x.length<=80));
    }).catch(error=>{
     if(!current.signal.aborted)setCategoryError(error instanceof Error?
      error.message:"Current reward categories are unavailable.");
    });
  }
  return()=>current.abort();
 },[programme]);
 useEffect(()=>{
  void load(1,false);
  const hidden=()=>{
   if(document.visibilityState==="visible")void load(1,false);
   else{sequence.current++;setItems([]);setMore(false);setBusy(false);}
  };
  document.addEventListener("visibilitychange",hidden);
  return()=>{sequence.current++;document.removeEventListener("visibilitychange",hidden);};
 },[load,refreshEpoch]);
 const prepareIssue=async(record:RewardEvent)=>{
  if(!canIssueStock||busy||record.type!=="PHYSICAL"||record.status!=="HELD")return;
  setBusy(true);setError("");setNotice("");
  try{
   const response=await fetch("/api/rewards-staff/redemptions/"+
    encodeURIComponent(record.ref)+"/prepare-issue",{
    method:"POST",credentials:"same-origin",cache:"no-store",
    signal:AbortSignal.timeout(15000)
   });
   const result:unknown=await response.json().catch(()=>null);
   if(!response.ok)throw Error(response.status===403?
    "Your current warehouse/stock permissions do not allow this operation.":
    "The real physical reward or warehouse status has changed. Check Stock Operations.");
   const data=result&&typeof result==="object"?
    result as {status?:string;notice?:string}:{};
   setNotice(data.notice??"Original warehouse issue draft prepared.");
   await load(1,false);
  }catch(e){setError(e instanceof Error?e.message:
   "Issue preparation status is uncertain. Check original Stock Operations.");}
  finally{setBusy(false);}
 };
 return <section aria-label="Verified member and volunteer reward redemptions"
  style={{display:"grid",gap:12}}>
  <h3 style={{margin:0}}>Volunteer &amp; Member Redemptions</h3>
  <p style={{fontSize:13,margin:0}}>Real points holds and verified reward outcomes only.
   An unfulfilled DIGITAL request is never counted as delivered.
   Records are restricted to your current Foundation branch access.</p>
  <div style={{display:"flex",flexWrap:"wrap",gap:10,alignItems:"end"}}>
   <label style={{display:"grid",gap:5}}>Programme
    <select style={styles.control} value={programme}
     onChange={e=>onProgrammeChange(e.target.value)}>
     {!programmes.length&&<option value="">No programme configured</option>}
     {programmes.map(p=><option value={p.ref} key={p.ref}>
      {p.name} · {p.status}</option>)}
    </select>
   </label>
   <label style={{display:"grid",gap:5}}>Status
    <select style={styles.control} value={status} onChange={e=>setStatus(e.target.value)}>
     <option value="ALL">All recorded statuses</option>
     <option value="HELD">Points held</option>
     <option value="CANCELLED">Cancelled</option>
     <option value="ISSUED_AWAITING_HANDOVER">Issued, awaiting handover</option>
     <option value="FULFILLED">Verified fulfilled</option>
    </select>
   </label>
   <label style={{display:"grid",gap:5}}>Reward category
    <select style={styles.control} value={category} onChange={e=>setCategory(e.target.value)}>
     <option value="">All recorded categories</option>
     {categories.map(name=><option key={name} value={name}>{name}</option>)}
    </select>
   </label>
   <label style={{display:"grid",gap:5}}>Search member or reward
    <input type="search" value={search} maxLength={80}
     style={styles.control} onChange={e=>setSearch(e.target.value)}/>
   </label>
   <label style={{display:"grid",gap:5}}>From
    <input type="date" value={from} style={styles.control}
     onChange={e=>setFrom(e.target.value)}/></label>
   <label style={{display:"grid",gap:5}}>To
    <input type="date" value={to} style={styles.control}
     onChange={e=>setTo(e.target.value)}/></label>
   <button type="button" style={styles.button} disabled={busy}
    onClick={()=>void load(1,false)}>Refresh records</button>
  </div>
  {busy&&<p role="status">Checking original reward requests…</p>}
  {error&&<p role="alert">{error}</p>}
  {categoryError&&<p role="status">{categoryError} Category filter is unavailable; the unfiltered original records remain visible.</p>
  {notice&&<p role="status">{notice}{" "}
   <a href="/admin/inventory">Open existing Stock Operations</a>
   to upload required CG19 proof and confirm the real warehouse ISSUE. An issue is
   not yet a recipient handover.
  </p>}
  <div role="region" tabIndex={0} aria-label="Actual reward request records"
   style={{overflowX:"auto"}}>
   <table style={{width:"100%",minWidth:580,borderCollapse:"collapse",fontSize:13}}>
    <thead><tr>{["Relationship","Member / volunteer","Reward",
     "Points","Source status","Requested",...(canIssueStock?["Warehouse action"]:[])].map(x=>
      <th key={x} scope="col" style={{padding:10,textAlign:"left",
       borderBottom:"1px solid var(--cg-border,#CBD5E1)"}}>{x}</th>)}</tr></thead>
    <tbody>
     {items.map((event,index)=><tr key={event.requestedAt+":"+event.productName+":"+index}>
      <td style={{padding:9}}>{event.kind==="MEMBER"?"Member":"Volunteer"}</td>
      <td style={{padding:9}}>{event.name}</td>
      <td style={{padding:9}}>{event.productName}</td>
      <td style={{padding:9}}>{event.pointsCost}</td>
      <td style={{padding:9}}>{niceStatus(event.status)}</td>
      <td style={{padding:9}}>{new Date(event.requestedAt).toLocaleDateString("en-IN",
       {timeZone:"Asia/Kolkata"})}</td>
      {canIssueStock&&<td style={{padding:9}}>{event.type==="PHYSICAL"&&event.status==="HELD"?
       <button type="button" disabled={busy} style={styles.button}
        onClick={()=>void prepareIssue(event)}>Prepare real warehouse ISSUE</button>:
       "Not applicable"}</td>}
     </tr>)}
     {!busy&&!items.length&&<tr><td colSpan={canIssueStock?7:6} style={{padding:24,textAlign:"center"}}>
      No source-confirmed reward requests match the current filters.</td></tr>}
    </tbody>
   </table>
  </div>
  {more&&<button type="button" style={styles.button} disabled={busy}
   onClick={()=>void load(page,true)}>Older verified requests</button>}
 </section>;
}
