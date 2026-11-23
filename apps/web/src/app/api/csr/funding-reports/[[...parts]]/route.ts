import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type Context={params:Promise<{parts?:string[]}>};
const error=(message:string,status:number)=>NextResponse.json({message},{status,
 headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
export async function GET(req:NextRequest,ctx:Context){
 const parts=(await ctx.params).parts??[];
 const csv=parts.length===2&&parts[0]==="export"&&parts[1]==="csv";
 if(!(parts.length===0||csv))
  return error("CSR report path unavailable.",404);
 const allow=new Set(["branchRef","partnerRef","projectRef","status","from","to","q","cursor"]);
 if([...req.nextUrl.searchParams.keys()].some(k=>!allow.has(k))||
  (csv&&req.nextUrl.searchParams.has("cursor")))
  return error("Use original CSR report filters.",400);
 const session=(await cookies()).get("cg_staff_session")?.value;
 if(!session)return error("Sign in to view the CSR funding report.",401);
 const backend=process.env.BACKEND_URL;
 if(!backend)return error("CSR report source unavailable.",503);
 try{
  const url=new URL("/api/v1/csr/funding-reports"+(csv?"/export/csv":""),backend);
  for(const [k,v] of req.nextUrl.searchParams)url.searchParams.append(k,v);
  const response=await fetch(url,{cache:"no-store",signal:AbortSignal.timeout(18000),
   headers:{Authorization:"Bearer "+session}});
  if(response.ok){
   if(csv){
    const body=await response.text();
    if(body.length>900000)return error("Narrow this report export.",409);
    return new NextResponse(body,{status:200,headers:{
     "Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff",
     "Content-Type":"text/csv; charset=utf-8",
     "Content-Disposition":'attachment; filename="careganga-csr-funding.csv"'}});
   }
   return NextResponse.json(await response.json(),{headers:{
    "Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
  }
  const status=[400,401,403,409,429].includes(response.status)?response.status:503;
  return error(status===401?"Sign in again.":status===403?
   "This private finance report is restricted by your role or branch.":status===409?
   "Narrow or refresh your original CSR report scope.":status===400?
   "Check the source filters, status and dates.":
   "Original CG09 finance verification is unavailable.",status);
 }catch{return error("Original CG09 report unavailable. Finance verification pending.",503);}
}
