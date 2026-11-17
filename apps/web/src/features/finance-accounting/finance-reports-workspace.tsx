"use client";
import {useCallback,useEffect,useState} from "react";
type Year={ref:string;name:string};
type Account={ref:string;name:string;code:string;kind:string};
type Ledger={accountName:string;accountCode:string;category:string;postingDate:string;
 description:string;postingKind:string;debitMinor:string;creditMinor:string};
type Trial={accountName:string;code:string;category:string;netDebitMinor:string;netCreditMinor:string};
type Book={postingDate:string;account:string;kind:string;debitMinor:string;creditMinor:string;
 description:string;postingKind:string};
type Receivable={invoiceNumber:string;invoiceDate:string;dueDate:string;
 counterpartyName:string;status:string;totalMinor:string;verifiedMinor:string;
 outstandingMinor:string};
type Bank={accountRef:string;name:string;code:string};
type Branch={branchRef:string;name:string;code:string;version:number};
type BankLine={journalRef:string;financialYearRef:string;postingDate:string;description:string;amountMinor:string};
type Match={reconciliationRef:string;accountName:string;statementDate:string;
 bankItemReference:string;statementAmountMinor:string;varianceMinor:string;status:string;canUpload:boolean};
type StatementFile={fileRef:string;fileVersion:number;mime:string;sizeBytes:string};
type UploadResult={status:string;uploadRef:string;uploadUrl?:string;uploadHeaders?:Record<string,string>;
 cleanVerified?:boolean;fileRef?:string|null;fileVersion?:number|null};
type View="summary"|"general-ledger"|"trial-balance"|"day-book"|"cash-book"|"bank-book"|"receivables"|"reconciliation";
const format=(n:string)=>{try{const v=BigInt(n),sign=v<0n?"-":"",a=v<0n?-v:v;
 return sign+"₹"+(a/100n).toLocaleString("en-IN")+"."+
  (a%100n).toString().padStart(2,"0");}catch{return "Unavailable";}};
async function message(r:Response){
 const v:unknown=await r.json().catch(()=>null);
 if(v&&typeof v==="object"&&!Array.isArray(v)&&"message" in v&&
   typeof v.message==="string"&&v.message.length<=300)return v.message;
 return r.status===403?"Your role cannot read this financial source.":
  r.status===409?"The original statement or journal entry changed. Refresh.":
  "The current financial report could not be confirmed. Refresh its source.";
}
function csvCell(s:string){
 const clean=s.replace(/[\r\n]/g," ").replace(/"/g,'""');
 return '"'+(/^\s*[=+\-@]/.test(clean)?"'"+clean:clean)+'"';
}
export function FinanceReportsWorkspace({canReconcile,canVerify,canUploadStatement}:{
 canReconcile:boolean;canVerify:boolean;canUploadStatement:boolean}){
 const [view,setView]=useState<View>("summary");
 const [years,setYears]=useState<Year[]>([]);
 const [accounts,setAccounts]=useState<Account[]>([]);
 const [branches,setBranches]=useState<Branch[]>([]);
  const [allBranches,setAllBranches]=useState(true);
 const [branch,setBranch]=useState("");
 const [year,setYear]=useState("");
 const [account,setAccount]=useState("");
 const [from,setFrom]=useState("");
 const [to,setTo]=useState("");
 const [offset,setOffset]=useState(0);
 const [next,setNext]=useState<number|null>(null);
 const [rows,setRows]=useState<Ledger[]|Trial[]|Book[]|Receivable[]>([]);
 const [summary,setSummary]=useState<Record<string,string>|null>(null);
 const [trialTotal,setTrialTotal]=useState<{debit:string;credit:string;balanced:boolean}|null>(null);
 const [banks,setBanks]=useState<Bank[]>([]);
 const [bank,setBank]=useState("");
 const [bankLines,setBankLines]=useState<BankLine[]>([]);
 const [matches,setMatches]=useState<Match[]>([]);
 const [selectedBankLine,setSelectedBankLine]=useState("");
 const [statementDate,setStatementDate]=useState("");
 const [statementAmount,setStatementAmount]=useState("");
 const [statementReference,setStatementReference]=useState("");
 const [reviewMatch,setReviewMatch]=useState("");
 const [password,setPassword]=useState("");
 const [statementFiles,setStatementFiles]=useState<StatementFile[]>([]);
 const [statementFileRef,setStatementFileRef]=useState("");
 const [inspectedStatement,setInspectedStatement]=useState(false);
 const [uploadMatch,setUploadMatch]=useState("");
 const [chosenFile,setChosenFile]=useState<File|null>(null);
 const [uploadKey,setUploadKey]=useState("");
 const [uploadRef,setUploadRef]=useState("");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [pending,setPending]=useState<{url:string;key:string;body:Record<string,unknown>}|null>(null);
 useEffect(()=>{
  let live=true;void(async()=>{
   try{
    const r=await fetch("/api/finance/reports/options",{cache:"no-store"});
    if(!r.ok)throw Error(await message(r));
    const data=await r.json() as {years?:Year[];accounts?:Account[];branches?:Branch[];allBranches?:boolean};
    if(!Array.isArray(data.years)||!Array.isArray(data.accounts)||!Array.isArray(data.branches))
     throw Error("Current report options unavailable.");
    if(live){setYears(data.years);setAccounts(data.accounts);setBranches(data.branches);
      setAllBranches(data.allBranches===true);
      if(data.allBranches!==true)setBranch(current=>data.branches!.some(x=>x.branchRef===current)?current:(data.branches![0]?.branchRef??""));
     }
   }catch(e){if(live)setError(e instanceof Error?e.message:"Financial period options unavailable.");}
  })();return()=>{live=false;};
 },[]);
 const load=useCallback(async()=>{
  setBusy(true);setError("");setTrialTotal(null);
  try{
   if(view==="reconciliation"){
    const [a,b]=await Promise.all([
     fetch("/api/finance/reports/reconciliation/banks",{cache:"no-store"}),
     fetch("/api/finance/reports/reconciliation/matches?offset="+offset,{cache:"no-store"})]);
    if(!a.ok||!b.ok)throw Error(await message(!a.ok?a:b));
    const options=await a.json() as {banks?:Bank[]};
    const status=await b.json() as {items?:Match[];nextOffset?:number|null};
    if(!Array.isArray(options.banks)||!Array.isArray(status.items))
     throw Error("Bank reconciliation register unavailable.");
    setBanks(options.banks);setMatches(status.items);setNext(status.nextOffset??null);
   }else if(view==="summary"){
    const q=new URLSearchParams();
    if(year)q.set("yearRef",year);
    if(branch)q.set("branchRef",branch);
    const res=await fetch("/api/finance/reports/summary?"+q,{cache:"no-store"});
    if(!res.ok)throw Error(await message(res));
    const data=await res.json() as Record<string,string>;
    if(!data||typeof data.incomeMinor!=="string")throw Error("Posted GL summary unavailable.");
    setSummary(data);setRows([]);setNext(null);
   }else{
    if(view==="trial-balance"&&!year){
     setRows([]);setNext(null);setError("Select a financial year to calculate the trial balance.");return;
    }
    const q=new URLSearchParams();
    if(year)q.set("yearRef",year);
    if(branch)q.set("branchRef",branch);
    if(account&&["general-ledger","bank-book","cash-book","day-book","receivables"].includes(view))q.set("accountRef",account);
    if(from&&view!=="trial-balance")q.set("from",from);
    if(to&&view!=="trial-balance")q.set("to",to);
    if(view!=="trial-balance")q.set("offset",String(offset));
    const res=await fetch("/api/finance/reports/"+view+"?"+q,{cache:"no-store"});
    if(!res.ok)throw Error(await message(res));
    const data=await res.json() as {lines?:Ledger[]|Book[];accounts?:Trial[];
     items?:Receivable[];nextOffset?:number|null;totalDebitMinor?:string;
     totalCreditMinor?:string;balanced?:boolean};
    const records=data.lines??data.accounts??data.items;
    if(!Array.isArray(records))throw Error("Cannot verify posted ledger lines.");
    setRows(records);setNext(data.nextOffset??null);
    if(view==="trial-balance")setTrialTotal({
     debit:data.totalDebitMinor??"0",credit:data.totalCreditMinor??"0",balanced:data.balanced===true});
   }
  }catch(e){setError(e instanceof Error?e.message:"Original posted report unavailable.");
   setRows([]);setNext(null);}
  finally{setBusy(false);}
 },[view,year,branch,account,from,to,offset]);
 useEffect(()=>{void load();},[load]);
 useEffect(()=>{
  let live=true;setStatementFiles([]);setStatementFileRef("");setInspectedStatement(false);
  if(!reviewMatch||!canVerify)return;
  void(async()=>{try{
   const result=await fetch("/api/finance-bank-statements/matches/"+reviewMatch+"/files",{cache:"no-store"});
   if(!result.ok)throw Error(await message(result));
   const data=await result.json() as {files?:StatementFile[]};
   if(!Array.isArray(data.files))throw Error("No confirmed private statement files.");
   if(live)setStatementFiles(data.files);
  }catch(e){if(live)setError(e instanceof Error?e.message:"Bank proof is unavailable.");}
  })();
  return()=>{live=false;};
 },[reviewMatch,canVerify]);
 useEffect(()=>{
  let current=true;if(view!=="reconciliation"||!bank){setBankLines([]);return;}
  void(async()=>{
   try{
    const r=await fetch("/api/finance/reports/reconciliation/banks/"+bank+"/entries",{cache:"no-store"});
    if(!r.ok)throw Error(await message(r));
    const data=await r.json() as {lines?:BankLine[]};
    if(current)setBankLines(data.lines??[]);
   }catch(e){if(current)setError(e instanceof Error?e.message:"Posted bank entries unavailable.");}
  })();return()=>{current=false;};
 },[bank,view]);
 async function action(path:string,raw:Record<string,unknown>){
  if(busy||pending)return;
  const key=crypto.randomUUID(),body={...raw,requestKey:key};
  setPending({url:path,key,body});setBusy(true);setError("");setNotice("");
  try{
   const res=await fetch("/api/finance/reports/"+path,{method:"POST",
    headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
   if(!res.ok)throw Error(await message(res));
   const state=await res.json() as {confirmed?:boolean;status?:string};
   if(!state.confirmed)throw Error("Original bank match cannot be confirmed.");
   setPending(null);setPassword("");setReviewMatch("");setInspectedStatement(false);
   setNotice("Bank statement match: "+state.status+
    ". This is not a provider payment confirmation.");void load();
  }catch(e){setError(e instanceof Error?e.message:"Original bank reconciliation is unconfirmed.");}
  finally{setBusy(false);}
 }
 async function checkUploadedStatement(){
  if(!uploadRef||busy)return;
  setBusy(true);setError("");setNotice("");
  try{
   const res=await fetch("/api/finance-bank-statements/intents/"+uploadRef,{cache:"no-store"});
   if(!res.ok)throw Error(await message(res));
   const data=await res.json() as UploadResult;
   setNotice(data.cleanVerified?"The original scanned bank statement is confirmed.":
    "Statement not verified yet: "+String(data.status).replaceAll("_"," ")+".");
  }catch(e){setError(e instanceof Error?e.message:"Original statement status unavailable.");}
  finally{setBusy(false);}
 }
 async function uploadStatement(){
  if(!uploadMatch||!chosenFile||busy)return;
  if(chosenFile.size<1||chosenFile.size>10485760||
   !["application/pdf","image/jpeg","image/png","image/webp"].includes(chosenFile.type)){
   setError("Choose a PDF, JPG, PNG or WebP bank statement under 10 MB.");return;
  }
  const key=uploadKey||crypto.randomUUID();setUploadKey(key);
  setBusy(true);setError("");setNotice("");
  try{
   const buffer=await chosenFile.arrayBuffer();
   const digest=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",buffer)))
    .map(x=>x.toString(16).padStart(2,"0")).join("");
   const init=await fetch("/api/finance-bank-statements/intents",{method:"POST",
    headers:{"Content-Type":"application/json"},body:JSON.stringify({
     reconciliationRef:uploadMatch,requestKey:key,mime:chosenFile.type,
     sizeBytes:chosenFile.size,sha256:digest})});
   if(!init.ok)throw Error(await message(init));
   const started=await init.json() as UploadResult;
   if(!started.uploadRef)throw Error("The original upload request is unconfirmed.");
   setUploadRef(started.uploadRef);
   if(started.status==="UPLOAD_READY"&&started.uploadUrl&&started.uploadHeaders&&
     started.uploadUrl.startsWith("https://")&&started.uploadHeaders["Content-Type"]===chosenFile.type){
    const sent=await fetch(started.uploadUrl,{method:"PUT",body:chosenFile,
     headers:started.uploadHeaders});
    // An immutable object already written during a lost response may return
    // precondition failure; only provider byte/checksum verification can accept it.
    if(!sent.ok&&sent.status!==412)throw Error("Bank statement upload unconfirmed. Check original request.");
   }else if(started.status!=="VALIDATED")throw Error(
    "Secure statement storage is not ready. Check original request.");
   const confirm=await fetch("/api/finance-bank-statements/intents/"+
    started.uploadRef+"/confirm",{method:"POST",headers:{"Content-Type":"application/json"},
    body:"{}"});
   if(!confirm.ok)throw Error(await message(confirm));
   const result=await confirm.json() as UploadResult;
   if(!result.cleanVerified||!result.fileRef||!result.fileVersion)
    throw Error("The private statement has not passed file and malware verification.");
   setNotice("Scanned statement uploaded. A different reviewer must inspect and approve the exact match.");
   setUploadMatch("");setChosenFile(null);setUploadRef("");setUploadKey("");
  }catch(e){setError(e instanceof Error?e.message:"Original statement upload result uncertain. Check its status.");}
  finally{setBusy(false);}
 }
 function exportCurrent(){
  const cols=view==="trial-balance"?["accountName","code","category","netDebitMinor","netCreditMinor"]:
   view==="general-ledger"?["accountName","postingDate","description","debitMinor","creditMinor"]:
   view==="receivables"?["invoiceNumber","invoiceDate","dueDate","counterpartyName",
    "status","totalMinor","verifiedMinor","outstandingMinor"]:
   ["postingDate","account","description","debitMinor","creditMinor"];
  const lines=[cols.join(","),...rows.map(x=>cols.map(k=>csvCell(String(
   (x as unknown as Record<string,unknown>)[k]??""))).join(","))];
  const blob=new Blob([lines.join("\r\n")],{type:"text/csv;charset=utf-8"});
  const href=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=href;a.download="CareGanga-"+view+"-visible-page.csv";a.click();
  URL.revokeObjectURL(href);
 }
 return <section className="cg-fin-manual">
  <div className="cg-fin-toolbar"><div><h2>Financial Statements & Ledger</h2>
   <p>Original posted double-entry lines. No sample amounts or future partner-project masters.</p></div>
   <button type="button" disabled={busy} onClick={()=>void load()}>Refresh</button></div>
  {error&&<p className="cg-fin-notice" role="alert">{error}</p>}
  {notice&&<p className="cg-fin-notice" role="status">{notice}</p>}
  {pending&&<p role="alert" className="cg-fin-card">
   Previous reconciliation command unconfirmed. Do not submit another statement match until verified.</p>}
  <div className="cg-fin-toolbar-actions">
   {([
    ["summary","Finance Dashboard"],["general-ledger","General Ledger"],
    ["day-book","Day Book"],["cash-book","Cash Book"],["bank-book","Bank Book"],
    ["trial-balance","Trial Balance"],["receivables","Invoice Receivables"],
    ["reconciliation","Bank Reconciliation"]
   ] as [View,string][]).map(([key,name])=><button type="button" key={key}
    aria-current={key===view?"page":undefined} onClick={()=>{setView(key);setOffset(0);}}>
    {name}</button>)}
  </div>
  {view!=="reconciliation"&&<div className="cg-fin-filters">
   <label className="cg-fin-field">Financial year
    <select value={year} onChange={e=>{setYear(e.target.value);setOffset(0);}}>
     <option value="">All years</option>{years.map(y=><option key={y.ref} value={y.ref}>{y.name}</option>)}
    </select></label>
   <label className="cg-fin-field">Foundation / branch
    <select value={branch} onChange={e=>{setBranch(e.target.value);setOffset(0);}}>
     {allBranches&&<option value="">All Foundation branches</option>}
     {branches.map(b=><option key={b.branchRef} value={b.branchRef}>
      {b.code} · {b.name}</option>)}
    </select></label>
   {["general-ledger","bank-book","cash-book","day-book","receivables"].includes(view)&&<label className="cg-fin-field">Account
    <select value={account} onChange={e=>{setAccount(e.target.value);setOffset(0);}}>
     <option value="">All permitted accounts</option>
     {accounts.map(a=><option key={a.ref} value={a.ref}>{a.code} · {a.name}</option>)}
    </select></label>}
   {!["summary","trial-balance"].includes(view)&&(["from","to"] as const).map(k=>
    <label className="cg-fin-field" key={k}>{k==="from"?"From":"To"}
     <input type="date" value={k==="from"?from:to}
      onChange={e=>{if(k==="from")setFrom(e.target.value);else setTo(e.target.value);setOffset(0);}}/>
    </label>)}
  </div>}
  {view==="summary"&&summary&&<div className="cg-fin-voucher-tiles">
   {([["Posted income",summary.incomeMinor],["Posted expenses",summary.expenseMinor],
    ["Recognized surplus",summary.surplusMinor],["Fund balances",summary.fundsMinor],
    ["Cash + Bank net",summary.cashBankMinor]] as [string,string][]).map(([name,amt])=>
    <article className="cg-fin-voucher-tile" key={name}>
     <div><p>{name}</p><strong>{format(amt)}</strong></div></article>)}
  </div>}
  {view==="trial-balance"&&trialTotal&&<p role="status">
   Total debit {format(trialTotal.debit)} · total credit {format(trialTotal.credit)} ·
   {trialTotal.balanced?" Posted trial balance reconciles.":" Discrepancy — verify the journal source."}
  </p>}
  {!["summary","reconciliation"].includes(view)&&<div className="cg-fin-table-wrap">
   <div className="cg-fin-toolbar"><h3>{view.replaceAll("-"," ").toUpperCase()}</h3>
    <button type="button" disabled={!rows.length} onClick={exportCurrent}>
     Export visible page (CSV)</button></div>
   <table className="cg-fin-table"><thead><tr>
    <th>{view==="trial-balance"?"Account":"Date / Account"}</th>
    <th>{view==="trial-balance"?"Category":"Original journal detail"}</th>
    <th>Debit</th><th>Credit</th></tr></thead><tbody>
    {rows.map((entry,i)=>{
     if(view==="receivables"){
      const x=entry as Receivable;
      return <tr key={i}><td>{x.invoiceNumber} · {x.invoiceDate}</td>
       <td>{x.counterpartyName} · {x.status==="ISSUED"?"Issued":"Posted, not yet issued"}
        {" · Due "+x.dueDate}</td><td>{format(x.verifiedMinor)} verified</td>
       <td>{format(x.outstandingMinor)} outstanding</td></tr>;
     }
     if(view==="trial-balance"){
      const x=entry as Trial;
      return <tr key={i}><td>{x.code} · {x.accountName}</td><td>{x.category}</td>
       <td>{format(x.netDebitMinor)}</td><td>{format(x.netCreditMinor)}</td></tr>;
     }
     if(view==="general-ledger"){
      const x=entry as Ledger;
      return <tr key={i}><td>{x.postingDate} · {x.accountCode} {x.accountName}</td>
       <td>{x.description} · {x.postingKind}</td><td>{format(x.debitMinor)}</td>
       <td>{format(x.creditMinor)}</td></tr>;
     }
     const x=entry as Book;
     return <tr key={i}><td>{x.postingDate} · {x.account}</td>
      <td>{x.description} · {x.postingKind}</td><td>{format(x.debitMinor)}</td>
      <td>{format(x.creditMinor)}</td></tr>;
    })}</tbody></table>
   {!rows.length&&!error&&<p className="cg-fin-empty">No matching posted journal lines.</p>}
   <div className="cg-fin-paging">
    <button type="button" disabled={offset===0||busy} onClick={()=>setOffset(v=>Math.max(0,v-50))}>Previous</button>
    <button type="button" disabled={next===null||busy} onClick={()=>setOffset(next??0)}>Next</button>
   </div>
  </div>}
  {view==="reconciliation"&&<div className="cg-fin-card">
   <h3>Real Bank Statement Matching</h3>
   <p>Enter the original bank item and compare it with one posted bank line.
    Attach the real private bank-statement PDF/image. A different authorized reviewer
    must inspect that document and confirm a zero variance; this does not release payments.</p>
   {canReconcile&&<>
    <label className="cg-fin-field">Bank account
     <select value={bank} onChange={e=>{setBank(e.target.value);setSelectedBankLine("");}}>
      <option value="">Select registered bank account</option>
      {banks.map(v=><option key={v.accountRef} value={v.accountRef}>{v.code} · {v.name}</option>)}
     </select></label>
    <label className="cg-fin-field">Original posted bank journal
     <select value={selectedBankLine} onChange={e=>{
      setSelectedBankLine(e.target.value);
      const j=bankLines.find(x=>x.journalRef===e.target.value);
      if(j)setStatementAmount((Number(j.amountMinor)/100).toFixed(2));
     }}>
      <option value="">Choose actual posted bank entry</option>
      {bankLines.map(j=><option key={j.journalRef} value={j.journalRef}>
       {j.postingDate} · {j.description} · {format(j.amountMinor)}</option>)}
     </select></label>
    <label className="cg-fin-field">Bank statement item reference
     <input maxLength={100} value={statementReference} onChange={e=>setStatementReference(e.target.value)}/></label>
    <label className="cg-fin-field">Bank statement date
     <input type="date" value={statementDate} onChange={e=>setStatementDate(e.target.value)}/></label>
    <label className="cg-fin-field">Signed bank amount in rupees
     <input inputMode="decimal" value={statementAmount} onChange={e=>setStatementAmount(e.target.value)}/></label>
    <button type="button" className="primary" disabled={busy||Boolean(pending)||!selectedBankLine||
      !statementDate||!statementReference||!statementAmount}
     onClick={()=>{
      const journal=bankLines.find(x=>x.journalRef===selectedBankLine);
      if(journal)void action("reconciliation/matches",{
       bankRef:bank,journalRef:selectedBankLine,financialYearRef:journal.financialYearRef,
       statementDate,bankItemReference:statementReference,statementAmount});
     }}>Record pending statement comparison</button>
   </>}
   <h4>Existing statement comparisons</h4>
   <div className="cg-fin-table-wrap"><table className="cg-fin-table"><thead><tr>
    <th>Account & date</th><th>Statement ref</th><th>Amount</th><th>Variance</th><th>Status</th><th>Review</th>
   </tr></thead><tbody>
    {matches.map(m=><tr key={m.reconciliationRef}>
     <td>{m.accountName} · {m.statementDate}</td><td>{m.bankItemReference}</td>
     <td>{format(m.statementAmountMinor)}</td><td>{format(m.varianceMinor)}</td>
     <td>{m.status==="VERIFIED"?"Statement reviewed":m.status}</td>
     <td>{m.status==="PENDING"&&<>
      {m.canUpload&&canUploadStatement&&<button type="button"
       onClick={()=>{setUploadMatch(m.reconciliationRef);setChosenFile(null);
        setUploadKey("");setUploadRef("");}}>Attach original bank statement</button>}
      {canVerify&&<button type="button"
       onClick={()=>setReviewMatch(m.reconciliationRef)}>Review</button>}
     </>}</td></tr>)}
   </tbody></table></div>
   {uploadMatch&&canUploadStatement&&<div className="cg-fin-card">
    <h4>Attach genuine bank statement</h4>
    <p>This file is private. A source/checksum/malware scan must succeed before review.</p>
    <label className="cg-fin-field">Bank statement PDF or image
     <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
      onChange={e=>{setChosenFile(e.target.files?.[0]??null);
       setUploadRef("");setUploadKey("");}}/></label>
    <button type="button" disabled={busy||!chosenFile} onClick={()=>void uploadStatement()}>
     Upload and scan bank statement</button>
    {uploadRef&&<button type="button" disabled={busy}
     onClick={()=>void checkUploadedStatement()}>Check existing upload status</button>}
    <button type="button" disabled={busy} onClick={()=>setUploadMatch("")}>Close</button>
   </div>}
   {reviewMatch&&canVerify&&<div className="cg-fin-card">
    <h4>Independent protected bank statement review</h4>
    <p>Open the original document, compare the statement date, item reference and signed amount,
     then select the specific scanned file used for this decision.</p>
    <label className="cg-fin-field">Verified private bank statement
     <select value={statementFileRef} onChange={e=>{setStatementFileRef(e.target.value);
      setInspectedStatement(false);}}>
      <option value="">Select inspected document</option>
      {statementFiles.map((file,i)=><option key={file.fileRef} value={file.fileRef}>
       Statement document {i+1} · {file.mime.replace("application/","").replace("image/","").toUpperCase()}
      </option>)}
     </select></label>
    {statementFileRef&&<a href={"/api/finance-bank-statements/files/"+statementFileRef+"/download"}
     target="_blank" rel="noopener noreferrer">Download the private statement document for review</a>}
    <label className="cg-fin-field"><input type="checkbox" checked={inspectedStatement}
     onChange={e=>setInspectedStatement(e.target.checked)} disabled={!statementFileRef}/>
     I inspected this statement and checked the exact bank item and amount.</label>
    <label className="cg-fin-field">Current reviewer password
     <input type="password" value={password} autoComplete="current-password"
      onChange={e=>setPassword(e.target.value)}/></label>
    <div className="cg-fin-toolbar-actions">
     <button type="button" disabled={busy||password.length<8||Boolean(pending)||
      !inspectedStatement||!statementFiles.some(f=>f.fileRef===statementFileRef)}
      onClick={()=>{const file=statementFiles.find(f=>f.fileRef===statementFileRef);
       if(file)void action("reconciliation/matches/"+reviewMatch+"/decision",{
        action:"VERIFY",currentPassword:password,statementFileRef:file.fileRef,
        statementFileVersion:file.fileVersion});}}>Confirm reviewed bank match</button>
     <button type="button" disabled={busy||password.length<8||Boolean(pending)}
      onClick={()=>void action("reconciliation/matches/"+reviewMatch+"/decision",{
       action:"REJECT",currentPassword:password})}>Reject mismatch</button>
    </div>
   </div>}
  </div>}
 </section>;
}
