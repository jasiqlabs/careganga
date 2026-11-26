import {useCallback,useEffect,useRef,useState} from "react";
import {Alert,Pressable,StyleSheet,Text,TextInput,View} from "react-native";
import * as Crypto from "expo-crypto";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {diagnosticRequest,isUncertain,moneyMinor,rupees,utcDate,
 type Item,type Mapping,type Price} from "./native-diagnostics-api";

type Props={token:string;centerRef:string;own:boolean;
 canMap:boolean;canPropose:boolean;canApprove:boolean;onExpired:()=>void};
type Attempt={key:string;route:string;body:Record<string,unknown>;label:string};
const label=(v:string)=>v.replaceAll("_"," ").toLowerCase();
const MAX=100;
export function NativeLabPricingPanel({token,centerRef,own,canMap,canPropose,
 canApprove,onExpired}:Props){
 const [items,setItems]=useState<Item[]>([]),[maps,setMaps]=useState<Mapping[]>([]);
 const [prices,setPrices]=useState<Price[]>([]);
 const priceFilter=useRef({status:"",offset:0});
 const [nextPriceOffset,setNextPriceOffset]=useState<number|null>(null),[priceLoading,setPriceLoading]=useState(false);
 const [kind,setKind]=useState<"TEST"|"PACKAGE">("TEST");
 const [itemRef,setItemRef]=useState(""),[mappingRef,setMappingRef]=useState("");
 const [base,setBase]=useState(""),[patient,setPatient]=useState("");
 const [start,setStart]=useState(""),[end,setEnd]=useState("");
 const [reason,setReason]=useState(""),[password,setPassword]=useState("");
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [uncertain,setUncertain]=useState(false),[message,setMessage]=useState("");
 const attempt=useRef<Attempt|null>(null);
 const epoch=useRef(0);
 const prefix=(own?"my-centers/":"centers/")+centerRef;
 const error=useCallback((e:unknown)=>{
  if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
  setMessage(e instanceof Error?e.message:"The current laboratory source is unavailable.");
 },[onExpired]);
 const refresh=useCallback(async()=>{
  const version=++epoch.current,filter=priceFilter.current;
  setPrices([]);setNextPriceOffset(null);setPriceLoading(true);
  try{const [a,b,c]=await Promise.all([
   diagnosticRequest<{items:Item[]}>(token,prefix+"/eligible-items"),
   diagnosticRequest<{mappings:Mapping[]}>(token,prefix+"/tests"),
   diagnosticRequest<{prices:Price[];nextOffset:number|null}>(token,prefix+"/test-prices?"+new URLSearchParams({priceStatus:filter.status,offset:String(filter.offset)}).toString())
  ]);
  if(version!==epoch.current)return;
  if(!Array.isArray(a.items)||!Array.isArray(b.mappings)||!Array.isArray(c.prices)||
    a.items.length>MAX||b.mappings.length>MAX||c.prices.length>MAX*3)
   throw Error("Lab lists cannot be verified; review again.");
  setItems(a.items);setMaps(b.mappings);setPrices(c.prices);setNextPriceOffset(c.nextOffset??null);
  }finally{if(version===epoch.current)setPriceLoading(false);}
 },[token,prefix]);
 useEffect(()=>{
  let live=true;
  priceFilter.current={status:"",offset:0};setNextPriceOffset(null);setMaps([]);setItems([]);setPrices([]);setLoading(true);
  setUncertain(false);attempt.current=null;setMessage("");
  void refresh().catch(e=>{if(live)error(e);}).finally(()=>{if(live)setLoading(false)});
  return()=>{live=false;++epoch.current;};
 },[refresh,error]);
 function filterPrices(status:string,offset=0){
  if(busy||uncertain||loading||priceLoading)return;
  priceFilter.current={status,offset};setPassword("");setMessage("");void refresh().catch(error);
 }
 async function send(command:Attempt,retry=false){
  if(busy||(!retry&&uncertain))return;
  setBusy(true);setMessage("");
  try{
   await diagnosticRequest(token,command.route,"POST",{...command.body,
    requestKey:command.key});
   attempt.current=null;setUncertain(false);
   if(command.route===prefix+"/tests")setItemRef("");
   if(command.route===prefix+"/test-prices"){
    setMappingRef("");setBase("");setPatient("");setStart("");setEnd("");setReason("");
   }
   setPassword("");
   setMessage(command.label);
   try{await refresh()}catch{
    setMessage(command.label+" Source saved, but list refresh failed. Refresh before another change.");
   }
  }catch(e){
   attempt.current=isUncertain(e)?command:null;
   setUncertain(isUncertain(e));error(e);
  }finally{setBusy(false);}
 }
 function commit(route:string,body:Record<string,unknown>,success:string){
  if(busy||uncertain)return;
  const current={route,body,key:Crypto.randomUUID(),label:success};
  attempt.current=current;void send(current);
 }
 function mapping(){
  if(!canMap||!itemRef)return;
  if(!items.some(v=>v.kind===kind&&v.itemRef===itemRef)){
   setMessage("Choose one currently eligible original test or package.");return;
  }
  commit(prefix+"/tests",{kind,itemRef},
   "Lab test mapping saved. No patient order or payment was created.");
 }
 function propose(){
  if(!canPropose||!mappingRef)return;
  const m=maps.find(x=>x.mappingRef===mappingRef&&x.status==="ACTIVE");
  if(!m){setMessage("Select an active mapped test.");return;}
  try{
   const basePriceMinor=moneyMinor(base),patientPriceMinor=moneyMinor(patient);
   if(patientPriceMinor>basePriceMinor)
    throw Error("Patient price cannot exceed the commercial base price.");
   const effectiveFromUtc=utcDate(start,true),effectiveToUtc=utcDate(end);
   if(effectiveToUtc&&effectiveFromUtc&&effectiveToUtc<=effectiveFromUtc)
    throw Error("Price expiry must be later than the start.");
   commit(prefix+"/test-prices",{mappingRef,expectedMappingVersion:m.revision,
    effectiveFromUtc,effectiveToUtc,basePriceMinor,patientPriceMinor,
    discountReason:reason,currency:"INR"},
    "Original commercial price proposed. An independent reviewer must approve it.");
  }catch(e){error(e);}
 }
 function decision(p:Price,action:"approve"|"reject"){
  if(!canApprove||!p.reviewCaseRevision||!p.reviewCaseRef||
   p.status!=="PROPOSED"||!["SUBMITTED","IN_REVIEW"].includes(p.reviewStatus??"")){
   setMessage("The current protected price approval record is unavailable.");return;
  }
  if(password.length<8){setMessage("Enter your current Foundation password.");return;}
  const currentPassword=password;setPassword("");
  commit("test-prices/"+p.priceRef+"/"+action,
   {expectedVersion:p.version,expectedCaseRevision:p.reviewCaseRevision,currentPassword},
   action==="approve"?"Original price independently approved. No payment collected.":
    "Original price proposal rejected. No published price created.");
 }
 const control=(name:string,value:string,update:(v:string)=>void,placeholder?:string,
  opts?:{secure?:boolean;numeric?:boolean})=><View style={s.field}>
   <Text style={s.label}>{name}</Text>
   <TextInput accessibilityLabel={name} value={value} onChangeText={update}
    placeholder={placeholder} placeholderTextColor={t.mutedText}
    secureTextEntry={opts?.secure} keyboardType={opts?.numeric?"decimal-pad":"default"}
    maxLength={opts?.secure?1024:240} autoCapitalize="none"
    style={s.input} editable={!busy&&!uncertain}/>
  </View>;
 const button=(name:string,run:()=>void,disabled=false,selected=false)=>
  <Pressable accessibilityRole="button" accessibilityLabel={name} onPress={run}
   disabled={disabled} accessibilityState={{disabled,selected}}
   style={[s.button,selected&&s.selected,disabled&&s.disabled]}>
   <Text style={s.buttonText}>{name}</Text>
  </Pressable>;
 return <View style={s.panel}>
  <Text style={s.title}>{own?"Assigned laboratory pricing":"Center-specific pricing"}</Text>
  <Text style={s.note}>Commercial partner tariffs only. Prices are not Foundation
   subsidies, money collected or confirmed payments.</Text>
  {!!message&&<Text accessibilityRole="alert" style={s.message}>{message}</Text>}
  {loading&&<Text style={s.note}>Checking the current original mappings and prices…</Text>}
  {uncertain&&<View style={s.item}>
   <Text style={s.message}>The previous write may already exist. Do not start another action.</Text>
   {button("Retry the exact same request",()=>{if(attempt.current)
    void send(attempt.current,true)},busy||!attempt.current)}
   {button("Refresh original records",()=>void refresh().then(()=>{
    setMessage("Current source refreshed. Verify the saved record before making another change.");
   }).catch(error),busy)}
  </View>}
  {button("Refresh current mappings and prices",()=>void refresh().catch(error),busy)}
  <Text style={s.title}>Mapped tests and packages</Text>
  {maps.length===0&&!loading&&<Text style={s.note}>No approved item mapped to this lab yet.</Text>}
  {maps.map(m=><View key={m.mappingRef} style={s.item}>
   <Text style={s.heading}>{m.name} · {m.code}</Text>
   <Text style={s.note}>{label(m.kind)} · {label(m.status)} · revision {m.revision}</Text>
  </View>)}
  {canMap&&<View style={s.item}>
   <Text style={s.heading}>Map one existing test or package</Text>
   <View style={s.row}>
    {button("Test",()=>{setKind("TEST");setItemRef("")},busy||uncertain,kind==="TEST")}
    {button("Package",()=>{setKind("PACKAGE");setItemRef("")},busy||uncertain,kind==="PACKAGE")}
   </View>
   {items.filter(i=>i.kind===kind&&!maps.some(m=>
     m.kind===i.kind&&(m.testRef===i.itemRef||m.packageRef===i.itemRef)))
    .map(i=>button(i.name+" · "+i.code,()=>setItemRef(i.itemRef),
     busy||uncertain,itemRef===i.itemRef))}
   {button("Map selected item to this lab",mapping,busy||uncertain||!itemRef)}
  </View>}
  {canPropose&&<View style={s.item}>
   <Text style={s.heading}>Propose a commercial price</Text>
   {maps.filter(m=>m.status==="ACTIVE").map(m=>button(m.name+" · "+m.code,
    ()=>setMappingRef(m.mappingRef),busy||uncertain,mappingRef===m.mappingRef))}
   {control("Base price (₹)",base,setBase,"Example: 250.00",{numeric:true})}
   {control("Patient price (₹)",patient,setPatient,"Example: 200.00",{numeric:true})}
   {control("Effective start with timezone",start,setStart,"YYYY-MM-DDTHH:mm:ss+05:30")}
   {control("Effective end with timezone (optional)",end,setEnd,"YYYY-MM-DDTHH:mm:ss+05:30")}
   {control("Discount reason (optional)",reason,setReason)}
   {button("Submit price for independent approval",propose,
    busy||uncertain||!mappingRef||!base||!patient||!start)}
  </View>}
  <Text style={s.title}>Original price proposals and history</Text>
  <Text style={s.label}>Price status</Text>
  <View style={s.row}>{[["","All statuses"],["PROPOSED","Pending review"],["APPROVED","Approved (all dates)"],["CURRENT","Approved, currently effective"],["UPCOMING","Approved, upcoming"],["EXPIRED","Approved, expired"],["REJECTED","Rejected"]].map(([value,name])=><View key={value||"all"}>{button(name,()=>filterPrices(value),busy||uncertain||loading||priceLoading,priceFilter.current.status===value)}</View>)}</View>
  {priceLoading&&<Text accessibilityLiveRegion="polite" style={s.note}>Checking current prices…</Text>}
  {prices.length===0&&!loading&&!priceLoading&&!message&&<Text style={s.note}>No prices match the current filter.</Text>}
  {canApprove&&prices.some(p=>p.status==="PROPOSED")&&control(
   "Current Foundation password for independent decision",password,setPassword,
   "Required only for price approval or rejection",{secure:true})}
  {prices.map(p=><View key={p.priceRef} style={s.item}>
   <Text style={s.heading}>{maps.find(m=>m.mappingRef===p.mappingRef)?.name??"Mapped item"}</Text>
   <Text style={s.note}>Patient price {rupees(p.patientPriceMinor)} ·
    Base {rupees(p.basePriceMinor)}</Text>
   <Text style={s.note}>{label(p.status)} · Version {p.version} ·
    {p.effectiveFromUtc} — {p.effectiveToUtc??"no expiry"}</Text>
   {!!p.reviewReference&&<Text style={s.note}>Review {p.reviewReference} ·
    {label(p.reviewStatus??"pending")}</Text>}
   {canApprove&&p.status==="PROPOSED"&&p.reviewCaseRevision&&
    ["SUBMITTED","IN_REVIEW"].includes(p.reviewStatus??"")&&<View style={s.row}>
    {button("Approve price",()=>Alert.alert("Approve this price?",
     "A qualified different Foundation reviewer and fresh password are required.",[
      {text:"Cancel",style:"cancel"},
      {text:"Approve",onPress:()=>decision(p,"approve")}
     ]),busy||uncertain||password.length<8)}
    {button("Reject price",()=>Alert.alert("Reject this price?",
     "The commercial proposal will not become a published rate.",[
      {text:"Cancel",style:"cancel"},
      {text:"Reject",style:"destructive",onPress:()=>decision(p,"reject")}
     ]),busy||uncertain||password.length<8)}
   </View>}
  </View>)}
  <View style={s.row}>
   {button("Previous prices",()=>filterPrices(priceFilter.current.status,Math.max(0,priceFilter.current.offset-100)),busy||uncertain||loading||priceLoading||priceFilter.current.offset===0)}
   {button("Next prices",()=>{if(nextPriceOffset!==null)filterPrices(priceFilter.current.status,nextPriceOffset);},busy||uncertain||loading||priceLoading||nextPriceOffset===null)}
  </View>
 </View>;
}
const s=StyleSheet.create({
 panel:{padding:12,gap:12,borderWidth:1,borderRadius:14,borderColor:t.border,
  backgroundColor:t.surface},
 title:{fontSize:18,fontWeight:"700",color:t.text},
 heading:{fontSize:15,fontWeight:"600",color:t.text},
 note:{fontSize:13,lineHeight:19,color:t.mutedText},
 message:{fontSize:13,lineHeight:20,color:t.error},
 item:{padding:11,borderWidth:1,borderColor:t.border,borderRadius:12,gap:10},
 field:{gap:5},label:{fontSize:13,color:t.text,fontWeight:"500"},
 input:{minHeight:48,borderWidth:1,borderColor:t.border,borderRadius:10,
  padding:10,color:t.text,backgroundColor:t.surface},
 row:{flexDirection:"row",gap:8,flexWrap:"wrap"},
 button:{minHeight:48,borderWidth:1,borderColor:t.border,
  borderRadius:10,padding:11,justifyContent:"center"},
 buttonText:{color:t.text,fontSize:14,fontWeight:"600"},
 selected:{borderColor:t.primary,backgroundColor:t.selectedSurface},
 disabled:{opacity:0.5}
});
