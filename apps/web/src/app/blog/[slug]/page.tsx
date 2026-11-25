import type {Metadata} from "next";
import {CmsEditorialRoute,editorialMetadata} from "../../../features/cms-public-content/cms-editorial-route";
export const dynamic="force-dynamic";
type Context={params:Promise<{slug:string}>};
export async function generateMetadata({params}:Context):Promise<Metadata>{
 const {slug}=await params;return editorialMetadata(slug,"ARTICLE");
}
export default async function ArticlePage({params}:Context){
 const {slug}=await params;
 return <CmsEditorialRoute slug={slug} expectedKind="ARTICLE"/>;
}
