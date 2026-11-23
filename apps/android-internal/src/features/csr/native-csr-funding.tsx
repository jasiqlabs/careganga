import React,{useCallback,useEffect,useRef,useState} from "react";
import {ActivityIndicator,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import * as Crypto from "expo-crypto";
import {identityRequest} from "../identity-access/http-client";
import {NativeCsrFundingAgreementPanel} from "./native-csr-funding-agreement-panel";
import {NativeCsrFundingReceiptsPanel} from "./native-csr-funding-receipts-panel";
type Choice={value:string;label:string;branchRef?:string|null;projectVersion?:number};
type Options={foundation:boolean;branches:Choice[];partners:Choice[];projects:Choice[]};
type Proposal={ref:string;branchRef:string|null;partnerRef:string|null;projectRef:string|null;
 projectVersion:number|null;purpose:string;fundType:"CSR_PARTNER"|"FOUNDATION"|"MIXED";
 amountMinor:string;csrShareBps:number;status:string;version:number;updatedAt:string;
 partnerName:string|null;projectName:string|null;branch:string|null;agreementSummary:string;
 proposedFrom:string|null;proposedUntil:string|null};
type Draft={branchRef:string;partnerRef:string;projectRef:string;purpose:string;
 fundType:Proposal["fundType"];rupees:string;csrPercent:number;
 proposedFrom:string;proposedUntil:string;agreementSummary:string};
type Command={path:string;method:"POST"|"PATCH";body:Record<string,unknown>};
const empty=(branch=""):Draft=>({branchRef:branch,partnerRef:"",projectRef:"",purpose:"",
 fundType:"MIXED",rupees:"",csrPercent:70,proposedFrom:"",proposedUntil:"",agreementSummary:""});
const from=(p:Proposal):Draft=>({branchRef:p.branchRef??"",partnerRef:p.partnerRef??"",
 projectRef:p.projectRef??"",purpose:p.purpose,fundType:p.fundType,
 rupees:(BigInt(p.amountMinor)/100n).toString()+"."+
  (BigInt(p.amountMinor)%100n).toString().padStart(2,"0"),
 csrPercent:p.csrShareBps/100,proposedFrom:p.proposedFrom??"",
 proposedUntil:p.proposedUntil??"",agreementSummary:p.agreementSummary});
function minor(v:string):string|null{
 const x=/^([0-9]{1,13})(?:\.([0-9]{1,2}))?$/.exec(v.trim());
 return x?(BigInt(x[1])*100n+BigInt((x[2]??"").padEnd(2,"0"))).toString():null;
}
function money(v:string){try{const x=BigInt(v);return "₹"+(x/100n).toLocaleString("en-IN")+
 "."+(x%100n).toString().padStart(2,"0");}catch{return "Unknown amount";}}
async function api<T,>(token:string,path:string,method:"GET"|"POST"|"PATCH"="GET",body?:Record<string,unknown>):Promise<T>{
 const res=await identityRequest("/api/v1/csr/funding-proposals"+path,{method,
  headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},
  body:body?JSON.stringify(body):undefined});
 const x:unknown=await res.json().catch(()=>null);
 if(!res.ok||x===null)throw Object.assign(Error(res.status===403?
  "This funding branch or role is no longer permitted.":res.status===409?
  "The original sponsor, project or funding draft changed. Refresh.":
  res.status===401?"Sign in again.":"Funding result is uncertain. Check the source."),
  {status:res.status||503});
 return x as T;
}
export function NativeCsrFunding({token,canManage,canReadAgreement,canUploadAgreement,canReadFinance,canLinkFinance,onExpired}:{
 token:string;canManage:boolean;canReadAgreement:boolean;canUploadAgreement:boolean;
 canReadFinance:boolean;canLinkFinance:boolean;onExpired:()=>void}){
 const [options,setOptions]=useState<Options|null>(null);
 const [page,setPage]=useState<{items:Proposal[];hasMore:boolean;summary?:{requests:number;drafts:number;requestedMinor:string;verifiedFinance:null|{committedMinor:string;verifiedReceivedMinor:string;revalidationRequiredMinor:string;allocatedMinor:string;utilizedMinor:string;availableMinor:string|null;utilizationPercent:string|null;needsRevalidation:boolean}}}>({items:[],hasMore:false});
 const [scope,setScope]=useState("ALL"),[status,setStatus]=useState("ALL"),
  [offset,setOffset]=useState(0),[epoch,setEpoch]=useState(0);
 const [loading,setLoading]=useState(true),[listError,setListError]=useState(""),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [editing,setEditing]=useState(false),[step,setStep]=useState(0),
  [selected,setSelected]=useState<Proposal|null>(null),[draft,setDraft]=useState<Draft>(empty);
 const [busy,setBusy]=useState(false),[pending,setPending]=useState<Command|null>(null);
 const generation=useRef(0);
 const clearDetail=()=>{generation.current+=1;setEditing(false);setSelected(null);setStep(0);};
 const refresh=()=>{clearDetail();setEpoch(v=>v+1);};
 useEffect(()=>{
  let live=true;
  void api<Options>(token,"/options").then(v=>{if(live)setOptions(v);}).catch(e=>{
   if(live){setOptions(null);setError(e instanceof Error?e.message:"Funding selectors unavailable.");}
   if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
  });
  return()=>{live=false;};
 },[token,epoch,onExpired]);
 useEffect(()=>{
  let live=true;setLoading(true);setListError("");
  const query=new URLSearchParams({offset:String(offset)});
  if(scope!=="ALL")query.set("branchRef",scope);
  if(status!=="ALL")query.set("status",status);
  void api<{items:Proposal[];hasMore:boolean;summary:{requests:number;drafts:number;requestedMinor:string;verifiedFinance:null|{committedMinor:string;verifiedReceivedMinor:string;revalidationRequiredMinor:string;allocatedMinor:string;utilizedMinor:string;availableMinor:string|null;utilizationPercent:string|null;needsRevalidation:boolean}}}>(token,"?"+query).then(v=>{
   if(live){setPage(v);setListError("");}
  }).catch(e=>{
   if(live){setPage({items:[],hasMore:false});setListError(e instanceof Error?e.message:"Funding list unavailable.");}
   if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
  }).finally(()=>{if(live)setLoading(false);});
  return()=>{live=false;};
 },[token,scope,status,offset,epoch,onExpired]);
 const choose=async(p:Proposal)=>{
  if(busy||pending)return;
  const seq=++generation.current;setBusy(true);setError("");setSelected(null);setEditing(false);
  try{
   const current=await api<Proposal>(token,"/"+p.ref);
   if(seq!==generation.current)return;
   setDraft(from(current));setSelected(current);setEditing(true);setStep(0);
  }catch(e){if(seq===generation.current){
   clearDetail();setError(e instanceof Error?e.message:"Funding detail unavailable.");
   if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
  }}finally{setBusy(false);}
 };
 const send=async(command:Command)=>{
  if(busy)return;setPending(command);setBusy(true);setError("");setNotice("");
  try{
   await api(token,command.path,command.method,command.body);
   setPending(null);clearDetail();
   setNotice(command.path.endsWith("/resume")?
    "Returned funding request reopened as a draft. Correct it and add a new signed document.":
    "Funding draft saved — not an approved commitment or bank receipt.");
   setOffset(0);setEpoch(v=>v+1);
  }catch(e){
   const code=e&&typeof e==="object"&&"status" in e?Number(e.status):503;
   if(code===401)onExpired();
   if(code>0&&code<500)setPending(null);
   setError(code>=500||code===0?
    "Save outcome unknown. Retry the same original funding request only.":
    e instanceof Error?e.message:"Original funding source rejected the draft.");
  }finally{setBusy(false);}
 };
 const save=()=>{
  if(!canManage||busy||pending||!options||selected&&selected.status!=="DRAFT")return;
  const amountMinor=minor(draft.rupees);
  if(!amountMinor||BigInt(amountMinor)<1n||BigInt(amountMinor)>999999999999999n||
   draft.purpose.trim().length<10){
   setError("Enter a valid INR amount and a purpose of at least 10 characters.");return;}
  const branch=draft.branchRef||null;
  if(!options.foundation&&!branch){setError("Select your assigned branch.");return;}
  const partner=options.partners.find(v=>v.value===draft.partnerRef&&
   (v.branchRef===null||v.branchRef===branch));
  if(draft.fundType!=="FOUNDATION"&&!partner){
   setError("Choose an approved original CSR partner.");return;}
  const project=options.projects.find(v=>v.value===draft.projectRef&&
   (v.branchRef??null)===branch);
  if(draft.projectRef&&!project){setError("Choose a current eligible CG05 project.");return;}
  const bps=draft.fundType==="FOUNDATION"?0:draft.fundType==="CSR_PARTNER"?10000:
   draft.csrPercent*100;
  if(!Number.isSafeInteger(bps)||bps<0||bps>10000||
   draft.fundType==="MIXED"&&(bps===0||bps===10000)){
   setError("CSR and Foundation shares must total 100%.");return;}
  const body:Record<string,unknown>={requestKey:Crypto.randomUUID(),branchRef:branch,
   partnerRef:draft.fundType==="FOUNDATION"?null:draft.partnerRef,
   projectRef:draft.projectRef||null,projectVersion:project?.projectVersion??null,
   purpose:draft.purpose.trim(),fundType:draft.fundType,
   amountMinor,csrShareBps:bps,foundationShareBps:10000-bps,
   proposedFrom:draft.proposedFrom||null,proposedUntil:draft.proposedUntil||null,
   agreementSummary:draft.agreementSummary.trim()};
  if(selected)body.expectedVersion=selected.version;
  void send({path:selected?"/"+selected.ref:"",method:selected?"PATCH":"POST",body});
 };
 const field=(title:string,key:keyof Draft,large=false)=><View style={styles.field}>
  <Text style={styles.label}>{title}</Text>
  <TextInput value={String(draft[key])} editable={canManage&&(!selected||selected.status==="DRAFT")&&!busy&&!pending}
   onChangeText={v=>setDraft(x=>({...x,[key]:key==="csrPercent"?Number(v):v}))}
   style={[styles.input,large&&styles.large]} multiline={large}
   placeholderTextColor="#64748B" placeholder={title}
   keyboardType={key==="rupees"?"decimal-pad":"default"}/>
 </View>;
 const chooseItem=(value:string,title:string,current:string,change:(next:string)=>void,
  disabled=false)=><Pressable key={value} accessibilityRole="button"
  accessibilityState={{selected:current===value,disabled:disabled||busy||!!pending}}
  disabled={disabled||busy||!!pending} onPress={()=>change(value)}
  style={[styles.choice,current===value&&styles.selected]}>
  <Text style={styles.choiceText}>{title}</Text>
 </Pressable>;
 const branch=draft.branchRef||null;
 const sponsors=options?.partners.filter(x=>x.branchRef===null||x.branchRef===branch)??[];
 const projects=options?.projects.filter(x=>(x.branchRef??null)===branch)??[];
 return <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
  <Text style={styles.title}>Fund Management</Text>
  <Text style={styles.note}>B07–B08 original funding requests. No pledge is received,
   allocated or utilized money until original CG03/CG09 validation.</Text>
  {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
  {!!listError&&<Text accessibilityRole="alert" style={styles.error}>{listError}</Text>}
  {!!notice&&<Text style={styles.success}>{notice}</Text>}
  {page.summary&&!listError&&<View accessibilityLabel="Original B07 scoped requested and independently verified money"
   style={{flexDirection:"row",flexWrap:"wrap",gap:8}}>
   {([
    ["requested","Total Fund / CSR requested",money(page.summary.requestedMinor)],
    ["received","Received · CG09 verified",page.summary.verifiedFinance?
     money(page.summary.verifiedFinance.verifiedReceivedMinor):"Finance restricted"],
    ["committed","Committed · CG03 approved",page.summary.verifiedFinance?
     money(page.summary.verifiedFinance.committedMinor):"Finance restricted"],
    ["utilized","Utilized · CG09",page.summary.verifiedFinance?money(page.summary.verifiedFinance.utilizedMinor):"Finance restricted"],
    ["available","Available · CG09",page.summary.verifiedFinance?.availableMinor!==null&&page.summary.verifiedFinance?.availableMinor!==undefined?money(page.summary.verifiedFinance.availableMinor):"Finance check required"],
    ["percentage","Utilization %",page.summary.verifiedFinance?.utilizationPercent!==null&&page.summary.verifiedFinance?.utilizationPercent!==undefined?page.summary.verifiedFinance.utilizationPercent+"%":"Finance check required"]
   ] as const).map(([id,label,value])=><View key={id} style={[styles.panel,{minWidth:145,flexGrow:1}]}>
    <Text style={styles.heading}>{value}</Text><Text style={styles.note}>{label}</Text>
   </View>)}
   <Text style={styles.note}>{page.summary.requests} original requests ·
    {page.summary.drafts} unapproved drafts. A signed pledge is not cash.</Text>
   {page.summary.verifiedFinance&&page.summary.verifiedFinance.needsRevalidation&&
    <Text accessibilityRole="alert" style={styles.error}>
     Prior bank evidence revoked or reversed; excluded from current received.</Text>}
  </View>}
  <View style={styles.panel}>
   <Text style={styles.heading}>Funding requests</Text>
   <Text style={styles.label}>Current status</Text>
   <ScrollView horizontal contentContainerStyle={styles.horizontal}>
    {(["ALL","DRAFT","SUBMITTED","APPROVED","RETURNED","REJECTED"] as const)
     .map(x=>chooseItem(x,x==="ALL"?"All":x==="SUBMITTED"?"Pending":x,status,v=>{
      clearDetail();setOffset(0);setStatus(v);}))}
   </ScrollView>
   <Text style={styles.label}>Current Foundation branch</Text>
   <ScrollView horizontal contentContainerStyle={styles.horizontal}>
    {chooseItem("ALL","All assigned",scope,v=>{clearDetail();setOffset(0);setScope(v);})}
    {options?.foundation&&chooseItem("FOUNDATION","Foundation",scope,v=>{clearDetail();setOffset(0);setScope(v);})}
    {options?.branches.map(x=>chooseItem(x.value,x.label,scope,v=>{
     clearDetail();setOffset(0);setScope(v);} ))}
   </ScrollView>
   <View style={styles.actions}>
    {chooseItem("refresh","Refresh", "",refresh)}
    {canManage&&chooseItem("new","New funding draft","",()=>{
     if(!options)return;
     clearDetail();setDraft(empty(options.foundation?"":options.branches[0]?.value??""));
     setEditing(true);setError("");},!options)}
   </View>
   {loading?<ActivityIndicator accessibilityLabel="Checking original funding"/>:listError?null:
    page.items.length===0?<Text style={styles.note}>No verified source drafts for this filter.</Text>:
    page.items.map(item=><View key={item.ref} style={styles.record}>
     <Text style={styles.heading}>{item.purpose}</Text>
     <Text style={styles.note}>{item.partnerName??"Foundation"} · {item.projectName??"General purpose"}</Text>
     <Text style={styles.note}>{money(item.amountMinor)} requested ·
      {item.csrShareBps/100}% CSR · {item.status==="DRAFT"?"Draft (not approved)":item.status}</Text>
     {chooseItem(item.ref,"View funding request","",()=>void choose(item))}
    </View>)}
   <View style={styles.actions}>
    {chooseItem("previous","Previous","",()=>{clearDetail();setOffset(x=>Math.max(0,x-25));},offset===0)}
    <Text style={styles.note}>Page {1+Math.floor(offset/25)}</Text>
    {chooseItem("next","Next","",()=>{clearDetail();setOffset(x=>x+25);},!page.hasMore)}
   </View>
  </View>
  {editing&&<View style={styles.panel}>
   <Text style={styles.heading}>{selected?"Original funding details":"New funding request"}</Text>
   <Text style={styles.note}>Four original steps. Save Draft does not submit or approve money.</Text>
   <ScrollView horizontal contentContainerStyle={styles.horizontal}>
    {["Information","Project & split","Agreement notes","Review"].map((label,i)=>
     chooseItem(String(i),String(i+1)+" · "+label,String(step),v=>setStep(Number(v))))}
   </ScrollView>
   {step===0&&<>
    <Text style={styles.label}>Permitted Foundation branch</Text>
    <ScrollView horizontal contentContainerStyle={styles.horizontal}>
     {options?.foundation&&chooseItem("","Foundation-wide",draft.branchRef,v=>{
      setDraft(x=>({...x,branchRef:v,partnerRef:"",projectRef:""}));},!!selected)}
     {options?.branches.map(x=>chooseItem(x.value,x.label,draft.branchRef,v=>{
      setDraft(z=>({...z,branchRef:v,partnerRef:"",projectRef:""}));},!!selected))}
    </ScrollView>
    <Text style={styles.label}>Funding source</Text>
    <ScrollView horizontal contentContainerStyle={styles.horizontal}>
     {(["MIXED","CSR_PARTNER","FOUNDATION"] as const).map(x=>
      chooseItem(x,x==="MIXED"?"CSR + Foundation":x==="CSR_PARTNER"?"CSR only":"Foundation only",
       draft.fundType,v=>setDraft(old=>({...old,fundType:v as Draft["fundType"],
        csrPercent:v==="FOUNDATION"?0:v==="CSR_PARTNER"?100:70,
        partnerRef:v==="FOUNDATION"?"":old.partnerRef})),!!selected))}
    </ScrollView>
    {field("Funding purpose","purpose",true)}
    {field("Requested INR amount","rupees")}
    {field("Proposed start YYYY-MM-DD","proposedFrom")}
    {field("Proposed end YYYY-MM-DD","proposedUntil")}
   </>}
   {step===1&&<>
    {draft.fundType!=="FOUNDATION"&&<>
     <Text style={styles.label}>Actual approved CSR sponsor</Text>
     <ScrollView horizontal contentContainerStyle={styles.horizontal}>
      {sponsors.map(x=>chooseItem(x.value,x.label,draft.partnerRef,v=>
       setDraft(z=>({...z,partnerRef:v})),!!selected))}
     </ScrollView>
     {sponsors.length===0&&<Text accessibilityRole="alert" style={styles.error}>
      No approved sponsor is available in this assigned branch.</Text>}
    </>}
    <Text style={styles.label}>Current project (optional)</Text>
    <ScrollView horizontal contentContainerStyle={styles.horizontal}>
     {chooseItem("","General purpose — no project",draft.projectRef,v=>
      setDraft(z=>({...z,projectRef:v})),!!selected&&selected.status!=="DRAFT")}
     {projects.map(x=>chooseItem(x.value,x.label,draft.projectRef,v=>
      setDraft(z=>({...z,projectRef:v})),!!selected&&selected.status!=="DRAFT"))}
    </ScrollView>
    {draft.fundType==="MIXED"&&field("CSR percentage (1–99)","csrPercent")}
    <Text style={styles.note}>CSR: {draft.csrPercent}% · Foundation: {100-draft.csrPercent}%.
     This is a planned split only, not cash.</Text>
   </>}
   {step===2&&<>
    {field("Private agreement scope and notes","agreementSummary",true)}
    <Text style={styles.note}>Actual signed proof must be verified through CG19;
     independent funding approval through CG03 is not yet available.</Text>
   </>}
   {step===3&&<>
    <Text style={styles.label}>Review requested-only amount</Text>
    <Text style={styles.heading}>{minor(draft.rupees)?money(minor(draft.rupees)!):"Invalid INR amount"}</Text>
    <Text style={styles.note}>{draft.purpose||"Purpose not entered"}</Text>
    <Text style={styles.note}>CSR {draft.csrPercent}% / Foundation {100-draft.csrPercent}%</Text>
    <Text style={styles.note}>After saving: DRAFT. Not approved, received, allocated or utilized.</Text>
   </>}
   <View style={styles.actions}>
    {chooseItem("close","Close","",clearDetail)}
    {selected?.status==="RETURNED"&&canManage&&chooseItem("resume","Revise returned funding request","",()=>{
     void send({path:"/"+selected.ref+"/resume",method:"POST",
      body:{requestKey:Crypto.randomUUID(),expectedVersion:selected.version}});
    })}
    {step>0&&chooseItem("back","Previous","",()=>setStep(x=>Math.max(0,x-1)))}
    {step<3?chooseItem("forward","Next","",()=>setStep(x=>Math.min(3,x+1))):
     canManage&&(!selected||selected.status==="DRAFT")&&chooseItem("save","Save draft","",save)}
   </View>
  </View>}
  {editing&&selected&&canReadAgreement&&<NativeCsrFundingAgreementPanel
   key={selected.ref+":"+selected.version} token={token} proposalRef={selected.ref}
   version={selected.version} canUpload={canManage&&canUploadAgreement&&selected.status==="DRAFT"}
   canSubmit={canManage&&selected.status==="DRAFT"}
   onSubmitted={()=>{clearDetail();setEpoch(x=>x+1);setNotice("Funding review submitted. No cash posted.");}}
   onExpired={onExpired}/>}
  {editing&&selected?.status==="APPROVED"&&canReadFinance&&
   <NativeCsrFundingReceiptsPanel key={selected.ref+":"+selected.version}
    token={token} proposalRef={selected.ref} version={selected.version}
    canLink={canManage&&canLinkFinance} onExpired={onExpired}/>}
  {!!pending&&<View style={styles.panel}>
   <Text accessibilityRole="alert" style={styles.error}>The original write may have succeeded.
    Retry the same key, not a new request.</Text>
   {chooseItem("retry","Retry original command","",()=>void send(pending))}
  </View>}
 </ScrollView>;
}
const styles=StyleSheet.create({
 body:{backgroundColor:"#F8FAFC",padding:16,paddingBottom:120,gap:14},
 title:{fontSize:22,fontWeight:"800",color:"#0F172A"},
 heading:{fontSize:16,fontWeight:"700",color:"#102D45"},
 note:{fontSize:13,color:"#526477",lineHeight:19},
 field:{gap:6},label:{fontSize:13,fontWeight:"600",color:"#334155"},
 panel:{padding:14,borderWidth:1,borderColor:"#D8E1EA",borderRadius:12,backgroundColor:"#FFFFFF",gap:12},
 input:{minHeight:44,padding:10,borderWidth:1,borderColor:"#CBD5E1",borderRadius:8,
  backgroundColor:"#FFFFFF",color:"#0F172A"},
 large:{minHeight:88,textAlignVertical:"top"},horizontal:{gap:8,paddingVertical:3,alignItems:"center"},
 choice:{paddingHorizontal:13,paddingVertical:11,borderRadius:9,
  backgroundColor:"#F4F7FC",borderWidth:1,borderColor:"#BCD0E0"},
 selected:{backgroundColor:"#DCFCE7",borderColor:"#0D7C51"},
 choiceText:{color:"#174D65",fontSize:13,fontWeight:"600"},
 actions:{flexDirection:"row",flexWrap:"wrap",alignItems:"center",gap:9},
 record:{borderTopWidth:1,borderTopColor:"#E2E8F0",paddingTop:12,gap:6},
 error:{color:"#B91C1C",fontSize:13},success:{color:"#166534",fontSize:13}
});
