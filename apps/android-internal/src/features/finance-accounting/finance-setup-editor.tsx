import {useEffect,useMemo,useState} from "react";
import {ActivityIndicator,KeyboardAvoidingView,Platform,Pressable,ScrollView,
 StyleSheet,Text,TextInput,View} from "react-native";
import * as Crypto from "expo-crypto";
import {SafeAreaView} from "react-native-safe-area-context";
import {careGangaTheme as theme} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";

export type FinanceKind="year"|"group"|"account"|"opening"|"manual"|"yearStatus"|"accountStatus";
export type FinanceYear={yearRef:string;name:string;startOn:string;endOn:string;status:string;version:number};
export type FinanceGroup={groupRef:string;name:string;code:string;category:string};
export type FinanceBranch={branchRef:string;name:string;code:string;version:number};
export type FinanceAccount={accountRef:string;code:string;name:string;groupName:string;
 kind:string;scopeKind:string;branchRef:string|null;branchName:string|null;
 status:string;version:number;balanceMinor:string;openingMinor:string;
 bankLabel:string|null;maskedDetails:string|null};
type PostingChoice={accountRef:string;code:string;name:string;
 branchRef:string|null;branchName:string|null;branchVersion:number|null};
export type FinanceSetup={accounts:FinanceAccount[];years:FinanceYear[];
 groups:FinanceGroup[];branches:FinanceBranch[];
 openingJournals:{journalRef:string;yearName:string;postingDate:string;amountMinor:string}[];
 categorySummary:{category:string;balanceMinor:string;accountCount:string}[];
 nextOffset:number|null};
type Target={ref:string;name:string;status:string;version:number};
type Props={token:string;kind:FinanceKind;data:FinanceSetup;target?:Target;
 onClose:()=>void;onSaved:()=>void;onExpired:()=>void};
type Choice={value:string;label:string};
type Failed={message:string;field?:string;unknown:boolean};
type Pending={key:string;command:string;path:string;method:"POST"|"PATCH";payload:Record<string,unknown>};
const titles:Record<FinanceKind,string>={
 year:"New Financial Year",group:"New Account Group",account:"New Account",
 opening:"Post Opening Balance",manual:"Post General Journal",yearStatus:"Close Financial Year",
 accountStatus:"Change Account Status"
};
const kinds=["ASSET","LIABILITY","FUND","INCOME","EXPENSE"];
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function failure(response:Response):Promise<Failed>{
 const payload:unknown=await response.json().catch(()=>null);
 const obj=payload&&typeof payload==="object"&&!Array.isArray(payload)?payload as Record<string,unknown>:{};
 const safe=typeof obj.code==="string"&&obj.code.startsWith("FINANCE_");
 const message=safe&&typeof obj.message==="string"&&obj.message.length<=300?obj.message:
  response.status===403?"Your role cannot perform this finance action. Ask the Foundation Administrator.":
  response.status===429?"Too many requests. Please try again after a short break.":
  response.status===409?"This financial record changed. Refresh and review it before saving.":
  response.status===400?"Review the finance fields and correct the highlighted details.":
  "This result could not be confirmed. Check the original request status before retrying.";
 return {message,field:safe&&typeof obj.field==="string"?obj.field:undefined,
  unknown:response.status>=500};
}
function ChoiceRow({title,value,options,onChange}:{
 title:string;value:string;options:Choice[];onChange:(next:string)=>void
}){
 return <View style={styles.selectBlock}>
  <Text style={styles.label}>{title}</Text>
  {!options.length?<Text style={styles.hint}>No currently eligible options. Refresh finance data.</Text>:
   <View style={styles.chips}>{options.map(o=><Pressable key={o.value}
    accessibilityRole="radio" accessibilityState={{checked:value===o.value}}
    style={[styles.chip,value===o.value&&styles.selectedChip]}
    onPress={()=>onChange(o.value)}><Text style={[styles.chipText,
      value===o.value&&styles.selectedChipText]}>{o.label}</Text></Pressable>)}</View>}
 </View>;
}
function Field({label,value,onChange,placeholder,keyboard="default",error,maxLength=140}:{
 label:string;value:string;onChange:(next:string)=>void;placeholder?:string;
 keyboard?:"default"|"numeric";error?:string;maxLength?:number
}){
 return <View style={styles.field}>
  <Text style={styles.label}>{label}</Text>
  <TextInput style={[styles.input,Boolean(error)&&styles.invalid]} value={value}
   onChangeText={onChange} placeholder={placeholder} placeholderTextColor={theme.mutedText}
   keyboardType={keyboard} autoCorrect={false} autoCapitalize="none"
   accessibilityLabel={label} accessibilityHint={error}
   maxLength={maxLength}/>
  {!!error&&<Text style={styles.fieldError}>{error}</Text>}
 </View>;
}
export function FinanceSetupEditor({token,kind,data,target,onClose,onSaved,onExpired}:Props){
 const [form,setForm]=useState<Record<string,string>>({
  name:"",code:"",startOn:"",endOn:"",category:"ASSET",parentRef:"",
  groupRef:"",accountKind:"GENERAL",scopeKind:"FOUNDATION",branchRef:"",
  bankLabel:"",bankLastFour:"",financialYearRef:"",postingDate:"",
  debitAccountRef:"",creditAccountRef:"",amount:"",description:""
 });
 const [notice,setNotice]=useState<Failed|null>(null);
 const [busy,setBusy]=useState(false);
 const [pending,setPending]=useState<Pending|null>(null);
 const [unconfirmedNotFound,setUnconfirmedNotFound]=useState(false);
 const [search,setSearch]=useState("");
 const [manualLines,setManualLines]=useState<Array<{accountRef:string;debit:string;credit:string}>>([{accountRef:"",debit:"",credit:""},{accountRef:"",debit:"",credit:""}]);
 const [choices,setChoices]=useState<PostingChoice[]>([]);
 const [selectedChoices,setSelectedChoices]=useState<Record<string,PostingChoice>>({});
 const [choiceBusy,setChoiceBusy]=useState(false);
 const [choiceError,setChoiceError]=useState("");
 const [choiceMore,setChoiceMore]=useState(false);
 const [searchReload,setSearchReload]=useState(0);
 const change=(key:string,value:string)=>{setForm(f=>({...f,[key]:value}));setNotice(null);};
 useEffect(()=>{
  if(kind!=="opening"&&kind!=="manual")return;
  let active=true;
  const timer=setTimeout(async()=>{
   if(!active)return;
   setChoiceBusy(true);setChoiceError("");
   try{
    const result=await identityRequest("/api/finance-accounting/account-options?q="+
       encodeURIComponent(search.trim()),{
      headers:{Authorization:"Bearer "+token},cache:"no-store"
     });
    if(result.status===401){if(active)onExpired();return;}
    if(!result.ok)throw Error("UNAVAILABLE");
    const payload:unknown=await result.json();
    if(!payload||typeof payload!=="object"||!("accounts" in payload)||
     !Array.isArray(payload.accounts)||!("hasMore" in payload)||
     typeof payload.hasMore!=="boolean")throw Error("UNVERIFIED");
    if(active){setChoices(payload.accounts as PostingChoice[]);
     setChoiceMore(payload.hasMore);}
   }catch{
    if(active){setChoices([]);
     setChoiceError("Account choices could not be loaded. Check your connection and retry the search.");}
   }finally{if(active)setChoiceBusy(false);}
  },300);
  return()=>{active=false;clearTimeout(timer);};
 },[kind,token,search,searchReload,onExpired]);
 const options=useMemo(()=>[...choices,...Object.values(selectedChoices)
   .filter(x=>!choices.some(c=>c.accountRef===x.accountRef))],[choices,selectedChoices]);
 function selectAccount(field:"debitAccountRef"|"creditAccountRef",reference:string){
  const item=options.find(x=>x.accountRef===reference);
  if(item)setSelectedChoices(v=>({...v,[reference]:item}));
  change(field,reference);
 }
 function editManualLine(index:number,field:"accountRef"|"debit"|"credit",value:string){
  if(field==="accountRef"){
   const choice=options.find(x=>x.accountRef===value);
   if(choice)setSelectedChoices(v=>({...v,[value]:choice}));
  }
  setManualLines(old=>old.map((row,i)=>i===index?{...row,[field]:value}:row));
  setNotice(null);
 }
 function intent():{path:string;method:"POST"|"PATCH";command:string;payload:Record<string,unknown>}{
  if(kind==="year")return {path:"years",method:"POST",command:"YEAR_CREATE",
   payload:{name:form.name,startOn:form.startOn,endOn:form.endOn}};
  if(kind==="group")return {path:"groups",method:"POST",command:"GROUP_CREATE",
   payload:{name:form.name,code:form.code,category:form.category,
    ...(form.parentRef?{parentRef:form.parentRef}:{})}};
  if(kind==="account"){
   const b=data.branches.find(x=>x.branchRef===form.branchRef);
   return {path:"accounts",method:"POST",command:"ACCOUNT_CREATE",
    payload:{name:form.name,code:form.code,groupRef:form.groupRef,
     accountKind:form.accountKind,scopeKind:form.scopeKind,
     ...(form.scopeKind==="BRANCH"?{branchRef:form.branchRef,branchVersion:b?.version}:{}),
     ...(form.accountKind!=="GENERAL"?{bankLabel:form.bankLabel}:{}),
     ...(form.accountKind==="BANK"&&form.bankLastFour?{bankLastFour:form.bankLastFour}:{})}};
  }
  if(kind==="opening"){
   const debit=options.find(x=>x.accountRef===form.debitAccountRef);
   const credit=options.find(x=>x.accountRef===form.creditAccountRef);
   const version=debit?.branchVersion??credit?.branchVersion;
   return {path:"opening-journals",method:"POST",command:"OPENING_POST",
    payload:{financialYearRef:form.financialYearRef,postingDate:form.postingDate,
     debitAccountRef:form.debitAccountRef,creditAccountRef:form.creditAccountRef,
     amount:form.amount,...(version?{branchVersion:version}:{})}};
  }
  if(kind==="manual"){
   const refs=manualLines.map(l=>options.find(x=>x.accountRef===l.accountRef));
   const version=refs.find(x=>x?.branchRef)?.branchVersion;
   return {path:"manual-journals",method:"POST",command:"GENERAL_POST",
    payload:{financialYearRef:form.financialYearRef,postingDate:form.postingDate,
     description:form.description,lines:manualLines.map(l=>({...l})),
     ...(version?{branchVersion:version}:{})}};
  }
  if(!target||!uuid.test(target.ref))throw Error("INVALID_TARGET");
  return {
   path:(kind==="yearStatus"?"years/":"accounts/")+target.ref+"/status",
   method:"PATCH",command:kind==="yearStatus"?"YEAR_STATUS":"ACCOUNT_STATUS",
   payload:{status:kind==="yearStatus"?"CLOSED":
      target.status==="ACTIVE"?"INACTIVE":"ACTIVE",expectedVersion:target.version}
  };
 }
 async function send(original:Pending){
  setBusy(true);setNotice(null);setUnconfirmedNotFound(false);
  try{
   const response=await identityRequest("/api/finance-accounting/"+original.path,{
    method:original.method,headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},
    body:JSON.stringify({...original.payload,requestKey:original.key})
   });
   if(response.status===401){onExpired();return;}
   if(!response.ok){
    const result=await failure(response);
    setNotice(result);setPending(result.unknown?original:null);return;
   }
   const payload:unknown=await response.json().catch(()=>null);
   if(!payload||typeof payload!=="object"||!("confirmed" in payload)||
    payload.confirmed!==true||!("recordRef" in payload)||
    typeof payload.recordRef!=="string"){
    setPending(original);setNotice({unknown:true,message:
      "The server response could not confirm the change. Check the original request before trying again."});return;
   }
   setPending(null);onSaved();
  }catch{
   setPending(original);
   setNotice({unknown:true,message:
    "The connection ended before the result could be confirmed. Check the original request before trying again."});
  }finally{setBusy(false);}
 }
 function submit(){
  if(busy||pending)return;
  try{const action=intent();
   void send({...action,key:Crypto.randomUUID()});
  }catch{setNotice({unknown:false,message:
   "The current financial record is unavailable. Refresh the Finance screen and select it again."});}
 }
 async function checkOriginal(){
  if(!pending||busy)return;
  setBusy(true);setNotice(null);
  try{
   const response=await identityRequest("/api/finance-accounting/commands/"+
    pending.command+"/"+pending.key,{headers:{Authorization:"Bearer "+token},cache:"no-store"});
   if(response.status===401){onExpired();return;}
   if(!response.ok){setNotice(await failure(response));return;}
   const result:unknown=await response.json();
   if(!result||typeof result!=="object"||!("confirmed" in result)||
    typeof result.confirmed!=="boolean")throw Error("UNKNOWN");
   if(result.confirmed===true){setPending(null);onSaved();return;}
   setUnconfirmedNotFound(true);
   setNotice({unknown:true,message:
    "No completed change was found for this request. You may retry the SAME request without creating a duplicate."});
  }catch{setNotice({unknown:true,message:
   "The original result cannot be verified right now. Check again before retrying."});}
  finally{setBusy(false);}
 }
 const relatedGroups=data.groups.filter(g=>form.accountKind==="GENERAL"||g.category==="ASSET");
 const debit=options.find(x=>x.accountRef===form.debitAccountRef);
 const eligibleCredit=options.filter(x=>x.accountRef!==form.debitAccountRef&&
    (!debit?.branchRef||!x.branchRef||x.branchRef===debit.branchRef));
 const noManageData=(kind==="account"&&!data.groups.length)||
  ((kind==="opening"||kind==="manual")&&(!data.years.some(y=>y.status==="OPEN")||!options.length));
 return <SafeAreaView style={styles.safe} edges={["top","bottom"]}>
  <KeyboardAvoidingView behavior={Platform.OS==="ios"?"padding":undefined} style={styles.safe}>
   <View style={styles.header}><Pressable accessibilityRole="button"
    style={styles.back} disabled={busy||!!pending} onPress={onClose}>
    <Text style={styles.backText}>‹ Back</Text></Pressable>
    <View style={styles.heading}><Text style={styles.eyebrow}>CAREGANGA / FINANCE</Text>
     <Text accessibilityRole="header" style={styles.title}>{titles[kind]}</Text></View></View>
   <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
    <Text style={styles.hint}>Required details are verified against your current Foundation permission and records.</Text>
    {kind==="year"&&<>
     <Field label="Financial year name *" value={form.name}
      onChange={v=>change("name",v)} placeholder="Example: Financial Year 2026–27"
      error={notice?.field==="name"?notice.message:undefined}/>
     <Field label="Start date (YYYY-MM-DD) *" value={form.startOn}
      onChange={v=>change("startOn",v)} placeholder="2026-04-01" keyboard="numeric"
      error={notice?.field==="startOn"?notice.message:undefined}/>
     <Field label="End date (YYYY-MM-DD) *" value={form.endOn}
      onChange={v=>change("endOn",v)} placeholder="2027-03-31" keyboard="numeric"
      error={notice?.field==="endOn"?notice.message:undefined}/>
    </>}
    {kind==="group"&&<>
     <Field label="Account group name *" value={form.name}
      onChange={v=>change("name",v)} placeholder="Example: Operating Expenses"
      error={notice?.field==="name"?notice.message:undefined}/>
     <Field label="Business group code *" value={form.code}
      onChange={v=>change("code",v)} placeholder="Example: EXPENSES"
      error={notice?.field==="code"?notice.message:undefined}/>
     <ChoiceRow title="Category *" value={form.category}
      options={kinds.map(k=>({value:k,label:k[0]+k.slice(1).toLowerCase()}))}
      onChange={v=>change("category",v)}/>
     <ChoiceRow title="Parent group (optional)" value={form.parentRef}
      options={[{value:"",label:"No parent group"},
        ...data.groups.filter(g=>g.category===form.category).map(g=>
          ({value:g.groupRef,label:g.name+" · "+g.code}))]}
      onChange={v=>change("parentRef",v)}/>
    </>}
    {kind==="account"&&<>
     <Field label="Account name *" value={form.name} onChange={v=>change("name",v)}
      placeholder="Example: Foundation Cash"
      error={notice?.field==="name"?notice.message:undefined}/>
     <Field label="Business account code *" value={form.code}
      onChange={v=>change("code",v)} placeholder="Example: CASH_01"
      error={notice?.field==="code"?notice.message:undefined}/>
     <ChoiceRow title="Account type *" value={form.accountKind}
      options={[{value:"GENERAL",label:"General"},{value:"CASH",label:"Cash"},
        {value:"BANK",label:"Bank"}]} onChange={v=>{
          change("accountKind",v);setForm(x=>({...x,groupRef:"",bankLabel:"",bankLastFour:""}));
        }}/>
     <ChoiceRow title="Account group *" value={form.groupRef}
      options={relatedGroups.map(g=>({value:g.groupRef,label:g.name+" · "+g.code}))}
      onChange={v=>change("groupRef",v)}/>
     <ChoiceRow title="Account scope *" value={form.scopeKind}
      options={[{value:"FOUNDATION",label:"Foundation"},
        {value:"BRANCH",label:"Branch"}]} onChange={v=>change("scopeKind",v)}/>
     {form.scopeKind==="BRANCH"&&<ChoiceRow title="Current ACTIVE branch *" value={form.branchRef}
       options={data.branches.map(b=>({value:b.branchRef,label:b.name+" · "+b.code}))}
       onChange={v=>change("branchRef",v)}/>}
     {form.accountKind!=="GENERAL"&&<Field
      label={form.accountKind==="BANK"?"Bank display label *":"Cash display label *"}
      value={form.bankLabel} onChange={v=>change("bankLabel",v)}
      placeholder="Example: Main Bank Account"
      error={notice?.field==="bankLabel"?notice.message:undefined}/>}
     {form.accountKind==="BANK"&&<Field label="Last four bank digits (optional)"
      value={form.bankLastFour} keyboard="numeric" onChange={v=>change("bankLastFour",v)}
      placeholder="1234 — never enter the complete bank account number"
      error={notice?.field==="bankLastFour"?notice.message:undefined}/>}
    </>}
    {kind==="opening"&&<>
     <ChoiceRow title="Open financial year *" value={form.financialYearRef}
       options={data.years.filter(y=>y.status==="OPEN").map(y=>({
        value:y.yearRef,label:y.name+" · "+y.startOn+" – "+y.endOn}))}
       onChange={v=>change("financialYearRef",v)}/>
     <Field label="Posting date (YYYY-MM-DD) *" value={form.postingDate}
      keyboard="numeric" onChange={v=>change("postingDate",v)}
      error={notice?.field==="postingDate"?notice.message:undefined}/>
     <Field label="Find posting account by name or code" value={search}
      onChange={v=>setSearch(v.slice(0,80))} placeholder="Search your eligible accounts"/>
     {choiceBusy&&<ActivityIndicator color={theme.primary}/>}
     {!!choiceError&&<View style={styles.warn}><Text style={styles.notice}>{choiceError}</Text>
      <Pressable style={styles.button} onPress={()=>setSearchReload(x=>x+1)}>
       <Text style={styles.buttonText}>Retry account search</Text></Pressable></View>}
     {choiceMore&&<Text style={styles.hint}>More accounts exist. Narrow your search to choose the correct account.</Text>}
     <ChoiceRow title="Debit account *" value={form.debitAccountRef}
      options={options.map(x=>({value:x.accountRef,label:x.name+" · "+x.code+
       (x.branchName?" ("+x.branchName+")":"")}))} onChange={v=>selectAccount("debitAccountRef",v)}/>
     <ChoiceRow title="Credit account *" value={form.creditAccountRef}
      options={eligibleCredit.map(x=>({value:x.accountRef,label:x.name+" · "+x.code+
       (x.branchName?" ("+x.branchName+")":"")}))} onChange={v=>selectAccount("creditAccountRef",v)}/>
     <Field label="Opening amount in INR *" value={form.amount}
       keyboard="numeric" onChange={v=>change("amount",v)} placeholder="Example: 1000.00"
       error={notice?.field==="amount"?notice.message:undefined}/>
     <Text style={styles.hint}>This creates one balanced, immutable entry. The amount is posted once on each side—not twice as cash.</Text>
    </>}
    {kind==="manual"&&<>
      <ChoiceRow title="Open financial year *" value={form.financialYearRef}
       options={data.years.filter(y=>y.status==="OPEN").map(y=>({value:y.yearRef,
        label:y.name+" · "+y.startOn+" – "+y.endOn}))}
       onChange={v=>change("financialYearRef",v)}/>
      <Field label="Posting date (YYYY-MM-DD) *" value={form.postingDate} maxLength={10}
       keyboard="numeric" onChange={v=>change("postingDate",v)}
       error={notice?.field==="postingDate"?notice.message:undefined}/>
      <Field label="Journal description *" value={form.description} maxLength={500}
       onChange={v=>change("description",v)}
       error={notice?.field==="description"?notice.message:undefined}/>
      <Field label="Find permitted account by name or code" value={search}
       maxLength={80} onChange={setSearch} placeholder="Search account name or code"/>
      {choiceBusy&&<ActivityIndicator color={theme.primary}/>}
      {!!choiceError&&<View style={styles.warn}><Text style={styles.notice}>{choiceError}</Text>
       <Pressable accessibilityRole="button" style={styles.button} onPress={()=>setSearchReload(n=>n+1)}>
        <Text style={styles.buttonText}>Retry account search</Text></Pressable></View>}
      {choiceMore&&<Text style={styles.hint}>More accounts exist. Refine the search before selecting.</Text>}
      {manualLines.map((line,index)=><View style={styles.warn} key={index}>
       <View style={styles.lineHead}><Text style={styles.bold}>Journal line {index+1}</Text>
        {manualLines.length>2&&<Pressable accessibilityRole="button"
          onPress={()=>setManualLines(old=>old.filter((_,i)=>i!==index))}>
          <Text style={styles.backText}>Remove</Text></Pressable>}</View>
       <ChoiceRow title="Account *" value={line.accountRef}
        options={[...options.filter(x=>x.accountRef===line.accountRef),
         ...options.filter(x=>x.accountRef!==line.accountRef).slice(0,11)]
          .map(x=>({value:x.accountRef,label:x.name+" · "+x.code+
           (x.branchName?" ("+x.branchName+")":"")}))}
        onChange={v=>editManualLine(index,"accountRef",v)}/>
       <Field label="Debit amount in INR" value={line.debit} maxLength={16} keyboard="numeric"
        onChange={v=>editManualLine(index,"debit",v)}/>
       <Field label="Credit amount in INR" value={line.credit} maxLength={16} keyboard="numeric"
        onChange={v=>editManualLine(index,"credit",v)}/>
      </View>)}
      {manualLines.length<40&&<Pressable accessibilityRole="button" style={styles.button}
       onPress={()=>setManualLines(old=>[...old,{accountRef:"",debit:"",credit:""}])}>
       <Text style={styles.buttonText}>+ Add journal line</Text></Pressable>}
      <Text style={styles.hint}>Each line requires either a debit or credit. Totals must balance.
       A posted journal does not confirm voucher approval or payment.</Text>
     </>}
     {(kind==="accountStatus"||kind==="yearStatus")&&<View style={styles.warn}>
      <Text style={styles.bold}>{target?.name??"Selected record"}</Text>
      <Text style={styles.hint}>{kind==="yearStatus"?
       "Closing prevents new postings in this financial year. Historical records remain unchanged.":
       target?.status==="ACTIVE"?
       "Deactivation blocks new postings. Historical balances remain visible.":
       "Reactivation permits new authorized postings only while the linked branch remains active."}</Text>
     </View>}
    {notice&&(!notice.field||kind.endsWith("Status")||
      !["name","code","startOn","endOn","bankLabel","bankLastFour",
        "postingDate","amount"].includes(notice.field))&&
      <View style={styles.warn} accessibilityRole="alert">
       <Text style={styles.notice}>{notice.message}</Text></View>}
    {pending&&<View style={styles.warn}>
     <Text style={styles.notice}>The previous save has an unconfirmed result. Check it before repeating a financial change.</Text>
     <Pressable accessibilityRole="button" style={styles.button}
      disabled={busy} onPress={()=>void checkOriginal()}><Text style={styles.buttonText}>Check original request</Text></Pressable>
     {unconfirmedNotFound&&<Pressable accessibilityRole="button" style={styles.button}
       disabled={busy} onPress={()=>void send(pending)}>
       <Text style={styles.buttonText}>Retry same request</Text></Pressable>}
    </View>}
    <View style={styles.actions}>
     <Pressable accessibilityRole="button" style={styles.button}
       disabled={busy||!!pending} onPress={onClose}><Text style={styles.buttonText}>Cancel</Text></Pressable>
     <Pressable accessibilityRole="button" style={[styles.button,styles.primary]}
       disabled={busy||!!pending||noManageData} onPress={submit}>
       <Text style={styles.primaryText}>{busy?"Saving…":
         kind==="opening"?"Post balanced entry":kind==="manual"?"Post balanced journal":kind==="yearStatus"?"Close year":
         kind==="accountStatus"?"Confirm change":"Save"}</Text></Pressable>
    </View>
   </ScrollView>
  </KeyboardAvoidingView>
 </SafeAreaView>;
}
const styles=StyleSheet.create({
 safe:{flex:1,backgroundColor:theme.background},
 header:{paddingHorizontal:14,paddingVertical:10,flexDirection:"row",
  alignItems:"center",gap:10,borderBottomWidth:1,borderBottomColor:theme.border,
  backgroundColor:theme.surface},
 back:{minHeight:48,justifyContent:"center",paddingHorizontal:8},
 backText:{color:theme.primary,fontSize:15,fontWeight:"600"},
 heading:{flex:1},eyebrow:{fontSize:10,color:theme.mutedText},
 title:{fontSize:18,fontWeight:"700",color:theme.text},
 body:{padding:16,paddingBottom:48,gap:14},
 label:{fontSize:13,fontWeight:"600",color:theme.text,marginBottom:5},
 field:{gap:4},
 input:{borderWidth:1,borderColor:theme.border,borderRadius:8,minHeight:48,
  paddingHorizontal:12,paddingVertical:10,color:theme.text,
  backgroundColor:theme.surface,fontSize:15},
 invalid:{borderColor:theme.error},
 fieldError:{color:theme.error,fontSize:12},
 selectBlock:{gap:6},chips:{flexDirection:"row",flexWrap:"wrap",gap:8},
 chip:{borderWidth:1,borderColor:theme.border,borderRadius:8,paddingHorizontal:12,
  paddingVertical:11,minHeight:46,justifyContent:"center",backgroundColor:theme.surface},
 selectedChip:{borderColor:theme.primary,backgroundColor:"#EEF4FF"},
 chipText:{color:theme.text,fontSize:13,fontWeight:"500"},
 selectedChipText:{color:theme.primary,fontWeight:"700"},
 hint:{color:theme.mutedText,fontSize:13,lineHeight:20},
 warn:{borderWidth:1,borderColor:theme.border,borderRadius:8,padding:12,gap:9,
  backgroundColor:theme.surface},
 notice:{color:theme.text,fontSize:13,lineHeight:20},
 bold:{fontWeight:"700",fontSize:15,color:theme.text},
 lineHead:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",gap:10},
 actions:{flexDirection:"row",justifyContent:"flex-end",gap:10,paddingTop:14},
 button:{borderWidth:1,borderColor:theme.border,borderRadius:7,paddingHorizontal:16,
  minHeight:48,justifyContent:"center",backgroundColor:theme.surface},
 buttonText:{color:theme.text,fontWeight:"600",fontSize:14},
 primary:{backgroundColor:theme.primary,borderColor:theme.primary},
 primaryText:{color:theme.primaryText,fontWeight:"700"}
});
