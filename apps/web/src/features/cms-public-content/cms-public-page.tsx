import Link from "next/link";
import type {PublicCmsNavigation} from "./cms-public-source";
export type PublicCmsSection={kind:string;order:number;fields:Record<string,unknown>};
export type PublicCmsPage={schemaVersion:number;effectiveGeneration:string;
 kind:string;slug:string;title:string;seoTitle:string;seoDescription:string;
 canonicalPath:string;lastPublishedAt:string;
 sections:PublicCmsSection[];assets:{role:string;altText:string;src:string;order:number}[]};
function text(value:unknown){return typeof value==="string"?value:"";}
function local(value:unknown){const href=text(value);
 return /^\/(?:[a-z0-9-]+\/?)*$/.test(href)&&
  !/\/(admin|api|auth|internal|join|volunteer|book)(\/|$)/.test(href)?href:null;
}
function Action({label,href}:{label:unknown;href:unknown}){
 const route=local(href);
 if(!route||!text(label))return null;
 return <Link className="cg-public-action" href={route}>{text(label)}</Link>;
}
/** Renders original published structured text only. No dangerouslySetInnerHTML,
 * no private author/case fields, no guessed future CG05 project items.
 */
export function CmsPublicPage({page,navigation}:{page:PublicCmsPage;navigation?:PublicCmsNavigation|null}){
 const assets=page.assets??[];
 return <main className="cg-public-main">
  <header className="cg-public-header">
   <Link className="cg-brandline" href="/"><img src="/careganga-mark.png" width={42}
    height={42} alt=""/><strong>CareGanga Foundation</strong></Link>
   <nav aria-label="Public website">
    <Link href="/">Home</Link><Link href="/about">About</Link>
    <Link href="/contact">Contact</Link>
    {navigation?.login?.visible&&navigation.login.path==="/admin/login"&&
     <Link href="/admin/login">Staff login</Link>}
   </nav>
  </header>
  <div className="cg-public-sections">
  {page.sections.map((section,index)=>{
   const v=section.fields??{},key=section.kind+"-"+section.order+"-"+index;
   if(section.kind==="HERO"){
    const hero=assets.find(x=>x.role==="HERO");
    const mobileHero=assets.find(x=>x.role==="MOBILE_HERO");
    return <section className="cg-public-hero" key={key}>
     <div><p className="cg-public-eyebrow">CareGanga Foundation</p>
      <h1>{text(v.heading)||page.title}</h1>
      {text(v.subtitle)&&<p>{text(v.subtitle)}</p>}
      <div className="cg-public-actions">
       <Action label={v.primaryLabel} href={v.primaryPath}/>
       <Action label={v.secondaryLabel} href={v.secondaryPath}/>
      </div>
     </div>
     {(hero||mobileHero)&&<picture className="cg-public-hero-picture">
      {mobileHero&&<source media="(max-width:52rem)" srcSet={mobileHero.src}/>}
      <img className="cg-public-hero-media" src={(hero||mobileHero)!.src}
       alt={(hero||mobileHero)!.altText} loading="eager"/>
     </picture>}
    </section>;
   }
   if(section.kind==="RICH_TEXT")return <section className="cg-public-card" key={key}>
    <h2>{text(v.heading)}</h2><p className="cg-public-prose">{text(v.body)}</p>
   </section>;
   if(section.kind==="TEAM"){
    const members=Array.isArray(v.members)?v.members:[];
    return <section className="cg-public-card" key={key}>
     <h2>{text(v.heading)||"Our team"}</h2>
     {members.length>0?<div className="cg-public-team">{members.map((person,i)=>{
      if(!person||typeof person!=="object"||!("consentConfirmed" in person)||
        person.consentConfirmed!==true)return null;
      const p=person as Record<string,unknown>;
      const photo=assets.find(x=>x.role==="TEAM"&&x.order===i);
      return <article className="cg-public-person" key={i}>
       {photo&&<img className="cg-public-team-photo" src={photo.src}
        alt={photo.altText} loading="lazy"/>}
       <h3>{text(p.name)}</h3><strong>{text(p.designation)}</strong>
       {text(p.bio)&&<p>{text(p.bio)}</p>}
      </article>;
     })}</div>:<p>Team information will appear after publication approval.</p>}
    </section>;
   }
   if(section.kind==="CTA")return <section className="cg-public-cta" key={key}>
    <Action label={v.label} href={v.path}/>
   </section>;
   // Operational project teasers require real CG05 approved source.
   return null;
  })}
  </div>
  <footer className="cg-public-footer">
   <span>CareGanga Foundation</span>
   <Link href="/contact">Contact</Link>
  </footer>
 </main>;
}
