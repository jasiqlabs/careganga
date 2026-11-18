import type {Metadata} from "next";
import {CmsNgoChildRoute,cmsNgoChildMetadata} from
 "../../../features/cms-public-content/cms-ngo-pages";
export const dynamic="force-dynamic";
export async function generateMetadata({params}:{
 params:Promise<{section:string}>}):Promise<Metadata>{
 const {section}=await params;
 return cmsNgoChildMetadata(section);
}
export default async function NgoInformationSection({params}:{
 params:Promise<{section:string}>}){
 const {section}=await params;
 return <CmsNgoChildRoute section={section}/>;
}
