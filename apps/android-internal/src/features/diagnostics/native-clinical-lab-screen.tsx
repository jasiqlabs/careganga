import {useCallback,useEffect,useRef,useState} from "react";
import {ActivityIndicator,Alert,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import * as Crypto from "expo-crypto";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";
import {NativeLabResultEntry} from "./native-lab-result-entry";
import {NativeLabProfessionalReview} from "./native-lab-professional-review";
import {NativeLabReportRelease} from "./native-lab-report-release";

type Center={centerRef:string;name:string};
type Patient={patientRef:string;virtualPatientId:string;name:string;
 careSourceKind:"CENTER_INTAKE"|"CONSULTATION";careSourceRef:string};
type Offer={mappingRef:string;name:string;kind:string;currentPatientPriceMinor:string};
type Order={orderRef:string;displayOrderRef:string;status:string;
 quotedTotalMinor:string};
type Sample={sampleRef:string;label:string;sampleType:string;status:string;revision:number};
type Detail={order:Order;lines:{name:string;code:string;sampleType:string;
 quantity:number;quotedLineTotalMinor:string}[];samples:Sample[];
 report:{state:string}|null};
type Choice={mappingRef:string;quantity:number};
type Submission={requestKey:string;patientRef:string;
 careSource:{kind:Patient["careSourceKind"];ref:string};selections:Choice[]};
type Custody={centerRef:string;orderRef:string;sampleRef:string;action:string;
 requestKey:string;expectedVersion:number};
type Props={token:string;canView:boolean;canCreate:boolean;
 canManageSamples:boolean;canRecordResults:boolean;canReview:boolean;canRelease:boolean;onExit:()=>void;
 onExpired:()=>void};
async function api<T>(token:string,path:string,method:"GET"|"POST"="GET",body?:object){
 const response=await identityRequest("/api/v1/diagnostics/clinical/"+path,{
  method,cache:"no-store",headers:{Authorization:"Bearer "+token,
   ...(body?{"Content-Type":"application/json"}:{})},
  body:body?JSON.stringify(body):undefined
 });
 if(!response.ok)throw Object.assign(new Error(
  response.status===401?"Sign in again to access clinical laboratory records.":
  response.status===403?"You are not currently authorized for this laboratory or action.":
  response.status===409?"The original order or specimen changed. Review it before retrying.":
  response.status===404?"This clinical record is no longer available.":
  response.status===400?"Check the verified patient, test and clinical action.":
  "The clinical action cannot be confirmed. Check the original records before retrying."
 ),{status:response.status});
 return await response.json() as T;
}
const money=(n:string)=>/^\d{1,11}$/.test(n)?
 "₹"+(Number(n)/100).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2}):
 "Price unavailable";
const actionFor:Record<string,{id:string;label:string}>={
 PENDING_COLLECTION:{id:"collect",label:"Record collection"},
 COLLECTED:{id:"receive",label:"Mark received"},
 RECEIVED:{id:"start-processing",label:"Start processing"},
 REJECTED:{id:"recollect",label:"Create recollection label"}
};
export function NativeClinicalLabScreen({token,canView,canCreate,canManageSamples,
 canRecordResults,canReview,canRelease,onExit,onExpired}:Props){
 const [centers,setCenters]=useState<Center[]>([]),[center,setCenter]=useState("");
 const [patients,setPatients]=useState<Patient[]>([]),[offers,setOffers]=useState<Offer[]>([]);
 const [orders,setOrders]=useState<Order[]>([]),[selected,setSelected]=useState<Detail|null>(null);
 const [detailCenter,setDetailCenter]=useState("");
 const [chosenPatient,setChosenPatient]=useState(""),[chosenOffer,setChosenOffer]=useState("");
 const [cart,setCart]=useState<Choice[]>([]);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [uncertain,setUncertain]=useState(false),[custodyUncertain,setCustodyUncertain]=useState(false);
 const [message,setMessage]=useState("");
 const [showCorrection,setShowCorrection]=useState(false);
 const submission=useRef<Submission|null>(null),custody=useRef<Custody|null>(null);
 const epoch=useRef(0),detailEpoch=useRef(0);
 const [orderQuery,setOrderQuery]=useState("");
 const orderFilter=useRef({q:"",offset:0});
 const [nextOrderOffset,setNextOrderOffset]=useState<number|null>(null);
 const [detailLoading,setDetailLoading]=useState(false);
 const handleError=useCallback((e:unknown)=>{
  if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
  setMessage(e instanceof Error?e.message:"This clinical request cannot be verified.");
 },[onExpired]);
 const button=(label:string,action:()=>void,disabled=false)=>(
  <Pressable accessibilityRole="button" accessibilityState={{disabled}}
   disabled={disabled} style={[s.button,disabled&&s.disabled]} onPress={action}>
   <Text style={s.buttonText}>{label}</Text>
  </Pressable>);
 const load=useCallback(async(c:string)=>{
  if(!c)return;
  const now=++epoch.current;
  const [p,o,r]=await Promise.all([
   canCreate?api<{patients:Patient[]}>(token,"centers/"+c+"/patients/eligible"):
    Promise.resolve({patients:[]}),
   canCreate?api<{items:Offer[]}>(token,"centers/"+c+"/catalog/eligible"):
    Promise.resolve({items:[]}),
   canView?api<{orders:Order[];nextOffset:number|null}>(token,"centers/"+c+"/orders?"+new URLSearchParams({q:orderFilter.current.q,offset:String(orderFilter.current.offset)}).toString()):
    Promise.resolve({orders:[],nextOffset:null})
  ]);
  if(now!==epoch.current)return;
  setPatients(p.patients);setOffers(o.items);setOrders(r.orders);setNextOrderOffset(r.nextOffset??null);
 },[token,canCreate,canView]);
 useEffect(()=>{
  let active=true;
  void api<{centers:Center[]}>(token,"centers/eligible").then(data=>{
   if(!active)return;
   setCenters(data.centers);
   if(data.centers.length===1)setCenter(data.centers[0].centerRef);
  }).catch(e=>{if(active)handleError(e);}).finally(()=>{if(active)setLoading(false)});
  return()=>{active=false;++epoch.current;++detailEpoch.current;};
 },[token,handleError]);
 useEffect(()=>{
  const stamp=++epoch.current;
  ++detailEpoch.current;setDetailLoading(false);setOrderQuery("");setShowCorrection(false);orderFilter.current={q:"",offset:0};setNextOrderOffset(null);
  setSelected(null);setDetailCenter("");setPatients([]);setOffers([]);setOrders([]);
  setChosenPatient("");setChosenOffer("");setCart([]);
  submission.current=null;custody.current=null;setUncertain(false);
  setCustodyUncertain(false);
  if(!center)return;
  setLoading(true);setMessage("");
  void load(center).catch(e=>{if(stamp<=epoch.current)handleError(e)})
   .finally(()=>setLoading(false));
 },[center,load,handleError]);
 async function searchOrders(q:string,offset=0){
  if(!center||busy||loading||uncertain||custodyUncertain||detailLoading)return;
  orderFilter.current={q:q.trim(),offset};setOrders([]);setNextOrderOffset(null);setSelected(null);setDetailCenter("");++detailEpoch.current;
  setLoading(true);setMessage("");
  try{await load(center);}catch(e){handleError(e)}finally{setLoading(false);}
 }
 async function detail(id:string){
  const requestedCenter=center,stamp=++detailEpoch.current;
  setSelected(null);setDetailCenter("");setShowCorrection(false);setDetailLoading(true);
  try{
   const found=await api<Detail>(token,
    "centers/"+requestedCenter+"/orders/"+id);
   if(stamp!==detailEpoch.current)return;
   if(found?.order?.orderRef!==id)throw Error("The selected order is unavailable.");
   setDetailCenter(requestedCenter);setSelected(found);
  }catch(e){if(stamp===detailEpoch.current){setSelected(null);setDetailCenter("");handleError(e);}}
  finally{if(stamp===detailEpoch.current)setDetailLoading(false);}
 }
 async function create(retry=false){
  if(busy||!canCreate||(!retry&&uncertain)||!center)return;
  const patient=patients.find(p=>p.patientRef+"|"+p.careSourceRef===chosenPatient);
  if(!retry&&(!patient||cart.length===0||cart.some(c=>!offers.some(o=>o.mappingRef===c.mappingRef)))){
   setMessage("Choose one authorized patient and at least one approved test.");return;
  }
  if(!retry){
   submission.current={requestKey:Crypto.randomUUID(),patientRef:patient!.patientRef,
    careSource:{kind:patient!.careSourceKind,ref:patient!.careSourceRef},
    selections:cart};
  }
  if(!submission.current)return;
  setBusy(true);setMessage("");
  try{
   const out=await api<{displayOrderRef:string}>(token,
    "centers/"+center+"/orders","POST",submission.current);
   setUncertain(false);submission.current=null;setCart([]);setChosenPatient("");
   setChosenOffer("");
   setMessage("Original order "+out.displayOrderRef+
    " confirmed. Payment and medical report are not recorded.");
   try{await load(center);}catch{
    setMessage("Order confirmed but the latest list is unavailable. Refresh the order list.");
   }
  }catch(e){
   setUncertain(!(e&&typeof e==="object"&&"status" in e&&
    typeof e.status==="number"&&e.status<500));
   handleError(e);
  }finally{setBusy(false);}
 }
 async function custodyAction(sample:Sample,act:string,retry=false){
  if(!selected||!canManageSamples||!canView||busy||
    (!retry&&custodyUncertain)||!center)return;
  if(!retry)custody.current={centerRef:center,orderRef:selected.order.orderRef,
   sampleRef:sample.sampleRef,action:act,expectedVersion:sample.revision,
   requestKey:Crypto.randomUUID()};
  const x=custody.current;
  if(!x||x.centerRef!==center)return;
  setBusy(true);setMessage("");
  try{
   const response=await api<{replacementLabel?:string}>(token,
    "centers/"+x.centerRef+"/orders/"+x.orderRef+"/samples/"+x.sampleRef+
    "/"+x.action,"POST",{requestKey:x.requestKey,expectedVersion:x.expectedVersion});
   custody.current=null;setCustodyUncertain(false);
   setMessage(response.replacementLabel?
    "A replacement specimen label was created. Collect a new sample.":
    "Original specimen custody step recorded.");
   await detail(x.orderRef);
   try{await load(center);}catch{setMessage("Custody saved, but the order list could not be refreshed.");}
  }catch(e){
   setCustodyUncertain(!(e&&typeof e==="object"&&"status" in e&&
    typeof e.status==="number"&&e.status<500));
   handleError(e);
  }finally{setBusy(false);}
 }
 const ready=selected?.order.status==="PROCESSING"&&selected.samples.length>0&&
  selected.samples.every(item=>item.status==="PROCESSING");
 return <SafeAreaView style={s.page} edges={["left","right"]}>
  <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
   {button("Back to Foundation home",onExit,busy||uncertain||custodyUncertain)}
   <Text accessibilityRole="header" style={s.title}>Lab Orders & Samples</Text>
   <Text style={s.note}>Clinical orders belong to your currently authorized laboratory.
    Patient records remain private. A generated report still needs independent clinician approval and release.</Text>
   {!!message&&<Text accessibilityRole="alert" style={s.message}>{message}</Text>}
   {loading&&<ActivityIndicator accessibilityLabel="Checking assigned laboratory"/>}
   {!loading&&centers.length===0&&<Text style={s.note}>
    No approved Lab ERP laboratory is assigned to your current role.</Text>}
   {centers.map(c=>button(c.name,()=>setCenter(c.centerRef),
    busy||uncertain||custodyUncertain))}
   {!!center&&<View style={s.panel}>
    <Text style={s.heading}>Current laboratory</Text>
    <Text style={s.note}>{centers.find(c=>c.centerRef===center)?.name??"Checking laboratory"}</Text>
    {button("Refresh current orders",()=>void load(center).catch(handleError),busy||uncertain||custodyUncertain)}
   </View>}
   {uncertain&&<View style={s.panel}>
    <Text style={s.message}>Order creation outcome is uncertain. Do not start a new order.</Text>
    {button("Retry exact original order safely",()=>void create(true),busy||!submission.current)}
   </View>}
   {canCreate&&!!center&&!uncertain&&<View style={s.panel}>
    <Text style={s.heading}>Create internal lab order</Text>
    <Text style={s.note}>Select one currently consented patient and approved test.</Text>
    {patients.map(p=>button(p.name+" · "+p.virtualPatientId+
      (p.careSourceKind==="CENTER_INTAKE"?" · Center intake":" · Consultation"),
      ()=>setChosenPatient(p.patientRef+"|"+p.careSourceRef),busy))}
    {!!chosenPatient&&<Text style={s.note}>Patient selected: {
     patients.find(p=>p.patientRef+"|"+p.careSourceRef===chosenPatient)?.name??"Selection unavailable"}</Text>}
    {offers.filter(o=>!cart.some(c=>c.mappingRef===o.mappingRef)).map(o=>button(
     o.name+" · "+money(o.currentPatientPriceMinor),
     ()=>setChosenOffer(o.mappingRef),busy))}
    {!!chosenOffer&&button("Add selected test",()=>{
     if(!offers.some(o=>o.mappingRef===chosenOffer)||cart.some(c=>c.mappingRef===chosenOffer))return;
     setCart(v=>[...v,{mappingRef:chosenOffer,quantity:1}]);setChosenOffer("");
    },busy||cart.length>=10)}
    {cart.map(c=><View key={c.mappingRef} style={s.line}>
     <Text style={s.note}>{offers.find(o=>o.mappingRef===c.mappingRef)?.name??"Offer unavailable"}
      {" · Quantity "+c.quantity}</Text>
     <View style={s.row}>
      {button("−",()=>setCart(v=>v.map(a=>a.mappingRef===c.mappingRef?
       {...a,quantity:Math.max(1,a.quantity-1)}:a)),busy||c.quantity<=1)}
      {button("+",()=>setCart(v=>v.map(a=>a.mappingRef===c.mappingRef?
       {...a,quantity:Math.min(20,a.quantity+1)}:a)),busy||c.quantity>=20)}
      {button("Remove",()=>setCart(v=>v.filter(a=>a.mappingRef!==c.mappingRef)),busy)}
     </View>
    </View>)}
    {button("Create clinical lab order",()=>void create(),
     busy||!chosenPatient||cart.length===0)}
   </View>}
   {canView&&!!center&&<View style={s.panel}>
    <Text style={s.heading}>Clinical orders</Text>
    <TextInput accessibilityLabel="Find clinical orders" maxLength={80} value={orderQuery} onChangeText={setOrderQuery} placeholder="Order number or clinical status" style={[s.line,{color:t.text}]}/>
    {button("Search",()=>void searchOrders(orderQuery),busy||loading||uncertain||custodyUncertain||detailLoading)}
    {button("Reset",()=>{setOrderQuery("");void searchOrders("");},busy||loading||uncertain||custodyUncertain||detailLoading)}
    {detailLoading&&<ActivityIndicator accessibilityLabel="Checking order details"/>}
    {loading&&<ActivityIndicator accessibilityLabel="Checking clinical orders"/>}
    {!loading&&orders.length===0&&!message&&<Text style={s.note}>No matching clinical lab orders for this center.</Text>}
    {orders.map(o=>button(o.displayOrderRef+" · "+money(o.quotedTotalMinor)+
     " · "+o.status.replaceAll("_"," "),()=>void detail(o.orderRef),busy||loading||uncertain||custodyUncertain||detailLoading))}
    {button("Previous page",()=>void searchOrders(orderFilter.current.q,Math.max(0,orderFilter.current.offset-30)),busy||loading||uncertain||custodyUncertain||detailLoading||orderFilter.current.offset===0)}
    {button("Next page",()=>{if(nextOrderOffset!==null)void searchOrders(orderFilter.current.q,nextOrderOffset);},busy||loading||uncertain||custodyUncertain||detailLoading||nextOrderOffset===null)}
    <Text style={s.note}>Up to 30 authorized orders per page. Payment and report delivery are verified separately.</Text>
   </View>}
   {!!selected&&detailCenter===center&&canView&&<View style={s.panel}>
    {button("Close order details",()=>setSelected(null),busy||custodyUncertain)}
    <Text style={s.heading}>{selected.order.displayOrderRef}</Text>
    <Text style={s.note}>Clinical status: {selected.order.status.replaceAll("_"," ")}</Text>
    <Text style={s.note}>Accepted test total: {money(selected.order.quotedTotalMinor)}.
     This is not payment evidence.</Text>
    <Text style={s.heading}>1. Accepted tests</Text>
    {selected.lines.map((l,i)=><Text key={i} style={s.note}>
     {l.name} · Qty {l.quantity} · {money(l.quotedLineTotalMinor)}</Text>)}
    <Text style={s.heading}>2. Specimen collection &amp; custody</Text>
    {selected.samples.map(sample=><View key={sample.sampleRef} style={s.line}>
     <Text style={s.note}>{sample.label} · {sample.sampleType.replaceAll("_"," ")}
      · {sample.status.replaceAll("_"," ")}</Text>
     {canManageSamples&&actionFor[sample.status]&&button(
      actionFor[sample.status].label,()=>void custodyAction(sample,actionFor[sample.status].id),
      busy||custodyUncertain)}
     {canManageSamples&&["COLLECTED","RECEIVED","PROCESSING"].includes(sample.status)&&
      button("Reject specimen",()=>Alert.alert("Reject original specimen?",
       "This preserves the original history and requires a new collection.",[
        {text:"Cancel",style:"cancel"},
        {text:"Reject specimen",style:"destructive",onPress:()=>void custodyAction(sample,"reject")}
       ]),busy||custodyUncertain)}
    </View>)}
    {custodyUncertain&&<View style={s.line}>
     <Text style={s.message}>The custody action might already be recorded.</Text>
     {button("Retry same original custody step",()=>{
      const c=custody.current,sm=selected.samples.find(x=>x.sampleRef===c?.sampleRef);
      if(c&&sm)void custodyAction(sm,c.action,true);
     },busy||!custody.current)}
    </View>}
    <Text style={s.heading}>3. Result entry, review &amp; release</Text>
    {canRelease&&selected.report?.state==="RESULT_READY"&&
     <NativeLabReportRelease key={"release:"+center+":"+selected.order.orderRef}
      token={token} centerRef={center} orderRef={selected.order.orderRef}
      onExpired={onExpired}/>}
    {canReview&&selected.report?.state==="RESULT_READY"&&
     <NativeLabProfessionalReview key={center+":"+selected.order.orderRef}
      token={token} centerRef={center} orderRef={selected.order.orderRef}
      onExpired={onExpired}/>} 
    {selected.report?.state==="RESULT_READY"?
     <View style={s.panel}>
      <Text style={s.note}>The generated report requires clinician
       approval and release before patient access.</Text>
      {canRecordResults&&button(showCorrection?
       "Close report correction":"Correct previously released report",
       ()=>setShowCorrection(x=>!x))}
      {canRecordResults&&showCorrection&&
       <NativeLabResultEntry key={"correction:"+center+":"+selected.order.orderRef}
        token={token} centerRef={center} orderRef={selected.order.orderRef}
        onVerified={async()=>{setShowCorrection(false);
         await detail(selected.order.orderRef);}}
        onExpired={onExpired}/>}
     </View>:
     canRecordResults&&(
      ready||selected.order.status==="RESULT_READY"&&
       selected.report?.state==="DRAFT")?
     <NativeLabResultEntry key={"entry:"+center+":"+selected.order.orderRef}
      token={token} centerRef={center} orderRef={selected.order.orderRef}
      onVerified={async()=>{await detail(selected.order.orderRef)}}
      onExpired={onExpired}/>:null}
   </View>}
  </ScrollView>
 </SafeAreaView>;
}
const s=StyleSheet.create({
 page:{flex:1,backgroundColor:t.adminCanvas},
 content:{padding:16,paddingBottom:110,gap:12},
 title:{fontSize:22,fontWeight:"700",color:t.text},
 heading:{fontSize:16,fontWeight:"700",color:t.text},
 note:{fontSize:13,color:t.mutedText,lineHeight:19},
 message:{fontSize:13,color:t.error,lineHeight:20},
 panel:{backgroundColor:t.surface,borderColor:t.border,borderWidth:1,
  borderRadius:14,padding:13,gap:10},
 line:{borderColor:t.border,borderWidth:1,borderRadius:10,padding:10,gap:8},
 row:{flexDirection:"row",flexWrap:"wrap",gap:8},
 button:{padding:12,minHeight:48,borderRadius:10,borderWidth:1,
  borderColor:t.border,justifyContent:"center"},
 buttonText:{color:t.text,fontSize:14,fontWeight:"600"},
 disabled:{opacity:0.5}
});
