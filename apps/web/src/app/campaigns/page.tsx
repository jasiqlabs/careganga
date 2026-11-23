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
 return <main className="page main" id="main-content">
  <header className="topbar"><Link href="/" className="cg-brandline">
   <img src="/careganga-mark.png" alt="" width={40} height={40}/>
   <strong>CareGanga Foundation</strong></Link><Link href="/contact">Contact</Link></header>
  <h1>Our Campaigns</h1>
  {r.state==="UNAVAILABLE"?<p role="alert">Campaign information is temporarily unavailable. Please check again.</p>:
   <CampaignPublicCards cards={r.cards} donationsEnabled={r.donationsEnabled}/>}
  {r.donationsEnabled?<p><Link href="/donate">Make a general donation</Link></p>:<p>Online donations are unavailable until Foundation payment verification is enabled.</p>}
  <Link href="/">Back to CareGanga</Link>
 </main>;
}