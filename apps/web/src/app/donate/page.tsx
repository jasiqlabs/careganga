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
 const eligible=!hasCampaign||(!!campaign&&published?.state==="PUBLISHED"&&published.cards.length===1);
 return <HealthcarePublicChrome><main className="page main" id="main-content">

  <h1>Donate to CareGanga</h1>
  {hasCampaign&&eligible&&published&&<p>Campaign: <strong>{published.cards[0].title}</strong></p>}
  {!eligible?<p role="alert">This campaign is no longer available for new contributions. No donation request has been created.</p>:
   available?<PublicDonationForm campaignSlug={campaign}/>:
   <p role="status">Online donations are currently unavailable until the Foundation verifies its payment merchant.</p>}
  <p><Link href="/contact">Contact the Foundation</Link></p>
 </main></HealthcarePublicChrome>;
}
