import type {Metadata} from "next";
import {notFound} from "next/navigation";
import {CmsEditorialRoute,editorialMetadata} from "../../../features/cms-public-content/cms-editorial-route";
export const dynamic="force-dynamic";
const allowed=new Set(["terms-and-conditions","privacy-policy","cookie-policy",
 "disclaimer","refund-and-cancellation","grievance-redressal",
 "copyright-and-intellectual-property"]);
type RouteContext={params:Promise<{slug:string}>};
export async function generateMetadata({params}:RouteContext):Promise<Metadata>{
 const {slug}=await params;
 if(!allowed.has(slug))return {robots:{index:false,follow:false}};
 return editorialMetadata(slug,"POLICY");
}
export default async function OriginalFoundationPolicy({params}:RouteContext){
 const {slug}=await params;
 if(!allowed.has(slug))notFound();
 return <CmsEditorialRoute slug={slug} expectedKind="POLICY"/>;
}
