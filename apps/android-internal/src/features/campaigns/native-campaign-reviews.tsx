import {useEffect,useRef,useState} from "react";
import {ActivityIndicator,AppState,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import * as Crypto from "expo-crypto";
import {identityRequest} from "../identity-access/http-client";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
type Choice="APPROVE"|"RETURN"|"REJECT";
type CaseItem={caseRef:string;reference:string;title:string;status:string;revision:number;canDecide:boolean};
type Page={items:CaseItem[];hasMore:boolean;offset:number};
type Details={caseRef:string;reference:string;status:string;revision:number;canDecide:boolean;
 source:{title:string;category:string;goalMinor:string|null;startAt:string|null;endAt:string|null};
 history:{action:string;actor:string;at:string;remarks:string}[]};
type Pending={requestKey:string;ref:string;revision:number;action:Choice;remarks:string};
const label=(s:string)=>s.replaceAll("_"," ").toLowerCase().replace(/\b[a-z]/g,v=>v.toUpperCase());
const amount=(v:string|null)=>{try{
 if(!v||!/^[0-9]+$/.test(v))return "Not specified";
 const n=BigInt(v);return "₹"+(n/100n).toString()+"."+(n%100n).toString().padStart(2,"0");
 }catch{return "Unavailable";}};
export function NativeCampaignReviews({token,canConfigure,onExpired}:{
 token:string;canConfigure:boolean;onExpired:()=>void
}){
 const [items,setItems]=useState<CaseItem[]>([]),[detail,setDetail]=useState<Details|null>(null),
  [configured,setConfigured]=useState<boolean|null>(null);
 const [status,setStatus]=useState("ALL"),[q,setQ]=useState(""),[applied,setApplied]=useState(""),
  [offset,setOffset]=useState(0),[hasMore,setHasMore]=useState(false);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(false),
  [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [decision,setDecision]=useState<Choice>("APPROVE"),[remarks,setRemarks]=useState(""),
  [password,setPassword]=useState(""),[setupPassword,setSetupPassword]=useState("");
 const request=useRef<Pending|null>(null),counter=useRef(0),active=useRef(true);
 async function api<T>(path:string,method:"GET"|"POST"="GET",body?:Record<string,unknown>):Promise<T>{
  const r=await identityRequest("/api/v1/campaign-reviews"+(path.startsWith("?")?path:path?"/"+path:""),{
   method,cache:"no-store",headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},
   ...(body?{body:JSON.stringify(body)}:{})});
  if(r.status===401){onExpired();throw Error("Sign in again.");}
  const data:unknown=await r.json().catch(()=>null);
  if(!r.ok||data===null)throw Object.assign(Error(r.status===403?"Independent Foundation reviewer permission required.":
   r.status===409?"This case, policy or source changed. Refresh the protected review.":
   r.status===400?"Check action, remarks, current password or revision.":
   "Review result could not be confirmed. Check the original case and retry."),{status:r.status});
  return data as T;
 }
 async function refresh(){
  const id=++counter.current;setLoading(true);
  try{
   const [list,policy]=await Promise.all([
    api<Page>("?"+new URLSearchParams({status,q:applied,offset:String(offset)}).toString()),
    api<{configured:boolean}>("policy")]);
   if(id!==counter.current||!active.current)return;
   setItems(list.items);setHasMore(list.hasMore);setConfigured(policy.configured);setError("");
  }catch(e){if(id===counter.current&&active.current){setItems([]);setError(e instanceof Error?e.message:"Cannot load current approvals.");}}
  finally{if(id===counter.current&&active.current)setLoading(false);}
 }
 useEffect(()=>{void refresh();return()=>{counter.current++;};},[token,status,applied,offset]);
 useEffect(()=>{
  const sub=AppState.addEventListener("change",state=>{
   active.current=state==="active";counter.current++;
   if(!active.current){
    setItems([]);setDetail(null);setPassword("");setSetupPassword("");setRemarks("");
    setNotice("");setError("");
   }else void refresh();
  });
  return()=>sub.remove();
 },[token,status,applied,offset]);
 async function open(item:CaseItem){
  if(busy||request.current)return;
  const id=++counter.current;setLoading(true);setError("");setNotice("");
  try{
   const value=await api<Details>(item.caseRef);
   if(id===counter.current&&active.current){setDetail(value);setDecision("APPROVE");setRemarks("");setPassword("");}
  }catch(e){if(id===counter.current&&active.current)setError(e instanceof Error?e.message:"Cannot verify current case.");}
  finally{if(id===counter.current&&active.current)setLoading(false);}
 }
 async function configure(){
  if(!canConfigure||busy||setupPassword.length<8)return;setBusy(true);setError("");
  try{
   const p=await api<{configured:boolean}>("policy","POST",{currentPassword:setupPassword});
   if(!active.current)return;setConfigured(p.configured);setSetupPassword("");
   setNotice("Original CG-03 campaign review configured.");
  }catch(e){if(active.current)setError(e instanceof Error?e.message:"Configuration not confirmed.");}
  finally{setBusy(false);}
 }
 async function decide(){
  if(!detail||!detail.canDecide||busy||password.length<8)return;setBusy(true);setError("");setNotice("");
  if(!request.current)request.current={requestKey:Crypto.randomUUID(),ref:detail.caseRef,
   revision:detail.revision,action:decision,remarks:remarks.trim()};
  const cmd=request.current;
  try{
   await api(cmd.ref+"/decide","POST",{requestKey:cmd.requestKey,expectedRevision:cmd.revision,
    action:cmd.action,remarks:cmd.remarks,currentPassword:password});
   if(!active.current)return;
   request.current=null;setPassword("");setRemarks("");
   setNotice("Independent campaign review saved. Public publication is separate.");
   const updated=await api<Details>(cmd.ref);
   if(active.current){setDetail(updated);void refresh();}
  }catch(e){
   if(!active.current)return;
   const status=e&&typeof e==="object"&&"status" in e?Number(e.status):0;
   if(status>0&&status<500&&![408,429].includes(status))request.current=null;
   setError(e instanceof Error?e.message:"Review may have been accepted. Retry the original request.");
  }finally{setBusy(false);}
 }
 const button=(title:string,onPress:()=>void,disabled=false)=>
  <Pressable accessibilityRole="button" disabled={disabled||busy}
   onPress={onPress} style={[s.button,(disabled||busy)&&{opacity:.45}]}>
    <Text style={s.buttonText}>{title}</Text>
   </Pressable>;
 return <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
  <Text accessibilityRole="header" style={s.title}>Campaign Verification</Text>
  <Text style={s.muted}>Independent protected review. Approval never publishes or records a donation.</Text>
  {configured===false&&<View style={s.card}>
   <Text>Campaign review must be configured by Foundation Admin before a campaign can be submitted.</Text>
   {canConfigure&&<>
    <TextInput accessibilityLabel="Current password for review policy" secureTextEntry
     autoComplete="current-password" value={setupPassword} onChangeText={setSetupPassword} style={s.input}/>
    {button("Configure original review",()=>void configure(),setupPassword.length<8)}
   </>}
  </View>}
  <View style={s.card}>
   <ScrollView horizontal contentContainerStyle={s.row}>
    {["ALL","SUBMITTED","RETURNED","REJECTED","OWNER_COMPLETED"].map(v=>
     <View key={v}>{button((status===v?"✓ ":"")+label(v),()=>{setStatus(v);setOffset(0);})}</View>)}
   </ScrollView>
   <TextInput accessibilityLabel="Search campaigns" placeholder="Campaign or case number"
    value={q} maxLength={80} onChangeText={setQ} style={s.input}/>
   <View style={s.row}>{button("Search",()=>{setApplied(q.trim());setOffset(0);})}
    {button("Refresh",()=>void refresh())}</View>
  </View>
  {loading&&<ActivityIndicator accessibilityLabel="Verifying current campaign cases"/>}
  {!loading&&!items.length&&<Text style={s.muted}>No permitted approval cases for this filter.</Text>}
  {items.map(item=><View key={item.caseRef} style={s.card}>
   <Text style={s.heading}>{item.title}</Text><Text>{item.reference} · {label(item.status)}</Text>
   {button(item.canDecide?"Review campaign":"View history",()=>void open(item),!!request.current)}
  </View>)}
  <View style={s.row}>{offset>0&&button("Previous",()=>setOffset(v=>Math.max(0,v-25)))}
   {hasMore&&button("Next",()=>setOffset(v=>v+25))}</View>
  {detail&&<View style={s.card}>
   <Text style={s.heading}>{detail.reference} · {label(detail.status)}</Text>
   <Text>Campaign: {detail.source.title} · {detail.source.category}</Text>
   <Text>Planned funding: {amount(detail.source.goalMinor)}</Text>
   <Text>Period: {detail.source.startAt??"Not set"} to {detail.source.endAt??"Not set"}</Text>
   {detail.canDecide&&<>
    <Text style={s.heading}>Independent decision</Text>
    <View style={s.row}>{(["APPROVE","RETURN","REJECT"] as const).map(v=>
     <View key={v}>{button((decision===v?"✓ ":"")+label(v),()=>setDecision(v),!!request.current)}</View>)}</View>
    <TextInput accessibilityLabel="Review remarks" placeholder="Remarks for the campaign applicant"
     value={remarks} maxLength={500} multiline style={[s.input,{minHeight:76}]}
     editable={!busy&&!request.current} onChangeText={setRemarks}/>
    <TextInput accessibilityLabel="Current password for protected approval"
     secureTextEntry autoComplete="current-password" style={s.input} value={password}
     editable={!busy} onChangeText={setPassword}/>
    {button(request.current?"Retry original decision":"Confirm protected decision",()=>void decide(),
      password.length<8||decision!=="APPROVE"&&remarks.trim().length<3)}
    <Text style={s.muted}>A different current reviewer must confirm the original CG-03 case.</Text>
   </>}
   <Text style={s.heading}>Decision history</Text>
   {detail.history.map((h,i)=><Text key={i}>{label(h.action)} · {h.actor}{h.remarks?" — "+h.remarks:""}</Text>)}
   {button("Close case",()=>{setDetail(null);setPassword("");setRemarks("");},!!request.current)}
  </View>}
  {!!notice&&<Text accessibilityRole="alert">{notice}</Text>}
  {!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
  {!!request.current&&<Text accessibilityRole="alert">Original protected decision may have completed. Retry with the same request; do not start another.</Text>}
 </ScrollView>;
}
const s=StyleSheet.create({
 page:{backgroundColor:t.adminCanvas,padding:14,paddingBottom:50,gap:12},
 title:{color:t.text,fontWeight:"700",fontSize:22},heading:{color:t.text,fontWeight:"700",fontSize:16},
 muted:{color:t.mutedText,fontSize:13},error:{color:t.error,fontSize:14},
 card:{backgroundColor:t.surface,borderWidth:1,borderColor:t.border,borderRadius:12,padding:12,gap:10},
 row:{flexDirection:"row",flexWrap:"wrap",gap:8},
 input:{backgroundColor:t.surface,borderColor:t.border,borderWidth:1,borderRadius:8,
  minHeight:46,color:t.text,padding:10},
 button:{borderColor:t.border,borderWidth:1,borderRadius:9,padding:12,minHeight:44,justifyContent:"center"},
 buttonText:{fontSize:13,fontWeight:"600",color:t.text}
});
