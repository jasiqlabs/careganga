import {useCallback,useEffect,useState} from "react";
import {ActivityIndicator,BackHandler,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import * as Crypto from "expo-crypto";
import {File,Paths} from "expo-file-system";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";
type Case={caseRef:string;reference:string;claimCategory:string;status:string;revision:number};
type Detail=Case&{billFileRef:string;billVersion:number;claim:{
 claimNumber:string;purpose:string;category:string;expenseDate:string;amountMinor:string}};
type Pending={key:string;caseRef:string;body:Record<string,unknown>};
const money=(s:string)=>{try{let n=BigInt(s);return "₹"+(n/100n).toLocaleString("en-IN")+
 "."+(n%100n).toString().padStart(2,"0");}catch{return "Amount unavailable";}};
async function call<T>(token:string,path:string,method:"GET"|"POST"="GET",body?:Record<string,unknown>){
 let r:Response;
 try{r=await identityRequest(path,{method,cache:"no-store",
  headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},
  ...(body?{body:JSON.stringify(body)}:{})});}
 catch{throw Error("UNKNOWN");}
 if(r.status===401)throw Error("EXPIRED");
 if(!r.ok){
  const value:unknown=await r.json().catch(()=>null);
  if(value&&typeof value==="object"&&!Array.isArray(value)&&
    "code" in value&&typeof value.code==="string"&&value.code.startsWith("FINANCE_")&&
    "message" in value&&typeof value.message==="string")throw Error("USER:"+value.message);
  throw Error(r.status===403?"DENIED":r.status===409?"CHANGED":"UNKNOWN");
 }
 return await r.json() as T;
}
const friendly=(e:unknown)=>{
 const k=e instanceof Error?e.message:"UNKNOWN";
 return k.startsWith("USER:")?k.slice(5):
  k==="EXPIRED"?"Session expired. Sign in again.":
  k==="DENIED"?"A currently authorized different Foundation reviewer is required.":
  k==="CHANGED"?"This original case or private file changed. Refresh before deciding.":
  "The original reviewer result is uncertain. Check its current case state before retrying.";
};
export function FinanceClaimNativeReviewer({token,onExit,onExpired}:{
 token:string;onExit:()=>void;onExpired:()=>void}){
 const [rows,setRows]=useState<Case[]>([]);
 const [page,setPage]=useState(0);
 const [nextPage,setNextPage]=useState<number|null>(null);
 const [selected,setSelected]=useState<Detail|null>(null);
 const [decision,setDecision]=useState<"APPROVE"|"RETURN"|"REJECT">("APPROVE");
 const [remarks,setRemarks]=useState("");
 const [password,setPassword]=useState("");
 const [pending,setPending]=useState<Pending|null>(null);
 const [notice,setNotice]=useState("");
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(false);
 const [busy,setBusy]=useState(false);
 const load=useCallback(async()=>{
  setLoading(true);setError("");
  try{
   const result=await call<{cases:Case[];nextOffset:number|null}>(token,
    "/api/approvals/finance-claims/cases?offset="+page);
   if(!Array.isArray(result.cases)||!(result.nextOffset===null||
     Number.isSafeInteger(result.nextOffset)))throw Error("UNKNOWN");
   setRows(result.cases);setNextPage(result.nextOffset);
  }catch(e){setRows([]);setNextPage(null);setError(friendly(e));
   if(e instanceof Error&&e.message==="EXPIRED")onExpired();}
  finally{setLoading(false);}
 },[token,page,onExpired]);
 useEffect(()=>{void load();},[load]);
 useEffect(()=>{
  const back=BackHandler.addEventListener("hardwareBackPress",()=>{
   if(busy||pending)return true;
   if(selected){setSelected(null);setPassword("");}
   else onExit();return true;
  });
  return()=>back.remove();
 },[busy,pending,selected,onExit]);
 async function open(c:Case){
  if(busy)return;
  setBusy(true);setError("");setNotice("");
  try{
   const info=await call<Detail>(token,
    "/api/approvals/finance-claims/cases/"+c.caseRef);
   if(!info.claim||!info.billFileRef||!info.reference)throw Error("UNKNOWN");
   setSelected(info);setPassword("");setRemarks("");setDecision("APPROVE");
   setPending(null);
  }catch(e){setError(friendly(e));
   if(e instanceof Error&&e.message==="EXPIRED")onExpired();}
  finally{setBusy(false);}
 }
 async function openBill(){
  if(!selected||busy)return;
  setBusy(true);setError("");
  let file:File|null=null;
  try{
   const res=await identityRequest(
    "/api/documents/finance-claim-bills/review/files/"+selected.billFileRef+"/download",
    {headers:{Authorization:"Bearer "+token},cache:"no-store"});
   if(res.status===401){onExpired();return;}
   if(!res.ok)throw Error(res.status===403?"DENIED":"UNKNOWN");
   const type=res.headers.get("content-type")?.split(";")[0]??"";
   if(!["application/pdf","image/jpeg","image/png","image/webp"].includes(type))
    throw Error("UNKNOWN");
   const bytes=new Uint8Array(await res.arrayBuffer());
   if(bytes.length===0||bytes.length>10485760)throw Error("UNKNOWN");
   file=new File(Paths.cache,"careganga-claim-review-"+Crypto.randomUUID()+
    (type==="application/pdf"?".pdf":type==="image/png"?".png":
      type==="image/jpeg"?".jpg":".webp"));
   file.create();await file.write(bytes);
   await file.preview({title:"Original protected reimbursement bill"});
  }catch(e){setError(friendly(e));}finally{try{file?.delete();}catch{}setBusy(false);}
 }
 async function send(value:Pending){
  if(busy)return;
  setBusy(true);setNotice("");setError("");
  try{
   const response=await call<{confirmed:boolean;status:string}>(token,
    "/api/approvals/finance-claims/cases/"+value.caseRef+"/decisions",
    "POST",{...value.body,requestKey:value.key});
   if(!response.confirmed)throw Error("UNKNOWN");
   setPending(null);setSelected(null);setPassword("");setRemarks("");
   setNotice("Original protected decision confirmed: "+response.status+
    ". No money has been posted or marked paid.");
   await load();
  }catch(e){setPending(value);setPassword("");setError(friendly(e));
   if(e instanceof Error&&e.message==="EXPIRED")onExpired();}
  finally{setBusy(false);}
 }
 return <SafeAreaView style={s.safe} edges={["top","bottom"]}>
  <View style={s.header}>
   <Pressable style={s.back} accessibilityRole="button" onPress={()=>{
    if(selected){setSelected(null);setPassword("");}else onExit();}}>
    <Text style={s.backText}>‹ Back</Text></Pressable>
   <View><Text style={s.eyebrow}>FOUNDATION / FINANCE</Text>
    <Text style={s.heading}>Claim Reviews</Text></View>
  </View>
  <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
   {notice&&<Text style={s.note} accessibilityRole="alert">{notice}</Text>}
   {error&&<Text style={s.alert} accessibilityRole="alert">{error}</Text>}
   {!selected?<View style={s.card}>
    <View style={s.row}><Text style={s.heading}>Protected review inbox</Text>
     <Pressable accessibilityRole="button" onPress={()=>void load()} disabled={loading}>
      <Text style={s.backText}>Refresh</Text></Pressable></View>
    {loading&&<ActivityIndicator color={t.primary}/>}
    {!loading&&!rows.length&&!error&&<Text style={s.note}>No original claims are awaiting review.</Text>}
    {rows.map(c=><Pressable accessibilityRole="button" key={c.caseRef}
     style={s.case} onPress={()=>void open(c)} disabled={busy}>
     <Text style={s.title}>{c.reference} · {c.claimCategory}</Text>
     <Text style={s.note}>{c.status==="PENDING_OWNER"?
      "Approved, awaiting Finance reconciliation":c.status}</Text>
     <Text style={s.backText}>Open verified claim</Text></Pressable>)}
    <View style={s.row}><Pressable accessibilityRole="button" disabled={page===0}
     onPress={()=>setPage(v=>Math.max(0,v-30))}><Text style={s.backText}>Previous</Text></Pressable>
     <Pressable accessibilityRole="button" disabled={nextPage===null}
      onPress={()=>setPage(nextPage??0)}><Text style={s.backText}>Next</Text></Pressable></View>
   </View>:<View style={s.card}>
    <Text style={s.heading}>Case {selected.reference}</Text>
    <Text style={s.title}>{selected.claim.claimNumber} · {selected.claim.category}</Text>
    <Text style={s.note}>Purpose: {selected.claim.purpose}</Text>
    <Text style={s.note}>Expense date: {selected.claim.expenseDate}</Text>
    <Text style={s.title}>Amount {money(selected.claim.amountMinor)}</Text>
    <Pressable accessibilityRole="button" style={s.button} disabled={busy}
     onPress={()=>void openBill()}><Text style={s.buttonText}>Open original private scanned bill</Text></Pressable>
    {["SUBMITTED","IN_REVIEW"].includes(selected.status)&&<>
     <View style={s.row}>
      {(["APPROVE","RETURN","REJECT"] as const).map(v=><Pressable key={v}
       accessibilityRole="button" onPress={()=>setDecision(v)}
       style={[s.tab,decision===v&&s.selected]}>
       <Text style={s.backText}>{v==="APPROVE"?"Approve":v==="RETURN"?"Return":"Reject"}</Text>
      </Pressable>)}
     </View>
     <TextInput accessibilityLabel="Reviewer remarks" placeholder="Optional remarks"
      value={remarks} onChangeText={setRemarks} multiline maxLength={500}
      placeholderTextColor={t.mutedText} style={s.input}/>
     <TextInput accessibilityLabel="Current password" placeholder="Current password"
      value={password} onChangeText={setPassword} secureTextEntry
      placeholderTextColor={t.mutedText} style={s.input}/>
     <Pressable accessibilityRole="button" disabled={busy||password.length<8||!!pending}
      style={s.button} onPress={()=>void send({key:Crypto.randomUUID(),
       caseRef:selected.caseRef,body:{action:decision,remarks,
        expectedRevision:selected.revision,currentPassword:password}})}>
      <Text style={s.buttonText}>Confirm protected decision</Text>
     </Pressable>
    </>}
    {pending&&<Text style={s.alert}>Decision outcome uncertain. Reopen the case
      to check the original decision before retrying.</Text>}
    <Text style={s.note}>Protected approval is not cash/bank verification or posting.</Text>
   </View>}
  </ScrollView>
 </SafeAreaView>;
}
const s=StyleSheet.create({
 safe:{flex:1,backgroundColor:t.background},
 header:{minHeight:66,padding:15,flexDirection:"row",alignItems:"center",
   gap:14,borderBottomWidth:1,borderBottomColor:t.border,backgroundColor:t.surface},
 back:{minHeight:48,justifyContent:"center"},backText:{fontSize:13,color:t.primary,fontWeight:"700"},
 eyebrow:{fontSize:10,color:t.mutedText},heading:{fontSize:19,color:t.text,fontWeight:"700"},
 title:{fontSize:15,color:t.text,fontWeight:"700"},note:{fontSize:13,color:t.mutedText,lineHeight:20},
 alert:{color:"#B42318",fontSize:13},content:{padding:16,gap:13},
 card:{backgroundColor:t.surface,borderWidth:1,borderColor:t.border,
  borderRadius:12,padding:16,gap:14},
 row:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",gap:7},
 case:{borderBottomWidth:1,borderBottomColor:t.border,gap:6,paddingVertical:12},
 input:{minHeight:48,borderColor:t.border,borderWidth:1,borderRadius:8,padding:12,color:t.text},
 button:{minHeight:48,backgroundColor:t.primary,borderRadius:8,alignItems:"center",
  justifyContent:"center",paddingHorizontal:12},
 buttonText:{color:t.primaryText,fontWeight:"700"},
 tab:{padding:8,borderWidth:1,borderColor:t.border,borderRadius:8,flex:1,alignItems:"center"},
 selected:{backgroundColor:t.background,borderColor:t.primary}
});
