import React,{useCallback,useEffect,useRef,useState} from "react";
import {ActivityIndicator,Pressable,StyleSheet,Text,TextInput,View} from "react-native";
import * as Crypto from "expo-crypto";
import {identityRequest} from "../identity-access/http-client";
import {NativeHrMyLeave,NativeHrLeaveReviews,NativeHrAttendanceCorrections,type CorrectionDay,type CorrectionPerson} from "./native-hr-leave";

type Day=CorrectionDay&{checkInAt:string|null;checkOutAt:string|null;workedMinutes:number|null};
type Mine={status:string;canCheckOut?:boolean;shift?:{label:string;timeZone:string;start:string;end:string}|null;days:Day[]};
type Branch={branchRef:string;label:string;manageShifts:boolean};
type Person={reference:string;name:string;designation:string};
type Rule={policyRef:string;label:string;timeZone:string;start:string;end:string;effectiveFrom:string};
type Matrix={items:Array<CorrectionPerson&{designation:string}>;hasMore:boolean};
const today=()=>new Date().toISOString().slice(0,10); // admin policy date input only
async function api(token:string,path:string,method="GET",body?:object):Promise<unknown>{
 const res=await identityRequest("/api/hr/"+path,{method,cache:"no-store",
  headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},
  ...(body?{body:JSON.stringify(body)}:{})});
 const data:unknown=await res.json().catch(()=>null);
 if(!res.ok){
  const message=res.status===401?"Your login has expired. Sign in again.":
   res.status===403?"Your current employment or branch does not permit this action.":
   res.status===409?"This attendance or shift record changed. Refresh first.":
   data&&typeof data==="object"&&"message" in data&&typeof data.message==="string"?
   data.message:"Unable to confirm this staff attendance action.";
  throw Object.assign(new Error(message),{status:res.status});
 }
 return data;
}
type LeaveRule={policyRef:string;leaveType:string;annualHalfDays:number;allowHalfDays:boolean;
 countWeeklyOff:boolean;effectiveFrom:string;effectiveTo:string|null;version:number};
function NativeHrLeavePolicies({token,onExpired}:{token:string;onExpired:()=>void}){
 const [items,setItems]=useState<LeaveRule[]>([]),[more,setMore]=useState(false);
 const [form,setForm]=useState({leaveType:"",annualDays:"",allowHalfDays:false,
  countWeeklyOff:false,effectiveFrom:today()});
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const key=useRef<string|null>(null);
 const failure=useCallback((e:unknown)=>{
  if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
  setError(e instanceof Error?e.message:"Unable to confirm leave policy");
 },[onExpired]);
 const refresh=useCallback(async()=>{
  setLoading(true);
  try{const v=await api(token,"leave-policies");
   if(!v||typeof v!=="object"||!("items" in v)||!Array.isArray(v.items))
    throw Error("Leave policies could not be confirmed");
   setItems(v.items as LeaveRule[]);setMore("hasMore" in v&&v.hasMore===true);setError("");
  }catch(e){setItems([]);setMore(false);failure(e);}finally{setLoading(false);}
 },[token,failure]);
 useEffect(()=>{void refresh();},[refresh]);
 const update=<K extends keyof typeof form,>(field:K,value:(typeof form)[K])=>{
  key.current=null;setForm(x=>({...x,[field]:value}));
 };
 const save=async()=>{
  if(busy)return;setBusy(true);setError("");setNotice("");
  const requestKey=key.current??Crypto.randomUUID();key.current=requestKey;
  try{const v=await api(token,"leave-policies","POST",{requestKey,leaveType:form.leaveType,
   annualHalfDays:Number(form.annualDays)*2,allowHalfDays:form.allowHalfDays,
   countWeeklyOff:form.countWeeklyOff,effectiveFrom:form.effectiveFrom});
   if(!v||typeof v!=="object"||!("saved" in v)||v.saved!==true)throw Error("Leave policy save could not be confirmed");
   key.current=null;setNotice("Leave policy version saved.");await refresh();
  }catch(e){failure(e);}finally{setBusy(false);}
 };
 const field=(label:string,value:string,onChange:(v:string)=>void)=><View style={styles.field}>
  <Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label}
   style={styles.input} editable={!busy} value={value} onChangeText={onChange}/></View>;
 return <View style={styles.card}>
  <Text style={styles.title}>Leave policies</Text>
  <Text style={styles.muted}>Set Foundation-wide annual entitlement. A newer effective date creates a new version.</Text>
  {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
  {!!notice&&<Text style={styles.success}>{notice}</Text>}
  {field("Leave type",form.leaveType,v=>update("leaveType",v))}
  {field("Annual entitlement (days)",form.annualDays,v=>update("annualDays",v))}
  {field("Effective date YYYY-MM-DD",form.effectiveFrom,v=>update("effectiveFrom",v))}
  <Pressable accessibilityRole="checkbox" accessibilityState={{checked:form.allowHalfDays,disabled:busy}}
   disabled={busy} style={styles.outline} onPress={()=>update("allowHalfDays",!form.allowHalfDays)}>
   <Text style={styles.outlineText}>Half-day leave: {form.allowHalfDays?"Allowed":"Not allowed"}</Text></Pressable>
  <Pressable accessibilityRole="checkbox" accessibilityState={{checked:form.countWeeklyOff,disabled:busy}}
   disabled={busy} style={styles.outline} onPress={()=>update("countWeeklyOff",!form.countWeeklyOff)}>
   <Text style={styles.outlineText}>Weekly days off: {form.countWeeklyOff?"Counted":"Excluded"}</Text></Pressable>
  <Pressable accessibilityRole="button" disabled={busy||!form.leaveType.trim()||!form.annualDays||!form.effectiveFrom}
   style={styles.primary} onPress={()=>void save()}><Text style={styles.primaryText}>Save leave policy</Text></Pressable>
  <Pressable accessibilityRole="button" disabled={busy||loading} style={styles.outline} onPress={()=>void refresh()}>
   <Text style={styles.outlineText}>Refresh policies</Text></Pressable>
  {loading?<ActivityIndicator accessibilityLabel="Loading leave policies"/>:!error&&!items.length?
   <Text style={styles.muted}>No leave policy configured.</Text>:null}
  {items.map(x=><View key={x.policyRef} style={styles.listItem}>
   <Text style={styles.label}>{x.leaveType} · {x.annualHalfDays/2} days annually · Version {x.version}</Text>
   <Text style={styles.muted}>From {x.effectiveFrom}{x.effectiveTo?" until "+x.effectiveTo+" (exclusive)":""}
    {" · "+(x.allowHalfDays?"Half-days allowed":"Full days only")+" · "+(x.countWeeklyOff?"Weekly off counted":"Weekly off excluded")}</Text>
  </View>)}
  {more&&<Text style={styles.muted}>Showing the latest 100 policy versions.</Text>}
 </View>;
}
/** Internal Android parity for the original CG10 shift + self check-in API. */
export function NativeHrAttendance({token,canConfigure,canManageLeave=false,canReviewLeave=false,canCorrect=false,canReviewCorrection=false,canViewStaff=false,onExpired}:{
 token:string;canConfigure:boolean;canManageLeave?:boolean;canReviewLeave?:boolean;canCorrect?:boolean;canReviewCorrection?:boolean;canViewStaff?:boolean;onExpired:()=>void
}){
 const [mine,setMine]=useState<Mine|null>(null),[busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true),[error,setError]=useState(""),[message,setMessage]=useState("");
 const [branches,setBranches]=useState<Branch[]>([]),[branch,setBranch]=useState("");
 const [staff,setStaff]=useState<Person[]>([]),[staffOffset,setStaffOffset]=useState(0);
 const [policies,setPolicies]=useState<Rule[]>([]),[employee,setEmployee]=useState("");
 const [policyId,setPolicyId]=useState("");
 const [rule,setRule]=useState({name:"",timeZone:"",start:"09:00",end:"17:00",
  graceMinutes:"0",breakMinutes:"0",effectiveFrom:today(),weeklyOffDays:[] as number[]});
 const [validFrom,setValidFrom]=useState(today());
 const [month,setMonth]=useState(today().slice(0,7));
 const [matrix,setMatrix]=useState<Matrix|null>(null),[matrixOffset,setMatrixOffset]=useState(0);
 const [matrixBusy,setMatrixBusy]=useState(false);
 const [matrixRefresh,setMatrixRefresh]=useState(0);
 const checkKey=useRef<string|null>(null),checkoutKey=useRef<string|null>(null),policyKey=useRef<string|null>(null),
  assignmentKey=useRef<string|null>(null);
 const failure=useCallback((e:unknown)=>{
  if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
  setError(e instanceof Error?e.message:"Unable to confirm attendance");
 },[onExpired]);
 const refresh=useCallback(async()=>{
  setLoading(true);
  try{
   const value=await api(token,"me/attendance");
   if(!value||typeof value!=="object"||!("status" in value)||!("days" in value)||
    !Array.isArray(value.days))throw Error("Employee attendance is unavailable");
   setMine(value as Mine);setError("");
  }catch(e){setMine(null);failure(e);}
  finally{setLoading(false);}
 },[token,failure]);
 useEffect(()=>{void refresh();},[refresh]);
 useEffect(()=>{if(!canConfigure&&!canViewStaff)return;let live=true;
  void api(token,"attendance/branches").then(v=>{
   if(live&&v&&typeof v==="object"&&"items" in v&&Array.isArray(v.items))
    setBranches(v.items as Branch[]);
  }).catch(e=>{if(live){setBranches([]);failure(e);}});
  return()=>{live=false;};
 },[token,canConfigure,canViewStaff,failure]);
 useEffect(()=>{if(!canConfigure||!branch||!branches.some(x=>x.branchRef===branch&&x.manageShifts)){setStaff([]);setPolicies([]);return;}
  let live=true;
  void Promise.all([api(token,"employees?branch="+encodeURIComponent(branch)+
   "&offset="+staffOffset),api(token,"shift-policies?branch="+encodeURIComponent(branch))])
   .then(([persons,rules])=>{
    if(!live)return;
    setStaff(persons&&typeof persons==="object"&&"items" in persons&&Array.isArray(persons.items)?
      persons.items as Person[]:[]);
    setPolicies(rules&&typeof rules==="object"&&"items" in rules&&Array.isArray(rules.items)?
      rules.items as Rule[]:[]);
   }).catch(e=>{if(live){setStaff([]);setPolicies([]);failure(e);}});
  return()=>{live=false;};
 },[token,canConfigure,branch,staffOffset,branches,failure]);
 useEffect(()=>{if((!canConfigure&&!canViewStaff)||!branch){setMatrix(null);return;}
  let live=true;setMatrix(null);setMatrixBusy(true);
  void api(token,"attendance/matrix?branch="+encodeURIComponent(branch)+
   "&month="+encodeURIComponent(month)+"&offset="+matrixOffset)
   .then(v=>{if(live&&v&&typeof v==="object"&&"items" in v&&Array.isArray(v.items))
    setMatrix(v as Matrix);})
   .catch(e=>{if(live){setMatrix(null);failure(e);}})
   .finally(()=>{if(live)setMatrixBusy(false);});
  return()=>{live=false;};
 },[token,canConfigure,branch,month,matrixOffset,matrixRefresh,canViewStaff,failure]);
 const checkIn=async()=>{
  if(busy)return;setBusy(true);setError("");setMessage("");
  const key=checkKey.current??Crypto.randomUUID();checkKey.current=key;
  try{
   const result=await api(token,"me/attendance/check-in","POST",{requestKey:key});
   if(!result||typeof result!=="object"||!("recorded" in result)||
    result.recorded!==true)throw Error("Check-in could not be confirmed");
   checkKey.current=null;setMessage("Check-in recorded using the verified server clock.");
   await refresh();
  }catch(e){failure(e);}
  finally{setBusy(false);}
 };
 const checkOut=async()=>{
  if(busy)return;setBusy(true);setError("");setMessage("");
  const key=checkoutKey.current??Crypto.randomUUID();checkoutKey.current=key;
  try{
   const result=await api(token,"me/attendance/check-out","POST",{requestKey:key});
   if(!result||typeof result!=="object"||!("recorded" in result)||
    result.recorded!==true)throw Error("Check-out was not confirmed");
   checkoutKey.current=null;setMessage("Check-out confirmed using verified server time.");
   await refresh();
  }catch(e){failure(e);}
  finally{setBusy(false);}
 };
 const change=(key:keyof typeof rule,value:string|number[])=>{
  setRule(x=>({...x,[key]:value}));policyKey.current=null;
 };
 const savePolicy=async()=>{
  if(busy||!branch||!rule.name.trim()||!rule.timeZone.trim())return;
  setBusy(true);setError("");setMessage("");
  const key=policyKey.current??Crypto.randomUUID();policyKey.current=key;
  try{
   await api(token,"shift-policies","POST",{requestKey:key,branchRef:branch,
    name:rule.name,timeZone:rule.timeZone,start:rule.start,end:rule.end,
    graceMinutes:Number(rule.graceMinutes),breakMinutes:Number(rule.breakMinutes),
    weeklyOffDays:rule.weeklyOffDays,effectiveFrom:rule.effectiveFrom});
   policyKey.current=null;setMessage("Shift policy saved.");
   const refreshed=await api(token,"shift-policies?branch="+encodeURIComponent(branch));
   if(refreshed&&typeof refreshed==="object"&&"items" in refreshed&&
    Array.isArray(refreshed.items))setPolicies(refreshed.items as Rule[]);
  }catch(e){failure(e);}
  finally{setBusy(false);}
 };
 const assign=async()=>{
  if(busy||!employee||!policyId)return;setBusy(true);setError("");setMessage("");
  const key=assignmentKey.current??Crypto.randomUUID();assignmentKey.current=key;
  try{
   await api(token,"shift-assignments","POST",{requestKey:key,
    employeeReference:employee,policyRef:policyId,validFrom});
   assignmentKey.current=null;setMessage("Employee shift assignment confirmed.");
  }catch(e){failure(e);}
  finally{setBusy(false);}
 };
 const field=(label:string,value:string,onChange:(v:string)=>void,placeholder:string)=>
  <View style={styles.field}><Text style={styles.label}>{label}</Text>
   <TextInput accessibilityLabel={label} style={styles.input} value={value}
    onChangeText={onChange} placeholder={placeholder} placeholderTextColor="#94A3B8"
    autoCapitalize="none"/></View>;
 return <View style={styles.container}>
  <View style={styles.card}>
   <Text style={styles.title}>My attendance</Text>
   {loading&&<ActivityIndicator accessibilityLabel="Loading my attendance"/>}
   {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
   {!!message&&<Text accessibilityRole="text" style={styles.success}>{message}</Text>}
   {mine?.status==="NOT_LINKED"&&<Text style={styles.muted}>No approved employment is linked to your account.</Text>}
   {mine?.status==="NO_CURRENT_SHIFT"&&<Text style={styles.muted}>HR has not assigned your current branch shift.</Text>}
   {mine?.shift&&<>
    <Text style={styles.label}>{mine.shift.label}</Text>
    <Text style={styles.muted}>{mine.shift.start}–{mine.shift.end} · {mine.shift.timeZone}</Text>
    <Pressable accessibilityRole="button" accessibilityState={{disabled:busy}} disabled={busy}
     onPress={()=>void checkIn()} style={styles.primary}>
     <Text style={styles.primaryText}>{busy?"Checking…":"Check in using server time"}</Text></Pressable>
   </>}
    {mine?.canCheckOut&&<Pressable accessibilityRole="button" disabled={busy}
     onPress={()=>void checkOut()} style={styles.primary}>
     <Text style={styles.primaryText}>Check out using server time</Text></Pressable>}
   <Pressable accessibilityRole="button" onPress={()=>void refresh()} style={styles.outline}>
    <Text style={styles.outlineText}>Refresh attendance</Text></Pressable>
   {mine?.days?.map(d=><View key={d.date} style={styles.listItem}>
    <Text style={styles.label}>{d.date} · {d.status}{d.leaveDays>0?" · "+d.leaveDays+" day approved leave":""}</Text>
    <Text style={styles.muted}>Check-in: {d.checkInAt?new Date(d.checkInAt).toLocaleString():"—"}</Text>
    <Text style={styles.muted}>Check-out: {d.checkOutAt?
     new Date(d.checkOutAt).toLocaleString():"Pending"}</Text>
    {d.workedMinutes!==null&&<Text style={styles.muted}>
     Worked: {Math.floor(d.workedMinutes/60)}h {d.workedMinutes%60}m</Text>}
   </View>)}
  </View>
  {(canConfigure||canViewStaff)&&<View style={styles.card}>
   <Text style={styles.title}>Staff shifts</Text>
   <Text style={styles.muted}>Create an actual branch shift and assign an approved employee.</Text>
   <Text style={styles.label}>Foundation branch</Text>
   <View style={styles.choices}>{branches.map(x=><Pressable key={x.branchRef}
    accessibilityRole="button" accessibilityState={{selected:x.branchRef===branch}}
    style={[styles.chip,branch===x.branchRef&&styles.active]} onPress={()=>{
     setBranch(x.branchRef);setEmployee("");setPolicyId("");setStaffOffset(0);
     policyKey.current=null;assignmentKey.current=null;}}>
    <Text style={branch===x.branchRef?styles.activeText:styles.chipText}>{x.label}</Text>
   </Pressable>)}</View>
   {!!branch&&<>
    {canConfigure&&branches.some(x=>x.branchRef===branch&&x.manageShifts)&&<>{field("Shift name",rule.name,v=>change("name",v),"Shift name")}
    {field("IANA timezone",rule.timeZone,v=>change("timeZone",v),"e.g. Asia/Kolkata")}
    {field("24-hour start",rule.start,v=>change("start",v),"09:00")}
    {field("24-hour end",rule.end,v=>change("end",v),"17:00")}
    {field("Grace minutes",rule.graceMinutes,v=>change("graceMinutes",v),"0")}
    {field("Break minutes",rule.breakMinutes,v=>change("breakMinutes",v),"0")}
    {field("Effective date YYYY-MM-DD",rule.effectiveFrom,
     v=>change("effectiveFrom",v),"YYYY-MM-DD")}
    <Text style={styles.label}>Weekly days off (tap to select)</Text>
    <View style={styles.choices}>{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((label,n)=>
     <Pressable key={label} accessibilityRole="button"
      accessibilityState={{selected:rule.weeklyOffDays.includes(n)}}
      style={[styles.chip,rule.weeklyOffDays.includes(n)&&styles.active]}
      onPress={()=>change("weeklyOffDays",rule.weeklyOffDays.includes(n)?
       rule.weeklyOffDays.filter(d=>d!==n):[...rule.weeklyOffDays,n])}>
      <Text style={rule.weeklyOffDays.includes(n)?styles.activeText:styles.chipText}>{label}</Text>
     </Pressable>)}</View>
    <Pressable accessibilityRole="button" disabled={busy||!rule.name.trim()||!rule.timeZone.trim()}
     style={styles.primary} onPress={()=>void savePolicy()}>
     <Text style={styles.primaryText}>Save shift policy</Text></Pressable>
    <Text style={styles.label}>Approved employee</Text>
    <View style={styles.choices}>{staff.map(x=><Pressable key={x.reference}
     accessibilityRole="button" accessibilityState={{selected:employee===x.reference}}
     style={[styles.chip,employee===x.reference&&styles.active]}
     onPress={()=>{setEmployee(x.reference);assignmentKey.current=null;}}>
     <Text style={employee===x.reference?styles.activeText:styles.chipText}>
      {x.name} · {x.designation}</Text>
    </Pressable>)}</View>
    {staffOffset>0&&<Pressable accessibilityRole="button"
     onPress={()=>setStaffOffset(v=>Math.max(0,v-25))} style={styles.outline}>
     <Text style={styles.outlineText}>Previous employees</Text></Pressable>}
    {staff.length===25&&<Pressable accessibilityRole="button"
     onPress={()=>setStaffOffset(v=>v+25)} style={styles.outline}>
     <Text style={styles.outlineText}>Next employees</Text></Pressable>}
    <Text style={styles.label}>Shift policy</Text>
    <View style={styles.choices}>{policies.map(p=><Pressable key={p.policyRef}
     accessibilityRole="button" accessibilityState={{selected:policyId===p.policyRef}}
     style={[styles.chip,policyId===p.policyRef&&styles.active]}
     onPress={()=>{setPolicyId(p.policyRef);assignmentKey.current=null;}}>
     <Text style={policyId===p.policyRef?styles.activeText:styles.chipText}>
      {p.label} · {p.start}–{p.end} · {p.timeZone} (from {p.effectiveFrom})</Text>
    </Pressable>)}</View>
    {field("Assignment date YYYY-MM-DD",validFrom,v=>{setValidFrom(v);
     assignmentKey.current=null;},"YYYY-MM-DD")}
    <Pressable accessibilityRole="button" disabled={busy||!employee||!policyId}
     style={styles.primary} onPress={()=>void assign()}>
     <Text style={styles.primaryText}>Assign employee shift</Text></Pressable></>}
    <View style={styles.listItem}>
     <Text style={styles.title}>Branch attendance</Text>
     <Text style={styles.muted}>Recorded attendance and approved leave are shown. Unrecorded is not absent.</Text>
     {field("Month YYYY-MM",month,v=>{setMonth(v);setMatrixOffset(0);},"YYYY-MM")}
     {matrixBusy&&<ActivityIndicator accessibilityLabel="Loading staff attendance"/>}
     {matrix?.items.map((x,i)=><View style={styles.listItem}
      key={x.employeeName+"-"+String(i)}>
      <Text style={styles.label}>{x.employeeName} · {x.designation}</Text>
      {x.days.length?x.days.map(d=><Text style={styles.muted}
       key={d.date}>{d.date}: {d.status}{d.leaveDays>0?" · "+d.leaveDays+" day leave":""}</Text>):
       <Text style={styles.muted}>No attendance or approved leave recorded this month.</Text>}
     </View>)}
     {matrixOffset>0&&<Pressable accessibilityRole="button" style={styles.outline}
      onPress={()=>setMatrixOffset(v=>Math.max(0,v-25))}>
      <Text style={styles.outlineText}>Previous staff page</Text></Pressable>}
     {matrix?.hasMore&&<Pressable accessibilityRole="button" style={styles.outline}
      onPress={()=>setMatrixOffset(v=>v+25)}>
      <Text style={styles.outlineText}>Next staff page</Text></Pressable>}
    </View>
   </>}
  </View>}
  <NativeHrMyLeave token={token} onExpired={onExpired} onChanged={()=>void refresh()}/>
  {canManageLeave&&<NativeHrLeavePolicies token={token} onExpired={onExpired}/>}
  {canReviewLeave&&<NativeHrLeaveReviews token={token} onExpired={onExpired} onChanged={()=>void refresh()}/>}
  <NativeHrAttendanceCorrections token={token} onExpired={onExpired} days={mine?.days??[]} staff={canCorrect?(matrix?.items??[]):[]} onChanged={()=>{void refresh();setMatrixRefresh(v=>v+1);}}/>
  {canReviewCorrection&&<NativeHrLeaveReviews token={token} onExpired={onExpired} kind="correction" onChanged={()=>{void refresh();setMatrixRefresh(v=>v+1);}}/>}
 </View>;
}
const styles=StyleSheet.create({
 container:{gap:14,marginVertical:12},
 card:{backgroundColor:"#fff",borderWidth:1,borderColor:"#E2E8F0",borderRadius:16,padding:15,gap:8},
 title:{fontSize:17,fontWeight:"700",color:"#0F172A"},
 label:{fontWeight:"600",fontSize:13,color:"#334155"},
 muted:{fontSize:13,color:"#64748B",lineHeight:20},
 primary:{backgroundColor:"#087F8C",padding:13,borderRadius:10,alignItems:"center",marginTop:5},
 primaryText:{fontWeight:"700",color:"#fff"},
 outline:{padding:10,backgroundColor:"#F1F5F9",borderRadius:9,alignSelf:"flex-start"},
 outlineText:{fontWeight:"600",color:"#0F172A"},
 error:{padding:10,color:"#991B1B",backgroundColor:"#FEF2F2",borderRadius:10},
 success:{padding:10,color:"#166534",backgroundColor:"#ECFDF5",borderRadius:10},
 listItem:{paddingVertical:8,borderTopWidth:1,borderColor:"#E2E8F0"},
 field:{gap:4,marginTop:6},input:{minHeight:47,borderWidth:1,borderColor:"#CBD5E1",
  borderRadius:9,padding:12,color:"#0F172A",backgroundColor:"#fff"},
 choices:{flexDirection:"row",flexWrap:"wrap",gap:7},
 chip:{padding:9,borderWidth:1,borderColor:"#CBD5E1",borderRadius:9},
 active:{backgroundColor:"#0369A1",borderColor:"#0369A1"},
 chipText:{color:"#334155",fontSize:13},activeText:{color:"#fff",fontSize:13,fontWeight:"700"}
});
