/** Public CG17 approved support projection. All editorial publication,
 * navigation and page composition belong to existing CG18. CG14 is the
 * source of genuine doctor/fee identity. Patient entitlement is NOT here.
 */
export type CurrentConsultationBenefit={
 centerSlug:string;centerName:string;doctorRef:string|null;
 doctorName:string|null;feeMinor:string|null;currency:"INR";
 mode:"PERCENT"|"FIXED";percentBasisPoints:number|null;
 fixedSupportMinor:string|null;maximumSupportMinor:string;
 validUntil:string;eligibility:"VERIFIED_PATIENT_CARE";
 patientEntitlementConfirmed:false;bookingChargeAccepted:false};
export type BenefitResult={state:"READY"|"NO_APPROVED_CURRENT_BENEFITS"|"UNAVAILABLE";
 items:CurrentConsultationBenefit[];disclaimer:string};
const EMPTY="Current approved assistance rates cannot be verified. No older or illustrative rates are shown.";
const slug=/^[a-z0-9][a-z0-9-]{2,79}$/;
const id=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const amount=(v:unknown)=>typeof v==="string"&&/^(0|[1-9]\d{0,10})$/.test(v)&&
 Number.isSafeInteger(Number(v))&&Number(v)<=10000000000;
function valid(v:unknown):v is CurrentConsultationBenefit{
 if(!v||typeof v!=="object"||Array.isArray(v))return false;
 const x=v as Partial<CurrentConsultationBenefit>;
 return typeof x.centerSlug==="string"&&slug.test(x.centerSlug)&&
  typeof x.centerName==="string"&&x.centerName.length<=160&&
  (x.doctorRef===null||typeof x.doctorRef==="string"&&id.test(x.doctorRef))&&
  (x.doctorName===null||typeof x.doctorName==="string"&&x.doctorName.length<=150)&&
  (x.feeMinor===null||amount(x.feeMinor))&&x.currency==="INR"&&
  (x.mode==="PERCENT"||x.mode==="FIXED")&&
  (x.mode==="PERCENT"?typeof x.percentBasisPoints==="number"&&
    Number.isInteger(x.percentBasisPoints)&&
    x.percentBasisPoints>=1&&x.percentBasisPoints<=10000&&
    x.fixedSupportMinor===null:
    x.percentBasisPoints===null&&amount(x.fixedSupportMinor))&&
  amount(x.maximumSupportMinor)&&typeof x.validUntil==="string"&&
  Number.isFinite(Date.parse(x.validUntil))&&Date.parse(x.validUntil)>Date.now()&&
  x.eligibility==="VERIFIED_PATIENT_CARE"&&
  x.patientEntitlementConfirmed===false&&x.bookingChargeAccepted===false;
}
export async function currentConsultationBenefits(filters?:{
 centerSlug?:string;doctorRef?:string}):Promise<BenefitResult>{
 const backend=process.env.BACKEND_URL;
 if(!backend)return {state:"UNAVAILABLE",items:[],disclaimer:EMPTY};
 const center=filters?.centerSlug??"",doctor=filters?.doctorRef??"";
 if(center&&!slug.test(center)||doctor&&!id.test(doctor))
  return {state:"UNAVAILABLE",items:[],disclaimer:EMPTY};
 try{
  const url=new URL("/api/v1/public/healthcare-assistance/consultation-benefits",backend);
  if(center)url.searchParams.set("center",center);
  if(doctor)url.searchParams.set("doctor",doctor);
  const result=await fetch(url,{cache:"no-store",
   signal:AbortSignal.timeout(8000)});
  if(!result.ok)throw Error("Source unavailable");
  const x:unknown=await result.json();
  if(!x||typeof x!=="object"||Array.isArray(x)||
    !("state" in x)||(x.state!=="READY"&&x.state!=="NO_APPROVED_CURRENT_BENEFITS")||
    !("items" in x)||!Array.isArray(x.items)||x.items.length>12||
    !x.items.every(item=>valid(item)&&(!center||item.centerSlug===center)&&
      (!doctor||item.doctorRef===null||item.doctorRef.toLowerCase()===doctor.toLowerCase()))||
    (x.state==="NO_APPROVED_CURRENT_BENEFITS"&&x.items.length!==0))
   throw Error("Invalid source payload");
  return {state:x.state as BenefitResult["state"],
   items:x.items as CurrentConsultationBenefit[],
   disclaimer:"Current approved policy is conditional on verified patient eligibility, "+
    "care consent and actual accepted consultation fee."};
 }catch{return {state:"UNAVAILABLE",items:[],disclaimer:EMPTY};}
}
export const formatRupees=(minor:string)=>new Intl.NumberFormat("en-IN",{
 style:"currency",currency:"INR",maximumFractionDigits:2}).format(Number(minor)/100);
