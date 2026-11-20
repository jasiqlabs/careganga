import {identityRequest} from "../identity-access/http-client";

export type Category={categoryRef:string;code:string;name:string;status:string;revision:number};
export type Test={
 testRef:string;code:string;name:string;categoryRef:string;category:string;
 sampleType:string;parametersDescription:string;clinicalDescription:string;
 status:"ACTIVE"|"INACTIVE";revision:number;activeFromUtc:string;activeToUtc:string|null
};
export type Package={packageRef:string;code:string;name:string;description:string;
 status:string;revision:number;testCount:number;activeFromUtc:string;activeToUtc:string|null};
export type Center={centerRef:string;name:string;code:string;providerName:string;
 publicationState:string;publicSlug:string|null};
export type Item={kind:"TEST"|"PACKAGE";itemRef:string;name:string;code:string};
export type Mapping={mappingRef:string;centerRef:string;kind:"TEST"|"PACKAGE";
 name:string;code:string;testRef:string|null;packageRef:string|null;
 status:string;revision:number};
export type Price={priceRef:string;mappingRef:string;version:number;
 effectiveFromUtc:string;effectiveToUtc:string|null;status:string;
 basePriceMinor:string;patientPriceMinor:string;currency:string;
 discountReason:string|null;reviewCaseRef:string|null;reviewReference:string|null;
 reviewCaseRevision:number|null;reviewStatus:string|null};
export type Summary={totalTests:number;activeTests:number;categories:number;
 packages:number;publishedOffers:number;averagePublishedPatientPriceMinor:string|null};
export type DiagnosticFault=Error&{status?:number};
export async function diagnosticRequest<T>(token:string,path:string,
 method:"GET"|"POST"|"PATCH"="GET",payload?:object):Promise<T>{
 const response=await identityRequest("/api/v1/diagnostics/"+path,{
  method,cache:"no-store",
  headers:{Authorization:"Bearer "+token,
   ...(payload?{"Content-Type":"application/json"}:{})},
  body:payload?JSON.stringify(payload):undefined
 });
 if(!response.ok){
  // Do not leak private backend internals, raw SQL or provider errors into UI.
  const message=response.status===401?"Your session expired. Sign in again.":
   response.status===403?"Your current role cannot perform this lab action.":
   response.status===404?"The selected original lab record is unavailable.":
   response.status===409?"This lab record changed. Refresh it before editing.":
   response.status===400?"Check your lab form, price and time period.":
   response.status===429?"Too many requests. Try again shortly.":
   "The request outcome cannot be confirmed. Review the original record first.";
  throw Object.assign(new Error(message),{status:response.status});
 }
 return await response.json() as T;
}
export function isUncertain(e:unknown){
 return !(e&&typeof e==="object"&&"status" in e&&
  typeof e.status==="number"&&e.status<500);
}
export function moneyMinor(value:string):number{
 if(!/^(0|[1-9]\d{0,6})(?:\.\d{1,2})?$/.test(value.trim()))
  throw Error("Enter rupees with up to two decimal places.");
 const [rupees,paise=""]=value.trim().split(".");
 const total=Number(rupees)*100+Number(paise.padEnd(2,"0"));
 if(!Number.isSafeInteger(total)||total>999999999)
  throw Error("Enter a smaller valid price.");
 return total;
}
export function rupees(minor:string|number):string{
 const n=Number(minor);
 return Number.isSafeInteger(n)&&n>=0?
  new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR"})
   .format(n/100):"Price unavailable";
}
/** Native datetime input accepts an explicit ISO 8601 offset or Z.
 * A naive local timestamp is not interpreted in the device's timezone.
 * That prevents silent changes to an approved center tariff period.
 */
export function utcDate(input:string,required=false):string|null{
 const value=input.trim();
 if(!value){if(required)throw Error("Enter a start time with timezone.");return null;}
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(value))
  throw Error("Enter time with timezone, e.g. 2026-11-25T09:30:00+05:30.");
 const n=new Date(value);
 if(!Number.isFinite(n.getTime()))
  throw Error("Enter a valid date and timezone.");
 return n.toISOString();
}
export function validateWindow(from:string,to:string,required=false){
 const start=utcDate(from,required),end=utcDate(to);
 if(start&&end&&end<=start)throw Error("End time must be after start time.");
 return {activeFromUtc:start,activeToUtc:end};
}
