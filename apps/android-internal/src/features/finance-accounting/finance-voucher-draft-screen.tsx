import {useCallback,useEffect,useState} from "react";
import {ActivityIndicator,BackHandler,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import * as Crypto from "expo-crypto";
import {SafeAreaView} from "react-native-safe-area-context";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";
import type {FinanceYear,FinanceBranch} from "./finance-setup-editor";
type Voucher={voucherRef:string;voucherNumber:string;type:string;postingDate:string;payeeName:string;
 purpose:string;totalMinor:string;version:number};
type Line={description:string;quantity:string;unitRate:string};
type Draft={voucherRef:string;voucherNumber:string;version:number;status:string;
 header:{financialYearRef?:string;branchRef?:string|null;type?:string;
 postingDate?:string;payeeName?:string;purpose?:string};
 lines:{description:string;quantity:number;unitRateMinor:string}[];
 taxMinor:string;chargesMinor:string};
type Pending={key:string;path:string;method:"POST"|"PATCH";payload:Record<string,unknown>};
type Props={token:string;years:readonly FinanceYear[];branches:readonly FinanceBranch[];
 canManage:boolean;onClose:()=>void;onExpired:()=>void};
const line=():Line=>({description:"",quantity:"1",unitRate:""});
const empty=()=>({type:"EXPENSE",financialYearRef:"",branchRef:"",postingDate:"",payeeName:"",
 purpose:"",tax:"0",charges:"0"});
function money(v:string){try{const n=BigInt(v),x=n<0n?-n:n;return(n<0n?"−":"")+"₹"+
 (x/100n).toLocaleString("en-IN")+"."+(x%100n).toString().padStart(2,"0");}catch{return"Amount unavailable";}}
function decimal(v:string){try{const n=BigInt(v);return(n/100n).toString()+"."+(n%100n).toString().padStart(2,"0");}catch{return"0.00";}}
async function reason(res:Response){
 const raw:unknown=await res.json().catch(()=>null);
 const x=raw&&typeof raw==="object"&&!Array.isArray(raw)?raw as Record<string,unknown>:{};
 if(typeof x.code==="string"&&x.code.startsWith("FINANCE_")&&typeof x.message==="string"&&x.message.length<=300)
  return x.message;
 return res.status===401?"Your session expired. Sign in again.":
 res.status===403?"Your role cannot manage voucher drafts. Ask the Foundation Administrator.":
 res.status===409?"This voucher or financial period changed. Refresh its current details before editing.":
 res.status===400?"Check the voucher details, item quantities and amounts, then try again.":
 "The result could not be confirmed. Check the original save before retrying.";
}
function TextField({label,value,update,placeholder,maxLength=140}:{label:string;value:string;
 update:(v:string)=>void;placeholder?:string;maxLength?:number}){
 return <View style={s.field}><Text style={s.label}>{label}</Text>
  <TextInput style={s.input} value={value} onChangeText={update} maxLength={maxLength}
   placeholder={placeholder} placeholderTextColor={t.mutedText} autoCorrect={false}
   accessibilityLabel={label}/></View>;
}
function Select({label,value,options,onChange}:{label:string;value:string;
 options:{value:string;label:string}[];onChange:(v:string)=>void}){
 return <View style={s.field}><Text style={s.label}>{label}</Text>
  <View style={s.choices}>{options.map(o=><Pressable key={o.value}
   style={[s.chip,o.value===value&&s.chipSelected]} accessibilityRole="radio"
   accessibilityState={{checked:o.value===value}} onPress={()=>onChange(o.value)}>
   <Text style={o.value===value?s.selected:s.plain}>{o.label}</Text></Pressable>)}</View></View>;
}
export function FinanceVoucherDraftScreen({token,years,branches,canManage,onClose,onExpired}:Props){
 const [drafts,setDrafts]=useState<Voucher[]>([]);
 const [loading,setLoading]=useState(true);
 const [problem,setProblem]=useState("");
 const [success,setSuccess]=useState("");
 const [editing,setEditing]=useState(false);
 const [busy,setBusy]=useState(false);
 const [target,setTarget]=useState<{ref:string;number:string;version:number}|null>(null);
 const [form,setForm]=useState(empty());
 const [items,setItems]=useState<Line[]>([line()]);
 const [pending,setPending]=useState<Pending|null>(null);
 const [retryAllowed,setRetryAllowed]=useState(false);
 const fetchDrafts=useCallback(async()=>{
  setLoading(true);setProblem("");
  try{
   const res=await identityRequest("/api/finance-accounting/vouchers/drafts",
    {headers:{Authorization:"Bearer "+token},cache:"no-store"});
   if(res.status===401){onExpired();return;}
   if(!res.ok)throw Error(await reason(res));
   const val:unknown=await res.json();
   if(!val||typeof val!=="object"||!("vouchers" in val)||!Array.isArray(val.vouchers))
    throw Error("Voucher list could not be verified. Refresh and retry.");
   setDrafts(val.vouchers);
  }catch(e){setDrafts([]);setProblem(e instanceof Error?e.message:"Cannot load vouchers. Check the connection.");}
  finally{setLoading(false);}
 },[token,onExpired]);
 useEffect(()=>{void fetchDrafts();},[fetchDrafts]);
 useEffect(()=>{
  const subscription=BackHandler.addEventListener("hardwareBackPress",()=>{
   if(busy||pending)return true;
   if(editing)setEditing(false);else onClose();
   return true;
  });
  return()=>subscription.remove();
 },[editing,busy,pending,onClose]);
 const update=(k:keyof ReturnType<typeof empty>,v:string)=>{setForm(f=>({...f,[k]:v}));setProblem("");};
 const itemField=(i:number,k:keyof Line,v:string)=>{setItems(old=>old.map((row,j)=>i===j?{...row,[k]:v}:row));setProblem("");};
 function start(){
  if(!canManage)return;
  setEditing(true);setTarget(null);setForm(empty());setItems([line()]);
  setPending(null);setRetryAllowed(false);setProblem("");setSuccess("");
 }
 async function edit(v:Voucher){
  if(!canManage)return;
  setBusy(true);setProblem("");
  try{
   const res=await identityRequest("/api/finance-accounting/vouchers/drafts/"+v.voucherRef,
    {headers:{Authorization:"Bearer "+token},cache:"no-store"});
   if(res.status===401){onExpired();return;}
   if(!res.ok)throw Error(await reason(res));
   const d=await res.json() as Draft;
   if(!d||d.status!=="DRAFT_NOT_APPROVED_OR_POSTED"||!Array.isArray(d.lines))
    throw Error("This voucher is no longer editable. Refresh its latest status.");
   setTarget({ref:d.voucherRef,number:d.voucherNumber,version:d.version});
   setForm({type:d.header.type??"EXPENSE",financialYearRef:d.header.financialYearRef??"",
    branchRef:d.header.branchRef??"",postingDate:d.header.postingDate??"",
    payeeName:d.header.payeeName??"",purpose:d.header.purpose??"",
    tax:decimal(d.taxMinor),charges:decimal(d.chargesMinor)});
   setItems(d.lines.map(l=>({description:l.description,quantity:String(l.quantity),
    unitRate:decimal(l.unitRateMinor)})));
   setPending(null);setRetryAllowed(false);setEditing(true);
  }catch(e){setProblem(e instanceof Error?e.message:"This voucher could not be opened.");}
  finally{setBusy(false);}
 }
 function payload(){
  const b=branches.find(x=>x.branchRef===form.branchRef);
  return {financialYearRef:form.financialYearRef,voucherType:form.type,postingDate:form.postingDate,
   payeeName:form.payeeName,purpose:form.purpose,tax:form.tax,charges:form.charges,
   lines:items.map(it=>({description:it.description,quantity:Number(it.quantity),unitRate:it.unitRate})),
   ...(form.branchRef?{branchRef:form.branchRef,branchVersion:b?.version}:{}),
   ...(target?{expectedVersion:target.version}:{})};
 }
 async function save(original:Pending){
  setBusy(true);setProblem("");setRetryAllowed(false);
  try{
   const res=await identityRequest("/api/finance-accounting/"+original.path,{
    method:original.method,headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},
    body:JSON.stringify({...original.payload,requestKey:original.key})
   });
   if(res.status===401){onExpired();return;}
   if(!res.ok){setProblem(await reason(res));setPending(res.status>=500?original:null);return;}
   const raw:unknown=await res.json();
   if(!raw||typeof raw!=="object"||!("confirmed" in raw)||raw.confirmed!==true||
     !("voucherNumber" in raw)||typeof raw.voucherNumber!=="string")
    throw Error("UNCONFIRMED");
   setPending(null);setEditing(false);
   setSuccess("Voucher "+raw.voucherNumber+" saved as Draft. Not approved, posted or paid.");
   await fetchDrafts();
  }catch{
   setPending(original);
   setProblem("The draft save could not be confirmed. Check the original request before retrying.");
  }finally{setBusy(false);}
 }
 function submit(){
  if(busy||pending||!canManage)return;
  if(items.some(it=>!/^[1-9][0-9]{0,5}$/.test(it.quantity)||Number(it.quantity)>1000000)){
   setProblem("Enter each item quantity as a whole number between 1 and 1,000,000.");return;
  }
  void save({key:Crypto.randomUUID(),method:target?"PATCH":"POST",
   path:target?"vouchers/drafts/"+target.ref:"vouchers/drafts",payload:payload()});
 }
 async function check(){
  if(!pending||busy)return;
  setBusy(true);setProblem("");
  try{
   const res=await identityRequest("/api/finance-accounting/vouchers/draft-commands/"+
    pending.key,{headers:{Authorization:"Bearer "+token},cache:"no-store"});
   if(res.status===401){onExpired();return;}
   if(!res.ok){setProblem(await reason(res));return;}
   const raw:unknown=await res.json();
   if(!raw||typeof raw!=="object"||!("confirmed" in raw)||
     typeof raw.confirmed!=="boolean")throw Error("UNVERIFIED");
   if(raw.confirmed){setPending(null);setEditing(false);
    setSuccess("The original voucher draft was saved. It is not approved or paid.");
    await fetchDrafts();
   }else{setRetryAllowed(true);setProblem(
    "No completed draft save was found. Retry only the same request to prevent duplicates.");}
  }catch{setProblem("The original save is not confirmed. Check again before retrying.");}
  finally{setBusy(false);}
 }
 return <SafeAreaView style={s.safe} edges={["top","bottom"]}>
  <View style={s.header}><Pressable style={s.back} accessibilityRole="button"
   disabled={busy||Boolean(pending)} onPress={()=>editing?setEditing(false):onClose()}>
   <Text style={s.link}>‹ Back</Text></Pressable>
   <View style={s.heading}><Text style={s.eyebrow}>CAREGANGA / FINANCE</Text>
    <Text style={s.title}>{editing?(target?"Edit "+target.number:"New Voucher Draft"):"Voucher Drafts"}</Text></View>
  </View>
  <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
   {!editing&&<>
    <Text style={s.hint}>These are real draft vouchers only. None has been approved, posted or paid.</Text>
    <View style={s.actions}>
     <Pressable style={s.button} onPress={()=>void fetchDrafts()}><Text style={s.plain}>Refresh</Text></Pressable>
     {canManage&&<Pressable style={[s.button,s.primary]} onPress={start}>
      <Text style={s.primaryText}>+ New Voucher</Text></Pressable>}
    </View>
    {loading&&<ActivityIndicator color={t.primary}/>}
    {!loading&&!drafts.length&&<Text style={s.hint}>No voucher draft is available yet.</Text>}
    {drafts.map(v=><View key={v.voucherRef} style={s.card}>
     <Text style={s.bold}>{v.voucherNumber} · {v.type}</Text>
     <Text style={s.hint}>{v.payeeName} · {v.postingDate}</Text>
     <Text style={s.hint}>{v.purpose}</Text>
     <Text style={s.money}>{money(v.totalMinor)}</Text>
     <Text style={s.hint}>Draft — not posted</Text>
     {canManage&&<Pressable accessibilityRole="button" style={s.button}
      onPress={()=>void edit(v)}><Text style={s.plain}>Edit draft</Text></Pressable>}
    </View>)}
   </>}
   {editing&&<>
    <Text style={s.hint}>Stage 1: voucher details · Stage 2: item amounts. Saving does not post money.</Text>
    <Select label="Voucher type *" value={form.type}
     options={["PAYMENT","EXPENSE","CONTRA","GENERAL"].map(k=>({value:k,label:k.charAt(0)+k.slice(1).toLowerCase()}))}
     onChange={v=>update("type",v)}/>
    <Select label="Open financial year *" value={form.financialYearRef}
     options={years.filter(y=>y.status==="OPEN").map(y=>({value:y.yearRef,label:y.name}))}
     onChange={v=>update("financialYearRef",v)}/>
    <TextField label="Posting date YYYY-MM-DD *" maxLength={10} value={form.postingDate}
     update={v=>update("postingDate",v)}/>
    <Select label="Foundation or Active Branch" value={form.branchRef}
     options={[{value:"",label:"Foundation-wide"},...branches.map(b=>({value:b.branchRef,label:b.name+" · "+b.code}))]}
     onChange={v=>update("branchRef",v)}/>
    <TextField label="Payee or counterparty *" maxLength={150} value={form.payeeName}
     update={v=>update("payeeName",v)}/>
    <TextField label="Voucher purpose *" maxLength={500} value={form.purpose}
     update={v=>update("purpose",v)}/>
    {items.map((it,i)=><View key={i} style={s.card}>
     <View style={s.actions}><Text style={s.bold}>Item {i+1}</Text>
      {items.length>1&&<Pressable accessibilityRole="button"
       onPress={()=>setItems(v=>v.filter((_,n)=>n!==i))}><Text style={s.link}>Remove</Text></Pressable>}
     </View>
     <TextField label="Description *" maxLength={180} value={it.description}
      update={v=>itemField(i,"description",v)}/>
     <TextField label="Quantity, whole units *" maxLength={7} value={it.quantity}
      update={v=>itemField(i,"quantity",v)}/>
     <TextField label="Unit rate (₹) *" maxLength={16} value={it.unitRate}
      update={v=>itemField(i,"unitRate",v)}/>
    </View>)}
    {items.length<40&&<Pressable style={s.button}
     onPress={()=>setItems(v=>[...v,line()])}><Text style={s.plain}>+ Add voucher item</Text></Pressable>}
    <TextField label="Tax amount (₹)" maxLength={16} value={form.tax} update={v=>update("tax",v)}/>
    <TextField label="Other charges (₹)" maxLength={16} value={form.charges} update={v=>update("charges",v)}/>
    <Text style={s.hint}>A saved draft is not an approved financial voucher or verified payment.</Text>
   </>}
   {!!problem&&<View style={s.notice} accessibilityRole="alert"><Text style={s.noticeText}>{problem}</Text></View>}
   {!!success&&<View style={s.notice}><Text style={s.noticeText}>{success}</Text></View>}
   {pending&&<View style={s.notice}>
    <Text style={s.noticeText}>This save has an unknown result. Verify it before retrying.</Text>
    <Pressable style={s.button} disabled={busy} onPress={()=>void check()}>
     <Text style={s.plain}>Check original save</Text></Pressable>
    {retryAllowed&&<Pressable style={s.button} disabled={busy}
     onPress={()=>void save(pending)}><Text style={s.plain}>Retry same request</Text></Pressable>}
   </View>}
   {editing&&<View style={s.actions}>
    <Pressable style={s.button} disabled={busy||Boolean(pending)}
     onPress={()=>setEditing(false)}><Text style={s.plain}>Cancel</Text></Pressable>
    <Pressable style={[s.button,s.primary]} disabled={busy||Boolean(pending)}
     onPress={submit}><Text style={s.primaryText}>{busy?"Saving…":"Save Draft"}</Text></Pressable>
   </View>}
  </ScrollView>
 </SafeAreaView>;
}
const s=StyleSheet.create({
 safe:{flex:1,backgroundColor:t.background},
 header:{flexDirection:"row",gap:10,padding:14,alignItems:"center",
  backgroundColor:t.surface,borderBottomWidth:1,borderBottomColor:t.border},
 heading:{flex:1},eyebrow:{fontSize:10,color:t.mutedText},
 title:{fontSize:18,fontWeight:"700",color:t.text},
 back:{minHeight:48,justifyContent:"center"},
 link:{color:t.primary,fontWeight:"650"},
 body:{padding:14,paddingBottom:48,gap:13},
 hint:{color:t.mutedText,fontSize:13,lineHeight:21},
 card:{borderWidth:1,borderColor:t.border,borderRadius:8,backgroundColor:t.surface,padding:14,gap:7},
 bold:{fontSize:15,fontWeight:"700",color:t.text},
 money:{fontSize:17,fontWeight:"700",color:t.text},
 actions:{flexDirection:"row",justifyContent:"space-between",flexWrap:"wrap",alignItems:"center",gap:9},
 button:{minHeight:48,borderRadius:7,borderWidth:1,borderColor:t.border,
   backgroundColor:t.surface,paddingHorizontal:12,justifyContent:"center"},
 primary:{backgroundColor:t.primary,borderColor:t.primary},
 plain:{fontWeight:"600",color:t.text},
 primaryText:{fontWeight:"700",color:t.primaryText},
 field:{gap:5},
 label:{color:t.text,fontWeight:"600",fontSize:13},
 input:{backgroundColor:t.surface,borderColor:t.border,borderWidth:1,
  borderRadius:7,minHeight:48,paddingHorizontal:11,color:t.text},
 choices:{flexDirection:"row",flexWrap:"wrap",gap:7},
 chip:{backgroundColor:t.surface,borderWidth:1,borderColor:t.border,
  minHeight:45,borderRadius:7,paddingHorizontal:11,justifyContent:"center"},
 chipSelected:{backgroundColor:"#EEF4FF",borderColor:t.primary},
 selected:{color:t.primary,fontWeight:"700"},
 notice:{backgroundColor:t.surface,padding:12,borderWidth:1,borderRadius:8,
  borderColor:t.border,gap:8},
 noticeText:{color:t.text,fontSize:13,lineHeight:20}
});
