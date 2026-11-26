"use client";
import {useCallback,useEffect,useRef,useState} from "react";
type Source={onlineAvailable?:boolean;reason?:string;status?:string;state?:string;
 checkoutAvailable?:boolean;publicKeyId?:string|null;orderRef?:string|null;
 amountMinor?:string;patientPayableMinor?:string;paidMinor?:string;
 refundedOrPartial?:boolean;message?:string;provider?:string};
type Props={bookingRef:string;centerRef?:string;canInitiate?:boolean};
type RzpOptions={key:string;order_id:string;amount:number;currency:"INR";
 name:string;description:string;handler:(proof:unknown)=>void;
 modal:{ondismiss:()=>void};theme:{color:string}};
declare global{interface Window{Razorpay?:new(options:RzpOptions)=>{open:()=>void}}}
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const RZP=/^order_[A-Za-z0-9]{8,60}$/;
const money=(value:string)=>new Intl.NumberFormat("en-IN",{
 style:"currency",currency:"INR",maximumFractionDigits:2
}).format(Number(value)/100);
async function api<T>(path:string,payload?:object){
 const r=await fetch("/api/healthcare-assistance/merchant/"+path,{
  credentials:"same-origin",cache:"no-store",method:payload?"POST":"GET",
  ...(payload?{headers:{"Content-Type":"application/json"},
   body:JSON.stringify(payload)}:{})});
 if(!r.ok)throw Object.assign(new Error(
  r.status===401?"Sign in again to view your center payment.":
  r.status===403?"This center or consultation is not available to you.":
  r.status===404?"Original center payment source is unavailable.":
  r.status===409?"Payment already pending or source changed. Check the original order.":
  "Payment provider outcome is uncertain. Check the original order first."),
  {status:r.status});
 return r.json() as Promise<T>;
}
function checkoutSDK(){
 return new Promise<void>((resolve,reject)=>{
  if(window.Razorpay){resolve();return;}
  const previous=document.querySelector<HTMLScriptElement>(
   'script[data-cg17-provider-checkout="razorpay"]');
  if(previous){previous.addEventListener("load",()=>resolve(),{once:true});
   previous.addEventListener("error",()=>reject(Error("Checkout unavailable.")),{once:true});
   return;}
  const script=document.createElement("script");
  script.dataset.cg17ProviderCheckout="razorpay";
  script.src="https://checkout.razorpay.com/v1/checkout.js";
  script.async=true;script.referrerPolicy="no-referrer";
  script.onload=()=>window.Razorpay?resolve():reject(Error("Checkout unavailable."));
  script.onerror=()=>reject(Error("Verified checkout cannot be loaded."));
  document.head.appendChild(script);
 });
}
/** All amounts/order are server-verified. Razorpay's browser handler is NOT
 * authoritative: only CG17's signed server webhook confirms collection.
 */
export function CenterMerchantCheckout({bookingRef,centerRef,canInitiate=true}:Props){
 const [current,setCurrent]=useState<Source|null>(null);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [error,setError]=useState(""),[message,setMessage]=useState("");
 const [uncertain,setUncertain]=useState(false);
 const request=useRef<string|null>(null),serial=useRef(0);
 const location=centerRef?"staff/centers/"+centerRef+
  "/appointments/"+bookingRef:"me/appointments/"+bookingRef;
 const valid=ID.test(bookingRef)&&(!centerRef||ID.test(centerRef));
 const refresh=useCallback(async()=>{
  if(!valid)throw Error("Original consultation unavailable.");
  const result=await api<Source>(location);
  if(result.checkoutAvailable&&
    (!result.orderRef||!RZP.test(result.orderRef)||
     !result.publicKeyId?.startsWith("rzp_")||
     !result.amountMinor||!/^\d{1,11}$/.test(result.amountMinor)))
   throw Error("Unverified center checkout response.");
  setCurrent(result);return result;
 },[location,valid]);
 useEffect(()=>{
  let active=true;const gen=++serial.current;
  setCurrent(null);setLoading(true);setError("");setMessage("");
  setUncertain(false);request.current=null;
  void refresh().catch(e=>{
   if(active&&gen===serial.current)setError(e instanceof Error?e.message:
    "Actual center payment is unavailable.");
  }).finally(()=>{if(active&&gen===serial.current)setLoading(false)});
  return()=>{active=false;++serial.current};
 },[refresh]);
 async function launch(v:Source){
  if(!v.checkoutAvailable||!v.orderRef||!v.publicKeyId||!v.amountMinor||
     !RZP.test(v.orderRef))return;
  await checkoutSDK();
  if(!window.Razorpay)throw Error("Provider checkout is unavailable.");
  const instance=new window.Razorpay({
   key:v.publicKeyId,order_id:v.orderRef,amount:Number(v.amountMinor),
   currency:"INR",name:"Verified Healthcare Center",
   description:"Consultation patient amount — center-owned merchant",
   handler:()=>{setMessage("Checkout returned. Confirmation is pending "+
    "the verified provider callback. Refresh status to check money received.");
    void refresh().catch(()=>{});},
   modal:{ondismiss:()=>setMessage("Checkout closed. No payment is confirmed. "+
    "Check the original order before trying again.")},
   theme:{color:"#194A3A"}
  });
  instance.open();
 }
 async function begin(){
  if(!valid||busy||uncertain||!canInitiate)return;
  setBusy(true);setError("");setMessage("");
  try{
   const known=current;
   if(known?.checkoutAvailable){
    await launch(known);return;
   }
   if(!known?.onlineAvailable)
    throw Error("This center has no independently verified online merchant. "+
     "Pay-at-center remains available.");
   if(!request.current)request.current=crypto.randomUUID();
   const order=await api<Source>(location+"/checkout",{
    requestKey:request.current});
   setCurrent(order);
   if(order.checkoutAvailable){
    request.current=null;await launch(order);
   }else{
    setUncertain(order.state==="UNKNOWN"||order.state==="INITIALIZING");
    setMessage(order.message??"Order still pending provider verification. "+
     "Do not create another order.");
   }
  }catch(e){
   const status=e&&typeof e==="object"&&"status" in e&&
    typeof e.status==="number"?e.status:503;
   setUncertain(status>=500);
   setError(e instanceof Error?e.message:
    "The center checkout cannot be confirmed.");
  }finally{setBusy(false);}
 }
 if(!valid)return null;
 const state=current?.state??current?.status??"UNAVAILABLE";
 return <section className="cg-diagnostics-card" aria-label="Verified center online payment">
  <h3>Payment method — verified healthcare center</h3>
  <p>Online collection goes only to the center's independently verified
   merchant, never to the Foundation's donation account.</p>
  {loading&&<p role="status">Checking your center's payment method…</p>}
  {!!error&&<p role="alert" className="notice error">{error}</p>}
  {!!message&&<p role="status" className="notice">{message}</p>}
  {current&&<div className="cg-diagnostics-summary">
   <p><strong>Center online payment:</strong> {
    current.onlineAvailable?"Verified and available":
    state==="CONFIRMED"?"Provider capture recorded":
    "Unavailable — pay at center instead"}</p>
   <p><strong>Original payment state:</strong> {state.replaceAll("_"," ")}</p>
   {current.paidMinor&&<p>Currently verified received:
    {" "+money(current.paidMinor)}</p>}
   {current.refundedOrPartial&&<p>Provider refunded or partially reversed
    some funds. Only the current verified balance counts.</p>}
  </div>}
  {canInitiate&&current?.onlineAvailable&&!uncertain&&
   <button className="primary" type="button" disabled={busy||loading} onClick={()=>void begin()}>
    {busy?"Checking original provider order…":
     current.checkoutAvailable?"Open existing verified checkout":
     "Pay online to this healthcare center"}
   </button>}
  {(uncertain||["UNKNOWN","INITIALIZING"].includes(state))&&
   <button type="button" disabled={busy||loading} onClick={()=>{
    setBusy(true);setError("");setMessage("");
    void api<Source>(location+"/reconcile",{}).then(v=>{
     setCurrent(v);
     if(v.checkoutAvailable)setUncertain(false);
     setMessage(v.message??"Original provider order checked.");
    }).catch(e=>setError(e instanceof Error?e.message:
     "Original provider order cannot be reconciled."))
     .finally(()=>setBusy(false));
   }}>Recover the original provider order — do not pay twice</button>}
  {uncertain&&<p role="alert">Your previous provider order may already exist.
   Do not create a new checkout or pay twice. Check the same order, or ask
   the center to reconcile its provider status.</p>}
  <button type="button" disabled={busy||loading} onClick={()=>{
   setBusy(true);setError("");
   void refresh().then(v=>{
    if(v.state==="CONFIRMED")setUncertain(false);
   }).catch(e=>setError(e instanceof Error?e.message:
    "Original center payment source is unavailable."))
    .finally(()=>setBusy(false));
  }}>Refresh actual provider payment status</button>
  <p>Returning from Razorpay is not proof of payment. A signed, independently
   fetched provider capture is required before any amount shows as received.
   You can still choose the normal pay-at-center flow.</p>
 </section>;
}
