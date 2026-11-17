import {useCallback,useEffect,useState} from "react";
import * as Crypto from "expo-crypto";
import {ActivityIndicator,BackHandler,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import {careGangaTheme as theme} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";
import {FinanceClaimNativeBill} from "./finance-claim-native-bill";

type Claim={claimRef:string;claimNumber:string;category:string;purpose:string;expenseDate:string;
 amountMinor:string;status:string;version:number};
type Draft={category:string;purpose:string;expenseDate:string;amount:string};
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
export function FinanceExpenseClaimsScreen({token,canCreate,canView,canUploadBill=false,onExit,onExpired}:{
 token:string;canCreate:boolean;canView:boolean;canUploadBill?:boolean;onExit:()=>void;onExpired:()=>void
}){
 const [claims,setClaims]=useState<Claim[]>([]);
 const [form,setForm]=useState<Draft>(clear());
 const [openedBill,setOpenedBill]=useState<string|null>(null);
 const [key,setKey]=useState<string|null>(null);
 const [fieldError,setFieldError]=useState<{field:string;message:string}|null>(null);
 const [message,setMessage]=useState("");
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(false);
 const refresh=useCallback(async()=>{
  if(!canView)return;
  setLoading(true);setError("");
  try{
   const res=await identityRequest("/api/finance-accounting/claims/mine",{
    headers:{Authorization:"Bearer "+token},cache:"no-store"});
   if(res.status===401){onExpired();return;}
   if(!res.ok)throw Error((await failure(res)).message);
   const raw:unknown=await res.json();
   if(!raw||typeof raw!=="object"||!("claims" in raw)||!Array.isArray(raw.claims))
    throw Error("The current claim list could not be verified.");
   setClaims(raw.claims as Claim[]);
  }catch(e){setClaims([]);setError(e instanceof Error?e.message:
   "Your claims cannot be loaded. Retry when connected.");}
  finally{setLoading(false);}
 },[token,canView,onExpired]);
 useEffect(()=>{void refresh();},[refresh]);
 useEffect(()=>{
  const back=BackHandler.addEventListener("hardwareBackPress",()=>{onExit();return true;});
  return()=>back.remove();
 },[onExit]);
 function change(field:keyof Draft,value:string){
  setForm(f=>({...f,[field]:value}));
  setKey(null);setFieldError(null);setMessage("");
 }
 async function save(){
  if(!canCreate||busy)return;
  const requestKey=key??Crypto.randomUUID();setKey(requestKey);
  setBusy(true);setFieldError(null);setMessage("");
  try{
   const res=await identityRequest("/api/finance-accounting/claims/drafts",{
    method:"POST",headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},
    body:JSON.stringify({...form,requestKey})});
   if(res.status===401){onExpired();return;}
   if(!res.ok){
    const x=await failure(res);
    if(x.field)setFieldError({field:x.field,message:x.message??"Please correct this field."});
    throw Error(x.message??"Your claim was not saved.");
   }
   const raw:unknown=await res.json();
   if(!raw||typeof raw!=="object"||!("confirmed" in raw)||raw.confirmed!==true||
     !("status" in raw)||raw.status!=="DRAFT")
    throw Error("Could not confirm the claim. Check its status before retrying.");
   setForm(clear());setKey(null);
   setMessage("Draft saved. A verified bill and separate approval are required before payment.");
   void refresh();
  }catch(e){
   try{
    const status=await identityRequest(
     "/api/finance-accounting/claims/draft-commands/"+requestKey,{
      headers:{Authorization:"Bearer "+token},cache:"no-store"});
    if(status.status===401){onExpired();return;}
    if(status.ok){
     const raw:unknown=await status.json();
     if(raw&&typeof raw==="object"&&"confirmed" in raw&&raw.confirmed===true){
      setForm(clear());setKey(null);
      setMessage("Your existing draft was saved. It has not been approved or paid.");
      void refresh();return;
     }
    }
   }catch{/* Unknown receipt remains unknown. */}
   setMessage(e instanceof Error?e.message:"Cannot confirm claim save. Check the status before retrying.");
  }finally{setBusy(false);}
 }
 const fields:[keyof Draft,string,string][]=[
  ["category","Category","e.g. Travel"],["expenseDate","Expense date","YYYY-MM-DD"],
  ["amount","Amount (₹)","e.g. 125.50"],["purpose","Purpose","Describe the expense"]
 ];
 return <SafeAreaView style={s.safe} edges={["top","bottom"]}>
  <View style={s.header}>
   <Pressable accessibilityRole="button" onPress={onExit} style={s.back}>
    <Text style={s.backText}>‹ Back</Text></Pressable>
   <View><Text style={s.eyebrow}>FOUNDATION / FINANCE</Text>
    <Text style={s.title} accessibilityRole="header">Expense Claims</Text></View>
  </View>
  <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
   <Text style={s.muted}>Submit a draft as an existing Foundation account. Drafts are not approved expenses or payments.</Text>
   {canCreate&&<View style={s.card}>
    <Text style={s.heading}>New claim draft</Text>
    {fields.map(([field,label,placeholder])=><View key={field}>
     <Text style={s.label}>{label} *</Text>
     <TextInput accessibilityLabel={label} value={form[field]}
      onChangeText={v=>change(field,v)} placeholder={placeholder} placeholderTextColor={theme.mutedText}
      keyboardType={field==="amount"?"decimal-pad":"default"}
      multiline={field==="purpose"} maxLength={field==="purpose"?500:field==="category"?80:field==="expenseDate"?10:18}
      style={[s.input,field==="purpose"&&s.area]}/>
     {fieldError?.field===field&&<Text style={s.alert} accessibilityRole="alert">{fieldError.message}</Text>}
    </View>)}
    <Text style={s.muted}>A securely verified bill and protected review must be completed separately before approval or payout.</Text>
    <Pressable accessibilityRole="button" disabled={busy} style={[s.action,busy&&s.disabled]}
     onPress={()=>void save()}>
     <Text style={s.actionText}>{busy?"Checking draft…":"Save claim draft"}</Text>
    </Pressable>
   </View>}
   {!!message&&<Text style={s.muted} accessibilityRole="alert">{message}</Text>}
   {canView&&<View style={s.card}>
    <View style={s.row}><Text style={s.heading}>My claims</Text>
     <Pressable accessibilityRole="button" onPress={()=>void refresh()} disabled={loading}>
      <Text style={s.backText}>Refresh</Text></Pressable></View>
    {loading&&<ActivityIndicator color={theme.primary}/>}
    {!!error&&<Text style={s.alert} accessibilityRole="alert">{error}</Text>}
    {!loading&&!error&&claims.length===0&&<Text style={s.muted}>No saved claims yet.</Text>}
    {claims.map(c=><View key={c.claimRef} style={s.claim}>
     <Text style={s.heading}>{c.claimNumber} · {c.category} · {inr(c.amountMinor)}</Text>
     <Text style={s.muted}>{c.expenseDate} · {c.purpose}</Text>
     <Text style={s.pending}>{c.status==="DRAFT"?"Draft — verified bill required":
      c.status==="SUBMITTED"?"Awaiting protected review":
      c.status==="APPROVED"?"Approved — posting/payment separate":
      c.status==="RETURNED"?"Returned for correction":
      c.status==="REJECTED"?"Rejected":"Check current source"}</Text>
     {c.status==="DRAFT"&&canCreate&&canUploadBill&&
      <Pressable accessibilityRole="button" style={s.action}
       onPress={()=>setOpenedBill(x=>x===c.claimRef?null:c.claimRef)}>
       <Text style={s.actionText}>{openedBill===c.claimRef?"Hide bill":"Attach verified bill"}</Text>
      </Pressable>}
     {c.status==="DRAFT"&&c.claimRef===openedBill&&canUploadBill&&
      <FinanceClaimNativeBill token={token} claim={c} canUpload={canUploadBill}
       onUpdated={()=>{setOpenedBill(null);void refresh();}} onExpired={onExpired}/>}

    </View>)}
    <Text style={s.muted}>Showing your most recent claims only.</Text>
   </View>}
  </ScrollView>
 </SafeAreaView>;
}
const s=StyleSheet.create({
 safe:{flex:1,backgroundColor:theme.background},
 header:{backgroundColor:theme.surface,padding:16,flexDirection:"row",alignItems:"center",gap:14,
  borderBottomWidth:1,borderBottomColor:theme.border},
 back:{minHeight:48,justifyContent:"center"},
 backText:{fontSize:15,fontWeight:"700",color:theme.primary},
 eyebrow:{fontSize:10,letterSpacing:1,color:theme.mutedText},
 title:{fontSize:20,fontWeight:"700",color:theme.text},
 content:{padding:16,gap:16},
 muted:{fontSize:13,color:theme.mutedText,lineHeight:19},
 heading:{fontSize:16,fontWeight:"700",color:theme.text},
 card:{backgroundColor:theme.surface,borderWidth:1,borderColor:theme.border,
  borderRadius:12,padding:16,gap:14},
 label:{fontSize:13,fontWeight:"600",color:theme.text,marginBottom:6},
 input:{minHeight:48,borderWidth:1,borderColor:theme.border,borderRadius:8,
  backgroundColor:theme.background,color:theme.text,padding:12,fontSize:15},
 area:{minHeight:92,textAlignVertical:"top"},
 alert:{fontSize:13,color:"#B42318"},
 action:{backgroundColor:theme.primary,minHeight:48,borderRadius:9,
  justifyContent:"center",alignItems:"center"},
 actionText:{color:theme.primaryText,fontSize:14,fontWeight:"700"},
 disabled:{opacity:0.55},
 row:{flexDirection:"row",justifyContent:"space-between",alignItems:"center"},
 claim:{borderTopWidth:1,borderTopColor:theme.border,paddingVertical:12,gap:6},
 pending:{fontSize:12,color:theme.mutedText,fontWeight:"700"}
});
