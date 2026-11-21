import {useCallback,useEffect,useRef,useState} from "react";
import {ActivityIndicator,Pressable,SafeAreaView,ScrollView,StyleSheet,Text,View}
 from "react-native";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";
import {NativePendingPartnerServiceClaims} from "./native-pending-partner-service-claims";
type Center={centerRef:string;centerName:string};
type Summary={month:string;state:string;eligibleAccruedMinor?:string;
 approvedFoundationMinor:string;actualPaidMinor:string;outstandingMinor:string;
 centerGrossServicesMinor?:string;patientPayableMinor?:string;
 patientCollectedVerifiedMinor?:string;patientRefundedMinor?:string;
 foundationApprovedLiabilityMinor?:string;
 originalApprovedFoundationMinor?:string;
 effectiveState?:string;adjustedFoundationMinor?:string;
 grossFoundationPaidMinor?:string;verifiedProviderRecoveryMinor?:string;
 patientCollectionNotFoundationIncome:true;paidVerified:boolean};
type Props={token:string;onExit:()=>void;onExpired:()=>void};
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const monthNow=()=>new Date().getFullYear()+"-"+
 String(new Date().getMonth()+1).padStart(2,"0");
const shift=(value:string,n:number)=>{
 const [y,m]=value.split("-").map(Number);
 const d=new Date(Date.UTC(y,m-1+n,1));
 return d.getUTCFullYear()+"-"+String(d.getUTCMonth()+1).padStart(2,"0");
};
const money=(value:string|undefined)=>{
 const n=value&&/^[0-9]{1,12}$/.test(value)?BigInt(value):0n;
 return "₹"+(n/100n).toLocaleString("en-IN")+"."+
  (n%100n).toString().padStart(2,"0");
};
export function NativePartnerSettlementSummary({token,onExit,onExpired}:Props){
 const [centers,setCenters]=useState<Center[]>([]);
 const [center,setCenter]=useState("");
 const [month,setMonth]=useState(monthNow);
 const [summary,setSummary]=useState<Summary|null>(null);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const requestVersion=useRef(0);
 const request=useCallback(async(path:string)=>{
  const response=await identityRequest(
   "/api/v1/healthcare-assistance/provider-settlements/"+path,{
   method:"GET",cache:"no-store",
   headers:{Authorization:"Bearer "+token}});
  if(response.status===401){onExpired();throw Error("Sign in again.");}
  if(!response.ok)throw Error(response.status===403?
   "Your current center or financial view permission is unavailable.":
   "The Foundation's original settlement status is unavailable.");
  return response.json() as Promise<unknown>;
 },[token,onExpired]);
 useEffect(()=>{
  let live=true;setLoading(true);setError("");
  void request("my-centers/eligible").then(x=>{
   if(!live)return;
   if(!x||typeof x!=="object"||!("centers" in x)||
    !Array.isArray(x.centers)||x.centers.length>50)
    throw Error("Your authorized centers cannot be verified.");
   const safe=x.centers.filter((v:unknown):v is Center=>
    !!v&&typeof v==="object"&&"centerRef" in v&&
    typeof v.centerRef==="string"&&ID.test(v.centerRef)&&
    "centerName" in v&&typeof v.centerName==="string");
   setCenters(safe);
   if(safe[0])setCenter(safe[0].centerRef);
  }).catch(e=>{if(live)setError(e instanceof Error?e.message:
   "Your healthcare center is unavailable.");})
   .finally(()=>{if(live)setLoading(false)});
  return()=>{live=false};
 },[request]);
 const refresh=useCallback(async()=>{
  if(!ID.test(center))throw Error("Choose your assigned healthcare center.");
  const data=await request("my-centers/"+center+"/months/"+month);
  if(!data||typeof data!=="object"||!("month" in data)||
   data.month!==month||!("patientCollectionNotFoundationIncome" in data)||
   data.patientCollectionNotFoundationIncome!==true)
   throw Error("Original monthly balance cannot be verified.");
  return data as Summary;
 },[request,center,month]);
 useEffect(()=>{
  const version=++requestVersion.current;
  setSummary(null);setError("");
  if(!ID.test(center))return;
  setBusy(true);
  void refresh().then(data=>{
   if(version===requestVersion.current)setSummary(data);
  }).catch(e=>{
   if(version===requestVersion.current)
    setError(e instanceof Error?e.message:"Monthly settlement status unavailable.");
  }).finally(()=>{
   if(version===requestVersion.current)setBusy(false);
  });
  return()=>{requestVersion.current++};
 },[refresh]);
 const button=(label:string,fn:()=>void,disabled=false)=>
  <Pressable accessibilityRole="button" disabled={disabled}
   accessibilityState={{disabled}} onPress={fn}
   style={[styles.button,disabled&&styles.disabled]}>
   <Text style={styles.buttonText}>{label}</Text>
  </Pressable>;
 const approved=summary&&
  ["APPROVED","PARTIALLY_SETTLED","SETTLED"].includes(summary.state);
 return <SafeAreaView style={styles.page}>
  <ScrollView contentContainerStyle={styles.content}>
   <Text accessibilityRole="header" style={styles.title}>
    My Foundation contributions</Text>
   <Text style={styles.note}>Your center collects the patient's own payment.
    Foundation assistance is reconciled separately after eligible care is completed.
    Only real verified payouts are marked paid.</Text>
   {button("Back to dashboard",onExit)}
   {loading&&<ActivityIndicator accessibilityLabel="Checking assigned centers"/>}
   {!!error&&<Text accessibilityRole="alert" style={styles.note}>{error}</Text>}
   {!loading&&!centers.length&&<Text style={styles.note}>
    No currently assigned healthcare center can be viewed with this role.</Text>}
   {centers.map(x=><View key={x.centerRef}>
    {button(x.centerName,()=>setCenter(x.centerRef),busy)}
   </View>)}
   {!!center&&<View style={styles.panel}>
    <Text style={styles.label}>Settlement month {month}</Text>
    <View style={styles.horizontal}>
     {button("Previous month",()=>setMonth(shift(month,-1)),
      busy||month<="2020-01")}
     {button("Next month",()=>setMonth(shift(month,1)),
      busy||month>=monthNow())}
    </View>
    {busy&&<ActivityIndicator accessibilityLabel="Loading settlement amounts"/>}
    {summary&&<>
     <Text style={styles.note}>Current claim: {
      (summary.effectiveState??summary.state).replaceAll("_"," ")}</Text>
     {summary.effectiveState&&summary.effectiveState!==summary.state&&
      <Text style={styles.note}>Original recorded claim: {
       summary.state.replaceAll("_"," ")}</Text>}
     {([
      ["Eligible completed consultation value",summary.centerGrossServicesMinor],
      ["Patient due for eligible consultations",summary.patientPayableMinor],
      ["Verified center collections (net)",summary.patientCollectedVerifiedMinor],
      ["Verified center refunds/corrections",summary.patientRefundedMinor],
      ["Foundation liability",summary.foundationApprovedLiabilityMinor],
      [approved?"Approved monthly Foundation claim":
        summary.state==="PROPOSED"?"Proposed claim (not approved)":
         "Posted accrual before monthly claim",
       approved?summary.approvedFoundationMinor:summary.eligibleAccruedMinor],
      ...(approved&&summary.adjustedFoundationMinor&&
       BigInt(summary.adjustedFoundationMinor)>0n?[
       ["Original Foundation claim before correction",summary.originalApprovedFoundationMinor],
       ["Verified original claim adjustments",summary.adjustedFoundationMinor],
       ["Original gross Foundation payout",summary.grossFoundationPaidMinor],
       ["Verified actual provider bank recovery",summary.verifiedProviderRecoveryMinor]
      ] as const:[]),
      ["Verified Foundation payout",summary.actualPaidMinor],
      ["Foundation payout outstanding",summary.outstandingMinor]
     ] as const).map(([label,value])=><View key={label} style={styles.amount}>
      <Text style={styles.note}>{label}</Text>
      <Text style={styles.figure}>{money(value)}</Text>
     </View>)}
     {summary.state==="PROPOSED"&&<Text style={styles.note}>
      Monthly claim is awaiting independent Foundation review.</Text>}
     {summary.state==="NOT_PREPARED"&&<Text style={styles.note}>
      No monthly claim has been prepared or approved yet.</Text>}
    </>}
    {button("Refresh my settlement",()=>{
     const version=++requestVersion.current;
     setBusy(true);setSummary(null);setError("");
     void refresh().then(data=>{
      if(version===requestVersion.current)setSummary(data);
     }).catch(e=>{
      if(version===requestVersion.current)
       setError(e instanceof Error?e.message:"Unable to refresh.");
     }).finally(()=>{
      if(version===requestVersion.current)setBusy(false);
     });
    },busy)}
   </View>}
   {!!center&&<NativePendingPartnerServiceClaims token={token}
    centerRef={center} mode="partner" onExpired={onExpired}/>}
  </ScrollView>
 </SafeAreaView>;
}
const styles=StyleSheet.create({
 page:{flex:1,backgroundColor:t.adminCanvas},
 content:{padding:15,paddingBottom:90,gap:12},
 title:{fontSize:21,fontWeight:"700",color:t.text},
 label:{fontSize:16,fontWeight:"700",color:t.text},
 note:{fontSize:13,lineHeight:20,color:t.mutedText},
 panel:{backgroundColor:t.surface,borderColor:t.border,borderWidth:1,
  borderRadius:13,padding:12,gap:11},
 amount:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",
  gap:8,borderBottomWidth:1,borderColor:t.border,paddingVertical:6},
 figure:{fontSize:14,fontWeight:"700",color:t.text},
 horizontal:{flexDirection:"row",gap:8,flexWrap:"wrap"},
 button:{minHeight:48,padding:11,justifyContent:"center",
  borderWidth:1,borderColor:t.border,borderRadius:9},
 buttonText:{color:t.text,fontSize:13,fontWeight:"600"},
 disabled:{opacity:.5}
});
