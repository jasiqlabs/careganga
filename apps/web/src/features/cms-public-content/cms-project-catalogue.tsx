import Link from "next/link";
import {CmsPublicPage} from "./cms-public-page";
import {CmsPublicShell} from "./cms-public-page";
import {publishedCmsPage,publishedCmsNavigation} from "./cms-public-source";
const categories=["All Projects","Education","Healthcare","Livelihood","Social Welfare","Community Development"] as const;
function validProject(raw:unknown,upcoming:boolean):raw is {slug:string;category:string}{
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
 const title=slug==="upcoming-projects"?"Upcoming Projects":"Our Work",chosen=categories.find(c=>c===category)??"All Projects";
 const footer=home.state==="PUBLISHED"?home.page.sections.find(s=>s.kind==="SITE_FOOTER")?.fields:null;
 const teasers=result.state==="PUBLISHED"?result.page.sections.filter(s=>s.kind==="PROJECT_TEASER"):[];
 const cards=teasers[0]?.fields.cards;
 if(result.state!=="PUBLISHED"||result.page.kind!=="PROJECTS"||result.page.canonicalPath!=="/"+slug||teasers.length!==1||!Array.isArray(cards)||!cards.every(x=>validProject(x,slug==="upcoming-projects"))||new Set(cards.map(x=>x.slug)).size!==cards.length)return <CmsPublicShell navigation={navigation} siteFooter={footer}><section className="cg-site-content"><h1>{title}</h1><p>{result.state==="NOT_PUBLISHED"?"No approved public project listing has been published.":"Current project content is temporarily unavailable."}</p><Link href="/">Return home</Link></section></CmsPublicShell>;
 const selected={...result.page,sections:result.page.sections.map(s=>s.kind!=="PROJECT_TEASER"?s:{...s,fields:{...s.fields,cards:(Array.isArray(s.fields.cards)?s.fields.cards:[]).filter(x=>chosen==="All Projects"||x&&typeof x==="object"&&typeof x.category==="string"&&x.category.toLowerCase()===chosen.toLowerCase())}})};
 const filters=<><h2>Project categories</h2>{categories.map(c=><p key={c}><Link href={"/"+slug+(c==="All Projects"?"":"?category="+encodeURIComponent(c))} aria-current={chosen===c?"page":undefined}>{c}</Link></p>)}<p><Link href={slug==="upcoming-projects"?"/our-work":"/upcoming-projects"}>{slug==="upcoming-projects"?"All approved projects":"Upcoming projects"}</Link></p></>;
 return <CmsPublicPage page={selected} navigation={navigation} siteFooter={footer}
  projectCategory={chosen==="All Projects"?undefined:chosen}
  projectFilters={slug==="upcoming-projects"?<nav className="cg-site-project-filters" aria-label="Project categories">{filters}</nav>:undefined}
  sidebar={slug==="our-work"?<nav className="cg-site-project-sidebar" aria-label="Project categories">{filters}</nav>:undefined}/>;
}
