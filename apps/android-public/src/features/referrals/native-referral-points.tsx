import {useCallback,useEffect,useRef,useState} from "react";
import {AppState,Pressable,StyleSheet,Text,View} from "react-native";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {memberInvoke} from "../membership/member-native-api";
type Kind="MEMBER"|"VOLUNTEER";
type Balance={earnedPoints:string;reversedPoints:string;heldPoints:string;
 availablePoints:string;qualifiedReferrals:number;currentRankName:string|null;
 adjustmentDuePoints:string};
type Entry={status:"QUALIFIED"|"REVERSED";points:string;recordedAt:string;rank:string|null};
type History={items:Entry[];page:number;hasMore:boolean};
type Rank={rank:string|null;qualifiedReferrals:number;
 history:{current:string|null;eligiblePoints:string;qualifiedReferrals:number;recordedAt:string}[]};
const display=(v:string)=>/^\-?[0-9]{1,18}$/.test(v)?
 BigInt(v).toLocaleString("en-IN"):"Unavailable";
export function NativeReferralPoints({token,onExpired,programmeRef,relationship}:{
 token:string;onExpired:()=>void;programmeRef:string;relationship:Kind}){
 const [balance,setBalance]=useState<Balance|null>(null),[rank,setRank]=useState<Rank|null>(null);
 const [events,setEvents]=useState<Entry[]>([]),[next,setNext]=useState(2);
 const [more,setMore]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const sequence=useRef(0),locked=useRef(false);
 const query="programmeRef="+encodeURIComponent(programmeRef)+
  "&relationship="+encodeURIComponent(relationship);
 const load=useCallback(async(page:number,append=false)=>{
  if(locked.current)return;locked.current=true;const request=++sequence.current;
  setBusy(true);setError("");
  if(!append){setBalance(null);setRank(null);setEvents([]);setMore(false);}
  try{
   const call=<T,>(path:string)=>memberInvoke<T>("/api/v1/referrals/"+path,"GET",undefined,token);
   if(append){
    const r=await call<History>("my-history?"+query+"&page="+page);
    if(request===sequence.current){setEvents(old=>[...old,...r.items]);
     setMore(r.hasMore);setNext(page+1);}
   }else{
    const [b,h,k]=await Promise.all([
     call<Balance>("points/my-balance?"+query),
     call<History>("my-history?"+query+"&page=1"),
     call<Rank>("rewards/my-rank?"+query+"&page=1")
    ]);
    if(request===sequence.current){setBalance(b);setEvents(h.items);
     setMore(h.hasMore);setNext(2);setRank(k);}
   }
  }catch(e){
   if(request===sequence.current){
    if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
    else setError(e instanceof Error?e.message:"Referral points could not be confirmed.");
   }
  }finally{if(request===sequence.current){locked.current=false;setBusy(false);}}
 },[token,onExpired,query]);
 useEffect(()=>{
  void load(1);
  const sub=AppState.addEventListener("change",state=>{
   if(state!=="active"){sequence.current++;locked.current=false;
    setBalance(null);setRank(null);setEvents([]);setMore(false);setBusy(false);}
   else void load(1);
  });
  return()=>{sequence.current++;sub.remove();};
 },[load]);
 return <View style={s.panel} accessibilityLabel="Your verified referral points and rank">
  <Text style={s.heading}>My verified referral points</Text>
  <Text style={s.sub}>No credit is awarded for sharing or submitting a form.
   Only independently approved qualifying events earn points.</Text>
  {!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
  {busy&&<Text accessibilityRole="text" style={s.sub}>Checking protected points…</Text>}
  {balance&&<View style={s.summary}>
   <Text style={s.text}>Earned: {display(balance.earnedPoints)}</Text>
   <Text style={s.text}>Available: {display(balance.availablePoints)}</Text>
   <Text style={s.text}>Held: {display(balance.heldPoints)}</Text>
   <Text style={s.text}>Reversed: {display(balance.reversedPoints)}</Text>
   <Text style={s.text}>Verified referrals: {balance.qualifiedReferrals}</Text>
   <Text style={s.text}>Current rank: {rank?.rank??"Not ranked yet"}</Text>
   {balance.adjustmentDuePoints!=="0"&&<Text style={s.sub}>
    Adjustment under review: {display(balance.adjustmentDuePoints)} points</Text>}
  </View>}
  {balance&&<View style={s.summary}>
   <Text style={s.heading}>My referral history</Text>
   {!events.length&&<Text style={s.sub}>No verified qualifying referrals recorded.</Text>}
   {events.map((e,i)=><Text key={e.recordedAt+":"+i} style={s.text}>
    {e.status==="QUALIFIED"?"Qualified":"Reversed"} · {display(e.points)} points ·
    {new Date(e.recordedAt).toLocaleDateString("en-IN",{timeZone:"Asia/Kolkata"})}
    {e.rank?" · "+e.rank:""}</Text>)}
   {more&&<Pressable style={s.button} disabled={busy}
    accessibilityRole="button" onPress={()=>void load(next,true)}>
    <Text style={s.action}>Older history</Text></Pressable>}
   {!!rank?.history?.length&&<View>
    <Text style={s.heading}>Rank history</Text>
    {rank.history.map((e,i)=><Text key={e.recordedAt+":"+i} style={s.text}>
     {e.current??"Unranked"} · {e.qualifiedReferrals} verified ·
     {display(e.eligiblePoints)} eligible points</Text>)}
   </View>}
  </View>}
  <Pressable style={s.button} disabled={busy} accessibilityRole="button"
   onPress={()=>void load(1)}><Text style={s.action}>Refresh points</Text></Pressable>
 </View>;
}
const s=StyleSheet.create({
 panel:{borderWidth:1,borderRadius:12,borderColor:t.border,
  backgroundColor:t.surface,padding:14,gap:10},
 heading:{fontSize:16,fontWeight:"700",color:t.text},
 sub:{fontSize:13,color:t.mutedText},
 text:{fontSize:14,color:t.text,marginBottom:5},
 summary:{gap:5,borderTopWidth:1,borderColor:t.border,paddingTop:10},
 error:{fontSize:13,color:"#a23b30"},
 button:{minHeight:44,padding:12,borderRadius:9,borderWidth:1,
  borderColor:t.border,alignSelf:"flex-start",justifyContent:"center"},
 action:{color:t.text,fontWeight:"600"}
});
