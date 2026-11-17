"use client";
import Link from "next/link";
import {useEffect,useRef,useState} from "react";

type FoundationAdminNavProps={
  active:"account"|"roles"|"accounts"|"policy"|"settings"|"audit"|"recovery"|"approvals"|"documents"|"communications"|"support"|"foundation"|"branches"|"finance"|"financeVouchers"|"financeReviews"|"financeClaims"|"financeClaimReviews"|"financeInvoices"|"financeInvoiceReviews"|"financeBudgets"|"financeBudgetReviews";
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
  canViewFinance?:boolean;
  canViewVouchers?:boolean;
  canReviewFinance?:boolean;
  canViewClaims?:boolean;
  canReviewClaims?:boolean;
  canViewInvoices?:boolean;
  canReviewInvoices?:boolean;
  canViewBudgets?:boolean;
  canReviewBudgets?:boolean;
};
/** Only delivered CG-01 destinations. Never show unfinished future-module menus. */
export function FoundationAdminNav({active,displayName,roleName,canViewRoles,canViewAccounts,canManageSecurityPolicy=false,canViewSettings=false,
  canViewAudit=false,canViewRecovery=false,canViewApprovals=false,
  canViewDocuments=false,canViewCommunications=false,canViewSupport=false,canViewFoundation=false,canViewBranches=false,canViewFinance=false,canViewVouchers=false,canReviewFinance=false,canViewClaims=false,canReviewClaims=false,canViewInvoices=false,canReviewInvoices=false,canViewBudgets=false,canReviewBudgets=false}:FoundationAdminNavProps){
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
  const [currentActions,setCurrentActions]=useState<Set<string>|null>(null);
  // Every protected menu is revalidated from the same current CG-01
  // effective-access source. A failed refresh hides all restricted links.
  useEffect(()=>{
    let live=true;
    void fetch("/api/access/effective",{cache:"no-store"})
      .then(async response=>{
        if(!response.ok)throw new Error("Access unavailable");
        return response.json() as Promise<unknown>;
      }).then(result=>{
        if(!live)return;
        if(!result||typeof result!=="object"||!("actions" in result)||
           !Array.isArray(result.actions))throw new Error("Access incomplete");
        setCurrentActions(new Set(result.actions.flatMap((item:unknown)=>
          item&&typeof item==="object"&&"key" in item&&
          typeof item.key==="string"?[item.key]:[])));
      }).catch(()=>{if(live)setCurrentActions(new Set());});
    return()=>{live=false;};
  },[]);
  const allowed=(key:string,initial:boolean)=>currentActions?
    currentActions.has(key):initial;
  const foundationAccess=currentActions?
    ["foundation.profile.view","foundation.geography.view","foundation.departments.view"]
      .some(key=>currentActions.has(key)):canViewFoundation;
  const branchAccess=allowed("foundation.branches.view",canViewBranches);
  // Create-only staff operators must see the destination they are authorized to use.
  const accountsAccess=currentActions?
    (currentActions.has("accounts.view")||
      (currentActions.has("accounts.create")&&currentActions.has("roles.assign"))):
    canViewAccounts;
  const rolesAccess=allowed("roles.view",canViewRoles);
  const policyAccess=allowed("identity.security-policy.manage",canManageSecurityPolicy);
  const settingsAccess=allowed("platform.settings.view",canViewSettings);
  const auditAccess=allowed("platform.audit.view",canViewAudit);
  const recoveryAccess=allowed("platform.recovery.view",canViewRecovery);
  const approvalAccess=currentActions?
    ["approvals.view","approvals.propose"].some(key=>currentActions.has(key)):canViewApprovals;
  const documentAccess=currentActions?
    ["documents.files.view","documents.files.manage"].every(key=>currentActions.has(key))&&approvalAccess:
    canViewDocuments;
  const communicationAccess=currentActions?
    ["communications.notifications.view","communications.notices.manage",
      "communications.notices.approve","communications.delivery.view",
      "communications.delivery.process"].some(key=>currentActions.has(key)):canViewCommunications;
  const supportAccess=currentActions?
    ["support.cases.view","support.faq.manage"].some(key=>currentActions.has(key)):canViewSupport;

  const financeAccess=allowed("finance.accounts.view",canViewFinance);
  const voucherAccess=allowed("finance.vouchers.view",canViewVouchers);
  const claimsReviewerAccess=currentActions?
    ["approvals.review","finance.claims.review","documents.files.view"]
      .every(k=>currentActions.has(k)):canReviewClaims;
  const claimsAccess=currentActions?["finance.claims.view","finance.claims.create","finance.claims.manage"].some(k=>currentActions.has(k)):canViewClaims;
  const invoiceAccess=currentActions?["finance.invoices.view","finance.invoices.manage"].some(k=>currentActions.has(k)):canViewInvoices;
  const budgetAccess=currentActions?["finance.budgets.view","finance.budgets.manage"].some(k=>currentActions.has(k)):canViewBudgets;
  const budgetReviewAccess=currentActions?["finance.budgets.review","approvals.review"].every(k=>currentActions.has(k)):canReviewBudgets;
  const invoiceReviewAccess=currentActions?["finance.invoices.review","approvals.review"].every(k=>currentActions.has(k)):canReviewInvoices;
  const reviewerAccess=currentActions?
    ["approvals.review","finance.vouchers.view","documents.files.view"].every(k=>currentActions.has(k)):
    canReviewFinance;
  const links=[
    {key:"account" as const,label:"My account",href:"/admin"},
    ...(accountsAccess?[{key:"accounts" as const,label:"Users Management",href:"/admin/accounts"}]:[]),
    ...(rolesAccess?[{key:"roles" as const,label:"Roles & permissions",href:"/admin/roles"}]:[]),
    ...(foundationAccess?[{key:"foundation" as const,label:"Foundation Structure",href:"/admin/foundation"}]:[]),
    ...(branchAccess?[{key:"branches" as const,label:"Branches & registration",href:"/admin/foundation/branches"}]:[]),
    ...(financeAccess?[{key:"finance" as const,label:"Accounts",href:"/admin/finance"}]:[]),
    ...(voucherAccess?[{key:"financeVouchers" as const,label:"Voucher Drafts",href:"/admin/finance/vouchers"}]:[]),
    ...(claimsAccess?[{key:"financeClaims" as const,label:"Expense Claims",href:"/admin/finance/claims"}]:[]),
    ...(invoiceAccess?[{key:"financeInvoices" as const,label:"Invoices & Receipts",href:"/admin/finance/invoices"}]:[]),
    ...(budgetAccess?[{key:"financeBudgets" as const,label:"Budgets",href:"/admin/finance/budgets"}]:[]),
    ...(budgetReviewAccess?[{key:"financeBudgetReviews" as const,label:"Budget Reviews",href:"/admin/finance/budget-reviews"}]:[]),
    ...(invoiceReviewAccess?[{key:"financeInvoiceReviews" as const,label:"Invoice Reviews",href:"/admin/finance/invoice-reviews"}]:[]),
    ...(claimsReviewerAccess?[{key:"financeClaimReviews" as const,label:"Claim Reviews",href:"/admin/finance/claim-reviews"}]:[]),
    ...(reviewerAccess?[{key:"financeReviews" as const,label:"Voucher Reviews",href:"/admin/finance/voucher-approvals"}]:[]),
    ...(policyAccess?[{key:"policy" as const,label:"Security Policy",href:"/admin/security-policy"}]:[]),
    ...(settingsAccess?[{key:"settings" as const,label:"General Settings",href:"/admin/settings"}]:[]),
    ...(auditAccess?[{key:"audit" as const,label:"Audit Logs",href:"/admin/audit"}]:[]),
    ...(recoveryAccess?[{key:"recovery" as const,label:"Backup & Restore",href:"/admin/backup-recovery"}]:[]),
    ...(approvalAccess?[{key:"approvals" as const,label:"Registration & Approval",href:"/admin/approvals"}]:[]),
    ...(documentAccess?[{key:"documents" as const,label:"Private Case Documents",href:"/admin/documents"}]:[]),
    ...(communicationAccess?[{key:"communications" as const,label:"Notices & Notifications",href:"/admin/communications"}]:[]),
    ...(supportAccess?[{key:"support" as const,label:"Contact Messages & Help",href:"/admin/support"}]:[])
  ].filter(item=>item.label.toLowerCase().includes(query.trim().toLowerCase()));
  const titles:Record<FoundationAdminNavProps["active"],string>={
    account:"Foundation Dashboard",roles:"Roles & Permissions",
    accounts:"Users Management",policy:"Security Policy",settings:"General Settings",
    audit:"Audit Logs",recovery:"Backup & Restore",
    approvals:"Registration & Approval",documents:"Private Case Documents",
    communications:"Notices & Notifications",support:"Help & Support",
    foundation:"Departments / Committees",branches:"Branches / Locations",finance:"Finance & Accounting",financeBudgets:"Budgets",financeBudgetReviews:"Budget Reviews",financeInvoices:"Invoices & Receipts",financeInvoiceReviews:"Invoice Reviews",financeClaims:"Expense Claims",financeClaimReviews:"Expense Claim Reviews",financeVouchers:"Finance Voucher Drafts",financeReviews:"Finance Voucher Reviews"
  };
  return <><nav className="sidebar" aria-label="Foundation navigation">
    <div className="sidebar-brand"><img alt="" src="/careganga-mark.png" width="48" height="48"/><div className="sidebar-brand-name"><strong>CAREGANGA</strong><span>FOUNDATION</span></div></div>
    <div className="sidebar-filter">
      <label htmlFor="foundation-menu-filter">Search menu</label>
      <input ref={searchRef} id="foundation-menu-filter" type="search" value={query}
        onChange={event=>setQuery(event.target.value)}
        placeholder="Search menu..." autoComplete="off"/>
    </div>
    <div className="sidebar-links">
      {([
        {name:"DASHBOARD",keys:["account"]},
        {name:"USER & ACCESS MANAGEMENT",keys:["accounts","roles","approvals","policy"]},
        {name:"ORGANIZATION MANAGEMENT",keys:["branches","foundation"]},
        {name:"FINANCE & ACCOUNTING",keys:["finance","financeVouchers","financeReviews","financeClaims","financeClaimReviews","financeInvoices","financeInvoiceReviews","financeBudgets","financeBudgetReviews"]},
        {name:"PLATFORM & COMMUNICATIONS",
          keys:["documents","communications","support","settings","audit","recovery"]}
      ] as const).map(group=>{
        const permitted=links.filter(item=>(group.keys as readonly string[]).includes(item.key));
        return permitted.length?<div key={group.name} className="sidebar-group">
          <p className="sidebar-section">{group.name}</p>
          {permitted.map(item=><Link key={item.key} href={item.href}
            aria-current={active===item.key?"page":undefined}
            className={"sidebar-link"+(active===item.key?" selected":"")}>
            {item.label}</Link>)}
        </div>:null;
      })}
      {links.length===0&&<p className="sidebar-empty">No matching permitted menu item.</p>}
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
        {communicationAccess&&<Link className="admin-topbar-link"
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
