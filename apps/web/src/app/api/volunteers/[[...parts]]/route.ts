import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{parts?:string[]}>};
type Method="GET"|"POST";
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const reply=(value:unknown,status=200)=>NextResponse.json(value,{status,headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
function endpoint(parts:string[],method:Method):{path:string;isFile:boolean}|null{
 const path=parts.join("/");
 if(method==="GET"&&["roster","roster/export","reviews","reviews/policy"].includes(path))return {path,isFile:false};
 if(method==="POST"&&path==="reviews/policy")return {path,isFile:false};
 if(method==="GET"&&parts.length===2&&parts[0]==="reviews"&&UUID.test(parts[1]))return {path,isFile:false};
 if(method==="POST"&&parts.length===3&&parts[0]==="reviews"&&UUID.test(parts[1])&&parts[2]==="decide")return {path,isFile:false};
 if(method==="GET"&&parts.length===4&&parts[0]==="reviews"&&UUID.test(parts[1])&&parts[2]==="files"&&UUID.test(parts[3]))return null;
 if(method==="GET"&&parts.length===5&&parts[0]==="reviews"&&UUID.test(parts[1])&&parts[2]==="files"&&UUID.test(parts[3])&&parts[4]==="download")return {path,isFile:true};
 return null;
}
async function proxy(req:NextRequest,ctx:Ctx,method:Method){
 const parts=(await ctx.params).parts??[],route=endpoint(parts,method);
 if(!route)return reply({message:"Volunteer staff action is unavailable."},404);
 if(method==="POST"&&req.headers.get("origin")!==req.nextUrl.origin)
  return reply({message:"Submit this review from the Foundation admin panel."},403);
 const token=(await cookies()).get("cg_staff_session")?.value,base=process.env.BACKEND_URL;
 if(!token)return reply({message:"Sign in again."},401);
 if(!base)return reply({message:"Volunteer records are temporarily unavailable."},503);
 let body:string|undefined;
 if(method==="POST"){
  try{const input:unknown=await req.json();if(!input||typeof input!=="object"||Array.isArray(input))throw Error();
   body=JSON.stringify(input);if(body.length>5000)throw Error();
  }catch{return reply({message:"Check the original volunteer review fields."},400);}
 }
 try{
  const target=new URL("/api/v1/volunteers/"+route.path,base);
  if(method==="GET"&&["roster","roster/export","reviews"].includes(route.path)){
   const allowed=route.path.startsWith("roster")?["q","status","availability","branch","department","offset"]:
    ["q","status","departmentRef","availability","offset"];
   for(const field of allowed){const value=req.nextUrl.searchParams.get(field);if(value!==null&&value.length<=110)target.searchParams.set(field,value);}
  }
  const response=await fetch(target,{method,cache:"no-store",signal:AbortSignal.timeout(13000),
   headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},body});
  if(!response.ok){
   const status=[400,401,403,404,409,429].includes(response.status)?response.status:503;
   return reply({message:status===401?"Sign in again.":status===403?"Your current role cannot access these volunteer records.":
    status===404?"Original volunteer record is unavailable.":status===409?"The protected application changed. Refresh before retrying.":
    status===429?"Too many attempts. Retry later.":status===400?"Check the review filters and the current password.":
    "Volunteer review outcome is uncertain. Refresh before retrying."},status);
  }
  if(route.isFile){
   const mime=(response.headers.get("content-type")??"").split(";")[0].trim();
   if(!["application/pdf","image/jpeg","image/png","image/webp"].includes(mime))return reply({message:"Protected proof type is unavailable."},503);
   const bytes=await response.arrayBuffer();if(!bytes.byteLength||bytes.byteLength>10485760)return reply({message:"Protected document unavailable."},503);
   return new NextResponse(bytes,{headers:{"Content-Type":mime,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Disposition":'attachment; filename="CareGanga-private-volunteer-proof"'}});
  }
  return reply(await response.json());
 }catch{return reply({message:"Protected volunteer result uncertain. Refresh its actual status."},503);}
}
export const GET=(r:NextRequest,c:Ctx)=>proxy(r,c,"GET");
export const POST=(r:NextRequest,c:Ctx)=>proxy(r,c,"POST");
