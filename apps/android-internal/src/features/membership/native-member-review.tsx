import React,{useEffect,useRef,useState} from "react";
import {ActivityIndicator,AppState,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {File,Paths} from "expo-file-system";
import * as Crypto from "expo-crypto";
import * as Sharing from "expo-sharing";
import type {CG04ReviewPage,CG04ReviewPolicy,CG04ReviewCase,CG04ReviewDecisionResult} from "@careganga/api-contracts";
import {careGangaTheme as theme} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";

type Decision="APPROVE"|"RETURN"|"REJECT";
type Command={ref:string;requestKey:string;expectedRevision:number;action:Decision;remarks:string};
const statuses=["ALL","SUBMITTED","PENDING_OWNER","RETURNED","REJECTED","OWNER_COMPLETED"];
const categories=["ALL","ANNUAL","LIFETIME","HONORARY","STUDENT","OTHER"];
const paymentStates=["ALL","NOT_DUE","PENDING","AWAITING_BANK_VERIFICATION","VERIFIED","REFUND_PENDING","REFUND_AWAITING_BANK_VERIFICATION","REFUNDED"];
type SearchFilter={q:string;category:string;payment:string;submittedFrom:string;submittedTo:string};
const emptySearch=():SearchFilter=>({q:"",category:"ALL",payment:"ALL",submittedFrom:"",submittedTo:""});
const detailTabs=[
 {key:"OVERVIEW",label:"Overview"},
 {key:"PERSONAL",label:"Personal Info"},
 {key:"MEMBERSHIP",label:"Membership Details"},
 {key:"DOCUMENTS",label:"Documents"},
 {key:"PAYMENT",label:"Payment & Donation"},
 {key:"GENERATED",label:"Generated Documents",pending:true},
 {key:"WORKFLOW",label:"Approval Workflow"},
 {key:"COMMUNICATION",label:"Communication",pending:true},
 {key:"ACTIVITY",label:"Activity Log"}
] as const;
type DetailTab=typeof detailTabs[number]["key"];
const label=(v:string)=>v.replaceAll("_"," ").toLowerCase().replace(/\b[a-z]/g,c=>c.toUpperCase());
const amount=(minor:string)=>{if(!/^\d{1,15}$/.test(minor))return "Unavailable";const n=BigInt(minor);return "₹"+(n/100n).toString()+"."+String(n%100n).padStart(2,"0");};

export function NativeMemberReview({token,canConfigure,onExpired}:{token:string;canConfigure:boolean;onExpired:()=>void}){
 const [policy,setPolicy]=useState<CG04ReviewPolicy|null>(null),[page,setPage]=useState<CG04ReviewPage|null>(null),[detail,setDetail]=useState<CG04ReviewCase|null>(null);
 const [detailTab,setDetailTab]=useState<DetailTab>("OVERVIEW");
 const [searchOpen,setSearchOpen]=useState(false),[draftSearch,setDraftSearch]=useState<SearchFilter>(emptySearch),[search,setSearch]=useState<SearchFilter>(emptySearch);
 const [status,setStatus]=useState("ALL"),[offset,setOffset]=useState(0),[selected,setSelected]=useState<string|null>(null),[epoch,setEpoch]=useState(0);
 const [loading,setLoading]=useState(true),[detailBusy,setDetailBusy]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [decision,setDecision]=useState<Decision>("APPROVE"),[remarks,setRemarks]=useState(""),[password,setPassword]=useState(""),[retryPassword,setRetryPassword]=useState(""),[configPassword,setConfigPassword]=useState("");
 const pending=useRef<Command|null>(null),seq=useRef(0),detailSeq=useRef(0),foreground=useRef(true),running=useRef(false);
 async function request<T>(path:string,body?:Record<string,unknown>):Promise<T>{
  const r=await identityRequest("/api/v1/membership/reviews"+path,{headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},cache:"no-store",...(body?{method:"POST",body:JSON.stringify(body)}:{})});
  if(r.status===401){onExpired();throw Error("Sign in again.");}
  if(!r.ok)throw Object.assign(new Error(r.status===403?"Current Foundation review permission is unavailable.":r.status===404?"This membership case or proof is unavailable.":r.status===409?"The review changed. Refresh the case before deciding.":r.status===400?(body?"Check the decision or password fields.":"Check the search filters, status and submitted dates."):"Membership review result could not be confirmed. Refresh before retrying."),{status:r.status});
  return await r.json() as T;
 }
 useEffect(()=>{const sub=AppState.addEventListener("change",state=>{
  foreground.current=state==="active";
  if(state!=="active"){seq.current++;detailSeq.current++;setPolicy(null);setPage(null);setDetail(null);setPassword("");setRetryPassword("");setConfigPassword("");}
  else setEpoch(x=>x+1);
 });return()=>sub.remove();},[]);
 useEffect(()=>{
  const n=++seq.current;setLoading(true);setPage(null);setError("");
  void Promise.all([request<CG04ReviewPolicy>("/policy"),request<CG04ReviewPage>("?"+new URLSearchParams({status,offset:String(offset),...search}))]).then(([p,list])=>{
   if(n===seq.current&&foreground.current){setPolicy(p);setPage(list);}
  }).catch(e=>{if(n===seq.current&&foreground.current)setError(e instanceof Error?e.message:"Membership reviews unavailable.");}).finally(()=>{if(n===seq.current&&foreground.current)setLoading(false);});
  return()=>{seq.current++;};
 },[token,status,offset,search,epoch]);
 useEffect(()=>{
  const n=++detailSeq.current;setDetail(null);setDetailBusy(!!selected);if(!selected)return;
  void request<CG04ReviewCase>("/"+selected).then(v=>{if(n===detailSeq.current&&foreground.current)setDetail(v);})
   .catch(e=>{if(n===detailSeq.current&&foreground.current)setError(e instanceof Error?e.message:"Case details unavailable.");})
   .finally(()=>{if(n===detailSeq.current&&foreground.current)setDetailBusy(false);});
  return()=>{detailSeq.current++;};
 },[token,selected,epoch]);
 const refresh=()=>setEpoch(x=>x+1);
 const applySearch=()=>{
  if(draftSearch.submittedFrom&&draftSearch.submittedTo&&draftSearch.submittedFrom>draftSearch.submittedTo){setError("Start date must be on or before the end date.");return;}
  setError("");setSearch({...draftSearch,q:draftSearch.q.trim()});setOffset(0);setSelected(null);setDetail(null);setPassword("");
 };
 const resetSearch=()=>{setDraftSearch(emptySearch());setSearch(emptySearch());setOffset(0);setSelected(null);setDetail(null);setPassword("");};
 const chip=(title:string,onPress:()=>void,selectedChip=false,disabled=false)=>(
  <Pressable accessibilityRole="button" accessibilityState={{selected:selectedChip,disabled}} disabled={disabled} onPress={onPress} style={[styles.chip,selectedChip&&styles.chipSelected,disabled&&styles.disabled]}><Text style={[styles.chipText,selectedChip&&styles.chipTextSelected]}>{title}</Text></Pressable>
 );
 async function configure(){
  if(running.current||configPassword.length<8)return;running.current=true;setBusy(true);setError("");
  const secret=configPassword;setConfigPassword("");
  try{const result=await request<CG04ReviewPolicy>("/policy",{currentPassword:secret});setPolicy(result);setNotice("Protected Foundation membership review workflow configured.");refresh();}
  catch(e){setError(e instanceof Error?e.message:"Configuration could not be confirmed.");}
  finally{running.current=false;setBusy(false);}
 }
 async function send(cmd:Command,secret:string){
  if(running.current||secret.length<8)return;running.current=true;setBusy(true);setError("");setNotice("");pending.current=cmd;
  try{
   const outcome=await request<CG04ReviewDecisionResult>("/"+cmd.ref+"/decide",{requestKey:cmd.requestKey,expectedRevision:cmd.expectedRevision,action:cmd.action,remarks:cmd.remarks,currentPassword:secret});
   pending.current=null;setNotice(outcome.status==="PENDING_OWNER"?"Approval recorded. Membership is not active until payment and owner completion are verified.":"Review decision recorded as "+label(outcome.status)+".");
   setRemarks("");setDecision("APPROVE");refresh();
  }catch(e){setError(e instanceof Error?e.message:"Decision outcome uncertain. Check the case before retrying.");}
  finally{setPassword("");setRetryPassword("");running.current=false;setBusy(false);}
 }
 async function shareProof(fileRef:string){
  if(running.current||!detail)return;running.current=true;setBusy(true);setError("");let file:File|null=null;
  try{
   const r=await identityRequest("/api/v1/membership/reviews/"+detail.caseRef+"/files/"+fileRef+"/download",{headers:{Authorization:"Bearer "+token},cache:"no-store"});
   if(r.status===401){onExpired();throw Error("Sign in again.");}
   if(!r.ok)throw Error("Current protected evidence is unavailable. Refresh the review.");
   const mime=(r.headers.get("content-type")??"").split(";")[0].trim();
   if(!["application/pdf","image/png","image/jpeg","image/webp"].includes(mime))throw Error("This evidence format is unavailable.");
   const bytes=new Uint8Array(await r.arrayBuffer());
   if(!bytes.length||bytes.length>10485760)throw Error("Protected evidence is unavailable.");
   if(!await Sharing.isAvailableAsync())throw Error("Private file sharing is not available on this device.");
   const extension=mime==="application/pdf"?"pdf":mime==="image/png"?"png":mime==="image/webp"?"webp":"jpg";
   file=new File(Paths.cache,"careganga-private-member-proof-"+Crypto.randomUUID()+"."+extension);
   file.create();file.write(bytes);
   await Sharing.shareAsync(file.uri,{mimeType:mime,dialogTitle:"Share private verified membership proof"});
   setNotice("Protected evidence opened. Do not share it outside authorized Foundation review.");
  }catch(e){setError(e instanceof Error?e.message:"Evidence could not be opened.");}
  finally{try{file?.delete();}catch{}running.current=false;setBusy(false);}
 }
 const choose=(ref:string)=>{setError("");setNotice("");setSelected(ref);setDetailTab("OVERVIEW");setPassword("");setRemarks("");};
 const changeStatus=(value:string)=>{setStatus(value);setOffset(0);setSelected(null);setDetail(null);setPassword("");};
 return <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
  <Text style={styles.heading}>Membership Applications</Text>
  <Text style={styles.muted}>Original protected Foundation review cases. Approval does not issue an ID or confirm payment.</Text>
  <View style={styles.buttons}>{chip("Refresh cases",refresh,false,busy)}</View>
  {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
  {!!notice&&<Text style={styles.muted} accessibilityRole="text">{notice}</Text>}
  {policy&&!policy.configured&&<View style={styles.card}><Text style={styles.title}>Review workflow not configured</Text>
   <Text style={styles.muted}>Saved applications cannot be submitted until authorized Foundation setup is complete.</Text>
   {canConfigure?<><Text style={styles.label}>Current Foundation password</Text><TextInput secureTextEntry accessibilityLabel="Password to configure membership review" value={configPassword} onChangeText={setConfigPassword} style={styles.input} editable={!busy}/>
    {chip("Configure protected review",()=>void configure(),false,busy||configPassword.length<8)}</>:<Text style={styles.muted}>Ask an authorized Foundation administrator to configure membership approval.</Text>}
  </View>}
  <View style={styles.card}><Text style={styles.title}>Review status</Text>
   {chip(searchOpen?"Hide search filters":"Filter applications",()=>setSearchOpen(v=>!v),searchOpen,busy)}
   {searchOpen&&<View style={styles.item}>
    <Text style={styles.label}>Find applicant, member number or reference</Text>
    <TextInput accessibilityLabel="Search application name, email, phone or reference" style={styles.input} value={draftSearch.q} maxLength={100} onChangeText={v=>setDraftSearch(x=>({...x,q:v}))}/>
    <Text style={styles.label}>Membership tier</Text><View style={styles.buttons}>
     {categories.map(v=><React.Fragment key={v}>{chip(v==="ALL"?"All tiers":label(v),()=>setDraftSearch(x=>({...x,category:v})),draftSearch.category===v,busy)}</React.Fragment>)}
    </View>
    <Text style={styles.label}>Verified fee status</Text><View style={styles.buttons}>
     {paymentStates.map(v=><React.Fragment key={v}>{chip(v==="ALL"?"All payment states":label(v),()=>setDraftSearch(x=>({...x,payment:v})),draftSearch.payment===v,busy)}</React.Fragment>)}
    </View>
    <Text style={styles.label}>Submitted from (YYYY-MM-DD)</Text>
    <TextInput accessibilityLabel="Submitted from date, year month day" value={draftSearch.submittedFrom} style={styles.input} maxLength={10} placeholder="YYYY-MM-DD" editable={!busy} onChangeText={v=>setDraftSearch(x=>({...x,submittedFrom:v}))}/>
    <Text style={styles.label}>Submitted through (YYYY-MM-DD)</Text>
    <TextInput accessibilityLabel="Submitted through date, year month day" value={draftSearch.submittedTo} style={styles.input} maxLength={10} placeholder="YYYY-MM-DD" editable={!busy} onChangeText={v=>setDraftSearch(x=>({...x,submittedTo:v}))}/>
    <View style={styles.buttons}>{chip("Search",applySearch,false,busy||loading)}{chip("Reset",resetSearch,false,busy||loading)}</View>
   </View>}
   <View style={styles.buttons}>{statuses.map(v=><React.Fragment key={v}>{chip(label(v),()=>changeStatus(v),status===v,busy)}</React.Fragment>)}</View>
   {loading&&<ActivityIndicator accessibilityLabel="Loading current membership review cases"/>}
   {page&&!loading&&<>
    {page.items.length===0&&<Text style={styles.muted}>No membership applications match your permitted filters.</Text>}
    {page.items.map(item=><View key={item.caseRef} style={styles.item}><Text style={styles.title}>{item.name}</Text><Text>{item.reference} · {label(item.status)}</Text><Text style={styles.muted}>Tier: {item.plan} · {label(item.category)}</Text><Text style={styles.muted}>Payment: {label(item.paymentStatus)}</Text>
     <Text style={styles.muted}>Submitted: {new Date(item.submittedAt).toLocaleDateString("en-IN",{timeZone:"Asia/Kolkata"})}</Text>
     {chip(selected===item.caseRef?"Selected":"View application",()=>choose(item.caseRef),selected===item.caseRef,busy)}</View>)}
    <View style={styles.buttons}>{chip("Previous",()=>{setOffset(x=>Math.max(0,x-25));setSelected(null);},false,busy||offset===0)}
     {chip("Next",()=>{setOffset(x=>x+25);setSelected(null);},false,busy||!page.hasMore)}</View>
   </>}
  </View>
  {detailBusy&&<ActivityIndicator accessibilityLabel="Loading protected case details"/>}
  {detail&&selected===detail.caseRef&&<View style={styles.card}>
   <Text style={styles.title}>Review {detail.reference}</Text>
   <Text style={styles.muted}>Application {detail.source.applicationNumber} · {label(detail.status)}</Text>
   <View style={styles.buttons} accessibilityRole="tablist" accessibilityLabel="Applicant details">
    {detailTabs.map(item=><React.Fragment key={item.key}>{chip(item.label+("pending" in item&&item.pending?" (pending)":""),()=>{
      setDetailTab(item.key);setPassword("");
     },detailTab===item.key,busy||("pending" in item&&item.pending===true))}</React.Fragment>)}
   </View>
   {detailTab==="OVERVIEW"&&<View style={styles.item}>
    <Text style={styles.title}>Application overview</Text>
    <Text>{detail.source.name} · {detail.source.plan}</Text>
    <Text>{label(detail.status)} · {detail.source.branch??"Foundation"}</Text>
    <Text>Verified proof: {detail.files.filter(f=>f.verified).length} of {detail.files.length}</Text>
    <Text>Original payment: {label(detail.fee.paymentStatus)}</Text>
    <Text>Accepted fee: {amount(detail.source.feeMinor)}</Text>
   </View>}
   {detailTab==="PERSONAL"&&<View style={styles.item}>
    <Text style={styles.title}>Personal information</Text>
    <Text>{detail.source.name} · {detail.source.mobile}</Text>
    <Text>{detail.source.email??"No email provided"}</Text>
    <Text>{detail.source.address}, {detail.source.city} · {detail.source.pinCode}</Text>
    <Text>{detail.source.district??"District unavailable"}, {detail.source.state??"State unavailable"}</Text>
    <Text style={styles.label}>Consent</Text>
    <Text>{detail.source.consentVersion} · {new Date(detail.source.consentedAt).toLocaleString("en-IN",{timeZone:"Asia/Kolkata"})}</Text>
    <Text style={styles.label}>Referral</Text><Text>{detail.source.referral||"No referral entered"}</Text>
   </View>}
   {detailTab==="MEMBERSHIP"&&<View style={styles.item}>
    <Text style={styles.title}>Membership details</Text>
    <Text>Tier: {detail.source.plan} · {label(detail.source.category)}</Text>
    <Text>Duration: {detail.source.durationUnit==="LIFETIME"?"Lifetime":detail.source.durationCount+" "+label(detail.source.durationUnit)+(detail.source.durationCount===1?"":"s")}</Text>
    <Text>Branch: {detail.source.branch??"Foundation"}</Text>
    <Text>Accepted joining fee: {amount(detail.source.feeMinor)}</Text>
    <Text style={styles.muted}>The original accepted amount is unaffected by later plan changes.</Text>
   </View>}
   {detailTab==="DOCUMENTS"&&<View style={styles.item}>
    <Text style={styles.title}>Protected original documents</Text>
    {detail.files.length===0&&<Text style={styles.muted}>No verified evidence is attached to this review.</Text>}
    {detail.files.map(f=><View key={f.fileRef} style={styles.item}>
     <Text>{label(f.classification)} · {f.verified?"Verified":"Changed or unavailable"}</Text>
     {f.verified&&chip("Open protected proof",()=>void shareProof(f.fileRef),false,busy)}
    </View>)}
   </View>}
   {detailTab==="PAYMENT"&&<View style={styles.item}>
    <Text style={styles.title}>Membership fee verification</Text>
    <Text>Accepted fee: {amount(detail.fee.feeMinor)}</Text>
    <Text>Payment state: {label(detail.fee.paymentStatus)}</Text>
    <Text>Bank verified: {amount(detail.fee.verifiedMinor)}</Text>
    <Text>Refund: {detail.fee.refundRequired?"Verified original fee requires refund":detail.fee.paymentStatus==="REFUNDED"?"Verified refund completed":"No outstanding verified refund indicated"}</Text>
    <Text style={styles.muted}>CG-09 is authoritative for payments and refunds. Donation records belong to Finance and are not inferred from fees.</Text>
   </View>}
   {detailTab==="WORKFLOW"&&<View style={styles.item}>
    <Text style={styles.title}>Approval workflow</Text><Text>Status: {label(detail.status)}</Text>
    <Text style={styles.muted}>Review approval is not a verified payment or issued membership.</Text>
    {detail.canDecide&&<View style={styles.item}>
     <Text style={styles.title}>Independent protected decision</Text>
     <View style={styles.buttons}>{(["APPROVE","RETURN","REJECT"] as const).map(v=><React.Fragment key={v}>{chip(v==="APPROVE"?"Approve (pending verification)":v==="RETURN"?"Return for correction":"Reject",()=>setDecision(v),decision===v,busy||!!pending.current)}</React.Fragment>)}</View>
     <Text style={styles.label}>Reviewer remarks {decision==="APPROVE"?"(optional)":"(required)"}</Text>
     <TextInput accessibilityLabel="Reviewer remarks" style={styles.input} value={remarks} onChangeText={setRemarks} multiline maxLength={500} editable={!busy&&!pending.current}/>
     <Text style={styles.label}>Current Foundation password</Text>
     <TextInput accessibilityLabel="Password to confirm review decision" secureTextEntry style={styles.input} value={password} onChangeText={setPassword} editable={!busy&&!pending.current}/>
     {chip("Confirm protected decision",()=>{
      if(decision!=="APPROVE"&&remarks.trim().length<3){setError("Provide a reason for returning or rejecting this application.");return;}
      void send({ref:detail.caseRef,requestKey:Crypto.randomUUID(),expectedRevision:detail.revision,action:decision,remarks:remarks.trim()},password);
     },false,busy||!!pending.current||password.length<8)}
    </View>}
    {!detail.canDecide&&<Text style={styles.muted}>No decision action is available in this case status or for this reviewer.</Text>}
   </View>}
   {detailTab==="ACTIVITY"&&<View style={styles.item}>
    <Text style={styles.title}>Original review activity</Text>
    {detail.timeline.length===0&&<Text style={styles.muted}>No committed review events are available.</Text>}
    {detail.timeline.map((event,i)=><Text key={i} style={styles.muted}>{label(event.action)} · {event.reviewer} · {new Date(event.occurredAt).toLocaleString("en-IN",{timeZone:"Asia/Kolkata"})}</Text>)}
   </View>}
   {chip("Back to application list",()=>{setSelected(null);setDetail(null);setPassword("");},false,busy)}
  </View>}
  {pending.current&&<View style={styles.card}><Text style={styles.title}>Review outcome uncertain</Text>
   <Text style={styles.muted}>Check the current case first. Re-enter your password to retry the exact original request; a new decision will not be created.</Text>
   {chip("Refresh original case",refresh,false,busy)}
   <TextInput accessibilityLabel="Re-enter password to retry original decision" secureTextEntry style={styles.input} value={retryPassword} onChangeText={setRetryPassword}/>
   {chip("Retry original decision",()=>{const cmd=pending.current;if(cmd)void send(cmd,retryPassword);},false,busy||retryPassword.length<8)}
  </View>}
 </ScrollView>;
}
const styles=StyleSheet.create({
 page:{padding:16,paddingBottom:120,gap:12,backgroundColor:theme.adminCanvas},
 heading:{fontSize:23,fontWeight:"800",color:theme.text},
 title:{fontSize:16,fontWeight:"700",color:theme.text},
 label:{fontWeight:"700",fontSize:13,color:theme.text},
 muted:{fontSize:13,lineHeight:19,color:theme.mutedText},
 error:{color:theme.error,fontSize:13},
 card:{backgroundColor:theme.surface,borderWidth:1,borderColor:theme.border,borderRadius:12,padding:14,gap:10},
 item:{borderTopWidth:1,borderColor:theme.border,paddingVertical:11,gap:8},
 input:{borderRadius:9,borderWidth:1,borderColor:theme.border,padding:11,color:theme.text,minHeight:42},
 buttons:{flexDirection:"row",flexWrap:"wrap",gap:8},
 chip:{borderWidth:1,borderColor:theme.border,backgroundColor:theme.selectedSurface,paddingHorizontal:12,paddingVertical:10,borderRadius:9},
 chipSelected:{backgroundColor:theme.primary,borderColor:theme.primary},
 chipText:{fontSize:13,fontWeight:"600",color:theme.primary},
 chipTextSelected:{color:theme.primaryText},
 disabled:{opacity:0.45}
});
