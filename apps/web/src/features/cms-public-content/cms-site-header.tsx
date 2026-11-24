"use client";
import Link from "next/link";
import {useState} from "react";
import {usePathname} from "next/navigation";
import type {PublicCmsNavigation} from "./cms-public-source";

type Contact={address?:string;email?:string;phone?:string};
const work=["All Projects","Education","Healthcare","Livelihood",
 "Social Welfare","Community Development"];
const media=["News & Updates","Gallery","Videos","Publications / Reports","Blog"];
function Menu({label,items}:{label:string;items:{text:string;href?:string}[]}){
 return <details className="cg-site-menu">
  <summary>{label}<span aria-hidden="true">⌄</span></summary>
  <div className="cg-site-dropdown">{items.map(item=>item.href?
   <Link href={item.href} key={item.text}>{item.text}</Link>:
   <span key={item.text} className="cg-site-unavailable" aria-disabled="true">{item.text}</span>)}</div>
 </details>;
}
/** Desktop names and ordering derive from owner's original public-site screenshots.
 * Unimplemented owner routes remain plain labels, never fake links.
 */
export function CmsSiteHeader({navigation,contact}:{
 navigation?:PublicCmsNavigation|null;contact?:Contact}){
 const [expanded,setExpanded]=useState(false);
 const pathname=usePathname();
 const member=navigation?.memberJoin?.visible===true&&navigation.memberJoin.path==="/membership"?
  "/membership":undefined;
 // The same exact original route check as Public Android; never render a guessed CMS CTA.
 const volunteer=navigation?.volunteerJoin?.visible===true&&navigation.volunteerJoin.path==="/volunteer"?
  "/volunteer":undefined;
 const routes=navigation?.publishedRoutes??[];
 const isPublished=(path:string)=>routes.some(x=>x.path===path);
 const anyArticles=routes.some(x=>x.kind==="ARTICLE"&&/^\/blog\/[a-z0-9-]+$/.test(x.path));
 return <header className="cg-site-header">
  <div className="cg-site-contact-strip">
   <div className="cg-site-strip-inner">
    <span className="cg-site-connect">CONNECT: <span aria-label="Social channels">f · ▶ · ◉</span></span>
    <div className="cg-site-contact-details">
     {contact?.address&&<span>{contact.address}</span>}
     {contact?.email&&<a href={"mailto:"+contact.email}>{contact.email}</a>}
     {contact?.phone&&<a href={"tel:"+contact.phone.replace(/[^+0-9]/g,"")}>{contact.phone}</a>}
    </div>
   </div>
  </div>
  <div className="cg-site-nav-shell">
   <Link href="/" className="cg-site-brand" aria-label="CareGanga Foundation homepage">
    <img src="/careganga-mark.png" alt="" width={64} height={64}/>
    <span><strong>CareGanga</strong><small>FOUNDATION</small></span>
   </Link>
   <button className="cg-site-menu-toggle" type="button"
    aria-label={expanded?"Close website navigation":"Open website navigation"}
    aria-expanded={expanded} aria-controls="cg-site-navigation"
    onClick={()=>setExpanded(x=>!x)}>{expanded?"Close":"Menu"} <span aria-hidden="true">☰</span></button>
   <nav id="cg-site-navigation" aria-label="CareGanga public website"
    className={expanded?"cg-site-nav cg-site-nav-open":"cg-site-nav"}>
    <Link href="/" className={pathname==="/"? "cg-site-active":undefined}>Home</Link>
    {isPublished("/about")?<Link href="/about"
     className={pathname==="/about"?"cg-site-active":undefined}>About Us</Link>:
     <span className="cg-site-unavailable">About Us</span>}
    <Menu label="Our Work" items={work.map(text=>({text,href:isPublished("/our-work")?"/our-work"+(text==="All Projects"?"":"?category="+encodeURIComponent(text)):undefined}))}/>
    {isPublished("/ngo-information")?<Link href="/ngo-information"
     className={pathname==="/ngo-information"?"cg-site-active":undefined}>NGO Information</Link>:
     <span className="cg-site-unavailable" aria-disabled="true">NGO Information</span>}
    {isPublished("/donate")&&<Link href="/donate">Donate Now</Link>}
    {isPublished("/campaigns")?<Link href="/campaigns"
     className={pathname.startsWith("/campaigns")?"cg-site-active":undefined}>Campaigns</Link>:
     <span className="cg-site-unavailable" aria-disabled="true">Campaigns</span>}
    {isPublished("/upcoming-projects")?<Link href="/upcoming-projects" className={pathname==="/upcoming-projects"?"cg-site-active":undefined}>Upcoming Projects</Link>:<span className="cg-site-unavailable">Upcoming Projects</span>}
    <Link href="/collaboration" className={pathname.startsWith("/collaboration")?"cg-site-active":undefined}>Partnerships</Link>
    <span className="cg-site-unavailable">Events</span>
    <Menu label="Media & Resources" items={media.map(text=>({text,
     href:text==="Gallery"&&isPublished("/gallery")?"/gallery":
      text==="Videos"&&isPublished("/gallery")?"/videos":
      text==="Publications / Reports"&&isPublished("/gallery")?
       "/publications":
      text==="News & Updates"?"/notices":
      text==="Blog"&&anyArticles?"/blog":undefined}))}/>
    <Menu label="Join Now" items={[{text:"Become a Member",href:member},
     {text:"Become a Volunteer",href:volunteer}]}/>
    <Link href={isPublished("/healthcare")?"/healthcare":"/health-network"}
     className={pathname==="/healthcare"||pathname.startsWith("/health-network")?"cg-site-active":undefined}>
     Healthcare Assistance</Link>
    <Link href="/contact">Contact Us</Link>
    {navigation?.login?.visible&&navigation.login.path==="/admin/login"&&
     <Link className="cg-site-staff" href="/admin/login">Staff login</Link>}
   </nav>
  </div>
 </header>;
}
