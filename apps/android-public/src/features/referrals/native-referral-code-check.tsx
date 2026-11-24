import {useEffect,useRef,useState} from "react";
import {Pressable,StyleSheet,Text,View} from "react-native";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {memberInvoke} from "../membership/member-native-api";
type Result={eligible:boolean;programmeName:string|null;notice:string};
/** Anonymous safe programme-only lookup. Does NOT create attribution or points. */
export function NativeReferralCodeCheck({code}:{code:string}){
 const [pending,setPending]=useState(false),[outcome,setOutcome]=useState<Result|null>(null);
 const [error,setError]=useState(""),epoch=useRef(0);
 useEffect(()=>{epoch.current++;setPending(false);setError("");setOutcome(null);},[code]);
 useEffect(()=>()=>{epoch.current++;},[]);
 const check=async()=>{
  if(pending)return;
  const id=++epoch.current;setPending(true);setError("");setOutcome(null);
  try{
   if(!/^[A-Za-z0-9_-]{32}$/.test(code))
    throw Error("Enter a complete referral code or leave it blank.");
   const data=await memberInvoke<Result>("/api/v1/referrals/resolve","POST",{code});
   if(id!==epoch.current)return;
   if(typeof data.eligible!=="boolean"||
    (data.programmeName!==null&&typeof data.programmeName!=="string"))
    throw Error("Unable to verify this referral code.");
   setOutcome(data);
  }catch(e){if(id===epoch.current)setError(e instanceof Error?e.message:"Referral code unavailable.");}
  finally{if(id===epoch.current)setPending(false);}
 };
 return <View style={s.box}>
  {!!code&&<Pressable accessibilityRole="button" disabled={pending} style={s.button}
   onPress={()=>void check()}>
   <Text style={s.buttonText}>{pending?"Checking code…":"Check referral code"}</Text>
  </Pressable>}
  {!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
  {outcome&&<Text accessibilityRole="text" style={s.note}>{outcome.eligible?
   "Eligible programme: "+outcome.programmeName+
    ". Points require actual independent activation.":"This code is not currently eligible. You may continue without it."}</Text>}
 </View>;
}
const s=StyleSheet.create({
 box:{gap:8},
 button:{minHeight:44,borderWidth:1,borderColor:t.border,borderRadius:9,
  backgroundColor:t.surface,padding:10,alignSelf:"flex-start",justifyContent:"center"},
 buttonText:{color:t.text,fontWeight:"600"},
 error:{color:"#a23b30",fontSize:13},
 note:{color:t.mutedText,fontSize:13}
});
