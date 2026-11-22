import Link from "next/link";
import {goalText,type PublicCampaign} from "./campaign-public-source";
export function CampaignPublicCards({cards,heading="Campaigns",donationsEnabled=false}:{cards:PublicCampaign[];heading?:string;donationsEnabled?:boolean}){
 return <section className="cg-site-content" aria-label="Published fundraising campaigns">
  <h2>{heading}</h2>
  {!cards.length?<p>No independently published campaigns are currently available.</p>:
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,280px),1fr))",gap:18}}>
    {cards.map(c=><article key={c.slug} style={{background:"#fffaf0",border:"1px solid #e5ddc9",borderRadius:16,padding:20,display:"grid",gap:9}}>
     {(c.coverSrc||c.heroSrc)&&<img alt={c.heroAlt||c.title} src={c.coverSrc||c.heroSrc||""}
      loading="lazy" style={{width:"100%",aspectRatio:"16 / 9",objectFit:"cover",borderRadius:10}}/>}
     <span className="cg-site-eyebrow">{c.category}</span>
     <h3 style={{margin:0}}>{c.title}</h3>
     {c.area&&<p style={{margin:0}}>{c.area}</p>}
     {c.summary&&<p style={{margin:0}}>{c.summary}</p>}
     {goalText(c.goalMinor)&&<p style={{margin:0}}><strong>Fundraising goal: {goalText(c.goalMinor)}</strong><small style={{display:"block"}}>Planned target, not money received</small></p>}
     <Link href={"/campaigns/"+c.slug}>Read about this campaign</Link>
     {donationsEnabled&&<Link href={"/donate?campaign="+encodeURIComponent(c.slug)}>Support this campaign</Link>}
    </article>)}
   </div>}
 </section>;
}
