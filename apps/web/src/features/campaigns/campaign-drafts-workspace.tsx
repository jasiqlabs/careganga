"use client";
import {useCallback,useEffect,useRef,useState,type FormEvent} from "react";
import styles from "./campaigns-reference-ui.module.css";
const steps=["Basic Details","Project & Category","Team & Assignment","Budget & Targets","Documents & Media","Review & Submit"];
type Row={ref:string;code:string;title:string;category:string;status:string;version:number;revision:number;
 branch:string|null;goalMinor:string|null;updatedAt:string;steps?:Record<string,unknown>};
type Summary={total:number;active:number;draft:number;completed:number;cancelled:number;goalMinor:string};
type Page={items:Row[];offset:number;hasMore:boolean;summary:Summary};
type Choice={value:string;label:string};
type Choices={canFoundation:boolean;branches:Choice[];states:Choice[];districts:Choice[];coordinators:Choice[];volunteers:Choice[];projects:Choice[];events:(Choice&{projectRef:string|null})[]};
type Draft={
 basic:{title:string;type:"GENERAL";summary:string;description:string;tags:string[]};
 project:{category:string;branchRef:string|null;projectRef:string|null;eventRef:string|null;stateRef:string|null;districtRef:string|null;location:string;
  targetGroup:string;plannedBeneficiaries:number|null};
 team:{coordinatorRef:string|null;volunteerRef:string|null};
 budget:{goal:string;expectedCost:string;startAt:string;endAt:string};
 media:{fileRef:null;alt:string};review:Record<string,never>;
};
const blank=():Draft=>({
 basic:{title:"",type:"GENERAL",summary:"",description:"",tags:[]},
 project:{category:"GENERAL",branchRef:null,projectRef:null,eventRef:null,stateRef:null,districtRef:null,
  location:"",targetGroup:"",plannedBeneficiaries:null},
 team:{coordinatorRef:null,volunteerRef:null},
 budget:{goal:"",expectedCost:"",startAt:"",endAt:""},
 media:{fileRef:null,alt:""},review:{}
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
  budget=p.budget as {goalMinor?:string|null;expectedCostMinor?:string|null;startAt?:string|null;endAt?:string|null}|undefined;
 return {...blank(),
  basic:{...blank().basic,title:basic?.title??row.title,summary:basic?.summary??"",
   description:basic?.description??"",tags:Array.isArray(basic?.tags)?basic.tags:[]},
  project:{...blank().project,category:project?.category??"GENERAL",branchRef:project?.branchRef??null,
   projectRef:project?.projectRef??null,eventRef:project?.eventRef??null,
   stateRef:project?.stateRef??null,districtRef:project?.districtRef??null,location:project?.location??"",
   targetGroup:project?.targetGroup??"",plannedBeneficiaries:project?.plannedBeneficiaries??null},
  team:{...blank().team,coordinatorRef:team?.coordinatorRef??null,volunteerRef:team?.volunteerRef??null},
  budget:{goal:minorToRupees(budget?.goalMinor),expectedCost:minorToRupees(budget?.expectedCostMinor),
   startAt:budget?.startAt??"",endAt:budget?.endAt??""}};
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
  [summary,setSummary]=useState<Summary|null>(null),[statusFilter,setStatusFilter]=useState("ALL");
 const choiceSeq=useRef(0);
 const pending=useRef<{key:string;body:Record<string,unknown>;method:"POST"|"PATCH";path:string}|null>(null);
 const submitPending=useRef<{key:string;ref:string;version:number}|null>(null);
 const serial=useRef(0),editingSerial=useRef(0);
 const refresh=useCallback(async()=>{
  const id=++serial.current;setLoading(true);
  try{
   const data=await api<Page>("?"+new URLSearchParams({offset:String(offset),q:applied,status:statusFilter}));
   if(id===serial.current){setRows(data.items);setHasMore(data.hasMore);setSummary(data.summary);setFailure("");}
  }catch(e){if(id===serial.current){setRows([]);setSummary(null);setFailure(e instanceof Error?e.message:"Campaign records unavailable.");}}
  finally{if(id===serial.current)setLoading(false);}
 },[offset,applied,statusFilter]);
 useEffect(()=>{void refresh();return()=>{serial.current++;editingSerial.current++;};},[refresh]);
 useEffect(()=>{
  if(!editing){setChoices(null);return;}
  const id=++choiceSeq.current;
  void api<Choices>("options?"+new URLSearchParams({stateRef:draft.project.stateRef??"",branchRef:draft.project.branchRef??""}))
   .then(data=>{if(id===choiceSeq.current)setChoices(data);})
   .catch(()=>{if(id===choiceSeq.current){setChoices(null);setFailure("Current branch, area or coordinator choices could not be verified.");}});
  return()=>{choiceSeq.current++;};
 },[editing,draft.project.stateRef,draft.project.branchRef]);
 const reset=()=>{if(busy||pending.current||submitPending.current)return;editingSerial.current++;setSelected(null);setDraft(blank());setSavedDraft(blank());setStep(0);setEditing(false);setFailure("");setNotice("");};
 const open=async(row:Row)=>{if(busy||pending.current||submitPending.current)return;const id=++editingSerial.current;setLoading(true);setFailure("");
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
 return <section aria-label="Foundation campaigns" style={{display:"grid",gap:18}}>
  <header><h1>Campaigns</h1><p>Original Foundation campaign drafts and six-step planning. Contributions, approvals and publication are separate verified workflows.</p></header>
  <section style={panel}><div style={actions}>
   <strong>Campaign records (current page): {rows.length}</strong>
   <span>Drafts shown: {rows.filter(x=>x.status==="DRAFT").length}</span>
   {canManage&&<button className="primary" disabled={busy||!!pending.current} onClick={()=>{reset();setEditing(true);}}>Launch New Campaign</button>}
  </div>
  <div style={{...actions,marginTop:12}}>
   <label style={field}>Search campaign or code<input style={entry} value={q} onChange={e=>setQ(e.target.value)} maxLength={80}/></label>
   <button type="button" disabled={busy} onClick={()=>{setOffset(0);setApplied(q.trim());}}>Search</button>
   <button type="button" disabled={busy} onClick={()=>void refresh()}>Refresh</button>
  </div>
  {loading&&<p role="status">Verifying current campaign records…</p>}
  {!loading&&!rows.length&&<p>No permitted campaign drafts match the current search.</p>}
  <div style={{display:"grid",gap:10,marginTop:12}}>
   {rows.map(row=><article key={row.ref} style={{...panel,padding:12}}>
    <div style={{...actions,justifyContent:"space-between"}}><div><strong>{row.title}</strong>
     <p style={{margin:"4px 0",color:"var(--cg-muted)"}}>{row.code} · {row.status.replaceAll("_"," ")} · {row.category}</p></div>
     <button type="button" disabled={busy||!!pending.current} onClick={()=>void open(row)}>{canManage?"Open draft":"View details"}</button></div>
   </article>)}
  </div>
  <div style={{...actions,marginTop:12}}>
   {offset>0&&<button onClick={()=>setOffset(v=>Math.max(0,v-25))} disabled={busy}>Previous page</button>}
   {hasMore&&<button onClick={()=>setOffset(v=>v+25)} disabled={busy}>Next page</button>}
  </div></section>
  {editing&&<section style={panel} aria-label="Six-step campaign draft wizard">
   <div style={{...actions,justifyContent:"space-between"}}>
    <h2>{selected?"Edit "+selected.code:"Create New Campaign"}</h2>
    <button disabled={busy||!!pending.current} onClick={reset}>Close</button>
   </div>
   <p role="status">Step {step+1} of 6: {steps[step]} · {selected?"Draft revision "+selected.revision:"Unsaved new campaign"}</p>
   <nav aria-label="Campaign wizard steps" style={{...actions,marginBottom:18}}>
    {steps.map((name,i)=><button type="button" key={name} aria-current={i===step?"step":undefined}
     disabled={busy||!!pending.current} onClick={()=>setStep(i)} style={{fontWeight:i===step?700:400}}>{i+1}. {name}</button>)}
   </nav>
   <form onSubmit={e=>void save(e)} style={{display:"grid",gap:15}}>
    {selected&&!editable&&<p role="status">This campaign is currently {selected.status.replaceAll("_"," ")}. Its submitted and approved information is read-only; corrections require an original returned review.</p>}
    {step===0&&<>
     {input("Campaign title (required)",draft.basic.title,v=>update("basic","title",v))}
     <p>Type: General Foundation Campaign. A real project may be associated only after source verification.</p>
     {input("Short description",draft.basic.summary,v=>update("basic","summary",v),true)}
     {input("Full campaign explanation",draft.basic.description,v=>update("basic","description",v),true)}
     {input("Tags (comma-separated)",draft.basic.tags.join(", "),v=>update("basic","tags",v.split(",").map(x=>x.trim()).filter(Boolean)))}
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
     <p>Project and event links require verified CG-05 source and are not yet available in this initial draft slice.</p>
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
    {step===4&&<><p>Text-only campaign draft is supported. A campaign banner or supporting document requires original CG-19 private upload, malware verification, publication consent and correct media ownership. Upload is not yet available.</p></>}
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
  </section>}
  {!editing&&failure&&<p role="alert">{failure}</p>}
  {!editing&&notice&&<p role="status">{notice}</p>}
 </section>;
}
