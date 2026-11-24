import {useCallback,useEffect,useRef,useState} from "react";
import {ActivityIndicator,Alert,Pressable,ScrollView,StyleSheet,Text,TextInput,View}
 from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import * as Crypto from "expo-crypto";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";
import {NativeDoctorEvidenceUploader} from "./native-doctor-evidence-uploader";
import {NativeDoctorCenterFees} from "./native-doctor-center-fees";
import {NativeClinicianAccountLinkReviewer} from "./native-clinician-account-link";
type Form={fullName:string;registrationJurisdiction:string;registrationNumber:string;
 qualifications:string[];specialties:string[];experienceYears:number;
 publicBio:string;portraitRightsStatus:"NONE"|"CONSENT_PENDING";
 professionalLicenseValidThrough:string|null};
type Row={doctorRef:string;name:string;status:string;version:number;
 specialties:string[]};
type Detail={doctorRef:string;status:string;version:number;doctor:Form};
type Props={token:string;onExit:()=>void;onExpired:()=>void;
 canManage:boolean;canVerify:boolean};
const empty=():Form=>({fullName:"",registrationJurisdiction:"",
 registrationNumber:"",qualifications:[],specialties:[],experienceYears:0,
 publicBio:"",portraitRightsStatus:"NONE",professionalLicenseValidThrough:null});
async function api<T>(token:string,path:string,method:"GET"|"POST"|"PATCH"="GET",
 body?:object){
 const response=await identityRequest("/api/v1/health-network/doctors"+path,{
  method,cache:"no-store",headers:{Authorization:"Bearer "+token,
   ...(body?{"Content-Type":"application/json"}:{})},
  ...(body?{body:JSON.stringify(body)}:{})});
 if(!response.ok)throw Object.assign(new Error(
  response.status===401?"Sign in again.":
  response.status===403?"Current role cannot manage this doctor.":
  response.status===409?"Original professional record changed; refresh before retrying.":
  "Original doctor source outcome could not be confirmed."
 ),{status:response.status});
 return response.json() as Promise<T>;
}
const title=(s:string)=>s.replaceAll("_"," ").toLowerCase()
 .replace(/\b\w/g,c=>c.toUpperCase());
export function NativeDoctorManagement({token,onExit,onExpired,canManage,
 canVerify}:Props){
 const [rows,setRows]=useState<Row[]>([]);
 const [search,setSearch]=useState(""),[statusFilter,setStatusFilter]=useState("");
 const applied=useRef({q:"",status:""}),listTurn=useRef(0),detailTurn=useRef(0);
 const [detailLoading,setDetailLoading]=useState(false);
 const [selected,setSelected]=useState<Detail|null>(null);
 const [form,setForm]=useState<Form>(empty);
 const [qualifications,setQualifications]=useState("");
 const [specialties,setSpecialties]=useState("");
 const [editing,setEditing]=useState<"none"|"create"|"update">("none");
 const [next,setNext]=useState<number|null>(null);
 const [proof,setProof]=useState("");
 const [password,setPassword]=useState("");
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [uncertain,setUncertain]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const command=useRef<{kind:string;key:string}|null>(null);
 const turn=useRef(0);
 const fail=useCallback((e:unknown)=>{
  if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
  if(!(e&&typeof e==="object"&&"status" in e&&
   typeof e.status==="number"&&e.status<500))setUncertain(true);
  setError(e instanceof Error?e.message:"Original doctor status is uncertain.");
 },[onExpired]);
 const list=useCallback(async(offset=0)=>{
  const request=++listTurn.current;
  const query=new URLSearchParams({offset:String(offset),q:applied.current.q,status:applied.current.status});
  const response=await api<{doctors:Row[];nextOffset:number|null}>(token,"?"+query.toString());
  if(request!==listTurn.current)return;
  if(!response||!Array.isArray(response.doctors))
   throw Error("Original verified doctor list unavailable.");
  if(offset===0)setRows(response.doctors);
  else setRows(old=>{
   const seen=new Set(old.map(x=>x.doctorRef));
   return [...old,...response.doctors.filter(x=>!seen.has(x.doctorRef))];
  });
  setNext(Number.isInteger(response.nextOffset)?response.nextOffset:null);
 },[token]);
 const show=useCallback(async(ref:string)=>{
  const request=++detailTurn.current;
  setSelected(null);setPassword("");setProof("");setDetailLoading(true);
  try{
   const response=await api<Detail>(token,"/"+encodeURIComponent(ref));
   if(!response?.doctor||response.doctorRef!==ref)
    throw Error("The doctor record is unavailable.");
   if(request===detailTurn.current){setSelected(response);setEditing("none");}
   return response;
  }finally{if(request===detailTurn.current)setDetailLoading(false);}
 },[token]);
 useEffect(()=>{
  const current=++turn.current;setLoading(true);
  void list().catch(e=>{if(current===turn.current)fail(e)})
   .finally(()=>{if(current===turn.current)setLoading(false)});
  return()=>{turn.current++;listTurn.current++;detailTurn.current++;};
 },[list,fail]);
 const button=(text:string,run:()=>void,disabled=false)=>
  <Pressable accessibilityRole="button" accessibilityState={{disabled}}
   disabled={disabled} onPress={run}
   style={[styles.button,disabled&&styles.disabled]}>
   <Text style={styles.text}>{text}</Text>
  </Pressable>;
 const field=(name:string,value:string,change:(s:string)=>void,max=180,
  secure=false)=><View style={styles.field}>
   <Text style={styles.note}>{name}</Text>
   <TextInput accessibilityLabel={name} style={styles.input} value={value}
    onChangeText={change} maxLength={max} secureTextEntry={secure}
    editable={!busy&&!uncertain}/>
  </View>;
 const set=<K extends keyof Form,>(k:K,v:Form[K])=>
  setForm(old=>({...old,[k]:v}));
 const key=(kind:string)=>{
  if(command.current?.kind!==kind)
   command.current={kind,key:Crypto.randomUUID()};
  return command.current.key;
 };
 async function write<T>(kind:string,path:string,method:"POST"|"PATCH",
  body:(id:string)=>object,success:(response:T)=>Promise<void>){
  if(busy||uncertain)return;
  setBusy(true);setError("");setNotice("");
  try{
   const result=await api<T>(token,path,method,body(key(kind)));
   command.current=null;setUncertain(false);
   await success(result);
  }catch(e){fail(e)}finally{setBusy(false)}
 }
 function openForm(original?:Detail){
  detailTurn.current++;setDetailLoading(false);
  command.current=null;setUncertain(false);
  setSelected(original??null);
  const v=original?.doctor??empty();
  setForm(v);setQualifications(v.qualifications.join(", "));
  setSpecialties(v.specialties.join(", "));
  setEditing(original?"update":"create");
 }
 const parse=(s:string)=>s.split(",").map(x=>x.trim()).filter(Boolean);
 async function save(){
  if(!canManage||editing==="none")return;
  const detail=selected,kind=editing;
  const path=kind==="update"&&detail?"/"+encodeURIComponent(detail.doctorRef):"";
  await write<{doctorRef:string}>("doctor:"+kind+path,path,
   kind==="update"?"PATCH":"POST",
   requestKey=>({requestKey,...(kind==="update"&&detail?
    {expectedVersion:detail.version}:{}),
    doctor:{...form,qualifications:parse(qualifications),
     specialties:parse(specialties)}}),
   async result=>{
    if(!result.doctorRef)throw Error("Original doctor draft not confirmed.");
    await list();await show(result.doctorRef);
    setNotice("Doctor draft recorded. Original license verification is separate.");
   });
 }
 async function submit(){
  if(!selected||!canManage||!proof||selected.status!=="PENDING")return;
  const ref=selected.doctorRef;
  await write("doctor-submit:"+ref,"/"+encodeURIComponent(ref)+"/submit","POST",
   requestKey=>({requestKey,expectedVersion:selected.version,proofFileRef:proof}),
   async()=>{
    await list();await show(ref);
    setNotice("Original licence submitted for independent Foundation review.");
   });
 }
 async function suspend(){
  if(!selected||!canVerify||selected.status!=="VERIFIED"||
   password.length<8)return;
  const ref=selected.doctorRef;
  await write("doctor-suspend:"+ref,"/"+encodeURIComponent(ref)+"/suspend","POST",
   requestKey=>({requestKey,expectedVersion:selected.version,
    currentPassword:password}),async()=>{
    await list();await show(ref);setPassword("");
    setNotice("Current professional suspended across its original centers.");
   });
 }
 function applySearch(q:string,status:string){
  applied.current={q:q.trim(),status};setRows([]);setNext(null);setLoading(true);setError("");
  void list().catch(fail).finally(()=>setLoading(false));
 }
 const selectedRef=selected?.doctorRef;
 const displayedTurn=detailTurn.current;
 return <SafeAreaView style={styles.page}>
  <ScrollView contentContainerStyle={styles.content}
   keyboardShouldPersistTaps="handled">
   <Text accessibilityRole="header" style={styles.title}>
    Doctors & professional registrations</Text>
   <Text style={styles.note}>One verified doctor identity can serve multiple
    independently approved centers. No public data is made from pending drafts.</Text>
   {button("Back to dashboard",onExit)}
   {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
   {!!notice&&<Text accessibilityRole="alert" style={styles.note}>{notice}</Text>}
   {uncertain&&<Text style={styles.error}>Outcome may have committed.
    Refresh original records before retrying another action.</Text>}
   {loading&&<ActivityIndicator accessibilityLabel="Loading doctor registrations"/>}
   {editing==="none"&&<View style={styles.panel}>
    {button("Refresh current doctor records",()=>{
     setUncertain(false);command.current=null;setLoading(true);
     void list().catch(fail).finally(()=>setLoading(false));
    },busy)}
    {canManage&&button("Register doctor",()=>openForm(),busy||uncertain||detailLoading)}
    <Text accessibilityRole="header" style={styles.heading}>Find a doctor</Text>
    {field("Name, registration number or specialty",search,setSearch,80)}
    <Text style={styles.note}>Verification status: {statusFilter?title(statusFilter):"All statuses"}</Text>
    <View style={styles.row}>{["","PENDING","VERIFIED","SUSPENDED"].map(v=><Pressable key={v||"all"} accessibilityRole="button" accessibilityState={{selected:v===statusFilter,disabled:busy||loading||uncertain}} disabled={busy||loading||uncertain} onPress={()=>setStatusFilter(v)} style={[styles.button,v===statusFilter&&styles.active]}><Text style={styles.text}>{v?title(v):"All"}</Text></Pressable>)}</View>
    <View style={styles.row}>{button("Search",()=>applySearch(search,statusFilter),loading||busy||uncertain)}{button("Reset",()=>{setSearch("");setStatusFilter("");applySearch("","");},loading||busy||uncertain)}</View>
    {!loading&&!rows.length&&!error&&<Text style={styles.note}>No matching doctor registrations.</Text>}
    {rows.map(x=><View key={x.doctorRef}>
     {button(x.name+" · "+title(x.status)+" · "+
      x.specialties.join(", "),()=>void show(x.doctorRef).catch(fail),busy||uncertain||detailLoading)}
    </View>)}
    {next!==null&&button("More verified doctor records",()=>{
     setLoading(true);void list(next).catch(fail).finally(()=>setLoading(false));
    },busy||loading||uncertain)}
   </View>}
   {editing!=="none"&&canManage&&<View style={styles.panel}>
    <Text style={styles.heading}>{editing==="create"?
     "New pending professional":"Correct pending doctor"}</Text>
    <Text accessibilityRole="header" style={styles.heading}>Professional identity</Text>
    {field("Doctor's full name",form.fullName,x=>set("fullName",x),180)}
    {field("Registration jurisdiction",form.registrationJurisdiction,
     x=>set("registrationJurisdiction",x),120)}
    {field("Registration number",form.registrationNumber,
     x=>set("registrationNumber",x),100)}
    <Text accessibilityRole="header" style={styles.heading}>Qualifications and experience</Text>
    {field("Qualifications (comma separated)",qualifications,
     setQualifications,400)}
    {field("Specialties (comma separated)",specialties,setSpecialties,400)}
    {field("Years of experience",String(form.experienceYears),x=>
     set("experienceYears",Number(x)||0),3)}
    {field("Public professional biography",form.publicBio,
     x=>set("publicBio",x),1500)}
    <Text accessibilityRole="header" style={styles.heading}>Licence and portrait permission</Text>
    {field("Current professional licence valid through (YYYY-MM-DD)",
     form.professionalLicenseValidThrough??"",
     x=>set("professionalLicenseValidThrough",x||null),10)}
    {button((form.portraitRightsStatus==="CONSENT_PENDING"?"✓ ":"")+
     "Portrait rights confirmation pending",()=>set("portraitRightsStatus",
      form.portraitRightsStatus==="NONE"?"CONSENT_PENDING":"NONE"),busy||uncertain)}
    {button("Save original pending doctor",()=>Alert.alert(
     "Save doctor draft?","The licence still needs independent verification.",[
      {text:"Cancel",style:"cancel"},{text:"Save",onPress:()=>void save()}
     ]),busy||uncertain)}
    {button("Cancel draft edits",()=>Alert.alert("Discard unsaved changes?","Your saved registration will not be changed.",[{text:"Keep editing",style:"cancel"},{text:"Discard",style:"destructive",onPress:()=>{setEditing("none");command.current=null;setSelected(null);}}]),busy||uncertain)}
   </View>}
   {detailLoading&&<ActivityIndicator accessibilityLabel="Loading doctor profile"/>}
   {selected&&editing==="none"&&<View style={styles.panel}>
    <Text style={styles.heading}>{selected.doctor.fullName}</Text>
    <Text style={styles.note}>Status: {title(selected.status)}</Text>
    <Text style={styles.note}>Registration jurisdiction: {
     selected.doctor.registrationJurisdiction}</Text>
    <Text style={styles.note}>Qualifications: {
     selected.doctor.qualifications.join(", ")}</Text>
    <Text style={styles.note}>Specialties: {
     selected.doctor.specialties.join(", ")}</Text>
    <Text style={styles.note}>Professional licence: {
     selected.doctor.professionalLicenseValidThrough??"Not recorded"}</Text>
    {selected.status==="PENDING"&&canManage&&<>
     {button("Edit pending doctor",()=>openForm(selected),busy||uncertain)}
     <NativeDoctorEvidenceUploader key={selectedRef+"-"+selected.version}
      token={token} doctorRef={selected.doctorRef} version={selected.version}
      classification="HEALTH_DOCTOR_LICENSE"
      onVerified={ref=>{if(displayedTurn===detailTurn.current)setProof(ref);}} onExpired={onExpired}/>
     {selected.doctor.portraitRightsStatus==="CONSENT_PENDING"&&
      <NativeDoctorEvidenceUploader key={selectedRef+"-portrait-"+selected.version}
       token={token} doctorRef={selected.doctorRef} version={selected.version}
       classification="HEALTH_DOCTOR_PORTRAIT"
       onVerified={()=>{}} onExpired={onExpired}/>}

     {button("Submit scanned licence for independent review",()=>Alert.alert(
      "Submit doctor verification case?",
      "Only verified private evidence is accepted. Publication is separate.",[
       {text:"Cancel",style:"cancel"},
       {text:"Submit",onPress:()=>void submit()}
      ]),busy||uncertain||!proof)}
    </>}
    {selected.status==="VERIFIED"&&canVerify&&
     <NativeClinicianAccountLinkReviewer token={token} doctorRef={selected.doctorRef}
      onExpired={onExpired}/>}
    {selected.status==="VERIFIED"&&<NativeDoctorCenterFees token={token}
     doctorRef={selected.doctorRef} canManage={canManage} canVerify={canVerify}
     onExpired={onExpired}/>}
    {selected.status==="VERIFIED"&&canVerify&&<>
     {field("Current Foundation password",password,setPassword,1024,true)}
     {button("Suspend verified professional",()=>Alert.alert(
      "Suspend doctor across centers?","Existing patient history remains immutable.",[
       {text:"Cancel",style:"cancel"},
       {text:"Suspend",style:"destructive",onPress:()=>void suspend()}
      ]),busy||uncertain||password.length<8)}
    </>}
   </View>}
  </ScrollView>
 </SafeAreaView>;
}
const styles=StyleSheet.create({
 page:{flex:1,backgroundColor:t.adminCanvas},
 content:{padding:15,paddingBottom:90,gap:12},
 title:{fontSize:21,fontWeight:"700",color:t.text},
 heading:{fontSize:16,fontWeight:"700",color:t.text},
 note:{fontSize:13,color:t.mutedText,lineHeight:19},
 text:{fontSize:13,fontWeight:"600",color:t.text},
 row:{flexDirection:"row",flexWrap:"wrap",gap:8},active:{borderColor:t.primary},
 field:{gap:5},panel:{backgroundColor:t.surface,borderWidth:1,
  borderColor:t.border,borderRadius:12,padding:12,gap:10},
 input:{backgroundColor:t.surface,borderColor:t.border,color:t.text,
  borderWidth:1,borderRadius:9,minHeight:45,padding:10},
 button:{borderColor:t.border,borderWidth:1,borderRadius:9,
  minHeight:45,padding:11,justifyContent:"center"},
 disabled:{opacity:.4},error:{color:"#A52626",fontSize:13}
});
