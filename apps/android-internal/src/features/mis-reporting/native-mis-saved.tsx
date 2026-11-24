import {useCallback,useEffect,useRef,useState} from "react";
import {Alert,Pressable,StyleSheet,Text,View} from "react-native";
import * as Crypto from "expo-crypto";
import {NativeFinanceAction,NativeFinanceField,NativeFinanceOptions}
 from "../finance-accounting/finance-native-source-kit";
import {identityRequest} from "../identity-access/http-client";
import {nativeMisProblem} from "./native-mis-problem";
import {NativeMisSharedDefinitions} from "./native-mis-shared-definitions";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
type Request={kind:string;view:string;yearRef?:string;branchRef?:string;projectRef?:string;areaRef?:string;
 centerRef?:string;fromDay?:string;untilDay?:string;status?:string;
 groupBy?:"CATEGORY"|"POSTING_KIND"|"ACCOUNT_NAME";sortBy?:"NAME"|"DEBIT"|"CREDIT";sortDirection?:"ASC"|"DESC";offset:number};
type Row={ref:string;name:string;state:"ACTIVE"|"RETIRED";version:number;revision:number};
type Detail=Row&{request:Request};
async function api<T>(token:string,path:string,method:"GET"|"POST"|"PATCH"="GET",
 body?:object):Promise<T>{
 const r=await identityRequest("/api/v1/mis/reports/saved"+path,{
  method,cache:"no-store",
  headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},
  ...(body?{body:JSON.stringify(body)}:{})});
 if(!r.ok)throw await nativeMisProblem(r,"The private report status could not be confirmed. Refresh before retrying.");
 return r.json() as Promise<T>;
}
export function NativeMisSaved({token,onExpired,canManage,canShare,current,onRestore,onDraftChange}:{
 token:string;onExpired:()=>void;canManage:boolean;canShare:boolean;
 current:Request|null;onRestore:(request:Request)=>void;
 onDraftChange?:(hasUnsavedDraft:boolean)=>void}){
 const [rows,setRows]=useState<Row[]>([]);
 const [selected,setSelected]=useState<Detail|null>(null);
 const [name,setName]=useState("");
 useEffect(()=>{onDraftChange?.(name.trim().length>0);
  return()=>onDraftChange?.(false);},[name,onDraftChange]);
 const [busy,setBusy]=useState(false);
 const [problem,setProblem]=useState(""),[notice,setNotice]=useState("");
 const [more,setMore]=useState(false);
 const seq=useRef(0);
 const pending=useRef<{payload:string;key:string}|null>(null);
 const fail=useCallback((e:unknown)=>{
  if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
  setProblem(e instanceof Error?e.message:"Saved report source unavailable.");
 },[onExpired]);
 const reload=useCallback(async()=>{
  const rev=++seq.current;setBusy(true);setProblem("");
  try{
   const list=await api<{items:Row[];hasMore:boolean}>(token,"");
   if(!Array.isArray(list.items))throw Error("Current saved reports cannot be verified.");
   if(rev===seq.current){setRows(list.items);setMore(list.hasMore);}
  }catch(e){if(rev===seq.current){setRows([]);fail(e);}}
  finally{if(rev===seq.current)setBusy(false);}
 },[token,fail]);
 useEffect(()=>{void reload();return()=>{seq.current++};},[reload]);
 async function open(ref:string){
  setBusy(true);setProblem("");setSelected(null);
  try{setSelected(await api<Detail>(token,"/"+encodeURIComponent(ref)));}
  catch(e){fail(e)}finally{setBusy(false);}
 }
 function key(kind:string,body:unknown){
  const payload=JSON.stringify({kind,body});
  if(pending.current?.payload!==payload)
   pending.current={payload,key:Crypto.randomUUID()};
  return pending.current.key;
 }
 async function change(action:"CREATE"|"REVISE"|"COPY"|"RETIRE"){
  if(busy||!canManage)return;
  if(action!=="RETIRE"&&!name.trim()){setProblem("Enter a report name first.");return;}
  if((action==="CREATE"||action==="REVISE")&&!current){
   setProblem("Select an actual report before saving.");return;
  }
  const saved=selected;
  if(action!=="CREATE"&&(!saved||saved.state!=="ACTIVE")){
   setProblem("Select an active saved report first.");return;
  }
  const values=action==="RETIRE"?{expectedVersion:saved!.version}:
   action==="COPY"?{name}:action==="REVISE"?
    {name,request:current,expectedVersion:saved!.version}:
    {name,request:current};
  const requestKey=key(action,{savedRef:saved?.ref,...values});
  setBusy(true);setProblem("");setNotice("");
  try{
   const endpoint=action==="CREATE"?"":"/"+encodeURIComponent(saved!.ref)+
    (action==="COPY"?"/copy":action==="RETIRE"?"/retire":"");
   await api<Row>(token,endpoint,action==="REVISE"?"PATCH":"POST",
    {...values,requestKey});
   pending.current=null;
   setSelected(null);setName("");
   setNotice(action==="RETIRE"?"Report retired and future schedules paused.":
    action==="COPY"?"Created your own private report copy.":
    action==="REVISE"?"Saved a new permitted revision.":"Report saved privately.");
   await reload();
  }catch(e){fail(e)}
  finally{setBusy(false);}
 }
 return <View style={s.root}>
  <Text accessibilityRole="header" style={s.heading}>My private saved reports</Text>
  <Text style={s.hint}>Private definitions never store confidential report rows.
   Current source permissions are checked again before reopening.</Text>
  <NativeFinanceAction label={busy?"Checking…":"Refresh saved reports"} secondary
   disabled={busy} onPress={()=>void reload()}/>
  {!!problem&&<Text accessibilityRole="alert" style={s.error}>{problem}</Text>}
  {!!notice&&<Text style={s.hint}>{notice}</Text>}
  {!busy&&rows.length===0&&<Text style={s.hint}>No private saved reports found.</Text>}
  {!!rows.length&&<NativeFinanceOptions label="Choose saved report" value={selected?.ref??""}
   options={[{ref:"",label:"Choose one"},...rows.filter(x=>x.state==="ACTIVE")
    .map(x=>({ref:x.ref,label:x.name}))]}
   onChange={v=>{if(v)void open(v);else setSelected(null);}}/>}
  {more&&<Text style={s.hint}>Showing the most recent 50 reports.</Text>}
  {selected&&<>
   <Text style={s.hint}>Selected: {selected.name} · Private</Text>
   <NativeFinanceAction label="Load saved filters" secondary
    onPress={()=>{onRestore(selected.request);
     setNotice("Saved source filters restored. Run the report again for fresh data.");}}/>
  </>}
  {canManage&&<>
   <NativeFinanceField label="Report name" value={name}
    onChange={v=>{setName(v);pending.current=null;}} placeholder="Monthly posted finance"/>
   <NativeFinanceAction label="Save new private report" disabled={busy||!current}
    onPress={()=>void change("CREATE")}/>
   {selected&&<>
    <NativeFinanceAction label="Save new revision" disabled={busy||!current}
     onPress={()=>void change("REVISE")}/>
    <NativeFinanceAction label="Make private copy" disabled={busy} secondary
     onPress={()=>void change("COPY")}/>
    <Pressable accessibilityRole="button" disabled={busy} style={s.remove}
     onPress={()=>Alert.alert("Retire saved report?",
      "It will no longer run, and any schedule will be paused.",[
       {text:"Cancel",style:"cancel"},
       {text:"Retire",style:"destructive",onPress:()=>void change("RETIRE")}
      ])}>
     <Text style={s.removeText}>Retire selected report</Text>
    </Pressable>
   </>}
  </>}
  <NativeMisSharedDefinitions token={token} onExpired={onExpired}
   selected={selected?{ref:selected.ref,name:selected.name,version:selected.version}:null}
   canManage={canManage} canShare={canShare} onChanged={()=>void reload()}/>
 </View>;
}
const s=StyleSheet.create({
 root:{borderTopWidth:1,borderTopColor:t.border,paddingTop:13,gap:10},
 heading:{fontWeight:"800",color:t.text,fontSize:15},
 hint:{fontSize:12,lineHeight:18,color:t.mutedText},
 error:{fontSize:13,color:t.error,lineHeight:20},
 remove:{borderColor:t.border,borderWidth:1,minHeight:48,borderRadius:10,
  alignItems:"center",justifyContent:"center"},
 removeText:{fontSize:13,color:t.error,fontWeight:"700"}
});
