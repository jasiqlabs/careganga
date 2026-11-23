import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type Context={params:Promise<{parts?:string[]}>};
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const response=(payload:unknown,status:number)=>NextResponse.json(payload,{status,headers:{
 "Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"
}});
export async function POST(request:NextRequest,ctx:Context){
 const parts=(await ctx.params).parts??[];
 if(parts.length!==3||parts[0]!=="redemptions"||
  !UUID.test(parts[1])||parts[2]!=="prepare-issue")
  return response({message:"That stock issue action is unavailable."},404);
 if(request.nextUrl.search||request.headers.get("origin")!==request.nextUrl.origin)
  return response({message:"Use the authenticated Foundation stock issue action."},403);
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)return response({message:"Sign in as authorized Foundation stock staff."},401);
 const backend=process.env.BACKEND_URL;
 if(!backend)return response({message:"Current warehouse source unavailable."},503);
 try{
  const url=new URL("/api/v1/rewards/admin/"+parts.join("/"),backend);
  const result=await fetch(url,{method:"POST",cache:"no-store",
   signal:AbortSignal.timeout(15000),headers:{Authorization:"Bearer "+token}});
  const body:unknown=await result.json().catch(()=>null);
  if(result.ok&&body)return response(body,result.status);
  const safe=[401,403,404,409,429].includes(result.status)?result.status:503;
  return response({message:safe===401?"Sign in again.":
   safe===403?"Your current inventory and rewards role or warehouse branch does not permit this action.":
   safe===404?"The original held physical reward is unavailable.":
   safe===409?"The original redemption or stock reservation changed. Refresh its status.":
   safe===429?"Too many warehouse requests. Try again shortly.":
   "Warehouse issue status may be uncertain. Open existing Stock Operations to check before retrying."},safe);
 }catch{return response({message:"Warehouse preparation outcome uncertain. Check original Stock Operations first."},503);}
}
