import {useCallback,useEffect,useRef,useState} from "react";
import * as Crypto from "expo-crypto";
import {ActivityIndicator,BackHandler,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import {careGangaTheme as theme} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";
import {FinanceClaimNativeBill} from "./finance-claim-native-bill";

type Claim={claimRef:string;claimNumber:string;category:string;purpose:string;expenseDate:string;
 amountMinor:string;status:string;version:number;paymentState?:string};
function claimStatus(c:Claim){
 if(c.paymentState==="PAID_VERIFIED"&&c.status==="APPROVED")return "Paid — verified";
 if(c.paymentState==="PAYMENT_REQUESTED"&&c.status==="APPROVED")return "Payment requested — verification pending";
 if(c.paymentState==="PAYMENT_VERIFIED_UNPOSTED"&&c.status==="APPROVED")return "Payment verified — posting pending";
 if(c.paymentState==="PAYABLE"&&c.status==="APPROVED")return "Payable — payment not verified";
 return c.status==="DRAFT"?"Draft — verified bill required":c.status==="SUBMITTED"?"Awaiting protected review":
 c.status==="APPROVED"?"Approved — posting/payment separate":c.status==="RETURNED"?"Returned for correction":
 c.status==="REJECTED"?"Rejected":"Check original status";
}
function matches(c:Claim,filter:string,search:string){
 const status=c.status==="APPROVED"&&["PAYABLE","PAID_VERIFIED","PAYMENT_REQUESTED","PAYMENT_VERIFIED_UNPOSTED"].includes(c.paymentState??"")?c.paymentState:c.status;
 return (filter==="ALL"||status===filter)&&(!search.trim()||[c.claimNumber,c.category,c.purpose].join(" ").toLowerCase().includes(search.trim().toLowerCase()));
}
const filters=["ALL","DRAFT","SUBMITTED","APPROVED","PAYABLE","PAYMENT_REQUESTED","PAYMENT_VERIFIED_UNPOSTED","PAID_VERIFIED","RETURNED","REJECTED"];
const filterLabel=(v:string)=>({ALL:"All",DRAFT:"Draft",SUBMITTED:"Pending review",APPROVED:"Approved",PAYABLE:"Payable",PAYMENT_REQUESTED:"Payment requested",PAYMENT_VERIFIED_UNPOSTED:"Verified, posting pending",PAID_VERIFIED:"Paid verified",RETURNED:"Returned",REJECTED:"Rejected"} as Record<string,string>)[v]??v;

type Draft={category:string;purpose:string;expenseDate:string;amount:string;breakdown?:string};
const splitPurpose=(purpose:string)=>{const marker=" | Breakdown: ",at=purpose.indexOf(marker);return at<0?{purpose,breakdown:""}:{purpose:purpose.slice(0,at),breakdown:purpose.slice(at+marker.length)};};
type Problem={message?:string;field?:string};
const clear=():Draft=>({category:"",purpose:"",expenseDate:"",amount:""});
const inr=(s:string)=>{
 try{const n=BigInt(s);return "₹"+(n/100n).toLocaleString("en-IN")+"."+
  (n%100n).toString().padStart(2,"0");}
 catch{return "Amount unavailable";}
};
async function failure(response:Response):Promise<Problem>{
 const raw:unknown=await response.json().catch(()=>null);
 if(raw&&typeof raw==="object"&&!Array.isArray(raw)){
  const r=raw as Record<string,unknown>;
  if(typeof r.message==="string"&&r.message.length<=300)
   return {message:r.message,field:typeof r.field==="string"?r.field:undefined};
 }
 return {message:response.status===403?
  "Your Foundation role does not permit this claim action.":
  response.status===409?"This claim changed. Check the original record before retrying.":
  "The result could not be confirmed. Check your saved claims before retrying."};
}
export function FinanceExpenseClaimsScreen({token,canCreate,canView,canUploadBill=false,allowanceMode=false,onExit,onExpired}:{
 token:string;canCreate:boolean;canView:boolean;canUploadBill?:boolean;allowanceMode?:boolean;onExit:()=>void;onExpired:()=>void
}){
 const [claims,setClaims]=useState<Claim[]>([]);
 const readGeneration=useRef(0),writeInFlight=useRef(false);
 const [eligible,setEligible]=useState(false),[search,setSearch]=useState(""),[filter,setFilter]=useState("ALL"),[drawer,setDrawer]=useState(false);
 const [offset,setOffset]=useState(0),[nextOffset,setNextOffset]=useState<number|null>(null);
 const allowCreate=canCreate&&(!allowanceMode||eligible);
 const [form,setForm]=useState<Draft>(clear());
 const [correction,setCorrection]=useState<{ref:string;version:number;number:string}|null>(null);
 const [openedBill,setOpenedBill]=useState<string|null>(null);
 const [key,setKey]=useState<string|null>(null);
 const [uncertain,setUncertain]=useState(false);
 const [fieldError,setFieldError]=useState<{field:string;message:string}|null>(null);
 const [message,setMessage]=useState("");
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(false);
 const refresh=useCallback(async()=>{
  const generation=++readGeneration.current;
  if(!canView){setClaims([]);setEligible(false);setNextOffset(null);setLoading(false);return;}
  setLoading(true);setError("");
  try{
   const res=await identityRequest("/api/finance-accounting/claims/mine?offset="+offset+(allowanceMode?"&source=HR_ALLOWANCE":""),{
    headers:{Authorization:"Bearer "+token},cache:"no-store"});
   if(res.status===401){onExpired();return;}
   if(!res.ok)throw Error((await failure(res)).message);
   const raw:unknown=await res.json();
   if(!raw||typeof raw!=="object"||!("claims" in raw)||!Array.isArray(raw.claims))
    throw Error("The current claim list could not be verified.");
   if(generation!==readGeneration.current)return;setClaims(raw.claims as Claim[]);setEligible(true);setNextOffset("nextOffset" in raw&&typeof raw.nextOffset==="number"?raw.nextOffset:null);
  }catch(e){if(generation!==readGeneration.current)return;setClaims([]);setEligible(false);setNextOffset(null);setError(e instanceof Error?e.message:
   "Your claims cannot be loaded. Retry when connected.");}
  finally{if(generation===readGeneration.current)setLoading(false);}
 },[token,canView,onExpired,offset,allowanceMode]);
 useEffect(()=>{void refresh();return()=>{readGeneration.current++;};},[refresh]);
 useEffect(()=>{
  const back=BackHandler.addEventListener("hardwareBackPress",()=>{onExit();return true;});
  return()=>back.remove();
 },[onExit]);
 function change(field:keyof Draft,value:string){
  if(busy||uncertain)return;
  setForm(f=>({...f,[field]:value}));
  setKey(null);setFieldError(null);setMessage("");
 }
 async function save(){
  if(!allowCreate||busy||writeInFlight.current)return;writeInFlight.current=true;
  const requestKey=key??Crypto.randomUUID();setKey(requestKey);
  setBusy(true);setFieldError(null);setMessage("");
  try{
   const res=await identityRequest(correction?"/api/finance-accounting/claims/"+correction.ref+"/correct":"/api/finance-accounting/claims/drafts",{
    method:"POST",headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},
    body:JSON.stringify({category:form.category,purpose:form.purpose,expenseDate:form.expenseDate,amount:form.amount,...(allowanceMode?{breakdown:form.breakdown??""}:{}),requestKey,...(correction?{expectedVersion:correction.version}:allowanceMode?{sourceKind:"HR_ALLOWANCE"}:{})})});
   if(res.status===401){onExpired();return;}
   if(!res.ok){
    const x=await failure(res);
    if(x.field)setFieldError({field:x.field,message:x.message??"Please correct this field."});
    if(res.status<500&&!uncertain){setKey(null);setMessage(x.message??"Your claim was not saved.");return;}
    throw Error(x.message??"Your claim was not saved.");
   }
   const raw:unknown=await res.json();
   if(!raw||typeof raw!=="object"||!("confirmed" in raw)||raw.confirmed!==true||
     !("status" in raw)||raw.status!=="DRAFT")
    throw Error("Could not confirm the claim. Check its status before retrying.");
   setForm(clear());setUncertain(false);setKey(null);setCorrection(null);
   setMessage(correction?"Corrected draft saved under the original claim number. Reattach a freshly scanned bill.":"Draft saved. A verified bill and separate approval are required before payment.");
   void refresh();
  }catch(e){
   try{
    const status=await identityRequest(
     "/api/finance-accounting/claims/"+(correction?"workflow-commands/":"draft-commands/")+requestKey,{
      headers:{Authorization:"Bearer "+token},cache:"no-store"});
    if(status.status===401){onExpired();return;}
    if(status.ok){
     const raw:unknown=await status.json();
     if(raw&&typeof raw==="object"&&"confirmed" in raw&&raw.confirmed===true&&"status" in raw&&typeof raw.status==="string"){
      setForm(clear());setUncertain(false);setKey(null);setCorrection(null);
      setMessage("Original request confirmed. Refresh for its current approval and payment status.");
      void refresh();return;
     }
    }
   }catch{/* Unknown receipt remains unknown. */}
   setUncertain(true);
   setMessage(e instanceof Error?e.message:"Cannot confirm claim save. Check the status before retrying.");
  }finally{writeInFlight.current=false;setBusy(false);}
 }
 const fields:[keyof Draft,string,string][]=[
  ["category","Category","e.g. Travel"],["expenseDate","Expense date","YYYY-MM-DD"],
  ["amount","Amount (₹)","e.g. 125.50"],["purpose","Purpose","Describe the expense"],...(allowanceMode?[["breakdown","Description / breakdown","What was the expense for?"] as [keyof Draft,string,string]]:[])
 ];
 const visible=allowanceMode?claims.filter(c=>matches(c,filter,search)):claims;
 return <SafeAreaView style={s.safe} edges={["left","right"]}>
  <View style={s.header}>
   <Pressable accessibilityRole="button" onPress={onExit} style={s.back}>
    <Text style={s.backText}>‹ Back</Text></Pressable>
   <View><Text style={s.eyebrow}>{allowanceMode?"FOUNDATION / HUMAN RESOURCES":"FOUNDATION / FINANCE"}</Text>
    <Text style={s.title} accessibilityRole="header">{allowanceMode?"My Allowances":"Expense Claims"}</Text></View>
  </View>
  <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
   <Text style={s.muted}>Submit a draft as an existing Foundation account. Drafts are not approved expenses or payments.</Text>
   {allowanceMode&&allowCreate&&<Pressable accessibilityRole="button" style={s.action} disabled={busy||uncertain} onPress={()=>setDrawer(v=>!v)}><Text style={s.actionText}>{drawer?"Close request form":"Request Allowance"}</Text></Pressable>}
   {allowCreate&&(!allowanceMode||drawer)&&<View style={s.card}>
    <Text style={s.heading}>{correction?"Correct "+correction.number:allowanceMode?"Request Allowance":"New claim draft"}</Text>
    {fields.map(([field,label,placeholder])=><View key={field}>
     <Text style={s.label}>{label} *</Text>
     <TextInput accessibilityLabel={label} editable={!busy&&!uncertain} value={form[field]??""}
      onChangeText={v=>change(field,v)} placeholder={placeholder} placeholderTextColor={theme.mutedText}
      keyboardType={field==="amount"?"decimal-pad":"default"}
      multiline={field==="purpose"||field==="breakdown"} maxLength={field==="breakdown"?300:field==="purpose"?(allowanceMode?180:500):field==="category"?80:field==="expenseDate"?10:18}
      style={[s.input,(field==="purpose"||field==="breakdown")&&s.area]}/>
     {fieldError?.field===field&&<Text style={s.alert} accessibilityRole="alert">{fieldError.message}</Text>}
    </View>)}
    {uncertain&&<Text accessibilityRole="alert" style={s.alert}>The original result is unknown. Retry this exact request before editing or starting another claim.</Text>}
    <Text style={s.muted}>A securely verified bill and protected review must be completed separately before approval or payout.</Text>
    <Pressable accessibilityRole="button" disabled={busy} style={[s.action,busy&&s.disabled]}
     onPress={()=>void save()}>
     <Text style={s.actionText}>{busy?"Checking draft…":uncertain?"Retry original request":correction?"Save corrected draft":"Save claim draft"}</Text>
    </Pressable>
   </View>}
   {!!message&&<Text style={s.muted} accessibilityRole="alert">{message}</Text>}
   {canView&&<View style={s.card}>
    <View style={s.row}><Text style={s.heading}>{allowanceMode?"My allowance requests":"My claims"}</Text>
     <Pressable accessibilityRole="button" onPress={()=>void refresh()} disabled={loading}>
      <Text style={s.backText}>Refresh</Text></Pressable></View>
    {allowanceMode&&eligible&&<View style={{gap:6}}><Text style={s.muted}>Current page: {claims.length} requests · {claims.filter(c=>c.status==="SUBMITTED").length} pending · {claims.filter(c=>c.paymentState==="PAID_VERIFIED").length} paid verified</Text><TextInput accessibilityLabel="Search current page" value={search} onChangeText={setSearch} maxLength={80} placeholder="Search requests" style={s.input}/><View style={{flexDirection:"row",flexWrap:"wrap",gap:8}}>{filters.map(v=><Pressable key={v} accessibilityRole="button" accessibilityState={{selected:filter===v}} onPress={()=>setFilter(v)} style={{padding:10,borderWidth:1,borderColor:theme.border,backgroundColor:filter===v?theme.primary:theme.surface,borderRadius:8}}><Text style={{color:filter===v?theme.primaryText:theme.text}}>{filterLabel(v)}</Text></Pressable>)}</View></View>}
    {loading&&<ActivityIndicator color={theme.primary}/>}
    {!!error&&<Text style={s.alert} accessibilityRole="alert">{error}</Text>}
    {!loading&&!error&&claims.length===0&&<Text style={s.muted}>No saved claims yet.</Text>}
    {visible.map(c=><View key={c.claimRef} style={s.claim}>
     <Text style={s.heading}>{c.claimNumber} · {c.category} · {inr(c.amountMinor)}</Text>
     <Text style={s.muted}>{c.expenseDate} · {c.purpose}</Text>
     <Text style={s.pending}>{claimStatus(c)}</Text>
     {c.status==="RETURNED"&&allowCreate&&
      <Pressable accessibilityRole="button" disabled={busy||uncertain} style={s.action}
       onPress={()=>{
        setDrawer(true);setCorrection({ref:c.claimRef,version:c.version,number:c.claimNumber});
        setForm({category:c.category,...(allowanceMode?splitPurpose(c.purpose):{purpose:c.purpose}),expenseDate:c.expenseDate,
         amount:(BigInt(c.amountMinor)/100n).toString()+"."+(BigInt(c.amountMinor)%100n).toString().padStart(2,"0")});
        setMessage("");setKey(null);setFieldError(null);
       }}><Text style={s.actionText}>Correct returned claim</Text></Pressable>}
     {c.status==="DRAFT"&&allowCreate&&canUploadBill&&
      <Pressable accessibilityRole="button" style={s.action}
       onPress={()=>setOpenedBill(x=>x===c.claimRef?null:c.claimRef)}>
       <Text style={s.actionText}>{openedBill===c.claimRef?"Hide bill":"Attach verified bill"}</Text>
      </Pressable>}
     {c.status==="DRAFT"&&c.claimRef===openedBill&&allowCreate&&canUploadBill&&
      <FinanceClaimNativeBill token={token} claim={c} canUpload={canUploadBill}
       onUpdated={()=>{setOpenedBill(null);void refresh();}} onExpired={onExpired}/>}

    </View>)}
    {!loading&&!error&&claims.length>0&&visible.length===0&&<Text style={s.muted}>No matching requests on this page.</Text>}
    <View style={s.row}><Pressable accessibilityRole="button" disabled={offset===0||loading} onPress={()=>setOffset(v=>Math.max(0,v-30))}><Text style={s.backText}>Previous</Text></Pressable><Pressable accessibilityRole="button" disabled={nextOffset===null||loading} onPress={()=>setOffset(nextOffset??0)}><Text style={s.backText}>Next</Text></Pressable></View>
   </View>}
  </ScrollView>
 </SafeAreaView>;
}
const s=StyleSheet.create({
 safe:{flex:1,backgroundColor:theme.adminCanvas},
 header:{backgroundColor:theme.surface,padding:16,flexDirection:"row",alignItems:"center",gap:14,
  borderBottomWidth:1,borderBottomColor:theme.border},
 back:{minHeight:48,justifyContent:"center"},
 backText:{fontSize:15,fontWeight:"700",color:theme.primary},
 eyebrow:{fontSize:10,letterSpacing:1,color:theme.mutedText},
 title:{fontSize:20,fontWeight:"700",color:theme.text},
 content:{padding:16,gap:16,paddingBottom:96},
 muted:{fontSize:13,color:theme.mutedText,lineHeight:19},
 heading:{fontSize:16,fontWeight:"700",color:theme.text},
 card:{backgroundColor:theme.surface,borderWidth:1,borderColor:theme.border,
  borderRadius:14,padding:16,gap:14,
    shadowColor:theme.sidebar,shadowOpacity:0.045,
    shadowOffset:{width:0,height:2},shadowRadius:8,elevation:1},
 label:{fontSize:13,fontWeight:"600",color:theme.text,marginBottom:6},
 input:{minHeight:48,borderWidth:1,borderColor:theme.border,borderRadius:10,
  backgroundColor:theme.surface,color:theme.text,padding:12,fontSize:15},
 area:{minHeight:92,textAlignVertical:"top"},
 alert:{fontSize:13,color:"#B42318"},
 action:{backgroundColor:theme.primary,minHeight:48,borderRadius:12,
  justifyContent:"center",alignItems:"center"},
 actionText:{color:theme.primaryText,fontSize:14,fontWeight:"700"},
 disabled:{opacity:0.55},
 row:{flexDirection:"row",justifyContent:"space-between",alignItems:"center"},
 claim:{borderTopWidth:1,borderTopColor:theme.border,paddingVertical:12,gap:6},
 pending:{fontSize:12,color:theme.mutedText,fontWeight:"700"}
});
