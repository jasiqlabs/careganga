/** Only implemented CG-01 capabilities appear here; new owners register theirs on delivery. */
export type Capability = Readonly<{
  key:string;
  businessLabel:string;
  group:string;
  assignable:boolean;
  sensitive:boolean;
}>;
const capabilities:readonly Capability[]=Object.freeze([
  {key:"roles.view",businessLabel:"View roles",group:"Roles & permissions",assignable:true,sensitive:false},
  {key:"roles.select",businessLabel:"Select roles",group:"Roles & permissions",assignable:true,sensitive:false},
  // Until CG-03 approves non-root role-management proposals, this stays root-only.
  {key:"roles.manage",businessLabel:"Create and manage roles",group:"Roles & permissions",assignable:false,sensitive:true},
  {key:"accounts.view",businessLabel:"View staff accounts",group:"Accounts & access",assignable:true,sensitive:false},
  {key:"accounts.select",businessLabel:"Select eligible accounts",group:"Accounts & access",assignable:true,sensitive:false},
  {key:"accounts.create",businessLabel:"Create staff accounts",group:"Accounts & access",assignable:true,sensitive:true},
  {key:"accounts.status.manage",businessLabel:"Suspend or reactivate staff",group:"Accounts & access",assignable:true,sensitive:true},
  {key:"roles.assign",businessLabel:"Assign eligible roles",group:"Accounts & access",assignable:true,sensitive:true},
  {key:"access.audit.view",businessLabel:"View access history",group:"Security & audit",assignable:true,sensitive:true},
  {key:"identity.security-policy.view",businessLabel:"View security policy",group:"Security & audit",assignable:false,sensitive:true},
  {key:"identity.security-policy.manage",businessLabel:"Manage security policy",group:"Security & audit",assignable:false,sensitive:true},
  // CG-21 is owner-installed; these capabilities are never user-assignable without a later approved process.
  {key:"platform.settings.view",businessLabel:"View platform settings",group:"Platform settings",assignable:false,sensitive:true},
  {key:"platform.settings.manage",businessLabel:"Manage platform settings",group:"Platform settings",assignable:false,sensitive:true},
  {key:"platform.integrations.view",businessLabel:"View integration readiness",group:"Platform settings",assignable:false,sensitive:true},
  {key:"platform.integrations.manage",businessLabel:"Manage integration references",group:"Platform settings",assignable:false,sensitive:true},
  {key:"platform.audit.view",businessLabel:"View platform audit",group:"Platform audit",assignable:false,sensitive:true},
  {key:"platform.audit.export",businessLabel:"Export platform audit",group:"Platform audit",assignable:false,sensitive:true},
  {key:"platform.recovery.view",businessLabel:"View backup readiness",group:"Backup & recovery",assignable:false,sensitive:true},
  {key:"platform.recovery.request",businessLabel:"Request protected recovery",group:"Backup & recovery",assignable:false,sensitive:true},
  {key:"platform.recovery.authorize",businessLabel:"Authorize protected recovery",group:"Backup & recovery",assignable:false,sensitive:true},
  {key:"approvals.view",businessLabel:"View permitted approvals",group:"Applications & approvals",assignable:true,sensitive:false},
  {key:"approvals.propose",businessLabel:"Submit protected access request",group:"Applications & approvals",assignable:true,sensitive:true},
  {key:"approvals.review",businessLabel:"Review final protected access decision",group:"Applications & approvals",assignable:false,sensitive:true},
  {key:"approvals.process.manage",businessLabel:"Manage approval process",group:"Applications & approvals",assignable:false,sensitive:true},
  // CG-02 owned Foundation and approved branch permissions.
  {key:"foundation.profile.view",businessLabel:"View Foundation profile",group:"Foundation structure",assignable:true,sensitive:false},
  {key:"foundation.profile.manage",businessLabel:"Manage Foundation profile",group:"Foundation structure",assignable:true,sensitive:true},
  {key:"foundation.geography.view",businessLabel:"View Foundation geography",group:"Foundation structure",assignable:true,sensitive:false},
  {key:"foundation.geography.manage",businessLabel:"Manage Foundation geography",group:"Foundation structure",assignable:true,sensitive:true},
  {key:"foundation.departments.view",businessLabel:"View departments and committees",group:"Foundation structure",assignable:true,sensitive:false},
  {key:"foundation.departments.manage",businessLabel:"Manage departments and committees",group:"Foundation structure",assignable:true,sensitive:true},
  {key:"foundation.departments.assign",businessLabel:"Assign Foundation officeholders",group:"Foundation structure",assignable:true,sensitive:true},
  {key:"foundation.branches.view",businessLabel:"View permitted branch drafts",group:"Foundation structure",assignable:true,sensitive:false},
  {key:"foundation.branches.manage",businessLabel:"Create and edit permitted branch drafts",group:"Foundation structure",assignable:true,sensitive:true},
  {key:"foundation.branches.admin",businessLabel:"Administrate all Foundation branch drafts",group:"Foundation structure",assignable:false,sensitive:true},
  {key:"documents.files.view",businessLabel:"View protected case evidence",group:"Documents & files",assignable:true,sensitive:true},
  {key:"documents.files.manage",businessLabel:"Upload protected case evidence",group:"Documents & files",assignable:true,sensitive:true},
  {key:"documents.letters.issue",businessLabel:"Issue private access confirmation letters",group:"Documents & files",assignable:false,sensitive:true},
  {key:"documents.letters.revoke",businessLabel:"Revoke private confirmation letters",group:"Documents & files",assignable:false,sensitive:true},
  {key:"communications.notifications.view",businessLabel:"Read own Foundation notices",group:"Notices & communications",assignable:true,sensitive:false},
  {key:"communications.notices.manage",businessLabel:"Draft Foundation notices",group:"Notices & communications",assignable:true,sensitive:true},
  {key:"communications.notices.approve",businessLabel:"Approve and send Foundation notices",group:"Notices & communications",assignable:false,sensitive:true},
  {key:"communications.delivery.process",businessLabel:"Process protected delivery queue",group:"Notices & communications",assignable:false,sensitive:true},
  {key:"communications.delivery.view",businessLabel:"View redacted delivery status",group:"Notices & communications",assignable:true,sensitive:true},
  {key:"support.cases.view",businessLabel:"View Foundation support requests",group:"Helpdesk & support",assignable:true,sensitive:true},
  {key:"support.cases.manage",businessLabel:"Assign and manage Foundation support requests",group:"Helpdesk & support",assignable:true,sensitive:true},
  {key:"support.cases.reply",businessLabel:"Reply to Foundation support requests",group:"Helpdesk & support",assignable:true,sensitive:true},
  {key:"support.faq.manage",businessLabel:"Manage Foundation help questions",group:"Helpdesk & support",assignable:true,sensitive:true},
  {key:"finance.accounts.view",businessLabel:"View finance accounts and periods",group:"Finance & accounting",assignable:true,sensitive:true},
  {key:"finance.accounts.manage",businessLabel:"Manage chart, financial years and cash/bank accounts",group:"Finance & accounting",assignable:true,sensitive:true},
  {key:"finance.journals.post",businessLabel:"Post balanced finance entries",group:"Finance & accounting",assignable:true,sensitive:true},
  {key:"finance.vouchers.view",businessLabel:"View Finance voucher drafts and status",group:"Finance & accounting",assignable:true,sensitive:true},
  {key:"finance.vouchers.manage",businessLabel:"Create and revise Finance voucher drafts",group:"Finance & accounting",assignable:true,sensitive:true},
  {key:"finance.claims.create",businessLabel:"Create my Foundation expense claims",group:"Finance & accounting",assignable:true,sensitive:true},
  {key:"finance.claims.view",businessLabel:"View my Foundation expense claims",group:"Finance & accounting",assignable:true,sensitive:true},
  {key:"finance.claims.review",businessLabel:"Review protected Foundation reimbursements",group:"Finance & accounting",assignable:false,sensitive:true},
  {key:"finance.claims.manage",businessLabel:"Reconcile approved Foundation claims and link original posted vouchers",group:"Finance & accounting",assignable:true,sensitive:true},
  {key:"finance.invoices.view",businessLabel:"View Foundation invoices and receipts",group:"Finance & accounting",assignable:true,sensitive:true},
  {key:"finance.invoices.manage",businessLabel:"Prepare and submit Foundation invoices",group:"Finance & accounting",assignable:true,sensitive:true},
  {key:"finance.invoices.review",businessLabel:"Review protected Foundation invoices",group:"Finance & accounting",assignable:false,sensitive:true},
  {key:"finance.invoices.issue",businessLabel:"Issue approved Foundation invoices and receipts",group:"Finance & accounting",assignable:true,sensitive:true},
  {key:"finance.budgets.view",businessLabel:"View Foundation budget allocations and utilization",group:"Finance & accounting",assignable:true,sensitive:true},
  {key:"finance.budgets.manage",businessLabel:"Draft budgets and manage genuine allocation commitments",group:"Finance & accounting",assignable:true,sensitive:true},
  {key:"finance.budgets.review",businessLabel:"Protected approval of original Foundation budgets",group:"Finance & accounting",assignable:false,sensitive:true},
  {key:"finance.reports.view",businessLabel:"View scoped posted General Ledger, cash/bank and trial balance",group:"Finance & accounting",assignable:true,sensitive:true},
  {key:"finance.reconciliation.manage",businessLabel:"Record actual original bank statement matches",group:"Finance & accounting",assignable:true,sensitive:true},
  {key:"finance.reconciliation.review",businessLabel:"Independently verify protected bank reconciliations",group:"Finance & accounting",assignable:false,sensitive:true},
  {key:"cms.content.view",businessLabel:"View website content and publication status",group:"Website & content",assignable:true,sensitive:false},
  {key:"cms.content.manage",businessLabel:"Write website pages and draft public content",group:"Website & content",assignable:true,sensitive:true},
  {key:"cms.content.publish",businessLabel:"Publish or withdraw approved website content",group:"Website & content",assignable:true,sensitive:true},
  // CG-14 US-001: permission alone never grants Center A/B access; affiliation is mandatory.
  {key:"health.patients.admin.view",businessLabel:"View protected Foundation patient and booking operations",group:"Healthcare patients",assignable:false,sensitive:true},
  {key:"health.visits.manage",businessLabel:"Check in and manage my center's consultation queue",group:"Healthcare visits",assignable:true,sensitive:true},
  {key:"health.appointments.cancel",businessLabel:"Cancel confirmed appointments at my assigned healthcare center",group:"Healthcare appointments",assignable:true,sensitive:true},
  {key:"health.patients.intake",businessLabel:"Register provisional patients at my assigned healthcare center",group:"Healthcare patient intake",assignable:true,sensitive:true},
  {key:"health.schedules.view",businessLabel:"View verified doctor-center schedules",group:"Healthcare scheduling",assignable:true,sensitive:true},
  {key:"health.schedules.manage",businessLabel:"Manage approved doctor-center weekly schedules",group:"Healthcare scheduling",assignable:true,sensitive:true},
  {key:"health.providers.view",businessLabel:"View healthcare provider drafts",group:"Healthcare network",assignable:true,sensitive:true},
  {key:"health.providers.manage",businessLabel:"Register and manage healthcare provider drafts",group:"Healthcare network",assignable:true,sensitive:true},
  {key:"health.doctors.view",businessLabel:"View protected doctor registration drafts",group:"Healthcare network",assignable:true,sensitive:true},
  {key:"health.doctors.manage",businessLabel:"Create and correct pending doctor registrations and propose associations",group:"Healthcare network",assignable:true,sensitive:true},
  {key:"health.doctors.verify",businessLabel:"Independently review and apply professional verification decisions",group:"Healthcare network",assignable:true,sensitive:true},
  {key:"health.centers.draft.edit",businessLabel:"Edit my assigned pending healthcare center",group:"Healthcare network",assignable:true,sensitive:true},
  {key:"health.providers.finance.view",businessLabel:"View protected provider settlement references",group:"Healthcare network",assignable:true,sensitive:true},
  {key:"health.providers.finance.manage",businessLabel:"Manage protected provider settlement references",group:"Healthcare network",assignable:true,sensitive:true},
  {key:"health.providers.verify",businessLabel:"Review submitted healthcare provider and center registrations",group:"Healthcare network",assignable:true,sensitive:true},
  {key:"health.centers.activate",businessLabel:"Enable or suspend verified healthcare center access",group:"Healthcare network",assignable:true,sensitive:true},
  {key:"health.centers.publish",businessLabel:"Publish or withdraw verified healthcare center listing",group:"Healthcare network",assignable:true,sensitive:true}
]);
export function capabilitiesInUse():readonly Capability[]{return capabilities;}
export function implementedCapability(key:string):Capability|undefined{
  return capabilities.find(x=>x.key===key);
}
export function assignableKeys(keys:unknown):string[]{
  if(!Array.isArray(keys)||keys.length>capabilities.length)throw new Error("INVALID_CAPABILITIES");
  const unique=new Set<string>();
  for(const key of keys){
    if(typeof key!=="string" || !implementedCapability(key)?.assignable || unique.has(key))
      throw new Error("INVALID_CAPABILITIES");
    unique.add(key);
  }
  return [...unique].sort();
}
