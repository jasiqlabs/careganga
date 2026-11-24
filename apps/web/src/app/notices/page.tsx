import type {Metadata} from "next";
import {CmsPublicShell} from "../../features/cms-public-content/cms-public-page";
import {CmsPublicNoticeBoard} from "../../features/cms-public-content/cms-public-notice-board";
import {publishedCmsNavigation,publishedCmsNotices,publishedCmsPage,publishedPublicIntro} from
 "../../features/cms-public-content/cms-public-source";

export const dynamic="force-dynamic";
/** Original client notice board, current CG19 notices independently approved
 * for public release in CG18. No private staff notifications are exposed.
 */
export async function generateMetadata():Promise<Metadata>{
 const notices=await publishedCmsNotices();
 return {title:"CareGanga Foundation — Notice & Announcement Board",
  alternates:{canonical:"/notices"},
  robots:{index:notices.available,follow:notices.available}};
}
export default async function OriginalNoticesPage(){
 const [data,navigation,home,intro]=await Promise.all([
  publishedCmsNotices(),publishedCmsNavigation(),publishedCmsPage("home"),publishedPublicIntro("NOTICES")]);
 const footer=home.state==="PUBLISHED"?
  home.page.sections.find(s=>s.kind==="SITE_FOOTER")?.fields:null;
 return <CmsPublicShell navigation={navigation} siteFooter={footer}>
  <CmsPublicNoticeBoard notices={data.notices} available={data.available} intro={intro}/>
 </CmsPublicShell>;
}
