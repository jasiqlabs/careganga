import {useState} from "react";
import {Image,Linking,Pressable,StyleSheet,Text,TextInput,View} from "react-native";
import {careGangaPublicTheme as t} from "../../../../../packages/design-tokens/src/index";
type Fields=Record<string,unknown>;
type Section={kind:string;order:number;fields:Fields};
type Asset={role:string;altText:string;src:string;order:number};
const text=(v:unknown)=>typeof v==="string"?v:"";
const rows=(v:unknown)=>Array.isArray(v)?v.filter(x=>x&&typeof x==="object")
 .slice(0,16) as Fields[]:[];
function Action({title,onPress}:{title:string;onPress:()=>void}){
 return <Pressable style={styles.button} accessibilityRole="button" onPress={onPress}>
  <Text style={styles.buttonText}>{title}</Text>
 </Pressable>;
}
const healthcareCodes:Record<string,string>={"poly clinic":"POLYCLINIC","polyclinic":"POLYCLINIC","diagnostic centre":"DIAGNOSTIC_CENTER","diagnostic center":"DIAGNOSTIC_CENTER","dental clinic":"DENTAL_CLINIC","medical laboratories":"MEDICAL_LABORATORY","medical laboratory":"MEDICAL_LABORATORY","hospital & nursing home":"HOSPITAL","hospital and nursing home":"HOSPITAL","retail pharmacy":"PHARMACY","orthopedic centre":"ORTHOPEDIC_CLINIC","orthopedic center":"ORTHOPEDIC_CLINIC","homoeopathy centre":"HOMEOPATHY_CLINIC","homeopathy centre":"HOMEOPATHY_CLINIC","homeopathy center":"HOMEOPATHY_CLINIC","ayurvedic centre":"AYURVEDIC_CLINIC","ayurvedic center":"AYURVEDIC_CLINIC"};
const healthcareCode=(title:unknown)=>healthcareCodes[text(title).trim().toLowerCase()]??"";
const open=(uri:string)=>void Linking.openURL(uri).catch(()=>undefined);
/** Plain-text, screen-reader accessible rendering of the SAME published CMS
 * DTO as Next.js. No offline cache of revoked claims or private media.
 */
export function CmsPublicExtendedSection({section,assets,mediaUrl,onContact,
 onNavigate,canNavigate,onBackToNews,onHealthcareDirectory,mediaScope,ngoScope="80g",backLabel="Back to approved articles"}:{section:Section;assets:Asset[];
 mediaUrl:(asset:Asset|undefined)=>string|null;
 onContact:()=>void;onNavigate:(path:unknown)=>void;canNavigate:(path:unknown)=>boolean;
 onBackToNews:()=>void;onHealthcareDirectory?:(category?:string)=>void;mediaScope?:"PHOTO"|"VIDEO"|"PUBLICATION";
 ngoScope?:"80g"|"pan-details"|"registration-certificate"|"annual-reports";backLabel?:string}){
 const f=section.fields;
 const impactItems=rows(f.items);
 const impactPeak=Math.max(0,...impactItems.map(v=>typeof v.value==="number"&&
  Number.isFinite(v.value)?v.value:0));
 const [mediaFilter,setMediaFilter]=useState("PHOTO");
 const actualMedia=mediaScope??mediaFilter;
 const [categoryFilter,setCategoryFilter]=useState("ALL");
 const [search,setSearch]=useState("");
 const [openFaq,setOpenFaq]=useState<number|null>(null);
 const [annualYear,setAnnualYear]=useState("ALL");
 const [mediaYear,setMediaYear]=useState("ALL");
 const galleryItems=rows(f.items);
 const asset=(role:string,order=section.order)=>assets.find(a=>a.role===role&&a.order===order);
 const available=galleryItems.map((item,index)=>({item,i:typeof item.originalIndex==="number"&&Number.isSafeInteger(item.originalIndex)?item.originalIndex:index}))
  .filter(({item,i})=>item.mediaType===actualMedia&&!!mediaUrl(asset("GALLERY",i)));
 const categories=Array.from(new Set(available.map(({item})=>text(item.category)).filter(Boolean))).sort();
 const mediaYears=Array.from(new Set(available.map(({item})=>text(item.asOfDate).slice(0,4)).filter(y=>/^\d{4}$/.test(y)))).sort((a,b)=>b.localeCompare(a));
 const resetMedia=()=>{setCategoryFilter("ALL");setSearch("");setMediaYear("ALL");};
 const galleryMatches=available.filter(({item})=>
  (categoryFilter==="ALL"||item.category===categoryFilter)&&
  (actualMedia!=="PUBLICATION"||mediaYear==="ALL"||text(item.asOfDate).startsWith(mediaYear+"-"))&&
  (!search.trim()||[item.title,item.caption,item.category].some(v=>text(v).toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))));
 const picture=(role:string,order=section.order)=>{
  const img=asset(role,order),uri=mediaUrl(img);
  return uri?<Image style={styles.photo} source={{uri}}
   accessibilityLabel={img?.altText||"Foundation illustration"} resizeMode="cover"/>:null;
 };
 if(section.kind==="IMPACT_GROUP")return <View style={styles.section}>
  <Text style={styles.eyebrow}>{f.group==="HERO"&&text(f.eyebrow)?
   text(f.eyebrow):text(f.group).replaceAll("_"," ")}</Text>
  <Text accessibilityRole="header" style={styles.title}>{text(f.heading)}</Text>
  {f.group==="HERO"&&!!text(f.highlight)&&
   <Text style={styles.highlight}>{text(f.highlight)}</Text>}
  {f.group==="HERO"&&!!text(f.quote)&&
   <Text style={styles.quote}>{text(f.quote)}</Text>}
  {!!text(f.intro)&&<Text style={styles.body}>{text(f.intro)}</Text>}
  {picture("IMPACT")}
  {impactItems.length>0&&<Text style={styles.source}>Source: {text(f.source)} · {text(f.asOfDate)}
   {"\n"}Editorial information; not independently audited</Text>}
  {!impactItems.length&&!["HERO","CTA","PILLARS"].includes(text(f.group))&&<View style={styles.item}><Text style={styles.source}>No approved information has been published yet.</Text></View>}
  {impactItems.map((v,i)=><View key={i} style={styles.item}>
   <Text style={styles.itemTitle}>{text(v.title)}
    {typeof v.year==="number"?" ("+v.year+")":""}</Text>
   {f.group==="GEOGRAPHY"&&["HIGH","MEDIUM","EXPANDING"].includes(text(v.level))&&
    <Text style={styles.source}>Source-reported reach: {text(v.level).toLowerCase()}</Text>}
   {typeof v.value==="number"&&<Text style={styles.value}>{v.value} {text(v.unit)}</Text>}
   {typeof v.percentage==="number"&&<Text style={styles.value}>{v.percentage}%</Text>}
   {["GROWTH","BREAKDOWN"].includes(text(f.group))&&(()=>{
    const value=f.group==="BREAKDOWN"?
     (typeof v.percentage==="number"?v.percentage:0):
     (typeof v.value==="number"?v.value:0);
    const proportion=f.group==="BREAKDOWN"?value:
     impactPeak>0?value/impactPeak*100:0;
    const width=Math.max(0,Math.min(100,proportion));
    return <View style={styles.barTrack} accessible={false}
     importantForAccessibility="no-hide-descendants">
      <View style={[styles.barFill,{flex:width}]}/>
      <View style={{flex:100-width}}/>
     </View>;
   })()}
   <Text style={styles.body}>{text(v.description)}</Text>
  </View>)}
  {(f.group==="CTA"||f.group==="HERO")&&!!text(f.ctaLabel)&&
   canNavigate(f.ctaPath)&&
   <Action title={text(f.ctaLabel)} onPress={()=>onNavigate(f.ctaPath)}/>}
 </View>;
 if(section.kind==="COMPLIANCE_FACTS"&&ngoScope!=="80g"){
  const verified=rows(f.documents).map((record,index)=>({
   record,index,url:mediaUrl(asset("DOCUMENT",index))
  })).filter(v=>!!v.url);
  if(ngoScope==="pan-details"){
   const publishedPan=text(f.pan);
   return <View style={styles.section}>
    <Text accessibilityRole="header" style={styles.title}>PAN Details</Text>
    {/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(publishedPan)?
     <Text style={styles.value}>{publishedPan}</Text>:
     <Text style={styles.source}>No current approved PAN is published.</Text>}
    {!!text(f.issuer)&&<Text style={styles.body}>Issuer: {text(f.issuer)}</Text>}
    {!!text(f.source)&&!!text(f.verifiedAsOf)&&<Text style={styles.source}>
     Source reviewed: {text(f.verifiedAsOf)}</Text>}
    <Text style={styles.source}>{text(f.disclaimer)}</Text>
   </View>;
  }
  const requested=ngoScope==="annual-reports"?"ANNUAL_REPORT":"REGISTRATION";
  const matching=verified.filter(({record})=>record.type===requested);
  const years=Array.from(new Set(matching.map(({record})=>text(record.asOfDate).slice(0,4))
   .filter(v=>/^\d{4}$/.test(v)))).sort((a,b)=>b.localeCompare(a));
  const active=matching.filter(({record})=>ngoScope!=="annual-reports"||
   annualYear==="ALL"||text(record.asOfDate).startsWith(annualYear+"-"));
  return <View style={styles.section}>
   <Text accessibilityRole="header" style={styles.title}>
    {ngoScope==="annual-reports"?"Annual Reports":"Registration Certificate"}</Text>
   {ngoScope==="annual-reports"&&<View style={styles.filterRow}
     accessibilityLabel="Annual reports year filter">
    <Pressable accessibilityRole="button" accessibilityState={{selected:annualYear==="ALL"}}
     onPress={()=>setAnnualYear("ALL")} style={styles.filter}>
     <Text style={styles.filterText}>All years</Text></Pressable>
    {years.map(y=><Pressable key={y} accessibilityRole="button"
     accessibilityState={{selected:annualYear===y}} onPress={()=>setAnnualYear(y)}
     style={styles.filter}><Text style={styles.filterText}>{y}</Text></Pressable>)}
   </View>}
   {active.length===0&&<Text style={styles.source}>
    No current approved documents are available for this selection.</Text>}
   {active.map(({record,index,url})=><View style={styles.item} key={index}>
    <Text style={styles.itemTitle}>{text(record.title)}</Text>
    <Text style={styles.source}>Document date: {text(record.asOfDate)}</Text>
    {url&&<Action title="View verified original document"
     onPress={()=>open(url)}/>}
   </View>)}
   <Text style={styles.source}>{text(f.disclaimer)}</Text>
  </View>;
 }
 if(section.kind==="COMPLIANCE_FACTS"){
  const proof=asset("DOCUMENT",0),url=mediaUrl(proof);
  return <View style={styles.section}>
   <Text style={styles.eyebrow}>Registration &amp; disclosures</Text>
   <Text accessibilityRole="header" style={styles.title}>{text(f.heading)}</Text>
   {f.verification==="VERIFIED"&&!!text(f.badgeText)&&
    <Text style={styles.source}>{text(f.badgeText)}</Text>}
   {!!text(f.subtitle)&&<Text style={styles.orangeHeading}>{text(f.subtitle)}</Text>}
   <Text style={styles.body}>{text(f.summary)}</Text>
   <Text style={styles.value}>{f.verification==="VERIFIED"?
    "Document-supported Foundation declaration":
    "Not currently verified — no tax benefit promised"}</Text>
   {(["issuer","pan","registrationNumber","approvalNumber","validFrom","validUntil",
     "source","verifiedAsOf"] as const).map(key=>text(f[key])?<Text key={key} style={styles.source}>
      {key.replace(/([A-Z])/g," $1")}: {text(f[key])}</Text>:null)}
   {rows(f.documents).map((document,i)=>{
    const original=asset("DOCUMENT",i),link=mediaUrl(original);
    if(!link)return null;
    return <View style={styles.item} key={i}>
     <Text style={styles.eyebrow}>{text(document.type).replaceAll("_"," ")}</Text>
     <Text style={styles.itemTitle}>{text(document.title)}</Text>
     <Text style={styles.source}>Document date: {text(document.asOfDate)}</Text>
     <Action title="Open approved source document" onPress={()=>open(link)}/>
    </View>;
   })}
   {f.verification==="VERIFIED"&&url&&!rows(f.documents).length&&
    <Action title="Open approved proof" onPress={()=>open(url)}/>}
   {!!text(f.importantNote)&&<View style={styles.item}>
    <Text style={styles.itemTitle}>Important</Text>
    <Text style={styles.body}>{text(f.importantNote)}</Text>
   </View>}
   <Text style={styles.body}>{text(f.disclaimer)}</Text>
  </View>;
 }
 if(section.kind==="GALLERY_GRID")return <View style={styles.section}>
  <Text style={styles.eyebrow}>Media &amp; Resources</Text>
  <Text accessibilityRole="header" style={styles.title}>
   {mediaScope==="VIDEO"?text(f.videosHeading)||text(f.heading):
    mediaScope==="PUBLICATION"?text(f.publicationsHeading)||text(f.heading):text(f.heading)}
  </Text>
  <Text style={styles.body}>{mediaScope==="VIDEO"?text(f.videosDescription):
   mediaScope==="PUBLICATION"?text(f.publicationsDescription):text(f.description)}</Text>
  {!mediaScope&&<View style={styles.filterRow} accessibilityLabel="Approved media type filters">
   {([["PHOTO","Photos"],["VIDEO","Videos"],
     ["PUBLICATION","Publications"]] as const).map(([value,label])=>
    <Pressable key={value} accessibilityRole="button"
     accessibilityState={{selected:actualMedia===value}}
     style={[styles.filter,actualMedia===value&&styles.filterActive]}
     onPress={()=>{resetMedia();setMediaFilter(value);}}>
     <Text style={[styles.filterText,actualMedia===value&&styles.filterActiveText]}>
      {label}</Text>
    </Pressable>)}
  </View>}
  {categories.length>0&&<View style={styles.filterRow} accessibilityLabel="Approved categories">
   <Pressable accessibilityRole="button" accessibilityState={{selected:categoryFilter==="ALL"}}
    style={[styles.filter,categoryFilter==="ALL"&&styles.filterActive]}
    onPress={()=>setCategoryFilter("ALL")}><Text style={[styles.filterText,
      categoryFilter==="ALL"&&styles.filterActiveText]}>All categories</Text></Pressable>
   {categories.map(name=><Pressable key={name} accessibilityRole="button"
    accessibilityState={{selected:categoryFilter===name}}
    style={[styles.filter,categoryFilter===name&&styles.filterActive]}
    onPress={()=>setCategoryFilter(name)}><Text style={[styles.filterText,
      categoryFilter===name&&styles.filterActiveText]}>{name}</Text></Pressable>)}
  </View>}
  <TextInput style={styles.search} value={search} onChangeText={setSearch}
   placeholder="Search approved media" accessibilityLabel="Search approved media"
   autoCapitalize="none" maxLength={80}/>
  {actualMedia==="PUBLICATION"&&<View style={styles.filterRow} accessibilityLabel="Publication year">{["ALL",...mediaYears].map(y=><Pressable key={y} accessibilityRole="button" accessibilityState={{selected:mediaYear===y}} style={[styles.filter,mediaYear===y&&styles.filterActive]} onPress={()=>setMediaYear(y)}><Text style={[styles.filterText,mediaYear===y&&styles.filterActiveText]}>{y==="ALL"?"All years":y}</Text></Pressable>)}</View>}
  <Action title="Reset filters" onPress={resetMedia}/>
  <Text style={styles.source} accessibilityLiveRegion="polite">
   {galleryMatches.length} approved resources match</Text>
  {galleryMatches.length===0&&<View style={styles.item}><Text style={styles.body}>{available.length===0?(text(f[actualMedia==="VIDEO"?"videosEmptyText":actualMedia==="PUBLICATION"?"publicationsEmptyText":"photosEmptyText"])||"No approved resources published yet."):"No approved resources match these filters. Change the filter or search."}</Text></View>}
  {galleryMatches.map(({item,i})=>{
   const media=asset("GALLERY",i),url=mediaUrl(media);
   if(!url)return null;
   return <View style={styles.item} key={i}>
    {item.mediaType==="PHOTO"&&picture("GALLERY",i)}
    <Text style={styles.eyebrow}>{text(item.category)}</Text>
    <Text style={styles.itemTitle}>{text(item.title)}</Text>
    <Text style={styles.body}>{text(item.caption)}</Text>
    <Text style={styles.source}>Source: {text(item.source)} · {text(item.asOfDate)}</Text>
    {item.mediaType!=="PHOTO"&&<Action
     title={item.mediaType==="VIDEO"?"Play approved video":"Open approved PDF"}
     onPress={()=>open(url)}/>}
   </View>;
  })}
 </View>;
 if(section.kind==="ARTICLE_BODY"){
 const event=f.event&&typeof f.event==="object"?f.event as Fields:null;
 const cover=event&&/^\/api\/public\/content\/media\/[a-f0-9-]{36}$/i.test(text(event.coverSrc))?mediaUrl({role:"ARTICLE",order:0,altText:text(f.heading),src:text(event.coverSrc)}):null;
 const stamp=(v:unknown)=>typeof v==="string"&&Number.isFinite(Date.parse(v))?new Date(v).toLocaleString("en-IN",{timeZone:"Asia/Kolkata"}):"";
 return <View style={styles.section}>
  <Text style={styles.eyebrow}>{text(f.category)}</Text>
  <Text accessibilityRole="header" style={styles.title}>{text(f.heading)}</Text>
  <Text style={styles.body}>{text(f.excerpt)}</Text>
  <Text style={styles.source}>Source: {text(f.source)} · {text(f.asOfDate)}
   {"\n"}Editorial credit: {text(f.authorLabel)}</Text>
  {event&&<><Text style={styles.body}>{text(event.status)==="SCHEDULED"?"Scheduled":text(event.status)==="ONGOING"?"Ongoing":"Completed"} · {text(event.area)}</Text><Text style={styles.source}>{stamp(event.scheduledStart)} – {stamp(event.scheduledEnd)} IST</Text>{!!cover&&<Image style={styles.photo} source={{uri:cover}} accessibilityLabel={text(f.heading)} resizeMode="cover"/>}</>}
  {!event&&picture("ARTICLE",0)}
  <Text style={styles.body}>{text(f.body)}</Text>
  {Array.isArray(f.tags)&&<Text style={styles.source}>{f.tags.map(text).join(" · ")}</Text>}
  <Action title={backLabel} onPress={onBackToNews}/>
 </View>;}
 if(section.kind==="CONTACT_INFO"){
  const permitted=(value:unknown,hosts:string[])=>{
   try{
    const url=new URL(text(value));
    return url.protocol==="https:"&&!url.username&&!url.password&&
     !url.port&&!url.hash&&hosts.includes(url.hostname.toLowerCase())?
     url.toString():null;
   }catch{return null;}
  };
  const map=permitted(f.mapUrl,["www.google.com","google.com","maps.google.com"]);
  const socialHosts:Record<string,string[]>={
   Facebook:["facebook.com","www.facebook.com"],
   Instagram:["instagram.com","www.instagram.com"],
   YouTube:["youtube.com","www.youtube.com"]
  };
  return <View style={styles.section}>
   <Text style={styles.eyebrow}>Contact the Foundation</Text>
   <Text accessibilityRole="header" style={styles.title}>{text(f.heroTitle)}</Text>
   {!!text(f.heroIntro)&&<Text style={styles.body}>{text(f.heroIntro)}</Text>}
   {rows(f.inquiries).map((item,i)=><View key={i} style={styles.item}>
    <Text style={styles.itemTitle}>{text(item.title)}</Text>
    <Text style={styles.body}>{text(item.description)}</Text>
   </View>)}
   <Action title="Send a private message" onPress={onContact}/>
   <Text style={styles.source}>Private messages use the Foundation’s existing contact-support service.</Text>
   {[0,1,2].map(i=>mediaUrl(asset("CONTACT",i))?<View key={i}>{picture("CONTACT",i)}</View>:null)}
   {!!text(f.officeHours)&&<Text style={styles.source}>
    Foundation hours: {text(f.officeHours)}</Text>}
   {map&&<Action title="View verified Foundation map"
    onPress={()=>open(map)}/>}
   {rows(f.faqs).length>0&&
    <Text accessibilityRole="header" style={styles.itemTitle}>
     Frequently Asked Questions</Text>}
   {rows(f.faqs).map((item,i)=><View key={i} style={styles.item}>
    <Pressable style={styles.faqToggle} accessibilityRole="button"
     accessibilityState={{expanded:openFaq===i}}
     onPress={()=>setOpenFaq(current=>current===i?null:i)}>
     <Text style={[styles.itemTitle,styles.faqQuestion]}>{text(item.question)}</Text>
     <Text accessibilityElementsHidden importantForAccessibility="no" style={styles.faqIndicator}>{openFaq===i?"−":"+"}</Text>
    </Pressable>
    {openFaq===i&&<Text style={styles.body}>{text(item.answer)}</Text>}
   </View>)}
   {rows(f.socialLinks).map((entry,i)=>{
    const network=text(entry.network);
    const url=socialHosts[network]?
     permitted(entry.url,socialHosts[network]):null;
    return url?<Action key={i} title={"Follow on "+network}
     onPress={()=>open(url)}/>:null;
   })}
  </View>;
 }
 if(section.kind==="HEALTHCARE_CATEGORIES")return <View style={styles.section}>
  <Text style={styles.eyebrow}>Healthcare Assistance</Text>
  <Text accessibilityRole="header" style={styles.title}>{text(f.heading)}</Text>
  <Text style={styles.body}>{text(f.intro)}</Text>
  {onHealthcareDirectory&&<Action title="Find verified healthcare services" onPress={()=>onHealthcareDirectory()}/>}
  {rows(f.categories).map((item,i)=><View style={styles.item} key={i}>
   {picture("FEATURE",i)}
   {asset("FEATURE",i)?.altText.match(/^(AI-generated illustration|Editorial illustration)/)&&<Text style={styles.source}>Illustration; not a photograph of a verified facility.</Text>}
   <Text style={styles.itemTitle}>{text(item.title)}</Text>
   <Text style={styles.body}>{text(item.description)}</Text>
   {onHealthcareDirectory&&<Action title={"Find centers — "+text(item.title)} onPress={()=>onHealthcareDirectory(healthcareCode(item.title))}/>}
  </View>)}
  {f.ctaPath==="/contact"&&!!text(f.ctaLabel)&&
   <Action title={text(f.ctaLabel)} onPress={onContact}/>}
  <Text style={styles.source}>General information only. No live provider,
   doctor fee, discount or appointment is represented.</Text>
 </View>;
 return null;
}
const styles=StyleSheet.create({
 section:{backgroundColor:t.surface,borderRadius:12,borderWidth:1,
  borderColor:t.border,padding:16,gap:12},
 eyebrow:{fontSize:12,fontWeight:"700",color:t.primary,letterSpacing:1.1},
 title:{fontSize:25,fontWeight:"800",color:t.sidebar},
 body:{fontSize:16,lineHeight:24,color:t.text},
 source:{fontSize:13,lineHeight:20,color:t.mutedText},
 highlight:{fontSize:24,fontWeight:"800",color:"#20824c"},
 quote:{fontSize:18,fontStyle:"italic",lineHeight:27,color:"#306b4a"},
 orangeHeading:{fontSize:17,fontWeight:"800",color:"#bd5a12"},
 barTrack:{flexDirection:"row",height:11,backgroundColor:"#dce9db",
  borderRadius:7,overflow:"hidden"},
 barFill:{backgroundColor:"#3b8d5a",borderRadius:7},
 item:{borderRadius:10,backgroundColor:t.selectedSurface,padding:13,gap:7},
 faqToggle:{minHeight:48,flexDirection:"row",alignItems:"center",gap:12},
 faqQuestion:{flex:1,flexShrink:1},
 faqIndicator:{fontSize:22,fontWeight:"700",color:t.primary},
 itemTitle:{fontSize:18,fontWeight:"700",color:t.primary},
 value:{fontSize:21,fontWeight:"700",color:"#17694a"},
 photo:{width:"100%",height:220,borderRadius:10},
 button:{minHeight:48,borderRadius:9,alignItems:"center",justifyContent:"center",
  backgroundColor:t.amber,padding:12},
 buttonText:{fontSize:15,fontWeight:"700",color:t.sidebar},
 filterRow:{flexDirection:"row",flexWrap:"wrap",gap:7},
 filter:{borderRadius:8,borderWidth:1,borderColor:t.border,paddingVertical:9,
  paddingHorizontal:12,minHeight:42,justifyContent:"center"},
 filterActive:{backgroundColor:t.primary},
 filterText:{fontWeight:"600",color:t.primary},
 filterActiveText:{color:t.primaryText},
 search:{borderWidth:1,borderColor:t.border,borderRadius:8,minHeight:46,
  paddingHorizontal:12,color:t.text}
});
