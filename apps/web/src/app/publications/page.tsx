import type {Metadata} from "next";
import {CmsOriginalMediaRoute,originalMediaMetadata} from "../../features/cms-public-content/cms-editorial-route";
export const dynamic="force-dynamic";
export async function generateMetadata():Promise<Metadata>{
 return originalMediaMetadata("PUBLICATION");
}
export default function OriginalMediaPage(){
 return <CmsOriginalMediaRoute mediaType="PUBLICATION"/>;
}
