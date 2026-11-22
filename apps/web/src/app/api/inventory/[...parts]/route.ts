import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type Context={params:Promise<{parts:string[]}>};
async function proxy(req:NextRequest,ctx:Context,method:"GET"|"POST"|"PATCH"){
 const parts=(await ctx.params).parts;
 const valid=parts.length===1&&(method==="GET"?["options","items","suppliers"]:method==="POST"?["items","suppliers","locations","threshold"]:[]).includes(parts[0])||parts.length===2&&["items","suppliers","locations"].includes(parts[0])&&/^[a-f0-9-]{36}$/i.test(parts[1])&&["GET","PATCH"].includes(method)||parts.length===3&&parts[0]==="suppliers"&&/^[a-f0-9-]{36}$/i.test(parts[1])&&parts[2]==="private"&&["GET","PATCH"].includes(method);
 if(!valid)return NextResponse.json({message:"This inventory action is unavailable."},{status:404});
 const token=(await cookies()).get("cg_staff_session")?.value;
 const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store"}});
 if(!token)return reply({message:"Sign in again."},401);
 const base=process.env.BACKEND_URL;if(!base)return reply({message:"Inventory is unavailable."},503);
 try{
  const url=new URL("/api/v1/inventory/"+parts.join("/"),base);
  for(const k of ["location","q","offset"])if(req.nextUrl.searchParams.has(k))url.searchParams.set(k,req.nextUrl.searchParams.get(k)!);
  let body:string|undefined;if(method!=="GET"){body=await req.text();if(body.length>8192)return reply({message:"Check the inventory fields."},400);}
  const response=await fetch(url,{method,headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body,cache:"no-store",signal:AbortSignal.timeout(12000)});
  const value:unknown=await response.json().catch(()=>null);
  if(response.ok)return reply(value,response.status);
  const approved=["CG12_CATALOG_INVALID","CG12_UNIT_INVALID","CG12_QUANTITY_INVALID","CG12_DUPLICATE_CODE","CG12_COMMAND_CHANGED","CG12_STALE"];
  const safe=value&&typeof value==="object"&&"code" in value&&typeof value.code==="string"&&approved.includes(value.code)&&"message" in value&&typeof value.message==="string"&&value.message.length<=220?value.message:null;
  return reply({message:safe??(response.status===401?"Sign in again.":response.status===403?"Your current role or store does not permit this action.":response.status===409?"This record changed. Refresh the catalog.":response.status===400?"Check the inventory fields.":"The result could not be confirmed. Check the catalog before retrying.")},response.status);
 }catch{return reply({message:"Could not confirm the result. Retry the same request."},503);}
}
export const GET=(req:NextRequest,ctx:Context)=>proxy(req,ctx,"GET");
export const POST=(req:NextRequest,ctx:Context)=>proxy(req,ctx,"POST");
export const PATCH=(req:NextRequest,ctx:Context)=>proxy(req,ctx,"PATCH");
