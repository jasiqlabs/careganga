import {BadRequestException} from "@nestjs/common";
const invalid=(message:string)=>new BadRequestException(message);
export function fields(raw:unknown,allowed:string[]){if(!raw||typeof raw!=="object"||Array.isArray(raw))throw invalid("Check payroll details");const x=raw as Record<string,unknown>;if(Object.keys(x).some(k=>!allowed.includes(k)))throw invalid("Unsupported payroll field");return x;}
export function id(v:unknown){if(typeof v!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v))throw invalid("Choose an existing record");return v.toLowerCase();}
export function date(v:unknown){if(typeof v!=="string"||!/^(19|20|21)\d{2}-\d{2}-\d{2}$/.test(v))throw invalid("Choose a valid effective date");const d=new Date(v+"T00:00:00Z");if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==v)throw invalid("Choose a valid effective date");return v;}
export function minor(v:unknown,allowZero=false){if(typeof v!=="string"||!/^(0|[1-9][0-9]{0,13})$/.test(v)||!allowZero&&v==="0")throw invalid("Enter a valid amount in paise");return v;}
export function option<T extends string>(v:unknown,values:readonly T[]):T{if(typeof v!=="string"||!values.includes(v as T))throw invalid("Choose an available option");return v as T;}
export function label(v:unknown){if(typeof v!=="string"||v.trim().length<2||v.trim().length>100||/[\u0000-\u001f\u007f]/.test(v))throw invalid("Enter a valid label");return v.trim();}
function range(x:Record<string,unknown>){const from=date(x.effectiveFrom),to=x.effectiveTo==null||x.effectiveTo===""?null:date(x.effectiveTo);if(to&&to<=from)throw invalid("End date must be after start date");return {from,to};}
export function parsePolicy(raw:unknown){
 const x=fields(raw,["requestKey","branchRef","label","effectiveFrom","effectiveTo","components"]);
 if(!Array.isArray(x.components)||x.components.length>40)throw invalid("Choose up to 40 salary components");
 const components=x.components.map(raw=>{const c=fields(raw,["code","label","kind","mode","minor","basisPoints","taxClass"]);
  if(typeof c.code!=="string"||!/^[A-Z][A-Z0-9_]{1,29}$/.test(c.code))throw invalid("Enter a valid component code");
  const mode=option(c.mode,["FIXED","PERCENT"] as const),kind=option(c.kind,["ALLOWANCE","DEDUCTION","EMPLOYER_CONTRIBUTION"] as const);
  if(mode==="FIXED"?c.basisPoints!=null:c.minor!=null||!Number.isInteger(c.basisPoints)||Number(c.basisPoints)<0||Number(c.basisPoints)>10000)throw invalid("Check amount or percentage");
  return {code:c.code,label:label(c.label),kind,mode,minor:mode==="FIXED"?minor(c.minor,true):null,bp:mode==="PERCENT"?Number(c.basisPoints):null,taxClass:option(c.taxClass,["TAXABLE","NON_TAXABLE","NOT_CONFIGURED"] as const)};
 });
 if(new Set(components.map(c=>c.code)).size!==components.length)throw invalid("Component codes must be unique");
 return {key:id(x.requestKey),branch:id(x.branchRef),label:label(x.label),...range(x),components};
}
export function parseSalary(raw:unknown){const x=fields(raw,["requestKey","policyRef","policyRevision","effectiveFrom","effectiveTo","baseMinor"]);if(!Number.isSafeInteger(x.policyRevision)||Number(x.policyRevision)<1)throw invalid("Refresh the policy");return {key:id(x.requestKey),policy:id(x.policyRef),policyRevision:Number(x.policyRevision),...range(x),baseMinor:minor(x.baseMinor)};}
/** Round half-up once per component, with integer arithmetic only. */
export function componentMinor(base:string,c:{mode:"FIXED"|"PERCENT";minor:string|null;bp:number|null}):bigint{
 return c.mode==="FIXED"?BigInt(minor(c.minor,true)):(BigInt(minor(base))*BigInt(c.bp??0)+5000n)/10000n;
}
