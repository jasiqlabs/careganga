import {useCallback,useEffect,useState} from "react";
import {BackHandler,Pressable,ScrollView,Text,View} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import * as Crypto from "expo-crypto";
import {File,Paths} from "expo-file-system";
import {identityRequest} from "../identity-access/http-client";
import {financeNativeStyles as s,NativeFinanceAction as Action,NativeFinanceCard as Card,
 NativeFinanceField as Field,NativeFinanceOptions as Options,
 financeNativeRequest as request,financeNativeProblem as problem,
 formatFinanceMoney as money,minorToRupees} from "./finance-native-source-kit";
type Stage="INFO"|"ITEMS"|"PAYMENT"|"REVIEW";
type InvoiceDashboard={cards:{total:number;drafts:number;pending:number;approved:number;
 issued:number;rejected:number;returned:number;paidVerified:number;partiallyPaid:number;
 issuedMinor:string;receivedVerifiedMinor:string};monthly:{month:string;count:number}[];explanation:string};
type Invoice={invoiceRef:string;invoiceNumber:string;status:string;version:number;
 counterpartyName:string|null;invoiceDate:string|null;totalMinor:string|null};
type Detail={invoiceRef:string;invoiceNumber:string;status:string;version:number;
 draft:{info?:Record<string,unknown>;items?:Record<string,unknown>;payment?:Record<string,unknown>}};
type Year={yearRef:string;name:string;status:string};
type Branch={branchRef:string;name:string;version:number};
type Account={accountRef:string;code:string;name:string;category:string;branchRef:string|null};
type ReceiptRow={receiptRef:string;receiptNumber:string;amountMinor:string;paidDate:string};
type Receipt={paymentVerified:boolean;status:string;totalMinor:string;paidMinor:string;
 outstandingMinor:string;receipts:ReceiptRow[]};
type ReceiptOption={reconciliationRef:string;bankName:string;statementDate:string;
 amountMinor:string;statementHint:string};
type DocumentState={status:string;canDownload?:boolean;documentRef?:string};
type Line={description:string;quantity:string;unitRate:string};
type Form={financialYearRef:string;branchRef:string;branchVersion:number|null;
 invoiceDate:string;dueDate:string;category:string;purpose:string;
 counterpartyName:string;counterpartyAddress:string;lines:Line[];
 tax:string;charges:string;receivableAccountRef:string;incomeAccountRef:string;
 taxAccountRef:string;terms:string;notes:string};
const empty=():Form=>({financialYearRef:"",branchRef:"",branchVersion:null,invoiceDate:"",
 dueDate:"",category:"",purpose:"",counterpartyName:"",counterpartyAddress:"",
 lines:[{description:"",quantity:"1",unitRate:""}],tax:"0.00",charges:"0.00",
 receivableAccountRef:"",incomeAccountRef:"",taxAccountRef:"",
 terms:"Payment due per invoice",notes:""});
type Pending={key:string;path:string;method:"POST"|"PATCH";body:Record<string,unknown>};
const key=()=>Crypto.randomUUID();
export function FinanceNativeInvoices({token,canManage,canPost,canIssue,onExit,onExpired}:{
 token:string;canManage:boolean;canPost:boolean;canIssue:boolean;
 onExit:()=>void;onExpired:()=>void}){
 const [list,setList]=useState<Invoice[]>([]);
 const [dashboard,setDashboard]=useState<InvoiceDashboard|null>(null);
 const [current,setCurrent]=useState<{ref:string;number:string;version:number;status:string}|null>(null);
 const [form,setForm]=useState<Form>(empty());
 const [stage,setStage]=useState<Stage>("INFO");
 const [years,setYears]=useState<Year[]>([]);
 const [branches,setBranches]=useState<Branch[]>([]);
 const [accounts,setAccounts]=useState<Account[]>([]);
 const [receipt,setReceipt]=useState<Receipt|null>(null);
 const [receiptOptions,setReceiptOptions]=useState<ReceiptOption[]>([]);
 const [receiptChoice,setReceiptChoice]=useState("");
 const [document,setDocument]=useState<DocumentState|null>(null);
 const [receiptDocs,setReceiptDocs]=useState<Record<string,DocumentState>>({});
 const [collection,setCollection]=useState<{banks:{accountRef:string;code:string;name:string}[];
  years:{yearRef:string;name:string;startOn:string;endOn:string}[]}|null>(null);
 const [bank,setBank]=useState(""),[collectionYear,setCollectionYear]=useState("");
 const [collectionDate,setCollectionDate]=useState(""),[collectionAmount,setCollectionAmount]=useState("");
 const [pending,setPending]=useState<Pending|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),
  [notice,setNotice]=useState("");
 const [offset,setOffset]=useState(0);
 const [next,setNext]=useState<number|null>(null);
 const expire=(e:unknown)=>{if(e instanceof Error&&e.message==="SESSION_EXPIRED")onExpired();};
 const load=useCallback(async()=>{
  try{
   const result=await request<{invoices:Invoice[];nextOffset:number|null}>(token,
    "/api/finance-accounting/invoices/drafts?offset="+offset);
   if(!Array.isArray(result.invoices))throw Error("UNKNOWN");
   setList(result.invoices);setNext(result.nextOffset);
  }catch(e){setError(problem(e));expire(e);}
 },[token,offset,onExpired]);
 useEffect(()=>{void load();},[load]);
 const loadDashboard=useCallback(async()=>{
  try{
   const snapshot=await request<InvoiceDashboard>(token,
    "/api/finance-accounting/invoices/dashboard");
   if(!snapshot?.cards||!Array.isArray(snapshot.monthly))
    throw Error("Original invoice dashboard unavailable");
   setDashboard(snapshot);
  }catch(e){setError(problem(e));expire(e);}
 },[token,onExpired]);
 useEffect(()=>{void loadDashboard();},[loadDashboard]);

 useEffect(()=>{let live=true;
  void(async()=>{try{
   const [o,a]=await Promise.all([
    request<{years:Year[];branches:Branch[]}>(token,"/api/finance-accounting/invoices/options"),
    request<{accounts:Account[]}>(token,"/api/finance-accounting/invoices/posting-accounts")]);
   if(live){setYears(o.years);setBranches(o.branches);setAccounts(a.accounts);}
  }catch(e){if(live)setError(problem(e));expire(e);}})();
  return()=>{live=false;};
 },[token,onExpired]);
 useEffect(()=>{const back=BackHandler.addEventListener("hardwareBackPress",()=>{
  if(current){setCurrent(null);return true;}onExit();return true;});
  return()=>back.remove();
 },[current,onExit]);
 const change=<K extends keyof Form,>(field:K,value:Form[K])=>{
  setForm(old=>({...old,[field]:value}));setNotice("");
 };
 async function receiptRefresh(invoiceRef:string){
  try{
   const result=await request<Receipt>(token,
    "/api/finance-accounting/invoices/"+invoiceRef+"/receipt");
   setReceipt(result);
   if(BigInt(result.outstandingMinor)>0n&&canIssue){
    const r=await request<{matches:ReceiptOption[]}>(token,
     "/api/finance-accounting/invoices/"+invoiceRef+"/receipt-options");
    setReceiptOptions(r.matches??[]);
    if(canPost&&canIssue){
     const eligible=await request<{banks:{accountRef:string;code:string;name:string}[];
      years:{yearRef:string;name:string;startOn:string;endOn:string}[]}>(token,
      "/api/finance-accounting/invoices/"+invoiceRef+"/collection-options");
     setCollection(eligible);
    }
   }else{setReceiptOptions([]);setCollection(null);}
   const docs:Record<string,DocumentState>={};
   for(const item of result.receipts.slice(0,20)){
    try{docs[item.receiptRef]=await request<DocumentState>(token,
     "/api/documents/finance-receipts/receipts/"+item.receiptRef+"/status");
    }catch{docs[item.receiptRef]={status:"UNKNOWN"};}
   }
   setReceiptDocs(docs);
   const d=await request<DocumentState>(token,
    "/api/documents/finance-invoice/invoices/"+invoiceRef+"/status");
   setDocument(d);
   return result;
  }catch(e){setError(problem(e));expire(e);return null;}
 }
 async function open(inv:Invoice){
  setBusy(true);setError("");setNotice("");
  try{
   const detail=await request<Detail>(token,
    "/api/finance-accounting/invoices/drafts/"+inv.invoiceRef);
   const i=detail.draft.info??{},p=detail.draft.payment??{},m=detail.draft.items??{};
   setCurrent({ref:detail.invoiceRef,number:detail.invoiceNumber,
    version:detail.version,status:detail.status});setStage("INFO");setPending(null);
   const lines=Array.isArray(m.rows)?m.rows as Array<Record<string,unknown>>:[];
   setForm({financialYearRef:String(i.financialYearRef??""),branchRef:String(i.branchRef??""),
    branchVersion:typeof i.branchVersion==="number"?i.branchVersion:null,
    invoiceDate:String(i.invoiceDate??""),dueDate:String(i.dueDate??""),
    category:String(i.category??""),purpose:String(i.purpose??""),
    counterpartyName:String(i.counterpartyName??""),
    counterpartyAddress:String(i.counterpartyAddress??""),
    lines:lines.length?lines.map(r=>({description:String(r.description??""),
     quantity:String(r.quantity??"1"),unitRate:minorToRupees(String(r.unitRateMinor??"0"))})):
      [{description:"",quantity:"1",unitRate:""}],
    tax:minorToRupees(String(m.taxMinor??"0")),
    charges:minorToRupees(String(m.chargesMinor??"0")),
    receivableAccountRef:String(p.receivableAccountRef??""),
    incomeAccountRef:String(p.incomeAccountRef??""),
    taxAccountRef:String(p.taxAccountRef??""),
    terms:String(p.terms??"Payment due per invoice"),notes:String(p.notes??"")});
   setReceipt(null);setDocument(null);setReceiptOptions([]);setReceiptDocs({});
   if(["ISSUED","POSTED"].includes(detail.status))void receiptRefresh(detail.invoiceRef);
  }catch(e){setError(problem(e));expire(e);}
  finally{setBusy(false);}
 }
 function formPayload(){
  if(stage==="INFO")return {financialYearRef:form.financialYearRef,
   branchRef:form.branchRef||null,branchVersion:form.branchRef?form.branchVersion:null,
   invoiceDate:form.invoiceDate,dueDate:form.dueDate,category:form.category,
   purpose:form.purpose,counterpartyName:form.counterpartyName,
   counterpartyAddress:form.counterpartyAddress||null};
  if(stage==="ITEMS")return {rows:form.lines.map(r=>({
   description:r.description,quantity:Number(r.quantity),unitRate:r.unitRate})),
   tax:form.tax,charges:form.charges};
  return {receivableAccountRef:form.receivableAccountRef,
   incomeAccountRef:form.incomeAccountRef,taxAccountRef:form.taxAccountRef||null,
   terms:form.terms,notes:form.notes||null};
 }
 async function execute(command:Pending){
  if(busy)return;
  setBusy(true);setError("");setNotice("");
  try{
   const result=await request<{confirmed:boolean;status:string;
    invoiceRef?:string;invoiceNumber?:string;version?:number}>(token,
    command.path,command.method,command.body);
   if(!result.confirmed)throw Error("UNKNOWN");
   setPending(null);
   setNotice("Original invoice operation confirmed: "+result.status+
    ". Reviewer decision, posting and payment are separate.");
   if(result.invoiceRef&&result.invoiceNumber&&result.version){
    setCurrent({ref:result.invoiceRef,number:result.invoiceNumber,
     version:result.version,status:result.status});
   }else if(current&&!command.path.endsWith("/link-receipt")&&
     !command.path.includes("/finance-receipts/"))
    setCurrent({...current,status:result.status});
   void load();
   const ref=result.invoiceRef??current?.ref;
   if(ref&&(result.status==="ISSUED"||result.status==="PAID_VERIFIED"||
      result.status==="PARTIALLY_PAID"||result.status==="POSTED_UNVERIFIED"))
    void receiptRefresh(ref);
  }catch(e){setPending(command);setError(problem(e));expire(e);}
  finally{setBusy(false);}
 }
 function saveStage(){
  if(busy||pending||stage==="REVIEW")return;
  const path=current?"/api/finance-accounting/invoices/drafts/"+current.ref+"/stages":
   "/api/finance-accounting/invoices/drafts";
  const command:Pending={key:key(),path,method:current?"PATCH":"POST",
   body:{stage,data:formPayload(),requestKey:key(),
    ...(current?{expectedVersion:current.version}:{})}};
  command.key=String(command.body.requestKey);
  void execute(command);
 }
 function workflow(kind:"submit"|"reconcile"|"post"|"issue"|"link-receipt"){
  if(!current||busy||pending)return;
  const requestKey=key();
  const body={requestKey,...(kind==="submit"?{expectedVersion:current.version}:{}),
   ...(kind==="link-receipt"?{reconciliationRef:receiptChoice}:{})};
  void execute({key:requestKey,method:"POST",body,
   path:"/api/finance-accounting/invoices/"+current.ref+"/"+kind});
 }
 async function check(){
  if(!pending||busy)return;
  setBusy(true);setError("");
  try{
   if(pending.path.includes("/finance-receipts/")){
    const original=receipt?.receipts.find(r=>pending.path.includes("/"+r.receiptRef+"/"));
    if(!original){setNotice("Refresh the original receipt before checking.");return;}
    const state=await request<DocumentState>(token,
     "/api/documents/finance-receipts/receipts/"+original.receiptRef+"/status");
    setReceiptDocs(d=>({...d,[original.receiptRef]:state}));
    if(state.status==="ISSUED"&&state.canDownload){
     setPending(null);setNotice("Original private receipt PDF confirmed.");
    }else setNotice("Original receipt issue remains unconfirmed. Do not use a new key.");
    return;
   }
   const draft=pending.path.includes("/drafts");
   const result=await request<{confirmed:boolean;status:string;version?:number}>(token,
    "/api/finance-accounting/invoices/"+
    (draft?"draft-commands/":"workflow-commands/")+pending.key);
   if(result.confirmed){
    setPending(null);setNotice("Original invoice request confirmed: "+result.status);
    if(current)await open({...current,invoiceRef:current.ref,
     invoiceNumber:current.number,counterpartyName:null,
     invoiceDate:null,totalMinor:null,version:result.version??current.version});
    void load();
   }else setNotice("Original request unconfirmed; retry only that same request key.");
  }catch(e){setError(problem(e));expire(e);}
  finally{setBusy(false);}
 }
 async function pdf(path:string){
  if(busy)return;setBusy(true);setError("");
  let file:File|null=null;
  try{
   const res=await identityRequest(path,{headers:{Authorization:"Bearer "+token},cache:"no-store"});
   if(res.status===401){onExpired();return;}
   if(!res.ok||res.headers.get("content-type")?.split(";")[0]!=="application/pdf")
    throw Error("UNKNOWN");
   const bytes=new Uint8Array(await res.arrayBuffer());
   if(bytes.length<100||bytes.length>10485760)throw Error("UNKNOWN");
   file=new File(Paths.cache,"careganga-finance-"+key()+".pdf");
   file.create();await file.write(bytes);await file.preview({title:"CareGanga private financial document"});
  }catch(e){setError(problem(e));}finally{try{file?.delete();}catch{}setBusy(false);}
 }
 return <SafeAreaView style={s.screen} edges={["top","bottom"]}>
  <View style={s.header}><Pressable accessibilityRole="button"
   onPress={()=>current?setCurrent(null):onExit()}>
   <Text style={s.back}>‹ Back</Text></Pressable>
   <Text accessibilityRole="header" style={s.title}>Invoices & Receipts</Text></View>
  <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
   <Text style={s.muted}>Original Foundation invoices; approval, accrual, issue and payment are separate.</Text>
   {!!error&&<Text accessibilityRole="alert" style={s.alert}>{error}</Text>}
   {!!notice&&<Text accessibilityRole="alert" style={s.muted}>{notice}</Text>}
   {pending&&<Card title="Original request not confirmed">
    <Action label="Check the same request" secondary disabled={busy} onPress={()=>void check()}/>
    <Action label="Retry exactly the same request" disabled={busy}
     onPress={()=>void execute(pending)}/></Card>}
   {dashboard&&<Card title="Original invoice dashboard">
    {([
     ["Total invoices",String(dashboard.cards.total)],
     ["Draft",String(dashboard.cards.drafts)],
     ["Pending protected review",String(dashboard.cards.pending)],
     ["Approved / posted",String(dashboard.cards.approved)],
     ["Issued",String(dashboard.cards.issued)],
     ["Fully paid, bank verified",String(dashboard.cards.paidVerified)],
     ["Partially paid, bank verified",String(dashboard.cards.partiallyPaid)],
     ["Issued face value",money(dashboard.cards.issuedMinor)],
     ["Verified bank collection",money(dashboard.cards.receivedVerifiedMinor)]
    ] as [string,string][]).map(([name,value])=><Text key={name} style={s.text}>
     {name}: {value}</Text>)}
    <Text style={s.muted}>{dashboard.explanation}</Text>
   </Card>}
   <Card title="Invoice register">
    <Action label="Refresh invoices" secondary onPress={()=>void load()}/>
    {list.map(v=><Pressable key={v.invoiceRef} accessibilityRole="button"
     onPress={()=>void open(v)} style={s.card}>
     <Text style={s.heading}>{v.invoiceNumber}</Text>
     <Text style={s.text}>{v.counterpartyName??"Incomplete draft"} · {money(v.totalMinor)}</Text>
     <Text style={s.muted}>{v.status==="ISSUED"?"Issued, not proof of payment":v.status}</Text>
    </Pressable>)}
    {!list.length&&<Text style={s.muted}>No original invoices saved yet.</Text>}
    <View style={s.row}>
     <Action label="Previous" secondary disabled={offset===0} onPress={()=>setOffset(Math.max(0,offset-40))}/>
     <Action label="Next" secondary disabled={next===null} onPress={()=>setOffset(next??0)}/>
    </View>
   </Card>
   {canManage&&<Card title={current?current.number:"Create an invoice"}>
    <Action label="Create new invoice" secondary onPress={()=>{setCurrent(null);setForm(empty());
     setStage("INFO");setPending(null);}}/>
    {(!current||["DRAFT","RETURNED"].includes(current.status))&&<>
     <Options label="Invoice wizard stage" value={stage}
      options={[{ref:"INFO",label:"1. Information"},{ref:"ITEMS",label:"2. Items"},
       {ref:"PAYMENT",label:"3. Accounts & Tax"},
       {ref:"REVIEW",label:"4. Review & Submit"}]}
      onChange={v=>setStage(v as Stage)}/>
     {stage==="INFO"&&<>
      <Options label="Open financial year" value={form.financialYearRef}
       options={years.filter(x=>x.status==="OPEN").map(y=>({ref:y.yearRef,label:y.name}))}
       onChange={v=>change("financialYearRef",v)}/>
      <Options label="Foundation / active branch" value={form.branchRef}
       options={[{ref:"",label:"Foundation (no branch)"},...branches.map(x=>({ref:x.branchRef,label:x.name}))]}
       onChange={v=>{const b=branches.find(x=>x.branchRef===v);setForm(f=>({
        ...f,branchRef:b?.branchRef??"",branchVersion:b?.version??null}));}}/>
      {(["invoiceDate","dueDate","category","purpose","counterpartyName","counterpartyAddress"] as const)
       .map(k=><Field key={k} label={k==="invoiceDate"?"Invoice date (YYYY-MM-DD)":
        k==="dueDate"?"Due date (YYYY-MM-DD)":k==="counterpartyName"?
        "Customer or organization":k==="counterpartyAddress"?"Address (optional)":k}
        value={form[k]} onChange={v=>change(k,v)}/>)}
     </>}
     {stage==="ITEMS"&&<>
      {form.lines.map((line,i)=><View key={i} style={s.card}>
       <Field label={"Item "+(i+1)+" description"} value={line.description}
        onChange={v=>setForm(f=>({...f,lines:f.lines.map((x,j)=>j===i?{...x,description:v}:x)}))}/>
       <Field label="Quantity" value={line.quantity} keyboardType="number-pad"
        onChange={v=>setForm(f=>({...f,lines:f.lines.map((x,j)=>j===i?{...x,quantity:v}:x)}))}/>
       <Field label="Unit rate (₹)" value={line.unitRate} keyboardType="decimal-pad"
        onChange={v=>setForm(f=>({...f,lines:f.lines.map((x,j)=>j===i?{...x,unitRate:v}:x)}))}/>
       {form.lines.length>1&&<Action label="Remove item" secondary
        onPress={()=>setForm(f=>({...f,lines:f.lines.filter((_,j)=>j!==i)}))}/>}
      </View>)}
      <Action label="Add another item" secondary disabled={form.lines.length>=40}
       onPress={()=>setForm(f=>({...f,lines:[...f.lines,{description:"",quantity:"1",unitRate:""}]}))}/>
      <Field label="Tax amount (₹)" value={form.tax} keyboardType="decimal-pad"
       onChange={v=>change("tax",v)}/>
      <Field label="Other charges (₹)" value={form.charges} keyboardType="decimal-pad"
       onChange={v=>change("charges",v)}/>
     </>}
     {stage==="PAYMENT"&&<>
      {(["receivableAccountRef","incomeAccountRef","taxAccountRef"] as const).map(k=>
       <Options key={k} label={k==="receivableAccountRef"?"Receivable asset account":
        k==="incomeAccountRef"?"Income account":"Tax payable liability (if any)"}
        value={form[k]} options={[{ref:"",label:"Not selected"},...accounts.filter(a=>
         a.category===(k==="receivableAccountRef"?"ASSET":k==="incomeAccountRef"?"INCOME":"LIABILITY"))
         .map(a=>({ref:a.accountRef,label:a.code+" · "+a.name}))]}
        onChange={v=>change(k,v)}/>)}
      <Field label="Payment terms" value={form.terms} onChange={v=>change("terms",v)}/>
      <Field label="Invoice notes" value={form.notes} multiline onChange={v=>change("notes",v)}/>
     </>}
     {stage==="REVIEW"&&<Card title="Review original invoice before submission">
      <Text style={s.text}>Customer: {form.counterpartyName||"Not entered"}</Text>
      <Text style={s.text}>Category: {form.category||"Not entered"}</Text>
      <Text style={s.text}>Purpose: {form.purpose||"Not entered"}</Text>
      <Text style={s.text}>Invoice date: {form.invoiceDate||"Not entered"} · Due date: {form.dueDate||"Not entered"}</Text>
      <Text style={s.text}>Original item lines: {form.lines.length}</Text>
      <Text style={s.text}>Payment terms: {form.terms||"Not entered"}</Text>
      <Text style={s.muted}>Save the first three stages before submission.
       Actual totals are independently calculated by the Finance service.
       Review, posting, document issue and bank payment are separate.</Text>
     </Card>}
     {stage!=="REVIEW"&&<Action label="Save original invoice draft stage" disabled={busy||Boolean(pending)}
      onPress={saveStage}/>}
    </>}
    {current?.status==="DRAFT"&&stage==="REVIEW"&&<Action label="Review & Submit to protected reviewer"
     disabled={busy||Boolean(pending)} onPress={()=>workflow("submit")}/>}
    {current?.status==="SUBMITTED"&&<Action label="Check original reviewer decision"
     disabled={busy||Boolean(pending)} onPress={()=>workflow("reconcile")}/>}
    {current?.status==="APPROVED"&&canPost&&<Action label="Post approved balanced receivable"
     disabled={busy||Boolean(pending)} onPress={()=>workflow("post")}/>}
    {current?.status==="POSTED"&&canIssue&&<Action label="Issue approved invoice PDF"
     disabled={busy||Boolean(pending)} onPress={()=>workflow("issue")}/>}
    {current?.status==="ISSUED"&&<Card title="Private invoice document">
     {document?.status==="ISSUED"&&document.documentRef?
      <Action label="Open private invoice PDF" onPress={()=>void pdf(
       "/api/documents/finance-invoice/files/"+document.documentRef+"/download")}/>:
      <Action label="Check invoice document status" secondary
       onPress={()=>void receiptRefresh(current.ref)}/>}
     <Text style={s.muted}>Issuance is not verified payment or cash received.</Text>
    </Card>}
    {current?.status==="ISSUED"&&<Card title="Verified bank collections and partial receipts">
     <Text style={s.muted}>An invoice issued is not paid. A genuine balanced bank collection
      journal must be independently reconciled with a bank statement.</Text>
     {receipt&&<>
      <Text style={s.heading}>Original invoice {money(receipt.totalMinor)}</Text>
      <Text style={s.text}>Verified received {money(receipt.paidMinor)}</Text>
      <Text style={s.heading}>Outstanding {money(receipt.outstandingMinor)}</Text>
     </>}
     {receipt&&BigInt(receipt.outstandingMinor)>0n&&canIssue&&canPost&&collection&&<Card
      title="1. Post actual bank collection (not yet verified)">
      <Options label="Open financial year" value={collectionYear}
       options={collection.years.map(y=>({ref:y.yearRef,label:y.name}))}
       onChange={setCollectionYear}/>
      <Options label="Real bank account" value={bank}
       options={collection.banks.map(x=>({ref:x.accountRef,label:x.code+" · "+x.name}))}
       onChange={setBank}/>
      <Field label="Collection posting date (YYYY-MM-DD)" value={collectionDate}
       onChange={setCollectionDate}/>
      <Field label="Collection amount (₹)" value={collectionAmount}
       keyboardType="decimal-pad" onChange={setCollectionAmount}/>
      <Action label="Post source-linked balanced bank journal" disabled={busy||Boolean(pending)||
       !collectionYear||!bank||!collectionDate||!collectionAmount}
       onPress={()=>{if(!current)return;const requestKey=key();
        void execute({key:requestKey,method:"POST",
         path:"/api/finance-accounting/invoices/"+current.ref+"/record-collection",
         body:{requestKey,financialYearRef:collectionYear,bankAccountRef:bank,
          postingDate:collectionDate,amount:collectionAmount}});
       }}/>
      <Text style={s.muted}>The posted journal is awaiting independent bank statement
       verification under Finance Ledger and Reports. No receipt is marked paid yet.</Text>
     </Card>}
     {receipt&&BigInt(receipt.outstandingMinor)>0n&&canIssue&&<Card
      title="2. Link independently verified bank statement match">
      <Options label="Verified original bank collection" value={receiptChoice}
       options={receiptOptions.map(o=>({ref:o.reconciliationRef,
        label:o.bankName+" · "+o.statementDate+" · "+money(o.amountMinor)}))}
       onChange={setReceiptChoice}/>
      <Action label="Record one real verified partial/full receipt"
       disabled={!receiptChoice||busy||Boolean(pending)}
       onPress={()=>workflow("link-receipt")}/>
      {!receiptOptions.length&&<Text style={s.muted}>No eligible reconciled bank deposit
       is available. Independently confirm the original bank statement first.</Text>}
     </Card>}
     <Card title="3. Original verified receipt history">
      {!receipt?.receipts.length&&<Text style={s.muted}>No verified bank receipts yet.</Text>}
      {receipt?.receipts.map(item=><View key={item.receiptRef} style={s.card}>
       <Text style={s.heading}>{item.receiptNumber} · {money(item.amountMinor)}</Text>
       <Text style={s.muted}>{item.paidDate}</Text>
       {receiptDocs[item.receiptRef]?.canDownload&&receiptDocs[item.receiptRef]?.documentRef?
        <Action label="Open this private bank-verified receipt PDF"
         onPress={()=>void pdf("/api/documents/finance-receipts/files/"+
          receiptDocs[item.receiptRef].documentRef+"/download")}/>:
        canIssue?<Action label={receiptDocs[item.receiptRef]?.status==="UNKNOWN"?
         "Receipt PDF requires provider recovery":"Issue this verified receipt PDF"}
         disabled={busy||Boolean(pending)||receiptDocs[item.receiptRef]?.status==="UNKNOWN"}
         onPress={()=>{const requestKey=key();void execute({
          key:requestKey,method:"POST",
          path:"/api/documents/finance-receipts/receipts/"+item.receiptRef+"/issue",
          body:{requestKey}});
         }}/> : <Text style={s.muted}>Private receipt document is not yet issued.</Text>}
      </View>)}
     </Card>
     <Action label="Refresh actual verified receipts" secondary
      onPress={()=>void receiptRefresh(current.ref)}/>
    </Card>}
   </Card>}
  </ScrollView>
 </SafeAreaView>;
}
