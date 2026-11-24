import {useCallback,useEffect,useRef,useState} from "react";
import {ActivityIndicator,AppState,BackHandler,Image,Platform,Pressable,StyleSheet,Text,View} from "react-native";
import {NativePublicDonation} from "./native-public-donation";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
type Campaign={slug:string;title:string;category:string;summary:string;description:string;
 goalMinor:string|null;raisedMinor:string;startAt:string|null;endAt:string|null;area:string;
 coverSrc:string|null;heroSrc:string|null;heroAlt:string};
const slug=/^cg-camp-[0-9]{8}$/;
const base=process.env.EXPO_PUBLIC_API_URL;
const validApi=typeof base==="string"&&/^https?:\/\//.test(base)&&
 (process.env.NODE_ENV!=="production"||base.startsWith("https://"));
const money=(value:string|null)=>{
 try{return value===null?null:"₹"+(BigInt(value)/100n).toLocaleString("en-IN")+
  (BigInt(value)%100n===0n?"":"."+(BigInt(value)%100n).toString().padStart(2,"0"));}
 catch{return null;}
};
const safeImage=(src:string|null)=>{
 if(!validApi||!src||!/^\/api\/public\/campaigns\/media\/[a-f0-9-]{36}$/i.test(src))return null;
 return new URL(src,base).toString();
};
const clean=(v:unknown):v is Campaign=>{
 if(!v||typeof v!=="object"||Array.isArray(v))return false;
 const x=v as Record<string,unknown>;
 return typeof x.slug==="string"&&slug.test(x.slug)&&
  typeof x.title==="string"&&x.title.length>=2&&x.title.length<=160&&
  typeof x.category==="string"&&x.category.length<=80&&
  typeof x.summary==="string"&&x.summary.length<=500&&
  typeof x.description==="string"&&x.description.length<=4000&&
  typeof x.area==="string"&&x.area.length<=250&&
  typeof x.heroAlt==="string"&&x.heroAlt.length<=240&&
  (x.coverSrc===null||typeof x.coverSrc==="string"&&safeImage(x.coverSrc)!==null)&&
  (x.heroSrc===null||typeof x.heroSrc==="string"&&safeImage(x.heroSrc)!==null)&&
  (x.goalMinor===null||typeof x.goalMinor==="string"&&/^[0-9]{1,14}$/.test(x.goalMinor))&&
  typeof x.raisedMinor==="string"&&/^(0|[1-9][0-9]{0,27})$/.test(x.raisedMinor)&&
  (x.startAt===null||typeof x.startAt==="string"&&/^20[0-9]{2}-[0-9]{2}-[0-9]{2}$/.test(x.startAt))&&
  (x.endAt===null||typeof x.endAt==="string"&&/^20[0-9]{2}-[0-9]{2}-[0-9]{2}$/.test(x.endAt));
};
export function NativePublicCampaigns(){
 const [items,setItems]=useState<Campaign[]>([]),[selected,setSelected]=useState<string|null>(null),
  [loading,setLoading]=useState(false),[unavailable,setUnavailable]=useState(false),
  [donationsEnabled,setDonationsEnabled]=useState(false);
 const latest=useRef(0);
 const load=useCallback(async()=>{
  const nonce=++latest.current;setLoading(true);setUnavailable(false);
  try{
   if(!validApi)throw Error("Original API unavailable");
   const response=await fetch(new URL("/api/public/content/campaigns",base),{
    cache:"no-store",signal:AbortSignal.timeout(9000)});
   if(!response.ok)throw Error("Campaign publication unavailable");
   const data:unknown=await response.json();
   const payload=data as {cards?:unknown;donationsEnabled?:unknown};
   if(!payload||typeof payload!=="object"||Array.isArray(payload)||
    !Array.isArray(payload.cards)||payload.cards.length>100||
    !payload.cards.every(clean))throw Error("Campaign publication source invalid");
   const cards:Campaign[]=payload.cards;
   if(nonce===latest.current){
    setItems(cards);setDonationsEnabled(payload.donationsEnabled===true);
    setSelected(old=>old&&cards.some(c=>c.slug===old)?old:null);
   }
  }catch{if(nonce===latest.current){setItems([]);setSelected(null);setUnavailable(true);setDonationsEnabled(false);}}
  finally{if(nonce===latest.current)setLoading(false);}
 },[]);
 useEffect(()=>{void load();return()=>{latest.current++};},[load]);
 useEffect(()=>{
  const sub=AppState.addEventListener("change",state=>{if(state==="active")void load();});
  return()=>sub.remove();
 },[load]);
 useEffect(()=>{
  if(Platform.OS!=="android")return;
  const sub=BackHandler.addEventListener("hardwareBackPress",()=>{
   if(selected){setSelected(null);return true;}return false;
  });
  return()=>sub.remove();
 },[selected]);
 const campaign=items.find(c=>c.slug===selected);
 const button=(label:string,action:()=>void)=><Pressable accessibilityRole="button"
  style={styles.button} onPress={action}><Text style={styles.buttonText}>{label}</Text></Pressable>;
 return <View style={styles.page}>
  <Text accessibilityRole="header" style={styles.title}>CareGanga Campaigns</Text>
  <Text style={styles.note}>Only currently approved and independently published Foundation campaigns appear here.</Text>
  {loading&&<ActivityIndicator accessibilityLabel="Refreshing approved campaign status"/>}
  {unavailable?<View style={styles.card}><Text accessibilityRole="alert">Current campaign information is temporarily unavailable.</Text>{button("Try again",()=>void load())}</View>:
   campaign?<View style={styles.card}>
    {button("Back to campaigns",()=>setSelected(null))}
    {!!safeImage(campaign.heroSrc)&&<Image source={{uri:safeImage(campaign.heroSrc)!}}
     accessibilityLabel={campaign.heroAlt||campaign.title} resizeMode="cover" style={styles.image}/>}
    <Text style={styles.label}>{campaign.category}</Text>
    <Text accessibilityRole="header" style={styles.heading}>{campaign.title}</Text>
    {!!campaign.area&&<Text>Area: {campaign.area}</Text>}
    {!!campaign.summary&&<Text style={styles.body}>{campaign.summary}</Text>}
    {!!campaign.description&&<Text style={styles.body}>{campaign.description}</Text>}
    {!!campaign.startAt&&<Text>Campaign starts: {campaign.startAt}</Text>}
    {!!campaign.endAt&&<Text>Campaign ends: {campaign.endAt}</Text>}
    {!!money(campaign.goalMinor)&&<Text>Planned fundraising goal: {money(campaign.goalMinor)}. This is not money received.</Text>}
    <Text>Verified net contributions: {money(campaign.raisedMinor)}. Pending payments are not included.</Text>
    {donationsEnabled?<NativePublicDonation campaignSlug={campaign.slug}/>:<Text style={styles.note}>Online donations are unavailable until the Foundation verifies its merchant.</Text>}
   </View>:items.length===0?<Text>No currently published campaigns are available.</Text>:
   items.map(c=><View key={c.slug} style={styles.card}>
    {!!safeImage(c.coverSrc||c.heroSrc)&&<Image source={{uri:safeImage(c.coverSrc||c.heroSrc)!}}
     accessibilityLabel={c.heroAlt||c.title} resizeMode="cover" style={styles.image}/>}
    <Text style={styles.label}>{c.category}</Text>
    <Text accessibilityRole="header" style={styles.heading}>{c.title}</Text>
    {!!c.summary&&<Text style={styles.body}>{c.summary}</Text>}
    {!!money(c.goalMinor)&&<Text>Fundraising goal: {money(c.goalMinor)} (planned)</Text>}
    {button("Read campaign details",()=>{setSelected(c.slug);void load();})}
   </View>)}
  {button("Refresh published campaigns",()=>void load())}
 </View>;
}
const styles=StyleSheet.create({
 page:{padding:12,gap:12},card:{backgroundColor:t.surface,borderColor:t.border,borderWidth:1,borderRadius:12,padding:14,gap:9},
 title:{fontSize:23,fontWeight:"700",color:t.text},heading:{fontSize:18,fontWeight:"700",color:t.text},
 label:{fontSize:12,fontWeight:"700",color:"#9a681b"},note:{fontSize:13,color:t.mutedText},
 body:{fontSize:15,color:t.text,lineHeight:22},image:{width:"100%",height:220,borderRadius:9},
 button:{backgroundColor:"#f4aa40",padding:13,borderRadius:8,minHeight:46,justifyContent:"center"},
 buttonText:{fontWeight:"700",color:"#17263c",textAlign:"center"}
});
