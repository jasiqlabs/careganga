"use client";
import {useCallback,useEffect,useRef,useState} from "react";
type Brand={configured:boolean;version:number;displayName?:string;signatoryName?:string};
type AssetKind="LOGO"|"SIGNATURE"|"SEAL";
type Asset={assetRef:string;kind:AssetKind;verified:boolean;status:string;uploadUrl?:string;uploadHeaders?:Record<string,string>};
type Pack={packRef:string;status:string;issueRevision:number;issuedAt:string|null;canDownload:boolean;canRetry:boolean};
type Pending={path:string;body:Record<string,unknown>;kind:"brand"|"issue"};
const base="/api/membership/documents";
const kinds=["CARD","CERTIFICATE","WELCOME"] as const;
async function api<T>(path:string,body?:Record<string,unknown>):Promise<T>{
 const res=await fetch(base+path,{method:body?"POST":"GET",cache:"no-store",
  headers:body?{"Content-Type":"application/json"}:undefined,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});
 const data:unknown=await res.json().catch(()=>null);
 if(!res.ok||data===null){
  const v=data&&typeof data==="object"?data as {message?:string}:{};
  throw new Error(v.message??"Official document outcome could not be confirmed. Refresh before retrying.");
 }
 return data as T;
}
/** Restricted to CG01 effective membership.documents.issue root permission by page and CG19. */
export function MemberDocumentManager({memberRef,memberNumber}:{memberRef?:string|null;memberNumber?:string}){
 const [opened,setOpened]=useState(false),[brand,setBrand]=useState<Brand|null>(null),[assets,setAssets]=useState<Partial<Record<AssetKind,string>>>({});
 const [displayName,setDisplayName]=useState(""),[signatoryName,setSignatoryName]=useState(""),[password,setPassword]=useState("");
 const [pack,setPack]=useState<Pack|null>(null),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[note,setNote]=useState("");
 const pending=useRef<Pending|null>(null),working=useRef(false),seq=useRef(0);
 const refresh=useCallback(async()=>{
  const n=++seq.current;setLoading(true);
  try{
   const [current,member]=await Promise.all([
    api<Brand>("/config"),memberRef?api<{pack:Pack|null}>("/members/"+memberRef):Promise.resolve({pack:null})
   ]);
   if(n===seq.current&&document.visibilityState==="visible"){setBrand(current);setPack(member.pack);}
  }catch(e){if(n===seq.current)setError(e instanceof Error?e.message:"Official document state is unavailable.");}
  finally{if(n===seq.current)setLoading(false);}
 },[memberRef]);
 useEffect(()=>{if(opened)void refresh();},[opened,refresh]);
 useEffect(()=>{
  if(memberRef){setOpened(true);setPack(null);}
 },[memberRef]);
 useEffect(()=>{
  const hide=()=>{if(document.visibilityState==="hidden"){seq.current++;setPack(null);setBrand(null);setPassword("");setAssets({});setLoading(true);}
   else if(opened)void refresh();};
  document.addEventListener("visibilitychange",hide);
  return()=>document.removeEventListener("visibilitychange",hide);
 },[opened,refresh]);
 const work=async(job:()=>Promise<void>)=>{
  if(working.current)return;working.current=true;setBusy(true);setError("");setNote("");
  try{await job();}catch(e){setError(e instanceof Error?e.message:"Official document outcome cannot be confirmed. Refresh before retrying.");}
  finally{working.current=false;setBusy(false);setPassword("");}
 };
 async function upload(kind:AssetKind,file:File){
  await work(async()=>{
   if(!["image/jpeg","image/png"].includes(file.type)||file.size<1||file.size>2097152)throw Error("Use an actual Foundation JPG/PNG logo, seal or signature under 2 MB.");
   const raw=await file.arrayBuffer(),sha=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",raw))).map(n=>n.toString(16).padStart(2,"0")).join("");
   const intent=await api<Asset>("/assets",{kind,requestKey:crypto.randomUUID(),mime:file.type,sizeBytes:file.size,sha256:sha});
   if(intent.status!=="UPLOAD_READY"||!intent.uploadUrl||!intent.uploadHeaders)throw Error("Official private asset upload is unavailable. Refresh before retrying.");
   const sent=await fetch(intent.uploadUrl,{method:"PUT",headers:intent.uploadHeaders,body:file,signal:AbortSignal.timeout(20000)});
   if(!sent.ok)throw Error("Private branding upload could not be confirmed.");
   const verified=await api<Asset>("/assets/"+intent.assetRef+"/confirm",{});
   if(!verified.verified)throw Error("The selected Foundation branding image has not passed secure verification.");
   setAssets(v=>({...v,[kind]:intent.assetRef}));setNote(kind+" image was privately verified. Complete all three files before approval.");
  });
 }
 async function submit(cmd:Pending,enteredPassword:string){
  await work(async()=>{
   if(enteredPassword.length<8)throw Error("Enter your current Foundation password.");
   pending.current=cmd;
   const response=await api<{configured?:boolean;packRef?:string;status?:string;version?:number}>(cmd.path,{...cmd.body,currentPassword:enteredPassword});
   pending.current=null;
   await refresh();
   setNote(cmd.kind==="brand"?"Original verified Foundation brand configuration approved.":"Original official document request recorded as "+(response.status??"PENDING")+".");
  });
 }
 const approve=()=>submit({kind:"brand",path:"/config",body:{
  displayName:displayName.trim(),signatoryName:signatoryName.trim(),signatureAssetRef:assets.SIGNATURE,
  sealAssetRef:assets.SEAL,logoAssetRef:assets.LOGO,expectedVersion:brand?.version??0,requestKey:crypto.randomUUID()
 }},password);
 const issue=()=>{if(!memberRef)return;void submit({kind:"issue",path:"/members/"+memberRef+"/issue",body:{requestKey:crypto.randomUUID()}},password);};
 const retry=()=>{const p=pending.current;if(p)void submit(p,password);};
 return <section className="cg04-panel cg04-document-desk" aria-label="Official membership documents">
  <div className="cg04-roster-head"><div><h3>Official membership documents</h3><p className="cg04-muted">Real Foundation documents require verified original member approval, payment and approved signing assets.</p></div>
   <button type="button" onClick={()=>{setOpened(x=>!x);setPassword("");}}>{opened?"Close document tools":"Open official document tools"}</button></div>
  {opened&&<>
   {error&&<p role="alert" className="cg04-error">{error}</p>}{note&&<p role="status">{note}</p>}
   <div className="cg04-buttons"><button type="button" disabled={busy||loading} onClick={()=>void refresh()}>Refresh current document state</button></div>
   {loading&&<p role="status">Checking original Foundation document authority…</p>}
   {brand&&!brand.configured&&<div className="cg04-panel"><h4>Approve genuine Foundation signing assets</h4>
    <p className="cg04-muted">These files must be your authorized Foundation logo, signatory signature and seal. Original client examples are not accepted as production assets.</p>
    <div className="cg04-document-grid">
     {(["LOGO","SIGNATURE","SEAL"] as const).map(kind=><label key={kind}>{kind==="LOGO"?"Official Foundation logo":kind==="SIGNATURE"?"Approved signatory signature":"Official seal"}
      <input type="file" accept="image/png,image/jpeg" disabled={busy||loading} onChange={e=>{const file=e.target.files?.[0];if(file)void upload(kind,file);e.target.value="";}}/>
      <small>{assets[kind]?"Verified private "+kind.toLowerCase()+" selected":"No verified "+kind.toLowerCase()+" selected"}</small></label>)}
     <label>Approved Foundation display name<input maxLength={120} value={displayName} onChange={e=>setDisplayName(e.target.value)}/></label>
     <label>Actual authorized signatory name<input maxLength={120} value={signatoryName} onChange={e=>setSignatoryName(e.target.value)}/></label>
    </div>
    <p>Approve only the real source images and accurate Foundation details. A current Foundation password is required.</p>
    <label>Current Foundation password<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
    <div className="cg04-buttons"><button type="button" className="cg04-primary" disabled={busy||loading||!!pending.current||!assets.LOGO||!assets.SIGNATURE||!assets.SEAL||displayName.trim().length<3||signatoryName.trim().length<2||password.length<8} onClick={()=>void approve()}>Approve original branding</button></div>
   </div>}
   {brand?.configured&&<p role="status">Approved official brand: <strong>{brand.displayName}</strong> · Authorized signatory: {brand.signatoryName}. Version {brand.version}.</p>}
   {memberRef&&<div className="cg04-panel">
    <h4>Member documents · {memberNumber??"Selected member"}</h4>
    {pack?<><p>Status: <strong>{pack.status==="ISSUED"?"Three verified documents issued":pack.status==="REVOKED"?"Revoked":pack.status==="UNKNOWN"?"Issue outcome uncertain":pack.status}</strong></p>
     {pack.canDownload&&<div className="cg04-buttons">{kinds.map(kind=><a key={kind} href={base+"/packs/"+pack.packRef+"/"+kind+"/download"}>{kind==="CARD"?"Member card (front/back)":kind==="CERTIFICATE"?"Certificate":"Welcome letter"} PDF</a>)}</div>}
     {pack.canRetry&&<button type="button" disabled={busy||loading} onClick={()=>void work(async()=>{await api("/packs/"+pack.packRef+"/reconcile",{});await refresh();setNote("Original document verification refreshed.");})}>Retry verification of original documents</button>}
     {pack.status!=="REVOKED"&&<><label>Current Foundation password for revocation<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
      <button type="button" disabled={busy||password.length<8} onClick={()=>void work(async()=>{await api("/packs/"+pack.packRef+"/revoke",{currentPassword:password});await refresh();setNote("Original official document pack revoked.");})}>Revoke existing pack</button></>}
    </>:<p>No original official member pack has been issued for this person.</p>}
    {brand?.configured&&(!pack||pack.status==="REVOKED")&&<><label>Confirm current Foundation password<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
     <button type="button" disabled={busy||loading||!!pending.current||password.length<8} className="cg04-primary" onClick={issue}>Issue three verified membership documents</button></>}
   </div>}
   {pending.current&&<div className="cg04-warning" role="status"><p>The official request result is uncertain. Refresh its current status before retrying the identical command. No duplicate issue should be created.</p>
    <label>Re-enter current Foundation password<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
    <button disabled={busy||password.length<8} type="button" onClick={retry}>Retry original request</button></div>}
  </>}
 </section>;
}
