import Link from "next/link";
import type {Metadata} from "next";
import {HealthcarePublicChrome} from "../../shared/healthcare-public-chrome";
import {publishedCmsArticles} from "../../features/cms-public-content/cms-public-source";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Foundation Events | CareGanga",robots:{index:false,follow:true}};
export default async function EventsPage({searchParams}:{searchParams:Promise<{cursor?:string}>}){
 const raw=(await searchParams).cursor;
 const cursor=typeof raw==="string"&&/^[a-z0-9][a-z0-9-]{0,69}$/.test(raw)?raw:"";
 const feed=await publishedCmsArticles("",cursor,true);
 return <HealthcarePublicChrome><main id="main-content" className="cg-site-content cg-site-article-body">
  <h1>Foundation Events</h1><p>Explore current independently approved Foundation events. Open an event for its current schedule and details.</p>
  {!feed.available?<p role="alert">Current event information cannot be verified. Please try again.</p>:feed.posts.length===0?<p>No currently approved events.</p>:<div className="cg-site-impact-grid">{feed.posts.map(event=><article key={event.slug} className="cg-site-impact-card"><p className="cg-site-eyebrow">{event.category}</p><h2>{event.title}</h2><p>{event.excerpt}</p><Link href={event.path}>View event details</Link></article>)}</div>}
  {feed.nextCursor&&<Link href={"/events?cursor="+encodeURIComponent(feed.nextCursor)}>Next page</Link>}
  {cursor&&<p><Link href="/events">Return to first page</Link></p>}
 </main></HealthcarePublicChrome>;
}
