import React,{useCallback,useEffect,useRef,useState} from "react";
import {Pressable,StyleSheet,Text,TextInput,View} from "react-native";
import * as Crypto from "expo-crypto";
import {identityRequest} from "../identity-access/http-client";
type Mode="own"|"manage"|"review";
type Kind="TRANSFER"|"PROMOTION"|"DEPUTATION"|"RESIGNATION"|"EXIT";
type Position={branch:string;designation:string;department?:string|null;manager?:string|null;role?:string|null};
type Form={employeeReference:string;kind:Kind;effectiveDate:string;lastWorkingDate:string;branchRef:string;departmentRef:string;managerRef:string;designation:string;roleRef:string;salary:string;reason:string};
type Item={reference:string;caseRef?:string;caseReference?:string|null;employeeName?:string;employeeReference?:string;kind:Kind;status:string;effectiveDate:string;lastWorkingDate?:string|null;revision:number;current?:Position;proposed?:Position|null;reason?:string;proposedSalaryMinor?:number|null;canEdit?:boolean;canWithdraw?:boolean;canReview?:boolean;canApply?:boolean;canRecordClearance?:boolean;effectIssue?:string|null;form?:Partial<Form>;clearance?:{items:{kind:string;status:string}[];financeStatus:string;salaryAndDuesStatus:string}|null};
type Option={value:string;label:string};
type Person={employeeReference:string;name:string;current:Position};
const display=(s:string)=>({APPROVED_PENDING_EFFECT:"Approved – application pending",SUBMITTED:"Awaiting review",NOT_VERIFIED:"Not verified",NOT_AVAILABLE:"Not available"} as Record<string,string>)[s]??s.toLowerCase().replaceAll("_"," ");
const kinds:Kind[]=["TRANSFER","PROMOTION","DEPUTATION","RESIGNATION","EXIT"];
const exit=(k:Kind)=>k==="RESIGNATION"||k==="EXIT";
const blank=(mode:Mode):Form=>({employeeReference:"",kind:mode==="own"?"RESIGNATION":"TRANSFER",effectiveDate:"",lastWorkingDate:"",branchRef:"",departmentRef:"",managerRef:"",designation:"",roleRef:"",salary:"",reason:""});
const known=(e:unknown)=>!!e&&typeof e==="object"&&"status" in e&&typeof e.status==="number"&&e.status>=400&&e.status<500;
async function api<T>(token:string,path:string,body?:object):Promise<T>{
 const r=await identityRequest("/api/hr/"+path,{method:body?"POST":"GET",cache:"no-store",headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{})});
 if(!r.ok)throw Object.assign(new Error(r.status===401?"Sign in again.":r.status===403?"Your current role cannot perform this action.":r.status===409?"Request changed or prerequisites not met. Refresh before acting.":r.status===400?"Check the employment details.":"Outcome could not be confirmed."),{status:r.status});
 const v=await r.json();if(!v||typeof v!=="object")throw Error("Outcome not confirmed");return v as T;
}
function Button({title,onPress,disabled=false}:{title:string;onPress:()=>void;disabled?:boolean}){return <Pressable accessibilityRole="button" accessibilityState={{disabled}} disabled={disabled} onPress={onPress} style={[styles.button,disabled&&{opacity:.5}]}><Text style={styles.label}>{title}</Text></Pressable>;}
function Field({label,value,onChange,secure=false,multiline=false,disabled=false}:{label:string;value:string;onChange:(v:string)=>void;secure?:boolean;multiline?:boolean;disabled?:boolean}){return <View><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} style={styles.input} value={value} onChangeText={onChange} secureTextEntry={secure} multiline={multiline} editable={!disabled} maxLength={secure?1024:1000}/></View>;}
function Choices({title,options,value,onChange,disabled=false}:{title:string;options:Option[];value:string;onChange:(v:string)=>void;disabled?:boolean}){
 return <View style={{gap:5}}><Text style={styles.label}>{title}</Text>{options.map(x=><Pressable key={x.value} accessibilityRole="radio" accessibilityState={{checked:x.value===value,disabled}} disabled={disabled} style={[styles.button,x.value===value&&{backgroundColor:"#D1FAE5"}]} onPress={()=>onChange(x.value)}><Text>{x.label}</Text></Pressable>)}</View>;
}
function PositionBlock({title,value}:{title:string;value:Position}){return <View style={styles.item}><Text style={styles.label}>{title}</Text><Text>{value.designation} · {value.branch}</Text>{!!value.department&&<Text>Department: {value.department}</Text>}{!!value.manager&&<Text>Manager: {value.manager}</Text>}{!!value.role&&<Text>Role: {value.role}</Text>}</View>;}
export function NativeHrEmploymentChanges({token,mode,onExpired,canSelectRoles=false}:{token:string;mode:Mode;onExpired:()=>void;canSelectRoles?:boolean}){
 const route=mode==="own"?"me/changes":mode==="review"?"employment-change-reviews":"employment-changes";
 const [items,setItems]=useState<Item[]>([]),[linked,setLinked]=useState<boolean|null>(null),[offset,setOffset]=useState(0),[more,setMore]=useState(false);
 const [selected,setSelected]=useState<Item|null>(null),[form,setForm]=useState<Form>(()=>blank(mode)),[editing,setEditing]=useState(false);
 const [people,setPeople]=useState<Person[]>([]),[branches,setBranches]=useState<Option[]>([]),[departments,setDepartments]=useState<Option[]>([]),[managers,setManagers]=useState<Option[]>([]),[roles,setRoles]=useState<Option[]>([]);
 const [search,setSearch]=useState(""),[roleSearch,setRoleSearch]=useState(""),[password,setPassword]=useState(""),[clearance,setClearance]=useState(""),[note,setNote]=useState("");
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[locked,setLocked]=useState(false);
 const pending=useRef<{path:string;body:Record<string,unknown>;decision?:boolean}|null>(null),inflight=useRef(false),read=useRef(0),peopleRead=useRef(0),destinationRead=useRef(0),roleRead=useRef(0);
 const change=<K extends keyof Form,>(k:K,v:Form[K])=>setForm(old=>({...old,[k]:v}));
 const fail=useCallback((e:unknown)=>{if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();setError(e instanceof Error?e.message:"Outcome not confirmed");},[onExpired]);
 const refresh=useCallback(async()=>{
  const seq=++read.current;setItems([]);setError("");
  try{const v=await api<{items:Item[];linked?:boolean;hasMore?:boolean}>(token,route+"?offset="+offset);if(!Array.isArray(v.items))throw Error("Employment history unavailable");
   if(seq===read.current){setItems(v.items);setLinked(v.linked??null);setMore(v.hasMore===true);}}
  catch(e){if(seq===read.current)fail(e);}
 },[token,route,offset,fail]);
 useEffect(()=>{void refresh();return()=>{read.current++;};},[refresh]);
 const loadPeople=useCallback(async(q:string)=>{const seq=++peopleRead.current;try{const v=await api<{items:Person[]}>(token,"employment-change-options/employees?search="+encodeURIComponent(q));if(seq===peopleRead.current)setPeople(v.items);}catch(e){if(seq===peopleRead.current)fail(e);}},[token,fail]);
 const loadRoles=useCallback(async(q:string)=>{const seq=++roleRead.current;if(!canSelectRoles)return;try{const v=await api<{options:Option[]}>(token,"employment-change-options/roles?search="+encodeURIComponent(q));if(seq===roleRead.current)setRoles(v.options);}catch(e){if(seq===roleRead.current)fail(e);}},[token,fail,canSelectRoles]);
 useEffect(()=>{if(mode!=="manage")return;let live=true;void loadPeople("");void loadRoles("");
  api<{items:{branchRef:string;label:string}[]}>(token,"employment-change-options/branches").then(v=>{if(live)setBranches(v.items.map(x=>({value:x.branchRef,label:x.label})));}).catch(e=>{if(live)fail(e);});
  return()=>{live=false;peopleRead.current++;roleRead.current++;};},[token,mode,loadPeople,loadRoles,fail]);
 useEffect(()=>{const seq=++destinationRead.current;setDepartments([]);setManagers([]);if(!form.branchRef||mode!=="manage")return;
  api<{departments:{departmentRef:string;label:string}[];managers:{managerRef:string;label:string}[]}>(token,"employment-change-options/destination?branchRef="+encodeURIComponent(form.branchRef)).then(v=>{if(seq===destinationRead.current){setDepartments(v.departments.map(x=>({value:x.departmentRef,label:x.label})));setManagers(v.managers.map(x=>({value:x.managerRef,label:x.label})));}}).catch(e=>{if(seq===destinationRead.current)fail(e);});
  return()=>{destinationRead.current++;};},[token,mode,form.branchRef,fail]);
 const open=async(x:Item)=>{
  if(inflight.current||locked)return;inflight.current=true;setBusy(true);setSelected(null);setEditing(false);setNotice("");setError("");setPassword("");setNote("");
  try{const ref=mode==="review"?x.caseRef:x.reference;if(!ref)throw Error("Original request unavailable");const v=await api<Item>(token,route+"/"+encodeURIComponent(ref));if(v.reference!==x.reference)throw Error("Original request changed");setSelected(v);}
  catch(e){fail(e);}finally{inflight.current=false;setBusy(false);}
 };
 const start=()=>{setSelected(null);setForm(blank(mode));setEditing(true);setNotice("");setError("");};
 const edit=()=>{if(!selected?.canEdit)return;let x=selected;setForm({...blank(mode),...x.form,employeeReference:x.employeeReference??"",kind:x.kind,effectiveDate:x.effectiveDate,lastWorkingDate:x.lastWorkingDate??"",branchRef:x.form?.branchRef??"",departmentRef:x.form?.departmentRef??"",managerRef:x.form?.managerRef??"",designation:x.form?.designation??"",roleRef:x.form?.roleRef??"",salary:x.proposedSalaryMinor==null?"":String(x.proposedSalaryMinor/100),reason:x.reason??""});setEditing(true);};
 const run=async(path?:string,body?:Record<string,unknown>,decision=false)=>{
  if(inflight.current)return;let cmd=pending.current;if(!cmd){if(!path||!body)return;cmd={path,body,decision};pending.current=cmd;}
  if(cmd.decision&&!password){setError("Confirm your current password.");return;}
  inflight.current=true;setBusy(true);setError("");setNotice("");
  try{const v=await api<Record<string,unknown>>(token,cmd.path,{...cmd.body,...(cmd.decision?{currentPassword:password}:{})});
   if(!v.reference&&v.withdrawn!==true&&v.recorded!==true&&v.applied!==true&&v.confirmed!==true)throw Error("Outcome not confirmed");
   pending.current=null;setLocked(false);setSelected(null);setEditing(false);setPassword("");setNote("");setForm(blank(mode));await refresh();setNotice("Request updated. Current status is shown in the list.");
  }catch(e){fail(e);setPassword("");if(known(e)){pending.current=null;setLocked(false);}else setLocked(true);}
  finally{inflight.current=false;setBusy(false);}
 };
 const save=()=>{
  if(!form.effectiveDate||form.reason.trim().length<2||(mode==="manage"&&!form.employeeReference)||(exit(form.kind)?!form.lastWorkingDate:!form.branchRef||!form.designation.trim())){setError("Complete the required employment details.");return;}
  const amount=form.salary.trim()?Math.round(Number(form.salary)*100):null;if(amount!==null&&(!Number.isSafeInteger(amount)||amount<=0)){setError("Enter a valid salary proposal.");return;}
  const payload={requestKey:Crypto.randomUUID(),kind:form.kind,effectiveDate:form.effectiveDate,reason:form.reason,...(mode==="manage"?{employeeReference:form.employeeReference}:{}),
   ...(exit(form.kind)?{lastWorkingDate:form.lastWorkingDate}:{branchRef:form.branchRef,departmentRef:form.departmentRef||null,managerRef:form.managerRef||null,designation:form.designation,roleRef:form.roleRef||null,proposedSalaryMinor:amount}),
   ...(selected?{expectedRevision:selected.revision}:{})};
  void run(selected?"employment-changes/"+selected.reference+"/edit":"employment-changes",payload);
 };
 const blocked=busy||locked,person=people.find(x=>x.employeeReference===form.employeeReference);
 const action=(name:string)=>selected&&void run("employment-changes/"+selected.reference+"/"+name,{requestKey:Crypto.randomUUID(),expectedRevision:selected.revision});
 return <View style={styles.card}>
  <Text style={styles.title}>{mode==="own"?"My employment changes":mode==="manage"?"Transfer, promotion & exit":"Employment approvals"}</Text>
  <Button title="Refresh" disabled={blocked} onPress={()=>void refresh()}/>
  {mode!=="review"&&(mode!=="own"||linked===true)&&<Button title={mode==="own"?"Request resignation":"New employment change"} disabled={blocked} onPress={start}/>}
  {!!error&&<Text accessibilityRole="alert" style={{color:"#991B1B"}}>{error}</Text>}{!!notice&&<Text accessibilityRole="alert">{notice}</Text>}
  {!items.length&&<Text style={styles.muted}>{mode==="own"&&linked===false?"No current employment is linked.":"No employment requests in this view."}</Text>}
  {items.map(x=><View key={x.reference} style={styles.item}><Text style={styles.label}>{x.employeeName??display(x.kind)} · {x.reference}</Text><Text>{display(x.kind)} · {x.effectiveDate} · {display(x.status)}</Text><Button title="View" disabled={blocked} onPress={()=>void open(x)}/></View>)}
  {mode!=="own"&&offset>0&&<Button title="Previous" disabled={blocked} onPress={()=>setOffset(v=>Math.max(0,v-25))}/>}
  {mode!=="own"&&more&&<Button title="Next" disabled={blocked} onPress={()=>setOffset(v=>v+25)}/>}
  {selected&&<View style={styles.item}><Text style={styles.label}>{selected.reference} · {display(selected.status)}</Text><Text>Effective: {selected.effectiveDate}</Text>{!!selected.lastWorkingDate&&<Text>Last working: {selected.lastWorkingDate}</Text>}
   {selected.current&&<PositionBlock title="Current position" value={selected.current}/>}
   {selected.proposed&&<PositionBlock title="Proposed position" value={selected.proposed}/>}
   {!!selected.reason&&<Text>Reason: {selected.reason}</Text>}{selected.proposedSalaryMinor!=null&&<Text>Confidential proposal: ₹{selected.proposedSalaryMinor/100} (not applied to payroll)</Text>}
   {!!selected.effectIssue&&<Text>{selected.effectIssue}</Text>}
   {selected.clearance&&<View><Text style={styles.label}>Exit clearance</Text>{selected.clearance.items.map(x=><Text key={x.kind}>{display(x.kind)}: {display(x.status)}</Text>)}<Text>Finance: {display(selected.clearance.financeStatus)} · Salary and dues: {display(selected.clearance.salaryAndDuesStatus)}</Text></View>}
   {!editing&&mode!=="review"&&selected.canEdit&&<><Button title="Edit draft" disabled={blocked} onPress={edit}/><Button title="Submit for review" disabled={blocked} onPress={()=>action("submit")}/></>}
   {mode!=="review"&&selected.canWithdraw&&<Button title="Withdraw pending request" disabled={blocked} onPress={()=>action("withdraw")}/>}
   {mode==="manage"&&selected.canRecordClearance&&<><Choices title="Clearance" options={(selected.clearance?.items??[]).filter(x=>x.status!=="CONFIRMED").map(x=>({value:x.kind,label:display(x.kind)}))} value={clearance} onChange={setClearance} disabled={blocked}/>
    <Field label="Actual evidence / handover note" value={note} onChange={setNote} multiline disabled={blocked}/><Button title="Confirm clearance" disabled={blocked||!clearance||note.trim().length<2} onPress={()=>void run("employment-changes/"+selected.reference+"/clearance",{requestKey:Crypto.randomUUID(),kind:clearance,evidenceNote:note})}/></>}
   {mode==="review"&&selected.canReview&&<><Field label="Current password" value={password} onChange={setPassword} secure disabled={busy}/>{["APPROVE","RETURN","REJECT"].map(a=><Button key={a} title={display(a)} disabled={blocked||!password} onPress={()=>void run(route+"/"+selected.caseRef+"/decide",{requestKey:Crypto.randomUUID(),expectedRevision:selected.revision,action:a},true)}/>)}</>}
   {mode==="review"&&selected.canApply&&<Button title={exit(selected.kind)?"Complete approved exit":"Apply approved change"} disabled={blocked} onPress={()=>void run(route+"/"+selected.caseRef+"/apply",{})}/>}
  </View>}
  {editing&&<View style={styles.item}>
   {mode==="manage"&&<><Field label="Find employee" value={search} onChange={setSearch} disabled={blocked}/><Button title="Search employees" disabled={blocked} onPress={()=>void loadPeople(search)}/><Choices title="Employee" options={people.map(x=>({value:x.employeeReference,label:x.name}))} value={form.employeeReference} onChange={v=>{const e=people.find(x=>x.employeeReference===v);setForm(old=>({...old,employeeReference:v,designation:e?.current.designation??"",branchRef:"",departmentRef:"",managerRef:"",roleRef:""}));}} disabled={blocked||!!selected}/>{person&&<PositionBlock title="Current position" value={person.current}/>}
   {!selected&&<Choices title="Change type" value={form.kind} options={kinds.map(k=>({value:k,label:display(k)}))} disabled={blocked} onChange={k=>change("kind",k as Kind)}/>}</>}
   <Field label="Effective date (YYYY-MM-DD)" value={form.effectiveDate} onChange={v=>change("effectiveDate",v)} disabled={blocked}/>
   {exit(form.kind)?<Field label="Last working date (YYYY-MM-DD)" value={form.lastWorkingDate} onChange={v=>change("lastWorkingDate",v)} disabled={blocked}/>:<>
    <Choices title="Destination branch" options={branches} value={form.branchRef} disabled={blocked} onChange={v=>setForm(old=>({...old,branchRef:v,departmentRef:"",managerRef:""}))}/>
    <Choices title="Department" options={[{value:"",label:"None"},...departments]} value={form.departmentRef} disabled={blocked} onChange={v=>change("departmentRef",v)}/>
    <Choices title="Manager" options={[{value:"",label:"None"},...managers]} value={form.managerRef} disabled={blocked} onChange={v=>change("managerRef",v)}/>
    <Field label="Proposed designation" value={form.designation} disabled={blocked} onChange={v=>change("designation",v)}/>
    {canSelectRoles&&<><Field label="Find staff role" value={roleSearch} onChange={setRoleSearch} disabled={blocked}/><Button title="Search roles" disabled={blocked} onPress={()=>void loadRoles(roleSearch)}/><Choices title="Proposed role (required for linked staff)" options={[{value:"",label:"No linked staff role"},...roles]} value={form.roleRef} disabled={blocked} onChange={v=>change("roleRef",v)}/></>}
    <Field label="Confidential monthly salary proposal (₹, optional)" value={form.salary} onChange={v=>change("salary",v)} disabled={blocked}/><Text style={styles.muted}>Salary is a proposal only, not payroll.</Text></>}
   <Field label="Reason" value={form.reason} onChange={v=>change("reason",v)} multiline disabled={blocked}/><Button title="Save draft" disabled={blocked} onPress={save}/><Button title="Close form" disabled={blocked} onPress={()=>setEditing(false)}/>
  </View>}
  {locked&&<View><Text accessibilityRole="alert">Outcome not confirmed. Retry the original command.</Text>{pending.current?.decision&&<Field label="Current password" value={password} secure onChange={setPassword} disabled={busy}/>}<Button title="Retry original request" disabled={busy||(pending.current?.decision===true&&!password)} onPress={()=>void run()}/></View>}
 </View>;
}
const styles=StyleSheet.create({card:{padding:14,borderRadius:14,borderWidth:1,borderColor:"#E2E8F0",backgroundColor:"#fff",gap:10},title:{fontSize:17,fontWeight:"700",color:"#0F172A"},label:{fontWeight:"600",color:"#334155"},button:{backgroundColor:"#F1F5F9",borderRadius:9,minHeight:44,alignItems:"center",justifyContent:"center",padding:8},muted:{fontSize:13,color:"#64748B"},item:{borderTopWidth:1,borderColor:"#E2E8F0",paddingTop:10,gap:8},input:{borderWidth:1,borderColor:"#CBD5E1",borderRadius:9,padding:10,minHeight:44,color:"#0F172A"}});
