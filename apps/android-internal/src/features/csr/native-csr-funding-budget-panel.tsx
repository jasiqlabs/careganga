import React,{useEffect,useRef,useState} from "react";
import {ActivityIndicator,Pressable,StyleSheet,Text,TextInput,View} from "react-native";
import * as Crypto from "expo-crypto";
import {identityRequest} from "../identity-access/http-client";

type Budget={budgetRef:string;name:string;category:string;ceilingMinor:string;
 items:{description:string;quantityMilli:string;unitRateMinor:string;totalMinor:string}[]};
type Expense={journalRef:string;voucherNumber:string;amountMinor:string;postedDate:string};
type Party="CSR"|"FOUNDATION";
type Kind="ALLOCATE"|"UTILIZE"|"DEALLOCATE";
type Command={requestKey:string;expectedVersion:number;budgetRef:string;
 partyKind:Party;kind:Kind;amountMinor:string;journalRef:string|null;correctionOfEventRef:string|null};
const minor=(v:string)=>{const m=/^(0|[1-9][0-9]{0,11})(?:\.([0-9]{1,2}))?$/.exec(v.trim());
 if(!m)return null;const n=BigInt(m[1])*100n+BigInt((m[2]??"").padEnd(2,"0"));
 return n>0n&&n<=99999999999999n?n.toString():null;};
const money=(v:string)=>{try{const x=BigInt(v);return "₹"+(x/100n).toLocaleString("en-IN")+
 "."+(x%100n).toString().padStart(2,"0");}catch{return "Amount unavailable";}};
export function NativeCsrFundingBudgetPanel({token,proposalRef,version,onExpired}:{
 token:string;proposalRef:string;version:number;onExpired:()=>void}){
 const [budgets,setBudgets]=useState<Budget[]>([]);
 const [budget,setBudget]=useState("");
 const [expenses,setExpenses]=useState<Expense[]>([]),[expense,setExpense]=useState("");
 const [allocations,setAllocations]=useState<{allocationRef:string;remainingMinor:string}[]>([]),
  [original,setOriginal]=useState("");
 const [party,setParty]=useState<Party>("CSR"),[kind,setKind]=useState<Kind>("ALLOCATE");
 const [rupees,setRupees]=useState(""),[pending,setPending]=useState<Command|null>(null);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState(""),[epoch,setEpoch]=useState(0);
 const lists=useRef(0),expensesEpoch=useRef(0),lock=useRef(false);
 const api=async<T,>(suffix:string,command?:Command):Promise<T>=>{
  const response=await identityRequest("/api/v1/csr/funding-proposals/"+proposalRef+
   "/finance"+suffix,{cache:"no-store",headers:{
    Authorization:"Bearer "+token,...(command?{"Content-Type":"application/json"}:{})},
    ...(command?{method:"POST",body:JSON.stringify(command)}:{})});
  if(response.status===401){onExpired();throw Object.assign(Error("Sign in again."),{status:401});}
  const value:unknown=await response.json().catch(()=>null);
  if(!response.ok||value===null)throw Object.assign(Error(response.status===403?
   "Current budget or branch permission is unavailable.":response.status===409?
   "The original approved budget or posted expense changed. Refresh.":
   "Original Finance budget outcome is uncertain."),{status:response.status||503});
  return value as T;
 };
 useEffect(()=>{
  let active=true;const n=++lists.current;setLoading(true);setError("");
  void api<{items:Budget[]}>("/budgets").then(v=>{
   if(active&&lists.current===n){setBudgets(v.items);
    setBudget(old=>v.items.some(x=>x.budgetRef===old)?old:v.items[0]?.budgetRef??"");}
  }).catch(e=>{if(active&&lists.current===n){setBudgets([]);setBudget("");
   setError(e instanceof Error?e.message:"Approved budgets unavailable.");}})
   .finally(()=>{if(active&&lists.current===n)setLoading(false);});
  return()=>{active=false;lists.current++;};
 },[token,proposalRef,epoch]);
 useEffect(()=>{
  let active=true;const n=++expensesEpoch.current;setExpenses([]);setExpense("");
  if(kind==="UTILIZE"&&budget){
   void api<{items:Expense[]}>("/budgets/"+budget+"/expenses").then(v=>{
    if(active&&expensesEpoch.current===n)setExpenses(v.items);
   }).catch(e=>{if(active&&expensesEpoch.current===n)
    setError(e instanceof Error?e.message:"Current posted expenses unavailable.");});
  }
  return()=>{active=false;expensesEpoch.current++;};
 },[token,proposalRef,budget,kind,epoch]);
 useEffect(()=>{
  let active=true;setAllocations([]);setOriginal("");
  if(kind==="DEALLOCATE"&&budget){
   void api<{items:{allocationRef:string;remainingMinor:string}[]}>(
    "/budgets/"+budget+"/allocations?partyKind="+party)
    .then(v=>{if(active)setAllocations(v.items);})
    .catch(e=>{if(active)setError(e instanceof Error?e.message:"Original allocations unavailable.");});
  }
  return()=>{active=false;};
 },[token,proposalRef,budget,party,kind,epoch]);
 const submit=async()=>{
  if(lock.current||loading||busy||(!budget&&!pending))return;
  const value=kind!=="UTILIZE"?minor(rupees):
   expenses.find(x=>x.journalRef===expense)?.amountMinor??null;
  if(!pending&&(!value||kind==="DEALLOCATE"&&!original)){
   setError("Choose the original unspent allocation or posted Finance expense.");return;}
  const command=pending??{requestKey:Crypto.randomUUID(),expectedVersion:version,
   budgetRef:budget,partyKind:party,kind,amountMinor:value!,
   journalRef:kind==="UTILIZE"?expense:null,
   correctionOfEventRef:kind==="DEALLOCATE"?original:null};
  lock.current=true;setBusy(true);setPending(command);setError("");setNotice("");
  try{
   await api("/budget-effects",command);
   setPending(null);setRupees("");setExpense("");setOriginal("");setEpoch(x=>x+1);
   setNotice("Original CG09 approved budget effect recorded. No new bank money was created.");
  }catch(e){
   const code=e&&typeof e==="object"&&"status" in e?Number(e.status):503;
   if(code>0&&code<500)setPending(null);
   setError(code>=500||code===0?
    "Outcome uncertain. Retry the EXACT same command or check original Finance.":
    e instanceof Error?e.message:"Finance action rejected.");
  }finally{lock.current=false;setBusy(false);}
 };
 const pick=(label:string,selected:boolean,fn:()=>void,disabled=false)=><Pressable
  accessibilityRole="radio" accessibilityState={{checked:selected,disabled:disabled||busy}}
  disabled={disabled||busy} onPress={fn}
  style={[styles.choice,selected&&styles.active]}>
  <Text style={styles.note}>{selected?"● ":"○ "}{label}</Text>
 </Pressable>;
 return <View style={styles.panel}>
  <Text style={styles.title}>3. Approved Budget & Utilization — original CG09</Text>
  <Text style={styles.note}>Only original CG09 approved budgets and posted Finance expense
   vouchers can be selected. Allocation cannot exceed current verified bank money.</Text>
  {loading?<ActivityIndicator/>:
   !budgets.length?<Text style={styles.note}>No eligible original approved CG09
    budget. Approve a matching budget in Finance first.</Text>:
    <View style={styles.panel}>
     <Text style={styles.title}>Approved category and budget</Text>
     {budgets.map(v=>pick(v.name+" · "+v.category+" · "+money(v.ceilingMinor),
      budget===v.budgetRef,()=>setBudget(v.budgetRef),!!pending))}
     <Text style={styles.title}>Original category / quantity / rate</Text>
     {budgets.find(x=>x.budgetRef===budget)?.items?.length?
      budgets.find(x=>x.budgetRef===budget)!.items.map((v,i)=>
       <Text key={i} style={styles.note}>{v.description} ·
        {(Number(v.quantityMilli)/1000).toFixed(3)} × {money(v.unitRateMinor)}
        {" = "}{money(v.totalMinor)}</Text>):
      <Text style={styles.note}>No item breakdown recorded in this approved CG09 budget.</Text>}
     <Text style={styles.title}>Funding share</Text>
     {pick("CSR partner share",party==="CSR",()=>setParty("CSR"),!!pending)}
     {pick("Foundation share",party==="FOUNDATION",()=>setParty("FOUNDATION"),!!pending)}
     <Text style={styles.title}>Financial effect</Text>
     {pick("Allocate verified bank funds",kind==="ALLOCATE",()=>setKind("ALLOCATE"),!!pending)}
     {pick("Correct unused original allocation",kind==="DEALLOCATE",()=>setKind("DEALLOCATE"),!!pending)}
     {pick("Utilize existing posted expense",kind==="UTILIZE",()=>setKind("UTILIZE"),!!pending)}
     {kind!=="UTILIZE"?<TextInput style={styles.input} value={rupees}
      editable={!busy&&!pending} inputMode="decimal" placeholder="Amount in INR"
      onChangeText={setRupees}/>:
      <View>
       <Text style={styles.note}>Original unutilized posted Finance voucher</Text>
       {expenses.length===0?<Text style={styles.note}>No eligible posted expense found.</Text>:
        expenses.map(v=>pick(v.voucherNumber+" · "+v.postedDate+" · "+money(v.amountMinor),
         expense===v.journalRef,()=>setExpense(v.journalRef),!!pending))}
      </View>}
     {kind==="DEALLOCATE"&&<View style={styles.panel}>
      <Text style={styles.title}>Original allocation being corrected</Text>
      {allocations.map(a=>pick("Unspent "+money(a.remainingMinor),
       original===a.allocationRef,()=>setOriginal(a.allocationRef),!!pending))}
      {!allocations.length&&<Text style={styles.note}>No unspent original allocation available.</Text>}
     </View>}
     <Pressable accessibilityRole="button"
      accessibilityState={{disabled:busy||!pending&&(!budget||kind!=="UTILIZE"&&!minor(rupees)||
       kind==="UTILIZE"&&!expense||kind==="DEALLOCATE"&&!original)}} disabled={busy||!pending&&(!budget||
        kind!=="UTILIZE"&&!minor(rupees)||kind==="UTILIZE"&&!expense||kind==="DEALLOCATE"&&!original)}
      onPress={()=>void submit()} style={styles.choice}>
      <Text style={styles.action}>{pending?"Retry exact original CG09 command":
       "Record original CG09 budget effect"}</Text>
     </Pressable>
    </View>}
  <Pressable accessibilityRole="button" disabled={busy} onPress={()=>setEpoch(x=>x+1)}
   style={styles.choice}><Text style={styles.action}>Refresh original Finance budgets</Text></Pressable>
  {!!notice&&<Text style={styles.success}>{notice}</Text>}
  {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
 </View>;
}
const styles=StyleSheet.create({
 panel:{backgroundColor:"#fff",borderColor:"#CBD5E1",borderWidth:1,
  borderRadius:12,padding:12,gap:10},
 title:{fontWeight:"700",color:"#0F172A",fontSize:15},
 note:{color:"#475569",fontSize:13},
 choice:{padding:10,borderRadius:9,borderWidth:1,borderColor:"#CBD5E1"},
 active:{backgroundColor:"#EFF6FF",borderColor:"#1D4ED8"},
 input:{borderWidth:1,borderColor:"#94A3B8",borderRadius:8,padding:12,color:"#0F172A"},
 action:{color:"#1D4ED8",fontWeight:"700",fontSize:13},
 error:{color:"#B91C1C",fontSize:13},success:{color:"#166534",fontSize:13}
});
