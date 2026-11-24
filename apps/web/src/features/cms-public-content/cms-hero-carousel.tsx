"use client";
import Link from "next/link";
import {useState} from "react";
import type {PublicCmsNavigation} from "./cms-public-source";
import {effectiveCmsCtaRoute} from "./cms-cta-route";
import type {PublicCmsSection,PublicCmsPage} from "./cms-public-page";
type Asset=PublicCmsPage["assets"][number];
type Slide={section:PublicCmsSection;hero?:Asset;mobile?:Asset};
const text=(v:unknown)=>typeof v==="string"?v:"";
const safeColor=(v:unknown)=>/^#[a-fA-F0-9]{6}$/.test(text(v))?text(v):undefined;
function Button({label,href,secondary=false,navigation}:{label:unknown;href:unknown;secondary?:boolean;navigation?:PublicCmsNavigation|null}){
 const target=effectiveCmsCtaRoute(href,navigation);
 return target&&text(label)?
  <Link className={secondary?"cg-site-hero-cta is-secondary":"cg-site-hero-cta"}
   href={target}>{text(label)}</Link>:null;
}
export function CmsHeroCarousel({slides,navigation}:{slides:Slide[];navigation?:PublicCmsNavigation|null}){
 const [active,setActive]=useState(0);
 if(slides.length===0)return null;
 const index=Math.min(active,slides.length-1),slide=slides[index],v=slide.section.fields;
 const chips=Array.isArray(v.tags)?v.tags.filter(x=>typeof x==="string").slice(0,4):[];
 return <section className="cg-site-hero" aria-label="Foundation featured initiatives">
  {(slide.hero||slide.mobile)&&<picture className="cg-site-hero-media">
   {slide.mobile&&<source media="(max-width: 48rem)" srcSet={slide.mobile.src}/>}
   <img src={(slide.hero||slide.mobile)!.src}
    alt={(slide.hero||slide.mobile)!.altText} loading={index===0?"eager":"lazy"}/>
  </picture>}
  <div className="cg-site-hero-gradient" aria-hidden="true"/>
  <div className="cg-site-hero-content" key={slide.section.order}>
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
   {[slide.hero,slide.mobile].some(a=>a?.altText.startsWith("AI-generated illustration"))&&<p className="cg-site-hero-description">AI-generated illustration; not a photograph of Foundation activities.</p>}
   <div className="cg-site-hero-actions">
    <Button label={v.primaryLabel} href={v.primaryPath} navigation={navigation}/>
    <Button label={v.secondaryLabel} href={v.secondaryPath} navigation={navigation} secondary/>
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
