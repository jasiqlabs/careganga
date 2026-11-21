import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function allowed(parts:string[],method:string){
 if(parts.length===1&&["me","branch-options","applications","employees","my-pending-link",
  "managers","account-options","my-bio-consent","role-options","employee-branches","employee-departments","summary"].includes(parts[0]))
  return parts[0]==="applications"?["GET","POST"].includes(method):method==="GET";
 if(parts.length===1&&parts[0]==="my-bio-consent")return method==="GET"||method==="POST";
 if(parts.length===2&&parts[0]==="my-link"&&parts[1]==="accept")
  return method==="POST";
 if(parts.length===1&&parts[0]==="departments")return method==="GET";
 if(parts.length===2&&parts[0]==="applications"&&UUID.test(parts[1]))
  return method==="GET"||method==="PATCH";
 if(parts.length===2&&parts[0]==="private"&&UUID.test(parts[1]))
  return method==="GET"||method==="PATCH";
 if(parts.length===3&&parts[0]==="applications"&&UUID.test(parts[1])&&
  ["submit","finalize"].includes(parts[2]))return method==="POST";
 if(parts.length===3&&parts[0]==="applications"&&UUID.test(parts[1])&&
  parts[2]==="review")return method==="GET";
 if(parts.length===1&&parts[0]==="reviews")return method==="GET";
 if(parts.length===2&&parts[0]==="reviews"&&parts[1]==="process")
  return method==="GET"||method==="POST";
 if(parts.length===2&&parts[0]==="reviews"&&UUID.test(parts[1]))return method==="GET";
 if(parts.length===3&&parts[0]==="reviews"&&UUID.test(parts[1])&&
  parts[2]==="decide")return method==="POST";
 return false;
}
async function proxy(req:NextRequest,parts:string[],method:string){
 if(!allowed(parts,method))
  return NextResponse.json({message:"This employee action is unavailable."},{status:404});
 if(method!=="GET"&&req.headers.get("origin")!==req.nextUrl.origin)
  return NextResponse.json({message:"Please submit this form from CareGanga."},{status:403});
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)return NextResponse.json({message:"Please sign in again."},{status:401});
 if(!process.env.BACKEND_URL)
  return NextResponse.json({message:"Employee services are temporarily unavailable."},{status:503});
 let body:string|undefined;
 if(method!=="GET"){
  try{
   const value:unknown=await req.json();
   if(!value||typeof value!=="object"||Array.isArray(value))
    throw Error("Bad form");
   body=JSON.stringify(value);
   if(body.length>6000)throw Error("Form too large");
  }catch{
   return NextResponse.json({message:"Check the employee form before saving."},{status:400});
  }
 }
 const target=new URL("/api/hr/"+parts.join("/"),process.env.BACKEND_URL);
 if(method==="GET")target.search=req.nextUrl.search;
 try{
  const res=await fetch(target,{method,body,cache:"no-store",signal:AbortSignal.timeout(10000),
   headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})}});
  if(!res.ok){
   const status=[400,401,403,404,409,429].includes(res.status)?res.status:503;
   return NextResponse.json({message:status===400?"Check the employee details."
    :status===401?"Your session expired. Please sign in again."
    :status===403?"Your current role or branch does not permit this action."
    :status===404?"The employee record is no longer available."
    :status===409?"This record changed. Refresh it before retrying."
    :status===429?"Too many requests. Try again later."
    :"The result is uncertain. Refresh before resubmitting."},
    {status,headers:{"Cache-Control":"no-store"}});
  }
  const data:unknown=await res.json();
  return NextResponse.json(data,{headers:{"Cache-Control":"no-store"}});
 }catch{
  return NextResponse.json({message:"Could not confirm the result. Check the list before retrying."},
   {status:503,headers:{"Cache-Control":"no-store"}});
 }
}
type Context={params:Promise<{parts:string[]}>};
export const GET=async(req:NextRequest,ctx:Context)=>proxy(req,(await ctx.params).parts,"GET");
export const POST=async(req:NextRequest,ctx:Context)=>proxy(req,(await ctx.params).parts,"POST");
export const PATCH=async(req:NextRequest,ctx:Context)=>proxy(req,(await ctx.params).parts,"PATCH");
