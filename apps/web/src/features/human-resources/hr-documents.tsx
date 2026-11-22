"use client";
import {useCallback,useEffect,useRef,useState} from "react";
type Mode="own"|"manage"|"review";
type Template={templateId:string;kind:string;version:number;title:string;body:string};
type Subject={reference:string;label:string;designation:string;branch:string};
type Snapshot={recipient:string;designation:string;branch:string;department?:string|null;hireDate:string;issueDate:string;expiryDate?:string|null;lastWorkingDate?:string|null;templateVersion:number};
type DocumentStatus={documentRef:string;status:string;issueRevision:number;canDownload:boolean;canRetry:boolean;receiptStatus:string;dispatch:{channel:string;status:string}[]};
type Row={reference:string;caseRef?:string;kind:string;status:string;revision:number;recipient?:string;snapshot?:Snapshot;document?:DocumentStatus|null;canSubmit?:boolean;canReview?:boolean};
const kinds=["APPOINTMENT","OFFER","JOINING","EXPERIENCE","RELIEVING","MEMO","EMPLOYEE_ID"];
const title=(s:string)=>({EMPLOYEE_ID:"Employee ID card",SENT_TO_PROVIDER:"Accepted by provider, delivery pending",IN_APP:"Available in app",UNKNOWN_PROVIDER:"Provider outcome uncertain"} as Record<string,string>)[s]??s.toLowerCase().replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase());
const known=(e:unknown)=>!!e&&typeof e==="object"&&"status" in e&&typeof e.status==="number"&&e.status>=400&&e.status<500;
type Command={path:string;body:Record<string,unknown>;proof:boolean};

const panel={border:"1px solid #E2E8F0",borderRadius:14,padding:16,background:"#fff",display:"grid",gap:10} as const;
const field={width:"100%",border:"1px solid #CBD5E1",borderRadius:8,padding:10,boxSizing:"border-box"} as const;
async function api<T>(path:string,body?:object):Promise<T>{
 const r=await fetch("/api/hr/"+path,{cache:"no-store",credentials:"same-origin",...(body?{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})});
 const v=await r.json().catch(()=>null);if(!r.ok)throw Object.assign(new Error(typeof v?.message==="string"?v.message:"Document unavailable"),{status:r.status});if(!v||typeof v!=="object")throw Error("Original result unconfirmed");return v as T;
}
function Select({label,value,options,onChange,disabled=false}:{label:string;value:string;options:{value:string;label:string}[];onChange:(v:string)=>void;disabled?:boolean}){return <label>{label}<select style={field} value={value} disabled={disabled} onChange={e=>onChange(e.target.value)}>{options.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></label>;}
export function HrDocuments({mode,canIssue=false,canApproveTemplate=false,canRevoke=false}:{mode:Mode;canIssue?:boolean;canApproveTemplate?:boolean;canRevoke?:boolean}){

 const route=mode==="own"?"me/documents":mode==="manage"?"document-requests":"document-reviews";
 const [rows,setRows]=useState<Row[]>([]),[templates,setTemplates]=useState<Template[]>([]),[people,setPeople]=useState<Subject[]>([]);
 const [kind,setKind]=useState("APPOINTMENT"),[search,setSearch]=useState(""),[subject,setSubject]=useState(""),[template,setTemplate]=useState("");
 const [issueDate,setIssueDate]=useState(""),[expiry,setExpiry]=useState(""),[heading,setHeading]=useState(""),[terms,setTerms]=useState(""),[password,setPassword]=useState("");
 const [selected,setSelected]=useState<Row|null>(null),[offset,setOffset]=useState(0),[more,setMore]=useState(false),[filter,setFilter]=useState("ALL");
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[locked,setLocked]=useState(false),[message,setMessage]=useState("");
 const pending=useRef<Command|null>(null),running=useRef(false),generation=useRef(0),personRead=useRef(0);
 const request=useCallback(<T,>(p:string,v?:object)=>api<T>(p,v),[]);
 const fail=useCallback((e:unknown)=>{setMessage(e instanceof Error?e.message:"Original outcome unconfirmed");},[]);
 const refresh=useCallback(async()=>{const g=++generation.current;setRows([]);setLoading(true);
  try{const v=await request<{items:Row[];hasMore:boolean}>(route+"?offset="+offset);if(!Array.isArray(v.items))throw Error("Document history unavailable");if(g===generation.current){setRows(v.items);setMore(v.hasMore===true);}}
  catch(e){if(g===generation.current)fail(e);}finally{if(g===generation.current)setLoading(false);}
 },[route,offset,request,fail]);
 useEffect(()=>{void refresh();return()=>{generation.current++;};},[refresh]);
 const loadTemplates=useCallback(async()=>{if(mode!=="manage")return;try{const v=await request<{items:Template[]}>("document-templates");setTemplates(v.items);}catch(e){fail(e);}},[mode,request,fail]);
 useEffect(()=>{void loadTemplates();},[loadTemplates]);
 const loadPeople=useCallback(async(k:string,q:string)=>{if(mode!=="manage")return;const g=++personRead.current;setPeople([]);
  try{const v=await request<{items:Subject[]}>("document-subjects?kind="+encodeURIComponent(k)+"&search="+encodeURIComponent(q));if(g===personRead.current)setPeople(v.items);}catch(e){if(g===personRead.current)fail(e);}
 },[mode,request,fail]);
 useEffect(()=>{void loadPeople(kind,"");return()=>{personRead.current++;};},[kind,loadPeople]);
 const current=templates.find(x=>x.kind===kind),chosen=templates.find(x=>x.templateId===template&&x.kind===kind),person=people.find(x=>x.reference===subject);
 const changeKind=(v:string)=>{setKind(v);setSubject("");setTemplate("");setPeople([]);setSearch("");setHeading("");setTerms("");setExpiry("");};
 const run=async(path?:string,body?:Record<string,unknown>,proof=false)=>{
  if(running.current)return;let cmd=pending.current;
  if(!cmd){if(!path||!body)return;if(proof&&password.length<8){setMessage("Confirm current password.");return;}cmd={path,body,proof};pending.current=cmd;}
  if(cmd.proof&&password.length<8){setMessage("Confirm current password.");return;}
  running.current=true;setBusy(true);setMessage("");
  try{const v=await request<Record<string,unknown>>(cmd.path,{...cmd.body,...(cmd.proof?{currentPassword:password}:{})});
   if(!v.reference&&!v.status&&!v.documentRef&&!v.confirmed)throw Error("Original outcome unconfirmed");
   pending.current=null;setLocked(false);setPassword("");setSelected(null);await refresh();await loadTemplates();setMessage("Recorded outcome: "+title(String(v.status??"Confirmed")));
  }catch(e){fail(e);setPassword("");if(known(e)){pending.current=null;setLocked(false);}else setLocked(true);}
  finally{running.current=false;setBusy(false);}
 };
 const save=()=>{if(!person||!chosen||!issueDate||(kind==="EMPLOYEE_ID"&&!expiry)){setMessage("Choose recipient, approved template and dates.");return;}
  void run("document-requests",{requestKey:crypto.randomUUID(),kind,subjectReference:subject,templateId:chosen.templateId,templateVersion:chosen.version,issueDate,...(kind==="EMPLOYEE_ID"?{expiryDate:expiry}:{})});};
 const approveTemplate=()=>void run("document-templates/approve",{kind,title:heading,body:terms,expectedVersion:current?.version??0,requestKey:crypto.randomUUID()},true);
 const open=async(x:Row)=>{if(mode!=="review"){setSelected(x);return;}if(!x.caseRef||running.current||locked)return;running.current=true;setBusy(true);setSelected(null);
  try{setSelected(await request<Row>(route+"/"+x.caseRef));}catch(e){fail(e);}finally{running.current=false;setBusy(false);}};
 const blocked=busy||locked,visible=rows.filter(x=>filter==="ALL"||(x.document?.status??x.status)===filter);
 const act=(path:string,proof=false,body:Record<string,unknown>={})=>void run(path,body,proof);
 const key=()=>crypto.randomUUID();
 
 return <section style={panel}><h2>{mode==="own"?"My documents & ID":mode==="manage"?"Employee letters, memos & ID cards":"Employee document approvals"}</h2>
  <button disabled={blocked||loading} onClick={()=>{setSelected(null);void refresh();}}>Refresh</button>
  {message&&<p role="status">{message}</p>}
  {mode==="manage"&&<fieldset style={panel} disabled={blocked}><legend>New document</legend>
   <Select label="Document type" value={kind} options={kinds.map(k=>({value:k,label:title(k)}))} onChange={changeKind}/>
   <label>Search eligible recipient<input style={field} value={search} maxLength={80} onChange={e=>setSearch(e.target.value)}/></label><button onClick={()=>void loadPeople(kind,search)}>Search</button>
   <Select label="Recipient" value={subject} options={[{value:"",label:"Choose recipient"},...people.map(x=>({value:x.reference,label:x.label+" · "+x.designation+" · "+x.branch}))]} onChange={setSubject}/>
   <Select label="Approved template" value={template} options={[{value:"",label:"Choose template"},...templates.filter(x=>x.kind===kind).map(x=>({value:x.templateId,label:x.title+" · Version "+x.version}))]} onChange={setTemplate}/>
   {!current&&<p>No approved template for this document.</p>}
   <label>Issue date<input style={field} type="date" value={issueDate} onChange={e=>setIssueDate(e.target.value)}/></label>{kind==="EMPLOYEE_ID"&&<label>Expiry date<input style={field} type="date" value={expiry} onChange={e=>setExpiry(e.target.value)}/></label>}
   {person&&chosen&&<article style={{...panel,maxWidth:480}}><strong>CareGanga Foundation · Draft preview</strong><h3>{chosen.title}</h3><p>{person.label} · {person.designation} · {person.branch}</p><p>{issueDate||"No date selected"}</p><p style={{whiteSpace:"pre-wrap"}}>{chosen.body}</p>{kind==="EMPLOYEE_ID"&&<p>Expiry {expiry}; back verification code available only after issue.</p>}<small>Preview only, not an issued PDF.</small></article>}
   <button disabled={!person||!chosen||!issueDate||(kind==="EMPLOYEE_ID"&&!expiry)} onClick={save}>Save draft</button>
  </fieldset>}
  {mode==="manage"&&canApproveTemplate&&<fieldset style={panel} disabled={blocked}><legend>Approve template — {title(kind)}</legend><p>Current version: {current?.version??0}</p>{current&&<button onClick={()=>{setHeading(current.title);setTerms(current.body);}}>Load current template</button>}
   <label>Heading<input style={field} maxLength={100} value={heading} onChange={e=>setHeading(e.target.value)}/></label><label>Terms<textarea style={field} maxLength={1200} rows={4} value={terms} onChange={e=>setTerms(e.target.value)}/></label><label>Current password<input type="password" autoComplete="current-password" style={field} value={password} onChange={e=>setPassword(e.target.value)}/></label><button disabled={heading.trim().length<10||terms.trim().length<20||password.length<8} onClick={approveTemplate}>Approve version</button></fieldset>}
  <Select label="Filter current page" value={filter} options={["ALL","DRAFT","SUBMITTED","APPROVED","PENDING","ISSUED","REVOKED","UNKNOWN","RETURNED","REJECTED"].map(s=>({value:s,label:title(s)}))} onChange={setFilter} disabled={blocked}/>
  {loading?<p>Loading documents…</p>:!visible.length&&<p>No documents in this view.</p>}
  {visible.map(x=><article key={x.reference} style={{borderTop:"1px solid #E2E8F0",paddingTop:10}}><strong>{title(x.kind)} · {x.snapshot?.recipient??x.recipient}</strong><p>{x.reference} · {title(x.document?.status??x.status)}</p><button disabled={blocked} onClick={()=>void open(x)}>View details</button></article>)}
  {offset>0&&<button disabled={blocked} onClick={()=>{setSelected(null);setOffset(v=>Math.max(0,v-25));}}>Previous</button>}{more&&<button disabled={blocked} onClick={()=>{setSelected(null);setOffset(v=>v+25);}}>Next</button>}
  {selected&&<article style={panel}><h3>{title(selected.kind)} · {selected.reference}</h3><p>{title(selected.status)}</p>
   {selected.snapshot&&<><p>{selected.snapshot.recipient} · {selected.snapshot.designation} · {selected.snapshot.branch}</p><p>Joining: {selected.snapshot.hireDate} · Issue: {selected.snapshot.issueDate}</p>{selected.snapshot.expiryDate&&<p>Expiry: {selected.snapshot.expiryDate}</p>}{selected.snapshot.lastWorkingDate&&<p>Last working date: {selected.snapshot.lastWorkingDate}</p>}</>}
   {mode==="manage"&&selected.canSubmit&&<button disabled={blocked} onClick={()=>act("document-requests/"+selected.reference+"/submit",false,{requestKey:key(),expectedRevision:selected.revision})}>Submit for review</button>}
   {mode==="review"&&selected.canReview&&<><label>Current password<input style={field} type="password" value={password} onChange={e=>setPassword(e.target.value)}/></label>{["APPROVE","RETURN","REJECT"].map(action=><button key={action} disabled={blocked||password.length<8} onClick={()=>act("document-reviews/"+selected.caseRef+"/decide",true,{requestKey:key(),expectedRevision:selected.revision,action})}>{title(action)}</button>)}</>}
   {selected.document&&<><p>File: {title(selected.document.status)} · Version {selected.document.issueRevision}</p><p>Receipt: {title(selected.document.receiptStatus)}</p>{selected.document.dispatch.map(x=><p key={x.channel}>{title(x.channel)}: {title(x.status)}</p>)}
    {selected.document.canDownload&&!blocked&&<a href={"/api/hr/"+(mode==="own"?"me/documents/":"issued-documents/")+selected.document.documentRef+"/file"}>Download verified PDF</a>}
    {mode==="own"&&selected.document.canDownload&&selected.document.receiptStatus!=="ACKNOWLEDGED"&&<button disabled={blocked} onClick={()=>act("me/documents/"+selected.document!.documentRef+"/acknowledge")}>Acknowledge receipt</button>}
    {mode==="manage"&&canIssue&&selected.document.canRetry&&<button disabled={blocked} onClick={()=>act("issued-documents/"+selected.document!.documentRef+"/reconcile")}>Check original issuance</button>}
    {mode==="manage"&&canIssue&&selected.document.canDownload&&["IN_APP","EMAIL","SMS"].map(channel=><button key={channel} disabled={blocked||selected.document!.dispatch.some(x=>x.channel===channel)} onClick={()=>act("issued-documents/"+selected.document!.documentRef+"/dispatch",false,{channel})}>Dispatch {title(channel)}</button>)}
    {mode==="manage"&&canRevoke&&selected.document.canDownload&&<><label>Current password<input style={field} type="password" value={password} onChange={e=>setPassword(e.target.value)}/></label><button disabled={blocked||password.length<8} onClick={()=>act("issued-documents/"+selected.document!.documentRef+"/revoke",true)}>Revoke</button></>}</>}
   {mode==="manage"&&canIssue&&selected.status==="APPROVED"&&(!selected.document||["REVOKED","FAILED"].includes(selected.document.status))&&<><label>Current password<input style={field} type="password" value={password} onChange={e=>setPassword(e.target.value)}/></label><button disabled={blocked||password.length<8} onClick={()=>act("document-requests/"+selected.reference+"/issue",true,{requestKey:key()})}>{selected.document?"Reissue":"Issue approved document"}</button></>}
  </article>}
  {locked&&<div role="alert"><p>Original outcome uncertain. Retry the same command.</p>{pending.current?.proof&&<input aria-label="Current password" type="password" style={field} value={password} onChange={e=>setPassword(e.target.value)}/>}<button disabled={busy||!!pending.current?.proof&&password.length<8} onClick={()=>void run()}>Retry original command</button></div>}
 </section>;
}
