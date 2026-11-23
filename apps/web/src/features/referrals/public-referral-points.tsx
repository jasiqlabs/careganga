"use client";
import {useCallback,useEffect,useRef,useState} from "react";
type Rel="MEMBER"|"VOLUNTEER";
type Balance={earnedPoints:string;reversedPoints:string;heldPoints:string;
 spentPoints:string;availablePoints:string;adjustmentDuePoints:string;
 qualifiedReferrals:number;pendingReferrals:string;heldForReviewReferrals:string;
  notQualifiedReferrals:string;awaitingVerificationReferrals:string;
  currentRankName:string|null;notice:string};
type Entry={status:"QUALIFIED"|"REVERSED";points:string;recordedAt:string;rank:string|null};
type History={items:Entry[];hasMore:boolean;page:number};
type Rank={rank:string|null;qualifiedReferrals:number;
 history:{previous:string|null;current:string|null;eligiblePoints:string;
  qualifiedReferrals:number;recordedAt:string}[];hasMore:boolean};
const formatted=(s:string)=>{
 try{if(!/^-?[0-9]{1,18}$/.test(s))return "Unavailable";
  return BigInt(s).toLocaleString("en-IN");}
 catch{return "Unavailable";}
};
async function get<T>(route:string){
 const result=await fetch("/api/referrals/"+route,{cache:"no-store",credentials:"same-origin",
  signal:AbortSignal.timeout(15000)});
 if(!result.ok)throw Error(result.status===401?"Sign in to view your own points.":
  result.status===403?"Your current eligible relationship is required.":
  "Your referral points are temporarily unavailable.");
 const decoded:unknown=await result.json();
 if(!decoded||typeof decoded!=="object")throw Error("Referral details are unavailable.");
 return decoded as T;
}
/** Strictly current authenticated CG04 self-only ledger projection: never
 * names the referred applicant or exposes another person's contact/branch.
 */
export function PublicReferralPoints({programmeRef,relationship}:{
 programmeRef:string;relationship:Rel}){
 const [balance,setBalance]=useState<Balance|null>(null),[rank,setRank]=useState<Rank|null>(null);
 const [history,setHistory]=useState<Entry[]>([]),[more,setMore]=useState(false);
 const [page,setPage]=useState(2),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const seq=useRef(0),locked=useRef(false);
 const query=new URLSearchParams({programmeRef,relationship}).toString();
 const load=useCallback(async(target:number,append=false)=>{
  if(locked.current)return;locked.current=true;
  const id=++seq.current;setBusy(true);setError("");
  if(!append){setBalance(null);setRank(null);setHistory([]);setMore(false);}
  try{
   if(append){
    const result=await get<History>("my-history?"+query+"&page="+target);
    if(id===seq.current){setHistory(old=>[...old,...result.items]);
     setMore(result.hasMore);setPage(target+1);}
   }else{
    const [value,events,currentRank]=await Promise.all([
     get<Balance>("points/my-balance?"+query),
     get<History>("my-history?"+query+"&page=1"),
     get<Rank>("rewards/my-rank?"+query+"&page=1")
    ]);
    if(id===seq.current){setBalance(value);setHistory(events.items);
     setMore(events.hasMore);setPage(2);setRank(currentRank);}
   }
  }catch(e){if(id===seq.current)setError(e instanceof Error?e.message:
   "Your referral status could not be confirmed.");}
  finally{if(id===seq.current){locked.current=false;setBusy(false);}}
 },[query]);
 useEffect(()=>{
  void load(1);
  const onVisibility=()=>{
   if(document.visibilityState!=="visible"){
    seq.current++;locked.current=false;setBalance(null);setRank(null);setHistory([]);
   }else void load(1);
  };
  document.addEventListener("visibilitychange",onVisibility);
  return()=>{seq.current++;document.removeEventListener("visibilitychange",onVisibility);};
 },[load]);
 return <section className="cg04-panel" aria-label="Private referral points and rank">
  <h3>My verified referral points</h3>
  <p>Only real independently approved qualifying applications earn points.
   Your referred applicants' personal details are never displayed here.</p>
  {error&&<p role="alert" className="cg04-error">{error}</p>}
  {busy&&<p role="status">Checking protected referral ledger…</p>}
  {balance&&<div>
   <dl className="cg04-document-grid">
    <div><dt>Earned</dt><dd>{formatted(balance.earnedPoints)}</dd></div>
    <div><dt>Available</dt><dd>{formatted(balance.availablePoints)}</dd></div>
    <div><dt>Held</dt><dd>{formatted(balance.heldPoints)}</dd></div>
    <div><dt>Redeemed (verified spent)</dt><dd>{formatted(balance.spentPoints)}</dd></div>
    <div><dt>Reversed</dt><dd>{formatted(balance.reversedPoints)}</dd></div>
    <div><dt>Verified referrals</dt><dd>{balance.qualifiedReferrals}</dd></div>
    <div><dt>Qualification pending</dt><dd>{formatted(balance.pendingReferrals)}</dd></div>
    <div><dt>Held for eligibility review</dt><dd>{formatted(balance.heldForReviewReferrals)}</dd></div>
    <div><dt>Not qualified (returned/rejected/cancelled)</dt><dd>{formatted(balance.notQualifiedReferrals)}</dd></div>
    <div><dt>Approval recorded, credit unconfirmed</dt><dd>{formatted(balance.awaitingVerificationReferrals)}</dd></div>
    <div><dt>Current rank</dt><dd>{rank?.rank??"Not ranked yet"}</dd></div>
   </dl>
   {balance.adjustmentDuePoints!=="0"&&<p role="status">
    An adjustment of {formatted(balance.adjustmentDuePoints)} points is under private review.
   </p>}
   <p>{balance.notice}</p>
  </div>}
  {balance&&<div>
   <h4>My referral history</h4>
   {!history.length?<p>No qualifying referral credit has been recorded.</p>:
    <div className="cg04-roster-scroll" role="region" tabIndex={0}
     aria-label="Your private referral history"><table>
      <thead><tr><th>Date</th><th>Outcome</th><th>Points</th><th>Rank</th></tr></thead>
      <tbody>{history.map((e,i)=><tr key={e.recordedAt+":"+i}>
       <td>{new Date(e.recordedAt).toLocaleDateString("en-IN",{timeZone:"Asia/Kolkata"})}</td>
       <td>{e.status==="QUALIFIED"?"Qualified":"Reversed"}</td>
       <td>{formatted(e.points)}</td><td>{e.rank??"—"}</td></tr>)}</tbody>
     </table></div>}
   {more&&<button type="button" disabled={busy}
    onClick={()=>void load(page,true)}>Older history</button>}
   {rank?.history?.length? <details><summary>Rank history</summary>
    {rank.history.map((e,i)=><p key={e.recordedAt+":"+i}>
     {e.current??"Unranked"} · {e.qualifiedReferrals} verified referrals ·
     {formatted(e.eligiblePoints)} eligible points</p>)}
   </details>:null}
  </div>}
  <button type="button" disabled={busy} onClick={()=>void load(1)}>Refresh points</button>
 </section>;
}
