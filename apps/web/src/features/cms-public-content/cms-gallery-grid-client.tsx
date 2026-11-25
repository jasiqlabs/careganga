"use client";
import {useMemo,useState} from "react";

type RecordFields=Record<string,unknown>;
type Asset={role:string;altText:string;src:string;order:number};
type GalleryFields={heading:unknown;description:unknown;items:unknown;
 photosEmptyText?:unknown;videosEmptyText?:unknown;publicationsEmptyText?:unknown};
export type CmsMediaType="PHOTO"|"VIDEO"|"PUBLICATION";
const text=(v:unknown)=>typeof v==="string"?v:"";
const records=(v:unknown):RecordFields[]=>Array.isArray(v)?
 v.filter(x=>x&&typeof x==="object"&&!Array.isArray(x)).slice(0,12):[];
const singular:Record<CmsMediaType,string>={PHOTO:"photo",VIDEO:"video",PUBLICATION:"publication"};
const labels:Record<CmsMediaType,string>={
 PHOTO:"photos",VIDEO:"videos",PUBLICATION:"publications"
};

/** Original /gallery, /videos and /publications are distinct public views
 * over one effective CG-18 Gallery revision and real CG-19 cleared originals.
 * Neither filters nor empty results create new or private media records.
 */
export function CmsGalleryGridClient({fields,assets,mediaType="PHOTO"}:{
 fields:GalleryFields;assets:Asset[];mediaType?:CmsMediaType}){
 const [category,setCategory]=useState("ALL");
 const [year,setYear]=useState("ALL");
 const [search,setSearch]=useState("");
 const entries=useMemo(()=>records(fields.items).map((item,index)=>{
  const mediaOrder=Number.isSafeInteger(item.originalIndex)&&Number(item.originalIndex)>=0?
   Number(item.originalIndex):index;
  return {item,index,asset:assets.find(a=>a.role==="GALLERY"&&a.order===mediaOrder)};
 }).filter(({item,asset})=>item.mediaType===mediaType&&Boolean(asset?.src)),
 [fields.items,assets,mediaType]);
 const categories=useMemo(()=>Array.from(new Set(entries.map(({item})=>
  text(item.category)).filter(Boolean))).sort((a,b)=>a.localeCompare(b)),[entries]);
 const years=useMemo(()=>Array.from(new Set(entries.map(({item})=>
  /^\d{4}-\d\d-\d\d$/.test(text(item.asOfDate))?
   text(item.asOfDate).slice(0,4):"").filter(Boolean)))
  .sort((a,b)=>b.localeCompare(a)),[entries]);
 const matches=entries.filter(({item})=>
  (category==="ALL"||item.category===category)&&
  (mediaType!=="PUBLICATION"||year==="ALL"||text(item.asOfDate).startsWith(year+"-"))&&
  (!search.trim()||[item.title,item.caption,item.category]
   .some(x=>text(x).toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))));
 const reset=()=>{setCategory("ALL");setYear("ALL");setSearch("");};
 const emptyKey=mediaType==="VIDEO"?"videosEmptyText":
  mediaType==="PUBLICATION"?"publicationsEmptyText":"photosEmptyText";
 const empty=entries.length===0?(text(fields[emptyKey])||"No approved "+labels[mediaType]+" published yet."):
  "No approved "+labels[mediaType]+" match these filters.";
 return <div className="cg-site-gallery-browser">
  <div className="cg-site-gallery-filters" aria-label={"Filter approved "+labels[mediaType]}>
   <label>Search {labels[mediaType]}
    <input type="search" value={search} maxLength={80}
     onChange={e=>setSearch(e.target.value)}
     placeholder={"Search "+labels[mediaType]}/>
   </label>
   {mediaType==="PUBLICATION"&&<label>Publication year
    <select value={year} onChange={e=>setYear(e.target.value)}>
     <option value="ALL">All years</option>
     {years.map(y=><option value={y} key={y}>{y}</option>)}
    </select>
   </label>}
   <button type="button" className="cg-site-filter-reset" onClick={reset}
    disabled={category==="ALL"&&year==="ALL"&&!search}
    aria-label="Reset media search and filters">Reset Filters</button>
  </div>
  {categories.length>0&&<div className="cg-site-gallery-tabs"
   role="group" aria-label={"Approved "+labels[mediaType]+" categories"}>
   <button type="button" aria-pressed={category==="ALL"}
    onClick={()=>setCategory("ALL")}>All</button>
   {categories.map(name=><button type="button" key={name}
    aria-pressed={category===name} onClick={()=>setCategory(name)}>
     {name}</button>)}
  </div>}
  <p className="cg-site-provenance" role="status" aria-live="polite">
   {matches.length} approved {matches.length===1?
    singular[mediaType]:labels[mediaType]} match
  </p>
  {matches.length===0?<div className="cg-site-gallery-empty">
   <p>{empty}</p>
   <button type="button" onClick={reset}>Reset Filters</button>
  </div>:<div className="cg-site-gallery-grid">{matches.map(({item,index,asset})=>
   <article className="cg-site-gallery-card" key={index}>
    {mediaType==="PHOTO"?<img src={asset!.src} alt={asset!.altText}
     className="cg-site-gallery-photo" loading="lazy"/>:
     mediaType==="VIDEO"?<video src={asset!.src} controls preload="none"
      playsInline aria-label={asset!.altText}/>:
     <a href={asset!.src} download className="cg-site-action">
      View approved publication</a>}
    <p className="cg-site-eyebrow">{text(item.category)}</p>
    <h2>{text(item.title)}</h2>
    {text(item.caption)&&<p>{text(item.caption)}</p>}
    <p className="cg-site-provenance">Source: {text(item.source)}
     {" · "}{text(item.asOfDate)}</p>
   </article>)}</div>}
 </div>;
}
