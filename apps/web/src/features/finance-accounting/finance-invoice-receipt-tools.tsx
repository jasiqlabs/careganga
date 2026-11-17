"use client";
import {useCallback,useEffect,useState} from "react";
type Paid={paymentVerified:boolean;receiptRef?:string;receiptNumber?:string;
 amountMinor?:string;paidDate?:string};
type Option={reconciliationRef:string;bankName:string;statementDate:string;
 amountMinor:string;statementHint:string};
type Doc={status:string;canDownload?:boolean;documentRef?:string};
const rupees=(minor:string)=>{try{let n=BigInt(minor);return "₹"+(n/100n).toLocaleString("en-IN")+
 "."+(n%100n).toString().padStart(2,"0");}catch{return "Amount unavailable";}};
async function explanation(res:Response){
 const obj:unknown=await res.json().catch(()=>null);
 if(obj&&typeof obj==="object"&&!Array.isArray(obj)&&"message" in obj&&
   typeof obj.message==="string"&&obj.message.length<=300)return obj.message;
 return res.status===409?"Original payment or invoice changed. Refresh before retrying.":
  res.status===403?"Your role cannot issue this private receipt.":
  "Original verified receipt outcome cannot be confirmed. Check its status.";
}
export function FinanceInvoiceReceiptTools({invoiceRef}:{invoiceRef:string}){
 const [paid,setPaid]=useState<Paid|null>(null);
 const [options,setOptions]=useState<Option[]>([]);
 const [choice,setChoice]=useState("");
 const [doc,setDoc]=useState<Doc|null>(null);
 const [notice,setNotice]=useState("");
 const [busy,setBusy]=useState(false);
 const [pending,setPending]=useState<{key:string;action:"LINK"|"ISSUE"}|null>(null);
 const refresh=useCallback(async()=>{
  try{
   const res=await fetch("/api/finance/invoices/"+invoiceRef+"/receipt",{cache:"no-store"});
   if(!res.ok)throw Error(await explanation(res));
   const x=await res.json() as Paid;
   setPaid(x);
   if(x.paymentVerified&&x.receiptRef){
    const pdf=await fetch("/api/finance-receipts/receipts/"+x.receiptRef+"/status",{cache:"no-store"});
    if(pdf.ok)setDoc(await pdf.json() as Doc);
    setOptions([]);
   }else{
    setDoc(null);
    const available=await fetch("/api/finance/invoices/"+invoiceRef+"/receipt-options",{cache:"no-store"});
    if(available.ok){
     const data=await available.json() as {matches?:Option[]};
     setOptions(data.matches??[]);
    }else throw Error(await explanation(available));
   }
  }catch(e){setNotice(e instanceof Error?e.message:"Verified receipt status unavailable.");}
 },[invoiceRef]);
 useEffect(()=>{void refresh();},[refresh]);
 async function link(){
  if(!choice||busy||pending)return;
  const key=crypto.randomUUID();setPending({key,action:"LINK"});setBusy(true);setNotice("");
  try{
   const res=await fetch("/api/finance/invoices/"+invoiceRef+"/link-receipt",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({reconciliationRef:choice,requestKey:key})});
   if(!res.ok)throw Error(await explanation(res));
   const result=await res.json() as {confirmed?:boolean;status?:string};
   if(!result.confirmed||result.status!=="PAID_VERIFIED")throw Error("Actual bank receipt not confirmed.");
   setPending(null);setNotice("Original bank-reconciled payment confirmed. A private receipt can be issued.");
   void refresh();
  }catch(e){setNotice(e instanceof Error?e.message:"Payment reconciliation cannot be confirmed.");}
  finally{setBusy(false);}
 }
 async function issue(){
  if(!paid?.receiptRef||busy||pending)return;
  const key=crypto.randomUUID();setPending({key,action:"ISSUE"});setBusy(true);setNotice("");
  try{
   const res=await fetch("/api/finance-receipts/receipts/"+paid.receiptRef+"/issue",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({requestKey:key})});
   if(!res.ok)throw Error(await explanation(res));
   const result=await res.json() as {confirmed?:boolean;status?:string};
   if(!result.confirmed||result.status!=="ISSUED")
    throw Error("The private receipt issue is not confirmed. Check its original status.");
   setPending(null);setNotice("The original private receipt PDF is issued.");
   void refresh();
  }catch(e){setNotice(e instanceof Error?e.message:"Private receipt issue outcome uncertain.");}
  finally{setBusy(false);}
 }
 async function verifyPending(){
  if(!pending||busy)return;
  setBusy(true);
  try{
   if(pending.action==="LINK"){
    const r=await fetch("/api/finance/invoices/workflow-commands/"+pending.key,{cache:"no-store"});
    if(!r.ok)throw Error(await explanation(r));
    const value=await r.json() as {confirmed?:boolean;status?:string};
    if(value.confirmed&&value.status==="PAID_VERIFIED"){
     setPending(null);setNotice("Original verified receipt link confirmed.");void refresh();
    }else setNotice("Original receipt payment has not been confirmed. Retry only this original request.");
   }else{
    await refresh();
    if(doc?.status==="ISSUED"){setPending(null);setNotice("Original receipt PDF has been issued.");}
    else setNotice("Original private receipt PDF is still not confirmed; do not issue another reference.");
   }
  }catch(e){setNotice(e instanceof Error?e.message:"Original receipt outcome unknown.");}
  finally{setBusy(false);}
 }
 return <section className="cg-fin-card" aria-label="Actual verified invoice receipt">
  <h4>Separate verified payment receipt</h4>
  <p className="cg-fin-help">An invoice PDF does not prove collection. Only a separately reviewed,
   zero-variance posted bank statement match can generate the receipt.</p>
  {notice&&<p role="status" className="cg-fin-notice">{notice}</p>}
  {!paid?.paymentVerified&&<>
   <label className="cg-fin-field">Existing independently reconciled bank deposit
    <select value={choice} onChange={e=>setChoice(e.target.value)}>
     <option value="">Select an actual eligible verified bank deposit</option>
     {options.map(x=><option key={x.reconciliationRef} value={x.reconciliationRef}>
      {x.bankName} · {x.statementDate} · {rupees(x.amountMinor)} · Statement ending {x.statementHint}
     </option>)}
    </select></label>
   <button type="button" className="primary" disabled={!choice||busy||Boolean(pending)}
    onClick={()=>void link()}>Link independently verified payment once</button>
   {!options.length&&<p>No eligible verified bank deposit found. Post the genuine balanced
    bank receipt journal and independently reconcile it first.</p>}
  </>}
  {paid?.paymentVerified&&<p>
   <strong>{paid.receiptNumber}</strong> · Payment verified {paid.paidDate} · {rupees(paid.amountMinor??"0")}
  </p>}
  {paid?.paymentVerified&&!doc?.canDownload&&<button type="button" className="primary"
    disabled={busy||Boolean(pending)} onClick={()=>void issue()}>
    Issue protected bank-verified receipt PDF</button>}
  {doc?.canDownload&&doc.documentRef&&<a
   href={"/api/finance-receipts/files/"+doc.documentRef+"/download"}>
    Download verified private financial receipt PDF</a>}
  {pending&&<button type="button" disabled={busy} onClick={()=>void verifyPending()}>
    Check original pending receipt command</button>}
  <button type="button" disabled={busy} onClick={()=>void refresh()}>Refresh receipt status</button>
 </section>;
}
