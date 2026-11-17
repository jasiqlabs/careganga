"use client";
import {useCallback,useEffect,useState} from "react";
type Year={ref:string;name:string};
type Account={ref:string;name:string;code:string;kind:string};
type Ledger={accountName:string;accountCode:string;category:string;postingDate:string;
 description:string;postingKind:string;debitMinor:string;creditMinor:string};
type Trial={accountName:string;code:string;category:string;netDebitMinor:string;netCreditMinor:string};
type Book={postingDate:string;account:string;kind:string;debitMinor:string;creditMinor:string;
 description:string;postingKind:string};
type Bank={accountRef:string;name:string;code:string};
type BankLine={journalRef:string;financialYearRef:string;postingDate:string;description:string;amountMinor:string};
type Match={reconciliationRef:string;accountName:string;statementDate:string;
 bankItemReference:string;statementAmountMinor:string;varianceMinor:string;status:string};
type View="summary"|"general-ledger"|"trial-balance"|"day-book"|"cash-book"|"bank-book"|"reconciliation";
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
export function FinanceReportsWorkspace({canReconcile,canVerify}:{
 canReconcile:boolean;canVerify:boolean}){
 const [view,setView]=useState<View>("summary");
 const [years,setYears]=useState<Year[]>([]);
 const [accounts,setAccounts]=useState<Account[]>([]);
 const [year,setYear]=useState("");
 const [account,setAccount]=useState("");
 const [from,setFrom]=useState("");
 const [to,setTo]=useState("");
 const [offset,setOffset]=useState(0);
 const [next,setNext]=useState<number|null>(null);
 const [rows,setRows]=useState<Ledger[]|Trial[]|Book[]>([]);
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
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [pending,setPending]=useState<{url:string;key:string;body:Record<string,unknown>}|null>(null);
 useEffect(()=>{
  let live=true;void(async()=>{
   try{
    const r=await fetch("/api/finance/reports/options",{cache:"no-store"});
    if(!r.ok)throw Error(await message(r));
    const data=await r.json() as {years?:Year[];accounts?:Account[]};
    if(!Array.isArray(data.years)||!Array.isArray(data.accounts))throw Error("Current report options unavailable.");
    if(live){setYears(data.years);setAccounts(data.accounts);}
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
    const query=year?"?yearRef="+year:"";
    const res=await fetch("/api/finance/reports/summary"+query,{cache:"no-store"});
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
    if(account&&view==="general-ledger")q.set("accountRef",account);
    if(from&&view!=="trial-balance")q.set("from",from);
    if(to&&view!=="trial-balance")q.set("to",to);
    if(view!=="trial-balance")q.set("offset",String(offset));
    const res=await fetch("/api/finance/reports/"+view+"?"+q,{cache:"no-store"});
    if(!res.ok)throw Error(await message(res));
    const data=await res.json() as {lines?:Ledger[]|Book[];accounts?:Trial[];
     nextOffset?:number|null;totalDebitMinor?:string;totalCreditMinor?:string;balanced?:boolean};
    const records=data.lines??data.accounts;
    if(!Array.isArray(records))throw Error("Cannot verify posted ledger lines.");
    setRows(records);setNext(data.nextOffset??null);
    if(view==="trial-balance")setTrialTotal({
     debit:data.totalDebitMinor??"0",credit:data.totalCreditMinor??"0",balanced:data.balanced===true});
   }
  }catch(e){setError(e instanceof Error?e.message:"Original posted report unavailable.");
   setRows([]);setNext(null);}
  finally{setBusy(false);}
 },[view,year,account,from,to,offset]);
 useEffect(()=>{void load();},[load]);
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
   setPending(null);setPassword("");setNotice("Bank statement match: "+state.status+
    ". This is not a provider payment confirmation.");void load();
  }catch(e){setError(e instanceof Error?e.message:"Original bank reconciliation is unconfirmed.");}
  finally{setBusy(false);}
 }
 function exportCurrent(){
  const cols=view==="trial-balance"?["accountName","code","category","netDebitMinor","netCreditMinor"]:
   view==="general-ledger"?["accountName","postingDate","description","debitMinor","creditMinor"]:
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
    ["trial-balance","Trial Balance"],["reconciliation","Bank Reconciliation"]
   ] as [View,string][]).map(([key,name])=><button type="button" key={key}
    aria-current={key===view?"page":undefined} onClick={()=>{setView(key);setOffset(0);}}>
    {name}</button>)}
  </div>
  {view!=="reconciliation"&&<div className="cg-fin-filters">
   <label className="cg-fin-field">Financial year
    <select value={year} onChange={e=>{setYear(e.target.value);setOffset(0);}}>
     <option value="">All years</option>{years.map(y=><option key={y.ref} value={y.ref}>{y.name}</option>)}
    </select></label>
   {view==="general-ledger"&&<label className="cg-fin-field">Account
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
   <p>Enter the actual bank statement item and compare its amount with one original posted bank line.
    An independent protected reviewer must verify a zero variance. This does not release payments.</p>
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
     <td>{m.status==="VERIFIED"?"Independently matched":m.status}</td>
     <td>{m.status==="PENDING"&&canVerify&&<button type="button"
      onClick={()=>setReviewMatch(m.reconciliationRef)}>Verify</button>}</td></tr>)}
   </tbody></table></div>
   {reviewMatch&&canVerify&&<div className="cg-fin-card">
    <h4>Independent protected bank statement review</h4>
    <label className="cg-fin-field">Current reviewer password
     <input type="password" value={password} autoComplete="current-password"
      onChange={e=>setPassword(e.target.value)}/></label>
    <div className="cg-fin-toolbar-actions">
     <button type="button" disabled={busy||password.length<8||Boolean(pending)}
      onClick={()=>void action("reconciliation/matches/"+reviewMatch+"/decision",{
       action:"VERIFY",currentPassword:password})}>Confirm exact bank match</button>
     <button type="button" disabled={busy||password.length<8||Boolean(pending)}
      onClick={()=>void action("reconciliation/matches/"+reviewMatch+"/decision",{
       action:"REJECT",currentPassword:password})}>Reject mismatch</button>
    </div>
   </div>}
  </div>}
 </section>;
}
