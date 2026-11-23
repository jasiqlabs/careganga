import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {AppState,Image,Pressable,StyleSheet,Text,TextInput,View} from "react-native";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {memberInvoke} from "../membership/member-native-api";

type Reward={
 ref:string;type:"DIGITAL"|"PHYSICAL";category:string;name:string;description:string;
 pointsPrice:string;imageUrl:string|null;
 availability:"NO_STOCK_REQUIRED"|"AVAILABLE"|"OUT_OF_STOCK";
};
type Page={eligibleRelationships:string[];items:Reward[];hasMore:boolean;notice:string;
 categories:string[];categoriesTruncated:boolean};
export function NativeEligibleRewardsCatalogue({token,onExpired}:{
 token:string;onExpired:()=>void}){
 const [items,setItems]=useState<Reward[]>([]),[audiences,setAudiences]=useState<string[]>([]);
 const [notice,setNotice]=useState(""),[error,setError]=useState("");
 const [busy,setBusy]=useState(false),[more,setMore]=useState(false),[page,setPage]=useState(2);
 const [category,setCategory]=useState("All"),[search,setSearch]=useState("");
 const [appliedSearch,setAppliedSearch]=useState("");
 const [availableCategories,setAvailableCategories]=useState<string[]>([]);
 const [categoriesTruncated,setCategoriesTruncated]=useState(false);
 useEffect(()=>{
  const handle=setTimeout(()=>setAppliedSearch(search.trim()),300);
  return()=>clearTimeout(handle);
 },[search]);
 const [detail,setDetail]=useState<string|null>(null),sequence=useRef(0);
 const load=useCallback(async(target:number,replace:boolean)=>{
  const request=++sequence.current;setBusy(true);setError("");
  if(replace){setItems([]);setMore(false);}
  try{
   const query="page="+target+
    (appliedSearch?"&q="+encodeURIComponent(appliedSearch):"")+
    (category!=="All"?"&category="+encodeURIComponent(category):"");
   const result=await memberInvoke<Page>("/api/v1/referrals/my-catalog?"+query,
    "GET",undefined,token);
   if(!Array.isArray(result.items)||!Array.isArray(result.eligibleRelationships)||
    !Array.isArray(result.categories)||!result.categories.every(c=>typeof c==="string")||
    typeof result.hasMore!=="boolean"||typeof result.categoriesTruncated!=="boolean")
    throw Error("Rewards are temporarily unavailable.");
   if(request!==sequence.current)return;
   setAudiences(result.eligibleRelationships);setNotice(result.notice);
   setAvailableCategories(result.categories);
   setCategoriesTruncated(result.categoriesTruncated);
   setItems(old=>replace?result.items:
    [...old,...result.items.filter(x=>!old.some(v=>v.ref===x.ref))]);
   setMore(result.hasMore);setPage(target+1);
  }catch(e){
   if(request!==sequence.current)return;
   if(replace){setItems([]);setAudiences([]);setMore(false);setDetail(null);
    setAvailableCategories([]);setCategoriesTruncated(false);}
   if(e&&typeof e==="object"&&"status" in e&&e.status===401){onExpired();return;}
   setError(e instanceof Error?e.message:"Rewards are temporarily unavailable.");
  }finally{if(request===sequence.current)setBusy(false);}
 },[token,onExpired,appliedSearch,category]);
 useEffect(()=>{
  void load(1,true);
  const sub=AppState.addEventListener("change",state=>{
   if(state!=="active"){
    sequence.current++;setItems([]);setAudiences([]);setDetail(null);setMore(false);
    setAvailableCategories([]);setCategoriesTruncated(false);
   }else void load(1,true);
  });
  return()=>{sequence.current++;sub.remove();};
 },[load]);
 const categories=useMemo(()=>["All",...new Set(availableCategories)],[availableCategories]);
 const filtered=useMemo(()=>items.filter(x=>
  (category==="All"||x.category===category)&&
  (x.name+" "+x.category+" "+x.description).toLowerCase().includes(appliedSearch.toLowerCase())),
  [items,category,appliedSearch]);
 return <View style={s.card} accessibilityLabel="Your eligible rewards catalogue">
  <Text style={s.heading}>Rewards catalogue</Text>
  <Text style={s.muted}>Browse rewards offered to active members and volunteers.
   Points are not cash; redemption is not yet available.</Text>
  <Pressable style={s.button} accessibilityRole="button" disabled={busy}
   onPress={()=>void load(1,true)}>
   <Text style={s.buttonText}>Refresh rewards</Text>
  </Pressable>
  {busy&&<Text accessibilityRole="text">Checking current rewards…</Text>}
  {!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
  {!error&&!!notice&&<Text style={s.muted}>{notice}</Text>}
  {!!audiences.length&&<>
   <View style={s.filters}>
    {categories.map(c=><Pressable key={c} style={[s.button,category===c&&s.selected]}
     accessibilityRole="button" accessibilityState={{selected:category===c}}
     onPress={()=>setCategory(c)}><Text style={[s.buttonText,category===c&&s.selectedText]}>{c}</Text></Pressable>)}
   </View>
   {categoriesTruncated&&<Text style={s.muted}>More categories exist.
    Search all eligible rewards to find them.</Text>}
   <TextInput style={s.input} value={search} onChangeText={setSearch}
    placeholder="Search rewards" maxLength={100} accessibilityLabel="Search rewards by name or category"/>
   {filtered.map(p=><View key={p.ref} style={s.product}>
    {!!p.imageUrl&&<Image source={{uri:p.imageUrl}} style={s.image}
     accessibilityLabel={p.name} resizeMode="contain"/>}
    <Text style={s.productName}>{p.name}</Text>
    <Text>{p.category} · {p.type==="DIGITAL"?"Digital":"Physical"} · {p.pointsPrice} points</Text>
    <Text style={s.muted}>{p.type==="DIGITAL"?"No stock needed":
     p.availability==="AVAILABLE"?"In stock":"Currently unavailable"}</Text>
    <Pressable style={s.button} accessibilityRole="button"
     accessibilityState={{expanded:detail===p.ref}}
     onPress={()=>setDetail(d=>d===p.ref?null:p.ref)}>
     <Text style={s.buttonText}>{detail===p.ref?"Hide details":"Product details"}</Text>
    </Pressable>
    {detail===p.ref&&<Text>{p.description||"No description provided."}
     {"\n"}Rewards can be requested after verified referral points and fulfilment are enabled.</Text>}
   </View>)}
   {!filtered.length&&!busy&&<Text>No rewards match these filters.</Text>}
   {more&&<Pressable style={s.button} accessibilityRole="button" disabled={busy}
    onPress={()=>void load(page,false)}><Text style={s.buttonText}>Load more rewards</Text></Pressable>}
  </>}
  {!audiences.length&&!busy&&!error&&<Text style={s.muted}>Rewards will appear
   after your eligible membership or volunteer relationship is active.</Text>}
 </View>;
}
const s=StyleSheet.create({
 card:{backgroundColor:t.surface,borderWidth:1,borderColor:t.border,borderRadius:13,padding:15,gap:11},
 heading:{fontSize:18,fontWeight:"700",color:t.text},
 muted:{fontSize:13,color:t.mutedText},
 error:{color:"#a23b30",fontSize:13},
 filters:{flexDirection:"row",flexWrap:"wrap",gap:7},
 button:{minHeight:44,padding:11,borderWidth:1,borderColor:t.border,
  backgroundColor:t.surface,borderRadius:9,justifyContent:"center",alignSelf:"flex-start"},
 buttonText:{fontWeight:"600",color:t.text},
 selected:{backgroundColor:t.primary,borderColor:t.primary},
 selectedText:{color:t.primaryText},
 input:{borderWidth:1,borderColor:t.border,borderRadius:9,padding:11,minHeight:48,color:t.text},
 product:{borderWidth:1,borderColor:t.border,borderRadius:10,padding:12,gap:9},
 productName:{fontSize:16,fontWeight:"700",color:t.text},
 image:{width:"100%",height:150}
});
