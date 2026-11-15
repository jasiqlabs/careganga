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
  {key:"accounts.invite",businessLabel:"Invite staff accounts",group:"Accounts & access",assignable:true,sensitive:true},
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
  {key:"platform.recovery.authorize",businessLabel:"Authorize protected recovery",group:"Backup & recovery",assignable:false,sensitive:true}
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
