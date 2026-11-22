"use client";
import {useCallback,useEffect,useRef,useState,type ReactNode} from "react";
import {careGangaTheme as theme} from "../../../../../packages/design-tokens/src/index";
type Section={id:string;label:string;content:ReactNode};
/** Mount on first visit and preserve in-progress forms and uncertain command keys. */
export function HrWorkspaceNavigation({sections,canViewDashboard=false,canAddEmployee=false}:{sections:Section[];canViewDashboard?:boolean;canAddEmployee?:boolean}){
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
  {canViewDashboard&&active==="overview"&&<HrDashboard choose={choose} sections={sections} canAddEmployee={canAddEmployee}/>}
  {sections.filter(s=>visited.includes(s.id)||active===s.id).map(s=><section key={s.id} id={"hr-section-"+s.id} aria-label={s.label} hidden={active!==s.id} style={active===s.id?{display:"grid",gap:18,minWidth:0}:{display:"none"}}>{s.content}</section>)}
 </div>;
}

type Summary={total:number;statuses:Record<string,number>;newJoinersThisMonth:number;attendance:{onApprovedLeaveToday:number;employeesWithPendingLeave:number}|null};
const metrics=(v:Summary|null)=>[
 {label:"Total employees",value:v?.total},{label:"Active employees",value:v?.statuses.ACTIVE},
 {label:"On probation",value:v?.statuses.PROBATION},{label:"Pending access",value:v?.statuses.PENDING_ACCESS},
 {label:"New joiners this month",value:v?.newJoinersThisMonth},{label:"Exited employees",value:v?.statuses.EXITED},
 ...(v?.attendance?[{label:"On approved leave today",value:v.attendance.onApprovedLeaveToday},{label:"Employees with pending leave",value:v.attendance.employeesWithPendingLeave}]:[])
];
function HrDashboard({choose,sections,canAddEmployee}:{choose:(id:string)=>void;sections:Section[];canAddEmployee:boolean}){
 const [summary,setSummary]=useState<Summary|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(true);
 const seq=useRef(0);
 const load=useCallback(async()=>{const read=++seq.current;setSummary(null);setBusy(true);setError("");
  try{const r=await fetch("/api/hr/summary",{cache:"no-store",credentials:"same-origin"});
   if(!r.ok)throw Error(r.status===401?"Sign in again.":"HR dashboard unavailable. Refresh to retry.");
   const v=await r.json() as Summary;if(!Number.isFinite(v.total)||!v.statuses||!Number.isFinite(v.newJoinersThisMonth))throw Error("Original summary unavailable.");
   if(read===seq.current)setSummary(v);
  }catch(e){if(read===seq.current)setError(e instanceof Error?e.message:"HR summary unavailable.");}finally{if(read===seq.current)setBusy(false);}
 },[]);
 useEffect(()=>{void load();return()=>{seq.current++;};},[load]);
 const quick=[{id:"employees",label:canAddEmployee?"Add employee / employee directory":"Employee directory"},{id:"attendance",label:"Attendance sheet / leave requests"},{id:"documents",label:"Document management"},{id:"performance",label:"Performance management"},{id:"profile",label:"My employment / apply for allowance"}].filter(x=>sections.some(s=>s.id===x.id));
 const panel={background:theme.surface,border:"1px solid "+theme.border,borderRadius:12,padding:16,minWidth:0} as const;
 return <section aria-label="HR Dashboard" style={{display:"grid",gap:16}}>
  <header style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"center",justifyContent:"space-between"}}><div><h2 style={{margin:0}}>HR Dashboard</h2><p style={{margin:"4px 0",color:theme.mutedText}}>Current employee statistics for your permitted branches.</p></div><button type="button" disabled={busy} onClick={()=>void load()}>Refresh</button></header>
  {error&&<p role="alert">{error}</p>}{busy&&<p role="status">Loading employee statistics…</p>}
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,170px),1fr))",gap:12}}>
   {metrics(summary).map(x=><article key={x.label} style={panel}><div style={{fontSize:"var(--cg-text-sm)",color:theme.mutedText,fontWeight:600}}>{x.label}</div><strong style={{display:"block",fontSize:"var(--cg-heading-lg)",marginTop:7,color:theme.text}}>{x.value??"—"}</strong></article>)}
  </div>
  {summary&&<article style={panel}><h3 style={{marginTop:0}}>Employees by status</h3><div style={{display:"grid",gap:10}}>{Object.entries(summary.statuses).map(([key,count])=><div key={key}><div style={{display:"flex",justifyContent:"space-between",gap:8}}><span>{key.replaceAll("_"," ").toLowerCase()}</span><strong>{count}</strong></div><div role="img" aria-label={key+" "+count+" of "+summary.total} style={{height:8,background:theme.selectedSurface,borderRadius:8,overflow:"hidden"}}><div style={{height:"100%",width:(summary.total?Math.min(100,100*count/summary.total):0)+"%",background:theme.primary}}/></div></div>)}</div></article>}
  <article style={panel}><h3 style={{marginTop:0}}>Quick actions</h3><div style={{display:"flex",flexWrap:"wrap",gap:10}}>{quick.map(x=><button key={x.id} type="button" onClick={()=>choose(x.id)} style={{minHeight:44,borderRadius:8,border:"1px solid "+theme.border,background:theme.selectedSurface,color:theme.primary,padding:"10px 14px",fontWeight:600}}>{x.label}</button>)}</div></article>
 </section>;
}
