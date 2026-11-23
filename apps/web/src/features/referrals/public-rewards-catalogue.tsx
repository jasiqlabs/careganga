"use client";
import {useCallback,useEffect,useMemo,useRef,useState} from "react";

type Reward={
 ref:string;programmeRef:string;type:"DIGITAL"|"PHYSICAL";category:string;
 name:string;description:string;pointsPrice:string;imageUrl:string|null;
 availability:"NO_STOCK_REQUIRED"|"AVAILABLE"|"OUT_OF_STOCK";highlighted:boolean;
};
type Page={eligibleRelationships:string[];items:Reward[];hasMore:boolean;page:number;notice:string;
 categories:string[];categoriesTruncated:boolean};

/** Existing authenticated CG04 self-service only. No wallet/redemption until US002/003. */
export function PublicRewardsCatalogue(){
 const [items,setItems]=useState<Reward[]>([]);
 const [audiences,setAudiences]=useState<string[]>([]);
 const [notice,setNotice]=useState("");
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(true),[more,setMore]=useState(false),[page,setPage]=useState(2);
 const [category,setCategory]=useState("All"),[search,setSearch]=useState("");
 const [appliedSearch,setAppliedSearch]=useState("");
 const [availableCategories,setAvailableCategories]=useState<string[]>([]);
 const [categoriesTruncated,setCategoriesTruncated]=useState(false);
 useEffect(()=>{
  const handle=setTimeout(()=>setAppliedSearch(search.trim()),300);
  return()=>clearTimeout(handle);
 },[search]);
 const [failedImages,setFailedImages]=useState<Record<string,true>>({});
 const latest=useRef(0);
 const load=useCallback(async (target:number,replace:boolean)=>{
  const serial=++latest.current;
  setLoading(true);setError("");
  if(replace){setItems([]);setMore(false);}
  try{
   const params=new URLSearchParams({page:String(target)});
   if(appliedSearch)params.set("q",appliedSearch);
   if(category!=="All")params.set("category",category);
   const r=await fetch("/api/referrals/my-catalog?"+params.toString(),{
    credentials:"same-origin",cache:"no-store",signal:AbortSignal.timeout(15000)});
   if(!r.ok)throw new Error(r.status===401?"Sign in to view your eligible rewards.":
    r.status===403?"This account cannot access the rewards catalogue.":
    "Reward information is unavailable. Refresh when the service is available.");
   const data=await r.json() as Page;
   if(!Array.isArray(data.items)||!Array.isArray(data.eligibleRelationships)||
    !Array.isArray(data.categories)||!data.categories.every(c=>typeof c==="string")||
    typeof data.hasMore!=="boolean"||typeof data.categoriesTruncated!=="boolean")
    throw new Error("Reward information is unavailable.");
   if(serial!==latest.current)return;
   if(replace)setFailedImages({});
   setAudiences(data.eligibleRelationships);
   setAvailableCategories(data.categories);setCategoriesTruncated(data.categoriesTruncated);
   setNotice(data.notice);
   setItems(old=>replace?data.items:[...old,...data.items.filter(x=>!old.some(p=>p.ref===x.ref))]);
   setMore(data.hasMore);setPage(target+1);
  }catch(e){
   if(serial===latest.current){
    if(replace){setItems([]);setMore(false);setAudiences([]);
     setAvailableCategories([]);setCategoriesTruncated(false);}
    setError(e instanceof Error?e.message:"Reward information is unavailable.");
   }
  }finally{if(serial===latest.current)setLoading(false);}
 },[appliedSearch,category]);
 useEffect(()=>{
  void load(1,true);
  const onVisibility=()=>{
   if(document.visibilityState!=="visible"){
    latest.current++;setItems([]);setAudiences([]);setMore(false);
    setAvailableCategories([]);setCategoriesTruncated(false);
   }else void load(1,true);
  };
  document.addEventListener("visibilitychange",onVisibility);
  return()=>{latest.current++;document.removeEventListener("visibilitychange",onVisibility);};
 },[load]);
 const categories=useMemo(()=>["All",...new Set(availableCategories)],[availableCategories]);
 const shown=useMemo(()=>items.filter(p=>
  (category==="All"||p.category===category)&&
  (p.name+" "+p.category+" "+p.description).toLowerCase().includes(appliedSearch.toLowerCase())),
  [items,category,appliedSearch]);
 return <section className="cg04-panel" aria-label="Your eligible rewards">
  <div className="cg04-buttons" style={{justifyContent:"space-between",alignItems:"center"}}>
   <div><h2 style={{margin:"0 0 5px"}}>Rewards catalogue</h2>
    <p style={{margin:0}}>Browse rewards offered to eligible members and volunteers.
     Points are not money; redemption is not available yet.</p></div>
   <button type="button" disabled={loading} onClick={()=>void load(1,true)}>Refresh rewards</button>
  </div>
  {loading&&<p role="status">Checking the current rewards catalogue…</p>}
  {error&&<p role="alert">{error}</p>}
  {!error&&!!notice&&<p role="status">{notice}</p>}
  {!!audiences.length&&<>
   <div className="cg04-buttons" aria-label="Reward category filter">
    {categories.map(c=><button key={c} type="button" aria-pressed={category===c}
     onClick={()=>setCategory(c)}>{c}</button>)}
   </div>
   {categoriesTruncated&&<p>More categories are available. Search the full catalogue
    to find additional eligible reward products.</p>}
   <label>Search available rewards
    <input type="search" value={search} onChange={e=>setSearch(e.target.value)}
     maxLength={100} placeholder="Product name or category"/>
   </label>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(100%,230px),1fr))",gap:12}}>
    {shown.map(p=><article key={p.ref} style={{border:"1px solid #d8e4df",borderRadius:12,padding:12}}>
     {p.imageUrl&&!failedImages[p.ref]&&<img src={p.imageUrl} loading="lazy"
      referrerPolicy="no-referrer" alt={p.name}
      onError={()=>setFailedImages(old=>({...old,[p.ref]:true}))}
      style={{width:"100%",maxHeight:160,objectFit:"contain"}}/>}
     <h3 style={{margin:"8px 0"}}>{p.name}</h3>
     <p>{p.category} · {p.type==="DIGITAL"?"Digital":"Physical"} · {p.pointsPrice} points</p>
     <p>{p.type==="DIGITAL"?"No stock required":
      p.availability==="AVAILABLE"?"In stock":"Currently unavailable"}</p>
     <details><summary>Product details</summary><p>{p.description||"No description provided."}</p>
      <p>Reward requests will be available after verified referral points and fulfilment are enabled.</p>
     </details>
    </article>)}
   </div>
   {!shown.length&&!loading&&<p>No rewards match this filter.</p>}
   {more&&<button type="button" disabled={loading} onClick={()=>void load(page,false)}>Load more rewards</button>}
  </>}
  {!audiences.length&&!loading&&!error&&<p>Rewards become visible after your eligible
   membership or volunteer relationship is active.</p>}
 </section>;
}
