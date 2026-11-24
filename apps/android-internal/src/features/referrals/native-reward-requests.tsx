import React,{useCallback,useEffect,useRef,useState} from "react";
import {AppState,Pressable,StyleSheet,Text,View} from "react-native";
import {identityRequest} from "../identity-access/http-client";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";

type Kind="MEMBER"|"VOLUNTEER";
type RewardRequest={ref:string;type:"DIGITAL"|"PHYSICAL";kind:Kind;
 name:string;productName:string;pointsCost:string;status:string;requestedAt:string};
type Page={items:RewardRequest[];hasMore:boolean;page:number};
type Programme={ref:string;name:string};
/** CG13 US003 QA17 source-only parity for existing CG12 physical stock operator.
 * Never presents review approval or "Delivered": original CG12 Stock Operations
 * confirms ISSUE; only the actual signed-in recipient acknowledges CG19 handover.
 */
export function NativeRewardRequests({token,onExpired,programme,canIssueStock,
 canViewMembers,canViewVolunteers}:{
 token:string;onExpired:()=>void;programme:Programme|null;
 canIssueStock:boolean;canViewMembers:boolean;canViewVolunteers:boolean;
}){
 const [status,setStatus]=useState("HELD");
 const [items,setItems]=useState<RewardRequest[]>([]);
 const [page,setPage]=useState(1),[more,setMore]=useState(false);
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(""),[error,setError]=useState("");
 const serial=useRef(0),mutation=useRef(false);
 const get=useCallback(async(pageNumber:number,append:boolean)=>{
  const id=++serial.current;
  if(!programme||!canIssueStock){setItems([]);setMore(false);setBusy(false);return;}
  setBusy(true);setError("");if(!append)setItems([]);
  try{
   const params=new URLSearchParams({page:String(pageNumber),status});
   const res=await identityRequest("/api/v1/referrals/programmes/"+
    encodeURIComponent(programme.ref)+"/redemptions?"+params.toString(),{
    headers:{Authorization:"Bearer "+token},cache:"no-store"});
   if(res.status===401){onExpired();throw Error("Foundation session expired.");}
   if(!res.ok)throw Error(res.status===403?
    "Your current role cannot view this source-scoped reward queue.":
    "Original reward requests unavailable. Refresh before issuing.");
   const data=await res.json() as Page;
   if(id!==serial.current)return;
   if(!Array.isArray(data.items)||typeof data.hasMore!=="boolean")
    throw Error("Verified reward queue unavailable.");
   setItems(old=>append?[...old,...data.items.filter(v=>!old.some(x=>x.ref===v.ref))]:data.items);
   setPage(pageNumber);setMore(data.hasMore);
  }catch(e){if(id===serial.current)setError(e instanceof Error?e.message:
   "Warehouse queue result uncertain.");}
  finally{if(id===serial.current)setBusy(false);}
 },[token,onExpired,programme?.ref,canIssueStock,status]);
 useEffect(()=>{
  void get(1,false);
  const sub=AppState.addEventListener("change",next=>{
   if(next!=="active"){serial.current++;setItems([]);setNotice("");setError("");}
   else void get(1,false);
  });
  return()=>{serial.current++;sub.remove();};
 },[get]);
 const prepare=async(item:RewardRequest)=>{
  if(!canIssueStock||item.type!=="PHYSICAL"||item.status!=="HELD"||mutation.current)return;
  mutation.current=true;setBusy(true);setNotice("");setError("");
  try{
   const res=await identityRequest("/api/v1/rewards/admin/redemptions/"+
    encodeURIComponent(item.ref)+"/prepare-issue",{
    method:"POST",headers:{Authorization:"Bearer "+token},cache:"no-store"});
   if(res.status===401){onExpired();throw Error("Foundation session expired.");}
   if(!res.ok)throw Error(res.status===403?
    "Your role or warehouse assignment cannot prepare this original issue.":
    "Original warehouse state changed. Open Stock Operations before retrying.");
   const result=await res.json() as {notice?:string};
   setNotice(result.notice??"Original warehouse issue draft prepared.");
   await get(1,false);
  }catch(e){setError(e instanceof Error?e.message:
   "Issue preparation uncertain. Check original CG12 Stock Operations.");}
  finally{mutation.current=false;setBusy(false);}
 };
 if(!canIssueStock||!programme)return null;
 const button=(label:string,fn:()=>void,disabled:boolean)=><Pressable accessibilityRole="button"
  disabled={disabled} accessibilityState={{disabled}} onPress={fn}
  style={[s.button,disabled&&{opacity:.5}]}><Text style={s.buttonText}>{label}</Text></Pressable>;
 return <View style={s.card}>
  <Text style={s.heading}>Member &amp; Volunteer Reward Requests</Text>
  <Text style={s.note}>Only current authorized warehouse staff can prepare an actual CG12 stock ISSUE.
   The existing Stock Operations screen must independently confirm that issue; issuing is
   not recipient delivery or points spending.</Text>
  <View style={s.row}>
   {button("Pending stock holds",()=>setStatus("HELD"),busy)}
   {button("Issued — handover pending",()=>setStatus("ISSUED_AWAITING_HANDOVER"),busy)}
   {button("Refresh original requests",()=>void get(1,false),busy)}
  </View>
  {!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
  {!!notice&&<Text accessibilityRole="text" style={s.note}>{notice}</Text>}
  {busy&&<Text style={s.note}>Checking current protected warehouse source…</Text>}
  {!items.length&&!busy&&<Text style={s.note}>No source-confirmed requests in this status.</Text>}
  {items.map((item,i)=><View key={item.ref} style={s.record}>
   <Text style={s.heading}>{item.productName}</Text>
   <Text style={s.note}>{item.type==="PHYSICAL"?"Physical item":"Digital reward"} ·
    {item.pointsCost} points · {item.status}</Text>
   {(item.kind==="MEMBER"?canViewMembers:canViewVolunteers)&&
    <Text style={s.note}>Authorized recipient: {item.name}</Text>}
   {item.type==="PHYSICAL"&&item.status==="HELD"&&
    button("Prepare original warehouse ISSUE",()=>void prepare(item),busy||mutation.current)}
   {item.type==="PHYSICAL"&&item.status==="ISSUED_AWAITING_HANDOVER"&&
    <Text style={s.note}>Warehouse ISSUE confirmed; only the real recipient can acknowledge
     physical handover. Do not mark this request Delivered here.</Text>}
  </View>)}
  {more&&button("Older verified requests",()=>void get(page+1,true),busy)}
 </View>;
}
const s=StyleSheet.create({
 card:{padding:13,borderRadius:12,borderWidth:1,borderColor:t.border,backgroundColor:t.surface,gap:10},
 heading:{fontSize:16,fontWeight:"700",color:t.text},
 note:{fontSize:13,color:t.mutedText},
 error:{fontSize:13,color:t.error},
 row:{flexDirection:"row",flexWrap:"wrap",gap:7},
 record:{paddingTop:10,borderTopWidth:1,borderTopColor:t.border,gap:7},
 button:{minHeight:44,padding:10,backgroundColor:t.surface,borderRadius:8,
  borderWidth:1,borderColor:t.border,alignSelf:"flex-start",justifyContent:"center"},
 buttonText:{fontSize:13,color:t.text,fontWeight:"600"}
});
