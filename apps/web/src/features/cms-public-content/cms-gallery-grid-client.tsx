"use client";
import {useEffect,useMemo,useState} from "react";
import {useSearchParams} from "next/navigation";
type RecordFields=Record<string,unknown>;
type Asset={role:string;altText:string;src:string;order:number};
type GalleryFields={heading:unknown;description:unknown;items:unknown};
const text=(v:unknown)=>typeof v==="string"?v:"";
const records=(v:unknown):RecordFields[]=>Array.isArray(v)?
 v.filter(x=>x&&typeof x==="object"&&!Array.isArray(x)).slice(0,12):[];
/** Public, approved gallery only. Filters are local views over exactly one
 * CG18 effective generation, not invented categories or CG19 private search.
 */
export function CmsGalleryGridClient({fields,assets}:{
 fields:GalleryFields;assets:Asset[]}){
 const params=useSearchParams();
 const requested=params.get("type");
 const initialType=["PHOTO","VIDEO","PUBLICATION"].includes(requested??"")?
  requested!:"ALL";
 const [media,setMedia]=useState(initialType);
 useEffect(()=>{setMedia(initialType);},[initialType]);
 const [category,setCategory]=useState("ALL");
 const [search,setSearch]=useState("");
 const items=records(fields.items);
 const categories=useMemo(()=>Array.from(new Set(items
  .map(x=>text(x.category)).filter(Boolean))).sort((a,b)=>a.localeCompare(b)),[fields.items]);
 const matches=items.map((item,index)=>({item,index})).filter(({item})=>
  (media==="ALL"||item.mediaType===media)&&
  (category==="ALL"||item.category===category)&&
  (!search.trim()||[item.title,item.caption,item.category]
    .some(x=>text(x).toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))));
 return <div className="cg-site-gallery-browser">
  <div className="cg-site-gallery-filters" aria-label="Filter published gallery">
   <div className="cg-site-gallery-tabs" role="group" aria-label="Resource type">
    {([["ALL","All"],["PHOTO","Photos"],["VIDEO","Videos"],
      ["PUBLICATION","Publications"]] as const).map(([value,label])=>
     <button key={value} type="button" aria-pressed={media===value}
      onClick={()=>setMedia(value)}>{label}</button>)}
   </div>
   <label>Category
    <select value={category} onChange={e=>setCategory(e.target.value)}>
     <option value="ALL">All categories</option>
     {categories.map(name=><option value={name} key={name}>{name}</option>)}
    </select>
   </label>
   <label>Search published media
    <input type="search" value={search} maxLength={80}
     onChange={e=>setSearch(e.target.value)} placeholder="Search photos and resources"/>
   </label>
  </div>
  <p className="cg-site-provenance" role="status">{matches.length}
   {" "}approved {matches.length===1?"resource":"resources"} match</p>
  {matches.length===0?<p className="cg-site-gallery-empty">
   No approved media matches these filters. Try another category or search.</p>:
   <div className="cg-site-gallery-grid">{matches.map(({item,index})=>{
    const mediaOrder=Number.isSafeInteger(item.originalIndex)?Number(item.originalIndex):index;
    const original=assets.find(a=>a.role==="GALLERY"&&a.order===mediaOrder);
    if(!original?.src)return null;
    const type=text(item.mediaType);
    return <article className="cg-site-gallery-card" key={index}>
     {type==="PHOTO"?<img src={original.src} alt={original.altText}
      className="cg-site-gallery-photo" loading="lazy"/>:
      type==="VIDEO"?<video src={original.src} controls preload="none"
       aria-label={original.altText}/>:
      type==="PUBLICATION"?<a href={original.src} download
       className="cg-site-action">View approved publication</a>:null}
     <p className="cg-site-eyebrow">{text(item.category)}</p>
     <h2>{text(item.title)}</h2>
     {text(item.caption)&&<p>{text(item.caption)}</p>}
     <p className="cg-site-provenance">Source: {text(item.source)}
      {" · "}{text(item.asOfDate)}</p>
    </article>;
   })}</div>}
 </div>;
}
