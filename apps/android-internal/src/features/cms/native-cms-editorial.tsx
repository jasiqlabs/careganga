import {useCallback,useEffect,useRef,useState} from "react";
import {ActivityIndicator,Alert,Pressable,ScrollView,StyleSheet,Text,TextInput,View}
 from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import * as Crypto from "expo-crypto";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";
import {NativeCmsMediaUploader} from "./native-cms-media-uploader";
import {NativeCmsReviewer} from "./native-cms-reviewer";
type Page={pageRef:string;kind:string;slug:string;title:string;
 version:string;draftStatus:string;publicStatus:string|null};
type Section={kind:string;order:number;fields:Record<string,unknown>};
type Asset={fileRef:string;version:number;role:string;altText:string;order:number};
type Navigation={loginDesired:boolean;memberJoinDesired:boolean;
 volunteerJoinDesired:boolean};
type Detail={pageRef:string;kind:string;slug:string;version:number;
 revisionRef:string;status:string;approvalCaseRef:string|null;
 title:string;seoTitle:string;seoDescription:string;canonicalPath:string;
 sections:Section[];assets:Asset[];navigation:Navigation|null;
 publicationStatus:string;scheduledAt:string|null};
// Same existing CMS editorial page types, slugs and initial section shapes as
// the original Web CmsExtendedWorkspace. These are draft defaults, not a
// second publication or independent CMS module.
type NewKind="HOME"|"ABOUT"|"IMPACT"|"COMPLIANCE"|"GALLERY"|"ARTICLE"|"CONTACT"|"HEALTHCARE"|"POLICY";
type NewPage={kind:NewKind;slug:string;title:string;seoTitle:string;
 seoDescription:string;sections:Section[];assets:Asset[];navigation?:Navigation};
const newKinds:NewKind[]=["HOME","ABOUT","IMPACT","COMPLIANCE","GALLERY","ARTICLE",
 "CONTACT","HEALTHCARE","POLICY"];
const legalPages=[["terms-and-conditions","Terms & Conditions"],
 ["privacy-policy","Privacy Policy"],["cookie-policy","Cookie Policy"],
 ["disclaimer","Disclaimer"],["refund-and-cancellation","Refund & Cancellation"],
 ["grievance-redressal","Grievance Redressal"],
 ["copyright-and-intellectual-property","Copyright & Intellectual Property"]];
const impactGroups=["HERO","PILLARS","STATS","GROWTH","GEOGRAPHY",
 "BREAKDOWN","FOCUS","STORIES","UPDATES","CTA"];
const day=()=>new Date().toISOString().slice(0,10);
const initialKind=(kind:NewKind):NewPage=>{
 const sections:Section[]=kind==="HOME"?[{kind:"HERO",order:0,fields:{
  heading:"",subtitle:"",description:"",eyebrow:"",visible:true,
  headingFont:"SERIF",headingWeight:"BOLD",headingSize:"LARGE",
  headingColor:"#FFE34A",subtitleColor:"#8CF442",tags:[]}}]:
 kind==="ABOUT"?[{kind:"RICH_TEXT",order:20,fields:{
  heading:"About the Foundation",body:"",variant:"STANDARD"}}]:
 kind==="IMPACT"?
  impactGroups.map((group,order)=>({kind:"IMPACT_GROUP",order,fields:{
   group,heading:"",intro:"",source:"",asOfDate:day(),items:[]}})):
 kind==="COMPLIANCE"?[{kind:"COMPLIANCE_FACTS",order:0,fields:{
   heading:"",summary:"",badgeText:"",subtitle:"",importantNote:"",
   issuer:"",pan:"",registrationNumber:"",approvalNumber:"",
   validFrom:"",validUntil:"",verifiedAsOf:day(),source:"",
   verification:"NOT_VERIFIED",
   disclaimer:"Check current official records before claiming a tax benefit.",
   documents:[]}}]:
 kind==="GALLERY"?[{kind:"GALLERY_GRID",order:0,fields:{
   heading:"",description:"",videosHeading:"Stories in Motion",
   videosDescription:"",publicationsHeading:"Publications & Reports",
   publicationsDescription:"",photosEmptyText:"",videosEmptyText:"",
   publicationsEmptyText:"",items:[]}}]:
 kind==="ARTICLE"?[{kind:"ARTICLE_BODY",order:0,fields:{
   heading:"",category:"",excerpt:"",body:"",authorLabel:"",
   source:"",asOfDate:day(),tags:[]}}]:
 kind==="CONTACT"?[
  {kind:"CONTACT_INFO",order:0,fields:{
   heroTitle:"Get In Touch",heroIntro:"",officeHours:"",mapUrl:"",
   inquiries:[{title:"General Inquiries",description:""},
    {title:"Volunteer With Us",description:""},
    {title:"CSR Partnerships",description:""}],faqs:[],socialLinks:[]}},
  {kind:"RICH_TEXT",order:1,fields:{
   heading:"Contact the Foundation",
   body:"Send a private message to CareGanga Foundation for general information.",
   eyebrow:"",variant:"STANDARD",highlights:[]}}]:
 kind==="POLICY"?[{kind:"RICH_TEXT",order:0,fields:{
   heading:legalPages[0][1],body:"",eyebrow:"",variant:"STANDARD",highlights:[]}}]:
 [{kind:"HERO",order:0,fields:{
   heading:"Healthcare Assistance",subtitle:"",description:"",eyebrow:"",
   tags:[],visible:true,headingFont:"SERIF",headingWeight:"BOLD",
   headingSize:"LARGE",headingColor:"#FFE34A",subtitleColor:"#8CF442"}},
  {kind:"HEALTHCARE_CATEGORIES",order:10,fields:{
   heading:"",intro:"",categories:[]}}];
 const slug=kind==="HOME"?"home":kind==="ABOUT"?"about":kind==="IMPACT"?"our-impact":kind==="COMPLIANCE"?"80g":
  kind==="POLICY"?legalPages[0][0]:kind.toLowerCase();
 return {kind,slug,title:kind==="POLICY"?legalPages[0][1]:"",
  seoTitle:"",seoDescription:"",sections,assets:[],
  ...(kind==="HOME"?{navigation:{loginDesired:true,
   memberJoinDesired:false,volunteerJoinDesired:false}}:{})};
};
const canonicalFor=(kind:NewKind,slug:string)=>kind==="HOME"?"/":
 kind==="ABOUT"?"/about":kind==="COMPLIANCE"?
 "/ngo-information":kind==="ARTICLE"?"/blog/"+slug:
 kind==="POLICY"?"/policies/"+slug:"/"+slug;
type Props={token:string;canManage:boolean;canPublish:boolean;
 canReview:boolean;
 onExit:()=>void;onExpired:()=>void};
type Command={kind:string;key:string;path:string;
 method:"PUT"|"POST";payload:Record<string,unknown>};
const title=(name:string)=>name.replaceAll("_"," ").replace(/([a-z])([A-Z])/g,"$1 $2")
 .replace(/\b\w/g,c=>c.toUpperCase());
async function api<T>(token:string,path:string,method:"GET"|"PUT"|"POST"="GET",
 body?:Record<string,unknown>):Promise<T>{
 const response=await identityRequest("/api/cms/"+path,{
  method,cache:"no-store",headers:{Authorization:"Bearer "+token,
   ...(body?{"Content-Type":"application/json"}:{})},
  ...(body?{body:JSON.stringify(body)}:{})});
 if(!response.ok)throw Object.assign(new Error(
  response.status===401?"Sign in again.":
  response.status===403?"Your Foundation CMS permission does not allow this action.":
  response.status===409?"Original page changed or was already reviewed. Reload before retrying.":
  "The original CMS outcome cannot be verified."
 ),{status:response.status});
 return response.json() as Promise<T>;
}
const button=(label:string,run:()=>void,disabled=false)=>
 <Pressable accessibilityRole="button" accessibilityState={{disabled}}
  disabled={disabled} onPress={run}
  style={[styles.button,disabled&&styles.disabled]}>
  <Text style={styles.text}>{label}</Text>
 </Pressable>;
/** Native first-item defaults mirror current CG18 validated extended sections.
 * Real-person consent is NEVER pre-confirmed and no future module is created.
 */
const listLimit=(name:string,section?:string)=>name==="faqs"?8:
 name==="socialLinks"||name==="inquiries"?3:name==="categories"?12:
 name==="documents"?6:name==="tags"?8:name==="items"?
 section==="GALLERY_GRID"?12:16:24;
const initialListItem=(name:string,section?:string,group?:string):
 Record<string,unknown>|null=>{
 if(name==="faqs")return {question:"",answer:""};
 if(name==="socialLinks")return {network:"Facebook",url:""};
 if(name==="inquiries")return {title:"",description:""};
 if(name==="categories"&&section==="HEALTHCARE_CATEGORIES")
  return {title:"",description:""};
 if(name==="documents"&&section==="COMPLIANCE_FACTS")
  return {type:"OTHER",title:"",asOfDate:day()};
 if(name==="items"&&section==="GALLERY_GRID")
  return {title:"",caption:"",category:"",mediaType:"PHOTO",source:"",
   asOfDate:day(),visible:true};
 if(name==="items"&&section==="IMPACT_GROUP"){
  const v:Record<string,unknown>={title:"",description:""};
  if(group==="STATS")v.value=0;
  if(group==="GROWTH"){v.value=0;v.year=new Date().getUTCFullYear()}
  if(group==="BREAKDOWN")v.percentage=0;
  if(group==="STORIES")v.consentConfirmed=false;
  return v;
 }
 return null;
};
type FieldProps={name:string;value:unknown;onChange:(value:unknown)=>void;
 locked:boolean;depth?:number;sectionKind?:string;impactGroup?:string};
function EditField({name,value,onChange,locked,depth=0,
 sectionKind,impactGroup}:FieldProps){
 if(depth>4)return <Text style={styles.note}>Additional protected content is preserved.</Text>;
 if(typeof value==="boolean")return button((value?"✓ ":"")+title(name),
  ()=>onChange(!value),locked);
 if(typeof value==="number"&&Number.isFinite(value))
  return <View style={styles.field}>
   <Text style={styles.note}>{title(name)}</Text>
   <TextInput style={styles.input} accessibilityLabel={title(name)}
    value={String(value)} editable={!locked} keyboardType="numeric"
    onChangeText={v=>{if(/^\d{0,10}$/.test(v))
     onChange(v===""?0:Number(v));}}/>
  </View>;
 if(typeof value==="string")return <View style={styles.field}>
  <Text style={styles.note}>{title(name)}</Text>
  <TextInput style={styles.input} accessibilityLabel={title(name)}
   value={value} onChangeText={onChange} editable={!locked}
   multiline={value.length>160||["body","description","bio","summary"].includes(name)}
   maxLength={name.toLowerCase().includes("description")?3000:5000}/>
 </View>;
 if(Array.isArray(value)){
  const initial=initialListItem(name,sectionKind,impactGroup);
  const cap=listLimit(name,sectionKind);
  const allText=!initial&&value.every(x=>typeof x==="string");
  const allObjects=value.every(x=>x&&typeof x==="object"&&!Array.isArray(x));
  return <View style={styles.nested}>
   <Text style={styles.heading}>{title(name)} ({value.length}/{cap})</Text>
   {value.map((v,i)=><View style={styles.nested} key={i}>
    <Text style={styles.note}>Item {i+1}</Text>
    <EditField name={Array.isArray(v)?"List":name.slice(0,-1)||"Item"}
     value={v} locked={locked} depth={depth+1}
     sectionKind={sectionKind} impactGroup={impactGroup}
     onChange={next=>onChange(value.map((x,j)=>j===i?next:x))}/>
    {button("Remove item "+(i+1),()=>onChange(value.filter((_,j)=>i!==j)),locked)}
   </View>)}
   {value.length<cap&&allText&&
    button("Add list item",()=>onChange([...value,""]),locked)}
   {value.length===0&&initial&&
    button("Add "+title(name)+" item",()=>onChange([initial]),locked)}
   {value.length>0&&value.length<cap&&allObjects&&
    button("Add another "+title(name),()=>onChange([...value,
     Object.fromEntries(Object.entries(value[value.length-1] as Record<string,unknown>)
      .map(([k,x])=>[k,typeof x==="string"?"":typeof x==="number"?0:
        typeof x==="boolean"?false:Array.isArray(x)?[]:x]))]),locked)}
  </View>;
 }
 if(value&&typeof value==="object"){
  const fields=value as Record<string,unknown>;
  return <View style={styles.nested}>
   <Text style={styles.heading}>{title(name)}</Text>
   {Object.entries(fields).map(([k,v])=>
    <EditField key={k} name={k} value={v} locked={locked} depth={depth+1}
     sectionKind={sectionKind} impactGroup={impactGroup}
     onChange={next=>onChange({...fields,[k]:next})}/>)}
  </View>;
 }
 return <Text style={styles.note}>{title(name)}: No value recorded</Text>;
}
export function NativeCmsEditorial({token,canManage,canPublish,canReview,onExit,
 onExpired}:Props){
 const [pages,setPages]=useState<Page[]>([]);
 const [selected,setSelected]=useState<Detail|null>(null);
 const [newPage,setNewPage]=useState<NewPage|null>(null);
 const [draft,setDraft]=useState<Detail|null>(null);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [uncertain,setUncertain]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [withdrawReason,setWithdrawReason]=useState("");
 const [schedule,setSchedule]=useState("");
 const [pending,setPending]=useState<Command|null>(null);
 const turn=useRef(0);
 const fail=useCallback((e:unknown)=>{
  if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
  if(!(e&&typeof e==="object"&&"status" in e&&
   typeof e.status==="number"&&e.status<500))setUncertain(true);
  setError(e instanceof Error?e.message:"The original CMS outcome is uncertain.");
 },[onExpired]);
 // A failed GET is not an uncertain mutation. Keep any earlier original
 // idempotency key while the user explicitly resolves that mutation.
 const readFailure=useCallback((e:unknown)=>{
  if(e&&typeof e==="object"&&"status" in e&&e.status===401)
   onExpired();
  setError(e instanceof Error?e.message:
   "Current Foundation CMS page details could not be refreshed.");
 },[onExpired]);
 const list=useCallback(async()=>{
  const response=await api<{pages:Page[]}>(token,"pages");
  if(!response||!Array.isArray(response.pages)||response.pages.length>100)
   throw Error("Current Foundation editorial pages cannot be verified.");
  setPages(response.pages);
 },[token]);
 const open=useCallback(async(ref:string)=>{
  const page=await api<Detail>(token,"pages/"+encodeURIComponent(ref));
  if(!page||!Array.isArray(page.sections)||!Array.isArray(page.assets)||
   !page.pageRef||!Number.isSafeInteger(page.version))
   throw Error("The original CMS revision is incomplete.");
  setNewPage(null);
  setSelected(page);setDraft(JSON.parse(JSON.stringify(page)) as Detail);
  setUncertain(false);setPending(null);setSchedule("");
 },[token]);
 useEffect(()=>{
  const rev=++turn.current;setLoading(true);
  void list().catch(e=>{if(turn.current===rev)readFailure(e)})
   .finally(()=>{if(turn.current===rev)setLoading(false)});
  return()=>{turn.current++};
 },[list,readFailure]);
 const content=(v:Detail)=>({
  kind:v.kind,slug:v.slug,title:v.title,seoTitle:v.seoTitle,
  seoDescription:v.seoDescription,canonicalPath:v.canonicalPath,
  sections:v.sections,assets:v.assets,
  ...(v.kind==="HOME"&&v.navigation?{navigation:v.navigation}:{})
 });
 function modified(){
  return !!selected&&!!draft&&JSON.stringify(content(selected))!==
   JSON.stringify(content(draft));
 }
 async function execute(cmd:Command){
  if(busy)return;
  setBusy(true);setError("");setNotice("");setPending(cmd);
  try{
   const outcome=await api<{confirmed:boolean;pageRef?:string;status?:string}>(
    token,cmd.path,cmd.method,{requestKey:cmd.key,...cmd.payload});
   if(!outcome.confirmed)
    throw Error("The original Foundation CMS did not confirm this action.");
   // The server has definitively committed THIS command; a later list or
   // detail GET cannot make the write outcome unknown or revive its key.
   setUncertain(false);setPending(null);
   setNotice("Confirmed original editorial state: "+(outcome.status??"Saved"));
   try{
    await list();
    await open(outcome.pageRef??selected?.pageRef??"");
   }catch(refreshError){
    // A confirmed CREATE must not leave its old creation form available to
    // accidentally resubmit the same page under a new request key.
    setSelected(null);setDraft(null);setNewPage(null);
    if(refreshError&&typeof refreshError==="object"&&
      "status" in refreshError&&refreshError.status===401)onExpired();
    setError("This original CMS action is CONFIRMED, but its latest page "+
     "could not be refreshed. Refresh the page list before editing again.");
   }
  }catch(e){
   if(e&&typeof e==="object"&&"status" in e&&
    typeof e.status==="number"&&e.status<500)
    setPending(null);
   fail(e);
  }finally{setBusy(false)}
 }
 const perform=(kind:string,method:"PUT"|"POST",path:string,
  payload:Record<string,unknown>)=>{
  if(busy||uncertain)return;
  const action:Command={kind,key:Crypto.randomUUID(),method,path,payload};
  void execute(action);
 };
 const newContent=(p:NewPage)=>({
  kind:p.kind,slug:p.slug,title:p.title,
  seoTitle:p.seoTitle.trim()||p.title,
  seoDescription:p.seoDescription,canonicalPath:canonicalFor(p.kind,p.slug),
  sections:p.sections,assets:p.assets,
  ...(p.kind==="HOME"&&p.navigation?{navigation:p.navigation}:{})
 });
 const create=()=>{
  if(!canManage||!newPage||busy||uncertain)return;
  if(newPage.title.trim().length<3||
   !/^[a-z0-9][a-z0-9-]{0,69}$/.test(newPage.slug)){
   setError("Enter a page title and a valid original page slug.");return;
  }
  Alert.alert("Create unpublished Foundation CMS draft?",
   "Only the original CG18 page will be created. Independent approval is required to publish.",[
    {text:"Cancel",style:"cancel"},
    {text:"Create draft",onPress:()=>perform("create","POST","pages",
     {content:newContent(newPage)})}
   ]);
 };
 const changeNew=(patch:Partial<NewPage>)=>setNewPage(old=>old?{...old,...patch}:null);
 const change=<K extends keyof Detail,>(k:K,v:Detail[K])=>
  setDraft(current=>current?{...current,[k]:v}:null);
 const replaceSection=(i:number,fields:Record<string,unknown>)=>
  setDraft(current=>current?{...current,sections:current.sections.map(
   (x,j)=>j===i?{...x,fields}:x)}:null);
 const locked=!canManage||busy||uncertain;
 const original=selected?.pageRef??"";
 return <SafeAreaView style={styles.page}>
  <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
   <Text accessibilityRole="header" style={styles.title}>Foundation Website Content</Text>
   <Text style={styles.note}>Original CG18 pages and revisions. Drafts are not
    public until independent approval and actual publication.</Text>
   {button("Back to dashboard",onExit)}
   {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
   {!!notice&&<Text accessibilityRole="alert" style={styles.note}>{notice}</Text>}
   {loading&&<ActivityIndicator accessibilityLabel="Loading original CMS pages"/>}
   {canReview&&<NativeCmsReviewer token={token} onExpired={onExpired} onDone={list}/>}
   {uncertain&&<Text style={styles.error}>The last save or publication may
    have committed. Check the original page before trying another request.</Text>}
   {button("Refresh original CMS pages",()=>{
    setLoading(true);setError("");
    // A list GET is not proof that an earlier uncertain write was ours.
    // Preserve the original request key until a same-key reply confirms it.
    void list().catch(readFailure).finally(()=>setLoading(false));
   },busy)}
   {pending&&button("Retry same original request",()=>{
    setUncertain(false);void execute(pending);
   },busy)}
   <Text style={styles.heading}>Managed public pages</Text>
   {!pages.length&&!loading&&<Text style={styles.note}>
    No original Foundation editorial pages recorded.</Text>}
   {pages.map(p=><View key={p.pageRef}>
    {button(p.title+" · "+title(p.kind)+" · Draft "+title(p.draftStatus)+
     " · Public "+title(p.publicStatus??"Not published"),()=>{
      if(busy)return;
      setError("");void open(p.pageRef).catch(readFailure);
     },busy||uncertain)}
   </View>)}
   {canManage&&!newPage&&button("Create a new original Foundation page",()=>{
    setSelected(null);setDraft(null);setError("");
    setNewPage(initialKind("ARTICLE"));
   },busy||uncertain)}
   {canManage&&newPage&&<View style={styles.panel}>
    <Text style={styles.heading}>Create an unpublished original CMS draft</Text>
    <Text style={styles.note}>Uses the original Web CMS page kinds and strict
     server template validation. A new draft is never automatically public.</Text>
    <Text style={styles.heading}>Existing page type</Text>
    <View style={styles.row}>{newKinds.map(k=>
     <View key={k}>{button((newPage.kind===k?"✓ ":"")+title(k),()=>{
      setNewPage(initialKind(k));setError("");},busy||uncertain)}</View>)}</View>
    {newPage.kind==="POLICY"&&<View style={styles.panel}>
     <Text style={styles.heading}>Existing legal-page type</Text>
     {legalPages.map(([slug,heading])=>button(
      (newPage.slug===slug?"✓ ":"")+heading,()=>changeNew({
       slug,title:heading,sections:newPage.sections.map(x=>({
        ...x,fields:{...x.fields,heading}}))}),busy||uncertain))}
    </View>}
    <EditField name="Public page slug" value={newPage.slug} locked={locked}
     onChange={v=>changeNew({slug:String(v).trim().toLowerCase()})}/>
    <EditField name="Page title" value={newPage.title} locked={locked}
     onChange={v=>changeNew({title:String(v)})}/>
    <EditField name="Search title" value={newPage.seoTitle} locked={locked}
     onChange={v=>changeNew({seoTitle:String(v)})}/>
    <EditField name="Search description" value={newPage.seoDescription}
     locked={locked} onChange={v=>changeNew({seoDescription:String(v)})}/>
    {newPage.kind==="HOME"&&newPage.navigation&&
     <EditField name="Approved original navigation choices" value={newPage.navigation}
      locked={locked} onChange={v=>changeNew({navigation:v as Navigation})}/>}
    {newPage.sections.map((sec,i)=><View key={sec.kind+"-"+i} style={styles.panel}>
     <Text style={styles.heading}>{title(sec.kind)}</Text>
     <EditField name="Source content" value={sec.fields} locked={locked}
      sectionKind={sec.kind}
      impactGroup={typeof sec.fields.group==="string"?sec.fields.group:""}
      onChange={v=>setNewPage(old=>old?{...old,
       sections:old.sections.map((x,j)=>i===j?{...x,
        fields:v as Record<string,unknown>}:x)}:null)}/>
    </View>)}
    {button("Create original unpublished page draft",create,
     locked||newPage.title.trim().length<3)}
    {button("Cancel page creation",()=>{
     setNewPage(null);setError("");},busy)}
   </View>}
   {draft&&selected&&<View style={styles.panel}>
    <Text style={styles.heading}>{draft.title}</Text>
    <Text style={styles.note}>Original page: {title(draft.kind)} ·
     Draft: {title(selected.status)} ·
     Publication: {title(selected.publicationStatus)}</Text>
    <EditField name="Page title" value={draft.title} locked={locked}
     onChange={v=>change("title",v as string)}/>
    <EditField name="Search title" value={draft.seoTitle} locked={locked}
     onChange={v=>change("seoTitle",v as string)}/>
    <EditField name="Search description" value={draft.seoDescription} locked={locked}
     onChange={v=>change("seoDescription",v as string)}/>
    {draft.navigation&&<View style={styles.nested}>
     <Text style={styles.heading}>Approved navigation requests</Text>
     <EditField name="Navigation" value={draft.navigation}
      locked={locked} onChange={v=>change("navigation",v as Navigation)}/>
    </View>}
    {draft.sections.map((section,i)=><View key={section.kind+"-"+section.order}
     style={styles.panel}>
      <Text style={styles.heading}>{title(section.kind)} · Section {i+1}</Text>
      <EditField name="Original section fields" value={section.fields}
       sectionKind={section.kind}
       impactGroup={typeof section.fields.group==="string"?section.fields.group:""}
       onChange={v=>replaceSection(i,v as Record<string,unknown>)}
       locked={locked}/>
    </View>)}
    <Text style={styles.note}>Original scanner-verified placements: {draft.assets.length}</Text>
    {canManage&&selected.status==="DRAFT"&&
     <NativeCmsMediaUploader token={token} kind={selected.kind}
      sections={draft.sections}
      pageRef={selected.pageRef} revisionRef={selected.revisionRef}
      assets={draft.assets} onExpired={onExpired} disabled={locked}
      onChange={assets=>change("assets",assets)}/>}

    {canManage&&button(selected.status==="DRAFT"?
     "Save original unpublished draft":"Create next unpublished revision",()=>{
     if(!draft||!selected)return;
     Alert.alert("Save original CMS revision?",
      "Only the Foundation-approved reviewer can later publish this content.",[
       {text:"Cancel",style:"cancel"},
       {text:"Save",onPress:()=>perform("save","PUT","pages/"+original+"/draft",
        {expectedVersion:selected.version,content:content(draft)})}
      ]);
    },locked||!modified())}
    {canManage&&selected.status==="DRAFT"&&
     button("Submit saved original revision to independent review",()=>{
      Alert.alert("Request independent review?",
       "Only the currently saved revision is submitted.",[
        {text:"Cancel",style:"cancel"},
        {text:"Submit",onPress:()=>perform("submit","POST",
         "pages/"+original+"/submit",{expectedVersion:selected.version})}
       ]);
     },locked||modified())}
    {canPublish&&selected.status==="SUBMITTED"&&selected.approvalCaseRef&&<>
     <Text style={styles.note}>Optional publish date-time (ISO; leave empty for now)</Text>
     <TextInput style={styles.input} value={schedule} onChangeText={setSchedule}
      editable={!busy&&!uncertain} placeholder="2026-11-21T17:00:00+05:30"/>
     {button("Publish original independently approved revision",()=>{
      if(schedule&&(!Number.isFinite(Date.parse(schedule))||
       Date.parse(schedule)<Date.now()+60000)){
       setError("Choose a valid future schedule or leave it blank.");return;
      }
      Alert.alert("Publish approved Foundation page?",
       "Only the approved and verified original revision becomes public.",[
        {text:"Cancel",style:"cancel"},
        {text:"Publish",onPress:()=>perform("publish","POST",
         "pages/"+original+"/publish",{expectedVersion:selected.version,
         caseRef:selected.approvalCaseRef,
         ...(schedule?{publishAt:new Date(schedule).toISOString()}:{})})}
       ]);
     },busy||uncertain||modified())}
    </>}
    {canPublish&&(selected.publicationStatus==="EFFECTIVE"||
     selected.scheduledAt)&&<>
      <TextInput accessibilityLabel="Reason for withdrawing public page"
       style={styles.input} value={withdrawReason}
       editable={!busy&&!uncertain} maxLength={400}
       placeholder="Why must this public page be withdrawn?"
       onChangeText={setWithdrawReason}/>
      {button("Withdraw existing public page",()=>Alert.alert(
       "Withdraw this publication?","The existing published page will be hidden.",[
        {text:"Cancel",style:"cancel"},
        {text:"Withdraw",style:"destructive",onPress:()=>perform("withdraw",
         "POST","pages/"+original+"/withdraw",
         {expectedVersion:selected.version,reason:withdrawReason.trim()})}
       ]),busy||uncertain||withdrawReason.trim().length<8)}
     </>}
   </View>}
  </ScrollView>
 </SafeAreaView>;
}
const styles=StyleSheet.create({
 page:{flex:1,backgroundColor:t.adminCanvas},
 content:{padding:15,paddingBottom:90,gap:12},
 title:{fontSize:21,fontWeight:"700",color:t.text},
 heading:{fontSize:16,fontWeight:"700",color:t.text},
 text:{fontSize:13,fontWeight:"600",color:t.text},
 note:{fontSize:13,color:t.mutedText,lineHeight:19},
 panel:{borderWidth:1,borderColor:t.border,backgroundColor:t.surface,
  borderRadius:12,padding:11,gap:8},
 nested:{gap:8,padding:8,borderWidth:1,borderColor:t.border,borderRadius:9},
 row:{flexDirection:"row",flexWrap:"wrap",gap:6},
 field:{gap:4},
 input:{borderWidth:1,borderColor:t.border,borderRadius:9,
  backgroundColor:t.surface,padding:10,color:t.text,minHeight:44},
 button:{borderWidth:1,borderColor:t.border,borderRadius:9,
  minHeight:45,padding:10,justifyContent:"center"},
 disabled:{opacity:.45},error:{fontSize:13,color:"#A52626"}
});
