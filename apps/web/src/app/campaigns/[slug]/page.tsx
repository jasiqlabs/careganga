import Link from "next/link";
import {notFound} from "next/navigation";
import type {Metadata} from "next";
import {goalText,publishedCampaigns} from "../../../features/campaigns/campaign-public-source";
export const dynamic="force-dynamic";
type P={params:Promise<{slug:string}>};
export async function generateMetadata({params}:P):Promise<Metadata>{
 const {slug}=await params,r=await publishedCampaigns(slug),c=r.cards[0];
 return c?{title:c.title+" | CareGanga Foundation",description:c.summary,
  alternates:{canonical:"/campaigns/"+c.slug},robots:{index:true,follow:true}}:
  {title:"Campaign unavailable | CareGanga Foundation",robots:{index:false,follow:false}};
}
export default async function CampaignDetail({params}:P){
 const {slug}=await params,r=await publishedCampaigns(slug);
 if(r.state==="NOT_PUBLISHED")notFound();
 const c=r.cards[0];
 if(!c)return <main className="page main"><h1>Campaign unavailable</h1><p>Current independently approved campaign information could not be confirmed. Please check again.</p><Link href="/campaigns">Return to campaigns</Link></main>;
 return <main className="page main" id="main-content">
  <header className="topbar"><Link href="/" className="cg-brandline"><img src="/careganga-mark.png" alt="" width={40} height={40}/><strong>CareGanga Foundation</strong></Link>
   <Link href="/campaigns">All campaigns</Link></header>
  <article className="cg-site-content">
   <p className="cg-site-eyebrow">{c.category}</p>
   <h1>{c.title}</h1>
   {c.heroSrc&&<img src={c.heroSrc} alt={c.heroAlt||c.title} style={{width:"100%",maxHeight:460,objectFit:"cover",borderRadius:16}}/>}
   {c.summary&&<p>{c.summary}</p>}
   {c.description&&<p style={{whiteSpace:"pre-line"}}>{c.description}</p>}
   {c.area&&<p><strong>Area:</strong> {c.area}</p>}
   {c.startAt&&<p><strong>Campaign start:</strong> {c.startAt}</p>}
   {c.endAt&&<p><strong>Campaign end:</strong> {c.endAt}</p>}
   {goalText(c.goalMinor)&&<p><strong>Planned fundraising goal:</strong> {goalText(c.goalMinor)}. This is not confirmed money received.</p>}
   <p>Online contributions for this campaign are not enabled yet. Please contact the Foundation for current assistance information.</p>
   <Link href="/contact">Contact CareGanga Foundation</Link>
  </article>
 </main>;
}