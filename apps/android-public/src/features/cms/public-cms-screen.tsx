import {useCallback,useEffect,useRef,useState} from "react";
import {ActivityIndicator,AppState,BackHandler,Image,Pressable,
 StyleSheet,Text,TextInput,View} from "react-native";
import {careGangaPublicTheme as t} from "../../../../../packages/design-tokens/src/index";
import {CmsPublicExtendedSection} from "./cms-extended-native-screen";
import {NativeMembershipPlans} from "../membership/native-membership-plans";
import {NativeNewsletterForm} from "./native-newsletter-form";
import {NativePublicCampaigns} from "./native-public-campaigns";
type Fields=Record<string,unknown>;
type Section={kind:string;order:number;fields:Fields};
type Asset={role:string;altText:string;src:string;order:number};
type CmsSource={schemaVersion:number;effectiveGeneration:string;kind:string;
 slug:string;title:string;seoTitle:string;seoDescription:string;
 lastPublishedAt:string;sections:Section[];assets:Asset[]};
type Result={state:"PUBLISHED"|"NOT_PUBLISHED"|"UNAVAILABLE";page:CmsSource|null};
const base=process.env.EXPO_PUBLIC_API_URL;
const legalPages=[
 ["terms-and-conditions","Terms & Conditions"],["privacy-policy","Privacy Policy"],
 ["cookie-policy","Cookie Policy"],["disclaimer","Disclaimer"],
 ["refund-and-cancellation","Refund & Cancellation"],
 ["grievance-redressal","Grievance Redressal"],
 ["copyright-and-intellectual-property","Copyright & Intellectual Property"]
] as const;
const isPolicySlug=(s:string)=>legalPages.some(x=>x[0]===s);
const text=(v:unknown)=>typeof v==="string"?v:"";
const safeColor=(v:unknown,fallback:string)=>/^#[a-fA-F0-9]{6}$/.test(text(v))?text(v):fallback;
const local=(v:unknown)=>{
 const route=text(v);
 return ["/","/about","/contact","/our-impact","/ngo-information","/gallery","/videos","/publications","/healthcare","/our-work","/upcoming-projects","/collaboration","/membership","/volunteer","/campaigns"].includes(route)?route:null;
};
async function published(slug:string):Promise<Result>{
 if(!/^[a-z0-9][a-z0-9-]{0,69}$/.test(slug))return {state:"NOT_PUBLISHED",page:null};
 if(!base||!/^https?:\/\//.test(base)||
   (process.env.NODE_ENV==="production"&&!base.startsWith("https://")))
  return {state:"UNAVAILABLE",page:null};
 try{
  const result=await fetch(new URL("/api/public/content/pages/"+slug,base).toString(),
   {cache:"no-store",signal:AbortSignal.timeout(9000)});
  if(result.status===404)return {state:"NOT_PUBLISHED",page:null};
  if(!result.ok)return {state:"UNAVAILABLE",page:null};
  const raw:unknown=await result.json();
  if(!raw||typeof raw!=="object"||Array.isArray(raw))throw Error();
  const data=raw as Record<string,unknown>;
  if(data.schemaVersion!==1||data.slug!==slug||
     data.kind!==({home:"HOME",about:"ABOUT","our-impact":"IMPACT",
       "80g":"COMPLIANCE",gallery:"GALLERY",contact:"CONTACT",healthcare:"HEALTHCARE","our-work":"PROJECTS","upcoming-projects":"PROJECTS",collaboration:"PARTNERS"} as Record<string,string>)[slug]&&
       !(data.kind==="POLICY"&&isPolicySlug(slug))&&
       !(data.kind==="ARTICLE"&&
         !["home","about","our-impact","80g","gallery","contact","healthcare","our-work","upcoming-projects","collaboration"].includes(slug)&&
         !isPolicySlug(slug))||
     typeof data.title!=="string"||!Array.isArray(data.sections)||
     !Array.isArray(data.assets)||typeof data.effectiveGeneration!=="string")
   throw Error();
  return {state:"PUBLISHED",page:raw as CmsSource};
 }catch{return {state:"UNAVAILABLE",page:null};}
}
type Article={slug:string;title:string;category:string;excerpt:string;asOfDate:string;path:string};
async function publishedArticles(eventsOnly=false,cursor=""):Promise<{available:boolean;posts:Article[];nextCursor:string|null}>{
 if(!base||!/^https?:\/\//.test(base)||
  (process.env.NODE_ENV==="production"&&!base.startsWith("https://")))
  return {available:false,posts:[],nextCursor:null};
 try{
  const url=new URL(eventsOnly?"/api/public/content/events":"/api/public/content/articles",base);
  if(cursor)url.searchParams.set("cursor",cursor);
  const r=await fetch(url.toString(),
   {cache:"no-store",signal:AbortSignal.timeout(9000)});
  if(!r.ok)throw Error();
  const v:unknown=await r.json();
  if(!v||typeof v!=="object"||!("posts" in v)||!Array.isArray(v.posts))throw Error();
  return {available:true,posts:(v.posts as Article[]).filter(a=>a&&
   typeof a.slug==="string"&&/^[a-z0-9][a-z0-9-]{0,69}$/.test(a.slug)&&
   a.path==="/blog/"+a.slug).slice(0,20),nextCursor:"nextCursor" in v&&typeof v.nextCursor==="string"&&/^[a-z0-9][a-z0-9-]{0,69}$/.test(v.nextCursor)?v.nextCursor:null};
 }catch{return {available:false,posts:[],nextCursor:null};}
}
type Notice={title:string;body:string;category:string;
 priority:"NORMAL"|"IMPORTANT";publishedOn:string;expiresOn:string;path:string};
async function publishedNotices():Promise<{available:boolean;notices:Notice[]}>{
 if(!base||!/^https?:\/\//.test(base)||
   (process.env.NODE_ENV==="production"&&!base.startsWith("https://")))
  return {available:false,notices:[]};
 try{
  const r=await fetch(new URL("/api/public/content/notices",base).toString(),
   {cache:"no-store",signal:AbortSignal.timeout(9000)});
  if(!r.ok)throw Error();
  const raw:unknown=await r.json();
  if(!raw||typeof raw!=="object"||Array.isArray(raw))throw Error();
  const data=raw as Record<string,unknown>;
  if(data.schemaVersion!==1||!Array.isArray(data.notices)||data.notices.length>60)
   throw Error();
  const valid=(n:unknown):n is Notice=>{
   if(!n||typeof n!=="object"||Array.isArray(n))return false;
   const item=n as Record<string,unknown>;
   return typeof item.title==="string"&&item.title.length<=120&&
    typeof item.body==="string"&&item.body.length<=480&&
    typeof item.category==="string"&&item.category.length<=80&&
    (item.priority==="IMPORTANT"||item.priority==="NORMAL")&&
    typeof item.publishedOn==="string"&&
    /^\d{4}-\d{2}-\d{2}$/.test(item.publishedOn)&&
    typeof item.expiresOn==="string"&&
    /^\d{4}-\d{2}-\d{2}$/.test(item.expiresOn)&&
    typeof item.path==="string"&&
    /^\/blog\/[a-z0-9-]{1,70}$/.test(item.path);
  };
  if(!data.notices.every(valid))throw Error();
  return {available:true,notices:data.notices};
 }catch{return {available:false,notices:[]};}
}
async function publishedNavigation():Promise<{login:boolean;paths:string[];member:boolean;volunteer:boolean}>{
 if(!base||!/^https?:\/\//.test(base)||
  (process.env.NODE_ENV==="production"&&!base.startsWith("https://")))
  return {login:false,paths:[],member:false,volunteer:false};
 try{
  const r=await fetch(new URL("/api/public/content/navigation",base).toString(),
   {cache:"no-store",signal:AbortSignal.timeout(9000)});
  if(!r.ok)throw Error();
  const result:unknown=await r.json();
  if(!result||typeof result!=="object"||!("schemaVersion" in result)||
    result.schemaVersion!==1)return {login:false,paths:[],member:false,volunteer:false};
  const data=result as {login?:{visible?:boolean};memberJoin?:{visible?:boolean;path?:string};volunteerJoin?:{visible?:boolean;path?:string};publishedRoutes?:{path:string}[]};
  const valid=new Set(["/about","/our-impact","/ngo-information","/gallery","/contact","/healthcare","/our-work","/upcoming-projects","/collaboration","/campaigns",
   ...legalPages.map(([slug])=>"/policies/"+slug)]);
  const paths=Array.isArray(data.publishedRoutes)?data.publishedRoutes
   .map(p=>p.path).filter(p=>typeof p==="string"&&
    (valid.has(p)||/^\/blog\/[a-z0-9-]{1,70}$/.test(p))).slice(0,100):[];
  return {login:data.login?.visible===true,
   member:data.memberJoin?.visible===true&&data.memberJoin?.path==="/membership",
   volunteer:data.volunteerJoin?.visible===true&&data.volunteerJoin?.path==="/volunteer",paths};
 }catch{return {login:false,paths:[],member:false,volunteer:false};}
}
function CmsButton({title,onPress,secondary=false}:{
 title:string;onPress:()=>void;secondary?:boolean}){
 return <Pressable accessibilityRole="button" onPress={onPress}
  style={[styles.action,secondary&&styles.secondary]}>
  <Text style={[styles.actionText,secondary&&styles.secondaryText]}>{title}</Text>
 </Pressable>;
}
/** Public Android receives the same original immutable public DTO as Next.js.
 * Revalidate on foreground; neither old cache nor a guessed CG04 Join is shown.
 */
function NativeTeamDirectory(){
 const [people,setPeople]=useState<{name:string;designation:string}[]>([]),[name,setName]=useState(""),[designation,setDesignation]=useState("");
 const [loading,setLoading]=useState(true),[unavailable,setUnavailable]=useState(false);
 const request=useRef(0);
 const refresh=useCallback(async()=>{
  const key=++request.current;setLoading(true);setPeople([]);setUnavailable(false);
  const results=await Promise.all([published("about"),published("home")]);
  if(key!==request.current)return;
  const out:{name:string;designation:string}[]=[];
  for(const r of results)if(r.state==="PUBLISHED"&&r.page)
   for(const sec of r.page.sections)if(sec.kind==="TEAM"&&Array.isArray(sec.fields.members))
    for(const p of sec.fields.members)if(p&&p.consentConfirmed===true&&typeof p.name==="string"&&typeof p.designation==="string"&&!out.some(x=>x.name===p.name&&x.designation===p.designation))out.push({name:p.name,designation:p.designation});
  setPeople(out);setUnavailable(results.some(r=>r.state==="UNAVAILABLE"));setLoading(false);
 },[]);
 useEffect(()=>{void refresh();const sub=AppState.addEventListener("change",state=>{if(state==="active")void refresh();});return()=>{request.current++;sub.remove();};},[refresh]);
 const filtered=people.filter(p=>(!name.trim()||p.name.toLowerCase().includes(name.trim().toLowerCase()))&&(!designation||p.designation===designation));
 return <View style={styles.card}><Text accessibilityRole="header" style={styles.heading}>Team Directory</Text>
  <Text style={styles.body}>Only independently published, currently consented names and designations are displayed.</Text>
  <TextInput accessibilityLabel="Search by name" placeholder="Search by name" maxLength={120} value={name} onChangeText={setName} style={{borderWidth:1,borderRadius:8,padding:10}}/>
  <View style={styles.nav}>{["",...new Set(people.map(p=>p.designation))].map(v=><CmsButton key={v} title={v||"All designations"} secondary={designation!==v} onPress={()=>setDesignation(v)}/>)}</View>
  <CmsButton title="Reset filters" secondary onPress={()=>{setName("");setDesignation("");}}/><CmsButton title="Refresh current profiles" secondary onPress={()=>void refresh()}/>
  {unavailable&&<Text accessibilityRole="alert">Some approved team information could not be verified.</Text>}
  {loading?<ActivityIndicator/>:filtered.length?filtered.map((p,i)=><View key={i} style={styles.person}><Text style={styles.heading}>{p.name}</Text><Text style={styles.role}>{p.designation}</Text></View>):<Text>No currently approved matching profiles.</Text>}
 </View>;
}
export function PublicCmsContent({onContact,onPartnerApplication,onMembershipApply,onVolunteerApply,onLoginVisibility,onHealthcareDirectory,onPatientProfile}: {
 onContact:()=>void;onPartnerApplication:()=>void;onMembershipApply:(planCode:string)=>void;onVolunteerApply:()=>void;
 onLoginVisibility:(visible:boolean)=>void;onHealthcareDirectory:(category?:string)=>void;onPatientProfile:()=>void}){
 const [slug,setSlug]=useState("home"),[projectCategory,setProjectCategory]=useState("All Projects");
 const [mediaScope,setMediaScope]=useState<"PHOTO"|"VIDEO"|"PUBLICATION">("PHOTO");
 const [ngoScope,setNgoScope]=useState<"80g"|"pan-details"|
  "registration-certificate"|"annual-reports">("80g");
 const [policiesExpanded,setPoliciesExpanded]=useState(false);
 const [publishedPaths,setPublishedPaths]=useState<string[]>([]);
 const [volunteerJoin,setVolunteerJoin]=useState(false);
 const [memberJoin,setMemberJoin]=useState(false);
 const [articleFeed,setArticleFeed]=useState<{available:boolean;posts:Article[];nextCursor?:string|null}>({
  available:false,posts:[]});
 const [noticeFeed,setNoticeFeed]=useState<{available:boolean;notices:Notice[]}>({
  available:false,notices:[]});
 const [noticeSearch,setNoticeSearch]=useState("");
 const [noticeCategory,setNoticeCategory]=useState("ALL");
 const [noticePriority,setNoticePriority]=useState("ALL");
 const [articleBackTarget,setArticleBackTarget]=useState<"articles"|"notices"|"@events">("articles");
 const [activeSlide,setActiveSlide]=useState(0);
 const [result,setResult]=useState<Result>({state:"UNAVAILABLE",page:null});
 const [loading,setLoading]=useState(true);
 const [loadedTarget,setLoadedTarget]=useState("");
 const [footerSource,setFooterSource]=useState<{target:string;page:CmsSource|null}>({target:"",page:null});
 const latestFooterRequest=useRef(0);
 const refreshFooter=useCallback(async(target:string)=>{
  const request=++latestFooterRequest.current;
  setFooterSource({target,page:null});
  const home=await published("home");
  if(request===latestFooterRequest.current)setFooterSource({target,page:home.state==="PUBLISHED"?home.page:null});
 },[]);
 const latestPageRequest=useRef(0);
 const latestNavRequest=useRef(0);
 const refreshNavigation=useCallback(async()=>{
  const request=++latestNavRequest.current;
  onLoginVisibility(false);setVolunteerJoin(false);setMemberJoin(false);setPublishedPaths([]);
  const nav=await publishedNavigation();
  if(request===latestNavRequest.current){
   onLoginVisibility(nav.login);setPublishedPaths(nav.paths);
   setVolunteerJoin(nav.volunteer);setMemberJoin(nav.member);
  }
 },[onLoginVisibility]);
 const load=useCallback(async(target:string,cursor="")=>{
  const request=++latestPageRequest.current;
  setLoading(true);setActiveSlide(0);
  if(target==="membership"){setResult({state:"UNAVAILABLE",page:null});setLoading(false);return;}
  if(target==="articles"||target==="@events"){
   const feed=await publishedArticles(target==="@events",cursor);
   if(request!==latestPageRequest.current)return;
   setArticleFeed(feed);setLoadedTarget(target);
   setResult({state:feed.available?"PUBLISHED":"UNAVAILABLE",page:null});
   setLoading(false);return;
  }
  if(target==="notices"){
    const feed=await publishedNotices();
    if(request!==latestPageRequest.current)return;
    setNoticeFeed(feed);setLoadedTarget(target);setResult({state:feed.available?"PUBLISHED":"UNAVAILABLE",page:null});
    setLoading(false);return;
   }
   const response=await published(target);
  if(request!==latestPageRequest.current)return;
  setResult(response);setLoadedTarget(target);setLoading(false);
 },[]);
 useEffect(()=>{
  if(slug!=="campaigns"&&slug!=="@newsletter"&&slug!=="@team")void load(slug);
  return()=>{latestPageRequest.current++};
 },[slug,load]);
 useEffect(()=>{
  void refreshNavigation();
  return()=>{latestNavRequest.current++};
 },[refreshNavigation]);
 useEffect(()=>{
  if(slug!=="home")void refreshFooter(slug);
  else{latestFooterRequest.current++;setFooterSource({target:"",page:null});}
  const sub=AppState.addEventListener("change",state=>{
   if(state==="active"){if(slug!=="campaigns"&&slug!=="@newsletter"&&slug!=="@team")void load(slug);void refreshNavigation();if(slug!=="home")void refreshFooter(slug);}
  });
  return()=>{latestFooterRequest.current++;sub.remove();};
 },[slug,load,refreshNavigation,refreshFooter]);
 useEffect(()=>{
  const sub=BackHandler.addEventListener("hardwareBackPress",()=>{
   if(slug==="80g"&&ngoScope!=="80g"){setNgoScope("80g");return true;}
   if(slug!=="home"){
    // Article detail returns to News. A published legal policy must
    // return to Home; it is not part of the article reader.
    setSlug(!["about","our-impact","80g","gallery","contact","healthcare","articles","notices","@events","@newsletter","@team","our-work","upcoming-projects","collaboration","membership","campaigns"].includes(slug)&&
     !isPolicySlug(slug)?articleBackTarget:"home");return true;
   }return false;
  });
  return()=>sub.remove();
 },[slug,articleBackTarget,ngoScope]);
 const canNavigate=(href:unknown)=>{
  const route=local(href);
  if(!route)return false;
  if(route==="/membership")return memberJoin;
  if(route==="/volunteer")return volunteerJoin;
  if(route==="/"||route==="/contact"||route==="/collaboration"||publishedPaths.includes("/collaboration"))return true;
  if(route==="/videos"||route==="/publications")return publishedPaths.includes("/gallery");
  return publishedPaths.includes(route);
 };
 const navigate=(href:unknown)=>{
  if(!canNavigate(href))return;
  const route=local(href);
  if(route==="/")setSlug("home");
  else if(route==="/collaboration")setSlug("collaboration");
  else if(route==="/membership"&&memberJoin)setSlug("membership");
  else if(route==="/volunteer"&&volunteerJoin)onVolunteerApply();
  else if(route==="/contact"){
   if(publishedPaths.includes("/contact"))setSlug("contact");else onContact();
  }
  else if(route==="/ngo-information"&&publishedPaths.includes(route)){
   setNgoScope("80g");setSlug("80g");
  }
  else if((route==="/gallery"||route==="/videos"||route==="/publications")&&
   publishedPaths.includes("/gallery")){
   setMediaScope(route==="/videos"?"VIDEO":route==="/publications"?"PUBLICATION":"PHOTO");setSlug("gallery");
  }
  // A CMS editorial CTA must not activate a destination that has
  // not been independently approved/published in the current source.
  else if(route&&publishedPaths.includes(route))setSlug(route.slice(1));
 };
 const noticeCategories=Array.from(new Set(noticeFeed.notices.map(n=>n.category)
  .filter(Boolean))).sort((a,b)=>a.localeCompare(b));
 const visibleNotices=noticeFeed.notices.filter(n=>
  (noticeCategory==="ALL"||n.category===noticeCategory)&&
  (noticePriority==="ALL"||n.priority===noticePriority)&&
  (!noticeSearch.trim()||[n.title,n.body,n.category].some(v=>
   v.toLocaleLowerCase().includes(noticeSearch.trim().toLocaleLowerCase()))));
 const page=result.page;
 const currentFooterHome=slug==="home"?(!loading&&loadedTarget==="home"&&result.state==="PUBLISHED"?page:null):footerSource.target===slug?footerSource.page:null;
 const effectiveFooter=currentFooterHome?.sections.find(section=>section.kind==="SITE_FOOTER")?.fields;
 const ngoFields=page?.kind==="COMPLIANCE"?
  page.sections.find(s=>s.kind==="COMPLIANCE_FACTS")?.fields:undefined;
 const ngoDocuments=Array.isArray(ngoFields?.documents)?ngoFields.documents:[];
 const hasOfficialDocument=(type:string)=>ngoDocuments.some((entry,i)=>
  entry!==null&&typeof entry==="object"&&!Array.isArray(entry)&&
  (entry as Record<string,unknown>).type===type&&
  page?.assets.some(a=>a.role==="DOCUMENT"&&a.order===i));
 const ngoHasPan=typeof ngoFields?.pan==="string"&&
  /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(ngoFields.pan);
 const slides=page?.sections.filter(s=>s.kind==="HERO"&&s.fields.visible!==false)
  .sort((a,b)=>a.order-b.order)??[];
 const safeImage=(asset:Asset|undefined)=>{
  if(!asset||!base||!asset.src.startsWith("/api/public/content/media/")||
    !/^\/api\/public\/content\/media\/[0-9a-f-]{36}$/i.test(asset.src))return null;
  return new URL(asset.src,base).toString();
 };
 return <View style={styles.container}>
  <View style={styles.nav}>
   <CmsButton title="Home" onPress={()=>setSlug("home")} secondary={slug!=="home"}/>
   {publishedPaths.includes("/about")&&<CmsButton title="About"
    onPress={()=>setSlug("about")} secondary={slug!=="about"}/>}
   {([["/our-impact","Impact","our-impact"],["/ngo-information","NGO Information","80g"],
     ["/healthcare","Healthcare","healthcare"],["/our-work","Our Work","our-work"],["/upcoming-projects","Upcoming Projects","upcoming-projects"]] as const)
      .filter(([path])=>publishedPaths.includes(path)).map(([,label,name])=>
       <CmsButton key={name} title={label} secondary={slug!==name}
        onPress={()=>setSlug(name)}/>)}
   {slug==="80g"&&ngoFields&&([
     ["80g","80G Registration"],
     ["pan-details","PAN Details"],
     ["registration-certificate","Registration Certificate"],
     ["annual-reports","Annual Reports"]
    ] as const).filter(([scope])=>scope==="80g"||
      (scope==="pan-details"?ngoHasPan:
       hasOfficialDocument(scope==="annual-reports"?"ANNUAL_REPORT":"REGISTRATION")))
     .map(([scope,label])=><CmsButton key={scope} title={label}
      secondary={ngoScope!==scope} onPress={()=>setNgoScope(scope)}/>)}
    {publishedPaths.includes("/gallery")&&([
    ["PHOTO","Gallery"],["VIDEO","Videos"],["PUBLICATION","Publications"]
   ] as const).map(([scope,label])=><CmsButton key={scope} title={label}
    secondary={slug!=="gallery"||mediaScope!==scope}
    onPress={()=>{setMediaScope(scope);setSlug("gallery");}}/>)}
   {publishedPaths.includes("/campaigns")&&<CmsButton title="Campaigns" secondary={slug!=="campaigns"} onPress={()=>setSlug("campaigns")}/>}
   <CmsButton title="Events" secondary={slug!=="@events"} onPress={()=>setSlug("@events")}/>
   <CmsButton title="Notices" secondary={slug!=="notices"} onPress={()=>setSlug("notices")}/>
   {publishedPaths.some(p=>p.startsWith("/blog/"))&&
    <CmsButton title="News" secondary={slug!=="articles"}
     onPress={()=>setSlug("articles")}/>}
   <CmsButton title="Membership Plans" secondary={slug!=="membership"} onPress={()=>setSlug("membership")}/>
   <CmsButton title="Partnerships" secondary={slug!=="collaboration"} onPress={()=>setSlug("collaboration")}/>
   <CmsButton title="Healthcare Partner Application" secondary onPress={onPartnerApplication}/>
   <CmsButton title="Team Directory" secondary={slug!=="@team"} onPress={()=>setSlug("@team")}/>
   <CmsButton title="Newsletter" secondary={slug!=="@newsletter"} onPress={()=>setSlug("@newsletter")}/>
   <CmsButton title="Contact" onPress={()=>navigate("/contact")}
    secondary={slug!=="contact"}/>
   {legalPages.some(([name])=>publishedPaths.includes("/policies/"+name))&&
    <CmsButton title={policiesExpanded?"Hide legal policies":"Policies & Legal"}
     secondary onPress={()=>setPoliciesExpanded(v=>!v)}/>}
   {policiesExpanded&&legalPages.filter(([name])=>
     publishedPaths.includes("/policies/"+name)).map(([name,title])=>
     <CmsButton key={name} title={title} secondary={slug!==name}
      onPress={()=>setSlug(name)}/>)}
  </View>
  {slug==="@team"?<NativeTeamDirectory/>:slug==="@newsletter"?<View style={styles.card}><NativeNewsletterForm/></View>:slug==="campaigns"?<NativePublicCampaigns/>:slug==="membership"?<NativeMembershipPlans onApply={onMembershipApply}/>:loading||loadedTarget!==slug?<ActivityIndicator accessibilityLabel="Checking current published website content"/>:
   (slug==="articles"||slug==="@events")?<View style={styles.card}>
    <Text accessibilityRole="header" style={styles.heading}>{slug==="@events"?"Foundation Events":"Approved News & Articles"}</Text>
    {!articleFeed.available?<Text accessibilityRole="alert" style={styles.muted}>
     {slug==="@events"?"Current events could not be verified.":"Current news could not be verified."}</Text>:articleFeed.posts.length===0?
     <Text style={styles.muted}>{slug==="@events"?"No currently approved events.":"No currently approved articles."}</Text>:
     articleFeed.posts.map(item=><View key={item.slug} style={styles.person}>
      <Text style={styles.eyebrow}>{item.category}</Text>
      <Text style={styles.heading}>{item.title}</Text>
      <Text style={styles.body}>{item.excerpt}</Text>
      <CmsButton title={slug==="@events"?"View event details":"Read full article"} onPress={()=>{setArticleBackTarget(slug==="@events"?"@events":"articles");setSlug(item.slug);}}/>
     </View>)}
    {articleFeed.nextCursor&&<CmsButton title="Next page" secondary onPress={()=>void load(slug,articleFeed.nextCursor??"")}/>}
    <CmsButton title={slug==="@events"?"Refresh events":"Refresh approved news"} secondary onPress={()=>void load(slug)}/>
   </View>:slug==="notices"?<View style={styles.card}>
     <Text accessibilityRole="header" style={styles.heading}>
      Notice &amp; Announcement Board</Text>
     {!noticeFeed.available?<Text accessibilityRole="alert" style={styles.muted}>
      Current approved notices cannot be verified.</Text>:<>
      <TextInput value={noticeSearch} onChangeText={setNoticeSearch}
       placeholder="Search current notices" accessibilityLabel="Search current notices"
       style={styles.search} autoCapitalize="none" maxLength={80}/>
      <View style={styles.actions} accessibilityLabel="Notice priority filters">
       {(["ALL","IMPORTANT","NORMAL"] as const).map(priority=>
        <CmsButton key={priority}
         title={priority==="ALL"?"All priorities":
          priority==="IMPORTANT"?"Important":"Normal"}
         secondary={noticePriority!==priority}
         onPress={()=>setNoticePriority(priority)}/>)}
      </View>
      <View style={styles.actions} accessibilityLabel="Notice category filters">
       <CmsButton title="All categories" secondary={noticeCategory!=="ALL"}
        onPress={()=>setNoticeCategory("ALL")}/>
       {noticeCategories.map(category=><CmsButton key={category} title={category}
         secondary={noticeCategory!==category}
         onPress={()=>setNoticeCategory(category)}/>)}
      </View>
      <CmsButton title="Reset Filters" secondary onPress={()=>{
       setNoticeSearch("");setNoticeCategory("ALL");setNoticePriority("ALL");}}/>
      <Text style={styles.muted} accessibilityLiveRegion="polite">
       {visibleNotices.length} current approved notices match</Text>
      {visibleNotices.length===0&&
       <Text style={styles.muted}>No current notices match the selected filters.</Text>}
      {visibleNotices.map(n=><View style={styles.person} key={n.path}>
       <Text style={styles.eyebrow}>{n.category} · {n.priority}</Text>
       <Text accessibilityRole="header" style={styles.heading}>{n.title}</Text>
       <Text style={styles.body}>{n.body}</Text>
       <Text style={styles.muted}>Published {n.publishedOn}</Text>
       <CmsButton title="Read approved notice" onPress={()=>{
        setArticleBackTarget("notices");setSlug(n.path.slice("/blog/".length));}}/>
      </View>)}
     </>}
     <CmsButton title="Refresh approved notices" secondary
      onPress={()=>void load("notices")}/>
    </View>:slug==="collaboration"&&result.state!=="PUBLISHED"?<View style={styles.card}>
    <Text accessibilityRole="header" style={styles.heading}>Corporate Partners</Text>
    <Text style={styles.body}>Contact the Foundation to discuss corporate social responsibility and service collaborations.</Text>
    <Text style={styles.muted}>{result.state==="UNAVAILABLE"?"Current partner announcements cannot be verified.":"No partner identities are currently approved for public display."}</Text>
    <CmsButton title="Get in touch" onPress={onContact}/>
    <CmsButton title="Apply as a healthcare partner" onPress={onPartnerApplication} secondary/>
    <CmsButton title="Refresh partner announcements" onPress={()=>void load("collaboration")} secondary/>
   </View>:result.state==="NOT_PUBLISHED"?<View style={styles.card}>
    <Text style={styles.heading}>{slug==="home"?"Foundation homepage":"About the Foundation"}</Text>
    <Text style={styles.muted}>This page has not yet been published.</Text>
   </View>:result.state==="UNAVAILABLE"?<View style={styles.card}>
    <Text accessibilityRole="alert" style={styles.heading}>Website content is temporarily unavailable</Text>
    <Text style={styles.muted}>We could not verify the current approved content.</Text>
    <CmsButton title="Try again" onPress={()=>void load(slug)} secondary/>
   </View>:page&&<View style={styles.sections}>
   {page.sections.map((section,i)=>{
    const fields=section.fields??{};
    if(section.kind==="HERO"){
     if(slides[Math.min(activeSlide,slides.length-1)]!==section)return null;
     const media=page.assets.find(v=>v.role==="MOBILE_HERO"&&v.order===section.order)||
      page.assets.find(v=>v.role==="HERO"&&v.order===section.order);
     const src=safeImage(media);
     const tags=Array.isArray(fields.tags)?fields.tags.filter(v=>typeof v==="string").slice(0,4):[];
     return <View key={i} style={styles.hero}>
      {!!text(fields.eyebrow)&&<Text style={styles.eyebrow}>{text(fields.eyebrow)}</Text>}
      <Text accessibilityRole="header" style={[styles.bigHeading,{
       fontFamily:fields.headingFont==="SANS"?"sans-serif":"serif",
       fontWeight:fields.headingWeight==="REGULAR"?"400":"800",
       fontSize:fields.headingSize==="STANDARD"?24:28,
       color:safeColor(fields.headingColor,"#FFE34A")
      }]}>
       {text(fields.heading)||page.title}</Text>
      {!!text(fields.subtitle)&&<Text style={[styles.heroSubtitle,{
       color:safeColor(fields.subtitleColor,"#8CF442")}]}>{text(fields.subtitle)}</Text>}
      {!!text(fields.description)&&<Text style={styles.heroBody}>{text(fields.description)}</Text>}
      {!!src&&<Image source={{uri:src}} accessibilityLabel={media?.altText||"Foundation initiative"}
       resizeMode="cover" style={styles.image}/>}
      {src&&media?.altText.startsWith("AI-generated illustration")&&<Text style={styles.heroBody}>AI-generated illustration; not a photograph of Foundation activities.</Text>}
      {tags.length>0&&<View style={styles.actions}>{tags.map((tag,j)=>
       <Text key={j} style={styles.tag}>{String(tag)}</Text>)}</View>}
      <View style={styles.actions}>
       {!!text(fields.primaryLabel)&&canNavigate(fields.primaryPath)&&
        <CmsButton title={text(fields.primaryLabel)} onPress={()=>navigate(fields.primaryPath)}/>}
       {!!text(fields.secondaryLabel)&&canNavigate(fields.secondaryPath)&&
        <CmsButton title={text(fields.secondaryLabel)} secondary
         onPress={()=>navigate(fields.secondaryPath)}/>}
      </View>
      {slides.length>1&&<View style={styles.actions}>
       <CmsButton title="Previous" secondary onPress={()=>
        setActiveSlide(v=>(v-1+slides.length)%slides.length)}/>
       <Text style={styles.counter}>{activeSlide+1} of {slides.length}</Text>
       <CmsButton title="Next" secondary onPress={()=>
        setActiveSlide(v=>(v+1)%slides.length)}/>
      </View>}
     </View>;
    }
    if(section.kind==="RICH_TEXT"){
     if(fields.placement)return null;
     const aboutImage=page.assets.find(v=>v.role==="ABOUT"&&v.order===section.order);
     const aboutSrc=safeImage(aboutImage);
     const highlights=Array.isArray(fields.highlights)?fields.highlights.slice(0,4):[];
     return <View style={styles.card} key={i}>
      {!!text(fields.eyebrow)&&<Text style={styles.eyebrow}>{text(fields.eyebrow)}</Text>}
      <Text accessibilityRole="header" style={styles.heading}>{text(fields.heading)}</Text>
      {fields.variant==="SPLIT"&&aboutSrc&&<Image source={{uri:aboutSrc}}
       style={styles.image} accessibilityLabel={aboutImage?.altText||"Foundation story"}/>}
      {aboutSrc&&aboutImage?.altText.startsWith("AI-generated illustration")&&<Text style={styles.muted}>AI-generated illustration.</Text>}
      <Text style={styles.body}>{text(fields.body)}</Text>
      {highlights.map((line,j)=><Text style={styles.highlight} key={j}>
       ✓ {text(line)}</Text>)}
     </View>;
    }
    if(section.kind==="FEATURE_CARDS"){
     const cards=Array.isArray(fields.cards)?fields.cards.slice(0,3):[];
     return <View style={styles.featureSection} key={i}>
      {!!text(fields.eyebrow)&&<Text style={styles.eyebrow}>{text(fields.eyebrow)}</Text>}
      <Text accessibilityRole="header" style={styles.featureHeading}>{text(fields.heading)}</Text>
      {!!text(fields.body)&&<Text style={styles.heroBody}>{text(fields.body)}</Text>}
      {cards.map((value,j)=>{
       if(!value||typeof value!=="object")return null;
       const item=value as Fields,asset=page.assets.find(x=>x.role==="FEATURE"&&x.order===j);
       const uri=safeImage(asset);
       return <View style={styles.card} key={j}>
        {!!uri&&<Image source={{uri}} style={styles.image}
         accessibilityLabel={asset?.altText||"Foundation program"}/>}
        {!!uri&&asset?.altText.startsWith("AI-generated illustration")&&<Text style={styles.muted}>AI-generated illustration.</Text>}
        <Text style={styles.eyebrow}>{text(item.label)}</Text>
        <Text style={styles.heading}>{text(item.title)}</Text>
        <Text style={styles.body}>{text(item.body)}</Text>
       </View>;
      })}
     </View>;
    }
    if(section.kind==="JOIN_CARDS")return <View key={i} style={styles.card}>
     <Text accessibilityRole="header" style={styles.heading}>{text(fields.volunteerTitle)}</Text>
     <Text style={styles.body}>{text(fields.volunteerBody)}</Text>
     {(Array.isArray(fields.volunteerBenefits)?fields.volunteerBenefits:[]).map((v,j)=>
      <Text style={styles.highlight} key={j}>✓ {text(v)}</Text>)}
     {volunteerJoin&&<CmsButton title="Become a Volunteer" onPress={onVolunteerApply}/>}
     <Text accessibilityRole="header" style={styles.heading}>{text(fields.memberTitle)}</Text>
     <Text style={styles.body}>{text(fields.memberBody)}</Text>
     {(Array.isArray(fields.memberBenefits)?fields.memberBenefits:[]).map((v,j)=>
      <Text style={styles.highlight} key={j}>✓ {text(v)}</Text>)}
     {memberJoin&&<CmsButton title="Become a Member" onPress={()=>setSlug("membership")}/>}
    </View>;
    if(section.kind==="CTA"){
     const image=page.assets.find(x=>x.role==="PROMO"&&x.order===section.order);
     const uri=safeImage(image);
     return <View style={styles.featureSection} key={i}>
      {!!text(fields.eyebrow)&&<Text style={styles.eyebrow}>{text(fields.eyebrow)}</Text>}
      {!!text(fields.heading)&&<Text style={styles.featureHeading}>{text(fields.heading)}</Text>}
      {!!text(fields.body)&&<Text style={styles.heroBody}>{text(fields.body)}</Text>}
      {!!uri&&<Image style={styles.image} source={{uri}}
       accessibilityLabel={image?.altText||"Foundation volunteers"}/>}
      {!!uri&&image?.altText.startsWith("AI-generated illustration")&&<Text style={styles.heroBody}>AI-generated illustration.</Text>}
      {text(fields.path)==="/volunteer"?volunteerJoin&&text(fields.label)?
       <CmsButton title={text(fields.label)} onPress={onVolunteerApply}/>:null:
       canNavigate(fields.path)&&text(fields.label)&&<CmsButton title={text(fields.label)} onPress={()=>navigate(fields.path)}/>}
     </View>;
    }
    if(section.kind==="SITE_FOOTER")return null; // one shared effective Home footer below
    if(section.kind==="TEAM"){
     const members=Array.isArray(fields.members)?fields.members:[];
     return <View style={styles.card} key={i}>
      <Text accessibilityRole="header" style={styles.heading}>
       {text(fields.heading)||"Our team"}</Text>
      {members.map((member,j)=>{
       if(!member||typeof member!=="object"||member.consentConfirmed!==true)return null;
       const photo=page.assets.find(x=>x.role==="TEAM"&&x.order===j);
       const photoUri=safeImage(photo);
       return <View key={j} style={styles.person}>
        {!!photoUri&&<Image source={{uri:photoUri}}
         accessibilityLabel={photo?.altText||"Foundation team member"}
         resizeMode="cover" style={styles.teamPhoto}/>}
        <Text style={styles.heading}>{text(member.name)}</Text>
        <Text style={styles.role}>{text(member.designation)}</Text>
        {!!text(member.bio)&&<Text>{text(member.bio)}</Text>}
       </View>;
      })}
     </View>;
    }
    if(["IMPACT_GROUP","COMPLIANCE_FACTS","GALLERY_GRID","ARTICLE_BODY",
       "HEALTHCARE_CATEGORIES","CONTACT_INFO"].includes(section.kind))
     return <CmsPublicExtendedSection key={i} section={section} assets={page.assets}
      mediaUrl={safeImage} onContact={onContact} onNavigate={navigate} canNavigate={canNavigate} onHealthcareDirectory={onHealthcareDirectory}
      mediaScope={section.kind==="GALLERY_GRID"?mediaScope:undefined}
       ngoScope={section.kind==="COMPLIANCE_FACTS"?ngoScope:undefined}
      onBackToNews={()=>setSlug(articleBackTarget)}
       backLabel={articleBackTarget==="notices"?"Back to notices":articleBackTarget==="@events"?"Back to events":"Back to approved articles"}/>;
    if(section.kind==="CAMPAIGN_TEASER"){
     const approved=(Array.isArray(fields.cards)?fields.cards:[])
      .filter(c=>c&&typeof c==="object"&&/^cg-camp-[0-9]{8}$/.test(text(c.slug)));
     return <View key={i} style={styles.card}>
      <Text accessibilityRole="header" style={styles.heading}>{text(fields.heading)||"Campaigns"}</Text>
      {!approved.length?<Text>No independently published campaigns to display.</Text>:
       approved.map((c,j)=><View key={j} style={styles.person}>
        <Text style={styles.heading}>{text(c.title)}</Text>
        {!!text(c.summary)&&<Text style={styles.body}>{text(c.summary)}</Text>}
       </View>)}
      <CmsButton title="View current published campaigns" onPress={()=>setSlug("campaigns")}/>
     </View>;
    }
    if(section.kind==="PARTNER_CARDS"&&page.kind==="PARTNERS"){
     const rows=Array.isArray(fields.cards)?fields.cards.slice(0,12):[];
     const verified=rows.flatMap((entry)=>{
      if(!entry||typeof entry!=="object"||Array.isArray(entry))return [];
      const value=entry as Fields;
      if(typeof value.name!=="string"||value.name.trim().length<2||value.name.length>200||
       typeof value.summary!=="string"||value.summary.trim().length<10||
       value.summary.length>500||!Number.isSafeInteger(value.originalIndex)||
       Number(value.originalIndex)<0||Number(value.originalIndex)>11)return [];
      return [{name:value.name as string,summary:value.summary as string,
       originalIndex:value.originalIndex as number}];
     });
     return <View key={i} style={styles.card}>
      <Text accessibilityRole="header" style={styles.heading}>
       {text(fields.heading)||"Meet Our Partners"}</Text>
      <Text style={styles.body}>{text(fields.intro)||"Only currently approved public partnership details appear here."}</Text>
      {!verified.length&&<Text style={styles.muted}>
       No partner identities are currently approved for public display.</Text>}
      {verified.map((entry,j)=>{
       const logo=page.assets.find(a=>a.role==="FEATURE"&&a.order===entry.originalIndex);
       const url=safeImage(logo);
       return <View style={styles.person} key={entry.name+":"+j}>
        {url&&<Image source={{uri:url}} style={styles.image}
         accessibilityLabel={logo?.altText||"Approved partner logo"} resizeMode="contain"/>}
        <Text style={styles.heading}>{entry.name}</Text>
        <Text style={styles.body}>{entry.summary}</Text>
       </View>;
      })}
      <CmsButton title="Get in touch" onPress={onContact}/>
      <CmsButton title="Apply as a healthcare partner" onPress={onPartnerApplication} secondary/>
     </View>;
    }
    if(section.kind==="PROJECT_TEASER"){const categories=["All Projects","Education","Healthcare","Livelihood","Social Welfare","Community Development"];const cards=(Array.isArray(fields.cards)?fields.cards:[]).filter(p=>page.kind!=="PROJECTS"||projectCategory==="All Projects"||p&&typeof p==="object"&&text(p.category).toLowerCase()===projectCategory.toLowerCase());return <View key={i} style={styles.card}><Text accessibilityRole="header" style={styles.heading}>{text(fields.heading)||"Projects"}</Text>{page.kind==="PROJECTS"&&<View style={styles.nav}>{categories.map(c=><CmsButton key={c} title={c} secondary={c!==projectCategory} onPress={()=>setProjectCategory(c)}/>)}</View>}{!cards.length?<Text>No currently approved projects to display.</Text>:cards.map((item,j)=>{if(!item||typeof item!=="object")return null;const p=item as Fields;const cover=/^\/api\/public\/content\/media\/[a-f0-9-]{36}$/i.test(text(p.coverSrc))?safeImage({src:text(p.coverSrc),role:"PROJECT",altText:text(p.title),order:0}):null;return <View key={j} style={styles.card}>{!!cover&&<Image source={{uri:cover}} accessibilityLabel={text(p.title)} style={styles.image} resizeMode="cover"/>}<Text style={styles.eyebrow}>{text(p.category)} · {text(p.status)==="PLANNED"?"Planned":"Active"}</Text><Text style={styles.heading}>{text(p.title)}</Text><Text>{text(p.area)}</Text><Text style={styles.body}>{text(p.summary)}</Text>{!!text(p.launch)&&<Text>Planned start: {text(p.launch)}</Text>}</View>;})}</View>;}
    // Never infer operational projects from CMS-only text.
    return null;
   })}
  </View>}
  {slug==="healthcare"&&result.state==="PUBLISHED"&&<View style={styles.card}>
   <Text accessibilityRole="header" style={styles.heading}>Find healthcare services</Text>
   <CmsButton title="Find verified centers, doctors & lab prices" onPress={()=>onHealthcareDirectory()}/>
   <CmsButton title="My patient profile & consultations" onPress={onPatientProfile} secondary/>
  </View>}
  {effectiveFooter&&<View style={styles.card}>
   <Text accessibilityRole="header" style={styles.heading}>{currentFooterHome?.title}</Text>
   {!!text(effectiveFooter.mission)&&<Text style={styles.body}>{text(effectiveFooter.mission)}</Text>}
   {!!text(effectiveFooter.address)&&<Text style={styles.muted}>Address: {text(effectiveFooter.address)}</Text>}
   {!!text(effectiveFooter.phone)&&<Text style={styles.muted}>Phone: {text(effectiveFooter.phone)}</Text>}
   {!!text(effectiveFooter.email)&&<Text style={styles.muted}>Email: {text(effectiveFooter.email)}</Text>}
   {slug!=="@newsletter"&&<>{!!text(effectiveFooter.newsletterText)&&<Text style={styles.body}>{text(effectiveFooter.newsletterText)}</Text>}<NativeNewsletterForm/></>}
   <CmsButton title="Contact the Foundation" secondary onPress={onContact}/>
  </View>}
 </View>;
}
const publicColors={green:"#194a3a",gold:"#ecc65b",amber:"#ffa337"};
const styles=StyleSheet.create({
 container:{gap:12,width:"100%"},
 nav:{flexDirection:"row",flexWrap:"wrap",alignItems:"center",gap:7,
  backgroundColor:publicColors.gold,padding:8,borderRadius:9},
 sections:{gap:12},
 card:{borderWidth:1,borderColor:t.border,borderRadius:12,padding:16,
  backgroundColor:t.surface,gap:9},
 hero:{borderRadius:15,backgroundColor:publicColors.green,padding:20,gap:12},
 eyebrow:{color:publicColors.gold,fontSize:12,fontWeight:"700",letterSpacing:1.2},
 heading:{fontSize:19,fontWeight:"700",color:t.sidebar},
 bigHeading:{fontSize:28,fontWeight:"800",color:publicColors.gold,lineHeight:34},
 heroSubtitle:{fontSize:20,fontWeight:"700",color:"#a5ed83"},
 heroBody:{fontSize:16,color:"#f1f9f4",lineHeight:24},
 tag:{color:"#fff",fontSize:11,padding:7,borderRadius:14,borderWidth:1,borderColor:"#c0d3c7"},
 counter:{color:publicColors.gold,fontWeight:"700"},
 highlight:{fontSize:15,color:publicColors.green,fontWeight:"700",lineHeight:25},
 featureSection:{backgroundColor:publicColors.green,borderRadius:12,padding:18,gap:12},
 featureHeading:{fontSize:27,fontWeight:"700",color:"#fff"},
 muted:{color:t.mutedText,fontSize:14},
 body:{fontSize:16,lineHeight:25,color:t.text},
 image:{width:"100%",height:225,borderRadius:9},
 actions:{flexDirection:"row",flexWrap:"wrap",gap:8},
 action:{backgroundColor:publicColors.amber,borderRadius:8,alignItems:"center",
  justifyContent:"center",minHeight:48,paddingVertical:10,paddingHorizontal:16},
 actionText:{color:"#17263c",fontWeight:"700",fontSize:15},
 secondary:{backgroundColor:t.surface,borderWidth:1,borderColor:t.border},
 secondaryText:{color:t.text},
 person:{borderWidth:1,borderColor:t.border,borderRadius:8,
  padding:12,gap:5,backgroundColor:"#f8fafc"},
 teamPhoto:{width:"100%",height:180,borderRadius:8},
 role:{fontWeight:"700",color:t.primary,fontSize:14},
 search:{borderWidth:1,borderColor:"#7fa792",borderRadius:8,minHeight:46,
  paddingHorizontal:12,color:t.text}
});
