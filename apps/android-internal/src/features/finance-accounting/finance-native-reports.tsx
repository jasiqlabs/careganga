import {useCallback,useEffect,useState} from "react";
import {BackHandler,Pressable,ScrollView,Text,View} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import * as Crypto from "expo-crypto";
import {File,Paths} from "expo-file-system";
import {financeNativeStyles as s,NativeFinanceAction as Action,NativeFinanceCard as Card,
 NativeFinanceField as Field,NativeFinanceOptions as Options,
 financeNativeRequest as request,financeNativeProblem as problem,
 formatFinanceMoney as money,minorToRupees} from "./finance-native-source-kit";
type ViewKind="summary"|"general-ledger"|"trial-balance"|"day-book"|"cash-book"|"bank-book"|"reconciliation";
type Ledger={accountName?:string;accountCode?:string;account?:string;category?:string;
 code?:string;postingDate?:string;description?:string;postingKind?:string;
 debitMinor?:string;creditMinor?:string;netDebitMinor?:string;netCreditMinor?:string};
type Year={ref:string;name:string},Account={ref:string;code:string;name:string;kind:string};
type Bank={accountRef:string;name:string;code:string};
type BankLine={journalRef:string;financialYearRef:string;postingDate:string;description:string;amountMinor:string};
type Match={reconciliationRef:string;accountName:string;statementDate:string;
 bankItemReference:string;statementAmountMinor:string;varianceMinor:string;status:string};
type Pending={path:string;key:string;body:Record<string,unknown>};
const viewChoices:{ref:ViewKind;label:string}[]=[
 {ref:"summary",label:"Dashboard"},{ref:"general-ledger",label:"General Ledger"},
 {ref:"day-book",label:"Day Book"},{ref:"cash-book",label:"Cash Book"},
 {ref:"bank-book",label:"Bank Book"},{ref:"trial-balance",label:"Trial Balance"},
 {ref:"reconciliation",label:"Bank Reconciliation"}];
const safeCsv=(s:string)=>'"'+(/^\s*[+\-=@]/.test(s)?"'":"")+
 s.replace(/[\r\n]/g," ").replace(/"/g,'""')+'"';
export function FinanceNativeReports({token,canReconcile,canReview,onExit,onExpired}:{
 token:string;canReconcile:boolean;canReview:boolean;onExit:()=>void;onExpired:()=>void}){
 const [view,setView]=useState<ViewKind>("summary");
 const [years,setYears]=useState<Year[]>([]),[accounts,setAccounts]=useState<Account[]>([]);
 const [year,setYear]=useState(""),[account,setAccount]=useState("");
 const [from,setFrom]=useState(""),[to,setTo]=useState("");
 const [offset,setOffset]=useState(0),[next,setNext]=useState<number|null>(null);
 const [rows,setRows]=useState<Ledger[]>([]);
 const [summary,setSummary]=useState<{incomeMinor:string;expenseMinor:string;
  surplusMinor:string;fundsMinor:string;cashBankMinor:string}|null>(null);
 const [trial,setTrial]=useState<{totalDebitMinor:string;totalCreditMinor:string;balanced:boolean}|null>(null);
 const [banks,setBanks]=useState<Bank[]>([]);
 const [bank,setBank]=useState(""),[bankLines,setBankLines]=useState<BankLine[]>([]);
 const [journal,setJournal]=useState("");
 const [statementRef,setStatementRef]=useState(""),[statementDate,setStatementDate]=useState(""),
  [amount,setAmount]=useState("");
 const [matches,setMatches]=useState<Match[]>([]),[review,setReview]=useState("");
 const [password,setPassword]=useState(""),[decision,setDecision]=useState<"VERIFY"|"REJECT">("VERIFY");
 const [pending,setPending]=useState<Pending|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const problemView=(e:unknown)=>{setError(problem(e));
  if(e instanceof Error&&e.message==="SESSION_EXPIRED")onExpired();};
 const load=useCallback(async()=>{
  setBusy(true);setError("");
  try{
   if(view==="reconciliation"){
    const [b,m]=await Promise.all([
     request<{banks:Bank[]}>(token,"/api/finance-accounting/reports/reconciliation/banks"),
     request<{items:Match[];nextOffset:number|null}>(token,
      "/api/finance-accounting/reports/reconciliation/matches?offset="+offset)]);
    setBanks(b.banks);setMatches(m.items);setNext(m.nextOffset);
   }else if(view==="summary"){
    const value=await request<typeof summary>(token,
     "/api/finance-accounting/reports/summary"+(year?"?yearRef="+year:""));
    setSummary(value);setRows([]);setNext(null);
   }else{
    if(view==="trial-balance"&&!year){setRows([]);setTrial(null);
     setError("Select the financial year before calculating a trial balance.");return;}
    const params=new URLSearchParams();
    if(year)params.set("yearRef",year);
    if(view==="general-ledger"&&account)params.set("accountRef",account);
    if(from&&view!=="trial-balance")params.set("from",from);
    if(to&&view!=="trial-balance")params.set("to",to);
    if(view!=="trial-balance")params.set("offset",String(offset));
    const response=await request<{lines?:Ledger[];accounts?:Ledger[];
     totalDebitMinor?:string;totalCreditMinor?:string;balanced?:boolean;
     nextOffset?:number|null}>(token,
     "/api/finance-accounting/reports/"+view+"?"+params.toString());
    const v=response.lines??response.accounts;
    if(!Array.isArray(v))throw Error("UNKNOWN");
    setRows(v);setNext(response.nextOffset??null);
    setTrial(view==="trial-balance"?{
     totalDebitMinor:response.totalDebitMinor??"0",
     totalCreditMinor:response.totalCreditMinor??"0",
     balanced:response.balanced===true}:null);
   }
  }catch(e){problemView(e);setRows([]);}
  finally{setBusy(false);}
 },[token,view,year,account,from,to,offset,onExpired]);
 useEffect(()=>{void load();},[load]);
 useEffect(()=>{let alive=true;void(async()=>{
  try{
   const opts=await request<{years:Year[];accounts:Account[]}>(token,
    "/api/finance-accounting/reports/options");
   if(alive){setYears(opts.years);setAccounts(opts.accounts);}
  }catch(e){if(alive)problemView(e);}})();return()=>{alive=false;};
 },[token,onExpired]);
 useEffect(()=>{let alive=true;if(view!=="reconciliation"||!bank){
   setBankLines([]);return;
  }
  void(async()=>{try{
   const x=await request<{lines:BankLine[]}>(token,
    "/api/finance-accounting/reports/reconciliation/banks/"+bank+"/entries");
   if(alive)setBankLines(x.lines);
  }catch(e){if(alive)problemView(e);}})();
  return()=>{alive=false;};
 },[token,view,bank,onExpired]);
 useEffect(()=>{const sub=BackHandler.addEventListener("hardwareBackPress",()=>{
  onExit();return true;});return()=>sub.remove();
 },[onExit]);
 async function post(cmd:Pending){
  if(busy)return;setBusy(true);setError("");setNotice("");
  try{
   const result=await request<{confirmed:boolean;status:string}>(token,cmd.path,"POST",cmd.body);
   if(!result.confirmed)throw Error("UNKNOWN");
   setPending(null);setReview("");setPassword("");
   setNotice("Original bank statement match: "+result.status+
    ". This is not a payment gateway settlement.");void load();
  }catch(e){setPending(cmd);problemView(e);}
  finally{setBusy(false);}
 }
 function record(){
  const x=bankLines.find(x=>x.journalRef===journal);
  if(!x||!statementRef||!statementDate||!amount||pending)return;
  const k=Crypto.randomUUID();
  void post({key:k,path:"/api/finance-accounting/reports/reconciliation/matches",
   body:{requestKey:k,bankRef:bank,journalRef:journal,
    financialYearRef:x.financialYearRef,statementDate,
    bankItemReference:statementRef,statementAmount:amount}});
 }
 function verify(){
  if(!review||!password||pending)return;
  const k=Crypto.randomUUID();
  void post({key:k,path:"/api/finance-accounting/reports/reconciliation/matches/"+
   review+"/decision",body:{requestKey:k,currentPassword:password,action:decision}});
 }
 async function exportVisible(){
  if(!rows.length||busy)return;
  setBusy(true);setError("");
  let file:File|null=null;
  try{
   const headers=view==="trial-balance"?
    ["accountName","code","category","netDebitMinor","netCreditMinor"]:
    view==="general-ledger"?
    ["postingDate","accountName","description","debitMinor","creditMinor"]:
    ["postingDate","account","description","debitMinor","creditMinor"];
   const csv=[headers.map(safeCsv).join(","),...rows.map(x=>headers.map(k=>
    safeCsv(String((x as Record<string,unknown>)[k]??""))).join(","))].join("\r\n");
   file=new File(Paths.cache,"careganga-"+view+"-visible-page-"+Crypto.randomUUID()+".csv");
   file.create();await file.write(csv);
   await file.preview({title:"CareGanga posted finance report (visible page)"});
  }catch{setError("The current posted report could not be exported to a local file.");}
  finally{try{file?.delete();}catch{}setBusy(false);}
 }
 return <SafeAreaView style={s.screen} edges={["top","bottom"]}>
  <View style={s.header}><Pressable accessibilityRole="button" onPress={onExit}>
   <Text style={s.back}>‹ Back</Text></Pressable>
   <Text accessibilityRole="header" style={s.title}>Financial Ledger & Reports</Text></View>
  <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
   <Text style={s.muted}>Only original posted double-entry lines. No invented fund collections.</Text>
   {!!error&&<Text accessibilityRole="alert" style={s.alert}>{error}</Text>}
   {!!notice&&<Text accessibilityRole="alert" style={s.muted}>{notice}</Text>}
   {pending&&<Card title="Original bank decision uncertain">
    <Action label="Refresh original register" secondary onPress={()=>void load()}/>
    <Text style={s.muted}>Review the existing bank statement item before another financial action.</Text>
   </Card>}
   <Options label="Finance book" value={view} options={viewChoices}
    onChange={v=>{setView(v as ViewKind);setOffset(0);}}/>
   {view!=="reconciliation"&&<>
    <Options label="Financial year" value={year}
     options={[{ref:"",label:"All years"},...years.map(y=>({ref:y.ref,label:y.name}))]}
     onChange={v=>{setYear(v);setOffset(0);}}/>
    {view==="general-ledger"&&<Options label="General Ledger account" value={account}
     options={[{ref:"",label:"All accounts"},...accounts.map(a=>({
      ref:a.ref,label:a.code+" · "+a.name}))]}
     onChange={v=>{setAccount(v);setOffset(0);}}/>}
    {view!=="summary"&&view!=="trial-balance"&&<>
     <Field label="Date from (YYYY-MM-DD)" value={from} onChange={setFrom}/>
     <Field label="Date to (YYYY-MM-DD)" value={to} onChange={setTo}/>
    </>}
   </>}
   <Action label="Refresh original financial source" secondary onPress={()=>void load()}/>
   {view==="summary"&&summary&&<Card title="Posted finance dashboard">
    {([["Posted income",summary.incomeMinor],["Posted expenses",summary.expenseMinor],
     ["Surplus",summary.surplusMinor],["Fund balances",summary.fundsMinor],
     ["Cash & bank net",summary.cashBankMinor]] as [string,string][])
     .map(([k,v])=><Text style={s.text} key={k}>{k}: {money(v)}</Text>)}
    <Text style={s.muted}>Drafts, claim approvals and invoice issuance are not cash receipts.</Text>
   </Card>}
   {view==="trial-balance"&&trial&&<Card title="Original balanced trial">
    <Text style={s.text}>Total debits: {money(trial.totalDebitMinor)}</Text>
    <Text style={s.text}>Total credits: {money(trial.totalCreditMinor)}</Text>
    <Text style={trial.balanced?s.muted:s.alert}>{trial.balanced?
     "Balanced source":"Unbalanced source — investigate original journal"}</Text>
   </Card>}
   {!["summary","reconciliation"].includes(view)&&<Card title="Actual posted ledger lines">
    {rows.map((x,i)=><View key={i} style={s.card}>
     <Text style={s.heading}>{x.code??x.accountCode??x.account??""} {x.accountName??""}</Text>
     <Text style={s.muted}>{x.postingDate??""} · {x.description??x.category??""}</Text>
     <Text style={s.text}>Debit: {money(x.netDebitMinor??x.debitMinor??"0")}</Text>
     <Text style={s.text}>Credit: {money(x.netCreditMinor??x.creditMinor??"0")}</Text>
    </View>)}
    {!rows.length&&<Text style={s.muted}>No matching posted lines.</Text>}
    <Action label="Export visible report page" secondary disabled={!rows.length||busy}
     onPress={()=>void exportVisible()}/>
    <View style={s.row}>
     <Action label="Previous" secondary disabled={offset===0}
      onPress={()=>setOffset(v=>Math.max(0,v-50))}/>
     <Action label="Next" secondary disabled={next===null} onPress={()=>setOffset(next??0)}/>
    </View>
   </Card>}
   {view==="reconciliation"&&<Card title="Actual bank statement matching">
    <Text style={s.muted}>A separate reviewer validates a real zero-variance bank
     statement item. It never automatically settles an outgoing payment.</Text>
    {canReconcile&&<>
     <Options label="Registered active bank" value={bank}
      options={banks.map(b=>({ref:b.accountRef,label:b.code+" · "+b.name}))}
      onChange={v=>{setBank(v);setJournal("");}}/>
     <Options label="Original posted bank journal" value={journal}
      options={bankLines.map(x=>({ref:x.journalRef,
       label:x.postingDate+" · "+x.description+" · "+money(x.amountMinor)}))}
      onChange={v=>{setJournal(v);const x=bankLines.find(x=>x.journalRef===v);
       if(x)setAmount(minorToRupees(x.amountMinor));}}/>
     <Field label="Statement item reference" value={statementRef} onChange={setStatementRef}/>
     <Field label="Statement date (YYYY-MM-DD)" value={statementDate} onChange={setStatementDate}/>
     <Field label="Signed statement amount (₹)" value={amount}
      keyboardType="decimal-pad" onChange={setAmount}/>
     <Action label="Record original pending statement match"
      disabled={busy||Boolean(pending)||!journal||!statementRef||!statementDate||!amount}
      onPress={record}/>
    </>}
    <Text style={s.heading}>Statement reconciliation register</Text>
    {matches.map(x=><View key={x.reconciliationRef} style={s.card}>
     <Text style={s.heading}>{x.accountName} · {x.statementDate}</Text>
     <Text style={s.text}>Bank item: {x.bankItemReference}</Text>
     <Text style={s.text}>Statement: {money(x.statementAmountMinor)}
      · Difference: {money(x.varianceMinor)}</Text>
     <Text style={s.muted}>{x.status==="VERIFIED"?"Independently verified":x.status}</Text>
     {x.status==="PENDING"&&canReview&&<Action label="Review original bank item"
      secondary onPress={()=>{setReview(x.reconciliationRef);setPassword("");}}/>}
    </View>)}
    {review&&canReview&&<Card title="Independent bank verifier">
     <Options label="Protected decision" value={decision}
      options={[{ref:"VERIFY",label:"Verify exact match"},{ref:"REJECT",label:"Reject mismatch"}]}
      onChange={v=>setDecision(v as typeof decision)}/>
     <Field label="Current reviewer password" value={password} secure onChange={setPassword}/>
     <Action label="Confirm independent bank decision" disabled={busy||Boolean(pending)||
      password.length<8} onPress={verify}/>
    </Card>}
   </Card>}
  </ScrollView>
 </SafeAreaView>;
}
