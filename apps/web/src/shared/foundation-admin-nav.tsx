"use client";
import Link from "next/link";
import {useEffect,useRef,useState} from "react";

type FoundationAdminNavProps={
  active:"account"|"roles"|"accounts"|"policy"|"settings"|"audit"|"recovery"|"approvals"|"documents"|"communications"|"support"|"foundation"|"branches";
  displayName:string;
  roleName:string;
  canViewRoles:boolean;
  canViewAccounts:boolean;
  canManageSecurityPolicy?:boolean;
  canViewSettings?:boolean;
  canViewAudit?:boolean;
  canViewRecovery?:boolean;
  canViewApprovals?:boolean;
  canViewDocuments?:boolean;
  canViewCommunications?:boolean;
  canViewSupport?:boolean;
  canViewFoundation?:boolean;
  canViewBranches?:boolean;
};
/** Only delivered CG-01 destinations. Never show unfinished future-module menus. */
export function FoundationAdminNav({active,displayName,roleName,canViewRoles,canViewAccounts,canManageSecurityPolicy=false,canViewSettings=false,
  canViewAudit=false,canViewRecovery=false,canViewApprovals=false,
  canViewDocuments=false,canViewCommunications=false,canViewSupport=false,canViewFoundation=false,canViewBranches=false}:FoundationAdminNavProps){
  const [query,setQuery]=useState("");
  const searchRef=useRef<HTMLInputElement>(null);
  // Unlike the old admin screenshot's unverified people search, this
  // actually searches only delivered and currently-permitted navigation.
  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="k"){
        event.preventDefault();searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown",onKey);
    return()=>window.removeEventListener("keydown",onKey);
  },[]);
  const [foundationAccess,setFoundationAccess]=useState(canViewFoundation);
  const [branchAccess,setBranchAccess]=useState(canViewBranches);
  // One authenticated current-rights refresh per navigation mount. No polling or client-only authority.
  useEffect(()=>{
    let live=true;
    void fetch("/api/access/effective",{cache:"no-store"})
      .then(async response=>{
        if(!response.ok)throw new Error("Access unavailable");
        return response.json() as Promise<unknown>;
      })
      .then(result=>{
        if(!live)return;
        const allowed=Boolean(result&&typeof result==="object"&&"actions" in result
          &&Array.isArray(result.actions)&&result.actions.some((x:unknown)=>
            Boolean(x)&&typeof x==="object"&&"key" in x&&
              ["foundation.profile.view","foundation.geography.view","foundation.departments.view"].includes(String(x.key))));
        setFoundationAccess(allowed);
        const canBranches=Boolean(result&&typeof result==="object"&&"actions" in result&&
          Array.isArray(result.actions)&&result.actions.some((x:unknown)=>
            Boolean(x)&&typeof x==="object"&&"key" in x&&String(x.key)==="foundation.branches.view"));
        setBranchAccess(canBranches);
      })
      .catch(()=>{if(live){setFoundationAccess(false);setBranchAccess(false);}});
    return()=>{live=false;};
  },[]);

  const links=[
    {key:"account" as const,label:"My account",href:"/admin"},
    ...(canViewAccounts?[{key:"accounts" as const,label:"Users Management",href:"/admin/accounts"}]:[]),
    ...(canViewRoles?[{key:"roles" as const,label:"Roles & permissions",href:"/admin/roles"}]:[]),
    ...(foundationAccess?[{key:"foundation" as const,label:"Foundation Structure",href:"/admin/foundation"}]:[]),
    ...(branchAccess?[{key:"branches" as const,label:"Branches & registration",href:"/admin/foundation/branches"}]:[]),
    ...(canManageSecurityPolicy?[{key:"policy" as const,label:"Security Policy",href:"/admin/security-policy"}]:[]),
    ...(canViewSettings?[{key:"settings" as const,label:"General Settings",href:"/admin/settings"}]:[]),
    ...(canViewAudit?[{key:"audit" as const,label:"Audit Logs",href:"/admin/audit"}]:[]),
    ...(canViewRecovery?[{key:"recovery" as const,label:"Backup & Restore",href:"/admin/backup-recovery"}]:[]),
    ...(canViewApprovals?[{key:"approvals" as const,label:"Registration & Approval",href:"/admin/approvals"}]:[]),
    ...(canViewDocuments?[{key:"documents" as const,label:"Private Case Documents",href:"/admin/documents"}]:[]),
    ...(canViewCommunications?[{key:"communications" as const,label:"Notices & Notifications",href:"/admin/communications"}]:[]),
    ...(canViewSupport?[{key:"support" as const,label:"Contact Messages & Help",href:"/admin/support"}]:[])
  ].filter(item=>item.label.toLowerCase().includes(query.trim().toLowerCase()));
  const titles:Record<FoundationAdminNavProps["active"],string>={
    account:"Foundation Dashboard",roles:"Roles & Permissions",
    accounts:"Users Management",policy:"Security Policy",settings:"General Settings",
    audit:"Audit Logs",recovery:"Backup & Restore",
    approvals:"Registration & Approval",documents:"Private Case Documents",
    communications:"Notices & Notifications",support:"Help & Support",
    foundation:"Departments / Committees",branches:"Branches / Locations"
  };
  return <><nav className="sidebar" aria-label="Foundation navigation">
    <div className="sidebar-brand"><img alt="" src="/careganga-mark.png" width="48" height="48"/><div className="sidebar-brand-name"><strong>CAREGANGA</strong><span>FOUNDATION</span></div></div>
    <div className="sidebar-filter">
      <label htmlFor="foundation-menu-filter">Search menu</label>
      <input ref={searchRef} id="foundation-menu-filter" type="search" value={query}
        onChange={event=>setQuery(event.target.value)}
        placeholder="Search menu..." autoComplete="off"/>
    </div>
    <p className="sidebar-section">FOUNDATION ACCESS</p>
    <div className="sidebar-links">
      {links.map(item=><Link key={item.key} href={item.href}
        aria-current={active===item.key?"page":undefined}
        className={"sidebar-link"+(active===item.key?" selected":"")}>
        {item.label}
      </Link>)}
      {links.length===0&&<p className="sidebar-empty">No matching menu item.</p>}
    </div>
    <div className="sidebar-user">
      <strong>{displayName}</strong>
      <span>{roleName} · Foundation</span>
    </div>
  </nav>
    <header className="admin-topbar">
      <div className="admin-topbar-title">
        <h1>{titles[active]}</h1>
        <p>Foundation Control Panel</p>
      </div>
      <div className="admin-topbar-tools">
        <label htmlFor="admin-topbar-module-search" className="admin-topbar-search">
          <span>Search available modules</span>
          <input id="admin-topbar-module-search" type="search"
            aria-label="Search permitted admin modules" value={query}
            onChange={event=>setQuery(event.target.value)} placeholder="Search permitted modules..."
            autoComplete="off"/>
            <kbd aria-hidden="true">Ctrl K</kbd>
        </label>
        {canViewCommunications&&<Link className="admin-topbar-link"
          href="/admin/communications">Notifications</Link>}
        <Link className="admin-topbar-link" href="/">View Site</Link>
        <Link className="admin-topbar-link" href="/contact">Help</Link>
        <Link className="admin-topbar-identity" href="/admin"
          aria-label="My Foundation account">
          <span className="admin-topbar-avatar" aria-hidden="true">
            {displayName.trim().slice(0,1).toUpperCase()||"F"}
          </span>
          <span><strong>{displayName}</strong><small>{roleName}</small></span>
        </Link>
      </div>
    </header>
  </>;
}
