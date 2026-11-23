"use client";
import {useCallback,useEffect,useRef,useState} from "react";
type Kind="MEMBER"|"VOLUNTEER";
export type RedeemableDigitalReward={
 ref:string;programmeRef:string;name:string;version:number;pointsPrice:string;
 type:"DIGITAL"|"PHYSICAL";availability:"NO_STOCK_REQUIRED"|"AVAILABLE"|"OUT_OF_STOCK";eligibleAudience:"MEMBER"|"VOLUNTEER"|"BOTH";
 programmeAudience:"MEMBER"|"VOLUNTEER"|"BOTH";
 digitalFulfillmentMethod:"PENDING_EXTERNAL_PROOF"|"ON_PLATFORM_RECOGNITION";
};
type Redemption={ref:string;state:string;type:"DIGITAL"|"PHYSICAL";productName:string;pointsCost:string;revision:number;
 requestedAt:string;digitalFulfillmentMethod:string;recognitionTitle:string|null;
 recognitionDescription:string|null;recognizedAt:string|null};
type Page={items:Redemption[];hasMore:boolean;page:number};
type Created={ref:string;state:string;pointsCost:string;replayed:boolean;notice:string};
async function call<T>(path:string,method:"GET"|"POST"="GET",body?:Record<string,unknown>){
 const response=await fetch("/api/rewards/"+path,{
  method,cache:"no-store",credentials:"same-origin",signal:AbortSignal.timeout(15000),
  headers:method==="POST"?{"Content-Type":"application/json"}:undefined,
  body:method==="POST"?JSON.stringify(body??{}):undefined
 });
 const raw:unknown=await response.json().catch(()=>null);
 if(!response.ok){
  const safe=raw&&typeof raw==="object"&&!Array.isArray(raw)?raw as {message?:unknown}:{};
  throw Error(typeof safe.message==="string"&&safe.message.length<230?
   safe.message:"Reward result is uncertain. Refresh original request history before retrying.");
 }
 if(!raw||typeof raw!=="object")throw Error("Reward request status unavailable.");
 return raw as T;
}
/** Genuine DIGITAL reward point holds only. Never displays a delivery code,
 * attempts CG12 reservation, or promises fulfillment without original evidence.
 */
export function PublicDigitalRedemption({selected,onClear,audiences}:{
 selected:RedeemableDigitalReward|null;onClear:()=>void;audiences:string[]}){
 const [relationship,setRelationship]=useState<Kind>("MEMBER");
 const [confirmed,setConfirmed]=useState(false);
 const [busy,setBusy]=useState(false),[historyBusy,setHistoryBusy]=useState(false);
 const [notice,setNotice]=useState(""),[error,setError]=useState("");
 const [entries,setEntries]=useState<Redemption[]>([]);
 const [more,setMore]=useState(false),[nextPage,setNextPage]=useState(2);
 const draft=useRef<{key:string;signature:string}|null>(null);
 const seq=useRef(0);
 const valid=selected?audiences.filter((kind):kind is Kind=>
  (kind==="MEMBER"||kind==="VOLUNTEER")&&
  (selected.eligibleAudience==="BOTH"||selected.eligibleAudience===kind)&&
  (selected.programmeAudience==="BOTH"||selected.programmeAudience===kind)):[];
 const chosen=valid.includes(relationship)?relationship:valid[0];
 const load=useCallback(async(page=1,append=false)=>{
  const key=++seq.current;setHistoryBusy(true);
  try{
   const result=await call<Page>("redemptions/my-history?page="+page);
   if(key!==seq.current)return;
   if(!Array.isArray(result.items)||typeof result.hasMore!=="boolean")
    throw Error("Verified reward history was not returned.");
   setEntries(old=>append?[...old,...result.items.filter(item=>!old.some(v=>v.ref===item.ref))]:result.items);
   setMore(result.hasMore);setNextPage(page+1);
  }catch(e){if(key===seq.current)setError(e instanceof Error?e.message:"Reward history unavailable.");}
  finally{if(key===seq.current)setHistoryBusy(false);}
 },[]);
 useEffect(()=>{
  void load();
  const visibility=()=>{
   if(document.visibilityState!=="visible"){
    seq.current++;setEntries([]);setNotice("");
   }else void load();
  };
  document.addEventListener("visibilitychange",visibility);
  return()=>{seq.current++;document.removeEventListener("visibilitychange",visibility);};
 },[load]);
 useEffect(()=>{setConfirmed(false);draft.current=null;setNotice("");setError("");},
  [selected?.ref,selected?.version,relationship]);
 const request=async()=>{
  if(!selected||!chosen||busy||
   (selected.type==="PHYSICAL"&&selected.availability!=="AVAILABLE"))return;
  if(!/^[1-9][0-9]{0,17}$/.test(selected.pointsPrice)){
   setError("Current verified reward price is unavailable.");return;
  }
  const signature=selected.ref+":"+selected.version+":"+chosen;
  if(!draft.current||draft.current.signature!==signature)
   draft.current={signature,key:crypto.randomUUID()};
  setBusy(true);setError("");setNotice("");
  try{
   const data=await call<Created>("redemptions","POST",{
    programmeRef:selected.programmeRef,productRef:selected.ref,
    relationship:chosen,expectedProductVersion:selected.version,
    requestKey:draft.current.key
   });
   setNotice(data.notice);
   setConfirmed(false);await load();
  }catch(e){
   setError(e instanceof Error?e.message:"Result uncertain. Use the SAME request to retry.");
   // Do not regenerate the idempotency key on uncertain writes.
  }finally{setBusy(false);}
 };
 const cancel=async(item:Redemption)=>{
  if(busy||item.state!=="HELD")return;
  setBusy(true);setError("");setNotice("");
  try{
   await call("redemptions/"+item.ref+"/cancel","POST",{});
   setNotice("The original pending reward request was cancelled; held points and any CG12 reservation were released.");
   await load();
  }catch(e){setError(e instanceof Error?e.message:"Cancellation result uncertain. Refresh history.");}
  finally{setBusy(false);}
 };
 const acknowledge=async(item:Redemption)=>{
  if(busy||item.state!=="HELD"||
   item.digitalFulfillmentMethod!=="ON_PLATFORM_RECOGNITION")return;
  setBusy(true);setError("");setNotice("");
  try{
   const result=await call<{state:string;notice:string}>(
    "redemptions/"+item.ref+"/claim-recognition","POST",{});
   setNotice(result.notice);
   await load();
  }catch(e){
   setError(e instanceof Error?e.message:
    "Recognition status uncertain. Refresh your original request history.");
  }finally{setBusy(false);}
 };
 return <section className="cg04-panel" aria-label="Verified reward requests">
  <h3>Reward requests</h3>
  <p>Only genuinely earned referral points can be reserved. Digital delivery is
   pending until an independently verified entitlement is actually delivered.
   No gift code, stock, money, or automatic fulfillment is created.</p>
  {selected&&<div>
   <p><strong>{selected.name}</strong> · {selected.pointsPrice} points</p>
   {!valid.length?<p>This reward is not eligible for your current relationship.</p>:<>
    <label>Redeem from my eligible relationship
     <select value={chosen} onChange={e=>setRelationship(e.target.value as Kind)}>
      {valid.map(k=><option key={k} value={k}>{k==="MEMBER"?"Membership":"Volunteer"}</option>)}
     </select>
    </label>
    {!confirmed?<button type="button" disabled={busy}
     onClick={()=>setConfirmed(true)}>Review digital reward reservation</button>:
     <div role="group" aria-label="Confirm current digital price">
      <p>Confirm reservation of <strong>{selected.pointsPrice} verified points</strong>.
       {selected.type==="PHYSICAL"?
        " One actual available warehouse unit will also be reserved. A staff issue and verified recipient handover are still required.":
        " Your points remain held until cancellation or genuine digital recognition/delivery."}</p>
      <div className="cg04-buttons">
       <button type="button" disabled={busy} onClick={()=>void request()}>
        Confirm points hold</button>
       <button type="button" disabled={busy} onClick={()=>setConfirmed(false)}>Back</button>
      </div>
     </div>}
   </>}
   <button type="button" disabled={busy} onClick={onClear}>Close selection</button>
  </div>}
  {selected?.type==="PHYSICAL"&&selected.availability!=="AVAILABLE"&&
   <p>The actual warehouse source is not available. No stock or points have been reserved.</p>}
  {error&&<p role="alert">{error}</p>}
  {notice&&<p role="status">{notice}</p>}
  {(busy||historyBusy)&&<p role="status">Checking original reward status…</p>}
  <h4>My request history</h4>
  {!entries.length&&!historyBusy&&<p>No confirmed reward requests are recorded.</p>}
  {entries.map(x=><div key={x.ref} className="cg04-panel">
   <strong>{x.productName}</strong>
   <p>{x.pointsCost} points · {x.state==="HELD"?
    (x.type==="PHYSICAL"?"Points and warehouse unit held — issue pending":
     "Points held — delivery pending"):
    x.state==="CANCELLED"?"Cancelled — points released":x.state}</p>
   <p>{new Date(x.requestedAt).toLocaleDateString("en-IN",{timeZone:"Asia/Kolkata"})}</p>
   {x.state==="HELD"&&x.digitalFulfillmentMethod==="ON_PLATFORM_RECOGNITION"&&
    <button type="button" disabled={busy}
     onClick={()=>void acknowledge(x)}>
     Open and acknowledge my on-platform recognition
    </button>}
   {x.state==="FULFILLED"&&x.recognitionTitle&&
    <div role="status" aria-label="Acknowledged on-platform recognition">
     <strong>{x.recognitionTitle}</strong>
     <p>{x.recognitionDescription}</p>
     <p>Actually acknowledged {x.recognizedAt?
      new Date(x.recognizedAt).toLocaleDateString("en-IN",{timeZone:"Asia/Kolkata"}):
      ""}</p>
    </div>}
   {x.state==="HELD"&&<button type="button" disabled={busy}
    onClick={()=>void cancel(x)}>Cancel pending request</button>}
  </div>)}
  <div className="cg04-buttons">
   <button type="button" disabled={busy||historyBusy} onClick={()=>void load()}>
    Refresh original history</button>
   {more&&<button type="button" disabled={busy||historyBusy}
    onClick={()=>void load(nextPage,true)}>Older requests</button>}
  </div>
 </section>;
}
