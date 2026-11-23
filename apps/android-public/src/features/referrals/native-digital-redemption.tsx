import {useCallback,useEffect,useRef,useState} from "react";
import {AppState,Pressable,StyleSheet,Text,View} from "react-native";
import * as Crypto from "expo-crypto";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {memberInvoke} from "../membership/member-native-api";
type Kind="MEMBER"|"VOLUNTEER";
export type NativeRedeemableReward={
 ref:string;programmeRef:string;name:string;type:"DIGITAL"|"PHYSICAL";
 pointsPrice:string;version:number;eligibleAudience:Kind|"BOTH";
 programmeAudience:Kind|"BOTH";
};
type Receipt={ref:string;state:string;productName:string;pointsCost:string;requestedAt:string};
type Page={items:Receipt[];hasMore:boolean;page:number};
type Created={ref:string;state:string;replayed:boolean;pointsCost:string;notice:string};
export function NativeDigitalRedemption({token,onExpired,selected,onClose,audiences}:{
 token:string;onExpired:()=>void;selected:NativeRedeemableReward|null;
 onClose:()=>void;audiences:string[]
}){
 const [kind,setKind]=useState<Kind>("MEMBER"),[confirm,setConfirm]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [items,setItems]=useState<Receipt[]>([]),[more,setMore]=useState(false),[page,setPage]=useState(2);
 const key=useRef<{signature:string;uuid:string}|null>(null),seq=useRef(0),locked=useRef(false);
 const eligible=selected?audiences.filter((v):v is Kind=>
  (v==="MEMBER"||v==="VOLUNTEER")&&
  (selected.eligibleAudience==="BOTH"||selected.eligibleAudience===v)&&
  (selected.programmeAudience==="BOTH"||selected.programmeAudience===v)):[];
 const chosen=eligible.includes(kind)?kind:eligible[0];
 const api=useCallback(async<T,>(path:string,method:"GET"|"POST"="GET",
  body?:Record<string,unknown>)=>{
  try{return await memberInvoke<T>("/api/v1/rewards/"+path,method,body,token);}
  catch(e){if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();throw e;}
 },[token,onExpired]);
 const refresh=useCallback(async(target=1,append=false)=>{
  const request=++seq.current;
  try{
   const result=await api<Page>("redemptions/my-history?page="+target);
   if(request!==seq.current)return;
   if(!Array.isArray(result.items)||typeof result.hasMore!=="boolean")
    throw Error("Verified request history unavailable.");
   setItems(old=>append?[...old,...result.items.filter(x=>!old.some(y=>y.ref===x.ref))]:result.items);
   setMore(result.hasMore);setPage(target+1);
  }catch(e){if(request===seq.current)setError(e instanceof Error?e.message:
   "Your private reward requests are unavailable.");}
 },[api]);
 useEffect(()=>{
  void refresh();
  const sub=AppState.addEventListener("change",state=>{
   if(state!=="active"){seq.current++;setItems([]);setNotice("");setError("");setConfirm(false);}
   else void refresh();
  });
  return()=>{seq.current++;sub.remove();};
 },[refresh]);
 useEffect(()=>{setConfirm(false);setNotice("");setError("");key.current=null;},
  [selected?.ref,selected?.version,kind]);
 const request=async()=>{
  if(!selected||selected.type!=="DIGITAL"||!chosen||busy||locked.current)return;
  if(!/^[1-9][0-9]{0,17}$/.test(selected.pointsPrice)){
   setError("Current points price is unavailable.");return;}
  const signature=selected.ref+":"+selected.version+":"+chosen;
  if(!key.current||key.current.signature!==signature)
   key.current={signature,uuid:Crypto.randomUUID()};
  locked.current=true;setBusy(true);setError("");setNotice("");
  try{
   const receipt=await api<Created>("redemptions","POST",{
    programmeRef:selected.programmeRef,productRef:selected.ref,relationship:chosen,
    expectedProductVersion:selected.version,requestKey:key.current.uuid
   });
   setNotice(receipt.notice);setConfirm(false);await refresh();
  }catch(e){setError(e instanceof Error?e.message:
   "Result uncertain. Refresh history before retrying the SAME request.");}
  finally{locked.current=false;setBusy(false);}
 };
 const cancel=async(x:Receipt)=>{
  if(busy||locked.current||x.state!=="HELD")return;
  locked.current=true;setBusy(true);setError("");setNotice("");
  try{await api("redemptions/"+x.ref+"/cancel","POST",{});
   setNotice("Original digital points hold cancelled and released.");await refresh();}
  catch(e){setError(e instanceof Error?e.message:
   "Cancellation uncertain. Refresh original history first.");}
  finally{locked.current=false;setBusy(false);}
 };
 const button=(title:string,fn:()=>void,disabled=false)=>{
  return <Pressable style={s.button} accessibilityRole="button" disabled={disabled}
   accessibilityState={{disabled}} onPress={fn}><Text style={s.action}>{title}</Text></Pressable>;
 };
 return <View style={s.card} accessibilityLabel="Your verified digital reward requests">
  <Text style={s.title}>Digital reward requests</Text>
  <Text style={s.note}>Only verified points can be reserved. Digital delivery remains
   pending real fulfillment evidence; no fake gift code, CG12 stock or cash is issued.</Text>
  {selected?.type==="DIGITAL"&&<>
   <Text style={s.title}>{selected.name} · {selected.pointsPrice} points</Text>
   {!eligible.length?<Text style={s.note}>Current relationship is not eligible.</Text>:
    <>
     <View style={s.row}>{eligible.map(k=><Pressable key={k}
      accessibilityRole="button" accessibilityState={{selected:k===chosen}}
      style={[s.button,chosen===k&&s.selected]} onPress={()=>setKind(k)}>
      <Text style={[s.action,chosen===k&&s.selectedText]}>
       {k==="MEMBER"?"Membership":"Volunteer"}</Text></Pressable>)}</View>
     {!confirm?button("Review points reservation",()=>setConfirm(true),busy):
      <View style={s.card}>
       <Text style={s.note}>Confirm holding {selected.pointsPrice} verified points.
        The request stays pending until genuine digital delivery is recorded.</Text>
       <View style={s.row}>{button("Confirm points hold",()=>void request(),busy)}
        {button("Back",()=>setConfirm(false),busy)}</View>
      </View>}
    </>}
   {button("Close selection",onClose,busy)}
  </>}
  {!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
  {!!notice&&<Text accessibilityRole="text" style={s.note}>{notice}</Text>}
  <Text style={s.title}>My request history</Text>
  {!items.length&&<Text style={s.note}>No confirmed digital requests are recorded.</Text>}
  {items.map(x=><View key={x.ref} style={s.item}>
   <Text style={s.title}>{x.productName}</Text>
   <Text style={s.note}>{x.pointsCost} points · {x.state==="HELD"?
    "Points held — delivery pending":x.state==="CANCELLED"?"Cancelled — points released":x.state}</Text>
   <Text style={s.note}>{new Date(x.requestedAt).toLocaleDateString("en-IN",
    {timeZone:"Asia/Kolkata"})}</Text>
   {x.state==="HELD"&&button("Cancel pending request",()=>void cancel(x),busy)}
  </View>)}
  <View style={s.row}>
   {button("Refresh original history",()=>void refresh(),busy)}
   {more&&button("Older requests",()=>void refresh(page,true),busy)}
  </View>
 </View>;
}
const s=StyleSheet.create({
 card:{borderWidth:1,borderColor:t.border,borderRadius:12,backgroundColor:t.surface,
  padding:12,gap:9},title:{fontSize:16,fontWeight:"700",color:t.text},
 note:{fontSize:13,color:t.mutedText},
 error:{fontSize:13,color:"#a23b30"},row:{flexDirection:"row",flexWrap:"wrap",gap:7},
 item:{borderTopWidth:1,borderColor:t.border,paddingTop:10,gap:6},
 button:{minHeight:44,padding:10,borderRadius:8,borderWidth:1,borderColor:t.border,
  backgroundColor:t.surface,alignSelf:"flex-start",justifyContent:"center"},
 action:{fontSize:13,fontWeight:"600",color:t.text},
 selected:{backgroundColor:t.primary,borderColor:t.primary},
 selectedText:{color:t.primaryText}
});
