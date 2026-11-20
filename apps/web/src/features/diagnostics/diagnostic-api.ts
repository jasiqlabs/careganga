export type DiagnosticCategory={
 categoryRef:string;code:string;name:string;status:string;revision:number
};
export type DiagnosticTest={
 testRef:string;code:string;name:string;categoryRef:string;category:string;
 sampleType:string;parametersDescription:string;clinicalDescription:string;
 status:"ACTIVE"|"INACTIVE";revision:number
};
export type DiagnosticPackage={
 packageRef:string;code:string;name:string;description:string;
 status:string;revision:number;testCount:number;
 activeFromUtc:string;activeToUtc:string|null
};
export type DiagnosticCenter={
 centerRef:string;name:string;code:string;providerName:string;publicationState:string;
 publicSlug:string|null
};
export type DiagnosticItem={kind:"TEST"|"PACKAGE";itemRef:string;name:string;code:string};
export type DiagnosticMapping={
 mappingRef:string;centerRef:string;kind:"TEST"|"PACKAGE";
 name:string;code:string;testRef:string|null;packageRef:string|null;
 status:string;revision:number
};
export type DiagnosticPrice={
 priceRef:string;mappingRef:string;version:number;
 effectiveFromUtc:string;effectiveToUtc:string|null;
 basePriceMinor:string;patientPriceMinor:string;currency:string;status:string;
 discountReason:string|null
};
export async function diagnosticsCall<T>(
 path:string,method:"GET"|"POST"|"PATCH"="GET",body?:object
):Promise<T>{
 const r=await fetch("/api/diagnostics/"+path,{
  method,credentials:"same-origin",cache:"no-store",
  ...(body?{headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})
 });
 const result:unknown=await r.json().catch(()=>null);
 if(!r.ok){
  const msg=result&&typeof result==="object"&&"message" in result&&
   typeof result.message==="string"?result.message:
   "The diagnostic record could not be confirmed. Check the saved record before retrying.";
  throw Object.assign(new Error(msg),{status:r.status});
 }
 return result as T;
}
export function writeUncertain(error:unknown){
 return !(error&&typeof error==="object"&&"status" in error&&
  typeof error.status==="number"&&error.status<500);
}
export function moneyMinor(input:string):number{
 if(!/^(0|[1-9]\d{0,6})(?:\.\d{1,2})?$/.test(input.trim()))
  throw new Error("Enter a price in rupees with up to two decimal places.");
 const [major,fraction=""]=input.trim().split(".");
 const result=Number(major)*100+Number(fraction.padEnd(2,"0"));
 if(!Number.isSafeInteger(result)||result>999999999)
  throw new Error("Enter a smaller valid price.");
 return result;
}
export function formatRupees(minor:string|number){
 const value=Number(minor);
 return Number.isSafeInteger(value)&&value>=0?
  new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR"})
   .format(value/100):"Price unavailable";
}
export function localDateTimeToUtc(value:string,field:string):string{
 if(!value||!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(value))
  throw new Error("Choose a valid "+field+".");
 const parsed=new Date(value);
 if(!Number.isFinite(parsed.valueOf()))
  throw new Error("Choose a valid "+field+".");
 return parsed.toISOString();
}
