import Link from "next/link";
import {publicLabOffers,rupees} from "./public-lab-offers";
/** H08 authenticated Foundation network overview. Source is the SAME
 * current CG14/CG03/CG19/CG16 anonymous public approval projection, not
 * unapproved draft/center tariff, booking counts, popularity or mockups. */
export async function FoundationLabOfferOverview(){
 const result=await publicLabOffers(new URLSearchParams());
 return <section className="form-section cg-diagnostics" aria-label="Current published laboratory offers">
  <h2>Current Published Laboratory Offers</h2>
  <p>Publicly approved tests and verified lab locations from the original
   healthcare network. Prices are partner commercial offers, not Foundation
   contributions, paid bookings or medical advice.</p>
  {result.state==="UNAVAILABLE"?<p role="alert" className="notice error">
    Published lab prices cannot be verified. No previous prices are shown.</p>:
   result.items.length===0?<p role="status" className="cg-module-empty">
    No published approved laboratory tests have been recorded.
    Verified healthcare providers remain available independently.</p>:
   <div className="table-wrap"><table className="role-table">
    <thead><tr><th>Published test or package</th><th>Original verified lab</th>
     <th>Current patient price</th><th>View</th></tr></thead>
    <tbody>{result.items.slice(0,8).map(offer=><tr key={offer.offerRef}>
     <td><strong>{offer.name}</strong><div>{offer.category}</div></td>
     <td>{offer.centerName}<div>{offer.providerName}</div></td>
     <td>{rupees(offer.patientPriceMinor)}</td>
     <td><Link href={"/healthcare/centers/"+encodeURIComponent(offer.centerSlug)}>
      Original center profile</Link></td>
    </tr>)}</tbody>
   </table></div>}
  <div className="toolbar">
   <Link href="/admin/health-network/diagnostics">Open Lab Test Master & Pricing</Link>
   <Link href="/health-network/lab-tests">View current public lab test offers</Link>
  </div>
  <p className="cg-diagnostics-note">Showing up to eight alphabetically listed
   current offers, not a popularity ranking. Every public view checks current
   center publication and approved price again.</p>
 </section>;
}
