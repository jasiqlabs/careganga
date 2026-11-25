import {HealthcarePublicChrome} from "../../shared/healthcare-public-chrome";
import Link from "next/link";
import {onlineDonationAvailability,publishedCampaigns} from "../../features/campaigns/campaign-public-source";
import {PublicDonationForm} from "../../features/campaigns/public-donation-form";
export const dynamic="force-dynamic";
export const metadata={title:"Donate | CareGanga Foundation",robots:{index:false,follow:false}};
export default async function DonatePage({searchParams}:{searchParams:Promise<{campaign?:string}>}){
 const available=await onlineDonationAvailability();
 const raw=(await searchParams).campaign;
 const hasCampaign=raw!==undefined;
 const campaign=typeof raw==="string"&&/^cg-camp-[0-9]{8}$/.test(raw)?raw:null;
 const published=hasCampaign&&campaign?await publishedCampaigns(campaign):null;
 const eligible=!hasCampaign||(!!campaign&&published?.state==="PUBLISHED"&&published.cards.length===1&&published.cards[0].slug===campaign);
 return <HealthcarePublicChrome><main className="cg-site-content cg-public-donate" id="main-content">

  <nav aria-label="Breadcrumb" className="cg-public-campaign-breadcrumb"><Link href="/">Home</Link><span aria-hidden="true"> / </span><span aria-current="page">Donate</span></nav>
  <header className="cg-public-donate-heading"><p className="cg-site-eyebrow">CareGanga Foundation</p><h1>Donate to CareGanga</h1><p>Support the Foundation through its verified donation process.</p></header>
  {hasCampaign&&eligible&&published&&<p>Campaign: <strong>{published.cards[0].title}</strong></p>}
  <div className="cg-public-donate-grid"><div className="cg-public-donate-panel">
  {!eligible?<p role="alert">This campaign is no longer available for new contributions. No donation request has been created.</p>:
   available?<PublicDonationForm campaignSlug={campaign}/>:
   <p role="status">Online donations are currently unavailable until the Foundation verifies its payment merchant.</p>}
  </div><aside className="cg-public-campaign-support" aria-label="Donation information"><h2>Before you donate</h2><p>Payment links and pending requests are not receipts. The Foundation confirms money received after verified finance posting.</p><p>Need help with a donation?</p><Link className="cg-public-campaign-secondary" href="/contact">Contact the Foundation</Link><Link className="cg-public-campaign-secondary" href="/campaigns">Explore campaigns</Link></aside></div>
 </main></HealthcarePublicChrome>;
}
