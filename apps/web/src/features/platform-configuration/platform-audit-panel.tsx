"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import type {
  CG21AuditPage,CG21AuditEvent,CG21AuditDetail,CG21AuditCsv
} from "@careganga/api-contracts";
type Scope="ALL"|"CG-01"|"CG-21";
type Feedback={kind:"error"|"info"|"success";message:string};
function dateRange(value:string,endOfDay:boolean):string|undefined{
  if(!value)return undefined;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error("Invalid date range");
  const date=new Date(value+(endOfDay?"T23:59:59.999Z":"T00:00:00.000Z"));
  if(!Number.isFinite(date.getTime()))throw Error("Invalid date range");
  return date.toISOString();
}
async function get<T>(path:string):Promise<T>{
  let response:Response;
  try{
    response=await fetch("/api/platform/"+path,{credentials:"same-origin",cache:"no-store"});
  }catch{throw Error("UNAVAILABLE");}
  if(response.status===401||response.status===403)throw Error("DENIED");
  if(!response.ok)throw Error("UNAVAILABLE");
  try{return await response.json() as T;}catch{throw Error("UNAVAILABLE");}
}
function validPage(x:unknown):x is CG21AuditPage{
  if(!x||typeof x!=="object"||Array.isArray(x))return false;
  const p=x as Record<string,unknown>;
  return Array.isArray(p.events)&&p.events.length<=100&&
    p.events.every(e=>Boolean(e)&&typeof e==="object"&&
      typeof e.eventRef==="string"&&typeof e.occurredAt==="string"&&
      typeof e.actionLabel==="string"&&typeof e.actorDisplay==="string")&&
    (p.coverage==="COMPLETE"||p.coverage==="PARTIAL")&&
    (p.nextCursor===null||typeof p.nextCursor==="string")&&
    Array.isArray(p.unavailableSources)&&Number.isInteger(p.limit)&&
    Number(p.limit)>=1&&Number(p.limit)<=100;
}
export function PlatformAuditPanel(){
  const [page,setPage]=useState<CG21AuditPage|null>(null);
  const [loading,setLoading]=useState(true);
  const [source,setSource]=useState<Scope>("ALL");
  const [from,setFrom]=useState("");
  const [to,setTo]=useState("");
  const [applied,setApplied]=useState<{source:Scope;from:string;to:string}>({
    source:"ALL",from:"",to:""
  });
  const [tokens,setTokens]=useState<Array<string|null>>([null]);
  const [position,setPosition]=useState(0);
  const [detail,setDetail]=useState<CG21AuditDetail|null>(null);
  const [selected,setSelected]=useState<CG21AuditEvent|null>(null);
  const [detailLoading,setDetailLoading]=useState(false);
  const [exporting,setExporting]=useState(false);
  const [notice,setNotice]=useState<Feedback|null>(null);
  const generation=useRef(0),detailGeneration=useRef(0);
  const detailDialog=useRef<HTMLElement|null>(null);
  const load=useCallback(async(cursor:string|null=null,nextPosition=0)=>{
    const request=++generation.current;
    ++detailGeneration.current;setDetail(null);setSelected(null);
    setLoading(true);setNotice(null);
    try{
      const params=new URLSearchParams();
      if(cursor){
        params.set("cursor",cursor);
      }else{
        params.set("source",applied.source);
        const fromIso=dateRange(applied.from,false),toIso=dateRange(applied.to,true);
        if(fromIso)params.set("from",fromIso);
        if(toIso)params.set("to",toIso);
        if(fromIso&&toIso&&fromIso>toIso)throw Error("Invalid date range");
      }
      const result:unknown=await get<unknown>("audit?"+params);
      if(!validPage(result))throw Error("UNAVAILABLE");
      if(request!==generation.current)return;
      setPage(result);setPosition(nextPosition);
      if(result.coverage==="PARTIAL")setNotice({kind:"info",
        message:"Audit coverage is partial. Unavailable source: "+
          result.unavailableSources.join(", ")+". Refresh before relying on this history."});
    }catch(e){
      if(request!==generation.current)return;
      setPage(null);
      setNotice({kind:"error",message:e instanceof Error&&e.message==="DENIED"?
        "Your privileged audit access is no longer verified. Protected history was cleared.":
        e instanceof Error&&e.message==="Invalid date range"?
          "Choose a valid date range (up to 90 days).":
          "The requested audit history could not be verified. Try refreshing."});
    }finally{if(request===generation.current)setLoading(false);}
  },[applied]);
  useEffect(()=>{
    setTokens([null]);void load(null,0);
    return()=>{++generation.current;++detailGeneration.current;};
  },[load]);
  useEffect(()=>{
    if(!selected)return;
    const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
    detailDialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const onKey=(event:KeyboardEvent)=>{
      if(event.key==="Escape"){++detailGeneration.current;setDetail(null);setSelected(null);return;}
      if(event.key!=="Tab")return;
      const controls=Array.from(detailDialog.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]),a[href]' )??[]).filter(el=>el.getClientRects().length>0);
      if(!controls.length)return;
      if(event.shiftKey&&document.activeElement===controls[0]){
        event.preventDefault();controls[controls.length-1].focus();
      }else if(!event.shiftKey&&document.activeElement===controls[controls.length-1]){
        event.preventDefault();controls[0].focus();
      }
    };
    document.addEventListener("keydown",onKey);
    return()=>{document.removeEventListener("keydown",onKey);previous?.focus();};
  },[selected]);
  function firstPage(){
    setTokens([null]);
    if(source!==applied.source||from!==applied.from||to!==applied.to)
      setApplied({source,from,to});
    else void load(null,0);
  }
  function nextPage(){
    if(!page?.nextCursor||loading||page.coverage!=="COMPLETE")return;
    const next=position+1,token=page.nextCursor;
    setTokens(previous=>[...previous.slice(0,next),token]);
    void load(token,next);
  }
  function previousPage(){
    if(position===0||loading)return;
    const index=position-1;void load(tokens[index],index);
  }
  async function openDetail(event:CG21AuditEvent){
    const current=++detailGeneration.current;setSelected(event);setDetail(null);
    setDetailLoading(true);
    try{
      const item=await get<CG21AuditDetail>(
        "audit/detail/"+encodeURIComponent(event.eventRef));
      if(current!==detailGeneration.current)return;
      if(!item||!["CG-01","CG-21"].includes(item.source)||
        typeof item.actionLabel!=="string"||typeof item.targetDisplay!=="string")
        throw Error("UNAVAILABLE");
      setDetail(item);
    }catch(e){
      if(current!==detailGeneration.current)return;
      setDetail(null);
      setNotice({kind:"error",message:e instanceof Error&&e.message==="DENIED"?
        "Privileged audit access expired. Close this detail and sign in again.":
        "Audit detail could not be verified. No private data was shown."});
    }finally{if(current===detailGeneration.current)setDetailLoading(false);}
  }
  async function exportAudit(){
    if(exporting||loading)return;
    setExporting(true);setNotice(null);
    try{
      const params=new URLSearchParams({source:applied.source});
      const a=dateRange(applied.from,false),z=dateRange(applied.to,true);
      if(a)params.set("from",a);
      if(z)params.set("to",z);
      const data=await get<CG21AuditCsv>("audit/export?"+params);
      if(data.coverage!=="COMPLETE"||typeof data.csv!=="string"||
        data.csv.length>130000||!Number.isInteger(data.rows)||data.rows>100)
        throw Error("UNAVAILABLE");
      const blob=new Blob([data.csv],{type:"text/csv;charset=utf-8"});
      const url=URL.createObjectURL(blob);
      const link=document.createElement("a");link.href=url;
      link.download="careganga-foundation-audit.csv";link.click();
      URL.revokeObjectURL(url);
      setNotice({kind:"success",message:data.truncated?
        "Exported the first 100 authorized events. More records exist; export is capped.":
        "Exported the verified, authorized audit events."});
    }catch(e){
      setNotice({kind:"error",message:e instanceof Error&&e.message==="DENIED"?
        "Audit export is not permitted for the current account.":
        "Audit export could not be verified. No incomplete export was produced."});
    }finally{setExporting(false);}
  }
  return <section className="role-workspace">
    <header className="topbar">
      <div><h1>Audit Logs</h1><p>Foundation access &amp; platform operations</p></div>
      <div className="toolbar">
        <button type="button" disabled={loading} onClick={firstPage}>Refresh records</button>
        <button type="button" disabled={loading||exporting||page?.coverage!=="COMPLETE"}
          onClick={()=>void exportAudit()}>{exporting?"Preparing…":"Export verified CSV"}</button>
      </div>
    </header>
    <div className="kpi-grid">
      <article className="kpi"><small>Visible audit events</small>
        <strong>{page?page.events.length:"—"}</strong><span>Current authorized page</span></article>
      <article className="kpi"><small>Feed coverage</small>
        <strong>{page?.coverage==="COMPLETE"?"Verified":page?.coverage??"—"}</strong>
        <span>CG-01 access + CG-21 operations</span></article>
      <article className="kpi"><small>Records per page</small>
        <strong>{page?.limit??"—"}</strong><span>Foundation current configuration</span></article>
    </div>
    {notice&&<p role={notice.kind==="success"?"status":"alert"}
      className={"notice "+notice.kind}>{notice.message}</p>}
    <form className="toolbar" onSubmit={e=>{e.preventDefault();firstPage();}}>
      <label className="field">Owner source
        <select value={source} onChange={e=>setSource(e.target.value as Scope)}>
          <option value="ALL">Both delivered sources</option>
          <option value="CG-01">Access &amp; roles</option>
          <option value="CG-21">Platform operations</option>
        </select></label>
      <label className="field">From (UTC)<input type="date" value={from}
        onChange={e=>setFrom(e.target.value)}/></label>
      <label className="field">To (UTC)<input type="date" value={to}
        onChange={e=>setTo(e.target.value)}/></label>
      <button type="submit" disabled={loading}>Apply filters</button>
    </form>
    <div className="role-table-wrap"><table className="role-table">
      <thead><tr><th>Date &amp; time</th><th>Source</th><th>Action</th>
        <th>Actor</th><th>Target</th><th>Outcome</th><th>Details</th></tr></thead>
      <tbody>
        {loading?<tr><td colSpan={7}><span className="cg-module-loading" role="status">Verifying authorized audit events…</span></td></tr>:
        page&&!page.events.length?<tr><td colSpan={7}><span className="cg-module-empty" role="status">
          {page.coverage==="COMPLETE"?"No audit events found for this period.":
            "Partial source results. Refresh to verify missing history."}</span></td></tr>:
        page?.events.map(e=><tr key={e.eventRef}>
          <td>{new Date(e.occurredAt).toLocaleString()}</td>
          <td>{e.source}</td><td>{e.actionLabel}</td>
          <td>{e.actorDisplay}</td><td>{e.targetDisplay}</td>
          <td><span className="account-status">{e.outcome}</span></td>
          <td><button type="button" onClick={()=>void openDetail(e)}>
            View detail</button></td>
        </tr>)}
      </tbody>
    </table></div>
    <div className="toolbar">
      <button type="button" disabled={loading||position===0}
        onClick={previousPage}>Previous page</button>
      <span>Page {position+1}</span>
      <button type="button" disabled={loading||!page?.nextCursor||
        page.coverage!=="COMPLETE"} onClick={nextPage}>Next page</button>
    </div>
    {selected&&<div className="drawer-backdrop" role="presentation">
      <section className="role-drawer" role="dialog" aria-modal="true" ref={detailDialog}
        aria-labelledby="audit-details-title">
        <header className="topbar"><div><h2 id="audit-details-title">Audit detail</h2>
          <p>Source-owned, protected event</p></div>
          <button type="button" onClick={()=>{++detailGeneration.current;
            setSelected(null);setDetail(null);}}>Close</button></header>
        {detailLoading?<p className="cg-module-loading" role="status">Verifying event…</p>:detail?
          <dl className="audit-detail">
            <dt>Recorded</dt><dd>{new Date(detail.occurredAt).toLocaleString()}</dd>
            <dt>Source</dt><dd>{detail.source}</dd>
            <dt>Action</dt><dd>{detail.actionLabel}</dd>
            <dt>Actor</dt><dd>{detail.actorDisplay}</dd>
            <dt>Target</dt><dd>{detail.targetDisplay}</dd>
            <dt>Outcome</dt><dd>{detail.outcome}</dd>
          </dl>:<p role="alert">No verified audit detail is available.</p>}
        <p>Secrets, credentials, internal database references and raw payloads are not displayed.</p>
      </section>
    </div>}
  </section>;
}
