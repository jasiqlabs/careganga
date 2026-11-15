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
  {key:"access.audit.view",businessLabel:"View access history",group:"Security & audit",assignable:true,sensitive:true}
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
