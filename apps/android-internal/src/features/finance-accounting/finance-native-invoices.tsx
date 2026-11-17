import {useCallback,useEffect,useState} from "react";
import {BackHandler,Pressable,ScrollView,Text,View} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import * as Crypto from "expo-crypto";
import {File,Paths} from "expo-file-system";
import {financeNativeStyles as s,NativeFinanceAction as Action,NativeFinanceCard as Card,
 NativeFinanceField as Field,NativeFinanceOptions as Options,
 financeNativeRequest as request,financeNativeProblem as problem,
 formatFinanceMoney as money,minorToRupees} from "./finance-native-source-kit";
type Stage="INFO"|"ITEMS"|"PAYMENT";
type Invoice={invoiceRef:string;invoiceNumber:string;status:string;version:number;
 counterpartyName:string|null;invoiceDate:string|null;totalMinor:string|null};
type Detail={invoiceRef:string;invoiceNumber:string;status:string;version:number;
 draft:{info?:Record<string,unknown>;items?:Record<string,unknown>;payment?:Record<string,unknown>}};
type Year={yearRef:string;name:string;status:string};
type Branch={branchRef:string;name:string;version:number};
type Account={accountRef:string;code:string;name:string;category:string;branchRef:string|null};
type Receipt={paymentVerified:boolean;receiptRef?:string;receiptNumber?:string;amountMinor?:string};
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
 const [receiptDocument,setReceiptDocument]=useState<DocumentState|null>(null);
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
 const change=<K extends keyof Form>(field:K,value:Form[K])=>{
  setForm(old=>({...old,[field]:value}));setNotice("");
 };
 async function receiptRefresh(invoiceRef:string){
  if(!canIssue)return;
  try{
   const result=await request<Receipt>(token,
    "/api/finance-accounting/invoices/"+invoiceRef+"/receipt");
   setReceipt(result);
   if(result.paymentVerified&&result.receiptRef){
    const r=await request<DocumentState>(token,
     "/api/documents/finance-receipts/receipts/"+result.receiptRef+"/status");
    setReceiptDocument(r);setReceiptOptions([]);
   }else{
    const r=await request<{matches:ReceiptOption[]}>(token,
     "/api/finance-accounting/invoices/"+invoiceRef+"/receipt-options");
    setReceiptOptions(r.matches);setReceiptDocument(null);
   }
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
   setReceipt(null);setDocument(null);setReceiptOptions([]);
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
   if(ref&&(result.status==="ISSUED"||result.status==="PAID_VERIFIED"))
    void receiptRefresh(ref);
  }catch(e){setPending(command);setError(problem(e));expire(e);}
  finally{setBusy(false);}
 }
 function saveStage(){
  if(busy||pending)return;
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
   if(pending.path.includes("/finance-receipts/")&&receipt?.receiptRef){
    const state=await request<DocumentState>(token,
      "/api/documents/finance-receipts/receipts/"+receipt.receiptRef+"/status");
    if(state.status==="ISSUED"){setReceiptDocument(state);setPending(null);
      setNotice("Original verified receipt PDF confirmed.");
    }else setNotice("Private receipt issue is not confirmed; retry only the same request.");
    return;
   }
   if(pending.path.endsWith("/link-receipt")&&current){
    const actual=await receiptRefresh(current.ref);
    if(actual?.paymentVerified){setPending(null);setNotice("Original verified receipt is recorded.");}
    else setNotice("The original bank receipt is not yet confirmed.");
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
       {ref:"PAYMENT",label:"3. Accounts & Tax"}]}
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
     <Action label="Save original invoice draft stage" disabled={busy||Boolean(pending)}
      onPress={saveStage}/>
    </>}
    {current?.status==="DRAFT"&&<Action label="Review & Submit to protected reviewer"
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
    {current?.status==="ISSUED"&&canIssue&&<Card title="Separate verified payment">
     {receipt?.paymentVerified?<>
      <Text style={s.text}>{receipt.receiptNumber} · {money(receipt.amountMinor)}</Text>
      {receiptDocument?.canDownload&&receiptDocument.documentRef?
       <Action label="Open private paid receipt PDF" onPress={()=>void pdf(
        "/api/documents/finance-receipts/files/"+receiptDocument.documentRef+"/download")}/>:
       <Action label="Issue receipt from actual verified bank collection"
        disabled={busy||Boolean(pending)} onPress={()=>{
          const requestKey=key();
          void execute({key:requestKey,method:"POST",path:"/api/documents/finance-receipts/receipts/"+
           receipt.receiptRef+"/issue",body:{requestKey}});
        }}/>} 
     </>:<>
      <Text style={s.muted}>Select one independently reconciled bank receipt. No amount is inferred.</Text>
      <Options label="Eligible verified bank collection" value={receiptChoice}
       options={receiptOptions.map(o=>({ref:o.reconciliationRef,
        label:o.bankName+" · "+o.statementDate+" · "+money(o.amountMinor)}))}
       onChange={setReceiptChoice}/>
      <Action label="Link this original received payment once"
       disabled={!receiptChoice||busy||Boolean(pending)} onPress={()=>workflow("link-receipt")}/>
     </>}
     <Action label="Refresh verified receipt" secondary onPress={()=>void receiptRefresh(current.ref)}/>
    </Card>}
   </Card>}
  </ScrollView>
 </SafeAreaView>;
}
