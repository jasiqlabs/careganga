import {useCallback,useEffect,useRef,useState} from "react";
import {Pressable,StyleSheet,Text,View} from "react-native";
import {identityRequest} from "../identity-access/http-client";
import {NativeFinanceAction,NativeFinanceField,NativeFinanceOptions}
 from "../finance-accounting/finance-native-source-kit";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
type Kind="FINANCE_POSTED_LEDGER"|"FINANCE_POSTED_SUMMARY"|
 "FINANCE_POSTED_TREND"|"APPOINTMENT_STATUS";
type Template={kind:Kind;label:string;views:("TABLE"|"SUMMARY"|"CHART")[];description:string};
type Option={ref:string;name:string};
type Catalog={templates:Template[];finance:{ready:boolean;years:Option[];branches:Option[];
 allBranches:boolean};appointments:{ready:boolean;centers:Option[];complete:boolean}};
type Preview={state:string;kind:Kind;label:string;
 rows:Record<string,string>[];columns:{key:string;label:string;unit?:string}[];
 nextOffset:number|null;sourceAsOf?:string;sourceReadAt:string;
 explanation:string;scopeLabel:string};
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
 if(!r.ok)throw Object.assign(Error(r.status===401?"Sign in again to read reports.":
  r.status===403?"You cannot view these reports in this role or location.":
  r.status===400?"Select permitted filters and report fields.":
  "The report could not be verified. Check and retry."),{status:r.status});
 return r.json() as Promise<T>;
}
/** Internal Android native C44/C46/C47 standard reporting. One real CG20
 * source contract; no public report entry or embedded WebView.
 */
export function NativeMisReports({token,onExpired}:{token:string;onExpired:()=>void}){
 const [catalog,setCatalog]=useState<Catalog|null>(null);
 const [kind,setKind]=useState<Kind|null>(null);
 const [year,setYear]=useState(""),[branch,setBranch]=useState("");
 const [center,setCenter]=useState(""),[from,setFrom]=useState(""),[until,setUntil]=useState("");
 const [status,setStatus]=useState("");
 const [preview,setPreview]=useState<Preview|null>(null);
 const [busy,setBusy]=useState(false),[problem,setProblem]=useState("");
 const seq=useRef(0);
 const load=useCallback(async()=>{
  const rev=++seq.current;setCatalog(null);setPreview(null);setProblem("");setBusy(true);
  try{
   const result=await fetchSource<Catalog>(token,"templates");
   if(!Array.isArray(result.templates))throw Error("Report source options could not be verified.");
   if(rev===seq.current){setCatalog(result);
    setKind(result.templates[0]?.kind??null);}
  }catch(e){
   if(rev===seq.current){if(e&&typeof e==="object"&&"status" in e&&e.status===401)
    onExpired();
    setProblem(e instanceof Error?e.message:"Report catalog unavailable.");}
  }finally{if(rev===seq.current)setBusy(false);}
 },[token,onExpired]);
 useEffect(()=>{void load();return()=>{seq.current++};},[load]);
 const chosen=catalog?.templates.find(x=>x.kind===kind);
 const finance=kind?.startsWith("FINANCE_");
 async function run(offset=0){
  if(!kind||!chosen||busy)return;
  const rev=++seq.current;setBusy(true);setPreview(null);setProblem("");
  try{
   const q={kind,view:chosen.views[0],
    ...(finance?{...(year?{yearRef:year}:{}),...(branch?{branchRef:branch}:{})}:{
     ...(center?{centerRef:center}:{}),...(status?{status}:{})}),
    ...((kind==="FINANCE_POSTED_LEDGER"||!finance)&&from?
     {fromDay:from,untilDay:until}:{}),offset};
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
  {catalog&&catalog.templates.length===0&&<Text style={s.hint}>
   No report packages are available for your current permissions.</Text>}
  {catalog&&catalog.templates.length>0&&<>
   <NativeFinanceOptions label="Report source" value={kind??""}
    options={catalog.templates.map(x=>({ref:x.kind,label:x.label}))}
    onChange={v=>{setKind(v as Kind);setPreview(null);
     setYear("");setBranch("");setCenter("");setFrom("");setUntil("");setStatus("");}}/>
   {!!chosen&&<Text style={s.hint}>{chosen.description}. Output: {chosen.views.join(" or ")}</Text>}
   {finance&&<>
    <NativeFinanceOptions label="Financial year" value={year}
     options={[{ref:"",label:"All permitted years"},...catalog.finance.years.map(x=>({
      ref:x.ref,label:x.name}))]} onChange={setYear}/>
    {!!catalog.finance.branches.length&&<NativeFinanceOptions label="Branch" value={branch}
     options={[...(catalog.finance.allBranches?[{ref:"",label:"All permitted branches"}]:[]),
      ...catalog.finance.branches.map(x=>({ref:x.ref,label:x.name}))]} onChange={setBranch}/>}
   </>}
   {!finance&&catalog.appointments.ready&&<>
    {!!catalog.appointments.centers.length&&<NativeFinanceOptions label="Healthcare center"
     value={center} options={[{ref:"",label:"All permitted centers"},
      ...catalog.appointments.centers.map(x=>({ref:x.ref,label:x.name}))]}
     onChange={setCenter}/>}
    <NativeFinanceOptions label="Appointment status" value={status}
     options={states} onChange={setStatus}/>
   </>}
   {(kind==="FINANCE_POSTED_LEDGER"||!finance)&&<>
    <NativeFinanceField label="Start date (YYYY-MM-DD)" value={from} onChange={setFrom}/>
    <NativeFinanceField label="End date (YYYY-MM-DD)" value={until} onChange={setUntil}/>
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
   {preview.state==="READY"?<>
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
