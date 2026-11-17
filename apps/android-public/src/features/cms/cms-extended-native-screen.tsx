import {Image,Linking,Pressable,StyleSheet,Text,View} from "react-native";
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
 const asset=(role:string,order=section.order)=>assets.find(a=>a.role===role&&a.order===order);
 const picture=(role:string,order=section.order)=>{
  const img=asset(role,order),uri=mediaUrl(img);
  return uri?<Image style={styles.photo} source={{uri}}
   accessibilityLabel={img?.altText||"Foundation illustration"} resizeMode="cover"/>:null;
 };
 if(section.kind==="IMPACT_GROUP")return <View style={styles.section}>
  <Text style={styles.eyebrow}>{text(f.group).replaceAll("_"," ")}</Text>
  <Text accessibilityRole="header" style={styles.title}>{text(f.heading)}</Text>
  {!!text(f.intro)&&<Text style={styles.body}>{text(f.intro)}</Text>}
  {picture("IMPACT")}
  <Text style={styles.source}>Source: {text(f.source)} · {text(f.asOfDate)}
   {"\n"}Editorial information; not independently audited</Text>
  {rows(f.items).map((v,i)=><View key={i} style={styles.item}>
   <Text style={styles.itemTitle}>{text(v.title)}
    {typeof v.year==="number"?" ("+v.year+")":""}</Text>
   {typeof v.value==="number"&&<Text style={styles.value}>{v.value} {text(v.unit)}</Text>}
   {typeof v.percentage==="number"&&<Text style={styles.value}>{v.percentage}%</Text>}
   <Text style={styles.body}>{text(v.description)}</Text>
  </View>)}
  {f.group==="CTA"&&!!text(f.ctaLabel)&&
   ["/","/about","/contact","/impact","/gallery","/healthcare","/80g"].includes(text(f.ctaPath))&&
   <Action title={text(f.ctaLabel)} onPress={()=>onNavigate(f.ctaPath)}/>}
 </View>;
 if(section.kind==="COMPLIANCE_FACTS"){
  const proof=asset("DOCUMENT",0),url=mediaUrl(proof);
  return <View style={styles.section}>
   <Text style={styles.eyebrow}>Registration &amp; disclosures</Text>
   <Text accessibilityRole="header" style={styles.title}>{text(f.heading)}</Text>
   <Text style={styles.body}>{text(f.summary)}</Text>
   <Text style={styles.value}>{f.verification==="VERIFIED"?
    "Document-supported Foundation declaration":
    "Not currently verified — no tax benefit promised"}</Text>
   {(["issuer","pan","registrationNumber","approvalNumber","validFrom","validUntil",
     "source","verifiedAsOf"] as const).map(key=>text(f[key])?<Text key={key} style={styles.source}>
      {key.replace(/([A-Z])/g," $1")}: {text(f[key])}</Text>:null)}
   {f.verification==="VERIFIED"&&url&&<Action title="Open approved proof"
    onPress={()=>open(url)}/>}
   <Text style={styles.body}>{text(f.disclaimer)}</Text>
  </View>;
 }
 if(section.kind==="GALLERY_GRID")return <View style={styles.section}>
  <Text style={styles.eyebrow}>Media &amp; Resources</Text>
  <Text accessibilityRole="header" style={styles.title}>{text(f.heading)}</Text>
  <Text style={styles.body}>{text(f.description)}</Text>
  {rows(f.items).map((item,i)=>{
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
 item:{borderRadius:10,backgroundColor:"#f2f7f0",padding:13,gap:7},
 itemTitle:{fontSize:18,fontWeight:"700",color:"#1c4a3a"},
 value:{fontSize:21,fontWeight:"700",color:"#17694a"},
 photo:{width:"100%",height:220,borderRadius:10},
 button:{minHeight:46,borderRadius:9,alignItems:"center",justifyContent:"center",
  backgroundColor:"#efa747",padding:12},
 buttonText:{fontSize:15,fontWeight:"700",color:"#193729"}
});
