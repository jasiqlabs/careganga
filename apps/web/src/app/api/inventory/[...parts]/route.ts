import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
import {isAllowedOrigin} from "../../../../shared/request-origin";
export const dynamic="force-dynamic";
type Context={params:Promise<{parts:string[]}>};
async function proxy(req:NextRequest,ctx:Context,method:"GET"|"POST"|"PATCH"){
 const parts=(await ctx.params).parts;
 const ref=(v:string|undefined)=>!!v&&/^[a-f0-9-]{36}$/i.test(v);
 const stock=parts[0]==="stock"&&(parts.length===2&&(method==="GET"?["drafts","events","summary"]:method==="POST"?["drafts"]:[]).includes(parts[1])||parts.length===3&&method==="GET"&&parts[1]==="drafts"&&ref(parts[2])||parts.length===4&&method==="POST"&&ref(parts[2])&&((parts[1]==="drafts"&&parts[3]==="confirm")||(parts[1]==="events"&&parts[3]==="reverse")));
 const evidence=parts[0]==="evidence"&&(parts.length===2&&parts[1]==="intents"&&method==="POST"||parts.length===3&&method==="GET"&&["intents","receipts"].includes(parts[1])&&ref(parts[2])||parts.length===4&&method==="POST"&&parts[1]==="intents"&&ref(parts[2])&&parts[3]==="confirm");
 const material=parts[0]==="material-requests"&&(parts.length===1&&["GET","POST"].includes(method)||parts.length===2&&(parts[1]==="process"&&["GET","POST"].includes(method)||ref(parts[1])&&method==="PATCH")||parts.length===3&&ref(parts[1])&&["submit","reserve","cancel"].includes(parts[2])&&method==="POST"||parts.length===4&&parts[1]==="reviews"&&ref(parts[2])&&parts[3]==="decide"&&method==="POST");
 const operations=parts[0]==="operations"&&(parts.length===1&&["GET","POST"].includes(method)||parts.length===2&&(["held-requests","recipients"].includes(parts[1])&&method==="GET"||parts[1]==="process"&&method==="POST")||parts.length===3&&ref(parts[1])&&parts[2]==="confirm"&&method==="POST"||parts.length===4&&parts[1]==="reviews"&&ref(parts[2])&&parts[3]==="decide"&&method==="POST");
 const movement=parts[0]==="movement-evidence"&&(parts.length===2&&parts[1]==="intents"&&method==="POST"||parts.length===3&&method==="GET"&&["intents","operations"].includes(parts[1])&&ref(parts[2])||parts.length===4&&method==="POST"&&parts[1]==="intents"&&ref(parts[2])&&parts[3]==="confirm");
 const reports=parts[0]==="reports"&&parts.length===1&&["GET","POST"].includes(method);
 const valid=operations||movement||reports||material||stock||evidence||parts.length===1&&(method==="GET"?["options","items","suppliers"]:method==="POST"?["items","suppliers","locations","threshold"]:[]).includes(parts[0])||parts.length===2&&["items","suppliers","locations"].includes(parts[0])&&/^[a-f0-9-]{36}$/i.test(parts[1])&&["GET","PATCH"].includes(method)||parts.length===3&&parts[0]==="suppliers"&&/^[a-f0-9-]{36}$/i.test(parts[1])&&parts[2]==="private"&&["GET","PATCH"].includes(method);
 if(!valid)return NextResponse.json({message:"This inventory action is unavailable."},{status:404});
 const token=(await cookies()).get("cg_staff_session")?.value;
 const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store"}});
 if(method!=="GET"&&(!isAllowedOrigin(req)||req.headers.get("sec-fetch-site")==="cross-site"))return reply({message:"Open this inventory action from the secure staff dashboard."},403);
 if(!token)return reply({message:"Sign in again."},401);
 const base=process.env.BACKEND_URL;if(!base)return reply({message:"Inventory is unavailable."},503);
 try{
  const url=new URL("/api/v1/inventory/"+parts.join("/"),base);
  for(const k of ["location","q","offset","status","kind","from","to","priority","review","category","report","requestType"])if(req.nextUrl.searchParams.has(k))url.searchParams.set(k,req.nextUrl.searchParams.get(k)!);
  let body:string|undefined;if(method!=="GET"){body=await req.text();if(body.length>32768)return reply({message:"Check the inventory fields."},400);}
  const response=await fetch(url,{method,headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body,cache:"no-store",signal:AbortSignal.timeout(12000)});
  const value:unknown=await response.json().catch(()=>null);
  if(response.ok)return reply(value,response.status);
  const approved=["CG12_CATALOG_INVALID","CG12_UNIT_INVALID","CG12_QUANTITY_INVALID","CG12_DUPLICATE_CODE","CG12_COMMAND_CHANGED","CG12_STALE","CG12_RECEIPT_INVALID","CG12_SOURCE_CHANGED","CG12_RECEIPT_PROOF","CG12_STOCK_SHORTAGE","CG12_RECEIPT_REVERSED","CG12_REVIEW_UNCONFIGURED","CG12_REVIEW_REQUIRED","CG12_PROOF_REQUIRED"];
  const safe=value&&typeof value==="object"&&"code" in value&&typeof value.code==="string"&&approved.includes(value.code)&&"message" in value&&typeof value.message==="string"&&value.message.length<=220?value.message:null;
  return reply({message:safe??(response.status===401?"Sign in again.":response.status===403?"Your current role or store does not permit this action.":response.status===409?"This record changed. Refresh the catalog.":response.status===400?"Check the inventory fields.":"The result could not be confirmed. Check the catalog before retrying.")},response.status);
 }catch{return reply({message:"Could not confirm the result. Retry the same request."},503);}
}
export const GET=(req:NextRequest,ctx:Context)=>proxy(req,ctx,"GET");
export const POST=(req:NextRequest,ctx:Context)=>proxy(req,ctx,"POST");
export const PATCH=(req:NextRequest,ctx:Context)=>proxy(req,ctx,"PATCH");
