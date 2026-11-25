import {HealthcarePublicChrome} from "../../shared/healthcare-public-chrome";
import Link from "next/link";
import type {Metadata} from "next";
import {publishedCampaigns} from "../../features/campaigns/campaign-public-source";
import {CampaignPublicCards} from "../../features/campaigns/campaign-public-cards";
export const dynamic="force-dynamic";
export async function generateMetadata():Promise<Metadata>{
 const r=await publishedCampaigns();
 return {title:"Campaigns | CareGanga Foundation",
  description:"Independently published CareGanga Foundation campaigns.",
  robots:{index:r.state==="PUBLISHED",follow:r.state==="PUBLISHED"},
  alternates:{canonical:"/campaigns"}};
}
export default async function CampaignsPage(){
 const r=await publishedCampaigns();
 return <HealthcarePublicChrome><main className="cg-site-content cg-public-campaign-list" id="main-content">
  <header className="cg-public-campaign-heading"><p className="cg-site-eyebrow">CareGanga Foundation</p><h1>Our Campaigns</h1><p className="cg-public-campaign-summary">Explore independently published Foundation campaigns and verified contributions.</p></header>
  {r.state==="UNAVAILABLE"?<p role="alert">Campaign information is temporarily unavailable. Please check again.</p>:
   <CampaignPublicCards heading="Published campaigns" cards={r.cards} donationsEnabled={r.donationsEnabled}/>}
  <div className="cg-public-campaign-list-actions">{r.donationsEnabled?<Link className="cg-public-campaign-primary" href="/donate">Make a general donation</Link>:<p role="status">Online donations are unavailable until Foundation payment verification is enabled.</p>}
  <Link className="cg-public-campaign-secondary" href="/">Back to CareGanga</Link></div>
 </main></HealthcarePublicChrome>;
}