import React,{useCallback,useEffect,useRef,useState} from "react";
import {ActivityIndicator,AppState,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {File,Paths} from "expo-file-system";
import * as Crypto from "expo-crypto";
import * as Sharing from "expo-sharing";
import type {CG04VolunteerReviewCase,CG04VolunteerReviewPage,CG04VolunteerReviewPolicy,CG04VolunteerRosterPage,CG04VolunteerRosterExport} from "@careganga/api-contracts";
import {identityRequest} from "../identity-access/http-client";
import {NativeVolunteerCardIssuer} from "./native-volunteer-card-issuer";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
type Decision="APPROVE"|"RETURN"|"REJECT";
type Pending={ref:string;body:{requestKey:string;expectedRevision:number;action:Decision;remarks:string};digest:string};
const statuses=["ALL","SUBMITTED","PENDING_OWNER","RETURNED","REJECTED","OWNER_COMPLETED"];
const windows=["ALL","FULL_TIME","PART_TIME","WEEKENDS","FLEXIBLE"];
const label=(v:string)=>v.replaceAll("_"," ").toLowerCase().replace(/\b[a-z]/g,c=>c.toUpperCase());
async function request<T>(token:string,path:string,body?:Record<string,unknown>):Promise<T>{
 const r=await identityRequest(path,{method:body?"POST":"GET",headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined});
 const v:unknown=await r.json().catch(()=>null);
 if(!r.ok||v===null)throw Object.assign(new Error(v&&typeof v==="object"&&typeof (v as {message?:unknown}).message==="string"?(v as {message:string}).message:
  r.status===401?"Sign in again.":r.status===403?"Your current volunteer permission is unavailable.":"Cannot verify this current volunteer record."),{status:r.status});
 return v as T;
}
export function NativeVolunteerStaff({token,canReview,canRoster,canExport,canConfigure,canIssueCards,onExpired}:{
 token:string;canReview:boolean;canRoster:boolean;canExport:boolean;canConfigure:boolean;canIssueCards:boolean;onExpired:()=>void
}){
 const [tab,setTab]=useState<"REVIEW"|"ROSTER">(canReview?"REVIEW":"ROSTER");
 const [policy,setPolicy]=useState<CG04VolunteerReviewPolicy|null>(null),[reviews,setReviews]=useState<CG04VolunteerReviewPage|null>(null);
 const [detail,setDetail]=useState<CG04VolunteerReviewCase|null>(null),[roster,setRoster]=useState<CG04VolunteerRosterPage|null>(null);
 const [status,setStatus]=useState("ALL"),[availability,setAvailability]=useState("ALL"),[q,setQ]=useState(""),[applied,setApplied]=useState(""),[offset,setOffset]=useState(0);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[message,setMessage]=useState("");
 const [action,setAction]=useState<Decision>("APPROVE"),[remarks,setRemarks]=useState(""),[password,setPassword]=useState(""),[configPassword,setConfigPassword]=useState("");
 const seq=useRef(0),details=useRef(0),active=useRef(true),pending=useRef<Pending|null>(null),tempFiles=useRef<File[]>([]);
 const scrub=()=>{
  seq.current++;details.current++;setDetail(null);setReviews(null);setRoster(null);setPolicy(null);
  setPassword("");setConfigPassword("");setRemarks("");setMessage("");
  for(const file of tempFiles.current)try{file.delete();}catch{}tempFiles.current=[];
 };
 const refresh=useCallback(async()=>{
  const id=++seq.current;setLoading(true);
  const path="?"+new URLSearchParams({status,q:applied,availability,offset:String(offset)});
  try{
   if(tab==="REVIEW"&&canReview){
    const [p,items]=await Promise.all([request<CG04VolunteerReviewPolicy>(token,"/api/v1/volunteers/reviews/policy"),
     request<CG04VolunteerReviewPage>(token,"/api/v1/volunteers/reviews"+path)]);
    if(id===seq.current&&active.current){setPolicy(p);setReviews(items);setDetail(null);setMessage("");}
   }else if(canRoster){
    const items=await request<CG04VolunteerRosterPage>(token,"/api/v1/volunteers/roster"+path);
    if(id===seq.current&&active.current){setRoster(items);setMessage("");}
   }
  }catch(e){
   if(id===seq.current){setMessage(e instanceof Error?e.message:"Volunteer records unavailable.");setReviews(null);setRoster(null);
    if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();}
  }finally{if(id===seq.current)setLoading(false);}
 },[token,tab,canReview,canRoster,status,availability,applied,offset,onExpired]);
 useEffect(()=>{void refresh();return()=>{seq.current++;};},[refresh]);
 useEffect(()=>{
  const sub=AppState.addEventListener("change",state=>{
   active.current=state==="active";
   if(state!=="active"){scrub();setLoading(true);}
   else void refresh();
  });
  return()=>{sub.remove();scrub();};
 },[refresh]);
 const run=async(work:()=>Promise<void>)=>{
  if(busy||!active.current)return;
  const at=seq.current;
  setBusy(true);setMessage("");
  try{await work();}catch(e){
   if(at===seq.current&&active.current){
    setMessage(e instanceof Error?e.message:"The original review result is uncertain. Refresh and check its status.");
    if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
   }
  }finally{setBusy(false);}
 };
 const open=async(ref:string)=>run(async()=>{
  const n=++details.current;
  const d=await request<CG04VolunteerReviewCase>(token,"/api/v1/volunteers/reviews/"+ref);
  if(n===details.current&&active.current)setDetail(d);
 });
 const configure=()=>void run(async()=>{
  if(!canConfigure||!configPassword)throw Error("Enter current password to configure original Foundation volunteer review.");
  const value=await request<CG04VolunteerReviewPolicy>(token,"/api/v1/volunteers/reviews/policy",{currentPassword:configPassword});
  setConfigPassword("");setPolicy(value);setMessage("Original independent volunteer review configured.");
 });
 const decide=()=>void run(async()=>{
  if(!detail||!detail.canDecide||detail.status!=="SUBMITTED")throw Error("An original submitted case and different reviewer are required.");
  if(action!=="APPROVE"&&remarks.trim().length<3)throw Error("Enter reason for returning or rejecting this application.");
  const digest=JSON.stringify([detail.caseRef,detail.revision,action,remarks.trim()]);
  if(!pending.current||pending.current.digest!==digest)pending.current={ref:detail.caseRef,digest,
   body:{requestKey:Crypto.randomUUID(),expectedRevision:detail.revision,action,remarks:remarks.trim()}};
  const p=pending.current;
  await request(token,"/api/v1/volunteers/reviews/"+p.ref+"/decide",{...p.body,currentPassword:password});
  pending.current=null;setPassword("");setRemarks("");setDetail(null);await refresh();
  setMessage("Independent volunteer decision recorded.");
 });
 const fileAction=(path:string,mimeHint?:string,exporting=false)=>void run(async()=>{
  // A protected proof or roster export must never open a share sheet after
  // a user backgrounds the app, changes scope or dismisses this staff view.
  const at=seq.current;
  const current=()=>active.current&&seq.current===at;
  const r=await identityRequest(path,{headers:{Authorization:"Bearer "+token}});
  if(!current())return;
  if(!r.ok){if(r.status===401)onExpired();throw Error("This protected Foundation file could not be verified.");}
  const mime=(r.headers.get("content-type")??"").split(";")[0].trim();
  if(exporting){
   if(mime!=="application/json")throw Error("Audited original export response is unavailable.");
   const v:CG04VolunteerRosterExport=await r.json();
   if(!current())return;
   if(typeof v.csv!=="string"||!Number.isSafeInteger(v.rows)||v.rows>500||v.rows<0)
    throw Error("Volunteer export failed its original scope check.");
   const dest=new File(Paths.cache,"careganga-approved-volunteers-"+Crypto.randomUUID()+".csv");
   try{
    if(!current())return;
    await dest.write(v.csv);tempFiles.current.push(dest);
    if(!current())return;
    const available=await Sharing.isAvailableAsync();
    if(!current())return;
    if(!available)throw Error("Sharing permitted original volunteers is unavailable on this device.");
    await Sharing.shareAsync(dest.uri,{mimeType:"text/csv",dialogTitle:"Approved Foundation volunteers"});
   }finally{try{dest.delete();}catch{}tempFiles.current=tempFiles.current.filter(x=>x.uri!==dest.uri);}
   if(current())setMessage(v.rows+" permitted approved volunteers exported.");
  }else{
   if(!["application/pdf","image/jpeg","image/png","image/webp"].includes(mime)||mimeHint&&mimeHint!==mime)
    throw Error("Original identity document type could not be confirmed.");
   const bytes=await r.arrayBuffer();
   if(!current())return;
   if(bytes.byteLength<1||bytes.byteLength>10485760)throw Error("Protected proof is invalid.");
   const suffix=mime==="application/pdf"?".pdf":mime==="image/png"?".png":mime==="image/webp"?".webp":".jpg";
   const dest=new File(Paths.cache,"careganga-review-proof-"+Crypto.randomUUID()+suffix);
   try{
    if(!current())return;
    await dest.write(new Uint8Array(bytes));tempFiles.current.push(dest);
    if(!current())return;
    const available=await Sharing.isAvailableAsync();
    if(!current())return;
    if(!available)throw Error("Private file viewing is not available on this device.");
    await Sharing.shareAsync(dest.uri,{mimeType:mime,dialogTitle:"Private volunteer identity proof"});
   }finally{try{dest.delete();}catch{}tempFiles.current=tempFiles.current.filter(x=>x.uri!==dest.uri);}
  }
 });
 const switchTo=(v:"REVIEW"|"ROSTER")=>{seq.current++;details.current++;setTab(v);setReviews(null);setRoster(null);setDetail(null);setStatus("ALL");setQ("");setApplied("");setAvailability("ALL");setOffset(0);setPassword("");setRemarks("");pending.current=null;};
 const choice=(text:string,fn:()=>void,selected=false,disabled=false)=><Pressable accessibilityRole="button" accessibilityState={{selected,disabled:disabled||busy}}
  onPress={fn} disabled={disabled||busy} style={[s.button,selected&&s.selected,(disabled||busy)&&{opacity:.5}]}>
  <Text style={[s.buttonText,selected&&s.selectedText]}>{text}</Text></Pressable>;
 return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
  <Text accessibilityRole="header" style={s.h1}>Volunteers</Text>
  <Text style={s.muted}>Original protected Foundation volunteer reviews and verified affiliation directory.</Text>
  <View style={s.row}>{canReview&&choice("Application review",()=>switchTo("REVIEW"),tab==="REVIEW")}
   {canRoster&&choice("Approved directory",()=>switchTo("ROSTER"),tab==="ROSTER")}</View>
  {loading&&<ActivityIndicator accessibilityLabel="Verifying protected volunteer records"/>}
  {!!message&&<Text accessibilityRole="alert">{message}</Text>}
  {tab==="REVIEW"&&canReview&&policy&&!policy.configured&&<View style={s.card}>
   <Text>Original independent volunteer review must be configured before applicant submission.</Text>
   {canConfigure&&<><TextInput accessibilityLabel="Foundation current password" secureTextEntry style={s.input} value={configPassword} onChangeText={setConfigPassword}/>
    {choice("Configure original approval",configure,false,!configPassword)}</>}
  </View>}
  <View style={s.card}>
   <TextInput accessibilityLabel="Search original volunteer number or name" value={q} onChangeText={setQ} style={s.input} placeholder="Search visible number or name"/>
   <Text>Review status</Text><View style={s.row}>{(tab==="REVIEW"?statuses:["ALL","ACTIVE","INACTIVE","SUSPENDED"]).map(v=>
    <View key={v}>{choice(label(v),()=>{setStatus(v);setOffset(0);},status===v)}</View>)}</View>
   <Text>Availability</Text><View style={s.row}>{windows.map(v=><View key={v}>{choice(label(v),()=>{setAvailability(v);setOffset(0);},availability===v)}</View>)}</View>
   <View style={s.row}>{choice("Apply search",()=>{setOffset(0);setApplied(q.trim());})}{choice("Refresh",()=>void refresh())}</View>
  </View>
  {tab==="REVIEW"&&canReview&&reviews&&<View style={s.card}>
   <Text style={s.h2}>Applications: {reviews.overview.total}</Text>
   <Text>Active volunteers: {reviews.overview.active} · Pending: {reviews.overview.pending} · Rejected: {reviews.overview.rejected}</Text>
   {!reviews.items.length&&<Text>No original volunteer cases match these filters.</Text>}
   {reviews.items.map(v=><View key={v.caseRef} style={s.item}>
    <Text style={s.h2}>{v.name}</Text><Text>{v.applicationNumber} · {v.reference}</Text>
    <Text>{label(v.status)} · {v.department} · {label(v.availability)}</Text>
    {choice("Review original application",()=>void open(v.caseRef))}
   </View>)}
   <View style={s.row}>{offset>0&&choice("Previous cases",()=>setOffset(x=>Math.max(0,x-25)))}
    {reviews.hasMore&&choice("More cases",()=>setOffset(x=>x+25))}</View>
  </View>}
  {tab==="REVIEW"&&detail&&<View style={s.card}>
   <Text style={s.h2}>{detail.applicationNumber} · {detail.reference}</Text>
   <Text>{label(detail.status)} · {detail.department}{detail.branch?" · "+detail.branch:""}</Text>
   <Text style={s.h2}>Submitted applicant details</Text>
   {["first_name","last_name","date_of_birth","contact_mobile","contact_email","address_text","city","pin_code","availability","skills","experience","referral_input"].map(key=>{
    const value=detail.source[key];
    return <Text key={key}>{label(key)}: {typeof value==="string"?value:Array.isArray(value)?value.join(", "):"Not supplied"}</Text>;
   })}
   <Text style={s.h2}>Original private proof</Text>
   {detail.files.map(v=><View key={v.fileRef} style={s.item}>
    <Text>{label(v.classification)}: {v.verified?"Verified":"Not verified"}</Text>
    {v.verified&&["SUBMITTED","PENDING_OWNER"].includes(detail.status)&&choice("Open original verified proof",()=>fileAction("/api/v1/volunteers/reviews/"+detail.caseRef+"/files/"+v.fileRef+"/download"))}
   </View>)}
   <Text style={s.h2}>Approval history</Text>{detail.timeline.map((v,i)=><Text key={i}>{label(v.action)} · {v.reviewer} · {new Date(v.occurredAt).toLocaleString("en-IN")}</Text>)}
   {detail.canDecide&&detail.status==="SUBMITTED"&&<View style={s.item}>
    <Text style={s.h2}>Independent protected decision</Text>
    <View style={s.row}>{(["APPROVE","RETURN","REJECT"] as const).map(v=><View key={v}>{choice(label(v),()=>{setAction(v);pending.current=null;},action===v)}</View>)}</View>
    <TextInput accessibilityLabel="Reviewer remarks" multiline style={[s.input,{minHeight:88}]} value={remarks} onChangeText={v=>{setRemarks(v);pending.current=null;}} placeholder="Reason for return or rejection"/>
    <TextInput accessibilityLabel="Current Foundation password for decision" secureTextEntry style={s.input} value={password} onChangeText={setPassword}/>
    <Text style={s.muted}>Approval is independent; volunteer activation remains with the verified applicant.</Text>
    {choice("Record independent decision",decide,false,password.length<8)}
   </View>}
  </View>}
  {tab==="ROSTER"&&canRoster&&roster&&<View style={s.card}>
   <Text style={s.h2}>Approved volunteers: {roster.overview.total}</Text><Text>Active: {roster.overview.active} · Inactive: {roster.overview.inactive} · Suspended: {roster.overview.suspended}</Text>
   {canExport&&choice("Export permitted roster",()=>fileAction("/api/v1/volunteers/roster/export?"+new URLSearchParams({q:applied,status,availability}).toString(),undefined,true))}
   {!roster.items.length&&<Text>No approved volunteers match these filters.</Text>}
   {roster.items.map(row=><View key={row.ref} style={s.item}>
    <Text style={s.h2}>{row.volunteerNumber} · {row.name}</Text>
    <Text>{row.department}{row.branch?" · "+row.branch:""} · {label(row.status)}</Text>
    <Text>{label(row.availability)} · {row.city}, {row.district} · Joined {row.joinedOn}</Text>
    <Text>{row.mobile}{row.email?" · "+row.email:""}</Text><Text>Skills: {row.skills.join(", ")||"None recorded"}</Text>
    {canIssueCards&&<NativeVolunteerCardIssuer key={row.ref} token={token} volunteerRef={row.ref} onExpired={onExpired}/> }
   </View>)}
   <View style={s.row}>{offset>0&&choice("Previous volunteers",()=>setOffset(x=>Math.max(0,x-25)))}
    {roster.hasMore&&choice("More volunteers",()=>setOffset(x=>x+25))}</View>
  </View>}
 </ScrollView>;
}
const s=StyleSheet.create({
 content:{padding:15,gap:12,paddingBottom:56,backgroundColor:t.adminCanvas},
 h1:{fontSize:23,fontWeight:"700",color:t.text},h2:{fontSize:16,fontWeight:"700",color:t.text},
 muted:{fontSize:13,color:t.mutedText},card:{borderRadius:12,borderWidth:1,borderColor:t.border,padding:13,gap:11,backgroundColor:t.surface},
 item:{gap:8,paddingVertical:11,borderTopWidth:1,borderColor:t.border},
 row:{flexDirection:"row",gap:8,flexWrap:"wrap"},input:{borderWidth:1,borderColor:t.border,borderRadius:8,padding:11,minHeight:44,color:t.text},
 button:{borderRadius:9,borderWidth:1,borderColor:t.border,padding:11,minHeight:44,justifyContent:"center"},
 buttonText:{fontWeight:"600",fontSize:13,color:t.text},selected:{backgroundColor:t.primary},selectedText:{color:t.primaryText}
});
