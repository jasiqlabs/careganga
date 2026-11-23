import {useCallback,useEffect,useRef,useState} from "react";
import {AppState,Pressable,Share,StyleSheet,Text,View} from "react-native";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {memberInvoke} from "../membership/member-native-api";

type Relationship="MEMBER"|"VOLUNTEER";
type Choice={programmeRef:string;programmeName:string;relationship:Relationship};
type Options={items:Choice[];page:number;hasMore:boolean;notice:string};
type Issued={programmeName:string;relationship:Relationship;code:string;sharePath:string;notice:string};
export function NativeReferralCode({token,onExpired}:{token:string;onExpired:()=>void}){
 const [choices,setChoices]=useState<Choice[]>([]),[chosen,setChosen]=useState("");
 const [issued,setIssued]=useState<Issued|null>(null),[error,setError]=useState("");
 const [loading,setLoading]=useState(false),[more,setMore]=useState(false);
 const [nextPage,setNextPage]=useState(2);
 const sequence=useRef(0),requestLocked=useRef(false);
 const safeRequest=useCallback(async<T,>(path:string)=>{
  try{return await memberInvoke<T>("/api/v1/referrals/"+path,"GET",undefined,token);}
  catch(e){
   if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
   throw e;
  }
 },[token,onExpired]);
 const load=useCallback(async(page:number,append:boolean)=>{
  if(requestLocked.current)return;
  requestLocked.current=true;const request=++sequence.current;setLoading(true);setError("");
  if(!append){setChoices([]);setChosen("");setIssued(null);setMore(false);}
  try{
   const result=await safeRequest<Options>("my-code/options?page="+page);
   if(request!==sequence.current)return;
   if(!Array.isArray(result.items)||typeof result.hasMore!=="boolean")
    throw Error("Referral programmes are not available.");
   setChoices(old=>append?[...old,...result.items.filter(p=>!old.some(x=>
    x.programmeRef===p.programmeRef&&x.relationship===p.relationship))]:result.items);
   setMore(result.hasMore);setNextPage(page+1);
  }catch(e){if(request===sequence.current)setError(e instanceof Error?e.message:
    "Could not verify current referral eligibility.");}
  finally{requestLocked.current=false;if(request===sequence.current)setLoading(false);}
 },[safeRequest]);
 useEffect(()=>{
  void load(1,false);
  const sub=AppState.addEventListener("change",state=>{
   if(state!=="active"){
    sequence.current++;setIssued(null);setChoices([]);setChosen("");setMore(false);setLoading(false);
   }else void load(1,false);
  });
  return()=>{sequence.current++;sub.remove();};
 },[load]);
 const issue=async()=>{
  const item=choices.find(x=>x.programmeRef+"|"+x.relationship===chosen);
  if(!item||loading||requestLocked.current)return;
  requestLocked.current=true;const request=++sequence.current;
  setLoading(true);setError("");setIssued(null);
  try{
   const query="my-code?programmeRef="+encodeURIComponent(item.programmeRef)+
    "&relationship="+encodeURIComponent(item.relationship);
   const data=await safeRequest<Issued>(query);
   if(request!==sequence.current)return;
   if(!/^[A-Za-z0-9_-]{32}$/.test(data.code)||
     !/^\/(?:membership|volunteer)\?ref=[A-Za-z0-9_-]{32}$/.test(data.sharePath))
    throw Error("Referral code is unavailable.");
   setIssued(data);
  }catch(e){if(request===sequence.current)setError(e instanceof Error?e.message:
    "Referral code cannot be confirmed.");}
  finally{requestLocked.current=false;if(request===sequence.current)setLoading(false);}
 };
 const share=async()=>{
  if(!issued)return;
  const website=process.env.EXPO_PUBLIC_PUBLIC_WEB_URL??"";
  const host=/^https:\/\/[A-Za-z0-9.-]+(?::443)?\/?$/.test(website)?
   website.replace(/\/$/,""):"";
  const message=host?host+issued.sharePath:
   "CareGanga referral code: "+issued.code+" — enter it when submitting your application.";
  try{await Share.share({message});}
  catch{setError("Sharing is unavailable. You can select and copy your code below.");}
 };
 const button=(label:string,fn:()=>void,disabled=false,selected=false)=>
  <Pressable accessibilityRole="button" disabled={disabled}
   accessibilityState={{disabled,selected}}
   style={[s.button,selected&&s.selected]} onPress={fn}>
   <Text style={[s.buttonText,selected&&s.selectedText]}>{label}</Text>
  </Pressable>;
 return <View style={s.card} accessibilityLabel="Your current referral code">
  <Text style={s.title}>Invite with your referral code</Text>
  <Text style={s.note}>Your code belongs to a real active membership or volunteer relationship.
   Points are earned only after independently verified qualification, never for clicks.</Text>
  {loading&&<Text accessibilityRole="text">Checking eligible programmes…</Text>}
  {!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
  {choices.map(item=>{
   const key=item.programmeRef+"|"+item.relationship;
   return <Pressable key={key} accessibilityRole="button"
    accessibilityState={{selected:chosen===key}}
    style={[s.button,chosen===key&&s.selected]}
    onPress={()=>{setChosen(key);setIssued(null);}}>
    <Text style={[s.buttonText,chosen===key&&s.selectedText]}>
     {item.programmeName} — {item.relationship==="MEMBER"?"Membership":"Volunteer"}
    </Text>
   </Pressable>;
  })}
  {!choices.length&&!loading&&!error&&<Text style={s.note}>
   No active referral programme is available for your verified relationship.</Text>}
  <View style={s.actions}>
   {button("Get my referral code",()=>void issue(),loading||!chosen)}
   {more&&button("More programmes",()=>void load(nextPage,true),loading)}
   {button("Refresh eligibility",()=>void load(1,false),loading)}
  </View>
  {issued&&<View style={s.result}>
   <Text style={s.title}>{issued.programmeName}</Text>
   <Text selectable accessibilityRole="text" style={s.code}>{issued.code}</Text>
   <Text style={s.note}>The code can be reused. Applicant approval and an eligible
    qualifying event are required before any points can be earned.</Text>
   {button("Share referral code",()=>void share())}
  </View>}
 </View>;
}
const s=StyleSheet.create({
 card:{backgroundColor:t.surface,borderWidth:1,borderColor:t.border,borderRadius:13,padding:14,gap:11},
 title:{fontSize:17,fontWeight:"700",color:t.text},
 note:{fontSize:13,color:t.mutedText},
 error:{fontSize:13,color:"#a23b30"},
 actions:{flexDirection:"row",flexWrap:"wrap",gap:8},
 button:{minHeight:44,padding:11,borderWidth:1,borderColor:t.border,
  borderRadius:9,backgroundColor:t.surface,justifyContent:"center",alignSelf:"flex-start"},
 buttonText:{fontWeight:"600",color:t.text},
 selected:{backgroundColor:t.primary,borderColor:t.primary},
 selectedText:{color:t.primaryText},
 result:{borderTopWidth:1,borderColor:t.border,paddingTop:12,gap:9},
 code:{fontSize:16,fontWeight:"700",color:t.text}
});
