"use client";
import {useEffect,useRef,useState,type CSSProperties,type FormEvent} from "react";

type Item={ref:string;reference:string;name:string;contactMobile:string|null;representativeName:string|null;
 representativeContact:string|null;branchRef:string|null;stateRef:string;districtRef:string|null;
 beneficiaryType:string;gender:string;ageGroup:string;consentKind:string;consentPurpose:string|null;
 consentRevoked:boolean;verification:string;lifecycle:string;revision:number;createdAt:string;
 projectLinks?:{ref:string;projectRef:string;projectName:string}[]};
type Page={items:Item[];hasMore:boolean;nextCursor:string|null};
type ActionHistory={action:string;revision:number;reason:string|null;at:string};
type VerificationHistory={decision:string;sourceRevision:number;at:string};
type Option={value:string;label:string};
type Options={canManageFoundation:boolean;branches:Option[];states:Option[];districts:Option[]};
type Form={branchRef:string;name:string;contactMobile:string;representativeName:string;representativeContact:string;
 stateRef:string;districtRef:string;beneficiaryType:string;gender:string;ageGroup:string;
 consentKind:string;consentPurpose:string;consentAcknowledged:boolean};
const empty=():Form=>({branchRef:"",name:"",contactMobile:"",representativeName:"",representativeContact:"",
 stateRef:"",districtRef:"",beneficiaryType:"",gender:"NOT_SPECIFIED",ageGroup:"NOT_SPECIFIED",
 consentKind:"SELF",consentPurpose:"Foundation beneficiary assistance",consentAcknowledged:false});
const card:CSSProperties={background:"var(--cg-surface,#fff)",border:"1px solid var(--cg-border)",borderRadius:12,padding:16};
const field:CSSProperties={display:"grid",gap:5,fontSize:13};
const input:CSSProperties={padding:"10px 12px",border:"1px solid var(--cg-border)",borderRadius:8,width:"100%",minWidth:0,font:"inherit"};
const primary:CSSProperties={padding:"10px 15px",borderRadius:8,border:0,color:"#fff",background:"var(--cg-accent,#2563eb)",cursor:"pointer",fontWeight:650};
const secondary:CSSProperties={padding:"10px 14px",borderRadius:8,border:"1px solid var(--cg-border)",background:"var(--cg-surface,#fff)",cursor:"pointer"};
const nice=(s:string)=>s.toLowerCase().replaceAll("_"," ").replace(/^./,x=>x.toUpperCase());
async function api<T>(p:string,method="GET",body?:Record<string,unknown>):Promise<T>{
 const r=await fetch("/api/beneficiaries"+p,{method,cache:"no-store",
  ...(body?{headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})});
 const v=await r.json().catch(()=>null);
 if(!r.ok||v===null)throw Object.assign(Error(v?.message??"Beneficiary information unavailable"),{status:r.status||503});
 return v as T;
}
function fromItem(x:Item):Form{
 return {branchRef:x.branchRef??"",name:x.name,contactMobile:x.contactMobile??"",
  representativeName:x.representativeName??"",representativeContact:x.representativeContact??"",
  stateRef:x.stateRef,districtRef:x.districtRef??"",beneficiaryType:x.beneficiaryType,
  gender:x.gender,ageGroup:x.ageGroup,consentKind:x.consentKind,
  consentPurpose:x.consentPurpose??"",consentAcknowledged:true};
}
const tabs=[["ALL","All"],["ACTIVE","Active"],["INACTIVE","Inactive"],["VERIFIED","Verified"],["PENDING","Pending verification"]] as const;
export function BeneficiariesWorkspace({canManage,canLinkProjects,canManageLifecycle,canRevoke}:{
 canManage:boolean;canLinkProjects:boolean;canManageLifecycle:boolean;canRevoke:boolean;
}){
 const [page,setPage]=useState<Page|null>(null),[busyList,setBusyList]=useState(true),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [q,setQ]=useState(""),[search,setSearch]=useState(""),[tab,setTab]=useState("ALL"),
  [branch,setBranch]=useState(""),[cursor,setCursor]=useState(""),[seen,setSeen]=useState<string[]>([]);
 const [epoch,setEpoch]=useState(0),[selected,setSelected]=useState<Item|null>(null),[detailLoading,setDetailLoading]=useState(false);
 const [opts,setOpts]=useState<Options|null>(null),[districts,setDistricts]=useState<Option[]>([]),
  [form,setForm]=useState<Form>(empty),[mode,setMode]=useState<"create"|"edit"|null>(null),
  [requestKey,setRequestKey]=useState(""),[saving,setSaving]=useState(false),[formError,setFormError]=useState("");
 const [projects,setProjects]=useState<Option[]>([]),[projectRef,setProjectRef]=useState(""),
  [linkKey,setLinkKey]=useState(""),[linking,setLinking]=useState(false);
 const [reason,setReason]=useState(""),[acting,setActing]=useState(false);
 const [actionHistory,setActionHistory]=useState<ActionHistory[]>([]),[verificationHistory,setVerificationHistory]=useState<VerificationHistory[]>([]);
 const seq=useRef(0),drawer=useRef<HTMLElement|null>(null),focus=useRef<HTMLElement|null>(null);
 const update=(k:keyof Form,v:string|boolean)=>setForm(x=>({...x,[k]:v}));
 useEffect(()=>{let live=true;void api<Options>("/options").then(v=>{if(live)setOpts(v);}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[]);
 useEffect(()=>{const id=++seq.current;setBusyList(true);setError("");
  const params=new URLSearchParams();if(search)params.set("q",search);if(branch)params.set("branchRef",branch);
  if(tab==="ACTIVE"||tab==="INACTIVE")params.set("lifecycle",tab);
  if(tab==="VERIFIED")params.set("verification","VERIFIED");
  if(tab==="PENDING")params.set("verification","PENDING");
  if(cursor)params.set("cursor",cursor);
  void api<Page>("?"+params).then(v=>{if(seq.current===id)setPage(v);})
   .catch(e=>{if(seq.current===id){setPage(null);setError(e.message);}})
   .finally(()=>{if(seq.current===id)setBusyList(false);});
  return()=>{seq.current++;};
 },[search,tab,branch,cursor,epoch]);
 useEffect(()=>{let live=true;setDistricts([]);if(!form.stateRef)return;
  void api<Options>("/options?"+new URLSearchParams({stateRef:form.stateRef}))
   .then(v=>{if(live)setDistricts(v.districts);}).catch(e=>{if(live)setFormError(e.message);});
  return()=>{live=false;};
 },[form.stateRef]);
 useEffect(()=>{if(!mode||!drawer.current)return;const previous=document.activeElement;
  focus.current=previous instanceof HTMLElement?previous:null;drawer.current.focus();
  return()=>{if(focus.current?.isConnected)focus.current.focus();};
 },[mode]);
 useEffect(()=>{if(!selected||!canLinkProjects){setProjects([]);return;}
  let live=true;
  const params=new URLSearchParams({branchRef:selected.branchRef??""});
  void api<Option[]>("/eligible-projects?"+params).then(v=>{if(live)setProjects(v);})
   .catch(()=>{if(live)setProjects([]);});
  return()=>{live=false;};
 },[selected?.ref,selected?.branchRef,canLinkProjects,epoch]);
 const refresh=()=>{setEpoch(x=>x+1);};
 const open= (kind:"create"|"edit")=>{
  setMode(kind);setFormError("");setNotice("");setRequestKey(crypto.randomUUID());
  setForm(kind==="edit"&&selected?fromItem(selected):{...empty(),branchRef:opts&&!opts.canManageFoundation?opts.branches[0]?.value??"":""});
 };
 const choose=async(id:string)=>{
  setDetailLoading(true);setSelected(null);setNotice("");
  try{
    const [detail,actions,verification]=await Promise.all([
     api<Item>("/"+id),
     api<{items:ActionHistory[]}>("/"+id+"/history"),
     api<{items:VerificationHistory[]}>("/"+id+"/verification-history")
    ]);
    setSelected(detail);setActionHistory(actions.items);setVerificationHistory(verification.items);
    setProjectRef("");setLinkKey(crypto.randomUUID());
   }
  catch(e){setError(e instanceof Error?e.message:"Beneficiary unavailable");}
  finally{setDetailLoading(false);}
 };
 const save=async(e:FormEvent)=>{
  e.preventDefault();if(!canManage||saving)return;setSaving(true);setFormError("");
  if(!form.consentAcknowledged){setFormError("Confirm that the person or guardian acknowledged this purpose.");setSaving(false);return;}
  const body:Record<string,unknown>={...form,requestKey,
   branchRef:form.branchRef||null,stateRef:form.stateRef,districtRef:form.districtRef||null,
   contactMobile:form.contactMobile||null,representativeName:form.representativeName||null,
   representativeContact:form.representativeContact||null};
  if(mode==="edit"){delete body.branchRef;body.expectedRevision=selected?.revision;}
  try{
   const outcome=await api<{ref:string}>(
    mode==="edit"?"/"+selected?.ref:"",mode==="edit"?"PATCH":"POST",body);
   setMode(null);refresh();await choose(outcome.ref);
   setNotice("Beneficiary intake saved. Verification remains separate and pending review.");
  }catch(e){setFormError(e instanceof Error?e.message:"Result unknown. Refresh before retrying this request.");}
  finally{setSaving(false);}
 };
 const link=async()=>{
  if(!selected||!projectRef||linking)return;setLinking(true);setFormError("");
  try{
   await api("/"+selected.ref+"/project-links","POST",
    {requestKey:linkKey,expectedRevision:selected.revision,projectRef});
   setLinkKey(crypto.randomUUID());setProjectRef("");await choose(selected.ref);refresh();
   setNotice("Eligible project linked.");
  }catch(e){setError(e instanceof Error?e.message:"Project link not confirmed. Refresh before retrying.");}
  finally{setLinking(false);}
 };
 const unlink=async(linkRef:string)=>{
  if(!selected||acting)return;setActing(true);setError("");
  try{
   await api("/"+selected.ref+"/project-links","DELETE",
    {requestKey:crypto.randomUUID(),expectedRevision:selected.revision,linkRef});
   await choose(selected.ref);refresh();setNotice("Project link ended; historical association retained.");
  }catch(e){setError(e instanceof Error?e.message:"Could not end project link");}
  finally{setActing(false);}
 };
 const changeLifecycle=async()=>{
  if(!selected||acting||reason.trim().length<3)return;setActing(true);setError("");
  try{
   await api("/"+selected.ref+"/lifecycle","PATCH",{requestKey:crypto.randomUUID(),
    expectedRevision:selected.revision,lifecycle:selected.lifecycle==="ACTIVE"?"INACTIVE":"ACTIVE",reason});
   await choose(selected.ref);refresh();setReason("");setNotice("Beneficiary lifecycle updated.");
  }catch(e){setError(e instanceof Error?e.message:"Could not confirm lifecycle change");}
  finally{setActing(false);}
 };
 const revoke=async()=>{
  if(!selected||acting||reason.trim().length<3)return;setActing(true);setError("");
  try{
   await api("/"+selected.ref+"/revoke-consent","POST",
    {requestKey:crypto.randomUUID(),expectedRevision:selected.revision,reason});
   await choose(selected.ref);refresh();setReason("");setNotice("Consent withdrawn. Contact details are restricted.");
  }catch(e){setError(e instanceof Error?e.message:"Could not confirm consent withdrawal");}
  finally{setActing(false);}
 };
 return <section aria-label="Private beneficiaries">
  <header style={{display:"flex",gap:12,alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",marginBottom:18}}>
   <div><h1 style={{marginBottom:3}}>Beneficiaries</h1><p style={{color:"var(--cg-muted)",margin:0}}>Register and manage private Foundation beneficiary profiles</p></div>
   {canManage&&<button type="button" style={primary} onClick={()=>open("create")}>Add Beneficiary</button>}
  </header>
  <div style={{...card,marginBottom:16}}>
   <strong>Beneficiary overview</strong>
   <p style={{fontSize:13,color:"var(--cg-muted)"}}>Only authorized records in your current Foundation/branch scope are shown. Verified counts and assistance totals require approved source-backed reporting.</p>
   <div style={{display:"flex",gap:7,flexWrap:"wrap"}} role="tablist" aria-label="Beneficiary status">
    {tabs.map(([key,label])=><button type="button" role="tab" aria-selected={tab===key} key={key}
     onClick={()=>{setTab(key);setCursor("");setSeen([]);}}
     style={{...secondary,borderColor:tab===key?"var(--cg-accent)":"var(--cg-border)",fontWeight:tab===key?700:400}}>
     {label}</button>)}
   </div>
  </div>
  <div style={{...card,marginBottom:16,display:"flex",gap:8,alignItems:"end",flexWrap:"wrap"}}>
   <label style={{...field,flex:"2 1 220px"}}>Advanced search (name or reference)
    <input style={input} value={q} onChange={e=>setQ(e.target.value)} maxLength={80} placeholder="Search permitted records"/></label>
   <label style={{...field,minWidth:180}}>Branch
    <select style={input} value={branch} onChange={e=>{setBranch(e.target.value);setCursor("");setSeen([]);}}>
     <option value="">Current authorized scope</option>{opts?.branches.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></label>
   <button type="button" style={primary} onClick={()=>{setSearch(q.trim());setCursor("");setSeen([]);}}>Search</button>
   <button type="button" style={secondary} onClick={()=>{setQ("");setSearch("");setBranch("");setTab("ALL");setCursor("");setSeen([]);}}>Reset</button>
  </div>
  {notice&&<p role="status" style={{color:"var(--cg-success,#166534)"}}>{notice}</p>}
  {error&&<p role="alert" style={{color:"var(--cg-danger,#b91c1c)"}}>{error}</p>}
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,330px),1fr))",gap:16,alignItems:"start"}}>
   <div style={card}>
    <h2 style={{fontSize:17,marginTop:0}}>Beneficiary records</h2>
    {busyList?<p>Loading authorized beneficiaries…</p>:!page?.items.length?<p>No matching beneficiary records in your current scope.</p>:
     <div style={{display:"grid",gap:8}}>{page.items.map(x=><button key={x.ref} type="button"
      onClick={()=>void choose(x.ref)} style={{...secondary,textAlign:"left",padding:12,
       borderColor:selected?.ref===x.ref?"var(--cg-accent)":"var(--cg-border)"}}>
      <strong>{x.name}</strong><div style={{fontSize:12,color:"var(--cg-muted)"}}>{x.reference} · {nice(x.verification)} · {nice(x.lifecycle)}</div>
      <div style={{fontSize:12}}>{x.beneficiaryType}</div></button>)}</div>}
    <div style={{display:"flex",gap:8,marginTop:14}}>
     {seen.length>0&&<button type="button" style={secondary} onClick={()=>{
      setCursor(seen[seen.length-1]);setSeen(x=>x.slice(0,-1));}}>Previous</button>}
     {page?.hasMore&&page.nextCursor&&<button type="button" style={secondary} onClick={()=>{
      setSeen(x=>[...x,cursor]);setCursor(page.nextCursor!);}}>Next</button>}
    </div>
   </div>
   <aside style={card}>
    <h2 style={{fontSize:17,marginTop:0}}>Beneficiary details &amp; verification</h2>
    {detailLoading?<p>Checking current scope…</p>:!selected?<p>Select a beneficiary to view their protected details and linked projects.</p>:
     <div style={{display:"grid",gap:9}}>
      <strong>{selected.name}</strong><small>{selected.reference} · Revision {selected.revision}</small>
      <div>Verification: <strong>{nice(selected.verification)}</strong></div>
      <div>Lifecycle: <strong>{nice(selected.lifecycle)}</strong></div>
      <div>Contact: {selected.contactMobile??"Not recorded / restricted"}</div>
      <div>Category: {selected.beneficiaryType}</div>
      <div>Consent: {selected.consentRevoked?"Withdrawn":nice(selected.consentKind)}</div>
      {selected.verification!=="VERIFIED"&&<p style={{fontSize:12,color:"var(--cg-muted)"}}>
       Independent verification requires the CG-03 reviewer workflow. This screen never self-approves.</p>}
      {canManage&&!selected.consentRevoked&&selected.lifecycle==="ACTIVE"&&
       <button type="button" style={secondary} onClick={()=>open("edit")}>Edit beneficiary</button>}
      <h3 style={{fontSize:15,marginBottom:0}}>Linked projects</h3>
      {selected.projectLinks?.length?selected.projectLinks.map(x=><div key={x.ref} style={{display:"flex",gap:8,justifyContent:"space-between",alignItems:"center"}}>
       <span>{x.projectName}</span>
       {canLinkProjects&&!selected.consentRevoked&&<button type="button" style={secondary} disabled={acting}
        onClick={()=>void unlink(x.ref)}>Unlink</button>}</div>):<p style={{color:"var(--cg-muted)"}}>No eligible project linked. A project is optional.</p>}
      {canLinkProjects&&!selected.consentRevoked&&selected.lifecycle==="ACTIVE"&&
       <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <select aria-label="Eligible active project" value={projectRef} style={{...input,flex:1}}
         onChange={e=>{setProjectRef(e.target.value);setLinkKey(crypto.randomUUID());}}>
         <option value="">Choose an eligible project</option>{projects.filter(x=>!selected.projectLinks?.some(y=>y.projectRef===x.value)).map(x=>
          <option key={x.value} value={x.value}>{x.label}</option>)}</select>
        <button type="button" style={secondary} disabled={!projectRef||linking} onClick={()=>void link()}>Link</button>
       </div>}
      <h3 style={{fontSize:15,marginBottom:0}}>Source history</h3>
       {actionHistory.length?<div style={{display:"grid",gap:6}}>
        {actionHistory.map((entry,i)=><div key={i} style={{fontSize:12,padding:8,border:"1px solid var(--cg-border)",borderRadius:6}}>
         <strong>{nice(entry.action)}</strong> · Revision {entry.revision} · {new Date(entry.at).toLocaleString("en-IN")}
         {entry.reason&&<p style={{marginBottom:0}}>{entry.reason}</p>}
        </div>)}
       </div>:<p>No action history is available.</p>}
       <h3 style={{fontSize:15,marginBottom:0}}>Verification history</h3>
       {verificationHistory.length?<div style={{display:"grid",gap:5}}>
        {verificationHistory.map((entry,i)=><div key={i} style={{fontSize:12}}>
         {nice(entry.decision)} · Revision {entry.sourceRevision} · {new Date(entry.at).toLocaleString("en-IN")}
        </div>)}</div>:<p>Not submitted for independent verification yet.</p>}
       {(canManageLifecycle||canRevoke)&&<div style={{borderTop:"1px solid var(--cg-border)",paddingTop:12,display:"grid",gap:8}}>
       <label style={field}>Reason for a status or consent change
        <input style={input} value={reason} onChange={e=>setReason(e.target.value)} maxLength={300}/></label>
       {canManageLifecycle&&<button type="button" style={secondary} disabled={acting||reason.trim().length<3}
        onClick={()=>void changeLifecycle()}>{selected.lifecycle==="ACTIVE"?"Mark inactive":"Reactivate"}</button>}
       {canRevoke&&!selected.consentRevoked&&<button type="button" style={secondary}
        disabled={acting||reason.trim().length<3} onClick={()=>void revoke()}>Record consent withdrawal</button>}
      </div>}
     </div>}
   </aside>
  </div>
  {mode&&<div role="presentation" style={{position:"fixed",inset:0,zIndex:50,background:"rgba(15,23,42,.48)",display:"flex",justifyContent:"flex-end"}}>
   <section role="dialog" aria-modal="true" aria-labelledby="beneficiary-form-title" tabIndex={-1} ref={drawer}
    style={{background:"var(--cg-surface,#fff)",width:"min(100%,530px)",height:"100%",overflowY:"auto",padding:24,boxShadow:"-6px 0 20px #0002"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
     <h2 id="beneficiary-form-title">{mode==="create"?"Add Beneficiary":"Edit Beneficiary"}</h2>
     <button type="button" style={secondary} onClick={()=>setMode(null)}>Close</button></div>
    <p style={{fontSize:13,color:"var(--cg-muted)"}}>Restricted Foundation profile, not a patient/member/employee account.</p>
    <form onSubmit={e=>void save(e)} style={{display:"grid",gap:12}}>
     {mode==="create"&&<label style={field}>Operating branch
      <select style={input} value={form.branchRef} onChange={e=>update("branchRef",e.target.value)}>
       <option value="">Foundation-wide (authorized root only)</option>{opts?.branches.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></label>}
     <label style={field}>Full name<input required style={input} value={form.name} maxLength={160}
      onChange={e=>update("name",e.target.value)}/></label>
     <label style={field}>Beneficiary type<input required style={input} value={form.beneficiaryType} maxLength={60}
      placeholder="Use the approved Foundation beneficiary category"
      onChange={e=>update("beneficiaryType",e.target.value)}/></label>
     <label style={field}>Contact (optional, with country code)
      <input style={input} inputMode="tel" value={form.contactMobile} maxLength={16}
       placeholder="+919876543210" onChange={e=>update("contactMobile",e.target.value)}/></label>
     <label style={field}>State<select required style={input} value={form.stateRef}
      onChange={e=>setForm(x=>({...x,stateRef:e.target.value,districtRef:""}))}>
      <option value="">Select a current state</option>{opts?.states.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></label>
     <label style={field}>District (optional)<select style={input} value={form.districtRef}
      onChange={e=>update("districtRef",e.target.value)}>
      <option value="">Not selected</option>{districts.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></label>
     <label style={field}>Gender (optional)
      <select style={input} value={form.gender} onChange={e=>update("gender",e.target.value)}>
       {["NOT_SPECIFIED","FEMALE","MALE","OTHER"].map(x=><option key={x} value={x}>{nice(x)}</option>)}</select></label>
     <label style={field}>Age group (optional)
      <select style={input} value={form.ageGroup} onChange={e=>update("ageGroup",e.target.value)}>
       {["NOT_SPECIFIED","CHILD","ADULT","SENIOR"].map(x=><option key={x} value={x}>{nice(x)}</option>)}</select></label>
     <label style={field}>Consent given by<select style={input} value={form.consentKind}
      onChange={e=>update("consentKind",e.target.value)}>
      {["SELF","GUARDIAN","REPRESENTATIVE"].map(x=><option key={x} value={x}>{nice(x)}</option>)}</select></label>
     {form.consentKind!=="SELF"&&<>
      <label style={field}>Guardian / representative name<input required style={input}
       value={form.representativeName} maxLength={160} onChange={e=>update("representativeName",e.target.value)}/></label>
      <label style={field}>Guardian contact (optional)<input style={input} inputMode="tel"
       value={form.representativeContact} onChange={e=>update("representativeContact",e.target.value)}/></label>
     </>}
     <label style={field}>Purpose of registration<input required style={input}
      value={form.consentPurpose} maxLength={240} onChange={e=>update("consentPurpose",e.target.value)}/></label>
     <label style={{display:"flex",gap:8,alignItems:"start",fontSize:13}}>
      <input type="checkbox" required checked={form.consentAcknowledged}
       onChange={e=>update("consentAcknowledged",e.target.checked)}/>
      I confirm that the beneficiary or authorized representative acknowledged this stated purpose.</label>
     {formError&&<p role="alert" style={{color:"var(--cg-danger,#b91c1c)"}}>{formError}</p>}
     <div style={{display:"flex",gap:10}}>
      <button type="submit" style={primary} disabled={saving}>{saving?"Saving…":"Save beneficiary"}</button>
      <button type="button" style={secondary} onClick={()=>setMode(null)}>Cancel</button>
     </div>
    </form>
   </section>
  </div>}
 </section>;
}
