import {useCallback,useEffect,useRef,useState} from "react";
import {Pressable,StyleSheet,Text,View} from "react-native";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";
import {NativeFinanceOptions} from "../finance-accounting/finance-native-source-kit";

type Statement={
 month:string;state:string;approvedFoundationMinor:string;
 actualPaidMinor:string;outstandingMinor:string;
 eligibleAccruedMinor?:string;centerGrossServicesMinor?:string;
 patientPayableMinor?:string;foundationApprovedLiabilityMinor?:string;
 patientCollectionNotFoundationIncome:true
};
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const initialMonth=()=>{
 const d=new Date();
 return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");
};
const monthChoices=()=>{
 const current=new Date();
 return Array.from({length:12},(_,index)=>{
  const date=new Date(current.getFullYear(),current.getMonth()-index,1);
  const value=date.getFullYear()+"-"+String(date.getMonth()+1).padStart(2,"0");
  return {ref:value,label:date.toLocaleDateString("en-IN",{month:"long",year:"numeric"})};
 });
};
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
 const [error,setError]=useState("");
 const seq=useRef(0);
 const load=useCallback(async()=>{
  const generation=++seq.current;
  setStatement(null);setError("");setLoading(true);
  if(!ID.test(centerRef)){
   setLoading(false);setError("Select an assigned verified center.");return;
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
 const approved=statement&&["APPROVED","PARTIALLY_SETTLED","SETTLED"].includes(statement.state);
 const items:readonly {label:string;amount:string|undefined}[]=statement?[
  {label:"Eligible completed services",amount:statement.centerGrossServicesMinor},
  {label:"Patient payment due to the center",amount:statement.patientPayableMinor},
  {label:"Foundation contribution for completed services",
   amount:statement.foundationApprovedLiabilityMinor},
  ...(approved?[
   {label:"Monthly approved Foundation claim",amount:statement.approvedFoundationMinor},
   {label:"Verified Foundation payout",amount:statement.actualPaidMinor},
   {label:"Remaining Foundation payout",amount:statement.outstandingMinor}
  ]:[{label:statement.state==="PROPOSED"?
    "Proposed claim awaiting approval":"Accrued contribution awaiting monthly claim",
    amount:statement.eligibleAccruedMinor}])
 ]:[];
 return <View style={styles.container}>
  <Text accessibilityRole="header" style={styles.title}>My Foundation contribution</Text>
  <Text style={styles.sub}>Only your currently assigned center. Patient collections
   are not Foundation income.</Text>
  <NativeFinanceOptions label="Settlement month" value={month}
   options={monthChoices()} onChange={setMonth}/>
  <Pressable accessibilityRole="button" disabled={loading} onPress={()=>void load()}
   style={styles.button}><Text style={styles.link}>
    {loading?"Checking statement…":"Refresh statement"}</Text></Pressable>
  {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
  {statement&&<>
   <Text style={styles.sub}>Claim status: {statement.state==="NOT_PREPARED"?
    "Not yet prepared":statement.state==="PROPOSED"?
    "Awaiting approval":statement.state.replaceAll("_"," ").toLowerCase()}</Text>
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
 row:{gap:5,paddingVertical:7,borderBottomWidth:1,borderBottomColor:t.border},
 amount:{fontWeight:"800",fontSize:17,color:t.text}
});
