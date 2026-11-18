import type {Metadata} from "next";
import {CmsEditorialRoute,editorialMetadata} from "../../features/cms-public-content/cms-editorial-route";
export const dynamic="force-dynamic";
export async function generateMetadata():Promise<Metadata>{return editorialMetadata("healthcare");}
export default function EditorialPage(){return <CmsEditorialRoute slug="healthcare"/>;}
