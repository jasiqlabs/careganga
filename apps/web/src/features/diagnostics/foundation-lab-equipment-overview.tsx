import Link from "next/link";
/** Server-only source aggregation; do not expose underlying equipment IDs,
 * serials, patient details, quality file URLs or image-invented accreditation.
 */
type Center={centerRef:string;name:string;total:number;ready:number;due:number};
type Summary={enabled:boolean;centers:Center[]};
export async function FoundationLabEquipmentOverview({token}:{token:string}){
 const backend=process.env.BACKEND_URL;
 if(!backend||process.env.CAREGANGA_ERP_LAB_ENABLED!=="true")return null;
 let value:Summary;
 try{
  const response=await fetch(new URL(
   "/api/v1/diagnostics/equipment/foundation/summary",backend),{
    headers:{Authorization:"Bearer "+token},cache:"no-store",
    signal:AbortSignal.timeout(9000)});
  if(!response.ok)return <section className="form-section">
   <h2>Lab Equipment & Quality</h2>
   <p>Current approved-lab equipment status cannot be verified.
    No unapproved quality or accreditation status is displayed.</p>
  </section>;
  value=await response.json() as Summary;
  if(!value.enabled||!Array.isArray(value.centers)||value.centers.length>50||
   value.centers.some(c=>!Number.isSafeInteger(c.total)||
    !Number.isSafeInteger(c.ready)||!Number.isSafeInteger(c.due)||
    c.total<0||c.ready<0||c.due<0||c.ready+c.due>c.total))
   throw Error("Invalid original aggregate");
 }catch{return <section className="form-section">
  <h2>Lab Equipment & Quality</h2>
  <p>Current verified equipment source is temporarily unavailable.</p>
 </section>;}
 return <section className="form-section" aria-label="Verified lab equipment overview">
  <h2>Lab Equipment & Quality</h2>
  <p>Current verified CG14 Lab ERP centers only. Readiness reflects actual
   scanned service evidence and calibration dates; not accreditation, stock,
   laboratory test capacity or patient medical status.</p>
  {value.centers.length===0?<p>No currently eligible laboratory equipment.</p>:
   <div className="table-wrap"><table className="role-table">
    <thead><tr><th>Approved laboratory</th><th>Registered instruments</th>
     <th>Ready with evidence</th><th>Calibration due</th></tr></thead>
    <tbody>{value.centers.map(c=><tr key={c.centerRef}>
     <td>{c.name}</td><td>{c.total}</td><td>{c.ready}</td><td>{c.due}</td>
    </tr>)}</tbody>
   </table></div>}
  <p>For permitted instrument maintenance, use
   {" "}<Link href="/admin/health-network/equipment">Lab Equipment & Quality</Link>.
   Only your assigned centers can be edited.</p>
 </section>;
}
