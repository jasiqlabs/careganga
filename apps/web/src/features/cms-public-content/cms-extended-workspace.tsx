"use client";
import {useCallback,useEffect,useState} from "react";
import {CmsPublicPage,type PublicCmsPage} from "./cms-public-page";

type Kind="IMPACT"|"COMPLIANCE"|"GALLERY"|"ARTICLE"|"CONTACT"|"HEALTHCARE";
type Section={kind:string;order:number;fields:Record<string,unknown>};
type Asset={fileRef:string;version:number;role:string;altText:string;order:number};
type Draft={kind:Kind;slug:string;title:string;seoTitle:string;seoDescription:string;
 sections:Section[];assets:Asset[]};
type Item={pageRef:string;kind:string;slug:string;title:string;version:string;
 draftStatus:string;publicStatus:string|null};
type Detail={pageRef:string;kind:Kind;slug:string;version:number;revisionRef:string;
 status:string;approvalCaseRef:string|null;title:string;seoTitle:string;
 seoDescription:string;sections:Section[];assets:Asset[];
 publicationStatus:string;scheduledAt:string|null};
type Command={path:string;method:"POST"|"PUT";body:Record<string,unknown>};
const kinds:Kind[]=["IMPACT","COMPLIANCE","GALLERY","ARTICLE","CONTACT","HEALTHCARE"];
const groups=["HERO","PILLARS","STATS","GROWTH","GEOGRAPHY","BREAKDOWN",
 "FOCUS","STORIES","UPDATES","CTA"];
const today=()=>new Date().toISOString().slice(0,10);
const str=(v:unknown)=>typeof v==="string"?v:"";
const items=(v:unknown)=>Array.isArray(v)?v as Record<string,unknown>[]:[];
const pathFor=(kind:Kind,slug:string)=>kind==="COMPLIANCE"?"/80g":
 kind==="ARTICLE"?"/blog/"+slug:"/"+slug;
const slugFor=(kind:Kind)=>kind==="COMPLIANCE"?"80g":kind.toLowerCase();
const group=(key:string,i:number):Section=>({kind:"IMPACT_GROUP",order:i,
 fields:{group:key,heading:"",intro:"",source:"",asOfDate:today(),items:[]}});
function initial(kind:Kind):Draft{
 const sections:Section[]=kind==="IMPACT"?groups.map(group):
  kind==="COMPLIANCE"?[{kind:"COMPLIANCE_FACTS",order:0,fields:{
   heading:"",summary:"",issuer:"",pan:"",registrationNumber:"",
   approvalNumber:"",validFrom:"",validUntil:"",verifiedAsOf:today(),
   source:"",verification:"NOT_VERIFIED",
   disclaimer:"Check current official records before claiming a tax benefit."
  }}]:
  kind==="GALLERY"?[{kind:"GALLERY_GRID",order:0,
   fields:{heading:"",description:"",items:[]}}]:
  kind==="ARTICLE"?[{kind:"ARTICLE_BODY",order:0,fields:{
   heading:"",category:"",excerpt:"",body:"",authorLabel:"",
   source:"",asOfDate:today(),tags:[]}}]:
  kind==="CONTACT"?[{kind:"RICH_TEXT",order:0,fields:{
   heading:"Contact the Foundation",body:"",
   eyebrow:"",variant:"STANDARD",highlights:[]}}]:
  [{kind:"HEALTHCARE_CATEGORIES",order:10,fields:{
   heading:"",intro:"",categories:[]}}];
 return {kind,slug:slugFor(kind),title:"",seoTitle:"",seoDescription:"",
  sections,assets:[]};
}
function content(d:Draft){return {kind:d.kind,slug:d.slug,title:d.title,
 seoTitle:d.seoTitle||d.title,seoDescription:d.seoDescription,
 canonicalPath:pathFor(d.kind,d.slug),sections:d.sections,assets:d.assets};}
class Rejected extends Error{constructor(message:string){super(message);this.name="Rejected";}}
async function api<T>(path:string,init?:RequestInit):Promise<T>{
 const response=await fetch("/api/cms/"+path,{cache:"no-store",...init});
 if(!response.ok){
  const data:unknown=await response.json().catch(()=>null);
  const message=data&&typeof data==="object"&&"message" in data&&
   typeof data.message==="string"?data.message:
   response.status===409?"The record changed. Refresh before retrying.":
   "The website operation could not be confirmed.";
  if(response.status>=400&&response.status<500)throw new Rejected(message);
  throw Error(message);
 }
 return response.json() as Promise<T>;
}
const json=(value:object):RequestInit=>({method:"POST",headers:{"Content-Type":"application/json"},
 body:JSON.stringify(value)});
function Field({name,value,onChange,large=false,type="text"}:{
 name:string;value:unknown;onChange:(s:string)=>void;large?:boolean;type?:string}){
 const current=str(value);
 return <label>{name}{large?<textarea value={current} rows={4} onChange={e=>onChange(e.target.value)}/>:
  <input type={type} value={current} onChange={e=>onChange(e.target.value)}/>}</label>;
}
function NumberField({name,value,onChange,max}:{name:string;value:unknown;
 onChange:(n:number)=>void;max?:number}){
 return <label>{name}<input type="number" min={0} max={max} step="any"
  value={typeof value==="number"?String(value):""}
  onChange={e=>onChange(e.target.value===""?0:Number(e.target.value))}/></label>;
}
/** Reuses the ONE CG18 revision/CG03 independent approval/CG19 scanned media.
 * These are separate editorial forms for US-002–US-004, NOT a second CMS.
 */
export function CmsExtendedWorkspace({canManage,canPublish}:{
 canManage:boolean;canPublish:boolean}){
 const [kind,setKind]=useState<Kind>("IMPACT");
 const [pages,setPages]=useState<Item[]>([]);
 const [selected,setSelected]=useState<Detail|null>(null);
 const [draft,setDraft]=useState<Draft>(initial("IMPACT"));
 const [busy,setBusy]=useState(false),[preview,setPreview]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [pending,setPending]=useState<Command|null>(null);
 const [uploadRole,setUploadRole]=useState("IMPACT"),[uploadOrder,setUploadOrder]=useState(0);
 const [uploadAlt,setUploadAlt]=useState(""),[rights,setRights]=useState(false);
 const [withdrawReason,setWithdrawReason]=useState("");
 const [publishWhen,setPublishWhen]=useState("");
 const refresh=useCallback(async()=>{
  const data=await api<{pages:Item[]}>("pages");
  setPages(data.pages.filter(p=>kinds.includes(p.kind as Kind)));
 },[]);
 useEffect(()=>{void refresh().catch(e=>setError(e.message));},[refresh]);
 const open=async(p:Item)=>{
  setBusy(true);setError("");setNotice("");
  try{
   const detail=await api<Detail>("pages/"+p.pageRef);
   setSelected(detail);setKind(detail.kind);
   setDraft({kind:detail.kind,slug:detail.slug,title:detail.title,
    seoTitle:detail.seoTitle,seoDescription:detail.seoDescription,
    sections:detail.sections,assets:detail.assets});
   setPreview(false);setPending(null);
  }catch(e){setError(e instanceof Error?e.message:"Page could not be loaded.")}
  finally{setBusy(false);}
 };
 const begin=(k:Kind)=>{
  setKind(k);setSelected(null);setDraft(initial(k));setPreview(false);
  setPending(null);setError("");setNotice("");
  setUploadRole(k==="IMPACT"?"IMPACT":k==="GALLERY"?"GALLERY":
   k==="COMPLIANCE"?"DOCUMENT":k==="ARTICLE"?"ARTICLE":"HERO");
 };
 const edit=(index:number,fields:Record<string,unknown>)=>{
  setDraft(d=>({...d,sections:d.sections.map((v,i)=>i===index?{...v,fields}:v)}));
 };
 const setField=(index:number,key:string,value:unknown)=>{
  const fields={...draft.sections[index].fields,[key]:value};
  edit(index,fields);
 };
 const changeItem=(sectionIndex:number,itemIndex:number,patch:Record<string,unknown>,
  key="items")=>{
  const current=items(draft.sections[sectionIndex].fields[key]);
  edit(sectionIndex,{...draft.sections[sectionIndex].fields,
   [key]:current.map((v,i)=>i===itemIndex?{...v,...patch}:v)});
 };
 const addItem=(sectionIndex:number,key:string,starter:Record<string,unknown>)=>{
  edit(sectionIndex,{...draft.sections[sectionIndex].fields,
   [key]:[...items(draft.sections[sectionIndex].fields[key]),starter]});
 };
 const removeItem=(sectionIndex:number,key:string,itemIndex:number,role?:string)=>{
  const current=items(draft.sections[sectionIndex].fields[key]);
  setDraft(d=>({...d,sections:d.sections.map((v,i)=>i===sectionIndex?
   {...v,fields:{...v.fields,[key]:current.filter((_,j)=>j!==itemIndex)}}:v),
   assets:role?d.assets.filter(a=>a.role!==role||a.order!==itemIndex)
    .map(a=>a.role===role&&a.order>itemIndex?{...a,order:a.order-1}:a):d.assets}));
 };
 const moveImpact=(index:number,shift:number)=>{
  const newIndex=index+shift;
  if(newIndex<0||newIndex>=draft.sections.length)return;
  const changed=[...draft.sections];
  [changed[index],changed[newIndex]]=[changed[newIndex],changed[index]];
  const sections=changed.map((v,i)=>({...v,order:i}));
  setDraft(d=>({...d,sections,assets:d.assets.map(a=>a.role==="IMPACT"?
   {...a,order:a.order===index?newIndex:a.order===newIndex?index:a.order}:a)}));
 };
 async function command(c:Command){
  setBusy(true);setPending(c);setError("");setNotice("");
  try{
   const outcome=await api<{confirmed:boolean;pageRef?:string;status?:string}>(
    c.path,{method:c.method,headers:{"Content-Type":"application/json"},
     body:JSON.stringify(c.body)});
   if(!outcome.confirmed)throw Error("Server did not confirm this change.");
   setPending(null);setNotice("Confirmed: "+str(outcome.status).replaceAll("_"," "));
   await refresh();
   const ref=outcome.pageRef??selected?.pageRef;
   if(ref){
    const detail=await api<Detail>("pages/"+ref);
    setSelected(detail);
    setDraft({kind:detail.kind,slug:detail.slug,title:detail.title,
     seoTitle:detail.seoTitle,seoDescription:detail.seoDescription,
     sections:detail.sections,assets:detail.assets});
   }
  }catch(e){
   if(e instanceof Rejected)setPending(null);
   setError(e instanceof Error?e.message:"Check the original action before retrying.");
  }finally{setBusy(false);}
 }
 const act=(path:string,method:"POST"|"PUT",body:Record<string,unknown>)=>
  void command({path,method,body:{requestKey:crypto.randomUUID(),...body}});
 async function upload(file:File){
  if(!selected||selected.status!=="DRAFT"||busy)return;
  if(!rights||uploadAlt.trim().length<3){setError("Confirm publication rights and image description.");return;}
  const cap=file.type==="video/mp4"?26214400:10485760;
  if(!["image/jpeg","image/png","image/webp","video/mp4","application/pdf"].includes(file.type)||
     file.size<1||file.size>cap){setError("Select an allowed image/PDF (10 MB) or video (25 MB).");return;}
  setBusy(true);setError("");
  try{
   const sha=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",await file.arrayBuffer())))
    .map(x=>x.toString(16).padStart(2,"0")).join("");
   const started=await api<{status:string;uploadUrl?:string;uploadHeaders?:Record<string,string>;
    uploadRef:string}>("media/initiate",json({pageRef:selected.pageRef,
      revisionRef:selected.revisionRef,requestKey:crypto.randomUUID(),mime:file.type,
      sizeBytes:file.size,sha256:sha,rightsConfirmed:true}));
   if(started.status!=="UPLOAD_READY"||!started.uploadUrl||!started.uploadHeaders)
    throw Error("Private upload is unavailable; no media has been attached.");
   const written=await fetch(started.uploadUrl,{method:"PUT",body:file,headers:started.uploadHeaders});
   if(!written.ok)throw Error("File upload was not verified.");
   const confirmed=await api<{cleanVerified:boolean;fileRef:string|null;
    validatedVersion:number|null}>("media/"+started.uploadRef+"/confirm",json({}));
   if(!confirmed.cleanVerified||!confirmed.fileRef||!confirmed.validatedVersion)
    throw Error("File verification is pending. Check the original upload before retrying.");
   const placement={fileRef:confirmed.fileRef,version:confirmed.validatedVersion,
    role:uploadRole,order:uploadOrder,altText:uploadAlt.trim()};
   setDraft(d=>({...d,assets:[...d.assets.filter(a=>
    a.role!==uploadRole||a.order!==uploadOrder),placement]}));
   setUploadAlt("");setRights(false);
   setNotice("Verified CG-19 file attached to your unsaved draft. Save before submitting.");
  }catch(e){setError(e instanceof Error?e.message:"Verification could not be confirmed.");}
  finally{setBusy(false);}
 }
 const previewPage:PublicCmsPage={schemaVersion:1,effectiveGeneration:"PRIVATE_DRAFT",
  kind:draft.kind,slug:draft.slug,title:draft.title,seoTitle:draft.seoTitle,
  seoDescription:draft.seoDescription,canonicalPath:pathFor(draft.kind,draft.slug),
  lastPublishedAt:"",sections:draft.sections,
  assets:draft.assets.map(a=>({...a,src:"/api/cms-image-preview/"+a.fileRef}))};
 const unsaved=selected&&JSON.stringify(content(draft))!==JSON.stringify({
  kind:selected.kind,slug:selected.slug,title:selected.title,seoTitle:selected.seoTitle,
  seoDescription:selected.seoDescription,canonicalPath:pathFor(selected.kind,selected.slug),
  sections:selected.sections,assets:selected.assets
 });
 return <section className="cg-cms-workspace" aria-label="Impact, media and healthcare editor">
  <div className="cg-cms-toolbar"><div><h2>Impact, media & healthcare content</h2>
   <p>Editable original content. One private draft, independent review and public publication.</p>
  </div><div className="cg-cms-actions">
   <button disabled={busy} onClick={()=>void refresh().catch(e=>setError(e.message))}>Refresh pages</button>
   {canManage&&<button disabled={busy} onClick={()=>begin(kind)}>New editorial page</button>}
  </div></div>
  {error&&<p className="cg-cms-error" role="alert">{error}</p>}
  {notice&&<p className="cg-cms-notice" role="status">{notice}</p>}
  {pending&&<div className="cg-cms-notice" role="status">
   <p>The outcome is not confirmed. Refresh before retrying the same request.</p>
   <button disabled={busy} onClick={()=>void command(pending)}>Retry original request</button>
  </div>}
  <div className="cg-cms-list">{pages.map(p=><button disabled={busy} key={p.pageRef}
   aria-pressed={selected?.pageRef===p.pageRef} onClick={()=>void open(p)}>
   <strong>{p.title}</strong><span>{p.kind} · {p.draftStatus.replaceAll("_"," ")}
   {p.publicStatus?" · "+p.publicStatus.replaceAll("_"," "):""}</span>
  </button>)}</div>
  {(canManage||selected)&&<section className="cg-cms-card">
   <div className="cg-cms-toolbar"><h3>{selected?"Edit source draft":"Create editorial page"}</h3>
    <button type="button" onClick={()=>setPreview(x=>!x)}>{preview?"Edit":"Preview"}</button>
   </div>
   {preview?<div className="cg-cms-preview"><p>Private preview; no publication or public media URL is implied.</p>
    <CmsPublicPage page={previewPage}/></div>:<div className="cg-cms-form">
    <label>Content type<select disabled={!!selected||!canManage} value={draft.kind}
     onChange={e=>begin(e.target.value as Kind)}>
     {kinds.map(k=><option key={k} value={k}>{k==="COMPLIANCE"?"80G / registration":k.replaceAll("_"," ")}</option>)}
    </select></label>
    {draft.kind==="ARTICLE"&&<Field name="Article URL name (lowercase letters, digits, hyphens)"
     value={draft.slug} onChange={v=>setDraft(d=>({...d,slug:v}))}/>}
    <Field name="Page title" value={draft.title}
     onChange={v=>setDraft(d=>({...d,title:v}))}/>
    <Field name="Search title" value={draft.seoTitle}
     onChange={v=>setDraft(d=>({...d,seoTitle:v}))}/>
    <Field name="Search description" value={draft.seoDescription} large
     onChange={v=>setDraft(d=>({...d,seoDescription:v}))}/>
    {draft.sections.map((section,index)=>{
     const f=section.fields,groupName=str(f.group);
     const change=(key:string,value:unknown)=>setField(index,key,value);
     return <fieldset key={section.kind+"-"+index}>
      <legend>{section.kind==="IMPACT_GROUP"?"Impact: "+groupName.replaceAll("_"," "):
       section.kind.replaceAll("_"," ")}</legend>
      <Field name="Heading" value={f.heading} onChange={v=>change("heading",v)}/>
      {section.kind==="IMPACT_GROUP"&&<>
       <Field name="Explanation" value={f.intro} large onChange={v=>change("intro",v)}/>
       <Field name="Data or editorial source" value={f.source} onChange={v=>change("source",v)}/>
       <Field name="Source date" type="date" value={f.asOfDate}
        onChange={v=>change("asOfDate",v)}/>
       <div className="cg-cms-actions">
        <button type="button" disabled={index===0} onClick={()=>moveImpact(index,-1)}>Move earlier</button>
        <button type="button" disabled={index===draft.sections.length-1}
         onClick={()=>moveImpact(index,1)}>Move later</button>
       </div>
       {groupName==="BREAKDOWN"&&<label className="cg-cms-consent">
        <input type="checkbox" checked={f.claimsFullBreakdown===true}
         onChange={e=>change("claimsFullBreakdown",e.target.checked)}/>
        This is a complete 100% breakdown (percentages must total exactly 100)
       </label>}
       {groupName==="CTA"&&<><Field name="Button label (optional)" value={f.ctaLabel}
        onChange={v=>change("ctaLabel",v)}/>
        <Field name="Existing public destination" value={f.ctaPath}
         onChange={v=>change("ctaPath",v)}/></>}
       {items(f.items).map((v,j)=><div className="cg-cms-team" key={j}>
        <Field name="Label" value={v.title} onChange={x=>changeItem(index,j,{title:x})}/>
        <Field name="Description" value={v.description}
         onChange={x=>changeItem(index,j,{description:x})}/>
        {["STATS","GROWTH"].includes(groupName)&&<NumberField name="Value" value={v.value}
         onChange={x=>changeItem(index,j,{value:x})}/>}
        {groupName==="GROWTH"&&<NumberField name="Year" value={v.year}
         onChange={x=>changeItem(index,j,{year:x})}/>}
        {groupName==="BREAKDOWN"&&<NumberField name="Percentage" value={v.percentage}
         max={100} onChange={x=>changeItem(index,j,{percentage:x})}/>}
        {groupName==="STORIES"&&<label className="cg-cms-consent">
         <input type="checkbox" checked={v.consentConfirmed===true}
          onChange={e=>changeItem(index,j,{consentConfirmed:e.target.checked})}/>
         Written public-story consent confirmed</label>}
        {canManage&&<button type="button" onClick={()=>removeItem(index,"items",j)}>
         Remove item</button>}
       </div>)}
       {canManage&&items(f.items).length<16&&<button type="button"
        onClick={()=>addItem(index,"items",{title:"",description:"",
         ...(["STATS","GROWTH"].includes(groupName)?{value:0}:{}),
         ...(groupName==="GROWTH"?{year:new Date().getUTCFullYear()}:{}),
         ...(groupName==="BREAKDOWN"?{percentage:0}:{}),
         ...(groupName==="STORIES"?{consentConfirmed:false}:{})})}>
        Add {groupName.toLowerCase()} item</button>}
      </>}
      {section.kind==="COMPLIANCE_FACTS"&&<>
       <Field name="Public summary (no unverified tax promises)" value={f.summary} large
        onChange={v=>change("summary",v)}/>
       {(["issuer","pan","registrationNumber","approvalNumber","source"] as const)
        .map(key=><Field key={key} name={key.replace(/([A-Z])/g," $1")}
         value={f[key]} onChange={v=>change(key,v)}/>)}
       <Field name="Source reviewed on" type="date" value={f.verifiedAsOf}
        onChange={v=>change("verifiedAsOf",v)}/>
       <Field name="Valid from" type="date" value={f.validFrom}
        onChange={v=>change("validFrom",v)}/>
       <Field name="Valid until" type="date" value={f.validUntil}
        onChange={v=>change("validUntil",v)}/>
       <label>Public verification status<select value={str(f.verification)}
        onChange={e=>change("verification",e.target.value)}>
        <option value="NOT_VERIFIED">Not verified — no active tax benefit promised</option>
        <option value="VERIFIED">Verified against actual current official proof</option>
       </select></label>
       <Field name="Required disclaimer" value={f.disclaimer} large
        onChange={v=>change("disclaimer",v)}/>
       <p>Verified 80G claims require current dates and a scanned, rights-approved CG-19 document.</p>
      </>}
      {section.kind==="GALLERY_GRID"&&<>
       <Field name="Intro" value={f.description} large onChange={v=>change("description",v)}/>
       {items(f.items).map((item,j)=><div className="cg-cms-team" key={j}>
        {(["title","caption","category","source"] as const).map(key=>
         <Field key={key} name={key} value={item[key]}
          onChange={v=>changeItem(index,j,{[key]:v})}/>)}
        <Field name="Media source date" type="date" value={item.asOfDate}
         onChange={v=>changeItem(index,j,{asOfDate:v})}/>
        <label>Media type<select value={str(item.mediaType)} onChange={e=>
         changeItem(index,j,{mediaType:e.target.value})}>
          <option value="PHOTO">Photo</option><option value="VIDEO">Video</option>
          <option value="PUBLICATION">Publication PDF</option>
         </select></label>
        {canManage&&<button type="button"
         onClick={()=>removeItem(index,"items",j,"GALLERY")}>Remove item</button>}
       </div>)}
       {canManage&&items(f.items).length<12&&<button type="button"
        onClick={()=>addItem(index,"items",{title:"",caption:"",category:"",
         source:"",asOfDate:today(),mediaType:"PHOTO"})}>Add gallery item</button>}
      </>}
      {section.kind==="ARTICLE_BODY"&&<>
       {(["category","authorLabel","source"] as const).map(key=><Field key={key}
        name={key.replace(/([A-Z])/g," $1")} value={f[key]}
        onChange={v=>change(key,v)}/>)}
       <Field name="Original source date" type="date" value={f.asOfDate}
        onChange={v=>change("asOfDate",v)}/>
       <Field name="Article summary" large value={f.excerpt}
        onChange={v=>change("excerpt",v)}/>
       <Field name="Article body (plain text, no HTML)" large value={f.body}
        onChange={v=>change("body",v)}/>
       <Field name="Tags (comma-separated)" value={Array.isArray(f.tags)?f.tags.join(", "):""}
        onChange={v=>change("tags",v.split(",").map(x=>x.trim()).filter(Boolean).slice(0,8))}/>
      </>}
      {section.kind==="HEALTHCARE_CATEGORIES"&&<>
       <Field name="General healthcare explanation" large value={f.intro}
        onChange={v=>change("intro",v)}/>
       <p>Describe real service categories only. No invented doctors, fees, discounts, ratings or bookable appointments.</p>
       {items(f.categories).map((v,j)=><div className="cg-cms-team" key={j}>
        <Field name="Category name" value={v.title}
         onChange={x=>changeItem(index,j,{title:x},"categories")}/>
        <Field name="What this category means" large value={v.description}
         onChange={x=>changeItem(index,j,{description:x},"categories")}/>
        {canManage&&<button type="button"
         onClick={()=>removeItem(index,"categories",j)}>Remove category</button>}
       </div>)}
       {canManage&&items(f.categories).length<12&&<button type="button"
        onClick={()=>addItem(index,"categories",{title:"",description:""})}>Add category</button>}
       <Field name="Optional information button" value={f.ctaLabel}
        onChange={v=>change("ctaLabel",v)}/>
       <label>Destination<select value={str(f.ctaPath)}
        onChange={e=>change("ctaPath",e.target.value)}>
        <option value="">No link</option><option value="/contact">Foundation Contact</option>
       </select></label>
      </>}
      {section.kind==="RICH_TEXT"&&<Field name="Introduction"
       value={f.body} large onChange={v=>change("body",v)}/>}
     </fieldset>;
    })}
    {selected?.status==="DRAFT"&&draft.kind!=="CONTACT"&&draft.kind!=="HEALTHCARE"&&
     <fieldset><legend>Verified original media</legend>
      <p>Only original CG-19 scanned, consented media. Attach one per matching section or item.</p>
      <label>Placement<select value={uploadRole} onChange={e=>setUploadRole(e.target.value)}>
       {draft.kind==="IMPACT"?<option value="IMPACT">Impact group photo</option>:
        draft.kind==="GALLERY"?<option value="GALLERY">Gallery item</option>:
        draft.kind==="COMPLIANCE"?<option value="DOCUMENT">Official proof scan or PDF</option>:
        <option value="ARTICLE">Article cover photo</option>}
      </select></label>
      {["IMPACT","GALLERY"].includes(uploadRole)&&<label>Placement position<select
       value={String(uploadOrder)} onChange={e=>setUploadOrder(Number(e.target.value))}>
       {(draft.kind==="IMPACT"?draft.sections:items(draft.sections[0]?.fields.items))
        .map((value,i)=><option value={i} key={i}>{draft.kind==="IMPACT"?
         str((value as Section).fields.group):str((value as Record<string,unknown>).title)||"Item "+(i+1)}</option>)}
      </select></label>}
      <Field name="Accessible image/document description" value={uploadAlt}
       onChange={setUploadAlt}/>
      <label className="cg-cms-consent"><input type="checkbox" checked={rights}
       onChange={e=>setRights(e.target.checked)}/>The Foundation owns the public-use rights</label>
      <input type="file" disabled={busy||!rights||uploadAlt.trim().length<3} accept={
       draft.kind==="GALLERY"?"image/jpeg,image/png,image/webp,video/mp4,application/pdf":
       draft.kind==="COMPLIANCE"?"application/pdf,image/png,image/jpeg,image/webp":
       "image/jpeg,image/png,image/webp"}
       onChange={e=>{const file=e.target.files?.[0];if(file)void upload(file);
        e.currentTarget.value="";}}/>
      {draft.assets.map(a=><div className="cg-cms-asset" key={a.fileRef}>
       <span>{a.role} · position {a.order+1} · {a.altText}</span>
       <button type="button" disabled={!canManage} onClick={()=>setDraft(d=>({
        ...d,assets:d.assets.filter(v=>v!==a)}))}>Detach</button></div>)}
     </fieldset>}
    <p className="cg-cms-muted">Contact submissions use the existing CG-19 private support form.
     Publication cannot create a separate inbox, event, provider or patient record.</p>
   </div>}
   <div className="cg-cms-actions">
    {!selected&&canManage&&<button disabled={busy||!!pending}
     onClick={()=>act("pages","POST",{content:content(draft)})}>Create draft</button>}
    {selected?.status==="DRAFT"&&canManage&&<button disabled={busy||!!pending}
     onClick={()=>act("pages/"+selected.pageRef+"/draft","PUT",{
      content:content(draft),expectedVersion:selected.version})}>Save draft</button>}
    {selected?.status==="DRAFT"&&canManage&&<button disabled={busy||!!pending||!!unsaved}
     onClick={()=>act("pages/"+selected.pageRef+"/submit","POST",{
      expectedVersion:selected.version})}>Submit to independent review</button>}
    {selected?.status==="SUBMITTED"&&selected.approvalCaseRef&&canPublish&&<>
     <label>Schedule (optional)<input type="datetime-local" value={publishWhen}
      onChange={e=>setPublishWhen(e.target.value)}/></label>
     <button type="button" disabled={busy||!!pending||!!unsaved}
      onClick={()=>act("pages/"+selected.pageRef+"/publish","POST",{
       expectedVersion:selected.version,caseRef:selected.approvalCaseRef,
       ...(publishWhen?{publishAt:new Date(publishWhen).toISOString()}:{})})}>
      Publish approved version</button></>}
    {selected&&canPublish&&(selected.publicationStatus==="EFFECTIVE"||selected.scheduledAt)&&<>
     <Field name="Withdrawal reason" value={withdrawReason} onChange={setWithdrawReason}/>
     <button disabled={busy||!!pending||withdrawReason.trim().length<8}
      onClick={()=>act("pages/"+selected.pageRef+"/withdraw","POST",{
       expectedVersion:selected.version,reason:withdrawReason})}>Withdraw public page</button>
    </>}
   </div>
   {selected&&<p className="cg-cms-muted">Draft {selected.status.replaceAll("_"," ")} ·
    Publication {selected.publicationStatus.replaceAll("_"," ")}.
    Review through the original Website CMS approval inbox. No draft is public.</p>}
  </section>}
 </section>;
}
