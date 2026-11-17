"use client";
import {FormEvent,useCallback,useEffect,useMemo,useState,type ReactNode} from "react";

type Year={yearRef:string;name:string;startOn:string;endOn:string;status:string;version:number};
type Group={groupRef:string;name:string;code:string;category:string};
type Branch={branchRef:string;name:string;code:string;version:number};
type Account={accountRef:string;code:string;name:string;groupName:string;kind:string;
 normalSide:string;scopeKind:string;branchRef:string|null;branchName:string|null;
 status:string;version:number;balanceMinor:string;openingMinor:string;bankLabel:string|null;maskedDetails:string|null};
type Opening={journalRef:string;postingDate:string;yearName:string;amountMinor:string};
type PostingChoice={accountRef:string;code:string;name:string;branchRef:string|null;
 branchName:string|null;branchVersion:number|null};
type Setup={years:Year[];groups:Group[];branches:Branch[];accounts:Account[];
 openingJournals:Opening[];categorySummary:{category:string;balanceMinor:string;accountCount:string}[];nextOffset:number|null};
type FormKind="year"|"group"|"account"|"opening";
type Pending={key:string;kind:string;path:string;payload:Record<string,unknown>;method?:"POST"|"PATCH"};
type SafeFailure={message:string;field:string|null;uncertain:boolean};
const base="/api/finance";
const validAction:Record<FormKind,{path:string;kind:string}>={
 year:{path:"years",kind:"YEAR_CREATE"},group:{path:"groups",kind:"GROUP_CREATE"},
 account:{path:"accounts",kind:"ACCOUNT_CREATE"},
 opening:{path:"opening-journals",kind:"OPENING_POST"}
};
const friendlyKind:Record<FormKind,string>={
 year:"Financial year",group:"Account group",account:"Account",opening:"Opening entry"
};
const emptyFilters=()=>({kind:"ALL",groupRef:"",branchRef:"",status:"ALL",yearRef:""});
const blank=():Record<string,string>=>({
 name:"",code:"",startOn:"",endOn:"",category:"ASSET",parentRef:"",
 groupRef:"",accountKind:"GENERAL",scopeKind:"FOUNDATION",branchRef:"",
 bankLabel:"",bankLastFour:"",financialYearRef:"",postingDate:"",
 debitAccountRef:"",creditAccountRef:"",amount:""
});
function rupees(value:string){
 try{
  const n=BigInt(value),absolute=n<0n?-n:n;
  const main=(absolute/100n).toLocaleString("en-IN"),fraction=(absolute%100n).toString().padStart(2,"0");
  return (n<0n?"−":"")+"₹"+main+"."+fraction;
 }catch{return "Amount unavailable";}
}
async function parseFailure(res:Response):Promise<SafeFailure>{
 const value:unknown=await res.json().catch(()=>null);
 const obj=value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{};
 return {
  message:typeof obj.message==="string"&&obj.message.length<=300?obj.message:
    "Could not confirm the finance action. Check its status before retrying.",
  field:typeof obj.field==="string"?obj.field:null,
  uncertain:res.status>=500
 };
}
function Field({name,label,form,onChange,type="text",required=false,children,failure}:{
 name:string;label:string;form:Record<string,string>;onChange:(k:string,v:string)=>void;
 type?:string;required?:boolean;children?:ReactNode;failure:SafeFailure|null
}){
 const invalid=Boolean(failure?.field===name);
 const messageId="cg-fin-"+name+"-error";
 return <label className="cg-fin-field" data-invalid={invalid?"true":undefined}>
  <span>{label}{required?" *":""}</span>
  {children??<input type={type} value={form[name]??""} required={required}
   aria-invalid={invalid} aria-describedby={invalid?messageId:undefined}
   onChange={e=>onChange(name,e.target.value)} autoComplete="off"/>}
  {invalid&&<small className="cg-fin-inline-error" id={messageId} role="alert">
    {failure?.message}</small>}
 </label>;
}
export function FinanceAccountsWorkspace({canManage,canPost}:{canManage:boolean;canPost:boolean}){
 const [data,setData]=useState<Setup|null>(null);
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(true);
 const [search,setSearch]=useState("");
 const [appliedSearch,setAppliedSearch]=useState("");
 const [filters,setFilters]=useState(emptyFilters);
 const [appliedFilters,setAppliedFilters]=useState(emptyFilters);
 const [offset,setOffset]=useState(0);
 const [tab,setTab]=useState<"accounts"|"groups"|"years"|"opening">("accounts");
 const [drawer,setDrawer]=useState<FormKind|null>(null);
 const [form,setForm]=useState<Record<string,string>>(blank());
 const [failure,setFailure]=useState<SafeFailure|null>(null);
 const [success,setSuccess]=useState("");
 const [busy,setBusy]=useState(false);
 const [pending,setPending]=useState<Pending|null>(null);
 const [pendingNotFound,setPendingNotFound]=useState(false);
 const [postingQuery,setPostingQuery]=useState("");
 const [postingSearchRevision,setPostingSearchRevision]=useState(0);
 const [postingResults,setPostingResults]=useState<PostingChoice[]>([]);
 const [postingSaved,setPostingSaved]=useState<Record<string,PostingChoice>>({});
 const [postingMore,setPostingMore]=useState(false);
 const [postingLoading,setPostingLoading]=useState(false);
 const [postingError,setPostingError]=useState("");
 const [statusConfirm,setStatusConfirm]=useState<{type:"year"|"account";ref:string;name:string;expectedVersion:number;nextStatus:string}|null>(null);
 const change=(name:string,value:string)=>setForm(v=>({...v,[name]:value}));
 const load=useCallback(async()=>{
  setLoading(true);setError("");
  try{
   const params=new URLSearchParams({search:appliedSearch,offset:String(offset),...appliedFilters});
   const res=await fetch(base+"/setup?"+params.toString(),{cache:"no-store"});
   if(!res.ok){
    const e=await parseFailure(res);throw new Error(e.message);
   }
   const result=await res.json() as Setup;
   if(!result||!Array.isArray(result.accounts)||!Array.isArray(result.years)||
     !Array.isArray(result.groups)||!Array.isArray(result.branches)||
     !Array.isArray(result.openingJournals)||!Array.isArray(result.categorySummary)||
     !result.categorySummary.every(x=>x&&typeof x.category==="string"&&
       ["ASSET","LIABILITY","FUND","INCOME","EXPENSE"].includes(x.category)&&
       typeof x.balanceMinor==="string"&&/^-?[0-9]{1,25}$/.test(x.balanceMinor)&&
       typeof x.accountCount==="string"&&/^[0-9]{1,9}$/.test(x.accountCount)))
      throw Error("Finance records could not be verified. Refresh and try again.");
   setData(result);
  }catch(e){setData(null);setError(e instanceof Error?e.message:"Finance accounts could not be loaded. Please retry.");}
  finally{setLoading(false);}
 },[appliedSearch,appliedFilters,offset]);
 useEffect(()=>{void load();},[load]);
 function open(kind:FormKind){
  setDrawer(kind);setFailure(null);setSuccess("");setPending(null);setPendingNotFound(false);
  setForm(blank());setPostingQuery("");setPostingResults([]);
  setPostingSaved({});setPostingMore(false);setPostingError("");
 }
 useEffect(()=>{
  if(drawer!=="opening")return;
  const controller=new AbortController();
  let active=true;
  const timer=setTimeout(async()=>{
   if(!active)return;
   setPostingLoading(true);setPostingError("");
   try{
    const response=await fetch(base+"/account-options?q="+encodeURIComponent(postingQuery.trim()),
     {cache:"no-store",signal:controller.signal});
    if(!response.ok)throw Error("Account choices could not be loaded.");
    const value:unknown=await response.json();
    if(!value||typeof value!=="object"||Array.isArray(value)||
       !("accounts" in value)||!Array.isArray(value.accounts)||
       !("hasMore" in value)||typeof value.hasMore!=="boolean"||
       !value.accounts.every((x:unknown)=>x&&typeof x==="object"&&
          "accountRef" in x&&typeof x.accountRef==="string"&&
          "name" in x&&typeof x.name==="string"&&
          "code" in x&&typeof x.code==="string"))
       throw Error("Account choices could not be verified.");
    if(active){setPostingResults(value.accounts as PostingChoice[]);
      setPostingMore(value.hasMore);}
   }catch{
    if(active){setPostingResults([]);
     setPostingError("Unable to load eligible posting accounts. Check the connection and retry.");}
   }finally{if(active)setPostingLoading(false);}
  },300);
  return()=>{active=false;clearTimeout(timer);controller.abort();};
 },[drawer,postingQuery,postingSearchRevision]);
 const activeAccounts=useMemo(()=>[...postingResults,
   ...Object.values(postingSaved).filter(p=>
     !postingResults.some(x=>x.accountRef===p.accountRef))],[postingResults,postingSaved]);
 function choosePosting(field:"debitAccountRef"|"creditAccountRef",value:string){
  const selected=activeAccounts.find(x=>x.accountRef===value);
  if(selected)setPostingSaved(p=>({...p,[value]:selected}));
  change(field,value);
 }
 const categoryMap=new Map((data?.categorySummary??[]).map(row=>[row.category,row]));
 const amount=(category:string)=>categoryMap.get(category)?.balanceMinor??"0";
 const accountsIn=(category:string)=>Number(categoryMap.get(category)?.accountCount??"0");
 const surplus=(BigInt(amount("INCOME"))-BigInt(amount("EXPENSE"))).toString();
 const summary=[
  {label:"Total Assets (posted)",value:rupees(amount("ASSET")),icon:"▣"},
  {label:"Total Liabilities (posted)",value:rupees(amount("LIABILITY")),icon:"▤"},
  {label:"Equity / Fund (posted)",value:rupees(amount("FUND")),icon:"⚖"},
  {label:"Total Income (posted)",value:rupees(amount("INCOME")),icon:"↗"},
  {label:"Total Expenses (posted)",value:rupees(amount("EXPENSE")),icon:"↘"},
  {label:"Net Surplus (posted)",value:rupees(surplus),icon:"▥"}
 ];
 const categoryCounts=["ASSET","LIABILITY","FUND","INCOME","EXPENSE"]
   .map(kind=>({kind,count:accountsIn(kind)})).filter(x=>x.count>0);
 const legendColors=["#1E53DC","#1BAF7A","#EDA100","#EB6834","#4A3AA7"];
 const countTotal=categoryCounts.reduce((sum,c)=>sum+c.count,0);
 let percent=0;
 const chartBackground=countTotal?"conic-gradient("+
    categoryCounts.map((c,i)=>{
      const start=percent;
      percent+=c.count/countTotal*100;
      return legendColors[i%legendColors.length]+" "+start+"% "+percent+"%";
    }).join(",")+")":"#E0E5ED";

 function payloadFor(kind:FormKind):Record<string,unknown>{
  if(kind==="year")return {name:form.name,startOn:form.startOn,endOn:form.endOn};
  if(kind==="group")return {name:form.name,code:form.code,category:form.category,
   ...(form.parentRef?{parentRef:form.parentRef}:{})};
  if(kind==="account"){
   const selected=data?.branches.find(x=>x.branchRef===form.branchRef);
   return {name:form.name,code:form.code,groupRef:form.groupRef,
    accountKind:form.accountKind,scopeKind:form.scopeKind,
    ...(form.scopeKind==="BRANCH"?{branchRef:form.branchRef,branchVersion:selected?.version}:{}),
    ...(form.accountKind!=="GENERAL"?{bankLabel:form.bankLabel}:{}),
    ...(form.accountKind==="BANK"&&form.bankLastFour?{bankLastFour:form.bankLastFour}:{})};
  }
  const debit=activeAccounts.find(a=>a.accountRef===form.debitAccountRef);
  const credit=activeAccounts.find(a=>a.accountRef===form.creditAccountRef);
  const ref=debit?.branchRef??credit?.branchRef;
  const branchVersion=debit?.branchRef?debit.branchVersion:credit?.branchRef?credit.branchVersion:null;
  return {financialYearRef:form.financialYearRef,postingDate:form.postingDate,
   debitAccountRef:form.debitAccountRef,creditAccountRef:form.creditAccountRef,
   amount:form.amount,...(ref?{branchVersion}:{})};
 }
 async function issue(request:Pending){
  setBusy(true);setFailure(null);setPendingNotFound(false);
  try{
   const res=await fetch(base+"/"+request.path,{
    method:request.method??"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({...request.payload,requestKey:request.key})});
   if(!res.ok){
    const f=await parseFailure(res);
    setFailure(f);
    if(f.uncertain){setPending(request);}
    else{setPending(null);}
    return;
   }
   const confirmation:unknown=await res.json().catch(()=>null);
   if(!confirmation||typeof confirmation!=="object"||Array.isArray(confirmation)||
      !("confirmed" in confirmation)||confirmation.confirmed!==true||
      !("recordRef" in confirmation)||typeof confirmation.recordRef!=="string")throw Error("UNCONFIRMED");
   const earlier="replayed" in confirmation&&confirmation.replayed===true;
   const done:Record<string,string>={
    YEAR_CREATE:"Financial year created",
    GROUP_CREATE:"Account group created",
    ACCOUNT_CREATE:"Financial account created",
    OPENING_POST:"Balanced opening entry posted",
    YEAR_STATUS:"Financial year closed",
    ACCOUNT_STATUS:request.payload.status==="INACTIVE"?"Account deactivated":"Account reactivated"
   };
   setPending(null);setDrawer(null);setStatusConfirm(null);
   setSuccess(earlier?"Your earlier finance change was confirmed.":(done[request.kind]??"Finance change")+" successfully.");
   setOffset(0);void load();
  }catch{
   setPending(request);
   setFailure({message:"The result could not be confirmed because the connection was interrupted. Check the request status before retrying.",
     field:null,uncertain:true});
  }finally{setBusy(false);}
 }
 function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!drawer||busy)return;
  const action=validAction[drawer];
  void issue({path:action.path,kind:action.kind,payload:payloadFor(drawer),key:crypto.randomUUID()});
 }
 function statusChange(){
  if(!statusConfirm||busy)return;
  const item=statusConfirm;
  const path=item.type==="year"?"years/"+item.ref+"/status":"accounts/"+item.ref+"/status";
  const kind=item.type==="year"?"YEAR_STATUS":"ACCOUNT_STATUS";
  void issue({path,kind,method:"PATCH",key:crypto.randomUUID(),
   payload:{status:item.nextStatus,expectedVersion:item.expectedVersion}});
 }
 async function checkPending(){
  if(!pending||busy)return;
  setBusy(true);setFailure(null);
  try{
   const res=await fetch(base+"/commands/"+pending.kind+"/"+pending.key,{cache:"no-store"});
   if(!res.ok)throw Error((await parseFailure(res)).message);
   const result=await res.json() as {confirmed?:boolean};
   if(result.confirmed===true){
    setPending(null);setDrawer(null);setStatusConfirm(null);
    setSuccess("Your original finance request was confirmed. The updated accounts have been loaded.");
    setOffset(0);void load();
   }else if(result.confirmed===false){
    setPendingNotFound(true);
    setFailure({message:"No completed change was found for this request. You may retry the same request without creating a duplicate.",field:null,uncertain:true});
   }else{setFailure({message:"The original result could not be verified. Check again before retrying.",field:null,uncertain:true});}
  }catch(e){setFailure({message:e instanceof Error?e.message:"Cannot verify the request yet. Try checking again.",field:null,uncertain:true});}
  finally{setBusy(false);}
 }
 return <div className="cg-fin-workspace">
  <header className="cg-fin-header">
   <div><div className="cg-fin-breadcrumb">Foundation / Finance Management</div>
    <h1>Accounts</h1><p>Foundation financial years, account groups, cash/bank accounts and opening balances.</p></div>
   <div className="cg-fin-header-actions">
    <button type="button" onClick={()=>void load()} disabled={loading}>Refresh</button>
    {canManage&&<button className="primary" type="button" onClick={()=>open("account")}>+ Add Account</button>}
   </div>
  </header>
  {success&&<p className="cg-fin-success" role="status">{success}</p>}
  {error&&<div className="cg-fin-notice" role="alert"><strong>Finance accounts unavailable.</strong>
   <p>{error}</p><button type="button" onClick={()=>void load()}>Try again</button></div>}
  {loading&&!data&&<p role="status">Checking current finance records…</p>}
  {data&&<>
   <div className="cg-fin-kpis" aria-label="Finance setup overview">
    {summary.map(s=><div className="cg-fin-kpi" key={s.label}>
     <span className="cg-fin-kpi-icon" aria-hidden="true">{s.icon}</span>
     <div><p>{s.label}</p><strong>{s.value}</strong></div>
    </div>)}
   </div>
   <div className="cg-fin-content-grid"><section className="cg-fin-panel">
    <div className="cg-fin-toolbar">
     <div><h2>Financial accounts & opening setup</h2>
      <p>Amounts are shown only from confirmed, posted finance records.</p></div>
     <div className="cg-fin-toolbar-actions">
      {canManage&&<button type="button" onClick={()=>open("year")}>+ Financial Year</button>}
      {canManage&&<button type="button" onClick={()=>open("group")}>+ Account Group</button>}
      {canPost&&<button type="button" onClick={()=>open("opening")}>+ Opening Entry</button>}
     </div>
    </div>
    <form className="cg-fin-advanced" onSubmit={e=>{
      e.preventDefault();setOffset(0);setAppliedSearch(search.trim());setAppliedFilters({...filters});
     }}>
     <strong>Advanced Search & Filters</strong>
     <div className="cg-fin-filter-grid">
      <label>Search
       <input type="search" value={search} maxLength={80}
        placeholder="Account name or code" onChange={e=>setSearch(e.target.value)}/>
      </label>
      <label>Financial year
       <select value={filters.yearRef} onChange={e=>setFilters(v=>({...v,yearRef:e.target.value}))}>
        <option value="">All years</option>
        {data?.years.map(y=><option value={y.yearRef} key={y.yearRef}>{y.name}</option>)}
       </select>
      </label>
      <label>Account type
       <select value={filters.kind} onChange={e=>setFilters(v=>({...v,kind:e.target.value}))}>
        <option value="ALL">All types</option><option value="GENERAL">General</option>
        <option value="CASH">Cash</option><option value="BANK">Bank</option>
       </select>
      </label>
      <label>Account group
       <select value={filters.groupRef} onChange={e=>setFilters(v=>({...v,groupRef:e.target.value}))}>
        <option value="">All groups</option>
        {data?.groups.map(g=><option key={g.groupRef} value={g.groupRef}>{g.name} — {g.code}</option>)}
       </select>
      </label>
      <label>Branch / Location
       <select value={filters.branchRef} onChange={e=>setFilters(v=>({...v,branchRef:e.target.value}))}>
        <option value="">All branches and Foundation</option>
        {data?.branches.map(b=><option value={b.branchRef} key={b.branchRef}>{b.name} — {b.code}</option>)}
       </select>
      </label>
      <label>Status
       <select value={filters.status} onChange={e=>setFilters(v=>({...v,status:e.target.value}))}>
        <option value="ALL">All statuses</option>
        <option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option>
       </select>
      </label>
     </div>
     <div className="cg-fin-filter-actions">
      <button type="button" onClick={()=>{
        setSearch("");setFilters(emptyFilters());setOffset(0);setAppliedSearch("");
        setAppliedFilters(emptyFilters());
       }}>Reset</button>
      <button className="primary" type="submit">Apply Filters</button>
     </div>
    </form>
    <div className="cg-fin-tabs" role="tablist" aria-label="Financial setup sections">
     {([
      ["accounts","Accounts"],["groups","Account Groups"],["years","Financial Years"],["opening","Opening Entries"]
     ] as const).map(([key,title])=><button role="tab" aria-selected={tab===key}
      className={tab===key?"is-active":""} key={key} onClick={()=>setTab(key)}
      type="button">{title}</button>)}
    </div>
    {tab==="accounts"&&<>
     <div className="cg-fin-table-wrap"><table className="cg-fin-table">
      <thead><tr><th>Account Name</th><th>Code</th><th>Group</th><th>Scope</th>
       <th>Type</th><th>Opening balance</th><th>Current balance</th><th>Status</th>{canManage&&<th>Action</th>}</tr></thead>
      <tbody>{data.accounts.map(a=><tr key={a.accountRef}>
       <td><strong>{a.name}</strong>{a.bankLabel&&<small>{a.bankLabel}{a.maskedDetails?" — "+a.maskedDetails:""}</small>}</td>
       <td>{a.code}</td><td>{a.groupName}</td><td>{a.branchName??"Foundation"}</td>
       <td>{a.kind==="GENERAL"?"General":a.kind==="CASH"?"Cash":"Bank"}</td>
       <td className="cg-fin-money">{rupees(a.openingMinor)}</td>
       <td className="cg-fin-money">{rupees(a.balanceMinor)}</td>
       <td><span className={"cg-fin-status "+(a.status==="ACTIVE"?"is-active":"")}>{a.status==="ACTIVE"?"Active":"Inactive"}</span></td>
       {canManage&&<td><button type="button" disabled={busy}
        onClick={()=>setStatusConfirm({type:"account",ref:a.accountRef,name:a.name,
         expectedVersion:a.version,nextStatus:a.status==="ACTIVE"?"INACTIVE":"ACTIVE"})}>
        {a.status==="ACTIVE"?"Deactivate":"Reactivate"}</button></td>}
      </tr>)}</tbody>
     </table>{!data.accounts.length&&!loading&&<p className="cg-fin-empty">No matching financial accounts. {canManage?"Choose Add Account to create your first account.":"Ask your Finance Administrator to create accounts."}</p>}</div>
     <div className="cg-fin-paging">
      <span>{data.accounts.length} account{data.accounts.length===1?"":"s"} displayed</span>
      <button type="button" disabled={offset===0||loading}
       onClick={()=>setOffset(v=>Math.max(0,v-50))}>Previous</button>
      <button type="button" disabled={data.nextOffset===null||loading}
       onClick={()=>setOffset(data.nextOffset??0)}>Next</button>
     </div>
    </>}
    {tab==="groups"&&<div className="cg-fin-table-wrap"><table className="cg-fin-table">
     <thead><tr><th>Group</th><th>Code</th><th>Category</th></tr></thead><tbody>
      {data.groups.map(g=><tr key={g.groupRef}><td><strong>{g.name}</strong></td>
       <td>{g.code}</td><td>{g.category.charAt(0)+g.category.slice(1).toLowerCase()}</td></tr>)}
     </tbody></table>{!data.groups.length&&<p className="cg-fin-empty">No account groups yet. Create one before adding accounts.</p>}</div>}
    {tab==="years"&&<div className="cg-fin-table-wrap"><table className="cg-fin-table">
     <thead><tr><th>Financial year</th><th>Start</th><th>End</th><th>Status</th>{canManage&&<th>Action</th>}</tr></thead><tbody>
      {data.years.map(y=><tr key={y.yearRef}><td><strong>{y.name}</strong></td>
       <td>{y.startOn}</td><td>{y.endOn}</td>
       <td><span className={"cg-fin-status "+(y.status==="OPEN"?"is-active":"")}>{y.status==="OPEN"?"Open":"Closed"}</span></td>
       {canManage&&<td>{y.status==="OPEN"?<button type="button" disabled={busy}
        onClick={()=>setStatusConfirm({type:"year",ref:y.yearRef,name:y.name,
         expectedVersion:y.version,nextStatus:"CLOSED"})}>Close year</button>:"Closed"}</td>}</tr>)}
     </tbody></table>{!data.years.length&&<p className="cg-fin-empty">No financial year exists. Add a financial year to begin.</p>}</div>}
    {tab==="opening"&&<div className="cg-fin-table-wrap"><table className="cg-fin-table">
     <thead><tr><th>Date</th><th>Financial year</th><th>Balanced opening amount</th><th>Status</th></tr></thead><tbody>
      {data.openingJournals.map(j=><tr key={j.journalRef}><td>{j.postingDate}</td>
       <td>{j.yearName}</td><td className="cg-fin-money">{rupees(j.amountMinor)}</td>
       <td><span className="cg-fin-status is-active">Posted</span></td></tr>)}
     </tbody></table>{!data.openingJournals.length&&<p className="cg-fin-empty">No opening entries posted. Select two eligible accounts and an open financial year.</p>}</div>}
   </section>
   <aside className="cg-fin-side" aria-label="Accounts overview">
    <section className="cg-fin-rail-card">
     <h2>Account Overview</h2>
     <p>Active and inactive account categories in this Foundation.</p>
     <div className="cg-fin-overview-visual">
      <div className="cg-fin-donut" style={{background:chartBackground}} role="img"
        aria-label="Account category distribution based on existing financial accounts">
       <div><small>Accounts</small><strong>{countTotal}</strong></div></div>
      <ul className="cg-fin-legend">{categoryCounts.map((c,i)=>
       <li key={c.kind}><span className="cg-fin-legend-marker"
        style={{background:legendColors[i%legendColors.length]}}/>
        <span>{c.kind==="FUND"?"Equity / Fund":
          c.kind.charAt(0)+c.kind.slice(1).toLowerCase()}</span><b>{c.count}</b></li>)}
      </ul>
     </div>
     {!countTotal&&<p className="cg-fin-empty">Create your first account to see its category.</p>}
    </section>
    <section className="cg-fin-rail-card">
     <h2>Cash & Bank Accounts</h2>
     <p>Accounts on the current page. Bank numbers remain masked.</p>
     {data.accounts.filter(a=>a.kind==="CASH"||a.kind==="BANK").length?
      <ul className="cg-fin-recent-list">{data.accounts.filter(a=>a.kind==="CASH"||a.kind==="BANK")
       .slice(0,6).map(a=><li key={a.accountRef}><div><b>{a.bankLabel??a.name}</b>
        <small>{a.maskedDetails??a.kind} · {a.status==="ACTIVE"?"Active":"Inactive"}</small>
       </div><strong>{rupees(a.balanceMinor)}</strong></li>)}</ul>:
      <p className="cg-fin-empty">No bank or cash accounts on this page.</p>}
    </section>
    <section className="cg-fin-rail-card">
     <h2>Recent Opening Entries</h2>
     <p>Only confirmed source-backed entries are displayed.</p>
     {data.openingJournals.length?<ul className="cg-fin-recent-list">
      {data.openingJournals.slice(0,5).map(j=><li key={j.journalRef}>
       <div><b>{j.yearName}</b><small>{j.postingDate}</small></div>
       <strong>{rupees(j.amountMinor)}</strong></li>)}</ul>:
      <p className="cg-fin-empty">No opening entries have been posted yet.</p>}
    </section>
   </aside></div>
  </>}
  {statusConfirm&&<div className="drawer-backdrop" role="presentation">
   <section className="role-drawer cg-fin-drawer" role="dialog" aria-modal="true"
    aria-labelledby="cg-fin-confirm-title">
    <div className="cg-fin-drawer-header"><h2 id="cg-fin-confirm-title">Confirm finance status change</h2>
     <button type="button" disabled={busy||Boolean(pending)} onClick={()=>setStatusConfirm(null)}>×</button></div>
    <p>{statusConfirm.type==="year"?
     "Close the financial year “"+statusConfirm.name+"”? New postings will be blocked for this period.":
     (statusConfirm.nextStatus==="INACTIVE"?"Deactivate":"Reactivate")+" the account “"+
      statusConfirm.name+"”? "+(statusConfirm.nextStatus==="INACTIVE"?
      "New postings to this account will be blocked; historical balances remain visible.":
      "The account may be used for new authorized postings if its branch is active.")}</p>
    {failure&&<p role="alert" className="cg-fin-notice">{failure.message}</p>}
    {pending&&<div className="cg-fin-pending"><p>Check the earlier request outcome before retrying.</p>
      <button type="button" disabled={busy} onClick={()=>void checkPending()}>Check original request</button>
      {pendingNotFound&&<button type="button" disabled={busy} onClick={()=>void issue(pending)}>Retry same request</button>}
     </div>}
    <div className="cg-fin-form-actions"><button type="button" disabled={busy||Boolean(pending)}
      onClick={()=>setStatusConfirm(null)}>Cancel</button>
     <button type="button" className="primary" disabled={busy||Boolean(pending)}
      onClick={statusChange}>{busy?"Saving…":"Confirm change"}</button></div>
   </section>
  </div>}
  {drawer&&<div className="drawer-backdrop" role="presentation" onMouseDown={e=>{
    if(e.target===e.currentTarget&&!busy&&!pending)setDrawer(null);}}>
   <div role="dialog" aria-modal="true" aria-labelledby="cg-fin-drawer-title"
    className="role-drawer cg-fin-drawer">
    <div className="cg-fin-drawer-header"><div><p>Finance Management</p>
     <h2 id="cg-fin-drawer-title">Create {friendlyKind[drawer]}</h2></div>
     <button type="button" aria-label="Close finance form" disabled={busy||Boolean(pending)}
      onClick={()=>setDrawer(null)}>×</button></div>
    <p className="cg-fin-description">Complete only the details needed for this record. Required fields are marked *.</p>
    <form className="cg-fin-form" onSubmit={submit}>
     {drawer==="year"&&<>
      <Field failure={failure} name="name" label="Financial year name" form={form} onChange={change} required/>
      <Field failure={failure} name="startOn" label="Start date" form={form} onChange={change} type="date" required/>
      <Field failure={failure} name="endOn" label="End date" form={form} onChange={change} type="date" required/>
     </>}
     {drawer==="group"&&<>
      <Field failure={failure} name="name" label="Group name" form={form} onChange={change} required/>
      <Field failure={failure} name="code" label="Group code" form={form} onChange={change} required/>
      <Field failure={failure} name="category" label="Account category" form={form} onChange={change} required>
       <select value={form.category} onChange={e=>change("category",e.target.value)}>
        {(["ASSET","LIABILITY","FUND","INCOME","EXPENSE"] as const).map(x=>
          <option key={x} value={x}>{x.charAt(0)+x.slice(1).toLowerCase()}</option>)}
       </select>
      </Field>
      <Field failure={failure} name="parentRef" label="Parent group (optional)" form={form} onChange={change}>
       <select value={form.parentRef} onChange={e=>change("parentRef",e.target.value)}>
        <option value="">No parent group</option>
        {data?.groups.filter(g=>g.category===form.category).map(g=>
         <option value={g.groupRef} key={g.groupRef}>{g.name} — {g.code}</option>)}
       </select>
      </Field>
     </>}
     {drawer==="account"&&<>
      <Field failure={failure} name="name" label="Account name" form={form} onChange={change} required/>
      <Field failure={failure} name="code" label="Account code" form={form} onChange={change} required/>
      <Field failure={failure} name="groupRef" label="Account group" form={form} onChange={change} required>
       <select required value={form.groupRef} onChange={e=>change("groupRef",e.target.value)}>
        <option value="">Select a current group</option>
        {data?.groups.filter(g=>form.accountKind==="GENERAL"||g.category==="ASSET").map(g=><option value={g.groupRef} key={g.groupRef}>{g.name} — {g.code}</option>)}
       </select>
      </Field>
      <Field failure={failure} name="accountKind" label="Account type" form={form} onChange={change}>
       <select value={form.accountKind} onChange={e=>change("accountKind",e.target.value)}>
        <option value="GENERAL">General account</option><option value="CASH">Cash</option>
        <option value="BANK">Bank</option>
       </select>
      </Field>
      <Field failure={failure} name="scopeKind" label="Account scope" form={form} onChange={change}>
       <select value={form.scopeKind} onChange={e=>change("scopeKind",e.target.value)}>
        <option value="FOUNDATION">Foundation</option><option value="BRANCH">Branch</option>
       </select>
      </Field>
      {form.scopeKind==="BRANCH"&&<Field failure={failure} name="branchRef" label="Active branch" form={form} onChange={change} required>
       <select required value={form.branchRef} onChange={e=>change("branchRef",e.target.value)}>
        <option value="">Select an active branch</option>
        {data?.branches.map(b=><option key={b.branchRef} value={b.branchRef}>{b.name} — {b.code}</option>)}
       </select>
      </Field>}
      {form.accountKind!=="GENERAL"&&<Field failure={failure} name="bankLabel" label={form.accountKind==="BANK"?"Bank account display name":"Cash account label"}
       form={form} onChange={change} required/>}
      {form.accountKind==="BANK"&&<Field failure={failure} name="bankLastFour" label="Last 4 digits (optional, do not enter full account number)"
       form={form} onChange={change}/>}
      {!data?.groups.length&&<p role="note">Create an account group before adding accounts.</p>}
     </>}
     {drawer==="opening"&&<>
      <Field failure={failure} name="financialYearRef" label="Open financial year" form={form} onChange={change} required>
       <select required value={form.financialYearRef} onChange={e=>change("financialYearRef",e.target.value)}>
        <option value="">Select financial year</option>
        {data?.years.filter(y=>y.status==="OPEN").map(y=><option value={y.yearRef} key={y.yearRef}>
         {y.name} ({y.startOn} to {y.endOn})</option>)}
       </select>
      </Field>
      <Field failure={failure} name="postingDate" label="Posting date" form={form} onChange={change} type="date" required/>
      <label className="cg-fin-field">Search eligible finance accounts
       <input type="search" value={postingQuery} maxLength={80}
        placeholder="Search by account name or business code"
        onChange={e=>setPostingQuery(e.target.value)}/>
      </label>
      {postingLoading&&<p role="status">Finding eligible finance accounts…</p>}
      {postingMore&&<p className="cg-fin-help">More eligible accounts exist. Refine the search to find the correct account.</p>}
      {postingError&&<div className="cg-fin-notice" role="alert"><p>{postingError}</p>
       <button type="button" onClick={()=>setPostingSearchRevision(i=>i+1)}>Retry search</button></div>}
      <Field failure={failure} name="debitAccountRef" label="Debit account" form={form} onChange={change} required>
       <select required value={form.debitAccountRef} onChange={e=>choosePosting("debitAccountRef",e.target.value)}>
        <option value="">Choose debit account</option>
        {activeAccounts.map(a=><option key={a.accountRef} value={a.accountRef}>
         {a.name} — {a.code}{a.branchName?" ("+a.branchName+")":""}</option>)}
       </select>
      </Field>
      <Field failure={failure} name="creditAccountRef" label="Credit account" form={form} onChange={change} required>
       <select required value={form.creditAccountRef} onChange={e=>choosePosting("creditAccountRef",e.target.value)}>
        <option value="">Choose credit account</option>
        {activeAccounts.filter(a=>a.accountRef!==form.debitAccountRef).map(a=>
         <option key={a.accountRef} value={a.accountRef}>
          {a.name} — {a.code}{a.branchName?" ("+a.branchName+")":""}</option>)}
       </select>
      </Field>
      <Field failure={failure} name="amount" label="Balanced amount (INR)" form={form} onChange={change}
       required type="text"/>
      <p className="cg-fin-help">Both accounts receive the same amount on opposite sides. This creates one immutable posted opening entry, not a cash payment.</p>
     </>}
     {failure&&!failure.field&&<div className="cg-fin-notice" role="alert"><p>{failure.message}</p>
      {failure.field&&<p>Review the indicated {failure.field==="groupRef"?"account group":
        failure.field==="branchRef"?"branch":failure.field==="postingDate"?"posting date":
        failure.field==="amount"?"amount":failure.field==="bankLastFour"?"bank account last four digits":"form"} field.</p>}</div>}
     {pending&&<div className="cg-fin-pending" role="status">
       <p>The earlier request has an unconfirmed result. Check it before attempting another change.</p>
       <button type="button" onClick={()=>void checkPending()} disabled={busy}>Check original request</button>
       {pendingNotFound&&<button type="button" disabled={busy} onClick={()=>void issue(pending)}>Retry same request</button>}
      </div>}
     <div className="cg-fin-form-actions">
      <button type="button" disabled={busy||Boolean(pending)} onClick={()=>setDrawer(null)}>Cancel</button>
      <button className="primary" type="submit" disabled={busy||Boolean(pending)}>{busy?"Saving…":
       drawer==="opening"?"Post balanced entry":"Save "+friendlyKind[drawer]}</button>
     </div>
    </form>
   </div>
  </div>}
 </div>;
}
