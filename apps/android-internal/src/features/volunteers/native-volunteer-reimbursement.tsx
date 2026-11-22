import {useEffect,useRef,useState} from "react";
import {AppState,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import * as Crypto from "expo-crypto";
import {identityRequest} from "../identity-access/http-client";
import {FinanceClaimNativeBill} from "../finance-accounting/finance-claim-native-bill";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
type Options={volunteerName:string;projects:{value:string;label:string}[]};
type Claim={confirmed:boolean;claimRef:string;version:number;status:string};
const initial=()=>({category:"Travel",purpose:"",expenseDate:"",amount:"",volunteerProjectRef:"",
 paymentMethod:"BANK_TRANSFER",utr:""});
const methods=["BANK_TRANSFER","UPI","CASH","OTHER"];
export function NativeVolunteerReimbursement({token,volunteerRef,onExpired,onClose}:{
 token:string;volunteerRef:string;onExpired:()=>void;onClose:()=>void
}){
 const [source,setSource]=useState<Options|null>(null),[draft,setDraft]=useState(initial),[claim,setClaim]=useState<Claim|null>(null);
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(""),[submitted,setSubmitted]=useState(false);
 const pending=useRef<string|null>(null),serial=useRef(0),active=useRef(true);
 useEffect(()=>{
  const n=++serial.current;setSource(null);setNotice("");
  void identityRequest("/api/v1/volunteers/roster/"+volunteerRef+"/reimbursement-options",{
   headers:{Authorization:"Bearer "+token},cache:"no-store"}).then(async r=>{
   if(r.status===401){onExpired();return;}
   if(!r.ok)throw Error();
   const data=await r.json() as Options;
   if(n===serial.current&&active.current&&Array.isArray(data.projects))setSource(data);
  }).catch(()=>{if(n===serial.current&&active.current)setNotice("Current volunteer or reimbursement authority cannot be verified.");});
  return()=>{serial.current++;};
 },[token,volunteerRef,onExpired]);
 useEffect(()=>{
  const sub=AppState.addEventListener("change",state=>{
   active.current=state==="active";
   if(state!=="active"){serial.current++;setSource(null);setNotice("");setDraft(initial());onClose();}
  });
  return()=>sub.remove();
 },[onClose]);
 const change=(field:keyof ReturnType<typeof initial>,v:string)=>{if(!pending.current)setDraft(x=>({...x,[field]:v}));};
 const request=async(path:string,body?:Record<string,unknown>)=>{
  const r=await identityRequest(path,{method:body?"POST":"GET",cache:"no-store",
   headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},
   ...(body?{body:JSON.stringify(body)}:{})});
  if(r.status===401){onExpired();throw Error("Sign in again.");}
  if(!r.ok)throw Error(r.status===409?"The original volunteer source changed. Refresh it.":"Claim state could not be confirmed. Check the existing request.");
  return r.json();
 };
 const create=async()=>{
  if(!source||busy||claim)return;
  const key=pending.current??Crypto.randomUUID();pending.current=key;setBusy(true);setNotice("");
  try{
   const c=await request("/api/finance-accounting/claims/drafts",{requestKey:key,volunteerRef,
    volunteerProjectRef:draft.volunteerProjectRef||null,paymentMethod:draft.paymentMethod,utr:draft.utr||null,
    category:draft.category,purpose:draft.purpose,expenseDate:draft.expenseDate,amount:draft.amount}) as Claim;
   if(!c.confirmed||!c.claimRef||!Number.isSafeInteger(c.version))throw Error();
   setClaim(c);pending.current=null;
   setNotice("Actual CG-09 draft saved. Attach a verified private bill; no payment is made.");
  }catch{
   try{
    const old=await request("/api/finance-accounting/claims/draft-commands/"+key) as Claim;
    if(old.confirmed&&old.claimRef&&Number.isSafeInteger(old.version)){
     setClaim(old);pending.current=null;setNotice("Original saved draft confirmed without a duplicate.");return;
    }
   }catch{/* Keep exact request key. */}
   setNotice("Result uncertain. Check CG-09 claims or retry this SAME original draft request.");
  }finally{setBusy(false);}
 };
 const button=(label:string,fn:()=>void,disabled=false)=><Pressable accessibilityRole="button" disabled={busy||disabled}
  style={[s.button,(busy||disabled)&&{opacity:.5}]} onPress={fn}><Text style={s.action}>{label}</Text></Pressable>;
 const field=(label:string,key:keyof ReturnType<typeof initial>)=><View><Text style={s.label}>{label}</Text>
  <TextInput accessibilityLabel={label} style={s.input} value={draft[key]} editable={!pending.current&&!busy}
   onChangeText={v=>change(key,v)}/></View>;
 return <View style={s.card}>
  <Text accessibilityRole="header" style={s.heading}>Volunteer reimbursement (U42)</Text>
  <Text style={s.muted}>Actual CG-09 request only. Payment method or reference is not proof of a transfer.</Text>
  {!source&&!notice&&<Text>Verifying current volunteer…</Text>}
  {!!notice&&<Text accessibilityRole="alert">{notice}</Text>}
  {source&&<Text style={s.heading}>{source.volunteerName}</Text>}
  {source&&!claim&&<View style={s.card}>
   {field("Category", "category")}{field("Purpose", "purpose")}{field("Expense date (YYYY-MM-DD)", "expenseDate")}
   {field("Amount (INR)", "amount")}
   <Text style={s.label}>Linked current project (optional)</Text>
   <ScrollView horizontal contentContainerStyle={s.options}>
    {button("No project",()=>change("volunteerProjectRef",""),!draft.volunteerProjectRef)}
    {source.projects.map(p=><View key={p.value}>{button(p.label,()=>change("volunteerProjectRef",p.value),draft.volunteerProjectRef===p.value)}</View>)}
   </ScrollView>
   <Text style={s.label}>Requested method</Text><ScrollView horizontal contentContainerStyle={s.options}>
    {methods.map(m=><View key={m}>{button(m.replaceAll("_"," "),()=>change("paymentMethod",m),draft.paymentMethod===m)}</View>)}
   </ScrollView>
   {field("Optional reference (not bank proof)", "utr")}
   {button(pending.current?"Retry same expense draft":"Save CG-09 expense claim",()=>void create(),!draft.category||!draft.purpose||!draft.expenseDate||!draft.amount)}
  </View>}
  {claim&&<View style={s.card}>
   <Text>Claim status: {submitted?"Submitted for independent review":claim.status}. Nothing is posted or paid.</Text>
   {!submitted&&<FinanceClaimNativeBill token={token} claim={{claimRef:claim.claimRef,claimNumber:"Volunteer reimbursement",version:claim.version,status:claim.status}}
    canUpload onExpired={onExpired} onUpdated={()=>{setSubmitted(true);setNotice("Original claim submitted for CG-03 review. Payment remains pending.");}}/>}
  </View>}
  {button("Close reimbursement",onClose)}
 </View>;
}
const s=StyleSheet.create({card:{padding:12,gap:10,borderWidth:1,borderColor:t.border,borderRadius:10,backgroundColor:t.surface},
 heading:{fontWeight:"700",fontSize:16,color:t.text},muted:{color:t.mutedText,fontSize:12},label:{color:t.text,fontWeight:"600",marginBottom:4},
 input:{borderWidth:1,borderColor:t.border,borderRadius:8,padding:10,minHeight:44,color:t.text},
 options:{gap:6,paddingVertical:4},button:{padding:10,minHeight:44,justifyContent:"center",borderRadius:8,
 borderWidth:1,borderColor:t.border},action:{color:t.text,fontWeight:"600"}});
