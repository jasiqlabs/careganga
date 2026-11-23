"use client";
import {useEffect,useMemo,useState} from "react";

type ReportRow={ref:string;branchName:string|null;partnerName:string|null;
 projectName:string|null;purpose:string;fundType:string;status:string;updatedAt:string;
 requestedMinor:string;committedMinor:string;receivedMinor:string;allocatedMinor:string;
 utilizedMinor:string;availableMinor:string|null;financeStatus:string};
type Page={items:ReportRow[];hasMore:boolean;nextCursor:string|null;
 currency:"INR";notice:string};
type Choices={branches:{value:string;label:string}[];projects:{value:string;label:string}[]};
const amount=(raw:string|null)=>{if(raw===null)return "Verification pending";
 try{const n=BigInt(raw);return "₹"+(n/100n).toLocaleString("en-IN")+"."+
 (n%100n).toString().padStart(2,"0");}catch{return "Finance unavailable";}};
const select={padding:10,border:"1px solid var(--cg-border,#CBD5E1)",
 background:"var(--cg-surface,#fff)",borderRadius:9,minHeight:42,maxWidth:"100%"};
export function CsrFundingReportsWorkspace(){
 const [scope,setScope]=useState(""),[stage,setStage]=useState("ALL"),[search,setSearch]=useState("");
 const [from,setFrom]=useState(""),[to,setTo]=useState("");
 const [project,setProject]=useState(""),[choices,setChoices]=useState<Choices|null>(null);
 const [cursor,setCursor]=useState(""),[back,setBack]=useState<string[]>([]);
 const [epoch,setEpoch]=useState(0),[page,setPage]=useState<Page|null>(null);
 const [loading,setLoading]=useState(true),[error,setError]=useState("");
 const filters=useMemo(()=>{
  const params=new URLSearchParams();
  if(scope)params.set("branchRef",scope);
  if(stage!=="ALL")params.set("status",stage);
  if(search.trim())params.set("q",search.trim().slice(0,100));
  if(from)params.set("from",from);
  if(to)params.set("to",to);
  if(project)params.set("projectRef",project);
  return params;
 },[scope,stage,search,from,to,project]);
 const filterKey=filters.toString();
 const refresh=()=>{setCursor("");setBack([]);setEpoch(x=>x+1);};
 useEffect(()=>{
  let alive=true;
  void fetch("/api/csr/funding-proposals/options",{cache:"no-store"})
   .then(async r=>r.ok?await r.json() as Choices:null)
   .then(x=>{if(alive)setChoices(x);}).catch(()=>{if(alive)setChoices(null);});
  return()=>{alive=false;};
 },[epoch]);
 useEffect(()=>{
  let alive=true;setError("");setPage(null);setLoading(true);
  const params=new URLSearchParams(filterKey);
  if(cursor)params.set("cursor",cursor);
  const path="/api/csr/funding-reports"+(params.size?"?"+params.toString():"");
  void fetch(path,{cache:"no-store",signal:AbortSignal.timeout(20000)})
   .then(async r=>{
    const data:unknown=await r.json().catch(()=>null);
    if(!r.ok||!data||typeof data!=="object"||!("items" in data))
     throw Error(r.status===403?"This private report is restricted by your role or branch.":
      r.status===401?"Sign in again to view Finance reports.":
      "Original CG09 finance verification is unavailable; no cash amount is shown.");
    return data as Page;
   }).then(v=>{if(alive)setPage(v);})
   .catch(e=>{if(alive)setError(e instanceof Error?e.message:"Finance report unavailable.");})
   .finally(()=>{if(alive)setLoading(false);});
  return()=>{alive=false;};
 },[filterKey,cursor,epoch]);
 const setFilter=(fn:()=>void)=>{fn();setCursor("");setBack([]);};
 const exportPath="/api/csr/funding-reports/export/csv"+
  (filterKey?"?"+filterKey:"");
 return <section aria-label="Source-verified private CSR funding report"
  style={{padding:20,border:"1px solid var(--cg-border,#CBD5E1)",borderRadius:14,
   background:"var(--cg-surface,#fff)",display:"grid",gap:14}}>
  <header>
   <h2 style={{margin:0}}>CSR Funding Reports</h2>
   <p style={{margin:"6px 0 0",fontSize:13}}>Requested is not approved. Committed
    is an approved pledge, not bank cash. Received and utilized come exclusively
    from original verified CG09 financial sources.</p>
  </header>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12}}>
   <label>Search partner or purpose<input style={select} type="search" maxLength={100}
    value={search} onChange={e=>setFilter(()=>setSearch(e.target.value))}/></label>
   <label>Original status<select style={select} value={stage}
    onChange={e=>setFilter(()=>setStage(e.target.value))}>
    {["ALL","DRAFT","SUBMITTED","APPROVED","RETURNED","REJECTED"].map(v=>
     <option key={v} value={v}>{v==="ALL"?"All statuses":v}</option>)}
   </select></label>
   <label>Branch<select style={select} value={scope}
    onChange={e=>setFilter(()=>setScope(e.target.value))}>
    <option value="">My permitted scope</option>
    {(choices?.branches??[]).map(x=><option key={x.value} value={x.value}>{x.label}</option>)}
   </select></label>
   <label>CG05 project<select style={select} value={project}
    onChange={e=>setFilter(()=>setProject(e.target.value))}>
    <option value="">All projects / general purpose</option>
    {(choices?.projects??[]).map(x=><option key={x.value} value={x.value}>{x.label}</option>)}
   </select></label>
   <label>Updated from<input style={select} type="date" value={from}
    onChange={e=>setFilter(()=>setFrom(e.target.value))}/></label>
   <label>Updated to<input style={select} type="date" value={to}
    onChange={e=>setFilter(()=>setTo(e.target.value))}/></label>
  </div>
  <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"center"}}>
   <button type="button" style={select} onClick={refresh}>Refresh original finance sources</button>
   {page&&!loading&&<a href={exportPath} style={{...select,display:"inline-block",
    textDecoration:"none",color:"inherit"}}>Export authorized CSV (max 1,000)</a>}
  </div>
  {loading&&<p role="status">Verifying current foundation and CG09 records…</p>}
  {!!error&&<p role="alert" style={{color:"#B91C1C"}}>{error}</p>}
  {page&&!loading&&<>
   <p style={{fontSize:13,margin:0}}>{page.notice}</p>
   {page.items.length===0?<p>There are no original funding records matching these filters.</p>:
    <div style={{overflowX:"auto"}}>
     <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
      <thead><tr>{["CSR sponsor / purpose","Branch / project","Funding status",
       "Requested","Committed","Received","Allocated","Utilized","Available"].map(x=>
       <th key={x} scope="col" style={{padding:9,textAlign:"left",
        borderBottom:"1px solid var(--cg-border,#CBD5E1)",whiteSpace:"nowrap"}}>{x}</th>)}</tr></thead>
      <tbody>{page.items.map(x=><tr key={x.ref}>
       <td style={{padding:9}}><strong>{x.partnerName??"Foundation source"}</strong>
        <div>{x.purpose}</div></td>
       <td style={{padding:9}}>{x.branchName??"Foundation"}<div>{x.projectName??"General purpose"}</div></td>
       <td style={{padding:9}}>{x.status}
        {x.financeStatus!=="VERIFIED_SOURCE"&&<div style={{color:"#B45309"}}>
         {x.financeStatus==="RECEIPT_PENDING"?"Bank receipt pending":"Finance revalidation required"}</div>}</td>
       {[x.requestedMinor,x.committedMinor,x.receivedMinor,x.allocatedMinor,
        x.utilizedMinor,x.availableMinor].map((v,i)=>
         <td key={i} style={{padding:9,whiteSpace:"nowrap"}}>{amount(v)}</td>)}
      </tr>)}</tbody>
     </table>
    </div>}
   <div style={{display:"flex",gap:10,justifyContent:"space-between"}}>
    <button type="button" style={select} disabled={back.length===0}
     onClick={()=>{setCursor(back[back.length-1]??"");setBack(x=>x.slice(0,-1));}}>Previous</button>
    <button type="button" style={select} disabled={!page.hasMore||!page.nextCursor}
     onClick={()=>{if(page.nextCursor){setBack(x=>[...x,cursor]);setCursor(page.nextCursor!);}}}>Next 25</button>
   </div>
  </>}
 </section>;
}
