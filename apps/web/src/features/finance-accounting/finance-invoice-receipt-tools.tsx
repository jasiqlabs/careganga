"use client";
import {useCallback,useEffect,useState} from "react";
type Receipt={receiptRef:string;receiptNumber:string;amountMinor:string;paidDate:string};
type Paid={paymentVerified:boolean;status:string;totalMinor:string;paidMinor:string;
 outstandingMinor:string;receipts:Receipt[];hasMore?:boolean};
type Option={reconciliationRef:string;bankName:string;statementDate:string;
 amountMinor:string;statementHint:string};
type Collection={banks:{accountRef:string;code:string;name:string}[];
 years:{yearRef:string;name:string;startOn:string;endOn:string}[]};
type Doc={status:string;canDownload?:boolean;documentRef?:string};
type Pending={key:string;action:"COLLECTION"|"LINK"|"ISSUE";receiptRef?:string};
const money=(v:string)=>{try{const n=BigInt(v),x=n<0n?-n:n;return (n<0n?"-":"")+"₹"+
 (x/100n).toLocaleString("en-IN")+"."+(x%100n).toString().padStart(2,"0");}
 catch{return "Amount unavailable";}};
async function failure(res:Response){
 const value:unknown=await res.json().catch(()=>null);
 if(value&&typeof value==="object"&&!Array.isArray(value)&&"message" in value&&
    typeof value.message==="string"&&value.message.length<=300)return value.message;
 return res.status===403?"Your role cannot perform this Finance action.":
  res.status===409?"The original invoice or bank source changed. Refresh before retrying.":
  "This bank collection result is not confirmed. Check the original command.";
}
async function data<T>(url:string):Promise<T>{
 const res=await fetch(url,{cache:"no-store"});
 if(!res.ok)throw Error(await failure(res));return res.json() as Promise<T>;
}
export function FinanceInvoiceReceiptTools({invoiceRef,canPost,canIssue}:{invoiceRef:string;canPost:boolean;canIssue:boolean}){
 const [paid,setPaid]=useState<Paid|null>(null);
 const [options,setOptions]=useState<Option[]>([]);
 const [collection,setCollection]=useState<Collection|null>(null);
 const [doc,setDoc]=useState<Record<string,Doc>>({});
 const [choice,setChoice]=useState("");
 const [bank,setBank]=useState("");
 const [year,setYear]=useState("");
 const [date,setDate]=useState("");
 const [amount,setAmount]=useState("");
 const [pending,setPending]=useState<Pending|null>(null);
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState("");
 const [error,setError]=useState("");
 const refresh=useCallback(async()=>{
  try{
   const current=await data<Paid>("/api/finance/invoices/"+invoiceRef+"/receipt");
   setPaid(current);
   const outstanding=BigInt(current.outstandingMinor??"0");
   if(outstanding>0n&&canIssue){
    const available=await data<{matches:Option[]}>(
     "/api/finance/invoices/"+invoiceRef+"/receipt-options");
    setOptions(available.matches??[]);
    if(canPost&&canIssue){
     const setup=await data<Collection>(
      "/api/finance/invoices/"+invoiceRef+"/collection-options");
     setCollection(setup);
    }
   }else{setOptions([]);setCollection(null);}
   const documents:Record<string,Doc>={};
   for(const receipt of current.receipts.slice(0,20)){
    try{documents[receipt.receiptRef]=await data<Doc>(
     "/api/finance-receipts/receipts/"+receipt.receiptRef+"/status");}
    catch{documents[receipt.receiptRef]={status:"UNKNOWN"};}
   }
   setDoc(documents);
  }catch(e){setError(e instanceof Error?e.message:"Could not verify original receipts.");}
 },[invoiceRef,canPost,canIssue]);
 useEffect(()=>{void refresh();},[refresh]);
 async function perform(url:string,body:Record<string,unknown>,
  kind:Pending["action"],receiptRef?:string){
  if(busy||pending)return;
  const key=crypto.randomUUID();
  setPending({key,action:kind,receiptRef});setBusy(true);setNotice("");setError("");
  try{
   const res=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({...body,requestKey:key})});
   if(!res.ok)throw Error(await failure(res));
   const value=await res.json() as {confirmed?:boolean;status?:string};
   if(!value.confirmed)throw Error("This operation is not confirmed. Check its original source.");
   setPending(null);
   setNotice(kind==="COLLECTION"?
    "Balanced bank collection journal posted. It is NOT paid until independently reconciled.":
    kind==="LINK"?"Bank reconciliation linked as an original verified partial/full receipt.":
    "Private verified financial receipt PDF issued.");
   await refresh();
  }catch(e){setError(e instanceof Error?e.message:"Original operation remains unconfirmed.");
  }finally{setBusy(false);}
 }
 async function checkPending(){
  if(!pending||busy)return;
  setBusy(true);setError("");
  try{
   let confirmed=false;
   if(pending.action==="ISSUE"&&pending.receiptRef){
    const d=await data<Doc>("/api/finance-receipts/receipts/"+pending.receiptRef+"/status");
    confirmed=d.status==="ISSUED"&&d.canDownload===true;
   }else{
    const v=await data<{confirmed:boolean;status:string}>(
     "/api/finance/invoices/workflow-commands/"+pending.key);
    confirmed=v.confirmed;
   }
   if(confirmed){setPending(null);setNotice("Original financial operation confirmed.");await refresh();}
   else setError("The original operation is still unconfirmed. Do not create another request key.");
  }catch(e){setError(e instanceof Error?e.message:"Original financial status unavailable.");}
  finally{setBusy(false);}
 }
 const outstanding=paid?BigInt(paid.outstandingMinor):null;
 return <section className="cg-fin-card" aria-label="Original invoice bank collection and verified receipts">
  <h4>Bank collections and verified receipts</h4>
  <p className="cg-fin-help">Issuing an invoice does not mean it has been paid.
   Every collection needs an actual balanced journal, independent bank statement
   verification, and an original receipt link.</p>
  {error&&<p role="alert" className="cg-fin-notice">{error}</p>}
  {notice&&<p role="status" className="cg-fin-notice">{notice}</p>}
  {paid&&<div className="cg-fin-voucher-tiles">
   {([["Invoice",paid.totalMinor],["Verified receipts",paid.paidMinor],
      ["Outstanding",paid.outstandingMinor]] as [string,string][]).map(([name,n])=>
    <article key={name} className="cg-fin-voucher-tile"><div><p>{name}</p>
     <strong>{money(n)}</strong></div></article>)}
  </div>}
  {outstanding!==null&&outstanding>0n&&canIssue&&canPost&&collection&&<div className="cg-fin-form">
   <h4>1. Record actual collection journal (not yet verified)</h4>
   <label className="cg-fin-field">Financial year of collection
    <select value={year} onChange={e=>setYear(e.target.value)}>
     <option value="">Choose an open financial year</option>
     {collection.years.map(y=><option key={y.yearRef} value={y.yearRef}>
      {y.name} · {y.startOn} to {y.endOn}</option>)}
    </select></label>
   <label className="cg-fin-field">Bank account
    <select value={bank} onChange={e=>setBank(e.target.value)}>
     <option value="">Choose permitted real bank account</option>
     {collection.banks.map(x=><option key={x.accountRef} value={x.accountRef}>
      {x.code} · {x.name}</option>)}
    </select></label>
   <label className="cg-fin-field">Collection posting date
    <input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
   <label className="cg-fin-field">Actual collection amount (₹)
    <input inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)}
     placeholder="e.g. 500.00"/></label>
   <button type="button" className="primary" disabled={busy||Boolean(pending)||!bank||!year||!date||!amount}
    onClick={()=>void perform("/api/finance/invoices/"+invoiceRef+"/record-collection",
     {bankAccountRef:bank,financialYearRef:year,postingDate:date,amount},"COLLECTION")}>
     Post balanced collection journal — awaiting bank verification</button>
   <p className="cg-fin-help">A separately authorized Finance bank reviewer must verify the
    matching original statement item before any paid receipt becomes available.</p>
  </div>}
  {outstanding!==null&&outstanding>0n&&canIssue&&<div className="cg-fin-form">
   <h4>2. Link separately verified real bank statement item</h4>
   <label className="cg-fin-field">Eligible original bank collection
    <select value={choice} onChange={e=>setChoice(e.target.value)}>
     <option value="">Select a matching verified bank item</option>
     {options.map(x=><option key={x.reconciliationRef} value={x.reconciliationRef}>
      {x.bankName} · {x.statementDate} · {money(x.amountMinor)} · Statement ending {x.statementHint}
     </option>)}
    </select></label>
   <button type="button" className="primary" disabled={!choice||busy||Boolean(pending)}
    onClick={()=>void perform("/api/finance/invoices/"+invoiceRef+"/link-receipt",
     {reconciliationRef:choice},"LINK")}>Record verified partial/full payment</button>
   {!options.length&&<p>No independently verified collection is currently eligible.</p>}
  </div>}
  <div className="cg-fin-table-wrap"><h4>Verified receipt history</h4>
   {paid?.receipts.length?paid.receipts.map(r=><div className="cg-fin-card" key={r.receiptRef}>
    <strong>{r.receiptNumber} · {money(r.amountMinor)}</strong>
    <p>{r.paidDate} · Original bank-statement verification</p>
    {doc[r.receiptRef]?.canDownload&&doc[r.receiptRef]?.documentRef?
     <a href={"/api/finance-receipts/files/"+doc[r.receiptRef].documentRef+"/download"}>
      Download this protected receipt PDF</a>:
     canIssue?<button type="button" disabled={busy||Boolean(pending)||
       doc[r.receiptRef]?.status==="UNKNOWN"} onClick={()=>void perform(
       "/api/finance-receipts/receipts/"+r.receiptRef+"/issue",{},"ISSUE",r.receiptRef)}>
      {doc[r.receiptRef]?.status==="UNKNOWN"?"Receipt issue requires provider recovery":
       "Issue this verified receipt PDF"}</button>:<p>Private receipt document not yet issued.</p>}
   </div>):<p>No bank-verified receipts recorded.</p>}
   {paid?.hasMore&&<p>Showing recent receipts only. Totals include all verified receipts.</p>}
  </div>
  {pending&&<button type="button" disabled={busy} onClick={()=>void checkPending()}>
   Check previous original request</button>}
  <button type="button" disabled={busy} onClick={()=>void refresh()}>Refresh verified receipt status</button>
 </section>;
}
