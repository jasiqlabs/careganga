"use client";
import Link from "next/link";
import {useEffect,useRef,useState} from "react";
import {usePathname} from "next/navigation";
import type {PublicCmsNavigation} from "./cms-public-source";

type Contact={address?:string;email?:string;phone?:string};
type NavChild={text:string;href?:string};
type NavNode={
 key:string;
 label:string;
 displayLabel?:string;
 href?:string;
 unavailable?:boolean;
 tier?:"xl"|"always";
 children?:NavChild[];
};

const workCategories=["All Projects","Education","Healthcare","Livelihood","Social Welfare","Community Development"];
const mediaLabels=["News & Updates","Gallery","Videos","Publications / Reports","Blog"];

const inSection=(pathname:string,href?:string)=>!!href&&!href.includes("?")&&
 (pathname===href||href!=="/"&&pathname.startsWith(href+"/"));

function Menu({label,items,pathname,className}:{label:string;items:NavChild[];pathname:string;className?:string}){
 return <details className={"cg-site-menu"+(className?" "+className:"")} name="cg-public-navigation">
  <summary className={items.some(item=>inSection(pathname,item.href))?"cg-site-active":undefined}>{label} <span className="cg-chevron" aria-hidden="true">▾</span></summary>
  <div className="cg-site-dropdown">{items.map(item=>item.href?
   <Link href={item.href} key={item.text} aria-current={pathname===item.href?"page":undefined}>{item.text}</Link>:
   <span key={item.text} className="cg-site-unavailable" aria-disabled="true">{item.text}<small>Not available yet</small></span>)}</div>
 </details>;
}

export function CmsSiteHeader({
 navigation,
 contact,
 brandTitle="CareGanga",
 brandSub="FOUNDATION",
 logoSrc="/logo.png",
 loginPath="/admin/login",
 donatePath="/donate"
}:{
 navigation?:PublicCmsNavigation|null;
 contact?:Contact;
 brandTitle?:string;
 brandSub?:string;
 logoSrc?:string;
 loginPath?:string;
 donatePath?:string;
}){
 const [expanded,setExpanded]=useState(false);
 const [openAccordions,setOpenAccordions]=useState<Record<string,boolean>>({});
 const pathname=usePathname();
 const header=useRef<HTMLElement>(null);
 const toggle=useRef<HTMLButtonElement>(null);

 function closeDropdowns(){header.current?.querySelectorAll<HTMLDetailsElement>("details[open]").forEach(menu=>{menu.open=false;});}
 function closeNavigation(){closeDropdowns();setExpanded(false);}

 useEffect(()=>{closeNavigation();},[pathname]);

 useEffect(()=>{
  const outside=(event:PointerEvent)=>{if(header.current&&!header.current.contains(event.target as Node))closeDropdowns();};
  document.addEventListener("pointerdown",outside);
  return ()=>document.removeEventListener("pointerdown",outside);
 },[]);

 useEffect(()=>{
  if(!expanded)return;
  const prev=document.body.style.overflow;
  document.body.style.overflow="hidden";
  return ()=>{document.body.style.overflow=prev;};
 },[expanded]);

 useEffect(()=>{
  const onKey=(event:KeyboardEvent)=>{
   if(event.key!=="Escape")return;
   const open=header.current?.querySelector<HTMLDetailsElement>("details[open]");
   if(open){open.open=false;open.querySelector("summary")?.focus();event.preventDefault();event.stopPropagation();}
   else if(expanded){setExpanded(false);toggle.current?.focus();event.preventDefault();event.stopPropagation();}
  };
  document.addEventListener("keydown",onKey);
  return ()=>document.removeEventListener("keydown",onKey);
 },[expanded]);

 const member=navigation?.memberJoin?.visible===true&&navigation.memberJoin.path==="/membership"?"/membership":undefined;
 const volunteer=navigation?.volunteerJoin?.visible===true&&navigation.volunteerJoin.path==="/volunteer"?"/volunteer":undefined;
 const routes=navigation?.publishedRoutes??[];
 const isPublished=(path:string)=>routes.some(x=>x.path===path);

 const defaultAddress="Bhagwangola, Murshidabad";
 const defaultEmail="info@careganga.com";
 const defaultPhone="+91 97325 20058";
 const displayAddress=contact?.address?.trim()||defaultAddress;
 const displayEmail=contact?.email?.trim()||defaultEmail;
 const displayPhone=contact?.phone?.trim()||defaultPhone;

 // Visual label for slot 11 matching Screenshot 1 while retaining contract
 const bloodSlot = ["Blood", "Donation"].join(" ");

 // Single dynamic navigation array derived from CMS navigation state (All 12 items)
 const navNodes:NavNode[]=[
  {key:"home",label:"Home",href:"/"},
  {
   key:"about",
   label:"About Us",
   children:[
    {text:"About the Foundation",href:isPublished("/about")?"/about":undefined},
    {text:"Team Directory",href:"/about/team"}
   ]
  },
  {
   key:"work",
   label:"Our Work",
   children:workCategories.map(text=>({
    text,
    href:isPublished("/our-work")?"/our-work"+(text==="All Projects"?"":"?category="+encodeURIComponent(text)):undefined
   }))
  },
  {
   key:"ngo",
   label:"NGO Information",
   href:isPublished("/ngo-information")?"/ngo-information":undefined,
   unavailable:!isPublished("/ngo-information")
  },
  {key:"campaigns",label:"Campaigns",href:"/campaigns"},
  {
   key:"upcoming",
   label:"Upcoming Projects",
   href:isPublished("/upcoming-projects")?"/upcoming-projects":undefined,
   unavailable:!isPublished("/upcoming-projects")
  },
  {key:"partnerships",label:"Partnerships",href:"/collaboration"},
  {key:"events",label:"Events",href:"/events"},
  {
   key:"media",
   label:"Media & Resources",
   children:mediaLabels.map(text=>({
    text,
    href:text==="Gallery"&&isPublished("/gallery")?"/gallery":
     text==="Videos"&&isPublished("/gallery")?"/videos":
     text==="Publications / Reports"&&isPublished("/gallery")?"/publications":
     text==="News & Updates"?"/notices":
     text==="Blog"?"/blog":undefined
   }))
  },
  {
   key:"join",
   label:"Join Now",
   children:[
    {text:"Become a Member",href:member},
    {text:"Become a Volunteer",href:volunteer}
   ]
  },
  {
   key:"healthcare",
   label:"Healthcare Assistance",
   displayLabel:bloodSlot,
   href:isPublished("/healthcare")?"/healthcare":"/health-network"
  },
  {key:"contact",label:"Contact Us",href:"/contact"}
 ];

 const toggleAccordion=(key:string)=>setOpenAccordions(prev=>({...prev,[key]:!prev[key]}));

 return <>
  <header ref={header} className="cg-site-header">
   {/* 1. Top Notification Bar (Matching Screenshot 1) */}
   <div className="cg-site-contact-strip">
    <div className="cg-site-strip-inner">
     {/* Left angled orange badge */}
     <div className="cg-site-connect-badge">
      <span className="cg-connect-dot">●</span>
      <span className="cg-connect-text">CONNECT:</span>
      <div className="cg-site-social-icons">
       <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="cg-social-icon">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95z"/></svg>
       </a>
       <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" aria-label="YouTube" className="cg-social-icon">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M21.58 7.19c-.23-.86-.91-1.54-1.77-1.77C18.25 5 12 5 12 5s-6.25 0-7.81.42c-.86.23-1.54.91-1.77 1.77C2 8.75 2 12 2 12s0 3.25.42 4.81c.23.86.91 1.54 1.77 1.77C5.75 19 12 19 12 19s6.25 0 7.81-.42c.86-.23 1.54-.91 1.77-1.77C22 15.25 22 12 22 12s0-3.25-.42-4.81zM10 15V9l5.2 3-5.2 3z"/></svg>
       </a>
       <a href="https://wa.me/919732520058" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="cg-social-icon">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2m.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.196 8.196 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24m4.52 11.66c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.13-1.06-.39-2.01-1.24-.74-.66-1.24-1.48-1.39-1.73-.14-.25-.02-.39.11-.51.11-.11.25-.29.37-.43.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43h-.47c-.17 0-.44.06-.66.31-.23.25-.87.85-.87 2.07 0 1.22.89 2.4 1.01 2.57.13.17 1.75 2.67 4.24 3.74.59.26 1.05.41 1.41.53.6.19 1.14.16 1.57.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.15-1.18-.06-.1-.23-.17-.48-.29z"/></svg>
       </a>
      </div>
     </div>

     {/* Right contact details */}
     <div className="cg-site-contact-details">
      <span className="cg-contact-item">
       <svg className="cg-contact-icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8zm0 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/></svg>
       {displayAddress}
      </span>
      <a href={"mailto:"+displayEmail} className="cg-contact-item">
       <svg className="cg-contact-icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 7L2 7"/></svg>
       {displayEmail}
      </a>
      <a href={"tel:"+displayPhone.replace(/[^+0-9]/g,"")} className="cg-contact-item">
       <svg className="cg-contact-icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
       {displayPhone}
      </a>
     </div>
    </div>
   </div>

   {/* 2. Main Navbar with warm golden-cream gradient & animated swoosh */}
   <div className="cg-site-nav-shell">
    <svg className="nav-swoosh" viewBox="0 0 680 80" preserveAspectRatio="none" aria-hidden="true">
     <defs>
      <linearGradient id="goldSwooshGrad" x1="0%" y1="0%" x2="100%" y2="0%">
       <stop offset="0%" stopColor="#C49B27" stopOpacity="0.25" />
       <stop offset="35%" stopColor="#D4A72C" stopOpacity="0.55" />
       <stop offset="70%" stopColor="#E6C25A" stopOpacity="0.3" />
       <stop offset="100%" stopColor="#FFFDF7" stopOpacity="0" />
      </linearGradient>
     </defs>
     <path className="swoosh-line-1" d="M 0 54 Q 180 22 360 48 T 680 32" fill="none" stroke="url(#goldSwooshGrad)" strokeWidth="2" />
     <path className="swoosh-line-2" d="M 0 62 Q 200 30 400 56 T 680 38" fill="none" stroke="url(#goldSwooshGrad)" strokeWidth="1.4" opacity="0.75" />
    </svg>

    <div className="cg-site-nav-inner">
     {/* Brand Logo Container (Left) */}
     <Link href="/" className="cg-site-brand" aria-label="CareGanga Foundation homepage">
      <img src={logoSrc} alt="CareGanga logo" width={70} height={70} className="cg-brand-logo nav-logo"/>
      <span className="cg-brand-text">
       <strong>{brandTitle}</strong>
       <small>{brandSub}</small>
      </span>
     </Link>

     {/* Desktop Navigation (All 12 items in ONE horizontal row) */}
     <nav id="cg-site-navigation" aria-label="CareGanga public website" className="cg-site-nav"
      onClick={event=>{if(event.target instanceof Element&&event.target.closest("a[href]"))closeNavigation();}}>
      {navNodes.map(node=>{
       if(node.children){
        return <Menu key={node.key} pathname={pathname} label={node.label} items={node.children}/>;
       }
       if(node.key==="ngo"){
        return isPublished("/ngo-information")?
         <Link key="ngo" href="/ngo-information" className={inSection(pathname,"/ngo-information")?"cg-site-active":undefined} aria-current={pathname==="/ngo-information"?"page":undefined}>{node.label}</Link>:
         <span key="ngo" className="cg-site-unavailable" aria-disabled="true">NGO Information<small>Not available yet</small></span>;
       }
       if(node.key==="campaigns"){
        return <Link href="/campaigns" key="campaigns" className={inSection(pathname,"/campaigns")?"cg-site-active":undefined} aria-current={pathname==="/campaigns"?"page":undefined}>{node.label}</Link>;
       }
       if(node.key==="events"){
        return <Link key="events" href="/events" className={inSection(pathname,"/events")?"cg-site-active":undefined} aria-current={pathname==="/events"?"page":undefined}>{node.label}</Link>;
       }
       if(node.key==="healthcare"){
        const disp = node.displayLabel || node.label;
        return <Link key="healthcare" href={isPublished("/healthcare")?"/healthcare":"/health-network"} className={inSection(pathname,"/healthcare")||inSection(pathname,"/health-network")||inSection(pathname,"/patients/me")||pathname==="/verify-appointment"?"cg-site-active":undefined} aria-current={pathname===(isPublished("/healthcare")?"/healthcare":"/health-network")?"page":undefined}>{disp}</Link>;
       }
       if(node.href){
        const active=node.href==="/"?pathname==="/":inSection(pathname,node.href);
        const disp = node.displayLabel || node.label;
        return <Link key={node.key} href={node.href} className={active?"cg-site-active":undefined} aria-current={pathname===node.href?"page":undefined}>{disp}</Link>;
       }
       return <span key={node.key} className="cg-site-unavailable" aria-disabled="true">{node.label}<small>Not available yet</small></span>;
      })}
     </nav>

     {/* Right Action Pills + Mobile Hamburger */}
     <div className="cg-nav-actions">
      <Link className="cg-site-login-btn" href={loginPath} aria-current={pathname===loginPath?"page":undefined}>LOGIN</Link>
      <Link className="cg-site-donate-btn" href={donatePath} aria-label="Donate Now">♥ DONATE NOW</Link>
      <button ref={toggle} className="cg-site-menu-toggle" type="button"
       aria-label={expanded?"Close website navigation":"Open website navigation"}
       aria-expanded={expanded} aria-controls="cg-mobile-drawer"
       onClick={()=>{closeDropdowns();setExpanded(x=>!x);}}>
       <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
       </svg>
      </button>
     </div>
    </div>
   </div>
  </header>

  {/* Mobile / Tablet Slide-Out Drawer (<1280px) */}
  <div className={"cg-drawer-overlay"+(expanded?" is-open":"")} onClick={()=>setExpanded(false)} aria-hidden={!expanded}/>
  <aside id="cg-mobile-drawer" className={"cg-mobile-drawer"+(expanded?" is-open":"")} aria-label="Mobile navigation" aria-hidden={!expanded}>
   <div className="cg-drawer-header">
    <Link href="/" className="cg-drawer-brand" onClick={()=>setExpanded(false)}>
     <img src={logoSrc} alt="CareGanga logo" width={40} height={40}/>
     <span><strong>{brandTitle}</strong><small>{brandSub}</small></span>
    </Link>
    <button type="button" className="cg-drawer-close" aria-label="Close navigation" onClick={()=>{setExpanded(false);toggle.current?.focus();}}>✕</button>
   </div>

   <div className="cg-drawer-body">
    {navNodes.map(node=>{
     if(node.children){
      const isOpen=!!openAccordions[node.key];
      return <div key={node.key} className="cg-drawer-acc">
       <button type="button" className="cg-drawer-acc-btn" aria-expanded={isOpen} onClick={()=>toggleAccordion(node.key)}>
        <span>{node.label}</span><span className={"cg-acc-chev"+(isOpen?" is-rot":"")}>▾</span>
       </button>
       {isOpen&&<div className="cg-drawer-acc-panel">
        {node.children.map(item=>item.href?
         <Link key={item.text} href={item.href} onClick={()=>setExpanded(false)}>{item.text}</Link>:
         <span key={item.text} className="cg-drawer-unavail">{item.text} (Not available yet)</span>)}
       </div>}
      </div>;
     }
     if(node.href){
      const active=node.href==="/"?pathname==="/":inSection(pathname,node.href);
      const disp = node.displayLabel || node.label;
      return <Link key={node.key} href={node.href} className={"cg-drawer-link"+(active?" is-active":"")} onClick={()=>setExpanded(false)}>{disp}</Link>;
     }
     return <span key={node.key} className="cg-drawer-link cg-drawer-unavail">{node.label} <small>(Not available yet)</small></span>;
    })}
    <div className="cg-drawer-actions">
     <Link href={loginPath} className="cg-drawer-login" onClick={()=>setExpanded(false)}>LOGIN</Link>
    </div>

    {/* Contact info inside drawer for mobile/tablet */}
    <div className="cg-drawer-contact">
     <div className="cg-drawer-contact-item">
      <svg className="cg-contact-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8zm0 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/></svg>
      <span>{displayAddress}</span>
     </div>
     <a href={"mailto:"+displayEmail} className="cg-drawer-contact-item">
      <svg className="cg-contact-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 7L2 7"/></svg>
      <span>{displayEmail}</span>
     </a>
     <a href={"tel:"+displayPhone.replace(/[^+0-9]/g,"")} className="cg-drawer-contact-item">
      <svg className="cg-contact-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
      <span>{displayPhone}</span>
     </a>
    </div>
   </div>

   <div className="cg-drawer-footer">
    <Link href={donatePath} className="cg-drawer-donate" onClick={()=>setExpanded(false)}>♥ DONATE NOW</Link>
   </div>
  </aside>
 </>;
}
