"use client";
import {useCallback,useEffect,useRef,useState,type CSSProperties,type FormEvent} from "react";
type Choice={value:string;label:string};
type Options={foundation:boolean;branches:Choice[]};
type Partner={ref:string;branchRef:string|null;branch:string|null;legalName:string;registrationReference:string|null;
 contactName:string;contactEmail:string|null;contactMobile:string|null;supportSummary:string;status:string;version:number;updatedAt:string};
type Page={items:Partner[];hasMore:boolean};
type Draft={branchRef:string;legalName:string;registrationReference:string;contactName:string;contactEmail:string;contactMobile:string;supportSummary:string};
type Command={path:string;method:"POST"|"PATCH";body:Record<string,unknown>};
const empty=():Draft=>({branchRef:"",legalName:"",registrationReference:"",contactName:"",contactEmail:"",contactMobile:"",supportSummary:""});
const from=(x:Partner):Draft=>({branchRef:x.branchRef??"",legalName:x.legalName,registrationReference:x.registrationReference??"",
 contactName:x.contactName,contactEmail:x.contactEmail??"",contactMobile:x.contactMobile??"",supportSummary:x.supportSummary});
const panel:CSSProperties={border:"1px solid var(--cg-border)",borderRadius:12,padding:18,background:"var(--cg-surface,#fff)",minWidth:0};
const field:CSSProperties={display:"grid",gap:5,fontSize:13,fontWeight:600};
const control:CSSProperties={width:"100%",minHeight:42,border:"1px solid var(--cg-border)",borderRadius:8,padding:"9px 11px",font:"inherit",background:"var(--cg-surface,#fff)",color:"inherit"};
const button:CSSProperties={border:"1px solid var(--cg-border)",padding:"9px 13px",borderRadius:8,background:"var(--cg-surface,#fff)",color:"inherit",fontWeight:600,cursor:"pointer"};
const primary:CSSProperties={...button,background:"var(--cg-accent)",color:"#fff",border:0};
async function api<T>(path:string,method:"GET"|"POST"|"PATCH"="GET",payload?:Record<string,unknown>):Promise<T>{
 const r=await fetch("/api/csr/partners"+path,{method,cache:"no-store",
  headers:payload?{"Content-Type":"application/json"}:undefined,
  body:payload?JSON.stringify(payload):undefined,signal:AbortSignal.timeout(16000)});
 const v:unknown=await r.json().catch(()=>null);
 if(!r.ok||v===null)throw Object.assign(Error(v&&typeof v==="object"&&"message" in v&&typeof v.message==="string"?v.message:"CSR result could not be confirmed."),{status:r.status||503});
 return v as T;
}
export function CsrPartnersWorkspace({canManage}:{canManage:boolean}){
 const [data,setData]=useState<Page>({items:[],hasMore:false}),[choices,setChoices]=useState<Options|null>(null);
 const [search,setSearch]=useState(""),[branchFilter,setBranchFilter]=useState("ALL"),[offset,setOffset]=useState(0),[epoch,setEpoch]=useState(0);
 const [loading,setLoading]=useState(true),[message,setMessage]=useState(""),[error,setError]=useState("");
 const [draft,setDraft]=useState<Draft>(empty),[selected,setSelected]=useState<Partner|null>(null);
 const [editing,setEditing]=useState(false),[busy,setBusy]=useState(false),[pending,setPending]=useState<Command|null>(null);
 const seq=useRef(0);
 const refresh=useCallback(()=>setEpoch(n=>n+1),[]);
 useEffect(()=>{
  let live=true;const n=++seq.current;setLoading(true);
  const params=new URLSearchParams({offset:String(offset)});
  if(search.trim())params.set("q",search.trim().slice(0,80));
  if(branchFilter!=="ALL")params.set("branchRef",branchFilter);
  void api<Page>("?"+params.toString()).then(v=>{if(live&&n===seq.current){setData(v);setError("");}})
   .catch(e=>{if(live&&n===seq.current){setData({items:[],hasMore:false});setError(e instanceof Error?e.message:"CSR records unavailable.");}})
   .finally(()=>{if(live&&n===seq.current)setLoading(false);});
  return()=>{live=false;};
 },[offset,search,branchFilter,epoch]);
 useEffect(()=>{
  let live=true;void api<Options>("/options").then(v=>{if(live)setChoices(v);}).catch(()=>{if(live)setError("Current CSR branch choices cannot be confirmed.");});
  return()=>{live=false;};
 },[epoch]);
 const begin=()=>{if(pending)return;setSelected(null);setDraft({...empty(),branchRef:choices?.foundation?"":choices?.branches[0]?.value??""});setEditing(true);setMessage("");setError("");};
 const choose=async(item:Partner)=>{
  if(pending)return;
  setError("");try{const full=await api<Partner>("/"+item.ref);setSelected(full);setDraft(from(full));setEditing(true);}
  catch(e){setError(e instanceof Error?e.message:"This CSR record is unavailable.");}
 };
 const send=async(cmd:Command)=>{
  setBusy(true);setPending(cmd);setError("");
  try{await api<{ref:string;version:number}>(cmd.path,cmd.method,cmd.body);
   setPending(null);setEditing(false);setSelected(null);setDraft(empty());setMessage("CSR draft saved. It is not approved or publicly listed.");setOffset(0);refresh();}
  catch(e){
   const code=e&&typeof e==="object"&&"status" in e?Number(e.status):503;
   if(code>=500||code===0){setError("The result is uncertain. Refresh the list to check it, or retry the exact original request.");}
   else{setPending(null);setError(e instanceof Error?e.message:"CSR draft could not be saved.");}
  }finally{setBusy(false);}
 };
 const submit=(e:FormEvent)=>{e.preventDefault();if(!canManage||busy||pending)return;
  const body:Record<string,unknown>={requestKey:crypto.randomUUID(),branchRef:draft.branchRef||null,
   legalName:draft.legalName.trim(),registrationReference:draft.registrationReference.trim()||null,
   contactName:draft.contactName.trim(),contactEmail:draft.contactEmail.trim()||null,
   contactMobile:draft.contactMobile.trim()||null,supportSummary:draft.supportSummary.trim()};
  if(selected)body.expectedVersion=selected.version;
  void send({path:selected?"/"+selected.ref:"",method:selected?"PATCH":"POST",body});
 };
 const cancel=()=>{if(pending||busy)return;setEditing(false);setSelected(null);setDraft(empty());};
 const archive=()=>{if(!selected||!canManage||busy||pending||!confirm("Discard this CSR draft? This cannot be undone."))return;
  void send({path:"/"+selected.ref+"/cancel",method:"POST",body:{requestKey:crypto.randomUUID(),expectedVersion:selected.version}});
 };
 const set=(key:keyof Draft,value:string)=>setDraft(d=>({...d,[key]:value}));
 return <div style={{display:"grid",gap:16,maxWidth:1300}}>
  <header><h1>CSR & Partnerships</h1><p style={{color:"var(--cg-muted)"}}>Register and maintain corporate partnership drafts. Approval, documents and financial commitments are separate verified steps.</p></header>
  {message&&<p role="status" style={{color:"#166534"}}>{message}</p>}
  {error&&<p role="alert" style={{color:"#b91c1c"}}>{error}</p>}
  <section style={panel} aria-label="CSR partner directory">
   <div style={{display:"flex",gap:12,alignItems:"end",flexWrap:"wrap",justifyContent:"space-between"}}>
    <label style={{...field,flex:"1 1 190px"}}>Search organizations<input style={control} value={search} maxLength={80} placeholder="Registered organization" onChange={e=>{setOffset(0);setSearch(e.target.value);}}/></label>
    <label style={{...field,flex:"1 1 180px"}}>Branch
     <select style={control} value={branchFilter} onChange={e=>{setOffset(0);setBranchFilter(e.target.value);}}>
      <option value="ALL">All permitted branches</option>
      {choices?.foundation&&<option value="FOUNDATION">Foundation-wide</option>}
      {choices?.branches.map(b=><option key={b.value} value={b.value}>{b.label}</option>)}
     </select>
    </label>
    <button style={button} type="button" onClick={refresh}>Refresh</button>
    {canManage&&<button style={primary} type="button" disabled={!!pending} onClick={begin}>New CSR partner</button>}
   </div>
   {loading?<p role="status">Loading authorized records…</p>:data.items.length===0?<p>No matching CSR partner drafts.</p>:
    <div style={{overflowX:"auto",marginTop:16}}><table style={{width:"100%",borderCollapse:"collapse",textAlign:"left",fontSize:14}}>
     <thead><tr>{["Organization","Branch","Draft status","Last updated","Action"].map(v=><th key={v} style={{padding:10,borderBottom:"1px solid var(--cg-border)"}}>{v}</th>)}</tr></thead>
     <tbody>{data.items.map(p=><tr key={p.ref}>
      <td style={{padding:10,borderBottom:"1px solid var(--cg-border)"}}>{p.legalName}</td>
      <td style={{padding:10,borderBottom:"1px solid var(--cg-border)"}}>{p.branch??"Foundation"}</td>
      <td style={{padding:10,borderBottom:"1px solid var(--cg-border)"}}>{p.status}</td>
      <td style={{padding:10,borderBottom:"1px solid var(--cg-border)"}}>{new Date(p.updatedAt).toLocaleDateString("en-IN")}</td>
      <td style={{padding:10,borderBottom:"1px solid var(--cg-border)"}}>{canManage&&["DRAFT","RETURNED"].includes(p.status)?
       <button style={button} disabled={!!pending} type="button" onClick={()=>void choose(p)}>Edit</button>:"Read only"}</td>
     </tr>)}</tbody>
    </table></div>}
   <div style={{display:"flex",justifyContent:"end",alignItems:"center",gap:10,marginTop:12}}>
    <button style={button} type="button" disabled={offset===0||loading} onClick={()=>setOffset(n=>Math.max(0,n-25))}>Previous</button>
    <span>Page {Math.floor(offset/25)+1}</span>
    <button style={button} type="button" disabled={!data.hasMore||loading} onClick={()=>setOffset(n=>n+25)}>Next</button>
   </div>
  </section>
  {editing&&<section style={panel} aria-label="CSR partner draft editor">
   <h2>{selected?"Edit CSR partner draft":"New CSR partner draft"}</h2>
   <p style={{color:"var(--cg-muted)"}}>Draft only. This screen does not verify registration, accept agreements or publish partnership claims.</p>
   <form onSubmit={submit} style={{display:"grid",gap:14}}>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:12}}>
     <label style={field}>Foundation branch
      <select style={control} value={draft.branchRef} disabled={!!selected||busy||!!pending} onChange={e=>set("branchRef",e.target.value)} required={!choices?.foundation}>
       {choices?.foundation&&<option value="">Foundation-wide</option>}
       {!choices?.foundation&&<option value="">Select assigned branch</option>}
       {choices?.branches.map(b=><option key={b.value} value={b.value}>{b.label}</option>)}
      </select>
     </label>
     <label style={field}>Registered organization name<input style={control} required minLength={2} maxLength={200} value={draft.legalName} onChange={e=>set("legalName",e.target.value)} /></label>
     <label style={field}>Registration reference (if available)<input style={control} maxLength={100} value={draft.registrationReference} onChange={e=>set("registrationReference",e.target.value)} /></label>
     <label style={field}>Contact name<input style={control} required minLength={2} maxLength={160} value={draft.contactName} onChange={e=>set("contactName",e.target.value)} /></label>
     <label style={field}>Contact email<input style={control} type="email" maxLength={254} value={draft.contactEmail} onChange={e=>set("contactEmail",e.target.value)} /></label>
     <label style={field}>Contact mobile (India, +91…)<input style={control} type="tel" maxLength={13} placeholder="+919876543210" value={draft.contactMobile} onChange={e=>set("contactMobile",e.target.value)} /></label>
    </div>
    <label style={field}>Proposed CSR support<textarea style={{...control,minHeight:90}} required minLength={5} maxLength={1000} value={draft.supportSummary} onChange={e=>set("supportSummary",e.target.value)}/></label>
    <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
     <button type="submit" style={primary} disabled={!canManage||busy||!!pending}>{busy?"Saving…":"Save draft"}</button>
     <button type="button" style={button} disabled={busy||!!pending} onClick={cancel}>Close</button>
     {selected&&canManage&&<button type="button" style={button} disabled={busy||!!pending} onClick={archive}>Discard draft</button>}
    </div>
   </form>
  </section>}
  {pending&&<section style={panel} role="status">
   <p>The last write may have succeeded. Do not start a different request before checking the current directory.</p>
   <button type="button" style={button} disabled={busy} onClick={()=>void send(pending)}>Retry exact request</button>
   <button type="button" style={{...button,marginLeft:10}} disabled={busy} onClick={refresh}>Check directory</button>
  </section>}
 </div>;
}
