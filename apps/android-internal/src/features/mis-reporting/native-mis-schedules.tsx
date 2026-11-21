import {useCallback,useEffect,useRef,useState} from "react";
import {AppState,StyleSheet,Text,View} from "react-native";
import * as Crypto from "expo-crypto";
import {identityRequest} from "../identity-access/http-client";
import {nativeMisProblem} from "./native-mis-problem";
import {NativeFinanceAction,NativeFinanceField,NativeFinanceOptions}
 from "../finance-accounting/finance-native-source-kit";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
type Saved={ref:string;name:string;state:string};
type Schedule={ref:string;state:string;cadence:string;timezone:string;
 localTime:string;nextDueAt:string;revision:number;canActivate:boolean};
async function api<T>(token:string,path:string,body?:object):Promise<T>{
 const r=await identityRequest("/api/v1/mis/reports/"+path,{
  method:body?"POST":"GET",cache:"no-store",
  headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},
  ...(body?{body:JSON.stringify(body)}:{})});
 if(!r.ok)throw await nativeMisProblem(r,"This schedule outcome is unconfirmed. Refresh its current status.");
 return r.json() as Promise<T>;
}
/** Paused-only native schedule management: no fake successful sending or
 * unauthorized background access to patient/finance reports.
 */
export function NativeMisSchedules({token,onExpired}:{token:string;onExpired:()=>void}){
 const [saved,setSaved]=useState<Saved[]>([]),[rows,setRows]=useState<Schedule[]>([]);
 const [selected,setSelected]=useState("");
 const [cadence,setCadence]=useState("MONTHLY");
 const [zone,setZone]=useState("Asia/Kolkata"),[day,setDay]=useState("");
 const [time,setTime]=useState("09:00");
 const [loading,setLoading]=useState(false),[error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [history,setHistory]=useState<{state:string;createdAt:string}[]>([]);
 const seq=useRef(0);
 const pending=useRef<{payload:string;key:string}|null>(null);
 const fail=useCallback((e:unknown)=>{
  if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
  setError(e instanceof Error?e.message:"Private schedules are unavailable.");
 },[onExpired]);
 const load=useCallback(async()=>{
  const rev=++seq.current;setLoading(true);setError("");
  try{
   const [a,b]=await Promise.all([
    api<{items:Saved[]}>(token,"saved"),
    api<{schedules:Schedule[]}>(token,"schedules")]);
   if(!Array.isArray(a.items)||!Array.isArray(b.schedules))
    throw Error("The saved report and schedule list cannot be verified.");
   if(rev===seq.current){
    setSaved(a.items.filter(x=>x.state==="ACTIVE"));
    setRows(b.schedules);
   }
  }catch(e){if(rev===seq.current){setSaved([]);setRows([]);fail(e)}}
  finally{if(rev===seq.current)setLoading(false);}
 },[token,fail]);
 useEffect(()=>{void load();return()=>{seq.current++;};},[load]);
 useEffect(()=>{
  const sub=AppState.addEventListener("change",status=>{
   seq.current++;setSaved([]);setRows([]);setHistory([]);
   if(status==="active"){pending.current=null;void load();}
  });
  return()=>sub.remove();
 },[load]);
 async function create(){
  if(loading||!selected)return;
  const body={savedRef:selected,cadence,timezone:zone,
   firstDate:day,localTime:time};
  const payload=JSON.stringify(body);
  if(pending.current?.payload!==payload)
   pending.current={payload,key:Crypto.randomUUID()};
  setLoading(true);setError("");setNotice("");
  try{
   const result=await api<{message:string}>(token,"schedules",{
    ...body,requestKey:pending.current.key});
   pending.current=null;
   setNotice(result.message??"Schedule saved as paused. Automatic delivery is not active.");
   await load();
  }catch(e){fail(e)}finally{setLoading(false);}
 }
 async function openHistory(ref:string){
  setLoading(true);setError("");setHistory([]);
  try{
   const result=await api<{runs:{state:string;createdAt:string}[]}>(
    token,"schedules/"+encodeURIComponent(ref)+"/history");
   setHistory(Array.isArray(result.runs)?result.runs:[]);
  }catch(e){fail(e)}finally{setLoading(false);}
 }
 return <View style={s.root}>
  <Text accessibilityRole="header" style={s.title}>My report schedules</Text>
  <Text style={s.text}>Automatic delivery is not enabled yet. New schedules
   remain paused until current recipient permission and original CG-19
   delivery can be verified. No reports are sent in this mode.</Text>
  {!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
  {!!notice&&<Text style={s.text}>{notice}</Text>}
  <NativeFinanceAction label="Refresh saved schedules" disabled={loading}
   secondary onPress={()=>void load()}/>
  {!!saved.length&&<>
   <NativeFinanceOptions label="My saved report" value={selected}
    options={[{ref:"",label:"Choose a private report"},
     ...saved.map(x=>({ref:x.ref,label:x.name}))]} onChange={setSelected}/>
   <NativeFinanceOptions label="Recurrence" value={cadence}
    options={["DAILY","WEEKLY","MONTHLY","YEARLY"].map(x=>({
     ref:x,label:x[0]+x.slice(1).toLowerCase()}))} onChange={setCadence}/>
   <NativeFinanceField label="Timezone (IANA)" value={zone} onChange={setZone}
    placeholder="Asia/Kolkata"/>
   <NativeFinanceField label="First local date (YYYY-MM-DD)" value={day}
    onChange={setDay} placeholder="2026-11-25"/>
   <NativeFinanceField label="Local time (HH:MM)" value={time} onChange={setTime}
    placeholder="09:00"/>
   <NativeFinanceAction label="Save as paused schedule"
    disabled={loading||!selected||!day} onPress={()=>void create()}/>
  </>}
  {!saved.length&&<Text style={s.text}>No eligible private saved report is available.</Text>}
  {rows.map(row=><View key={row.ref} style={s.card}>
   <Text style={s.title}>{row.cadence[0]+row.cadence.slice(1).toLowerCase()}</Text>
   <Text style={s.text}>Status: {row.state==="PAUSED"?"Paused — not sending":row.state}</Text>
   <Text style={s.text}>Timezone: {row.timezone}</Text>
   <Text style={s.text}>Planned: {new Date(row.nextDueAt).toLocaleString("en-IN")}</Text>
   <NativeFinanceAction label="View actual run history" secondary disabled={loading}
    onPress={()=>void openHistory(row.ref)}/>
  </View>)}
  {history.map((row,i)=><Text key={i} style={s.text}>
   {row.state.replaceAll("_"," ")} · {new Date(row.createdAt).toLocaleString("en-IN")}</Text>)}
 </View>;
}
const s=StyleSheet.create({
 root:{paddingTop:14,borderTopWidth:1,borderTopColor:t.border,gap:9},
 title:{fontSize:14,fontWeight:"800",color:t.text},
 text:{fontSize:12,lineHeight:19,color:t.mutedText},
 error:{fontSize:13,color:t.error,lineHeight:19},
 card:{padding:12,gap:8,borderRadius:10,borderWidth:1,borderColor:t.border}
});
