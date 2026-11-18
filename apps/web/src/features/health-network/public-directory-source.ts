/** Current anonymous CG-14 projection. Never cache revoked licenses or publication. */
export type PublicCenter={slug:string;centerName:string;providerName:string;type:string;
 address:string;pinCode:string;publicPhone:string|null;
 latitude:number|null;longitude:number|null};
export type PublicFee={currency:"INR";amountMinor:number;kind:string;mode:string;
 effectiveFrom:string;effectiveTo:string|null};
export type PublicDoctor={doctorRef:string;doctorName:string;qualifications:string[];
 specialties:string[];experienceYears:number;centerSlug:string;centerName:string;
 address:string;pinCode:string;fee:PublicFee|null};
export type DirectoryResult<T>={state:"READY";items:T[];next:string|null}|
 {state:"UNAVAILABLE";items:[];next:null};
const params=["q","after","category","specialty","pin","state","district","block",
 "facility","service","day","minExperience","maxExperience","minFee","maxFee","center"];
export function directorySearch(search:Record<string,string|string[]|undefined>){
 const query=new URLSearchParams();
 for(const key of params){
  const value=search[key];
  if(typeof value==="string"&&value.length<=(key==="after"?130:80)&&
    !/[\u0000-\u001f\u007f]/.test(value)&&value.trim())
   query.set(key,value.trim());
 }
 return query;
}
async function read(path:string):Promise<unknown>{
 const base=process.env.BACKEND_URL;
 if(!base)throw Error("UNAVAILABLE");
 const response=await fetch(new URL("/api/v1/public/health-network/"+path,base),{
  cache:"no-store",signal:AbortSignal.timeout(9000)
 });
 if(!response.ok)throw Error(response.status===404?"NOT_FOUND":"UNAVAILABLE");
 return response.json();
}
function center(x:unknown):x is PublicCenter{
 if(!x||typeof x!=="object"||Array.isArray(x))return false;
 const v=x as Partial<PublicCenter>;
 return typeof v.slug==="string"&&/^[a-z0-9][a-z0-9-]{2,79}$/.test(v.slug)&&
  typeof v.centerName==="string"&&typeof v.providerName==="string"&&
  typeof v.type==="string"&&typeof v.address==="string"&&
  typeof v.pinCode==="string";
}
function doctor(x:unknown):x is PublicDoctor{
 if(!x||typeof x!=="object"||Array.isArray(x))return false;
 const v=x as Partial<PublicDoctor>;
 return typeof v.doctorRef==="string"&&/^[a-f0-9-]{36}$/i.test(v.doctorRef)&&
  typeof v.doctorName==="string"&&typeof v.centerName==="string"&&
  typeof v.centerSlug==="string"&&
  Array.isArray(v.specialties)&&Array.isArray(v.qualifications);
}
export async function directory<T extends PublicDoctor|PublicCenter>(
 resource:"centers"|"doctors",search:URLSearchParams):Promise<DirectoryResult<T>>{
 try{
  const data=await read(resource+"?"+search.toString()) as {
   items?:unknown;next?:unknown};
  const valid=resource==="centers"?center:doctor;
  if(!data||!Array.isArray(data.items)||!data.items.every(valid)||
    !(data.next===null||typeof data.next==="string"))
   throw Error("UNAVAILABLE");
  return {state:"READY",items:data.items.slice(0,20) as T[],
    next:data.next};
 }catch{return {state:"UNAVAILABLE",items:[],next:null};}
}
export type PublicArea={value:string;label:string;level:string;parentRef:string|null};
export async function publicAreas():Promise<PublicArea[]>{
 try{
  const response=await read("facets");
  if(!response||typeof response!=="object"||!("areas" in response)||
   !Array.isArray(response.areas))return [];
  return response.areas.filter((x:unknown):x is PublicArea=>
   !!x&&typeof x==="object"&&"value" in x&&"label" in x&&
   "level" in x&&typeof x.value==="string"&&
   /^[a-f0-9-]{36}$/i.test(x.value)&&
   typeof x.label==="string"&&typeof x.level==="string"&&
   ["STATE","DISTRICT","BLOCK"].includes(x.level)&&
   "parentRef" in x&&(x.parentRef===null||typeof x.parentRef==="string"))
   .slice(0,500);
 }catch{return [];}
}
export async function publicDoctor(ref:string){
 if(!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(ref))return null;
 try{
  const result=await read("doctors/"+encodeURIComponent(ref));
  if(!result||typeof result!=="object"||Array.isArray(result))return null;
  const p=result as {doctorName?:unknown;specialties?:unknown;
   qualifications?:unknown;experienceYears?:unknown;bio?:unknown;
   centers?:unknown;notice?:unknown};
  if(typeof p.doctorName!=="string"||!Array.isArray(p.centers)||
    !p.centers.every(doctor)||!Array.isArray(p.qualifications)||
    !Array.isArray(p.specialties))return null;
  return p as {doctorName:string;specialties:string[];qualifications:string[];
   experienceYears:number;bio:string;centers:PublicDoctor[];notice:string};
 }catch{return null;}
}
