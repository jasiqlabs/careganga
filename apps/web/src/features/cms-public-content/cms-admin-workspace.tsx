"use client";
import {useCallback,useEffect,useState} from "react";
import {CmsPublicPage,type PublicCmsPage} from "./cms-public-page";
type Kind="HOME"|"ABOUT";
type Team={name:string;designation:string;bio:string;consentConfirmed:boolean};
type Asset={fileRef:string;version:number;role:"HERO"|"MOBILE_HERO"|"TEAM"|"ABOUT"|"PROMO"|"FEATURE";altText:string;order:number};
type NavDesired={loginDesired:boolean;memberJoinDesired:boolean;volunteerJoinDesired:boolean};
type PageItem={pageRef:string;kind:Kind;slug:string;title:string;version:string;draftStatus:string;publicStatus:string|null};
type PageDetail={pageRef:string;kind:Kind;slug:string;version:number;revisionRef:string;
 revisionNo:number;status:string;approvalCaseRef:string|null;
 title:string;seoTitle:string;seoDescription:string;canonicalPath:string;
 sections:{kind:string;order:number;fields:Record<string,unknown>}[];
 assets:Asset[];navigation:NavDesired|null;publicationStatus:string;scheduledAt:string|null};
type Review={caseRef:string;number:string;title:string;status:string;revision:number};
type ReviewDetail={caseNumber:string;caseRef:string;status:string;revision:number;
 source:{title:string;slug:string;kind:string;seoTitle:string;
 seoDescription:string;navigation:NavDesired|null;sections:{kind:string;order:number;fields:Record<string,unknown>}[]}};
type Command={label:string;path:string;method:"POST"|"PUT";body:Record<string,unknown>};
type Slide={heading:string;subtitle:string;description:string;eyebrow:string;tags:string;
 primaryLabel:string;primaryPath:string;secondaryLabel:string;secondaryPath:string};
type FeatureCard={label:string;title:string;body:string};
type Draft={kind:Kind;title:string;seoTitle:string;seoDescription:string;
 slides:Slide[];bodyHeading:string;body:string;bodyEyebrow:string;
 bodyVariant:"STANDARD"|"SPLIT";highlights:string;
 promoEyebrow:string;promoHeading:string;promoBody:string;promoLabel:string;promoPath:string;
 featuresEyebrow:string;featuresHeading:string;featuresBody:string;featureCards:FeatureCard[];
 volunteerTitle:string;volunteerBody:string;volunteerBenefits:string;
 memberTitle:string;memberBody:string;memberBenefits:string;
 footerMission:string;footerAddress:string;footerPhone:string;footerEmail:string;
 footerNewsletterText:string;teamHeading:string;team:Team[];assets:Asset[];
 loginDesired:boolean;memberJoinDesired:boolean;volunteerJoinDesired:boolean};
const blankSlide=():Slide=>({heading:"",subtitle:"",description:"",eyebrow:"",tags:"",
 primaryLabel:"",primaryPath:"",secondaryLabel:"",secondaryPath:""});
const blank=(kind:Kind):Draft=>({kind,title:"",seoTitle:"",seoDescription:"",
 slides:kind==="HOME"?[blankSlide()]:[],bodyHeading:"",body:"",bodyEyebrow:"",
 bodyVariant:kind==="HOME"?"SPLIT":"STANDARD",highlights:"",
 promoEyebrow:"",promoHeading:"",promoBody:"",promoLabel:"",promoPath:"",
 featuresEyebrow:"",featuresHeading:"",featuresBody:"",featureCards:[],
 volunteerTitle:"",volunteerBody:"",volunteerBenefits:"",
 memberTitle:"",memberBody:"",memberBenefits:"",
 footerMission:"",footerAddress:"",footerPhone:"",footerEmail:"",footerNewsletterText:"",
 teamHeading:"Our team",team:[],assets:[],loginDesired:true,
 memberJoinDesired:false,volunteerJoinDesired:false});
function val(v:unknown):string{return typeof v==="string"?v:"";}
function words(v:unknown){return Array.isArray(v)?v.filter(x=>typeof x==="string").join("\n"):"";}
function section(d:PageDetail,kind:string){
 return d.sections.find(x=>x.kind===kind)?.fields??{};
}
function fromPage(p:PageDetail):Draft{
 const draft=blank(p.kind),body=section(p,"RICH_TEXT"),team=section(p,"TEAM");
 const promo=section(p,"CTA"),features=section(p,"FEATURE_CARDS");
 const join=section(p,"JOIN_CARDS"),footer=section(p,"SITE_FOOTER");
 return {...draft,title:p.title,seoTitle:p.seoTitle,seoDescription:p.seoDescription,
  slides:p.sections.filter(x=>x.kind==="HERO").sort((a,b)=>a.order-b.order)
   .map(x=>({heading:val(x.fields.heading),subtitle:val(x.fields.subtitle),
    description:val(x.fields.description),eyebrow:val(x.fields.eyebrow),
    tags:Array.isArray(x.fields.tags)?x.fields.tags.filter(y=>typeof y==="string").join(", "):"",
    primaryLabel:val(x.fields.primaryLabel),primaryPath:val(x.fields.primaryPath),
    secondaryLabel:val(x.fields.secondaryLabel),secondaryPath:val(x.fields.secondaryPath)})),
  bodyHeading:val(body.heading),body:val(body.body),
  bodyEyebrow:val(body.eyebrow),bodyVariant:body.variant==="SPLIT"?"SPLIT":"STANDARD",
  highlights:words(body.highlights),
  promoEyebrow:val(promo.eyebrow),promoHeading:val(promo.heading),
  promoBody:val(promo.body),promoLabel:val(promo.label),promoPath:val(promo.path),
  featuresEyebrow:val(features.eyebrow),featuresHeading:val(features.heading),
  featuresBody:val(features.body),
  featureCards:Array.isArray(features.cards)?features.cards
   .filter(x=>x&&typeof x==="object").map(x=>{const y=x as Record<string,unknown>;
    return {label:val(y.label),title:val(y.title),body:val(y.body)}}):[],
  volunteerTitle:val(join.volunteerTitle),volunteerBody:val(join.volunteerBody),
  volunteerBenefits:words(join.volunteerBenefits),memberTitle:val(join.memberTitle),
  memberBody:val(join.memberBody),memberBenefits:words(join.memberBenefits),
  footerMission:val(footer.mission),footerAddress:val(footer.address),
  footerPhone:val(footer.phone),footerEmail:val(footer.email),
  footerNewsletterText:val(footer.newsletterText),
  teamHeading:val(team.heading)||"Our team",
  team:Array.isArray(team.members)?team.members.filter(v=>v&&typeof v==="object")
   .map(v=>{const person=v as Record<string,unknown>;return {
    name:val(person.name),designation:val(person.designation),bio:val(person.bio),
    consentConfirmed:person.consentConfirmed===true};}):[],
  assets:p.assets,loginDesired:p.navigation?.loginDesired??true,
  memberJoinDesired:p.navigation?.memberJoinDesired??false,
  volunteerJoinDesired:p.navigation?.volunteerJoinDesired??false};
}
function lines(s:string){return s.split("\n").map(v=>v.trim()).filter(Boolean).slice(0,4);}
function payload(d:Draft){
 const sections:{kind:string;order:number;fields:Record<string,unknown>}[]=[];
 d.slides.forEach((slide,index)=>{
  const fields:Record<string,unknown>={heading:slide.heading,subtitle:slide.subtitle,
   description:slide.description,eyebrow:slide.eyebrow,
   tags:slide.tags.split(",").map(x=>x.trim()).filter(Boolean).slice(0,4)};
  if(slide.primaryLabel.trim()&&slide.primaryPath.trim()){
   fields.primaryLabel=slide.primaryLabel;fields.primaryPath=slide.primaryPath;
  }
  if(slide.secondaryLabel.trim()&&slide.secondaryPath.trim()){
   fields.secondaryLabel=slide.secondaryLabel;fields.secondaryPath=slide.secondaryPath;
  }
  sections.push({kind:"HERO",order:index,fields});
 });
 if(d.body.trim())sections.push({kind:"RICH_TEXT",order:20,
  fields:{heading:d.bodyHeading||"About the Foundation",body:d.body,
   eyebrow:d.bodyEyebrow,variant:d.bodyVariant,highlights:lines(d.highlights)}});
 if(d.promoHeading.trim())sections.push({kind:"CTA",order:30,
  fields:{heading:d.promoHeading,eyebrow:d.promoEyebrow,body:d.promoBody,
   ...(d.promoLabel.trim()&&d.promoPath.trim()?
    {label:d.promoLabel,path:d.promoPath}:{})}});
 if(d.featuresHeading.trim()&&d.featureCards.length)sections.push({
  kind:"FEATURE_CARDS",order:40,
  fields:{heading:d.featuresHeading,eyebrow:d.featuresEyebrow,
   body:d.featuresBody,cards:d.featureCards}});
 if(d.volunteerTitle.trim()&&d.memberTitle.trim())sections.push({
  kind:"JOIN_CARDS",order:50,
  fields:{volunteerTitle:d.volunteerTitle,volunteerBody:d.volunteerBody,
   volunteerBenefits:lines(d.volunteerBenefits),
   memberTitle:d.memberTitle,memberBody:d.memberBody,
   memberBenefits:lines(d.memberBenefits)}});
 if(d.team.length)sections.push({kind:"TEAM",order:70,
  fields:{heading:d.teamHeading||"Our team",members:d.team}});
 if(d.kind==="HOME"&&(d.footerMission||d.footerAddress||d.footerEmail||d.footerPhone))
  sections.push({kind:"SITE_FOOTER",order:90,
   fields:{mission:d.footerMission,address:d.footerAddress,
    phone:d.footerPhone,email:d.footerEmail,newsletterText:d.footerNewsletterText}});
 if(!sections.length)sections.push({kind:"RICH_TEXT",order:20,
  fields:{heading:d.title||"About the Foundation",body:d.body,variant:"STANDARD"}});
 return {kind:d.kind,slug:d.kind==="HOME"?"home":"about",title:d.title,
  seoTitle:d.seoTitle||d.title,seoDescription:d.seoDescription,
  canonicalPath:d.kind==="HOME"?"/":"/about",sections,assets:d.assets,
  ...(d.kind==="HOME"?{navigation:{loginDesired:d.loginDesired,
   memberJoinDesired:d.memberJoinDesired,volunteerJoinDesired:d.volunteerJoinDesired}}:{})};
}
function CmsReviewSection({kind,fields}:{kind:string;fields:Record<string,unknown>}){
 const heading=val(fields.heading);
 const labels=kind==="HERO"?
  [["Subtitle",fields.subtitle],["Primary button",fields.primaryLabel],
   ["Primary destination",fields.primaryPath],["Secondary button",fields.secondaryLabel],
   ["Secondary destination",fields.secondaryPath]]:
  kind==="RICH_TEXT"?[["Page text",fields.body]]:
  kind==="CTA"?[["Button",fields.label],["Destination",fields.path]]:[];
 return <div className="cg-cms-review-text">
  {!!heading&&<h5>{heading}</h5>}
  {labels.filter(([,value])=>val(value)).map(([label,value],i)=>
   <p key={i}><strong>{val(label)}:</strong> {val(value)}</p>)}
  {kind==="TEAM"&&Array.isArray(fields.members)&&fields.members.map((member,i)=>{
   const x=member as Record<string,unknown>;
   return <p key={i}><strong>{val(x.name)}</strong> · {val(x.designation)}
    {val(x.bio)?": "+val(x.bio):""}
    {x.consentConfirmed===true?" · Public-use consent confirmed":""}</p>;
  })}
 </div>;
}
async function serverMessage(r:Response){
 const result:unknown=await r.json().catch(()=>null);
 if(result&&typeof result==="object"&&"message" in result&&
  typeof result.message==="string")return result.message.slice(0,240);
 return r.status===403?"Your role does not allow this website change.":
  r.status===409?"Someone changed this page. Refresh before continuing.":
  "The request could not be confirmed. Check its status before retrying.";
}
async function read<T>(path:string,init?:RequestInit):Promise<T>{
 const r=await fetch("/api/cms/"+path,{cache:"no-store",...init});
 if(!r.ok)throw Error(await serverMessage(r));
 return r.json() as Promise<T>;
}
export function CmsAdminWorkspace({canManage,canPublish,canReview}:{
 canManage:boolean;canPublish:boolean;canReview:boolean}){
 const [pages,setPages]=useState<PageItem[]>([]);
 const [selected,setSelected]=useState<PageDetail|null>(null);
 const [draft,setDraft]=useState<Draft>(blank("HOME"));
 const [preview,setPreview]=useState(false),[reviewing,setReviewing]=useState(false);
 const [reviews,setReviews]=useState<Review[]>([]);
 const [review,setReview]=useState<ReviewDetail|null>(null);
 const [reviewPassword,setReviewPassword]=useState("");
 const [remark,setRemark]=useState("");
 const [withdrawReason,setWithdrawReason]=useState("");
 const [publishWhen,setPublishWhen]=useState("");
 const [uploadRole,setUploadRole]=useState<Asset["role"]>("HERO");
 const [uploadOrder,setUploadOrder]=useState(0);
 const [uploadAlt,setUploadAlt]=useState(""),[rights,setRights]=useState(false);
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(""),[error,setError]=useState("");
 const [pending,setPending]=useState<Command|null>(null);
 const refresh=useCallback(async()=>{
  try{const x=await read<{pages:PageItem[]}>("pages");setPages(x.pages);}
  catch(e){setError(e instanceof Error?e.message:"Could not load website pages.");}
 },[]);
 useEffect(()=>{void refresh();},[refresh]);
 async function open(ref:string){
  if(busy)return;
  setBusy(true);setError("");setNotice("");
  try{const x=await read<PageDetail>("pages/"+ref);setSelected(x);setDraft(fromPage(x));
   setReviewing(false);setReview(null);setPreview(false);setPending(null);setPublishWhen("");}
  catch(e){setError(e instanceof Error?e.message:"Page detail unavailable.");}
  finally{setBusy(false);}
 }
 function edit<K extends keyof Draft>(field:K,value:Draft[K]){
  setDraft(x=>({...x,[field]:value}));
 }
 function moveSlide(index:number,delta:number){
  const target=index+delta;if(target<0||target>=draft.slides.length)return;
  const slides=[...draft.slides];[slides[index],slides[target]]=[slides[target],slides[index]];
  const assets=draft.assets.map(a=>{
   if(a.role!=="HERO"&&a.role!=="MOBILE_HERO")return a;
   return a.order===index?{...a,order:target}:
    a.order===target?{...a,order:index}:a;
  });
  setDraft(v=>({...v,slides,assets}));
 }
 function removeSlide(index:number){
  const slides=draft.slides.filter((_,i)=>i!==index);
  const assets=draft.assets.filter(a=>!["HERO","MOBILE_HERO"].includes(a.role)||
   a.order!==index).map(a=>["HERO","MOBILE_HERO"].includes(a.role)&&a.order>index?
    {...a,order:a.order-1}:a);
  setDraft(v=>({...v,slides,assets}));
 }
 const okay=draft.title.trim().length>=3&&
  (draft.kind!=="HOME"||draft.slides.length>0)&&
  draft.slides.length<=6&&draft.slides.every(x=>x.heading.trim().length>=3)&&
  (!draft.promoHeading||Boolean(draft.promoLabel)===Boolean(draft.promoPath))&&
  (!draft.featuresHeading||draft.featureCards.length>0&&draft.featureCards.every(x=>
    x.label.trim().length>=2&&x.title.trim().length>=3&&x.body.trim().length>=5))&&
  (!draft.volunteerTitle||Boolean(draft.memberTitle)&&
    Boolean(draft.volunteerBody)&&Boolean(draft.memberBody))&&
  draft.body.trim().length>=5&&
  draft.team.every(x=>x.consentConfirmed&&x.name.trim().length>=2&&
   x.designation.trim().length>=2);
 async function send(c:Command){
  if(busy)return;
  setBusy(true);setError("");setNotice("");setPending(c);
  try{
   const outcome=await read<{confirmed:boolean;pageRef?:string;status?:string}>(c.path,{
    method:c.method,headers:{"Content-Type":"application/json"},body:JSON.stringify(c.body)});
   if(!outcome.confirmed)throw Error("Publication action was not confirmed. Check the original record.");
   setPending(null);setNotice(c.label+" confirmed. "+val(outcome.status).replaceAll("_"," "));
   await refresh();
   if(c.path.startsWith("pages/")&&selected){
    const x=await read<PageDetail>("pages/"+selected.pageRef);
    setSelected(x);setDraft(fromPage(x));
   }else if(outcome.pageRef){
    const x=await read<PageDetail>("pages/"+outcome.pageRef);
    setSelected(x);setDraft(fromPage(x));
   }
  }catch(e){setError(e instanceof Error?e.message:"Action not confirmed. Retry the same request key.");}
  finally{setBusy(false);}
 }
 const command=(label:string,path:string,method:"POST"|"PUT",body:Record<string,unknown>)=>
  void send({label,path,method,body:{requestKey:crypto.randomUUID(),...body}});
 async function showInbox(){
  setBusy(true);setError("");setReviewing(true);setPreview(false);
  try{const x=await read<{cases:Review[]}>("reviews");setReviews(x.cases);setReview(null);}
  catch(e){setError(e instanceof Error?e.message:"Review inbox unavailable.");}
  finally{setBusy(false);}
 }
 async function openReview(ref:string){
  setBusy(true);setError("");
  try{setReview(await read<ReviewDetail>("reviews/"+ref));setRemark("");setReviewPassword("");}
  catch(e){setError(e instanceof Error?e.message:"Reviewer source unavailable.");}
  finally{setBusy(false);}
 }
 async function decide(action:"APPROVE"|"RETURN"|"REJECT"){
  if(!review||reviewPassword.length<8)return;
  setBusy(true);setError("");
  const c:Command={label:"Reviewer decision",path:"reviews/"+review.caseRef+"/decide",
   method:"POST",body:{requestKey:crypto.randomUUID(),
    expectedRevision:review.revision,action,remarks:remark,currentPassword:reviewPassword}};
  setPending(c);
  try{
   const result=await read<{confirmed:boolean;status:string}>(c.path,{
    method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(c.body)});
   if(!result.confirmed)throw Error("Decision could not be confirmed.");
   setPending(null);setReview(null);setReviewPassword("");
   setNotice(action==="APPROVE"?"The page is approved. A publisher must still publish it.":
    "The author can now correct or review this page.");
   await showInbox();await refresh();
  }catch(e){setError(e instanceof Error?e.message:"Review was not confirmed.");}
  finally{setBusy(false);}
 }
 async function upload(file:File){
  if(!selected||selected.status!=="DRAFT"||busy)return;
  if(!rights){setError("Confirm that the Foundation may publish this image.");return;}
  if(!uploadAlt.trim()||file.size<1||file.size>10485760||
   !["image/jpeg","image/png","image/webp"].includes(file.type)){
   setError("Choose a JPG, PNG or WebP under 10 MB and describe the image.");return;
  }
  setBusy(true);setError("");setNotice("");
  try{
   const sha=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",await file.arrayBuffer())))
    .map(x=>x.toString(16).padStart(2,"0")).join("");
   const initiated=await read<{uploadRef:string;status:string;uploadUrl?:string;
    uploadHeaders?:Record<string,string>}>("media/initiate",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({pageRef:selected.pageRef,revisionRef:selected.revisionRef,
     requestKey:crypto.randomUUID(),mime:file.type,sizeBytes:file.size,
     sha256:sha,rightsConfirmed:true})});
   if(initiated.status!=="UPLOAD_READY"||!initiated.uploadUrl||!initiated.uploadHeaders)
    throw Error("Secure upload is unavailable. No image has been attached.");
   const put=await fetch(initiated.uploadUrl,{method:"PUT",headers:initiated.uploadHeaders,
    body:file,cache:"no-store"});
   if(!put.ok)throw Error("The image upload was not confirmed.");
   const confirmed=await read<{cleanVerified:boolean;fileRef:string|null;validatedVersion:number|null}>(
    "media/"+initiated.uploadRef+"/confirm",{method:"POST",headers:{"Content-Type":"application/json"},
     body:"{}"});
   if(!confirmed.cleanVerified||!confirmed.fileRef||!confirmed.validatedVersion)
    throw Error("The image is awaiting secure validation. Check before uploading again.");
   const next:Asset={fileRef:confirmed.fileRef,version:confirmed.validatedVersion,
    role:uploadRole,altText:uploadAlt.trim(),order:uploadRole==="ABOUT"?20:
      uploadRole==="PROMO"?30:uploadOrder};
   setDraft(v=>({...v,assets:[...v.assets.filter(x=>x.role!==next.role||x.order!==next.order),next]}));
   setUploadAlt("");setRights(false);
   setNotice("Image verified. Save the draft to attach it to the page.");
  }catch(e){setError(e instanceof Error?e.message:"Image could not be verified.");}
  finally{setBusy(false);}
 }
 const previewData=payload(draft);
 const previewPage:PublicCmsPage={schemaVersion:1,effectiveGeneration:"DRAFT_PREVIEW",
  kind:draft.kind,slug:previewData.slug,title:draft.title,
  seoTitle:draft.seoTitle||draft.title,seoDescription:draft.seoDescription,
  canonicalPath:previewData.canonicalPath,lastPublishedAt:"",
  sections:previewData.sections,assets:[]};
 return <div className="cg-cms-workspace">
  <header className="cg-cms-toolbar"><div>
   <h2>Website content</h2><p>Draft → independent approval → publish. Public visitors see only approved pages.</p>
  </div><div className="cg-cms-actions">
   <button type="button" onClick={()=>void refresh()} disabled={busy}>Refresh</button>
   {canReview&&<button type="button" onClick={()=>void showInbox()} disabled={busy}>
    Review approvals</button>}
   {canManage&&<button type="button" onClick={()=>{setSelected(null);setReviewing(false);
    setDraft(blank("HOME"));setPending(null);setPreview(false);}}>New page</button>}
  </div></header>
  {!!error&&<p role="alert" className="cg-cms-error">{error}</p>}
  {!!notice&&<p role="status" className="cg-cms-notice">{notice}</p>}
  {pending&&<div className="cg-cms-notice" role="status"><p>Result not confirmed.
   Refresh the record first; retry only the original request.</p>
   <button type="button" disabled={busy} onClick={()=>void send(pending)}>Retry original action</button>
   <button type="button" disabled={busy} onClick={()=>void refresh()}>Check current records</button>
  </div>}
  {reviewing?<section className="cg-cms-card">
   <h3>Website publication approvals</h3>
   <div className="cg-cms-list">{reviews.map(v=><button type="button" key={v.caseRef}
    aria-pressed={review?.caseRef===v.caseRef} disabled={busy}
    onClick={()=>void openReview(v.caseRef)}>
    <strong>{v.title}</strong><span>{v.number} · {v.status.replaceAll("_"," ")}</span>
   </button>)}</div>
   {!reviews.length&&<p>No submitted pages are awaiting an editorial decision.</p>}
   {review&&<section className="cg-cms-form" aria-label="Review original page">
    <h4>{review.source.title} — original draft</h4>
    <p>{review.source.kind==="HOME"?"Homepage":"About page"} · {review.status}</p>
    {review.source.navigation&&<div className="cg-cms-notice">
     <p>Reviewed navigation: Staff login {review.source.navigation.loginDesired?"requested":"hidden"};
      member registration {review.source.navigation.memberJoinDesired?"requested, unavailable until delivered":"hidden"};
      volunteer registration {review.source.navigation.volunteerJoinDesired?"requested, unavailable until delivered":"hidden"}.</p>
    </div>}
    {review.source.sections.map((sec,i)=><article key={i}><strong>{sec.kind.replaceAll("_"," ")}</strong>
     <CmsReviewSection kind={sec.kind} fields={sec.fields}/>
    </article>)}
    {["SUBMITTED","IN_REVIEW"].includes(review.status)&&<>
     <label>Review comments<textarea value={remark} maxLength={500}
      onChange={e=>setRemark(e.target.value)}/></label>
     <label>Current reviewer password<input type="password" autoComplete="current-password"
      value={reviewPassword} onChange={e=>setReviewPassword(e.target.value)}/></label>
     <div className="cg-cms-actions">
      <button disabled={busy||reviewPassword.length<8} onClick={()=>void decide("APPROVE")}>
       Approve original content</button>
      <button disabled={busy||reviewPassword.length<8} onClick={()=>void decide("RETURN")}>
       Return for changes</button>
      <button disabled={busy||reviewPassword.length<8} onClick={()=>void decide("REJECT")}>
       Reject</button>
     </div>
    </>}
   </section>}
   <button type="button" onClick={()=>setReviewing(false)}>Back to pages</button>
  </section>:<>
   <section className="cg-cms-list" aria-label="Foundation website pages">
    {pages.map(v=><button type="button" key={v.pageRef} disabled={busy}
     aria-pressed={selected?.pageRef===v.pageRef} onClick={()=>void open(v.pageRef)}>
     <strong>{v.title}</strong><span>{v.kind==="HOME"?"Homepage":"About"} · {v.draftStatus.replaceAll("_"," ")}
      {v.publicStatus?" · "+v.publicStatus.replaceAll("_"," "):""}</span></button>)}
    {!pages.length&&<p>No Foundation website pages have been created.</p>}
   </section>
   {(canManage||selected)&&<section className="cg-cms-card">
    <div className="cg-cms-toolbar"><h3>{selected?"Edit original website page":"Create website page"}</h3>
     <button type="button" onClick={()=>setPreview(v=>!v)}>
      {preview?"Back to editor":"Preview draft"}</button></div>
    {preview?<div className="cg-cms-preview">
     <p>Private editor preview — not published. Images are shown only after approval.</p>
     <CmsPublicPage page={previewPage}/>
    </div>:<div className="cg-cms-form">
     <label>Page<select disabled={!!selected||!canManage} value={draft.kind}
      onChange={e=>setDraft(blank(e.target.value as Kind))}>
      <option value="HOME">Homepage</option><option value="ABOUT">About the Foundation</option>
     </select></label>
     <label>Page title<input disabled={!canManage} value={draft.title} maxLength={180}
      onChange={e=>edit("title",e.target.value)} placeholder="Enter the actual page title"/></label>
     <label>Search title<input disabled={!canManage} value={draft.seoTitle} maxLength={180}
      onChange={e=>edit("seoTitle",e.target.value)} placeholder="Optional — uses page title"/></label>
     <label>Search description<textarea disabled={!canManage} value={draft.seoDescription}
      maxLength={300} onChange={e=>edit("seoDescription",e.target.value)}/></label>
     {draft.kind==="HOME"&&<fieldset><legend>Public navigation (original C50)</legend>
      <p>These choices are reviewed with the homepage. Member and volunteer links
       remain hidden until registration is genuinely delivered.</p>
      <label className="cg-cms-consent"><input type="checkbox" disabled={!canManage}
       checked={draft.loginDesired} onChange={e=>edit("loginDesired",e.target.checked)}/>
       Show Foundation staff login</label>
      <label className="cg-cms-consent"><input type="checkbox" disabled={!canManage}
       checked={draft.memberJoinDesired} onChange={e=>edit("memberJoinDesired",e.target.checked)}/>
       Request member registration link when available</label>
      <label className="cg-cms-consent"><input type="checkbox" disabled={!canManage}
       checked={draft.volunteerJoinDesired} onChange={e=>edit("volunteerJoinDesired",e.target.checked)}/>
       Request volunteer registration link when available</label>
     </fieldset>}
     <div className="cg-cms-editor-grid">
      <fieldset><legend>Hero banners — original C22–C24</legend>
        <p>Each slide has independent text, buttons and approved desktop/mobile images.
         The current slide order is saved with the draft and subject to independent review.</p>
        {draft.slides.map((slide,index)=><div className="cg-cms-team" key={index}>
         <h4>Slide {index+1}</h4>
         <label>Eyebrow<input disabled={!canManage} maxLength={100} value={slide.eyebrow}
          onChange={e=>edit("slides",draft.slides.map((x,i)=>i===index?{...x,eyebrow:e.target.value}:x))}/></label>
         <label>Heading<input disabled={!canManage} maxLength={180} value={slide.heading}
          onChange={e=>edit("slides",draft.slides.map((x,i)=>i===index?{...x,heading:e.target.value}:x))}/></label>
         <label>Highlighted subtitle<textarea disabled={!canManage} maxLength={700} value={slide.subtitle}
          onChange={e=>edit("slides",draft.slides.map((x,i)=>i===index?{...x,subtitle:e.target.value}:x))}/></label>
         <label>Supporting paragraph<textarea disabled={!canManage} maxLength={400} value={slide.description}
          onChange={e=>edit("slides",draft.slides.map((x,i)=>i===index?{...x,description:e.target.value}:x))}/></label>
         <label>Badges (up to four, comma-separated)<input disabled={!canManage} value={slide.tags}
          onChange={e=>edit("slides",draft.slides.map((x,i)=>i===index?{...x,tags:e.target.value}:x))}/></label>
         <label>Primary button label<input disabled={!canManage} maxLength={60} value={slide.primaryLabel}
          onChange={e=>edit("slides",draft.slides.map((x,i)=>i===index?{...x,primaryLabel:e.target.value}:x))}/></label>
         <label>Primary route<input disabled={!canManage} value={slide.primaryPath} placeholder="/about"
          onChange={e=>edit("slides",draft.slides.map((x,i)=>i===index?{...x,primaryPath:e.target.value}:x))}/></label>
         <label>Secondary button label<input disabled={!canManage} maxLength={60} value={slide.secondaryLabel}
          onChange={e=>edit("slides",draft.slides.map((x,i)=>i===index?{...x,secondaryLabel:e.target.value}:x))}/></label>
         <label>Secondary route<input disabled={!canManage} value={slide.secondaryPath} placeholder="/contact"
          onChange={e=>edit("slides",draft.slides.map((x,i)=>i===index?{...x,secondaryPath:e.target.value}:x))}/></label>
         {canManage&&<div className="cg-cms-actions">
          <button type="button" disabled={index===0} onClick={()=>moveSlide(index,-1)}>Move up</button>
          <button type="button" disabled={index===draft.slides.length-1}
           onClick={()=>moveSlide(index,1)}>Move down</button>
          <button type="button" disabled={draft.kind==="HOME"&&draft.slides.length===1}
           onClick={()=>removeSlide(index)}>Remove slide</button>
         </div>}
        </div>)}
        {canManage&&draft.slides.length<6&&<button type="button"
         onClick={()=>edit("slides",[...draft.slides,blankSlide()])}>Add slide</button>}
       </fieldset>      <fieldset><legend>Page body</legend>
       <label>Section heading<input disabled={!canManage} value={draft.bodyHeading}
        onChange={e=>edit("bodyHeading",e.target.value)}/></label>
       <label>Foundation information<textarea disabled={!canManage} rows={9}
        value={draft.body} maxLength={4000}
        onChange={e=>edit("body",e.target.value)}/></label>
      </fieldset>
     </div>
     <fieldset><legend>Public team members (with permission)</legend>
      <label>Section heading<input disabled={!canManage} value={draft.teamHeading}
       onChange={e=>edit("teamHeading",e.target.value)}/></label>
      {draft.team.map((member,index)=><div className="cg-cms-team" key={index}>
       <label>Public name<input disabled={!canManage} value={member.name}
        onChange={e=>edit("team",draft.team.map((v,i)=>i===index?{...v,name:e.target.value}:v))}/></label>
       <label>Role<input disabled={!canManage} value={member.designation}
        onChange={e=>edit("team",draft.team.map((v,i)=>i===index?{...v,designation:e.target.value}:v))}/></label>
       <label>Biography<textarea disabled={!canManage} value={member.bio}
        onChange={e=>edit("team",draft.team.map((v,i)=>i===index?{...v,bio:e.target.value}:v))}/></label>
       <label className="cg-cms-consent"><input type="checkbox" disabled={!canManage}
        checked={member.consentConfirmed} onChange={e=>
         edit("team",draft.team.map((v,i)=>i===index?{...v,consentConfirmed:e.target.checked}:v))}/>
        I confirm permission to publish this profile</label>
       {canManage&&<button type="button" onClick={()=>edit("team",draft.team.filter((_,i)=>i!==index))}>
        Remove profile</button>}
      </div>)}
      {canManage&&draft.team.length<15&&<button type="button" onClick={()=>edit("team",[
       ...draft.team,{name:"",designation:"",bio:"",consentConfirmed:false}])}>
       Add team member</button>}
     </fieldset>
     {!!selected&&selected.status==="DRAFT"&&canManage&&<fieldset>
      <legend>Hero and team photographs</legend>
      <p>Upload only an original image the Foundation is authorized to publish.
       It must pass the private file scan before saving the draft.</p>
      <label>Placement<select value={uploadRole}
       onChange={e=>setUploadRole(e.target.value as Asset["role"])}>
       <option value="HERO">Desktop hero image</option>
       <option value="MOBILE_HERO">Mobile hero image</option>
       <option value="TEAM">Team member photograph</option></select></label>
      {uploadRole==="TEAM"&&<label>Team member
       <select value={String(uploadOrder)} onChange={e=>setUploadOrder(Number(e.target.value))}>
        {draft.team.map((m,i)=><option key={i} value={i}>{m.name||"Team member "+(i+1)}</option>)}
       </select></label>}
      <label>Describe the image<input value={uploadAlt} maxLength={300}
       onChange={e=>setUploadAlt(e.target.value)}/></label>
      <label className="cg-cms-consent"><input type="checkbox" checked={rights}
       onChange={e=>setRights(e.target.checked)}/>I confirm public image rights and consent</label>
      <label>Select original image<input type="file" accept="image/png,image/jpeg,image/webp"
       disabled={busy||!rights||uploadAlt.trim().length<3||(uploadRole==="TEAM"&&draft.team.length===0)}
       onChange={e=>{const file=e.target.files?.[0];if(file)void upload(file);e.currentTarget.value="";}}/></label>
      {draft.assets.map(x=><div className="cg-cms-asset" key={x.fileRef}>
       <span>{x.role==="TEAM"?(draft.team[x.order]?.name||"Team member "+(x.order+1)):
        x.role.replaceAll("_"," ")} · {x.altText}</span>
       <button type="button" onClick={()=>edit("assets",draft.assets.filter(v=>v!==x))}>
        Remove from draft</button></div>)}
     </fieldset>}
    </div>}
    <div className="cg-cms-actions">
     {!selected&&canManage&&<button disabled={busy||!okay||!!pending} type="button"
      onClick={()=>command("Draft created","pages","POST",{content:payload(draft)})}>Create draft</button>}
     {selected&&canManage&&<button disabled={busy||!okay||!!pending} type="button"
      onClick={()=>command("Draft saved","pages/"+selected.pageRef+"/draft","PUT",
       {content:payload(draft),expectedVersion:selected.version})}>Save draft</button>}
     {selected&&selected.status==="DRAFT"&&canManage&&<button
      disabled={busy||!!pending} type="button"
      onClick={()=>command("Submitted for approval","pages/"+selected.pageRef+"/submit","POST",
       {expectedVersion:selected.version})}>Send for review</button>}
     {selected&&selected.status==="SUBMITTED"&&selected.approvalCaseRef&&canPublish&&
      !selected.scheduledAt&&<>
      <label>Publish later (optional, local date and time)
       <input type="datetime-local" value={publishWhen}
        onChange={e=>setPublishWhen(e.target.value)}/></label>
      <button type="button" disabled={busy||!!pending||
        (Boolean(publishWhen)&&(!Number.isFinite(Date.parse(publishWhen))||
         Date.parse(publishWhen)-Date.now()<60000))}
       onClick={()=>{
        const publishAt=publishWhen?new Date(publishWhen).toISOString():undefined;
        command(publishAt?"Scheduled publication":"Page publication",
         "pages/"+selected.pageRef+"/publish","POST",
         {expectedVersion:selected.version,caseRef:selected.approvalCaseRef,
          ...(publishAt?{publishAt}:{})});
       }}>
       {publishWhen?"Schedule approved page":"Publish approved page now"}</button></>}
     {selected&&(selected.publicationStatus==="EFFECTIVE"||selected.scheduledAt)&&canPublish&&<>
      <label>Why hide this page?<input value={withdrawReason} maxLength={300}
       onChange={e=>setWithdrawReason(e.target.value)}/></label>
      <button type="button" disabled={busy||!!pending||withdrawReason.trim().length<8}
       onClick={()=>command("Publication withdrawal","pages/"+selected.pageRef+"/withdraw","POST",
        {expectedVersion:selected.version,reason:withdrawReason})}>
       {selected.scheduledAt?"Cancel scheduled publication / hide page":"Hide from public website"}</button>
     </>}
    </div>
    {selected&&<p className="cg-cms-muted">Current draft: {selected.status.replaceAll("_"," ")}.
     Public page: {selected.publicationStatus.replaceAll("_"," ")}.
     {selected.scheduledAt&&" Scheduled for "+new Date(selected.scheduledAt).toLocaleString()+"."}
     {selected.status==="SUBMITTED"&&" A different authorized reviewer must approve the exact draft."}</p>}
   </section>}
  </>}
 </div>;
}
