import React,{useCallback,useEffect,useRef,useState} from "react";
import {AppState,Image,Pressable,ScrollView,StyleSheet,Text,View} from "react-native";
import {identityRequest} from "../identity-access/http-client";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";

type Programme={ref:string;name:string;status:"ACTIVE"|"INACTIVE"};
type Reward={ref:string;programmeRef:string;type:"DIGITAL"|"PHYSICAL";name:string;
 category:string;description:string;pointsPrice:string;eligibleAudience:string;
 status:"DRAFT"|"ACTIVE"|"ARCHIVED";highlighted:boolean;
 imageUrl:string|null;publicVisible:boolean};
type Paged<T>={items:T[];hasMore:boolean;page:number};

export function NativeRewardCatalogue({token,onExpired}:{
 token:string;onExpired:()=>void}){
 const [programmes,setProgrammes]=useState<Programme[]>([]),[chosen,setChosen]=useState("");
 const [items,setItems]=useState<Reward[]>([]);
 const [nextProgramme,setNextProgramme]=useState(2),[nextProduct,setNextProduct]=useState(2);
 const [moreProgrammes,setMoreProgrammes]=useState(false),[moreProducts,setMoreProducts]=useState(false);
 const [loading,setLoading]=useState(false),[error,setError]=useState("");
 const [expanded,setExpanded]=useState<string|null>(null);
 const programmeSeq=useRef(0),productSeq=useRef(0);
 const call=useCallback(async<T,>(path:string):Promise<T>=>{
  const response=await identityRequest("/api/v1/referrals/"+path,{
   headers:{Authorization:"Bearer "+token},cache:"no-store"});
  if(response.status===401){onExpired();throw Error("Your Foundation session expired.");}
  if(!response.ok)throw Error(response.status===403?
   "Your current Foundation role cannot view this catalogue.":
   "Rewards catalogue is temporarily unavailable.");
  return response.json() as Promise<T>;
 },[token,onExpired]);
 const loadProgrammes=useCallback(async(page:number,append:boolean)=>{
  const serial=++programmeSeq.current;setLoading(true);setError("");
  if(!append){setProgrammes([]);setItems([]);setChosen("");setExpanded(null);}
  try{
   const data=await call<Paged<Programme>>("catalogue-programmes?page="+page);
   if(serial!==programmeSeq.current)return;
   if(!Array.isArray(data.items)||typeof data.hasMore!=="boolean")throw Error("Catalogue data unavailable.");
   setProgrammes(old=>append?[...old,...data.items.filter(p=>!old.some(x=>x.ref===p.ref))]:data.items);
   setMoreProgrammes(data.hasMore);setNextProgramme(page+1);
   if(!append)setChosen(data.items[0]?.ref??"");
  }catch(e){if(serial===programmeSeq.current)setError(e instanceof Error?e.message:"Catalogue unavailable.");}
  finally{if(serial===programmeSeq.current)setLoading(false);}
 },[call]);
 const loadProducts=useCallback(async(programme:string,page:number,append:boolean)=>{
  const serial=++productSeq.current;setLoading(true);setError("");
  if(!append){setItems([]);setExpanded(null);setMoreProducts(false);}
  try{
   const data=await call<Paged<Reward>>("programmes/"+programme+"/products?page="+page);
   if(serial!==productSeq.current)return;
   if(!Array.isArray(data.items)||typeof data.hasMore!=="boolean")throw Error("Catalogue data unavailable.");
   setItems(old=>append?[...old,...data.items.filter(p=>!old.some(x=>x.ref===p.ref))]:data.items);
   setMoreProducts(data.hasMore);setNextProduct(page+1);
  }catch(e){if(serial===productSeq.current)setError(e instanceof Error?e.message:"Catalogue unavailable.");}
  finally{if(serial===productSeq.current)setLoading(false);}
 },[call]);
 useEffect(()=>{
  void loadProgrammes(1,false);
  const sub=AppState.addEventListener("change",state=>{
   if(state!=="active"){programmeSeq.current++;productSeq.current++;setItems([]);setProgrammes([]);setExpanded(null);}
   else void loadProgrammes(1,false);
  });
  return()=>{programmeSeq.current++;productSeq.current++;sub.remove();};
 },[loadProgrammes]);
 useEffect(()=>{
  if(!chosen)return;
  void loadProducts(chosen,1,false);
  return()=>{productSeq.current++;};
 },[chosen,loadProducts]);
 const btn=(label:string,fn:()=>void,disabled=false)=>
  <Pressable accessibilityRole="button" disabled={disabled} accessibilityState={{disabled}}
   style={[s.button,disabled&&s.disabled]} onPress={fn}>
   <Text style={s.buttonText}>{label}</Text>
  </Pressable>;
 return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.page}>
  <Text style={s.title}>Rewards Store</Text>
  <Text style={s.muted}>View the current Foundation reward catalogue. Programme
   settings, award approvals and warehouse fulfilment are handled in their authorized workflows.</Text>
  <View style={s.card}>
   <Text style={s.heading}>Referral programmes</Text>
   <View style={s.wrap}>{programmes.map(p=><Pressable key={p.ref}
    accessibilityRole="button" accessibilityState={{selected:chosen===p.ref}}
    style={[s.button,chosen===p.ref&&s.selected]} onPress={()=>setChosen(p.ref)}>
    <Text style={[s.buttonText,chosen===p.ref&&s.selectedText]}>{p.name} · {p.status}</Text>
   </Pressable>)}</View>
   {moreProgrammes&&btn("Load more programmes",()=>void loadProgrammes(nextProgramme,true),loading)}
   {btn("Refresh catalogue",()=>void loadProgrammes(1,false),loading)}
   {!programmes.length&&!loading&&!error&&<Text>No programmes have been recorded.</Text>}
  </View>
  {!!error&&<Text style={s.error} accessibilityRole="alert">{error}</Text>}
  {loading&&<Text accessibilityRole="text">Loading current rewards…</Text>}
  {!!chosen&&<View style={s.card}>
   <Text style={s.heading}>Reward products</Text>
   {items.map(p=><View key={p.ref} style={s.product}>
    {!!p.imageUrl&&<Image source={{uri:p.imageUrl}} style={s.image}
     resizeMode="contain" accessibilityLabel={p.name}/>}
    <Text style={s.heading}>{p.name}</Text>
    <Text>{p.category} · {p.type==="DIGITAL"?"Digital":"Physical"} · {p.pointsPrice} points</Text>
    <Text style={s.muted}>{p.status} · {p.eligibleAudience} ·
     {p.publicVisible?" Eligible catalogue":" Staff only"}</Text>
    {btn(expanded===p.ref?"Hide details":"Product details",
     ()=>setExpanded(v=>v===p.ref?null:p.ref))}
    {expanded===p.ref&&<Text>{p.description||"No description provided."}</Text>}
   </View>)}
   {!items.length&&!loading&&!error&&<Text>No products recorded for this programme.</Text>}
   {moreProducts&&btn("Load more products",()=>void loadProducts(chosen,nextProduct,true),loading)}
  </View>}
 </ScrollView>;
}
const s=StyleSheet.create({
 page:{padding:16,paddingBottom:110,gap:12,backgroundColor:t.adminCanvas},
 title:{fontSize:22,fontWeight:"700",color:t.text},
 heading:{fontSize:16,fontWeight:"700",color:t.text},
 muted:{fontSize:13,color:t.mutedText},
 error:{fontSize:13,color:t.error},
 card:{padding:14,borderRadius:12,borderWidth:1,borderColor:t.border,
  backgroundColor:t.surface,gap:11},
 product:{borderTopWidth:1,borderTopColor:t.border,paddingVertical:12,gap:8},
 image:{height:145,width:"100%"},
 wrap:{flexDirection:"row",flexWrap:"wrap",gap:8},
 button:{borderRadius:9,borderWidth:1,borderColor:t.border,backgroundColor:t.surface,
  minHeight:44,padding:11,justifyContent:"center",alignSelf:"flex-start"},
 disabled:{opacity:.5},
 buttonText:{color:t.text,fontWeight:"600"},
 selected:{backgroundColor:t.primary,borderColor:t.primary},
 selectedText:{color:t.primaryText}
});
