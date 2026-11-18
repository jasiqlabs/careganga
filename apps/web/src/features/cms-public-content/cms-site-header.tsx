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
 const member=navigation?.memberJoin?.visible&&navigation.memberJoin.path?
  navigation.memberJoin.path:undefined;
 const volunteer=navigation?.volunteerJoin?.visible&&navigation.volunteerJoin.path?
  navigation.volunteerJoin.path:undefined;
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
    <Menu label="Our Work" items={work.map(text=>({text}))}/>
    {isPublished("/ngo-information")?<Link href="/ngo-information"
     className={pathname==="/ngo-information"?"cg-site-active":undefined}>NGO Information</Link>:
     <span className="cg-site-unavailable" aria-disabled="true">NGO Information</span>}
    <span className="cg-site-unavailable">Campaigns</span>
    <span className="cg-site-unavailable">Upcoming Projects</span>
    <span className="cg-site-unavailable">Partnerships</span>
    <span className="cg-site-unavailable">Events</span>
    <Menu label="Media & Resources" items={media.map(text=>({text,
     href:text==="Gallery"&&isPublished("/gallery")?"/gallery":
      text==="Videos"&&isPublished("/gallery")?"/gallery?type=VIDEO":
      text==="Publications / Reports"&&isPublished("/gallery")?
       "/gallery?type=PUBLICATION":
      (text==="News & Updates"||text==="Blog")&&anyArticles?"/blog":undefined}))}/>
    <Menu label="Join Now" items={[{text:"Become a Member",href:member},
     {text:"Become a Volunteer",href:volunteer}]}/>
    {isPublished("/healthcare")?<Link href="/healthcare"
     className={pathname==="/healthcare"?"cg-site-active":undefined}>
     Healthcare Assistance</Link>:
     <span className="cg-site-unavailable">Healthcare Assistance</span>}
    <Link href="/contact">Contact Us</Link>
    {navigation?.login?.visible&&navigation.login.path==="/admin/login"&&
     <Link className="cg-site-staff" href="/admin/login">Staff login</Link>}
   </nav>
  </div>
 </header>;
}
