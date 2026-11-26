import {useCallback,useEffect,useRef,useState} from "react";
import {ActivityIndicator,BackHandler,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import * as Crypto from "expo-crypto";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";
import {NativeCenterConsultationSlip} from "./native-center-consultation-slip";
import {NativeClinicianVisitHistory} from "./native-clinician-visit-history";
import {NativeClinicianSharedPatientFiles} from "./native-clinician-shared-patient-files";
type Center={centerRef:string;centerName:string;timeZone:string};
type ClinicianAssignment={centerRef:string;doctorRef:string};
type Item={appointmentRef:string;bookingId:string;doctorRef:string;doctorName:string;patientName:string;
 consentGranted:boolean;startAt:string;endAt:string;bookingStatus:string;
 bookingVersion:number;visitRef:string|null;
 visitStatus:string|null;visitVersion:number|null;queueToken:string|null};
type Props={token:string;canCancel:boolean;canClinicalManage:boolean;
 onExit:()=>void;onExpired:()=>void};
type Summary={centerRef:string;day:string;total:number;confirmed:number;arrived:number;
 waiting:number;inConsultation:number;completed:number;noShow:number;cancelled:number};
type AuditEvent={revision:number;action:string;when:string;by:string;
 beforeStatus:string|null;afterStatus:string|null};
type AuditHistory={bookingId:string;events:AuditEvent[];next:number|null};
type VerifiedSlip={valid:boolean;bookingId?:string;patientName?:string;
 bookingStatus?:string;startAt?:string;timeZone?:string;canCheckIn?:boolean};
const dateAt=(offset:number,zone:string)=>{
 try{
  const parts=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{
   timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit"
  }).formatToParts(new Date()).map(x=>[x.type,x.value]));
  return new Date(Date.UTC(Number(parts.year),Number(parts.month)-1,
   Number(parts.day)+offset)).toISOString().slice(0,10);
 }catch{return "";}
};
async function request<T>(token:string,path:string,method="GET",body?:object):Promise<T>{
 const response=await identityRequest("/api/v1/appointments/queue/"+path,{
  method,cache:"no-store",
  headers:{Authorization:"Bearer "+token,
   ...(body?{"Content-Type":"application/json"}:{})},
  body:body?JSON.stringify(body):undefined
 });
 if(!response.ok){
  const raw:unknown=await response.json().catch(()=>null);
  const error=raw&&typeof raw==="object"&&"message" in raw&&
   typeof raw.message==="string"&&raw.message.length<=220?
   raw.message:response.status===401?"Session expired. Sign in again.":
   response.status===403?"Your current role cannot manage this center's queue.":
   response.status===409?"Visit status changed. Refresh this queue.":
   "The visit action cannot be confirmed.";
  throw Object.assign(new Error(error),{status:response.status});
 }
 return await response.json() as T;
}
export function NativeCenterVisitQueue({token,canCancel,canClinicalManage,onExit,onExpired}:Props){
 const [centers,setCenters]=useState<Center[]>([]);
 const [clinicianAssignments,setClinicianAssignments]=useState<ClinicianAssignment[]>([]);
 const [center,setCenter]=useState(""),[offset,setOffset]=useState(0);
 const [items,setItems]=useState<Item[]>([]);
 const [summary,setSummary]=useState<Summary|null>(null);
 const [cursor,setCursor]=useState(""),[nextCursor,setNextCursor]=useState<string|null>(null);
 const [previousCursors,setPreviousCursors]=useState<string[]>([]);
 const [doctorFilter,setDoctorFilter]=useState(""),[statusFilter,setStatusFilter]=useState("");
 const centerZone=centers.find(x=>x.centerRef===center)?.timeZone??"UTC";
 const [qrToken,setQrToken]=useState(""),[verifiedSlip,setVerifiedSlip]=useState<VerifiedSlip|null>(null);
 const [selectedSlip,setSelectedSlip]=useState<Item|null>(null);
 const [auditRef,setAuditRef]=useState("");
 const [audit,setAudit]=useState<AuditHistory|null>(null);
 const [auditBusy,setAuditBusy]=useState(false);
 const [auditError,setAuditError]=useState("");
 const auditSerial=useRef(0);
 const [cancelPending,setCancelPending]=useState<string|null>(null);
 const [expanded,setExpanded]=useState("");
 const [queueLoading,setQueueLoading]=useState(false);
 const cancelKeys=useRef<Map<string,string>>(new Map());
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [message,setMessage]=useState(""),[uncertain,setUncertain]=useState(false);
 const commands=useRef<Map<string,string>>(new Map()),seq=useRef(0),selectedCenter=useRef("");
 const fail=useCallback((e:unknown)=>{
  if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
  setMessage(e instanceof Error?e.message:"Protected queue is unavailable.");
 },[onExpired]);
 const load=useCallback(async(c:string,day:string,after="")=>{
  const stamp=++seq.current;
  if(!c){setItems([]);setSummary(null);setSelectedSlip(null);setQueueLoading(false);return;}
  if(!day){setItems([]);setSummary(null);setQueueLoading(false);setMessage("The center local date is unavailable.");return;}
  setSummary(null);setQueueLoading(true);setExpanded("");setSelectedSlip(null);setCancelPending(null);
  auditSerial.current++;setAuditRef("");setAudit(null);setAuditError("");setAuditBusy(false);
  try{
   const data=await request<{items:Item[];next:string|null}>(token,
    "my-centers/"+encodeURIComponent(c)+"?date="+encodeURIComponent(day)+
     (after?"&after="+encodeURIComponent(after):""));
   if(stamp!==seq.current||selectedCenter.current!==c)return;
   setItems(data.items);setSelectedSlip(null);setCancelPending(null);
   auditSerial.current++;setAuditRef("");setAudit(null);setAuditError("");
   setAuditBusy(false);
   setCursor(after);setNextCursor(data.next);setUncertain(false);
   void request<Summary>(token,
    "my-centers/"+encodeURIComponent(c)+"/summary?date="+encodeURIComponent(day))
    .then(report=>{
     if(stamp===seq.current&&selectedCenter.current===c&&
      report.centerRef===c&&report.day===day)setSummary(report);
    }).catch(()=>{if(stamp===seq.current)setSummary(null);});
  }catch(e){if(stamp===seq.current&&selectedCenter.current===c){setItems([]);setNextCursor(null);fail(e);}}
  finally{if(stamp===seq.current)setQueueLoading(false);}
 },[token,fail]);
 useEffect(()=>{
  let live=true;
  void request<{centers:Center[];clinicianAssignments:ClinicianAssignment[]}>(token,"my-centers")
   .then(data=>{
    if(!live)return;
    setCenters(data.centers);
    setClinicianAssignments((data.clinicianAssignments??[]).filter(x=>
     typeof x?.doctorRef==="string"&&typeof x?.centerRef==="string"));
    if(data.centers.length===1){selectedCenter.current=data.centers[0].centerRef;setCenter(data.centers[0].centerRef);}
   }).catch(e=>{if(live)fail(e);})
   .finally(()=>{if(live)setLoading(false);});
  return()=>{live=false;};
 },[token,fail]);
 useEffect(()=>{
  setCursor("");setNextCursor(null);setPreviousCursors([]);
  void load(center,dateAt(offset,centerZone));
  return()=>{seq.current++;};
 },[center,centerZone,offset,load]);
 useEffect(()=>{
  const back=BackHandler.addEventListener("hardwareBackPress",()=>{
   onExit();return true;
  });
  return()=>back.remove();
 },[onExit]);
 async function verifySlip(){
  if(busy||uncertain||!center||!/^CGV-[A-F0-9]{24}$/.test(qrToken))return;
  setBusy(true);setMessage("");setVerifiedSlip(null);
  try{
   const result=await request<VerifiedSlip>(token,
    "my-centers/"+encodeURIComponent(center)+"/verify-slip","POST",{token:qrToken});
   if(selectedCenter.current!==center)return;
   if(!result.valid){
    setMessage("This slip is not a current appointment at your assigned center.");
   }else{
    setVerifiedSlip(result);
    setMessage("The slip matches a real consultation at your own center. Check in from the current date queue.");
   }
  }catch(e){if(selectedCenter.current===center)fail(e);}
  finally{setBusy(false);}
 }
 async function change(item:Item,next:"CHECK_IN"|"WAITING"|"IN_CONSULTATION"|"COMPLETED"|"NO_SHOW"){
  if(busy||uncertain)return;
  const reference=center+":"+item.appointmentRef+":"+next+":"+
   (item.visitVersion??item.bookingVersion);
  if(!commands.current.has(reference))commands.current.set(reference,Crypto.randomUUID());
  setBusy(true);setMessage("");
  try{
   if(next==="CHECK_IN"||next==="NO_SHOW"){
    const path=next==="CHECK_IN"?"check-in":"no-show";
    const outcome=await request<Record<string,unknown>>(token,
     "my-centers/"+encodeURIComponent(center)+"/"+path,"POST",{
     requestKey:commands.current.get(reference),appointmentRef:item.appointmentRef,
     expectedVersion:item.bookingVersion
    });
    if(next==="NO_SHOW"&&outcome.bookingStatus!=="NO_SHOW")
     throw Error("The original missed-booking status could not be confirmed.");
   }else{
    if(!item.visitRef||!item.visitVersion)throw Error("Current visit could not be confirmed.");
    await request(token,"my-centers/"+encodeURIComponent(center)+"/visits/"+
     encodeURIComponent(item.visitRef)+"/transition","POST",{
      requestKey:commands.current.get(reference),
      expectedVersion:item.visitVersion,nextState:next
     });
   }
   commands.current.delete(reference);
   await load(center,dateAt(offset,centerZone),cursor);
   setMessage("Original visit status saved.");
  }catch(e){
   fail(e);
   const status=e&&typeof e==="object"&&"status" in e?e.status:null;
   setUncertain(!(typeof status==="number"&&status>=400&&status<500));
  }
  finally{setBusy(false);}
 }
 async function cancelBooking(item:Item){
  if(!canCancel||busy||uncertain||!center||
   cancelPending!==item.appointmentRef||
   item.bookingStatus!=="CONFIRMED"||item.visitRef)return;
  const activeCenter=center;
  const signature=activeCenter+":"+item.appointmentRef+":"+item.bookingVersion;
  let key=cancelKeys.current.get(signature);
  if(!key){key=Crypto.randomUUID();cancelKeys.current.set(signature,key);}
  setBusy(true);setMessage("");
  try{
   const response=await identityRequest(
    "/api/v1/appointments/consultations/staff/centers/"+
    encodeURIComponent(activeCenter)+"/bookings/"+
    encodeURIComponent(item.appointmentRef)+"/cancel",{
     method:"POST",cache:"no-store",
     headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},
     body:JSON.stringify({requestKey:key,expectedVersion:item.bookingVersion,
      reason:"CENTER_REQUEST"})
    });
   const raw:unknown=await response.json().catch(()=>null);
   if(!response.ok){
    const detail=raw&&typeof raw==="object"&&"message" in raw&&
     typeof raw.message==="string"&&raw.message.length<=220?
     raw.message:"The center cancellation was rejected. Refresh its booking.";
    throw Object.assign(new Error(detail),{status:response.status});
   }
   if(!raw||typeof raw!=="object"||!("bookingStatus" in raw)||
    raw.bookingStatus!=="CANCELLED")
    throw Error("Cancellation outcome uncertain. Check the original booking.");
   cancelKeys.current.delete(signature);
   await load(activeCenter,dateAt(offset,centerZone),cursor);
   setCancelPending(null);
   setMessage("The original consultation was cancelled at this assigned center.");
  }catch(e){
   fail(e);
   const status=e&&typeof e==="object"&&"status" in e?e.status:null;
   setUncertain(!(typeof status==="number"&&status>=400&&status<500));
  }finally{setBusy(false);}
 }
 async function loadAudit(item:Item,before?:number){
  if(!center||auditBusy)return;
  if(auditRef!==item.appointmentRef){setAudit(null);setAuditRef(item.appointmentRef);}
  const stamp=++auditSerial.current,centerAtRequest=center;
  setAuditBusy(true);setAuditError("");
  try{
   const data=await request<AuditHistory>(token,
    "my-centers/"+encodeURIComponent(centerAtRequest)+"/bookings/"+
    encodeURIComponent(item.appointmentRef)+"/history"+
    (before===undefined?"":"?before="+encodeURIComponent(String(before))));
   if(stamp!==auditSerial.current||selectedCenter.current!==centerAtRequest)return;
   setAudit(old=>before!==undefined&&old&&auditRef===item.appointmentRef?
    {...data,events:[...old.events,...data.events]}:data);
  }catch(e){
   if(stamp===auditSerial.current){fail(e);
    setAuditError(e instanceof Error?e.message:"Current booking history is unavailable.");}
  }finally{if(stamp===auditSerial.current)setAuditBusy(false);}
 }
 const doctorChoices=Array.from(new Map(items.map(x=>
  [x.doctorRef,{ref:x.doctorRef,name:x.doctorName}])).values())
  .sort((a,b)=>a.name.localeCompare(b.name));
 const statuses=[...new Set(items.map(x=>x.bookingStatus))].sort();
 const visible=items.filter(x=>(!doctorFilter||x.doctorRef===doctorFilter)&&
  (!statusFilter||x.bookingStatus===statusFilter));
 const filter=(label:string,current:string,value:string,choose:(x:string)=>void)=>(
  <Pressable accessibilityRole="button" accessibilityState={{
    selected:current===value,disabled:busy}} disabled={busy}
    onPress={()=>choose(value)} style={[styles.button,current===value&&styles.selected]}>
   <Text style={styles.buttonLabel}>{label}</Text>
  </Pressable>
 );
 const button=(name:string,onClick:()=>void,disabled=false,primary=false)=>(
  <Pressable accessibilityRole="button" onPress={onClick}
   disabled={disabled} accessibilityState={{disabled}}
   style={[styles.button,primary&&styles.primary,disabled&&styles.disabled]}>
   <Text style={[styles.buttonLabel,primary&&styles.primaryLabel]}>{name}</Text>
  </Pressable>);
 return <SafeAreaView style={styles.page} edges={["left","right"]}>
  <ScrollView contentContainerStyle={styles.content}>
   {button("Back to my Foundation account",onExit,busy)}
   <Text accessibilityRole="header" style={styles.pageTitle}>My Consultation Queue</Text>
   <Text style={styles.help}>Only current, assigned verified healthcare centers are shown.
    Use real booked appointments; no private clinical reports.</Text>
   {loading&&<ActivityIndicator accessibilityLabel="Checking assigned queue centers"/>}
   {!!message&&<Text accessibilityRole="alert" style={styles.error}>{message}</Text>}
   {uncertain&&<View style={styles.card}>
    <Text style={styles.error}>The last action may have been recorded. Refresh its
     original state before taking any further action.</Text>
    {button("Refresh original queue",()=>void load(center,dateAt(offset,centerZone)),busy)}
   </View>}
   <Text style={styles.help}>Assigned healthcare center</Text>
   <View style={styles.row}>{centers.map(c=>
    <Pressable key={c.centerRef} accessibilityRole="button"
     accessibilityState={{selected:center===c.centerRef,disabled:busy}}
      disabled={busy}
     style={[styles.button,center===c.centerRef&&styles.selected]}
     onPress={()=>{selectedCenter.current=c.centerRef;seq.current++;setOffset(0);setItems([]);setSummary(null);setSelectedSlip(null);setCursor("");setNextCursor(null);setPreviousCursors([]);
       setVerifiedSlip(null);setQrToken("");setDoctorFilter("");setStatusFilter("");
       setCancelPending(null);setCenter(c.centerRef);setUncertain(false);}}>
     <Text style={styles.buttonLabel}>{c.centerName}</Text>
    </Pressable>)}</View>
   {center&&<View style={styles.card}>
    <Text style={styles.title}>Verify my center's consultation QR</Text>
    <Text style={styles.help}>Enter the status-only QR code from the patient's
     actual slip. A different center's code cannot reveal their patient data.</Text>
    <TextInput accessibilityLabel="Original appointment QR status code"
     autoCapitalize="characters" maxLength={28} value={qrToken}
     onChangeText={value=>{setQrToken(value.toUpperCase());setVerifiedSlip(null);}}
     placeholder="CGV-XXXXXXXXXXXXXXXXXXXXXXXX" style={styles.input}/>
    {button("Verify only at this center",()=>void verifySlip(),
     busy||!/^CGV-[A-F0-9]{24}$/.test(qrToken))}
    {verifiedSlip?.valid&&<Text style={styles.help}>
     Booking {verifiedSlip.bookingId}, {verifiedSlip.patientName},
     {verifiedSlip.bookingStatus}. Select the source row below to check in.</Text>}
   </View>}
   <Text style={styles.help}>Consultation date: {dateAt(offset,centerZone)}</Text>
   {summary&&summary.centerRef===center&&summary.day===dateAt(offset,centerZone)&&
    <View style={styles.card} accessibilityLabel="Original complete-day consultation summary">
     <Text style={styles.title}>Daily consultations — {summary.day}</Text>
     <View style={styles.row}>{([["Total",summary.total],["Confirmed",summary.confirmed],["Checked in",summary.arrived],["Waiting",summary.waiting],["With doctor",summary.inConsultation],["Completed",summary.completed],["Missed",summary.noShow],["Cancelled",summary.cancelled]] as const).map(([label,value])=><View key={label} style={styles.metric}><Text style={styles.title}>{value}</Text><Text style={styles.help}>{label}</Text></View>)}</View>
     <Text style={styles.help}>These source totals include all same-day bookings,
      not just the visible 100 appointments on one page.</Text>
    </View>}
   <View style={styles.row}>
    {button("Previous day",()=>{seq.current++;setItems([]);setSummary(null);setCursor("");setNextCursor(null);setPreviousCursors([]);setVerifiedSlip(null);setQrToken("");setDoctorFilter("");setStatusFilter("");
     setSelectedSlip(null);setCancelPending(null);setOffset(n=>Math.max(-14,n-1));},busy||offset<=-14)}
    {button("Next day",()=>{seq.current++;setItems([]);setSummary(null);setCursor("");setNextCursor(null);setPreviousCursors([]);setVerifiedSlip(null);setQrToken("");setDoctorFilter("");setStatusFilter("");
     setSelectedSlip(null);setCancelPending(null);setOffset(n=>Math.min(30,n+1));},busy||offset>=30)}
   </View>
   {center&&items.length>0&&<>
    <Text style={styles.help}>Filter by doctor</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false}
     contentContainerStyle={styles.row}>
     {filter("All doctors",doctorFilter,"",setDoctorFilter)}
     {doctorChoices.map(d=><View key={d.ref}>
      {filter(d.name,doctorFilter,d.ref,setDoctorFilter)}</View>)}
    </ScrollView>
    <Text style={styles.help}>Filter by visit status</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false}
     contentContainerStyle={styles.row}>
     {filter("All statuses",statusFilter,"",setStatusFilter)}
     {statuses.map(state=><View key={state}>
      {filter(state.replaceAll("_"," "),statusFilter,state,setStatusFilter)}</View>)}
    </ScrollView>
   </>}
   {queueLoading&&<ActivityIndicator accessibilityLabel="Loading current queue"/>}
   {center&&items.length===0&&!loading&&!queueLoading&&!message&&
    <Text style={styles.help}>No consultations were returned for this date.</Text>}
   {center&&items.length>0&&visible.length===0&&
    <Text style={styles.help}>No consultations match these filters.</Text>}
   {!queueLoading&&visible.map(a=><View key={a.appointmentRef} style={styles.card}>
    <Text style={styles.title}>{a.patientName}</Text>
    <Text style={styles.help}>Doctor: {a.doctorName}</Text>
    <Text style={styles.help}>{a.bookingId} · {new Date(a.startAt).toLocaleString("en-IN",{timeZone:centerZone,dateStyle:"medium",timeStyle:"short"})}</Text>
    <Text style={styles.help}>Current state: {a.bookingStatus} · Queue: {a.queueToken??"Not checked in"}</Text>
    <View style={styles.row}>
     {a.consentGranted&&a.bookingStatus==="CONFIRMED"&&
      button("Check in",()=>void change(a,"CHECK_IN"),busy||uncertain||queueLoading,true)}
     {a.visitStatus==="ARRIVED"&&button("Move to waiting",()=>void change(a,"WAITING"),busy||uncertain||queueLoading,true)}
     {canClinicalManage&&clinicianAssignments.some(link=>link.centerRef===center&&link.doctorRef===a.doctorRef)&&a.visitStatus==="WAITING"&&button("Start consultation",()=>void change(a,"IN_CONSULTATION"),busy||uncertain||queueLoading,true)}
     {canClinicalManage&&clinicianAssignments.some(link=>link.centerRef===center&&link.doctorRef===a.doctorRef)&&a.visitStatus==="IN_CONSULTATION"&&button("Complete visit",()=>void change(a,"COMPLETED"),busy||uncertain||queueLoading,true)}
     {a.bookingStatus==="CONFIRMED"&&!a.visitRef&&
      Number.isFinite(Date.parse(a.endAt))&&Date.parse(a.endAt)<=Date.now()&&
      button("Mark missed appointment",()=>void change(a,"NO_SHOW"),busy||uncertain)}
    </View>
    <Pressable accessibilityRole="button" accessibilityState={{expanded:expanded===a.appointmentRef,disabled:busy||queueLoading}} disabled={busy||queueLoading} onPress={()=>{setExpanded(expanded===a.appointmentRef?"":a.appointmentRef);setCancelPending(null);setSelectedSlip(null);auditSerial.current++;setAuditRef("");setAudit(null);setAuditError("");setAuditBusy(false);}} style={styles.button}><Text style={styles.buttonLabel}>{expanded===a.appointmentRef?"Hide appointment details":"Appointment details & documents"}</Text></Pressable>
    {expanded===a.appointmentRef&&<>
     {a.consentGranted&&!["CANCELLED","NO_SHOW"].includes(a.bookingStatus)&&
      button("Consultation slip",()=>setSelectedSlip(a),busy||uncertain)}
   {selectedSlip?.appointmentRef===a.appointmentRef&&a.consentGranted&&items.some(row=>row.appointmentRef===a.appointmentRef&&row.consentGranted)&&<View style={styles.card}>
    {button("Close current consultation slip",()=>setSelectedSlip(null),busy)}
    <Text style={styles.title}>{selectedSlip.bookingId} — current private PDF</Text>
    <NativeCenterConsultationSlip key={selectedSlip.appointmentRef} token={token}
     bookingRef={selectedSlip.appointmentRef}
     bookingStatus={selectedSlip.bookingStatus} onExpired={onExpired}/>
   </View>}
    {button(auditRef===a.appointmentRef?"Hide booking history":"Original booking history",
     ()=>{if(auditRef===a.appointmentRef){
      auditSerial.current++;setAuditRef("");setAudit(null);setAuditError("");
     }else void loadAudit(a);},auditBusy)}
    {auditRef===a.appointmentRef&&<View style={styles.card}>
     {auditBusy&&!audit&&<ActivityIndicator accessibilityLabel="Checking actual booking history"/>}
     {!!auditError&&<Text accessibilityRole="alert" style={styles.error}>{auditError}</Text>}
     {audit?.events.length===0&&<Text style={styles.help}>No original booking events.</Text>}
     {audit?.events.map(event=><View key={event.revision} style={styles.card}>
      <Text style={styles.help}>{event.action.replaceAll("_"," ")}</Text>
      <Text style={styles.help}>{new Date(event.when).toLocaleString("en-IN")}
       · {event.by}</Text>
      <Text style={styles.help}>{event.beforeStatus??"New"}
       → {event.afterStatus??"Current state unavailable"}</Text>
     </View>)}
     {audit?.next&&button("Older original events",
      ()=>void loadAudit(a,audit.next??undefined),auditBusy)}
     <Text style={styles.help}>Only operational status events are shown.
      No private clinical documents or medical notes are included.</Text>
    </View>}
    {!a.consentGranted&&<Text style={styles.help}>Care consent withdrawn. New check-in and private documents are unavailable.</Text>}
     {a.consentGranted&&a.visitRef&&canClinicalManage&&
      clinicianAssignments.some(link=>link.centerRef===center&&link.doctorRef===a.doctorRef)&&
      <NativeClinicianVisitHistory key={center+":"+a.appointmentRef}
       token={token} centerRef={center} bookingRef={a.appointmentRef}
       onExpired={onExpired}/>}
     {a.consentGranted&&a.visitRef&&canClinicalManage&&
      clinicianAssignments.some(link=>link.centerRef===center&&link.doctorRef===a.doctorRef)&&
      <NativeClinicianSharedPatientFiles key={"file:"+center+":"+a.appointmentRef}
       token={token} centerRef={center} bookingRef={a.appointmentRef}
       onExpired={onExpired}/>}
    {canCancel&&a.bookingStatus==="CONFIRMED"&&!a.visitRef&&
     (cancelPending===a.appointmentRef?
      <View style={styles.card}>
       <Text style={styles.help}>Cancel this confirmed appointment at your assigned center? The audit history will remain.</Text>
       {button("Confirm center cancellation",()=>void cancelBooking(a),busy||uncertain)}
       {button("Keep appointment",()=>setCancelPending(null),busy)}
      </View>:
      button("Cancel center booking",()=>setCancelPending(a.appointmentRef),busy||uncertain))}

    </>}
   </View>)}
   {center&&items.length>0&&<View style={styles.card}>
    <Text style={styles.help}>Page {previousCursors.length+1}. Showing {items.length} consultations.</Text>
    <Text style={styles.help}>Filters apply to this page.</Text>
    <View style={styles.row}>
     {button("Previous 100",()=>{
      const prior=previousCursors.at(-1)??"";
      setPreviousCursors(p=>p.slice(0,-1));setDoctorFilter("");setStatusFilter("");
      void load(center,dateAt(offset,centerZone),prior);
     },busy||queueLoading||!previousCursors.length)}
     {button("Next 100",()=>{
      if(!nextCursor)return;
      setPreviousCursors(p=>[...p,cursor]);setDoctorFilter("");setStatusFilter("");
      void load(center,dateAt(offset,centerZone),nextCursor);
     },busy||queueLoading||!nextCursor)}
    </View>
   </View>}
  </ScrollView>
 </SafeAreaView>;
}
const styles=StyleSheet.create({
 page:{flex:1,backgroundColor:t.adminCanvas},
 content:{padding:18,paddingBottom:56,gap:14,width:"100%",maxWidth:760,alignSelf:"center"},
 pageTitle:{fontSize:23,fontWeight:"800",color:t.sidebar,marginBottom:4},
 title:{fontSize:17,fontWeight:"700",color:t.text},
 help:{fontSize:13,lineHeight:19,color:t.mutedText},
 error:{fontSize:13,color:t.error},
 row:{flexDirection:"row",flexWrap:"wrap",gap:8},
 card:{padding:16,borderColor:t.border,borderWidth:1,borderRadius:14,
  backgroundColor:t.surface,gap:10,
    shadowColor:t.sidebar,shadowOpacity:0.045,
    shadowOffset:{width:0,height:2},shadowRadius:8,elevation:1},
 input:{borderColor:t.border,borderWidth:1,borderRadius:10,padding:12,
  minHeight:48,color:t.text,backgroundColor:t.surface},
 button:{borderColor:t.border,borderWidth:1,borderRadius:10,minHeight:48,
  padding:12,justifyContent:"center"},
 selected:{borderColor:t.primary,backgroundColor:t.surface},
 primary:{backgroundColor:t.primary,borderColor:t.primary},primaryLabel:{color:t.primaryText},
 metric:{flexGrow:1,flexBasis:"21%",minWidth:70,padding:8,borderColor:t.border,borderWidth:1,borderRadius:8},
 buttonLabel:{color:t.text,fontSize:13,fontWeight:"600"},
 disabled:{opacity:0.4}
});
