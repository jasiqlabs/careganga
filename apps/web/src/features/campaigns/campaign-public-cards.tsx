import Link from "next/link";
import {goalText,type PublicCampaign} from "./campaign-public-source";
export function CampaignPublicCards({cards,heading="Campaigns",donationsEnabled=false}:{cards:PublicCampaign[];heading?:string;donationsEnabled?:boolean}){
 return <section className="cg-site-content cg-site-campaigns" aria-label="Published fundraising campaigns">
  <h2>{heading}</h2>
  {!cards.length?<div className="cg-site-empty" role="status"><strong>No campaigns published yet</strong><p>Independently approved Foundation campaigns will appear here.</p></div>:
   <div className="cg-site-campaign-grid">
    {cards.map(c=><article key={c.slug} className="cg-site-campaign-card">
     {(c.coverSrc||c.heroSrc)&&<img alt={c.heroAlt||c.title} src={c.coverSrc||c.heroSrc||""}
      loading="lazy" className="cg-site-campaign-image"/>}
     <span className="cg-site-eyebrow">{c.category}</span>
     <h3 style={{margin:0}}>{c.title}</h3>
     {c.area&&<p style={{margin:0}}>{c.area}</p>}
     {c.summary&&<p style={{margin:0}}>{c.summary}</p>}
     {goalText(c.goalMinor)&&<p style={{margin:0}}><strong>Fundraising goal: {goalText(c.goalMinor)}</strong><small style={{display:"block"}}>Planned target, not money received</small></p>}
     <p style={{margin:0}}><strong>Verified net contributions: {goalText(c.raisedMinor)}</strong>
      <small style={{display:"block"}}>Original posted donations less confirmed refunds</small></p>
     <div className="cg-site-campaign-actions"><Link href={"/campaigns/"+c.slug}>Read about this campaign</Link>
     {donationsEnabled&&<Link href={"/donate?campaign="+encodeURIComponent(c.slug)}>Support this campaign</Link>}</div>
    </article>)}
   </div>}
 </section>;
}
