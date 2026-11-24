"use client";
import Link from "next/link";
import {useMemo,useState} from "react";
import type {CmsPublicNotice} from "./cms-public-source";

const plain=(s:string)=>s.toLocaleLowerCase();
const types=["All","General","Announcements","Events","Updates","Emergency","Policy"];

/** Public-safe, already independently approved CG19 notice read projection.
 * No staff notices or recipient lists and no copy of CG19 mutable state.
 */
import type {PublicIntro} from "./cms-public-source";
export function CmsPublicNoticeBoard({notices,available,intro}:{
 notices:CmsPublicNotice[];available:boolean;intro?:PublicIntro|null}){
 const [search,setSearch]=useState("");
 const [category,setCategory]=useState("All");
 const [priority,setPriority]=useState("ALL");
 const categories=useMemo(()=>Array.from(new Set(notices
  .map(n=>n.category).filter(Boolean))).sort((a,b)=>a.localeCompare(b)),[notices]);
 const chipCategories=types.slice(1).filter(v=>categories.includes(v));
 const other=categories.filter(v=>!types.includes(v));
 const matches=notices.filter(n=>
  (category==="All"||n.category===category)&&
  (priority==="ALL"||n.priority===priority)&&
  (!search.trim()||[n.title,n.body,n.category].some(v=>
    plain(v).includes(plain(search.trim())))));
 const reset=()=>{setCategory("All");setPriority("ALL");setSearch("");};
 return <section className="cg-site-content cg-site-notices" aria-labelledby="notices-title">
  <div className="cg-site-notice-hero">
   {intro?.eyebrow&&<p className="cg-site-eyebrow">{intro.eyebrow}</p>}
   <h1 id="notices-title">{intro?.heading??"Notice & Announcement Board"}</h1>
   {intro?.body&&<p>{intro.body}</p>}
  </div>
  <div className="cg-site-gallery-filters">
   <label>Search notices
    <input type="search" value={search} maxLength={80}
     onChange={e=>setSearch(e.target.value)}
     placeholder="Search announcements"/>
   </label>
   <label>Priority
    <select value={priority} onChange={e=>setPriority(e.target.value)}>
     <option value="ALL">All priorities</option>
     <option value="IMPORTANT">Important</option>
     <option value="NORMAL">Normal</option>
    </select>
   </label>
   <button type="button" className="cg-site-filter-reset"
    disabled={category==="All"&&priority==="ALL"&&!search}
    onClick={reset}>Reset Filters</button>
  </div>
  <div className="cg-site-gallery-tabs" role="group" aria-label="Notice categories">
   <button type="button" aria-pressed={category==="All"} onClick={()=>setCategory("All")}>
    All notices</button>
   {[...chipCategories,...other].map(v=><button type="button" key={v}
    aria-pressed={category===v} onClick={()=>setCategory(v)}>{v}</button>)}
  </div>
  {!available?<p role="alert" className="cg-site-gallery-empty">
   Current approved notices cannot be verified. Please try again later.</p>:
  <>
   <p className="cg-site-provenance" role="status" aria-live="polite">
    {matches.length} currently approved {matches.length===1?"notice":"notices"} match
   </p>
   {!matches.length?<div className="cg-site-gallery-empty">
    <p>There are no current approved notices matching these filters.</p>
    <button type="button" onClick={reset}>Reset Filters</button></div>:
   <div className="cg-site-notice-list">{matches.map(item=>
    <article key={item.path} className="cg-site-notice-card">
     <div className="cg-site-notice-meta">
      <span>{item.category}</span><span>{item.priority==="IMPORTANT"?"Important":"Normal"}</span>
      <time dateTime={item.publishedOn}>Published {item.publishedOn}</time>
     </div>
     <h2>{item.title}</h2>
     <p>{item.body}</p>
     <Link href={item.path} className="cg-site-notice-link">Read Details</Link>
    </article>)}</div>}
  </>}
 </section>;
}
