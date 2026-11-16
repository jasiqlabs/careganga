"use client";
import Link from "next/link";
import {useEffect,useState} from "react";

type FoundationAdminNavProps={
  active:"account"|"roles"|"accounts"|"policy"|"settings"|"audit"|"recovery"|"approvals"|"documents"|"foundation";
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
  canViewFoundation?:boolean;
};
/** Only delivered CG-01 destinations. Never show unfinished future-module menus. */
export function FoundationAdminNav({active,displayName,roleName,canViewRoles,canViewAccounts,canManageSecurityPolicy=false,canViewSettings=false,
  canViewAudit=false,canViewRecovery=false,canViewApprovals=false,
  canViewDocuments=false,canViewFoundation=false}:FoundationAdminNavProps){
  const [query,setQuery]=useState("");
  const [foundationAccess,setFoundationAccess]=useState(canViewFoundation);
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
      })
      .catch(()=>{if(live)setFoundationAccess(false);});
    return()=>{live=false;};
  },[]);

  const links=[
    {key:"account" as const,label:"My account",href:"/admin"},
    ...(canViewAccounts?[{key:"accounts" as const,label:"Users Management",href:"/admin/accounts"}]:[]),
    ...(canViewRoles?[{key:"roles" as const,label:"Roles & permissions",href:"/admin/roles"}]:[]),
    ...(foundationAccess?[{key:"foundation" as const,label:"Foundation Structure",href:"/admin/foundation"}]:[]),
    ...(canManageSecurityPolicy?[{key:"policy" as const,label:"Security Policy",href:"/admin/security-policy"}]:[]),
    ...(canViewSettings?[{key:"settings" as const,label:"General Settings",href:"/admin/settings"}]:[]),
    ...(canViewAudit?[{key:"audit" as const,label:"Audit Logs",href:"/admin/audit"}]:[]),
    ...(canViewRecovery?[{key:"recovery" as const,label:"Backup & Restore",href:"/admin/backup-recovery"}]:[]),
    ...(canViewApprovals?[{key:"approvals" as const,label:"Registration & Approval",href:"/admin/approvals"}]:[]),
    ...(canViewDocuments?[{key:"documents" as const,label:"Private Case Documents",href:"/admin/documents"}]:[])
  ].filter(item=>item.label.toLowerCase().includes(query.trim().toLowerCase()));
  return <nav className="sidebar" aria-label="Foundation navigation">
    <div className="sidebar-brand"><img alt="" src="/careganga-mark.png" width="48" height="48"/><div className="sidebar-brand-name"><strong>CAREGANGA</strong><span>FOUNDATION</span></div></div>
    <div className="sidebar-filter">
      <label htmlFor="foundation-menu-filter">Search menu</label>
      <input id="foundation-menu-filter" type="search" value={query}
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
  </nav>;
}
