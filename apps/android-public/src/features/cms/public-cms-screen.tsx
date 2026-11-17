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
 const [result,setResult]=useState<Result>({state:"UNAVAILABLE",page:null});
 const [loading,setLoading]=useState(true);
 const refreshNavigation=useCallback(async()=>{
  onLoginVisibility(false);
  onLoginVisibility(await approvedLoginFlag());
 },[onLoginVisibility]);
 const load=useCallback(async(target:"home"|"about")=>{
  setLoading(true);setResult(await published(target));setLoading(false);
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
     const media=page.assets.find(v=>v.role==="MOBILE_HERO")||
      page.assets.find(v=>v.role==="HERO");
     const src=safeImage(media);
     return <View key={i} style={styles.hero}>
      <Text style={styles.eyebrow}>CareGanga Foundation</Text>
      <Text accessibilityRole="header" style={styles.bigHeading}>
       {text(fields.heading)||page.title}</Text>
      {!!text(fields.subtitle)&&<Text style={styles.body}>{text(fields.subtitle)}</Text>}
      {!!src&&<Image source={{uri:src}} accessibilityLabel={media?.altText||"Foundation image"}
       resizeMode="cover" style={styles.image}/>}
      <View style={styles.actions}>
       {!!text(fields.primaryLabel)&&local(fields.primaryPath)&&
        <CmsButton title={text(fields.primaryLabel)} onPress={()=>navigate(fields.primaryPath)}/>}
       {!!text(fields.secondaryLabel)&&local(fields.secondaryPath)&&
        <CmsButton title={text(fields.secondaryLabel)} secondary
         onPress={()=>navigate(fields.secondaryPath)}/>}
      </View>
     </View>;
    }
    if(section.kind==="RICH_TEXT")return <View style={styles.card} key={i}>
     <Text accessibilityRole="header" style={styles.heading}>{text(fields.heading)}</Text>
     <Text style={styles.body}>{text(fields.body)}</Text>
    </View>;
    if(section.kind==="TEAM"){
     const members=Array.isArray(fields.members)?fields.members:[];
     return <View style={styles.card} key={i}>
      <Text accessibilityRole="header" style={styles.heading}>
       {text(fields.heading)||"Our team"}</Text>
      {members.map((member,j)=>{
       if(!member||typeof member!=="object"||member.consentConfirmed!==true)return null;
       return <View key={j} style={styles.person}>
        <Text style={styles.heading}>{text(member.name)}</Text>
        <Text style={styles.role}>{text(member.designation)}</Text>
        {!!text(member.bio)&&<Text>{text(member.bio)}</Text>}
       </View>;
      })}
     </View>;
    }
    if(section.kind==="CTA"&&local(fields.path)&&text(fields.label))
     return <CmsButton key={i} title={text(fields.label)}
      onPress={()=>navigate(fields.path)}/>;
    // Project teasers require CG05 original owner and cannot be invented.
    return null;
   })}
  </View>}
 </View>;
}
const styles=StyleSheet.create({
 container:{gap:12,width:"100%"},
 nav:{flexDirection:"row",flexWrap:"wrap",alignItems:"center",gap:7},
 sections:{gap:12},
 card:{borderWidth:1,borderColor:t.border,borderRadius:12,padding:16,
  backgroundColor:t.surface,gap:9},
 hero:{borderRadius:15,backgroundColor:"#eaf1ff",padding:20,gap:12},
 eyebrow:{color:t.primary,fontSize:12,fontWeight:"700",letterSpacing:1.2},
 heading:{fontSize:19,fontWeight:"700",color:t.sidebar},
 bigHeading:{fontSize:28,fontWeight:"800",color:t.sidebar,lineHeight:34},
 muted:{color:t.mutedText,fontSize:14},
 body:{fontSize:16,lineHeight:25,color:t.text},
 image:{width:"100%",height:225,borderRadius:9},
 actions:{flexDirection:"row",flexWrap:"wrap",gap:8},
 action:{backgroundColor:t.primary,borderRadius:8,alignItems:"center",
  justifyContent:"center",minHeight:48,paddingVertical:10,paddingHorizontal:16},
 actionText:{color:t.primaryText,fontWeight:"700",fontSize:15},
 secondary:{backgroundColor:t.surface,borderWidth:1,borderColor:t.border},
 secondaryText:{color:t.text},
 person:{borderWidth:1,borderColor:t.border,borderRadius:8,
  padding:12,gap:5,backgroundColor:"#f8fafc"},
 role:{fontWeight:"700",color:t.primary,fontSize:14}
});
