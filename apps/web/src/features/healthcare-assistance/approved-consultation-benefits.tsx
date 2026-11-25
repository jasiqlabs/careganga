import Link from "next/link";
import {currentConsultationBenefits,formatRupees}
 from "./public-consultation-benefits";
/** CG18 CMS placement: only original currently approved CG17+CG14 support,
 * without any patient detail or implying a confirmed award.
 */
export async function ApprovedConsultationBenefits(){
 return <ConsultationBenefitCards response={await currentConsultationBenefits()}/>;
}
export function ConsultationBenefitCards({response}:{response:Awaited<ReturnType<typeof currentConsultationBenefits>>}){
 if(response.state!=="READY"||response.items.length===0)return null;
 return <section className="cg-site-content cg-health-benefit-strip"
  aria-label="Currently approved consultation contribution policies">
  <h2>Currently approved consultation support</h2>
  <p>Where applicable, the Foundation may contribute toward an eligible
   in-person consultation. The patient's share depends on an actual current
   doctor's fee, verified patient-care eligibility and policy cap.
   This is not a guaranteed discount or a payment confirmation.</p>
  <ul>
   {response.items.slice(0,4).map((item,i)=><li key={item.centerSlug+":"+(item.doctorRef??"center")+":"+i}>
    <strong>{item.centerName}</strong>
    {item.doctorName?<> · {item.doctorName}</>:null}:{" "}
    {item.mode==="PERCENT"&&item.percentBasisPoints!==null?
     (item.percentBasisPoints/100).toFixed(2)+"% possible Foundation contribution":
     "Fixed possible Foundation contribution of "+formatRupees(item.fixedSupportMinor??"0")}
    {" · maximum "+formatRupees(item.maximumSupportMinor)}
    {item.feeMinor!==null?
     " · currently approved consultation fee "+formatRupees(item.feeMinor):""}
    {" · subject to eligibility and available appointments."}
    {" "}<Link href={"/healthcare/centers/"+encodeURIComponent(item.centerSlug)}>View center</Link>
   </li>)}
  </ul>
  <p>Policies may change or expire. Check the current rate when choosing
   a verified doctor. No laboratory, pharmacy, nursing or procedure support
   percentage is implied by this page.</p>
  <Link className="cg-site-action" href="/health-network?tab=doctors">
   Find an approved doctor</Link>
 </section>;
}
