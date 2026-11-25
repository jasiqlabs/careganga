import Link from "next/link";
import {CmsPublicPage} from "./cms-public-page";
import {CmsPublicShell} from "./cms-public-page";
import {publishedCmsPage,publishedCmsNavigation} from "./cms-public-source";
const categories=["All Projects","Education","Healthcare","Livelihood","Social Welfare","Community Development"] as const;
export async function CmsProjectCatalogue({slug,category}:{slug:"our-work"|"upcoming-projects";category?:string}){
 const [result,home,navigation]=await Promise.all([publishedCmsPage(slug),publishedCmsPage("home"),publishedCmsNavigation()]);
 const title=slug==="upcoming-projects"?"Upcoming Projects":"Our Work",chosen=categories.find(c=>c===category)??"All Projects";
 const footer=home.state==="PUBLISHED"?home.page.sections.find(s=>s.kind==="SITE_FOOTER")?.fields:null;
 if(result.state!=="PUBLISHED")return <CmsPublicShell navigation={navigation} siteFooter={footer}><section className="cg-site-content"><h1>{title}</h1><p>{result.state==="NOT_PUBLISHED"?"No approved public project listing has been published.":"Current project content is temporarily unavailable."}</p><Link href="/">Return home</Link></section></CmsPublicShell>;
 const selected={...result.page,sections:result.page.sections.map(s=>s.kind!=="PROJECT_TEASER"?s:{...s,fields:{...s.fields,cards:(Array.isArray(s.fields.cards)?s.fields.cards:[]).filter(x=>chosen==="All Projects"||x&&typeof x==="object"&&typeof x.category==="string"&&x.category.toLowerCase()===chosen.toLowerCase())}})};
 const filters=<><h2>Our Work</h2>{categories.map(c=><p key={c}><Link href={"/"+slug+(c==="All Projects"?"":"?category="+encodeURIComponent(c))} aria-current={chosen===c?"page":undefined}>{c}</Link></p>)}<p><Link href={slug==="upcoming-projects"?"/our-work":"/upcoming-projects"}>{slug==="upcoming-projects"?"All approved projects":"Upcoming projects"}</Link></p></>;
 return <CmsPublicPage page={selected} navigation={navigation} siteFooter={footer}
  projectCategory={chosen==="All Projects"?undefined:chosen}
  projectFilters={slug==="upcoming-projects"?<nav className="cg-site-project-filters" aria-label="Project categories">{filters}</nav>:undefined}
  sidebar={slug==="our-work"?filters:undefined}/>;
}
