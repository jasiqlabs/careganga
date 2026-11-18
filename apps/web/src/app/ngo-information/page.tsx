import type {Metadata} from "next";
import {CmsOriginalNgoInformationRoute,originalNgoInformationMetadata} from "../../features/cms-public-content/cms-editorial-route";
export const dynamic="force-dynamic";
export async function generateMetadata():Promise<Metadata>{
 return originalNgoInformationMetadata();
}
export default function OriginalNgoInformationPage(){
 return <CmsOriginalNgoInformationRoute/>;
}
