import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function allowed(parts:string[],method:string){
 if(parts.length===1&&parts[0]==="intents")return method==="POST";
 if(parts.length===2&&parts[0]==="intents"&&ID.test(parts[1]))
  return method==="GET";
 if(parts.length===3&&parts[0]==="intents"&&ID.test(parts[1])&&parts[2]==="confirm")
  return method==="POST";
 if(parts.length===2&&parts[0]==="applications"&&ID.test(parts[1]))
  return method==="GET";
 if(parts.length===3&&parts[0]==="files"&&ID.test(parts[1])&&
   parts[2]==="revoke")return method==="POST";
 return false;
}
async function proxy(req:NextRequest,parts:string[],method:string){
 if(!allowed(parts,method))
  return NextResponse.json({message:"This private employee file action is unavailable."},
   {status:404});
 if(method!=="GET"&&req.headers.get("origin")!==req.nextUrl.origin)
  return NextResponse.json({message:"Open your employee documents from CareGanga."},
   {status:403});
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)return NextResponse.json({message:"Please sign in again."},{status:401});
 const backend=process.env.BACKEND_URL;
 if(!backend)return NextResponse.json({message:"Protected documents are unavailable."},{status:503});
 let body:string|undefined;
 if(method==="POST"&&parts.length===1){
  try{
   const data:unknown=await req.json();
   if(!data||typeof data!=="object"||Array.isArray(data))
    throw Error("Invalid document");
   body=JSON.stringify(data);
   if(body.length>3500)throw Error("Invalid document size");
  }catch{
   return NextResponse.json({message:"Check the selected private document."},{status:400});
  }
 }
 const target=new URL("/api/documents/hr/"+parts.join("/"),backend);
 try{
  const res=await fetch(target,{method,body,cache:"no-store",signal:AbortSignal.timeout(20000),
   headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})}});
  if(!res.ok){
   const status=[400,401,403,404,409,429].includes(res.status)?res.status:503;
   return NextResponse.json({message:status===400?"Choose a valid private document.":
    status===401?"Your session expired. Please sign in again.":
    status===403?"Your role cannot access this employee document.":
    status===404?"The private document is no longer available.":
    status===409?"The document or draft changed. Refresh before retrying.":
    status===429?"Too many requests. Try again later.":
    "Private file scanning or storage is unavailable. The upload is not confirmed."},
    {status,headers:{"Cache-Control":"no-store"}});
  }
  return NextResponse.json(await res.json(),{
   status:res.status,headers:{"Cache-Control":"private, no-store"}});
 }catch{
  return NextResponse.json({message:"The secure upload result is uncertain. Check its status before retrying."},
   {status:503,headers:{"Cache-Control":"private, no-store"}});
 }
}
type Context={params:Promise<{parts:string[]}>};
export const GET=async(req:NextRequest,c:Context)=>proxy(req,(await c.params).parts,"GET");
export const POST=async(req:NextRequest,c:Context)=>proxy(req,(await c.params).parts,"POST");
