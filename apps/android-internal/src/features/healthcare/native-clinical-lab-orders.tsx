import {useCallback,useEffect,useRef,useState} from "react";
import {
 ActivityIndicator,BackHandler,Pressable,ScrollView,StyleSheet,Text,TextInput,View
} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import * as Crypto from "expo-crypto";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";

type Center={centerRef:string;name:string};
type Patient={patientRef:string;name:string;virtualPatientId:string;
 careSourceKind:"CENTER_INTAKE"|"CONSULTATION";careSourceRef:string};
type Item={mappingRef:string;name:string;code:string;kind:"TEST"|"PACKAGE";
 currentPatientPriceMinor:string;currency:"INR"};
type Selection={mappingRef:string;quantity:number};
type Order={orderRef:string;displayOrderRef:string;status:string;
 quotedTotalMinor:string;createdAt:string};
type Sample={sampleRef:string;label:string;sampleType:string;
 status:string;revision:number};
type Details={order:Order;lines:{name:string;code:string;quantity:number;
 quotedLineTotalMinor:string}[];samples:Sample[]};
type CustodyAction="collect"|"receive"|"start-processing"|"reject"|"recollect";
type OrderPayload={requestKey:string;patientRef:string;
 careSource:{kind:"CENTER_INTAKE"|"CONSULTATION";ref:string};
 selections:Selection[]};
type CustodyPayload={requestKey:string;expectedVersion:number};
type PendingCustody={center:string;order:string;sample:string;
 action:CustodyAction;payload:CustodyPayload};
const next:Partial<Record<string,{action:CustodyAction;label:string}>>={
 PENDING_COLLECTION:{action:"collect",label:"Record collection"},
 COLLECTED:{action:"receive",label:"Record receipt"},
 RECEIVED:{action:"start-processing",label:"Start processing"},
 REJECTED:{action:"recollect",label:"Request recollection"}
};
const money=(v:string)=>/^\d{1,11}$/.test(v)?
 "₹"+(Number(v)/100).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2}):
 "Current price unavailable";
async function api<T>(token:string,path:string,method:"GET"|"POST"="GET",body?:object):Promise<T>{
 const response=await identityRequest("/api/v1/diagnostics/clinical/"+path,{
  method,cache:"no-store",
  headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},
  ...(body?{body:JSON.stringify(body)}:{})
 });
 if(!response.ok){
  const message=response.status===401?"Session expired. Please sign in again.":
   response.status===403?"You cannot access this patient's laboratory or this action.":
   response.status===409?"The original record changed. Refresh before retrying.":
   response.status===404?"This original laboratory record is unavailable.":
   response.status===429?"Too many requests. Try again shortly.":
   response.status===400?"Check the authorized patient, selected test and current state.":
   "The current laboratory outcome cannot be verified.";
  throw Object.assign(new Error(message),{status:response.status});
 }
 return await response.json() as T;
}
type Props={token:string;canCreate:boolean;canView:boolean;canManageSamples:boolean;
 onExit:()=>void;onExpired:()=>void};
function Button({name,onPress,disabled=false}:{
 name:string;onPress:()=>void;disabled?:boolean
}){
 return <Pressable accessibilityRole="button" disabled={disabled}
  accessibilityState={{disabled}}
  onPress={onPress} style={[styles.button,disabled&&styles.disabled]}>
  <Text style={styles.buttonLabel}>{name}</Text></Pressable>;
}
export function NativeClinicalLabOrders({token,canCreate,canView,canManageSamples,
 onExit,onExpired}:Props){
 const [centers,setCenters]=useState<Center[]>([]),[center,setCenter]=useState("");
 const [patients,setPatients]=useState<Patient[]>([]),[catalog,setCatalog]=useState<Item[]>([]);
 const [patientKey,setPatientKey]=useState(""),[itemKey,setItemKey]=useState("");
 const [quantity,setQuantity]=useState("1"),[cart,setCart]=useState<Selection[]>([]);
 const [orders,setOrders]=useState<Order[]>([]),[details,setDetails]=useState<Details|null>(null);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [uncertain,setUncertain]=useState(false),[custodyUncertain,setCustodyUncertain]=useState(false);
 const [confirmReject,setConfirmReject]=useState("");
 const seq=useRef(0),orderReplay=useRef<OrderPayload|null>(null);
 const custodyReplay=useRef<PendingCustody|null>(null);
 const centerPath=(c:string)=>"centers/"+encodeURIComponent(c);
 const load=useCallback(async(c:string)=>{
  const n=++seq.current;
  if(!c){setPatients([]);setCatalog([]);setOrders([]);return;}
  const [p,items,o]=await Promise.all([
   canCreate?api<{patients:Patient[]}>(token,centerPath(c)+"/patients/eligible"):
    Promise.resolve({patients:[]}),
   canCreate?api<{items:Item[]}>(token,centerPath(c)+"/catalog/eligible"):
    Promise.resolve({items:[]}),
   canView?api<{orders:Order[]}>(token,centerPath(c)+"/orders"):
    Promise.resolve({orders:[]})
  ]);
  if(n===seq.current){
   setPatients(Array.isArray(p.patients)?p.patients.slice(0,60):[]);
   setCatalog(Array.isArray(items.items)?items.items.slice(0,100):[]);
   setOrders(Array.isArray(o.orders)?o.orders.slice(0,30):[]);
  }
 },[token,canCreate,canView]);
 useEffect(()=>{
  let active=true;setLoading(true);
  void api<{centers:Center[]}>(token,"centers/eligible").then(r=>{
   if(active)setCenters(Array.isArray(r.centers)?r.centers.slice(0,30):[]);
  }).catch(e=>{if(!active)return;
   if(e?.status===401)onExpired();
   setError("Current assigned laboratory access could not be verified.");
  }).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;++seq.current;};
 },[token,onExpired]);
 useEffect(()=>{
  setPatients([]);setCatalog([]);setOrders([]);setDetails(null);
  setCart([]);setPatientKey("");setItemKey("");setConfirmReject("");
  setNotice("");setError("");orderReplay.current=null;custodyReplay.current=null;
  setUncertain(false);setCustodyUncertain(false);
  if(!center)return;
  setLoading(true);
  void load(center).catch(e=>{if(e?.status===401)onExpired();
   setError("The latest patient, test or order sources could not be verified.");
  }).finally(()=>setLoading(false));
 },[center,load,onExpired]);
 useEffect(()=>{
  const sub=BackHandler.addEventListener("hardwareBackPress",()=>{
   if(uncertain||custodyUncertain||busy)return true;
   if(details){setDetails(null);return true;}
   if(center){setCenter("");return true;}
   onExit();return true;
  });
  return()=>sub.remove();
 },[uncertain,custodyUncertain,busy,details,center,onExit]);
 async function refresh(){
  if(!center)return;
  setLoading(true);setError("");
  try{await load(center);
   if(details)await open(details.order.orderRef);
  }catch(e){if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
   setError("Current laboratory data could not be verified.");}
  finally{setLoading(false);}
 }
 function add(){
  const qty=Number(quantity);
  if(!itemKey||!Number.isSafeInteger(qty)||qty<1||qty>20||cart.length>=10)return;
  if(!catalog.some(x=>x.mappingRef===itemKey)||cart.some(x=>x.mappingRef===itemKey))return;
  setCart(old=>[...old,{mappingRef:itemKey,quantity:qty}]);
  setItemKey("");setQuantity("1");
 }
 async function sendOrder(payload:OrderPayload){
  if(!center||busy)return;
  setBusy(true);setError("");setNotice("");
  try{
   const saved=await api<{displayOrderRef:string;orderRef:string}>(token,
    centerPath(center)+"/orders","POST",payload);
   orderReplay.current=null;setUncertain(false);
   setNotice("Lab order "+saved.displayOrderRef+
    " confirmed. No payment, professional report or benefit was recorded.");
   setCart([]);setPatientKey("");
   try{await load(center);}catch{setError("Order saved, but the latest list could not be refreshed.");}
  }catch(e){
   if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
   const status=e&&typeof e==="object"&&"status" in e&&typeof e.status==="number"?
    e.status:503;
   setError(e instanceof Error?e.message:"Order outcome uncertain.");
   if(status>=500){setUncertain(true);orderReplay.current=payload;}
   else{setUncertain(false);orderReplay.current=null;}
  }finally{setBusy(false);}
 }
 function create(){
  const selected=patients.find(x=>x.patientRef+"|"+x.careSourceRef===patientKey);
  if(!selected||!center||!cart.length||!canCreate||uncertain)return;
  const payload:OrderPayload={requestKey:Crypto.randomUUID(),patientRef:selected.patientRef,
   careSource:{kind:selected.careSourceKind,ref:selected.careSourceRef},selections:cart};
  orderReplay.current=payload;
  void sendOrder(payload);
 }
 async function open(ref:string){
  if(!center)return;
  setError("");
  try{
   const r=await api<Details>(token,centerPath(center)+"/orders/"+
    encodeURIComponent(ref));
   if(!r||!r.order||!Array.isArray(r.lines)||!Array.isArray(r.samples))
    throw Error("The original laboratory details could not be confirmed.");
   setDetails(r);setConfirmReject("");
  }catch(e){if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
   setError("The current order details are unavailable.");}
 }
 async function custody(p:PendingCustody){
  if(busy)return;
  setBusy(true);setError("");setNotice("");
  try{
   await api(token,centerPath(p.center)+"/orders/"+encodeURIComponent(p.order)+
    "/samples/"+encodeURIComponent(p.sample)+"/"+p.action,"POST",p.payload);
   custodyReplay.current=null;setCustodyUncertain(false);setConfirmReject("");
   setNotice("Original sample custody recorded. This is not a released clinical report.");
   try{await open(p.order);await load(p.center);}
   catch{setError("Custody was saved, but the latest order view could not be refreshed.");}
  }catch(e){
   if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
   const status=e&&typeof e==="object"&&"status" in e&&typeof e.status==="number"?
    e.status:503;
   setError(e instanceof Error?e.message:"Sample status could not be confirmed.");
   if(status>=500){custodyReplay.current=p;setCustodyUncertain(true);}
   else{custodyReplay.current=null;setCustodyUncertain(false);}
  }finally{setBusy(false);}
 }
 function updateSample(s:Sample,action:CustodyAction){
  if(!canManageSamples||busy||custodyUncertain||!center||!details)return;
  if(!Number.isSafeInteger(s.revision)||s.revision<1)return;
  const expected=next[s.status]?.action===action||
   (action==="reject"&&["COLLECTED","RECEIVED","PROCESSING"].includes(s.status));
  if(!expected)return;
  const p:PendingCustody={center,order:details.order.orderRef,sample:s.sampleRef,
   action,payload:{requestKey:Crypto.randomUUID(),expectedVersion:s.revision}};
  custodyReplay.current=p;void custody(p);
 }
 const disabled=busy||loading||uncertain||custodyUncertain;
 return <SafeAreaView style={styles.page}>
  <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
   <View style={styles.row}><Button name="Back" onPress={()=>{
    if(details)setDetails(null);else if(center)setCenter("");else onExit();
   }} disabled={disabled}/><Text style={styles.title}>Lab Orders & Samples</Text></View>
   <Text style={styles.hint}>Staff-only clinical operations at your verified assigned
    lab. Lab ERP, actual patient consent and current role are checked on the server.</Text>
   {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
   {!!notice&&<Text accessibilityRole="summary" style={styles.hint}>{notice}</Text>}
   {loading&&<ActivityIndicator accessibilityLabel="Checking clinical lab permissions"/>}
   {uncertain&&<View style={styles.card}>
    <Text>Order outcome is uncertain. Do not create another request.</Text>
    <Button name="Retry original order safely" disabled={busy||!orderReplay.current}
     onPress={()=>{if(orderReplay.current)void sendOrder(orderReplay.current);}}/>
   </View>}
   {custodyUncertain&&<View style={styles.card}>
    <Text>Specimen action outcome is uncertain. Do not create another custody event.</Text>
    <Button name="Retry original specimen action" disabled={busy||!custodyReplay.current}
     onPress={()=>{if(custodyReplay.current)void custody(custodyReplay.current);}}/>
   </View>}
   {!loading&&centers.length===0&&<Text style={styles.hint}>No approved clinical lab
    is available for your current account. Lab ERP may be off.</Text>}
   {!center&&centers.map(c=><View style={styles.card} key={c.centerRef}>
    <Text style={styles.cardTitle}>{c.name}</Text>
    <Button name="Open this authorized laboratory" disabled={disabled}
     onPress={()=>setCenter(c.centerRef)}/>
   </View>)}
   {!!center&&<View style={styles.row}>
    <Button name="Refresh latest records" disabled={disabled} onPress={()=>void refresh()}/>
    <Button name="Choose another lab" disabled={disabled} onPress={()=>setCenter("")}/>
   </View>}
   {!!center&&canCreate&&<View style={styles.card}>
    <Text style={styles.cardTitle}>New internal lab order</Text>
    <Text style={styles.hint}>Choose an actual consented patient visit and current
     independently approved test. The final quote is frozen by the backend.</Text>
    <Text style={styles.fieldLabel}>Authorized patient and care source</Text>
    {patients.map(p=><Pressable key={p.patientRef+"-"+p.careSourceRef}
     accessibilityRole="radio" accessibilityState={{
      checked:patientKey===p.patientRef+"|"+p.careSourceRef}}
     onPress={()=>setPatientKey(p.patientRef+"|"+p.careSourceRef)}
     style={[styles.option,patientKey===p.patientRef+"|"+p.careSourceRef&&styles.active]}>
     <Text style={styles.body}>{p.name} · {p.virtualPatientId} ·
      {p.careSourceKind==="CONSULTATION"?" Consultation":" Verified center intake"}</Text>
    </Pressable>)}
    {!patients.length&&<Text>No currently eligible consenting patients at this center.</Text>}
    <Text style={styles.fieldLabel}>Select approved test or package</Text>
    {catalog.filter(i=>!cart.some(c=>c.mappingRef===i.mappingRef)).map(i=>
     <Pressable key={i.mappingRef} accessibilityRole="radio"
      accessibilityState={{checked:itemKey===i.mappingRef}}
      onPress={()=>setItemKey(i.mappingRef)}
      style={[styles.option,itemKey===i.mappingRef&&styles.active]}>
      <Text style={styles.body}>{i.name} · {i.kind==="PACKAGE"?"Package":"Test"}
       {" · "+money(i.currentPatientPriceMinor)}</Text>
     </Pressable>)}
    <Text style={styles.fieldLabel}>Quantity (1–20)</Text>
    <TextInput accessibilityLabel="Test quantity" value={quantity}
     keyboardType="number-pad" onChangeText={setQuantity} style={styles.input}/>
    <Button name="Add selected test" disabled={disabled||!itemKey||cart.length>=10}
     onPress={add}/>
    {cart.map(i=>{const item=catalog.find(c=>c.mappingRef===i.mappingRef);
     return <View key={i.mappingRef} style={styles.row}>
      <Text style={styles.body}>{item?.name??"Selected test"} · Qty {i.quantity}</Text>
      <Button name="Remove" disabled={disabled} onPress={()=>
       setCart(old=>old.filter(x=>x.mappingRef!==i.mappingRef))}/>
     </View>})}
    <Button name="Create clinical lab order" disabled={disabled||!patientKey||!cart.length}
     onPress={create}/>
   </View>}
   {!!center&&canView&&<View style={styles.card}>
    <Text style={styles.cardTitle}>Latest clinical orders</Text>
    {!orders.length&&<Text>No current lab orders for this assigned center.</Text>}
    {orders.map(o=><View style={styles.option} key={o.orderRef}>
     <Text style={styles.body}>{o.displayOrderRef} · {money(o.quotedTotalMinor)}</Text>
     <Text style={styles.hint}>{o.status.replaceAll("_"," ").toLowerCase()}</Text>
     <Button name="View order and specimen history" disabled={disabled}
      onPress={()=>void open(o.orderRef)}/>
    </View>)}
   </View>}
   {details&&canView&&<View style={styles.card}>
    <Text style={styles.cardTitle}>{details.order.displayOrderRef}</Text>
    <Text>Accepted quote: {money(details.order.quotedTotalMinor)}.
     This is not a paid invoice.</Text>
    {details.lines.map((l,i)=><Text key={i} style={styles.body}>
     {l.name} · Qty {l.quantity} · {money(l.quotedLineTotalMinor)}
    </Text>)}
    <Text style={styles.fieldLabel}>Original specimen custody</Text>
    {details.samples.map(s=><View key={s.sampleRef} style={styles.option}>
     <Text style={styles.body}>{s.label} · {s.sampleType.replaceAll("_"," ")}</Text>
     <Text style={styles.hint}>{s.status.replaceAll("_"," ").toLowerCase()}</Text>
     {canManageSamples&&next[s.status]&&<Button name={next[s.status]!.label}
      disabled={disabled} onPress={()=>updateSample(s,next[s.status]!.action)}/>}
     {canManageSamples&&["COLLECTED","RECEIVED","PROCESSING"].includes(s.status)&&
      (confirmReject===s.sampleRef?<View style={styles.row}>
       <Text>Reject this sample and retain its original custody history?</Text>
       <Button name="Confirm reject" disabled={disabled}
        onPress={()=>updateSample(s,"reject")}/>
       <Button name="Cancel" disabled={busy} onPress={()=>setConfirmReject("")}/>
      </View>:<Button name="Reject sample…" disabled={disabled}
       onPress={()=>setConfirmReject(s.sampleRef)}/>)}
    </View>)}
    <Text style={styles.hint}>Collected or scanner-verified samples do not mean a
     clinical report has been independently approved, released or delivered.</Text>
   </View>}
  </ScrollView>
 </SafeAreaView>;
}
const styles=StyleSheet.create({
 page:{flex:1,backgroundColor:t.background},
 content:{padding:16,paddingBottom:110,gap:14,maxWidth:740,width:"100%",alignSelf:"center"},
 row:{flexDirection:"row",flexWrap:"wrap",alignItems:"center",gap:10},
 title:{fontSize:23,fontWeight:"800",color:t.text,flexShrink:1},
 card:{padding:15,borderWidth:1,borderColor:t.border,borderRadius:14,
  backgroundColor:t.surface,gap:10},
 cardTitle:{fontSize:17,fontWeight:"700",color:t.text},
 fieldLabel:{fontSize:14,fontWeight:"700",color:t.text,marginTop:4},
 option:{padding:12,borderColor:t.border,borderWidth:1,borderRadius:10,gap:7},
 active:{borderColor:t.primary,backgroundColor:t.background},
 body:{fontSize:14,color:t.text,flexShrink:1},
 hint:{fontSize:13,color:t.mutedText,lineHeight:20},
 error:{fontSize:13,color:"#B91C1C"},
 button:{minHeight:46,paddingHorizontal:12,paddingVertical:8,borderWidth:1,
  borderColor:t.border,borderRadius:10,justifyContent:"center"},
 buttonLabel:{fontWeight:"650",fontSize:13,color:t.text},
 disabled:{opacity:0.45},
 input:{minHeight:46,padding:10,borderColor:t.border,borderWidth:1,
  borderRadius:10,color:t.text}
});
