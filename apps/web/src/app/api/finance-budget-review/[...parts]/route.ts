import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function valid(parts:string[],method:string){
 if(parts.length===1&&["process","cases"].includes(parts[0]))
  return method==="GET"||(parts[0]==="process"&&method==="POST");
 if(parts.length===2&&parts[0]==="cases"&&UUID.test(parts[1]))return method==="GET";
 if(parts.length===3&&parts[0]==="cases"&&UUID.test(parts[1])&&parts[2]==="decisions")
  return method==="POST";
 return false;
}
async function handle(req:NextRequest,parts:string[],method:string){
 if(!valid(parts,method))return NextResponse.json(
  {message:"This budget review action is unavailable."},{status:404});
 if(method!=="GET"&&req.headers.get("origin")!==req.nextUrl.origin)
  return NextResponse.json({message:"Open the original CareGanga claim reviewer form."},{status:403});
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)return NextResponse.json({message:"Session expired. Sign in again."},{status:401});
 const backend=process.env.BACKEND_URL;
 if(!backend)return NextResponse.json({message:"Protected review service is unavailable."},{status:503});
 const target=new URL("/api/approvals/finance-budgets/"+parts.join("/"),backend);
 if(method==="GET"&&parts.length===1&&parts[0]==="cases"){
  const offset=req.nextUrl.searchParams.get("offset")??"0";
  if(!/^(0|[1-9][0-9]{0,4})$/.test(offset))
   return NextResponse.json({message:"Choose a valid review inbox page."},{status:400});
  target.searchParams.set("offset",offset);
 }
 let body:string|undefined;
 if(method==="POST"){
  try{
   const raw:unknown=await req.json();
   if(!raw||typeof raw!=="object"||Array.isArray(raw))throw Error("INVALID");
   body=JSON.stringify(raw);
   if(body.length>2400)throw Error("INVALID");
  }catch{return NextResponse.json({message:"Review the decision form and current password."},{status:400});}
 }
 try{
  const response=await fetch(target,{method,body,cache:"no-store",
   signal:AbortSignal.timeout(15000),
   headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})}});
  const raw:unknown=await response.json().catch(()=>null);
  if(response.ok)return NextResponse.json(raw,{status:response.status,
   headers:{"Cache-Control":"private, no-store"}});
  const obj=raw&&typeof raw==="object"&&!Array.isArray(raw)?raw as Record<string,unknown>:{};
  const status=[400,401,403,404,409,429].includes(response.status)?response.status:503;
  const known=typeof obj.code==="string"&&[
   "FINANCE_BUDGET_REVIEW_INVALID","FINANCE_BUDGET_REVIEW_UNAVAILABLE",
   "FINANCE_BUDGET_STALE","FINANCE_BUDGET_REPLAY_CONFLICT",
   "FINANCE_BUDGET_BILL_INVALID","FINANCE_BUDGET_SOURCE_INVALID"
  ].includes(obj.code)?obj.code:null;
  const message=known&&typeof obj.message==="string"&&obj.message.length<=300?
   obj.message:status===401?"Session expired. Sign in again.":
   status===403?"Only a different authorized protected Foundation reviewer can decide.":
   status===429?"Too many confirmation attempts. Try again later.":
   status===409?"The claim or its verified bill has changed. Refresh before deciding.":
   status===400?"Check the current review revision, action and password.":
   "The decision result cannot be confirmed. Refresh this original case before retrying.";
  return NextResponse.json({message,...(known?{code:known}:{})},
   {status,headers:{"Cache-Control":"private, no-store"}});
 }catch{return NextResponse.json({
  message:"The reviewer result is uncertain. Check this case before repeating the decision."
 },{status:503,headers:{"Cache-Control":"private, no-store"}});}
}
type Ctx={params:Promise<{parts:string[]}>};
export async function GET(req:NextRequest,ctx:Ctx){return handle(req,(await ctx.params).parts,"GET");}
export async function POST(req:NextRequest,ctx:Ctx){return handle(req,(await ctx.params).parts,"POST");}
