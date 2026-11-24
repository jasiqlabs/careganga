import {useCallback,useEffect,useRef,useState} from "react";
import {
 ActivityIndicator,Alert,Pressable,ScrollView,StyleSheet,Text,TextInput,View
} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import * as Crypto from "expo-crypto";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";
import {NativeVerifiedProviderPayout} from "./native-verified-provider-payout";
type Props={token:string;canPropose:boolean;canReview:boolean;canPay:boolean;
 onExit:()=>void;onExpired:()=>void};
type Center={centerRef:string;name:string};
type Summary={month:string;state:string;settlementRef?:string;revision?:number;
 postedLiabilities?:number;eligibleAccruedMinor?:string;proposedClaimMinor?:string;
 approvedFoundationMinor:string;actualPaidMinor:string;
 outstandingMinor:string;patientCollectionNotFoundationIncome:true;paidVerified:boolean;
 centerGrossServicesMinor?:string;patientPayableMinor?:string;
 patientCollectedVerifiedMinor?:string;patientRefundedMinor?:string;
 partnerPatientCollectedAttestedMinor?:string;
 foundationApprovedLiabilityMinor?:string;
 originalApprovedFoundationMinor?:string;
 effectiveState?:string;originalClaimState?:string;adjustedFoundationMinor?:string;
 grossFoundationPaidMinor?:string;verifiedProviderRecoveryMinor?:string;
 collectionsScope?:"VERIFIED_TO_DATE_FOR_COMPLETED_SERVICES"};
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const MONTH=/^20[2-9]\d-(0[1-9]|1[0-2])$/;
const money=(minor:string|undefined)=>typeof minor==="string"&&/^-?\d+$/.test(minor)&&Number.isSafeInteger(Number(minor))?"₹"+(Number(minor)/100).toFixed(2):"Not available";
const base="/api/v1/healthcare-assistance/provider-settlements/";
async function api(token:string,path:string,body?:object){
 const response=await identityRequest(base+path,{
  method:body?"POST":"GET",cache:"no-store",
  headers:{Authorization:"Bearer "+token,
   ...(body?{"Content-Type":"application/json"}:{})},
  body:body?JSON.stringify(body):undefined});
 if(!response.ok)throw Object.assign(new Error(
  response.status===401?"Sign in again to view Foundation settlements.":
  response.status===403?"Your current role cannot perform this action.":
  response.status===404?"The original provider or posted source is unavailable.":
  response.status===409?"The original claim, year or bank proof changed.":
  "Settlement outcome uncertain. Check the original claim first."),{
   status:response.status});
 return response.json() as Promise<unknown>;
}
function valid(v:unknown):v is Summary{
 if(!v||typeof v!=="object"||Array.isArray(v))return false;
 const x=v as Partial<Summary>;
 return typeof x.month==="string"&&typeof x.state==="string"&&
  typeof x.approvedFoundationMinor==="string"&&
  typeof x.actualPaidMinor==="string"&&
  typeof x.outstandingMinor==="string"&&
  x.patientCollectionNotFoundationIncome===true&&
  typeof x.paidVerified==="boolean";
}
/** Same original CG17/CG09 source as Admin Web. No direct patient collections,
 * unverified bank transfers or simulated monthly payout state.
 */
export function NativeMonthlyProviderSettlement({token,canPropose,canReview,canPay,
 onExit,onExpired}:Props){
 const [centers,setCenters]=useState<Center[]>([]);
 const [center,setCenter]=useState(""),[month,setMonth]=useState("");
 const [source,setSource]=useState<Summary|null>(null);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [uncertain,setUncertain]=useState(false);
 const attempt=useRef<{kind:"propose"|"review";center:string;month:string;
  key:string;revision:number}|null>(null),serial=useRef(0);
 const report=useCallback((e:unknown)=>{
  if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
  setError(e instanceof Error?e.message:"Original settlement source unavailable.");
 },[onExpired]);
 const load=useCallback(async(c:string,m:string)=>{
  if(!ID.test(c)||!MONTH.test(m))
   throw Error("Select a verified center and month (YYYY-MM).");
  const raw=await api(token,"centers/"+c+"/months/"+m);
  if(!valid(raw)||raw.month!==m)throw Error("Original monthly status cannot be verified.");
  return raw;
 },[token]);
 useEffect(()=>{
  let live=true;setLoading(true);
  void api(token,"centers/eligible").then(raw=>{
   if(!live)return;
   if(!raw||typeof raw!=="object"||Array.isArray(raw)||
    !("centers" in raw)||!Array.isArray(raw.centers)||
    raw.centers.length>50)
    throw Error("Original verified center list is unavailable.");
   const cs=raw.centers.filter((x:unknown):x is Center=>!!x&&
    typeof x==="object"&&"centerRef" in x&&typeof x.centerRef==="string"&&
    ID.test(x.centerRef)&&"name" in x&&typeof x.name==="string");
   setCenters(cs);if(cs.length===1)setCenter(cs[0].centerRef);
  }).catch(e=>{if(live)report(e)})
   .finally(()=>{if(live)setLoading(false)});
  return()=>{live=false};
 },[token,report]);
 useEffect(()=>{
  const rev=++serial.current;
  setSource(null);setError("");setNotice("");setUncertain(false);
  attempt.current=null;
  if(!ID.test(center)||!MONTH.test(month)){setLoading(false);return;}
  setLoading(true);
  void load(center,month).then(v=>{if(serial.current===rev)setSource(v)})
   .catch(e=>{if(serial.current===rev)report(e)})
   .finally(()=>{if(serial.current===rev)setLoading(false)});
  return()=>{serial.current++;};
 },[center,month,load,report]);
 async function refresh(){
  if(busy||!ID.test(center)||!MONTH.test(month))return;
  setBusy(true);setError("");setNotice("");
  try{const next=await load(center,month);setSource(next);setUncertain(false);
   if(next.state!=="NOT_PREPARED")attempt.current=null;
  }catch(e){setUncertain(true);report(e)}finally{setBusy(false);}
 }
 async function write(kind:"propose"|"review"){
  const prev=source;
  if(!prev||busy||uncertain)return;
  if(kind==="propose"&&(!canPropose||prev.state!=="NOT_PREPARED"||
   !prev.postedLiabilities))return;
  if(kind==="review"&&(!canReview||prev.state!=="PROPOSED"||
   !Number.isSafeInteger(prev.revision)))return;
  const rev=kind==="review"?prev.revision!:1;
  if(!attempt.current||attempt.current.kind!==kind||
   attempt.current.center!==center||attempt.current.month!==month)
   attempt.current={kind,center,month,key:Crypto.randomUUID(),revision:rev};
  setBusy(true);setError("");setNotice("");
  try{
   const body=kind==="review"?
    {requestKey:attempt.current.key,expectedRevision:attempt.current.revision}:
    {requestKey:attempt.current.key};
   const raw=await api(token,"centers/"+center+"/months/"+month+"/"+
    kind,body);
   if(!valid(raw)||raw.state!==(kind==="review"?"APPROVED":"PROPOSED"))
    throw Error("The original settlement result could not be verified.");
   setSource(raw);setUncertain(false);attempt.current=null;
   try{setSource(await load(center,month))}catch{
    // Original action succeeded; status remains as returned until refresh.
   }
   setNotice(kind==="review"?"Independent approval confirmed. No bank payment made.":
    "Original source-backed claim prepared; independent review required.");
  }catch(e){
   const status=e&&typeof e==="object"&&"status" in e&&
    typeof e.status==="number"?e.status:503;
   setUncertain(status>=500);
   if(status<500)attempt.current=null;
   report(e);
  }finally{setBusy(false);}
 }
 const button=(title:string,press:()=>void,disabled=false)=>
  <Pressable accessibilityRole="button" accessibilityState={{disabled}}
   disabled={disabled} onPress={press} style={[styles.button,
    disabled&&styles.disabled]}><Text style={styles.buttonText}>{title}</Text></Pressable>;
 return <SafeAreaView edges={["left","right"]} style={styles.page}>
  <ScrollView contentContainerStyle={styles.content}>
   {button("Back to Foundation home",onExit,busy)}
   <Text accessibilityRole="header" style={styles.title}>
    Healthcare Provider Settlements</Text>
   <Text style={styles.note}>Only source-approved Foundation obligations
    recorded in Foundation accounts are eligible. Patient center cash is separate.
    Preparing or approving a claim does not pay the provider.</Text>
   {loading&&<ActivityIndicator accessibilityLabel="Checking original settlement"/>}
   {!!error&&<Text accessibilityRole="alert" style={styles.note}>{error}</Text>}
   {!!notice&&<Text accessibilityRole="alert" style={styles.note}>{notice}</Text>}
   <Text style={styles.heading}>Verified healthcare center</Text>
   <View style={styles.centerRow}>{centers.map(x=><View key={x.centerRef}>
    {button(x.name,()=>setCenter(x.centerRef),busy||loading||uncertain)}
   </View>)}</View>
   <Text style={styles.heading}>Original liability month (YYYY-MM)</Text>
   <TextInput accessibilityLabel="Original monthly period" style={styles.input}
    placeholder="2026-11" value={month} editable={!busy&&!uncertain} maxLength={7}
    autoCapitalize="none" onChangeText={setMonth}/>
   {source&&<View style={styles.card}>
    <Text accessibilityRole="header" style={styles.heading}>Settlement overview — {source.month}</Text>
    <View style={styles.centerRow}>
     {[["Verified patient collections",source.collectionsScope==="VERIFIED_TO_DATE_FOR_COMPLETED_SERVICES"?money(source.patientCollectedVerifiedMinor):"Not available"],["Foundation claim status",(source.effectiveState??source.state).replaceAll("_"," ")],["Verified provider payout",money(source.actualPaidMinor)],["Outstanding approved claim",["APPROVED","PARTIALLY_SETTLED","SETTLED"].includes(source.state)?money(source.outstandingMinor):"Not yet approved"]].map(([label,value])=><View key={label} style={[styles.card,{flexGrow:1,flexBasis:"45%"}]}><Text style={styles.note}>{label}</Text><Text style={styles.amount}>{value}</Text></View>)}
    </View>
    <Text style={styles.note}>Original claim: {source.state.replaceAll("_"," ")}</Text>
    {source.effectiveState&&source.effectiveState!==source.state&&
     <Text style={styles.note}>Current verified payable status: {
      source.effectiveState.replaceAll("_"," ")}</Text>}
    <Text style={styles.amount}>{source.state==="NOT_PREPARED"?
     "Eligible posted Foundation liabilities":source.state==="PROPOSED"?
     "Prepared claim awaiting approval":"Approved monthly Foundation claim"}: {
     money(source.state==="NOT_PREPARED"?source.eligibleAccruedMinor:
      source.state==="PROPOSED"?source.proposedClaimMinor:
      source.approvedFoundationMinor)}</Text>
    {source.adjustedFoundationMinor&&BigInt(source.adjustedFoundationMinor)>0n&&<>
     <Text style={styles.note}>Original approved claim: {
      money(source.originalApprovedFoundationMinor)}</Text>
     <Text style={styles.note}>Verified liability correction: {
      money(source.adjustedFoundationMinor)}</Text>
     <Text style={styles.note}>Original gross bank payout: {
      money(source.grossFoundationPaidMinor)}</Text>
     <Text style={styles.note}>Actually recovered incoming bank money: {
      money(source.verifiedProviderRecoveryMinor)}</Text>
    </>}
    <Text style={styles.amount}>Actual verified provider payout: {
     money(source.actualPaidMinor)}</Text>
    <Text style={styles.amount}>Claim still due: {
     ["APPROVED","PARTIALLY_SETTLED","SETTLED"].includes(source.state)?
      money(source.outstandingMinor):"Not yet approved"}</Text>
    {source.collectionsScope==="VERIFIED_TO_DATE_FOR_COMPLETED_SERVICES"&&
     source.centerGrossServicesMinor!==undefined&&<View style={styles.card}>
     <Text style={styles.heading}>Original completed-service financial breakdown</Text>
     <Text style={styles.amount}>Gross service value: {
      money(source.centerGrossServicesMinor)}</Text>
     <Text style={styles.note}>Patient payable: {
      money(source.patientPayableMinor)}</Text>
     <Text style={styles.note}>Center collections verified to date: {
      money(source.patientCollectedVerifiedMinor)}</Text>
     <Text style={styles.note}>Partner-attested patient collections for approved
      pharmacy/nursing/OT: {money(source.partnerPatientCollectedAttestedMinor)}</Text>
     <Text style={styles.note}>Center refunds/corrections to date: {
      money(source.patientRefundedMinor)}</Text>
     <Text style={styles.amount}>Original Foundation obligation: {
      money(source.foundationApprovedLiabilityMinor)}</Text>
     <Text style={styles.note}>These are separate source amounts. Patient
      receipts and refunds may occur after the service month and are never
      Foundation bank income.</Text>
    </View>}
    <Text style={styles.note}>No unverified payment or bank credit is inferred.</Text>
    {source.state==="NOT_PREPARED"&&canPropose&&
     button("Prepare original monthly claim",()=>
      Alert.alert("Prepare completed-service claim?",
       "The claim contains only the original posted Foundation liability. "+
       "No cash or provider transfer occurs.",[
        {text:"Cancel",style:"cancel"},
        {text:"Prepare",onPress:()=>void write("propose")}
       ]),busy||uncertain||!source.postedLiabilities)}
    {source.state==="PROPOSED"&&canReview&&
     button("Independently approve claim",()=>
      Alert.alert("Approve protected monthly claim?",
       "Independently approve the original evidence only. "+
       "This does not send money.",[
        {text:"Cancel",style:"cancel"},
        {text:"Approve",onPress:()=>void write("review")}
       ]),busy||uncertain)}
    {uncertain&&<Text accessibilityRole="alert" style={styles.note}>
     Last outcome uncertain. Check this original claim before another action.</Text>}
    {canPay&&!uncertain&&["APPROVED","PARTIALLY_SETTLED"].includes(source.state)&&
     <NativeVerifiedProviderPayout key={source.settlementRef}
      token={token} centerRef={center} month={month}
      onExpired={onExpired} onApplied={refresh}/>}
    {button("Refresh original claim state",()=>void refresh(),busy)}
   </View>}
  </ScrollView>
 </SafeAreaView>;
}
const styles=StyleSheet.create({
 page:{flex:1,backgroundColor:t.background},
 content:{padding:16,gap:12,paddingBottom:42},
 title:{fontSize:22,fontWeight:"700",color:t.text},
 heading:{fontSize:15,fontWeight:"700",color:t.text},
 amount:{fontSize:14,fontWeight:"600",color:t.text},
 note:{fontSize:13,lineHeight:20,color:t.mutedText},
 centerRow:{flexDirection:"row",flexWrap:"wrap",gap:8},
 card:{gap:9,padding:12,borderWidth:1,borderColor:t.border,
  borderRadius:12,backgroundColor:t.surface},
 input:{minHeight:48,borderWidth:1,borderColor:t.border,borderRadius:9,
  backgroundColor:t.surface,padding:10,color:t.text},
 button:{minHeight:48,borderWidth:1,borderColor:t.border,borderRadius:9,
  padding:10,justifyContent:"center"},
 buttonText:{color:t.text,fontWeight:"600",fontSize:13},
 disabled:{opacity:0.45}
});
