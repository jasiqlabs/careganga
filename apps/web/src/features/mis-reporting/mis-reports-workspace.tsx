"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {safeClientProblem} from "./mis-safe-error";
import {MisSavedReports} from "./mis-saved-reports";
import {MisReportExports} from "./mis-report-exports";
import {MisReportSchedules} from "./mis-report-schedules";
import {MisFinanceTrend,MisAppointmentDistribution,MisAppointmentGroupBars} from "./mis-source-charts";
import {MisGroupedFinanceChart} from "./mis-grouped-finance-chart";
type Kind="FINANCE_POSTED_LEDGER"|"FINANCE_POSTED_SUMMARY"|
 "FINANCE_POSTED_TREND"|"FINANCE_POSTED_GROUPED"|
 "APPOINTMENT_STATUS"|"APPOINTMENT_STATUS_GROUPED"|"APPOINTMENT_DOCTOR_SUMMARY"|"PLATFORM_AUDIT_ACTIVITY"|"DIAGNOSTICS_CATALOG_SUMMARY"|"BENEFICIARY_ASSISTANCE_SUMMARY"|"MEMBERSHIP_ROSTER_SUMMARY"|"VOLUNTEER_ROSTER_SUMMARY"|"PAYROLL_STATUS_SUMMARY"|"DONATION_RECEIPT_SUMMARY"|"CSR_FUNDING_SUMMARY";
type View="TABLE"|"SUMMARY"|"CHART"|"PIVOT";
type Option={ref:string;name:string};
type AreaOption=Option&{level:string};
type Template={kind:Kind;label:string;views:View[];description:string};
type Catalog={
 templates:Template[];
 payroll?:{ready:boolean;branches:Option[];month:string};
 membership?:{ready:boolean;branches:Option[]};volunteers?:{ready:boolean;branches:Option[]};beneficiary?:{ready:boolean;branches:Option[]};
 finance:{ready:boolean;state?:"AVAILABLE"|"ACCESS_RESTRICTED"|"SOURCE_UNAVAILABLE";years:Option[];branches:Option[];areas?:AreaOption[];allBranches:boolean};
 appointments:{ready:boolean;state?:"AVAILABLE"|"ACCESS_RESTRICTED"|"SOURCE_UNAVAILABLE";centers:Option[];complete:boolean};
 capabilities:{manage:boolean;export:boolean;schedule:boolean;share?:boolean}
};
export type ReportRequest={kind:Kind;view:View;payrollMonth?:string;yearRef?:string;branchRef?:string;areaRef?:string;
 centerRef?:string;fromDay?:string;untilDay?:string;status?:string;
 groupBy?:"CATEGORY"|"POSTING_KIND"|"ACCOUNT_NAME";
 sortBy?:"NAME"|"DEBIT"|"CREDIT";sortDirection?:"ASC"|"DESC";offset:number};
export type ReportPreview={
 state:"READY"|"EMPTY"|"SUPPRESSED"|"PARTIAL";kind:Kind;view:View;label:string;
 columns:{key:string;label:string;unit?:string}[];
 rows:Record<string,string>[];nextOffset:number|null;
 sourceAsOf?:string;sourceReadAt:string;sourceCutoffKind:string;
 explanation:string;scopeLabel:string
};
type Period="CUSTOM"|"DAY"|"WEEK"|"MONTH"|"YEAR";
const reportLocalDate=(date:Date)=>String(date.getFullYear())+"-"+
 String(date.getMonth()+1).padStart(2,"0")+"-"+
 String(date.getDate()).padStart(2,"0");
function localReportPeriod(period:Exclude<Period,"CUSTOM">){
 const today=new Date();
 const start=new Date(today.getFullYear(),today.getMonth(),today.getDate());
 if(period==="WEEK")start.setDate(start.getDate()-((start.getDay()+6)%7));
 else if(period==="MONTH")start.setDate(1);
 else if(period==="YEAR"){start.setMonth(0);start.setDate(1);}
 return {from:reportLocalDate(start),until:reportLocalDate(today)};
}
const statuses:{key:string;label:string}[]=[
 {key:"",label:"All statuses"},
 {key:"CONFIRMED",label:"Confirmed"},{key:"ARRIVED",label:"Arrived"},
 {key:"WAITING",label:"Waiting"},{key:"IN_CONSULTATION",label:"In consultation"},
 {key:"COMPLETED",label:"Completed"},{key:"NO_SHOW",label:"No show"},
 {key:"CANCELLED",label:"Cancelled"}
];
function labelMoney(value:string){
 try{const n=BigInt(value),a=n<0n?-n:n;
  return (n<0n?"−":"")+"₹"+(a/100n).toLocaleString("en-IN")+"."+
   (a%100n).toString().padStart(2,"0");
 }catch{return "Not confirmed";}
}
function cell(value:string|undefined,unit?:string){
 if(value===undefined)return "Not confirmed";
 if(unit==="INR_MINOR")return labelMoney(value);
 return value;
}
async function request<T>(path:string,body?:object):Promise<T>{
 const r=await fetch("/api/mis/reports/"+path,{cache:"no-store",
  credentials:"same-origin",method:body?"POST":"GET",
  headers:body?{"Content-Type":"application/json"}:undefined,
  body:body?JSON.stringify(body):undefined});
 if(!r.ok)throw new Error(await safeClientProblem(r,"The report could not be verified. Check its current scope and try again."));
 return await r.json() as T;
}
/** Original C44/C46/C47 report cards. Only genuinely registered owner
 * source filters/actions are available; no screenshot demo rows or raw refs.
 */
export function MisReportsWorkspace(){
 const [catalog,setCatalog]=useState<Catalog|null>(null);
 const [kind,setKind]=useState<Kind|null>(null);
 const [view,setView]=useState<View>("TABLE");
 const [year,setYear]=useState(""),[branch,setBranch]=useState("");
 const [rosterBranch,setRosterBranch]=useState("");
 const [payrollMonth,setPayrollMonth]=useState(""),[payrollBranch,setPayrollBranch]=useState("");
 const [area,setArea]=useState("");
 const [center,setCenter]=useState(""),[from,setFrom]=useState("");
 const [until,setUntil]=useState(""),[status,setStatus]=useState("");
 const [period,setPeriod]=useState<Period>("CUSTOM");
 const [groupBy,setGroupBy]=useState<"CATEGORY"|"POSTING_KIND"|"ACCOUNT_NAME">("CATEGORY");
 const [sortBy,setSortBy]=useState<"NAME"|"DEBIT"|"CREDIT">("NAME");
 const [sortDirection,setSortDirection]=useState<"ASC"|"DESC">("ASC");
 const [result,setResult]=useState<ReportPreview|null>(null);
 const [problem,setProblem]=useState(""),[loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState("");
 const seq=useRef(0);
 const previewSeq=useRef(0);
 const load=useCallback(async()=>{
  const i=++seq.current;setLoading(true);setProblem("");setResult(null);
  try{
   const c=await request<Catalog>("templates");
   if(!Array.isArray(c.templates))throw Error("Current report catalog could not be verified.");
   if(i===seq.current){setCatalog(c);setPayrollMonth(c.payroll?.month??"");setPayrollBranch("");setRosterBranch("");
    setBranch(c.finance.allBranches?"":c.finance.branches[0]?.ref??"");
    setArea("");
    setKind(c.templates[0]?.kind??null);
    setView(c.templates[0]?.views[0]??"TABLE");}
  }catch(e){if(i===seq.current){setCatalog(null);setKind(null);
   setProblem(e instanceof Error?e.message:"Report source unavailable.");}}
  finally{if(i===seq.current)setLoading(false);}
 },[]);
 useEffect(()=>{void load();return()=>{seq.current++;previewSeq.current++};},[load]);
 useEffect(()=>{previewSeq.current++;setResult(null);setNotice("");},
  [kind,view,year,branch,area,center,from,until,status,groupBy,sortBy,sortDirection,payrollMonth,payrollBranch,rosterBranch]);
 useEffect(()=>{
  const recheck=()=>{
   seq.current++;previewSeq.current++;setCatalog(null);setResult(null);setKind(null);
   setPeriod("CUSTOM");
   setYear("");setBranch("");setArea("");setCenter("");setFrom("");setUntil("");
   setStatus("");void load();
  };
  const onVisible=()=>{if(document.visibilityState==="visible")recheck();
   else{seq.current++;previewSeq.current++;setCatalog(null);setResult(null);}};
  document.addEventListener("visibilitychange",onVisible);
  return()=>document.removeEventListener("visibilitychange",onVisible);
 },[load]);
 const selected=catalog?.templates.find(t=>t.kind===kind);
 const finance=kind?.startsWith("FINANCE_");
 const health=kind==="APPOINTMENT_STATUS"||kind==="APPOINTMENT_STATUS_GROUPED"||
 kind==="APPOINTMENT_DOCTOR_SUMMARY";
 const ledger=kind==="FINANCE_POSTED_LEDGER";
 const grouped=kind==="FINANCE_POSTED_GROUPED";
 const geography=ledger||grouped;
 const roster=kind==="MEMBERSHIP_ROSTER_SUMMARY"?catalog?.membership:kind==="VOLUNTEER_ROSTER_SUMMARY"?catalog?.volunteers:undefined;
 const beneficiary=kind==="BENEFICIARY_ASSISTANCE_SUMMARY"?catalog?.beneficiary:undefined;
 const scoped=roster??beneficiary;
 const dated=ledger||grouped||health||kind==="PLATFORM_AUDIT_ACTIVITY"||kind==="CSR_FUNDING_SUMMARY"||!!scoped;
 function setPreset(next:Period){
  setPeriod(next);setResult(null);
  if(next==="CUSTOM"){setFrom("");setUntil("");return;}
  const dates=localReportPeriod(next);setFrom(dates.from);setUntil(dates.until);
 }
 function input(offset=0):ReportRequest|null{
  if(!kind||!selected)return null;
  return {kind,view:selected.views.includes(view)?view:selected.views[0],
   ...(finance?{
    ...(year?{yearRef:year}:{}),...(branch?{branchRef:branch}:{}),
    ...(geography&&area?{areaRef:area}:{})}:{
    ...(center?{centerRef:center}:{}),
    ...(status?{status}:{}),
   }),
   ...(kind==="PAYROLL_STATUS_SUMMARY"?{...(payrollMonth?{payrollMonth}:{}),...(payrollBranch?{branchRef:payrollBranch}:{})}:{}),
   ...(scoped&&rosterBranch?{branchRef:rosterBranch}:{}),
   ...(dated&&(from||until)?{fromDay:from,untilDay:until}:{}),
   ...(grouped?{groupBy,sortBy,sortDirection}:{}),
   offset};
 }
 async function preview(offset=0){
  const q=input(offset);if(!q||busy)return;
  const version=++previewSeq.current;
  setBusy(true);setProblem("");setNotice("");setResult(null);
  try{
   const v=await request<ReportPreview>("preview",q);
   if(!v||!Array.isArray(v.columns)||!Array.isArray(v.rows))
    throw Error("The original report response could not be verified.");
   if(version!==previewSeq.current)return;
   setResult(v);
   setNotice(v.state==="PARTIAL"?"Only part of the original source is available or the result is truncated. Narrow the authorized filters before exporting.":
    v.state==="EMPTY"?"No original records match the permitted report filters.":
    v.state==="SUPPRESSED"?"This result cannot be shown without exposing a small private group.":
    "Report loaded from authorized original records.");
  }catch(e){if(version===previewSeq.current)
   setProblem(e instanceof Error?e.message:"Could not verify the report.");}
  finally{setBusy(false);}
 }
 return <section aria-labelledby="mis-standard-reports"
  style={{marginTop:"2rem",borderTop:"1px solid var(--cg-border)",paddingTop:"1.3rem"}}>
  <h2 id="mis-standard-reports" style={{fontSize:"1.1rem"}}>
   Reports &amp; MIS · Standard reports</h2>
  <p style={{fontSize:".83rem",color:"var(--cg-muted)"}}>
   Select a real source, apply permitted filters and preview verified rows.
   Saved reports and protected exports appear only when enabled for your role.</p>
  {loading&&<p role="status">Checking available report sources…</p>}
  {!!problem&&<p role="alert">{problem}</p>}
  {catalog?.finance.state==="SOURCE_UNAVAILABLE"&&
   <p role="status">Finance reporting is temporarily unavailable. Other permitted sources remain accessible.</p>}
  {catalog?.appointments.state==="SOURCE_UNAVAILABLE"&&
   <p role="status">Appointment reporting is temporarily unavailable. Other permitted sources remain accessible.</p>}
  {!loading&&catalog?.templates.length===0&&
   <p role="status">No original report source is available for your current permissions.</p>}
  {!!catalog?.templates.length&&<>
   <div role="group" aria-label="Choose source-backed report"
    style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(14rem,1fr))",gap:10}}>
    {catalog.templates.map(t=><button type="button" key={t.kind}
     aria-pressed={kind===t.kind} onClick={()=>{
      setKind(t.kind);setRosterBranch("");setPeriod("CUSTOM");setView(t.views[0]);setResult(null);setProblem("");setNotice("");
      setYear("");setBranch(catalog.finance.allBranches?"":catalog.finance.branches[0]?.ref??"");setArea("");setCenter("");setFrom("");setUntil("");setStatus("");
     }} style={{textAlign:"left",border:"1px solid var(--cg-border)",borderRadius:10,
      padding:14,minHeight:84,background:kind===t.kind?"var(--cg-canvas)":"var(--cg-surface)"}}>
     <strong style={{display:"block",color:"var(--cg-text)"}}>{t.label}</strong>
     <small style={{color:"var(--cg-muted)"}}>{t.description}</small>
    </button>)}
   </div>
   {selected&&<div style={{marginTop:16,display:"grid",gap:12}}>
    <p role="status">Available output: {selected.views.map(v=>v.toLowerCase()).join(" or ")}.
     Unsupported pivots and confidential fields are not included.</p>
    {selected.views.length>1&&<label>Report view <select value={view}
     onChange={e=>{setView(e.target.value as View);setResult(null);}}>
     {selected.views.map(v=><option key={v} value={v}>
      {v==="SUMMARY"?"Summary":v==="CHART"?"Chart":v==="PIVOT"?"Pivot":"Table"}</option>)}
    </select></label>}
    <div style={{display:"flex",flexWrap:"wrap",gap:12}}>
     {scoped?.ready&&<label>{beneficiary?"Beneficiary branch":"Roster branch"} <select value={rosterBranch} onChange={e=>setRosterBranch(e.target.value)}><option value="">All permitted branches</option>{scoped.branches.map(b=><option key={b.ref} value={b.ref}>{b.name}</option>)}</select></label>}
     {kind==="PAYROLL_STATUS_SUMMARY"&&catalog.payroll?.ready&&<>
      <label>Payroll month <input type="month" min="2000-01" value={payrollMonth} onChange={e=>setPayrollMonth(e.target.value)}/></label>
      <label>Payroll branch <select value={payrollBranch} onChange={e=>setPayrollBranch(e.target.value)}><option value="">All permitted payroll branches</option>{catalog.payroll.branches.map(b=><option key={b.ref} value={b.ref}>{b.name}</option>)}</select></label>
     </>}
     {finance&&<>
      <label>Financial year <select value={year} onChange={e=>setYear(e.target.value)}>
       <option value="">All permitted years</option>
       {catalog.finance.years.map(o=><option key={o.ref} value={o.ref}>{o.name}</option>)}
      </select></label>
      {geography&&!!catalog.finance.areas?.length&&<label>District or block
       <select value={area} onChange={e=>{
        const next=e.target.value;setArea(next);setResult(null);
        setBranch(next?"":catalog.finance.allBranches?"":catalog.finance.branches[0]?.ref??"");
       }}>
        <option value="">No geographic restriction</option>
        {catalog.finance.areas.map(x=><option key={x.ref} value={x.ref}>
         {x.level==="DISTRICT"?"District":"Block"} · {x.name}</option>)}
       </select></label>}
      {!area&&!!catalog.finance.branches.length&&<label>Branch <select value={branch}
       onChange={e=>setBranch(e.target.value)}>
       {catalog.finance.allBranches&&<option value="">All permitted branches</option>}
       {catalog.finance.branches.map(o=><option key={o.ref} value={o.ref}>{o.name}</option>)}
      </select></label>}
     </>}
     {health&&catalog.appointments.ready&&<>
      {!!catalog.appointments.centers.length&&<label>Healthcare center
       <select value={center} onChange={e=>setCenter(e.target.value)}>
        <option value="">All permitted centers</option>
        {catalog.appointments.centers.map(o=><option key={o.ref} value={o.ref}>{o.name}</option>)}
       </select></label>}
      <label>Appointment status <select value={status} onChange={e=>setStatus(e.target.value)}>
       {statuses.map(x=><option key={x.key} value={x.key}>{x.label}</option>)}
      </select></label>
     </>}
     {grouped&&<>
      <label>Group by <select value={groupBy} onChange={e=>setGroupBy(e.target.value as typeof groupBy)}>
       <option value="CATEGORY">Account category</option>
       <option value="POSTING_KIND">Posted entry type</option>
       <option value="ACCOUNT_NAME">Account name</option>
      </select></label>
      <label>Sort by <select value={sortBy} onChange={e=>setSortBy(e.target.value as typeof sortBy)}>
       <option value="NAME">Group name</option><option value="DEBIT">Posted debit</option><option value="CREDIT">Posted credit</option>
      </select></label>
      <label>Order <select value={sortDirection} onChange={e=>setSortDirection(e.target.value as typeof sortDirection)}>
       <option value="ASC">Ascending</option><option value="DESC">Descending</option>
      </select></label>
     </>}
     {dated&&<>
      {roster&&<p>Dates filter enrollment dates. Status is current, not historical.</p>}
      {beneficiary&&<p>Dates filter deliveries only. Demographic counts are current and small groups are hidden.</p>}
      {kind==="CSR_FUNDING_SUMMARY"&&<p>Dates filter proposal updates, not bank posting dates.</p>}
      <label>Reporting period <select value={period}
       onChange={e=>setPreset(e.target.value as Period)}>
       <option value="CUSTOM">Custom date range</option>
       <option value="DAY">Today</option>
       <option value="WEEK">This week (Monday onward)</option>
       <option value="MONTH">This month</option>
       {kind!=="PLATFORM_AUDIT_ACTIVITY"&&
        <option value="YEAR">This calendar year</option>}
      </select></label>
      <label>Start date <input type="date" value={from}
       onChange={e=>{setPeriod("CUSTOM");setFrom(e.target.value);setResult(null);}}/></label>
      <label>End date <input type="date" value={until}
       onChange={e=>{setPeriod("CUSTOM");setUntil(e.target.value);setResult(null);}}/></label>
     </>}
    </div>
    <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
     <button type="button" className="primary" disabled={busy} onClick={()=>void preview()}>
      {busy?"Checking report…":"Run permitted report"}</button>
    </div>
   </div>}
  </>}
  {!!notice&&<p role="status">{notice}</p>}
  {result&&<div style={{marginTop:16}}>
   <h3 style={{fontSize:"1rem"}}>{result.label}</h3>
   <p style={{fontSize:".8rem",color:"var(--cg-muted)"}}>
    {result.scopeLabel} · {result.sourceAsOf?
     "Database snapshot "+new Date(result.sourceAsOf).toLocaleString("en-IN"):
     "Source read completed "+new Date(result.sourceReadAt).toLocaleString("en-IN")}
   </p>
   <p style={{fontSize:".8rem",color:"var(--cg-muted)"}}>{result.explanation}</p>
   {(result.state==="READY"||result.state==="PARTIAL")&&<>
    {result.view==="CHART"&&result.kind==="FINANCE_POSTED_TREND"&&
     <MisFinanceTrend trend={{type:"MONTHLY_FINANCE",
      windowLabel:"Last six calendar months",state:"AVAILABLE",
      points:result.rows.map(r=>({month:r.month??"",incomeMinor:r.incomeMinor??"0",
       expenseMinor:r.expenseMinor??"0"}))}}/>}
    {result.view==="CHART"&&result.kind==="FINANCE_POSTED_GROUPED"&&
     <MisGroupedFinanceChart rows={result.rows.map(x=>({groupLabel:x.groupLabel??"",debitMinor:x.debitMinor??"0",creditMinor:x.creditMinor??"0"}))}/>}
    {result.view==="CHART"&&result.kind==="APPOINTMENT_DOCTOR_SUMMARY"&&
     <MisAppointmentGroupBars rows={result.rows.map(r=>({
      statusLabel:(r.doctorName??"Doctor")+" · "+(r.centerName??"Center"),
      count:r.bookings??"0"
     }))}/>}
    {result.view==="CHART"&&result.kind==="APPOINTMENT_STATUS_GROUPED"&&
     <MisAppointmentGroupBars rows={result.rows.map(r=>({
      statusLabel:r.statusLabel??"",count:r.count??"0"
     }))}/>}
    {result.view==="CHART"&&result.kind==="APPOINTMENT_STATUS"&&
     <MisAppointmentDistribution metrics={result.columns.map(c=>({
      key:c.key,label:c.label,unit:c.unit??"COUNT",
      value:result.rows[0]?.[c.key]??"0"}))}/>}
    {result.view==="CHART"&&<div style={{display:"grid",gap:9,margin:"1rem 0"}}>
     {result.rows.map((row,i)=><div key={i} style={{background:"var(--cg-surface)",
      border:"1px solid var(--cg-border)",padding:10,borderRadius:9}}>
      {result.columns.map(c=><span key={c.key} style={{display:"inline-block",marginRight:18,
       fontSize:".82rem"}}><strong>{c.label}:</strong> {cell(row[c.key],c.unit)}</span>)}
     </div>)}
    </div>}
    <div style={{overflowX:"auto"}}>
     <table style={{width:"100%",borderCollapse:"collapse",fontSize:".84rem"}}>
      <thead><tr>{result.columns.map(c=><th scope="col" key={c.key}
       style={{textAlign:"left",padding:10,borderBottom:"1px solid var(--cg-border)"}}>
       {c.label}</th>)}</tr></thead>
      <tbody>{result.rows.map((row,i)=><tr key={i}>
       {result.columns.map(c=><td key={c.key}
        style={{padding:9,borderBottom:"1px solid var(--cg-border)"}}>
        {cell(row[c.key],c.unit)}</td>)}
      </tr>)}</tbody>
     </table>
    </div>
    {result.nextOffset!==null&&<button type="button"
     disabled={busy} onClick={()=>void preview(result.nextOffset!)}>
     Next page of posted entries</button>}
   </>}
   {result.state==="PARTIAL"&&<p role="status">This original source is incomplete or requires reconciliation. Review the source explanation before export.</p>}
   {result.state==="EMPTY"&&<p role="status">No original records match the selected filters.</p>}
   {result.state==="SUPPRESSED"&&<p role="status">
    The result contains too few people to display safely.</p>}
  </div>}
  {catalog?.capabilities?.export===true&&
   <MisReportExports allowed request={(["BENEFICIARY_ASSISTANCE_SUMMARY","MEMBERSHIP_ROSTER_SUMMARY","VOLUNTEER_ROSTER_SUMMARY","PAYROLL_STATUS_SUMMARY","DONATION_RECEIPT_SUMMARY","CSR_FUNDING_SUMMARY"] as readonly string[]).includes(kind??"")?null:input(0)}/>}
  {catalog?.capabilities?.schedule===true&&<MisReportSchedules/>}
  {catalog&&<MisSavedReports canManage={catalog.capabilities?.manage===true}
    canShare={catalog.capabilities?.share===true}
   currentRequest={(["BENEFICIARY_ASSISTANCE_SUMMARY","MEMBERSHIP_ROSTER_SUMMARY","VOLUNTEER_ROSTER_SUMMARY","PAYROLL_STATUS_SUMMARY","DONATION_RECEIPT_SUMMARY","CSR_FUNDING_SUMMARY"] as readonly string[]).includes(kind??"")?null:input(0)}
   onRestore={q=>{
    setKind(q.kind);setView(q.view);setYear(q.yearRef??"");setBranch(q.branchRef??"");
    setArea(q.areaRef??"");
    setGroupBy(q.groupBy??"CATEGORY");setSortBy(q.sortBy??"NAME");
    setSortDirection(q.sortDirection??"ASC");
    setCenter(q.centerRef??"");setFrom(q.fromDay??"");
    setUntil(q.untilDay??"");setStatus(q.status??"");
    setResult(null);setProblem("");setNotice("");
   }}/>}
 </section>;
}
