"use client";
import Link from "next/link";
import {useEffect,useRef,useState} from "react";
import {usePathname} from "next/navigation";
import type {PublicCmsNavigation} from "./cms-public-source";

type Contact={address?:string;email?:string;phone?:string};
const work=["All Projects","Education","Healthcare","Livelihood",
 "Social Welfare","Community Development"];
const media=["News & Updates","Gallery","Videos","Publications / Reports","Blog"];
const inSection=(pathname:string,href?:string)=>!!href&&!href.includes("?")&&
 (pathname===href||href!=="/"&&pathname.startsWith(href+"/"));
function Menu({label,items,pathname}:{label:string;items:{text:string;href?:string}[];pathname:string}){
 return <details className="cg-site-menu" name="cg-public-navigation">
  <summary className={items.some(item=>inSection(pathname,item.href))?"cg-site-active":undefined}>{label}<span aria-hidden="true">⌄</span></summary>
  <div className="cg-site-dropdown">{items.map(item=>item.href?
   <Link href={item.href} key={item.text} aria-current={pathname===item.href?"page":undefined}>{item.text}</Link>:
   <span key={item.text} className="cg-site-unavailable" aria-disabled="true">{item.text}<small>Not available yet</small></span>)}</div>
 </details>;
}
/** Desktop names and ordering derive from owner's original public-site screenshots.
 * Unimplemented owner routes remain plain labels, never fake links.
 */
export function CmsSiteHeader({navigation,contact}:{
 navigation?:PublicCmsNavigation|null;contact?:Contact}){
 const [expanded,setExpanded]=useState(false);
 const pathname=usePathname();
 const header=useRef<HTMLElement>(null);
 const toggle=useRef<HTMLButtonElement>(null);
 function closeDropdowns(){header.current?.querySelectorAll<HTMLDetailsElement>("details[open]").forEach(menu=>{menu.open=false;});}
 function closeNavigation(){closeDropdowns();setExpanded(false);}
 useEffect(()=>{closeNavigation();},[pathname]);
 useEffect(()=>{
  const outside=(event:PointerEvent)=>{if(header.current&&!header.current.contains(event.target as Node))closeNavigation();};
  document.addEventListener("pointerdown",outside);
  return ()=>document.removeEventListener("pointerdown",outside);
 },[]);
 const member=navigation?.memberJoin?.visible===true&&navigation.memberJoin.path==="/membership"?
  "/membership":undefined;
 // The same exact original route check as Public Android; never render a guessed CMS CTA.
 const volunteer=navigation?.volunteerJoin?.visible===true&&navigation.volunteerJoin.path==="/volunteer"?
  "/volunteer":undefined;
 const routes=navigation?.publishedRoutes??[];
 const isPublished=(path:string)=>routes.some(x=>x.path===path);
 const defaultAddress="Bhagwangola, Murshidabad";
 const defaultEmail="info@careganga.com";
 const defaultPhone="+91 97325 20058";
 const displayAddress=contact?.address?.trim()||defaultAddress;
 const displayEmail=contact?.email?.trim()||defaultEmail;
 const displayPhone=contact?.phone?.trim()||defaultPhone;

 return <header ref={header} className="cg-site-header" onKeyDown={event=>{
  if(event.key!=="Escape")return;
  const open=header.current?.querySelector<HTMLDetailsElement>("details[open]");
  if(open){open.open=false;open.querySelector("summary")?.focus();}
  else if(expanded){setExpanded(false);toggle.current?.focus();}
  else return;
  event.preventDefault();event.stopPropagation();
 }}>
  <div className="cg-site-contact-strip">
   <div className="cg-site-strip-inner">
    <div className="cg-site-connect-block">
     <Link className="cg-site-connect" href="/contact">
      CONNECT:
     </Link>
     <div className="cg-site-social-icons">
      <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="cg-social-icon">
       <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95z"/></svg>
      </a>
      <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" aria-label="YouTube" className="cg-social-icon">
       <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M21.58 7.19c-.23-.86-.91-1.54-1.77-1.77C18.25 5 12 5 12 5s-6.25 0-7.81.42c-.86.23-1.54.91-1.77 1.77C2 8.75 2 12 2 12s0 3.25.42 4.81c.23.86.91 1.54 1.77 1.77C5.75 19 12 19 12 19s6.25 0 7.81-.42c.86-.23 1.54-.91 1.77-1.77C22 15.25 22 12 22 12s0-3.25-.42-4.81zM10 15V9l5.2 3-5.2 3z"/></svg>
      </a>
      <a href="https://wa.me/919732520058" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="cg-social-icon">
       <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2m.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.196 8.196 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24m4.52 11.66c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.13-1.06-.39-2.01-1.24-.74-.66-1.24-1.48-1.39-1.73-.14-.25-.02-.39.11-.51.11-.11.25-.29.37-.43.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43h-.47c-.17 0-.44.06-.66.31-.23.25-.87.85-.87 2.07 0 1.22.89 2.4 1.01 2.57.13.17 1.75 2.67 4.24 3.74.59.26 1.05.41 1.41.53.6.19 1.14.16 1.57.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.15-1.18-.06-.1-.23-.17-.48-.29z"/></svg>
      </a>
     </div>
    </div>
    <div className="cg-site-contact-details">
     <span>
      <svg className="cg-contact-icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8zm0 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/></svg>
      {displayAddress}
     </span>
     <a href={"mailto:"+displayEmail}>
      <svg className="cg-contact-icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 7L2 7"/></svg>
      {displayEmail}
     </a>
     <a href={"tel:"+displayPhone.replace(/[^+0-9]/g,"")}>
      <svg className="cg-contact-icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
      {displayPhone}
     </a>
    </div>
   </div>
  </div>
  <div className="cg-site-nav-shell">
   <Link href="/" className="cg-site-brand" aria-label="CareGanga Foundation homepage">
    <img src="/logo.png" alt="CareGanga logo" width={56} height={56}/>
    <span><strong>CareGanga</strong><small>FOUNDATION</small></span>
   </Link>
   <button ref={toggle} className="cg-site-menu-toggle" type="button"
    aria-label={expanded?"Close website navigation":"Open website navigation"}
    aria-expanded={expanded} aria-controls="cg-site-navigation"
    onClick={()=>{closeDropdowns();setExpanded(x=>!x);}}>{expanded?"Close":"Menu"} <span aria-hidden="true">☰</span></button>
   <nav id="cg-site-navigation" aria-label="CareGanga public website"
    className={expanded?"cg-site-nav cg-site-nav-open":"cg-site-nav"} onClick={event=>{
     if(event.target instanceof Element&&event.target.closest("a[href]"))closeNavigation();
    }}>
    <Link href="/" className={pathname==="/"? "cg-site-active":undefined} aria-current={pathname==="/"?"page":undefined}>Home</Link>
    <Menu pathname={pathname} label="About Us" items={[{text:"About the Foundation",href:isPublished("/about")?"/about":undefined},{text:"Team Directory",href:"/about/team"}]}/>
    <Menu pathname={pathname} label="Our Work" items={work.map(text=>({text,href:isPublished("/our-work")?"/our-work"+(text==="All Projects"?"":"?category="+encodeURIComponent(text)):undefined}))}/>
    {isPublished("/ngo-information")?<Link href="/ngo-information"
     className={inSection(pathname,"/ngo-information")?"cg-site-active":undefined} aria-current={pathname==="/ngo-information"?"page":undefined}>NGO Information</Link>:
     <span className="cg-site-unavailable" aria-disabled="true">NGO Information<small>Not available yet</small></span>}
    {isPublished("/donate")&&<Link href="/donate" className={inSection(pathname,"/donate")?"cg-site-active":undefined} aria-current={pathname==="/donate"?"page":undefined}>Donate Now</Link>}
    {/* The catalogue is a safe public information route even when no campaigns are published.
        The catalogue and payment owner still enforce actual publication and merchant readiness. */}
    <Link href="/campaigns" className={inSection(pathname,"/campaigns")?"cg-site-active":undefined}
     aria-current={pathname==="/campaigns"?"page":undefined}>Campaigns</Link>
    {isPublished("/upcoming-projects")?<Link href="/upcoming-projects" className={inSection(pathname,"/upcoming-projects")?"cg-site-active":undefined} aria-current={pathname==="/upcoming-projects"?"page":undefined}>Upcoming Projects</Link>:<span className="cg-site-unavailable" aria-disabled="true">Upcoming Projects<small>Not available yet</small></span>}
    <Link href="/collaboration" className={inSection(pathname,"/collaboration")?"cg-site-active":undefined} aria-current={pathname==="/collaboration"?"page":undefined}>Partnerships</Link>
    <Link href="/events" className={inSection(pathname,"/events")?"cg-site-active":undefined} aria-current={pathname==="/events"?"page":undefined}>Events</Link>
    <Menu pathname={pathname} label="Media & Resources" items={media.map(text=>({text,
     href:text==="Gallery"&&isPublished("/gallery")?"/gallery":
      text==="Videos"&&isPublished("/gallery")?"/videos":
      text==="Publications / Reports"&&isPublished("/gallery")?
       "/publications":
      text==="News & Updates"?"/notices":
      text==="Blog"?"/blog":undefined}))}/>
    <Menu pathname={pathname} label="Join Now" items={[{text:"Become a Member",href:member},
     {text:"Become a Volunteer",href:volunteer}]}/>
    <Link href={isPublished("/healthcare")?"/healthcare":"/health-network"}
     className={inSection(pathname,"/healthcare")||inSection(pathname,"/health-network")||inSection(pathname,"/patients/me")||pathname==="/verify-appointment"?"cg-site-active":undefined}
     aria-current={pathname===(isPublished("/healthcare")?"/healthcare":"/health-network")?"page":undefined}>
     Healthcare Assistance</Link>
    <Link href="/contact" className={inSection(pathname,"/contact")?"cg-site-active":undefined} aria-current={pathname==="/contact"?"page":undefined}>Contact Us</Link>
    <Link className="cg-site-login-btn" href="/admin/login" aria-current={pathname==="/admin/login"?"page":undefined}>LOGIN</Link>
    <Link className="cg-site-donate-btn" href="/donate" aria-label="Donate Now">♥ DONATE NOW</Link>
   </nav>
  </div>
 </header>;
}
