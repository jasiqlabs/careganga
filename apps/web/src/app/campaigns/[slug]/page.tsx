import {HealthcarePublicChrome} from "../../../shared/healthcare-public-chrome";
import Link from "next/link";
import {notFound} from "next/navigation";
import type {Metadata} from "next";
import {goalText,publishedCampaigns,onlineDonationAvailability} from "../../../features/campaigns/campaign-public-source";
export const dynamic="force-dynamic";
type P={params:Promise<{slug:string}>};
export async function generateMetadata({params}:P):Promise<Metadata>{
 const {slug}=await params,r=await publishedCampaigns(slug),c=r.state==="PUBLISHED"?r.cards.find(card=>card.slug===slug):undefined;
 return c?{title:c.title+" | CareGanga Foundation",description:c.summary,
  alternates:{canonical:"/campaigns/"+c.slug},robots:{index:true,follow:true}}:
  {title:"Campaign unavailable | CareGanga Foundation",robots:{index:false,follow:false}};
}
export default async function CampaignDetail({params}:P){
 const {slug}=await params,r=await publishedCampaigns(slug);
 if(r.state==="NOT_PUBLISHED")notFound();
 const c=r.state==="PUBLISHED"?r.cards.find(card=>card.slug===slug):undefined;
 if(!c)return <HealthcarePublicChrome><main className="cg-site-content cg-public-campaign-detail" id="main-content"><div className="cg-public-campaign-empty" role="status"><h1>Campaign unavailable</h1><p>Current independently approved campaign information could not be confirmed. Please check again.</p><Link href="/campaigns">Return to campaigns</Link></div></main></HealthcarePublicChrome>;
 const donationsEnabled=await onlineDonationAvailability();
 const goal=goalText(c.goalMinor),received=goalText(c.raisedMinor);
 return <HealthcarePublicChrome><main className="cg-site-content cg-public-campaign-detail" id="main-content">
  <nav aria-label="Breadcrumb" className="cg-public-campaign-breadcrumb"><Link href="/campaigns">All campaigns</Link><span aria-hidden="true"> / </span><span aria-current="page">Campaign details</span></nav>
  <article className="cg-public-campaign-article">
   <header className="cg-public-campaign-heading"><p className="cg-site-eyebrow">{c.category}</p><h1>{c.title}</h1>{c.summary&&<p className="cg-public-campaign-summary">{c.summary}</p>}</header>
   {c.heroSrc&&<img className="cg-public-campaign-hero" src={c.heroSrc} alt={c.heroAlt||c.title}/>}
   <div className="cg-public-campaign-body">
    <section className="cg-public-campaign-copy" aria-label="Campaign information">
     {c.description&&<p className="cg-public-campaign-description">{c.description}</p>}
     {(c.area||c.startAt||c.endAt)&&<dl className="cg-public-campaign-facts">
      {c.area&&<div><dt>Area</dt><dd>{c.area}</dd></div>}
      {c.startAt&&<div><dt>Campaign start</dt><dd>{c.startAt}</dd></div>}
      {c.endAt&&<div><dt>Campaign end</dt><dd>{c.endAt}</dd></div>}
     </dl>}
    </section>
    <aside className="cg-public-campaign-support" aria-label="Campaign support">
     <h2>Support this campaign</h2>
     {goal&&<div className="cg-public-campaign-amount"><span>Planned fundraising goal</span><strong>{goal}</strong></div>}
     {received&&<div className="cg-public-campaign-amount"><span>Verified net contributions</span><strong>{received}</strong></div>}
     <p className="cg-public-campaign-note">A planned goal is not confirmed money received. Pending payments are not included in verified net contributions.</p>
     {donationsEnabled?<Link className="cg-public-campaign-primary" href={"/donate?campaign="+encodeURIComponent(c.slug)}>Support this campaign</Link>:<p role="status">Online donations are unavailable. Contact the Foundation.</p>}
     <Link className="cg-public-campaign-secondary" href="/contact">Contact CareGanga Foundation</Link>
    </aside>
   </div>
  </article>
 </main></HealthcarePublicChrome>;
}