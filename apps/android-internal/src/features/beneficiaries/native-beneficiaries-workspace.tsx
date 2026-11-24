import {NativeBeneficiaryReportPanel} from "./native-beneficiary-report-panel";
import {NativeAssistancePanel} from "./native-assistance-panel";
import {NativeProjectCoverPanel} from "../projects/native-project-cover-panel";
import React,{useCallback,useEffect,useRef,useState} from "react";
import {ActivityIndicator,Modal,Pressable,ScrollView,Text,TextInput,View} from "react-native";
import * as Crypto from "expo-crypto";
import {identityRequest} from "../identity-access/http-client";
import {careGangaTheme as theme} from "../../../../../packages/design-tokens/src/index";
type Option={value:string;label:string};
type Options={canManageFoundation:boolean;canFilterProjects:boolean;branches:Option[];states:Option[];districts:Option[];blocks:Option[]};
type Item={ref:string;reference:string;name:string;contactMobile:string|null;representativeName:string|null;
 representativeContact:string|null;branchRef:string|null;stateRef:string;districtRef:string|null;blockRef:string|null;beneficiaryCategory:string|null;beneficiaryType:string;
 gender:string;ageGroup:string;consentKind:string;consentPurpose:string|null;consentRevoked:boolean;
 verification:string;lifecycle:string;revision:number;projectLinks?:{ref:string;projectRef:string;projectName:string}[]};
type Summary={total:number;male:number;female:number;children:number;active:number;verified:number};
const metrics:[keyof Summary,string][]=[["total","Total Beneficiaries"],["male","Male"],["female","Female"],["children","Children"],["active","Active"],["verified","Verified"]];
function validateIntake(v:Form):string{
 if(v.name.trim().length<2)return "Enter the beneficiary name (at least 2 characters).";
 if(v.beneficiaryType.trim().length<2)return "Enter the beneficiary type.";
 if(!v.stateRef)return "Select the beneficiary state.";
 if(v.blockRef&&!v.districtRef)return "Select a district before choosing a block.";
 if(v.contactMobile.trim()&&!/^\+[1-9][0-9]{7,14}$/.test(v.contactMobile.trim()))return "Enter the contact mobile with country code, or leave it blank.";
 if(v.representativeContact.trim()&&!/^\+[1-9][0-9]{7,14}$/.test(v.representativeContact.trim()))return "Enter the representative mobile with country code, or leave it blank.";
 if(v.ageGroup==="CHILD"&&v.consentKind!=="GUARDIAN")return "A child requires guardian consent.";
 if(v.consentKind!=="SELF"&&!v.representativeName.trim())return "Enter the guardian or representative name.";
 if(v.consentPurpose.trim().length<5)return "Enter the consent purpose (at least 5 characters).";
 if(!v.consentAcknowledged)return "Confirm consent acknowledgement.";
 return "";
}
type Page={summary:Summary;items:Item[];nextCursor:string|null;hasMore:boolean};
type DuplicateSuggestion={reference:string;maskedName:string;beneficiaryType:string;contactMatches:boolean};
type DuplicateResponse={advisory:boolean;items:DuplicateSuggestion[];hasMore:boolean};
type ActionHistory={action:string;revision:number;reason:string|null;at:string};
type VerificationHistory={decision:string;sourceRevision:number;at:string};
type ReviewInfo={status:string;caseNumber:string|null;revision?:number;canReview:boolean;caseRef:string|null;
 sourceRevision:number;sourceVerification:string;allowedDecisions?:string[];requiresCurrentPassword?:boolean;
 decisions?:{action:string;remarks:string;at:string}[]};
type Form={branchRef:string;name:string;contactMobile:string;representativeName:string;representativeContact:string;
 stateRef:string;districtRef:string;blockRef:string;beneficiaryCategory:string;beneficiaryType:string;gender:string;ageGroup:string;consentKind:string;
 consentPurpose:string;consentAcknowledged:boolean};
const blank=():Form=>({branchRef:"",name:"",contactMobile:"",representativeName:"",representativeContact:"",
 stateRef:"",districtRef:"",blockRef:"",beneficiaryCategory:"",beneficiaryType:"",gender:"NOT_SPECIFIED",ageGroup:"NOT_SPECIFIED",consentKind:"SELF",
 consentPurpose:"Foundation beneficiary assistance",consentAcknowledged:false});
const fromItem=(x:Item):Form=>({...blank(),branchRef:x.branchRef??"",name:x.name,contactMobile:x.contactMobile??"",
 representativeName:x.representativeName??"",representativeContact:x.representativeContact??"",stateRef:x.stateRef,
 districtRef:x.districtRef??"",blockRef:x.blockRef??"",beneficiaryCategory:x.beneficiaryCategory??"",beneficiaryType:x.beneficiaryType,gender:x.gender,ageGroup:x.ageGroup,
 consentKind:x.consentKind,consentPurpose:x.consentPurpose??"",consentAcknowledged:true});
const capitalize=(s:string)=>s.toLowerCase().replaceAll("_"," ").replace(/^./,x=>x.toUpperCase());
const actionStyle={padding:12,borderRadius:10,backgroundColor:"#1D4ED8",marginTop:8} as const;
const textStyle={fontSize:14,color:"#0F172A"} as const;
const labelStyle={fontSize:12,fontWeight:"600",color:"#334155",marginBottom:4} as const;
function Button({label,onPress,disabled=false,outline=false}:{label:string;onPress:()=>void;disabled?:boolean;outline?:boolean}){
 return <Pressable accessibilityRole="button" accessibilityState={{disabled}} disabled={disabled}
  onPress={onPress} style={{...actionStyle,backgroundColor:outline?"#EFF6FF":disabled?"#94A3B8":"#1D4ED8",
   borderColor:"#BFDBFE",borderWidth:outline?1:0}}>
  <Text style={{color:outline?"#1D4ED8":"white",fontWeight:"700",textAlign:"center"}}>{label}</Text>
 </Pressable>;
}
function Select({title,selected,items,onSelect}:{title:string;selected:string;items:Option[];onSelect:(x:string)=>void}){
 return <View style={{marginBottom:10}}>
  <Text style={labelStyle}>{title}</Text>
  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{maxHeight:46}}
   contentContainerStyle={{gap:7}}>
   {items.map(x=><Pressable key={x.value} onPress={()=>onSelect(x.value)} accessibilityRole="button"
    accessibilityState={{selected:selected===x.value}}
    style={{padding:10,borderRadius:9,borderWidth:1,
     borderColor:selected===x.value?"#1D4ED8":"#CBD5E1",
     backgroundColor:selected===x.value?"#DBEAFE":"white"}}>
    <Text style={{fontSize:12,color:"#0F172A"}}>{x.label}</Text></Pressable>)}
  </ScrollView>
 </View>;
}
const enumOptions=(items:string[]):Option[]=>items.map(x=>({value:x,label:capitalize(x)}));
export function NativeBeneficiariesWorkspace({token,onExpired,canManage,canLinkProjects,canManageLifecycle,canRevoke,canSubmitVerification,canReviewVerification,canReadEvidence,canUploadEvidence,canViewAssistance,canManageAssistance,canReviewAssistance,canDeliverAssistance,canIssueStock,canPreparePayment,canExportReports}:{
 token:string;onExpired:()=>void;canManage:boolean;canLinkProjects:boolean;canManageLifecycle:boolean;canRevoke:boolean;
 canSubmitVerification:boolean;canReviewVerification:boolean;canReadEvidence:boolean;canUploadEvidence:boolean;
 canViewAssistance:boolean;canManageAssistance:boolean;canReviewAssistance:boolean;canDeliverAssistance:boolean;canIssueStock:boolean;canPreparePayment:boolean;canExportReports:boolean;
}){
 const [page,setPage]=useState<Page|null>(null),[selected,setSelected]=useState<Item|null>(null);
 const [opts,setOpts]=useState<Options|null>(null),[districts,setDistricts]=useState<Option[]>([]);
 const [q,setQ]=useState(""),[search,setSearch]=useState(""),[tab,setTab]=useState("ALL"),[branch,setBranch]=useState("");
 const [genderFilter,setGenderFilter]=useState(""),[ageFilter,setAgeFilter]=useState(""),[typeFilter,setTypeFilter]=useState("");
 const [projectFilter,setProjectFilter]=useState(""),[projectSearch,setProjectSearch]=useState(""),[filterProjects,setFilterProjects]=useState<Option[]>([]);
 const [stateFilter,setStateFilter]=useState(""),[districtFilter,setDistrictFilter]=useState("");
 const [fromFilter,setFromFilter]=useState(""),[toFilter,setToFilter]=useState("");
 const [filterDistricts,setFilterDistricts]=useState<Option[]>([]),[filterBlocks,setFilterBlocks]=useState<Option[]>([]),[blocks,setBlocks]=useState<Option[]>([]);
 const [blockFilter,setBlockFilter]=useState(""),[categoryFilter,setCategoryFilter]=useState("");
 const [campaignFilter,setCampaignFilter]=useState(""),[filterCampaigns,setFilterCampaigns]=useState<Option[]>([]);
 const [appliedFilters,setAppliedFilters]=useState({gender:"",ageGroup:"",type:"",stateRef:"",districtRef:"",blockRef:"",category:"",registeredFrom:"",registeredTo:"",projectRef:"",campaignRef:""});
 const [cursor,setCursor]=useState(""),[history,setHistory]=useState<string[]>([]);
 const [auditHistory,setAuditHistory]=useState<ActionHistory[]>([]),[verificationHistory,setVerificationHistory]=useState<VerificationHistory[]>([]);
 const [review,setReview]=useState<ReviewInfo|null>(null),[reviewAction,setReviewAction]=useState("APPROVE");
 const [reviewRemarks,setReviewRemarks]=useState(""),[reviewPassword,setReviewPassword]=useState("");
 const [verificationBusy,setVerificationBusy]=useState(false);
 const [submitKey,setSubmitKey]=useState(Crypto.randomUUID),[decisionKey,setDecisionKey]=useState(Crypto.randomUUID);
 const [refreshKey,setRefreshKey]=useState(0),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [mode,setMode]=useState<"create"|"edit"|null>(null),[draft,setDraft]=useState(blank);
 const [commandKey,setCommandKey]=useState(""),[projects,setProjects]=useState<Option[]>([]);
 const [projectRef,setProjectRef]=useState(""),[linkKey,setLinkKey]=useState(""),[reason,setReason]=useState("");
 const [duplicates,setDuplicates]=useState<DuplicateResponse|null>(null),
  [checkingDuplicates,setCheckingDuplicates]=useState(false);
 const change=(key:keyof Form,value:string|boolean)=>{setDraft(f=>({...f,[key]:value}));setDuplicates(null);};
 const api=useCallback(async<T,>(path:string,method="GET",body?:Record<string,unknown>):Promise<T>=>{
  const r=await identityRequest("/api/v1/beneficiaries"+path,{cache:"no-store",method,
   headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},
   ...(body?{body:JSON.stringify(body)}:{})});
  if(r.status===401){onExpired();throw Error("Sign in again.");}
  const v=await r.json().catch(()=>null);
  if(!r.ok||v===null)throw Error(r.status===403?"Your current role or branch cannot perform this action.":
   r.status===404?"Beneficiary unavailable.":r.status===409?"The record changed. Refresh to continue.":
   r.status===400?"Check the beneficiary details.":"Outcome unavailable. Refresh before retrying.");
  return v as T;
 },[token,onExpired]);
 useEffect(()=>{let active=true;void api<Options>("/options")
  .then(x=>{if(active)setOpts(x);}).catch(e=>{if(active)setError(String(e.message));});
  return()=>{active=false;};},[api]);
 useEffect(()=>{let active=true;setDistricts([]);
  if(draft.stateRef)void api<Options>("/options?"+new URLSearchParams({stateRef:draft.stateRef}))
   .then(x=>{if(active)setDistricts(x.districts);})
   .catch(e=>{if(active)setError(String(e.message));});
  return()=>{active=false;};},[draft.stateRef,api]);
 useEffect(()=>{let live=true;setLoading(true);
  const p=new URLSearchParams();
  if(search)p.set("q",search);if(branch)p.set("branchRef",branch);if(tab==="ACTIVE"||tab==="INACTIVE")p.set("lifecycle",tab);
  if(tab==="VERIFIED")p.set("verification","VERIFIED");
  if(tab==="PENDING")p.set("verification","PENDING");
  for(const [k,v] of Object.entries(appliedFilters))if(v.trim())p.set(k,v.trim());
   if(cursor)p.set("cursor",cursor);
  void api<Page>("?"+p).then(x=>{if(live)setPage(x);})
   .catch(e=>{if(live){setPage(null);setError(e.message);}})
   .finally(()=>{if(live)setLoading(false);});
  return()=>{live=false;};
 },[search,tab,branch,cursor,refreshKey,api,appliedFilters]);
 useEffect(()=>{let live=true;setFilterDistricts([]);if(stateFilter)void api<Options>("/options?"+new URLSearchParams({stateRef:stateFilter})).then(v=>{if(live)setFilterDistricts(v.districts);}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[stateFilter,api]);
 useEffect(()=>{let live=true;setFilterBlocks([]);if(stateFilter&&districtFilter)void api<Options>("/options?"+new URLSearchParams({stateRef:stateFilter,districtRef:districtFilter})).then(v=>{if(live)setFilterBlocks(v.blocks);}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[stateFilter,districtFilter,api]);
 useEffect(()=>{let live=true;setBlocks([]);if(draft.stateRef&&draft.districtRef)void api<Options>("/options?"+new URLSearchParams({stateRef:draft.stateRef,districtRef:draft.districtRef})).then(v=>{if(live)setBlocks(v.blocks);}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[draft.stateRef,draft.districtRef,api]);
 const detailSeq=useRef(0),detailTarget=useRef("");
 const select=async(id:string)=>{const n=++detailSeq.current;if(detailTarget.current!==id){detailTarget.current=id;setSubmitKey(Crypto.randomUUID());setDecisionKey(Crypto.randomUUID());}setBusy(true);setSelected(null);setReview(null);setError("");
  try{
   const [x,audit,verification,reviewInfo]=await Promise.all([
    api<Item>("/"+id),api<{items:ActionHistory[]}>("/"+id+"/history"),
    api<{items:VerificationHistory[]}>("/"+id+"/verification-history"),
    api<ReviewInfo>("/"+id+"/verification-review").catch(()=>null)
   ]);
   if(n!==detailSeq.current)return;
   setSelected(x);setAuditHistory(audit.items);setVerificationHistory(verification.items);
   setReview(reviewInfo);setReviewPassword("");setReviewRemarks("");
   if(!reviewInfo)setError("Independent verification unavailable. Review actions are disabled until refresh.");
   setLinkKey(Crypto.randomUUID());setProjectRef("");
   if(canLinkProjects){const p=new URLSearchParams({branchRef:x.branchRef??""});
    const options=await api<Option[]>("/eligible-projects?"+p).catch(()=>[]);if(n===detailSeq.current)setProjects(options);}
  }catch(e){if(n===detailSeq.current){setSelected(null);setError(e instanceof Error?e.message:"Cannot open beneficiary");}}
  finally{if(n===detailSeq.current)setBusy(false);}
 };
 const reload=()=>setRefreshKey(x=>x+1);
 const loadCampaignFilters=async()=>{try{const v=await api<{items:Option[]}>("/campaign-report-options?"+new URLSearchParams({branchRef:branch,projectRef:projectFilter}));setFilterCampaigns(v.items);if(!v.items.some(x=>x.value===campaignFilter))setCampaignFilter("");}catch(e){setFilterCampaigns([]);setCampaignFilter("");setError(e instanceof Error?e.message:"Campaigns unavailable");}};
 const loadProjectFilters=async()=>{try{setFilterProjects(await api<Option[]>("/project-filter-options?"+new URLSearchParams({branchRef:branch,q:projectSearch.trim()})));}catch(e){setFilterProjects([]);setError(e instanceof Error?e.message:"Projects unavailable");}};
 const open=(m:"create"|"edit")=>{setMode(m);setError("");setDuplicates(null);setDraft(m==="create"?{...blank(),branchRef:opts&&!opts.canManageFoundation?opts.branches[0]?.value??"":""}:selected?fromItem(selected):blank());setCommandKey(Crypto.randomUUID());};
 const submitVerification=async()=>{
  if(!selected||verificationBusy||!canSubmitVerification)return;
  setVerificationBusy(true);setError("");
  try{
   const outcome=await api<{caseNumber:string;status:string}>("/"+selected.ref+"/submit-verification","POST",{
    requestKey:submitKey,expectedRevision:selected.revision});
   setSubmitKey(Crypto.randomUUID());
   await select(selected.ref);reload();
   setNotice("Submitted to independent CG-03 review: "+outcome.caseNumber);
  }catch(e){setError(e instanceof Error?e.message:"Submission unknown. Retry using the same request.");}
  finally{setVerificationBusy(false);}
 };
 const decideVerification=async()=>{
  if(!selected||!review?.canReview||!review.caseRef||!review.revision||!canReviewVerification||verificationBusy)return;
  setVerificationBusy(true);setError("");
  try{
   const outcome=await api<{status:string}>("/verification-cases/"+review.caseRef+"/decide","POST",{
    requestKey:decisionKey,expectedRevision:review.revision,action:reviewAction,
    remarks:reviewRemarks,currentPassword:reviewPassword});
   setDecisionKey(Crypto.randomUUID());setReviewPassword("");setReviewRemarks("");
   await select(selected.ref);reload();
   setNotice("Original CG-03 review: "+capitalize(outcome.status));
  }catch(e){setError(e instanceof Error?e.message:"Decision not confirmed. Refresh before retrying.");}
  finally{setVerificationBusy(false);}
 };
 const checkDuplicates=async()=>{
  if(checkingDuplicates)return;
  if(draft.name.trim().length<3&&!draft.contactMobile.trim())return;
  setCheckingDuplicates(true);setError("");
  try{
   const p=new URLSearchParams({branchRef:draft.branchRef,name:draft.name.trim(),
    contactMobile:draft.contactMobile.trim()});
   if(mode==="edit"&&selected)p.set("excludeRef",selected.ref);
   setDuplicates(await api<DuplicateResponse>("/duplicate-suggestions?"+p));
  }catch(e){setError(e instanceof Error?e.message:"Could not check possible matches");}
  finally{setCheckingDuplicates(false);}
 };
 const save=async()=>{if(busy||!mode||!draft.consentAcknowledged)return;setBusy(true);setError("");
  const fieldIssue=validateIntake(draft);if(fieldIssue){setError(fieldIssue);setBusy(false);return;}
  const body:Record<string,unknown>={...draft,requestKey:commandKey,branchRef:draft.branchRef||null,
   contactMobile:draft.contactMobile||null,representativeName:draft.representativeName||null,
   representativeContact:draft.representativeContact||null,districtRef:draft.districtRef||null};
  if(mode==="edit"){delete body.branchRef;body.expectedRevision=selected?.revision;}
  try{
   const x=await api<{ref:string}>(mode==="edit"?"/"+selected?.ref:"",mode==="edit"?"PATCH":"POST",body);
   setMode(null);reload();await select(x.ref);setNotice("Saved privately. Independent verification is separate.");
  }catch(e){setError(e instanceof Error?e.message:"Could not confirm save. Recheck before retrying.");}
  finally{setBusy(false);}
 };
 const link=async()=>{
  if(!selected||!projectRef||busy)return;setBusy(true);setError("");
  try{await api("/"+selected.ref+"/project-links","POST",{requestKey:linkKey,
   expectedRevision:selected.revision,projectRef});reload();await select(selected.ref);setNotice("Project linked.");}
  catch(e){setError(e instanceof Error?e.message:"Could not confirm project link");}
  finally{setBusy(false);}
 };
 const unlink=async(id:string)=>{
  if(!selected||busy)return;setBusy(true);setError("");
  try{await api("/"+selected.ref+"/project-links","DELETE",
   {requestKey:Crypto.randomUUID(),expectedRevision:selected.revision,linkRef:id});
   reload();await select(selected.ref);setNotice("Project unlinked. History retained.");}
  catch(e){setError(e instanceof Error?e.message:"Could not unlink project");}
  finally{setBusy(false);}
 };
 const lifecycle=async()=>{
  if(!selected||busy||reason.trim().length<3)return;setBusy(true);setError("");
  try{await api("/"+selected.ref+"/lifecycle","PATCH",{requestKey:Crypto.randomUUID(),
   expectedRevision:selected.revision,lifecycle:selected.lifecycle==="ACTIVE"?"INACTIVE":"ACTIVE",reason});
   await select(selected.ref);reload();setReason("");setNotice("Lifecycle updated.");}
  catch(e){setError(e instanceof Error?e.message:"Change not confirmed");}
  finally{setBusy(false);}
 };
 const revoke=async()=>{
  if(!selected||busy||reason.trim().length<3)return;setBusy(true);setError("");
  try{await api("/"+selected.ref+"/revoke-consent","POST",{requestKey:Crypto.randomUUID(),
   expectedRevision:selected.revision,reason});await select(selected.ref);reload();setReason("");
   setNotice("Consent withdrawal recorded. Private details restricted.");}
  catch(e){setError(e instanceof Error?e.message:"Withdrawal not confirmed");}
  finally{setBusy(false);}
 };
 return <View style={{flex:1,backgroundColor:"#F8FAFC"}}>
  <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:18,paddingBottom:100,gap:12}}>
   <Text style={{fontSize:23,fontWeight:"800",color:theme.text}}>Beneficiaries</Text>
   <Text style={{color:"#64748B"}}>Private Foundation records · current branch and role only</Text>
   <View style={{flexDirection:"row",flexWrap:"wrap",gap:8}}>
    {metrics.map(([key,label])=><View key={key} style={{flexBasis:"30%",flexGrow:1,backgroundColor:"white",padding:12,borderRadius:10,borderWidth:1,borderColor:"#E2E8F0"}}>
     <Text style={{fontSize:12,color:"#64748B"}}>{label}</Text>
     <Text style={{fontSize:22,fontWeight:"800",color:theme.text}}>{loading?"…":page?.summary?.[key]??"—"}</Text>
    </View>)}
   </View>
   <Text style={{fontSize:12,color:"#64748B"}}>Current authorized scope and applied filters. Withdrawn consent is excluded from demographic, active and verified counts.</Text>
   {canManage&&<Button label="Add Beneficiary" onPress={()=>open("create")}/>}
   <TextInput accessibilityLabel="Search beneficiary" value={q} onChangeText={setQ}
    style={{backgroundColor:"white",borderWidth:1,borderColor:"#CBD5E1",padding:12,borderRadius:10}}
    placeholder="Name or beneficiary reference"/>
   <Text style={labelStyle}>Beneficiary type</Text>
   <TextInput accessibilityLabel="Beneficiary type" value={typeFilter} maxLength={60} onChangeText={setTypeFilter} style={{backgroundColor:"white",borderWidth:1,borderColor:"#CBD5E1",padding:12,borderRadius:10}}/>
   <Select title="Gender" selected={genderFilter} items={[{value:"",label:"All"},...enumOptions(["MALE","FEMALE","OTHER","NOT_SPECIFIED"])]} onSelect={setGenderFilter}/>
   <Select title="Age group" selected={ageFilter} items={[{value:"",label:"All"},...enumOptions(["CHILD","ADULT","SENIOR","NOT_SPECIFIED"])]} onSelect={setAgeFilter}/>
   {opts?.canFilterProjects&&<View><Text style={labelStyle}>Find project</Text><TextInput accessibilityLabel="Find project" maxLength={80} value={projectSearch} onChangeText={setProjectSearch} placeholder="Project name or code" style={{backgroundColor:"white",borderWidth:1,borderColor:"#CBD5E1",padding:12,borderRadius:10}}/><Button label="Find projects" outline onPress={()=>void loadProjectFilters()}/><Select title="Project" selected={projectFilter} items={[{value:"",label:"All projects"},...filterProjects]} onSelect={x=>{setProjectFilter(x);setCampaignFilter("");setFilterCampaigns([]);}}/></View>}
   <Select title="State" selected={stateFilter} items={[{value:"",label:"All states"},...(opts?.states??[])]} onSelect={x=>{setStateFilter(x);setDistrictFilter("");setBlockFilter("");}}/>
   {stateFilter!==""&&<Select title="District" selected={districtFilter} items={[{value:"",label:"All districts"},...filterDistricts]} onSelect={x=>{setDistrictFilter(x);setBlockFilter("");}}/>}
   {districtFilter!==""&&<Select title="Block / location" selected={blockFilter} items={[{value:"",label:"All blocks"},...filterBlocks]} onSelect={setBlockFilter}/>}
   <Text style={labelStyle}>Category</Text><TextInput accessibilityLabel="Category" value={categoryFilter} maxLength={60} onChangeText={setCategoryFilter} style={{backgroundColor:"white",borderWidth:1,borderColor:"#CBD5E1",padding:12,borderRadius:10}}/>
   <Text style={labelStyle}>Registered from (YYYY-MM-DD)</Text>
   <TextInput accessibilityLabel="Registered from" value={fromFilter} onChangeText={setFromFilter} maxLength={10} placeholder="YYYY-MM-DD" style={{backgroundColor:"white",borderWidth:1,borderColor:"#CBD5E1",padding:12,borderRadius:10}}/>
   <Text style={labelStyle}>Registered to (YYYY-MM-DD)</Text>
   <TextInput accessibilityLabel="Registered to" value={toFilter} onChangeText={setToFilter} maxLength={10} placeholder="YYYY-MM-DD" style={{backgroundColor:"white",borderWidth:1,borderColor:"#CBD5E1",padding:12,borderRadius:10}}/>
   {canViewAssistance&&<View><Button label="Find permitted campaigns" outline onPress={()=>void loadCampaignFilters()}/>{filterCampaigns.length>0&&<Select title="Campaign" selected={campaignFilter} items={[{value:"",label:"All campaigns"},...filterCampaigns]} onSelect={setCampaignFilter}/>}</View>}
   <Button label="Apply Filters" outline onPress={()=>{setSearch(q.trim());setAppliedFilters({gender:genderFilter,ageGroup:ageFilter,type:typeFilter,stateRef:stateFilter,districtRef:districtFilter,blockRef:blockFilter,category:categoryFilter,registeredFrom:fromFilter,registeredTo:toFilter,projectRef:projectFilter,campaignRef:campaignFilter});setCursor("");setHistory([]);}}/>
   <Button label="Reset filters" outline onPress={()=>{setQ("");setSearch("");setBranch("");setTab("ALL");setGenderFilter("");setAgeFilter("");setTypeFilter("");setStateFilter("");setDistrictFilter("");setBlockFilter("");setCategoryFilter("");setFromFilter("");setToFilter("");setCampaignFilter("");setFilterCampaigns([]);setProjectFilter("");setProjectSearch("");setFilterProjects([]);setAppliedFilters({gender:"",ageGroup:"",type:"",stateRef:"",districtRef:"",blockRef:"",category:"",registeredFrom:"",registeredTo:"",projectRef:"",campaignRef:""});setCursor("");setHistory([]);}}/>
   <Select title="Operating branch" selected={branch}
    items={[{value:"",label:"All permitted branches"},...(opts?.branches??[])]}
    onSelect={x=>{detailSeq.current++;setBusy(false);setSelected(null);setReview(null);setBranch(x);setProjectFilter("");setFilterProjects([]);setCampaignFilter("");setFilterCampaigns([]);setAppliedFilters(f=>({...f,projectRef:"",campaignRef:""}));setCursor("");setHistory([]);}}/>
   {(canViewAssistance||canExportReports)&&<NativeBeneficiaryReportPanel key={JSON.stringify([search,branch,tab,appliedFilters])} token={token} onExpired={onExpired} filters={{...appliedFilters,q:search,branchRef:branch,lifecycle:tab==="ACTIVE"||tab==="INACTIVE"?tab:"",verification:tab==="VERIFIED"||tab==="PENDING"?tab:""}} canView={canViewAssistance} canExport={canExportReports} onProject={(ref,label)=>{setProjectFilter(ref);setFilterProjects(xs=>xs.some(x=>x.value===ref)?xs:[...xs,{value:ref,label}]);setCampaignFilter("");setFilterCampaigns([]);setAppliedFilters(f=>({...f,projectRef:ref,campaignRef:""}));setCursor("");setHistory([]);}}/>}
   <Select title="Status" selected={tab} onSelect={x=>{setTab(x);setCursor("");setHistory([]);}}
    items={enumOptions(["ALL","ACTIVE","INACTIVE","VERIFIED","PENDING"])}/>
   {!!notice&&<Text accessibilityRole="alert" style={{color:"#166534"}}>{notice}</Text>}
   {!!error&&<Text accessibilityRole="alert" style={{color:"#B91C1C"}}>{error}</Text>}
   {loading?<ActivityIndicator/>:!page?<View><Text style={textStyle}>Beneficiary records unavailable.</Text><Button label="Retry" outline onPress={reload}/></View>:!page.items.length?<Text style={textStyle}>No beneficiaries found for your current access.</Text>:
    page.items.map(x=><Pressable key={x.ref} accessibilityRole="button" onPress={()=>void select(x.ref)}
     style={{padding:14,borderWidth:1,borderColor:"#E2E8F0",borderRadius:12,backgroundColor:"white"}}>
     <Text style={{fontWeight:"700",color:"#0F172A"}}>{x.name}</Text>
     <Text style={{fontSize:12,color:"#64748B"}}>{x.reference} · {capitalize(x.verification)} · {capitalize(x.lifecycle)}</Text>
     <Text style={{fontSize:12,color:"#64748B"}}>{x.beneficiaryType}</Text></Pressable>)}
   <View style={{flexDirection:"row",gap:8}}>
    {history.length>0&&<Button label="Previous" outline onPress={()=>{
     setCursor(history[history.length-1]);setHistory(x=>x.slice(0,-1));}}/>}
    {page?.hasMore&&page.nextCursor&&<Button label="Next" outline onPress={()=>{
     setHistory(x=>[...x,cursor]);setCursor(page.nextCursor!);}}/>}
   </View>
   {selected&&<View style={{padding:16,borderRadius:12,backgroundColor:"white",gap:7,borderColor:"#DBEAFE",borderWidth:1}}>
    <Text style={{fontSize:18,fontWeight:"700"}}>{selected.name}</Text>
    <Text>{selected.reference}</Text>
    <Text>Verification: {capitalize(selected.verification)}</Text>
    <Text>Lifecycle: {capitalize(selected.lifecycle)}</Text>
    <Text>Contact: {selected.contactMobile??"Not recorded / restricted"}</Text>
    <Text>Beneficiary type: {selected.beneficiaryType}</Text><Text>Category: {selected.beneficiaryCategory??"Not specified"}</Text>
    <Text>Consent: {selected.consentRevoked?"Withdrawn":capitalize(selected.consentKind)}</Text>
    {canReadEvidence&&!selected.consentRevoked&&selected.lifecycle==="ACTIVE"&&<NativeProjectCoverPanel key={selected.ref+":"+selected.revision} projectRef={selected.ref} version={selected.revision} sourceKind="beneficiary" token={token} onExpired={onExpired} canUpload={canUploadEvidence&&(canManage||canDeliverAssistance)}/>}
    {canViewAssistance&&!selected.consentRevoked&&<NativeAssistancePanel key={selected.ref+":"+selected.revision} beneficiary={selected} token={token} onExpired={onExpired} canManage={canManageAssistance} canReview={canReviewAssistance} canDeliver={canDeliverAssistance} canStock={canIssueStock} canFinance={canPreparePayment} canEvidence={canReadEvidence}/>}

    <Text style={{fontSize:12,color:"#64748B"}}>Verified status requires independent CG-03 review. This screen cannot approve it.</Text>
    {!review&&<View><Text>Independent verification unavailable.</Text><Button label="Refresh details" outline onPress={()=>void select(selected.ref)}/></View>}
    {review&&<View style={{borderWidth:1,borderColor:"#E0E5ED",borderRadius:10,padding:12,gap:8}}>
     <Text style={{fontWeight:"700"}}>CG-03 independent verification & approval</Text>
     <Text>Case: {review.caseNumber??"Not submitted"} · {capitalize(review.status)}</Text>
     {canSubmitVerification&&!selected.consentRevoked&&selected.lifecycle==="ACTIVE"&&
       ["DRAFT","RETURNED","REJECTED"].includes(selected.verification)&&
       <Button label={verificationBusy?"Submitting…":"Submit for independent verification"}
        disabled={verificationBusy} onPress={()=>void submitVerification()}/>}
     {canReviewVerification&&review.canReview&&review.caseRef&&<>
      <Select title="Review decision" selected={reviewAction}
       items={enumOptions(["APPROVE","RETURN","REJECT"])}
       onSelect={x=>{setReviewAction(x);setDecisionKey(Crypto.randomUUID());}}/>
      <Text style={labelStyle}>Review remarks</Text>
      <TextInput value={reviewRemarks} onChangeText={setReviewRemarks} maxLength={500}
       multiline style={{backgroundColor:"white",borderWidth:1,borderColor:"#CBD5E1",borderRadius:8,padding:10}}/>
      <Text style={labelStyle}>Current Foundation password</Text>
      <TextInput value={reviewPassword} onChangeText={setReviewPassword}
       secureTextEntry autoCapitalize="none" autoCorrect={false}
       style={{backgroundColor:"white",borderWidth:1,borderColor:"#CBD5E1",borderRadius:8,padding:10}}/>
      <Button label="Confirm independent review" disabled={verificationBusy||reviewPassword.length<8||
       (reviewAction!=="APPROVE"&&reviewRemarks.trim().length<3)}
       onPress={()=>void decideVerification()}/>
     </>}
    </View>}
    {canManage&&!selected.consentRevoked&&selected.lifecycle==="ACTIVE"&&
     <Button label="Edit beneficiary" outline onPress={()=>open("edit")}/>}
    <Text style={{fontWeight:"700",marginTop:10}}>Linked projects</Text>
    {!selected.projectLinks?.length&&<Text>No project linked. Optional for intake.</Text>}
    {selected.projectLinks?.map(x=><View key={x.ref} style={{marginBottom:6}}>
     <Text>{x.projectName}</Text>
     {canLinkProjects&&!selected.consentRevoked&&<Button label="Unlink project" outline onPress={()=>void unlink(x.ref)} disabled={busy}/>}</View>)}
    {canLinkProjects&&!selected.consentRevoked&&selected.lifecycle==="ACTIVE"&&<>
     <Select title="Eligible active project" selected={projectRef}
      items={[{value:"",label:"Not selected"},...projects.filter(x=>!selected.projectLinks?.some(y=>y.projectRef===x.value))]}
      onSelect={x=>{setProjectRef(x);setLinkKey(Crypto.randomUUID());}}/>
     <Button label="Link project" onPress={()=>void link()} disabled={busy||!projectRef}/>
    </>}
    <Text style={{fontWeight:"700",marginTop:10}}>Source history</Text>
    {auditHistory.length?auditHistory.map((entry,i)=><Text key={i} style={{fontSize:12,color:"#475569"}}>
     {capitalize(entry.action)} · Revision {entry.revision} · {new Date(entry.at).toLocaleString("en-IN")}
     {entry.reason?" · "+entry.reason:""}
    </Text>):<Text>No action history available.</Text>}
    <Text style={{fontWeight:"700",marginTop:10}}>Verification history</Text>
    {verificationHistory.length?verificationHistory.map((entry,i)=><Text key={i} style={{fontSize:12,color:"#475569"}}>
     {capitalize(entry.decision)} · Revision {entry.sourceRevision} · {new Date(entry.at).toLocaleString("en-IN")}
    </Text>):<Text>Not submitted for independent verification yet.</Text>}
    {(canManageLifecycle||canRevoke)&&<>
     <Text style={labelStyle}>Reason for status or consent change</Text>
     <TextInput value={reason} onChangeText={setReason} maxLength={300}
      style={{backgroundColor:"#F8FAFC",borderColor:"#CBD5E1",borderWidth:1,borderRadius:8,padding:12}}/>
     {canManageLifecycle&&!selected.consentRevoked&&<Button label={selected.lifecycle==="ACTIVE"?"Mark inactive":"Reactivate"}
      disabled={busy||reason.trim().length<3} outline onPress={()=>void lifecycle()}/>}
     {canRevoke&&!selected.consentRevoked&&<Button label="Record consent withdrawal"
      disabled={busy||reason.trim().length<3} outline onPress={()=>void revoke()}/>}
    </>}
   </View>}
  </ScrollView>
  <Modal visible={mode!==null} animationType="slide" onRequestClose={()=>setMode(null)}>
   <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:20,gap:11,paddingBottom:70}}>
    <Text style={{fontSize:21,fontWeight:"800",color:"#0F172A"}}>{mode==="edit"?"Edit Beneficiary":"Add Beneficiary"}</Text>
    <Button outline label="Close" onPress={()=>setMode(null)}/>
    {mode==="create"&&<Select title="Operating branch" selected={draft.branchRef}
     items={[...(opts?.canManageFoundation?[{value:"",label:"Foundation wide"}]:[]),...(opts?.branches??[])]}
     onSelect={x=>change("branchRef",x)}/>}
    {([["name","Full name"],["beneficiaryType","Beneficiary type"],["beneficiaryCategory","Category (optional)"],["contactMobile","Phone (optional, with +country code)"]] as const).map(([k,title])=>
     <View key={k}><Text style={labelStyle}>{title}</Text>
      <TextInput value={draft[k]} onChangeText={x=>change(k,x)} style={{...textStyle,backgroundColor:"#F8FAFC",borderWidth:1,
       borderColor:"#CBD5E1",borderRadius:8,padding:12}}/></View>)}
    <View style={{borderWidth:1,borderColor:"#E0E5ED",padding:12,borderRadius:10,backgroundColor:"white",gap:5}}>
     <Text style={{fontWeight:"700"}}>Possible existing records</Text>
     <Text style={{fontSize:12,color:"#64748B"}}>Suggestions only; family members may share a phone. Never merge records automatically.</Text>
     <Button outline label={checkingDuplicates?"Checking…":"Check possible matches"}
      disabled={checkingDuplicates} onPress={()=>void checkDuplicates()}/>
     {duplicates&&(duplicates.items.length===0?<Text>No matches in the selected branch.</Text>:
      duplicates.items.map(x=><Text key={x.reference} style={{fontSize:12}}>
       {x.maskedName} · {x.beneficiaryType} · {x.reference}{x.contactMatches?" · Shared contact":""}
      </Text>))}
     {duplicates?.hasMore&&<Text>Other possible matches exist.</Text>}
    </View>
    <Select title="State" selected={draft.stateRef} items={opts?.states??[]}
     onSelect={x=>setDraft(v=>({...v,stateRef:x,districtRef:"",blockRef:""}))}/>
    <Select title="District (optional)" selected={draft.districtRef}
     items={[{value:"",label:"Not selected"},...districts]} onSelect={x=>setDraft(v=>({...v,districtRef:x,blockRef:""}))}/>
     {draft.districtRef!==""&&<Select title="Block / location (optional)" selected={draft.blockRef} items={[{value:"",label:"Not selected"},...blocks]} onSelect={x=>change("blockRef",x)}/>}
    <Select title="Gender (optional)" selected={draft.gender}
     items={enumOptions(["NOT_SPECIFIED","FEMALE","MALE","OTHER"])} onSelect={x=>change("gender",x)}/>
    <Select title="Age group (optional)" selected={draft.ageGroup}
     items={enumOptions(["NOT_SPECIFIED","CHILD","ADULT","SENIOR"])} onSelect={x=>change("ageGroup",x)}/>
    <Select title="Consent given by" selected={draft.consentKind}
     items={enumOptions(["SELF","GUARDIAN","REPRESENTATIVE"])} onSelect={x=>change("consentKind",x)}/>
    {draft.consentKind!=="SELF"&&<>
     {([["representativeName","Guardian or representative name"],["representativeContact","Representative contact"]] as const).map(([k,title])=>
      <View key={k}><Text style={labelStyle}>{title}</Text><TextInput value={draft[k]} onChangeText={x=>change(k,x)}
       style={{...textStyle,borderWidth:1,borderColor:"#CBD5E1",borderRadius:8,padding:12}}/></View>)}
    </>}
    <Text style={labelStyle}>Purpose of registration</Text>
    <TextInput value={draft.consentPurpose} onChangeText={x=>change("consentPurpose",x)}
     style={{...textStyle,borderWidth:1,borderColor:"#CBD5E1",borderRadius:8,padding:12}}/>
    <Pressable accessibilityRole="checkbox" accessibilityState={{checked:draft.consentAcknowledged}}
     onPress={()=>change("consentAcknowledged",!draft.consentAcknowledged)}
     style={{padding:12,borderWidth:1,borderColor:"#CBD5E1",borderRadius:8,backgroundColor:draft.consentAcknowledged?"#DBEAFE":"white"}}>
     <Text>{draft.consentAcknowledged?"☑":"☐"} Beneficiary or authorized guardian acknowledged the stated purpose.</Text>
    </Pressable>
    {!!error&&<Text style={{color:"#B91C1C"}}>{error}</Text>}
    {busy?<ActivityIndicator/>:<Button label="Save beneficiary" disabled={!draft.consentAcknowledged||!draft.stateRef||!draft.name}
     onPress={()=>void save()}/>}
   </ScrollView>
  </Modal>
 </View>;
}
