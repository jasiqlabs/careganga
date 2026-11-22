"use client";
import {useCallback,useEffect,useRef,useState,type ReactNode} from "react";
import {careGangaTheme as theme, roleColor} from "../../../../../packages/design-tokens/src/index";
type Section={id:string;label:string;content:ReactNode};
/** Mount on first visit and preserve in-progress forms and uncertain command keys. */
export function HrWorkspaceNavigation({sections,canViewDashboard=false,canAddEmployee=false,canViewLeave=false}:{sections:Section[];canViewDashboard?:boolean;canAddEmployee?:boolean;canViewLeave?:boolean}){
 const first=canViewDashboard?"overview":sections[0]?.id??"profile";
 const [current,setCurrent]=useState(first);
 const [visited,setVisited]=useState<string[]>([first]);
 const active=(canViewDashboard&&current==="overview")||sections.some(x=>x.id===current)?current:first;
 const choose=(id:string)=>{setCurrent(id);setVisited(old=>old.includes(id)?old:[...old,id]);};
 const links=canViewDashboard?[{id:"overview",label:"HR Dashboard"},...sections]:sections;
 return <div style={{display:"grid",gap:16,minWidth:0}}>
  <nav aria-label="Human resources workflows" style={{display:"flex",flexWrap:"wrap",gap:8,padding:12,border:"1px solid "+theme.border,borderRadius:12,background:theme.surface}}>
   {links.map(s=><button key={s.id} type="button" aria-current={active===s.id?"page":undefined} onClick={()=>choose(s.id)}
    style={{border:"1px solid "+(active===s.id?theme.primary:theme.border),background:active===s.id?theme.primary:theme.surface,color:active===s.id?theme.primaryText:theme.text,borderRadius:9,minHeight:44,padding:"8px 13px",fontWeight:600}}>{s.label}</button>)}
  </nav>
  {canViewDashboard&&active==="overview"&&<HrDashboard choose={choose} sections={sections} canAddEmployee={canAddEmployee} canViewLeave={canViewLeave}/>}
  {sections.filter(s=>visited.includes(s.id)||active===s.id).map(s=><section key={s.id} id={"hr-section-"+s.id} aria-label={s.label} hidden={active!==s.id} style={active===s.id?{display:"grid",gap:18,minWidth:0}:{display:"none"}}>{s.content}</section>)}
 </div>;
}

type Summary={total:number;statuses:Record<string,number>;newJoinersThisMonth:number;departments:{label:string;count:number}[];joiners:{month:string;count:number}[];attendance:{onApprovedLeaveToday:number;employeesWithPendingLeave:number}|null};
const metrics=(v:Summary|null)=>[
 {label:"Total employees",value:v?.total},{label:"Active employees",value:v?.statuses.ACTIVE},
 {label:"On probation",value:v?.statuses.PROBATION},{label:"Pending access",value:v?.statuses.PENDING_ACCESS},
 {label:"New joiners this month",value:v?.newJoinersThisMonth},{label:"Exited employees",value:v?.statuses.EXITED},
 ...(v?.attendance?[{label:"On approved leave today",value:v.attendance.onApprovedLeaveToday},{label:"Employees with pending leave",value:v.attendance.employeesWithPendingLeave}]:[])
];
type RecentLeave={reference:string;employeeName:string;leaveType:string;startDate:string;endDate:string;days:number;status:string;caseStatus:string};
function HrDashboard({choose,sections,canAddEmployee,canViewLeave}:{choose:(id:string)=>void;sections:Section[];canAddEmployee:boolean;canViewLeave:boolean}){
 const [summary,setSummary]=useState<Summary|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(true);
 const seq=useRef(0);
 const [recent,setRecent]=useState<RecentLeave[]|null>(null),[leaveError,setLeaveError]=useState("");
 const leaveSeq=useRef(0);const loadLeave=useCallback(async()=>{const read=++leaveSeq.current;setRecent(null);setLeaveError("");if(!canViewLeave)return;try{const r=await fetch("/api/hr/leave-reviews?status=ALL&offset=0",{cache:"no-store",credentials:"same-origin"});if(!r.ok)throw Error("Recent leave requests unavailable.");const v=await r.json();if(!Array.isArray(v.items))throw Error("Recent leave requests unavailable.");if(read===leaveSeq.current)setRecent(v.items.slice(0,5) as RecentLeave[]);}catch(e){if(read===leaveSeq.current)setLeaveError(e instanceof Error?e.message:"Recent leave requests unavailable.");}},[canViewLeave]);
 useEffect(()=>{void loadLeave();return()=>{leaveSeq.current++;};},[loadLeave]);
 const load=useCallback(async()=>{const read=++seq.current;setSummary(null);setBusy(true);setError("");
  try{const r=await fetch("/api/hr/summary",{cache:"no-store",credentials:"same-origin"});
   if(!r.ok)throw Error(r.status===401?"Sign in again.":"HR dashboard unavailable. Refresh to retry.");
   const v=await r.json() as Summary;if(!Number.isFinite(v.total)||!v.statuses||!Number.isFinite(v.newJoinersThisMonth)||!Array.isArray(v.departments)||!Array.isArray(v.joiners))throw Error("Original summary unavailable.");
   if(read===seq.current)setSummary(v);
  }catch(e){if(read===seq.current)setError(e instanceof Error?e.message:"HR summary unavailable.");}finally{if(read===seq.current)setBusy(false);}
 },[]);
 useEffect(()=>{void load();return()=>{seq.current++;};},[load]);
 const quick=[{id:"employees",label:canAddEmployee?"Add employee / employee directory":"Employee directory"},{id:"attendance",label:"Attendance & leave"},{id:"documents",label:"Letters & ID cards"},{id:"performance",label:"Performance"},{id:"profile",label:"My employment & allowances"}].filter(x=>sections.some(s=>s.id===x.id));
 const statusColors:Record<string,string>={ACTIVE:theme.primary,PROBATION:roleColor("green"),PENDING_ACCESS:roleColor("amber"),ON_HOLD:roleColor("violet"),EXITED:theme.error};
 const statusRows=summary?Object.entries(summary.statuses):[];
 const statusTotal=statusRows.reduce((sum,[,count])=>sum+count,0);
 let start=0;
 const wedges=statusTotal>0?statusRows.filter(([,count])=>count>0).map(([key,count])=>{
  const from=start;start+=count/statusTotal*100;
  return (statusColors[key]??theme.mutedText)+" "+from+"% "+start+"%";
 }):[];
 const panel={background:theme.surface,border:"1px solid "+theme.border,borderRadius:12,padding:16,minWidth:0} as const;
 return <section aria-label="HR Dashboard" style={{display:"grid",gap:16}}>
  <header style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"center",justifyContent:"space-between"}}><div><h2 style={{margin:0}}>HR Dashboard</h2><p style={{margin:"4px 0",color:theme.mutedText}}>Current employee statistics for your permitted branches.</p></div><button type="button" disabled={busy} onClick={()=>{void load();void loadLeave();}}>Refresh</button></header>
  {error&&<p role="alert">{error}</p>}{busy&&<p role="status">Loading employee statistics…</p>}
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,170px),1fr))",gap:12}}>
   {metrics(summary).map(x=><article key={x.label} style={panel}><div style={{fontSize:"var(--cg-text-sm)",color:theme.mutedText,fontWeight:600}}>{x.label}</div><strong style={{display:"block",fontSize:"var(--cg-heading-lg)",marginTop:7,color:theme.text}}>{x.value??"—"}</strong></article>)}
  </div>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,300px),1fr))",gap:12,alignItems:"start"}}>
   {summary&&<article style={panel}><h3 style={{marginTop:0}}>Employees by status</h3>
    <div style={{display:"flex",alignItems:"center",flexWrap:"wrap",gap:20}}>
     <div aria-hidden="true" style={{width:144,height:144,flexShrink:0,borderRadius:"50%",background:wedges.length?"conic-gradient("+wedges.join(",")+")":theme.selectedSurface,display:"grid",placeItems:"center"}}>
      <div style={{width:96,height:96,borderRadius:"50%",background:theme.surface,display:"grid",placeContent:"center",textAlign:"center"}}><strong style={{fontSize:"var(--cg-heading-lg)"}}>{summary.total}</strong><small style={{color:theme.mutedText}}>Employees</small></div>
     </div>
     <div style={{display:"grid",gap:10,flex:"1 1 130px"}}>{statusRows.map(([key,count])=><div key={key} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}><span style={{display:"flex",gap:8,alignItems:"center"}}><span aria-hidden="true" style={{width:10,height:10,borderRadius:"50%",background:statusColors[key]??theme.mutedText}}/>{key.replaceAll("_"," ").toLowerCase()}</span><strong>{count}</strong></div>)}</div>
    </div>
   </article>}
   {summary&&<article style={panel}><h3 style={{marginTop:0}}>Current employees by department</h3>
    {summary.departments.length===0?<p style={{color:theme.mutedText}}>No current employees in permitted branches.</p>:<div style={{display:"grid",gap:10}}>{summary.departments.map((x,i)=><div key={i}><div style={{display:"flex",gap:8,justifyContent:"space-between"}}><span>{x.label}</span><strong>{x.count}</strong></div><div aria-hidden="true" style={{height:8,borderRadius:8,background:theme.selectedSurface,overflow:"hidden"}}><div style={{height:"100%",background:theme.primary,width:(100*x.count/Math.max(1,summary.departments.reduce((sum,v)=>sum+v.count,0)))+"%"}}/></div></div>)}</div>}
   </article>}
   {summary&&<article style={panel}><h3 style={{marginTop:0}}>Joining trend</h3><p style={{fontSize:"var(--cg-text-sm)",color:theme.mutedText}}>Joining month of employees currently in your permitted branches · last six months</p>
    {summary.joiners.length===0?<p style={{color:theme.mutedText}}>No employee data available.</p>:<div style={{display:"grid",gridTemplateColumns:"repeat(6,minmax(0,1fr))",gap:6,alignItems:"end"}}>{summary.joiners.map(x=><div key={x.month} style={{display:"grid",gap:5,textAlign:"center"}}><strong>{x.count}</strong><div aria-hidden="true" style={{height:76,display:"flex",alignItems:"end",justifyContent:"center",background:theme.selectedSurface,borderRadius:6}}><div style={{width:"100%",height:(100*x.count/Math.max(1,...summary.joiners.map(v=>v.count)))+"%",background:theme.primary,borderRadius:4}}/></div><small>{x.month.slice(5)}/{x.month.slice(2,4)}</small></div>)}</div>}
   </article>}
   {canViewLeave&&<article style={{...panel,gridColumn:"1 / -1"}}><h3>Recent leave requests</h3>{leaveError?<p role="alert">{leaveError}</p>:recent===null?<p role="status">Loading…</p>:recent.length===0?<p>No leave requests in your permitted scope.</p>:<div style={{overflowX:"auto"}}><table style={{width:"100%",textAlign:"left",borderCollapse:"collapse",fontSize:13}}><thead><tr>{["Request","Employee","Leave type","From","To","Days","Status"].map(x=><th key={x} style={{padding:8}}>{x}</th>)}</tr></thead><tbody>{recent.map(x=><tr key={x.reference} style={{borderTop:"1px solid "+theme.border}}>{[x.reference,x.employeeName,x.leaveType,x.startDate,x.endDate,x.days,x.status.replaceAll("_"," ")].map((value,i)=><td key={i} style={{padding:8}}>{value}</td>)}</tr>)}</tbody></table></div>}<button type="button" onClick={()=>choose("attendance")}>View leave management</button></article>}
   <article style={panel}><h3 style={{marginTop:0}}>Quick actions</h3><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,130px),1fr))",gap:10}}>{quick.map(x=><button key={x.id} type="button" onClick={()=>choose(x.id)} style={{minHeight:60,borderRadius:8,border:"1px solid "+theme.border,background:theme.selectedSurface,color:theme.primary,padding:"10px 14px",fontWeight:600}}>{x.label}</button>)}</div></article>
  </div>
 </section>;
}
