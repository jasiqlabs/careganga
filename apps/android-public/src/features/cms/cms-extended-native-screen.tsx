import {useState} from "react";
import {Image,Linking,Pressable,StyleSheet,Text,TextInput,View} from "react-native";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
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
const open=(uri:string)=>void Linking.openURL(uri).catch(()=>undefined);
/** Plain-text, screen-reader accessible rendering of the SAME published CMS
 * DTO as Next.js. No offline cache of revoked claims or private media.
 */
export function CmsPublicExtendedSection({section,assets,mediaUrl,onContact,
 onNavigate,onBackToNews}:{section:Section;assets:Asset[];
 mediaUrl:(asset:Asset|undefined)=>string|null;
 onContact:()=>void;onNavigate:(path:unknown)=>void;
 onBackToNews:()=>void}){
 const f=section.fields;
 const impactItems=rows(f.items);
 const impactPeak=Math.max(0,...impactItems.map(v=>typeof v.value==="number"&&
  Number.isFinite(v.value)?v.value:0));
 const [mediaFilter,setMediaFilter]=useState("ALL");
 const [categoryFilter,setCategoryFilter]=useState("ALL");
 const [search,setSearch]=useState("");
 const galleryItems=rows(f.items);
 const categories=Array.from(new Set(galleryItems.map(x=>text(x.category)).filter(Boolean))).sort();
 const galleryMatches=galleryItems.map((item,index)=>({item,
  i:typeof item.originalIndex==="number"&&Number.isSafeInteger(item.originalIndex)?
   item.originalIndex:index})).filter(({item})=>
   (mediaFilter==="ALL"||item.mediaType===mediaFilter)&&
   (categoryFilter==="ALL"||item.category===categoryFilter)&&
   (!search.trim()||[item.title,item.caption,item.category].some(v=>
    text(v).toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))));
 const asset=(role:string,order=section.order)=>assets.find(a=>a.role===role&&a.order===order);
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
  <Text style={styles.source}>Source: {text(f.source)} · {text(f.asOfDate)}
   {"\n"}Editorial information; not independently audited</Text>
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
   ["/","/about","/contact","/our-impact","/gallery","/healthcare","/80g"].includes(text(f.ctaPath))&&
   <Action title={text(f.ctaLabel)} onPress={()=>onNavigate(f.ctaPath)}/>}
 </View>;
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
  <Text accessibilityRole="header" style={styles.title}>{text(f.heading)}</Text>
  <Text style={styles.body}>{text(f.description)}</Text>
  <View style={styles.filterRow} accessibilityLabel="Approved media type filters">
   {([["ALL","All"],["PHOTO","Photos"],["VIDEO","Videos"],
     ["PUBLICATION","Publications"]] as const).map(([value,label])=>
    <Pressable key={value} accessibilityRole="button"
     accessibilityState={{selected:mediaFilter===value}}
     style={[styles.filter,mediaFilter===value&&styles.filterActive]}
     onPress={()=>setMediaFilter(value)}>
     <Text style={[styles.filterText,mediaFilter===value&&styles.filterActiveText]}>
      {label}</Text>
    </Pressable>)}
  </View>
  {categories.length>1&&<View style={styles.filterRow} accessibilityLabel="Approved categories">
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
  <Text style={styles.source} accessibilityLiveRegion="polite">
   {galleryMatches.length} approved resources match</Text>
  {galleryMatches.length===0&&<Text style={styles.body}>No approved media matches.
    Change the filter or search.</Text>}
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
 if(section.kind==="ARTICLE_BODY")return <View style={styles.section}>
  <Text style={styles.eyebrow}>{text(f.category)}</Text>
  <Text accessibilityRole="header" style={styles.title}>{text(f.heading)}</Text>
  <Text style={styles.body}>{text(f.excerpt)}</Text>
  <Text style={styles.source}>Source: {text(f.source)} · {text(f.asOfDate)}
   {"\n"}Editorial credit: {text(f.authorLabel)}</Text>
  {picture("ARTICLE",0)}
  <Text style={styles.body}>{text(f.body)}</Text>
  {Array.isArray(f.tags)&&<Text style={styles.source}>{f.tags.map(text).join(" · ")}</Text>}
  <Action title="Back to approved articles" onPress={onBackToNews}/>
 </View>;
 if(section.kind==="HEALTHCARE_CATEGORIES")return <View style={styles.section}>
  <Text style={styles.eyebrow}>Healthcare Assistance</Text>
  <Text accessibilityRole="header" style={styles.title}>{text(f.heading)}</Text>
  <Text style={styles.body}>{text(f.intro)}</Text>
  {rows(f.categories).map((item,i)=><View style={styles.item} key={i}>
   <Text style={styles.itemTitle}>{text(item.title)}</Text>
   <Text style={styles.body}>{text(item.description)}</Text>
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
 eyebrow:{fontSize:12,fontWeight:"700",color:"#1f6d54",letterSpacing:1.1},
 title:{fontSize:25,fontWeight:"800",color:"#1b4b38"},
 body:{fontSize:16,lineHeight:24,color:t.text},
 source:{fontSize:13,lineHeight:20,color:t.mutedText},
 highlight:{fontSize:24,fontWeight:"800",color:"#20824c"},
 quote:{fontSize:18,fontStyle:"italic",lineHeight:27,color:"#306b4a"},
 orangeHeading:{fontSize:17,fontWeight:"800",color:"#bd5a12"},
 barTrack:{flexDirection:"row",height:11,backgroundColor:"#dce9db",
  borderRadius:7,overflow:"hidden"},
 barFill:{backgroundColor:"#3b8d5a",borderRadius:7},
 item:{borderRadius:10,backgroundColor:"#f2f7f0",padding:13,gap:7},
 itemTitle:{fontSize:18,fontWeight:"700",color:"#1c4a3a"},
 value:{fontSize:21,fontWeight:"700",color:"#17694a"},
 photo:{width:"100%",height:220,borderRadius:10},
 button:{minHeight:46,borderRadius:9,alignItems:"center",justifyContent:"center",
  backgroundColor:"#efa747",padding:12},
 buttonText:{fontSize:15,fontWeight:"700",color:"#193729"},
 filterRow:{flexDirection:"row",flexWrap:"wrap",gap:7},
 filter:{borderRadius:8,borderWidth:1,borderColor:"#7fa792",paddingVertical:9,
  paddingHorizontal:12,minHeight:42,justifyContent:"center"},
 filterActive:{backgroundColor:"#205c42"},
 filterText:{fontWeight:"600",color:"#205c42"},
 filterActiveText:{color:"#fff"},
 search:{borderWidth:1,borderColor:"#7fa792",borderRadius:8,minHeight:46,
  paddingHorizontal:12,color:t.text}
});
