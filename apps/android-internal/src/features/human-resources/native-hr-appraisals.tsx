import React,{useCallback,useEffect,useRef,useState} from "react";
import {ActivityIndicator,Modal,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import * as Crypto from "expo-crypto";
import {careGangaTheme as theme} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";
type Summary={total:number;draft:number;submitted:number;released:number;averageScore:number|null;outstanding:number};
// B26 displays an unweighted average on a five-point scale; persisted scores stay 0..100.
const five=(value:number)=>Number((value/20).toFixed(2)).toString();
const overall=(value:{goal:number;competency:number;attendance:number})=>five((value.goal+value.competency+value.attendance)/3);
const scoreSummary=(value:{total:number;draft:number;submitted:number;released:number;averageScore:number|null;outstanding:number})=>[
 {label:"Total reviews",value:String(value.total)},{label:"Submitted (including released)",value:String(value.submitted+value.released)},
 {label:"Average score",value:typeof value.averageScore==="number"&&Number.isFinite(value.averageScore)?value.averageScore.toFixed(2)+" / 5":"—"},{label:"Perfect score (5/5)",value:Number.isSafeInteger(value.outstanding)?String(value.outstanding):"—"}
];
const statusOptions=[{value:"ALL",label:"All status"},{value:"DRAFT",label:"Draft"},{value:"SUBMITTED",label:"Submitted"},{value:"RELEASED",label:"Released"}] as const;
type Item={reference:string;periodStart:string;periodEnd:string;goal:number;competency:number;attendance:number;status:string};
export function NativeHrMyAppraisals({token,onExpired}:{token:string;onExpired:()=>void}){
 const [items,setItems]=useState<Item[]>([]),[linked,setLinked]=useState<boolean|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const sequence=useRef(0);
 const refresh=useCallback(async()=>{
  const read=++sequence.current;setLoading(true);setError("");setItems([]);setLinked(null);
  try{
   const response=await identityRequest("/api/hr/me/appraisals",{method:"GET",headers:{Authorization:"Bearer "+token},cache:"no-store"});
   if(response.status===401){if(read===sequence.current)onExpired();throw Error("Your session expired. Sign in again.");}
   if(!response.ok)throw Error("Released appraisals are unavailable. Refresh to retry.");
   const result=await response.json() as {linked:boolean;items:Item[]};
   if(typeof result.linked!=="boolean"||!Array.isArray(result.items))throw Error("Appraisal result unavailable");
   if(read===sequence.current){setItems(result.items);setLinked(result.linked);}
  }catch(e){if(read===sequence.current)setError(e instanceof Error?e.message:"Unable to read performance.");}
  finally{if(read===sequence.current)setLoading(false);}
 },[token,onExpired]);
 useEffect(()=>{void refresh();return()=>{sequence.current++;};},[refresh]);
 return <View style={styles.card}><Text style={styles.title}>My performance</Text>
  <Pressable accessibilityRole="button" accessibilityState={{disabled:loading}} disabled={loading} onPress={()=>void refresh()} style={styles.button}><Text style={styles.label}>Refresh</Text></Pressable>
  {loading&&<ActivityIndicator accessibilityLabel="Loading released appraisals"/>}
  {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
  {linked===false&&<Text style={styles.muted}>No current approved employment is linked to your account.</Text>}
  {linked===true&&!items.length&&<Text style={styles.muted}>No appraisal has been released to you.</Text>}
  {items.map(x=><View key={x.reference} style={styles.item}>
   <Text style={styles.label}>{x.periodStart} – {x.periodEnd}</Text>
   <Text>Goal & delivery: {five(x.goal)}/5</Text><Text>Competency: {five(x.competency)}/5</Text><Text>Attendance & conduct: {five(x.attendance)}/5</Text><Text style={styles.label}>Overall {overall(x)}/5 · Released</Text>
  </View>)}
 </View>;
}
const styles=StyleSheet.create({card:{padding:14,borderRadius:14,borderWidth:1,borderColor:theme.border,backgroundColor:theme.surface,gap:10},title:{fontSize:17,fontWeight:"700",color:theme.text},
 label:{fontSize:14,fontWeight:"600",color:theme.text},button:{backgroundColor:"#F1F5F9",borderRadius:9,minHeight:44,alignItems:"center",justifyContent:"center"},muted:{fontSize:13,color:theme.mutedText},item:{borderTopWidth:1,borderColor:theme.border,paddingTop:10,gap:5},error:{color:"#991B1B"}});

type StaffItem=Item&{employeeReference:string;employeeName:string;revision:number};
type Form={employeeReference:string;periodStart:string;periodEnd:string;goal:number;competency:number;attendance:number;strengths:string;improvement:string};
type Detail=StaffItem&{strengths:string;improvement:string};
type Person={employeeReference:string;employeeName:string};
const empty=():Form=>({employeeReference:"",periodStart:"",periodEnd:"",goal:0,competency:0,attendance:0,strengths:"",improvement:""});
const scores=[["goal","Goal & delivery"],["competency","Competency"],["attendance","Attendance & conduct"]] as const;
type Command={path:string;body:object};
const label=(v:string)=>({DRAFT:"Draft",SUBMITTED:"Submitted",RELEASED:"Released"} as Record<string,string>)[v]??"Unavailable";
export function NativeHrAppraisalWorkspace({token,onExpired}:{token:string;onExpired:()=>void}){
 const [items,setItems]=useState<StaffItem[]>([]),[summary,setSummary]=useState<Summary|null>(null),[offset,setOffset]=useState(0),[more,setMore]=useState(false);
 const [status,setStatus]=useState("ALL");
 const [people,setPeople]=useState<Person[]>([]),[search,setSearch]=useState(""),[optionsError,setOptionsError]=useState("");
 const [form,setForm]=useState<Form>(empty),[selected,setSelected]=useState<Detail|null>(null),[editor,setEditor]=useState(false);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[locked,setLocked]=useState(false);
 const pending=useRef<Command|null>(null),running=useRef(false),reads=useRef(0),optionReads=useRef(0);
 const api=useCallback(async<T,>(path:string,body?:object):Promise<T>=>{
  const r=await identityRequest("/api/hr/"+path,{method:body?"POST":"GET",cache:"no-store",headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const v=await r.json().catch(()=>null);
  if(r.status===401)onExpired();
  if(!r.ok)throw Object.assign(Error(r.status===401?"Sign in again.":r.status===403?"Your current role or branch cannot perform this action.":r.status===409?"The appraisal changed. Refresh and try again.":r.status===400?"Check the appraisal details.":"Appraisal result is unavailable. Retry the original request."),{status:r.status});
  if(!v||typeof v!=="object")throw Error("Original appraisal result unavailable");
  return v as T;
 },[token,onExpired]);
 const refresh=useCallback(async()=>{const seq=++reads.current;setLoading(true);setError("");setItems([]);setSummary(null);setMore(false);
  try{const v=await api<{items:StaffItem[];summary:Summary;hasMore:boolean}>("appraisals?offset="+offset+"&status="+encodeURIComponent(status));
   if(!Array.isArray(v.items)||!v.summary)throw Error("Performance list unavailable");
   if(seq===reads.current){setItems(v.items);setSummary(v.summary);setMore(v.hasMore===true);}
  }catch(e){if(seq===reads.current)setError(e instanceof Error?e.message:"Unable to load appraisals.");}
  finally{if(seq===reads.current)setLoading(false);}
 },[api,offset,status]);
 useEffect(()=>{void refresh();return()=>{reads.current++;};},[refresh]);
 const options=useCallback(async(q:string)=>{const seq=++optionReads.current;setPeople([]);setOptionsError("");
  try{const v=await api<{items:Person[]}>("appraisals/options?search="+encodeURIComponent(q));if(!Array.isArray(v.items))throw Error("Employee choices unavailable");
   if(seq===optionReads.current)setPeople(v.items);
  }catch(e){if(seq===optionReads.current)setOptionsError(e instanceof Error?e.message:"Unable to find employees.");}
 },[api]);
 useEffect(()=>()=>{optionReads.current++;},[]);
 const start=()=>{if(running.current||locked)return;setSelected(null);setForm(empty());setEditor(true);setNotice("");setError("");void options("");};
 const open=async(item:StaffItem)=>{
  if(running.current||locked)return;running.current=true;setBusy(true);setError("");setNotice("");setSelected(null);setEditor(false);
  try{const v=await api<Detail>("appraisals/"+encodeURIComponent(item.reference));
   if(v.reference!==item.reference||typeof v.strengths!=="string"||typeof v.improvement!=="string")throw Error("Original appraisal unavailable");
   setSelected(v);setForm({employeeReference:v.employeeReference,periodStart:v.periodStart,periodEnd:v.periodEnd,goal:v.goal,competency:v.competency,attendance:v.attendance,strengths:v.strengths,improvement:v.improvement});setEditor(true);
  }catch(e){setError(e instanceof Error?e.message:"Unable to open appraisal.");}finally{running.current=false;setBusy(false);}
 };
 const execute=async(action:"save"|"submit"|"release")=>{
  if(running.current)return;let cmd=pending.current;const v=selected,ref=v?encodeURIComponent(v.reference):"";
  if(!cmd){
   if(action==="save"&&(!form.employeeReference||!/^\d{4}-\d{2}-\d{2}$/.test(form.periodStart)||!/^\d{4}-\d{2}-\d{2}$/.test(form.periodEnd)||form.periodStart>form.periodEnd)){setError("Choose an employee and a valid appraisal period.");return;}
   if(action!=="save"&&!v)return;
   const requestKey=Crypto.randomUUID(),values={goal:form.goal,competency:form.competency,attendance:form.attendance,strengths:form.strengths,improvement:form.improvement};
   cmd=action==="save"?v?{path:"appraisals/"+ref+"/edit",body:{requestKey,expectedRevision:v.revision,...values}}:{path:"appraisals",body:{requestKey,...form}}:{path:"appraisals/"+ref+"/"+action,body:{requestKey,expectedRevision:v!.revision}};
   pending.current=cmd;
  }
  running.current=true;setBusy(true);setError("");setNotice("");
  try{const result=await api<StaffItem&{replayed?:boolean}>(cmd.path,cmd.body);
   if(!result.reference||!Number.isInteger(result.revision)||!["DRAFT","SUBMITTED","RELEASED"].includes(result.status))throw Error("Appraisal result is uncertain.");
   pending.current=null;setLocked(false);let current:Detail={...result,strengths:form.strengths.trim(),improvement:form.improvement.trim()};
   if(result.replayed!==false){
    try{const fresh=await api<Detail>("appraisals/"+encodeURIComponent(result.reference));
     if(fresh.reference!==result.reference||typeof fresh.strengths!=="string"||typeof fresh.improvement!=="string")throw Error("Detail unavailable");
     current=fresh;
    }catch{setSelected(null);setForm(empty());setEditor(false);await refresh();setNotice("Appraisal result confirmed. Open the saved review to verify its latest details.");return;}
   }
   setSelected(current);setForm({employeeReference:current.employeeReference,periodStart:current.periodStart,periodEnd:current.periodEnd,goal:current.goal,competency:current.competency,attendance:current.attendance,strengths:current.strengths,improvement:current.improvement});setEditor(true);await refresh();setNotice(label(current.status)+" · "+current.reference);
  }catch(e){setError(e instanceof Error?e.message:"Result unknown.");if(!locked&&e&&typeof e==="object"&&"status" in e&&typeof e.status==="number"&&e.status>=400&&e.status<500){pending.current=null;setLocked(false);}else setLocked(true);}
  finally{running.current=false;setBusy(false);}
 };
 const blocked=busy||locked,editable=editor&&(!selected||selected.status==="DRAFT");
 const closeEditor=()=>{if(running.current||locked)return;setEditor(false);setSelected(null);setForm(empty());setError("");setNotice("");};
 const changed=!!selected&&(scores.some(([key])=>form[key]!==selected[key])||form.strengths!==selected.strengths||form.improvement!==selected.improvement);
 const set=<K extends keyof Form,>(k:K,v:Form[K])=>{if(!blocked)setForm(old=>({...old,[k]:v}));};
 const btn=(name:string,onPress:()=>void,disabled=false,primary=false)=><Pressable accessibilityRole="button" accessibilityState={{disabled}} disabled={disabled} onPress={onPress} style={[styles.button,{paddingHorizontal:12,backgroundColor:primary?theme.primary:theme.selectedSurface},disabled&&{opacity:.5}]}><Text style={[styles.label,{color:primary?theme.primaryText:theme.text}]}>{name}</Text></Pressable>;
 const field=(name:string,value:string,onChange:(v:string)=>void,maxLength:number,multi=false)=><View style={{gap:4}}><Text style={styles.label}>{name}</Text><TextInput accessibilityLabel={name} editable={!blocked&&editable} value={value} onChangeText={onChange} maxLength={maxLength} multiline={multi} style={{minHeight:44,borderWidth:1,borderColor:theme.border,borderRadius:8,padding:10,color:theme.text,backgroundColor:theme.surface}}/></View>;
 return <View style={styles.card} accessibilityLabel="Performance management">
  <Text style={styles.title}>Performance management</Text>
  {summary&&<View style={{flexDirection:"row",flexWrap:"wrap",gap:8}}>{scoreSummary(summary).map(x=><View key={x.label} style={[styles.card,{flexBasis:"46%",flexGrow:1,minWidth:130,padding:10}]}><Text style={styles.muted}>{x.label}</Text><Text style={styles.title}>{x.value}</Text></View>)}</View>}
  {btn("New appraisal",start,blocked,true)}{btn("Refresh list",()=>void refresh(),blocked||loading)}
  {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}{!!notice&&<Text accessibilityRole="alert" style={styles.label}>{notice}</Text>}
  {loading&&<ActivityIndicator accessibilityLabel="Loading staff appraisals"/>}
  <Text style={styles.label}>Performance reviews</Text><View style={{flexDirection:"row",flexWrap:"wrap",gap:8}}>{statusOptions.map(x=><Pressable key={x.value} accessibilityRole="button" accessibilityState={{selected:status===x.value,disabled:blocked}} disabled={blocked} onPress={()=>{setStatus(x.value);setOffset(0);}} style={[styles.button,{paddingHorizontal:12,backgroundColor:status===x.value?theme.primary:theme.selectedSurface}]}><Text style={[styles.label,{color:status===x.value?theme.primaryText:theme.text}]}>{x.label}</Text></Pressable>)}</View>
  {!loading&&!items.length&&!error&&<Text style={styles.muted}>No appraisals match this status in your permitted scope.</Text>}
  {items.map(x=><View key={x.reference} style={styles.item}><Text style={styles.label}>{x.employeeName} · {label(x.status)}</Text><Text>{x.periodStart} – {x.periodEnd}</Text><Text style={styles.muted}>Goal {five(x.goal)}/5 · Competency {five(x.competency)}/5 · Attendance {five(x.attendance)}/5</Text><Text style={styles.label}>Overall {overall(x)}/5{x.goal===100&&x.competency===100&&x.attendance===100?" · Outstanding":""}</Text>{btn("View appraisal",()=>void open(x),blocked)}</View>)}
  {offset>0&&btn("Previous appraisals",()=>setOffset(v=>Math.max(0,v-25)),blocked||loading)}
  {more&&btn("Next appraisals",()=>setOffset(v=>v+25),blocked||loading)}
  <Modal visible={editor} animationType="slide" onRequestClose={closeEditor}>
   <View style={{flex:1,backgroundColor:theme.surface}}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:16,gap:14}}>
   <View style={{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:8}}><Text style={[styles.title,{flex:1}]}>{selected?selected.employeeName+" · "+label(selected.status):"New appraisal"}</Text>{btn("Close",closeEditor,blocked)}</View>
   {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}{!!notice&&<Text accessibilityRole="alert" style={styles.label}>{notice}</Text>}
   <View style={styles.card}>
   {!selected&&<><Text style={styles.label}>Find employee</Text><TextInput accessibilityLabel="Find employee" value={search} editable={!blocked} onChangeText={v=>setSearch(v.slice(0,80))} style={{minHeight:44,borderWidth:1,borderColor:theme.border,borderRadius:8,padding:10}}/>{btn("Search permitted employees",()=>void options(search),blocked)}
   {!!optionsError&&<Text accessibilityRole="alert" style={styles.error}>{optionsError}</Text>}
   {!people.length&&!optionsError&&<Text style={styles.muted}>Search for an eligible employee.</Text>}
   {people.map(x=><Pressable key={x.employeeReference} accessibilityRole="button" accessibilityState={{selected:form.employeeReference===x.employeeReference,disabled:blocked}} disabled={blocked} onPress={()=>set("employeeReference",x.employeeReference)} style={[styles.button,{padding:8,backgroundColor:form.employeeReference===x.employeeReference?theme.selectedSurface:theme.surface,borderWidth:1,borderColor:theme.border}]}><Text>{x.employeeName}</Text></Pressable>)}
   {field("Period start (YYYY-MM-DD)",form.periodStart,v=>set("periodStart",v),10)}{field("Period end (YYYY-MM-DD)",form.periodEnd,v=>set("periodEnd",v),10)}</>}
   {selected&&<Text>{form.periodStart} – {form.periodEnd}</Text>}
   {scores.map(([k,name])=><View key={k} style={{gap:8}}>
    <Text style={styles.label}>{name}: {five(form[k])}/5</Text>
    <View accessible accessibilityRole="adjustable" accessibilityLabel={name}
     accessibilityValue={{min:0,max:100,now:form[k],text:five(form[k])+" out of five"}}
     accessibilityState={{disabled:blocked||!editable}}
     accessibilityActions={[{name:"increment",label:"Increase score"},{name:"decrement",label:"Decrease score"}]}
     onAccessibilityAction={e=>{if(blocked||!editable)return;const a=e.nativeEvent.actionName;if(a==="increment"||a==="decrement")set(k,Math.max(0,Math.min(100,form[k]+(a==="increment"?1:-1))));}}
     style={{height:8,backgroundColor:theme.selectedSurface,borderRadius:8,overflow:"hidden"}}>
     <View style={{height:8,backgroundColor:theme.primary,width:(form[k]+"%") as `${number}%`}}/>
    </View>
    <View style={{flexDirection:"row",flexWrap:"wrap",gap:6}}>{[0,1,2,3,4,5].map(v=><Pressable key={v} accessibilityRole="button" accessibilityLabel={name+" "+v+" out of five"} accessibilityState={{selected:form[k]===v*20,disabled:blocked||!editable}} disabled={blocked||!editable} onPress={()=>set(k,v*20)} style={[styles.button,{minWidth:44,paddingHorizontal:10,backgroundColor:form[k]===v*20?theme.primary:theme.selectedSurface}]}><Text style={[styles.label,{color:form[k]===v*20?theme.primaryText:theme.text}]}>{v}</Text></Pressable>)}</View>
    <View style={{flexDirection:"row",gap:8}}>{btn("− 0.05",()=>set(k,Math.max(0,form[k]-1)),blocked||!editable||form[k]===0)}{btn("+ 0.05",()=>set(k,Math.min(100,form[k]+1)),blocked||!editable||form[k]===100)}</View>
   </View>)}
   {field("Strengths (private reviewer notes)",form.strengths,v=>set("strengths",v),1000,true)}{field("Areas to improve (private reviewer notes)",form.improvement,v=>set("improvement",v),1000,true)}
   <View style={[styles.card,{backgroundColor:theme.selectedSurface}]}><Text style={styles.label}>Overall score: {overall(form)} / 5</Text><Text style={styles.muted}>Average of all three components. Choose a score or adjust by 0.05. Only the confirmed perfect-score rating is labeled.</Text></View>
   {locked?<><Text accessibilityRole="alert" style={styles.error}>The original result is unknown. Retry the same command before editing.</Text>{btn("Retry original command",()=>void execute("save"),busy,true)}</>:<>
   {editable&&btn("Save draft",()=>void execute("save"),busy,true)}
   {selected?.status==="DRAFT"&&btn("Submit saved appraisal",()=>void execute("submit"),busy||changed,true)}
   {selected?.status==="SUBMITTED"&&btn("Release scores to employee",()=>void execute("release"),busy,true)}
   {changed&&<Text style={styles.muted}>Save changes before submitting.</Text>}{btn("Close appraisal",closeEditor,busy)}</>}
  </View></ScrollView></View></Modal>
 </View>;
}
