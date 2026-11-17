import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const kinds=new Set(["YEAR_CREATE","YEAR_STATUS","GROUP_CREATE","ACCOUNT_CREATE","ACCOUNT_STATUS","OPENING_POST","GENERAL_POST"]);
const financeErrors=new Set([
 "FINANCE_YEAR_NAME_TOO_LONG","FINANCE_GROUP_NAME_TOO_LONG","FINANCE_ACCOUNT_NAME_TOO_LONG","FINANCE_BANK_LABEL_TOO_LONG","FINANCE_GROUP_CATEGORY_INVALID","FINANCE_REQUEST_KEY_INVALID","FINANCE_VOUCHER_EVIDENCE_INVALID","FINANCE_VOUCHER_EVIDENCE_CONFLICT","FINANCE_VOUCHER_REVIEW_UNAVAILABLE","FINANCE_VOUCHER_REVIEW_INVALID","FINANCE_VOUCHER_SOURCE_INVALID","FINANCE_VOUCHER_NAME_INVALID","FINANCE_VOUCHER_PURPOSE_INVALID","FINANCE_VOUCHER_DATE_INVALID","FINANCE_VOUCHER_FORM_INVALID","FINANCE_VOUCHER_TYPE_INVALID","FINANCE_VOUCHER_LINES_INVALID","FINANCE_VOUCHER_QUANTITY_INVALID","FINANCE_VOUCHER_AMOUNT_INVALID","FINANCE_VOUCHER_REPLAY_CONFLICT","FINANCE_VOUCHER_NOT_EDITABLE","FINANCE_VOUCHER_STALE","FINANCE_JOURNAL_MEMO_INVALID","FINANCE_JOURNAL_LINES_INVALID","FINANCE_ACCOUNT_SEARCH_INVALID","FINANCE_ACCOUNT_KIND_INVALID","FINANCE_ACCOUNT_STATUS_INVALID","FINANCE_FILTER_INVALID","FINANCE_BANK_LABEL_INVALID","FINANCE_FORM_INVALID","FINANCE_STALE_RECORD","FINANCE_POSTED_IMMUTABLE","FINANCE_BANK_LAST_FOUR","FINANCE_NAME_REQUIRED","FINANCE_CODE_INVALID","FINANCE_YEAR_DATE_INVALID","FINANCE_YEAR_OVERLAP",
 "FINANCE_DUPLICATE","FINANCE_GROUP_INVALID","FINANCE_SCOPE_INVALID","FINANCE_BRANCH_INACTIVE",
 "FINANCE_BRANCH_STALE","FINANCE_YEAR_CLOSED","FINANCE_ACCOUNT_INACTIVE","FINANCE_ACCOUNT_SCOPE",
 "FINANCE_OPENING_AMOUNT","FINANCE_DEBITS_CREDITS","FINANCE_OPENING_DATE",
 "FINANCE_REQUEST_CONFLICT","FINANCE_PERMISSION","FINANCE_UNAVAILABLE"
]);
function allowed(parts:string[],method:string):boolean{
 if(parts.length===1&&["setup","account-options"].includes(parts[0]))return method==="GET";
 if(parts.length===1&&parts[0]==="manual-journals")return method==="GET"||method==="POST";
 if(parts.length===2&&parts[0]==="vouchers"&&parts[1]==="options")return method==="GET";
 if(parts.length===2&&parts[0]==="vouchers"&&parts[1]==="drafts")return method==="GET"||method==="POST";
 if(parts.length===3&&parts[0]==="vouchers"&&parts[1]==="drafts"&&UUID.test(parts[2]))return method==="GET"||method==="PATCH";
 if(parts.length===3&&parts[0]==="vouchers"&&parts[1]==="draft-commands"&&UUID.test(parts[2]))return method==="GET";
 if(parts.length===4&&parts[0]==="vouchers"&&parts[1]==="drafts"
   &&UUID.test(parts[2])&&parts[3]==="submit")return method==="POST";
 if(parts.length===3&&parts[0]==="vouchers"&&UUID.test(parts[1])
   &&parts[2]==="settle")return method==="POST";
 if(parts.length===3&&parts[0]==="vouchers"&&parts[1]==="workflow-commands"
   &&UUID.test(parts[2]))return method==="GET";
 if(parts.length===1&&["years","groups","accounts","opening-journals"].includes(parts[0]))
  return method==="POST";
 if(parts.length===3&&["years","accounts"].includes(parts[0])&&UUID.test(parts[1])
   &&parts[2]==="status")return method==="PATCH";
 if(parts.length===3&&parts[0]==="commands"&&kinds.has(parts[1])&&UUID.test(parts[2]))
  return method==="GET";
 return false;
}
async function handler(request:NextRequest,parts:string[],method:string){
 if(!allowed(parts,method))return NextResponse.json(
  {message:"This finance action is not available."},{status:404});
 if(method!=="GET"&&request.headers.get("origin")!==request.nextUrl.origin)
  return NextResponse.json({message:"Submit this form from your CareGanga finance page."},{status:403});
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)return NextResponse.json({message:"Your session expired. Sign in again."},{status:401});
 const backend=process.env.BACKEND_URL;
 if(!backend)return NextResponse.json({message:"Finance service is unavailable. Please try again later."},{status:503});
 let body:string|undefined;
 if(method!=="GET"){
  try{
   const parsed:unknown=await request.json();
   if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))throw Error("FORM");
   body=JSON.stringify(parsed);
   if(body.length>12000)throw Error("FORM");
  }catch{return NextResponse.json({message:"Review the finance form and complete the required details."},{status:400});}
 }
 const target=new URL("/api/finance-accounting/"+parts.join("/"),backend);
 if(method==="GET"&&parts[0]==="vouchers"&&parts[1]==="drafts"&&parts.length===2){
  const offset=request.nextUrl.searchParams.get("offset")??"0";
  if(!/^(0|[1-9][0-9]{0,4})$/.test(offset))
   return NextResponse.json({message:"Choose a valid voucher list page and try again."},{status:400});
  target.searchParams.set("offset",offset);
 }
 if(method==="GET"&&parts[0]==="account-options"){
  const query=request.nextUrl.searchParams.get("q")??"";
  if(query.length>80)
   return NextResponse.json({message:"Search by a shorter account name or code (up to 80 characters)."},
    {status:400});
  target.searchParams.set("q",query);
 }
 if(method==="GET"&&parts[0]==="setup"){
  const search=request.nextUrl.searchParams.get("search")??"";
  const offset=request.nextUrl.searchParams.get("offset")??"0";
  if(search.length>80||!/^(0|[1-9][0-9]{0,5})$/.test(offset))
   return NextResponse.json({message:"Check the account search or page number."},{status:400});
  target.searchParams.set("search",search);target.searchParams.set("offset",offset);
  const kinds=new Set(["ALL","GENERAL","CASH","BANK"]);
  const statuses=new Set(["ALL","ACTIVE","INACTIVE"]);
  const kind=request.nextUrl.searchParams.get("kind")??"ALL";
  const status=request.nextUrl.searchParams.get("status")??"ALL";
  const groupRef=request.nextUrl.searchParams.get("groupRef")??"";
  const branchRef=request.nextUrl.searchParams.get("branchRef")??"";
  const yearRef=request.nextUrl.searchParams.get("yearRef")??"";
  if(!kinds.has(kind)||!statuses.has(status)||
    (groupRef&&!UUID.test(groupRef))||(branchRef&&!UUID.test(branchRef))||
    (yearRef&&!UUID.test(yearRef)))
   return NextResponse.json({message:"Choose a valid financial year, account type, status, group or branch before searching."},{status:400});
  for(const [key,value] of Object.entries({kind,status,groupRef,branchRef,yearRef}))
   if(value)target.searchParams.set(key,value);
 }
 try{
  const res=await fetch(target,{method,body,cache:"no-store",
   signal:AbortSignal.timeout(12000),
   headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})}});
  const data:unknown=await res.json().catch(()=>null);
  if(res.ok)return NextResponse.json(data,{status:res.status,headers:{"Cache-Control":"no-store"}});
  const safeStatus=[400,401,403,404,409,429].includes(res.status)?res.status:503;
  const obj=data&&typeof data==="object"&&!Array.isArray(data)?data as Record<string,unknown>:{};
  const code=typeof obj.code==="string"&&financeErrors.has(obj.code)?obj.code:null;
  const fields=new Set(["proofFileRef","proofVersion","caseRef","requestKey","voucherRef","purpose","payeeName","voucherType","postingDate","quantity","unitRate","tax","charges","expectedVersion","description","lines","search","offset","name","code","category","startOn","endOn","scopeKind","branchRef",
   "groupRef","parentRef","financialYearRef","bankLabel","accountKind","bankLastFour","postingDate","amount","debitAccountRef","creditAccountRef"]);
  const field=code&&typeof obj.field==="string"&&fields.has(obj.field)?obj.field:null;
  const explanation=code&&typeof obj.message==="string"&&obj.message.length<=300?
   obj.message:safeStatus===401?"Your session expired. Sign in again.":
   safeStatus===403?"You do not have permission for this finance action. Ask your Administrator.":
   safeStatus===409?"Finance information changed. Refresh before saving.":
   safeStatus===429?"Too many requests. Try again after a short break.":
   safeStatus===400?"Review the highlighted finance fields and correct them.":
   "The result cannot be confirmed. Check the request status before trying again.";
  return NextResponse.json({message:explanation,...(code?{code}:{}),...(field?{field}:{})},
    {status:safeStatus,headers:{"Cache-Control":"no-store"}});
 }catch{
  return NextResponse.json(
   {message:"The result cannot be confirmed. Check the request status before trying again."},
   {status:503,headers:{"Cache-Control":"no-store"}});
 }
}
type Ctx={params:Promise<{parts:string[]}>};
export async function GET(r:NextRequest,c:Ctx){return handler(r,(await c.params).parts,"GET");}
export async function POST(r:NextRequest,c:Ctx){return handler(r,(await c.params).parts,"POST");}
export async function PATCH(r:NextRequest,c:Ctx){return handler(r,(await c.params).parts,"PATCH");}
