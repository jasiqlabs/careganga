import React,{useCallback,useEffect,useRef,useState} from "react";
import {ActivityIndicator,Pressable,StyleSheet,Text,TextInput,View} from "react-native";
import * as Crypto from "expo-crypto";
import {identityRequest} from "../identity-access/http-client";
type Policy={policyRef:string;leaveType:string;annualDays:number;usedDays:number;availableDays:number;allowHalfDays:boolean;countWeeklyOff:boolean;effectiveFrom:string;effectiveTo:string|null};
type Request={reference:string;leaveType:string;startDate:string;endDate:string;days:number;status:string;caseStatus:string};
type Mine={linked:boolean;year:string;policies:Policy[];requests:Request[]};
type Review=Request&{caseRef:string;employeeName:string;revision:number;canReview:boolean;reason?:string};
const blank=()=>({policyRef:"",startDate:"",endDate:"",halfDay:false,reason:""});
const label=(status:string)=>(({SUBMITTED:"Pending review",IN_REVIEW:"In review",APPROVED:"Approved",OWNER_COMPLETED:"Approved",RETURNED:"Returned",REJECTED:"Rejected"} as Record<string,string>)[status]??"Review status unavailable");
const failure=(e:unknown)=>e instanceof Error?e.message:"Could not confirm the result. Refresh before retrying.";
const known=(e:unknown)=>e&&typeof e==="object"&&"status" in e&&typeof e.status==="number"&&e.status>=400&&e.status<500;

async function api<T>(token:string,path:string,body?:object):Promise<T>{
 const res=await identityRequest("/api/hr/"+path,{method:body?"POST":"GET",cache:"no-store",
  headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const data=await res.json().catch(()=>null);
 if(!res.ok)throw Object.assign(new Error(res.status===401?"Your session expired. Sign in again.":
  typeof data?.message==="string"?data.message:"Leave result unavailable"),{status:res.status});
 if(!data||typeof data!=="object")throw Error("Leave result unavailable");
 return data as T;
}
function Button({title,onPress,disabled=false,selected=false}:{title:string;onPress:()=>void;disabled?:boolean;selected?:boolean}){
 return <Pressable accessibilityRole="button" accessibilityState={{disabled,selected}} disabled={disabled} onPress={onPress}
 style={[styles.button,selected&&styles.active,disabled&&styles.disabled]}><Text style={selected?styles.activeText:styles.buttonText}>{title}</Text></Pressable>;
}
function Field({title,value,onChange,disabled=false,secure=false,multiline=false,maxLength=500}:{title:string;value:string;onChange:(v:string)=>void;disabled?:boolean;secure?:boolean;multiline?:boolean;maxLength?:number}){
 return <View style={{gap:4}}><Text style={styles.label}>{title}</Text><TextInput accessibilityLabel={title} editable={!disabled}
  style={[styles.input,multiline&&{minHeight:80}]} value={value} onChangeText={onChange} secureTextEntry={secure}
  multiline={multiline} maxLength={maxLength} autoCapitalize="none"/></View>;
}
function useFailure(onExpired:()=>void,setError:(v:string)=>void){
 return useCallback((e:unknown)=>{if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();setError(failure(e));},[onExpired,setError]);
}
export function NativeHrMyLeave({token,onExpired,onChanged}:{token:string;onExpired:()=>void;onChanged:()=>void}){
 const [year,setYear]=useState(String(new Date().getFullYear())),[yearInput,setYearInput]=useState(year);
 const [data,setData]=useState<Mine|null>(null),[form,setForm]=useState(blank);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[locked,setLocked]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const key=useRef<string|null>(null),fail=useFailure(onExpired,setError);
 const refresh=useCallback(async()=>{
  setLoading(true);setError("");
  try{const v=await api<Mine>(token,"me/leave?year="+encodeURIComponent(year));
   if(typeof v.linked!=="boolean"||!Array.isArray(v.requests)||!Array.isArray(v.policies))throw Error("Leave history unavailable");
   setData(v);
  }catch(e){setData(null);fail(e);}finally{setLoading(false);}
 },[token,year,fail]);
 useEffect(()=>{void refresh();},[refresh]);
 const change=<K extends keyof typeof form,>(name:K,value:(typeof form)[K])=>setForm(x=>({...x,[name]:value}));
 const selected=data?.policies.find(x=>x.policyRef===form.policyRef);
 const submit=async()=>{
  if(busy||!data?.linked)return;
  setBusy(true);setError("");setNotice("");
  const requestKey=key.current??Crypto.randomUUID();key.current=requestKey;
  try{
   const v=await api<{submitted:boolean;reference:string;caseStatus:string}>(token,"me/leave",{requestKey,...form});
   if(v.submitted!==true||typeof v.reference!=="string")throw Error("Leave result is uncertain");
   key.current=null;setLocked(false);setForm(blank());setNotice(v.reference+" · "+label(v.caseStatus));await refresh();onChanged();
  }catch(e){fail(e);if(known(e)){key.current=null;setLocked(false);}else setLocked(true);}
  finally{setBusy(false);}
 };
 return <View style={styles.card}>
  <Text style={styles.title}>My leave</Text>
  <Field title="Leave year" value={yearInput} maxLength={4} disabled={busy||locked} onChange={setYearInput}/>
  <Button title="View year" disabled={busy||locked||!/^20\d{2}$/.test(yearInput)} onPress={()=>{setForm(blank());if(year===yearInput)void refresh();else setYear(yearInput);}}/>
  <Button title="Refresh leave history" disabled={busy||loading} onPress={()=>void refresh()}/>
  {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}{!!notice&&<Text style={styles.success}>{notice}</Text>}
  {loading&&<ActivityIndicator accessibilityLabel="Loading leave balances"/>}
  {data&&!data.linked&&<Text style={styles.muted}>No current approved employment is linked to this account.</Text>}
  {data?.linked&&<>
   {data.policies.length===0?<Text style={styles.muted}>No effective leave policy configured for this year.</Text>:<>
    {data.policies.map(x=><View key={x.policyRef} style={styles.item}><Text style={styles.label}>{x.leaveType}</Text>
     <Text style={styles.muted}>{x.availableDays} available · {x.usedDays} approved · From {x.effectiveFrom}{x.effectiveTo?" to before "+x.effectiveTo:" onward"}</Text></View>)}
    <Text style={styles.label}>Apply for leave · Choose leave type</Text>
    {data.policies.map(x=><Button key={x.policyRef} title={x.leaveType+" · from "+x.effectiveFrom} disabled={busy||locked}
     selected={form.policyRef===x.policyRef} onPress={()=>setForm(v=>({...v,policyRef:x.policyRef,halfDay:false}))}/>)}
    <Field title="Start date YYYY-MM-DD" value={form.startDate} disabled={busy||locked} maxLength={10} onChange={v=>change("startDate",v)}/>
    <Field title="End date YYYY-MM-DD" value={form.endDate} disabled={busy||locked} maxLength={10} onChange={v=>change("endDate",v)}/>
    {selected?.allowHalfDays&&<Button title={form.halfDay?"Half day selected":"Full day(s) · tap for half day"} selected={form.halfDay}
     disabled={busy||locked} onPress={()=>change("halfDay",!form.halfDay)}/>}
    <Field title="Private reason" value={form.reason} disabled={busy||locked} multiline onChange={v=>change("reason",v)}/>
    {locked&&<Text style={styles.muted}>The previous submission is uncertain. Retry the same request or refresh history; do not send a new application.</Text>}
    <Button title={busy?"Submitting…":locked?"Retry same leave request":"Submit for review"}
     disabled={busy||!form.policyRef||!form.startDate||!form.endDate||form.reason.trim().length<2} onPress={()=>void submit()}/>
   </>}
   <Text style={styles.label}>Leave history</Text>
   {!data.requests.length&&<Text style={styles.muted}>No leave requests in this year.</Text>}
   {data.requests.map(x=><View key={x.reference} style={styles.item}><Text style={styles.label}>{x.leaveType} · {label(x.status)}</Text>
    <Text style={styles.muted}>{x.startDate} – {x.endDate} · {x.days} days · {x.reference}</Text></View>)}
  </>}
 </View>;
}
export function NativeHrLeaveReviews({token,onExpired,onChanged}:{token:string;onExpired:()=>void;onChanged:()=>void}){
 const [items,setItems]=useState<Review[]>([]),[selected,setSelected]=useState<Review|null>(null);
 const [status,setStatus]=useState("SUBMITTED"),[offset,setOffset]=useState(0),[more,setMore]=useState(false);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [password,setPassword]=useState(""),[action,setAction]=useState("APPROVE"),[locked,setLocked]=useState(false);
 const key=useRef<string|null>(null),fail=useFailure(onExpired,setError);
 const refresh=useCallback(async()=>{
  setLoading(true);setError("");
  try{const v=await api<{items:Review[];hasMore:boolean}>(token,"leave-reviews?status="+status+"&offset="+offset);
   if(!Array.isArray(v.items))throw Error("Review list unavailable");setItems(v.items);setMore(v.hasMore===true);
  }catch(e){setItems([]);setMore(false);setSelected(null);fail(e);}finally{setLoading(false);}
 },[token,status,offset,fail]);
 useEffect(()=>{void refresh();},[refresh]);
 const open=async(x:Review)=>{
  if(busy||locked)return;setBusy(true);setError("");setSelected(null);setPassword("");setAction("APPROVE");key.current=null;
  try{const v=await api<Review>(token,"leave-reviews/"+encodeURIComponent(x.caseRef));
   if(v.reference!==x.reference)throw Error("Original review changed");setSelected(v);
  }catch(e){fail(e);}finally{setBusy(false);}
 };
 const decide=async()=>{
  if(busy||!selected?.canReview)return;setBusy(true);setError("");setNotice("");
  const requestKey=key.current??Crypto.randomUUID();key.current=requestKey;
  try{const v=await api<{confirmed:boolean;status:string;reference:string}>(token,"leave-reviews/"+encodeURIComponent(selected.caseRef)+"/decide",
    {requestKey,expectedRevision:selected.revision,action,currentPassword:password});
   if(v.confirmed!==true)throw Error("Decision result uncertain");
   key.current=null;setLocked(false);setPassword("");setSelected(null);setNotice(v.reference+" · "+label(v.status));await refresh();onChanged();
  }catch(e){setPassword("");fail(e);if(known(e)){key.current=null;setLocked(false);}else setLocked(true);}finally{setBusy(false);}
 };
 return <View style={styles.card}><Text style={styles.title}>Leave requests</Text>
  <View style={styles.choices}>{[{key:"SUBMITTED",title:"Pending"},{key:"OWNER_COMPLETED",title:"Approved"},
   {key:"RETURNED",title:"Returned"},{key:"REJECTED",title:"Rejected"},{key:"ALL",title:"All"}].map(x=>
   <Button key={x.key} title={x.title} selected={status===x.key} disabled={busy||locked}
    onPress={()=>{setStatus(x.key);setOffset(0);setSelected(null);setPassword("");}}/>)}</View>
  <Button title="Refresh reviews" disabled={busy||loading} onPress={()=>void refresh()}/>
  {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}{!!notice&&<Text style={styles.success}>{notice}</Text>}
  {loading&&<ActivityIndicator accessibilityLabel="Loading leave reviews"/>}
  {!loading&&!error&&!items.length&&<Text style={styles.muted}>No matching leave requests.</Text>}
  {items.map(x=><View key={x.caseRef} style={styles.item}><Text style={styles.label}>{x.employeeName} · {x.leaveType}</Text>
   <Text style={styles.muted}>{x.startDate} – {x.endDate} · {x.days} days · {label(x.status)}</Text>
   <Button title="View request" disabled={busy||locked} onPress={()=>void open(x)}/></View>)}
  {offset>0&&<Button title="Previous page" disabled={busy||locked} onPress={()=>{setSelected(null);setOffset(v=>Math.max(0,v-25));}}/>}
  {more&&<Button title="Next page" disabled={busy||locked} onPress={()=>{setSelected(null);setOffset(v=>v+25);}}/>}
  {selected&&<View style={styles.item}><Text style={styles.label}>{selected.employeeName} · {selected.leaveType}</Text>
   <Text style={styles.muted}>{selected.reference} · {selected.startDate} – {selected.endDate} · {selected.days} days</Text>
   <Text>Private reason: {selected.reason}</Text>
   {selected.canReview?<><View style={styles.choices}>{[{key:"APPROVE",title:"Approve"},{key:"RETURN",title:"Return"},{key:"REJECT",title:"Reject"}].map(x=>
    <Button key={x.key} title={x.title} selected={action===x.key} disabled={busy||locked} onPress={()=>setAction(x.key)}/>)}</View>
    <Field title="Current password" secure value={password} disabled={busy} maxLength={256} onChange={setPassword}/>
    {locked&&<Text style={styles.muted}>Decision outcome uncertain. Re-enter your password to retry the same decision.</Text>}
    <Button title={busy?"Confirming…":"Confirm decision"} disabled={busy||password.length<8} onPress={()=>void decide()}/>
   </>:<Text style={styles.muted}>{label(selected.status)} · A different authorized reviewer is required for your own request.</Text>}
   <Button title="Close request" disabled={busy||locked} onPress={()=>{setSelected(null);setPassword("");key.current=null;}}/>
  </View>}
 </View>;
}
const styles=StyleSheet.create({
 card:{borderWidth:1,borderColor:"#E2E8F0",borderRadius:14,padding:14,backgroundColor:"#fff",gap:10},
 title:{fontSize:17,fontWeight:"700",color:"#0F172A"},label:{fontSize:14,fontWeight:"600",color:"#334155"},
 muted:{fontSize:13,color:"#64748B",lineHeight:20},error:{color:"#991B1B",backgroundColor:"#FEE2E2",padding:10,borderRadius:8},
 success:{color:"#166534",backgroundColor:"#DCFCE7",padding:10,borderRadius:8},input:{borderWidth:1,borderColor:"#CBD5E1",borderRadius:9,padding:11,minHeight:46,color:"#0F172A"},
 button:{padding:11,borderRadius:9,backgroundColor:"#F1F5F9",alignItems:"center",minHeight:44,justifyContent:"center"},
 buttonText:{fontSize:14,color:"#0F172A",fontWeight:"600"},active:{backgroundColor:"#087F8C"},activeText:{color:"#fff",fontWeight:"700"},
 disabled:{opacity:0.5},item:{borderTopWidth:1,borderColor:"#E2E8F0",paddingTop:10,gap:6},choices:{flexDirection:"row",flexWrap:"wrap",gap:6}
});
