import {useCallback,useEffect,useRef,useState} from "react";
import {AppState,Pressable,StyleSheet,Text,View} from "react-native";
import {identityRequest} from "../identity-access/http-client";
import {nativeMisProblem} from "./native-mis-problem";
import {NativeFinanceAction,NativeFinanceField,NativeFinanceOptions}
 from "../finance-accounting/finance-native-source-kit";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {NativeMisSaved} from "./native-mis-saved";
import {NativeMisExports} from "./native-mis-exports";
import {NativeMisSchedules} from "./native-mis-schedules";
import {NativeMisFinanceTrend,NativeMisAppointmentDistribution,NativeMisAppointmentGroupBars}
 from "./native-mis-source-charts";
import {NativeMisGroupedFinanceChart} from "./native-mis-grouped-finance-chart";
type Kind="FINANCE_POSTED_LEDGER"|"FINANCE_POSTED_SUMMARY"|
 "FINANCE_POSTED_TREND"|"FINANCE_POSTED_GROUPED"|
 "APPOINTMENT_STATUS"|"APPOINTMENT_STATUS_GROUPED"|"APPOINTMENT_DOCTOR_SUMMARY"|"PLATFORM_AUDIT_ACTIVITY"|"DIAGNOSTICS_CATALOG_SUMMARY"|"BENEFICIARY_ASSISTANCE_SUMMARY"|"MEMBERSHIP_ROSTER_SUMMARY"|"VOLUNTEER_ROSTER_SUMMARY"|"PAYROLL_STATUS_SUMMARY"|"DONATION_RECEIPT_SUMMARY";
type Template={kind:Kind;label:string;views:("TABLE"|"SUMMARY"|"CHART"|"PIVOT")[];description:string};
type Option={ref:string;name:string};
type AreaOption=Option&{level:string};
type Catalog={templates:Template[];finance:{ready:boolean;state?:"AVAILABLE"|"ACCESS_RESTRICTED"|"SOURCE_UNAVAILABLE";years:Option[];branches:Option[];
 allBranches:boolean;areas?:AreaOption[]};appointments:{ready:boolean;state?:"AVAILABLE"|"ACCESS_RESTRICTED"|"SOURCE_UNAVAILABLE";centers:Option[];complete:boolean};
 capabilities:{manage:boolean;export:boolean;schedule:boolean;share?:boolean}};
type Preview={state:string;kind:Kind;view:"TABLE"|"SUMMARY"|"CHART"|"PIVOT";label:string;
 rows:Record<string,string>[];columns:{key:string;label:string;unit?:string}[];
 nextOffset:number|null;sourceAsOf?:string;sourceReadAt:string;
 explanation:string;scopeLabel:string};
type Period="CUSTOM"|"DAY"|"WEEK"|"MONTH"|"YEAR";
const reportLocalDate=(date:Date)=>String(date.getFullYear())+"-"+
 String(date.getMonth()+1).padStart(2,"0")+"-"+
 String(date.getDate()).padStart(2,"0");
function localReportPeriod(period:Exclude<Period,"CUSTOM">){
 const today=new Date(),start=new Date(today.getFullYear(),today.getMonth(),today.getDate());
 if(period==="WEEK")start.setDate(start.getDate()-((start.getDay()+6)%7));
 else if(period==="MONTH")start.setDate(1);
 else if(period==="YEAR"){start.setMonth(0);start.setDate(1);}
 return {from:reportLocalDate(start),until:reportLocalDate(today)};
}
const states=[
 {ref:"",label:"All statuses"},{ref:"CONFIRMED",label:"Confirmed"},
 {ref:"ARRIVED",label:"Arrived"},{ref:"WAITING",label:"Waiting"},
 {ref:"IN_CONSULTATION",label:"In consultation"},
 {ref:"COMPLETED",label:"Completed"},{ref:"NO_SHOW",label:"No show"},
 {ref:"CANCELLED",label:"Cancelled"}
];
const currency=(s:string)=>{
 try{const v=BigInt(s),a=v<0n?-v:v;
  return (v<0n?"−":"")+"₹"+(a/100n).toLocaleString("en-IN")+
   "."+(a%100n).toString().padStart(2,"0");
 }catch{return "Not confirmed";}
};
async function fetchSource<T>(token:string,path:string,body?:object):Promise<T>{
 const r=await identityRequest("/api/v1/mis/reports/"+path,{
  method:body?"POST":"GET",cache:"no-store",
  headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},
  ...(body?{body:JSON.stringify(body)}:{})});
 if(!r.ok)throw await nativeMisProblem(r,"The report could not be verified. Check the source filters and try again.");
 return r.json() as Promise<T>;
}
/** Internal Android native C44/C46/C47 standard reporting. One real CG20
 * source contract; no public report entry or embedded WebView.
 */
export function NativeMisReports({token,onExpired,onDraftChange}:{token:string;onExpired:()=>void;
 onDraftChange?:(hasUnsavedDraft:boolean)=>void}){
 const [catalog,setCatalog]=useState<Catalog|null>(null);
 const [kind,setKind]=useState<Kind|null>(null);
 const [view,setView]=useState<"TABLE"|"SUMMARY"|"CHART"|"PIVOT">("TABLE");
 const [year,setYear]=useState(""),[branch,setBranch]=useState("");
 const [area,setArea]=useState("");
 const [center,setCenter]=useState(""),[from,setFrom]=useState(""),[until,setUntil]=useState("");
 const [status,setStatus]=useState("");
 const [period,setPeriod]=useState<Period>("CUSTOM");
 const [groupBy,setGroupBy]=useState<"CATEGORY"|"POSTING_KIND"|"ACCOUNT_NAME">("CATEGORY");
 const [sortBy,setSortBy]=useState<"NAME"|"DEBIT"|"CREDIT">("NAME");
 const [sortDirection,setSortDirection]=useState<"ASC"|"DESC">("ASC");
 const [preview,setPreview]=useState<Preview|null>(null);
 const [busy,setBusy]=useState(false),[problem,setProblem]=useState("");
 const seq=useRef(0);
 const load=useCallback(async()=>{
  const rev=++seq.current;setCatalog(null);setPreview(null);setProblem("");setBusy(true);
  try{
   const result=await fetchSource<Catalog>(token,"templates");
   if(!Array.isArray(result.templates))throw Error("Report source options could not be verified.");
   if(rev===seq.current){setCatalog(result);
    setBranch(result.finance.allBranches?"":result.finance.branches[0]?.ref??"");
    setArea("");
    setKind(result.templates[0]?.kind??null);
    setView(result.templates[0]?.views[0]??"TABLE");}
  }catch(e){
   if(rev===seq.current){if(e&&typeof e==="object"&&"status" in e&&e.status===401)
    onExpired();
    setProblem(e instanceof Error?e.message:"Report catalog unavailable.");}
  }finally{if(rev===seq.current)setBusy(false);}
 },[token,onExpired]);
 // Filter invalidation runs before initial catalog fetch on mount; otherwise
 // it could invalidate the initial in-flight catalog response.
 useEffect(()=>{seq.current++;setPreview(null);},
  [kind,view,year,branch,area,center,from,until,status,groupBy,sortBy,sortDirection]);
 useEffect(()=>{void load();return()=>{seq.current++};},[load]);
 useEffect(()=>{
  const sub=AppState.addEventListener("change",status=>{
   seq.current++;setPreview(null);
   if(status==="active"){
    setCatalog(null);setKind(null);setYear("");setBranch("");setArea("");
    setCenter("");setFrom("");setUntil("");setStatus("");setPeriod("CUSTOM");
    void load();
   }
  });
  return()=>sub.remove();
 },[load]);
 const chosen=catalog?.templates.find(x=>x.kind===kind);
 const finance=kind?.startsWith("FINANCE_");
 const health=kind==="APPOINTMENT_STATUS"||kind==="APPOINTMENT_STATUS_GROUPED"||
 kind==="APPOINTMENT_DOCTOR_SUMMARY";
 const grouped=kind==="FINANCE_POSTED_GROUPED";
 const geography=kind==="FINANCE_POSTED_LEDGER"||grouped;
 const dated=kind==="FINANCE_POSTED_LEDGER"||grouped||health||kind==="PLATFORM_AUDIT_ACTIVITY";
 function setPreset(next:Period){
  setPeriod(next);setPreview(null);
  if(next==="CUSTOM"){setFrom("");setUntil("");return;}
  const dates=localReportPeriod(next);setFrom(dates.from);setUntil(dates.until);
 }
 function request(offset=0){
  if(!kind||!chosen)return null;
  return {kind,view:chosen.views.includes(view)?view:chosen.views[0],
   ...(finance?{...(year?{yearRef:year}:{}),...(branch?{branchRef:branch}:{}),
    ...(geography&&area?{areaRef:area}:{})}:{
    ...(center?{centerRef:center}:{}),...(status?{status}:{})}),
   ...((kind==="FINANCE_POSTED_LEDGER"||grouped||health||kind==="PLATFORM_AUDIT_ACTIVITY")&&from?
    {fromDay:from,untilDay:until}:{}),
   ...(grouped?{groupBy,sortBy,sortDirection}:{}),offset};
 }
 async function run(offset=0){
  if(!kind||!chosen||busy)return;
  const rev=++seq.current;setBusy(true);setPreview(null);setProblem("");
  try{
   const q=request(offset)!;
   const result=await fetchSource<Preview>(token,"preview",q);
   if(!Array.isArray(result.rows)||!Array.isArray(result.columns))
    throw Error("The original report is unavailable.");
   if(rev===seq.current)setPreview(result);
  }catch(e){
   if(rev===seq.current){if(e&&typeof e==="object"&&"status" in e&&e.status===401)
    onExpired();setProblem(e instanceof Error?e.message:"Could not verify this report.");}
  }finally{if(rev===seq.current)setBusy(false);}
 }
 return <View style={s.root}>
  <Text accessibilityRole="header" style={s.heading}>Reports &amp; MIS</Text>
  <Text style={s.hint}>Private posted-source and appointment reports. Only
   actual supported formats and source permissions are available.</Text>
  <NativeFinanceAction label={busy?"Checking reports…":"Refresh available reports"}
   disabled={busy} secondary onPress={()=>void load()}/>
  {!!problem&&<Text accessibilityRole="alert" style={s.error}>{problem}</Text>}
  {catalog?.finance.state==="SOURCE_UNAVAILABLE"&&<Text style={s.hint}>
   Finance reporting is temporarily unavailable. Other permitted sources remain accessible.</Text>}
  {catalog?.appointments.state==="SOURCE_UNAVAILABLE"&&<Text style={s.hint}>
   Appointment reporting is temporarily unavailable. Other permitted sources remain accessible.</Text>}
  {catalog&&catalog.templates.length===0&&<Text style={s.hint}>
   No report packages are available for your current permissions.</Text>}
  {catalog&&catalog.templates.length>0&&<>
   <NativeFinanceOptions label="Report source" value={kind??""}
    options={catalog.templates.map(x=>({ref:x.kind,label:x.label}))}
    onChange={v=>{setKind(v as Kind);
     setView(catalog.templates.find(t=>t.kind===v)?.views[0]??"TABLE");
     setPreview(null);
     setYear("");setBranch(catalog.finance.allBranches?"":catalog.finance.branches[0]?.ref??"");setArea("");setCenter("");setFrom("");setUntil("");setStatus("");
     setGroupBy("CATEGORY");setSortBy("NAME");setSortDirection("ASC");}}/>
   {!!chosen&&<Text style={s.hint}>{chosen.description}. Output: {chosen.views.join(" or ")}</Text>}
   {!!chosen&&chosen.views.length>1&&<NativeFinanceOptions label="Report view"
    value={view} options={chosen.views.map(v=>({ref:v,label:v==="CHART"?"Chart":
     v==="SUMMARY"?"Summary":v==="PIVOT"?"Pivot":"Table"}))} onChange={v=>{setView(v as typeof view);
      setPreview(null);}}/>}
   {finance&&<>
    <NativeFinanceOptions label="Financial year" value={year}
     options={[{ref:"",label:"All permitted years"},...catalog.finance.years.map(x=>({
      ref:x.ref,label:x.name}))]} onChange={setYear}/>
    {geography&&!!catalog.finance.areas?.length&&<NativeFinanceOptions
     label="District or block" value={area}
     options={[{ref:"",label:"No geographic restriction"},
      ...catalog.finance.areas.map(x=>({ref:x.ref,
       label:(x.level==="DISTRICT"?"District":"Block")+" · "+x.name}))]}
     onChange={next=>{
      setArea(next);setPreview(null);
      setBranch(next?"":catalog.finance.allBranches?"":
       catalog.finance.branches[0]?.ref??"");
     }}/>}
    {!area&&!!catalog.finance.branches.length&&<NativeFinanceOptions label="Branch" value={branch}
     options={[...(catalog.finance.allBranches?[{ref:"",label:"All permitted branches"}]:[]),
      ...catalog.finance.branches.map(x=>({ref:x.ref,label:x.name}))]} onChange={setBranch}/>}
   </>}
   {health&&catalog.appointments.ready&&<>
    {!!catalog.appointments.centers.length&&<NativeFinanceOptions label="Healthcare center"
     value={center} options={[{ref:"",label:"All permitted centers"},
      ...catalog.appointments.centers.map(x=>({ref:x.ref,label:x.name}))]}
     onChange={setCenter}/>}
    <NativeFinanceOptions label="Appointment status" value={status}
     options={states} onChange={setStatus}/>
   </>}
   {grouped&&<>
    <NativeFinanceOptions label="Group by" value={groupBy}
     options={[{ref:"CATEGORY",label:"Account category"},
       {ref:"POSTING_KIND",label:"Posted entry type"},
       {ref:"ACCOUNT_NAME",label:"Account name"}]} onChange={v=>setGroupBy(v as typeof groupBy)}/>
    <NativeFinanceOptions label="Sort groups by" value={sortBy}
     options={[{ref:"NAME",label:"Group name"},{ref:"DEBIT",label:"Debit"},
       {ref:"CREDIT",label:"Credit"}]} onChange={v=>setSortBy(v as typeof sortBy)}/>
    <NativeFinanceOptions label="Sort direction" value={sortDirection}
     options={[{ref:"ASC",label:"Ascending"},{ref:"DESC",label:"Descending"}]}
     onChange={v=>setSortDirection(v as typeof sortDirection)}/>
   </>}
   {dated&&<>
    <NativeFinanceOptions label="Reporting period" value={period}
     options={[{ref:"CUSTOM",label:"Custom date range"},
      {ref:"DAY",label:"Today"},
      {ref:"WEEK",label:"This week (Monday onward)"},
      {ref:"MONTH",label:"This month"},
      ...(kind==="PLATFORM_AUDIT_ACTIVITY"?[]:
       [{ref:"YEAR",label:"This calendar year"}])]}
     onChange={value=>setPreset(value as Period)}/>
    <NativeFinanceField label="Start date (YYYY-MM-DD)" value={from}
     onChange={value=>{setFrom(value);setPeriod("CUSTOM");setPreview(null);}}/>
    <NativeFinanceField label="End date (YYYY-MM-DD)" value={until}
     onChange={value=>{setUntil(value);setPeriod("CUSTOM");setPreview(null);}}/>
   </>}
   <NativeFinanceAction disabled={busy} label={busy?"Checking report…":"Run permitted report"}
    onPress={()=>void run()}/>
  </>}
  {preview&&<View style={s.output}>
   <Text accessibilityRole="header" style={s.heading}>{preview.label}</Text>
   <Text style={s.hint}>{preview.scopeLabel}</Text>
   <Text style={s.hint}>{preview.sourceAsOf?"Owner snapshot: ":"Source retrieved: "}
    {new Date(preview.sourceAsOf??preview.sourceReadAt).toLocaleString("en-IN")}</Text>
   <Text style={s.hint}>{preview.explanation}</Text>
   {["READY","PARTIAL"].includes(preview.state)?<>
    {preview.kind==="FINANCE_POSTED_TREND"&&
     <NativeMisFinanceTrend trend={{type:"MONTHLY_FINANCE",
      state:"AVAILABLE",windowLabel:"Last six calendar months",
      points:preview.rows.map(r=>({month:r.month??"",
       incomeMinor:r.incomeMinor??"0",expenseMinor:r.expenseMinor??"0"}))}}/>}
    {preview.view==="CHART"&&preview.kind==="FINANCE_POSTED_GROUPED"&&
     <NativeMisGroupedFinanceChart rows={preview.rows.map(x=>({groupLabel:x.groupLabel??"",debitMinor:x.debitMinor??"0",creditMinor:x.creditMinor??"0"}))}/>}
    {preview.view==="CHART"&&preview.kind==="APPOINTMENT_DOCTOR_SUMMARY"&&
     <NativeMisAppointmentGroupBars rows={preview.rows.map(r=>({
      statusLabel:(r.doctorName??"Doctor")+" · "+(r.centerName??"Center"),
      count:r.bookings??"0"
     }))}/>}
    {preview.view==="CHART"&&preview.kind==="APPOINTMENT_STATUS_GROUPED"&&
     <NativeMisAppointmentGroupBars rows={preview.rows.map(r=>({
      statusLabel:r.statusLabel??"",count:r.count??"0"
     }))}/>}
    {preview.view==="CHART"&&preview.kind==="APPOINTMENT_STATUS"&&
     <NativeMisAppointmentDistribution metrics={preview.columns.map(c=>({
      key:c.key,label:c.label,unit:c.unit??"COUNT",
      value:preview.rows[0]?.[c.key]??"0"}))}/>} 
    {preview.rows.map((row,i)=><View key={i} style={s.row}>
     {preview.columns.map(c=><View key={c.key} style={s.cell}>
      <Text style={s.hint}>{c.label}</Text>
      <Text style={s.value}>{c.unit==="INR_MINOR"?currency(row[c.key]):row[c.key]}</Text>
     </View>)}
    </View>)}
    {preview.nextOffset!==null&&
     <NativeFinanceAction label="Next page" disabled={busy}
      onPress={()=>void run(preview.nextOffset!)}/>}
   </>:<Text style={s.hint}>{preview.state==="SUPPRESSED"?
    "Private results are hidden for this small group.":"No matching original records."}</Text>}
  </View>}
  {preview?.state==="PARTIAL"&&<Text style={s.hint}>
   This original source is incomplete or requires reconciliation. Review the source explanation before export.</Text>}
  {catalog?.capabilities?.export===true&&
   <NativeMisExports token={token} onExpired={onExpired} current={(["BENEFICIARY_ASSISTANCE_SUMMARY","MEMBERSHIP_ROSTER_SUMMARY","VOLUNTEER_ROSTER_SUMMARY","PAYROLL_STATUS_SUMMARY","DONATION_RECEIPT_SUMMARY"] as readonly string[]).includes(kind??"")?null:request(0)}/>}
  {catalog?.capabilities?.schedule===true&&
   <NativeMisSchedules token={token} onExpired={onExpired}/>}
  {catalog&&<NativeMisSaved token={token} onExpired={onExpired}
   canManage={catalog.capabilities?.manage===true}
   canShare={catalog.capabilities?.share===true}
   onDraftChange={onDraftChange}
   current={(["BENEFICIARY_ASSISTANCE_SUMMARY","MEMBERSHIP_ROSTER_SUMMARY","VOLUNTEER_ROSTER_SUMMARY","PAYROLL_STATUS_SUMMARY","DONATION_RECEIPT_SUMMARY"] as readonly string[]).includes(kind??"")?null:request(0)}
   onRestore={value=>{
    setKind(value.kind as Kind);setView(value.view as typeof view);
    setGroupBy(value.groupBy??"CATEGORY");setSortBy(value.sortBy??"NAME");
    setSortDirection(value.sortDirection??"ASC");
    setYear(value.yearRef??"");
    setBranch(value.branchRef??"");setArea(value.areaRef??"");setCenter(value.centerRef??"");
    setFrom(value.fromDay??"");setUntil(value.untilDay??"");
    setStatus(value.status??"");setPreview(null);setProblem("");
   }}/>} 
 </View>;
}
const s=StyleSheet.create({
 root:{marginHorizontal:18,marginTop:18,padding:14,gap:12,
  borderRadius:14,borderColor:t.border,borderWidth:1,backgroundColor:t.surface},
 heading:{fontSize:16,color:t.text,fontWeight:"800"},
 hint:{fontSize:12,color:t.mutedText,lineHeight:19},
 error:{fontSize:13,color:t.error,lineHeight:20},
 output:{gap:8},
 row:{gap:8,padding:12,borderColor:t.border,borderWidth:1,borderRadius:9},
 cell:{gap:3},
 value:{color:t.text,fontSize:14,fontWeight:"700"}
});
