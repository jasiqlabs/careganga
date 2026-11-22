import Link from "next/link";
import {onlineDonationAvailability} from "../../features/campaigns/campaign-public-source";
import {PublicDonationForm} from "../../features/campaigns/public-donation-form";
export const dynamic="force-dynamic";
export const metadata={title:"Donate | CareGanga Foundation",robots:{index:false,follow:false}};
export default async function DonatePage({searchParams}:{searchParams:Promise<{campaign?:string}>}){
 const available=await onlineDonationAvailability();
 const raw=(await searchParams).campaign;
 const campaign=typeof raw==="string"&&/^cg-camp-[0-9]{8}$/.test(raw)?raw:null;
 return <main className="page main" id="main-content">
  <header className="topbar"><Link href="/" className="cg-brandline">
   <img src="/careganga-mark.png" alt="" width={40} height={40}/>
   <strong>CareGanga Foundation</strong></Link><Link href="/campaigns">Campaigns</Link></header>
  <h1>Donate to CareGanga</h1>
  {available?<PublicDonationForm campaignSlug={campaign}/>:
   <p role="status">Online donations are currently unavailable until the Foundation verifies its payment merchant.</p>}
  <p><Link href="/contact">Contact the Foundation</Link></p>
 </main>;
}
