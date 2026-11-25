export type PublicCampaign={slug:string;title:string;category:string;summary:string;description:string;
 goalMinor:string|null;raisedMinor:string;startAt:string|null;endAt:string|null;area:string;
 coverSrc:string|null;heroSrc:string|null;heroAlt:string};
type Result={state:"PUBLISHED"|"NOT_PUBLISHED"|"UNAVAILABLE";cards:PublicCampaign[];donationsEnabled:boolean};
const slug=/^cg-camp-[0-9]{8}$/;
const media=/^\/api\/public\/campaigns\/media\/[0-9a-f-]{36}$/i;
function validDate(value:unknown){
 if(typeof value!=="string"||!/^20[0-9]{2}-[0-9]{2}-[0-9]{2}$/.test(value))return false;
 const date=new Date(value+"T00:00:00.000Z");
 return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
}
function valid(raw:unknown):raw is PublicCampaign{
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return false;
 const x=raw as Record<string,unknown>;
 return typeof x.slug==="string"&&slug.test(x.slug)&&
  typeof x.title==="string"&&x.title.length>=2&&x.title.length<=160&&
  typeof x.summary==="string"&&x.summary.length<=500&&
  typeof x.description==="string"&&x.description.length<=4000&&
  typeof x.category==="string"&&x.category.length<=80&&
  typeof x.area==="string"&&x.area.length<=250&&
  typeof x.heroAlt==="string"&&x.heroAlt.length<=240&&
  (x.goalMinor===null||typeof x.goalMinor==="string"&&/^[1-9][0-9]{0,13}$/.test(x.goalMinor))&&
  typeof x.raisedMinor==="string"&&/^(0|[1-9][0-9]{0,27})$/.test(x.raisedMinor)&&
  (x.coverSrc===null||typeof x.coverSrc==="string"&&media.test(x.coverSrc))&&
  (x.heroSrc===null||typeof x.heroSrc==="string"&&media.test(x.heroSrc))&&
  (x.startAt===null||validDate(x.startAt))&&
  (x.endAt===null||validDate(x.endAt))&&
  (typeof x.startAt!=="string"||typeof x.endAt!=="string"||x.startAt<=x.endAt);
}
export async function publishedCampaigns(one?:string):Promise<Result>{
 if(one!==undefined&&!slug.test(one))return {state:"NOT_PUBLISHED",cards:[],donationsEnabled:false};
 if(!process.env.BACKEND_URL)return {state:"UNAVAILABLE",cards:[],donationsEnabled:false};
 try{
  const path="/api/public/content/campaigns"+(one?"/"+one:"");
  const response=await fetch(new URL(path,process.env.BACKEND_URL),{
   cache:"no-store",signal:AbortSignal.timeout(9000)});
  if(response.status===404)return {state:"NOT_PUBLISHED",cards:[],donationsEnabled:false};
  if(!response.ok)return {state:"UNAVAILABLE",cards:[],donationsEnabled:false};
  const value:unknown=await response.json();
  if(!one&&(!value||typeof value!=="object"||Array.isArray(value)||!("cards" in value)||!Array.isArray(value.cards)))throw Error("Invalid original public campaign list");
  const cards:unknown[]=one?[value]:(value as {cards:unknown[]}).cards;
  if(cards.length>100||!cards.every(valid)||new Set(cards.map(x=>x.slug)).size!==cards.length||
    (one&&cards[0]?.slug!==one))throw Error("Invalid original public campaign response");
  return {state:cards.length?"PUBLISHED":"NOT_PUBLISHED",cards:cards as PublicCampaign[],
    donationsEnabled:one===undefined&&!!value&&typeof value==="object"&&"donationsEnabled" in value&&value.donationsEnabled===true};
 }catch{return {state:"UNAVAILABLE",cards:[],donationsEnabled:false};}
}
export const goalText=(minor:string|null)=>{
 if(minor===null)return null;
 try{return "₹"+(BigInt(minor)/100n).toLocaleString("en-IN")+
  ((BigInt(minor)%100n)===0n?"":"."+(BigInt(minor)%100n).toString().padStart(2,"0"));}
 catch{return null;}
};

export async function onlineDonationAvailability(){
 if(!process.env.BACKEND_URL)return false;
 try{
  const r=await fetch(new URL("/api/public/content/donations/readiness",process.env.BACKEND_URL),
   {cache:"no-store",signal:AbortSignal.timeout(7000)});
  if(!r.ok)return false;const v:unknown=await r.json();
  return !!v&&typeof v==="object"&&"schemaVersion" in v&&v.schemaVersion===1&&
   "onlineAvailable" in v&&v.onlineAvailable===true;
 }catch{return false;}
}
