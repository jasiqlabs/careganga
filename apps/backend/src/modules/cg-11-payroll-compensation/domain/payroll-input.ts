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
 const x=fields(raw,["requestKey","branchRef","label","effectiveFrom","effectiveTo","supersedesRef","components","attendanceRules"]);
 if(!Array.isArray(x.components)||x.components.length>40)throw invalid("Choose up to 40 salary components");
 const components=x.components.map(raw=>{const c=fields(raw,["code","label","kind","mode","minor","basisPoints","taxClass"]);
  if(typeof c.code!=="string"||!/^[A-Z][A-Z0-9_]{1,29}$/.test(c.code))throw invalid("Enter a valid component code");
  const normalized=label(c.label).toUpperCase().replace(/[^A-Z0-9]/g,"");
  if(/^(PF|EPF|ESI|ESIC|PT|TDS)(_|$)/.test(c.code)||/^(PF|EPF|ESI|ESIC|PT|TDS|PROVIDENTFUND|EMPLOYEE(S)?STATEINSURANCE|PROFESSIONALTAX|INCOMETAX|GRATUITY)$/.test(normalized)||c.code==="BASIC")throw invalid("Statutory configuration requires an approved rule; basic salary is entered separately");
  const mode=option(c.mode,["FIXED","PERCENT"] as const),kind=option(c.kind,["ALLOWANCE","DEDUCTION","EMPLOYER_CONTRIBUTION"] as const);
  if(mode==="FIXED"?c.basisPoints!=null:c.minor!=null||!Number.isInteger(c.basisPoints)||Number(c.basisPoints)<0||Number(c.basisPoints)>10000)throw invalid("Check amount or percentage");
  return {code:c.code,label:label(c.label),kind,mode,minor:mode==="FIXED"?minor(c.minor,true):null,bp:mode==="PERCENT"?Number(c.basisPoints):null,taxClass:option(c.taxClass,["TAXABLE","NON_TAXABLE","NOT_CONFIGURED"] as const)};
 });
 if(new Set(components.map(c=>c.code)).size!==components.length)throw invalid("Component codes must be unique");
 const rules=x.attendanceRules===undefined?{absence:"UNCONFIGURED",leave:{}}:fields(x.attendanceRules,["absence","leave"]);
 const absence=option(rules.absence,["UNCONFIGURED","PAID","UNPAID"] as const);
 if(!rules.leave||typeof rules.leave!=="object"||Array.isArray(rules.leave)||Object.keys(rules.leave).length>40)throw invalid("Check approved leave rules");
 const leave=Object.fromEntries(Object.entries(rules.leave).map(([k,v])=>[id(k),option(v,["PAID","UNPAID"] as const)]));
 return {attendanceRules:{absence,leave},key:id(x.requestKey),branch:x.branchRef===null||x.branchRef==="FOUNDATION"?null:id(x.branchRef),label:label(x.label),supersedes:x.supersedesRef==null||x.supersedesRef===""?null:id(x.supersedesRef),...range(x),components};
}
export function parseSalary(raw:unknown){const x=fields(raw,["requestKey","policyRef","policyRevision","effectiveFrom","effectiveTo","supersedesRef","hrProposalRef","baseMinor"]);if(!Number.isSafeInteger(x.policyRevision)||Number(x.policyRevision)<1)throw invalid("Refresh the policy");return {key:id(x.requestKey),policy:id(x.policyRef),policyRevision:Number(x.policyRevision),hrProposal:x.hrProposalRef==null||x.hrProposalRef===""?null:id(x.hrProposalRef),supersedes:x.supersedesRef==null||x.supersedesRef===""?null:id(x.supersedesRef),...range(x),baseMinor:minor(x.baseMinor)};}
/** Round half-up once per component, with integer arithmetic only. */
export function componentMinor(base:string,c:{mode:"FIXED"|"PERCENT";minor:string|null;bp:number|null}):bigint{
 if(c.mode==="FIXED")return BigInt(minor(c.minor,true));
 if(c.mode!=="PERCENT"||!Number.isInteger(c.bp)||Number(c.bp)<0||Number(c.bp)>10000)throw invalid("Invalid component rate");
 return (BigInt(minor(base))*BigInt(c.bp!)+5000n)/10000n;
}

/** One policy-derived fiscal calendar; no finance-year master or client clock. */
export function fiscalYearFor(value:unknown){const d=date(value),y=Number(d.slice(0,4))-(Number(d.slice(5,7))<4?1:0);return {label:String(y)+"-"+String(y+1),from:String(y)+"-04-01",until:String(y+1)+"-04-01"};}
export function payrollMonth(yearInput:unknown,monthInput:unknown){if(typeof yearInput!=="string"||!/^\d{4}-\d{4}$/.test(yearInput)||typeof monthInput!=="string"||!/^\d{4}-\d{2}$/.test(monthInput))throw invalid("Choose a valid payroll financial year and month");const from=date(monthInput+"-01"),fy=fiscalYearFor(from);if(fy.label!==yearInput)throw invalid("Payroll month is outside the selected financial year");const y=Number(from.slice(0,4)),m=Number(from.slice(5,7));return {...fy,period:monthInput,periodFrom:from,periodUntil:String(y+(m===12?1:0))+"-"+String(m===12?1:m+1).padStart(2,"0")+"-01"};}
