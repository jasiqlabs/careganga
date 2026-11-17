import {useCallback,useEffect,useState} from "react";
import {BackHandler,Pressable,ScrollView,Text,View} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import * as Crypto from "expo-crypto";
import {File,Paths,UploadType} from "expo-file-system";
import * as DocumentPicker from "expo-document-picker";
import {identityRequest} from "../identity-access/http-client";
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
 bankItemReference:string;statementAmountMinor:string;varianceMinor:string;status:string;canUpload:boolean};
type StatementFile={fileRef:string;fileVersion:number;mime:string;sizeBytes:string};
type Picked={uri:string;name:string;mime:string;size:number};
type UploadState={status:string;uploadRef:string;uploadUrl?:string;
 uploadHeaders?:Record<string,string>;cleanVerified?:boolean;fileRef?:string|null;fileVersion?:number|null};
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
 const [statementFiles,setStatementFiles]=useState<StatementFile[]>([]);
 const [statementFileRef,setStatementFileRef]=useState("");
 const [inspected,setInspected]=useState(false);
 const [uploadMatch,setUploadMatch]=useState("");
 const [picked,setPicked]=useState<Picked|null>(null);
 const [uploadRef,setUploadRef]=useState(""),[uploadKey,setUploadKey]=useState("");
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
 useEffect(()=>{let live=true;
  setStatementFiles([]);setStatementFileRef("");setInspected(false);
  if(!review||!canReview)return;
  void(async()=>{try{
   const source=await request<{files:StatementFile[]}>(token,
    "/api/documents/finance-bank-statements/matches/"+review+"/files");
   if(live)setStatementFiles(source.files);
  }catch(e){if(live)problemView(e);}})();
  return()=>{live=false;};
 },[token,review,canReview,onExpired]);
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
  if(!review||password.length<8||pending)return;
  const file=statementFiles.find(x=>x.fileRef===statementFileRef);
  if(decision==="VERIFY"&&(!inspected||!file)){
   setError("Inspect and select the scanned bank statement before verification.");return;
  }
  const k=Crypto.randomUUID();
  void post({key:k,path:"/api/finance-accounting/reports/reconciliation/matches/"+
   review+"/decision",body:{requestKey:k,currentPassword:password,action:decision,
    ...(decision==="VERIFY"&&file?{statementFileRef:file.fileRef,
     statementFileVersion:file.fileVersion}:{})}});
 }
 async function chooseStatement(){
  if(busy||!canReconcile||!uploadMatch)return;
  try{
   const result=await DocumentPicker.getDocumentAsync({multiple:false,
    type:["application/pdf","image/jpeg","image/png","image/webp"],copyToCacheDirectory:true});
   if(result.canceled)return;
   const file=result.assets?.[0];
   if(!file||!file.mimeType||!["application/pdf","image/jpeg","image/png","image/webp"].includes(file.mimeType)||
    !file.size||file.size<1||file.size>10485760)
    throw Error("Select a PDF or image under 10 MB.");
   setPicked({uri:file.uri,name:file.name,mime:file.mimeType,size:file.size});
   setUploadKey("");setUploadRef("");setNotice("Selected private statement: "+file.name);
  }catch(e){problemView(e);}
 }
 async function checkStatement(){
  if(!uploadRef||busy)return;
  setBusy(true);setError("");
  try{
   const value=await request<UploadState>(token,
    "/api/documents/finance-bank-statements/intents/"+uploadRef);
   setNotice(value.cleanVerified?"Original private statement scanned and verified.":
    "Original statement not confirmed: "+value.status.replaceAll("_"," ")+".");
  }catch(e){problemView(e);}finally{setBusy(false);}
 }
 async function uploadStatement(){
  if(!picked||!uploadMatch||busy||!canReconcile)return;
  const key=uploadKey||Crypto.randomUUID();setUploadKey(key);
  setBusy(true);setError("");setNotice("");
  try{
   const file=new File(picked.uri),digest=await file.digest("SHA-256");
   if(!/^[a-f0-9]{64}$/.test(digest))throw Error("UNKNOWN");
   const init=await request<UploadState>(token,
    "/api/documents/finance-bank-statements/intents","POST",{
     reconciliationRef:uploadMatch,requestKey:key,mime:picked.mime,
     sizeBytes:picked.size,sha256:digest});
   if(!init.uploadRef)throw Error("UNKNOWN");
   setUploadRef(init.uploadRef);
   if(init.status==="UPLOAD_READY"&&init.uploadUrl?.startsWith("https://")&&
      init.uploadHeaders?.["Content-Type"]===picked.mime){
    const task=file.createUploadTask(init.uploadUrl,{
     httpMethod:"PUT",uploadType:UploadType.BINARY_CONTENT,
     mimeType:picked.mime,headers:init.uploadHeaders,sessionType:"foreground"});
    let result;
    try{result=await task.uploadAsync();}finally{task.release();}
    // Create-only object keys can return precondition failure on uncertain retry.
    if((result.status<200||result.status>=300)&&result.status!==412)
     throw Error("UNKNOWN");
   }else if(init.status!=="VALIDATED")throw Error("UNKNOWN");
   const verified=await request<UploadState>(token,
    "/api/documents/finance-bank-statements/intents/"+init.uploadRef+"/confirm","POST",{});
   if(!verified.cleanVerified||!verified.fileRef||!verified.fileVersion)throw Error("UNKNOWN");
   setNotice("Bank statement privately scanned. A different finance reviewer must inspect it.");
   setUploadMatch("");setPicked(null);setUploadKey("");setUploadRef("");
  }catch(e){problemView(e);}finally{setBusy(false);}
 }
 async function openStatement(){
  const current=statementFiles.find(x=>x.fileRef===statementFileRef);
  if(!current||busy)return;
  setBusy(true);setError("");setInspected(false);
  let local:File|null=null;
  try{
   const res=await identityRequest(
    "/api/documents/finance-bank-statements/files/"+current.fileRef+"/download",{
    method:"GET",headers:{Authorization:"Bearer "+token},cache:"no-store"});
   if(res.status===401){onExpired();throw Error("SESSION_EXPIRED");}
   if(!res.ok)throw Error("The original statement is unavailable to your role.");
   const type=(res.headers.get("content-type")??"").split(";")[0];
   if(type!==current.mime)throw Error("The private file type changed.");
   const bytes=new Uint8Array(await res.arrayBuffer());
   if(bytes.length<1||bytes.length>10485760)throw Error("Invalid original statement.");
   const ext=type==="application/pdf"?"pdf":type==="image/jpeg"?"jpg":
    type==="image/png"?"png":"webp";
   local=new File(Paths.cache,"careganga-private-bank-statement-"+Crypto.randomUUID()+"."+ext);
   local.create();await local.write(bytes);
   await local.preview({title:"CareGanga private bank statement"});
   setNotice("Compare the document with the recorded bank item, then explicitly confirm inspection.");
  }catch(e){problemView(e);}finally{try{local?.delete();}catch{}setBusy(false);}
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
     <Text style={s.muted}>{x.status==="VERIFIED"?"Bank statement reviewed":x.status}</Text>
     {x.status==="PENDING"&&x.canUpload&&canReconcile&&
      <Action label="Attach original bank statement" secondary onPress={()=>{
       setUploadMatch(x.reconciliationRef);setPicked(null);setUploadKey("");setUploadRef("");}}/>}
     {x.status==="PENDING"&&canReview&&<Action label="Review original bank item"
      secondary onPress={()=>{setReview(x.reconciliationRef);setPassword("");}}/>}
    </View>)}
    {uploadMatch&&canReconcile&&<Card title="Original private bank statement">
     <Text style={s.muted}>Only the genuine PDF or image can proceed to an independent review.</Text>
     <Action label="Choose bank statement" secondary disabled={busy} onPress={()=>void chooseStatement()}/>
     {picked&&<Text style={s.text}>{picked.name}</Text>}
     {picked&&<Action label="Upload and scan original" disabled={busy}
      onPress={()=>void uploadStatement()}/>}
     {!!uploadRef&&<Action label="Check existing upload status" secondary disabled={busy}
      onPress={()=>void checkStatement()}/>}
     <Action label="Close upload" secondary disabled={busy} onPress={()=>setUploadMatch("")}/>
    </Card>}
    {review&&canReview&&<Card title="Independent bank verifier">
     <Text style={s.muted}>Open and inspect the actual protected statement document before signing.</Text>
     <Options label="Scanned bank statement" value={statementFileRef}
      options={statementFiles.map((f,i)=>({ref:f.fileRef,label:
       "Statement document "+(i+1)+" · "+f.mime.replace("application/","").replace("image/","")}))}
      onChange={v=>{setStatementFileRef(v);setInspected(false);}}/>
     {!!statementFileRef&&<Action label="Open private statement" secondary
      disabled={busy} onPress={()=>void openStatement()}/>}
     {!!statementFileRef&&<Action label={inspected?
      "Statement inspection acknowledged":"I inspected the bank item, date and amount"}
      secondary disabled={busy} onPress={()=>setInspected(v=>!v)}/>
     <Options label="Protected decision" value={decision}
      options={[{ref:"VERIFY",label:"Verify exact match"},{ref:"REJECT",label:"Reject mismatch"}]}
      onChange={v=>setDecision(v as typeof decision)}/>
     <Field label="Current reviewer password" value={password} secure onChange={setPassword}/>
     <Action label="Confirm independent bank decision" disabled={busy||Boolean(pending)||
      password.length<8||(decision==="VERIFY"&&(!inspected||!statementFileRef))}
      onPress={verify}/>
    </Card>}
   </Card>}
  </ScrollView>
 </SafeAreaView>;
}
