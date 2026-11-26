"use client";
import {useCallback,useEffect,useMemo,useRef,useState,type CSSProperties} from "react";
import {AdminRedemptionsTable} from "./admin-redemptions-table";
import {AdminReferralRecords} from "./admin-referral-records";

type Rank={name:string;verifiedReferrals:number|string;minimumPoints:number|string;benefitsSummary:string;sortOrder?:number};
type Programme={ref:string;code:string;name:string;audience:"MEMBER"|"VOLUNTEER"|"BOTH";
 status:"ACTIVE"|"INACTIVE";version:number;policyVersion:number;
 effectivePolicyVersion:number|null;effectiveFrom:string;
 qualifyingEvent:"MEMBERSHIP_ACTIVATED_VERIFIED"|"VOLUNTEER_APPROVED_ACTIVE";
 awardPoints:string;minimumClaimPoints:string;displayInrRatio:string|null;
 autoRankUpgrade:boolean;ranks?:Rank[];effectiveRanks?:Rank[]};
type ProgrammeSummary=Pick<Programme,"ref"|"name"|"status">;
type Reward={ref:string;programmeRef:string;type:"DIGITAL"|"PHYSICAL";category:string;
 name:string;description:string;pointsPrice:string;eligibleAudience:"MEMBER"|"VOLUNTEER"|"BOTH";
 status:"DRAFT"|"ACTIVE"|"ARCHIVED";highlighted:boolean;publicVisible:boolean;
 imageUrl:string|null;itemRef:string|null;storeRef:string|null;version:number;
 digitalFulfillmentMethod:"PENDING_EXTERNAL_PROOF"|"ON_PLATFORM_RECOGNITION";};
type Option={ref:string;name:string};
type Stock={availableQuantity:string;onHandQuantity:string;reservedQuantity:string;
 itemName:string;stockStatus:string;notice:string};
type Command={method:"POST"|"PATCH";path:string;body:Record<string,unknown>};
type RealReferralSummary={
 metrics:{activeReferrers:string;successfulReferrals:string;earnedPoints:string;netPoints:string};
 rankCounts:{kind:"MEMBER"|"VOLUNTEER";rank:string|null;count:string;
  referrals:string;points:string;lastActivity:string|null}[];
 rankCountsTruncated:boolean;redemptionMetricsAvailable:boolean;
 heldForFraudReview:string;
 redemptionMetrics?:{pending:string;cancelled:string;fulfilled:string;total:string;spentPoints:string};
 notice:string;
};
const pointsDisplay=(x:string|null|undefined)=>{
 try{return x&&/^[0-9]{1,18}$/.test(x)?BigInt(x).toLocaleString("en-IN"):"—";}
 catch{return "—";}
};
type ProgrammeDraft={programmeCode:string;name:string;audience:Programme["audience"];
 effectiveFrom:string;qualifyingEvent:Programme["qualifyingEvent"];awardPoints:string;
 minimumClaimPoints:string;displayInrRatio:string;autoRankUpgrade:boolean;ranks:Rank[]};
type RewardDraft={type:Reward["type"];category:string;name:string;description:string;
 pointsPrice:string;eligibleAudience:Reward["eligibleAudience"];status:Reward["status"];
 highlighted:boolean;publicVisible:boolean;imageUrl:string;itemRef:string;storeRef:string;
 digitalFulfillmentMethod:"PENDING_EXTERNAL_PROOF"|"ON_PLATFORM_RECOGNITION";};
const today=()=>new Date(Date.now()+19800000).toISOString().slice(0,10);
const blankProgramme=():ProgrammeDraft=>({programmeCode:"",name:"",audience:"BOTH",
 effectiveFrom:today(),qualifyingEvent:"MEMBERSHIP_ACTIVATED_VERIFIED",
 awardPoints:"",minimumClaimPoints:"0",displayInrRatio:"",autoRankUpgrade:true,ranks:[]});
const blankReward=():RewardDraft=>({type:"DIGITAL",category:"",name:"",description:"",
 pointsPrice:"",eligibleAudience:"BOTH",status:"DRAFT",highlighted:false,
 publicVisible:true,imageUrl:"",itemRef:"",storeRef:"",
 digitalFulfillmentMethod:"PENDING_EXTERNAL_PROOF"});
const css:Record<string,CSSProperties>={
 panel:{background:"var(--cg-surface,#fff)",border:"1px solid var(--cg-border,#DCE4ED)",
  padding:18,borderRadius:14,display:"grid",gap:12,minWidth:0},
 field:{display:"grid",gap:6,fontSize:13,fontWeight:600,color:"inherit"},
 control:{width:"100%",minHeight:44,padding:"9px 11px",border:"1px solid var(--cg-border,#CBD5E1)",
  borderRadius:9,background:"var(--cg-surface,#fff)",color:"inherit",font:"inherit",boxSizing:"border-box"},
 button:{padding:"10px 15px",borderRadius:9,border:"1px solid var(--cg-border,#CBD5E1)",
  background:"var(--cg-surface,#fff)",color:"inherit",cursor:"pointer",minHeight:44},
 primary:{padding:"10px 15px",borderRadius:9,border:"none",background:"var(--cg-accent,#244CA4)",
  color:"#fff",fontWeight:650,cursor:"pointer",minHeight:44},
};
async function api<T>(path:string,cmd?:Command):Promise<T>{
 const response=await fetch("/api/referrals"+path,{cache:"no-store",
  signal:AbortSignal.timeout(16000),method:cmd?.method??"GET",
  ...(cmd?{headers:{"Content-Type":"application/json"},body:JSON.stringify(cmd.body)}:{})});
 const body:unknown=await response.json().catch(()=>null);
 if(!response.ok||!body){
  const failure=body&&typeof body==="object"&&!Array.isArray(body)?
   body as {message?:unknown;code?:unknown}:{};
  const message=typeof failure.code==="string"&&failure.code.startsWith("CG13_")&&
   typeof failure.message==="string"&&failure.message.length<=220?failure.message:
   response.status===409?"This record changed. Refresh its latest version before retrying.":
   response.status===403?"Your current Foundation permissions do not allow this action.":
   response.status===400?"Check the programme, rank or product fields.":
   "The result is uncertain. Refresh this record before retrying the same request.";
  throw Object.assign(new Error(typeof message==="string"?message:"The result is uncertain."),{status:response.status||503});
 }
 return body as T;
}
const productsPath=(programme:string,page:number,search:string,category:string)=>
 "/programmes/"+programme+"/products?"+new URLSearchParams({
  page:String(page),...(search?{q:search}:{}),...(category!=="All"?{category}:{})
 }).toString();
const num=(v:string,field:string):number=>{
 const n=Number(v);
 if(!/^\d+$/.test(v)||!Number.isSafeInteger(n))throw Error("Enter a whole number for "+field);
 return n;
};
const fromProgramme=(v:Programme):ProgrammeDraft=>({programmeCode:v.code,name:v.name,
 audience:v.audience,effectiveFrom:v.effectiveFrom.slice(0,10),
 qualifyingEvent:v.qualifyingEvent,awardPoints:v.awardPoints,
 minimumClaimPoints:v.minimumClaimPoints,displayInrRatio:v.displayInrRatio??"",
 autoRankUpgrade:v.autoRankUpgrade,ranks:(v.ranks??[]).map(x=>({...x,
  verifiedReferrals:String(x.verifiedReferrals),minimumPoints:String(x.minimumPoints)}))});
const fromProduct=(v:Reward):RewardDraft=>({type:v.type,name:v.name,category:v.category,
 description:v.description,pointsPrice:v.pointsPrice,eligibleAudience:v.eligibleAudience,
 status:v.status,highlighted:v.highlighted,publicVisible:v.publicVisible,
 imageUrl:v.imageUrl??"",itemRef:v.itemRef??"",storeRef:v.storeRef??"",
 digitalFulfillmentMethod:v.digitalFulfillmentMethod??"PENDING_EXTERNAL_PROOF"});
export function ReferralRewardsWorkspace({canViewPolicy,canViewRewards,canManagePolicy,canManageRewards,
 canIssueStock,canViewMemberRoster,canViewVolunteerRoster}:{
 canViewPolicy:boolean;canViewRewards:boolean;canManagePolicy:boolean;canManageRewards:boolean;
 canIssueStock:boolean;canViewMemberRoster:boolean;canViewVolunteerRoster:boolean}){
 const [programmes,setProgrammes]=useState<ProgrammeSummary[]>([]);
 const [selected,setSelected]=useState(""),[detail,setDetail]=useState<Programme|null>(null);
 const [products,setProducts]=useState<Reward[]>([]),[edition,setEdition]=useState<Reward|null>(null);
 const [activeTotal,setActiveTotal]=useState<string|null>(null);
 const [moreProgrammes,setMoreProgrammes]=useState(false),[moreProducts,setMoreProducts]=useState(false);
 const [programmePage,setProgrammePage]=useState(2),[productPage,setProductPage]=useState(2);
 const [pagingBusy,setPagingBusy]=useState(false);
 const pagingLock=useRef(false),programmeGeneration=useRef(0),productGeneration=useRef(0);
 const [section,setSection]=useState<"PROGRAMMES"|"REWARDS">(canViewPolicy?"PROGRAMMES":"REWARDS");
 const [rankTab,setRankTab]=useState<"MEMBER"|"VOLUNTEER">("MEMBER");
 const [selectedRank,setSelectedRank]=useState(0);
 const [summary,setSummary]=useState<RealReferralSummary|null>(null);
 const [summaryLoading,setSummaryLoading]=useState(false);
 const [categoryFilter,setCategoryFilter]=useState("All");
 const [searchProduct,setSearchProduct]=useState(""),[appliedSearch,setAppliedSearch]=useState("");
 const [availableCategories,setAvailableCategories]=useState<string[]>([]);
 const [categoriesTruncated,setCategoriesTruncated]=useState(false);
 const [productsLoading,setProductsLoading]=useState(false);
 const [rewardView,setRewardView]=useState<"CATALOG"|"REDEMPTIONS">("CATALOG");
 const [drawer,setDrawer]=useState<"POLICY"|"PRODUCT"|null>(null);
 const [editingPolicy,setEditingPolicy]=useState(false);
 const [programmeForm,setProgrammeForm]=useState<ProgrammeDraft>(blankProgramme);
 const [rewardForm,setRewardForm]=useState<RewardDraft>(blankReward);
 const [stockOptions,setStockOptions]=useState<{items:Option[];stores:Option[]}|null>(null);
 const [stock,setStock]=useState<Stock|null>(null);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const [notice,setNotice]=useState(""),[epoch,setEpoch]=useState(0);
 const [failedImages,setFailedImages]=useState<Record<string,true>>({});
 const [pending,setPending]=useState<Command|null>(null);
 useEffect(()=>{setSelectedRank(0);setCategoryFilter("All");},[selected]);
 useEffect(()=>{
  const handle=setTimeout(()=>setAppliedSearch(searchProduct.trim()),300);
  return()=>clearTimeout(handle);
 },[searchProduct]);
 useEffect(()=>{
  let live=true;setAvailableCategories([]);setCategoriesTruncated(false);
  if(!selected||!canViewRewards)return;
  void api<{items:string[];hasMore:boolean}>("/programmes/"+selected+"/categories")
   .then(v=>{if(live){setAvailableCategories(v.items);setCategoriesTruncated(v.hasMore);}})
   .catch(e=>{if(live)setError(e instanceof Error?e.message:"Reward categories unavailable.");});
  return()=>{live=false;};
 },[selected,epoch,canViewRewards]);
 useEffect(()=>setFailedImages({}),[selected,epoch]);
 const lock=useRef(false);
 const dialogRef=useRef<HTMLElement|null>(null);
 const editorOrigin=useRef("");
 const editorState=useRef({drawer,busy,pending,programmeForm,rewardForm});
 editorState.current={drawer,busy,pending,programmeForm,rewardForm};
 const closeDrawer=useCallback(()=>{
  const current=editorState.current;
  if(current.busy||current.pending||!current.drawer)return;
  const draft=current.drawer==="POLICY"?current.programmeForm:current.rewardForm;
  if(JSON.stringify(draft)!==editorOrigin.current&&
   !window.confirm("Discard unsaved changes to this form?"))return;
  setDrawer(null);setEdition(null);
 },[]);
 const refresh=useCallback(()=>setEpoch(v=>v+1),[]);
 useEffect(()=>{
  let live=true;programmeGeneration.current++;
  setLoading(true);setError("");setMoreProgrammes(false);setProgrammePage(2);
  void api<{items:ProgrammeSummary[];hasMore:boolean}>(
   canViewPolicy?"/programmes?page=1":"/catalogue-programmes?page=1").then(v=>{
   if(!live)return;
   setProgrammes(v.items);setMoreProgrammes(v.hasMore);setSelected(current=>
    v.items.some(x=>x.ref===current)?current:v.items[0]?.ref??"");
  }).catch(e=>{if(live){setProgrammes([]);setError(e instanceof Error?e.message:"Programmes unavailable.");}})
   .finally(()=>{if(live)setLoading(false);});
  return()=>{live=false;};
 },[epoch,canViewPolicy]);
 useEffect(()=>{
  let live=true;productGeneration.current++;
  setProductsLoading(true);setDetail(null);setProducts([]);setActiveTotal(null);
  setMoreProducts(false);setProductPage(2);
  if(!selected){setProductsLoading(false);return;}
  void Promise.all([canViewPolicy?api<Programme>("/programmes/"+selected):Promise.resolve(null),
   canViewRewards?api<{items:Reward[];hasMore:boolean;activeTotal:string}>(
    productsPath(selected,1,appliedSearch,categoryFilter)):Promise.resolve({items:[],hasMore:false,activeTotal:null})])
   .then(([p,v])=>{if(live){setDetail(p);setProducts(v.items);setMoreProducts(v.hasMore);setActiveTotal(v.activeTotal);}})
   .catch(e=>{if(live)setError(e instanceof Error?e.message:"Current programme unavailable.");})
   .finally(()=>{if(live)setProductsLoading(false);});
  return()=>{live=false;};
 },[selected,epoch,canViewPolicy,canViewRewards,appliedSearch,categoryFilter]);
 useEffect(()=>{
  let live=true;setSummary(null);
  if(!selected||!canViewPolicy){setSummaryLoading(false);return;}
  setSummaryLoading(true);
  void api<RealReferralSummary>("/programmes/"+selected+"/summary")
   .then(v=>{if(live)setSummary(v);})
   .catch(e=>{if(live)setError(e instanceof Error?e.message:
    "Verified referral totals are unavailable.");})
   .finally(()=>{if(live)setSummaryLoading(false);});
  return()=>{live=false;};
 },[selected,epoch,canViewPolicy]);
 useEffect(()=>{
  let live=true;setStockOptions(null);
  if(drawer!=="PRODUCT"||rewardForm.type!=="PHYSICAL")return;
  void api<{items:Option[];stores:Option[]}>("/stock-options")
   .then(v=>{if(live)setStockOptions(v);})
   .catch(e=>{if(live)setError(e instanceof Error?e.message:"Warehouse item and store options are unavailable.");});
  return()=>{live=false;};
 },[drawer,rewardForm.type,epoch]);
 useEffect(()=>{
  let live=true;setStock(null);
  if(drawer!=="PRODUCT"||rewardForm.type!=="PHYSICAL"||!rewardForm.itemRef||!rewardForm.storeRef)return;
  void api<Stock>("/stock-preview/"+rewardForm.itemRef+"/"+rewardForm.storeRef)
   .then(v=>{if(live)setStock(v);})
   .catch(e=>{if(live)setError(e instanceof Error?e.message:"Stock status unavailable.");});
  return()=>{live=false;};
 },[drawer,rewardForm.type,rewardForm.itemRef,rewardForm.storeRef,epoch]);
 useEffect(()=>{
  if(!drawer)return;
  const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const bodyOverflow=document.body.style.overflow;
  document.body.style.overflow="hidden";
  const dialog=dialogRef.current;
  dialog?.querySelector<HTMLElement>('button:not([disabled]),input:not([disabled])')?.focus();
  const handler=(e:KeyboardEvent)=>{
   if(e.key==="Escape"){e.preventDefault();closeDrawer();return;}
   if(e.key!=="Tab"||!dialog)return;
   const focusable=Array.from(dialog.querySelectorAll<HTMLElement>(
    'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'))
    .filter(el=>el.getClientRects().length>0);
   if(!focusable.length){e.preventDefault();dialog.focus();return;}
   const first=focusable[0],last=focusable[focusable.length-1];
   if(e.shiftKey&&(document.activeElement===first||!dialog.contains(document.activeElement))){
    e.preventDefault();last.focus();
   }else if(!e.shiftKey&&(document.activeElement===last||!dialog.contains(document.activeElement))){
    e.preventDefault();first.focus();
   }
  };
  window.addEventListener("keydown",handler);
  return()=>{window.removeEventListener("keydown",handler);
   document.body.style.overflow=bodyOverflow;previous?.focus();};
 },[drawer,closeDrawer]);
 const send=async(request:Command)=>{
  if(lock.current)return;
  lock.current=true;setBusy(true);setPending(request);setError("");setNotice("");
  try{
   const result=await api<{ref:string;version:number;replayed:boolean}>(request.path,request);
   setPending(null);setDrawer(null);setEdition(null);
   if(request.path==="/programmes"||request.path.startsWith("/programmes/"))setSelected(result.ref);
   setNotice(result.replayed?"Original request found; no duplicate was created.":"Saved successfully.");
   refresh();
  }catch(e){
   const status=e&&typeof e==="object"&&"status" in e?Number(e.status):503;
   if(status>=400&&status<500)setPending(null);
   setError(status>=500?"The outcome may have committed. Retry the SAME request or refresh the record.":
    e instanceof Error?e.message:"This action was rejected.");
  }finally{lock.current=false;setBusy(false);}
 };
 const openPolicy=(current=false)=>{
  setError("");setPending(null);
  const draft=current&&detail?fromProgramme(detail):blankProgramme();
  editorOrigin.current=JSON.stringify(draft);
  setEditingPolicy(Boolean(current&&detail));setProgrammeForm(draft);setDrawer("POLICY");
 };
 const openProduct=(item?:Reward)=>{
  setError("");setPending(null);setEdition(item??null);
  const draft=item?fromProduct(item):blankReward();
  editorOrigin.current=JSON.stringify(draft);
  setRewardForm(draft);setDrawer("PRODUCT");
 };
 const saveProgramme=()=>{
  try{
   if(pending){void send(pending);return;}
   const p=programmeForm;
   const body:Record<string,unknown>={requestKey:crypto.randomUUID(),name:p.name,
    audience:p.audience,qualifyingEvent:p.qualifyingEvent,effectiveFrom:p.effectiveFrom,
    awardPoints:num(p.awardPoints,"points per verified referral"),
    minimumClaimPoints:num(p.minimumClaimPoints,"minimum claim"),
    displayInrRatio:p.displayInrRatio||null,autoRankUpgrade:p.autoRankUpgrade,
    ranks:p.ranks.map(x=>({name:x.name,verifiedReferrals:num(String(x.verifiedReferrals),"rank referrals"),
     minimumPoints:num(String(x.minimumPoints),"rank points"),benefitsSummary:x.benefitsSummary}))};
   if(editingPolicy&&detail){
    body.expectedVersion=detail.version;
    void send({path:"/programmes/"+detail.ref,method:"PATCH",body});
   }else{
    body.programmeCode=p.programmeCode;
    void send({path:"/programmes",method:"POST",body});
   }
  }catch(e){setError(e instanceof Error?e.message:"Check the current programme and rank thresholds.");}
 };
 const saveProduct=()=>{
  try{
   if(pending){void send(pending);return;}
   if(!selected)throw Error("Select an original referral programme first.");
   if(rewardForm.type==="DIGITAL"&&rewardForm.status==="ACTIVE"&&
    rewardForm.digitalFulfillmentMethod!=="ON_PLATFORM_RECOGNITION")
    throw Error("Digital rewards must remain Draft until verified on-platform recognition is configured.");
   if(rewardForm.type==="PHYSICAL"&&rewardForm.status!=="ARCHIVED"&&!stock)
    throw Error("Check current available warehouse stock before saving.");
   const p=rewardForm;
   const body:Record<string,unknown>={requestKey:crypto.randomUUID(),
    programmeRef:selected,type:p.type,name:p.name,description:p.description,
    category:p.category,pointsPrice:num(p.pointsPrice,"product points"),
    eligibleAudience:p.eligibleAudience,status:p.status,highlighted:p.highlighted,
    publicVisible:p.publicVisible,imageUrl:p.imageUrl||null,
    digitalFulfillmentMethod:p.type==="DIGITAL"?p.digitalFulfillmentMethod:"PENDING_EXTERNAL_PROOF",
    itemRef:p.type==="PHYSICAL"?p.itemRef:null,
    storeRef:p.type==="PHYSICAL"?p.storeRef:null};
   if(edition){
    body.expectedVersion=edition.version;
    void send({path:"/products/"+edition.ref,method:"PATCH",body});
   }else void send({path:"/products",method:"POST",body});
  }catch(e){setError(e instanceof Error?e.message:"Check product source fields.");}
 };
 const setRank=(i:number,field:keyof Rank,v:string)=>{
  setProgrammeForm(p=>({...p,ranks:p.ranks.map((x,k)=>k===i?{...x,[field]:v}:x)}));
 };
 const availableRanks=detail?.effectiveRanks??detail?.ranks??[];
 const programmeTitle=programmes.find(p=>p.ref===selected)?.name??"No active programme selected";
 const categories=useMemo(()=>["All",...new Set(availableCategories)],[availableCategories]);
 const orderedProducts=useMemo(()=>[...products].filter(p=>
  (categoryFilter==="All"||p.category===categoryFilter)&&
  (p.name+" "+p.category+" "+p.description).toLowerCase().includes(appliedSearch.toLowerCase()))
  .sort((a,b)=>Number(b.highlighted)-Number(a.highlighted)||a.name.localeCompare(b.name)),
  [products,categoryFilter,appliedSearch]);
 const loadMore=async(kind:"PROGRAMMES"|"PRODUCTS")=>{
  if(pagingLock.current)return;
  pagingLock.current=true;setPagingBusy(true);setError("");
  const generation=kind==="PROGRAMMES"?programmeGeneration.current:productGeneration.current;
  const chosen=selected, page=kind==="PROGRAMMES"?programmePage:productPage;
  try{
   if(kind==="PROGRAMMES"){
    const next=await api<{items:ProgrammeSummary[];hasMore:boolean}>(
     (canViewPolicy?"/programmes?page=":"/catalogue-programmes?page=")+page);
    if(generation!==programmeGeneration.current)return;
    setProgrammes(old=>[...old,...next.items.filter(item=>!old.some(p=>p.ref===item.ref))]);
    setMoreProgrammes(next.hasMore);setProgrammePage(page+1);
   }else{
    if(!chosen)return;
    const next=await api<{items:Reward[];hasMore:boolean}>(
     productsPath(chosen,page,appliedSearch,categoryFilter));
    if(generation!==productGeneration.current)return;
    setProducts(old=>[...old,...next.items.filter(item=>!old.some(p=>p.ref===item.ref))]);
    setMoreProducts(next.hasMore);setProductPage(page+1);
   }
  }catch(e){if((kind==="PROGRAMMES"?programmeGeneration.current:productGeneration.current)===generation)
   setError(e instanceof Error?e.message:"Cannot retrieve the next original catalogue page.");}
  finally{pagingLock.current=false;setPagingBusy(false);}
 };
 const rowInput=(title:string,value:string,fn:(v:string)=>void,type="text")=><label style={css.field}>{title}
  <input style={css.control} type={type} value={value}
   onChange={e=>fn(e.target.value)} autoComplete="off"/></label>;
 return <div style={{display:"grid",gap:16,maxWidth:1280,width:"100%",margin:"0 auto"}}>
  <header style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
   <div><h1 style={{margin:0,fontSize:27}}>{section==="PROGRAMMES"?"Referral Programme":"Rewards Store"}</h1>
    <p style={{margin:"6px 0 0",color:"var(--cg-text-muted,#64748B)",fontSize:13}}>
     Verified referral points, rank policy and rewards catalogue</p></div>
   <button type="button" style={css.button} onClick={refresh} disabled={busy}>Refresh current sources</button>
  </header>
  <nav aria-label="Referral workspace sections" style={{display:"flex",gap:8,flexWrap:"wrap"}}>
   {canViewPolicy&&<button type="button" style={section==="PROGRAMMES"?css.primary:css.button}
    onClick={()=>setSection("PROGRAMMES")}>Referral Programme & Ranks</button>}
   {canViewRewards&&<button type="button" style={section==="REWARDS"?css.primary:css.button}
    onClick={()=>setSection("REWARDS")}>Rewards Store</button>}
  </nav>
  {!!notice&&<p role="status" style={{padding:12,border:"1px solid #86EFAC",borderRadius:8}}>{notice}</p>}
  {!!error&&<p role="alert" style={{padding:12,border:"1px solid #FCA5A5",borderRadius:8,color:"#B91C1C"}}>{error}</p>}
  {loading?<p role="status">Loading authorized Foundation source…</p>:<>
   {section==="PROGRAMMES"?<>
    <section style={css.panel} aria-label="Referral ranks and policy overview">
     <div style={{display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap",alignItems:"center"}}>
      <div><h2 style={{margin:0,fontSize:21}}>Referral Programme</h2>
       <p style={{margin:"5px 0",fontSize:13}}>Only verified member or volunteer activations will earn points.
        A click or application submission is not a verified referral.</p></div>
      {canManagePolicy&&<div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
       <button style={css.button} onClick={()=>openPolicy(false)}>New Programme</button>
       {!!detail&&<button style={css.primary} onClick={()=>openPolicy(true)}>Configure Referral Settings</button>}
      </div>}
     </div>
     <label style={css.field}>Current programme
      <select style={css.control} value={selected} onChange={e=>setSelected(e.target.value)}>
       {!programmes.length&&<option value="">No recorded programmes</option>}
       {programmes.map(p=><option key={p.ref} value={p.ref}>{p.name} · {p.status}</option>)}
      </select></label>
     {moreProgrammes&&<button type="button" style={css.button} disabled={loading||pagingBusy||busy}
      onClick={()=>void loadMore("PROGRAMMES")}>Load more programmes</button>}
     {!!detail?<>
      <div style={{display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
       <h3 style={{fontSize:16,margin:0}}>Referral Ranks ({availableRanks.length} Levels)</h3>
       
      </div>
      <p role="status" style={{fontSize:12,margin:"0 0 4px",color:"var(--cg-text-muted,#64748B)"}}>
       {detail.effectivePolicyVersion===null?
        "Programme rules are scheduled to begin on "+detail.effectiveFrom+" (India time).":
        detail.effectivePolicyVersion!==detail.policyVersion?
        "Updated settings are scheduled for "+detail.effectiveFrom+
         ". Existing effective rules continue until then.":
        "Current policy effective since "+detail.effectiveFrom+" (India time)."}
      </p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:9}}>
       {availableRanks.map((rank,i)=><button type="button" key={i}
        aria-pressed={selectedRank===i} onClick={()=>setSelectedRank(i)}
        style={{textAlign:"left",cursor:"pointer",padding:12,minHeight:101,
         background:"var(--cg-surface,#fff)",color:"inherit",borderRadius:10,
         border:selectedRank===i?"2px solid var(--cg-accent,#244CA4)":"1px solid var(--cg-border,#CBD5E1)"}}>
        <strong>🏅 {rank.name}</strong><div style={{fontSize:11}}>Rank {i+1}</div>
        <div style={{fontSize:11}}>{rank.verifiedReferrals} verified referrals required</div>
        <div style={{fontSize:11}}>{rank.minimumPoints} minimum eligible points</div>
        {summary&&<div style={{fontSize:11}}>
         {pointsDisplay(summary.rankCounts.filter(x=>x.rank===rank.name)
          .reduce((total,x)=>total+BigInt(x.count),0n).toString())} recorded referrers
        </div>}
       </button>)}
       {!availableRanks.length&&<p>{detail.effectivePolicyVersion===null?
        "No rank policy is effective yet. The programme is scheduled.":
        "No rank policy recorded."}</p>}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:9}}>
       {([
        ["TOTAL ACTIVE REFERRERS",summary?.metrics.activeReferrers],
        ["TOTAL SUCCESSFUL REFERRALS",summary?.metrics.successfulReferrals],
        ["TOTAL REFERRAL POINTS",summary?.metrics.netPoints],
        ["TOTAL REWARDS REDEEMED",summary?.redemptionMetrics?.fulfilled],
        ["PENDING REWARDS",summary?.redemptionMetrics?.pending]
       ] as const).map(([label,value])=><div key={label}
        style={{...css.panel,padding:12,gap:3}}>
        <span style={{fontSize:10,fontWeight:700}}>{label}</span>
        <strong style={{fontSize:23}}>{pointsDisplay(value)}</strong>
        <span style={{fontSize:11,color:"var(--cg-text-muted,#64748B)"}}>
         {value!==null&&value!==undefined?
          "Verified source-recorded activity":"Unavailable until real recorded source"}
        </span>
       </div>)}
       {summary&&summary.heldForFraudReview!=="0"&&<p role="status"
        style={{fontSize:12,margin:0}}>
        {pointsDisplay(summary.heldForFraudReview)} attempted circular referrals are held
        for protected review. They have not received points or rank credit.
       </p>}
       {summaryLoading&&<p role="status">Checking verified referral activity…</p>}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,330px),1fr))",
       gap:12,alignItems:"start"}}>
       <section style={{...css.panel,padding:13}}>
        <h3 style={{margin:0,fontSize:16}}>Rank Wise Details — {availableRanks[selectedRank]?.name??"Not configured"}</h3>
        <div role="tablist" aria-label="Member and Volunteer rank records"
         style={{display:"flex",gap:7}}>
         {(["MEMBER","VOLUNTEER"] as const).map(t=><button key={t}
          type="button" role="tab" aria-selected={rankTab===t}
          style={rankTab===t?css.primary:css.button}
          onClick={()=>setRankTab(t)}>{t==="MEMBER"?"Members":"Volunteers"}</button>)}
        </div>
        <p style={{fontSize:12,margin:0}}>Verified rank totals only. Individual
         referrers appear separately below, subject to your current CG04 roster permission.</p>
        <div style={{overflowX:"auto"}}>
         <table style={{width:"100%",minWidth:510,borderCollapse:"collapse",fontSize:12}}>
          <thead><tr>{["RELATIONSHIP","VERIFIED REFERRERS","REFERRAL COUNT","NET POINTS",
           "LAST ACTIVITY"].map(t=><th scope="col" key={t}
           style={{padding:10,textAlign:"left",borderBottom:"1px solid var(--cg-border,#CBD5E1)"}}>{t}</th>)}</tr></thead>
          <tbody>
           {summary?.rankCounts.filter(x=>x.kind===rankTab&&
            x.rank===availableRanks[selectedRank]?.name).map((x,i)=><tr key={x.kind+":"+x.rank+":"+i}>
             <td style={{padding:9}}>{rankTab==="MEMBER"?"Members":"Volunteers"}</td>
             <td style={{padding:9}}>{pointsDisplay(x.count)}</td>
             <td style={{padding:9}}>{pointsDisplay(x.referrals)}</td>
             <td style={{padding:9}}>{pointsDisplay(x.points)}</td>
             <td style={{padding:9}}>{x.lastActivity?
              new Date(x.lastActivity).toLocaleDateString("en-IN",{timeZone:"Asia/Kolkata"}):
              "—"}</td>
            </tr>)}
           {!summary?.rankCounts.some(x=>x.kind===rankTab&&
             x.rank===availableRanks[selectedRank]?.name)&&<tr><td colSpan={5}
             style={{textAlign:"center",padding:24}}>
              No verified {rankTab==="MEMBER"?"member":"volunteer"} referrers recorded in this rank.
              Applicant identities remain private.
             </td></tr>}
          </tbody>
         </table>
        </div>
       </section>
       <aside style={{display:"grid",gap:12}}>
        <div style={{...css.panel,padding:13}}>
         <h3 style={{margin:0,fontSize:15}}>Rank {Math.min(selectedRank+1,availableRanks.length)} — {availableRanks[selectedRank]?.name??"Unconfigured"}</h3>
         <p style={{fontSize:12,margin:0}}>Minimum referrals: {availableRanks[selectedRank]?.verifiedReferrals??"—"}</p>
         <p style={{fontSize:12,margin:0}}>Minimum points: {availableRanks[selectedRank]?.minimumPoints??"—"}</p>
         <p style={{fontSize:12,margin:0}}>Benefits: {availableRanks[selectedRank]?.benefitsSummary||"No recorded benefits"}</p>
        </div>
        <div style={{...css.panel,padding:13}}>
         <h3 style={{margin:0,fontSize:15}}>Reward / Gift</h3>
         <p style={{fontSize:12,margin:0}}>Only actual eligible catalog products are shown; no invented certificates or vouchers.</p>
         {canViewRewards&&<button type="button" style={css.button}
          onClick={()=>setSection("REWARDS")}>View recorded rewards</button>}
        </div>
       </aside>
      </div>
      <AdminReferralRecords key={selected} programme={selected} kind={rankTab}
       selectedRank={availableRanks[selectedRank]?.name??""}
       canViewMember={canViewMemberRoster} canViewVolunteer={canViewVolunteerRoster}
       refreshEpoch={epoch}/>
      {canManagePolicy&&<button style={{...css.button,justifySelf:"start"}} disabled={busy}
       onClick={()=>void send({method:"POST",path:"/programmes/"+detail.ref+"/status",
        body:{requestKey:crypto.randomUUID(),expectedVersion:detail.version,
         status:detail.status==="ACTIVE"?"INACTIVE":"ACTIVE"}})}>
       {detail.status==="ACTIVE"?"Deactivate future programme":"Reactivate current programme"}</button>}
     </>:<p>No programme has been recorded. Create a policy to begin; no member account,
      stock inventory or cash provider is required for a digital reward.</p>}
    </section>
   </>:<>
    <section style={{...css.panel,background:"linear-gradient(105deg,#076843,#0F7663 60%,#0F172A)",color:"#fff",border:0,padding:22}}>
     <span style={{fontSize:11,color:"#B2F3D0",fontWeight:700}}>REWARDS MARKETPLACE HUB</span>
     <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
      <h2 style={{margin:0,fontSize:24}}>Redeem Items &amp; Rewards Store</h2>
      <div style={{display:"flex",gap:8}}>
       <button type="button" style={{...css.button,background:"#155E53",color:"#fff",borderColor:"#155E53"}}
        onClick={refresh}>Refresh</button>
       {canManageRewards&&<button type="button" style={{...css.primary,background:"#06D48A",color:"#073A30"}}
        onClick={()=>openProduct()}>+ Add New Product</button>}
      </div>
     </div>
     <p style={{margin:0,fontSize:13}}>Current approved reward catalogue. Physical stock is read-only
      from warehouse inventory; points represent programme eligibility, never withdrawable rupees.</p>
    </section>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:9}}>
     {([
      ["ACTIVE PRODUCTS",activeTotal??"—"],
      ["POINTS REDEEMED",summary?.redemptionMetrics?.spentPoints??"—"],
      ["PENDING ORDERS",summary?.redemptionMetrics?.pending??"—"],
      ["FULFILLED ORDERS",summary?.redemptionMetrics?.fulfilled??"—"]
     ] as const).map(([label,value],i)=>
      <div key={label} style={{...css.panel,padding:12,gap:4}}>
       <span style={{fontSize:11,color:"var(--cg-text-muted,#64748B)"}}>
        <span style={{color:["#0B9D67","#D38A07","#2C60CC","#8A45C3"][i]}}>◈ </span>{label}</span>
       <strong style={{fontSize:22}}>{value}</strong>
       {i>0&&<span style={{fontSize:11}}>Recorded source events only</span>}
      </div>)}
    </div>
    <nav aria-label="Rewards Store sections" style={{display:"flex",gap:8,flexWrap:"wrap"}}>
     {(["CATALOG","REDEMPTIONS"] as const).map(tab=>
      <button type="button" key={tab} aria-pressed={rewardView===tab}
       style={rewardView===tab?css.primary:css.button}
       onClick={()=>setRewardView(tab)}>
       {tab==="CATALOG"?"Reward Products Catalogue":"Volunteer & Member Redemptions"}</button>)}
    </nav>
    {rewardView==="CATALOG"?<section style={css.panel}>
     <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
      <div><h3 style={{margin:0}}>Reward Products Catalogue</h3>
       <p style={{fontSize:13,margin:"5px 0"}}>{activeTotal??"—"} active recorded products for {programmeTitle}</p></div>
      {canManageRewards&&<button style={css.primary} onClick={()=>openProduct()}>Add New Product</button>}
     </div>
     <label style={css.field}>Selected programme
      <select style={css.control} value={selected} onChange={e=>setSelected(e.target.value)}>
       {!programmes.length&&<option value="">No programme configured</option>}
       {programmes.map(p=><option key={p.ref} value={p.ref}>{p.name} · {p.status}</option>)}
      </select></label>
     {moreProgrammes&&<button type="button" style={css.button} disabled={loading||pagingBusy||busy}
      onClick={()=>void loadMore("PROGRAMMES")}>Load more programmes</button>}
     <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,
      flexWrap:"wrap",borderBottom:"1px solid var(--cg-border,#DCE4ED)",paddingBottom:9}}>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
       {categories.map(cat=><button type="button" key={cat} aria-pressed={categoryFilter===cat}
        onClick={()=>setCategoryFilter(cat)}
        style={{...css.button,fontSize:12,padding:"5px 10px",minHeight:32,
         ...(categoryFilter===cat?{background:"#059669",color:"#fff",borderColor:"#059669"}:{})}}>
        {cat}</button>)}
      </div>
      <input type="search" aria-label="Search reward products" placeholder="Search products…"
       maxLength={100} value={searchProduct} onChange={e=>setSearchProduct(e.target.value)}
       style={{...css.control,minHeight:35,maxWidth:225}}/>
     </div>
     <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(206px,1fr))",gap:12}}>
      {orderedProducts.map(p=><article key={p.ref} style={{border:"1px solid var(--cg-border,#CBD5E1)",borderRadius:13,overflow:"hidden"}}>
       <div style={{height:148,background:"#E8FBF2",display:"grid",placeItems:"center",position:"relative"}}>
        {p.imageUrl&&!failedImages[p.ref]?<img src={p.imageUrl} alt={p.name}
         loading="lazy" referrerPolicy="no-referrer"
         onError={()=>setFailedImages(old=>({...old,[p.ref]:true}))}
         style={{maxWidth:"100%",height:"100%",objectFit:"cover"}}/>:
         <span aria-label="Product image not provided" style={{fontSize:32,color:"#0FBA78"}}>▢</span>}
         <span style={{position:"absolute",top:7,left:7,padding:"3px 7px",borderRadius:14,
          fontSize:10,fontWeight:650,background:"#F5A20B",color:"#1A293E"}}>
          {p.highlighted?"Highlighted":p.category}</span>
         <span style={{position:"absolute",top:7,right:7,padding:"3px 7px",borderRadius:14,
          fontSize:10,fontWeight:650,background:p.status==="ACTIVE"?"#10B981":"#64748B",
          color:"#fff"}}>{p.status}</span>
       </div>
       <div style={{padding:12,display:"grid",gap:6}}>
        <strong style={{fontSize:13,lineHeight:1.3}}>{p.name}</strong>
        <span style={{fontSize:11,color:"var(--cg-text-muted,#64748B)"}}>{p.category} · {p.type}</span>
         <p style={{fontSize:11,color:"var(--cg-text-muted,#64748B)",margin:0,
          display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>
          {p.description||"No product description recorded"}</p>
        <strong style={{color:"#FDE68A",background:"#172338",padding:"4px 8px",borderRadius:16,justifySelf:"start"}}>{p.pointsPrice} Pts</strong>
        <span style={{fontSize:12}}>{p.highlighted?"Highlighted · ":""}{p.publicVisible?"Public eligible catalogue":"Staff only"}</span>
        {p.type==="DIGITAL"&&p.digitalFulfillmentMethod!=="ON_PLATFORM_RECOGNITION"&&
         <span role="status" style={{fontSize:12,color:"var(--cg-text-muted,#64748B)"}}>
          Delivery source unavailable — must remain Draft; not redeemable.
         </span>}
        {p.type==="PHYSICAL"&&<span style={{fontSize:12}}>Linked warehouse item and store — read-only</span>}
        {canManageRewards&&<button style={css.button} onClick={()=>openProduct(p)}>Edit product</button>}
       </div>
      </article>)}
     </div>
     {moreProducts&&<button type="button" style={css.button} disabled={loading||pagingBusy||busy}
      onClick={()=>void loadMore("PRODUCTS")}>Load more reward products</button>}
     {productsLoading&&<p role="status">Loading current reward products…</p>}
     {categoriesTruncated&&<p style={{fontSize:12}}>More categories exist. Search
      the full catalogue to find products outside the displayed category choices.</p>}
     {!productsLoading&&!orderedProducts.length&&<p>{products.length||
      appliedSearch||categoryFilter!=="All"?
       "No products match the current search or category.":
       "No rewards are recorded for this programme yet."}</p>}
    </section>:<section style={css.panel}>
     <AdminRedemptionsTable key={selected} programme={selected} programmes={programmes}
      onProgrammeChange={setSelected} refreshEpoch={epoch}
      canIssueStock={canIssueStock}/>
    </section>}
   </>}
  </>}
  {drawer&&<div style={{position:"fixed",inset:0,background:"rgba(10,22,45,.58)",zIndex:200,
   display:"flex",justifyContent:"flex-end"}} onMouseDown={e=>{
    if(e.target===e.currentTarget)closeDrawer();
   }}>
   <aside ref={dialogRef} role="dialog" tabIndex={-1} aria-modal="true" aria-labelledby="cg13-editor-heading"
    style={{background:"var(--cg-surface,#fff)",color:"inherit",width:"min(100%,410px)",height:"100%",
     overflowY:"auto",padding:18,display:"grid",alignContent:"start",gap:13,
     boxShadow:"-8px 0 35px rgba(8,20,40,.15)"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
     <h2 id="cg13-editor-heading" style={{margin:0,fontSize:21}}>{drawer==="POLICY"?"Configure Referral Settings":"Add Reward Product"}</h2>
     <button type="button" style={css.button} disabled={busy||!!pending} onClick={closeDrawer}
      aria-label="Close editor">Close</button>
    </div>
    {drawer==="POLICY"?<>
     <div style={{fontSize:11,fontWeight:700,color:"var(--cg-text-muted,#64748B)",
      borderBottom:"1px solid var(--cg-border,#DCE4ED)",paddingBottom:8}}>
      POINTS &amp; VALUES</div>
     <label style={css.field}>Programme code (immutable after creation)
      <input style={css.control} disabled={editingPolicy} autoComplete="off"
       value={programmeForm.programmeCode}
       onChange={e=>setProgrammeForm(p=>({...p,programmeCode:e.target.value}))}/>
     </label>
     {rowInput("Programme display name",programmeForm.name,v=>setProgrammeForm(p=>({...p,name:v})))}
     <label style={css.field}>Eligible relationship
      <select style={css.control} value={programmeForm.audience}
       onChange={e=>setProgrammeForm(p=>({...p,audience:e.target.value as Programme["audience"]}))}>
       <option value="MEMBER">Members</option><option value="VOLUNTEER">Volunteers</option>
       <option value="BOTH">Members and Volunteers</option></select></label>
     <label style={css.field}>Actual qualification source
      <select style={css.control} value={programmeForm.qualifyingEvent}
       onChange={e=>setProgrammeForm(p=>({...p,qualifyingEvent:e.target.value as Programme["qualifyingEvent"]}))}>
       <option value="MEMBERSHIP_ACTIVATED_VERIFIED">Verified member activation</option>
       <option value="VOLUNTEER_APPROVED_ACTIVE">Approved active volunteer</option></select></label>
     {rowInput("Points per verified referral",programmeForm.awardPoints,
      v=>setProgrammeForm(p=>({...p,awardPoints:v})),"text")}
     {rowInput("Minimum points to claim",programmeForm.minimumClaimPoints,
      v=>setProgrammeForm(p=>({...p,minimumClaimPoints:v})),"text")}
     {rowInput("Effective date (India)",programmeForm.effectiveFrom,
      v=>setProgrammeForm(p=>({...p,effectiveFrom:v})),"date")}
     {rowInput("Points to INR display rate (optional; NOT cash)",programmeForm.displayInrRatio,
      v=>setProgrammeForm(p=>({...p,displayInrRatio:v})),"text")}
     <div style={{fontSize:11,fontWeight:700,color:"var(--cg-text-muted,#64748B)",
      borderBottom:"1px solid var(--cg-border,#DCE4ED)",paddingBottom:8}}>
      AUTOMATION &amp; PERMISSIONS · only source-backed options enabled</div>
     <label style={css.field}><input type="checkbox" checked={programmeForm.autoRankUpgrade}
      onChange={e=>setProgrammeForm(p=>({...p,autoRankUpgrade:e.target.checked}))}/>
      Automatic rank upgrade on a genuinely verified event</label>
     <p style={{fontSize:12}}>Digital certificate auto-issue, public leaderboard and
      interview gates in the screenshot are not editable here until their verified
      the required verification and reward fulfilment workflows are available. Points never expire by default.
      INR conversion is an informational
      reference and does not issue money or a guaranteed reward.</p>
     <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <strong>Rank thresholds</strong>
      <button type="button" style={css.button} disabled={programmeForm.ranks.length>=30}
       onClick={()=>setProgrammeForm(p=>({...p,ranks:[...p.ranks,{
        name:"",verifiedReferrals:p.ranks.length===0?"0":String(Number(p.ranks[p.ranks.length-1].verifiedReferrals)+1),
        minimumPoints:p.ranks.length===0?"0":String(p.ranks[p.ranks.length-1].minimumPoints),
        benefitsSummary:""}]}))}>Add rank</button>
     </div>
     {programmeForm.ranks.map((rank,i)=><div key={i} style={{...css.panel,padding:12}}>
      <strong>Rank {i+1}</strong>
      {rowInput("Rank name",rank.name,v=>setRank(i,"name",v))}
      {rowInput("Minimum verified referrals",String(rank.verifiedReferrals),v=>setRank(i,"verifiedReferrals",v))}
      {rowInput("Minimum eligible points",String(rank.minimumPoints),v=>setRank(i,"minimumPoints",v))}
      {rowInput("Benefit summary (optional)",rank.benefitsSummary,v=>setRank(i,"benefitsSummary",v))}
      <button type="button" style={css.button} onClick={()=>setProgrammeForm(p=>({...p,
       ranks:p.ranks.filter((_,j)=>j!==i)}))}>Remove rank</button>
     </div>)}
     {!programmeForm.ranks.length&&<p>Add at least one original rank. The first rank begins
      at 0 verified referrals and 0 eligible points; there are no hardcoded tiers.</p>}
    </>:<>
     {rowInput("Product title",rewardForm.name,v=>setRewardForm(p=>({...p,name:v})))}
     {rowInput("Category",rewardForm.category,v=>setRewardForm(p=>({...p,category:v})))}
     <label style={css.field}>Product type
      <select style={css.control} value={rewardForm.type}
       onChange={e=>setRewardForm(p=>({...p,type:e.target.value as Reward["type"],itemRef:"",storeRef:""}))}>
       <option value="DIGITAL">Digital recognition (no stock)</option>
       <option value="PHYSICAL">Physical item (warehouse stock)</option></select></label>
     {rewardForm.type==="DIGITAL"&&<label style={css.field}>
      Real digital fulfillment source
      <select style={css.control} value={rewardForm.digitalFulfillmentMethod}
       onChange={e=>setRewardForm(p=>({...p,
        digitalFulfillmentMethod:e.target.value as RewardDraft["digitalFulfillmentMethod"]}))}>
       <option value="PENDING_EXTERNAL_PROOF">Await verified delivery — no automatic fulfillment</option>
       <option value="ON_PLATFORM_RECOGNITION">Recipient-acknowledged on-platform recognition only</option>
      </select>
      <span style={{fontSize:12,fontWeight:400}}>The recognition option delivers only the
       configured in-app recognition, not a gift code, cash or PDF certificate.</span>
     </label>}
     {rowInput("Redemption points (not rupees)",rewardForm.pointsPrice,
      v=>setRewardForm(p=>({...p,pointsPrice:v})),"text")}
     <label style={css.field}>Eligible marketplace
      <select style={css.control} value={rewardForm.eligibleAudience}
       onChange={e=>setRewardForm(p=>({...p,eligibleAudience:e.target.value as Reward["eligibleAudience"]}))}>
       <option value="MEMBER">Members</option><option value="VOLUNTEER">Volunteers</option>
       <option value="BOTH">Members and Volunteers</option></select></label>
     <label style={css.field}>Product status<select style={css.control} value={rewardForm.status}
      onChange={e=>setRewardForm(p=>({...p,status:e.target.value as Reward["status"]}))}>
      <option value="DRAFT">Draft</option><option value="ACTIVE"
       disabled={rewardForm.type==="DIGITAL"&&
        rewardForm.digitalFulfillmentMethod!=="ON_PLATFORM_RECOGNITION"}>
       Active catalogue</option>
      <option value="ARCHIVED">Archived</option></select></label>
     {rewardForm.type==="DIGITAL"&&
      rewardForm.digitalFulfillmentMethod!=="ON_PLATFORM_RECOGNITION"&&
      <p role="status" style={{fontSize:12,margin:0}}>
       Keep this digital product in Draft: the current release has no approved
       external-delivery source. No member points can be held for it.
      </p>}
     <label style={css.field}>Description<textarea style={{...css.control,minHeight:85}}
      maxLength={1000} value={rewardForm.description}
      onChange={e=>setRewardForm(p=>({...p,description:e.target.value}))}/></label>
     {rowInput("Published CareGanga image link (optional)",rewardForm.imageUrl,
      v=>setRewardForm(p=>({...p,imageUrl:v})),"url")}
     <p style={{fontSize:12,margin:0}}>Use a currently published image from CareGanga's approved media library.
      Images without current scan/rights approval cannot be saved. Blank is allowed.</p>
     <label style={css.field}><input type="checkbox" checked={rewardForm.highlighted}
      onChange={e=>setRewardForm(p=>({...p,highlighted:e.target.checked}))}/>
      Highlight on reward card</label>
     <label style={css.field}><input type="checkbox" checked={rewardForm.publicVisible}
      onChange={e=>setRewardForm(p=>({...p,publicVisible:e.target.checked}))}/>
      Visible to eligible members and volunteers</label>
     {rewardForm.type==="PHYSICAL"&&<>
      <label style={css.field}>Warehouse item
       <select style={css.control} value={rewardForm.itemRef}
        onChange={e=>setRewardForm(p=>({...p,itemRef:e.target.value}))}>
        <option value="">Choose an active whole-piece item</option>
        {(stockOptions?.items??[]).map(x=><option key={x.ref} value={x.ref}>{x.name}</option>)}
       </select></label>
      <label style={css.field}>Authorized warehouse store
       <select style={css.control} value={rewardForm.storeRef}
        onChange={e=>setRewardForm(p=>({...p,storeRef:e.target.value}))}>
        <option value="">Choose an active store</option>
        {(stockOptions?.stores??[]).map(x=><option key={x.ref} value={x.ref}>{x.name}</option>)}
       </select></label>
      <p style={{fontSize:13}}>Stock units — <strong>{stock?
       stock.availableQuantity+" available (warehouse)": "Source not yet verified"}</strong>.
       Read-only; changing reward details never creates stock.</p>
      {stock&&<p style={{fontSize:12,margin:0}}>
       On hand: <strong>{stock.onHandQuantity}</strong> ·
       Reserved: <strong>{stock.reservedQuantity}</strong> ·
       Available: <strong>{stock.availableQuantity}</strong>
      </p>}
      {!stockOptions&&<p role="status">Checking current warehouse options…</p>}
     </>}
    </>}
    <div style={{display:"flex",justifyContent:"flex-end",gap:8,position:"sticky",bottom:0,
     padding:"10px 0",background:"var(--cg-surface,#fff)"}}>
     <button type="button" style={css.button} disabled={busy||!!pending}
      onClick={closeDrawer}>Cancel</button>
     <button type="button" style={css.primary} disabled={busy}
      onClick={drawer==="POLICY"?saveProgramme:saveProduct}>
      {pending?"Retry same request":busy?"Saving…":"Save changes"}</button>
    </div>
   </aside>
  </div>}
 </div>;
}
