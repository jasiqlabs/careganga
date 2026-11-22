import {useEffect,useRef,useState} from "react";
import {Linking,Pressable,Text,TextInput,View} from "react-native";
import * as Crypto from "expo-crypto";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
const base=process.env.EXPO_PUBLIC_API_URL;
async function request<T>(path:string,value:object):Promise<T>{
 if(!base||!/^https?:\/\//.test(base)||(process.env.NODE_ENV==="production"&&!base.startsWith("https://")))
  throw Error("Donation service unavailable.");
 const response=await fetch(new URL("/api/public/donations"+path,base),{
  method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(value),
  cache:"no-store",signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error(response.status===409?"Donation changed. Check the original status.":"Donation request outcome is uncertain.");
 return await response.json() as T;
}
/** True Public Android self-service, never a synthetic receipt or paid claim. */
export function NativePublicDonation({campaignSlug=null}:{campaignSlug?:string|null}){
 const [enabled,setEnabled]=useState(false),[amount,setAmount]=useState(""),
  [name,setName]=useState(""),[consent,setConsent]=useState(false);
 const [token,setToken]=useState(""),[status,setStatus]=useState(""),
  [paymentUrl,setPaymentUrl]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 const key=useRef<string|null>(null),paymentKey=useRef<string|null>(null);
 useEffect(()=>{let active=true;(async()=>{try{
  if(!base||!/^https?:\/\//.test(base)||(process.env.NODE_ENV==="production"&&!base.startsWith("https://")))return;
  const r=await fetch(new URL("/api/public/content/donations/readiness",base),{
   cache:"no-store",signal:AbortSignal.timeout(7000)});
  const v:unknown=await r.json();if(active)setEnabled(r.ok&&!!v&&typeof v==="object"&&
   "onlineAvailable" in v&&v.onlineAvailable===true);
 }catch{if(active)setEnabled(false);}})();return()=>{active=false};},[]);
 const call=async(fn:()=>Promise<void>)=>{if(busy)return;setBusy(true);setError("");
  try{await fn();}catch(e){setError(e instanceof Error?e.message:"Donation outcome uncertain.");}
  finally{setBusy(false);}};
 const create=()=>call(async()=>{
  if(!key.current)key.current=Crypto.randomUUID();
  const v=await request<{status:string;statusToken:string}>("",{
   requestKey:key.current,campaignSlug,amount,consent:true,
   donor:{name,mobile:"",email:"",pan:"",address:""}});
  setToken(v.statusToken);setStatus(v.status);
 });
 const pay=()=>call(async()=>{
  if(!paymentKey.current)paymentKey.current=Crypto.randomUUID();
  const v=await request<{status:string;checkoutUrl:string|null;message?:string}>("/payment-link",{
   statusToken:token,requestKey:paymentKey.current});
  if(v.status!=="LINK_READY"||!v.checkoutUrl)throw Error(v.message??"Payment link not confirmed. Do not create another request.");
  const u=new URL(v.checkoutUrl);
  if(u.protocol!=="https:"||u.hostname!=="rzp.io")throw Error("Unsafe payment URL.");
  setPaymentUrl(u.toString());await Linking.openURL(u.toString());
 });
 const refresh=()=>call(async()=>{
  const v=await request<{status:string}>("/status",{statusToken:token});setStatus(v.status);
 });
 const button=(title:string,fn:()=>void)=><Pressable accessibilityRole="button"
  disabled={busy} onPress={fn} style={{padding:13,backgroundColor:"#f4aa40",borderRadius:8,minHeight:46}}>
  <Text style={{fontWeight:"700",textAlign:"center"}}>{title}</Text></Pressable>;
 if(!enabled)return null;
 return <View style={{backgroundColor:t.surface,padding:15,gap:11,borderWidth:1,borderColor:t.border,borderRadius:12}}>
  <Text accessibilityRole="header" style={{fontSize:18,fontWeight:"700",color:t.text}}>
   {campaignSlug?"Support this campaign":"Make a general donation"}</Text>
  <Text>Payment links are not confirmed funds or tax receipts.</Text>
  {!token?<><Text>Donation amount in rupees</Text>
   <TextInput accessibilityLabel="Donation amount" keyboardType="decimal-pad"
    style={{minHeight:46,borderWidth:1,borderColor:t.border,padding:11}}
    editable={!key.current} value={amount} onChangeText={setAmount}/>
   <Text>Name (optional)</Text><TextInput accessibilityLabel="Donor name"
    style={{minHeight:46,borderWidth:1,borderColor:t.border,padding:11}}
    editable={!key.current} value={name} onChangeText={setName}/>
   <Pressable accessibilityRole="checkbox" accessibilityState={{checked:consent}}
    onPress={()=>{if(!key.current)setConsent(x=>!x);}}>
    <Text>{consent?"☑":"☐"} I consent to the Foundation processing the supplied donation information.</Text></Pressable>
   {consent&&!!amount&&button("Create donation request",create)}</>:
  <><Text accessibilityRole="header">Status: {status.replaceAll("_"," ")}</Text>
   <Text selectable>Private status proof (keep safe): {token}</Text>
   {status!=="RECEIVED_POSTED"&&(paymentUrl?button("Open existing secure payment",()=>void Linking.openURL(paymentUrl)):
    button("Request secure payment link",pay))}
   {button("Check donation status",refresh)}</>}
  {!!error&&<Text accessibilityRole="alert" style={{color:"#a12c3b"}}>{error}</Text>}
 </View>;
}
