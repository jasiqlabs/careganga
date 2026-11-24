"use client";
import {useEffect,useRef,useState} from "react";
type Choice={value:string;label:string};
type Run={ref:string;branchRef:string|null;reference:string;period:string;fiscalYear:string;tentativePaymentDate:string|null;status:string;attendanceStatus:string;calculationStatus:string;paymentStatus:string};
const card={background:"white",border:"1px solid #e2e8f0",borderRadius:12,padding:16,display:"grid",gap:12} as const;
const row={display:"flex",gap:12,flexWrap:"wrap",alignItems:"end"} as const;
const fy=(month:string)=>{const y=Number(month.slice(0,4))-(Number(month.slice(5,7))<4?1:0);return String(y)+"-"+String(y+1);};
async function api<T>(path:string,body?:Record<string,unknown>):Promise<T>{
 const res=await fetch("/api/payroll/runs"+path,{cache:"no-store",method:body?"POST":"GET",...(body?{headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})});
 const data=await res.json().catch(()=>null);if(!res.ok||!data)throw Object.assign(Error(data?.message??"Payroll run unavailable"),{status:res.status});return data as T;
}
export function PayrollRunWorkspace({canManage}:{canManage:boolean}){
 const [branches,setBranches]=useState<Choice[]>([]),[branch,setBranch]=useState(""),[month,setMonth]=useState(""),[paymentDate,setPaymentDate]=useState("");
 const [runs,setRuns]=useState<Run[]|null>(null),[selected,setSelected]=useState<Run|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[unknown,setUnknown]=useState(false);
 const pending=useRef<Record<string,unknown>|null>(null),writing=useRef(false),seq=useRef(0);
 const load=async()=>{const n=++seq.current;setError("");setRuns(null);try{const [options,list]=await Promise.all([api<{branches:Choice[];today:string}>("/options"),api<{items:Run[]}>("")]);if(n===seq.current){setBranches(options.branches);setMonth(old=>old||options.today.slice(0,7));setRuns(list.items);}}catch(e){if(n===seq.current)setError(e instanceof Error?e.message:"Payroll run unavailable");}};
 useEffect(()=>{void load();return()=>{seq.current++;};},[]);
 const save=async()=>{if(writing.current||!canManage||(!pending.current&&(!month||!branch)))return;
  pending.current??={requestKey:crypto.randomUUID(),branchRef:branch,fiscalYear:fy(month),period:month,tentativePaymentDate:paymentDate||null};
  writing.current=true;setBusy(true);setError("");try{const v=await api<Run>("/draft",pending.current);pending.current=null;setUnknown(false);setSelected(v);await load();}catch(e){const status=(e as {status?:number}).status;if([400,401,403,404,409].includes(status??0)&&!unknown){pending.current=null;setUnknown(false);}else setUnknown(true);setError(e instanceof Error?e.message:"Outcome unknown");}finally{writing.current=false;setBusy(false);}
 };
 const choose=async(ref:string)=>{const n=++seq.current;setSelected(null);setError("");try{const v=await api<Run>("/"+ref);if(n===seq.current)setSelected(v);}catch(e){if(n===seq.current)setError(e instanceof Error?e.message:"Payroll run unavailable");}};
 const locked=busy||unknown;
 return <section aria-label="Generate payroll"><h2>Generate Payroll</h2><p>Select an actual payroll period and scope. No attendance or salary amount is assumed.</p>
 <div style={row}>{["Select payroll period","Validate & Calculate","Review & Adjust","Submit for Approval","Approval & Payment"].map((label,i)=><span key={label} style={{fontWeight:i===0?700:400,color:i===0?"#1e40af":"#64748b"}}>{i+1}. {label}</span>)}</div>
 {error&&<p role="alert">{error}</p>}{unknown&&<p role="alert">The draft outcome is unconfirmed. Retry the original request only.</p>}
 {canManage&&<div style={card}><h3>1. Select Payroll Period</h3><div style={row}>
 <label>Foundation / branch <select disabled={locked} value={branch} onChange={e=>setBranch(e.target.value)}><option value="">Choose scope</option>{branches.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></label>
 <label>Payroll month <input type="month" value={month} onChange={e=>setMonth(e.target.value)} disabled={locked}/></label>
 <label>Financial year <input value={month?fy(month):""} readOnly/></label><label>Cycle <input value="Monthly" readOnly/></label>
 <label>Payment date (tentative, optional) <input type="date" value={paymentDate} onChange={e=>setPaymentDate(e.target.value)} disabled={locked}/></label>
 <button disabled={busy||!unknown&&(!month||!branch)} onClick={()=>void save()}>{unknown?"Retry original draft":"Save as draft"}</button></div></div>}
 <div style={card}><h3>Previous payroll drafts</h3><button disabled={locked} onClick={()=>void load()}>Refresh</button>{runs===null?<p>Payroll draft list loading or unavailable.</p>:runs.length===0?<p>No payroll draft in your current scope.</p>:runs.map(r=><button key={r.ref} disabled={locked} onClick={()=>void choose(r.ref)}>{r.reference} · {r.period} · {r.branchRef===null?"Foundation-wide":branches.find(b=>b.value===r.branchRef)?.label??"Permitted branch"} · {r.status}</button>)}</div>
 {selected&&<div style={card}><h3>{selected.reference} · {selected.status}</h3><p>{selected.period} · FY {selected.fiscalYear}</p><p>Attendance: {selected.attendanceStatus.replaceAll("_"," ")} · Calculation: {selected.calculationStatus.replaceAll("_"," ")}</p><p>Payment: {selected.paymentStatus.replaceAll("_"," ")}</p><p>Only the payroll period draft is saved. Attendance import and calculation have not been performed.</p></div>}
 </section>;
}
