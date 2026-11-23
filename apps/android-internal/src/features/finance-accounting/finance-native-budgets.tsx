import {useCallback,useEffect,useState} from "react";
import {BackHandler,Pressable,ScrollView,Text,View} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import * as Crypto from "expo-crypto";
import {financeNativeStyles as s,NativeFinanceAction as Action,NativeFinanceCard as Card,
 NativeFinanceField as Field,NativeFinanceOptions as Options,
 financeNativeRequest as request,financeNativeProblem as problem,
 formatFinanceMoney as money,minorToRupees} from "./finance-native-source-kit";
type Year={yearRef:string;name:string;status:string;startOn:string;endOn:string};
type ProjectChoice={value:string;label:string;branchRef:string|null};
type Branch={branchRef:string;name:string;version:number};
type Budget={budgetRef:string;budgetNumber:string;name:string;status:string;version:number;
 category:string;ceilingMinor:string;periodStart:string;periodEnd:string};
type Detail={budgetRef:string;budgetNumber:string;name:string;status:string;version:number;
 category:string;ceilingMinor:string;financialYearRef:string;branchRef:string|null;projectRef?:string|null;projectLabel?:string|null;
 start:string;end:string;allocatedMinor:string;committedOutstandingMinor:string;
 utilizedMinor:string;releasedMinor:string;availableMinor:string;overBudgetMinor:string;
 items:{description:string;quantityMilli:string;unitRateMinor:string;totalMinor:string}[];
 events:{kind:string;amountMinor:string;recordedAt:string}[]};
type Expense={journalRef:string;voucherNumber:string;postedDate:string;amountMinor:string};
type Form={budgetName:string;financialYearRef:string;branchRef:string;branchVersion:number|null;projectRef:string;
 category:string;periodStart:string;periodEnd:string;fundingNote:string;ceiling:string;
 items:{description:string;quantity:string;unitRate:string}[]};
const clear=():Form=>({budgetName:"",financialYearRef:"",branchRef:"",branchVersion:null,projectRef:"",
 category:"",periodStart:"",periodEnd:"",fundingNote:"Foundation budget authorization",ceiling:"",items:[]});
type Pending={key:string;path:string;method:"POST"|"PATCH";body:Record<string,unknown>};
const key=()=>Crypto.randomUUID();
export function FinanceNativeBudgets({token,canManage,onExit,onExpired}:{
 token:string;canManage:boolean;onExit:()=>void;onExpired:()=>void}){
 const [list,setList]=useState<Budget[]>([]);
 const [overview,setOverview]=useState<{total:number;approved:number;submitted:number;
  totalCeilingMinor:string;committedOutstandingMinor:string;allocatedMinor:string;
  utilizedMinor:string;availableMinor:string;overBudgetMinor:string}|null>(null);
 const [year,setYear]=useState<Year[]>([]),[branches,setBranches]=useState<Branch[]>([]),[projects,setProjects]=useState<ProjectChoice[]>([]);
 const [categories,setCategories]=useState<{code:string;name:string}[]>([]);
 const [selected,setSelected]=useState<Detail|null>(null);
 const [form,setForm]=useState<Form>(clear());
 const [expenses,setExpenses]=useState<Expense[]>([]);
 const [kind,setKind]=useState("ALLOCATE"),[amount,setAmount]=useState(""),
  [source,setSource]=useState("");
 const [pending,setPending]=useState<Pending|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [offset,setOffset]=useState(0),[next,setNext]=useState<number|null>(null);
 const fail=(e:unknown)=>{setError(problem(e));
  if(e instanceof Error&&e.message==="SESSION_EXPIRED")onExpired();};
 const load=useCallback(async()=>{
  try{
   const x=await request<{budgets:Budget[];nextOffset:number|null}>(token,
    "/api/finance-accounting/budgets/list?offset="+offset);
   if(!Array.isArray(x.budgets))throw Error("UNKNOWN");
   setList(x.budgets);setNext(x.nextOffset);
  }catch(e){fail(e);}
 },[token,offset,onExpired]);
 useEffect(()=>{void load();},[load]);
 const loadOverview=useCallback(async()=>{
  try{
   const result=await request<{cards:NonNullable<typeof overview>}>(token,
    "/api/finance-accounting/budgets/dashboard");
   setOverview(result.cards);
  }catch(e){fail(e);}
 },[token,onExpired]);
 useEffect(()=>{void loadOverview();},[loadOverview]);
 useEffect(()=>{let alive=true;void(async()=>{
  try{
   const x=await request<{years:Year[];branches:Branch[];categories:{code:string;name:string}[];projects?:ProjectChoice[]}>(token,
    "/api/finance-accounting/budgets/options");
   if(alive){setYear(x.years);setBranches(x.branches);setCategories(x.categories);setProjects(Array.isArray(x.projects)?x.projects:[]);}
  }catch(e){if(alive)fail(e);}})();return()=>{alive=false;};
 },[token,onExpired]);
 useEffect(()=>{const back=BackHandler.addEventListener("hardwareBackPress",()=>{
  if(selected){setSelected(null);return true;}onExit();return true;});
  return()=>back.remove();
 },[selected,onExit]);
 async function open(ref:string){
  setBusy(true);setError("");
  try{
   const x=await request<Detail>(token,"/api/finance-accounting/budgets/"+ref);
   setSelected(x);
   if(["DRAFT","RETURNED"].includes(x.status)){
    const branch=branches.find(b=>b.branchRef===x.branchRef);
    setForm({budgetName:x.name,financialYearRef:x.financialYearRef,
     branchRef:x.branchRef??"",branchVersion:branch?.version??null,projectRef:x.projectRef??"",
     category:x.category,periodStart:x.start,periodEnd:x.end,
     fundingNote:"Foundation budget authorization",
     ceiling:minorToRupees(x.ceilingMinor),
     items:(x.items??[]).map(line=>({description:line.description,
      quantity:(BigInt(line.quantityMilli)/1000n).toString()+
       (BigInt(line.quantityMilli)%1000n===0n?"":"."+
        (BigInt(line.quantityMilli)%1000n).toString().padStart(3,"0").replace(/0+$/,"")),
      unitRate:minorToRupees(line.unitRateMinor)}))});
   }
   if(x.status==="APPROVED"){
    const v=await request<{expenses:Expense[]}>(token,
     "/api/finance-accounting/budgets/"+ref+"/eligible-expenses");
    setExpenses(v.expenses);setSource("");setAmount("");
   }else setExpenses([]);
  }catch(e){fail(e);}finally{setBusy(false);}
 }
 function change<K extends keyof Form>(k:K,v:Form[K]){setForm(s=>({...s,[k]:v}));}
 async function execute(cmd:Pending){
  if(busy)return;setBusy(true);setError("");setNotice("");
  try{
   const data=await request<{confirmed:boolean;status:string;budgetRef?:string}>(token,
    cmd.path,cmd.method,cmd.body);
   if(!data.confirmed)throw Error("UNKNOWN");
   setPending(null);
   setNotice("Original budget action confirmed: "+data.status+
    ". Allocation is not cash received or spent.");
   void load();void loadOverview();
   const ref=data.budgetRef??selected?.budgetRef;
   if(ref)void open(ref);
  }catch(e){setPending(cmd);fail(e);}finally{setBusy(false);}
 }
 function submit(path:string,method:"POST"|"PATCH",details:Record<string,unknown>){
  if(busy||pending)return;
  const requestKey=key();
  void execute({key:requestKey,path,method,body:{...details,requestKey}});
 }
 async function status(){
  if(!pending||busy)return;
  setBusy(true);setError("");
  try{
   const row=await request<{confirmed:boolean;status:string}>(token,
    "/api/finance-accounting/budgets/commands/"+pending.key);
   if(row.confirmed){setPending(null);setNotice("Original budget command confirmed: "+row.status);
    void load();void loadOverview();if(selected)void open(selected.budgetRef);
   }else setNotice("Previous command not confirmed. Only retry the same request.");
  }catch(e){fail(e);}finally{setBusy(false);}
 }
 function save(){
  if(form.projectRef&&!projects.some(p=>p.value===form.projectRef&&(p.branchRef??"")===form.branchRef)){setError("Choose a currently available project or remove the optional association.");return;}
  const updating=selected&&["DRAFT","RETURNED"].includes(selected.status);
  submit("/api/finance-accounting/budgets/drafts"+
   (updating?"/"+selected.budgetRef:""),updating?"PATCH":"POST",{
   ...form,branchRef:form.branchRef||null,
   ...(updating?{expectedVersion:selected.version}:{})});
 }
 function movement(){
  if(!selected)return;
  submit("/api/finance-accounting/budgets/"+selected.budgetRef+"/events","POST",{
   kind,amount,...(kind==="UTILIZE"?{journalRef:source}:{})});
 }
 return <SafeAreaView style={s.screen} edges={["left","right"]}>
  <View style={s.header}><Pressable accessibilityRole="button"
   onPress={()=>selected?setSelected(null):onExit()}><Text style={s.back}>‹ Back</Text></Pressable>
   <Text accessibilityRole="header" style={s.title}>Budgets & Allocations</Text></View>
  <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
   <Text style={s.muted}>One Foundation budget source and true posted expense utilization.
    Budget approval never confirms a bank payment.</Text>
   {!!error&&<Text accessibilityRole="alert" style={s.alert}>{error}</Text>}
   {!!notice&&<Text accessibilityRole="alert" style={s.muted}>{notice}</Text>}
   {pending&&<Card title="Original request result not confirmed">
    <Action label="Check same request" secondary disabled={busy} onPress={()=>void status()}/>
    <Action label="Retry exactly this request" disabled={busy} onPress={()=>void execute(pending)}/>
   </Card>}
   {overview&&<Card title="Foundation budget overview">
    {([
     ["All budgets",String(overview.total)],["Submitted",String(overview.submitted)],
     ["Approved",String(overview.approved)],
     ["Approved ceiling",money(overview.totalCeilingMinor)],
     ["Allocated",money(overview.allocatedMinor)],
     ["Committed",money(overview.committedOutstandingMinor)],
     ["Utilized",money(overview.utilizedMinor)],
     ["Available",money(overview.availableMinor)],
     ["Over-budget",money(overview.overBudgetMinor)]
    ] as [string,string][]).map(([label,value])=>
     <Text key={label} style={s.text}>{label}: {value}</Text>)}
   </Card>}
   <Card title="Existing budgets">
    <Action label="Refresh budgets" secondary onPress={()=>void load()}/>
    {list.map(x=><Pressable accessibilityRole="button" key={x.budgetRef} style={s.card}
      onPress={()=>void open(x.budgetRef)}>
     <Text style={s.heading}>{x.budgetNumber} · {x.name}</Text>
     <Text style={s.text}>{categories.find(c=>c.code===x.category)?.name??x.category} · {money(x.ceilingMinor)}</Text>
     <Text style={s.muted}>{x.periodStart} to {x.periodEnd} · {x.status}</Text>
    </Pressable>)}
    {!list.length&&<Text style={s.muted}>No original Foundation budgets.</Text>}
    <View style={s.row}>
     <Action label="Previous" secondary disabled={offset===0}
      onPress={()=>setOffset(v=>Math.max(0,v-40))}/>
     <Action label="Next" secondary disabled={next===null} onPress={()=>setOffset(next??0)}/>
    </View>
   </Card>
   {selected&&<Card title={selected.budgetNumber+" — "+selected.status}>
    {([
     ["Approved ceiling",selected.ceilingMinor],["Allocated (earmarked)",selected.allocatedMinor],
     ["Committed outstanding",selected.committedOutstandingMinor],
     ["Utilized from posted expenses",selected.utilizedMinor],
     ["Released commitments",selected.releasedMinor],
     ["Available",selected.availableMinor],["Over-budget",selected.overBudgetMinor]
    ] as [string,string][]).map(([k,v])=><Text style={s.text} key={k}>{k}: {money(v)}</Text>)}
    {selected.events.slice(0,20).map((x,i)=><Text style={s.muted} key={i}>
     {x.recordedAt.slice(0,10)} · {x.kind} · {money(x.amountMinor)}</Text>)}
   </Card>}
   {canManage&&<Card title={selected?selected.budgetNumber+" — edit":"Create Foundation budget"}>
    <Action label="New budget" secondary onPress={()=>{setSelected(null);setForm(clear());setPending(null);}}/>
    {(!selected||["DRAFT","RETURNED"].includes(selected.status))&&<>
     <Field label="Budget name" value={form.budgetName} onChange={v=>change("budgetName",v)}/>
     <Options label="Open financial year" value={form.financialYearRef}
      options={year.filter(x=>x.status==="OPEN").map(x=>({ref:x.yearRef,label:x.name}))}
      onChange={v=>change("financialYearRef",v)}/>
     <Options label="Foundation or permitted branch" value={form.branchRef}
      options={[{ref:"",label:"Foundation root"},...branches.map(x=>({ref:x.branchRef,label:x.name}))]}
      onChange={v=>{
       const b=branches.find(x=>x.branchRef===v);
       setForm(f=>({...f,branchRef:b?.branchRef??"",branchVersion:b?.version??null,projectRef:""}));}}/>
     <Options label="Project (optional)" value={form.projectRef} options={[{ref:"",label:"No project — general budget"},...projects.filter(p=>(p.branchRef??"")===form.branchRef).map(p=>({ref:p.value,label:p.label}))]} onChange={v=>change("projectRef",v)}/>{!!form.projectRef&&!projects.some(p=>p.value===form.projectRef&&(p.branchRef??"")===form.branchRef)&&<Text accessibilityRole="alert">Previous project unavailable — choose another project or no project.</Text>}
     <Options label="Expense account group" value={form.category}
      options={categories.map(v=>({ref:v.code,label:v.name+" ("+v.code+")"}))}
      onChange={v=>change("category",v)}/>
     <Field label="Period starts (YYYY-MM-DD)" value={form.periodStart} onChange={v=>change("periodStart",v)}/>
     <Field label="Period ends (YYYY-MM-DD)" value={form.periodEnd} onChange={v=>change("periodEnd",v)}/>
     <Field label="Approved ceiling requested (₹)" value={form.ceiling} keyboardType="decimal-pad"
      onChange={v=>change("ceiling",v)}/>
     <Text style={s.heading}>Original CG09 budget items</Text>
     <Action label="Add budget item" secondary disabled={form.items.length>=30}
      onPress={()=>setForm(v=>({...v,items:[...v.items,{description:"",quantity:"1",unitRate:""}]}))}/>
     {form.items.map((line,i)=><Card key={i}>
      <Field label={"Item "+(i+1)+" description"} value={line.description}
       onChange={v=>setForm(old=>({...old,items:old.items.map((x,j)=>
        i===j?{...x,description:v}:x)}))}/>
      <Field label="Quantity (up to 3 decimals)" value={line.quantity}
       keyboardType="decimal-pad" onChange={v=>setForm(old=>({...old,items:old.items.map((x,j)=>
        i===j?{...x,quantity:v}:x)}))}/>
      <Field label="Unit rate (INR)" value={line.unitRate}
       keyboardType="decimal-pad" onChange={v=>setForm(old=>({...old,items:old.items.map((x,j)=>
        i===j?{...x,unitRate:v}:x)}))}/>
      <Action label="Remove this line" secondary onPress={()=>
       setForm(old=>({...old,items:old.items.filter((_,j)=>j!==i)}))}/>
     </Card>)}
     <Text style={s.text}>Itemized quantity × unit-rate totals must equal
      the requested approved ceiling. Finance verifies the exact calculation.</Text>
     <Field label="Funding note (not cash evidence)" value={form.fundingNote}
      onChange={v=>change("fundingNote",v)}/>
     <Action label="Save original budget draft" disabled={busy||Boolean(pending)} onPress={save}/>
     {selected?.status==="DRAFT"&&<Action label="Submit for protected budget approval"
       disabled={busy||Boolean(pending)} onPress={()=>submit(
       "/api/finance-accounting/budgets/"+selected.budgetRef+"/submit","POST",
       {expectedVersion:selected.version})}/>}
    </>}
    {selected?.status==="SUBMITTED"&&<Action label="Check original protected review result"
     disabled={busy||Boolean(pending)} onPress={()=>submit(
      "/api/finance-accounting/budgets/"+selected.budgetRef+"/reconcile","POST",{})}/>}
    {selected&&<Card>
     <Text style={s.heading}>Original Finance item breakdown</Text>
     {selected.items?.length?selected.items.map((item,i)=><Text key={i} style={s.text}>
      {item.description}: {(Number(item.quantityMilli)/1000).toFixed(3)} ×
      {money(item.unitRateMinor)} = {money(item.totalMinor)}
     </Text>):<Text style={s.muted}>No original item breakdown recorded for this budget.</Text>}
    </Card>}
    {selected?.status==="APPROVED"&&<>
     <Options label="Budget event" value={kind} options={[
      {ref:"ALLOCATE",label:"Allocate / earmark"},{ref:"COMMIT",label:"Commit"},
      {ref:"RELEASE",label:"Release commitment"},{ref:"UTILIZE",label:"Utilize posted expense"}]}
      onChange={v=>{setKind(v);setAmount("");setSource("");}}/>
     {kind==="UTILIZE"&&<Options label="Actual posted expense voucher"
      value={source} options={expenses.map(x=>({ref:x.journalRef,
       label:x.voucherNumber+" · "+x.postedDate+" · "+money(x.amountMinor)}))}
      onChange={v=>{setSource(v);const x=expenses.find(x=>x.journalRef===v);
       if(x)setAmount(minorToRupees(x.amountMinor));}}/>}
     <Field label="Event amount (₹)" value={amount} keyboardType="decimal-pad" onChange={setAmount}/>
     <Action label="Confirm source-backed budget movement once"
      disabled={busy||Boolean(pending)||!amount||(kind==="UTILIZE"&&!source)}
      onPress={movement}/>
     <Text style={s.muted}>Utilization is accepted only if the selected voucher was actually
      approved, balanced, posted, belongs to this category and has not been used before.</Text>
     <Action label="Archive approved budget (retain all history)" secondary
      disabled={busy||Boolean(pending)} onPress={()=>submit(
       "/api/finance-accounting/budgets/"+selected.budgetRef+"/archive","POST",
       {expectedVersion:selected.version})}/>
    </>}
   </Card>}
  </ScrollView>
 </SafeAreaView>;
}
