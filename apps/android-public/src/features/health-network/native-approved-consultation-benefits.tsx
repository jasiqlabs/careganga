import {useCallback,useEffect,useRef,useState} from "react";
import {ActivityIndicator,AppState,Pressable,StyleSheet,Text,View} from "react-native";
import {careGangaPublicTheme as theme}
 from "../../../../../packages/design-tokens/src/index";
const url=process.env.EXPO_PUBLIC_API_URL;
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Benefit={centerSlug:string;centerName:string;doctorRef:string|null;
 doctorName:string|null;feeMinor:string|null;currency:"INR";
 mode:"PERCENT"|"FIXED";percentBasisPoints:number|null;
 fixedSupportMinor:string|null;maximumSupportMinor:string;validUntil:string;
 eligibility:"VERIFIED_PATIENT_CARE";patientEntitlementConfirmed:false;
 bookingChargeAccepted:false};
type Reply={state:"READY"|"NO_APPROVED_CURRENT_BENEFITS";items:Benefit[]};
type Props={doctorRef:string};
const money=(s:string)=>"₹"+(Number(s)/100).toLocaleString("en-IN",{
 minimumFractionDigits:0,maximumFractionDigits:2});
const amount=(s:unknown)=>typeof s==="string"&&/^(0|[1-9]\d{0,10})$/.test(s)&&
 Number.isSafeInteger(Number(s))&&Number(s)<=10000000000;
function valid(v:unknown):v is Benefit{
 if(!v||typeof v!=="object"||Array.isArray(v))return false;
 const x=v as Partial<Benefit>;
 return typeof x.centerSlug==="string"&&
  /^[a-z0-9][a-z0-9-]{2,79}$/.test(x.centerSlug)&&
  typeof x.centerName==="string"&&x.centerName.length<=160&&
  (x.doctorRef===null||typeof x.doctorRef==="string"&&
   ID.test(x.doctorRef))&&
  (x.doctorName===null||typeof x.doctorName==="string"&&x.doctorName.length<=150)&&
  (x.feeMinor===null||amount(x.feeMinor))&&x.currency==="INR"&&
  (x.mode==="PERCENT"||x.mode==="FIXED")&&
  (x.mode==="PERCENT"?Number.isInteger(x.percentBasisPoints)&&
    (x.percentBasisPoints??0)>=1&&(x.percentBasisPoints??0)<=10000&&
    x.fixedSupportMinor===null:
    x.percentBasisPoints===null&&amount(x.fixedSupportMinor))&&
  amount(x.maximumSupportMinor)&&typeof x.validUntil==="string"&&
  Number.isFinite(Date.parse(x.validUntil))&&Date.parse(x.validUntil)>Date.now()&&
  x.eligibility==="VERIFIED_PATIENT_CARE"&&
  x.patientEntitlementConfirmed===false&&x.bookingChargeAccepted===false;
}
/** Fits inside the existing native CG14 doctor detail (not another
 * healthcare navigation or future CG22/23/24 module). Never cache a rule.
 */
export function NativeApprovedConsultationBenefits({doctorRef}:Props){
 const [items,setItems]=useState<Benefit[]>([]),[loading,setLoading]=useState(true);
 const [status,setStatus]=useState<"READY"|"EMPTY"|"UNAVAILABLE">("EMPTY");
 const sequence=useRef(0);
 const [viewFor,setViewFor]=useState(doctorRef);
 const reload=useCallback(async()=>{
  const request=++sequence.current;
  setViewFor(doctorRef);setLoading(true);setItems([]);setStatus("EMPTY");
  try{
   if(!ID.test(doctorRef)||!url||!/^https?:\/\//.test(url)||
    (process.env.NODE_ENV==="production"&&!url.startsWith("https://")))
    throw Error("Public assistance source unavailable");
   const target=new URL("/api/v1/public/healthcare-assistance/consultation-benefits",url);
   target.searchParams.set("doctor",doctorRef);
   const reply=await fetch(target,{cache:"no-store",signal:AbortSignal.timeout(9000)});
   if(!reply.ok)throw Error("Unverified source");
   const obj:unknown=await reply.json();
   if(!obj||typeof obj!=="object"||Array.isArray(obj)||
     !("items" in obj)||!Array.isArray(obj.items)||obj.items.length>12||
     !obj.items.every(x=>valid(x)&&(x.doctorRef===null||x.doctorRef.toLowerCase()===doctorRef.toLowerCase()))||!("state" in obj)||
     !["READY","NO_APPROVED_CURRENT_BENEFITS"].includes(String(obj.state))||
     (obj.state==="NO_APPROVED_CURRENT_BENEFITS"&&obj.items.length!==0))
    throw Error("Invalid source");
   if(request===sequence.current){setItems(obj.items);setStatus(obj.items.length?"READY":"EMPTY");}
  }catch{if(request===sequence.current){setStatus("UNAVAILABLE");setItems([])}}
  finally{if(request===sequence.current)setLoading(false)}
 },[doctorRef]);
 useEffect(()=>{
  void reload();
  const listener=AppState.addEventListener("change",next=>{
   if(next==="active")void reload();
   else{sequence.current++;setItems([]);setStatus("EMPTY");setLoading(false);}
  });
  return()=>{sequence.current++;listener.remove();};
 },[reload]);
 // Time-based removal is not polling. Nothing is displayed past expiration.
 useEffect(()=>{
  if(!items.length)return;
  const nearest=Math.min(...items.map(x=>Date.parse(x.validUntil)));
  const delay=Math.max(1,Math.min(nearest-Date.now(),2147483647));
  const timer=setTimeout(()=>{
   setItems(current=>current.filter(x=>Date.parse(x.validUntil)>Date.now()));
  },delay);
  return()=>clearTimeout(timer);
 },[items]);
 const checking=loading||viewFor!==doctorRef;
 if(!checking&&(status==="EMPTY"||status==="READY"&&!items.length))return null;
 return <View style={styles.panel}
  accessibilityLabel="Verified Foundation consultation assistance">
  <Text accessibilityRole="header" style={styles.title}>Current consultation support</Text>
  {checking?<ActivityIndicator accessibilityLabel="Checking actual assistance policy"/>:
   status==="UNAVAILABLE"?<Text style={styles.note}>
    Current assistance status cannot be verified; no old rates are shown.
   </Text>:items.map((v,i)=><View key={v.centerSlug+":"+i} style={styles.row}>
    <Text style={styles.center}>{v.centerName}</Text>
    <Text style={styles.amount}>
     {v.mode==="PERCENT"?
      (v.percentBasisPoints??0)/100+"% possible Foundation contribution":
      "Possible fixed contribution "+money(v.fixedSupportMinor??"0")}
     {" · maximum "+money(v.maximumSupportMinor)}
    </Text>
    {v.feeMinor&&<Text style={styles.note}>
     Currently approved consultation fee: {money(v.feeMinor)}
    </Text>}
    <Text style={styles.note}>Subject to verified patient identity,
     active consent, current policy and accepted booking. This is not
     a guaranteed discount or a payment confirmation.</Text>
   </View>)}
  <Pressable accessibilityRole="button" onPress={()=>void reload()}
   style={[styles.button,checking&&styles.disabled]} disabled={checking}>
   <Text style={styles.buttonLabel}>Check current policy again</Text>
  </Pressable>
 </View>;
}
const styles=StyleSheet.create({
 panel:{padding:14,gap:12,backgroundColor:theme.surface,
  borderColor:theme.border,borderWidth:1,borderRadius:16},
 title:{fontWeight:"700",fontSize:17,color:theme.primaryText,backgroundColor:theme.primary,
  padding:12,borderRadius:10},
 center:{fontWeight:"700",fontSize:15,color:theme.text},
 amount:{fontWeight:"700",fontSize:16,lineHeight:23,color:theme.primary},
 row:{padding:12,borderWidth:1,borderRadius:10,borderColor:theme.border,
  backgroundColor:theme.background,gap:8},
 note:{fontSize:13,lineHeight:20,color:theme.mutedText},
 button:{minHeight:48,padding:12,borderWidth:1,borderColor:theme.border,
  borderRadius:10,justifyContent:"center",alignItems:"center"},
 disabled:{opacity:.55},
 buttonLabel:{fontSize:14,fontWeight:"600",color:theme.primary,textAlign:"center"}
});
