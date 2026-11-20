import {useCallback,useEffect,useRef,useState} from "react";
import {ActivityIndicator,Alert,AppState,Pressable,ScrollView,StyleSheet,
 Text,TextInput,View} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import {File,Paths} from "expo-file-system";
import * as Crypto from "expo-crypto";
import {fetch as expoFetch} from "expo/fetch";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";
import {NativeLabEquipmentQualityUpload} from "./native-lab-equipment-quality-upload";

type Center={centerRef:string;name:string};
type Equipment={equipmentRef:string;centerRef:string;code:string;name:string;
 manufacturer:string;model:string;serialNumber:string;status:string;
 readiness:string;effectiveReadiness:string;calibrationDueOn:string|null;
 revision:number;fileRef:string|null};
type Event={eventRef:string;eventType:string;description:string;occurredAt:string;
 fileRef:string|null};
type Evidence={fileRef:string;documentKind:string;scannedAt:string};
type Detail={equipment:Equipment;events:Event[];files:Evidence[]};
type Attempt={route:string;body:Record<string,unknown>;success:string};
type Props={token:string;canManage:boolean;canUpload:boolean;
 onExit:()=>void;onExpired:()=>void};
const remote=process.env.EXPO_PUBLIC_API_URL;
const path=(route:string)=>{
 if(!remote||!/^https?:\/\//.test(remote)||
  (process.env.NODE_ENV==="production"&&!remote.startsWith("https://")))
  throw Error("The private laboratory service is unavailable.");
 return new URL("/api/v1/diagnostics/equipment/"+route,remote).toString();
};
function reason(status:number){return status===401?
 "Your session expired. Sign in again.":
 status===403?"You are no longer authorized at this lab.":
 status===404?"The original equipment record is unavailable.":
 status===409?"This equipment record has changed. Refresh before acting.":
 status===400?"Check the equipment, verified evidence and calibration date.":
 "The action outcome is uncertain. Verify the original record before retrying.";}
async function api<T>(token:string,route:string,
 method:"GET"|"POST"="GET",body?:object):Promise<T>{
 const res=await identityRequest("/api/v1/diagnostics/equipment/"+route,{
  method,cache:"no-store",headers:{Authorization:"Bearer "+token,
   ...(body?{"Content-Type":"application/json"}:{})},
  body:body?JSON.stringify(body):undefined});
 if(!res.ok)throw Object.assign(new Error(reason(res.status)),{status:res.status});
 return res.json() as Promise<T>;
}
const label=(e:Equipment)=>e.status==="RETIRED"?"Retired":
 e.effectiveReadiness==="READY"?"Ready — evidence verified":
 e.effectiveReadiness==="CALIBRATION_DUE"?"Calibration due — NOT READY":
 e.effectiveReadiness==="OUT_OF_SERVICE"?"Out of service":"Not ready";
export function NativeLabEquipmentScreen({token,canManage,canUpload,
 onExit,onExpired}:Props){
 const [centers,setCenters]=useState<Center[]>([]),[center,setCenter]=useState("");
 const [items,setItems]=useState<Equipment[]>([]),[detail,setDetail]=useState<Detail|null>(null);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [message,setMessage]=useState(""),[uncertain,setUncertain]=useState(false);
 const [code,setCode]=useState(""),[name,setName]=useState("");
 const [manufacturer,setManufacturer]=useState(""),[model,setModel]=useState("");
 const [serial,setSerial]=useState(""),[note,setNote]=useState(""),[due,setDue]=useState("");
 const [proof,setProof]=useState(""),[action,setAction]=useState<
  "MAINTENANCE"|"MARK_OUT_OF_SERVICE"|"RETIRED">("MAINTENANCE");
 const previous=useRef<Attempt|null>(null),seq=useRef(0),file=useRef<File|null>(null);
 function cleanup(){try{file.current?.delete()}catch{/* OS preview may hold it */}
  file.current=null;}
 const onError=useCallback((e:unknown)=>{
  if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
  setMessage(e instanceof Error?e.message:"Original lab equipment cannot be verified.");
 },[onExpired]);
 const load=useCallback(async(c:string)=>{
  if(!c)return;
  const id=++seq.current;
  const result=await api<{items:Equipment[]}>(token,"centers/"+c+"/items");
  if(id!==seq.current)return;
  if(!Array.isArray(result.items)||result.items.length>100)
   throw Error("Current instrument list is unavailable.");
  setItems(result.items);setDetail(null);
 },[token]);
 const inspect=useCallback(async(c:string,ref:string)=>{
  const id=++seq.current;
  const result=await api<Detail>(token,"centers/"+c+"/items/"+ref+"/history");
  if(id!==seq.current)return;
  if(!result||!Array.isArray(result.files)||!Array.isArray(result.events)||
    result.files.length>30||result.events.length>40)
   throw Error("Current private quality history cannot be verified.");
  setDetail(result);
 },[token]);
 useEffect(()=>{
  let active=true;
  setLoading(true);
  void api<{centers:Center[]}>(token,"centers/eligible").then(v=>{
   if(!active)return;
   if(!Array.isArray(v.centers)||v.centers.length>30)
    throw Error("Assigned laboratory list cannot be verified.");
   setCenters(v.centers);
   if(v.centers.length===1)setCenter(v.centers[0].centerRef);
  }).catch(e=>{if(active)onError(e)}).finally(()=>{if(active)setLoading(false)});
  return()=>{active=false;++seq.current;cleanup()};
 },[token,onError]);
 useEffect(()=>{
  ++seq.current;setDetail(null);setItems([]);setProof("");
  setUncertain(false);previous.current=null;setMessage("");
  if(!center)return;
  setLoading(true);void load(center).catch(onError).finally(()=>setLoading(false));
 },[center,load,onError]);
 useEffect(()=>{
  let switched=false;
  const sub=AppState.addEventListener("change",value=>{
   if(value!=="active")switched=true;
   else if(switched){switched=false;cleanup();}
  });
  return()=>{sub.remove();cleanup()};
 },[]);
 const btn=(name:string,fn:()=>void,disabled=false,selected=false)=>
  <Pressable accessibilityRole="button"
   accessibilityState={{disabled,selected}} disabled={disabled}
   style={[s.button,selected&&s.selected,disabled&&s.disabled]} onPress={fn}>
   <Text style={s.buttonText}>{name}</Text>
  </Pressable>;
 const input=(title:string,value:string,change:(v:string)=>void,max=160)=>
  <View style={s.field}><Text style={s.label}>{title}</Text>
   <TextInput accessibilityLabel={title} value={value} onChangeText={change}
    placeholderTextColor={t.mutedText} maxLength={max} style={s.input}
    editable={!busy&&!uncertain}/></View>;
 async function send(what:Attempt,retry=false){
  if(busy||(!retry&&uncertain))return;
  setBusy(true);setMessage("");
  try{
   const out=await api<{equipmentRef:string;revision:number}>(
    token,what.route,"POST",what.body);
   previous.current=null;setUncertain(false);
   setMessage(what.success);
   if(what.route.endsWith("/items")){
    setCode("");setName("");setManufacturer("");setModel("");setSerial("");
   }else{setNote("");setProof("");setDue("");}
   try{await load(center);await inspect(center,out.equipmentRef)}
   catch{setMessage(what.success+" Current list could not be refreshed.");}
  }catch(e){
   const status=e&&typeof e==="object"&&"status" in e&&
    typeof e.status==="number"?e.status:503;
   setUncertain(status>=500);previous.current=status>=500?what:null;
   onError(e);
  }finally{setBusy(false);}
 }
 function create(){
  if(!canManage||!center||!code.trim()||name.trim().length<2)return;
  const attempt={route:"centers/"+center+"/items",
   body:{requestKey:Crypto.randomUUID(),code:code.trim().toUpperCase(),
    name:name.trim(),manufacturer:manufacturer.trim(),model:model.trim(),
    serialNumber:serial.trim()},
   success:"Instrument registered as NOT READY. No stock or patient transaction."};
  previous.current=attempt;void send(attempt);
 }
 function update(){
  if(!canManage||!center||!detail||note.trim().length<2||
   (action==="MAINTENANCE"&&(!due||!proof)))return;
  const what={route:"centers/"+center+"/items/"+
    detail.equipment.equipmentRef+"/maintenance",
   body:{requestKey:Crypto.randomUUID(),
    expectedVersion:detail.equipment.revision,action,note:note.trim(),
    ...(action==="MAINTENANCE"?{calibrationDueOn:due,evidenceFileRef:proof}:{})},
   success:action==="MAINTENANCE"?
    "Verified original service recorded. Check current readiness.":
    "Equipment state and immutable service history recorded."};
  Alert.alert("Confirm equipment action",action==="MAINTENANCE"?
   "Only verified CG19 service evidence may mark an instrument ready.":
   action==="RETIRED"?"Retire this instrument?":"Mark instrument out of service?",[
    {text:"Cancel",style:"cancel"},
    {text:"Record action",onPress:()=>{previous.current=what;void send(what)}}
   ]);
 }
 async function read(equipment:string,document:string){
  setBusy(true);setMessage("");cleanup();
  try{
   const result=await expoFetch(path("centers/"+center+"/items/"+equipment+
    "/evidence/files/"+document),{method:"GET",cache:"no-store",
    headers:{Authorization:"Bearer "+token},signal:AbortSignal.timeout(20000)});
   if(!result.ok){
    if(result.status===401)onExpired();
    throw Error(reason(result.status));
   }
   if(result.headers.get("content-type")?.split(";")[0]!=="application/pdf")
    throw Error("Original private document format was not verified.");
   const bytes=await result.bytes();
   if(bytes.length<5||bytes.length>10485760||
    String.fromCharCode(...bytes.subarray(0,4))!=="%PDF")
    throw Error("The quality PDF did not pass private file checks.");
   const pdf=new File(Paths.cache,"careganga-quality-"+Crypto.randomUUID()+".pdf");
   pdf.create();await pdf.write(bytes);file.current=pdf;
   if(!await File.canPreview(pdf,{mimeType:"application/pdf"}))
    throw Error("No compatible PDF viewer is available on this device.");
   await File.preview(pdf,{title:"Private laboratory equipment quality",mimeType:"application/pdf"});
   setMessage("Private quality PDF handed to the device viewer. Do not share externally.");
  }catch(e){onError(e);}
  finally{setBusy(false);}
 }
 return <SafeAreaView style={s.page} edges={["left","right"]}>
  <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
   {btn("Back to Foundation home",onExit,busy||uncertain)}
   <Text accessibilityRole="header" style={s.title}>Lab Equipment & Quality</Text>
   <Text style={s.note}>Only instruments for your approved Laboratory ERP center.
    Readiness requires a scanned service document and valid calibration date.
    No patient record, CG12 stock or accreditation is implied.</Text>
   {!!message&&<Text accessibilityRole="alert" style={s.warning}>{message}</Text>}
   {loading&&<ActivityIndicator accessibilityLabel="Checking laboratory equipment"/>}
   {!loading&&centers.length===0&&<Text style={s.note}>
    No currently eligible diagnostic laboratory is assigned to your role.</Text>}
   {centers.map(c=><View key={c.centerRef}>{btn(c.name,()=>setCenter(c.centerRef),
    busy||uncertain,center===c.centerRef)}</View>)}
   {uncertain&&<View style={s.panel}>
    <Text style={s.warning}>Last action may have succeeded. Never create another
     maintenance event until the original outcome is checked.</Text>
    {btn("Retry exactly the original request",()=>{
     if(previous.current)void send(previous.current,true);
    },busy||!previous.current)}
    {btn("Refresh original equipment",()=>void load(center).catch(onError),busy)}
   </View>}
   {!!center&&<View style={s.panel}>
    <Text style={s.heading}>Current laboratory instruments</Text>
    {btn("Refresh equipment",()=>void load(center).catch(onError),busy||uncertain)}
    {items.length===0&&!loading&&<Text style={s.note}>No registered instruments.</Text>}
    {items.map(v=><View key={v.equipmentRef} style={s.item}>
     <Text style={s.heading}>{v.name} · {v.code}</Text>
     <Text style={s.note}>{label(v)} · Calibration through: {
      v.calibrationDueOn??"Not recorded"}</Text>
     {btn("View instrument and history",()=>void inspect(center,v.equipmentRef)
      .catch(onError),busy||uncertain)}
    </View>)}
   </View>}
   {canManage&&!!center&&!uncertain&&<View style={s.panel}>
    <Text style={s.heading}>Register instrument</Text>
    {input("Equipment code",code,setCode,32)}
    {input("Equipment name",name,setName)}
    {input("Manufacturer (optional)",manufacturer,setManufacturer,120)}
    {input("Model (optional)",model,setModel,120)}
    {input("Serial number (optional)",serial,setSerial,120)}
    {btn("Register as not ready",create,busy||!code.trim()||name.trim().length<2)}
   </View>}
   {detail&&detail.equipment.centerRef===center&&<View style={s.panel}>
    {btn("Close equipment details",()=>setDetail(null),busy)}
    <Text style={s.heading}>{detail.equipment.name} · {detail.equipment.code}</Text>
    <Text style={s.note}>Current readiness: {label(detail.equipment)}.
     Service dates are source-owned, not a verified NABL badge.</Text>
    <Text style={s.heading}>Audited maintenance history</Text>
    {detail.events.map(event=><Text key={event.eventRef} style={s.note}>
     {event.eventType.replaceAll("_"," ")} ·
     {new Date(event.occurredAt).toLocaleDateString("en-IN")} ·
     {event.description}</Text>)}
    <Text style={s.heading}>Private verified quality PDFs</Text>
    {detail.files.length===0&&<Text style={s.note}>No scanner-verified PDF.</Text>}
    {detail.files.map(v=><View key={v.fileRef} style={s.item}>
     <Text style={s.note}>{v.documentKind.replaceAll("_"," ")} ·
      {new Date(v.scannedAt).toLocaleDateString("en-IN")}</Text>
     {btn("Read protected original PDF",()=>void read(detail.equipment.equipmentRef,
      v.fileRef),busy)}
     {canManage&&btn(proof===v.fileRef?"Selected as service proof":"Use as service proof",
      ()=>setProof(v.fileRef),busy||uncertain,proof===v.fileRef)}
    </View>)}
    {canUpload&&detail.equipment.status==="ACTIVE"&&
     <NativeLabEquipmentQualityUpload
      key={center+":"+detail.equipment.equipmentRef}
      token={token} centerRef={center} equipmentRef={detail.equipment.equipmentRef}
      onExpired={onExpired} onVerified={async()=>{
       await inspect(center,detail.equipment.equipmentRef);
      }}/>}
    {canManage&&detail.equipment.status==="ACTIVE"&&!uncertain&&<View style={s.item}>
     <Text style={s.heading}>Record verified maintenance / readiness</Text>
     {(["MAINTENANCE","MARK_OUT_OF_SERVICE","RETIRED"] as const).map(a=>
      <View key={a}>{btn(a.replaceAll("_"," "),()=>setAction(a),
       busy,action===a)}</View>)}
     {action==="MAINTENANCE"&&<>
      {input("Calibration through (YYYY-MM-DD)",due,setDue,10)}
      <Text style={s.note}>{proof?"Verified private PDF selected.":
       "Select a scanner-verified service PDF above."}</Text>
     </>}
     {input("Maintenance note",note,setNote,1000)}
     {btn("Save original maintenance event",update,
      busy||note.trim().length<2||(action==="MAINTENANCE"&&(!due||!proof)))}
    </View>}
   </View>}
  </ScrollView>
 </SafeAreaView>;
}
const s=StyleSheet.create({
 page:{flex:1,backgroundColor:t.adminCanvas},
 content:{padding:16,paddingBottom:110,gap:12},
 title:{fontSize:22,fontWeight:"700",color:t.text},
 heading:{fontSize:16,fontWeight:"700",color:t.text},
 note:{fontSize:13,lineHeight:20,color:t.mutedText},
 warning:{fontSize:13,lineHeight:20,color:t.error},
 panel:{padding:13,gap:10,backgroundColor:t.surface,borderColor:t.border,
  borderWidth:1,borderRadius:14},
 item:{padding:10,gap:8,borderWidth:1,borderRadius:10,borderColor:t.border},
 field:{gap:5},label:{fontSize:13,fontWeight:"600",color:t.text},
 input:{padding:12,minHeight:48,borderWidth:1,borderRadius:10,
  borderColor:t.border,color:t.text},
 button:{minHeight:48,borderRadius:10,padding:12,borderWidth:1,
  borderColor:t.border,justifyContent:"center"},
 buttonText:{fontSize:14,fontWeight:"600",color:t.text},
 selected:{borderColor:t.primary,backgroundColor:t.selectedSurface},
 disabled:{opacity:0.5}
});
