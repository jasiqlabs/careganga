import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type Context={params:Promise<{parts?:string[]}>};
const uuid=(x:string)=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(x);
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store"}});
async function proxy(req:NextRequest,ctx:Context,method:"GET"|"POST"){
 const p=(await ctx.params).parts??[];
 const pdf=method==="GET"&&p.length===4&&p[0]==="payslips"&&uuid(p[1])&&uuid(p[2])&&p[3]==="download";
 const slips=method==="GET"&&p.length===2&&p[0]==="me"&&p[1]==="payslips"||method==="POST"&&p.length===3&&p[0]==="payslips"&&uuid(p[1])&&["issue","email"].includes(p[2]);
 const valid=pdf||slips||method==="GET"&&(p.length===1&&["me","employee-options","policies","review-cases","run-review-cases","leave-rule-options","bank-options","runs"].includes(p[0])||p.length===2&&(["review-cases","run-review-cases"].includes(p[0])&&uuid(p[1])||p[0]==="runs"&&(p[1]==="options"||uuid(p[1])))||p.length===3&&p[0]==="runs"&&uuid(p[1])&&["validation","history","late-options","accrual-options","batch-options","payment-outcomes","payment-report"].includes(p[2])||p.length===3&&p[0]==="employees"&&uuid(p[1])&&["compensation","salary-history","payout-instruction","hr-proposals"].includes(p[2]))||method==="POST"&&(p.length===1&&p[0]==="policies"||p.length===2&&p[0]==="runs"&&p[1]==="draft"||p.length===3&&p[0]==="runs"&&uuid(p[1])&&["import-current-attendance","calculate","adjust","submit-review","late-adjustment","request-release","prepare-batch","request-payout"].includes(p[2])||p.length===3&&p[0]==="employees"&&uuid(p[1])&&["compensation","payout-instruction"].includes(p[2])||p.length===4&&p[0]==="sources"&&["POLICY","COMPENSATION","PAYOUT"].includes(p[1])&&uuid(p[2])&&p[3]==="submit"||p.length===3&&["review-cases","run-review-cases"].includes(p[0])&&uuid(p[1])&&p[2]==="decide");
 if(!valid)return reply({message:"Payroll action unavailable"},404);
 if(method==="POST"&&req.headers.get("origin")!==req.nextUrl.origin)return reply({message:"Request origin not allowed"},403);
 const token=(await cookies()).get("cg_staff_session")?.value;if(!token)return reply({message:"Sign in again"},401);
 const base=process.env.BACKEND_URL;if(!base)return reply({message:"Payroll unavailable"},503);
 try{
  const url=new URL("/api/v1/payroll/"+p.join("/"),base);
  for(const k of ["branchRef","period","afterPeriod","afterRun","q","offset","department","employmentType","employmentStatus","salaryStatus","state"]){const v=req.nextUrl.searchParams.get(k);if(v!==null&&v.length<=100)url.searchParams.set(k,v);}
  const body=method==="POST"?await req.text():undefined;if(body&&body.length>32000)return reply({message:"Check payroll fields"},400);
  const r=await fetch(url,{method,body,headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},cache:"no-store",signal:AbortSignal.timeout(p[0]==="runs"&&method==="POST"?60000:12000)});
  if(pdf&&r.ok&&r.headers.get("content-type")?.split(";")[0]==="application/pdf"){const bytes=await r.arrayBuffer();if(bytes.byteLength>10485760)return reply({message:"Document unavailable"},503);return new NextResponse(bytes,{headers:{"Content-Type":"application/pdf","Content-Disposition":'attachment; filename="CareGanga-Salary-Statement.pdf"',"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});}
  const data=await r.json().catch(()=>null);if(r.ok&&data!==null)return reply(data,r.status);
  return reply({message:r.status===401?"Sign in again":r.status===403?"Current payroll authority denied":r.status===404?"Payroll source unavailable":r.status===400?"Check the payroll fields and dates":r.status===409?"Original source or approval changed. Refresh and check the effective period.":"Outcome not confirmed. Refresh and retry the same request."},r.ok?503:r.status);
 }catch{return reply({message:"Outcome not confirmed. Refresh and retry the same request."},503);}
}
export const GET=(req:NextRequest,ctx:Context)=>proxy(req,ctx,"GET");
export const POST=(req:NextRequest,ctx:Context)=>proxy(req,ctx,"POST");
