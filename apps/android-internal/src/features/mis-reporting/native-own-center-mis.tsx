import {useCallback,useEffect,useRef,useState} from "react";
import {AppState,Pressable,StyleSheet,Text,TextInput,View} from "react-native";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";
import * as Crypto from "expo-crypto";
import {File,Paths} from "expo-file-system";

type Statement={
 month:string;state:string;approvedFoundationMinor:string;
 actualPaidMinor:string;outstandingMinor:string;
 eligibleAccruedMinor?:string;centerGrossServicesMinor?:string;
 patientPayableMinor?:string;foundationApprovedLiabilityMinor?:string;
 patientCollectedVerifiedMinor?:string;patientRefundedMinor?:string;
 partnerPatientCollectedAttestedMinor?:string;proposedClaimMinor?:string;
 adjustedFoundationMinor?:string;originalApprovedFoundationMinor?:string;
 grossFoundationPaidMinor?:string;verifiedProviderRecoveryMinor?:string;
 effectiveState?:string;
 patientCollectionNotFoundationIncome:true
};
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const initialMonth=()=>{
 const d=new Date();
 return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");
};
const MONTH=/^20[2-9]\d-(0[1-9]|1[0-2])$/;
const formatMoney=(value:string|undefined)=>{
 if(typeof value!=="string"||!/^-?\d{1,14}$/.test(value))return "Not confirmed";
 try{const v=BigInt(value),abs=v<0n?-v:v;
  return (v<0n?"−":"")+"₹"+(abs/100n).toLocaleString("en-IN")+"."+
   (abs%100n).toString().padStart(2,"0");
 }catch{return "Not confirmed";}
};
function isStatement(x:unknown):x is Statement{
 if(!x||typeof x!=="object"||Array.isArray(x))return false;
 const v=x as Partial<Statement>;
 return typeof v.month==="string"&&typeof v.state==="string"&&
  typeof v.approvedFoundationMinor==="string"&&
  typeof v.actualPaidMinor==="string"&&typeof v.outstandingMinor==="string"&&
  v.patientCollectionNotFoundationIncome===true;
}
/** CG-20 own-center MIS uses the ORIGINAL CG-17 settled source/CG-14 scope.
 * This is a read-only native counterpart to CenterMonthlySettlementSummary.
 * It never uses Foundation-wide finance/accounting endpoints.
 */
export function NativeOwnCenterMis({token,centerRef,onExpired}:{
 token:string;centerRef:string;onExpired:()=>void}){
 const [month,setMonth]=useState(initialMonth);
 const [statement,setStatement]=useState<Statement|null>(null);
 const [loading,setLoading]=useState(false);
 const [exporting,setExporting]=useState(false);
 const [exportNotice,setExportNotice]=useState("");
 const [error,setError]=useState("");
 const seq=useRef(0);
 const load=useCallback(async()=>{
  const generation=++seq.current;
  setStatement(null);setError("");setLoading(true);
  if(!ID.test(centerRef)||!MONTH.test(month)||month>initialMonth()){
   setLoading(false);setError("Select a valid settlement month up to the current month.");return;
  }
  try{
   const response=await identityRequest(
    "/api/v1/healthcare-assistance/provider-settlements/my-centers/"+
     encodeURIComponent(centerRef)+"/months/"+encodeURIComponent(month),
    {headers:{Authorization:"Bearer "+token},cache:"no-store"});
   if(generation!==seq.current)return;
   if(response.status===401){onExpired();return;}
   if(!response.ok)throw new Error(response.status===403?
    "Your current center assignment does not permit this statement.":
    "Your Foundation settlement summary is unavailable. Try again.");
   const data=await response.json() as unknown;
   if(!isStatement(data)||data.month!==month)throw new Error(
    "The current original settlement summary could not be verified.");
   if(generation===seq.current)setStatement(data);
  }catch(e){
   if(generation===seq.current)setError(e instanceof Error?e.message:
    "Your settlement cannot be confirmed. Refresh to retry.");
  }finally{if(generation===seq.current)setLoading(false);}
 },[centerRef,month,token,onExpired]);
 useEffect(()=>{void load();return()=>{seq.current++};},[load]);
 // A center assignment may be revoked while staff leave the application.
 // Discard previously fetched financial numbers and validate current
 // CG14/CG17 scope on resume, never retain a stale center statement.
 useEffect(()=>{
  const subscription=AppState.addEventListener("change",state=>{
   seq.current++;
   setStatement(null);
   if(state==="active")void load();
  });
  return()=>subscription.remove();
 },[load]);
 async function exportCurrentStatement(){
  if(loading||exporting||!statement||!ID.test(centerRef)||
   !MONTH.test(month)||month>initialMonth())return;
  setExportNotice("");setExporting(true);let file:File|null=null;
  try{
   const response=await identityRequest(
    "/api/v1/healthcare-assistance/provider-settlements/my-centers/"+
    encodeURIComponent(centerRef)+"/months/"+encodeURIComponent(month)+"/export.csv",{
     headers:{Authorization:"Bearer "+token},cache:"no-store"});
   if(response.status===401){onExpired();return;}
   if(!response.ok||response.headers.get("content-type")?.split(";")[0]!=="text/csv")
    throw Error("Current center assignment does not permit this export.");
   const bytes=new Uint8Array(await response.arrayBuffer());
   if(bytes.byteLength<30||bytes.byteLength>65536)
    throw Error("This private center file failed verification.");
   file=new File(Paths.cache,"CareGanga-Center-Settlement-"+month+"-"+
    Crypto.randomUUID()+".csv");
   file.create();await file.write(bytes);
   await file.preview({title:"CareGanga current center statement"});
   setExportNotice("Your current center statement was verified for private viewing.");
  }catch(e){
   setExportNotice(e instanceof Error?e.message:
    "The current center statement could not be exported.");
  }finally{
   try{file?.delete();}catch{}
   setExporting(false);
  }
 }
 const approved=statement&&["APPROVED","PARTIALLY_SETTLED","SETTLED"].includes(statement.state);
 const items:readonly {label:string;amount:string|undefined}[]=statement?[
  {label:"Eligible completed services",amount:statement.centerGrossServicesMinor},
  {label:"Patient payment due to the center",amount:statement.patientPayableMinor},
  {label:"Verified center collection after refunds",amount:statement.patientCollectedVerifiedMinor},
  {label:"Verified center refunds",amount:statement.patientRefundedMinor},
  {label:"Patient collections confirmed by service partners",
   amount:statement.partnerPatientCollectedAttestedMinor},
  {label:"Foundation contribution for completed services",
   amount:statement.foundationApprovedLiabilityMinor},
  ...(approved?[
   {label:"Monthly approved Foundation claim",amount:statement.approvedFoundationMinor},
   ...(statement.adjustedFoundationMinor&&
     /^[0-9]{1,14}$/.test(statement.adjustedFoundationMinor)&&
     BigInt(statement.adjustedFoundationMinor)>0n?[
    {label:"Foundation claim before corrections",amount:statement.originalApprovedFoundationMinor},
    {label:"Confirmed corrections",amount:statement.adjustedFoundationMinor},
    {label:"Original gross payout",amount:statement.grossFoundationPaidMinor},
    {label:"Verified money returned to Foundation",
     amount:statement.verifiedProviderRecoveryMinor}
   ]:[]),
   {label:"Verified Foundation payout",amount:statement.actualPaidMinor},
   {label:"Remaining Foundation payout",amount:statement.outstandingMinor}
  ]:[{label:statement.state==="PROPOSED"?
    "Proposed claim awaiting approval":"Accrued contribution awaiting monthly claim",
    amount:statement.state==="PROPOSED"?
     statement.proposedClaimMinor??statement.eligibleAccruedMinor:
     statement.eligibleAccruedMinor}])
 ]:[];
 return <View style={styles.container}>
  <Text accessibilityRole="header" style={styles.title}>My Foundation contribution</Text>
  <Text style={styles.sub}>Only your currently assigned center. Patient collections
   are not Foundation income.</Text>
  <Text style={styles.sub}>Settlement month (YYYY-MM)</Text>
  <TextInput accessibilityLabel="Settlement month, year dash month"
   value={month} maxLength={7} onChangeText={setMonth}
   autoCorrect={false} placeholder="2026-11" style={styles.monthInput}/>
  <Pressable accessibilityRole="button" disabled={loading} onPress={()=>void load()}
   style={styles.button}><Text style={styles.link}>
    {loading?"Checking statement…":"Refresh statement"}</Text></Pressable>
  {!!statement&&<Pressable accessibilityRole="button"
   accessibilityLabel="Export authorized center settlement CSV"
   disabled={loading||exporting} onPress={()=>void exportCurrentStatement()}
   style={styles.button}>
   <Text style={styles.link}>{exporting?
    "Verifying current statement…":"Export my center statement (CSV)"}</Text>
  </Pressable>}
  {!!exportNotice&&<Text style={styles.sub}>{exportNotice}</Text>}
  {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
  {statement&&<>
   <Text style={styles.sub}>Claim status: {statement.state==="NOT_PREPARED"?
    "Not yet prepared":statement.state==="PROPOSED"?
    "Awaiting approval":
     (statement.effectiveState??statement.state).replaceAll("_"," ").toLowerCase()}</Text>
   {items.map(x=><View key={x.label} style={styles.row}>
    <Text style={styles.sub}>{x.label}</Text>
    <Text style={styles.amount}>{formatMoney(x.amount)}</Text>
   </View>)}
   <Text style={styles.sub}>{approved?
    "Only verified payments count as paid.":
    "Unapproved contributions are not yet confirmed payouts."}</Text>
  </>}
 </View>;
}
const styles=StyleSheet.create({
 container:{marginTop:14,padding:14,borderWidth:1,borderColor:t.border,
  backgroundColor:t.surface,borderRadius:14,gap:9},
 title:{fontSize:17,fontWeight:"800",color:t.text},
 sub:{fontSize:12,color:t.mutedText,lineHeight:18},
 button:{borderWidth:1,borderColor:t.border,borderRadius:10,minHeight:48,
  padding:12,justifyContent:"center",alignItems:"center"},
 link:{fontSize:14,fontWeight:"700",color:t.primary},
 error:{color:"#B91C1C",fontSize:12},
 monthInput:{borderWidth:1,borderColor:t.border,borderRadius:10,
  paddingHorizontal:12,paddingVertical:10,minHeight:48,fontSize:15,color:t.text},
 row:{gap:5,paddingVertical:7,borderBottomWidth:1,borderBottomColor:t.border},
 amount:{fontWeight:"800",fontSize:17,color:t.text}
});
