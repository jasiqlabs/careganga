import {useCallback,useEffect,useRef,useState} from "react";
import {
 ActivityIndicator,AppState,Linking,Pressable,ScrollView,StyleSheet,Text,
 TextInput,View
} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import {careGangaPublicTheme as theme} from "../../../../../packages/design-tokens/src/index";

/** Native equivalent of the CURRENT CG-16 published lab-offers projection.
 * It is anonymous, uses no cached private/medical state, and never performs
 * order, payment, collection or report actions. */
type Offer={
 offerRef:string;kind:"TEST"|"PACKAGE";name:string;code:string;
 category:string;categoryCode:string|null;sampleType:string|null;
 description:string|null;centerSlug:string;centerName:string;
 providerName:string;centerAddress:string;pinCode:string;
 publicPhone:string|null;patientPriceMinor:string;basePriceMinor:string;
 currency:"INR";validFromUtc:string;validUntilUtc:string|null;
 priceVersion:number
};
type Filters={q:string;category:string;center:string};
type Result={state:"READY"|"ERROR";items:Offer[];next:string|null};
const base=process.env.EXPO_PUBLIC_API_URL;
const slug=/^[a-z0-9][a-z0-9-]{2,79}$/;
const money=(x:string)=>"₹"+(Number(x)/100).toLocaleString("en-IN",{
 minimumFractionDigits:0,maximumFractionDigits:2});
function validate(x:unknown):x is Offer{
 if(!x||typeof x!=="object"||Array.isArray(x))return false;
 const v=x as Partial<Offer>;
 const minor=(a:unknown)=>typeof a==="string"&&/^\d{1,10}$/.test(a)&&
  Number.isSafeInteger(Number(a));
 return typeof v.offerRef==="string"&&/^[a-f0-9-]{36}$/i.test(v.offerRef)&&
  (v.kind==="TEST"||v.kind==="PACKAGE")&&
  typeof v.name==="string"&&v.name.length<=160&&
  typeof v.code==="string"&&v.code.length<=24&&
  typeof v.category==="string"&&v.category.length<=100&&
  (v.categoryCode===null||typeof v.categoryCode==="string"&&v.categoryCode.length<=24)&&
  (v.description===null||typeof v.description==="string"&&v.description.length<=2000)&&
  (v.sampleType===null||typeof v.sampleType==="string")&&
  typeof v.centerSlug==="string"&&slug.test(v.centerSlug)&&
  typeof v.centerName==="string"&&v.centerName.length<=160&&
  typeof v.providerName==="string"&&v.providerName.length<=180&&
  typeof v.centerAddress==="string"&&v.centerAddress.length<=500&&
  typeof v.pinCode==="string"&&/^[1-9]\d{5}$/.test(v.pinCode)&&
  (v.publicPhone===null||typeof v.publicPhone==="string"&&/^\+?[0-9]{10,15}$/.test(v.publicPhone))&&
  minor(v.basePriceMinor)&&minor(v.patientPriceMinor)&&
  Number(v.patientPriceMinor)<=Number(v.basePriceMinor)&&
  v.currency==="INR"&&typeof v.validFromUtc==="string"&&
  Number.isFinite(Date.parse(v.validFromUtc))&&
  (v.validUntilUtc===null||typeof v.validUntilUtc==="string"&&
   Number.isFinite(Date.parse(v.validUntilUtc)))&&
  Number.isSafeInteger(v.priceVersion)&&Number(v.priceVersion)>0;
}
async function read(filters:Filters,page:string):Promise<{items:Offer[];next:string|null}>{
 if(!base||!/^https?:\/\//.test(base)||
  (process.env.NODE_ENV==="production"&&!base.startsWith("https://")))
  throw Error("The lab directory is temporarily unavailable.");
 const query=new URLSearchParams();
 if(filters.q.trim())query.set("q",filters.q.trim().slice(0,80));
 if(filters.category)query.set("category",filters.category);
 if(filters.center)query.set("center",filters.center);
 if(page)query.set("page",page);
 const response=await fetch(
  new URL("/api/v1/public/diagnostics/offers?"+query.toString(),base),{
   cache:"no-store",signal:AbortSignal.timeout(10000)
  });
 if(!response.ok)throw Error("Current approved lab prices are unavailable.");
 const value:unknown=await response.json();
 if(!value||typeof value!=="object"||Array.isArray(value)||
  !("state" in value)||value.state!=="READY"||
  !("items" in value)||!Array.isArray(value.items)||
  value.items.length>50||!value.items.every(validate)||
  !("next" in value)||!(value.next===null||
   typeof value.next==="string"&&/^(?:[1-9]|10)$/.test(value.next)))
  throw Error("Current laboratory price verification failed.");
 return {items:value.items,next:value.next};
}
type Category={code:string;name:string};
async function facets():Promise<Category[]>{
 if(!base||!/^https?:\/\//.test(base)||
  (process.env.NODE_ENV==="production"&&!base.startsWith("https://")))
  return [];
 try{
  const res=await fetch(new URL("/api/v1/public/diagnostics/facets",base),{
   cache:"no-store",signal:AbortSignal.timeout(10000)
  });
  if(!res.ok)return [];
  const data:unknown=await res.json();
  if(!data||typeof data!=="object"||Array.isArray(data)||
   !("categories" in data)||!Array.isArray(data.categories)||
   data.categories.length>100||
   !data.categories.every((c:unknown)=>
    !!c&&typeof c==="object"&&"code" in c&&"name" in c&&
    typeof c.code==="string"&&/^[A-Z0-9][A-Z0-9-]{1,23}$/.test(c.code)&&
    typeof c.name==="string"&&c.name.length<=100))
   return [];
  return data.categories as Category[];
 }catch{return [];}
}
export async function hasCurrentLabOffers(center:string):Promise<boolean>{
 if(!slug.test(center))return false;
 try{
  const current=await read({q:"",category:"",center},"");
  return current.items.length>0;
 }catch{return false;}
}
function action(title:string,onPress:()=>void,selected=false,disabled=false){
 return <Pressable key={title} accessibilityRole="button"
  accessibilityState={{selected,disabled}} disabled={disabled}
  style={[styles.button,selected&&styles.selected]} onPress={onPress}>
  <Text style={styles.buttonText}>{title}</Text>
 </Pressable>;
}
const EMPTY:Filters={q:"",category:"",center:""};
export function PublicLabOfferDirectory({onExit,initialCenterSlug=""}:{
 onExit:()=>void;initialCenterSlug?:string
}){
 const [search,setSearch]=useState("");
 const [categories,setCategories]=useState<Category[]>([]);
 const [filters,setFilters]=useState<Filters>(()=>({...EMPTY,
  center:slug.test(initialCenterSlug)?initialCenterSlug:""}));
 const [result,setResult]=useState<Result>({state:"READY",items:[],next:null});
 const [loading,setLoading]=useState(true),[loadingMore,setLoadingMore]=useState(false);
 const [expanded,setExpanded]=useState("");
 const seq=useRef(0);
 const fetchCurrent=useCallback(async(next="",append=false)=>{
  const n=++seq.current;
  if(append)setLoadingMore(true);else{setLoading(true);setExpanded("");}
  try{
   const response=await read(filters,next);
   if(n!==seq.current)return;
   setResult(old=>({state:"READY",
    items:append?[...old.items,...response.items]:response.items,
    next:response.next}));
  }catch{
   if(n!==seq.current)return;
   setResult({state:"ERROR",items:[],next:null});
  }finally{
   if(n===seq.current){setLoading(false);setLoadingMore(false);}
  }
 },[filters]);
 useEffect(()=>{
  void fetchCurrent();
  return()=>{seq.current++;};
 },[fetchCurrent]);
 useEffect(()=>{
  let active=true;
  void facets().then(data=>{if(active)setCategories(data);});
  return()=>{active=false;};
 },[]);
 useEffect(()=>{
  const listener=AppState.addEventListener("change",state=>{
   if(state==="active"){
    void fetchCurrent();
    void facets().then(setCategories);
   }
  });
  return()=>listener.remove();
 },[fetchCurrent]);
 function apply(){
  const next={...filters,q:search.trim().slice(0,80)};
  setFilters(next);
  if(next.q===filters.q)void fetchCurrent();
 }
 function narrowCenter(center:string){
  setFilters(prev=>({...prev,center,category:""}));
  setExpanded("");
 }
 function clear(){
  setSearch("");
  setFilters(EMPTY);
  setExpanded("");
  if(filters.q===""&&filters.center===""&&filters.category==="")
   void fetchCurrent();
 }
 return <SafeAreaView style={styles.page}>
  <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
   <View style={styles.row}>
    {action("‹ Healthcare network",onExit)}
    <Text accessibilityRole="header" style={styles.title}>Lab Tests & Prices</Text>
   </View>
   <Text style={styles.helper}>
    Published partner commercial rates only. Not Foundation assistance, a payment
    receipt, medical advice or a laboratory booking.
   </Text>
   <Text style={styles.fieldLabel}>Test, package or lab name</Text>
   <TextInput style={styles.input} value={search} maxLength={80}
    accessibilityLabel="Search approved lab tests" onChangeText={setSearch}
    placeholder="Find a current laboratory test"/>
   <View style={styles.row}>
    {action("Search",apply,false,loading)}
    {action("Clear filters",clear,false,loading)}
    {action("Refresh current offers",()=>void fetchCurrent(),false,loading)}
   </View>
   {filters.center?<View style={styles.card}>
    <Text>Showing one selected published lab location.</Text>
    {action("Show all labs",()=>narrowCenter(""))}
   </View>:null}
   <Text style={styles.fieldLabel}>Categories with current published offers</Text>
   <View style={styles.row}>
    {action("All categories",()=>{
     setFilters(prev=>({...prev,category:""}));
     if(filters.category==="")void fetchCurrent();
    },!filters.category)}
    {categories.map(c=>action(c.name,()=>{
     setFilters(prev=>({...prev,category:c.code}));
     if(filters.category===c.code)void fetchCurrent();
    },filters.category===c.code))}
   </View>
   {loading&&<ActivityIndicator accessibilityLabel="Checking approved lab offers"/>}
   {!loading&&result.state==="ERROR"&&<View style={styles.card}>
    <Text accessibilityRole="alert">Current approved laboratory prices could not
     be checked. No outdated or cached prices are displayed.</Text>
    {action("Retry verification",()=>void fetchCurrent())}
   </View>}
   {!loading&&result.state==="READY"&&result.items.length===0&&
    <View style={styles.card}><Text>No currently published approved prices match
     your search. Other verified center services may still be available.</Text></View>}
   {!loading&&result.state==="READY"&&result.items.map(item=>
    <View style={styles.card} key={item.offerRef}>
     <Text style={styles.eyebrow}>{item.kind==="TEST"?item.category:"Diagnostic package"}</Text>
     <Text style={styles.cardTitle}>{item.name}</Text>
     <Text>{item.code} · {item.centerName}</Text>
     <Text style={styles.amount}>Current patient price {money(item.patientPriceMinor)}</Text>
     {Number(item.basePriceMinor)>Number(item.patientPriceMinor)&&
      <Text>Base commercial price {money(item.basePriceMinor)} · Partner saving
       {" "+money(String(Number(item.basePriceMinor)-Number(item.patientPriceMinor)))}</Text>}
     <Text>{item.providerName} · {item.centerAddress}, PIN {item.pinCode}</Text>
     <Text style={styles.helper}>Effective from
      {" "+new Date(item.validFromUtc).toLocaleDateString("en-IN")}
      {item.validUntilUtc?" until "+new Date(item.validUntilUtc).toLocaleDateString("en-IN"):""}</Text>
     <View style={styles.row}>
      {action(expanded===item.offerRef?"Hide offer details":"View offer details",()=>{
       setExpanded(old=>old===item.offerRef?"":item.offerRef);})}
      {action("Only this lab",()=>narrowCenter(item.centerSlug))}
     </View>
     {expanded===item.offerRef&&<View style={styles.details}>
      {item.sampleType&&<Text>Sample category: {item.sampleType.replaceAll("_"," ")}</Text>}
      {item.description&&<Text>{item.description}</Text>}
      {item.publicPhone&&action("Call published lab number",()=>{
       void Linking.openURL("tel:"+item.publicPhone).catch(()=>{});
      })}
      <Text style={styles.helper}>Confirm the service and price directly with
       the laboratory. There is no online lab checkout or report access here.</Text>
     </View>}
    </View>)}
   {!loading&&result.state==="READY"&&result.next&&action(
    loadingMore?"Checking next results…":"Show more current offers",
    ()=>void fetchCurrent(result.next!,true),false,loadingMore)}
   <Text style={styles.helper}>Results are rechecked against the source.
    Suspended labs, withdrawn tests and expired prices are not guaranteed
    to remain available between views. No clinical results are shown.</Text>
  </ScrollView>
 </SafeAreaView>;
}
const styles=StyleSheet.create({
 page:{flex:1,backgroundColor:theme.background},
 content:{padding:18,paddingBottom:48,gap:14,width:"100%",maxWidth:720,alignSelf:"center"},
 row:{flexDirection:"row",gap:10,alignItems:"center",flexWrap:"wrap"},
 title:{fontSize:23,fontWeight:"800",color:theme.sidebar,flexShrink:1},
 fieldLabel:{fontSize:14,fontWeight:"600",color:theme.text},
 input:{minHeight:48,padding:12,borderWidth:1,borderColor:theme.border,
  borderRadius:10,backgroundColor:theme.surface,color:theme.text},
 helper:{fontSize:13,lineHeight:20,color:theme.mutedText},
 button:{minHeight:48,minWidth:68,borderWidth:1,borderColor:theme.border,
  borderRadius:10,paddingHorizontal:12,paddingVertical:10,justifyContent:"center"},
 selected:{borderColor:theme.primary,backgroundColor:theme.surface},
 buttonText:{color:theme.text,fontWeight:"600"},
 card:{borderWidth:1,borderColor:theme.border,borderRadius:16,
  backgroundColor:theme.surface,padding:16,gap:10},
 details:{gap:8,borderTopWidth:1,borderTopColor:theme.border,paddingTop:10},
 cardTitle:{fontSize:18,fontWeight:"700",color:theme.text},
 amount:{fontWeight:"800",fontSize:16,color:theme.sidebar},
 eyebrow:{color:theme.mutedText,fontSize:12,fontWeight:"700"}
});
