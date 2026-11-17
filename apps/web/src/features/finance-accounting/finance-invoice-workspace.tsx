"use client";
import {useCallback,useEffect,useState} from "react";
import {FinanceInvoiceReceiptTools} from "./finance-invoice-receipt-tools";
import {FinanceInvoiceAdjustmentTools} from "./finance-invoice-adjustment-tools";
type Stage="INFO"|"ITEMS"|"PAYMENT"|"REVIEW";
type Invoice={invoiceRef:string;invoiceNumber:string;status:string;version:number;
 counterpartyName:string|null;totalMinor:string|null;invoiceDate:string|null};
type Account={accountRef:string;name:string;code:string;category:string;branchName:string|null};
type Dashboard={cards:{total:number;drafts:number;pending:number;approved:number;
 issued:number;rejected:number;returned:number;paidVerified:number;partiallyPaid:number;
 faceValueMinor:string;issuedMinor:string;receivedVerifiedMinor:string};
 monthly:{month:string;count:number;issuedMinor:string}[];explanation:string};
type Year={yearRef:string;name:string;status:string};
type Branch={branchRef:string;name:string;version:number};
type CorrectedInvoice={invoiceRef:string;invoiceNumber:string;counterpartyName:string;branchRef:string|null};
type Detail={invoiceRef:string;invoiceNumber:string;version:number;status:string;
 draft:{info?:Record<string,unknown>;items?:Record<string,unknown>;payment?:Record<string,unknown>}};
type Form={financialYearRef:string;branchRef:string;branchVersion:number|null;
 invoiceDate:string;dueDate:string;category:string;purpose:string;
 counterpartyName:string;counterpartyAddress:string;replacesInvoiceRef:string;
 rows:{description:string;quantity:number;unitRate:string}[];
 tax:string;charges:string;receivableAccountRef:string;incomeAccountRef:string;
 taxAccountRef:string;terms:string;notes:string};
const empty=():Form=>({financialYearRef:"",branchRef:"",branchVersion:null,
 invoiceDate:"",dueDate:"",category:"",purpose:"",counterpartyName:"",counterpartyAddress:"",
 replacesInvoiceRef:"",
 rows:[{description:"",quantity:1,unitRate:"0.00"}],tax:"0.00",charges:"0.00",
 receivableAccountRef:"",incomeAccountRef:"",taxAccountRef:"",terms:"Payment due per invoice",notes:""});
type Active={ref:string;number:string;version:number;status:string};
function errorMessage(e:unknown){return e instanceof Error?e.message:"The original invoice request could not be confirmed.";}
async function errorFor(r:Response){
 const v:unknown=await r.json().catch(()=>null);
 if(v&&typeof v==="object"&&!Array.isArray(v)&&"message" in v&&
  typeof v.message==="string"&&v.message.length<301)return v.message;
 return r.status===409?"This invoice changed. Refresh before saving.":
  r.status===403?"Your current role does not allow this invoice action.":
  "This invoice action could not be confirmed. Check its original request state.";
}
const format=(v:string|null)=>{if(!v)return "Not calculated";
 try{const n=BigInt(v);return "₹"+(n/100n).toLocaleString("en-IN")+"."+
  (n%100n).toString().padStart(2,"0");}catch{return "Not calculated";}};
export function FinanceInvoiceWorkspace({canManage,canIssue,canPost,canCancel}:{
 canManage:boolean;canIssue:boolean;canPost:boolean;canCancel:boolean}){
 const [rows,setRows]=useState<Invoice[]>([]);
 const [dashboard,setDashboard]=useState<Dashboard|null>(null);
 const [filter,setFilter]=useState("ALL");
 const [refreshVersion,setRefreshVersion]=useState(0);
 const [years,setYears]=useState<Year[]>([]);
 const [branches,setBranches]=useState<Branch[]>([]);
 const [allowFoundation,setAllowFoundation]=useState(false);
 const [correctedInvoices,setCorrectedInvoices]=useState<CorrectedInvoice[]>([]);
 const [accounts,setAccounts]=useState<Account[]>([]);
 const [active,setActive]=useState<Active|null>(null);
 const [stage,setStage]=useState<Stage>("INFO");
 const [form,setForm]=useState<Form>(empty());
 const [notice,setNotice]=useState("");
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 const [offset,setOffset]=useState(0);
 const [nextOffset,setNextOffset]=useState<number|null>(null);
 const [pending,setPending]=useState<{key:string;url:string;method:string;body:unknown}|null>(null);
 const [protectedEligible,setProtectedEligible]=useState(false);
 const canCancelPosted=canCancel&&protectedEligible;
 useEffect(()=>{
  if(!canCancel){setProtectedEligible(false);return;}
  let live=true;
  void (async()=>{
   try{
    const r=await fetch("/api/finance/invoices/cancel-eligibility",{cache:"no-store"});
    if(!r.ok)throw Error("Eligibility unavailable");
    const result=await r.json() as {canCancel?:boolean};
    if(live)setProtectedEligible(result.canCancel===true);
   }catch{if(live)setProtectedEligible(false);}
  })();
  return()=>{live=false;};
 },[canCancel]);
 const [cancelOpen,setCancelOpen]=useState(false);
 const [cancelYear,setCancelYear]=useState("");
 const [cancelDate,setCancelDate]=useState("");
 const [cancelReason,setCancelReason]=useState("");
 const [cancelPassword,setCancelPassword]=useState("");
 const [cancelPending,setCancelPending]=useState<{
  invoiceRef:string;key:string;body:Record<string,unknown>}|null>(null);
 const load=useCallback(async()=>{
  setError("");
  setRefreshVersion(n=>n+1);
  try{
   const req=await fetch("/api/finance/invoices/drafts?offset="+offset+
    "&status="+filter,{cache:"no-store"});
   if(!req.ok)throw Error(await errorFor(req));
   const value=await req.json() as {invoices?:Invoice[];nextOffset?:number|null};
   if(!Array.isArray(value.invoices))throw Error("Original invoices could not be verified.");
   setRows(value.invoices);setNextOffset(value.nextOffset??null);
  }catch(e){setError(errorMessage(e));setRows([]);}
 },[offset,filter]);
 useEffect(()=>{void load();},[load]);
 useEffect(()=>{
  let live=true;
  void (async()=>{
   try{
    const [op,ac]=await Promise.all([fetch("/api/finance/invoices/options",{cache:"no-store"}),
      fetch("/api/finance/invoices/posting-accounts",{cache:"no-store"})]);
    if(!op.ok||!ac.ok)throw Error(await errorFor(!op.ok?op:ac));
    const o=await op.json() as {years?:Year[];branches?:Branch[];allBranches?:boolean;correctedInvoices?:CorrectedInvoice[]};
    const a=await ac.json() as {accounts?:Account[]};
    if(!Array.isArray(o.years)||!Array.isArray(o.branches)||!Array.isArray(a.accounts))
     throw Error("Current account/branch choices are unavailable.");
    if(live){setYears(o.years);setBranches(o.branches);setAccounts(a.accounts);
     setAllowFoundation(o.allBranches===true);
     setCorrectedInvoices(o.correctedInvoices??[]);}
   }catch(e){if(live)setError(errorMessage(e));}
  })();return()=>{live=false;};
 },[]);
 useEffect(()=>{
  let live=true;
  void(async()=>{
   try{
    const r=await fetch("/api/finance/invoices/dashboard",{cache:"no-store"});
    if(!r.ok)throw Error(await errorFor(r));
    const data=await r.json() as Dashboard;
    if(!data?.cards||!Array.isArray(data.monthly))throw Error("Invoice totals are unavailable.");
    if(live)setDashboard(data);
   }catch(e){if(live)setNotice(errorMessage(e));}
  })();return()=>{live=false;};
 },[refreshVersion]);
 async function openInvoice(row:Invoice){
  setBusy(true);setError("");setNotice("");
  try{
   const res=await fetch("/api/finance/invoices/drafts/"+row.invoiceRef,{cache:"no-store"});
   if(!res.ok)throw Error(await errorFor(res));
   const detail=await res.json() as Detail;
   setActive({ref:row.invoiceRef,number:row.invoiceNumber,version:detail.version,status:detail.status});
   const i=detail.draft?.info??{},j=detail.draft?.items??{},p=detail.draft?.payment??{};
   setForm(v=>({...v,
    financialYearRef:String(i.financialYearRef??""),branchRef:String(i.branchRef??""),
    branchVersion:typeof i.branchVersion==="number"?i.branchVersion:null,
    invoiceDate:String(i.invoiceDate??""),dueDate:String(i.dueDate??""),
    category:String(i.category??""),purpose:String(i.purpose??""),
    counterpartyName:String(i.counterpartyName??""),
    counterpartyAddress:String(i.counterpartyAddress??""),
    replacesInvoiceRef:String(i.replacesInvoiceRef??""),
    rows:Array.isArray(j.rows)?j.rows.map((r:Record<string,unknown>)=>({
     description:String(r.description??""),quantity:Number(r.quantity??1),
     unitRate:typeof r.unitRateMinor==="string"?(BigInt(r.unitRateMinor)/100n).toString()+
      "."+(BigInt(r.unitRateMinor)%100n).toString().padStart(2,"0"):"0.00"})):v.rows,
    tax:typeof j.taxMinor==="string"?format(j.taxMinor).replace(/^₹/,"").replaceAll(",",""):v.tax,
    charges:typeof j.chargesMinor==="string"?format(j.chargesMinor).replace(/^₹/,"").replaceAll(",",""):v.charges,
    receivableAccountRef:String(p.receivableAccountRef??""),
    incomeAccountRef:String(p.incomeAccountRef??""),
    taxAccountRef:String(p.taxAccountRef??""),
    terms:String(p.terms??v.terms),notes:String(p.notes??"")
   }));
   setPending(null);setStage("INFO");
  }catch(e){setError(errorMessage(e));}
  finally{setBusy(false);}
 }
 function payload():unknown{
  if(stage==="INFO")return {
   financialYearRef:form.financialYearRef,branchRef:form.branchRef||null,
   branchVersion:form.branchRef?form.branchVersion:null,invoiceDate:form.invoiceDate,
   dueDate:form.dueDate,category:form.category,purpose:form.purpose,
   counterpartyName:form.counterpartyName,counterpartyAddress:form.counterpartyAddress||null,
   replacesInvoiceRef:form.replacesInvoiceRef||null};
  if(stage==="ITEMS")return {rows:form.rows,tax:form.tax,charges:form.charges};
  return {receivableAccountRef:form.receivableAccountRef,
   incomeAccountRef:form.incomeAccountRef,taxAccountRef:form.taxAccountRef||null,
   terms:form.terms,notes:form.notes||null};
 }
 async function command(url:string,method:"POST"|"PATCH",body:Record<string,unknown>,
   action:"SAVE"|"WORKFLOW"){
  if(busy||pending)return;
  const key=crypto.randomUUID();
  const data={...body,requestKey:key};
  setPending({key,url,method,body:data});setBusy(true);setError("");setNotice("");
  try{
   const res=await fetch(url,{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
   if(!res.ok)throw Error(await errorFor(res));
   const result=await res.json() as {confirmed?:boolean;status?:string;
    invoiceRef?:string;invoiceNumber?:string;version?:number};
   if(!result.confirmed)throw Error("The original invoice command remains unconfirmed.");
   setPending(null);setNotice("Original invoice status: "+result.status+". Approval, posting and payment are separate.");
   if(action==="SAVE"&&result.invoiceRef&&result.invoiceNumber&&result.version)
    setActive({ref:result.invoiceRef,number:result.invoiceNumber,version:result.version,status:result.status??"DRAFT"});
   else if(active)setActive({...active,status:result.status??active.status});
   void load();
  }catch(e){setError(errorMessage(e));}
  finally{setBusy(false);}
 }
 async function checkPending(){
  if(!pending||busy)return;
  setBusy(true);setError("");
  try{
   const base=pending.url.includes("/drafts")?"draft-commands":"workflow-commands";
   const res=await fetch("/api/finance/invoices/"+base+"/"+pending.key,{cache:"no-store"});
   if(!res.ok)throw Error(await errorFor(res));
   const result=await res.json() as {confirmed?:boolean;status?:string};
   if(result.confirmed){setPending(null);setNotice("Original operation confirmed: "+result.status);void load();}
   else setError("The previous operation remains unconfirmed. Retry only its original request.");
  }catch(e){setError(errorMessage(e));}
  finally{setBusy(false);}
 }
 function saveStage(){
  if(stage==="REVIEW")return;
  const ref=active?.ref;
  void command(ref?"/api/finance/invoices/drafts/"+ref+"/stages":
   "/api/finance/invoices/drafts",ref?"PATCH":"POST",{
   stage,data:payload(),...(ref?{expectedVersion:active?.version}:{})
  },"SAVE");
 }
 async function cancelPosted(command:{invoiceRef:string;key:string;body:Record<string,unknown>}){
  if(busy)return;
  setBusy(true);setError("");setNotice("");setCancelPending(command);
  try{
   const r=await fetch("/api/finance/invoices/"+command.invoiceRef+"/cancel-posted",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({...command.body,requestKey:command.key})});
   if(!r.ok)throw Error(await errorFor(r));
   const data=await r.json() as {confirmed?:boolean;status?:string};
   if(!data.confirmed||data.status!=="REVERSED")
    throw Error("The original invoice cancellation could not be confirmed.");
   setCancelPending(null);setCancelOpen(false);setCancelPassword("");
   setActive(old=>old&&old.ref===command.invoiceRef?{...old,status:"REVERSED"}:old);
   setNotice("Posted but unissued invoice corrected by one immutable linked reversal.");
   void load();
  }catch(e){setError(errorMessage(e));}
  finally{setBusy(false);}
 }
 async function checkCancellation(){
  if(!cancelPending||busy)return;
  setBusy(true);setError("");
  try{
   const r=await fetch("/api/finance/invoices/cancel-commands/"+cancelPending.key,
    {cache:"no-store"});
   if(!r.ok)throw Error(await errorFor(r));
   const status=await r.json() as {confirmed?:boolean;status?:string};
   if(status.confirmed&&status.status==="REVERSED"){
    setCancelPending(null);setCancelOpen(false);setCancelPassword("");
    setActive(old=>old&&old.ref===cancelPending.invoiceRef?{...old,status:"REVERSED"}:old);
    setNotice("Original invoice offset was confirmed.");void load();
   }else setNotice("No completed original cancellation found. Retry its same request only.");
  }catch(e){setError(errorMessage(e));}
  finally{setBusy(false);}
 }
 function workflow(name:"submit"|"reconcile"|"post"|"issue"){
  if(!active)return;
  void command("/api/finance/invoices/"+active.ref+"/"+name,"POST",
   name==="submit"?{expectedVersion:active.version}:
   {},"WORKFLOW");
 }
 return <section className="cg-fin-manual">
  <div className="cg-fin-toolbar"><div><h2>Invoices & Receipts</h2>
   <p>Original Foundation financial invoices. Approved, posted, issued and paid are different states.</p>
  </div><button type="button" disabled={busy} onClick={()=>void load()}>Refresh</button></div>
  {notice&&<p role="status" className="cg-fin-notice">{notice}</p>}
  {error&&<p role="alert" className="cg-fin-notice">{error}</p>}
  {pending&&<div className="cg-fin-card"><p>The previous invoice operation is unconfirmed.
   Check the original request before submitting another financial action.</p>
   <button type="button" disabled={busy} onClick={()=>void checkPending()}>Check existing request</button>
  </div>}
  {dashboard&&<div className="cg-fin-voucher-dashboard">
   <div className="cg-fin-voucher-tiles">
    {[
      {title:"Total invoices",value:String(dashboard.cards.total)},
      {title:"Drafts",value:String(dashboard.cards.drafts)},
      {title:"Pending verification",value:String(dashboard.cards.pending)},
      {title:"Approved / posted",value:String(dashboard.cards.approved)},
      {title:"Issued",value:String(dashboard.cards.issued)},
      {title:"Rejected / returned",value:String(dashboard.cards.rejected+dashboard.cards.returned)},
      {title:"Fully paid (bank verified)",value:String(dashboard.cards.paidVerified)},
      {title:"Partially paid (bank verified)",value:String(dashboard.cards.partiallyPaid)},
      {title:"Issued face value",value:format(dashboard.cards.issuedMinor)},
      {title:"Verified bank collection",value:format(dashboard.cards.receivedVerifiedMinor)}
    ].map(x=><div className="cg-fin-voucher-tile" key={x.title}>
     <div><p className="cg-fin-tile-label">{x.title}</p><strong>{x.value}</strong></div>
    </div>)}
   </div>
   <div className="cg-fin-voucher-charts">
    <article className="cg-fin-voucher-chart"><h4>Monthly invoice trend</h4>
      <div className="cg-fin-month-bars" role="img" aria-label="Actual monthly invoice count">
       {dashboard.monthly.map(m=><div key={m.month} className="cg-fin-month">
        <span style={{height:Math.max(4,100*m.count/
          Math.max(1,...dashboard.monthly.map(v=>v.count)))+"%"}}
         title={m.month+": "+m.count+" invoices"}/>
        <small>{m.month.slice(5)}</small>
       </div>)}
      </div>
    </article>
   </div>
   <p className="cg-fin-help">{dashboard.explanation}</p>
  </div>}
  {canManage&&<section className="cg-fin-card">
   <div className="cg-fin-toolbar"><h3>{active?active.number:"Create invoice"}</h3>
    <button type="button" disabled={busy||Boolean(pending)} onClick={()=>{
     setActive(null);setForm(empty());setStage("INFO");setNotice("");setError("");}}>
     New invoice</button></div>
   <div className="cg-fin-toolbar-actions">
    {(["INFO","ITEMS","PAYMENT","REVIEW"] as Stage[]).map((s,i)=><button key={s}
     type="button" aria-current={s===stage?"step":undefined} onClick={()=>setStage(s)}>
     {i+1}. {s==="INFO"?"Invoice Information":s==="ITEMS"?"Items & Amount":s==="PAYMENT"?"Payment & Tax":"Review & Submit"}</button>)}
   </div>
   <div className="cg-fin-form">
    {stage==="INFO"&&<>
     <label className="cg-fin-field">Financial year<select value={form.financialYearRef}
      onChange={e=>setForm(v=>({...v,financialYearRef:e.target.value}))}>
      <option value="">Select current year</option>
      {years.filter(y=>y.status==="OPEN").map(y=><option key={y.yearRef} value={y.yearRef}>{y.name}</option>)}
     </select></label>
     <label className="cg-fin-field">Branch<select value={form.branchRef}
      onChange={e=>{const branch=branches.find(b=>b.branchRef===e.target.value);
       setForm(v=>({...v,branchRef:branch?.branchRef??"",branchVersion:branch?.version??null,
        replacesInvoiceRef:""}));}}>
      {allowFoundation?<option value="">Foundation (no branch)</option>:
       <option value="">Select assigned branch</option>}
      {branches.map(b=><option key={b.branchRef} value={b.branchRef}>{b.name}</option>)}
     </select></label>
     {(Boolean(form.replacesInvoiceRef)||correctedInvoices.some(v=>v.branchRef===(form.branchRef||null)))&&
      <label className="cg-fin-field">Replaces credited invoice (optional)
       <select value={form.replacesInvoiceRef} onChange={e=>
        setForm(v=>({...v,replacesInvoiceRef:e.target.value}))}>
        <option value="">New invoice — not a correction</option>
        {form.replacesInvoiceRef&&!correctedInvoices.some(v=>v.invoiceRef===form.replacesInvoiceRef)&&
         <option value={form.replacesInvoiceRef}>Previously linked corrected invoice</option>}
        {correctedInvoices.filter(v=>v.branchRef===(form.branchRef||null))
         .map(v=><option key={v.invoiceRef} value={v.invoiceRef}>
          {v.invoiceNumber} · {v.counterpartyName}</option>)}
       </select></label>}
     {([["invoiceDate","Invoice date"],["dueDate","Due date"]] as const)
      .map(([field,label])=><label className="cg-fin-field" key={field}>{label}
       <input type="date" value={form[field]}
        onChange={e=>setForm(v=>({...v,[field]:e.target.value}))}/></label>)}
     {([["category","Invoice category"],["purpose","Purpose"],["counterpartyName","Customer / organization"],["counterpartyAddress","Address (optional)"]] as const)
      .map(([field,label])=><label className="cg-fin-field" key={field}>{label}
       <input maxLength={field==="purpose"?500:field==="counterpartyAddress"?250:150}
        value={form[field]} onChange={e=>setForm(v=>({...v,[field]:e.target.value}))}/></label>)}
    </>}
    {stage==="ITEMS"&&<>
     {form.rows.map((line,i)=><div key={i} className="cg-fin-card">
      <label className="cg-fin-field">Item description
       <input maxLength={180} value={line.description} onChange={e=>setForm(v=>({
        ...v,rows:v.rows.map((r,j)=>j===i?{...r,description:e.target.value}:r)}))}/></label>
      <label className="cg-fin-field">Quantity
       <input type="number" min={1} max={1000000} value={line.quantity}
        onChange={e=>setForm(v=>({...v,rows:v.rows.map((r,j)=>j===i?
         {...r,quantity:Number(e.target.value)}:r)}))}/></label>
      <label className="cg-fin-field">Final unit rate after discount (₹)
       <input inputMode="decimal" value={line.unitRate} onChange={e=>setForm(v=>({
        ...v,rows:v.rows.map((r,j)=>j===i?{...r,unitRate:e.target.value}:r)}))}/></label>
      <button type="button" disabled={form.rows.length===1}
       onClick={()=>setForm(v=>({...v,rows:v.rows.filter((_,j)=>i!==j)}))}>Remove item</button>
     </div>)}
     <button type="button" disabled={form.rows.length>=40} onClick={()=>
      setForm(v=>({...v,rows:[...v.rows,{description:"",quantity:1,unitRate:"0.00"}]}))}>
      Add item</button>
     {(["tax","charges"] as const).map(k=><label className="cg-fin-field" key={k}>
      {k==="tax"?"Tax in rupees":"Other charges in rupees"}
      <input inputMode="decimal" value={form[k]}
       onChange={e=>setForm(v=>({...v,[k]:e.target.value}))}/></label>)}
    </>}
    {stage==="PAYMENT"&&<>
     {(["receivableAccountRef","incomeAccountRef","taxAccountRef"] as const).map(key=>{
      const category=key==="receivableAccountRef"?"ASSET":
       key==="incomeAccountRef"?"INCOME":"LIABILITY";
      return <label className="cg-fin-field" key={key}>
       {key==="receivableAccountRef"?"Receivable account":
        key==="incomeAccountRef"?"Income account":"Tax liability account (only if tax)"}
       <select value={form[key]} onChange={e=>setForm(v=>({...v,[key]:e.target.value}))}>
        <option value="">{key==="taxAccountRef"?"No separate tax liability":"Select active account"}</option>
        {accounts.filter(a=>a.category===category).map(a=>
         <option key={a.accountRef} value={a.accountRef}>{a.code} · {a.name}</option>)}
       </select></label>;
     })}
     <label className="cg-fin-field">Payment terms
      <textarea value={form.terms} maxLength={300}
       onChange={e=>setForm(v=>({...v,terms:e.target.value}))}/></label>
     <label className="cg-fin-field">Notes
      <textarea value={form.notes} maxLength={500}
       onChange={e=>setForm(v=>({...v,notes:e.target.value}))}/></label>
    </>}
    {stage==="REVIEW"&&<div className="cg-fin-card">
     <h4>Review original invoice draft before submission</h4>
     <p><strong>Customer / organization:</strong> {form.counterpartyName||"Not entered"}</p>
     <p><strong>Category / purpose:</strong> {form.category||"Not entered"} · {form.purpose||"Not entered"}</p>
     <p><strong>Invoice date / due:</strong> {form.invoiceDate||"Not entered"} · {form.dueDate||"Not entered"}</p>
     <p><strong>Item lines:</strong> {form.rows.length}. Enter the final agreed unit rate (including any discount). Tax and totals are recalculated and frozen by Finance.</p>
     <p><strong>Payment terms:</strong> {form.terms||"Not entered"}</p>
     <p className="cg-fin-help">Save the Information, Items and Payment stages first.
      Submission creates an immutable review case; approval, journal posting, PDF issuance and received payment remain separate.</p>
    </div>}
    {stage!=="REVIEW"&&(!active||["DRAFT","RETURNED"].includes(active.status))&&<button className="primary" disabled={busy||Boolean(pending)}
     type="button" onClick={saveStage}>Save original draft or corrected revision</button>}
   </div>
   <div className="cg-fin-toolbar-actions">
    {active?.status==="DRAFT"&&stage==="REVIEW"&&<button className="primary" disabled={busy||Boolean(pending)}
      type="button" onClick={()=>workflow("submit")}>Review & Submit</button>}
    {active?.status==="SUBMITTED"&&<button type="button" disabled={busy||Boolean(pending)}
      onClick={()=>workflow("reconcile")}>Check original protected reviewer decision</button>}
    {active?.status==="APPROVED"&&canPost&&<button className="primary" type="button"
      disabled={busy||Boolean(pending)} onClick={()=>workflow("post")}>Post balanced invoice accrual</button>}
    {active?.status==="POSTED"&&canIssue&&<button className="primary" type="button"
      disabled={busy||Boolean(pending)||Boolean(cancelPending)} onClick={()=>workflow("issue")}>Issue protected PDF</button>}
    {active?.status==="POSTED"&&canCancelPosted&&<button type="button"
      disabled={busy||Boolean(pending)||Boolean(cancelPending)}
      onClick={()=>{setCancelOpen(true);setCancelYear("");setCancelDate("");
       setCancelReason("");setCancelPassword("");}}>
     Reverse unissued posted invoice</button>
   </div>
   {active?.status==="REVERSED"&&<p role="status" className="cg-fin-notice">
     This posted invoice was reversed before issue. The original journal remains in the audit ledger.
    </p>}
    {active&&["ISSUED","CREDITED"].includes(active.status)&&<InvoiceDocumentLink refId={active.ref}/>}
   {active&&["ISSUED","CREDITED"].includes(active.status)&&<FinanceInvoiceReceiptTools invoiceRef={active.ref} canPost={canPost&&active.status==="ISSUED"} canIssue={canIssue&&active.status==="ISSUED"}/>}
   {active&&["ISSUED","CREDITED"].includes(active.status)&&<FinanceInvoiceAdjustmentTools invoiceRef={active.ref} canManage={canManage} canReview={canCancelPosted} onCredited={()=>{setActive(v=>v?{...v,status:"CREDITED"}:v);void load();}}/>}
  </section>}
  {cancelOpen&&active?.status==="POSTED"&&canCancelPosted&&<div className="drawer-backdrop" role="presentation">
   <section role="dialog" aria-modal="true" aria-labelledby="cg-invoice-cancel-title"
    className="role-drawer cg-fin-drawer">
    <div className="cg-fin-drawer-header"><div><p>Finance / Protected Invoice Correction</p>
     <h2 id="cg-invoice-cancel-title">Reverse posted, unissued invoice</h2></div>
     <button type="button" disabled={busy||Boolean(cancelPending)}
      onClick={()=>setCancelOpen(false)}>Close</button></div>
    <p className="cg-fin-description">Only an independently approved posted invoice with no PDF
     issue or bank collection can be corrected here. This leaves the original journal immutable;
     issued credit notes and refunds require a different authorized workflow.</p>
    <label className="cg-fin-field">Correction financial year
     <select value={cancelYear} onChange={e=>setCancelYear(e.target.value)}>
      <option value="">Choose open financial year</option>
      {years.filter(y=>y.status==="OPEN").map(y=><option key={y.yearRef}
       value={y.yearRef}>{y.name}</option>)}
     </select></label>
    <label className="cg-fin-field">Correction posting date
     <input type="date" value={cancelDate} onChange={e=>setCancelDate(e.target.value)}/></label>
    <label className="cg-fin-field">Business reason (12–300 characters)
     <textarea minLength={12} maxLength={300} rows={3} value={cancelReason}
      onChange={e=>setCancelReason(e.target.value)}/></label>
    <label className="cg-fin-field">Current independent reviewer password
     <input type="password" autoComplete="current-password" value={cancelPassword}
      onChange={e=>setCancelPassword(e.target.value)}/></label>
    <button type="button" className="primary" disabled={busy||Boolean(cancelPending)||
      !cancelYear||!cancelDate||cancelReason.trim().length<12||cancelPassword.length<8}
     onClick={()=>void cancelPosted({invoiceRef:active.ref,key:crypto.randomUUID(),
      body:{financialYearRef:cancelYear,postingDate:cancelDate,
       reason:cancelReason,currentPassword:cancelPassword}})}>
     Post protected exact invoice reversal</button>
    {cancelPending&&<div className="cg-fin-pending" role="status">
     <p>Correction result uncertain. Check the original request before retrying.</p>
     <button type="button" disabled={busy} onClick={()=>void checkCancellation()}>
      Check original cancellation</button>
     <button type="button" disabled={busy}
      onClick={()=>void cancelPosted(cancelPending)}>Retry same request</button>
    </div>}
   </section>
  </div>}
  <div className="cg-fin-toolbar-actions" role="group" aria-label="Invoice status tabs">
   {[
    ["ALL","All"],["DRAFT","Drafts"],["SUBMITTED","Pending Verification"],
    ["APPROVED","Approved"],["POSTED","Posted"],
    ["ISSUED","Issued"],["CREDITED","Credited"],["REVERSED","Reversed before issue"],
    ["REJECTED","Rejected"],["RETURNED","Returned"]
   ].map(([key,label])=><button type="button" key={key}
     aria-current={filter===key?"page":undefined}
     onClick={()=>{setFilter(key);setOffset(0);}}>{label}</button>)}
  </div>
  <div className="cg-fin-table-wrap"><h3>Original invoices</h3>
   <table className="cg-fin-table"><thead><tr><th>Invoice</th><th>Date</th><th>Counterparty</th>
    <th>Total</th><th>Status</th><th>Action</th></tr></thead><tbody>
    {rows.map(v=><tr key={v.invoiceRef}><td>{v.invoiceNumber}</td><td>{v.invoiceDate??"Draft"}</td>
     <td>{v.counterpartyName??"Not yet submitted"}</td>
     <td>{format(v.totalMinor)}</td><td>{v.status==="ISSUED"?"Issued — not proof of payment":v.status==="CREDITED"?"Credited — history kept":v.status}</td>
     <td><button type="button" onClick={()=>void openInvoice(v)}>Open</button></td></tr>)}
   </tbody></table>
   {!rows.length&&!error&&<p className="cg-fin-empty">No invoices yet.</p>}
   <div className="cg-fin-paging">
    <button type="button" disabled={offset===0} onClick={()=>setOffset(v=>Math.max(0,v-40))}>Previous</button>
    <button type="button" disabled={nextOffset===null} onClick={()=>setOffset(nextOffset??0)}>Next</button>
   </div>
  </div>
 </section>;
}
function InvoiceDocumentLink({refId}:{refId:string}){
 const [documentRef,setDocumentRef]=useState("");
 const [status,setStatus]=useState("");
 useEffect(()=>{
  let active=true;
  void(async()=>{
   const r=await fetch("/api/finance-invoice-documents/invoices/"+refId+"/status",{cache:"no-store"});
   if(r.ok){const v=await r.json() as {documentRef?:string;status?:string};
    if(active){setDocumentRef(v.documentRef??"");setStatus(v.status??"");}}
  })();return()=>{active=false;};
 },[refId]);
 return <div>{status==="ISSUED"&&documentRef?
  <a href={"/api/finance-invoice-documents/files/"+documentRef+"/download"}>Download protected invoice PDF</a>:
  <p>Private invoice document status cannot be confirmed. Check document issuance.</p>}</div>;
}
