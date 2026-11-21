import {useCallback,useEffect,useRef,useState} from "react";
import {ActivityIndicator,Alert,Pressable,StyleSheet,Text,View} from "react-native";
import * as Crypto from "expo-crypto";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";
type Bank={bankMatchRef:string;bankItemLabel:string;statementDate:string;
 amountMinor:string};
type Prior={bankMatchRef:string;bankItemLabel:string;amountMinor:string;
 verifiedAt:string};
type Options={settlementRef:string;state:string;outstandingMinor:string;
 actualPaidMinor:string;protectedDestinationLabel:string;
 bankDisbursements:Bank[];payoutHistory:Prior[];complete:boolean};
type Props={token:string;centerRef:string;month:string;
 onExpired:()=>void;onApplied:()=>Promise<void>};
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const money=(minor:string)=>"₹"+(Number(minor)/100).toFixed(2);
const api=async(token:string,path:string,body?:object)=>{
 const response=await identityRequest(
  "/api/v1/healthcare-assistance/provider-settlements/"+path,{
   method:body?"POST":"GET",cache:"no-store",
   headers:{Authorization:"Bearer "+token,
    ...(body?{"Content-Type":"application/json"}:{})},
   body:body?JSON.stringify(body):undefined});
 if(!response.ok)throw Object.assign(new Error(
  response.status===401?"Sign in again to view private bank proof.":
  response.status===403?"You cannot confirm this Foundation bank payment.":
  response.status===409?"The original reconciliation or payable amount changed.":
  "Verified provider bank proof could not be confirmed."),{status:response.status});
 return response.json() as Promise<unknown>;
};
/** Staff-only CG17->CG09 original verified bank reconciliation allocation.
 * Never initiates a transfer, guesses a beneficiary, or posts patient cash.
 */
export function NativeVerifiedProviderPayout({token,centerRef,month,
 onExpired,onApplied}:Props){
 const [data,setData]=useState<Options|null>(null);
 const [bankRef,setBankRef]=useState(""),[attested,setAttested]=useState(false);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [uncertain,setUncertain]=useState(false);
 const [message,setMessage]=useState("");
 const request=useRef<{bankRef:string;requestKey:string}|null>(null);
 const path="centers/"+centerRef+"/months/"+month+"/";
 const report=useCallback((e:unknown)=>{
  if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
  setMessage(e instanceof Error?e.message:"Verified original bank proof unavailable.");
 },[onExpired]);
 const load=useCallback(async()=>{
  const raw=await api(token,path+"payout-options");
  if(!raw||typeof raw!=="object"||Array.isArray(raw)||
   !("bankDisbursements" in raw)||!Array.isArray(raw.bankDisbursements)||
   !("payoutHistory" in raw)||!Array.isArray(raw.payoutHistory)||
   !("protectedDestinationLabel" in raw)||
   typeof raw.protectedDestinationLabel!=="string")
   throw Error("Original provider payout and CG14 bank proof are incomplete.");
  return raw as Options;
 },[token,path]);
 useEffect(()=>{
  let active=true;
  void load().then(x=>{if(active)setData(x)})
   .catch(e=>{if(active)report(e)})
   .finally(()=>{if(active)setLoading(false)});
  return()=>{active=false;};
 },[load,report]);
 async function refresh(){
  if(busy)return;
  setBusy(true);setMessage("");
  try{
   const next=await load();setData(next);setUncertain(false);
   if(request.current&&next.payoutHistory.some(x=>
    x.bankMatchRef===request.current?.bankRef)){
    request.current=null;setAttested(false);setBankRef("");
    setMessage("The original provider bank payment was already recorded.");
    await onApplied();
   }
  }catch(e){report(e)}
  finally{setBusy(false);}
 }
 async function confirm(){
  if(busy||uncertain||!data||!ID.test(bankRef)||!attested)return;
  if(!data.bankDisbursements.some(x=>x.bankMatchRef===bankRef))return;
  if(!request.current||request.current.bankRef!==bankRef)
   request.current={bankRef,requestKey:Crypto.randomUUID()};
  setBusy(true);setMessage("");
  try{
   const raw=await api(token,path+"confirm-payout",{
    requestKey:request.current.requestKey,bankMatchRef:bankRef,payeeMatched:true});
   if(!raw||typeof raw!=="object"||!("state" in raw)||
    !["PARTIALLY_SETTLED","SETTLED"].includes(String(raw.state)))
    throw Error("Original verified payout state could not be confirmed.");
   request.current=null;setUncertain(false);setBankRef("");setAttested(false);
   setData(await load());
   setMessage("Existing independently verified Foundation bank payment linked. "+
    "No new transfer was initiated.");
   await onApplied();
  }catch(e){
   const code=e&&typeof e==="object"&&"status" in e&&
    typeof e.status==="number"?e.status:503;
   setUncertain(code>=500);
   if(code<500)request.current=null;
   report(e);
  }finally{setBusy(false);}
 }
 const button=(label:string,action:()=>void,disabled=false)=>
  <Pressable accessibilityRole="button" accessibilityState={{disabled}}
   disabled={disabled} onPress={action} style={[styles.button,
    disabled&&styles.disabled]}><Text style={styles.buttonText}>{label}</Text></Pressable>;
 return <View style={styles.panel}>
  <Text accessibilityRole="header" style={styles.heading}>
   Actual verified provider bank payment</Text>
  <Text style={styles.note}>This uses only an independently verified
   CG09 bank reconciliation. It does not initiate a transfer or record
   center-collected patient money as Foundation income.</Text>
  {loading&&<ActivityIndicator accessibilityLabel="Checking verified bank payment"/>}
  {!!message&&<Text accessibilityRole="alert" style={styles.note}>{message}</Text>}
  {data&&<>
   <Text style={styles.note}>Protected CG14 beneficiary reference: {
    data.protectedDestinationLabel}. Check the original bank statement
    beneficiary against the current scanned provider instruction.</Text>
   <Text style={styles.amount}>Claim still unpaid: {money(data.outstandingMinor)}</Text>
   {data.payoutHistory.map(x=><View style={styles.history} key={x.bankMatchRef}>
    <Text style={styles.amount}>{x.bankItemLabel}: {money(x.amountMinor)}</Text>
    <Text style={styles.note}>Verified on {
     new Date(x.verifiedAt).toLocaleDateString("en-IN")}</Text>
   </View>)}
   {data.state!=="SETTLED"&&<>
    {data.bankDisbursements.length===0&&<Text style={styles.note}>
     No independently verified bank disbursement within the approved
     remaining amount is available. Do not assert a provider payment.</Text>}
    {data.bankDisbursements.map(x=><View key={x.bankMatchRef}>
     {button((bankRef===x.bankMatchRef?"Selected: ":"Select: ")+
      x.bankItemLabel+" — "+money(x.amountMinor),
      ()=>{setBankRef(x.bankMatchRef);setAttested(false);
       if(request.current?.bankRef!==x.bankMatchRef)request.current=null},
      busy||uncertain)}
     <Text style={styles.note}>Bank statement date: {x.statementDate}</Text>
    </View>)}
    {!!bankRef&&button(attested?"Beneficiary match confirmed":
     "Confirm bank beneficiary matches protected CG14 proof",
     ()=>setAttested(v=>!v),busy||uncertain)}
    {!uncertain&&!!bankRef&&attested&&button(
     "Link original verified bank payout",()=>
      Alert.alert("Confirm actual verified provider payment?",
       "You have checked the original bank beneficiary and the "+
       "independently verified CG09 statement. This only links the payment; "+
       "it does not initiate a bank transfer.",[
        {text:"Cancel",style:"cancel"},
        {text:"Confirm verified payment",onPress:()=>void confirm()}]),
     busy)}
   </>}
  </>}
  {uncertain&&<Text accessibilityRole="alert" style={styles.note}>
   The last allocation may have been recorded. Check the same original
   bank item before retrying. Do not record another transfer.</Text>}
  {button("Recheck original verified bank proof",()=>void refresh(),busy)}
 </View>;
}
const styles=StyleSheet.create({
 panel:{gap:9,padding:12,backgroundColor:t.surface,borderWidth:1,
  borderColor:t.border,borderRadius:12},
 heading:{color:t.text,fontSize:16,fontWeight:"700"},
 amount:{color:t.text,fontSize:14,fontWeight:"600"},
 note:{color:t.mutedText,fontSize:13,lineHeight:20},
 history:{borderBottomWidth:1,borderColor:t.border,paddingVertical:6},
 button:{minHeight:48,justifyContent:"center",borderWidth:1,
  borderColor:t.border,borderRadius:9,padding:10},
 buttonText:{fontSize:13,fontWeight:"600",color:t.text},
 disabled:{opacity:0.45}
});
