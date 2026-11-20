import {useCallback,useEffect,useRef,useState} from "react";
import {ActivityIndicator,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import * as Crypto from "expo-crypto";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";

type Payment={collectionRef:string;method:"CASH"|"UPI"|"CARD"|"BANK";
 amountMinor:string;state:string;cashReceiptNumber:string|null;recordedAt:string;
 receiptPdfState:string};
type Adjustment={adjustmentRef:string;collectionRef:string;amountMinor:string;
 kind:string;refundReceiptNumber:string;recordedAt:string};
type Statement={chargeRef:string;currency:"INR";patientDueMinor:string;
 collectedMinor:string;outstandingMinor:string;pendingElectronicMinor:string;
 refundedOrCorrectedMinor:string;state:string;collections:Payment[];
 adjustments:Adjustment[];foundationIncomeRecorded:false;foundationLiabilityCreated:false};
type Attempt={path:string;body:Record<string,unknown>};
type Props={token:string;centerRef:string;chargeRef:string;canRecord:boolean;
 canRefund:boolean;onExpired:()=>void};
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const CASH_RECEIPT=/^[A-Za-z0-9][A-Za-z0-9/_-]{3,59}$/;
const amount=(v:string)=>{
 if(!/^(0|[1-9]\d{0,7})(?:\.\d{1,2})?$/.test(v))
  throw Error("Enter a valid rupee amount with at most two decimals.");
 const [whole,fraction=""]=v.split(".");
 const minor=BigInt(whole)*100n+BigInt((fraction+"00").slice(0,2));
 if(minor<1n||minor>10000000000n)throw Error("Check the collection amount.");
 return minor.toString();
};
const rupees=(v:string)=>"₹"+(Number(v)/100).toFixed(2);
function confirmed(v:unknown):v is Statement{
 if(!v||typeof v!=="object"||Array.isArray(v))return false;
 const x=v as Partial<Statement>;
 const minor=(s:unknown)=>typeof s==="string"&&/^(0|[1-9]\d{0,10})$/.test(s);
 return x.currency==="INR"&&minor(x.patientDueMinor)&&minor(x.collectedMinor)&&
  minor(x.outstandingMinor)&&minor(x.pendingElectronicMinor)&&
  minor(x.refundedOrCorrectedMinor)&&
  BigInt(x.patientDueMinor!)===BigInt(x.collectedMinor!)+BigInt(x.outstandingMinor!)&&
  Array.isArray(x.collections)&&x.collections.length<=50&&
  Array.isArray(x.adjustments)&&x.adjustments.length<=50&&
  x.foundationIncomeRecorded===false&&x.foundationLiabilityCreated===false;
}
async function api(token:string,path:string,body?:Record<string,unknown>){
 const result=await identityRequest(
  "/api/v1/healthcare-assistance/center-collections/"+path,{
   method:body?"POST":"GET",cache:"no-store",
   headers:{Authorization:"Bearer "+token,
    ...(body?{"Content-Type":"application/json"}:{})},
   body:body?JSON.stringify(body):undefined
  });
 if(!result.ok)throw Object.assign(new Error(
  result.status===401?"Sign in again to view center collections.":
  result.status===403?"This center or cashier permission is not available.":
  result.status===404?"The accepted consultation charge could not be found.":
  result.status===409?"Payment evidence changed. Check the current statement.":
  result.status===400?"Check the amount and cash-receipt details.":
  "The payment outcome is uncertain. Check its original statement before retrying."
 ),{status:result.status});
 return result.json() as Promise<unknown>;
}
/** Native staff equivalent of CG17 US004: only the original source, no
 * Foundation income, no payment provider assertion, no fabricated PDF.
 */
export function NativeCenterCollectionWorkspace({token,centerRef,chargeRef,
 canRecord,canRefund,onExpired}:Props){
 const [data,setData]=useState<Statement|null>(null);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [uncertain,setUncertain]=useState(false),[message,setMessage]=useState("");
 const [method,setMethod]=useState<"CASH"|"UPI"|"CARD"|"BANK">("CASH");
 const [paid,setPaid]=useState(""),[receipt,setReceipt]=useState("");
 const [payerRef,setPayerRef]=useState(""),[cashAttested,setCashAttested]=useState(false);
 const [refundRef,setRefundRef]=useState(""),[refundPaid,setRefundPaid]=useState("");
 const [refundReceipt,setRefundReceipt]=useState("");
 const [reason,setReason]=useState(""),[refundAttested,setRefundAttested]=useState(false);
 const last=useRef<Attempt|null>(null),generation=useRef(0);
 const base="staff/centers/"+centerRef+"/";
 const validIds=ID.test(centerRef)&&ID.test(chargeRef);
 const report=useCallback((e:unknown)=>{
  if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
  setMessage(e instanceof Error?e.message:"The center's original payment is unavailable.");
 },[onExpired]);
 const refresh=useCallback(async()=>{
  if(!validIds)throw Error("The original consultation reference is not valid.");
  const reply=await api(token,base+"charges/"+chargeRef);
  if(!confirmed(reply))throw Error("The center collection statement is incomplete.");
  return reply;
 },[token,base,chargeRef,validIds]);
 useEffect(()=>{
  let live=true;const stamp=++generation.current;
  setLoading(true);setUncertain(false);setData(null);setMessage("");
  last.current=null;
  void refresh().then(v=>{if(live&&stamp===generation.current)setData(v);})
   .catch(e=>{if(live&&stamp===generation.current)report(e)})
   .finally(()=>{if(live&&stamp===generation.current)setLoading(false)});
  return()=>{live=false;++generation.current;};
 },[refresh,report]);
 async function check(){
  if(busy)return;setBusy(true);setMessage("");
  try{const v=await refresh();setData(v);setUncertain(false);last.current=null;}
  catch(e){report(e);}finally{setBusy(false);}
 }
 async function submit(command:Attempt){
  if(busy)return;setBusy(true);setMessage("");
  try{
   const reply=await api(token,command.path,command.body);
   if(!reply||typeof reply!=="object"||!("statement" in reply)||
     !confirmed(reply.statement))
    throw Error("The original payment response could not be confirmed.");
   setData(reply.statement);setUncertain(false);last.current=null;
   setPaid("");setReceipt("");setPayerRef("");setCashAttested(false);
   setRefundRef("");setRefundPaid("");setRefundReceipt("");
   setReason("");setRefundAttested(false);
   setMessage("Original center collection updated. Patient receipt PDF is "+
    "separate; no Foundation money or settlement was recorded.");
  }catch(e){
   const code=e&&typeof e==="object"&&"status" in e&&
    typeof e.status==="number"?e.status:503;
   setUncertain(code>=500);if(code<500)last.current=null;
   report(e);
  }finally{setBusy(false);}
 }
 function record(){
  if(!canRecord||!data||busy||uncertain)return;
  try{
   const minor=amount(paid);
   if(BigInt(minor)>BigInt(data.outstandingMinor))
    throw Error("The amount exceeds what the patient currently owes.");
   if(method==="CASH"&&(!cashAttested||!CASH_RECEIPT.test(receipt.trim())))
    throw Error("Confirm actual cash received and enter its unique receipt number.");
   if(method!=="CASH"&&payerRef.length>100)
    throw Error("Electronic reference is too long.");
   const command:Attempt={
    path:base+"charges/"+chargeRef+"/record",
    body:{requestKey:Crypto.randomUUID(),method,amountMinor:minor,
     ...(method==="CASH"?
      {cashReceived:true,cashReceiptNumber:receipt.trim()}:
      {payerReference:payerRef.trim()})}
   };
   last.current=command;void submit(command);
  }catch(e){report(e);}
 }
 function refund(){
  if(!canRefund||busy||uncertain||!refundAttested)return;
  try{
   if(!ID.test(refundRef)||!CASH_RECEIPT.test(refundReceipt.trim())||
      reason.trim().length<8||reason.trim().length>400)
    throw Error("Choose a cash collection and enter a refund receipt and reason.");
   const minor=amount(refundPaid);
   const selected=data?.collections.find(c=>c.collectionRef===refundRef&&
    c.method==="CASH"&&c.state==="VERIFIED_CASH");
   if(!selected||BigInt(minor)>BigInt(selected.amountMinor))
    throw Error("The refund must not exceed the original cash collection.");
   const command:Attempt={
    path:base+"collections/"+refundRef+"/refund",
    body:{requestKey:Crypto.randomUUID(),kind:"CASH_REFUND",refundMinor:minor,
     refundReceiptNumber:refundReceipt.trim(),reason:reason.trim(),cashReturned:true}
   };
   last.current=command;void submit(command);
  }catch(e){report(e);}
 }
 const button=(text:string,action:()=>void,disabled=false)=>
  <Pressable accessibilityRole="button" disabled={disabled}
   accessibilityState={{disabled}} onPress={action}
   style={[styles.button,disabled&&styles.disabled]}>
   <Text style={styles.buttonText}>{text}</Text>
  </Pressable>;
 if(!validIds)return null;
 return <View style={styles.panel}>
  <Text accessibilityRole="header" style={styles.title}>Patient payment at this center</Text>
  <Text style={styles.note}>Staff-only, original patient payable amount. Cash must be
   physically received; UPI/card/bank references remain pending until real provider proof.
   The Foundation has not received this money.</Text>
  {loading&&<ActivityIndicator accessibilityLabel="Checking original payment"/>}
  {!!message&&<Text accessibilityRole="alert" style={styles.note}>{message}</Text>}
  {data&&<>
   <Text style={styles.amount}>Original patient due: {rupees(data.patientDueMinor)}</Text>
   <Text style={styles.amount}>Actually collected: {rupees(data.collectedMinor)}</Text>
   <Text style={styles.amount}>Still due: {rupees(data.outstandingMinor)}</Text>
   <Text style={styles.note}>Electronic pending: {rupees(data.pendingElectronicMinor)}.
    Refunds/corrections: {rupees(data.refundedOrCorrectedMinor)}.
    Status: {data.state.replaceAll("_"," ")}.</Text>
   {canRecord&&BigInt(data.outstandingMinor)>0n&&<View style={styles.form}>
    <Text style={styles.heading}>Record actual center collection</Text>
    <View style={styles.row}>{(["CASH","UPI","CARD","BANK"] as const).map(m=>
     <View key={m}>{button(m,()=>setMethod(m),busy||uncertain)}</View>)}</View>
    <Text style={styles.note}>Selected method: {method}</Text>
    <TextInput accessibilityLabel="Amount received in rupees" style={styles.input}
     keyboardType="decimal-pad" placeholder="Amount in rupees" value={paid}
     onChangeText={setPaid} editable={!busy&&!uncertain}/>
    {method==="CASH"?<>
     <TextInput accessibilityLabel="Unique cash receipt number" style={styles.input}
      placeholder="Actual cash receipt number" value={receipt}
      onChangeText={setReceipt} editable={!busy&&!uncertain}/>
     {button(cashAttested?"Cash receipt confirmed":"Confirm cash was actually received",
      ()=>setCashAttested(x=>!x),busy||uncertain)}
    </>:<TextInput accessibilityLabel="Electronic payment reference" style={styles.input}
     placeholder="Provider reference (pending verification)" value={payerRef}
     onChangeText={setPayerRef} editable={!busy&&!uncertain}/>}
    {button("Record center payment",record,busy||uncertain||
     (method==="CASH"&&!cashAttested))}
   </View>}
   <Text style={styles.heading}>Original collection history</Text>
   {data.collections.length===0&&<Text style={styles.note}>No center collection recorded.</Text>}
   {data.collections.map(item=><View style={styles.history} key={item.collectionRef}>
    <Text style={styles.amount}>{item.method}: {rupees(item.amountMinor)}</Text>
    <Text style={styles.note}>{item.state.replaceAll("_"," ")}.
     {item.cashReceiptNumber?" Cash receipt: "+item.cashReceiptNumber:""}
     {" Document: "+item.receiptPdfState.replaceAll("_"," ")}</Text>
    {canRefund&&item.method==="CASH"&&item.state==="VERIFIED_CASH"&&
     button(refundRef===item.collectionRef?"Selected for refund":"Select cash refund",
      ()=>setRefundRef(item.collectionRef),busy||uncertain)}
   </View>)}
   {canRefund&&!!refundRef&&<View style={styles.form}>
    <Text style={styles.heading}>Actual cash refund or correction</Text>
    <TextInput accessibilityLabel="Refund amount rupees" style={styles.input}
     placeholder="Amount returned in rupees" value={refundPaid}
     onChangeText={setRefundPaid} keyboardType="decimal-pad"/>
    <TextInput accessibilityLabel="Unique refund receipt number" style={styles.input}
     placeholder="Refund receipt number" value={refundReceipt}
     onChangeText={setRefundReceipt}/>
    <TextInput accessibilityLabel="Reason for refund" style={styles.input}
     placeholder="Reason" value={reason} onChangeText={setReason}/>
    {button(refundAttested?"Cash refund confirmed":"Confirm cash was actually returned",
     ()=>setRefundAttested(x=>!x),busy||uncertain)}
    {button("Record original refund",refund,busy||uncertain||!refundAttested)}
   </View>}
   {data.adjustments.length>0&&<Text style={styles.heading}>Refund history</Text>}
   {data.adjustments.map(x=><Text key={x.adjustmentRef} style={styles.note}>
    {x.kind.replaceAll("_"," ")}: {rupees(x.amountMinor)} — {x.refundReceiptNumber}
   </Text>)}
  </>}
  {button("Refresh original payment status",()=>void check(),busy||loading)}
  {uncertain&&last.current&&<>
   <Text style={styles.note}>The last submission might have succeeded.
    Use exactly its original request; do not create a second receipt.</Text>
   {button("Retry the same original request",()=>void submit(last.current!),busy)}
  </>}
 </View>;
}
const styles=StyleSheet.create({
 panel:{backgroundColor:t.surface,borderColor:t.border,borderWidth:1,
  borderRadius:12,padding:12,gap:10},
 title:{fontSize:16,fontWeight:"700",color:t.text},
 heading:{fontSize:14,fontWeight:"700",color:t.text},
 note:{fontSize:13,lineHeight:19,color:t.mutedText},
 amount:{fontSize:14,fontWeight:"600",color:t.text},
 form:{gap:8,padding:10,borderRadius:10,borderWidth:1,borderColor:t.border},
 history:{gap:4,padding:8,borderBottomWidth:1,borderColor:t.border},
 row:{flexDirection:"row",flexWrap:"wrap",gap:6},
 input:{minHeight:48,borderWidth:1,borderColor:t.border,borderRadius:9,
  paddingHorizontal:10,color:t.text,backgroundColor:t.surface},
 button:{minHeight:46,borderRadius:9,borderWidth:1,borderColor:t.border,
  paddingHorizontal:10,paddingVertical:9,justifyContent:"center"},
 buttonText:{fontSize:13,fontWeight:"600",color:t.text},
 disabled:{opacity:0.45}
});
