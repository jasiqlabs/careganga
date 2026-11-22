import {useEffect,useRef,useState} from "react";
import {AppState,Linking,Pressable,Text,TextInput,View} from "react-native";
import * as Crypto from "expo-crypto";
import {File,Paths} from "expo-file-system";
import * as Sharing from "expo-sharing";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
type HistoryRow={donationNumber:string;proofIndex:number;status:string;netReceivedMinor:string;
 receiptStatus:string;receiptNumber:string|null};
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
  [name,setName]=useState(""),[mobile,setMobile]=useState(""),[email,setEmail]=useState(""),
  [pan,setPan]=useState(""),[address,setAddress]=useState(""),
  [geography,setGeography]=useState(""),[remarks,setRemarks]=useState(""),
  [paymentReferenceNote,setPaymentReferenceNote]=useState(""),
  [recurringIntent,setRecurringIntent]=useState(false),[consent,setConsent]=useState(false);
 const [token,setToken]=useState(""),[status,setStatus]=useState(""),
  [paymentUrl,setPaymentUrl]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 const [received,setReceived]=useState(false),[receiptStatus,setReceiptStatus]=useState("NOT_ISSUED"),
  [refundedMinor,setRefundedMinor]=useState("0"),[refundPending,setRefundPending]=useState(false);
 const [extraProofs,setExtraProofs]=useState(""),[history,setHistory]=useState<HistoryRow[]>([]),
  [historyTokens,setHistoryTokens]=useState<string[]>([]);
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
   donor:{name,mobile,email,pan,address,geography,remarks,recurringIntent,paymentReferenceNote}});
  setToken(v.statusToken);setStatus(v.status);setReceived(v.status==="RECEIVED_POSTED");
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
  const v=await request<{status:string;received:boolean;receiptStatus:string;refundedMinor:string;refundPending:boolean}>(
   "/status",{statusToken:token});
  setStatus(v.status);setReceived(v.received);setReceiptStatus(v.receiptStatus);
  setRefundedMinor(v.refundedMinor);setRefundPending(v.refundPending);
 });
 const loadHistory=()=>call(async()=>{
  if(!token)return;
  const proofs=[token,...extraProofs.split(/\s+/)].filter(Boolean);
  if(proofs.length>20||new Set(proofs).size!==proofs.length)
   throw Error("Provide up to 20 distinct private donation proofs.");
  const result=await request<{items:HistoryRow[]}>("/history",{statusTokens:proofs});
  setHistoryTokens(proofs);setHistory(result.items);
 });
 useEffect(()=>{
  const sub=AppState.addEventListener("change",state=>{
   if(state==="active"&&token&&!busy)void refresh();
  });
  return()=>sub.remove();
 },[token,busy]);
 const download=(proofToken=token)=>call(async()=>{
  if(!proofToken||!base)throw Error("Private receipt proof unavailable.");
  const r=await fetch(new URL("/api/public/donations/receipt/download",base),{
   method:"POST",headers:{"Content-Type":"application/json"},
   body:JSON.stringify({statusToken:proofToken}),cache:"no-store",signal:AbortSignal.timeout(20000)});
  if(!r.ok||r.headers.get("content-type")?.split(";")[0]!=="application/pdf")
   throw Error("Original private receipt is unavailable.");
  const bytes=new Uint8Array(await r.arrayBuffer());
  if(bytes.length<100||bytes.length>10485760)throw Error("Private PDF could not be verified.");
  const file=new File(Paths.cache,"CareGanga-Donation-Receipt-"+Crypto.randomUUID()+".pdf");
  try{
   await file.write(bytes);
   if(!(await Sharing.isAvailableAsync()))throw Error("Sharing a private PDF is not supported on this device.");
   await Sharing.shareAsync(file.uri,{mimeType:"application/pdf",
    dialogTitle:"Your original CareGanga donation receipt"});
  }finally{try{file.delete();}catch{}}
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
   <Text>Mobile (optional)</Text><TextInput accessibilityLabel="Donor mobile"
    keyboardType="phone-pad" maxLength={20}
    style={{minHeight:46,borderWidth:1,borderColor:t.border,padding:11}}
    editable={!key.current} value={mobile} onChangeText={setMobile}/>
   <Text>Email (optional)</Text><TextInput accessibilityLabel="Donor email"
    keyboardType="email-address" autoCapitalize="none" maxLength={254}
    style={{minHeight:46,borderWidth:1,borderColor:t.border,padding:11}}
    editable={!key.current} value={email} onChangeText={setEmail}/>
   <Text>Address (optional)</Text><TextInput accessibilityLabel="Donor address"
    maxLength={300} multiline
    style={{minHeight:65,borderWidth:1,borderColor:t.border,padding:11}}
    editable={!key.current} value={address} onChangeText={setAddress}/>
   <Text>PAN (optional, private record only)</Text>
   <TextInput accessibilityLabel="Donor PAN" maxLength={10}
    autoCapitalize="characters" style={{minHeight:46,borderWidth:1,borderColor:t.border,padding:11}}
    editable={!key.current} value={pan} onChangeText={v=>setPan(v.toUpperCase())}/>
   <Text>City / area (optional)</Text>
   <TextInput accessibilityLabel="Donor city or area" maxLength={100}
    style={{minHeight:46,borderWidth:1,borderColor:t.border,padding:11}}
    editable={!key.current} value={geography} onChangeText={setGeography}/>
   <Text>Remarks (optional)</Text>
   <TextInput accessibilityLabel="Donation remarks" maxLength={300} multiline
    style={{minHeight:64,borderWidth:1,borderColor:t.border,padding:11}}
    editable={!key.current} value={remarks} onChangeText={setRemarks}/>
   <Text>Payment reference note (unverified, optional)</Text>
   <TextInput accessibilityLabel="Unverified payment reference note" maxLength={100}
    style={{minHeight:46,borderWidth:1,borderColor:t.border,padding:11}}
    editable={!key.current} value={paymentReferenceNote} onChangeText={setPaymentReferenceNote}/>
   <Pressable accessibilityRole="checkbox" accessibilityState={{checked:recurringIntent}}
    onPress={()=>{if(!key.current)setRecurringIntent(x=>!x);}}>
    <Text>{recurringIntent?"☑":"☐"} I may donate again (no automatic recurring charge).</Text>
   </Pressable>
   <Text>Payment reference notes do not prove bank settlement. PAN does not guarantee 80G eligibility.</Text>
   <Pressable accessibilityRole="checkbox" accessibilityState={{checked:consent}}
    onPress={()=>{if(!key.current)setConsent(x=>!x);}}>
    <Text>{consent?"☑":"☐"} I consent to the Foundation processing the supplied donation information.</Text></Pressable>
   {consent&&!!amount&&button("Create donation request",create)}</>:
  <><Text accessibilityRole="header">Status: {status.replaceAll("_"," ")}</Text>
   <Text selectable>Private status proof (keep safe): {token}</Text>
   {!received&&(paymentUrl?button("Open existing secure payment",()=>void Linking.openURL(paymentUrl)):
    button("Request secure payment link",pay))}
   {refundedMinor!=="0"&&<Text>Confirmed refund has reduced verified net donations.</Text>}
   {refundPending&&<Text accessibilityRole="alert">Refund requested; actual payout has not been verified.</Text>}
   {receiptStatus==="ISSUED"&&button("Open/share your verified private PDF receipt",download)}
   <Text accessibilityRole="header">My proven donation history</Text>
   <Text>Enter any other original private status proofs, one per line. Only transactions you can prove are shown.</Text>
   <TextInput accessibilityLabel="Additional private donor proofs" multiline maxLength={1600}
    style={{minHeight:70,borderWidth:1,borderColor:t.border,padding:10}}
    value={extraProofs} onChangeText={setExtraProofs}/>
   {button("View proven donation history",loadHistory)}
   {history.map(item=><View key={item.donationNumber} style={{gap:5,padding:10,
     borderWidth:1,borderColor:t.border,borderRadius:8}}>
     <Text>{item.donationNumber} · {item.status.replaceAll("_"," ")}</Text>
     <Text>Confirmed net: ₹{(BigInt(item.netReceivedMinor)/100n).toString()}</Text>
     <Text>Receipt: {item.receiptNumber??item.receiptStatus.replaceAll("_"," ")}</Text>
     {item.receiptStatus==="ISSUED"&&!!historyTokens[item.proofIndex]&&
      button("Open this proven private receipt",()=>void download(historyTokens[item.proofIndex]))}
    </View>)}
   {button("Check donation status",refresh)}</>}
  {!!error&&<Text accessibilityRole="alert" style={{color:"#a12c3b"}}>{error}</Text>}
 </View>;
}
