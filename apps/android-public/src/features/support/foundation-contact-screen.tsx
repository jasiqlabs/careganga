import {useEffect,useState} from "react";
import {ActivityIndicator,Platform,Pressable,ScrollView,StyleSheet,
  Text,TextInput,View} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import * as Crypto from "expo-crypto";
import {careGangaPublicTheme as theme} from "../../../../../packages/design-tokens/src/index";
type Faq={faqRef:string;question:string;answer:string};
type Receipt={receipt:string;ticketNumber:string;expiresAt:string;status:string;result:string};
const web=process.env.EXPO_PUBLIC_CONTACT_WEB_ORIGIN;
async function contactApi<T>(path:string,method:"GET"|"POST"="GET",body?:object):Promise<T>{
  // Native guest requests enter the signed, trusted Next Web ingress.
  // Never bundle CG19_GUEST_PROXY_KEY or any server-only token in the app.
  if(!web||!/^https?:\/\//.test(web)||
    (process.env.NODE_ENV==="production"&&!web.startsWith("https://")))
    throw Error("UNAVAILABLE");
  let resolvedWeb = web;
  if (Platform.OS === "android" && (resolvedWeb.startsWith("http://localhost:") || resolvedWeb.startsWith("http://127.0.0.1:"))) {
    resolvedWeb = resolvedWeb.replace(/localhost|127\.0\.0\.1/, "10.0.2.2");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  let response:Response;
  try{
    response=await fetch(new URL("/api/support/"+path,resolvedWeb).toString(),{
      method,cache:"no-store",
      headers:body?{"Content-Type":"application/json"}:undefined,
      ...(body?{body:JSON.stringify(body)}:{}),
      signal:controller.signal
    });
  }catch{throw Error("UNKNOWN")}
  finally{clearTimeout(timer);}
  if(!response.ok)throw Error(response.status===429?"LIMIT":
    response.status===400?"INVALID":
    response.status===409?"CONFLICT":"UNKNOWN");
  try{return await response.json() as T;}catch{throw Error("UNKNOWN")}
}
const explain=(e:unknown)=>{
  const reason=e instanceof Error?e.message:"UNKNOWN";
  return reason==="LIMIT"?"Too many requests. Try again later.":
    reason==="INVALID"?"Check every field, contact and message length.":
    reason==="CONFLICT"?"The original request key was already used for different content.":
    reason==="UNAVAILABLE"?"Foundation contact is not configured on this app.":
    "Outcome not confirmed. Retry the unchanged request to recover its original receipt.";
};
export function FoundationContactScreen({onExit}:{onExit:()=>void}){
  const [name,setName]=useState(""),[contact,setContact]=useState("");
  const [subject,setSubject]=useState(""),[message,setMessage]=useState("");
  const [requestKey,setRequestKey]=useState("");
  const [receipt,setReceipt]=useState<Receipt|null>(null);
  const [proof,setProof]=useState(""),[proofStatus,setProofStatus]=useState("");
  const [faq,setFaq]=useState<Faq[]>([]);
  const [busy,setBusy]=useState(false),[loadingFaq,setLoadingFaq]=useState(true);
  const [feedback,setFeedback]=useState("");
  const [feedbackArea,setFeedbackArea]=useState<"message"|"receipt">("message");
  useEffect(()=>{
    let live=true;
    void contactApi<{faqs:Faq[]}>("public/faqs").then(x=>{
      if(live&&Array.isArray(x.faqs))setFaq(x.faqs.slice(0,30));
    }).catch(()=>{}).finally(()=>{if(live)setLoadingFaq(false)});
    return()=>{live=false};
  },[]);
  async function send(){
    if(busy||receipt)return;
    setFeedbackArea("message");
    if(name.trim().length<2||contact.trim().length<5||subject.trim().length<5||
      message.trim().length<10){
      setFeedback("Enter your name, contact, subject and a message of at least ten characters.");
      return;
    }
    setBusy(true);setFeedback("");
    const key=requestKey||Crypto.randomUUID();setRequestKey(key);
    try{
      const result=await contactApi<Receipt>("public/contact","POST",{
        requestKey:key,name,contact,subject,message
      });
      if(!result.receipt||!result.expiresAt)throw Error("UNKNOWN");
      setReceipt(result);setProof(result.receipt);setRequestKey("");setMessage("");
      setFeedback("The request is saved in Foundation support. No email or SMS delivery is claimed.");
    }catch(e){setFeedback(explain(e))}
    finally{setBusy(false)}
  }
  async function check(){
    if(busy||!proof.trim())return;
    setFeedbackArea("receipt");setBusy(true);setFeedback("");setProofStatus("");
    try{
      const result=await contactApi<{status:string;ticketNumber:string}>(
        "receipt/status","POST",{receipt:proof.trim()});
      setProofStatus(`${result.ticketNumber} · ${result.status.replaceAll("_"," ")}`);
    }catch(e){setFeedback(explain(e))}
    finally{setBusy(false)}
  }
  return <SafeAreaView style={s.page}><ScrollView keyboardShouldPersistTaps="handled"
    contentContainerStyle={s.content}>
    <View style={s.row}><Pressable accessibilityRole="button" style={s.button}
      onPress={onExit}><Text>Back</Text></Pressable>
      <Text accessibilityRole="header" style={s.heading}>Contact the Foundation</Text></View>
    <Text style={s.muted}>You do not need a staff account. Your request is private
      and is sent to the same CareGanga Foundation support source as the website.</Text>
    <View style={s.card}>
      {receipt?<View style={s.card}>
        <Text style={s.heading}>Your request was recorded</Text>
        <Text selectable>Ticket number: {receipt.ticketNumber}</Text>
        <Text>Keep this private receipt in a safe place. Leaving the page may
          remove the displayed code from this device.</Text>
        <Text selectable style={s.code}>{receipt.receipt}</Text>
        <Text style={s.muted}>Valid until: {new Date(receipt.expiresAt).toLocaleString()}</Text>
        <Text>Only the public status can be checked with this receipt.
          Private replies and contact details are never exposed through it.</Text>
      </View>:<>
        <Text style={s.heading}>Send a private contact request</Text>
        <Text>Name</Text>
        <TextInput style={s.input} accessibilityLabel="Your name" value={name} editable={!busy}
          onChangeText={setName} maxLength={90} autoComplete="name"/>
        <Text>Email or phone number</Text>
        <TextInput style={s.input} accessibilityLabel="Email or phone" value={contact} editable={!busy}
          onChangeText={setContact} maxLength={120} autoCapitalize="none"/>
        <Text>Subject</Text>
        <TextInput style={s.input} accessibilityLabel="Subject" value={subject} editable={!busy}
          onChangeText={setSubject} maxLength={140}/>
        <Text>How can we help?</Text>
        <TextInput style={[s.input,s.long]} accessibilityLabel="Contact message"
          multiline editable={!busy} value={message} onChangeText={setMessage} maxLength={2000}/>
        <Pressable style={s.primary} accessibilityRole="button" disabled={busy}
          onPress={()=>void send()}><Text style={s.primaryText}>
            {busy?"Checking original request…":"Send private request"}</Text>
        </Pressable>
      </>}
      {feedback&&feedbackArea==="message"?<Text accessibilityRole={receipt?"text":"alert"} style={receipt?s.muted:s.warning}>{feedback}</Text>:null}
    </View>
    <View style={s.card}>
      <Text style={s.heading}>Check a private receipt</Text>
      <TextInput value={proof} editable={!busy} onChangeText={v=>{setProof(v);setProofStatus("");if(feedbackArea==="receipt")setFeedback("");}} style={s.input}
        accessibilityLabel="Private receipt code" maxLength={43}
        autoCapitalize="none" autoCorrect={false}/>
      <Pressable style={s.button} accessibilityRole="button"
        disabled={busy||!proof.trim()} onPress={()=>void check()}>
        <Text>Check request status</Text></Pressable>
      {proofStatus?<Text>Current status: {proofStatus}</Text>:null}
      {feedback&&feedbackArea==="receipt"?<Text accessibilityRole="alert" style={s.warning}>{feedback}</Text>:null}
    </View>
    <View style={s.card}>
      <Text style={s.heading}>Foundation help questions</Text>
      {loadingFaq&&<ActivityIndicator accessibilityLabel="Loading published help"/>}
      {faq.length===0&&!loadingFaq&&<Text>No published help questions are available.</Text>}
      {faq.map(x=><View key={x.faqRef} style={s.item}>
        <Text style={s.heading}>{x.question}</Text><Text>{x.answer}</Text>
      </View>)}
    </View>
  </ScrollView></SafeAreaView>;
}
const s=StyleSheet.create({
  page:{flex:1,backgroundColor:theme.background},
  content:{padding:18,paddingBottom:48,maxWidth:750,width:"100%",alignSelf:"center",gap:14},
  row:{flexDirection:"row",alignItems:"center",gap:10},
  heading:{fontSize:18,fontWeight:"700",color:theme.text,flex:1},
  muted:{fontSize:13,color:theme.mutedText},
  card:{padding:15,backgroundColor:theme.surface,borderColor:theme.border,
    borderWidth:1,borderRadius:12,gap:11},
  item:{padding:10,borderColor:theme.border,borderWidth:1,borderRadius:8,gap:7},
  input:{minHeight:48,borderWidth:1,borderColor:theme.border,borderRadius:8,
    padding:10,color:theme.text,backgroundColor:theme.surface},
  long:{minHeight:110,textAlignVertical:"top"},
  code:{fontSize:12,color:theme.text},
  warning:{padding:11,color:theme.error,backgroundColor:theme.surface},
  button:{minHeight:48,padding:10,borderWidth:1,borderColor:theme.border,
    borderRadius:8,justifyContent:"center"},
  primary:{padding:13,minHeight:48,backgroundColor:theme.primary,
    borderRadius:8,justifyContent:"center"},
  primaryText:{fontWeight:"700",color:theme.primaryText}
});
