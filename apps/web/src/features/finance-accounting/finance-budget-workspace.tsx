"use client";
import {useCallback,useEffect,useState} from "react";
type Year={yearRef:string;name:string;startOn:string;endOn:string;status:string};
type ProjectChoice={value:string;label:string;branchRef:string|null};
type Branch={branchRef:string;name:string;version:number};
type Budget={budgetRef:string;budgetNumber:string;name:string;category:string;status:string;
 ceilingMinor:string;version:number;periodStart:string;periodEnd:string};
type Detail={budgetRef:string;budgetNumber:string;name:string;status:string;version:number;
 category:string;ceilingMinor:string;financialYearRef:string;branchRef:string|null;projectRef?:string|null;projectLabel?:string|null;
 start:string;end:string;allocatedMinor:string;committedOutstandingMinor:string;
 utilizedMinor:string;availableMinor:string;overBudgetMinor:string;releasedMinor:string;
 items:{description:string;quantityMilli:string;unitRateMinor:string;totalMinor:string}[];
 events:{kind:string;amountMinor:string;recordedAt:string}[]};
type Dashboard={cards:{total:number;drafts:number;submitted:number;approved:number;
 returned:number;rejected:number;archived:number;totalCeilingMinor:string;
 allocatedMinor:string;committedOutstandingMinor:string;utilizedMinor:string;
 availableMinor:string;overBudgetMinor:string};explanation:string};
type Expense={journalRef:string;voucherNumber:string;postedDate:string;amountMinor:string};
type Form={budgetName:string;financialYearRef:string;branchRef:string;branchVersion:number|null;projectRef:string;
 category:string;periodStart:string;periodEnd:string;fundingNote:string;ceiling:string;
 items:{description:string;quantity:string;unitRate:string}[]};
const clean=():Form=>({budgetName:"",financialYearRef:"",branchRef:"",
 branchVersion:null,projectRef:"",category:"",periodStart:"",periodEnd:"",
 fundingNote:"Foundation budget authorization",ceiling:"",items:[]});
const currency=(value:string)=>{try{
 const n=BigInt(value);return "₹"+(n/100n).toLocaleString("en-IN")+
 "."+(n%100n).toString().padStart(2,"0");
}catch{return "Not available";}};
const rupees=(v:string)=>(BigInt(v)/100n).toString()+"."+
 (BigInt(v)%100n).toString().padStart(2,"0");
async function failure(res:Response){
 const body:unknown=await res.json().catch(()=>null);
 if(body&&typeof body==="object"&&!Array.isArray(body)&&"message" in body&&
    typeof body.message==="string"&&body.message.length<=300)return body.message;
 return res.status===409?"Budget changed or capacity is insufficient. Refresh first.":
  res.status===403?"Your current role cannot manage this budget.":
  "The original budget command cannot be confirmed. Check its status.";
}
export function FinanceBudgetWorkspace({canManage}:{canManage:boolean}){
 const [years,setYears]=useState<Year[]>([]);
 const [branches,setBranches]=useState<Branch[]>([]),[projects,setProjects]=useState<ProjectChoice[]>([]);
 const [categories,setCategories]=useState<{code:string;name:string}[]>([]);
 const [budgets,setBudgets]=useState<Budget[]>([]);
 const [overview,setOverview]=useState<Dashboard|null>(null);
 const [refreshTick,setRefreshTick]=useState(0);
 const [selected,setSelected]=useState<Detail|null>(null);
 const [expenses,setExpenses]=useState<Expense[]>([]);
 const [form,setForm]=useState<Form>(clean());
 const [stage,setStage]=useState(0);
 const [offset,setOffset]=useState(0);
 const [next,setNext]=useState<number|null>(null);
 const [eventKind,setEventKind]=useState("ALLOCATE");
 const [eventAmount,setEventAmount]=useState("");
 const [expenseRef,setExpenseRef]=useState("");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [pending,setPending]=useState<{key:string;path:string;method:string;body:Record<string,unknown>}|null>(null);
 const list=useCallback(async()=>{
  setRefreshTick(v=>v+1);
  try{
   const response=await fetch("/api/finance/budgets/list?offset="+offset,{cache:"no-store"});
   if(!response.ok)throw Error(await failure(response));
   const value=await response.json() as {budgets?:Budget[];nextOffset?:number|null};
   if(!Array.isArray(value.budgets))throw Error("The original budget list is unavailable.");
   setBudgets(value.budgets);setNext(value.nextOffset??null);
  }catch(e){setError(e instanceof Error?e.message:"Budget list is unavailable.");}
 },[offset]);
 useEffect(()=>{void list();},[list]);
 useEffect(()=>{
  let live=true;
  void(async()=>{try{
   const r=await fetch("/api/finance/budgets/dashboard",{cache:"no-store"});
   if(!r.ok)throw Error(await failure(r));
   const data=await r.json() as Dashboard;
   if(!data?.cards)throw Error("Original budget totals cannot be confirmed.");
   if(live)setOverview(data);
  }catch(e){if(live)setError(e instanceof Error?e.message:"Budget totals unavailable.");}})();
  return()=>{live=false;};
 },[refreshTick]);
 useEffect(()=>{let mounted=true;
  void(async()=>{
   try{
    const r=await fetch("/api/finance/budgets/options",{cache:"no-store"});
    if(!r.ok)throw Error(await failure(r));
    const d=await r.json() as {years?:Year[];branches?:Branch[];categories?:{code:string;name:string}[];projects?:ProjectChoice[]};
    if(!Array.isArray(d.years)||!Array.isArray(d.branches)||!Array.isArray(d.categories))throw Error("Invalid budget options");
    if(mounted){setYears(d.years);setBranches(d.branches);setCategories(d.categories);setProjects(Array.isArray(d.projects)?d.projects:[]);}
   }catch(e){if(mounted)setError(e instanceof Error?e.message:"Budget scope unavailable.");}
  })();return()=>{mounted=false;};
 },[]);
 async function open(ref:string){
  setBusy(true);setError("");setNotice("");
  try{
   const [d,e]=await Promise.all([
    fetch("/api/finance/budgets/"+ref,{cache:"no-store"}),
    fetch("/api/finance/budgets/"+ref+"/eligible-expenses",{cache:"no-store"})]);
   if(!d.ok)throw Error(await failure(d));
   const info=await d.json() as Detail;
   if(!info.budgetNumber)throw Error("The original budget could not be confirmed.");
   setSelected(info);
   if(e.ok){
    const eligible=await e.json() as {expenses?:Expense[]};
    setExpenses(eligible.expenses??[]);
   }else setExpenses([]);
   setExpenseRef("");
   if(["DRAFT","RETURNED"].includes(info.status)){
    const branch=branches.find(x=>x.branchRef===info.branchRef);
    setForm({budgetName:info.name,financialYearRef:info.financialYearRef,
     branchRef:info.branchRef??"",branchVersion:branch?.version??null,projectRef:info.projectRef??"",
     category:info.category,periodStart:info.start,periodEnd:info.end,
     fundingNote:"Foundation budget authorization",ceiling:rupees(info.ceilingMinor),
     items:(info.items??[]).map(x=>({
      description:x.description,quantity:(BigInt(x.quantityMilli)/1000n).toString()+
       (BigInt(x.quantityMilli)%1000n===0n?"":"."+String(BigInt(x.quantityMilli)%1000n).padStart(3,"0").replace(/0+$/,"")),
      unitRate:rupees(x.unitRateMinor)}))});
   }
  }catch(e){setError(e instanceof Error?e.message:"Budget details unavailable.");}
  finally{setBusy(false);}
 }
 async function execute(path:string,method:"POST"|"PATCH",content:Record<string,unknown>){
  if(busy||pending)return;
  const key=crypto.randomUUID();
  const data={key,path,method,body:{...content,requestKey:key}};
  setPending(data);setBusy(true);setError("");setNotice("");
  try{
   const r=await fetch("/api/finance/budgets/"+path,{method,
    headers:{"Content-Type":"application/json"},body:JSON.stringify(data.body)});
   if(!r.ok)throw Error(await failure(r));
   const result=await r.json() as {confirmed?:boolean;status?:string;budgetRef?:string};
   if(!result.confirmed)throw Error("The original budget outcome is unconfirmed.");
   setPending(null);setNotice("Budget source confirmed: "+result.status+
    ". Allocation is not cash received or money paid.");
   if(result.budgetRef)await open(result.budgetRef);
   else if(selected)await open(selected.budgetRef);
   void list();
  }catch(e){setError(e instanceof Error?e.message:"The original budget command is unconfirmed.");}
  finally{setBusy(false);}
 }
 async function verify(){
  if(!pending||busy)return;
  setBusy(true);setError("");
  try{
   const r=await fetch("/api/finance/budgets/commands/"+pending.key,{cache:"no-store"});
   if(!r.ok)throw Error(await failure(r));
   const data=await r.json() as {confirmed:boolean;status:string};
   if(data.confirmed){setNotice("Original budget request confirmed: "+data.status);setPending(null);
    if(selected)void open(selected.budgetRef);void list();}
   else setError("The previous request is not confirmed. Retry the exact same request only.");
  }catch(e){setError(e instanceof Error?e.message:"Cannot verify the original request.");}
  finally{setBusy(false);}
 }
 function save(){
  if(form.projectRef&&!projects.some(p=>p.value===form.projectRef&&(p.branchRef??"")===form.branchRef)){setError("Choose a currently available project or remove the optional project association.");return;}
  void execute(selected&&["DRAFT","RETURNED"].includes(selected.status)?
   "drafts/"+selected.budgetRef:"drafts",selected&&["DRAFT","RETURNED"].includes(selected.status)?"PATCH":"POST",{
   ...form,branchRef:form.branchRef||null,
   ...(selected&&["DRAFT","RETURNED"].includes(selected.status)?{expectedVersion:selected.version}:{})});
 }
 function update(key:keyof Form,value:string){setForm(v=>({...v,[key]:value}));setNotice("");}
 const meter=selected?Math.max(0,Number(selected.ceilingMinor)):1;
 return <section className="cg-fin-manual">
  <div className="cg-fin-toolbar"><div><h1>Budgets & Fund Allocation</h1>
   <p>Original approved ceilings and source-backed commitments. A budget is not cash received.</p></div>
   <button type="button" onClick={()=>void list()}>Refresh</button></div>
  {error&&<p role="alert" className="cg-fin-notice">{error}</p>}
  {notice&&<p role="status" className="cg-fin-notice">{notice}</p>}
  {pending&&<div className="cg-fin-card"><p>A financial command is unconfirmed. Check it before retrying.</p>
   <button type="button" disabled={busy} onClick={()=>void verify()}>Check original budget request</button></div>}
  {overview&&<div className="cg-fin-voucher-dashboard">
   <div className="cg-fin-voucher-tiles">
    {[
     ["All budgets",String(overview.cards.total)],
     ["Awaiting protected approval",String(overview.cards.submitted)],
     ["Approved",String(overview.cards.approved)],
     ["Rejected / Returned",String(overview.cards.rejected+overview.cards.returned)],
     ["Approved ceilings",currency(overview.cards.totalCeilingMinor)],
     ["Allocated earmarks",currency(overview.cards.allocatedMinor)],
     ["Outstanding commitments",currency(overview.cards.committedOutstandingMinor)],
     ["Utilized from posted expenses",currency(overview.cards.utilizedMinor)],
     ["Available funds authorization",currency(overview.cards.availableMinor)],
     ["Over-budget",currency(overview.cards.overBudgetMinor)]
    ].map(([k,v])=><article key={k} className="cg-fin-voucher-tile">
      <div><p className="cg-fin-tile-label">{k}</p><strong>{v}</strong></div>
    </article>)}
   </div>
   <p className="cg-fin-help">{overview.explanation}</p>
  </div>}
  <div className="cg-fin-voucher-tiles">
   {(selected?[
    ["Approved ceiling",selected.ceilingMinor],["Allocated (earmarked)",selected.allocatedMinor],
    ["Committed outstanding",selected.committedOutstandingMinor],["Utilized from posted expenses",selected.utilizedMinor],
    ["Available",selected.availableMinor],["Over-budget",selected.overBudgetMinor]
   ]:[]).map(([title,value])=><article className="cg-fin-voucher-tile" key={title}>
    <div><p>{title}</p><strong>{currency(value)}</strong></div></article>)}
  </div>
  <div className="cg-fin-table-wrap"><h3>Original budgets</h3>
   <table className="cg-fin-table"><thead><tr><th>Budget</th><th>Category</th>
    <th>Period</th><th>Ceiling</th><th>Status</th><th>Action</th></tr></thead><tbody>
    {budgets.map(b=><tr key={b.budgetRef}><td>{b.budgetNumber} · {b.name}</td>
     <td>{categories.find(c=>c.code===b.category)?.name??b.category}</td><td>{b.periodStart} to {b.periodEnd}</td>
     <td>{currency(b.ceilingMinor)}</td><td>{b.status}</td>
     <td><button type="button" onClick={()=>void open(b.budgetRef)}>Open</button></td></tr>)}
   </tbody></table>
   {!budgets.length&&<p className="cg-fin-empty">No Foundation budgets recorded.</p>}
   <div className="cg-fin-paging">
    <button disabled={offset===0} type="button" onClick={()=>setOffset(v=>Math.max(0,v-40))}>Previous</button>
    <button disabled={next===null} type="button" onClick={()=>setOffset(next??0)}>Next</button>
   </div>
  </div>
  {canManage&&<section className="cg-fin-card">
   <div className="cg-fin-toolbar"><h3>{selected?selected.budgetNumber:"Create Budget"}</h3>
    <button type="button" disabled={busy||Boolean(pending)}
     onClick={()=>{setSelected(null);setForm(clean());setStage(0);setError("");}}>
     New budget</button></div>
   <div className="cg-fin-toolbar-actions">
    {["Budget Information","Fund Allocation","Notes","Review & Submit"].map((name,i)=>
     <button type="button" key={name} aria-current={stage===i?"step":undefined}
      onClick={()=>setStage(i)}>{i+1}. {name}</button>)}
   </div>
   {(!selected||["DRAFT","RETURNED"].includes(selected.status))&&<>
    {stage===0&&<div className="cg-fin-form">
     <label className="cg-fin-field">Budget name
      <input maxLength={160} value={form.budgetName} onChange={e=>update("budgetName",e.target.value)}/></label>
     <label className="cg-fin-field">Financial year
      <select value={form.financialYearRef} onChange={e=>update("financialYearRef",e.target.value)}>
       <option value="">Select open financial year</option>
       {years.filter(y=>y.status==="OPEN").map(y=><option key={y.yearRef} value={y.yearRef}>{y.name}</option>)}
      </select></label>
     <label className="cg-fin-field">Branch
      <select value={form.branchRef} onChange={e=>{
       const b=branches.find(v=>v.branchRef===e.target.value);
       setForm(v=>({...v,branchRef:b?.branchRef??"",branchVersion:b?.version??null,projectRef:""}));}}>
       <option value="">Foundation root — no branch</option>
       {branches.map(b=><option key={b.branchRef} value={b.branchRef}>{b.name}</option>)}
      </select></label>
     <label className="cg-fin-field">Project (optional)<select value={form.projectRef} onChange={e=>update("projectRef",e.target.value)}><option value="">No project — general budget</option>{projects.filter(p=>(p.branchRef??"")===form.branchRef).map(p=><option key={p.value} value={p.value}>{p.label}</option>)}{form.projectRef&&!projects.some(p=>p.value===form.projectRef&&(p.branchRef??"")===form.branchRef)&&<option value={form.projectRef} disabled>Previous project unavailable — choose again</option>}</select></label>
     <label className="cg-fin-field">Expense account group
      <select value={form.category} onChange={e=>update("category",e.target.value)}>
       <option value="">Select an existing expense group</option>
       {categories.map(c=><option key={c.code} value={c.code}>{c.name} ({c.code})</option>)}
      </select></label>
     {(["periodStart","periodEnd"] as const).map(k=><label className="cg-fin-field" key={k}>
      {k==="periodStart"?"Period begins":"Period ends"}
      <input type="date" value={form[k]} onChange={e=>update(k,e.target.value)}/></label>)}
    </div>}
    {stage===1&&<div className="cg-fin-form">
     <label className="cg-fin-field">Approved budget ceiling in rupees
      <input inputMode="decimal" value={form.ceiling} onChange={e=>update("ceiling",e.target.value)}/></label>
     <p className="cg-fin-help">Ceiling is the requested authorization amount.
      Allocated, committed and utilized amounts are recorded separately only after protected approval.</p>
     <div className="cg-fin-toolbar"><h4>Original CG09 itemized budget</h4>
      <button type="button" disabled={form.items.length>=30}
       onClick={()=>setForm(v=>({...v,items:[...v.items,{description:"",quantity:"1",unitRate:""}]}))}>Add budget line</button>
     </div>
     {form.items.map((line,i)=><div key={i} className="cg-fin-form">
      <label className="cg-fin-field">Item description
       <input maxLength={200} value={line.description}
        onChange={e=>setForm(v=>({...v,items:v.items.map((x,j)=>
         j===i?{...x,description:e.target.value}:x)}))}/></label>
      <label className="cg-fin-field">Quantity (up to 3 decimals)
       <input inputMode="decimal" value={line.quantity}
        onChange={e=>setForm(v=>({...v,items:v.items.map((x,j)=>
         j===i?{...x,quantity:e.target.value}:x)}))}/></label>
      <label className="cg-fin-field">Unit rate in INR
       <input inputMode="decimal" value={line.unitRate}
        onChange={e=>setForm(v=>({...v,items:v.items.map((x,j)=>
         j===i?{...x,unitRate:e.target.value}:x)}))}/></label>
      <button type="button" onClick={()=>setForm(v=>({...v,
       items:v.items.filter((_,j)=>j!==i)}))}>Remove line</button>
     </div>)}
     <p className="cg-fin-help">When itemized, the sum of quantity × unit rate
      must equal the approved ceiling. Unrecorded quantities are never inferred.</p>
    </div>}
    {stage===2&&<div className="cg-fin-form">
     <label className="cg-fin-field">Funding note (not proof of received cash)
      <textarea maxLength={250} value={form.fundingNote}
       onChange={e=>update("fundingNote",e.target.value)}/></label>
     <p>Project and donor funding options appear only when their original source modules exist.</p>
    </div>}
    {stage===3&&<div><p>{form.budgetName} · {categories.find(c=>c.code===form.category)?.name??form.category} · {form.periodStart} to {form.periodEnd}</p>
     <p>Requested ceiling: {form.ceiling} rupees</p>
     <button className="primary" type="button" disabled={busy||Boolean(pending)}
      onClick={save}>Save original budget draft</button>
     {selected?.status==="DRAFT"&&<button type="button" disabled={busy||Boolean(pending)}
      onClick={()=>void execute(selected.budgetRef+"/submit","POST",
       {expectedVersion:selected.version})}>Submit for protected budget approval</button>}
    </div>}
   </>}
   {selected?.status==="SUBMITTED"&&<button type="button" disabled={busy||Boolean(pending)}
    onClick={()=>void execute(selected.budgetRef+"/reconcile","POST",{})}>
    Confirm original protected reviewer outcome</button>}
   {selected?.status==="APPROVED"&&<div className="cg-fin-form">
    <h4>Actual budget movements</h4>
    <label className="cg-fin-field">Movement type
     <select value={eventKind} onChange={e=>setEventKind(e.target.value)}>
      <option value="ALLOCATE">Allocate / earmark amount</option>
      <option value="COMMIT">Record outstanding commitment</option>
      <option value="RELEASE">Release existing commitment</option>
      <option value="UTILIZE">Utilize a posted original expense</option>
     </select></label>
    <label className="cg-fin-field">Amount in rupees
     <input inputMode="decimal" value={eventAmount}
      onChange={e=>setEventAmount(e.target.value)}/></label>
    {eventKind==="UTILIZE"&&<label className="cg-fin-field">
     Real original posted expense voucher
     <select value={expenseRef} onChange={e=>{
      setExpenseRef(e.target.value);
      const line=expenses.find(x=>x.journalRef===e.target.value);
      if(line)setEventAmount(rupees(line.amountMinor));
     }}>
      <option value="">Select one matching posted expense</option>
      {expenses.map(e=><option key={e.journalRef} value={e.journalRef}>
       {e.voucherNumber} · {e.postedDate} · {currency(e.amountMinor)}</option>)}
     </select></label>}
    <button className="primary" type="button" disabled={busy||Boolean(pending)||
      !eventAmount||(eventKind==="UTILIZE"&&!expenseRef)}
     onClick={()=>void execute(selected.budgetRef+"/events","POST",{
      kind:eventKind,amount:eventAmount,
      ...(eventKind==="UTILIZE"?{journalRef:expenseRef}:{})})}>
     Confirm original budget movement</button>
    <p className="cg-fin-help">Utilization requires an actual posted and matching expense voucher.
     Approval and commitments do not transfer bank funds.</p>
   </div>}
   {selected?.status==="APPROVED"&&<div className="cg-fin-toolbar-actions">
    <button type="button" disabled={busy||Boolean(pending)}
     onClick={()=>void execute(selected.budgetRef+"/archive","POST",
      {expectedVersion:selected.version})}>Archive approved budget (retain history)</button>
   </div>}
   {selected&&<div className="cg-fin-table-wrap"><h4>Original Finance budget items</h4>
    {selected.items?.length?<table className="cg-fin-table">
     <thead><tr><th>Description</th><th>Quantity</th><th>Unit rate</th><th>Amount</th></tr></thead>
     <tbody>{selected.items.map((line,i)=><tr key={i}><td>{line.description}</td>
      <td>{(BigInt(line.quantityMilli)/1000n).toString()+
       "."+String(BigInt(line.quantityMilli)%1000n).padStart(3,"0")}</td>
      <td>{currency(line.unitRateMinor)}</td><td>{currency(line.totalMinor)}</td></tr>)}</tbody></table>:
     <p>No item breakdown is recorded in this original approved budget.</p>}
   </div>}
   {selected&&<div className="cg-fin-table-wrap"><h4>Immutable budget history</h4>
    <table className="cg-fin-table"><thead><tr><th>Date</th><th>Event</th><th>Amount</th></tr></thead>
     <tbody>{selected.events.map((e,i)=><tr key={i}><td>{e.recordedAt.slice(0,10)}</td>
      <td>{e.kind}</td><td>{currency(e.amountMinor)}</td></tr>)}</tbody></table></div>}
  </section>}
 </section>;
}
