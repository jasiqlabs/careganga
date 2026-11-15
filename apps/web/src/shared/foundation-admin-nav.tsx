"use client";
import Link from "next/link";
import {useState} from "react";

type FoundationAdminNavProps={
  active:"account"|"roles"|"accounts"|"policy";
  displayName:string;
  roleName:string;
  canViewRoles:boolean;
  canViewAccounts:boolean;
  canManageSecurityPolicy?:boolean;
};
/** Only delivered CG-01 destinations. Never show unfinished future-module menus. */
export function FoundationAdminNav({active,displayName,roleName,canViewRoles,canViewAccounts,canManageSecurityPolicy=false}:FoundationAdminNavProps){
  const [query,setQuery]=useState("");
  const links=[
    {key:"account" as const,label:"My account",href:"/admin"},
    ...(canViewAccounts?[{key:"accounts" as const,label:"Users Management",href:"/admin/accounts"}]:[]),
    ...(canViewRoles?[{key:"roles" as const,label:"Roles & permissions",href:"/admin/roles"}]:[]),
    ...(canManageSecurityPolicy?[{key:"policy" as const,label:"Security Policy",href:"/admin/security-policy"}]:[])
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
