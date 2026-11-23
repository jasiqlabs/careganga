"use client";
import {useEffect,useRef,useState} from "react";
type Budget={budgetRef:string;name:string;category:string;ceilingMinor:string;
 periodStart:string;periodEnd:string;
 items:{description:string;quantityMilli:string;unitRateMinor:string;totalMinor:string}[]};
type Expense={journalRef:string;voucherNumber:string;amountMinor:string;postedDate:string};
type Kind="ALLOCATE"|"UTILIZE"|"DEALLOCATE";
type Party="CSR"|"FOUNDATION";
type Command={requestKey:string;expectedVersion:number;budgetRef:string;partyKind:Party;
 kind:Kind;amountMinor:string;journalRef:string|null;correctionOfEventRef:string|null};
const money=(n:string)=>{try{const x=BigInt(n);
 return "₹"+(x/100n).toLocaleString("en-IN")+"."+(x%100n).toString().padStart(2,"0");}
 catch{return "Amount unavailable";}};
const minor=(n:string)=>{const m=/^(0|[1-9][0-9]{0,11})(?:\.([0-9]{1,2}))?$/.exec(n.trim());
 if(!m)return null;const k=BigInt(m[1])*100n+BigInt((m[2]??"").padEnd(2,"0"));
 return k>0n&&k<=99999999999999n?k.toString():null;};
async function api<T>(proposal:string,path:string,command?:Command):Promise<T>{
 const response=await fetch("/api/csr/funding-proposals/"+proposal+"/finance"+path,{
  cache:"no-store",signal:AbortSignal.timeout(18000),
  ...(command?{method:"POST",headers:{"Content-Type":"application/json"},
   body:JSON.stringify(command)}:{})});
 const value:unknown=await response.json().catch(()=>null);
 if(!response.ok||value===null)throw Object.assign(Error(response.status===403?
  "Your current Foundation or finance branch access is restricted.":
  response.status===409?"Original budget, receipt or expense changed. Refresh.":
  "Finance budget outcome is uncertain."),{status:response.status||503});
 return value as T;
}
export function CsrFundingBudgetPanel({proposalRef,version,canManage}:{
 proposalRef:string;version:number;canManage:boolean}){
 const [budgets,setBudgets]=useState<Budget[]>([]);
 const [expenses,setExpenses]=useState<Expense[]>([]);
 const [allocations,setAllocations]=useState<{allocationRef:string;remainingMinor:string}[]>([]);
 const [original,setOriginal]=useState("");
 const [budget,setBudget]=useState(""),[expense,setExpense]=useState("");
 const [party,setParty]=useState<Party>("CSR"),[kind,setKind]=useState<Kind>("ALLOCATE");
 const [amount,setAmount]=useState(""),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [pending,setPending]=useState<Command|null>(null),[epoch,setEpoch]=useState(0);
 const guard=useRef(false),seq=useRef(0);
 useEffect(()=>{
  let live=true;const n=++seq.current;setLoading(true);setError("");
  void api<{items:Budget[]}>(proposalRef,"/budgets").then(v=>{
   if(live&&n===seq.current){setBudgets(v.items);setBudget(x=>
    v.items.some(y=>y.budgetRef===x)?x:v.items[0]?.budgetRef??"");}
  }).catch(e=>{if(live&&n===seq.current){
   setBudgets([]);setError(e instanceof Error?e.message:"Current budgets unavailable.");}})
   .finally(()=>{if(live&&n===seq.current)setLoading(false);});
  return()=>{live=false;seq.current++;};
 },[proposalRef,epoch]);
 useEffect(()=>{
  let live=true;setExpenses([]);setExpense("");
  if(!budget||kind!=="UTILIZE")return;
  void api<{items:Expense[]}>(proposalRef,"/budgets/"+budget+"/expenses")
   .then(v=>{if(live)setExpenses(v.items);})
   .catch(e=>{if(live)setError(e instanceof Error?e.message:"Posted expenses unavailable.");});
  return()=>{live=false;};
 },[proposalRef,budget,kind,epoch]);
 useEffect(()=>{
  let live=true;setAllocations([]);setOriginal("");
  if(!budget||kind!=="DEALLOCATE")return;
  void api<{items:{allocationRef:string;remainingMinor:string}[]}>(
   proposalRef,"/budgets/"+budget+"/allocations?partyKind="+party)
   .then(v=>{if(live)setAllocations(v.items);})
   .catch(e=>{if(live)setError(e instanceof Error?e.message:"Original allocation unavailable.");});
  return()=>{live=false;};
 },[proposalRef,budget,party,kind,epoch]);
 const selectedExpense=expenses.find(v=>v.journalRef===expense);
 const submit=async()=>{
  if(guard.current||loading||busy||!canManage||(!budget&&!pending))return;
  const value=kind==="UTILIZE"?selectedExpense?.amountMinor??null:minor(amount);
  if(!pending&&(!value||kind==="DEALLOCATE"&&!original)){
   setError("Choose an exact posted expense or the original unspent allocation.");return;}
  const command=pending??{requestKey:crypto.randomUUID(),expectedVersion:version,
   budgetRef:budget,partyKind:party,kind,amountMinor:value!,journalRef:kind==="UTILIZE"?expense:null,
   correctionOfEventRef:kind==="DEALLOCATE"?original:null};
  guard.current=true;setBusy(true);setPending(command);setError("");setNotice("");
  try{
   await api(proposalRef,"/budget-effects",command);
   setPending(null);setAmount("");setExpense("");setOriginal("");
   setNotice("Recorded original CG09 budget effect. Allocation is not a new bank deposit.");
   setEpoch(x=>x+1);
  }catch(e){
   const code=e&&typeof e==="object"&&"status" in e?Number(e.status):503;
   if(code>0&&code<500)setPending(null);
   setError(code>=500||code===0?
    "Effect may have been committed. Check Finance or retry the SAME request.":
    e instanceof Error?e.message:"Finance operation rejected.");
  }finally{guard.current=false;setBusy(false);}
 };
 const control={border:"1px solid var(--cg-border)",borderRadius:8,padding:"10px 12px",width:"100%",
  background:"var(--cg-surface,#fff)",color:"inherit",minHeight:44};
 return <section aria-label="Original approved CG09 budget allocation and expense utilization"
  style={{border:"1px solid var(--cg-border)",borderRadius:12,padding:18,display:"grid",gap:12}}>
  <h3 style={{margin:0}}>Budget Categories & Financial Effects</h3>
  <p style={{fontSize:13,margin:0}}>Select a current independently approved CG09 budget
   for this exact Foundation branch and CG05 project. Allocation cannot exceed
   attributed verified bank receipts. Utilization requires a real posted expense.</p>
  {loading?<p role="status">Checking original approved budgets…</p>:
   !budgets.length?<p>No compatible approved CG09 category budget is available.
    Create and independently approve one in Finance before allocating.</p>:<>
   <label>Approved budget and category<select style={control} disabled={busy||!!pending}
    value={budget} onChange={e=>setBudget(e.target.value)}>
    {budgets.map(v=><option key={v.budgetRef} value={v.budgetRef}>
     {v.name} · {v.category} · Ceiling {money(v.ceilingMinor)}
    </option>)}
   </select></label>
   <div aria-label="Original CG09 budget itemization">
    <h4 style={{margin:"0 0 8px"}}>Approved budget lines</h4>
    {budgets.find(x=>x.budgetRef===budget)?.items?.length?
     <table style={{width:"100%",fontSize:13}}><thead><tr>
      <th>Description</th><th>Quantity</th><th>Unit rate</th><th>Amount</th>
     </tr></thead><tbody>{budgets.find(x=>x.budgetRef===budget)!.items.map((item,i)=>
      <tr key={i}><td>{item.description}</td>
       <td>{(Number(item.quantityMilli)/1000).toFixed(3)}</td>
       <td>{money(item.unitRateMinor)}</td><td>{money(item.totalMinor)}</td></tr>)}
     </tbody></table>:
     <p>No item breakdown recorded in this approved original CG09 budget.</p>}
   </div>
   <label>Original party<select style={control} value={party} disabled={busy||!!pending}
    onChange={e=>setParty(e.target.value as Party)}>
    <option value="CSR">CSR portion</option><option value="FOUNDATION">Foundation portion</option>
   </select></label>
   <label>Effect<select style={control} value={kind} disabled={busy||!!pending}
    onChange={e=>setKind(e.target.value as Kind)}>
    <option value="ALLOCATE">Allocate verified funds</option>
    <option value="DEALLOCATE">Correct unused allocation</option>
    <option value="UTILIZE">Utilize against posted expense</option>
   </select></label>
   {kind!=="UTILIZE"?<label>Amount (INR)<input style={control}
    inputMode="decimal" disabled={busy||!!pending} value={amount} onChange={e=>setAmount(e.target.value)}
    placeholder="Amount actually verified and available"/></label>:
    <label>Original posted Finance expense<select style={control} value={expense}
     disabled={busy||!!pending} onChange={e=>setExpense(e.target.value)}>
     <option value="">Choose unutilized posted voucher</option>
     {expenses.map(v=><option key={v.journalRef} value={v.journalRef}>
      {v.voucherNumber} · {v.postedDate} · {money(v.amountMinor)}
     </option>)}
    </select></label>}
   {kind==="DEALLOCATE"&&<label>Original unspent allocation to correct
    <select style={control} value={original} disabled={busy||!!pending}
     onChange={e=>setOriginal(e.target.value)}>
     <option value="">Choose original allocation</option>
     {allocations.map(a=><option key={a.allocationRef} value={a.allocationRef}>
      Remaining unspent authorization {money(a.remainingMinor)}
     </option>)}
    </select>
   </label>}
   <button type="button" disabled={busy||!canManage||!pending&&
    (!budget||kind==="UTILIZE"&&!expense||kind!=="UTILIZE"&&!minor(amount)||
     kind==="DEALLOCATE"&&!original)}
    onClick={()=>void submit()}>{pending?"Retry exact CG09 command":"Record original CG09 budget effect"}</button>
  </>}
  <button type="button" disabled={busy} onClick={()=>setEpoch(x=>x+1)}>
   Refresh finance evidence</button>
  {!!notice&&<p role="status">{notice}</p>}
  {!!error&&<p role="alert" style={{color:"#B91C1C"}}>{error}</p>}
 </section>;
