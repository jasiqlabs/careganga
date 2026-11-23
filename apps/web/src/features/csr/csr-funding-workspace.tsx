"use client";
import {useCallback,useEffect,useRef,useState,type CSSProperties} from "react";
type Choice={value:string;label:string;branchRef?:string|null;projectVersion?:number};
type Options={foundation:boolean;branches:Choice[];partners:Choice[];projects:Choice[]};
type Proposal={ref:string;branchRef:string|null;branch:string|null;partnerRef:string|null;
 partnerName:string|null;projectRef:string|null;projectVersion:number|null;projectName:string|null;
 purpose:string;fundType:"CSR_PARTNER"|"FOUNDATION"|"MIXED";amountMinor:string;
 csrShareBps:number;foundationShareBps:number;csrRequestedMinor:string;
 foundationRequestedMinor:string;proposedFrom:string|null;proposedUntil:string|null;
 agreementSummary:string;status:string;version:number;updatedAt:string};
type Draft={branchRef:string;partnerRef:string;projectRef:string;purpose:string;
 fundType:"CSR_PARTNER"|"FOUNDATION"|"MIXED";rupees:string;csrPercent:number;
 proposedFrom:string;proposedUntil:string;agreementSummary:string};
type Command={url:string;method:"POST"|"PATCH";body:Record<string,unknown>};
const fresh=(branch=""):Draft=>({branchRef:branch,partnerRef:"",projectRef:"",purpose:"",
 fundType:"MIXED",rupees:"",csrPercent:70,proposedFrom:"",proposedUntil:"",agreementSummary:""});
const INR=(minor:string)=>{
 try{const v=BigInt(minor);return "₹"+(v/100n).toLocaleString("en-IN")+
  "."+(v%100n).toString().padStart(2,"0");}catch{return "Amount unavailable";}
};
const toMinor=(rupees:string)=>{
 const m=/^([0-9]{1,13})(?:\.([0-9]{1,2}))?$/.exec(rupees.trim());
 return m?(BigInt(m[1])*100n+BigInt((m[2]??"").padEnd(2,"0"))).toString():null;
};
const from=(p:Proposal):Draft=>({branchRef:p.branchRef??"",partnerRef:p.partnerRef??"",
 projectRef:p.projectRef??"",purpose:p.purpose,fundType:p.fundType,
 rupees:(BigInt(p.amountMinor)/100n).toString()+"."+
  (BigInt(p.amountMinor)%100n).toString().padStart(2,"0"),
 csrPercent:p.csrShareBps/100,proposedFrom:p.proposedFrom??"",
 proposedUntil:p.proposedUntil??"",agreementSummary:p.agreementSummary});
const box:CSSProperties={border:"1px solid var(--cg-border)",background:"var(--cg-surface,#fff)",
 borderRadius:14,padding:19,minWidth:0};
const field:CSSProperties={display:"grid",gap:6,fontSize:13,fontWeight:600};
const control:CSSProperties={border:"1px solid var(--cg-border)",borderRadius:8,
 font:"inherit",width:"100%",boxSizing:"border-box",minHeight:44,
 background:"var(--cg-surface,#fff)",padding:"10px 12px",color:"inherit"};
const btn:CSSProperties={padding:"10px 15px",borderRadius:9,
 border:"1px solid var(--cg-border)",background:"var(--cg-surface,#fff)",color:"inherit",
 fontWeight:650,cursor:"pointer"};
const primary:CSSProperties={...btn,background:"var(--cg-accent)",color:"#fff",border:0};
async function api<T>(path:string,method:"GET"|"POST"|"PATCH"="GET",body?:Record<string,unknown>):Promise<T>{
 const response=await fetch("/api/csr/funding-proposals"+path,{method,cache:"no-store",
  headers:body?{"Content-Type":"application/json"}:undefined,
  body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(18000)});
 const x:unknown=await response.json().catch(()=>null);
 if(!response.ok||x===null){
  const message=x&&typeof x==="object"&&"message" in x&&typeof x.message==="string"?
   x.message:"The saved proposal result could not be confirmed.";
  throw Object.assign(Error(message),{status:response.status||503});
 }
 return x as T;
}
export function CsrFundingWorkspace({canManage}:{canManage:boolean}){
 const [page,setPage]=useState<{items:Proposal[];hasMore:boolean}>({items:[],hasMore:false});
 const [options,setOptions]=useState<Options|null>(null);
 const [offset,setOffset]=useState(0),[epoch,setEpoch]=useState(0),[loading,setLoading]=useState(true);
 const [filter,setFilter]=useState("ALL"),[status,setStatus]=useState("ALL"),[query,setQuery]=useState("");
 const [error,setError]=useState(""),[listError,setListError]=useState(""),[notice,setNotice]=useState("");
 const [editing,setEditing]=useState(false),[step,setStep]=useState(0),
  [selected,setSelected]=useState<Proposal|null>(null),[draft,setDraft]=useState<Draft>(fresh);
 const [busy,setBusy]=useState(false),[pending,setPending]=useState<Command|null>(null);
 const detailEpoch=useRef(0);
 const invalidateDetail=()=>{detailEpoch.current+=1;setSelected(null);setEditing(false);setStep(0);};
 const refresh=useCallback(()=>setEpoch(v=>v+1),[]);
 useEffect(()=>{
  let live=true;
  void api<Options>("/options").then(v=>{if(live)setOptions(v);}).catch(e=>{
   if(live){setOptions(null);setError(e instanceof Error?e.message:"Current funding selectors unavailable.");}});
  return()=>{live=false;};
 },[epoch]);
 useEffect(()=>{
  let live=true;setLoading(true);setListError("");
  const p=new URLSearchParams({offset:String(offset)});
  if(filter!=="ALL")p.set("branchRef",filter);
  if(status!=="ALL")p.set("status",status);
  if(query.trim())p.set("q",query.trim());
  void api<{items:Proposal[];hasMore:boolean}>("?"+p.toString()).then(data=>{
   if(live)setPage(data);
  }).catch(e=>{if(live){setPage({items:[],hasMore:false});
   setListError(e instanceof Error?e.message:"Funding list unavailable.");}})
   .finally(()=>{if(live)setLoading(false);});
  return()=>{live=false;};
 },[offset,epoch,filter,status,query]);
 const close=()=>{if(busy||pending)return;invalidateDetail();};
 const begin=()=>{if(!options||busy||pending)return;
  setDraft(fresh(options.foundation?"":options.branches[0]?.value??""));
  invalidateDetail();setEditing(true);setError("");setNotice("");
 };
 const choose=async(p:Proposal)=>{
  if(pending||busy)return;
  const request=++detailEpoch.current;
  setSelected(null);setEditing(false);setBusy(true);setError("");
  try{
   const current=await api<Proposal>("/"+p.ref);
   if(request!==detailEpoch.current)return;
   setSelected(current);setDraft(from(current));setEditing(true);setStep(0);
  }catch(e){
   if(request!==detailEpoch.current)return;
   invalidateDetail();setError(e instanceof Error?e.message:"Funding proposal no longer available.");
  }finally{setBusy(false);}
 };
 const set=(name:keyof Draft,value:string|number)=>setDraft(v=>({...v,[name]:value}));
 const kind=(next:Draft["fundType"])=>setDraft(v=>({...v,fundType:next,
  csrPercent:next==="FOUNDATION"?0:next==="CSR_PARTNER"?100:70,
  partnerRef:next==="FOUNDATION"?"":v.partnerRef}));
 const send=async(command:Command)=>{
  if(busy)return;setBusy(true);setPending(command);setError("");setNotice("");
  try{
   await api<{ref:string;version:number;status:"DRAFT"}>(command.url,command.method,command.body);
   setPending(null);invalidateDetail();
   setNotice("Funding draft saved. This is a request, not an approved commitment or received cash.");
   setOffset(0);refresh();
  }catch(e){
   const code=e&&typeof e==="object"&&"status" in e?Number(e.status):503;
   if(code>0&&code<500)setPending(null);
   setError(code>=500||code===0?
    "The save may have reached the server. Retry only the SAME original request. Check the list before another save.":
    e instanceof Error?e.message:"Funding draft not saved.");
  }finally{setBusy(false);}
 };
 const submit=()=>{
  if(!canManage||busy||pending||!options||selected?.status!=="DRAFT"&&!!selected)return;
  const amountMinor=toMinor(draft.rupees);
  if(!amountMinor||BigInt(amountMinor)<=0n||BigInt(amountMinor)>999999999999999n){
   setError("Enter a positive INR requested amount with at most two decimals.");return;}
  const branchRef=draft.branchRef||null;
  if(!options.foundation&&!branchRef){setError("Select one of your current assigned branches.");return;}
  const project=options.projects.find(p=>p.value===draft.projectRef&&
   (p.branchRef??null)===branchRef);
  if(draft.projectRef&&!project){setError("Refresh and choose a currently eligible project.");return;}
  const partner=options.partners.find(p=>p.value===draft.partnerRef&&
   (p.branchRef===null||p.branchRef===branchRef));
  if(draft.fundType!=="FOUNDATION"&&!partner){
   setError("Choose an approved sponsor in the current Foundation/branch scope.");return;}
  const bps=draft.fundType==="FOUNDATION"?0:draft.fundType==="CSR_PARTNER"?10000:
   draft.csrPercent*100;
  if(!Number.isSafeInteger(bps)||bps<0||bps>10000||
   draft.fundType==="MIXED"&&(bps===0||bps===10000)){
   setError("Set a CSR/Foundation split totaling exactly 100%.");return;}
  if(draft.purpose.trim().length<10){setError("Describe the actual funding purpose.");return;}
  const body:Record<string,unknown>={requestKey:crypto.randomUUID(),
   branchRef,partnerRef:draft.fundType==="FOUNDATION"?null:draft.partnerRef,
   projectRef:draft.projectRef||null,projectVersion:project?.projectVersion??null,
   purpose:draft.purpose.trim(),fundType:draft.fundType,
   amountMinor,csrShareBps:bps,foundationShareBps:10000-bps,
   proposedFrom:draft.proposedFrom||null,proposedUntil:draft.proposedUntil||null,
   agreementSummary:draft.agreementSummary.trim()};
  if(selected)body.expectedVersion=selected.version;
  void send({url:selected?"/"+selected.ref:"",method:selected?"PATCH":"POST",body});
 };
 const matchingPartners=options?.partners.filter(p=>
  (p.branchRef??null)===null||p.branchRef===draft.branchRef)??[];
 const matchingProjects=options?.projects.filter(p=>
  (p.branchRef??null)===(draft.branchRef||null))??[];
 const cashNote="Committed, received, allocated and utilized money must be checked in the original Finance module. These records are funding proposals only.";
 return <section aria-label="CSR fund management" style={{display:"grid",gap:16}}>
  <header><h2>CSR Fund Management</h2><p style={{color:"var(--cg-muted)"}}>
   Original B07–B08 funding requests · {cashNote}</p></header>
  {!!notice&&<p role="status" style={{color:"#166534"}}>{notice}</p>}
  {!!error&&<p role="alert" style={{color:"#B91C1C"}}>{error}</p>}
  <div style={box}>
   <div style={{display:"flex",gap:10,flexWrap:"wrap",justifyContent:"space-between",alignItems:"center"}}>
    <div><h3 style={{margin:0}}>Funding proposals</h3><p style={{fontSize:13,color:"var(--cg-muted)"}}>
     No unverified receipt or allocation totals are shown here.</p></div>
    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
     <button type="button" style={btn} onClick={refresh} disabled={busy||!!pending}>Refresh</button>
     {canManage&&<button type="button" style={primary} onClick={begin} disabled={busy||!!pending||!options}>New funding request</button>}
    </div>
   </div>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:10}}>
    <label style={field}>Funding status
     <select style={control} value={status} disabled={!!pending||busy} onChange={e=>{
      invalidateDetail();setStatus(e.target.value);setOffset(0);}}>
      <option value="ALL">All requests</option><option value="DRAFT">Draft</option>
      <option value="SUBMITTED">Pending approval</option><option value="APPROVED">Approved</option>
      <option value="RETURNED">Returned</option><option value="REJECTED">Rejected</option>
     </select>
    </label>
    <label style={field}>Foundation branch
     <select style={control} value={filter} disabled={!!pending||busy} onChange={e=>{
      invalidateDetail();setFilter(e.target.value);setOffset(0);}}>
      <option value="ALL">All permitted branches</option>
      {options?.foundation&&<option value="FOUNDATION">Foundation-wide</option>}
      {options?.branches.map(x=><option value={x.value} key={x.value}>{x.label}</option>)}
     </select>
    </label>
    <label style={field}>Find funding purpose<input style={control} value={query} maxLength={80}
     disabled={!!pending||busy} onChange={e=>{invalidateDetail();setQuery(e.target.value);setOffset(0);}}/></label>
   </div>
   {!!listError&&<p role="alert">{listError}</p>}
   {loading?<p role="status">Checking original funding proposals…</p>:listError?null:
    page.items.length===0?<p>No actual funding requests match the current branch and filters.</p>:
    <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",textAlign:"left",fontSize:14}}>
     <thead><tr>{["Purpose","Source","Project","Requested","CSR / Foundation","Status","Action"]
      .map(x=><th key={x} scope="col" style={{padding:10,borderBottom:"1px solid var(--cg-border)"}}>{x}</th>)}</tr></thead>
     <tbody>{page.items.map(p=><tr key={p.ref}>
      <td style={{padding:10,borderBottom:"1px solid var(--cg-border)"}}>{p.purpose}</td>
      <td style={{padding:10,borderBottom:"1px solid var(--cg-border)"}}>{p.partnerName??"Foundation"}</td>
      <td style={{padding:10,borderBottom:"1px solid var(--cg-border)"}}>{p.projectName??"General purpose"}</td>
      <td style={{padding:10,borderBottom:"1px solid var(--cg-border)",fontVariantNumeric:"tabular-nums"}}>{INR(p.amountMinor)}</td>
      <td style={{padding:10,borderBottom:"1px solid var(--cg-border)"}}>{p.csrShareBps/100}% / {p.foundationShareBps/100}%</td>
      <td style={{padding:10,borderBottom:"1px solid var(--cg-border)"}}>{p.status==="DRAFT"?"Draft — not approved":p.status.replaceAll("_"," ")}</td>
      <td style={{padding:10,borderBottom:"1px solid var(--cg-border)"}}><button style={btn} type="button" disabled={busy||!!pending}
       onClick={()=>void choose(p)}>{canManage&&p.status==="DRAFT"?"Edit draft":"View"}</button></td>
     </tr>)}</tbody>
    </table></div>}
   <div style={{display:"flex",justifyContent:"end",gap:10,alignItems:"center"}}>
    <button style={btn} type="button" disabled={offset===0||loading} onClick={()=>setOffset(v=>Math.max(0,v-25))}>Previous</button>
    <span>Page {Math.floor(offset/25)+1}</span>
    <button style={btn} type="button" disabled={!page.hasMore||loading} onClick={()=>setOffset(v=>v+25)}>Next</button>
   </div>
  </div>
  {editing&&<div style={box} aria-label="Original CSR funding request details">
   <h3>{selected?"Funding request details":"Create funding request"}</h3>
   <p style={{fontSize:13,color:"var(--cg-muted)"}}>B08 funding request · Save an unapproved draft only. Signed agreements use original CG19, approval uses CG03 and actual cash uses CG09.</p>
   <nav aria-label="Funding request steps" style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
    {["Fund information","Project & split","Agreement notes","Review & save"].map((v,i)=>
     <button key={v} type="button" style={step===i?primary:btn} aria-current={step===i?"step":undefined}
      onClick={()=>setStep(i)} disabled={busy||!!pending}>{i+1}. {v}</button>)}
   </nav>
   {step===0&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12}}>
    <label style={field}>Foundation scope
     <select style={control} value={draft.branchRef} disabled={!!selected||busy||!!pending||!canManage}
      onChange={e=>setDraft(x=>({...x,branchRef:e.target.value,partnerRef:"",projectRef:""}))}>
      {options?.foundation&&<option value="">Foundation-wide</option>}
      {!options?.foundation&&<option value="">Select permitted branch</option>}
      {options?.branches.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}
     </select>
    </label>
    <label style={field}>Funding source
     <select style={control} disabled={!!selected||busy||!!pending||!canManage}
      value={draft.fundType} onChange={e=>kind(e.target.value as Draft["fundType"])}>
      <option value="MIXED">CSR and Foundation (shared)</option>
      <option value="CSR_PARTNER">CSR partner only</option>
      <option value="FOUNDATION">Foundation only</option>
     </select>
    </label>
    <label style={{...field,gridColumn:"1 / -1"}}>Funding purpose
     <textarea style={{...control,minHeight:82}} value={draft.purpose} maxLength={500}
      readOnly={!canManage||selected?.status!=="DRAFT"&&!!selected}
      onChange={e=>set("purpose",e.target.value)}/>
    </label>
    <label style={field}>Requested amount (INR)
     <input style={control} inputMode="decimal" placeholder="50000.00" value={draft.rupees}
      readOnly={!canManage||selected?.status!=="DRAFT"&&!!selected}
      onChange={e=>set("rupees",e.target.value)}/>
    </label>
    <label style={field}>Proposed start date<input style={control} type="date" value={draft.proposedFrom}
     readOnly={!canManage} onChange={e=>set("proposedFrom",e.target.value)}/></label>
    <label style={field}>Proposed end date<input style={control} type="date" value={draft.proposedUntil}
     readOnly={!canManage} onChange={e=>set("proposedUntil",e.target.value)}/></label>
   </div>}
   {step===1&&<div style={{display:"grid",gap:13}}>
    {draft.fundType!=="FOUNDATION"&&<label style={field}>Approved CSR sponsor
     <select style={control} value={draft.partnerRef} disabled={!!selected||busy||!canManage} onChange={e=>set("partnerRef",e.target.value)}>
      <option value="">Select approved original partner</option>
      {matchingPartners.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}
     </select>
    </label>}
    <label style={field}>Eligible project (optional)
     <select style={control} value={draft.projectRef} disabled={busy||!canManage}
      onChange={e=>set("projectRef",e.target.value)}>
      <option value="">General Foundation / branch purpose — no project</option>
      {matchingProjects.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}
     </select>
    </label>
    <label style={field}>CSR share (%) — Foundation receives the remainder
     <input style={control} type="number" min={draft.fundType==="MIXED"?1:0} max={draft.fundType==="MIXED"?99:100}
      step="1" disabled={draft.fundType!=="MIXED"||busy||!canManage}
      value={draft.csrPercent} onChange={e=>set("csrPercent",Number(e.target.value))}/>
    </label>
    <p>Requested split: <strong>{draft.csrPercent}% CSR / {100-draft.csrPercent}% Foundation.</strong> The request does not make either share spendable cash.</p>
   </div>}
   {step===2&&<div style={{display:"grid",gap:12}}>
    <label style={field}>Agreement scope and supporting notes
     <textarea style={{...control,minHeight:130}} maxLength={1000} value={draft.agreementSummary}
      readOnly={!canManage} onChange={e=>set("agreementSummary",e.target.value)}/>
    </label>
    <p role="note">Saving here does not upload, verify or sign an agreement. The protected original CG19 agreement and CG03 funding approval workflows must be completed before this can become an approved commitment.</p>
   </div>}
   {step===3&&<div style={{display:"grid",gap:9}}>
    <h4 style={{margin:0}}>Review unapproved funding request</h4>
    <p><strong>Purpose:</strong> {draft.purpose||"Not entered"}</p>
    <p><strong>Requested:</strong> {toMinor(draft.rupees)?INR(toMinor(draft.rupees)!):"Invalid amount"}</p>
    <p><strong>Source:</strong> {draft.fundType.replaceAll("_"," ")}</p>
    <p><strong>Split:</strong> {draft.csrPercent}% CSR / {100-draft.csrPercent}% Foundation</p>
    <p><strong>Branch:</strong> {options?.branches.find(x=>x.value===draft.branchRef)?.label??"Foundation-wide"}</p>
    <p><strong>Project:</strong> {matchingProjects.find(x=>x.value===draft.projectRef)?.label??"No project linked"}</p>
    <p><strong>Status after save:</strong> Draft only — no CG03 approval, CG09 bank receipt, allocation or utilization.</p>
   </div>}
   <div style={{display:"flex",gap:10,justifyContent:"end",flexWrap:"wrap",marginTop:17}}>
    <button type="button" style={btn} disabled={busy||!!pending} onClick={close}>Close</button>
    {step>0&&<button type="button" style={btn} disabled={busy||!!pending} onClick={()=>setStep(v=>Math.max(0,v-1))}>Previous step</button>}
    {step<3?<button type="button" style={primary} disabled={busy||!!pending} onClick={()=>setStep(v=>Math.min(3,v+1))}>Next step</button>:
     canManage&&(!selected||selected.status==="DRAFT")&&<button type="button" style={primary} disabled={busy||!!pending} onClick={submit}>{busy?"Saving…":"Save funding draft"}</button>}
   </div>
  </div>}
  {pending&&<div style={box} role="alert">
   <p>The last original funding write may have reached the server. Retry the exact same command key rather than creating another request.</p>
   <button type="button" style={btn} disabled={busy} onClick={()=>void send(pending)}>Retry original funding write</button>
  </div>}
 </section>;
}
