"use client";
import {useCallback,useEffect,useRef,useState,type CSSProperties} from "react";
type Kind="MEMBER"|"VOLUNTEER";
type Top={name:string;participantNumber:string;rank:string|null;
 referrals:string;points:string;lastActivity:string;status:string};
type Recent={name:string;participantNumber:string;rank:string|null;
 status:"QUALIFICATION"|"QUALIFICATION_REVERSAL";points:string;recordedAt:string};
type Source={kind:Kind;topReferrers:Top[];recentEvents:Recent[];
 hasMore:boolean;page:number;notice:string};
const control:CSSProperties={width:"100%",maxWidth:220,minHeight:38,
 padding:"7px 9px",border:"1px solid var(--cg-border,#CBD5E1)",borderRadius:8,
 color:"inherit",background:"var(--cg-surface,#fff)"};
const button:CSSProperties={minHeight:38,padding:"6px 12px",borderRadius:8,
 border:"1px solid var(--cg-border,#CBD5E1)",background:"var(--cg-surface,#fff)",
 color:"inherit",cursor:"pointer"};
const date=(v:string)=>new Date(v).toLocaleDateString("en-IN",{timeZone:"Asia/Kolkata"});
const points=(v:string)=>/^-?[0-9]{1,18}$/.test(v)?BigInt(v).toLocaleString("en-IN"):"—";
export function AdminReferralRecords({programme,kind,selectedRank,canViewMember,canViewVolunteer,refreshEpoch}:{
 programme:string;kind:Kind;selectedRank:string;canViewMember:boolean;canViewVolunteer:boolean;refreshEpoch:number;
}){
 const allowed=kind==="MEMBER"?canViewMember:canViewVolunteer;
 const [search,setSearch]=useState(""),[query,setQuery]=useState("");
 const [status,setStatus]=useState("ALL"),[from,setFrom]=useState(""),[to,setTo]=useState("");
 const [location,setLocation]=useState(""),[locationFilter,setLocationFilter]=useState("");
 const [sort,setSort]=useState("REFERRALS");
 const [source,setSource]=useState<Source|null>(null);
 const [loading,setLoading]=useState(false),[error,setError]=useState("");
 const [older,setOlder]=useState(false);
 const seq=useRef(0);
 useEffect(()=>{const t=setTimeout(()=>setQuery(search.trim()),300);return()=>clearTimeout(t);},[search]);
 useEffect(()=>{const t=setTimeout(()=>setLocationFilter(location.trim()),300);return()=>clearTimeout(t);},[location]);
 const load=useCallback(async(page:number,append=false)=>{
  const request=++seq.current;
  if(!programme||!allowed){setSource(null);setLoading(false);setOlder(false);return;}
  if(from&&to&&from>to){
   setSource(null);setLoading(false);setOlder(false);
   setError("Start date must be before end date.");return;
  }
  if(append)setOlder(true);else{setSource(null);setLoading(true);}
  setError("");
  try{
   const params=new URLSearchParams({kind,page:String(page),status});
   if(query)params.set("q",query);
   if(locationFilter)params.set("location",locationFilter);
   if(selectedRank)params.set("rank",selectedRank);
   params.set("sort",sort);
   if(from)params.set("from",from);
   if(to)params.set("to",to);
   const response=await fetch("/api/referrals/programmes/"+encodeURIComponent(programme)+
    "/referral-records?"+params.toString(),{cache:"no-store",
    signal:AbortSignal.timeout(15000)});
   if(!response.ok)throw Error(response.status===403?
    "Your current role cannot view individual referral records for this relationship.":
    "Verified referral records are unavailable. Refresh before retrying.");
   const received=await response.json() as Source;
   if(request!==seq.current)return;
   setSource(old=>append&&old&&page===old.page+1?
    {...received,recentEvents:[...old.recentEvents,...received.recentEvents]}:received);
  }catch(e){if(request===seq.current)setError(e instanceof Error?e.message:
   "Referral status uncertain. Refresh the original records.");}
  finally{if(request===seq.current){setLoading(false);setOlder(false);}}
 },[programme,kind,allowed,query,status,from,to,locationFilter,selectedRank,sort]);
 useEffect(()=>{void load(1);return()=>{seq.current++;};},[load,refreshEpoch]);
 if(!programme)return null;
 return <section aria-label="Original B12 authorized referral records"
  style={{display:"grid",gap:12,minWidth:0}}>
  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
   gap:12,flexWrap:"wrap"}}>
   <div><h3 style={{fontSize:17,margin:"0 0 3px"}}>Top Referrers &amp; Recent Referral Activity</h3>
    <p style={{fontSize:12,margin:0,color:"var(--cg-text-muted,#64748B)"}}>
     {kind==="MEMBER"?"Member":"Volunteer"} records · Current authorized branches only</p></div>
   <button style={button} type="button" disabled={loading||older} onClick={()=>void load(1)}>
    Refresh records</button>
  </div>
  {!allowed?<p role="status">Individual names require the matching current
   {kind==="MEMBER"?" member":" volunteer"} roster-view permission.
   Referral programme aggregate totals remain available above.</p>:<>
   <div style={{display:"flex",alignItems:"end",flexWrap:"wrap",gap:9}}>
    <label style={{display:"grid",gap:3,fontSize:12}}>Name or member/volunteer number
     <input style={{...control,maxWidth:265}} type="search" maxLength={80}
      value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search authorized records"/></label>
    <label style={{display:"grid",gap:3,fontSize:12}}>Current status
     <select style={control} value={status} onChange={e=>setStatus(e.target.value)}>
      <option value="ALL">All</option><option value="ACTIVE">Active</option>
      <option value="INACTIVE">Inactive / expired</option></select></label>
    <label style={{display:"grid",gap:3,fontSize:12}}>City or district
     <input style={control} type="search" maxLength={120} value={location}
      onChange={e=>setLocation(e.target.value)} placeholder="Current verified location"/></label>
    <label style={{display:"grid",gap:3,fontSize:12}}>Sort top referrers
     <select style={control} value={sort} onChange={e=>setSort(e.target.value)}>
      <option value="REFERRALS">Most verified referrals</option>
      <option value="RECENT">Most recent activity</option></select></label>
    <label style={{display:"grid",gap:3,fontSize:12}}>Recent events from
     <input style={control} type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>
    <label style={{display:"grid",gap:3,fontSize:12}}>To
     <input style={control} type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>
    <button style={button} type="button" disabled={loading||older}
     onClick={()=>{setSearch("");setQuery("");setLocation("");setLocationFilter("");
      setSort("REFERRALS");setStatus("ALL");setFrom("");setTo("");}}>
     Clear filters</button>
   </div>
   {!!error&&<p role="alert" style={{fontSize:13,color:"#B91C1C"}}>{error}</p>}
   {loading&&<p role="status">Checking current authorized referral events…</p>}
   {source&&<><p style={{fontSize:12,margin:0}}>{source.notice}</p>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,410px),1fr))",gap:12}}>
     <div style={{minWidth:0}}>
      <h4 style={{fontSize:15,margin:"0 0 8px"}}>Top Referrers — {selectedRank||"all ranks"}</h4>
      <div style={{overflowX:"auto"}}>
       <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:410}}>
        <thead><tr>{["Member / Volunteer","Rank","Verified","Net points","Status"].map(k=>
         <th key={k} scope="col" style={{textAlign:"left",padding:8,
          borderBottom:"1px solid var(--cg-border,#CBD5E1)"}}>{k}</th>)}</tr></thead>
        <tbody>{source.topReferrers.map((x,i)=><tr key={x.participantNumber+":"+i}>
         <td style={{padding:8}}>{x.name}<div style={{fontSize:11}}>{x.participantNumber}</div></td>
         <td style={{padding:8}}>{x.rank??"Unranked"}</td>
         <td style={{padding:8}}>{points(x.referrals)}</td>
         <td style={{padding:8}}>{points(x.points)}</td>
         <td style={{padding:8}}>{x.status}</td>
        </tr>)}
        {!source.topReferrers.length&&<tr><td colSpan={5} style={{padding:15}}>
         No eligible referrer records match these current filters.</td></tr>}</tbody>
       </table>
      </div>
     </div>
     <div style={{minWidth:0}}>
      <h4 style={{fontSize:15,margin:"0 0 8px"}}>Recent verified point events</h4>
      <div style={{overflowX:"auto"}}>
       <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:410}}>
        <thead><tr>{["Date","Referrer","Source outcome","Points"].map(k=>
         <th scope="col" key={k} style={{textAlign:"left",padding:8,
          borderBottom:"1px solid var(--cg-border,#CBD5E1)"}}>{k}</th>)}</tr></thead>
        <tbody>{source.recentEvents.map((x,i)=><tr key={x.recordedAt+":"+x.participantNumber+":"+i}>
         <td style={{padding:8}}>{date(x.recordedAt)}</td>
         <td style={{padding:8}}>{x.name}</td>
         <td style={{padding:8}}>{x.status==="QUALIFICATION"?"Qualified":"Reversed"}</td>
         <td style={{padding:8}}>{points(x.points)}</td>
        </tr>)}
        {!source.recentEvents.length&&<tr><td colSpan={4} style={{padding:15}}>
         No verified qualifying events match this period.</td></tr>}</tbody>
       </table>
      </div>
      {source.hasMore&&<button style={button} type="button" disabled={older||loading}
       onClick={()=>void load(source.page+1,true)}>
       {older?"Loading…":"Older verified events"}</button>}
     </div>
    </div>
   </>}
  </>}
 </section>;
}
