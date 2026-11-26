/** CG-16 public safe test-menu view. Uses the same currently published source
 * as native Android and never caches revoked CG-14 providers or old prices.
 * No patient, order, report, payment or Foundation-benefit data is present.
 */
export type PublicLabOffer={
 offerRef:string;kind:"TEST"|"PACKAGE";name:string;code:string;
 category:string;categoryCode:string|null;sampleType:string|null;
 description:string|null;centerSlug:string;centerName:string;
 providerName:string;centerAddress:string;pinCode:string;publicPhone:string|null;
 basePriceMinor:string;patientPriceMinor:string;currency:"INR";
 validFromUtc:string;validUntilUtc:string|null;priceVersion:number
};
export type PublicLabOffersResult={state:"READY";items:PublicLabOffer[];
 next:string|null;notice:string}|{state:"UNAVAILABLE";items:[];next:null;notice:string};
const slug=/^[a-z0-9][a-z0-9-]{2,79}$/;
function valid(x:unknown):x is PublicLabOffer{
 if(!x||typeof x!=="object"||Array.isArray(x))return false;
 const v=x as Partial<PublicLabOffer>;
 const price=(n:unknown)=>typeof n==="string"&&/^\d{1,10}$/.test(n)&&
  Number.isSafeInteger(Number(n))&&Number(n)>=0;
 return typeof v.offerRef==="string"&&/^[a-f0-9-]{36}$/i.test(v.offerRef)&&
  (v.kind==="TEST"||v.kind==="PACKAGE")&&
  typeof v.name==="string"&&v.name.length<=160&&
  typeof v.code==="string"&&v.code.length<=24&&
  typeof v.category==="string"&&v.category.length<=100&&
  (v.categoryCode===null||
   typeof v.categoryCode==="string"&&v.categoryCode.length<=24)&&
  (v.sampleType===null||typeof v.sampleType==="string")&&
  (v.description===null||typeof v.description==="string"&&v.description.length<=2000)&&
  typeof v.centerSlug==="string"&&slug.test(v.centerSlug)&&
  typeof v.centerName==="string"&&v.centerName.length<=160&&
  typeof v.providerName==="string"&&v.providerName.length<=180&&
  typeof v.centerAddress==="string"&&v.centerAddress.length<=500&&
  typeof v.pinCode==="string"&&/^[1-9]\d{5}$/.test(v.pinCode)&&
  (v.publicPhone===null||typeof v.publicPhone==="string"&&/^\+?[0-9]{10,15}$/.test(v.publicPhone))&&
  price(v.basePriceMinor)&&price(v.patientPriceMinor)&&
  Number(v.patientPriceMinor)<=Number(v.basePriceMinor)&&
  v.currency==="INR"&&typeof v.validFromUtc==="string"&&
  Number.isFinite(Date.parse(v.validFromUtc))&&
  (v.validUntilUtc===null||
   typeof v.validUntilUtc==="string"&&Number.isFinite(Date.parse(v.validUntilUtc)))&&
  Number.isSafeInteger(v.priceVersion)&&Number(v.priceVersion)>0;
}
export function labOfferSearch(
 search:Record<string,string|string[]|undefined>
):URLSearchParams{
 const result=new URLSearchParams();
 const q=search.q,category=search.category,center=search.center,page=search.page;
 if(typeof q==="string"&&q.trim().length<=80&&
  !/[\u0000-\u001f\u007f<>]/.test(q))result.set("q",q.trim());
 if(typeof category==="string"&&
  /^[A-Z0-9][A-Z0-9-]{1,23}$/.test(category))result.set("category",category);
 if(typeof center==="string"&&slug.test(center))result.set("center",center);
 if(typeof page==="string"&&/^(?:[1-9]|10)$/.test(page))result.set("page",page);
 return result;
}
export async function publicLabOffers(query:URLSearchParams):Promise<PublicLabOffersResult>{
 const backend=process.env.BACKEND_URL;
 if(!backend)return {state:"UNAVAILABLE",items:[],next:null,
  notice:"Current lab prices cannot be verified. Please try again."};
 try{
  const endpoint=new URL("/api/v1/public/diagnostics/offers?"+query.toString(),backend);
  const response=await fetch(endpoint,{cache:"no-store",
   signal:AbortSignal.timeout(9000)});
  if(!response.ok)throw Error("Current lab prices unavailable");
  const data:unknown=await response.json();
  const now=Date.now(),center=query.get("center");
  if(!data||typeof data!=="object"||Array.isArray(data)||
   !("state" in data)||data.state!=="READY"||
   !("items" in data)||!Array.isArray(data.items)||
   data.items.length>50||!data.items.every(x=>valid(x)&&
    Date.parse(x.validFromUtc)<=now&&
    (x.validUntilUtc===null||Date.parse(x.validUntilUtc)>now)&&
    (!center||x.centerSlug===center))||
   !("next" in data)||!(data.next===null||
     typeof data.next==="string"&&/^(?:[1-9]|10)$/.test(data.next))||
   !("notice" in data)||typeof data.notice!=="string"||data.notice.length>300)
   throw Error("Invalid current lab offer projection");
  return data as PublicLabOffersResult;
 }catch{return {state:"UNAVAILABLE",items:[],next:null,
  notice:"Current lab prices cannot be verified. Please try again. No older prices are shown."};}
}
export type PublicLabCategory={code:string;name:string};
export async function publicLabCategories():Promise<PublicLabCategory[]>{
 const backend=process.env.BACKEND_URL;
 if(!backend)return [];
 try{
  const res=await fetch(new URL("/api/v1/public/diagnostics/facets",backend),{
   cache:"no-store",signal:AbortSignal.timeout(9000)
  });
  if(!res.ok)return [];
  const data:unknown=await res.json();
  if(!data||typeof data!=="object"||Array.isArray(data)||
   !("categories" in data)||!Array.isArray(data.categories)||
   data.categories.length>100||
   !data.categories.every((v:unknown)=>
    !!v&&typeof v==="object"&&"code" in v&&"name" in v&&
    typeof v.code==="string"&&/^[A-Z0-9][A-Z0-9-]{1,23}$/.test(v.code)&&
    typeof v.name==="string"&&v.name.length<=100))
   return [];
  return data.categories as PublicLabCategory[];
 }catch{return [];}
}
export function rupees(minor:string){
 return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR"})
  .format(Number(minor)/100);
}
