import {useCallback,useEffect,useRef,useState} from "react";
import {Alert,AppState,StyleSheet,Text,View} from "react-native";
import * as Crypto from "expo-crypto";
import {identityRequest} from "../identity-access/http-client";
import {nativeMisProblem} from "./native-mis-problem";
import {NativeFinanceAction,NativeFinanceField}
 from "../finance-accounting/finance-native-source-kit";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
type Selected={ref:string;name:string;version:number};
type Choice={ref:string;name:string};
type Shared=Choice&{sourceKey:string};
async function api<T>(token:string,path:string,body?:object):Promise<T>{
 const response=await identityRequest("/api/v1/mis/reports/saved/"+path,{
  method:body?"POST":"GET",cache:"no-store",
  headers:{Authorization:"Bearer "+token,
   ...(body?{"Content-Type":"application/json"}:{})},
  ...(body?{body:JSON.stringify(body)}:{})});
 if(!response.ok)throw await nativeMisProblem(response,
  "This private definition is no longer available. Refresh before retrying.");
 return response.json() as Promise<T>;
}
/** Native equivalent of Web individual private report-definition sharing.
 * Never grants a colleague the original owner's data/files or schedules.
 */
export function NativeMisSharedDefinitions({token,onExpired,selected,
 canManage,canShare,onChanged}:{
 token:string;onExpired:()=>void;selected:Selected|null;
 canManage:boolean;canShare:boolean;onChanged:()=>void}){
 const [shared,setShared]=useState<Shared[]>([]);
 const [grants,setGrants]=useState<Choice[]>([]);
 const [found,setFound]=useState<Choice[]>([]);
 const [search,setSearch]=useState("");
 const [busy,setBusy]=useState(false);
 const [problem,setProblem]=useState(""),[notice,setNotice]=useState("");
 const sharedSeq=useRef(0),grantsSeq=useRef(0);
 const pending=useRef<{payload:string;key:string}|null>(null);
 const fail=useCallback((err:unknown)=>{
  if(err&&typeof err==="object"&&"status" in err&&err.status===401)onExpired();
  setProblem(err instanceof Error?err.message:"The private sharing outcome is unavailable.");
 },[onExpired]);
 const loadShared=useCallback(async()=>{
  const i=++sharedSeq.current;
  try{
   const result=await api<{items:Shared[]}>(token,"shared-with-me");
   if(i===sharedSeq.current)setShared(result.items??[]);
  }catch(e){if(i===sharedSeq.current){setShared([]);fail(e);}}
 },[token,fail]);
 const loadGrants=useCallback(async()=>{
  const i=++grantsSeq.current;
  if(!selected||!canShare){setGrants([]);return;}
  try{
   const result=await api<{people:Choice[]}>(token,
    encodeURIComponent(selected.ref)+"/grants");
   if(i===grantsSeq.current)setGrants(result.people??[]);
  }catch(e){if(i===grantsSeq.current){setGrants([]);fail(e);}}
 },[token,selected?.ref,canShare,fail]);
 useEffect(()=>{void loadShared();return()=>{sharedSeq.current++};},[loadShared]);
 useEffect(()=>{void loadGrants();return()=>{grantsSeq.current++};},[loadGrants]);
 useEffect(()=>{
  const sub=AppState.addEventListener("change",state=>{
   sharedSeq.current++;grantsSeq.current++;
   setShared([]);setGrants([]);setFound([]);
   if(state==="active"){
    pending.current=null;void loadShared();void loadGrants();
   }
  });
  return()=>sub.remove();
 },[loadShared,loadGrants]);
 async function find(){
  if(!canShare||search.trim().length<2||busy)return;
  setBusy(true);setFound([]);setProblem("");setNotice("");
  try{
   const result=await api<{people:Choice[]}>(token,
    "share-recipients?q="+encodeURIComponent(search.trim()));
   setFound(result.people??[]);
   if(!result.people?.length)setNotice("No eligible colleague matches that name.");
  }catch(e){fail(e);}finally{setBusy(false);}
 }
 async function grant(person:Choice,active:boolean){
  if(!selected||!canShare||busy)return;
  const payload=JSON.stringify({selected:selected.ref,person:person.ref,
   version:selected.version,active});
  if(pending.current?.payload!==payload)
   pending.current={payload,key:Crypto.randomUUID()};
  setBusy(true);setProblem("");setNotice("");
  try{
   const result=await api<{message:string}>(token,
    encodeURIComponent(selected.ref)+"/share",{
     recipientRef:person.ref,active,expectedVersion:selected.version,
     requestKey:pending.current!.key});
   pending.current=null;
   setNotice(result.message);setFound([]);
   await loadGrants();
  }catch(e){fail(e);}finally{setBusy(false);}
 }
 async function copy(row:Shared){
  if(busy||!canManage)return;
  setBusy(true);setProblem("");setNotice("");
  try{
   await api(token,encodeURIComponent(row.ref)+"/copy",{
    name:("Copy of "+row.name).slice(0,100),
    requestKey:Crypto.randomUUID()});
   setNotice("A source-authorized copy is in your private saved reports.");
   onChanged();await loadShared();
  }catch(e){fail(e);}finally{setBusy(false);}
 }
 return <View style={s.root}>
  <Text accessibilityRole="header" style={s.title}>Shared report definitions</Text>
  <Text style={s.hint}>Only report settings can be shared or copied, never
   another person's source data, private files or scheduled deliveries.
   Your current source permissions are checked on every copy.</Text>
  {!!problem&&<Text accessibilityRole="alert" style={s.error}>{problem}</Text>}
  {!!notice&&<Text style={s.hint}>{notice}</Text>}
  <NativeFinanceAction label="Refresh definitions shared with me" secondary
   disabled={busy} onPress={()=>void loadShared()}/>
  {!shared.length&&<Text style={s.hint}>No report settings are shared with you.</Text>}
  {shared.map(row=><View key={row.ref} style={s.item}>
   <Text style={s.title}>{row.name}</Text>
   {canManage&&<NativeFinanceAction label="Make my private copy"
    disabled={busy} onPress={()=>void copy(row)}/>}
  </View>)}
  {selected&&canShare&&<View style={s.item}>
   <Text style={s.title}>Allow a colleague to copy: {selected.name}</Text>
   <NativeFinanceField label="Colleague name (two or more letters)"
    value={search} onChange={value=>{setSearch(value);setFound([]);}}
    placeholder="Search colleagues"/>
   <NativeFinanceAction label="Find eligible colleagues"
    disabled={busy||search.trim().length<2} secondary
    onPress={()=>void find()}/>
   {found.map(person=><View key={person.ref} style={s.item}>
    <Text style={s.hint}>{person.name}</Text>
    <NativeFinanceAction label={"Allow "+person.name+" to copy definition"}
     disabled={busy} onPress={()=>void grant(person,true)}/>
   </View>)}
   <Text style={s.title}>Current individual grants</Text>
   {!grants.length&&<Text style={s.hint}>No active colleague grants.</Text>}
   {grants.map(person=><View key={person.ref} style={s.item}>
    <Text style={s.hint}>{person.name}</Text>
    <NativeFinanceAction label={"Revoke "+person.name+" copy access"}
     disabled={busy} secondary onPress={()=>Alert.alert(
      "Revoke private report sharing?",
      "Existing permitted private copies are separate from this original.",
      [{text:"Cancel",style:"cancel"},
       {text:"Revoke",style:"destructive",
        onPress:()=>void grant(person,false)}])}/>
   </View>)}
  </View>}
 </View>;
}
const s=StyleSheet.create({
 root:{borderTopWidth:1,borderTopColor:t.border,paddingTop:14,gap:9},
 title:{color:t.text,fontWeight:"800",fontSize:14},
 hint:{fontSize:12,lineHeight:18,color:t.mutedText},
 error:{fontSize:12,lineHeight:18,color:t.error},
 item:{borderWidth:1,borderColor:t.border,borderRadius:9,padding:12,gap:9}
});
