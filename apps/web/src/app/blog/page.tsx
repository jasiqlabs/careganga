import Link from "next/link";
import type {Metadata} from "next";
import {HealthcarePublicChrome} from "../../shared/healthcare-public-chrome";
import {publishedCmsArticles} from "../../features/cms-public-content/cms-public-source";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"CareGanga Foundation — News & Articles",
 robots:{index:false,follow:true}};
type Query={searchParams:Promise<{category?:string;cursor?:string}>};
export default async function FoundationArticles({searchParams}:Query){
 const {category="",cursor=""}=await searchParams;
 const safeCategory=category.length<=80?category:"";
 const safeCursor=cursor.length<=70?cursor:"";
 const content=await publishedCmsArticles(safeCategory,safeCursor);
 return <HealthcarePublicChrome><main id="main-content" className="cg-site">
  <section className="cg-site-content cg-site-article-body">
   <p className="cg-site-eyebrow">Media &amp; Resources</p>
   <h1>News &amp; Articles</h1>
   <p>Current approved Foundation editorial updates.</p>
   <form method="GET" action="/blog" className="cg-site-article-filter">
    <label>Filter by actual category
     <input name="category" maxLength={80} defaultValue={safeCategory}
      placeholder="e.g. Education or Healthcare"/></label>
    <button type="submit">Show matching articles</button>
    {safeCategory&&<Link href="/blog">Clear filter</Link>}
   </form>
   {!content.available?<p role="alert">Articles cannot be verified right now. Try again later.</p>:
    content.posts.length===0?<p>No approved articles match this selection.</p>:
    <div className="cg-site-impact-grid">{content.posts.map(post=>
     <article className="cg-site-impact-card" key={post.slug}>
      <p className="cg-site-eyebrow">{post.category}</p>
      <h2>{post.title}</h2>
      <p>{post.excerpt}</p>
      <p className="cg-site-provenance">Source date: {post.asOfDate}</p>
      <Link href={post.path}>Read article</Link>
     </article>)}</div>}
   {content.nextCursor&&<Link href={"/blog?"+new URLSearchParams({
    ...(safeCategory?{category:safeCategory}:{}),
    cursor:content.nextCursor}).toString()}>More approved articles</Link>}
   <p><Link href="/">Back to the Foundation homepage</Link></p>
  </section>
 </main></HealthcarePublicChrome>;
}
