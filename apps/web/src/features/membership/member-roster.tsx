"use client";
import {useEffect,useRef,useState,type FormEvent} from "react";
import type {CG04RosterPage,CG04RosterExport} from "@careganga/api-contracts";
const categories={ALL:"All tiers",ANNUAL:"Annual",LIFETIME:"Lifetime",HONORARY:"Honorary",STUDENT:"Student",OTHER:"Other"};
const statuses={ALL:"All statuses",ACTIVE:"Active",EXPIRED:"Expired",SUSPENDED:"Suspended",CANCELLED:"Cancelled"};
type Filter={q:string;status:string;category:string;branch:string};
const initial=():Filter=>({q:"",status:"ALL",category:"ALL",branch:""});
async function request<T>(url:string):Promise<T>{
 const r=await fetch(url,{cache:"no-store",signal:AbortSignal.timeout(12000)});
 const data=await r.json().catch(()=>null);
 if(!r.ok||data===null)throw Object.assign(new Error(typeof data?.message==="string"?data.message:"Membership roster could not be confirmed."),{status:r.status});
 return data as T;
}
export function MemberRoster({canExport=false}:{canExport?:boolean}){
 const [draft,setDraft]=useState<Filter>(initial),[filter,setFilter]=useState<Filter>(initial),[cursor,setCursor]=useState(""),[history,setHistory]=useState<string[]>([]);
 const [page,setPage]=useState<CG04RosterPage|null>(null),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(""),[notice,setNotice]=useState(""),[epoch,setEpoch]=useState(0);
 const seq=useRef(0);
 useEffect(()=>{
  const n=++seq.current;setPage(null);setLoading(true);setError("");
  const params=new URLSearchParams({...filter,cursor});
  void request<CG04RosterPage>("/api/membership/members?"+params).then(p=>{if(n===seq.current)setPage(p);}).catch(e=>{if(n===seq.current){setError(e.message);if(e.status===401)window.location.assign("/admin/login");}}).finally(()=>{if(n===seq.current)setLoading(false);});
  return()=>{seq.current++;};
 },[filter,cursor,epoch]);
 const apply=(e?:FormEvent)=>{e?.preventDefault();setHistory([]);setCursor("");setFilter({...draft,q:draft.q.trim()});};
 const reset=()=>{setDraft(initial());setFilter(initial());setHistory([]);setCursor("");};
 async function exportCsv(){
  if(busy)return;setBusy(true);setError("");setNotice("");
  try{
   const data=await request<CG04RosterExport>("/api/membership/members/export?"+new URLSearchParams(filter));
   if(typeof data.csv!=="string"||!Number.isSafeInteger(data.rows))throw Error("Roster export unavailable.");
   const blob=new Blob([data.csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob);
   const a=document.createElement("a");a.href=url;a.download="CareGanga-approved-member-roster.csv";a.click();
   setTimeout(()=>URL.revokeObjectURL(url),1500);setNotice(data.rows+" member records exported for your permitted scope.");
  }catch(e){setError(e instanceof Error?e.message:"Member export could not be confirmed.");}finally{setBusy(false);}
 }
 return <section className="cg04-panel cg04-roster" aria-label="Patron roster directory">
 <div className="cg04-roster-head"><div><h2>Patron Roster Directory</h2><p className="cg04-muted">Approved members only. The current role and permitted Foundation locations determine which records appear.</p></div>
 {canExport&&<button type="button" disabled={busy||loading} onClick={()=>void exportCsv()}>Export Members</button>}</div>
 {!!error&&<p className="cg04-error" role="alert">{error} <button type="button" onClick={()=>setEpoch(x=>x+1)}>Try again</button></p>}
 {!!notice&&<p role="status">{notice}</p>}
 <form className="cg04-roster-filter" onSubmit={apply}>
 <label>Search member number, name or contact<input maxLength={100} placeholder="Search authorized members" value={draft.q} onChange={e=>setDraft(x=>({...x,q:e.target.value}))}/></label>
 <label>Status<select value={draft.status} onChange={e=>setDraft(x=>({...x,status:e.target.value}))}>{Object.entries(statuses).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
 <label>Membership type<select value={draft.category} onChange={e=>setDraft(x=>({...x,category:e.target.value}))}>{Object.entries(categories).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
 <label>Foundation branch<select value={draft.branch} onChange={e=>setDraft(x=>({...x,branch:e.target.value}))}><option value="">All permitted branches</option>{page?.branchOptions.map(b=><option key={b.value} value={b.value}>{b.label}</option>)}</select></label>
 <button type="submit" disabled={busy||loading}>Search</button><button type="button" disabled={busy||loading} onClick={reset}>Reset</button>
 </form>
 {loading?<p role="status">Checking currently permitted membership roster…</p>:page&&<>
 <div className="cg04-roster-overview" aria-label="Current authorized membership overview">
  {([["Approved members",page.overview.total],["Active",page.overview.active],["Expired",page.overview.expired],["Cancelled",page.overview.cancelled]] as const).map(([label,count])=><div className="cg04-roster-stat" key={label}><small>{label}</small><strong>{count}</strong></div>)}
 </div>
 <p className="cg04-muted">Membership categories: {Object.entries(page.overview.byCategory).map(([category,count])=>category+": "+count).join(" · ")||"No approved member records in your permitted scope."}</p>
 <p className="cg04-muted">Showing {page.items.length} authorized member records on this page.</p>
 <div className="cg04-roster-scroll" role="region" aria-label="Approved member records" tabIndex={0}>
 <table><thead><tr><th>Member</th><th>Name</th><th>Email</th><th>Mobile</th><th>Tier</th><th>Joined</th><th>Expires</th><th>Status</th><th>City / District</th><th>Branch</th></tr></thead>
 <tbody>{page.items.map(m=><tr key={m.ref}><td>{m.memberNumber}</td><td>{m.name}</td><td>{m.email??"Not provided"}</td><td>{m.mobile}</td><td>{m.plan}</td><td>{m.joinedOn}</td><td>{m.expiresOn??"Lifetime"}</td><td><span className={"cg04-roster-state cg04-state-"+m.status.toLowerCase()}>{m.status}</span></td><td>{m.city} / {m.district}</td><td>{m.branch??"Foundation"}</td></tr>)}
 {!page.items.length&&<tr><td colSpan={10}>No approved members match your permitted filters.</td></tr>}</tbody></table></div>
 <div className="cg04-buttons"><button disabled={!history.length||busy} type="button" onClick={()=>{setCursor(history.at(-1)??"");setHistory(x=>x.slice(0,-1));}}>Previous page</button>
 <button disabled={!page.nextCursor||busy} type="button" onClick={()=>{setHistory(x=>[...x,cursor]);setCursor(page.nextCursor??"");}}>Next page</button></div>
 </>}
 </section>;
}
