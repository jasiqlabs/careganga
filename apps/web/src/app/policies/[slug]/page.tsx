import type {Metadata} from "next";
import {notFound} from "next/navigation";
import {CmsEditorialRoute,editorialMetadata} from "../../../features/cms-public-content/cms-editorial-route";
import {publishedCmsPage} from "../../../features/cms-public-content/cms-public-source";
export const dynamic="force-dynamic";
const allowed=new Set(["terms-and-conditions","privacy-policy","cookie-policy",
 "disclaimer","refund-and-cancellation","grievance-redressal",
 "copyright-and-intellectual-property"]);
type RouteContext={params:Promise<{slug:string}>};
export async function generateMetadata({params}:RouteContext):Promise<Metadata>{
 const {slug}=await params;
 if(!allowed.has(slug))return {robots:{index:false,follow:false}};
 const source=await publishedCmsPage(slug);
 if(source.state!=="PUBLISHED"||source.page.kind!=="POLICY")
  return {robots:{index:false,follow:false}};
 return editorialMetadata(slug);
}
export default async function OriginalFoundationPolicy({params}:RouteContext){
 const {slug}=await params;
 if(!allowed.has(slug))notFound();
 const source=await publishedCmsPage(slug);
 if(source.state==="PUBLISHED"&&source.page.kind!=="POLICY")notFound();
 return <CmsEditorialRoute slug={slug}/>;
}
