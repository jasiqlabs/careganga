"use client";
import {useCallback,useEffect,useRef,useState,type FormEvent} from "react";
import styles from "./campaigns-reference-ui.module.css";
import {CampaignBannerPanel,CampaignSupportingDocumentsPanel} from "./campaign-banner-panel";
const steps=["Basic Details","Project & Category","Team & Assignment","Budget & Targets","Documents & Media","Review & Submit"];
type Row={ref:string;code:string;title:string;category:string;status:string;version:number;revision:number;
 branch:string|null;goalMinor:string|null;updatedAt:string;steps?:Record<string,unknown>};
type Summary={total:number;active:number;publicCount:number;draft:number;completed:number;cancelled:number;goalMinor:string};
type Activity={code:string;title:string;action:string;at:string;by:string};
type Page={items:Row[];offset:number;hasMore:boolean;summary:Summary;recentActivities:Activity[]};
type Choice={value:string;label:string};
type CampaignFilters={stateRef:string;districtRef:string;leaderRef:string;branchRef:string;featured:"ALL"|"YES"|"NO";createdFrom:string;createdTo:string};
const emptyCampaignFilters=():CampaignFilters=>({stateRef:"",districtRef:"",leaderRef:"",branchRef:"",featured:"ALL",createdFrom:"",createdTo:""});
type Choices={canFoundation:boolean;branches:Choice[];states:Choice[];districts:Choice[];coordinators:Choice[];volunteers:Choice[];projects:Choice[];events:(Choice&{projectRef:string|null})[]};
type Draft={
 basic:{title:string;type:"GENERAL";summary:string;description:string;tags:string[]};
 project:{category:string;branchRef:string|null;projectRef:string|null;eventRef:string|null;stateRef:string|null;districtRef:string|null;location:string;
  targetGroup:string;plannedBeneficiaries:number|null};
 team:{coordinatorRef:string|null;volunteerRef:string|null};
 budget:{goal:string;expectedCost:string;startAt:string;endAt:string};
 media:{coverRef:string|null;fileRef:string|null;supportingFileRefs:string[];alt:string};review:Record<string,never>;
};
const blank=():Draft=>({
 basic:{title:"",type:"GENERAL",summary:"",description:"",tags:[]},
 project:{category:"GENERAL",branchRef:null,projectRef:null,eventRef:null,stateRef:null,districtRef:null,
  location:"",targetGroup:"",plannedBeneficiaries:null},
 team:{coordinatorRef:null,volunteerRef:null},
 budget:{goal:"",expectedCost:"",startAt:"",endAt:""},
 media:{coverRef:null,fileRef:null,supportingFileRefs:[],alt:""},review:{}
});
const minorToRupees=(value:unknown)=>{
 try{if(typeof value!=="string"||!/^[0-9]+$/.test(value))return "";
  const x=BigInt(value);return (x/100n).toString()+"."+(x%100n).toString().padStart(2,"0");}
 catch{return "";}
};
function fromRow(row:Row):Draft{
 const p=row.steps??{},basic=p.basic as Partial<Draft["basic"]>|undefined,
  project=p.project as Partial<Draft["project"]>|undefined,
  team=p.team as Partial<Draft["team"]>|undefined,
  budget=p.budget as {goalMinor?:string|null;expectedCostMinor?:string|null;startAt?:string|null;endAt?:string|null}|undefined,
  media=p.media as Partial<Draft["media"]>|undefined;
 return {...blank(),
  basic:{...blank().basic,title:basic?.title??row.title,summary:basic?.summary??"",
   description:basic?.description??"",tags:Array.isArray(basic?.tags)?basic.tags:[]},
  project:{...blank().project,category:project?.category??"GENERAL",branchRef:project?.branchRef??null,
   projectRef:project?.projectRef??null,eventRef:project?.eventRef??null,
   stateRef:project?.stateRef??null,districtRef:project?.districtRef??null,location:project?.location??"",
   targetGroup:project?.targetGroup??"",plannedBeneficiaries:project?.plannedBeneficiaries??null},
  team:{...blank().team,coordinatorRef:team?.coordinatorRef??null,volunteerRef:team?.volunteerRef??null},
  budget:{goal:minorToRupees(budget?.goalMinor),expectedCost:minorToRupees(budget?.expectedCostMinor),
   startAt:budget?.startAt??"",endAt:budget?.endAt??""},
  media:{coverRef:media?.coverRef??null,fileRef:media?.fileRef??null,supportingFileRefs:Array.isArray(media?.supportingFileRefs)?media.supportingFileRefs:[],alt:media?.alt??""}};
}
async function api<T>(path:string,method:"GET"|"POST"|"PATCH"="GET",body?:Record<string,unknown>):Promise<T>{
 const r=await fetch("/api/campaigns"+(path.startsWith("?")?path:path?"/"+path:""),{method,cache:"no-store",
  headers:body?{"Content-Type":"application/json"}:undefined,
  body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(18000)});
 const data:unknown=await r.json().catch(()=>null);
 if(!r.ok||!data)throw Object.assign(Error(data&&typeof data==="object"&&"message" in data&&
  typeof data.message==="string"?data.message:"Current campaign result cannot be verified."),{status:r.ok?503:r.status});
 return data as T;
}
const panel={border:"1px solid var(--cg-border)",borderRadius:12,padding:18,background:"var(--cg-surface,#fff)"} as const;
const field={display:"grid",gap:6,fontSize:14,fontWeight:600} as const;
const entry={minHeight:42,borderRadius:8,border:"1px solid var(--cg-border)",padding:"10px 12px",width:"100%",background:"var(--cg-surface,#fff)",color:"inherit"} as const;
const actions={display:"flex",gap:8,flexWrap:"wrap" as const,alignItems:"center" as const};
export function CampaignDraftsWorkspace({canManage}:{canManage:boolean}){
 const [rows,setRows]=useState<Row[]>([]),[offset,setOffset]=useState(0),[hasMore,setHasMore]=useState(false),
  [q,setQ]=useState(""),[applied,setApplied]=useState(""),[selected,setSelected]=useState<Row|null>(null),
  [draft,setDraft]=useState<Draft>(blank),[step,setStep]=useState(0),[editing,setEditing]=useState(false),
  [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[notice,setNotice]=useState(""),
  [failure,setFailure]=useState(""),[choices,setChoices]=useState<Choices|null>(null),
  [savedDraft,setSavedDraft]=useState<Draft>(blank),
  [summary,setSummary]=useState<Summary|null>(null),[statusFilter,setStatusFilter]=useState("ALL"),
  [filters,setFilters]=useState<CampaignFilters>(emptyCampaignFilters),[appliedFilters,setAppliedFilters]=useState<CampaignFilters>(emptyCampaignFilters),
  [filterChoices,setFilterChoices]=useState<Choices|null>(null),[filterError,setFilterError]=useState(""),
  [activities,setActivities]=useState<Activity[]>([]);
 const choiceSeq=useRef(0),filterSeq=useRef(0);
 const pending=useRef<{key:string;body:Record<string,unknown>;method:"POST"|"PATCH";path:string}|null>(null);
 const submitPending=useRef<{key:string;ref:string;version:number}|null>(null);
 const lifecyclePending=useRef<{key:string;ref:string;version:number;action:"PAUSE"|"RESUME"|"CLOSE"|"WITHDRAW"}|null>(null);
 const serial=useRef(0),editingSerial=useRef(0);
 const refresh=useCallback(async()=>{
  const id=++serial.current;setLoading(true);
  try{
   const data=await api<Page>("?"+new URLSearchParams({offset:String(offset),q:applied,status:statusFilter,...appliedFilters}));
   if(id===serial.current){setRows(data.items);setHasMore(data.hasMore);setSummary(data.summary);setActivities(data.recentActivities??[]);setFailure("");}
  }catch(e){if(id===serial.current){setRows([]);setSummary(null);setActivities([]);setFailure(e instanceof Error?e.message:"Campaign records unavailable.");}}
  finally{if(id===serial.current)setLoading(false);}
 },[offset,applied,statusFilter,appliedFilters]);
 useEffect(()=>{void refresh();return()=>{serial.current++;editingSerial.current++;};},[refresh]);
 useEffect(()=>{
  if(!editing){setChoices(null);return;}
  const id=++choiceSeq.current;
  void api<Choices>("options?"+new URLSearchParams({stateRef:draft.project.stateRef??"",branchRef:draft.project.branchRef??""}))
   .then(data=>{if(id===choiceSeq.current)setChoices(data);})
   .catch(()=>{if(id===choiceSeq.current){setChoices(null);setFailure("Current branch, area or coordinator choices could not be verified.");}});
  return()=>{choiceSeq.current++;};
 },[editing,draft.project.stateRef,draft.project.branchRef]);
 useEffect(()=>{
  if(editing){setFilterChoices(null);return;}
  const id=++filterSeq.current;setFilterError("");
  void api<Choices>("options?"+new URLSearchParams({stateRef:filters.stateRef,branchRef:filters.branchRef}))
   .then(data=>{if(id===filterSeq.current)setFilterChoices(data);})
   .catch(()=>{if(id===filterSeq.current){setFilterChoices(null);setFilterError("Current campaign area and fundraiser choices could not be verified.");}});
  return()=>{filterSeq.current++;};
 },[editing,filters.stateRef,filters.branchRef]);
  const reset=()=>{if(busy||pending.current||submitPending.current||lifecyclePending.current)return;editingSerial.current++;setSelected(null);setDraft(blank());setSavedDraft(blank());setStep(0);setEditing(false);setFailure("");setNotice("");};
 const open=async(row:Row)=>{if(busy||pending.current||submitPending.current||lifecyclePending.current)return;const id=++editingSerial.current;setLoading(true);setFailure("");
  try{const result=await api<Row>(row.ref);if(id===editingSerial.current){setSelected(result);setDraft(fromRow(result));setSavedDraft(fromRow(result));setEditing(true);setStep(0);setNotice("");}}
  catch(e){if(id===editingSerial.current)setFailure(e instanceof Error?e.message:"Campaign detail unavailable.");}
  finally{if(id===editingSerial.current)setLoading(false);}
 };
 const update=<K extends keyof Draft>(kind:K,key:string,value:unknown)=>{
  if(!editable||pending.current||submitPending.current)return;
  setDraft(d=>({...d,[kind]:{...d[kind],[key]:value}}));
 };
 const save=async(e?:FormEvent)=>{e?.preventDefault();if(!editable||busy||submitPending.current)return;setBusy(true);setFailure("");setNotice("");
  if(!pending.current){
   const key=crypto.randomUUID();
   pending.current={key,method:selected?"PATCH":"POST",path:selected?selected.ref+"/draft":"",
    body:{requestKey:key,...(selected?{expectedVersion:selected.version}:{}),steps:draft}};
  }
  const command=pending.current;
  try{
   const result=await api<{ref:string;version:number;code:string;status:string;replayed:boolean}>(command.path,command.method,command.body);
   pending.current=null;
   setNotice("Campaign "+result.code+" saved as a private draft. Approval and public publication have not occurred.");
   const current=await api<Row>(result.ref);
   setSelected(current);setDraft(fromRow(current));setSavedDraft(fromRow(current));setEditing(true);
   void refresh();
  }catch(e){
   const status=e&&typeof e==="object"&&"status" in e?Number(e.status):0;
   if(status>0&&status<500&&![408,429].includes(status))pending.current=null;
   setFailure(e instanceof Error?e.message:"Campaign result uncertain. Check the saved draft.");
  }finally{setBusy(false);}
 };
 const editable=canManage&&(!selected||selected.status==="DRAFT"||selected.status==="RETURNED");
 const submitForReview=async()=>{
  if(!canManage||busy||pending.current||!selected||selected.status!=="DRAFT")return;
  if(JSON.stringify(draft)!==JSON.stringify(savedDraft)){
   setFailure("Save your latest six-step campaign changes before submitting for independent verification.");
   return;
  }
  setBusy(true);setFailure("");setNotice("");
  if(!submitPending.current)submitPending.current={key:crypto.randomUUID(),ref:selected.ref,version:selected.version};
  const command=submitPending.current;
  try{
   const result=await api<{reference:string;status:string;replayed:boolean}>(
    command.ref+"/submit","POST",{requestKey:command.key,expectedVersion:command.version});
   submitPending.current=null;
   setNotice("Campaign submitted as "+result.reference+" for independent Foundation verification. It is not yet public or eligible for donations.");
   setEditing(false);setSelected(null);setSavedDraft(blank());setDraft(blank());void refresh();
  }catch(e){
   const status=e&&typeof e==="object"&&"status" in e?Number(e.status):0;
   if(status>0&&status<500&&![408,429].includes(status))submitPending.current=null;
   setFailure(e instanceof Error?e.message:"Submission outcome unknown. Retry using the same original request.");
  }finally{setBusy(false);}
 };
 const lifecycle=async(row:Row,action:"PAUSE"|"RESUME"|"CLOSE"|"WITHDRAW")=>{
  if(!canManage||busy||pending.current||submitPending.current)return;
  const prior=lifecyclePending.current;
  if(prior&&(prior.ref!==row.ref||prior.version!==row.version||prior.action!==action)){
   setFailure("The previous campaign status change has an uncertain result. Retry its original action before changing another campaign.");return;
  }
  const allowed=row.status==="APPROVED"?["PAUSE","CLOSE","WITHDRAW"]:
   row.status==="PAUSED"?["RESUME","CLOSE","WITHDRAW"]:
   ["DRAFT","RETURNED"].includes(row.status)?["WITHDRAW"]:[];
  if(!allowed.includes(action))return;
  if(!lifecyclePending.current)lifecyclePending.current={key:crypto.randomUUID(),ref:row.ref,version:row.version,action};
  const request=lifecyclePending.current;
  setBusy(true);setFailure("");setNotice("");
  try{
   const result=await api<{status:string;version:number;replayed:boolean}>(request.ref+"/lifecycle","POST",
    {requestKey:request.key,expectedVersion:request.version,action:request.action});
   lifecyclePending.current=null;
   setNotice("Campaign "+row.code+" is now "+result.status.replaceAll("_"," ").toLowerCase()+
    ". Public visibility is independently checked on every request.");
   setEditing(false);setSelected(null);setDraft(blank());setSavedDraft(blank());void refresh();
  }catch(e){
   const code=e&&typeof e==="object"&&"status" in e?Number(e.status):0;
   if(code>0&&code<500&&![408,429].includes(code))lifecyclePending.current=null;
   setFailure(e instanceof Error?e.message:"Campaign status cannot be confirmed. Retry the same original action.");
  }finally{setBusy(false);}
 };
 const hasUnsavedChanges=JSON.stringify(draft)!==JSON.stringify(savedDraft);
 const select=(label:string,value:string|null,items:Choice[],change:(v:string|null)=>void,empty:string)=>
  <label style={field}>{label}<select style={entry} disabled={busy||!editable||!!pending.current||!!submitPending.current||!choices}
   value={value??""} onChange={e=>change(e.target.value||null)}>
    <option value="">{empty}</option>{items.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}
  </select></label>;
 const input=(label:string,value:string,onChange:(v:string)=>void,multiline=false)=>
  <label style={field}>{label}{multiline?
   <textarea style={{...entry,minHeight:100}} value={value} onChange={e=>onChange(e.target.value)} disabled={busy||!editable||!!pending.current||!!submitPending.current}/>:
   <input style={entry} value={value} onChange={e=>onChange(e.target.value)} disabled={busy||!editable||!!pending.current||!!submitPending.current}/>}</label>;
 const tabItems=[{key:"ALL",label:"All Campaigns",count:summary?.total},
  {key:"APPROVED",label:"Approved",count:summary?.active},
  {key:"DRAFT",label:"Drafts",count:summary?.draft},
  {key:"CLOSED",label:"Completed",count:summary?.completed},
  {key:"WITHDRAWN",label:"Cancelled",count:summary?.cancelled}];
 const kpis=[{name:"Total Campaigns",count:summary?.total,style:styles.statBlue,icon:"◉"},
  {name:"Approved Campaigns",count:summary?.active,style:styles.statGreen,icon:"✓"},
  {name:"Draft Campaigns",count:summary?.draft,style:styles.statAmber,icon:"◷"},
  {name:"Completed Campaigns",count:summary?.completed,style:styles.statPurple,icon:"▣"},
  {name:"Cancelled Campaigns",count:summary?.cancelled,style:styles.statRed,icon:"×"}];
 return <section aria-label="Foundation campaigns" className={styles.workspace}>
  {!editing&&<>
   <header className={styles.titleRow}>
    <div><h1>Campaigns</h1><p>CareGanga Foundation campaign planning and verification</p></div>
   </header>
   <div className={styles.statGrid} aria-label="Campaign source status overview">
    {kpis.map(item=><article className={styles.statCard+" "+item.style} key={item.name}>
     <span className={styles.statIcon} aria-hidden="true">{item.icon}</span>
     <div><div className={styles.statLabel}>{item.name}</div><div className={styles.statNumber}>{item.count??"—"}</div></div>
    </article>)}
   </div>
   <section className={styles.filterPanel} aria-label="Advanced campaign search and filters">
    <h2>Advanced Search &amp; Filters</h2>
    <div className={styles.filterGrid}>
     <label style={field}>Search keyword<input style={entry} value={q} onChange={e=>setQ(e.target.value)}
       placeholder="Campaign title or code" maxLength={80}/></label>
     <label style={field}>Campaign status<select style={entry} value={statusFilter}
      onChange={e=>{setStatusFilter(e.target.value);setOffset(0);}}>
      {tabItems.map(t=><option key={t.key} value={t.key}>{t.label}</option>)}
      {["SUBMITTED","RETURNED","REJECTED","PAUSED"].map(t=>
       <option key={t} value={t}>{t.replaceAll("_"," ").toLowerCase()}</option>)}
     </select></label>
     <label style={field}>Foundation branch<select style={entry} value={filters.branchRef}
       onChange={e=>setFilters(f=>({...f,branchRef:e.target.value,leaderRef:""}))}>
       <option value="">All permitted branches</option>
       {(filterChoices?.branches??[]).map(x=><option key={x.value} value={x.value}>{x.label}</option>)}
      </select></label>
     <label style={field}>Campaign leader<select style={entry} value={filters.leaderRef}
       onChange={e=>setFilters(f=>({...f,leaderRef:e.target.value}))}>
       <option value="">All permitted leaders</option>
       {(filterChoices?.coordinators??[]).map(x=><option key={x.value} value={x.value}>{x.label}</option>)}
      </select></label>
     <label style={field}>State<select style={entry} value={filters.stateRef}
       onChange={e=>setFilters(f=>({...f,stateRef:e.target.value,districtRef:""}))}>
       <option value="">All permitted states</option>
       {(filterChoices?.states??[]).map(x=><option key={x.value} value={x.value}>{x.label}</option>)}
      </select></label>
     <label style={field}>District<select style={entry} value={filters.districtRef}
       disabled={!filters.stateRef} onChange={e=>setFilters(f=>({...f,districtRef:e.target.value}))}>
       <option value="">All districts</option>
       {(filterChoices?.districts??[]).map(x=><option key={x.value} value={x.value}>{x.label}</option>)}
      </select></label>
     <label style={field}>Featured on published website<select style={entry} value={filters.featured}
       onChange={e=>setFilters(f=>({...f,featured:e.target.value as CampaignFilters["featured"]}))}>
       <option value="ALL">All campaigns</option><option value="YES">Editorially featured</option>
       <option value="NO">Not editorially featured</option>
      </select></label>
     <label style={field}>Created from<input type="date" style={entry} value={filters.createdFrom}
       onChange={e=>setFilters(f=>({...f,createdFrom:e.target.value}))}/></label>
     <label style={field}>Created through<input type="date" style={entry} value={filters.createdTo}
       onChange={e=>setFilters(f=>({...f,createdTo:e.target.value}))}/></label>
     {filterError&&<p role="alert">{filterError}</p>}
     <button type="button" disabled={busy} onClick={()=>{setOffset(0);setApplied(q.trim());setAppliedFilters({...filters});}}>Apply Filters</button>
     <button type="button" disabled={busy} onClick={()=>{setQ("");setApplied("");setStatusFilter("ALL");setFilters(emptyCampaignFilters());setAppliedFilters(emptyCampaignFilters());setOffset(0);}}>Reset</button>
    </div>
   </section>
   <div className={styles.overviewColumns}>
    <section style={panel} aria-label="Campaign records">
     <div className={styles.listTop}>
      <nav className={styles.tabStrip} aria-label="Campaign status tabs">
       {tabItems.map(t=><button type="button" key={t.key}
        className={styles.tabButton+(statusFilter===t.key?" "+styles.tabActive:"")}
        aria-current={statusFilter===t.key?"page":undefined} disabled={busy}
        onClick={()=>{setOffset(0);setStatusFilter(t.key);}}>
        {t.label} ({t.count??"—"})</button>)}
      </nav>
      {canManage&&<button type="button" className={styles.launch}
       disabled={busy||!!pending.current||!!submitPending.current}
       onClick={()=>{reset();setEditing(true);}}>Launch New Campaign</button>}
     </div>
     {loading&&<p role="status">Verifying current campaign records…</p>}
     {!loading&&!rows.length&&<p>No permitted campaign records match the current filters.</p>}
     <div style={{display:"grid",gap:10,marginTop:12}}>
      {rows.map(row=><article key={row.ref} style={{...panel,padding:12}}>
       <div style={{...actions,justifyContent:"space-between"}}>
        <div><strong>{row.title}</strong>
         <p style={{margin:"4px 0",color:"var(--cg-muted)"}}>{row.code} · {row.status.replaceAll("_"," ")} · {row.category}</p></div>
        <div style={actions}>
         <button type="button" disabled={busy||!!pending.current||!!submitPending.current||!!lifecyclePending.current}
          onClick={()=>void open(row)}>{canManage?"Open campaign":"View details"}</button>
         {canManage&&(row.status==="APPROVED"||row.status==="PAUSED"||row.status==="DRAFT"||row.status==="RETURNED")&&
          <>{(row.status==="APPROVED"?["PAUSE","CLOSE","WITHDRAW"]:
            row.status==="PAUSED"?["RESUME","CLOSE","WITHDRAW"]:["WITHDRAW"]).map(action=>
           <button key={action} type="button" disabled={busy||!!pending.current||!!submitPending.current||
             !!lifecyclePending.current&&(lifecyclePending.current.ref!==row.ref||lifecyclePending.current.action!==action)}
            onClick={()=>void lifecycle(row,action as "PAUSE"|"RESUME"|"CLOSE"|"WITHDRAW")}>
            {lifecyclePending.current?.ref===row.ref&&lifecyclePending.current.action===action?"Retry ":""}
            {action==="WITHDRAW"?"Cancel / withdraw":action==="PAUSE"?"Pause":action==="RESUME"?"Resume":"Complete"}
           </button>)}</>}
        </div>
       </div>
      </article>)}
     </div>
     <div style={{...actions,marginTop:12}}>
      {offset>0&&<button type="button" onClick={()=>setOffset(v=>Math.max(0,v-25))} disabled={busy}>Previous page</button>}
      {hasMore&&<button type="button" onClick={()=>setOffset(v=>v+25)} disabled={busy}>Next page</button>}
     </div>
    </section>
    <aside className={styles.sideRail} aria-label="Campaign overview sidebar">
     <section className={styles.sideCard}><h3>Campaign Overview</h3>
      <p>CG03-approved campaigns: {summary?.active??"—"}</p>
      <p>Currently published campaigns: {summary?.publicCount??"—"}</p>
      <p>Awaiting verification: {summary?"View status filters":"Not available"}</p>
      <p>Approved means original CG03 operational approval, not public CG18 publication. Public visibility is checked separately.</p></section>
     <section className={styles.sideCard}><h3>Funding Overview (₹)</h3>
      <p>CG03-approved planned campaign goals: {summary?"₹"+minorToRupees(summary.goalMinor):"Not available"}</p>
      <p>Raised so far: <strong>Not yet verified by finance</strong></p>
      <p>Unverified donations are never counted as funds raised.</p></section>
     <section className={styles.sideCard}><h3>Recent Activities</h3>
      {!activities.length?<p>No campaign changes recorded in your current scope.</p>:
       <div style={{display:"grid",gap:10}}>{activities.map((item,i)=>
        <article key={item.code+"-"+item.at+"-"+i}>
         <strong>{item.title}</strong>
         <p style={{margin:0}}>{item.action.replaceAll("_"," ").toLowerCase()} · {item.by}</p>
         <small>{Number.isFinite(Date.parse(item.at))?new Date(item.at).toLocaleString("en-IN"):"Recorded"}</small>
        </article>)}</div>}
     </section>
    </aside>
   </div>
  </>}
  {editing&&<>
   <div className={styles.wizardIntro}>
    <div><h2>{selected?"Campaign Details":"Create New Campaign"}</h2>
     <p>Create and manage a campaign. Independent verification is required before it can appear publicly.</p>
     {selected&&<p>Campaign code: {selected.code} · Revision {selected.revision}</p>}
    </div>
    <button type="button" disabled={busy||!!pending.current||!!submitPending.current} onClick={reset}>
     Back to Campaigns</button>
   </div>
   <nav aria-label="Campaign wizard steps" className={styles.stepsStrip}>
    {steps.map((name,i)=><button type="button" key={name} aria-current={i===step?"step":undefined}
      disabled={busy||!!pending.current||!!submitPending.current}
      onClick={()=>setStep(i)} className={styles.stepButton+(step===i?" "+styles.stepActive:"")}>
      <span>{i+1}</span><span>{name}</span>
     </button>)}
   </nav>
   <div className={styles.wizardGrid}>
    <section className={styles.formPanel} aria-label="Six-step campaign draft wizard">
     <h3>{step+1}. {steps[step]}</h3>
     <p role="status">Step {step+1} of 6 · {selected?"Saved revision "+selected.revision:"New campaign draft"}</p>
     <form onSubmit={e=>void save(e)} className={styles.formGrid}>
    {selected&&!editable&&<p role="status">This campaign is currently {selected.status.replaceAll("_"," ")}. Its submitted and approved information is read-only; corrections require an original returned review.</p>}
    {step===0&&<>
     {input("Campaign title (required)",draft.basic.title,v=>update("basic","title",v))}
     <p>Type: General Foundation Campaign. A real project may be associated only after source verification.</p>
     {input("Short description",draft.basic.summary,v=>update("basic","summary",v),true)}
     {input("Full campaign explanation",draft.basic.description,v=>update("basic","description",v),true)}
     {input("Tags (comma-separated)",draft.basic.tags.join(", "),v=>update("basic","tags",v.split(",").map(x=>x.trim()).filter(Boolean)))}
     {selected?<div className={styles.fullWidth}>
      <CampaignBannerPanel key={selected.ref+"-cover"} campaignRef={selected.ref} version={selected.version}
       kind="COVER" canUpload={editable&&!busy&&!pending.current&&!submitPending.current}
       currentFileRef={draft.media.coverRef}
       onVerified={ref=>update("media","coverRef",ref||null)}/>
     </div>:<p className={styles.fullWidth}>Save the new campaign as a draft to enable the optional cover image. Cover images are not publicly visible before independent approval.</p>}
    </>}
    {step===1&&<>
     {select("Foundation branch",draft.project.branchRef,choices?.branches??[],
       v=>setDraft(d=>({...d,project:{...d.project,branchRef:v,projectRef:null,eventRef:null},team:{...d.team,volunteerRef:null}})),
       choices?.canFoundation?"Foundation-wide campaign":"Select your assigned branch")}
     {select("State",draft.project.stateRef,choices?.states??[],v=>
       setDraft(d=>({...d,project:{...d.project,stateRef:v,districtRef:null}})),"No state selected")}
     {select("District",draft.project.districtRef,choices?.districts??[],
       v=>update("project","districtRef",v),"No district selected")}
     {select("Current active project (optional)",draft.project.projectRef,choices?.projects??[],
       v=>setDraft(d=>({...d,project:{...d.project,projectRef:v,eventRef:null}})),"General campaign — no project")}
     {select("Current scheduled or ongoing event (optional)",draft.project.eventRef,
       (choices?.events??[]).filter(e=>e.projectRef===draft.project.projectRef),
       v=>update("project","eventRef",v),"No linked event")}
     {input("Campaign category",draft.project.category,v=>update("project","category",v))}
     {input("Location description",draft.project.location,v=>update("project","location",v))}
     {input("Target group (planned, not verified)",draft.project.targetGroup,v=>update("project","targetGroup",v))}
     <label style={field}>Planned beneficiaries (estimate only)
      <input style={entry} type="number" min="0" max="10000000" step="1" value={draft.project.plannedBeneficiaries??""}
       disabled={busy||!editable||!!pending.current||!!submitPending.current} onChange={e=>update("project","plannedBeneficiaries",e.target.value===""?null:Number(e.target.value))}/></label>
     <p>Project and event choices come from current CG-05 records. A general campaign works without either association.</p>
    </>}
    {step===2&&<>{select("Campaign coordinator",draft.team.coordinatorRef,choices?.coordinators??[],
      v=>update("team","coordinatorRef",v),"Use current signed-in Foundation operator")}
     {select("Current approved volunteer (optional)",draft.team.volunteerRef,choices?.volunteers??[],
       v=>update("team","volunteerRef",v),"No volunteer assigned")}
     <p>The original CG-04 active volunteer and branch affiliation are rechecked at save, submission and independent approval. No staff permission is granted.</p></>}
    {step===3&&<>
     {input("Fundraising goal (INR, planned)",draft.budget.goal,v=>update("budget","goal",v))}
     {input("Expected cost (INR, planned)",draft.budget.expectedCost,v=>update("budget","expectedCost",v))}
     <label style={field}>Campaign start date<input type="date" style={entry} value={draft.budget.startAt} disabled={busy||!!pending.current}
      onChange={e=>update("budget","startAt",e.target.value)}/></label>
     <label style={field}>Campaign end date<input type="date" style={entry} value={draft.budget.endAt} disabled={busy||!!pending.current}
      onChange={e=>update("budget","endAt",e.target.value)}/></label>
     <p>Goal and expected cost are estimates—not finance budget approval, donations received or available funds.</p>
    </>}
    {step===4&&<>
     <p>Documents &amp; Media. The banner is optional. Only original CG19-scanned private evidence can be saved; an uploaded file never publishes or receives donations.</p>
     {selected?<div className={styles.fullWidth}>
      <CampaignBannerPanel key={selected.ref+"-hero"} campaignRef={selected.ref} kind="BANNER" version={selected.version}
       canUpload={editable&&!busy&&!pending.current&&!submitPending.current}
       currentFileRef={draft.media.fileRef}
       onVerified={ref=>update("media","fileRef",ref||null)}/>
      <CampaignSupportingDocumentsPanel key={selected.ref+"-documents"} campaignRef={selected.ref}
       version={selected.version} canUpload={editable&&!busy&&!pending.current&&!submitPending.current}
       refs={draft.media.supportingFileRefs}
       onChange={refs=>update("media","supportingFileRefs",refs)}/>
     </div>:<p>Save your campaign draft first to enable secure original file uploads. A campaign without documents can still be submitted.</p>}
     {input("Image description (optional)",draft.media.alt,v=>update("media","alt",v))}
    </>}
    {step===5&&<>
     <h3>Review private campaign details</h3>
     <p><strong>Title:</strong> {draft.basic.title||"Not entered"}</p>
     <p><strong>Category:</strong> {draft.project.category} · <strong>Location:</strong> {draft.project.location||"Not selected"}</p>
     <p><strong>Goal:</strong> {draft.budget.goal||"Not entered"} INR · <strong>Expected cost:</strong> {draft.budget.expectedCost||"Not entered"} INR</p>
     <p><strong>Dates:</strong> {draft.budget.startAt||"Not entered"} – {draft.budget.endAt||"Not entered"}</p>
     <p>Submit creates an original CG-03 independent approval case. Even after approval, separate CG-18 editorial publication and donation eligibility are required.</p>
     {canManage&&<button type="button" disabled={busy||!!pending.current||!selected||
      selected.status!=="DRAFT"||hasUnsavedChanges}
       onClick={()=>void submitForReview()}>
       {submitPending.current?"Retry original verification request":"Submit for Verification"}
      </button>}
     {hasUnsavedChanges&&selected&&<p>Save changes as a draft first to pin the exact revision.</p>}
    </>}
    {failure&&<p role="alert">{failure}</p>}{notice&&<p role="status">{notice}</p>}
    {pending.current&&<p role="alert">Original save outcome unknown. Retry the same request; do not change campaign fields until confirmed.</p>}
    {submitPending.current&&<p role="alert">Review submission outcome may be uncertain; retry with its original request key before changing the draft.</p>}
    <div style={actions}>
     <button type="button" disabled={busy||step===0||!!pending.current} onClick={()=>setStep(v=>Math.max(0,v-1))}>Previous</button>
     <button type="button" disabled={busy||step===5||!!pending.current} onClick={()=>setStep(v=>Math.min(5,v+1))}>Next</button>
     {editable&&<button className="primary" type="submit" disabled={busy||draft.basic.title.trim().length<2}>
      {busy?"Confirming draft…":pending.current?"Retry original save":"Save as Draft"}</button>}
    </div>
     </form>
    </section>
    <aside className={styles.wizardAside} aria-label="Campaign preview and actions">
     <section className={styles.wizardSideCard}>
      <h3>Campaign Preview</h3>
      <div className={styles.previewThumb} aria-hidden="true">▧</div>
      <strong>{draft.basic.title||"Campaign Title"}</strong>
      <p>{draft.basic.summary||"Short description will appear here when entered."}</p>
      <p>Dates: {draft.budget.startAt||"Not set"} – {draft.budget.endAt||"Not set"}</p>
      <p>Location: {draft.project.location||"Not set"}</p>
      <p>Target: {draft.project.plannedBeneficiaries??"Not set"} beneficiaries (planned)</p>
     </section>
     <section className={styles.wizardSideCard}><h3>Quick Actions</h3>
      <div style={{...actions,gap:6}}>
       <button type="button" disabled={!editable||busy||draft.basic.title.trim().length<2}
        onClick={()=>void save()}>Save Draft</button>
       <button type="button" disabled={busy||!!pending.current||!!submitPending.current}
        onClick={reset}>Back to campaigns</button>
      </div>
     </section>
     <section className={styles.note}>
      <strong>Important Note</strong>
      <p>Saving a draft does not publish the campaign or collect donations. Submitting requires a separate independent approval.</p>
     </section>
    </aside>
    <aside className={styles.wizardAside} aria-label="Wizard overview">
     <section className={styles.wizardSideCard}>
      <h3>Steps Overview</h3>
      {steps.map((name,i)=><div key={name} className={styles.miniStep+(step===i?" "+styles.miniActive:"")}>
        <strong>{i+1}</strong><span>{name}</span></div>)}
     </section>
     <section className={styles.wizardSideCard}><h3>Team Summary</h3>
      <p>Campaign coordinator: {draft.team.coordinatorRef?"Assigned":"Signed-in operator"}</p>
      <p>Verified volunteer: {draft.team.volunteerRef?"Selected":"Not assigned"}</p>
     </section>
     <section className={styles.wizardSideCard}><h3>Need Help?</h3>
      <p>Complete the six steps, save your draft and submit it for independent Foundation verification. No technical IDs or unverified public actions are required.</p>
     </section>
    </aside>
   </div>
  </>}
  {lifecyclePending.current&&<p role="alert">A campaign status result is uncertain. Retry its original action before changing another campaign.</p>}
  {!editing&&failure&&<p role="alert">{failure}</p>}
  {!editing&&notice&&<p role="status">{notice}</p>}
 </section>;
}
