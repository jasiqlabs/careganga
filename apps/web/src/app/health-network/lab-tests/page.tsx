import {HealthcarePublicChrome} from "../../../shared/healthcare-public-chrome";
import {publicLabOffers,publicLabCategories,labOfferSearch,rupees} from "../../../features/diagnostics/public-lab-offers";
import type {Metadata} from "next";
import Link from "next/link";
export const dynamic="force-dynamic";
export const metadata:Metadata={
 title:"Currently Approved Lab Tests | CareGanga",
 description:"View current commercial lab tests and packages at published verified healthcare centers. Confirm details directly with the laboratory.",
 alternates:{canonical:"/health-network/lab-tests"},
 robots:{index:true,follow:true}
};
type Props={searchParams:Promise<Record<string,string|string[]|undefined>>};
export default async function PublicLabTestsPage({searchParams}:Props){
 const raw=await searchParams,query=labOfferSearch(raw);
 const [result,categories]=await Promise.all([publicLabOffers(query),publicLabCategories()]);
 const center=typeof raw.center==="string"?raw.center:"";
 const search=typeof raw.q==="string"?raw.q:"";
 const selectedCategory=typeof raw.category==="string"?raw.category:"";
 const next=new URLSearchParams(query);
 if(result.next)next.set("page",result.next);
 else next.delete("page");
 return <HealthcarePublicChrome><main className="cg-public-shell">
  <header className="cg-public-header">
   <nav aria-label="Breadcrumb">
    <Link href="/">CareGanga</Link><span aria-hidden="true"> / </span>
    <Link href="/health-network">Healthcare Network</Link><span aria-hidden="true"> / </span>
    <span>Approved Lab Tests</span>
   </nav>
  </header>
  <section className="cg-public-section">
   <p className="cg-eyebrow">CareGanga · Healthcare Assistance</p>
   <h1>Approved Lab Tests & Packages</h1>
   <p className="cg-lead">Compare current published partner laboratory prices by test and center.
    Prices are commercial offers, not financial assistance, a completed payment or a booking.</p>
   <p>Clinical reports, patient records and sample processing are not available through this directory.</p>
   <form method="get" action="/health-network/lab-tests"
    style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,220px),1fr))",gap:16}}>
    {center&&<input type="hidden" name="center" value={center}/>}
    <label>Search test, package or lab
     <input name="q" type="search" maxLength={80}
      defaultValue={search.slice(0,80)} placeholder="Search approved offers"/>
    </label>
    <label>Category
     <select name="category" defaultValue={selectedCategory}>
      <option value="">All categories</option>
      {selectedCategory&&!categories.some(x=>x.code===selectedCategory)&&
       <option value={selectedCategory}>{selectedCategory}</option>}
      {categories.map(c=><option key={c.code} value={c.code}>{c.name}</option>)}
     </select>
    </label>
    <div style={{display:"flex",gap:12,alignItems:"end",flexWrap:"wrap"}}>
     <button type="submit" className="primary">Find current tests</button>
     <Link href={center?"/health-network/lab-tests?center="+encodeURIComponent(center):
      "/health-network/lab-tests"}>Clear filters</Link>
    </div>
   </form>
  </section>
  <section className="cg-public-section" aria-live="polite">
   <h2>Currently published test offers</h2>
   {result.state==="UNAVAILABLE"?<p role="alert">{result.notice}</p>:
    result.items.length===0?<p role="status">No current approved test prices match this search.
     This does not affect other services at verified healthcare centers.</p>:
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,290px),1fr))",gap:16}}>
     {result.items.map(offer=><article key={offer.offerRef}
      style={{border:"1px solid #d7dfdb",borderRadius:12,padding:18}}>
      <p className="cg-eyebrow">{offer.kind==="TEST"?offer.category:"Diagnostic package"}</p>
      <h3>{offer.name}</h3>
      <p>Test code: {offer.code}</p>
      {offer.sampleType&&<p>Sample category: {offer.sampleType.replaceAll("_"," ")}</p>}
      {offer.description&&<p>{offer.description}</p>}
      <p><strong>{rupees(offer.patientPriceMinor)}</strong> · Current patient price</p>
      {Number(offer.basePriceMinor)>Number(offer.patientPriceMinor)&&
       <p>Base commercial price: {rupees(offer.basePriceMinor)}
        {" · Partner commercial saving: "}
        {rupees(String(Number(offer.basePriceMinor)-Number(offer.patientPriceMinor)))}
       </p>}
      <p><strong><Link href={"/healthcare/centers/"+encodeURIComponent(offer.centerSlug)}>
       {offer.centerName}</Link></strong> · {offer.providerName}</p>
      <p>{offer.centerAddress}, PIN {offer.pinCode}</p>
      <p>Published price effective from {new Date(offer.validFromUtc).toLocaleDateString("en-IN")}
       {offer.validUntilUtc?" until "+new Date(offer.validUntilUtc).toLocaleDateString("en-IN"):""}</p>
      {offer.publicPhone&&<p><a href={"tel:"+offer.publicPhone}>Contact the lab</a></p>}
      <p style={{fontSize:14}}>Informational listing only. Contact this center to confirm
       price and test availability before visiting.</p>
     </article>)}
    </div>}
   {result.state==="READY"&&result.next&&<p>
    <Link href={"/health-network/lab-tests?"+next.toString()}>Next approved offers</Link>
   </p>}
  </section>
  <section className="cg-public-section">
   <p>{result.notice}</p>
   <Link href="/health-network">Browse all verified centers and doctors</Link>
  </section>
 </main></HealthcarePublicChrome>;
}
