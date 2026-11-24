import {useCallback,useEffect,useRef,useState} from "react";
import {AppState,StyleSheet,Text,View} from "react-native";
import * as Crypto from "expo-crypto";
import {identityRequest} from "../identity-access/http-client";
import {nativeMisProblem} from "./native-mis-problem";
import {NativeFinanceAction,NativeFinanceField,NativeFinanceOptions}
 from "../finance-accounting/finance-native-source-kit";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
type Saved={ref:string;name:string;state:string;sourceKey?:string|null};
type Schedule={ref:string;state:string;cadence:string;savedReportName:string;
 timezone:string;localTime:string;nextDueAt:string;revision:number;canActivate:boolean};
type History={state:string;createdAt:string;deliveryState:string;dueAt:string;
 sourceAsOf:string|null;rowCount:number|null;format:string|null};
async function api<T>(token:string,path:string,body?:object):Promise<T>{
 const response=await identityRequest("/api/v1/mis/reports/"+path,{
  method:body?"POST":"GET",cache:"no-store",
  headers:{Authorization:"Bearer "+token,
   ...(body?{"Content-Type":"application/json"}:{})},
  ...(body?{body:JSON.stringify(body)}:{})});
 if(!response.ok)throw await nativeMisProblem(response,
  "The schedule status could not be confirmed. Refresh before retrying.");
 return response.json() as Promise<T>;
}
const localDate=(when:string,zone:string)=>{
 try{
  const fmt=new Intl.DateTimeFormat("en-GB",{timeZone:zone,
   year:"numeric",month:"2-digit",day:"2-digit"});
  const p=Object.fromEntries(fmt.formatToParts(new Date(when))
   .map(x=>[x.type,x.value]));
  return p.year+"-"+p.month+"-"+p.day;
 }catch{return "";}
};
/** Original C49 native schedule controls for real CG09 posted summaries.
 * Only in-app notice after verified CG19 PDF; never a fake email or sent
 * acknowledgement. Same staff role and original CG20 API as Admin Web.
 */
export function NativeMisSchedules({token,onExpired}:{token:string;onExpired:()=>void}){
 const [saved,setSaved]=useState<Saved[]>([]);
 const [rows,setRows]=useState<Schedule[]>([]);
 const [selected,setSelected]=useState("");
 const [cadence,setCadence]=useState("MONTHLY");
 const [zone,setZone]=useState("Asia/Kolkata");
 const [day,setDay]=useState("");
 const [time,setTime]=useState("09:00");
 const [editing,setEditing]=useState<Schedule|null>(null);
 const [loading,setLoading]=useState(false),[error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [history,setHistory]=useState<History[]>([]);
 const seq=useRef(0),pending=useRef<{payload:string;key:string}|null>(null);
 const fail=useCallback((err:unknown)=>{
  if(err&&typeof err==="object"&&"status" in err&&err.status===401)onExpired();
  setError(err instanceof Error?err.message:"This schedule cannot be checked.");
 },[onExpired]);
 const load=useCallback(async()=>{
  const rev=++seq.current;setLoading(true);setError("");
  try{
   const [savedReports,schedules]=await Promise.all([
    api<{items:Saved[]}>(token,"saved"),
    api<{schedules:Schedule[]}>(token,"schedules")]);
   if(!Array.isArray(savedReports.items)||!Array.isArray(schedules.schedules))
    throw Error("Current schedule and saved report information is unavailable.");
   if(rev===seq.current){
    setSaved(savedReports.items.filter(x=>x.state==="ACTIVE"&&
     (x.sourceKey==="FINANCE_POSTED_SUMMARY"||x.sourceKey==="PROJECT_STATUS_REPORT")));
    setRows(schedules.schedules);
   }
  }catch(e){if(rev===seq.current){setSaved([]);setRows([]);fail(e);}}
  finally{if(rev===seq.current)setLoading(false);}
 },[token,fail]);
 useEffect(()=>{void load();return()=>{seq.current++;};},[load]);
 useEffect(()=>{
  const sub=AppState.addEventListener("change",state=>{
   seq.current++;setSaved([]);setRows([]);setHistory([]);
   if(state==="active"){
    pending.current=null;setEditing(null);void load();
   }
  });
  return()=>sub.remove();
 },[load]);
 function reset(){
  setEditing(null);setDay("");pending.current=null;
 }
 async function save(){
  if(loading||!day||!editing&&!selected)return;
  const fields={cadence,timezone:zone,firstDate:day,localTime:time};
  const payload=JSON.stringify({savedRef:selected,...fields});
  if(!editing&&pending.current?.payload!==payload)
   pending.current={payload,key:Crypto.randomUUID()};
  setLoading(true);setError("");setNotice("");
  try{
   const result=editing?
    await api<{message:string}>(token,
     "schedules/"+encodeURIComponent(editing.ref)+"/edit",{
      expectedRevision:editing.revision,...fields}):
    await api<{message:string}>(token,"schedules",{
     savedRef:selected,...fields,requestKey:pending.current!.key});
   setNotice(result.message||
    "Schedule active for verified private in-app reports.");
   reset();await load();
  }catch(e){fail(e);}finally{setLoading(false);}
 }
 async function pause(item:Schedule){
  if(loading||item.state!=="ACTIVE")return;
  setLoading(true);setError("");setNotice("");
  try{
   await api(token,"schedules/"+encodeURIComponent(item.ref)+"/pause",{
    expectedRevision:item.revision});
   setNotice("Schedule paused. No new report occurrence will be created.");
   await load();
  }catch(e){fail(e);}finally{setLoading(false);}
 }
 async function resume(item:Schedule){
  if(loading||item.state!=="PAUSED")return;
  setLoading(true);setError("");setNotice("");
  try{
   const result=await api<{message:string}>(token,
    "schedules/"+encodeURIComponent(item.ref)+"/resume",{
     expectedRevision:item.revision});
   setNotice(result.message||"Schedule resumed with current permissions.");
   await load();
  }catch(e){fail(e);}finally{setLoading(false);}
 }
 function edit(item:Schedule){
  setEditing(item);setCadence(item.cadence);
  setZone(item.timezone);setTime(item.localTime.slice(0,5));
  setDay(localDate(item.nextDueAt,item.timezone));
  setHistory([]);setError("");setNotice("");pending.current=null;
 }
 async function openHistory(item:Schedule){
  if(loading)return;
  setLoading(true);setError("");setHistory([]);
  try{
   const result=await api<{runs:History[]}>(token,
    "schedules/"+encodeURIComponent(item.ref)+"/history");
   setHistory(Array.isArray(result.runs)?result.runs:[]);
  }catch(e){fail(e);}finally{setLoading(false);}
 }
 return <View style={s.root}>
  <Text accessibilityRole="header" style={s.title}>My report schedules</Text>
  <Text style={s.text}>Your authorized posted-finance summaries and project status reports can run
   automatically at a selected local time. CareGanga stores the protected PDF
   with CG-19 and records a private in-app notice only after confirmation.
   The recipient is your current account. Other report sources, email and SMS
   are not enabled.</Text>
  {!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
  {!!notice&&<Text style={s.text}>{notice}</Text>}
  <NativeFinanceAction label="Refresh current schedules"
   disabled={loading} secondary onPress={()=>void load()}/>
  {(!!saved.length||editing!==null)&&<>
   {editing?<Text style={s.title}>Editing: {editing.savedReportName}</Text>:
    <NativeFinanceOptions label="My saved finance or project report" value={selected}
     options={[{ref:"",label:"Choose a private finance or project report"},...saved.map(x=>({
      ref:x.ref,label:x.name}))]} onChange={setSelected}/>}
   <NativeFinanceOptions label="Recurrence" value={cadence}
    options={["DAILY","WEEKLY","MONTHLY","YEARLY"].map(value=>({
     ref:value,label:value[0]+value.slice(1).toLowerCase()}))}
    onChange={setCadence}/>
   <NativeFinanceField label="Timezone" value={zone}
    onChange={setZone} placeholder="Asia/Kolkata"/>
   <NativeFinanceField label="First local date (YYYY-MM-DD)" value={day}
    onChange={setDay} placeholder="2026-11-25"/>
   <NativeFinanceField label="Local time (HH:MM)" value={time}
    onChange={setTime} placeholder="09:00"/>
   <NativeFinanceAction
    label={editing?"Save changes and activate":"Create active in-app schedule"}
    disabled={loading||!day||!editing&&!selected}
    onPress={()=>void save()}/>
   {!!editing&&<NativeFinanceAction label="Cancel schedule edit" secondary
    disabled={loading} onPress={reset}/>}
  </>}
  {!saved.length&&!editing&&<Text style={s.text}>
   No eligible private report is available for new schedules.</Text>}
  {rows.map(item=><View key={item.ref} style={s.card}>
   <Text style={s.title}>{item.savedReportName} · {item.cadence[0]+
    item.cadence.slice(1).toLowerCase()}</Text>
   <Text style={s.text}>Status: {item.state==="ACTIVE"?"Active · in-app only":
    item.state==="PAUSED"?"Paused · not sending":item.state}</Text>
   <Text style={s.text}>Timezone: {item.timezone}</Text>
   <Text style={s.text}>Next planned: {new Date(item.nextDueAt).toLocaleString(
    "en-IN",{timeZone:item.timezone})}</Text>
   {item.state==="ACTIVE"&&<NativeFinanceAction label="Pause this schedule"
    disabled={loading} secondary onPress={()=>void pause(item)}/>}
   {item.state==="PAUSED"&&<NativeFinanceAction label="Resume with current permissions"
    disabled={loading} secondary onPress={()=>void resume(item)}/>}
   {item.state!=="DISABLED"&&<NativeFinanceAction label="Edit schedule"
    disabled={loading} secondary onPress={()=>edit(item)}/>}
   <NativeFinanceAction label="View actual report and delivery history"
    secondary disabled={loading} onPress={()=>void openHistory(item)}/>
  </View>)}
  {!history.length&&<Text style={s.text}>No selected schedule runs to display.</Text>}
  {history.map((item,index)=><Text key={index} style={s.text}>
   {item.state.replaceAll("_"," ")} · In-app notice:
   {" "}{item.deliveryState.replaceAll("_"," ")} ·
   {" "}{new Date(item.createdAt).toLocaleString("en-IN")}
   {item.sourceAsOf&&" · Source snapshot: "+
     new Date(item.sourceAsOf).toLocaleString("en-IN")}
   {item.rowCount!==null&&item.rowCount!==undefined&&
    " · Verified rows: "+item.rowCount}
   {item.format&&" · "+item.format}
  </Text>)}
 </View>;
}
const s=StyleSheet.create({
 root:{paddingTop:14,borderTopWidth:1,borderTopColor:t.border,gap:9},
 title:{fontSize:14,fontWeight:"800",color:t.text},
 text:{fontSize:12,lineHeight:19,color:t.mutedText},
 error:{fontSize:13,color:t.error,lineHeight:19},
 card:{padding:12,gap:8,borderRadius:10,borderWidth:1,borderColor:t.border}
});
