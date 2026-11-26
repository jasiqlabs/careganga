"use client";
import Link from "next/link";
import {useState, useEffect, useRef} from "react";
import type {PublicCmsNavigation} from "./cms-public-source";
import {effectiveCmsCtaRoute} from "./cms-cta-route";
import type {PublicCmsSection,PublicCmsPage} from "./cms-public-page";

type Asset=PublicCmsPage["assets"][number];
type Slide={section:PublicCmsSection;hero?:Asset;mobile?:Asset};
const text=(v:unknown)=>typeof v==="string"?v:"";
const safeColor=(v:unknown)=>/^#[a-fA-F0-9]{6}$/.test(text(v))?text(v):undefined;

function Button({label,href,secondary=false,navigation}:{label:unknown;href:unknown;secondary?:boolean;navigation?:PublicCmsNavigation|null}){
 const target=effectiveCmsCtaRoute(href,navigation);
 const labelStr=text(label);
 if(!target||!labelStr)return null;
 const isDonate=target==="/donate"||labelStr.toLowerCase().includes("donate");
 return <Link className={isDonate?"cg-site-hero-cta cg-site-hero-donate":(secondary?"cg-site-hero-cta is-secondary":"cg-site-hero-cta")}
  href={target}>
  {isDonate&&<span className="cg-hero-heart" aria-hidden="true">♥ </span>}
  {labelStr}
 </Link>;
}

export function CmsHeroCarousel({slides,navigation}:{slides:Slide[];navigation?:PublicCmsNavigation|null}){
 const [active,setActive]=useState(0);
 const [isPaused,setIsPaused]=useState(false);

 useEffect(()=>{
  if(slides.length<=1||isPaused)return;
  const timer=setInterval(()=>{
   setActive(prev=>(prev+1)%slides.length);
  },5000);
  return ()=>clearInterval(timer);
 },[slides.length,isPaused,active]);

 if(slides.length===0)return null;
 const index=Math.min(active,slides.length-1);
 const slide=slides[index];
 const v=slide.section.fields;
 const chips=Array.isArray(v.tags)?v.tags.filter(x=>typeof x==="string").slice(0,4):typeof v.tags==="string"?(v.tags as string).split(",").map(x=>x.trim()).filter(Boolean).slice(0,4):[];

 return <section className="cg-site-hero" aria-label="Foundation featured initiatives"
  onMouseEnter={()=>setIsPaused(true)}
  onMouseLeave={()=>setIsPaused(false)}>
  {(slide.hero||slide.mobile)&&<picture className="cg-site-hero-media" key={"hero-media-"+index}>
   {slide.mobile&&<source media="(max-width: 48rem)" srcSet={slide.mobile.src}/>}
   <img src={(slide.hero||slide.mobile)!.src}
    alt={(slide.hero||slide.mobile)!.altText} loading={index===0?"eager":"lazy"}/>
  </picture>}
  <div className="cg-site-hero-gradient" aria-hidden="true"/>
  <div className="cg-site-hero-content" key={"hero-content-"+index} aria-live="polite">
   {!!text(v.eyebrow)&&<p className="cg-site-hero-eyebrow">{text(v.eyebrow)}</p>}
   <h1 style={{
    fontFamily:v.headingFont==="SANS"?"Arial, Helvetica, sans-serif":"Georgia, serif",
    fontWeight:v.headingWeight==="REGULAR"?400:900,
    ...(v.headingSize==="STANDARD"?{fontSize:"clamp(1.75rem, 2.7vw, 3rem)"}:{}),
    color:safeColor(v.headingColor)
   }}>{text(v.heading)}</h1>
   {!!text(v.subtitle)&&<h2 style={{color:safeColor(v.subtitleColor)}}>{text(v.subtitle)}</h2>}
   {!!text(v.description)&&<p className="cg-site-hero-description">{text(v.description)}</p>}
   {chips.length>0&&<div className="cg-site-hero-chips">{chips.map((chip,i)=>
    <span key={i}>{chip as string}</span>)}</div>}
   {[slide.hero,slide.mobile].some(a=>a?.altText.match(/^(AI-generated illustration|Editorial illustration)/))&&<p className="cg-site-hero-description">Illustration; not a photograph of Foundation activities.</p>}
   <div className="cg-site-hero-actions">
    <Button label={v.primaryLabel||"DONATE NOW"} href={v.primaryPath||"/donate"} navigation={navigation}/>
    {!!text(v.secondaryLabel)&&<Button label={v.secondaryLabel} href={v.secondaryPath} navigation={navigation} secondary/>}
   </div>
  </div>
  {slides.length>1&&<div className="cg-site-slide-controls">
   <button aria-label="Previous slide" type="button"
    onClick={()=>setActive((index-1+slides.length)%slides.length)}>‹</button>
   <div className="cg-site-slide-dots" role="group" aria-label="Choose a slide">
    {slides.map((s,i)=><button key={s.section.order} type="button"
     aria-label={"Show slide "+(i+1)} aria-pressed={i===index}
     onClick={()=>setActive(i)}/>)}
   </div>
   <button aria-label="Next slide" type="button"
    onClick={()=>setActive((index+1)%slides.length)}>›</button>
  </div>}
 </section>;
}
