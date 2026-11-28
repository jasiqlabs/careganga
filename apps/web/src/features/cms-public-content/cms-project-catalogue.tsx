import Link from "next/link";
import {CmsPublicShell} from "./cms-public-page";
import {publishedCmsPage,publishedCmsNavigation} from "./cms-public-source";
import {CmsProjectExplorer,type ExplorerProject} from "./cms-project-explorer";
function validProject(raw:unknown,upcoming:boolean):raw is ExplorerProject{
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return false;
 const x=raw as Record<string,unknown>;
 if(!["slug","title","category","summary","area"].every(k=>typeof x[k]==="string"&&(x[k] as string).trim().length>0))return false;
 if(x.status!=="PLANNED"&&(upcoming||x.status!=="ACTIVE"))return false;
 if(x.launch!==null){
  if(typeof x.launch!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(x.launch))return false;
  const d=new Date(x.launch+"T00:00:00Z");
  if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==x.launch)return false;
 }
 return x.coverSrc===null||typeof x.coverSrc==="string"&&/^\/api\/public\/content\/media\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x.coverSrc);
}
export async function CmsProjectCatalogue({slug,category}:{slug:"our-work"|"upcoming-projects";category?:string}){
 const [result,home,navigation]=await Promise.all([publishedCmsPage(slug),publishedCmsPage("home"),publishedCmsNavigation()]);
 const title=slug==="upcoming-projects"?"Upcoming Projects":"Our Work";
 const footer=home.state==="PUBLISHED"?home.page.sections.find(s=>s.kind==="SITE_FOOTER")?.fields:null;
 const teasers=result.state==="PUBLISHED"?result.page.sections.filter(s=>s.kind==="PROJECT_TEASER"):[];
 const cards=teasers[0]?.fields.cards;
 if(result.state!=="PUBLISHED"||result.page.kind!=="PROJECTS"||result.page.canonicalPath!=="/"+slug||teasers.length!==1||!Array.isArray(cards)||!cards.every(x=>validProject(x,slug==="upcoming-projects"))||new Set(cards.map(x=>x.slug)).size!==cards.length)return <CmsPublicShell navigation={navigation} siteFooter={footer}><section className="cg-site-content"><h1>{title}</h1><p>{result.state==="NOT_PUBLISHED"?"No approved public project listing has been published.":"Current project content is temporarily unavailable."}</p><Link href="/">Return home</Link></section></CmsPublicShell>;
 const richIntro=result.page.sections.find(s=>s.kind==="RICH_TEXT"&&typeof s.fields.body==="string")?.fields.body;
 const pageIntro=typeof richIntro==="string"&&richIntro.trim()?richIntro.trim():(result.page.seoDescription.trim()||undefined);
 const heroAsset=result.page.assets.find(a=>a.role==="HERO");
 const teaserHeading=typeof teasers[0]?.fields.heading==="string"?teasers[0].fields.heading:(slug==="upcoming-projects"?"Planned Projects":"Our Projects");
 const joinHref=navigation?.publishedRoutes?.some(r=>r.path==="/volunteer")?"/volunteer":"/contact";
 const isDonatePublished=navigation?.publishedRoutes?.some(r=>r.path==="/donate")===true;
 const donateHref=isDonatePublished?"/donate":"/contact";
 return <CmsPublicShell navigation={navigation} siteFooter={footer}>
  <CmsProjectExplorer
   slug={slug}
   pageTitle={result.page.title||title}
   pageIntro={pageIntro}
   teaserHeading={teaserHeading}
   heroImageSrc={heroAsset?.src}
   heroImageAlt={heroAsset?.altText}
   projects={cards as ExplorerProject[]}
   initialCategory={category}
   joinHref={joinHref}
   donateHref={donateHref}
   isDonatePublished={isDonatePublished}
  />
 </CmsPublicShell>;
}
