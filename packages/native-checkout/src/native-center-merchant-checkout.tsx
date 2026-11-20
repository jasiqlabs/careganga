import {useCallback,useEffect,useRef,useState} from "react";
import {ActivityIndicator,Modal,Pressable,ScrollView,StyleSheet,
 Text,View} from "react-native";
import {WebView} from "react-native-webview";
import * as Crypto from "expo-crypto";
import {careGangaTheme as t} from "../../design-tokens/src/index";
export type MerchantOrder={
 onlineAvailable?:boolean;reason?:string;status?:string;state?:string;
 checkoutAvailable?:boolean;publicKeyId?:string|null;orderRef?:string|null;
 amountMinor?:string;patientPayableMinor?:string;paidMinor?:string;
 refundedOrPartial?:boolean;message?:string;provider?:string
};
type Props={status:()=>Promise<MerchantOrder>;
 begin:(key:string)=>Promise<MerchantOrder>;onExpired?:()=>void;
 canInitiate?:boolean;subject:string};
const key=/^rzp_(?:live|test)_[A-Za-z0-9]+$/;
const order=/^order_[A-Za-z0-9]{8,60}$/;
const minor=/^[1-9][0-9]{0,10}$/;
const money=(x:string)=>"₹"+(Number(x)/100).toFixed(2);
function htmlFor(x:MerchantOrder){
 if(!x.checkoutAvailable||!key.test(x.publicKeyId??"")||
  !order.test(x.orderRef??"")||!minor.test(x.amountMinor??"")||
  !Number.isSafeInteger(Number(x.amountMinor)))
  throw Error("Original checkout order cannot be verified.");
 const config=JSON.stringify({
  key:x.publicKeyId,order_id:x.orderRef,amount:Number(x.amountMinor),
  currency:"INR",name:"Verified Healthcare Center",
  description:"Original CareGanga consultation patient due"
 });
 return `<!DOCTYPE html><html><head><meta name="viewport"
 content="width=device-width,initial-scale=1,maximum-scale=1">
 <title>Verified center checkout</title>
 <style>body{font-family:system-ui,sans-serif;padding:1rem;
 background:#f6fafb;color:#193843;text-align:center}p{line-height:1.6}</style>
 <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
 </head><body><p>Opening this center's verified payment provider…</p>
 <p>A payment remains pending until CareGanga verifies the provider
 capture on its server.</p><button id="open">Open secure checkout</button>
 <script>
 (function(){
  var config=${config};
  config.handler=function(){window.ReactNativeWebView.postMessage("CHECK");};
  config.modal={ondismiss:function(){window.ReactNativeWebView.postMessage("CLOSE");}};
  var opened=false;
  function open(){
   if(typeof Razorpay!=="function"){document.body.lastChild.innerText=
    "Checkout unavailable. Close and retry.";return;}
   try{var widget=new Razorpay(config);widget.open();opened=true;}
   catch(e){window.ReactNativeWebView.postMessage("ERROR");}
  }
  document.getElementById("open").addEventListener("click",open);
  setTimeout(function(){if(!opened)open();},150);
 })();
 </script></body></html>`;
}
/** Shared Public/Internal Android presentation. Neither HTML, native bridge,
 * checkout handler nor an untrusted redirect can ever mark patient PAID.
 */
export function NativeCenterMerchantCheckout({status,begin,onExpired,
 canInitiate=true,subject}:Props){
 const [state,setState]=useState<MerchantOrder|null>(null);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [uncertain,setUncertain]=useState(false),[html,setHtml]=useState("");
 const attempt=useRef<string|null>(null),seq=useRef(0);
 const refresh=useCallback(async()=>{
  const v=await status();
  if(!v||typeof v!=="object"||
    (v.checkoutAvailable&&
     (!order.test(v.orderRef??"")||!key.test(v.publicKeyId??"")||
      !minor.test(v.amountMinor??""))))
   throw Error("Original verified payment status unavailable.");
  setState(v);return v;
 },[status]);
 const err=useCallback((e:unknown)=>{
  if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired?.();
  setError(e instanceof Error?e.message:
   "Original provider payment status unavailable.");
 },[onExpired]);
 useEffect(()=>{
  let live=true;const n=++seq.current;setLoading(true);
  setState(null);setError("");setNotice("");attempt.current=null;
  setUncertain(false);setHtml("");
  void refresh().catch(e=>{if(live&&n===seq.current)err(e)})
   .finally(()=>{if(live&&n===seq.current)setLoading(false)});
  return()=>{live=false;++seq.current};
 },[refresh,err]);
 async function open(v:MerchantOrder){
  try{setHtml(htmlFor(v));}
  catch(e){err(e)}
 }
 async function start(){
  if(busy||uncertain||!canInitiate)return;
  setBusy(true);setError("");setNotice("");
  try{
   if(state?.checkoutAvailable){await open(state);return;}
   if(!state?.onlineAvailable)
    throw Error("This center has no independently verified online merchant. "+
     "Pay-at-center remains available.");
   if(!attempt.current)attempt.current=Crypto.randomUUID();
   const updated=await begin(attempt.current);
   setState(updated);
   if(updated.checkoutAvailable){attempt.current=null;await open(updated);}
   else{
    setUncertain(["UNKNOWN","INITIALIZING"].includes(updated.state??""));
    setNotice(updated.message??"Your center payment order is pending verification.");
   }
  }catch(e){
   const code=e&&typeof e==="object"&&"status" in e&&
    typeof e.status==="number"?e.status:503;
   setUncertain(code>=500);err(e);
  }finally{setBusy(false);}
 }
 const button=(label:string,onPress:()=>void,disabled=false)=>
  <Pressable accessibilityRole="button" accessibilityState={{disabled}}
   disabled={disabled} onPress={onPress}
   style={[s.button,disabled&&s.disabled]}>
   <Text style={s.buttonText}>{label}</Text>
  </Pressable>;
 return <View style={s.card} accessibilityLabel="Verified center online payment">
  <Text accessibilityRole="header" style={s.title}>Pay your healthcare center</Text>
  <Text style={s.body}>Only {subject}'s verified center merchant may
   receive online funds. The Foundation account is not used.</Text>
  {loading&&<ActivityIndicator accessibilityLabel="Checking center merchant"/>}
  {!!error&&<Text accessibilityRole="alert" style={s.alert}>{error}</Text>}
  {!!notice&&<Text accessibilityRole="alert" style={s.body}>{notice}</Text>}
  {state&&<>
   <Text style={s.body}>Merchant: {state.onlineAvailable?
    "Independently verified":"Unavailable — pay at center"}</Text>
   <Text style={s.body}>Provider status:
    {" "+(state.state??state.status??"NOT_STARTED").replaceAll("_"," ")}</Text>
   {state.paidMinor&&<Text style={s.body}>
    Verified received: {money(state.paidMinor)}</Text>}
   {state.refundedOrPartial&&<Text style={s.alert}>Some funds were refunded
    or reversed; only actual remaining collections count.</Text>}
   {canInitiate&&state.onlineAvailable&&!uncertain&&
    button(state.checkoutAvailable?"Open existing center checkout":
     "Pay online to this verified center",()=>void start(),busy)}
  </>}
  {button("Refresh actual provider payment",()=>{
   setBusy(true);setError("");
   void refresh().then(v=>{if(v.state==="CONFIRMED")setUncertain(false);})
    .catch(err).finally(()=>setBusy(false));
  },busy||loading)}
  {uncertain&&<Text style={s.alert}>The last order result is unknown.
   Check this exact order or ask the center before making another payment.</Text>}
  <Text style={s.body}>Closing checkout, a success screen or a returned
   signature does not prove payment. Only actual independently verified
   provider capture confirms collection.</Text>
  <Modal visible={!!html} animationType="slide"
   onRequestClose={()=>setHtml("")} presentationStyle="fullScreen">
   <View style={s.modal}>
    <View style={s.modalHead}>
     {button("Close checkout — payment still pending",()=>{
      setHtml("");setNotice("Checkout closed; verify the original center payment.");
     })}
    </View>
    {!!html&&<WebView source={{html}} javaScriptEnabled domStorageEnabled
     mixedContentMode="never" allowFileAccess={false}
     originWhitelist={["https://*","about:blank"]}
     onShouldStartLoadWithRequest={req=>
      req.url==="about:blank"||req.url.startsWith("https://")}
     onMessage={event=>{
      const signal=event.nativeEvent.data;
      if(signal==="CHECK"||signal==="CLOSE"){
       setHtml("");setNotice("Provider checkout returned. Confirmation
        remains pending until verified on the server.");
       void refresh().catch(err);
      }else if(signal==="ERROR"){
       setHtml("");setError("Provider checkout could not open.");
      }
     }}
     onError={()=>{setHtml("");setError("Verified provider checkout unavailable.");}}
     style={{flex:1}}/>}
   </View>
  </Modal>
 </View>;
}
const s=StyleSheet.create({
 card:{padding:14,gap:11,borderColor:t.border,borderWidth:1,
  borderRadius:14,backgroundColor:t.surface},
 title:{fontSize:16,fontWeight:"700",color:t.text},
 body:{fontSize:13,lineHeight:20,color:t.mutedText},
 alert:{fontSize:13,lineHeight:20,color:t.error},
 button:{minHeight:48,padding:12,borderColor:t.border,borderWidth:1,
  borderRadius:10,justifyContent:"center"},
 buttonText:{fontSize:14,fontWeight:"600",color:t.text},
 disabled:{opacity:0.5},
 modal:{flex:1,backgroundColor:t.adminCanvas,paddingTop:34},
 modalHead:{padding:10}
});
