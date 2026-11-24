import {useCallback,useEffect,useRef,useState} from "react";
import {AppState,StyleSheet,Text,View} from "react-native";
import * as Crypto from "expo-crypto";
import {File,Paths} from "expo-file-system";
import {identityRequest} from "../identity-access/http-client";
import {nativeMisProblem} from "./native-mis-problem";
import {NativeFinanceAction,NativeFinanceOptions}
 from "../finance-accounting/finance-native-source-kit";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
type Format="PDF"|"XLSX"|"CSV";
type Request={kind:string;view:string;yearRef?:string;branchRef?:string;projectRef?:string;
 centerRef?:string;fromDay?:string;untilDay?:string;status?:string;
 groupBy?:"CATEGORY"|"POSTING_KIND"|"ACCOUNT_NAME";sortBy?:"NAME"|"DEBIT"|"CREDIT";sortDirection?:"ASC"|"DESC";offset:number};
type Run={ref:string;state:string;format:Format;canDownload:boolean;
 createdAt?:string;rows?:number|null};
const MIME:Record<Format,string>={
 PDF:"application/pdf",CSV:"text/csv",
 XLSX:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
};
async function request<T>(token:string,path:string,body?:object):Promise<T>{
 const r=await identityRequest("/api/v1/mis/reports/runs"+path,{
  method:body?"POST":"GET",cache:"no-store",
  headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},
  ...(body?{body:JSON.stringify(body)}:{})});
 if(!r.ok)throw await nativeMisProblem(r,"The protected report file status is unconfirmed. Refresh its history first.");
 return r.json() as Promise<T>;
}
/** Native secure report export with original CG19-only byte validation,
 * temporary cache preview and delete on exit. Never store protected exports
 * permanently or expose private CG20 paths to Public Android.
 */
export function NativeMisExports({token,onExpired,current}:{token:string;
 onExpired:()=>void;current:Request|null}){
 const [runs,setRuns]=useState<Run[]>([]);
 const [format,setFormat]=useState<Format>("PDF");
 const [busy,setBusy]=useState(false),[problem,setProblem]=useState("");
 const [notice,setNotice]=useState("");
 const seq=useRef(0);
 const pending=useRef<{digest:string;key:string}|null>(null);
 const fail=useCallback((e:unknown)=>{
  if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
  setProblem(e instanceof Error?e.message:"Original report is unavailable.");
 },[onExpired]);
 const refresh=useCallback(async()=>{
  const rev=++seq.current;setProblem("");
  try{
   const res=await request<{runs:Run[]}>(token,"");
   if(!Array.isArray(res.runs))throw Error("Private export history is unavailable.");
   if(rev===seq.current)setRuns(res.runs);
  }catch(e){if(rev===seq.current){setRuns([]);fail(e);}}
 },[token,fail]);
 useEffect(()=>{void refresh();return()=>{seq.current++};},[refresh]);
 useEffect(()=>{
  const sub=AppState.addEventListener("change",state=>{
   seq.current++;setRuns([]);
   if(state==="active"){pending.current=null;void refresh();}
  });
  return()=>sub.remove();
 },[refresh]);
 async function create(){
  if(!current||busy)return;
  const digest=JSON.stringify({request:current,format});
  if(pending.current?.digest!==digest)
   pending.current={digest,key:Crypto.randomUUID()};
  setBusy(true);setProblem("");setNotice("");
  try{
   const row=await request<Run>(token,"",{
    requestKey:pending.current.key,format,request:current});
   pending.current=null;
   setNotice(row.state==="READY"?"Protected file verified and ready.":
    row.state==="EMPTY"?"No original entries match this report.":
    "File outcome not confirmed. Refresh before retrying.");
   await refresh();
  }catch(e){fail(e);}finally{setBusy(false);}
 }
 async function preview(row:Run){
  if(busy||!row.canDownload||row.state!=="READY")return;
  setBusy(true);setProblem("");let file:File|null=null;
  try{
   const r=await identityRequest(
    "/api/v1/mis/reports/runs/"+encodeURIComponent(row.ref)+"/download",{
    headers:{Authorization:"Bearer "+token},cache:"no-store"});
   if(r.status===401){onExpired();return;}
   if(!r.ok||r.headers.get("content-type")?.split(";")[0]!==MIME[row.format])
    throw Error("Private file was not authorized or verified.");
   const bytes=new Uint8Array(await r.arrayBuffer());
   if(bytes.byteLength<10||bytes.byteLength>5242880)
    throw Error("Protected file did not pass the safety limit.");
   file=new File(Paths.cache,"careganga-mis-"+Crypto.randomUUID()+"."+
    row.format.toLowerCase());
   file.create();await file.write(bytes);
   await file.preview({title:"CareGanga protected report"});
  }catch(e){fail(e);}finally{try{file?.delete();}catch{}
   setBusy(false);}
 }
 return <View style={s.root}>
  <Text accessibilityRole="header" style={s.heading}>My protected report exports</Text>
  <Text style={s.helper}>Reports are private. Your current role, branch and source
   grants are checked again before each download.</Text>
  {current&&<>
   <NativeFinanceOptions label="Export format" value={format}
    options={[{ref:"PDF",label:"PDF"},{ref:"XLSX",label:"Excel"},
     {ref:"CSV",label:"CSV"}]} onChange={v=>setFormat(v as Format)}/>
   <NativeFinanceAction label="Generate original protected report" disabled={busy}
    onPress={()=>void create()}/>
  </>}
  <NativeFinanceAction label="Refresh report history" disabled={busy}
   secondary onPress={()=>void refresh()}/>
  {!!problem&&<Text accessibilityRole="alert" style={s.error}>{problem}</Text>}
  {!!notice&&<Text style={s.helper}>{notice}</Text>}
  {runs.map(row=><View key={row.ref} style={s.row}>
   <Text style={s.heading}>{row.format} report · {row.state==="READY"?
    "Verified":row.state==="EMPTY"?"No rows":
    row.state==="UNKNOWN"?"Outcome unconfirmed":
    row.state==="REVOKED"?"No longer accessible":
    row.state==="FAILED"?"Generation failed":
    row.state==="RUNNING"?"Preparing":
    row.state==="QUEUED"?"Queued":
    row.state==="EXPIRED"?"Expired":"Status unavailable"}</Text>
   {!!row.createdAt&&<Text style={s.helper}>
    Requested {new Date(row.createdAt).toLocaleString("en-IN")}</Text>}
   {row.state==="READY"&&row.canDownload&&<NativeFinanceAction
    label={"Open authorized "+row.format+" file"} disabled={busy}
    secondary onPress={()=>void preview(row)}/>}
  </View>)}
  {!runs.length&&<Text style={s.helper}>No private exports are recorded.</Text>}
 </View>;
}
const s=StyleSheet.create({
 root:{borderTopWidth:1,borderTopColor:t.border,gap:10,paddingTop:14},
 heading:{fontSize:14,color:t.text,fontWeight:"800"},
 helper:{fontSize:12,lineHeight:18,color:t.mutedText},
 error:{fontSize:13,lineHeight:19,color:t.error},
 row:{gap:6,padding:10,borderRadius:10,borderColor:t.border,borderWidth:1}
});
