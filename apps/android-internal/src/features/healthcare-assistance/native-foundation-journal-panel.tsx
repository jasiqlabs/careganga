import {useCallback,useEffect,useState} from "react";
import {ActivityIndicator,Alert,Pressable,StyleSheet,Text,TextInput,View}
 from "react-native";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Year={yearRef:string;name:string};
type Account={accountRef:string;name:string;kind:"EXPENSE"|"LIABILITY"};
type Source={liabilityRef:string;postingDate:string;postingState:string;
 amountMinor:string;foundationJournalPosted:boolean;originalRequestKey:string;
 financialYears:Year[];accounts:Account[];complete:boolean};
type Props={token:string;centerRef:string;liabilityRef:string;
 onPosted:()=>Promise<void>;onExpired:()=>void};
async function api(token:string,path:string,body?:object){
 const res=await identityRequest(
  "/api/v1/healthcare-assistance/foundation-journals/"+path,{
   method:body?"POST":"GET",cache:"no-store",
   headers:{Authorization:"Bearer "+token,
    ...(body?{"Content-Type":"application/json"}:{})},
   body:body?JSON.stringify(body):undefined});
 if(!res.ok)throw Object.assign(new Error(
  res.status===401?"Sign in again to access Foundation accounting.":
  res.status===403?"Your current Foundation finance role cannot post this entry.":
  res.status===409?"Account, year or original source changed. Check its status.":
  "Journal outcome uncertain. Check the original CG09 record."),{status:res.status});
 return res.json() as Promise<unknown>;
}
function valid(v:unknown):v is Source{
 if(!v||typeof v!=="object"||Array.isArray(v))return false;
 const s=v as Partial<Source>;
 return typeof s.originalRequestKey==="string"&&ID.test(s.originalRequestKey)&&
  typeof s.postingDate==="string"&&
  typeof s.foundationJournalPosted==="boolean"&&
  Array.isArray(s.financialYears)&&s.financialYears.length<=20&&
  Array.isArray(s.accounts)&&s.accounts.length<=100&&
  typeof s.complete==="boolean";
}
/** CG09 original Foundation expense/payable posting only, independent of
 * CG17 patient cash, bank transfer and provider settlement.
 */
export function NativeFoundationJournalPanel({token,centerRef,liabilityRef,
 onPosted,onExpired}:Props){
 const [source,setSource]=useState<Source|null>(null);
 const [year,setYear]=useState(""),[expense,setExpense]=useState("");
 const [payable,setPayable]=useState(""),[search,setSearch]=useState("");
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [uncertain,setUncertain]=useState(false),[message,setMessage]=useState("");
 const base="centers/"+centerRef+"/liabilities/"+liabilityRef+"/";
 const report=useCallback((err:unknown)=>{
  if(err&&typeof err==="object"&&"status" in err&&err.status===401)onExpired();
  setMessage(err instanceof Error?err.message:"Original CG09 journal unavailable.");
 },[onExpired]);
 const load=useCallback(async()=>{
  const v=await api(token,base+"options");
  if(!valid(v))throw Error("Original CG09 account options are incomplete.");
  return v;
 },[token,base]);
 useEffect(()=>{
  let active=true;
  setLoading(true);setSource(null);setYear("");setExpense("");setPayable("");
  setUncertain(false);setSearch("");setMessage("");
  void load().then(v=>{if(active)setSource(v)})
   .catch(e=>{if(active)report(e)})
   .finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[load,report]);
 async function check(){
  if(busy)return;setBusy(true);setMessage("");
  try{
   const current=await load();setSource(current);
   if(current.foundationJournalPosted){setUncertain(false);await onPosted();}
   else setMessage("The original Foundation journal has not been posted.
    Check the same original request before another attempt.");
  }catch(e){report(e)}finally{setBusy(false)}
 }
 async function post(){
  if(busy||loading||uncertain||!source||!source.complete||
    source.foundationJournalPosted||
    !ID.test(year)||!ID.test(expense)||!ID.test(payable)||expense===payable)return;
  setBusy(true);setMessage("");
  try{
   const v=await api(token,base+"post",{
    requestKey:source.originalRequestKey,financialYearRef:year,
    expenseAccountRef:expense,liabilityAccountRef:payable});
   if(!v||typeof v!=="object"||!("foundationJournalPosted" in v)||
     v.foundationJournalPosted!==true)
    throw Error("Actual original Foundation journal posting is not confirmed.");
   setUncertain(false);
   setSource(await load());await onPosted();
   setMessage("Original CG09 balanced Foundation expense/payable journal posted.
    Provider bank payment has not been made.");
  }catch(e){
   const status=e&&typeof e==="object"&&"status" in e&&
    typeof e.status==="number"?e.status:503;
   setUncertain(status>=500);report(e);
  }finally{setBusy(false)}
 }
 const btn=(label:string,onPress:()=>void,disabled=false)=>
  <Pressable accessibilityRole="button" accessibilityState={{disabled}}
   disabled={disabled} style={[style.button,disabled&&style.disabled]}
   onPress={onPress}><Text style={style.buttonText}>{label}</Text></Pressable>;
 if(!ID.test(centerRef)||!ID.test(liabilityRef))return null;
 const accounts=source?.accounts.filter(a=>a.name.toLowerCase().includes(
  search.trim().toLowerCase()))??[];
 return <View style={style.panel}>
  <Text accessibilityRole="header" style={style.title}>Post approved liability to Accounts</Text>
  <Text style={style.note}>CG09 Foundation expense and payable only.
   No patient receipt or provider bank disbursement is posted here.</Text>
  {loading&&<ActivityIndicator accessibilityLabel="Checking CG09 accounts"/>}
  {!!message&&<Text accessibilityRole="alert" style={style.note}>{message}</Text>}
  {source?.foundationJournalPosted&&
   <Text style={style.note}>The original balanced CG09 journal is posted.</Text>}
  {source&&!source.foundationJournalPosted&&<>
   <Text style={style.note}>Original accounting date: {source.postingDate}.
    Approved Foundation liability: ₹{(Number(source.amountMinor)/100).toFixed(2)}.</Text>
   {!source.complete&&<Text style={style.note}>The original account list exceeds this
    bounded view. Use the Foundation Web page before posting.</Text>}
   {source.financialYears.length===0&&
    <Text style={style.note}>No active CG09 financial year covers this original
     service date; this liability must remain pending.</Text>}
   <Text style={style.heading}>Actual financial year</Text>
   {source.financialYears.map(y=><View key={y.yearRef}>
    {btn((year===y.yearRef?"Selected: ":"")+y.name,()=>setYear(y.yearRef),
     busy||uncertain)}</View>)}
   <TextInput style={style.input} accessibilityLabel="Find Foundation account"
    placeholder="Search Foundation expense or payable accounts"
    value={search} onChangeText={setSearch}
    editable={!busy&&!uncertain}/>
   <Text style={style.heading}>Foundation healthcare expense account</Text>
   {accounts.filter(a=>a.kind==="EXPENSE").slice(0,12).map(a=>
    <View key={a.accountRef}>
     {btn((expense===a.accountRef?"Selected: ":"")+a.name,
      ()=>setExpense(a.accountRef),busy||uncertain)}</View>)}
   <Text style={style.heading}>Foundation provider payable account</Text>
   {accounts.filter(a=>a.kind==="LIABILITY").slice(0,12).map(a=>
    <View key={a.accountRef}>
     {btn((payable===a.accountRef?"Selected: ":"")+a.name,
      ()=>setPayable(a.accountRef),busy||uncertain)}</View>)}
   {!uncertain&&btn("Post original approved liability",()=>
    Alert.alert("Post this approved Foundation liability?",
     "Only the actual original Foundation expense and payable accounts "+
     "are posted. No patient money or provider payment is recorded.",[
      {text:"Cancel",style:"cancel"},
      {text:"Post",onPress:()=>void post()}]),
    busy||!source.complete||!ID.test(year)||!ID.test(expense)||
    !ID.test(payable)||expense===payable)}
   {uncertain&&<Text accessibilityRole="alert" style={style.note}>
    Original result unknown; check the source before retrying.
    Never make a second journal using a different key.</Text>}
  </>}
  {btn("Check original CG09 posting",()=>void check(),busy||loading)}
 </View>;
}
const style=StyleSheet.create({
 panel:{backgroundColor:t.surface,borderColor:t.border,borderWidth:1,
  borderRadius:12,padding:12,gap:10},
 title:{fontSize:16,fontWeight:"700",color:t.text},
 heading:{fontSize:14,fontWeight:"700",color:t.text},
 note:{fontSize:13,lineHeight:20,color:t.mutedText},
 input:{minHeight:48,borderWidth:1,borderColor:t.border,borderRadius:10,
  paddingHorizontal:10,color:t.text,backgroundColor:t.surface},
 button:{minHeight:46,justifyContent:"center",padding:10,
  borderWidth:1,borderColor:t.border,borderRadius:10},
 buttonText:{fontSize:13,fontWeight:"600",color:t.text},
 disabled:{opacity:0.45}
});
