"use client";
import "./audit-logs.css";
import {useCallback,useEffect,useRef,useState} from "react";
import {motion,AnimatePresence,useReducedMotion} from "framer-motion";
import type {
  CG21AuditPage,CG21AuditEvent,CG21AuditDetail,CG21AuditCsv
} from "@careganga/api-contracts";

function RotateCwIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </svg>
  );
}

function DownloadIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function LayersIcon({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

function ShieldCheckIcon({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function ShieldAlertIcon({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function ListIcon({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function FilterIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

function RotateCcwIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

function SearchIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function ChevronDownIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function EyeIcon({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function CheckCircleIcon({ size = 12, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function ChevronLeftIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRightIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function XIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function formatDateTime(iso: string): { date: string; time: string } {
  try {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return { date: iso, time: "" };
    const datePart = d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "numeric",
      day: "numeric"
    }) + ",";
    const timePart = d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    });
    return { date: datePart, time: timePart };
  } catch {
    return { date: iso, time: "" };
  }
}

function getOutcomeBadge(outcome: string) {
  const norm = (outcome || "").toUpperCase();
  if (norm.includes("CONFIRMED") || norm.includes("SUCCESS")) {
    return (
      <span className="cg-audit-outcome-badge confirmed">
        <CheckCircleIcon size={12} />
        <span>Confirmed</span>
      </span>
    );
  }
  if (norm.includes("UNAVAILABLE")) {
    return (
      <span className="cg-audit-outcome-badge unavailable">
        <span>Unavailable</span>
      </span>
    );
  }
  if (norm.includes("DENIED")) {
    return (
      <span className="cg-audit-outcome-badge denied">
        <span>Denied</span>
      </span>
    );
  }
  return (
    <span className="cg-audit-outcome-badge pending">
      <span>{outcome || "Pending"}</span>
    </span>
  );
}

type FeedCoverageInfo = {
  status: "Verified" | "Partial" | "Unavailable" | "Verifying…";
  subtext: string;
  tone: "green" | "amber" | "red" | "neutral";
};

function getFeedCoverage(page: CG21AuditPage | null, loading: boolean): FeedCoverageInfo {
  if (loading && !page) {
    return {
      status: "Verifying…",
      subtext: "Checking delivered sources",
      tone: "neutral"
    };
  }
  if (!page) {
    return {
      status: "Unavailable",
      subtext: "Sources unreachable",
      tone: "red"
    };
  }
  const unavailableCount = page.unavailableSources?.length ?? 0;
  if (page.coverage === "COMPLETE" && unavailableCount === 0) {
    return {
      status: "Verified",
      subtext: "CG-01 access + CG-21 operations",
      tone: "green"
    };
  }
  if (page.coverage === "PARTIAL" || unavailableCount === 1) {
    const missing = page.unavailableSources?.length ? page.unavailableSources.join(", ") : "1 source";
    return {
      status: "Partial",
      subtext: `Unavailable: ${missing}`,
      tone: "amber"
    };
  }
  return {
    status: "Unavailable",
    subtext: "Both sources unavailable",
    tone: "red"
  };
}
type Scope="ALL"|"CG-01"|"CG-21"|"PAYROLL";
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
function AuditTableSkeleton({ count = 5 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, idx) => (
        <tr key={`skel-row-${idx}`} className="cg-skeleton-row" aria-hidden="true">
          <td>
            <div className="cg-audit-time-cell">
              <span className="cg-skeleton cg-skeleton-line" style={{ width: "5.5rem", height: "0.8125rem", marginBottom: "0.2rem" }} />
              <span className="cg-skeleton cg-skeleton-line" style={{ width: "3.75rem", height: "0.75rem" }} />
            </div>
          </td>
          <td>
            <span className="cg-skeleton cg-skeleton-badge" style={{ width: "3.25rem", height: "1.25rem" }} />
          </td>
          <td>
            <span className="cg-skeleton cg-skeleton-line" style={{ width: "8.5rem", height: "0.875rem" }} />
          </td>
          <td>
            <span className="cg-skeleton cg-skeleton-line" style={{ width: "7rem", height: "0.875rem" }} />
          </td>
          <td>
            <span className="cg-skeleton cg-skeleton-line" style={{ width: "12rem", height: "0.875rem" }} />
          </td>
          <td>
            <span className="cg-skeleton cg-skeleton-pill" style={{ width: "4.75rem", height: "1.375rem" }} />
          </td>
          <td>
            <span className="cg-skeleton cg-skeleton-button" style={{ width: "3.5rem", height: "1.875rem" }} />
          </td>
        </tr>
      ))}
    </>
  );
}

function AuditMobileCardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, idx) => (
        <article key={`skel-card-${idx}`} className="cg-audit-mobile-card cg-skeleton-card" aria-hidden="true">
          <div className="cg-audit-mobile-header">
            <div className="cg-audit-time-cell">
              <span className="cg-skeleton cg-skeleton-line" style={{ width: "5.5rem", height: "0.8125rem", marginBottom: "0.2rem" }} />
              <span className="cg-skeleton cg-skeleton-line" style={{ width: "3.5rem", height: "0.75rem" }} />
            </div>
            <span className="cg-skeleton cg-skeleton-badge" style={{ width: "3.25rem", height: "1.25rem" }} />
          </div>
          <div className="cg-audit-mobile-body">
            <span className="cg-skeleton cg-skeleton-line" style={{ width: "9rem", height: "0.9375rem", marginBottom: "0.25rem" }} />
            <div className="cg-audit-mobile-row">
              <span className="cg-skeleton cg-skeleton-line" style={{ width: "3rem", height: "0.8125rem" }} />
              <span className="cg-skeleton cg-skeleton-line" style={{ width: "7rem", height: "0.8125rem" }} />
            </div>
            <div className="cg-audit-mobile-row">
              <span className="cg-skeleton cg-skeleton-line" style={{ width: "3rem", height: "0.8125rem" }} />
              <span className="cg-skeleton cg-skeleton-line" style={{ width: "11rem", height: "0.8125rem" }} />
            </div>
          </div>
          <div className="cg-audit-mobile-footer">
            <span className="cg-skeleton cg-skeleton-pill" style={{ width: "4.75rem", height: "1.375rem" }} />
            <span className="cg-skeleton cg-skeleton-button" style={{ width: "4rem", height: "2.75rem" }} />
          </div>
        </article>
      ))}
    </>
  );
}

export type PlatformAuditPanelProps = {
  canManageSettings?: boolean;
  initialPayroll?: boolean;
};

export function PlatformAuditPanel({ canManageSettings = false, initialPayroll=false }: PlatformAuditPanelProps){
  const [page,setPage]=useState<CG21AuditPage|null>(null);
  const [loading,setLoading]=useState(true);
  const [source,setSource]=useState<Scope>(initialPayroll?"PAYROLL":"ALL");
  const [from,setFrom]=useState("");
  const [to,setTo]=useState("");
  const [searchQuery,setSearchQuery]=useState("");
  const [appliedSearch,setAppliedSearch]=useState("");
  const [customLimit,setCustomLimit]=useState<number|undefined>(undefined);
  const [applied,setApplied]=useState<{source:Scope;from:string;to:string}>({
    source:initialPayroll?"PAYROLL":"ALL",from:"",to:""
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
  const load=useCallback(async(cursor:string|null=null,nextPosition=0,limitOverride?:number|null)=>{
    const request=++generation.current;
    ++detailGeneration.current;setDetail(null);setSelected(null);
    setLoading(true);setNotice(null);
    try{
      const params=new URLSearchParams();
      if(cursor){
        params.set("cursor",cursor);
      }else{
        params.set("source",applied.source==="PAYROLL"?"CG-21":applied.source);
        if(applied.source==="PAYROLL")params.set("category","PAYROLL");
        const fromIso=dateRange(applied.from,false),toIso=dateRange(applied.to,true);
        if(fromIso)params.set("from",fromIso);
        if(toIso)params.set("to",toIso);
        if(fromIso&&toIso&&fromIso>toIso)throw Error("Invalid date range");
        const activeLimit=limitOverride===null?undefined:(limitOverride??customLimit);
        if(activeLimit&&activeLimit>=1&&activeLimit<=100)params.set("limit",String(activeLimit));
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
  },[applied,customLimit]);
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
    setAppliedSearch(searchQuery.trim());
    if(source!==applied.source||from!==applied.from||to!==applied.to)
      setApplied({source,from,to});
    else void load(null,0,customLimit);
  }
  function resetFilters(){
    setSource("ALL");
    setFrom("");
    setTo("");
    setSearchQuery("");
    setAppliedSearch("");
    setCustomLimit(undefined);
    setTokens([null]);
    if(applied.source!=="ALL"||applied.from!==""||applied.to!==""){
      setApplied({source:"ALL",from:"",to:""});
    }else{
      void load(null,0,null);
    }
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
      const params=new URLSearchParams({source:applied.source==="PAYROLL"?"CG-21":applied.source});
      if(applied.source==="PAYROLL")params.set("category","PAYROLL");
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
  const shouldReduceMotion = useReducedMotion();
  const reduceMotion = Boolean(shouldReduceMotion);
  const isInitialLoading = loading && !page;
  const coverageInfo = getFeedCoverage(page, loading);
  const filteredEvents = (page?.events ?? []).filter(e => {
    if (!appliedSearch) return true;
    const term = appliedSearch.toLowerCase();
    return (
      e.actionLabel.toLowerCase().includes(term) ||
      e.actorDisplay.toLowerCase().includes(term) ||
      e.targetDisplay.toLowerCase().includes(term) ||
      e.source.toLowerCase().includes(term) ||
      e.outcome.toLowerCase().includes(term)
    );
  });
  const configuredLimit = page?.limit ?? 25;
  const pageSize = customLimit ?? configuredLimit;
  const defaultPageSizes = [10, 25, 50, 100];
  const pageSizeOptions = Array.from(new Set([...defaultPageSizes, configuredLimit])).sort((a, b) => a - b);
  const startRecord = filteredEvents.length > 0 ? position * pageSize + 1 : 0;
  const endRecord = position * pageSize + filteredEvents.length;
  const paginationRangeText =
    filteredEvents.length === 0
      ? "No visible events"
      : `Showing events ${startRecord}–${endRecord}`;
  return <section className="cg-audit-page">
    <header className="cg-audit-header">
      <div className="cg-audit-header-left">
        <div className="cg-audit-title-row">
          <h1 className="cg-audit-title">Audit Logs</h1>
          <span className="cg-audit-verified-badge" aria-hidden="true" title="Verified audit stream">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
        </div>
        <p className="cg-audit-subtitle">Foundation access &amp; platform operations</p>
      </div>
      <div className="cg-audit-header-actions">
        <button
          type="button"
          className="cg-audit-btn-secondary"
          disabled={loading}
          onClick={firstPage}
          title="Refresh audit records"
          aria-busy={loading}
        >
          <RotateCwIcon size={16} className={loading ? "cg-spin" : ""} />
          <span>{loading ? "Refreshing…" : "Refresh"}</span>
        </button>
        <button
          type="button"
          className="cg-audit-btn-secondary"
          disabled={loading || exporting || page?.coverage !== "COMPLETE"}
          onClick={() => void exportAudit()}
          title="Export verified audit CSV"
          aria-busy={exporting}
        >
          {exporting ? (
            <RotateCwIcon size={16} className="cg-spin" />
          ) : (
            <DownloadIcon size={16} />
          )}
          <span>{exporting ? "Preparing…" : "Export CSV"}</span>
        </button>
      </div>
    </header>

    <div className="cg-audit-kpi-grid">
      <motion.article
        className="cg-audit-kpi-card"
        initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: reduceMotion ? 0 : 0.05, ease: "easeOut" }}
      >
        {isInitialLoading ? (
          <>
            <div className="cg-skeleton cg-skeleton-kpi-icon" aria-hidden="true" />
            <div className="cg-audit-kpi-content">
              <span className="cg-skeleton" style={{ width: "5rem", height: "0.875rem", marginBottom: "0.35rem" }} />
              <span className="cg-skeleton" style={{ width: "3.5rem", height: "1.75rem" }} />
            </div>
          </>
        ) : (
          <>
            <div className="cg-audit-kpi-icon-wrap blue" aria-hidden="true">
              <LayersIcon size={24} />
            </div>
            <div className="cg-audit-kpi-content">
              <span className="cg-audit-kpi-label">Visible events</span>
              <span className="cg-audit-kpi-value">{page ? filteredEvents.length : "—"}</span>
            </div>
          </>
        )}
      </motion.article>

      <motion.article
        className="cg-audit-kpi-card"
        initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: reduceMotion ? 0 : 0.1, ease: "easeOut" }}
      >
        {isInitialLoading ? (
          <>
            <div className="cg-skeleton cg-skeleton-kpi-icon" aria-hidden="true" />
            <div className="cg-audit-kpi-content">
              <span className="cg-skeleton" style={{ width: "5.5rem", height: "0.875rem", marginBottom: "0.35rem" }} />
              <span className="cg-skeleton" style={{ width: "5rem", height: "1.75rem", marginBottom: "0.35rem" }} />
              <span className="cg-skeleton" style={{ width: "10rem", height: "0.75rem" }} />
            </div>
          </>
        ) : (
          <>
            <div className={`cg-audit-kpi-icon-wrap ${coverageInfo.tone}`} aria-hidden="true">
              {coverageInfo.tone === "green" ? (
                <ShieldCheckIcon size={24} />
              ) : (
                <ShieldAlertIcon size={24} />
              )}
            </div>
            <div className="cg-audit-kpi-content">
              <span className="cg-audit-kpi-label">Feed coverage</span>
              <span className={`cg-audit-kpi-value ${coverageInfo.tone}`}>
                {coverageInfo.status}
              </span>
              <span className="cg-audit-kpi-subtext">{coverageInfo.subtext}</span>
            </div>
          </>
        )}
      </motion.article>

      <motion.article
        className="cg-audit-kpi-card"
        initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: reduceMotion ? 0 : 0.15, ease: "easeOut" }}
      >
        {isInitialLoading ? (
          <>
            <div className="cg-skeleton cg-skeleton-kpi-icon" aria-hidden="true" />
            <div className="cg-audit-kpi-content">
              <span className="cg-skeleton" style={{ width: "4.5rem", height: "0.875rem", marginBottom: "0.35rem" }} />
              <span className="cg-skeleton" style={{ width: "4rem", height: "1.75rem", marginBottom: "0.35rem" }} />
              <span className="cg-skeleton" style={{ width: "8rem", height: "0.75rem" }} />
            </div>
          </>
        ) : (
          <>
            <div className="cg-audit-kpi-icon-wrap indigo" aria-hidden="true">
              <ListIcon size={24} />
            </div>
            <div className="cg-audit-kpi-content">
              <span className="cg-audit-kpi-label">Page size</span>
              <span className="cg-audit-kpi-value">{page ? `${page.limit} rows` : "—"}</span>
              <span className="cg-audit-kpi-subtext">Current configuration</span>
            </div>
          </>
        )}
      </motion.article>
    </div>

    <AnimatePresence mode="wait">
      {notice && (
        <motion.p
          key={notice.message}
          role={notice.kind === "success" ? "status" : "alert"}
          className={`cg-audit-notice ${notice.kind}`}
          initial={{ opacity: 0, y: reduceMotion ? 0 : -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduceMotion ? 0 : -6 }}
          transition={{ duration: 0.2 }}
        >
          {notice.message}
        </motion.p>
      )}
    </AnimatePresence>

    <div className="cg-audit-filter-card">
      <form className="cg-audit-filter-form" onSubmit={e => { e.preventDefault(); firstPage(); }}>
        <div className="cg-audit-field-group source">
          <label htmlFor="audit-filter-source" className="cg-audit-label">Owner source</label>
          <div className="cg-audit-select-wrap">
            <select
              id="audit-filter-source"
              className="cg-audit-select"
              value={source}
              onChange={e => setSource(e.target.value as Scope)}
            >
              <option value="ALL">Both delivered sources</option>
              <option value="CG-01">Access &amp; roles</option>
              <option value="CG-21">Platform operations</option>
              <option value="PAYROLL">Payroll audit trail</option>
            </select>
            <span className="cg-audit-select-arrow" aria-hidden="true">
              <ChevronDownIcon size={16} />
            </span>
          </div>
        </div>

        <div className="cg-audit-field-group date">
          <label htmlFor="audit-filter-from" className="cg-audit-label">From date</label>
          <input
            id="audit-filter-from"
            type="date"
            className="cg-audit-date-input"
            value={from}
            onChange={e => setFrom(e.target.value)}
            aria-label="From date (UTC)"
          />
        </div>

        <div className="cg-audit-field-group date">
          <label htmlFor="audit-filter-to" className="cg-audit-label">To date</label>
          <input
            id="audit-filter-to"
            type="date"
            className="cg-audit-date-input"
            value={to}
            onChange={e => setTo(e.target.value)}
            aria-label="To date (UTC)"
          />
        </div>

        <div className="cg-audit-field-group search">
          <label htmlFor="audit-filter-search" className="sr-only">Search actor, action, target</label>
          <div className="cg-audit-search-wrap">
            <span className="cg-audit-search-icon" aria-hidden="true">
              <SearchIcon size={16} />
            </span>
            <input
              id="audit-filter-search"
              type="text"
              className="cg-audit-search-input"
              placeholder="Search actor, action, target..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="cg-audit-filter-actions">
          <button
            type="submit"
            className="cg-audit-btn-apply"
            disabled={loading}
            title="Apply filters"
            aria-busy={loading}
          >
            {loading ? (
              <RotateCwIcon size={16} className="cg-spin" />
            ) : (
              <FilterIcon size={16} />
            )}
            <span>{loading ? "Applying…" : "Apply filters"}</span>
          </button>
          <button
            type="button"
            className="cg-audit-btn-reset"
            disabled={loading || (source === "ALL" && !from && !to && !searchQuery && !appliedSearch && customLimit === undefined)}
            onClick={resetFilters}
            title="Reset filters"
          >
            <RotateCcwIcon size={15} />
            <span>Reset</span>
          </button>
        </div>
      </form>
    </div>

    {/* Desktop Table View */}
    <div className="cg-audit-table-card cg-audit-desktop-table" aria-busy={loading}>
      <div className="cg-audit-table-wrap" role="region" aria-label="Audit logs table" tabIndex={0}>
        <table className="cg-audit-table">
          <thead>
            <tr>
              <th scope="col">Date &amp; time</th>
              <th scope="col">Source</th>
              <th scope="col">Action</th>
              <th scope="col">Actor</th>
              <th scope="col">Target</th>
              <th scope="col">Outcome</th>
              <th scope="col">Details</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <AuditTableSkeleton count={5} />
            ) : page && !filteredEvents.length ? (
              <tr>
                <td colSpan={7} className="cg-audit-empty-row">
                  <span className="cg-module-empty" role="status">
                    {appliedSearch
                      ? "No audit events match your search criteria."
                      : page.coverage === "COMPLETE"
                      ? "No audit events found for this period."
                      : "Partial source results. Refresh to verify missing history."}
                  </span>
                </td>
              </tr>
            ) : (
              filteredEvents.map(e => {
                const timeInfo = formatDateTime(e.occurredAt);
                return (
                  <motion.tr
                    key={e.eventRef}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.15 }}
                  >
                    <td>
                      <div className="cg-audit-time-cell">
                        <span className="cg-audit-time-date">{timeInfo.date}</span>
                        <span className="cg-audit-time-clock">{timeInfo.time}</span>
                      </div>
                    </td>
                    <td>
                      <span className="cg-audit-source-badge">{e.source}</span>
                    </td>
                    <td>
                      <div className="cg-audit-action-cell">{e.actionLabel}</div>
                    </td>
                    <td>
                      <div className="cg-audit-actor-cell">{e.actorDisplay}</div>
                    </td>
                    <td>
                      <div className="cg-audit-target-cell">{e.targetDisplay}</div>
                    </td>
                    <td>
                      {getOutcomeBadge(e.outcome)}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="cg-audit-view-btn"
                        onClick={() => void openDetail(e)}
                        title={`View detail for ${e.actionLabel}`}
                      >
                        <EyeIcon size={14} />
                        <span>View</span>
                      </button>
                    </td>
                  </motion.tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>

    {/* Mobile Cards View */}
    <div className="cg-audit-mobile-cards" aria-busy={loading}>
      {loading ? (
        <AuditMobileCardSkeleton count={3} />
      ) : page && !filteredEvents.length ? (
        <div className="cg-audit-table-card">
          <div className="cg-audit-empty-row">
            <span className="cg-module-empty" role="status">
              {appliedSearch
                ? "No audit events match your search criteria."
                : page.coverage === "COMPLETE"
                ? "No audit events found for this period."
                : "Partial source results. Refresh to verify missing history."}
            </span>
          </div>
        </div>
      ) : (
        filteredEvents.map(e => {
          const timeInfo = formatDateTime(e.occurredAt);
          return (
            <motion.article
              key={e.eventRef}
              className="cg-audit-mobile-card"
              initial={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="cg-audit-mobile-header">
                <div className="cg-audit-time-cell">
                  <span className="cg-audit-time-date">{timeInfo.date}</span>
                  <span className="cg-audit-time-clock">{timeInfo.time}</span>
                </div>
                <span className="cg-audit-source-badge">{e.source}</span>
              </div>
              <div className="cg-audit-mobile-body">
                <div className="cg-audit-mobile-action">{e.actionLabel}</div>
                <div className="cg-audit-mobile-row">
                  <strong>Actor:</strong>
                  <span>{e.actorDisplay}</span>
                </div>
                <div className="cg-audit-mobile-row">
                  <strong>Target:</strong>
                  <span>{e.targetDisplay}</span>
                </div>
              </div>
              <div className="cg-audit-mobile-footer">
                <div>{getOutcomeBadge(e.outcome)}</div>
                <button
                  type="button"
                  className="cg-audit-view-btn"
                  onClick={() => void openDetail(e)}
                  title={`View detail for ${e.actionLabel}`}
                >
                  <EyeIcon size={14} />
                  <span>View</span>
                </button>
              </div>
            </motion.article>
          );
        })
      )}
    </div>

    {/* Dedicated Pagination Footer */}
    <div className="cg-audit-pagination" role="navigation" aria-label="Audit log pagination" aria-busy={loading}>
      <div className="cg-audit-pagination-info">
        <span>{paginationRangeText}</span>
      </div>
      <div className="cg-audit-pagination-controls">
        <div className="cg-audit-page-size-wrap">
          <span className="cg-audit-label">Rows per page:</span>
          <div className="cg-audit-page-size-container">
            <select
              className="cg-audit-page-size-select"
              value={pageSize}
              onChange={e => {
                const newSize = Number(e.target.value);
                setCustomLimit(newSize);
                setTokens([null]);
                void load(null, 0, newSize);
              }}
              disabled={loading}
              aria-label="Rows per page"
            >
              {pageSizeOptions.map(size => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <span className="cg-audit-page-size-arrow" aria-hidden="true">
              <ChevronDownIcon size={12} />
            </span>
          </div>
        </div>

        <span className="cg-audit-page-indicator">
          Page {position + 1}
        </span>

        <div className="cg-audit-pagination-btns">
          <button
            type="button"
            className="cg-audit-page-btn"
            disabled={loading || position === 0}
            onClick={previousPage}
            title="Go to previous page"
            aria-busy={loading}
          >
            <ChevronLeftIcon size={15} />
            <span>Previous</span>
          </button>
          <button
            type="button"
            className="cg-audit-page-btn"
            disabled={loading || !page?.nextCursor || page?.coverage !== "COMPLETE"}
            onClick={nextPage}
            title="Go to next page"
            aria-busy={loading}
          >
            <span>Next</span>
            <ChevronRightIcon size={15} />
          </button>
        </div>
      </div>
    </div>

    {/* Detail Drawer */}
    <AnimatePresence>
      {selected && (
        <motion.div
          className="cg-audit-drawer-backdrop"
          role="presentation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={e => {
            if (e.target === e.currentTarget) {
              ++detailGeneration.current;
              setSelected(null);
              setDetail(null);
            }
          }}
        >
          <motion.section
            className="cg-audit-drawer"
            role="dialog"
            aria-modal="true"
            ref={detailDialog}
            aria-labelledby="audit-details-title"
            initial={{ x: reduceMotion ? 0 : "100%" }}
            animate={{ x: 0 }}
            exit={{ x: reduceMotion ? 0 : "100%" }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <header className="cg-audit-drawer-header">
              <div>
                <h2 id="audit-details-title" className="cg-audit-drawer-title">Audit detail</h2>
                <p className="cg-audit-drawer-subtitle">Source-owned, protected event</p>
              </div>
              <button
                type="button"
                className="cg-audit-drawer-close"
                onClick={() => {
                  ++detailGeneration.current;
                  setSelected(null);
                  setDetail(null);
                }}
                aria-label="Close audit detail"
                title="Close"
              >
                <XIcon size={16} />
              </button>
            </header>
            <div className="cg-audit-drawer-body">
              {detailLoading ? (
                <div className="cg-skeleton-drawer-body" aria-hidden="true">
                  <dl className="cg-audit-detail-list">
                    <dt><span className="cg-skeleton" style={{ width: "4rem", height: "0.875rem" }} /></dt>
                    <dd><span className="cg-skeleton" style={{ width: "9rem", height: "0.875rem" }} /></dd>
                    <dt><span className="cg-skeleton" style={{ width: "3.5rem", height: "0.875rem" }} /></dt>
                    <dd><span className="cg-skeleton cg-skeleton-badge" style={{ width: "3.25rem", height: "1.25rem" }} /></dd>
                    <dt><span className="cg-skeleton" style={{ width: "3.5rem", height: "0.875rem" }} /></dt>
                    <dd><span className="cg-skeleton" style={{ width: "12rem", height: "0.875rem" }} /></dd>
                    <dt><span className="cg-skeleton" style={{ width: "3rem", height: "0.875rem" }} /></dt>
                    <dd><span className="cg-skeleton" style={{ width: "8rem", height: "0.875rem" }} /></dd>
                    <dt><span className="cg-skeleton" style={{ width: "3.5rem", height: "0.875rem" }} /></dt>
                    <dd><span className="cg-skeleton" style={{ width: "14rem", height: "0.875rem" }} /></dd>
                    <dt><span className="cg-skeleton" style={{ width: "4rem", height: "0.875rem" }} /></dt>
                    <dd><span className="cg-skeleton cg-skeleton-pill" style={{ width: "4.75rem", height: "1.375rem" }} /></dd>
                  </dl>
                </div>
              ) : detail ? (
                <dl className="cg-audit-detail-list">
                  <dt>Recorded</dt>
                  <dd>{new Date(detail.occurredAt).toLocaleString()}</dd>
                  <dt>Source</dt>
                  <dd>
                    <span className="cg-audit-source-badge">{detail.source}</span>
                  </dd>
                  <dt>Action</dt>
                  <dd>{detail.actionLabel}</dd>
                  <dt>Actor</dt>
                  <dd>{detail.actorDisplay}</dd>
                  <dt>Target</dt>
                  <dd>{detail.targetDisplay}</dd>
                  <dt>Outcome</dt>
                  <dd>{getOutcomeBadge(detail.outcome)}</dd>
                </dl>
              ) : (
                <p role="alert">No verified audit detail is available.</p>
              )}
              <p className="cg-audit-drawer-note">
                Secrets, credentials, internal database references and raw payloads are not displayed.
              </p>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  </section>;
}
