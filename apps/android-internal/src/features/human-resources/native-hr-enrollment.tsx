import React,{useCallback,useEffect,useState} from "react";
import * as Crypto from "expo-crypto";
import {ActivityIndicator,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {identityRequest} from "../identity-access/http-client";

type Application={applicationRef:string;reference:string;name:string;designation:string;
 employmentType:string;branchRef:string;departmentRef:string|null;
 hireDate:string;revision:number;status:string};
type Option={label:string;branchRef?:string;departmentRef?:string};
type Draft={name:string;designation:string;employmentType:string;
 branchRef:string;departmentRef:string;hireDate:string};
const blank=():Draft=>({name:"",designation:"",employmentType:"FULL_TIME",
 branchRef:"",departmentRef:"",hireDate:""});
const types=["FULL_TIME","PART_TIME","CONTRACT","VOLUNTEER_STAFF"] as const;
const title=(s:string)=>s.replaceAll("_"," ").toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
async function api(token:string,path:string,method="GET",body?:object){
 const response=await identityRequest("/api/hr/"+path,{method,cache:"no-store",
  headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},
  ...(body?{body:JSON.stringify(body)}:{})});
 if(!response.ok)throw Object.assign(new Error(
  response.status===401?"Your session has expired. Sign in again.":
  response.status===403?"Your current role or branch cannot perform this employee action.":
  response.status===409?"The employee application has changed. Refresh before saving.":
  "The employee result could not be confirmed. Refresh before retrying."
 ),{status:response.status});
 return response.json() as Promise<unknown>;
}
export function NativeHrEnrollment({token,canView,canManage,onExit,onExpired}:{
 token:string;canView:boolean;canManage:boolean;onExit:()=>void;onExpired:()=>void
}){
 const [apps,setApps]=useState<Application[]>([]);
 const [branches,setBranches]=useState<Option[]>([]);
 const [departments,setDepartments]=useState<Option[]>([]);
 const [selected,setSelected]=useState<Application|null>(null);
 const [draft,setDraft]=useState<Draft>(blank);
 const [key,setKey]=useState<string|null>(null);
 const [status,setStatus]=useState("");
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
 const [self,setSelf]=useState<{status:string;name?:string;designation?:string;
   branch?:string;employeeReference?:string;message?:string}|null>(null);
 const [next,setNext]=useState<number|null>(null);
 const failure=useCallback((e:unknown)=>{
  if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
  setError(e instanceof Error?e.message:"Unable to confirm employee records.");
 },[onExpired]);
 const load=useCallback(async(offset=0)=>{
  setLoading(true);setError("");
  try{
   const own=await api(token,"me");
   if(own&&typeof own==="object"&&"status" in own)
    setSelf(own as {status:string;name?:string;designation?:string;branch?:string;message?:string});
   if(canView){
    const [records,opts]=await Promise.all([
     api(token,"applications?offset="+offset),api(token,"branch-options")]);
    if(!records||typeof records!=="object"||!("items" in records)||
      !Array.isArray(records.items)||!opts||typeof opts!=="object"||
      !("items" in opts)||!Array.isArray(opts.items))
      throw Error("Foundation employee data could not be verified.");
    const items=records.items as Application[];
    if(offset===0)setApps(items);
    else setApps(old=>{
     const known=new Set(old.map(a=>a.applicationRef));
     return [...old,...items.filter(a=>!known.has(a.applicationRef))];
    });
    setBranches(opts.items as Option[]);
    setNext("hasMore" in records&&records.hasMore===true?offset+25:null);
   }
  }catch(e){
   // A network failure cannot be treated as a confirmed empty/last-known list.
   setApps([]);setBranches([]);setSelf(null);setNext(null);
   failure(e);
  }finally{setLoading(false);}
 },[token,canView,failure]);
 useEffect(()=>{void load(0);},[load]);
 useEffect(()=>{
  let active=true;
  setDepartments([]);
  if(!draft.branchRef||!canView)return;
  void api(token,"departments?branch="+encodeURIComponent(draft.branchRef))
   .then(res=>{
    if(active&&res&&typeof res==="object"&&"items" in res&&Array.isArray(res.items))
     setDepartments(res.items as Option[]);
   }).catch(e=>{if(active)failure(e);});
  return()=>{active=false;};
 },[token,canView,draft.branchRef,failure]);
 const change=(field:keyof Draft,value:string)=>{
  setDraft(old=>({...old,[field]:value,
   ...(field==="branchRef"?{departmentRef:""}:{})}));
  setKey(null);setStatus("");setError("");
 };
 const edit=(item:Application)=>{
  if(!canManage||!["DRAFT","RETURNED"].includes(item.status))return;
  setSelected(item);
  setDraft({name:item.name,designation:item.designation,employmentType:item.employmentType,
   branchRef:item.branchRef,departmentRef:item.departmentRef??"",hireDate:item.hireDate});
  setKey(null);setStatus("");setError("");
 };
 const reset=()=>{
  setSelected(null);setDraft(blank());setKey(null);
 };
 const save=async()=>{
  if(!canManage||saving)return;
  if(!draft.name.trim()||!draft.designation.trim()||
    !draft.branchRef||!draft.hireDate){
   setError("Enter the required employee details, active branch and joining date.");
   return;
  }
  const requestKey=key??Crypto.randomUUID();
  setKey(requestKey);setSaving(true);setError("");setStatus("");
  const body={requestKey,name:draft.name,designation:draft.designation,
   employmentType:draft.employmentType,branchRef:draft.branchRef,
   departmentRef:draft.departmentRef||null,hireDate:draft.hireDate,accountRef:null,
   ...(selected?{expectedRevision:selected.revision}:{})};
  try{
   await api(token,selected?"applications/"+selected.applicationRef:"applications",
    selected?"PATCH":"POST",body);
   reset();await load(0);
   setStatus("Draft saved. Employment remains unapproved.");
  }catch(e){failure(e);}
  finally{setSaving(false);}
 };
 const field=(label:string,value:string,onChange:(v:string)=>void,placeholder:string)=>(
  <View style={styles.field}>
   <Text style={styles.label}>{label}</Text>
   <TextInput accessibilityLabel={label} style={styles.input} value={value}
    onChangeText={onChange} placeholder={placeholder} placeholderTextColor="#94A3B8"
    autoCapitalize={label==="Joining date"?"none":"words"}/>
  </View>
 );
 return <ScrollView style={styles.page} keyboardShouldPersistTaps="handled"
  contentContainerStyle={styles.content}>
   <View style={styles.heading}>
    <Text style={styles.title}>Human Resources</Text>
    <Pressable accessibilityRole="button" onPress={onExit} style={styles.outline}>
     <Text style={styles.outlineText}>Back</Text></Pressable>
   </View>
   {loading&&<ActivityIndicator accessibilityLabel="Loading employee records"/>}
   {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
   {!!status&&<Text style={styles.success}>{status}</Text>}
   <View style={styles.card}>
    <Text style={styles.h2}>My employment</Text>
    {self?.status==="NOT_LINKED"?
      <Text style={styles.muted}>{self.message??"No approved employee profile linked."}</Text>:
      self?<View>
       <Text style={styles.label}>{self.name??"Employee"}</Text>
       <Text style={styles.muted}>{self.designation??""} · {self.branch??""}</Text>
       <Text style={styles.muted}>Current status: {title(self.status)}</Text>
      </View>:
      <Text style={styles.muted}>Profile unavailable until your session is verified.</Text>}
   </View>
   {canManage&&<View style={styles.card}>
    <Text style={styles.h2}>{selected?"Correct application draft":"Create employee draft"}</Text>
    <Text style={styles.muted}>Saving never activates an employee or grants system access.
     A separate Foundation approval is required.</Text>
    {field("Employee name",draft.name,v=>change("name",v),"Employee name")}
    {field("Designation",draft.designation,v=>change("designation",v),"Role or designation")}
    <Text style={styles.label}>Employment type</Text>
    <View style={styles.choices}>{types.map(v=><Pressable key={v}
      accessibilityRole="button" accessibilityState={{selected:draft.employmentType===v}}
      style={[styles.chip,draft.employmentType===v&&styles.selected]}
      onPress={()=>change("employmentType",v)}>
      <Text style={draft.employmentType===v?styles.selectedText:styles.chipText}>{title(v)}</Text>
     </Pressable>)}</View>
    <Text style={styles.label}>Active Foundation branch</Text>
    {branches.length===0?<Text style={styles.muted}>No eligible branches available.</Text>:
      <View style={styles.choices}>{branches.map(opt=><Pressable key={opt.branchRef}
       accessibilityRole="button" accessibilityState={{selected:draft.branchRef===opt.branchRef}}
       style={[styles.chip,draft.branchRef===opt.branchRef&&styles.selected]}
       onPress={()=>change("branchRef",opt.branchRef??"")}>
       <Text style={draft.branchRef===opt.branchRef?styles.selectedText:styles.chipText}>
        {opt.label}</Text></Pressable>)}</View>}
    {!!draft.branchRef&&<><Text style={styles.label}>Department (optional)</Text>
     <View style={styles.choices}><Pressable accessibilityRole="button"
       style={[styles.chip,!draft.departmentRef&&styles.selected]}
       onPress={()=>change("departmentRef","")}>
       <Text style={!draft.departmentRef?styles.selectedText:styles.chipText}>Not assigned</Text>
      </Pressable>
      {departments.map(opt=><Pressable key={opt.departmentRef}
       accessibilityRole="button" style={[styles.chip,draft.departmentRef===opt.departmentRef&&styles.selected]}
       onPress={()=>change("departmentRef",opt.departmentRef??"")}>
       <Text style={draft.departmentRef===opt.departmentRef?styles.selectedText:styles.chipText}>
        {opt.label}</Text>
       </Pressable>)}</View></>}
    {field("Joining date",draft.hireDate,v=>change("hireDate",v),"YYYY-MM-DD")}
    <Pressable accessibilityRole="button" disabled={saving}
     style={[styles.primary,saving&&{opacity:.5}]} onPress={()=>void save()}>
     <Text style={styles.primaryText}>{saving?"Saving…":selected?"Update draft":"Save draft"}</Text>
    </Pressable>
    {selected&&<Pressable accessibilityRole="button" onPress={reset} style={styles.outline}>
      <Text style={styles.outlineText}>Cancel edit</Text></Pressable>}
   </View>}
   {canView&&<View style={styles.card}>
    <View style={styles.heading}><Text style={styles.h2}>Employee applications</Text>
     <Pressable accessibilityRole="button" onPress={()=>void load(0)} style={styles.outline}>
      <Text style={styles.outlineText}>Refresh</Text>
     </Pressable></View>
    {apps.length===0?<Text style={styles.muted}>No applications in your permitted branches.</Text>:
     apps.map(item=><View key={item.applicationRef} style={styles.item}>
      <Text style={styles.label}>{item.name}</Text>
      <Text style={styles.muted}>{item.reference} · {item.designation}</Text>
      <Text style={styles.muted}>Status: {title(item.status)}</Text>
      {canManage&&["DRAFT","RETURNED"].includes(item.status)&&
       <Pressable accessibilityRole="button" onPress={()=>edit(item)} style={styles.outline}>
        <Text style={styles.outlineText}>Edit draft</Text></Pressable>}
     </View>)}
    {next!==null&&<Pressable accessibilityRole="button" style={styles.outline}
     onPress={()=>void load(next)}>
     <Text style={styles.outlineText}>Load more</Text></Pressable>}
   </View>}
  </ScrollView>;
}
const styles=StyleSheet.create({
 page:{flex:1,backgroundColor:"#F8FAFC"},
 content:{padding:17,paddingBottom:140,gap:15},
 heading:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",gap:8},
 title:{fontSize:22,fontWeight:"800",color:"#0F172A"},
 h2:{fontSize:17,fontWeight:"700",color:"#0F172A",marginBottom:7},
 muted:{color:"#64748B",lineHeight:20,fontSize:13,marginBottom:8},
 label:{fontWeight:"600",fontSize:13,color:"#334155",marginBottom:6},
 card:{backgroundColor:"#fff",padding:16,borderRadius:16,borderWidth:1,borderColor:"#E2E8F0",gap:7},
 field:{gap:3,marginVertical:5},
 input:{borderColor:"#CBD5E1",borderWidth:1,borderRadius:9,padding:12,
  fontSize:15,color:"#0F172A",backgroundColor:"#fff",minHeight:48},
 choices:{flexDirection:"row",flexWrap:"wrap",gap:8,marginBottom:8},
 chip:{paddingVertical:9,paddingHorizontal:12,borderRadius:9,borderWidth:1,
  borderColor:"#CBD5E1",backgroundColor:"#fff"},
 selected:{backgroundColor:"#0369A1",borderColor:"#0369A1"},
 chipText:{fontSize:13,color:"#334155"},selectedText:{fontSize:13,color:"#fff",fontWeight:"700"},
 primary:{padding:13,backgroundColor:"#087F8C",borderRadius:10,alignItems:"center",marginTop:8},
 primaryText:{color:"#fff",fontSize:14,fontWeight:"700"},
 outline:{paddingVertical:9,paddingHorizontal:12,backgroundColor:"#F1F5F9",
  borderRadius:9,alignSelf:"flex-start",marginTop:5},
 outlineText:{color:"#0F172A",fontWeight:"600",fontSize:13},
 item:{paddingVertical:12,borderTopWidth:1,borderColor:"#E2E8F0"},
 error:{backgroundColor:"#FEF2F2",padding:12,borderRadius:10,color:"#991B1B"},
 success:{backgroundColor:"#ECFDF5",padding:12,borderRadius:10,color:"#166534"}
});
