import type {ReactNode} from "react";
import {CmsSiteHeader} from "../features/cms-public-content/cms-site-header";
import {SiteFooter} from "../features/cms-public-content/cms-public-page";
import {publishedCmsNavigation,publishedCmsPage} from "../features/cms-public-content/cms-public-source";

/** Public healthcare pages reuse the published CareGanga website identity.
 * Anonymous CMS navigation never receives patient or staff private details. */
export async function HealthcarePublicChrome({children}:{children:ReactNode}){
 const [navigation,home]=await Promise.all([
  publishedCmsNavigation(),publishedCmsPage("home")
 ]);
 const footer=home.state==="PUBLISHED"?
  home.page.sections.find(section=>section.kind==="SITE_FOOTER")?.fields:null;
 return <div className="cg-site cg-health-public-chrome">
  <CmsSiteHeader navigation={navigation} contact={{
   address:typeof footer?.address==="string"?footer.address:undefined,
   phone:typeof footer?.phone==="string"?footer.phone:undefined,
   email:typeof footer?.email==="string"?footer.email:undefined
  }}/>
  {children}
  <SiteFooter data={footer??{}} navigation={navigation}/>
 </div>;
}
