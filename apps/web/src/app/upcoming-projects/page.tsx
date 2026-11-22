import {CmsProjectCatalogue} from "../../features/cms-public-content/cms-project-catalogue";
import {editorialMetadata} from "../../features/cms-public-content/cms-editorial-route";
export const dynamic="force-dynamic";
export async function generateMetadata(){return editorialMetadata("upcoming-projects");}
export default async function Page({searchParams}:{searchParams:Promise<{category?:string}>}){const query=await searchParams;return <CmsProjectCatalogue slug="upcoming-projects" category={query.category}/>;}
