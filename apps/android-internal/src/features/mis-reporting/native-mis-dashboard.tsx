import {useCallback,useEffect,useRef,useState} from "react";
import {AppState,Pressable,StyleSheet,Text,View} from "react-native";
import {identityRequest} from "../identity-access/http-client";
import {NativeFinanceAction,NativeFinanceField,NativeFinanceOptions}
 from "../finance-accounting/finance-native-source-kit";
import {NativeMisFinanceTrend,NativeMisAppointmentDistribution,type MonthlyTrend}
 from "./native-mis-source-charts";

type Metric={key:string;label:string;unit:string;value:string};
type Source={sourceKey:string;sourceLabel:string;state:string;metrics:Metric[];
 readAt?:string;explanation?:string;trend?:MonthlyTrend};
type Overview={state:string;readAt:string;sources:Source[];
 periodLabel?:string;scopeLabel?:string;message?:string};
type Option={ref:string;name:string};
type Choices={state:string;years:Option[];branches:Option[];
 allBranches:boolean;healthAvailable:boolean;centers:Option[];centersComplete:boolean};
type Mode="OVERVIEW"|"FINANCE"|"HEALTH";
type HealthFilter={center:string;fromDay:string;untilDay:string;status:string};
const EMPTY:HealthFilter={center:"",fromDay:"",untilDay:"",status:""};
const STATUSES=[
 {ref:"",label:"All statuses"},
 {ref:"CONFIRMED",label:"Confirmed"},
 {ref:"ARRIVED",label:"Arrived"},
 {ref:"WAITING",label:"Waiting"},
 {ref:"IN_CONSULTATION",label:"In consultation"},
 {ref:"COMPLETED",label:"Completed"},
 {ref:"NO_SHOW",label:"No show"},
 {ref:"CANCELLED",label:"Cancelled"}
];
const validDay=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&
 !Number.isNaN(Date.parse(value+"T00:00:00Z"))&&
 new Date(value+"T00:00:00Z").toISOString().slice(0,10)===value;
const currency=(v:string)=>{
 try{const n=BigInt(v),a=n<0n?-n:n;
  return (n<0n?"−":"")+"₹"+(a/100n).toLocaleString("en-IN")+"."+
   (a%100n).toString().padStart(2,"0");
 }catch{return "Unavailable";}
};
/** US-001 original owner API, real native task-first dashboard. No private
 * data/identity in Public Android and no arbitrary report source queries.
 */
export function NativeMisDashboard({token,onExpired,onOpenFinance,onOpenPatientAdmin}:{
 token:string;onExpired:()=>void;onOpenFinance?:()=>void;
 onOpenPatientAdmin?:()=>void}){
 const [overview,setOverview]=useState<Overview|null>(null);
 const [busy,setBusy]=useState(true),[problem,setProblem]=useState("");
 const [optionsError,setOptionsError]=useState("");
 const seq=useRef(0),[ready,setReady]=useState(false);
 const [allBranches,setAllBranches]=useState(false);
 const [years,setYears]=useState<Option[]>([]),[branches,setBranches]=useState<Option[]>([]);
 const [centers,setCenters]=useState<Option[]>([]);
 const [centersComplete,setCentersComplete]=useState(true);
 const [healthAvailable,setHealthAvailable]=useState(false);
 const [financeAvailable,setFinanceAvailable]=useState(false);
 const [mode,setMode]=useState<Mode>("OVERVIEW");
 const [year,setYear]=useState(""),[branch,setBranch]=useState("");
 const [draft,setDraft]=useState<HealthFilter>(EMPTY);
 const [applied,setApplied]=useState<HealthFilter>(EMPTY);
 useEffect(()=>{
  let live=true;
  void (async()=>{
   try{
    const response=await identityRequest("/api/v1/mis/options",{
     headers:{Authorization:"Bearer "+token},cache:"no-store"});
    if(!live)return;
    if(response.status===401){onExpired();return;}
    if(!response.ok)throw Error("OPTIONS");
    const opts=await response.json() as Choices;
    if(!Array.isArray(opts.years)||!Array.isArray(opts.branches)||
       !Array.isArray(opts.centers))throw Error("OPTIONS");
    if(!live)return;
    setYears(opts.years);setBranches(opts.branches);setCenters(opts.centers);
    setFinanceAvailable(opts.state==="AVAILABLE");
    setAllBranches(opts.allBranches===true);
    setCentersComplete(opts.centersComplete!==false);
    setHealthAvailable(opts.healthAvailable===true);
    setBranch(opts.allBranches===true?"":opts.branches[0]?.ref??"");
   }catch{
    if(live)setOptionsError("Some report filters are unavailable. The overview may still work.");
   }finally{if(live)setReady(true);}
  })();
  return()=>{live=false;};
 },[token,onExpired]);
 const load=useCallback(async()=>{
  const requestId=++seq.current;
  setBusy(true);setProblem("");setOverview(null);
  try{
   const q=new URLSearchParams();q.set("view",mode);
   if(mode==="FINANCE"){
    if(year)q.set("yearRef",year);
    if(branch)q.set("branchRef",branch);
   }else if(mode==="HEALTH"){
    if(Boolean(applied.fromDay)!==Boolean(applied.untilDay))
     throw Error("Select both the start and end dates.");
    if(applied.center)q.set("centerRef",applied.center);
    if(applied.fromDay)q.set("fromDay",applied.fromDay);
    if(applied.untilDay)q.set("untilDay",applied.untilDay);
    if(applied.status)q.set("status",applied.status);
   }
   const response=await identityRequest("/api/v1/mis/dashboard?"+q.toString(),{
    headers:{Authorization:"Bearer "+token},cache:"no-store"});
   if(requestId!==seq.current)return;
   if(response.status===401){onExpired();return;}
   if(!response.ok)throw Error(response.status===403?
    "Your role or location no longer permits these figures.":
    response.status===400?"Check the selected date, center or financial year.":
    "Reporting sources could not be verified. Refresh to retry.");
   const data=await response.json() as Overview;
   if(!data||!Array.isArray(data.sources)||typeof data.state!=="string")
    throw Error("Current reporting figures are unavailable.");
   if(requestId===seq.current)setOverview(data);
  }catch(e){
   if(requestId===seq.current)setProblem(e instanceof Error?e.message:
    "Unable to check the reporting source.");
  }finally{if(requestId===seq.current)setBusy(false);}
 },[token,onExpired,mode,year,branch,applied]);
 useEffect(()=>{if(ready)void load();},[ready,load]);
 useEffect(()=>()=>{seq.current+=1;},[]);
 useEffect(()=>{
  if(!ready)return;
  const sub=AppState.addEventListener("change",state=>{
   if(state==="active")void load();
  });
  return()=>sub.remove();
 },[ready,load]);
 function applyHealth(){
  if(Boolean(draft.fromDay)!==Boolean(draft.untilDay)||
    (draft.fromDay&&(!validDay(draft.fromDay)||!validDay(draft.untilDay)))||
    draft.fromDay&&(
     draft.fromDay>draft.untilDay||
     Date.parse(draft.untilDay+"T00:00:00Z")-
      Date.parse(draft.fromDay+"T00:00:00Z")>366*86400000)){
   setProblem("Choose a valid start and end date, no more than one year apart.");
   return;
  }
  setApplied({...draft});
 }
 const modes:{ref:Mode;label:string}[]=[
  {ref:"OVERVIEW",label:"Overview"},
  ...(financeAvailable?
   [{ref:"FINANCE" as const,label:"Finance"}]:[]),
  ...(healthAvailable?[{ref:"HEALTH" as const,label:"Appointments"}]:[])
 ];
 return <View style={styles.container}>
  <View style={styles.header}>
   <View style={{flex:1}}>
    <Text accessibilityRole="header" style={styles.title}>Foundation MIS · Verified Sources</Text>
    <Text style={styles.helper}>Original owner records · current permitted access</Text>
   </View>
   <Pressable accessibilityRole="button" accessibilityLabel="Refresh dashboard figures"
    disabled={busy} style={styles.refresh} onPress={()=>void load()}>
    <Text style={styles.link}>{busy?"Checking…":"Refresh"}</Text>
   </Pressable>
  </View>
  {ready&&<View style={{gap:9}}>
   <NativeFinanceOptions label="Dashboard view" value={mode}
    options={modes} onChange={v=>setMode(v as Mode)}/>
   {mode==="FINANCE"&&<>
    <NativeFinanceOptions label="Financial year" value={year}
     options={[{ref:"",label:"All permitted years"},
      ...years.map(y=>({ref:y.ref,label:y.name}))]} onChange={setYear}/>
    {!!branches.length&&<NativeFinanceOptions label="Branch" value={branch}
     options={[...(allBranches?[{ref:"",label:"All permitted branches"}]:[]),
      ...branches.map(b=>({ref:b.ref,label:b.name}))]} onChange={setBranch}/>}
   </>}
   {mode==="HEALTH"&&<>
    {!!centers.length&&<NativeFinanceOptions label="Healthcare center" value={draft.center}
     options={[{ref:"",label:"All permitted centers"},
      ...centers.map(c=>({ref:c.ref,label:c.name}))]}
     onChange={v=>setDraft(old=>({...old,center:v}))}/>}
    {!centersComplete&&<Text style={styles.helper}>
     Additional centers can be found in the existing patient-management search.</Text>}
    <NativeFinanceField label="From date (YYYY-MM-DD)" value={draft.fromDay}
     onChange={v=>setDraft(old=>({...old,fromDay:v}))} placeholder="YYYY-MM-DD"/>
    <NativeFinanceField label="To date (YYYY-MM-DD)" value={draft.untilDay}
     onChange={v=>setDraft(old=>({...old,untilDay:v}))} placeholder="YYYY-MM-DD"/>
    <NativeFinanceOptions label="Appointment status" value={draft.status}
     options={STATUSES} onChange={v=>setDraft(old=>({...old,status:v}))}/>
    <NativeFinanceAction label="Apply appointment filters" onPress={applyHealth}/>
    <Text style={styles.helper}>These filters apply only to appointments, not finance.</Text>
   </>}
  </View>}
  {!!optionsError&&<Text style={styles.helper}>{optionsError}</Text>}
  {busy&&ready&&<Text style={styles.helper}>Checking current reporting sources…</Text>}
  {!!problem&&<Text accessibilityRole="alert" style={styles.error}>{problem}</Text>}
  {overview&&<>
   <Text style={styles.helper}>{overview.periodLabel} · {overview.scopeLabel}</Text>
   <Text style={styles.helper}>Retrieved {new Date(overview.readAt).toLocaleString("en-IN")}</Text>
   {!!overview.message&&<Text style={styles.helper}>{overview.message}</Text>}
   {overview.sources.map(source=><View key={source.sourceKey} style={styles.source}>
    <Text accessibilityRole="header" style={styles.title}>{source.sourceLabel}</Text>
    {source.state==="AVAILABLE"?<>
     <View style={styles.metrics}>
      {source.metrics.map(m=><View key={m.key} style={styles.card}>
       <Text style={styles.helper}>{m.label}</Text>
       <Text accessibilityLabel={m.label+": "+(m.unit==="INR_MINOR"?currency(m.value):m.value)}
        style={styles.value}>{m.unit==="INR_MINOR"?currency(m.value):m.value}</Text>
      </View>)}
     </View>
     {!!source.explanation&&<Text style={styles.helper}>{source.explanation}</Text>}
     {source.trend&&<NativeMisFinanceTrend trend={source.trend}/>}
     {source.sourceKey==="CG15_APPOINTMENT_STATES"&&
      <NativeMisAppointmentDistribution metrics={source.metrics}/>}
     {!!onOpenFinance&&source.sourceKey==="CG09_POSTED_FINANCE"&&
      <Pressable accessibilityRole="button" style={styles.refresh} onPress={onOpenFinance}>
       <Text style={styles.link}>Open detailed finance reports</Text>
      </Pressable>}
     {!!onOpenPatientAdmin&&source.sourceKey==="CG15_APPOINTMENT_STATES"&&
      <Pressable accessibilityRole="button" style={styles.refresh}
       onPress={onOpenPatientAdmin}>
       <Text style={styles.link}>Open patient management</Text>
      </Pressable>}
    </>:<Text style={styles.helper}>{source.state==="EMPTY"?
      "No records found for this permitted reporting scope.":
      source.state==="SUPPRESSED"?
      "This group is too small to show its private appointment counts.":
      "Original source unavailable; no estimated figures."}</Text>}
   </View>)}
   {overview.sources.length===0&&
    <Text style={styles.helper}>No reporting sources are permitted for this role.</Text>}
  </>}
 </View>;
}
const styles=StyleSheet.create({
 container:{marginHorizontal:18,marginTop:18,gap:9},
 header:{flexDirection:"row",alignItems:"center",gap:10},
 title:{color:"#0F172A",fontSize:16,fontWeight:"800"},
 helper:{color:"#64748B",fontSize:12,lineHeight:18},
 error:{color:"#B91C1C",fontSize:13,padding:10,backgroundColor:"#FEF2F2",borderRadius:10},
 refresh:{borderWidth:1,borderColor:"#BFDBFE",backgroundColor:"#EFF6FF",
  paddingHorizontal:12,paddingVertical:9,borderRadius:10,minHeight:48,justifyContent:"center"},
 link:{color:"#1D4ED8",fontSize:12,fontWeight:"700"},
 source:{backgroundColor:"#FFFFFF",padding:14,gap:9,borderRadius:14,
  borderColor:"#E2E8F0",borderWidth:1},
 metrics:{flexDirection:"row",flexWrap:"wrap",gap:8},
 card:{borderWidth:1,borderColor:"#E2E8F0",borderRadius:10,
  padding:12,minWidth:"45%",flexGrow:1,gap:5,backgroundColor:"#FFFFFF"},
 value:{fontSize:16,fontWeight:"800",color:"#0F172A"}
});
