import {useState} from "react";
import {Platform,Pressable,StyleSheet,Text,TextInput,View} from "react-native";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
type Action="SUBSCRIBE"|"WITHDRAW";
type Step="REQUEST"|"CODE"|"KEY";
export function NativeNewsletterForm(){
 const [email,setEmail]=useState(""),[action,setAction]=useState<Action>("SUBSCRIBE");
 const [step,setStep]=useState<Step>("REQUEST"),[consent,setConsent]=useState(false),[code,setCode]=useState("");
 const [busy,setBusy]=useState(false),[feedback,setFeedback]=useState("");
 const reset=(a:Action,s:Step="REQUEST")=>{setAction(a);setStep(s);setConsent(false);setCode("");setFeedback("");};
 async function submit(){
  if(busy)return;
  const address=email.trim();
  if(address.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)){setFeedback("Enter a valid email address.");return;}
  if(step==="REQUEST"&&action==="SUBSCRIBE"&&!consent){setFeedback("Confirm your newsletter consent.");return;}
  if(step==="CODE"&&!/^\d{8}$/.test(code)||step==="KEY"&&!/^[A-Za-z0-9_-]{43}$/.test(code)){setFeedback("Enter the complete private code.");return;}
  let base=process.env.EXPO_PUBLIC_CONTACT_WEB_ORIGIN;
  if(!base||!/^https?:\/\//.test(base)||process.env.NODE_ENV==="production"&&!base.startsWith("https://")){
   setFeedback("Newsletter access is not configured on this app.");return;}
  if(Platform.OS==="android"&&/^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(base))base=base.replace(/localhost|127\.0\.0\.1/,"10.0.2.2");
  const path=step==="REQUEST"?"start":step==="KEY"?"withdraw":"confirm";
  const body=step==="REQUEST"?{email:address,action,...(action==="SUBSCRIBE"?{consent:true}:{})}:
   step==="KEY"?{email:address,key:code}:{email:address,action,code};
  setBusy(true);setFeedback("");
  try{
   const r=await fetch(new URL("/api/support/public/newsletter/"+path,base).toString(),{method:"POST",cache:"no-store",
    headers:{"Content-Type":"application/json"},body:JSON.stringify(body),signal:AbortSignal.timeout(23000)});
   if(!r.ok){setFeedback(r.status===429?"Too many requests. Try again later.":
    r.status===400?"Check the email or private code. Request a new code if expired.":"Verification unavailable or unconfirmed. Enter the code if it arrives.");
    if(step==="REQUEST"&&r.status>=500)setStep("CODE");return;}
   const value:unknown=await r.json(),state=value&&typeof value==="object"&&"state" in value?value.state:null;
   if(step==="REQUEST"&&["CHECK_EMAIL","CHECK_EXISTING_CODE","SEND_UNCONFIRMED"].includes(String(state))){
    setStep("CODE");setFeedback(state==="CHECK_EMAIL"?"Verification email accepted for sending. Check your inbox and spam folder.":
     state==="CHECK_EXISTING_CODE"?"Use the recently requested code.":"Email delivery unconfirmed. Enter the code if it arrives.");
   }else if(step!=="REQUEST"&&state===(action==="SUBSCRIBE"?"SUBSCRIBED":"WITHDRAWN")){
    setEmail("");setCode("");setConsent(false);setStep("REQUEST");
    setFeedback(state==="SUBSCRIBED"?"Subscription confirmed. Keep the private withdrawal key from your email.":"Newsletter consent withdrawn.");
   }else setFeedback("Outcome unconfirmed. Use the original private code.");
  }catch{if(step==="REQUEST")setStep("CODE");setFeedback("Outcome unconfirmed. Enter the code if it arrives.");}
  finally{setBusy(false);}
 }
 const button=(label:string,fn:()=>void,disabled=busy)=><Pressable accessibilityRole="button" accessibilityState={{disabled}}
  disabled={disabled} onPress={fn} style={[s.button,disabled&&{opacity:.5}]}><Text style={s.buttonText}>{label}</Text></Pressable>;
 return <View style={s.root}>
  <Text accessibilityRole="header" style={s.heading}>Newsletter</Text>
  <View style={s.row}>{button("Subscribe",()=>reset("SUBSCRIBE"))}{button("Unsubscribe",()=>reset("WITHDRAW"))}</View>
  <Text style={s.copy}>Email address</Text>
  <TextInput accessibilityLabel="Newsletter email" style={s.input} value={email} editable={!busy&&step!=="CODE"} maxLength={254}
   keyboardType="email-address" autoCapitalize="none" autoCorrect={false} onChangeText={setEmail}/>
  {step==="REQUEST"&&action==="SUBSCRIBE"&&<Pressable accessibilityRole="checkbox" accessibilityState={{checked:consent,disabled:busy}}
   disabled={busy} onPress={()=>setConsent(x=>!x)} style={s.row}><Text style={s.copy}>{consent?"☑":"☐"}</Text>
   <Text style={[s.copy,{flex:1}]}>I agree to receive CareGanga Foundation newsletters by email. I can unsubscribe at any time.</Text></Pressable>}
  {step!=="REQUEST"&&<><Text style={s.copy}>{step==="KEY"?"Private withdrawal key":"Email verification code"}</Text>
   <TextInput accessibilityLabel={step==="KEY"?"Private withdrawal key":"Email verification code"} style={s.input}
    value={code} editable={!busy} autoCapitalize="none" autoCorrect={false} maxLength={step==="KEY"?43:8}
    secureTextEntry={step==="KEY"} keyboardType={step==="CODE"?"number-pad":"default"} onChangeText={x=>setCode(x.trim())}/></>}
  {button(busy?"Processing…":step==="REQUEST"?"Send verification code":step==="KEY"?"Withdraw consent":"Confirm "+(action==="SUBSCRIBE"?"subscription":"withdrawal"),()=>void submit(),busy||step==="REQUEST"&&action==="SUBSCRIBE"&&!consent)}
  {action==="WITHDRAW"&&step!=="KEY"&&button("Use private withdrawal key",()=>reset("WITHDRAW","KEY"))}
  {step!=="REQUEST"&&button("Change email or request a new code",()=>reset(action))}
  {!!feedback&&<Text accessibilityLiveRegion="polite" style={s.copy}>{feedback}</Text>}
 </View>;
}
const s=StyleSheet.create({root:{gap:8,paddingVertical:12},heading:{fontWeight:"800",fontSize:16,color:t.text},
 row:{flexDirection:"row",flexWrap:"wrap",gap:8,alignItems:"center"},copy:{fontSize:13,lineHeight:19,color:t.text},
 input:{borderColor:t.border,borderWidth:1,borderRadius:8,padding:10,color:t.text,backgroundColor:t.surface},
 button:{borderColor:t.border,borderWidth:1,borderRadius:8,padding:10},buttonText:{color:t.text,fontWeight:"600"}});
