"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {hrLetterBlocks,appendLetterBlock} from "../../../../../packages/design-tokens/src/hr-letter-format";
type Mode="own"|"manage"|"review";
type Template={templateId:string;kind:string;version:number;title:string;body:string;assetsReady:boolean;signatoryName?:string|null};
type Subject={reference:string;label:string;designation:string;branch:string};
type Snapshot={recipient:string;designation:string;branch:string;department?:string|null;hireDate:string;issueDate:string;expiryDate?:string|null;lastWorkingDate?:string|null;templateVersion:number};
type DocumentStatus={documentRef:string;status:string;issueRevision:number;canDownload:boolean;canRetry:boolean;receiptStatus:string;canDownloadReceipt?:boolean;dispatch:{channel:string;status:string}[]};
type Row={reference:string;caseRef?:string;kind:string;status:string;revision:number;recipient?:string;snapshot?:Snapshot;document?:DocumentStatus|null;canSubmit?:boolean;canReview?:boolean};
const kinds=["APPOINTMENT","OFFER","JOINING","EXPERIENCE","RELIEVING","MEMO","EMPLOYEE_ID"];
const title=(s:string)=>({EMPLOYEE_ID:"Employee ID card",SENT_TO_PROVIDER:"Accepted by provider, delivery pending",IN_APP:"Available in app",RECEIVED_COPY_VERIFIED:"Received copy scan-verified",UNKNOWN_PROVIDER:"Provider outcome uncertain"} as Record<string,string>)[s]??s.toLowerCase().replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase());
const known=(e:unknown)=>!!e&&typeof e==="object"&&"status" in e&&typeof e.status==="number"&&e.status>=400&&e.status<500;
type Command={path:string;body:Record<string,unknown>;proof:boolean};

const panel={border:"1px solid #E2E8F0",borderRadius:14,padding:16,background:"#fff",display:"grid",gap:10} as const;
const field={width:"100%",border:"1px solid #CBD5E1",borderRadius:8,padding:10,boxSizing:"border-box"} as const;
async function api<T>(path:string,body?:object):Promise<T>{
 const r=await fetch("/api/hr/"+path,{cache:"no-store",credentials:"same-origin",...(body?{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})});
 const v=await r.json().catch(()=>null);if(!r.ok)throw Object.assign(new Error(typeof v?.message==="string"?v.message:"Document unavailable"),{status:r.status});if(!v||typeof v!=="object")throw Error("Original result unconfirmed");return v as T;
}
function Select({label,value,options,onChange,disabled=false}:{label:string;value:string;options:{value:string;label:string}[];onChange:(v:string)=>void;disabled?:boolean}){return <label>{label}<select style={field} value={value} disabled={disabled} onChange={e=>onChange(e.target.value)}>{options.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></label>;}
function LetterBodyPreview({value}:{value:string}){
 return <div style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{hrLetterBlocks(value).map((b,i)=>b.kind==="heading"?<h4 key={i} style={{margin:"8px 0",color:"#1E53DC"}}>{b.text}</h4>:b.kind==="bullet"?<p key={i} style={{margin:"4px 0",paddingLeft:16}}>• {b.text}</p>:<p key={i} style={{margin:"4px 0",minHeight:b.text?undefined:12}}>{b.text}</p>)}</div>;
}
function ReceiptUpload({id,onVerified,disabled,assetType,onClear,staff=false}:{id?:string;onVerified:(fileRef?:string)=>void;disabled:boolean;assetType?:"SIGNATURE"|"SEAL";onClear?:()=>void;staff?:boolean}){
 const [file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const original=useRef<{key:string;hash:string;upload?:string}|null>(null);
 const upload=async()=>{
  if(!file||busy||disabled)return;
  if(!(assetType?["image/jpeg","image/png"]:["application/pdf","image/jpeg","image/png"]).includes(file.type)||file.size<1||file.size>(assetType?2097152:10485760)){setMessage(assetType?"Choose a JPEG or PNG under 2 MB.":"Choose a PDF, JPEG or PNG under 10 MB.");return;}
  setBusy(true);setMessage("");
  try{
   const bytes=await file.arrayBuffer(),digest=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),x=>x.toString(16).padStart(2,"0")).join("");
   const cmd:{key:string;hash:string;upload?:string}=original.current?.hash===digest?original.current:{key:crypto.randomUUID(),hash:digest};original.current=cmd;
   const path=assetType?"document-templates/assets":(staff?"issued-documents/":"me/documents/")+id+"/receipt-uploads";
   if(cmd.upload){const status=await api<{cleanVerified:boolean;fileRef?:string}>(path+"/"+cmd.upload);if(status.cleanVerified&&(!assetType||status.fileRef)){onVerified(status.fileRef);setMessage("Secure file scan verified.");return;}
    const oldState=(status as {status?:string}).status;
    if(oldState==="REJECTED"||oldState==="EXPIRED"){original.current=null;setMessage("The previous secure file request ended. Choose the file again.");return;}
    const recovered=await api<{cleanVerified:boolean;fileRef?:string;status?:string}>(path+"/"+cmd.upload+"/confirm",{});
    if(recovered.cleanVerified&&(!assetType||recovered.fileRef)){onVerified(recovered.fileRef);setMessage("Secure file scan verified.");return;}
    if(recovered.status==="EXPIRED_OR_REJECTED"||recovered.status==="REJECTED"){original.current=null;setMessage("The previous secure file request ended. Choose the file again.");return;}
   }
   const grant=await api<{uploadRef:string;status:string;cleanVerified:boolean;fileRef?:string;uploadUrl?:string;uploadHeaders?:Record<string,string>}>(path,{requestKey:cmd.key,mime:file.type,sizeBytes:file.size,sha256:digest,...(assetType?{assetType}:{})});
   cmd.upload=grant.uploadRef;if(grant.cleanVerified&&(!assetType||grant.fileRef)){onVerified(grant.fileRef);setMessage("Secure file scan verified.");return;}
   if(grant.status!=="UPLOAD_READY"||!grant.uploadUrl||!grant.uploadHeaders||!grant.uploadUrl.startsWith("https://"))throw Error("Secure upload unavailable. No copy was accepted.");
   const sent=await fetch(grant.uploadUrl,{method:"PUT",body:bytes,headers:grant.uploadHeaders,credentials:"omit",cache:"no-store"});
   const checked=await api<{cleanVerified:boolean;fileRef?:string}>(path+"/"+cmd.upload+"/confirm",{});if(!checked.cleanVerified)throw Error(!sent.ok?"Transfer unconfirmed. Retry the same file.":"The original scan has not verified the received copy.");
   if(assetType&&!checked.fileRef)throw Error("Original asset reference was not confirmed.");onVerified(checked.fileRef);setMessage("Secure file scan verified.");
  }catch(e){setMessage(e&&typeof e==="object"&&"status" in e&&e.status===401?"Sign in again.":e&&typeof e==="object"&&"status" in e&&e.status===403?"Your current document permission does not allow this file.":"Secure file outcome unconfirmed. Retry the same selected file or refresh.");}finally{setBusy(false);}
 };
 return <div style={panel}><label>{assetType?title(assetType)+" image":"Upload signed received copy"}<input type="file" accept={assetType?"image/jpeg,image/png":"application/pdf,image/jpeg,image/png"} disabled={busy||disabled} onChange={e=>{setFile(e.target.files?.[0]??null);original.current=null;onClear?.();setMessage("");}}/></label>
 <button disabled={!file||busy||disabled} onClick={()=>void upload()}>{busy?"Checking private file…":assetType?"Upload and verify "+title(assetType):"Upload and verify received copy"}</button>{message&&<p role="alert">{message}</p>}</div>;
}
export function HrDocuments({mode,canIssue=false,canApproveTemplate=false,canRevoke=false}:{mode:Mode;canIssue?:boolean;canApproveTemplate?:boolean;canRevoke?:boolean}){

 const route=mode==="own"?"me/documents":mode==="manage"?"document-requests":"document-reviews";
 const [rows,setRows]=useState<Row[]>([]),[templates,setTemplates]=useState<Template[]>([]),[people,setPeople]=useState<Subject[]>([]);
 const [kind,setKind]=useState("APPOINTMENT"),[search,setSearch]=useState(""),[subject,setSubject]=useState(""),[template,setTemplate]=useState("");
 const [issueDate,setIssueDate]=useState(""),[expiry,setExpiry]=useState(""),[heading,setHeading]=useState(""),[terms,setTerms]=useState(""),[password,setPassword]=useState("");
 const [signatoryName,setSignatoryName]=useState(""),[signatureRef,setSignatureRef]=useState(""),[sealRef,setSealRef]=useState("");
 const [selected,setSelected]=useState<Row|null>(null),[offset,setOffset]=useState(0),[more,setMore]=useState(false),[filter,setFilter]=useState("ALL"),[historySearch,setHistorySearch]=useState("");
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[locked,setLocked]=useState(false),[message,setMessage]=useState("");
 const pending=useRef<Command|null>(null),running=useRef(false),generation=useRef(0),personRead=useRef(0);
 const request=useCallback(<T,>(p:string,v?:object)=>api<T>(p,v),[]);
 const fail=useCallback((e:unknown)=>{setMessage(e instanceof Error?e.message:"Original outcome unconfirmed");},[]);
 const refresh=useCallback(async()=>{const g=++generation.current;setRows([]);setSelected(null);setMore(false);setLoading(true);
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
 const current=templates.find(x=>x.kind===kind),chosen=templates.find(x=>x.templateId===template&&x.kind===kind&&x.assetsReady),person=people.find(x=>x.reference===subject);
 useEffect(()=>{if(mode==="manage"&&current?.assetsReady&&!chosen)setTemplate(current.templateId);},[mode,current,chosen]);
 const changeKind=(v:string)=>{setKind(v);setSubject("");setTemplate("");setPeople([]);setSearch("");setHeading("");setTerms("");setExpiry("");setSignatoryName("");setSignatureRef("");setSealRef("");};
 const run=async(path?:string,body?:Record<string,unknown>,proof=false)=>{
  if(running.current)return;let cmd=pending.current;
  if(!cmd){if(!path||!body)return;if(proof&&password.length<8){setMessage("Confirm current password.");return;}cmd={path,body,proof};pending.current=cmd;}
  if(cmd.proof&&password.length<8){setMessage("Confirm current password.");return;}
  running.current=true;setBusy(true);setMessage("");
  try{const v=await request<Record<string,unknown>>(cmd.path,{...cmd.body,...(cmd.proof?{currentPassword:password}:{})});
   if(!v.reference&&!v.status&&!v.documentRef&&!v.confirmed)throw Error("Original outcome unconfirmed");
   pending.current=null;setLocked(false);setPassword("");setSelected(null);await refresh();await loadTemplates();
   if(cmd.path==="document-requests"&&typeof v.reference==="string"&&v.kind===kind&&v.status==="DRAFT"&&Number.isInteger(v.revision)&&v.snapshot&&typeof v.snapshot==="object"){
    // Original server-confirmed draft: guide directly into preview/submit, with no duplicate save.
    setSelected({...v,canSubmit:true} as Row);setMessage("Draft saved. Open the private preview, then submit for review.");
   }else setMessage("Recorded outcome: "+title(String(v.status??"Confirmed")));
  }catch(e){fail(e);setPassword("");if(!locked&&known(e)){pending.current=null;setLocked(false);}else setLocked(true);}
  finally{running.current=false;setBusy(false);}
 };
 const save=()=>{if(!person||!chosen||!issueDate||(kind==="EMPLOYEE_ID"&&!expiry)){setMessage("Choose recipient, approved template and dates.");return;}
  void run("document-requests",{requestKey:crypto.randomUUID(),kind,subjectReference:subject,templateId:chosen.templateId,templateVersion:chosen.version,issueDate,...(kind==="EMPLOYEE_ID"?{expiryDate:expiry}:{})});};
 const approveTemplate=()=>void run("document-templates/approve",{kind,title:heading,body:terms,signatoryName,signatureFileRef:signatureRef,sealFileRef:sealRef,expectedVersion:current?.version??0,requestKey:crypto.randomUUID()},true);
 const open=async(x:Row)=>{if(mode!=="review"){setSelected(x);return;}if(!x.caseRef||running.current||locked)return;running.current=true;setBusy(true);setSelected(null);
  try{setSelected(await request<Row>(route+"/"+x.caseRef));}catch(e){fail(e);}finally{running.current=false;setBusy(false);}};
 const blocked=busy||locked,visible=rows.filter(x=>(filter==="ALL"||(x.document?.status??x.status)===filter||x.document?.receiptStatus===filter)&&[x.reference,title(x.kind),x.snapshot?.recipient??x.recipient??"",x.snapshot?.branch??""].join(" ").toLowerCase().includes(historySearch.trim().toLowerCase()));
 const act=(path:string,proof=false,body:Record<string,unknown>={})=>void run(path,body,proof);
 const key=()=>crypto.randomUUID();
 
 return <section style={panel}><h2>{mode==="own"?"My documents & ID":mode==="manage"?"Employee letters, memos & ID cards":"Employee document approvals"}</h2>
  <button disabled={blocked||loading} onClick={()=>{setSelected(null);void refresh();}}>Refresh</button>
  {message&&<p role="status">{message}</p>}
  {mode==="manage"&&<fieldset style={panel} disabled={blocked}><legend>New document</legend>
   <Select label="Document type" value={kind} options={kinds.map(k=>({value:k,label:title(k)}))} onChange={changeKind}/>
   <label>Search eligible recipient<input style={field} value={search} maxLength={80} onChange={e=>setSearch(e.target.value)}/></label><button onClick={()=>void loadPeople(kind,search)}>Search</button>
   <Select label="Recipient" value={subject} options={[{value:"",label:"Choose recipient"},...people.map(x=>({value:x.reference,label:x.label+" · "+x.designation+" · "+x.branch}))]} onChange={setSubject}/>
   <Select label="Approved template" value={template} options={[{value:"",label:"Choose template"},...templates.filter(x=>x.kind===kind&&x.assetsReady).map(x=>({value:x.templateId,label:x.title+" · Version "+x.version}))]} onChange={setTemplate}/>
   {!current?.assetsReady&&<p>No issue-ready template for this document. {canApproveTemplate?"Approve the template and verified signature/seal below first.":"Ask an authorized template approver to complete it."}</p>}
   <label>Issue date<input style={field} type="date" value={issueDate} onChange={e=>setIssueDate(e.target.value)}/></label>{kind==="EMPLOYEE_ID"&&<label>Expiry date<input style={field} type="date" value={expiry} onChange={e=>setExpiry(e.target.value)}/></label>}
   {person&&chosen&&<article style={{...panel,maxWidth:480}}><strong>CareGanga Foundation · Draft preview</strong><h3>{chosen.title}</h3><p>{person.label} · {person.designation} · {person.branch}</p><p>{issueDate||"No date selected"}</p><LetterBodyPreview value={chosen.body}/>{kind==="EMPLOYEE_ID"&&<p>Expiry {expiry}; back verification code available only after issue.</p>}<small>Preview only, not an issued PDF.</small></article>}
   <button disabled={!person||!chosen||!issueDate||(kind==="EMPLOYEE_ID"&&!expiry)} onClick={save}>Save draft</button>
  </fieldset>}
  {mode==="manage"&&canApproveTemplate&&<fieldset style={panel} disabled={blocked}><legend>Approve template — {title(kind)}</legend><p>Current version: {current?.version??0}</p>{current&&<button onClick={()=>{setHeading(current.title);setTerms(current.body);setSignatoryName(current.signatoryName??"");}}>Load current template</button>}
   <label>Heading<input style={field} maxLength={100} value={heading} onChange={e=>setHeading(e.target.value)}/></label><label>Letter body and terms<textarea style={field} maxLength={1200} rows={6} value={terms} onChange={e=>setTerms(e.target.value)}/></label><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button type="button" onClick={()=>setTerms(v=>appendLetterBlock(v,"heading"))}>Add heading</button><button type="button" onClick={()=>setTerms(v=>appendLetterBlock(v,"bullet"))}>Add bullet</button></div><small>Use # at the start of a heading or - at the start of a bullet. {terms.length}/1200 characters.</small><article style={panel}><strong>Draft template preview</strong><h3>{heading||"Letter heading"}</h3><LetterBodyPreview value={terms}/><small>Signature, seal and final recipient are applied only through the protected issue workflow.</small></article><label>Authorized signatory name<input style={field} maxLength={100} value={signatoryName} onChange={e=>setSignatoryName(e.target.value)}/></label>
   <p>Only use signature and seal images you are authorized to approve. No example image is accepted.</p>
   <ReceiptUpload key={kind+"-signature"} assetType="SIGNATURE" disabled={blocked} onClear={()=>setSignatureRef("")} onVerified={ref=>setSignatureRef(ref??"")}/>
   <ReceiptUpload key={kind+"-seal"} assetType="SEAL" disabled={blocked} onClear={()=>setSealRef("")} onVerified={ref=>setSealRef(ref??"")}/>
   <label>Current password<input type="password" autoComplete="current-password" style={field} value={password} onChange={e=>setPassword(e.target.value)}/></label><button disabled={heading.trim().length<10||terms.trim().length<20||signatoryName.trim().length<2||!signatureRef||!sealRef||password.length<8} onClick={approveTemplate}>Approve version</button></fieldset>}
  <label>Search current document page<input style={field} maxLength={80} value={historySearch} disabled={blocked} onChange={e=>setHistorySearch(e.target.value)}/></label>
  <Select label="Filter current page" value={filter} options={["ALL","DRAFT","SUBMITTED","APPROVED","PENDING","ISSUED","REVOKED","UNKNOWN","RETURNED","REJECTED","ACKNOWLEDGED","RECEIVED_COPY_VERIFIED"].map(s=>({value:s,label:title(s)}))} onChange={setFilter} disabled={blocked}/>
  {loading?<p>Loading documents…</p>:!visible.length&&<p>No documents in this view.</p>}
  {visible.map(x=><article key={x.reference} style={{borderTop:"1px solid #E2E8F0",paddingTop:10}}><strong>{title(x.kind)} · {x.snapshot?.recipient??x.recipient}</strong><p>{x.reference} · {title(x.document?.status??x.status)}</p><button disabled={blocked} onClick={()=>void open(x)}>View details</button></article>)}
  {offset>0&&<button disabled={blocked} onClick={()=>{setSelected(null);setOffset(v=>Math.max(0,v-25));}}>Previous</button>}{more&&<button disabled={blocked} onClick={()=>{setSelected(null);setOffset(v=>v+25);}}>Next</button>}
  {selected&&<article style={panel} ref={node=>{if(node&&selected.status==="DRAFT"&&selected.canSubmit)node.scrollIntoView({block:"nearest",behavior:"auto"});}}><h3>{title(selected.kind)} · {selected.reference}</h3><p>{title(selected.status)}</p>
   {selected.snapshot&&<><p>{selected.snapshot.recipient} · {selected.snapshot.designation} · {selected.snapshot.branch}</p><p>Joining: {selected.snapshot.hireDate} · Issue: {selected.snapshot.issueDate}</p>{selected.snapshot.expiryDate&&<p>Expiry: {selected.snapshot.expiryDate}</p>}{selected.snapshot.lastWorkingDate&&<p>Last working date: {selected.snapshot.lastWorkingDate}</p>}</>}
   {mode==="manage"&&!blocked&&["DRAFT","SUBMITTED","APPROVED"].includes(selected.status)&&<a target="_blank" rel="noopener noreferrer" href={"/api/hr/document-requests/"+selected.reference+"/preview"}>Open private watermarked draft preview</a>}
   {mode==="manage"&&selected.canSubmit&&<button disabled={blocked} onClick={()=>act("document-requests/"+selected.reference+"/submit",false,{requestKey:key(),expectedRevision:selected.revision})}>Submit for review</button>}
   {mode==="review"&&selected.canReview&&<><label>Current password<input style={field} type="password" value={password} onChange={e=>setPassword(e.target.value)}/></label>{["APPROVE","RETURN","REJECT"].map(action=><button key={action} disabled={blocked||password.length<8} onClick={()=>act("document-reviews/"+selected.caseRef+"/decide",true,{requestKey:key(),expectedRevision:selected.revision,action})}>{title(action)}</button>)}</>}
   {selected.document&&<><p>File: {title(selected.document.status)} · Version {selected.document.issueRevision}</p><p>Receipt: {title(selected.document.receiptStatus)}</p>{selected.document.dispatch.map(x=><p key={x.channel}>{title(x.channel)}: {title(x.status)}</p>)}
    {selected.document.canDownload&&!blocked&&<><a target="_blank" rel="noopener noreferrer" href={"/api/hr/"+(mode==="own"?"me/documents/":"issued-documents/")+selected.document.documentRef+"/file?view=1"}>View / print verified PDF</a><a href={"/api/hr/"+(mode==="own"?"me/documents/":"issued-documents/")+selected.document.documentRef+"/file"}>Download verified PDF</a></>}
    {selected.document.canDownloadReceipt&&!blocked&&<a href={"/api/hr/"+(mode==="own"?"me/documents/":"issued-documents/")+selected.document.documentRef+"/receipt-file"}>Download scan-verified received copy</a>}
    {mode==="own"&&selected.document.canDownload&&selected.document.receiptStatus==="AWAITING_ACKNOWLEDGEMENT"&&<button disabled={blocked} onClick={()=>act("me/documents/"+selected.document!.documentRef+"/acknowledge")}>Acknowledge receipt</button>}
    {(mode==="own"||(mode==="manage"&&canIssue))&&selected.document.canDownload&&selected.document.receiptStatus!=="RECEIVED_COPY_VERIFIED"&&<ReceiptUpload key={selected.document.documentRef} staff={mode==="manage"} id={selected.document.documentRef} disabled={blocked} onVerified={()=>{setSelected(null);setMessage("Received copy accepted after secure file and malware verification.");void refresh();}}/>}
    {mode==="manage"&&canIssue&&selected.document.canRetry&&<button disabled={blocked} onClick={()=>act("issued-documents/"+selected.document!.documentRef+"/reconcile")}>Check original issuance</button>}
    {mode==="manage"&&canIssue&&selected.document.canDownload&&["IN_APP","EMAIL","SMS"].map(channel=><button key={channel} disabled={blocked||selected.document!.dispatch.some(x=>x.channel===channel)} onClick={()=>act("issued-documents/"+selected.document!.documentRef+"/dispatch",false,{channel})}>Dispatch {title(channel)}</button>)}
    {mode==="manage"&&canRevoke&&selected.document.canDownload&&<><label>Current password<input style={field} type="password" value={password} onChange={e=>setPassword(e.target.value)}/></label><button disabled={blocked||password.length<8} onClick={()=>act("issued-documents/"+selected.document!.documentRef+"/revoke",true)}>Revoke</button></>}</>}
   {mode==="manage"&&canIssue&&selected.status==="APPROVED"&&(!selected.document||["REVOKED","FAILED"].includes(selected.document.status))&&<><label>Current password<input style={field} type="password" value={password} onChange={e=>setPassword(e.target.value)}/></label><button disabled={blocked||password.length<8} onClick={()=>act("document-requests/"+selected.reference+"/issue",true,{requestKey:key()})}>{selected.document?"Reissue":"Issue approved document"}</button></>}
  </article>}
  {locked&&<div role="alert"><p>Original outcome uncertain. Retry the same command.</p>{pending.current?.proof&&<input aria-label="Current password" type="password" style={field} value={password} onChange={e=>setPassword(e.target.value)}/>}<button disabled={busy||!!pending.current?.proof&&password.length<8} onClick={()=>void run()}>Retry original command</button></div>}
 </section>;
}
