import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type Context={params:Promise<{parts:string[]}>};
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const safeCodes=new Set([
 "LAB_CENTER_INVALID","LAB_CATALOG_INVALID","LAB_CATALOG_FIELD_INVALID",
 "LAB_CATALOG_CONFLICT","LAB_CATALOG_REQUEST_CONFLICT","LAB_CATALOG_UNAVAILABLE",
 "LAB_CATALOG_CATEGORY_UNAVAILABLE","LAB_CATALOG_VERSION_CHANGED",
 "LAB_CATALOG_CODE_IMMUTABLE","LAB_CATALOG_PACKAGE_INVALID",
 "LAB_CATALOG_ITEM_UNAVAILABLE","LAB_CATALOG_PRICE_EXPIRED","LAB_CATALOG_RATE_OVERLAP","LAB_CATALOG_RATE_OUTSIDE_WINDOW,"LAB_CATALOG_TEST_EXPIRED"
]);
const reply=(status:number,message:string)=>NextResponse.json({message},{
 status,headers:{"Cache-Control":"no-store"}
});
function allowed(p:string[],method:string){
 if(p.length===2&&p[0]==="catalog"&&p[1]==="admin")return method==="GET";
 if(p.length===1&&["categories","tests","packages"].includes(p[0]))
  return method==="GET"||method==="POST";
 if(p.length===2&&p[0]==="tests"&&p[1]==="export")return method==="POST";
 if(p.length===2&&p[0]==="tests"&&ID.test(p[1]))
  return method==="PATCH";
 if(p.length===2&&["centers","my-centers"].includes(p[0])&&p[1]==="eligible")
  return method==="GET";
 if(p.length===3&&["centers","my-centers"].includes(p[0])&&ID.test(p[1])&&
  ["tests","test-prices","eligible-items"].includes(p[2]))
  return p[2]==="eligible-items"?method==="GET":method==="GET"||method==="POST";
 if(p.length===3&&p[0]==="test-prices"&&ID.test(p[1])&&["approve","reject"].includes(p[2]))
  return method==="POST";
 return false;
}
async function proxy(req:NextRequest,parts:string[],method:string){
 if(!allowed(parts,method))return reply(404,"This diagnostic catalogue action is unavailable.");
 if(method!=="GET"&&req.headers.get("origin")!==req.nextUrl.origin)
  return reply(403,"Submit this change from CareGanga.");
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)return reply(401,"Sign in to manage diagnostic tests.");
 const backend=process.env.BACKEND_URL;
 if(!backend)return reply(503,"Diagnostic records are temporarily unavailable.");
 let body:string|undefined;
 if(method!=="GET"){
  try{
   const input:unknown=await req.json();
   if(!input||typeof input!=="object"||Array.isArray(input))
    return reply(400,"Check the diagnostic form and try again.");
   body=JSON.stringify(input);
   if(body.length>24000)return reply(400,"The diagnostic form is too large.");
  }catch{return reply(400,"Check the diagnostic form and try again.");}
 }
 const target=new URL("/api/v1/diagnostics/"+parts.join("/"),backend);
 if(method==="GET")target.search=req.nextUrl.search;
 try{
  const response=await fetch(target,{
   method,body,cache:"no-store",signal:AbortSignal.timeout(12000),
   headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})}
  });
  const raw:unknown=await response.json().catch(()=>null);
  if(!response.ok){
   const status=[400,401,403,404,409,429].includes(response.status)?response.status:503;
   if(status<500&&raw&&typeof raw==="object"&&"code" in raw&&
    typeof raw.code==="string"&&safeCodes.has(raw.code)&&
    "message" in raw&&typeof raw.message==="string"&&raw.message.length<=240){
    const field="field" in raw&&typeof raw.field==="string"&&
     /^[A-Za-z][A-Za-z0-9]{0,35}$/.test(raw.field)?raw.field:null;
    return NextResponse.json({code:raw.code,message:raw.message,...(field?{field}:{})},{
     status,headers:{"Cache-Control":"no-store"}});
   }
   return reply(status,
    status===401?"Your session expired. Sign in again.":
    status===403?"You do not have access to these diagnostic records.":
    status===404?"This diagnostic record is no longer available.":
    status===409?"This diagnostic record changed. Refresh and review before retrying.":
    status===429?"Too many requests. Try again shortly.":
    status===400?"Check the diagnostic test or pricing details.":
    "The result could not be confirmed. Check the original record before retrying.");
  }
  return NextResponse.json(raw,{status:response.status,headers:{"Cache-Control":"no-store"}});
 }catch{
  return reply(503,"We could not confirm your change. Refresh and check the original record.");
 }
}
export async function GET(req:NextRequest,ctx:Context){
 return proxy(req,(await ctx.params).parts,"GET");
}
export async function POST(req:NextRequest,ctx:Context){
 return proxy(req,(await ctx.params).parts,"POST");
}
export async function PATCH(req:NextRequest,ctx:Context){
 return proxy(req,(await ctx.params).parts,"PATCH");
}
