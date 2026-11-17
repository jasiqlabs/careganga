import {useCallback,useEffect,useState} from "react";
import {ActivityIndicator,AppState,BackHandler,Image,Pressable,
 StyleSheet,Text,View} from "react-native";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
type Fields=Record<string,unknown>;
type Section={kind:string;order:number;fields:Fields};
type Asset={role:string;altText:string;src:string;order:number};
type CmsSource={schemaVersion:number;effectiveGeneration:string;kind:string;
 slug:string;title:string;seoTitle:string;seoDescription:string;
 lastPublishedAt:string;sections:Section[];assets:Asset[]};
type Result={state:"PUBLISHED"|"NOT_PUBLISHED"|"UNAVAILABLE";page:CmsSource|null};
const base=process.env.EXPO_PUBLIC_API_URL;
const text=(v:unknown)=>typeof v==="string"?v:"";
const local=(v:unknown)=>{
 const route=text(v);
 return ["/","/about","/contact"].includes(route)?route:null;
};
async function published(slug:"home"|"about"):Promise<Result>{
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
     data.kind!==(slug==="home"?"HOME":"ABOUT")||
     typeof data.title!=="string"||!Array.isArray(data.sections)||
     !Array.isArray(data.assets)||typeof data.effectiveGeneration!=="string")
   throw Error();
  return {state:"PUBLISHED",page:raw as CmsSource};
 }catch{return {state:"UNAVAILABLE",page:null};}
}
async function approvedLoginFlag():Promise<boolean>{
 if(!base||!/^https?:\/\//.test(base)||
  (process.env.NODE_ENV==="production"&&!base.startsWith("https://")))return false;
 try{
  const r=await fetch(new URL("/api/public/content/navigation",base).toString(),
   {cache:"no-store",signal:AbortSignal.timeout(9000)});
  if(!r.ok)return false;
  const result:unknown=await r.json();
  return Boolean(result&&typeof result==="object"&&
   "schemaVersion" in result&&result.schemaVersion===1&&
   "login" in result&&result.login&&typeof result.login==="object"&&
   "visible" in result.login&&result.login.visible===true);
 }catch{return false;}
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
export function PublicCmsContent({onContact,onLoginVisibility}: {
 onContact:()=>void;onLoginVisibility:(visible:boolean)=>void}){
 const [slug,setSlug]=useState<"home"|"about">("home");
 const [activeSlide,setActiveSlide]=useState(0);
 const [result,setResult]=useState<Result>({state:"UNAVAILABLE",page:null});
 const [loading,setLoading]=useState(true);
 const refreshNavigation=useCallback(async()=>{
  onLoginVisibility(false);
  onLoginVisibility(await approvedLoginFlag());
 },[onLoginVisibility]);
 const load=useCallback(async(target:"home"|"about")=>{
  setLoading(true);setActiveSlide(0);setResult(await published(target));setLoading(false);
 },[]);
 useEffect(()=>{void load(slug);},[slug,load]);
 useEffect(()=>{void refreshNavigation();},[refreshNavigation]);
 useEffect(()=>{
  const sub=AppState.addEventListener("change",state=>{
   if(state==="active"){void load(slug);void refreshNavigation();}
  });
  return()=>sub.remove();
 },[slug,load,refreshNavigation]);
 useEffect(()=>{
  const sub=BackHandler.addEventListener("hardwareBackPress",()=>{
   if(slug==="about"){setSlug("home");return true;}return false;
  });
  return()=>sub.remove();
 },[slug]);
 const navigate=(href:unknown)=>{
  const route=local(href);
  if(route==="/")setSlug("home");
  else if(route==="/about")setSlug("about");
  else if(route==="/contact")onContact();
 };
 const page=result.page;
 const slides=page?.sections.filter(s=>s.kind==="HERO").sort((a,b)=>a.order-b.order)??[];
 const safeImage=(asset:Asset|undefined)=>{
  if(!asset||!base||!asset.src.startsWith("/api/public/content/media/")||
    !/^\/api\/public\/content\/media\/[0-9a-f-]{36}$/i.test(asset.src))return null;
  return new URL(asset.src,base).toString();
 };
 return <View style={styles.container}>
  <View style={styles.nav}>
   <CmsButton title="Home" onPress={()=>setSlug("home")} secondary={slug!=="home"}/>
   <CmsButton title="About" onPress={()=>setSlug("about")} secondary={slug!=="about"}/>
   <CmsButton title="Contact" onPress={onContact} secondary/>
  </View>
  {loading?<ActivityIndicator accessibilityLabel="Checking current published website content"/>:
   result.state==="NOT_PUBLISHED"?<View style={styles.card}>
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
      <Text accessibilityRole="header" style={styles.bigHeading}>
       {text(fields.heading)||page.title}</Text>
      {!!text(fields.subtitle)&&<Text style={styles.heroSubtitle}>{text(fields.subtitle)}</Text>}
      {!!text(fields.description)&&<Text style={styles.heroBody}>{text(fields.description)}</Text>}
      {!!src&&<Image source={{uri:src}} accessibilityLabel={media?.altText||"Foundation initiative"}
       resizeMode="cover" style={styles.image}/>}
      {tags.length>0&&<View style={styles.actions}>{tags.map((tag,j)=>
       <Text key={j} style={styles.tag}>{String(tag)}</Text>)}</View>}
      <View style={styles.actions}>
       {!!text(fields.primaryLabel)&&local(fields.primaryPath)&&
        <CmsButton title={text(fields.primaryLabel)} onPress={()=>navigate(fields.primaryPath)}/>}
       {!!text(fields.secondaryLabel)&&local(fields.secondaryPath)&&
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
     const aboutImage=page.assets.find(v=>v.role==="ABOUT"&&v.order===section.order);
     const aboutSrc=safeImage(aboutImage);
     const highlights=Array.isArray(fields.highlights)?fields.highlights.slice(0,4):[];
     return <View style={styles.card} key={i}>
      {!!text(fields.eyebrow)&&<Text style={styles.eyebrow}>{text(fields.eyebrow)}</Text>}
      <Text accessibilityRole="header" style={styles.heading}>{text(fields.heading)}</Text>
      {fields.variant==="SPLIT"&&aboutSrc&&<Image source={{uri:aboutSrc}}
       style={styles.image} accessibilityLabel={aboutImage?.altText||"Foundation story"}/>}
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
     <Text accessibilityRole="header" style={styles.heading}>{text(fields.memberTitle)}</Text>
     <Text style={styles.body}>{text(fields.memberBody)}</Text>
     {(Array.isArray(fields.memberBenefits)?fields.memberBenefits:[]).map((v,j)=>
      <Text style={styles.highlight} key={j}>✓ {text(v)}</Text>)}
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
      {local(fields.path)&&text(fields.label)&&
       <CmsButton title={text(fields.label)} onPress={()=>navigate(fields.path)}/>}
     </View>;
    }
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
    // Project teasers require CG05 original owner and cannot be invented.
    return null;
   })}
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
 role:{fontWeight:"700",color:t.primary,fontSize:14}
});
