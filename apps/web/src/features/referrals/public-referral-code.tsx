"use client";
import {useCallback,useEffect,useRef,useState} from "react";
type Choice={programmeRef:string;programmeName:string;relationship:"MEMBER"|"VOLUNTEER"};
type Options={items:Choice[];hasMore:boolean;page:number;notice:string};
type Issued={programmeName:string;relationship:Choice["relationship"];code:string;sharePath:string;notice:string};
async function read<T>(path:string):Promise<T>{
 const r=await fetch("/api/referrals/"+path,{cache:"no-store",credentials:"same-origin",
  signal:AbortSignal.timeout(15000)});
 const data:unknown=await r.json().catch(()=>null);
 if(!r.ok||!data||typeof data!=="object")
  throw Error(r.status===401?"Sign in again to view your referral code.":
   r.status===403?"A currently active membership or volunteer relationship is required.":
   "Referral code information is temporarily unavailable.");
 return data as T;
}
/** Only authenticated, currently eligible original CG04 actors can receive codes.
 * No client credits points and no code by itself confirms a qualified referral.
 */
export function PublicReferralCode(){
 const [choices,setChoices]=useState<Choice[]>([]),[chosen,setChosen]=useState("");
 const [issued,setIssued]=useState<Issued|null>(null),[error,setError]=useState("");
 const [busy,setBusy]=useState(false),[hasMore,setHasMore]=useState(false);
 const [page,setPage]=useState(2),[copied,setCopied]=useState(false);
 const epoch=useRef(0),lock=useRef(false);
 const refresh=useCallback(async(target:number,append:boolean)=>{
  if(lock.current)return;
  lock.current=true;const seq=++epoch.current;setBusy(true);setError("");
  if(!append){setIssued(null);setChoices([]);setChosen("");setHasMore(false);setCopied(false);}
  try{
   const data=await read<Options>("my-code/options?page="+target);
   if(seq!==epoch.current)return;
   if(!Array.isArray(data.items)||typeof data.hasMore!=="boolean")
    throw Error("Current referral programmes are temporarily unavailable.");
   setChoices(old=>append?[...old,...data.items.filter(i=>!old.some(x=>
    x.programmeRef===i.programmeRef&&x.relationship===i.relationship))]:data.items);
   setHasMore(data.hasMore);setPage(target+1);
  }catch(e){if(seq===epoch.current)setError(e instanceof Error?e.message:"Referral programmes are unavailable.");}
  finally{if(seq===epoch.current){lock.current=false;setBusy(false);}}
 },[]);
 useEffect(()=>{
  void refresh(1,false);
  const visibility=()=>{
   if(document.visibilityState!=="visible"){
    epoch.current++;lock.current=false;setIssued(null);setChoices([]);setChosen("");setCopied(false);
   }else void refresh(1,false);
  };
  document.addEventListener("visibilitychange",visibility);
  return()=>{epoch.current++;document.removeEventListener("visibilitychange",visibility);};
 },[refresh]);
 const get=async()=>{
  const c=choices.find(x=>x.programmeRef+"|"+x.relationship===chosen);
  if(!c||busy)return;
  const seq=++epoch.current;setBusy(true);setError("");setCopied(false);setIssued(null);
  try{
   const data=await read<Issued>("my-code?"+
    new URLSearchParams({programmeRef:c.programmeRef,relationship:c.relationship}));
   if(seq!==epoch.current)return;
   if(!/^[A-Za-z0-9_-]{32}$/.test(data.code)||
    !new RegExp("^\\/(?:membership|volunteer)\\?ref=[A-Za-z0-9_-]{32}$").test(data.sharePath))
    throw Error("Referral link was not confirmed. Refresh before sharing.");
   setIssued(data);
  }catch(e){if(seq===epoch.current)setError(e instanceof Error?e.message:"Cannot confirm a current referral code.");}
  finally{if(seq===epoch.current)setBusy(false);}
 };
 const link=issued&&typeof window!=="undefined"?window.location.origin+issued.sharePath:"";
 const copy=async()=>{
  if(!link)return;
  try{await navigator.clipboard.writeText(link);setCopied(true);}
  catch{setError("Copy is unavailable on this device. Select and copy the link shown below.");}
 };
 return <section className="cg04-panel" aria-label="Your referral code">
  <h2>Invite with your referral code</h2>
  <p>Only independently approved, currently active members and volunteers may invite
   new applicants. A visit or submitted application does not earn points.</p>
  {error&&<p role="alert" className="cg04-error">{error}</p>}
  {busy&&<p role="status">Verifying current referral eligibility…</p>}
  {!!choices.length?<div className="cg04-buttons">
   <label>Choose your eligible programme and relationship
    <select value={chosen} disabled={busy} onChange={e=>{setChosen(e.target.value);setIssued(null);setCopied(false);}}>
     <option value="">Choose a programme</option>
     {choices.map(c=><option key={c.programmeRef+"|"+c.relationship}
      value={c.programmeRef+"|"+c.relationship}>
      {c.programmeName} — {c.relationship==="MEMBER"?"Membership":"Volunteer"}</option>)}
    </select>
   </label>
   <button type="button" disabled={busy||!chosen} onClick={()=>void get()}>Get my referral code</button>
   {hasMore&&<button type="button" disabled={busy} onClick={()=>void refresh(page,true)}>More programmes</button>}
   <button type="button" disabled={busy} onClick={()=>void refresh(1,false)}>Refresh eligibility</button>
  </div>:!busy&&!error&&<p>No eligible referral programme is currently available for your verified relationship.</p>}
  {issued&&<div className="cg04-panel" role="status">
   <p><strong>{issued.programmeName} — {issued.relationship==="MEMBER"?"Membership":"Volunteer"}</strong></p>
   <label>Your reusable code<input readOnly value={issued.code} aria-label="Your referral code"/></label>
   <label>Your private sharing link<input readOnly value={link} aria-label="Referral sharing link"/></label>
   <div className="cg04-buttons">
    <button type="button" onClick={()=>void copy()}>{copied?"Copied":"Copy link"}</button>
   </div>
   <p>Share this link only with an interested new applicant. Actual referral points
    will appear only after the Foundation verifies the qualifying application and activation.</p>
  </div>}
 </section>;
}
