import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type Context={params:Promise<{parts?:string[]}>};
type Method="GET"|"POST"|"PATCH";
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const safeCodes:Record<string,string>={
 CG13_INVALID_INPUT:"Check the selected programme or reward field.",
 CG13_SOURCE_ALREADY_EXISTS:"This code or reward already exists. Refresh the catalogue.",
 CG13_CURRENT_SOURCE_UNAVAILABLE:"A required source has changed. Refresh before continuing.",
 CG13_REQUEST_KEY_CONFLICT:"This request was already used for different changes. Refresh first.",
 CG13_POLICY_STALE:"These referral settings changed. Reload the current policy.",
 CG13_PROGRAMME_STALE:"This programme has changed. Refresh before saving.",
 CG13_PHYSICAL_ITEM_UNAVAILABLE:"Select a permitted active whole-piece warehouse item.",
 CG13_PROGRAMME_INACTIVE:"The selected programme is inactive.",
 CG13_PRODUCT_STALE:"The product has changed. Reload its current details.",
 CG13_MEDIA_UNAVAILABLE:"The selected image is not currently approved for public use. Choose another or leave blank.",
 CG13_CODE_UNAVAILABLE:"Your referral code is unavailable. Verify your membership or volunteer status."
};
const safeFields:Record<string,string>={
 programmeCode:"Programme code",name:"Name",audience:"Eligible audience",
 qualifyingEvent:"Qualification event",awardPoints:"Award points",
 minimumClaimPoints:"Minimum claim points",displayInrRatio:"Points reference rate",
 ranks:"Rank thresholds",effectiveFrom:"Effective date",pointsPrice:"Reward points",
 imageUrl:"Approved image URL",itemRef:"Warehouse item",storeRef:"Warehouse",
 programmeRef:"Programme",type:"Product type",category:"Category",
 eligibleAudience:"Reward audience",physicalStock:"Linked warehouse stock",
 request:"Request fields",page:"Page number",status:"Status",expectedVersion:"Record version",
  digitalFulfillmentMethod:"Verified digital delivery method"
};

const response=(body:unknown,status:number)=>NextResponse.json(body,{status,headers:{
 "Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
function route(parts:string[],method:Method):{target:string;isSelf:boolean}|null{
 const segment=parts.join("/");
 if(segment==="resolve"&&method==="POST")return {target:segment,isSelf:false};
 if(segment==="my-catalog"&&method==="GET")return {target:"my-catalog",isSelf:true};
 if((segment==="my-code"||segment==="my-code/options"||
  segment==="points/my-balance"||segment==="my-history"||
  segment==="rewards/my-rank")&&method==="GET")
  return {target:segment,isSelf:true};
 if(segment==="catalogue-programmes"&&method==="GET")
  return {target:segment,isSelf:false};
 if(segment==="programmes"&&(method==="GET"||method==="POST"))
  return {target:segment,isSelf:false};
 if(parts.length===2&&parts[0]==="programmes"&&UUID.test(parts[1])&&
  (method==="GET"||method==="PATCH"))
  return {target:segment,isSelf:false};
 if(parts.length===3&&parts[0]==="programmes"&&UUID.test(parts[1])&&
  parts[2]==="status"&&method==="POST")return {target:segment,isSelf:false};
 if(parts.length===3&&parts[0]==="programmes"&&UUID.test(parts[1])&&
  parts[2]==="summary"&&method==="GET")return {target:segment,isSelf:false};
 if(parts.length===3&&parts[0]==="programmes"&&UUID.test(parts[1])&&
  parts[2]==="redemptions"&&method==="GET")return {target:segment,isSelf:false};
 if(parts.length===3&&parts[0]==="programmes"&&UUID.test(parts[1])&&
  parts[2]==="referral-records"&&method==="GET")return {target:segment,isSelf:false};
 if(parts.length===3&&parts[0]==="programmes"&&UUID.test(parts[1])&&
  parts[2]==="categories"&&method==="GET")return {target:segment,isSelf:false};
 if(parts.length===3&&parts[0]==="programmes"&&UUID.test(parts[1])&&
  parts[2]==="products"&&method==="GET")return {target:segment,isSelf:false};
 if(segment==="products"&&method==="POST")return {target:segment,isSelf:false};
 if(parts.length===2&&parts[0]==="products"&&UUID.test(parts[1])&&method==="PATCH")
  return {target:segment,isSelf:false};
 if(segment==="stock-options"&&method==="GET")return {target:segment,isSelf:false};
 if(parts.length===3&&parts[0]==="stock-preview"&&
  UUID.test(parts[1])&&UUID.test(parts[2])&&method==="GET")
  return {target:segment,isSelf:false};

 return null;
}
async function proxy(req:NextRequest,ctx:Context,method:Method){
 const path=route((await ctx.params).parts??[],method);
 if(!path)return response({message:"That referral or reward action is unavailable."},404);
 const params=req.nextUrl.searchParams;
 const page=params.get("page"),search=params.get("q"),category=params.get("category");
 const programme=params.get("programmeRef"),relationship=params.get("relationship");
 const status=params.get("status"),from=params.get("from"),to=params.get("to");
 const kind=params.get("kind");
 const location=params.get("location"),rank=params.get("rank"),sort=params.get("sort");
 const branchRef=params.get("branchRef");
 const codePath=path.target==="my-code",codeOptions=path.target==="my-code/options";
 const walletPath=["points/my-balance","my-history","rewards/my-rank"].includes(path.target);
 const selector=codePath||walletPath;
 const redemptionAdmin=method==="GET"&&path.target.endsWith("/redemptions");
 const referralAdmin=method==="GET"&&path.target.endsWith("/referral-records");
 const products=method==="GET"&&
  (path.target.endsWith("/products")||path.target==="my-catalog");
 const paged=method==="GET"&&(path.target==="programmes"||path.target==="catalogue-programmes"||
  path.target==="my-catalog"||products||codeOptions||
  path.target==="my-history"||path.target==="rewards/my-rank"||redemptionAdmin||referralAdmin);
 if([...params.keys()].some(k=>!["page","q","category","programmeRef","relationship","status","from","to","kind","location","rank","sort","branchRef"].includes(k))||
    ["page","q","category","programmeRef","relationship","status","from","to","kind","location","rank","sort","branchRef"].some(k=>params.getAll(k).length>1)||
    ((programme!==null||relationship!==null)&&!selector)||
    (selector&&(!programme||!UUID.test(programme)||!["MEMBER","VOLUNTEER"].includes(relationship??"")))||
    ((codePath||path.target==="points/my-balance")&&page!==null)||
    (selector&&(search!==null||category!==null))||
    (page!==null&&(!paged||!(/^[1-9][0-9]{0,3}$/).test(page)))||
    (search!==null&&!products&&!redemptionAdmin&&!referralAdmin)||
    (category!==null&&!products&&!redemptionAdmin)||
    ((status!==null||from!==null||to!==null)&&!redemptionAdmin&&!referralAdmin)||
    (kind!==null&&(!referralAdmin||!["MEMBER","VOLUNTEER"].includes(kind)))||
    ([location,rank,sort].some(v=>v!==null)&&!referralAdmin)||
    (branchRef!==null&&(!(referralAdmin||redemptionAdmin)||!UUID.test(branchRef)))||
    (sort!==null&&!["REFERRALS","RECENT"].includes(sort))||
    (location!==null&&(location.length>120||/[\u0000-\u001f\u007f]/.test(location)))||
    (rank!==null&&(rank.length>120||/[\u0000-\u001f\u007f]/.test(rank)))||
    (status!==null&&!((redemptionAdmin&&["ALL","HELD","CANCELLED","ISSUED_AWAITING_HANDOVER","FULFILLED"].includes(status))||
      (referralAdmin&&["ALL","ACTIVE","INACTIVE"].includes(status))))||
    ([from,to].some(v=>v!==null&&!/^\d{4}-\d{2}-\d{2}$/.test(v)))||
    (search!==null&&(search.length>100||/[\u0000-\u001f\u007f]/.test(search)))||
    (category!==null&&(category.length>80||/[\u0000-\u001f\u007f]/.test(category))))
  return response({message:"Invalid catalogue filters."},400);
 if(method!=="GET"&&req.headers.get("origin")!==req.nextUrl.origin)
  return response({message:"Use the authenticated CareGanga form."},403);
 const anonymous=path.target==="resolve";
 const cookieName=path.isSelf?"cg_community_session":"cg_staff_session";
 const token=anonymous?null:(await cookies()).get(cookieName)?.value;
 if(!anonymous&&!token)return response({message:path.isSelf?
  "Sign in as an eligible member or volunteer.":"Sign in to the Foundation admin panel."},401);
 const backend=process.env.BACKEND_URL;
 if(!backend)return response({message:"Original reward catalogue temporarily unavailable."},503);
 let body:string|undefined;
 if(method!=="GET"){
  if(!req.headers.get("content-type")?.includes("application/json"))
   return response({message:"Use the correct reward form."},415);
  try{
   const raw:unknown=await req.json();
   if(!raw||typeof raw!=="object"||Array.isArray(raw))throw Error();
   body=JSON.stringify(raw);
   if(body.length>(anonymous?300:12000))throw Error();
  }catch{return response({message:"Check current programme and reward fields."},400);}
 }
 try{
  const url=new URL("/api/v1/referrals/"+path.target,backend);
  if(page!==null)url.searchParams.set("page",page);
  if(search!==null)url.searchParams.set("q",search);
  if(category!==null)url.searchParams.set("category",category);
  if(status!==null)url.searchParams.set("status",status);
  if(kind!==null)url.searchParams.set("kind",kind);
   if(location!==null)url.searchParams.set("location",location);
   if(rank!==null)url.searchParams.set("rank",rank);
   if(sort!==null)url.searchParams.set("sort",sort);
   if(branchRef!==null)url.searchParams.set("branchRef",branchRef);
  if(from!==null)url.searchParams.set("from",from);
  if(to!==null)url.searchParams.set("to",to);
  if(programme!==null)url.searchParams.set("programmeRef",programme);
  if(relationship!==null)url.searchParams.set("relationship",relationship);
  const result=await fetch(url,{method,body,cache:"no-store",
   signal:AbortSignal.timeout(15000),
   headers:{...(token?{Authorization:"Bearer "+token}:{}),
    ...(body?{"Content-Type":"application/json"}:{})}});
  const decoded:unknown=await result.json().catch(()=>null);
  if(result.ok&&decoded!==null)return response(decoded,result.status);
  const httpStatus=[400,401,403,404,409,429].includes(result.status)?result.status:503;
  const parsed=decoded&&typeof decoded==="object"&&!Array.isArray(decoded)?
   decoded as Record<string,unknown>:{};
  const safeCode=typeof parsed.code==="string"&&Object.hasOwn(safeCodes,parsed.code)?
   parsed.code:null;
  const label=typeof parsed.field==="string"?safeFields[parsed.field]:undefined;
  if((httpStatus===400||httpStatus===409)&&safeCode){
   return response({message:(label?label+": ":"")+safeCodes[safeCode],
    code:safeCode,...(label?{field:parsed.field}:{})},httpStatus);
  }
  return response({message:httpStatus===401?"Sign in again.":httpStatus===403?
   "Your current role or membership cannot access that reward source.":httpStatus===404?
   "Original programme or reward unavailable.":httpStatus===409?
   "This source was changed or already recorded. Refresh and retry the same request.":
   httpStatus===429?"Too many referral checks. Try again later.":
   httpStatus===400?"Check the original referral code or programme fields.":
   "Result uncertain. Refresh original records before submitting again."},httpStatus);
 }catch{return response({message:"Result uncertain. Refresh original records before submitting again."},503);}
}
export const GET=(r:NextRequest,c:Context)=>proxy(r,c,"GET");
export const POST=(r:NextRequest,c:Context)=>proxy(r,c,"POST");
export const PATCH=(r:NextRequest,c:Context)=>proxy(r,c,"PATCH");
