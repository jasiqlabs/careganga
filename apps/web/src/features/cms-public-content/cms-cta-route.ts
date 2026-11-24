import type {PublicCmsNavigation} from "./cms-public-source";
// Exact public destinations supported on both Web and Public Android.
// Authorization/publication is checked separately; never accept arbitrary URLs.
const routes:readonly string[]=["/","/about","/contact","/our-impact","/ngo-information","/gallery","/videos","/publications","/healthcare","/our-work","/upcoming-projects","/collaboration","/membership","/volunteer","/campaigns"];
export const isCmsCtaRoute=(value:unknown):value is string=>typeof value==="string"&&routes.includes(value);
export function effectiveCmsCtaRoute(value:unknown,navigation?:PublicCmsNavigation|null):string|null{
 if(!isCmsCtaRoute(value))return null;
 if(value==="/"||value==="/contact"||value==="/collaboration")return value;
 if(value==="/membership")return navigation?.memberJoin?.visible===true&&navigation.memberJoin.path===value?value:null;
 if(value==="/volunteer")return navigation?.volunteerJoin?.visible===true&&navigation.volunteerJoin.path===value?value:null;
 const required=value==="/videos"||value==="/publications"?"/gallery":value;
 return navigation?.publishedRoutes?.some(p=>p.path===required)===true?value:null;
}
