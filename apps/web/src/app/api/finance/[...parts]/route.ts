import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const kinds=new Set(["YEAR_CREATE","YEAR_STATUS","GROUP_CREATE","ACCOUNT_CREATE","ACCOUNT_STATUS","OPENING_POST","GENERAL_POST"]);
const financeErrors=new Set([
 "FINANCE_YEAR_NAME_TOO_LONG","FINANCE_GROUP_NAME_TOO_LONG","FINANCE_ACCOUNT_NAME_TOO_LONG","FINANCE_BANK_LABEL_TOO_LONG","FINANCE_GROUP_CATEGORY_INVALID","FINANCE_REQUEST_KEY_INVALID","FINANCE_PAYROLL_BANK_FUNDS_UNAVAILABLE","FINANCE_PAYROLL_SIGNER_UNAVAILABLE","FINANCE_PAYROLL_PROVIDER_PROOF_MISMATCH","FINANCE_VOUCHER_POSTING_NOT_READY","FINANCE_VOUCHER_PAYMENT_PROOF_NOT_READY","FINANCE_VOUCHER_PAYMENT_PROOF_INVALID","FINANCE_VOUCHER_PAYMENT_PROOF_CONFLICT","FINANCE_VOUCHER_PAYMENT_VERIFICATION_INVALID","FINANCE_VOUCHER_ACCOUNT_SIDES_INVALID","FINANCE_VOUCHER_PAYMENT_ACCOUNT_REQUIRED","FINANCE_VOUCHER_PAYMENT_ACCOUNT_UNAVAILABLE","FINANCE_VOUCHER_EVIDENCE_INVALID","FINANCE_VOUCHER_EVIDENCE_CONFLICT","FINANCE_VOUCHER_REVIEW_UNAVAILABLE","FINANCE_VOUCHER_REVIEW_INVALID","FINANCE_VOUCHER_SOURCE_INVALID","FINANCE_VOUCHER_NAME_INVALID","FINANCE_VOUCHER_PURPOSE_INVALID","FINANCE_VOUCHER_DATE_INVALID","FINANCE_VOUCHER_FORM_INVALID","FINANCE_VOUCHER_TYPE_INVALID","FINANCE_VOUCHER_LINES_INVALID","FINANCE_VOUCHER_QUANTITY_INVALID","FINANCE_VOUCHER_AMOUNT_INVALID","FINANCE_VOUCHER_REPLAY_CONFLICT","FINANCE_VOUCHER_NOT_EDITABLE","FINANCE_VOUCHER_STALE","FINANCE_JOURNAL_MEMO_INVALID","FINANCE_JOURNAL_LINES_INVALID","FINANCE_ACCOUNT_SEARCH_INVALID","FINANCE_ACCOUNT_KIND_INVALID","FINANCE_ACCOUNT_STATUS_INVALID","FINANCE_FILTER_INVALID","FINANCE_BANK_LABEL_INVALID","FINANCE_FORM_INVALID","FINANCE_STALE_RECORD","FINANCE_POSTED_IMMUTABLE","FINANCE_BANK_LAST_FOUR","FINANCE_NAME_REQUIRED","FINANCE_CODE_INVALID","FINANCE_YEAR_DATE_INVALID","FINANCE_YEAR_OVERLAP",
 "FINANCE_DUPLICATE","FINANCE_GROUP_INVALID","FINANCE_SCOPE_INVALID","FINANCE_BRANCH_INACTIVE",
 "FINANCE_BRANCH_STALE","FINANCE_YEAR_CLOSED","FINANCE_ACCOUNT_INACTIVE","FINANCE_ACCOUNT_SCOPE",
 "FINANCE_OPENING_AMOUNT","FINANCE_DEBITS_CREDITS","FINANCE_OPENING_DATE","FINANCE_JOURNAL_REVERSAL_INVALID","FINANCE_JOURNAL_REVERSAL_CONFLICT",
 "FINANCE_REQUEST_CONFLICT","FINANCE_PERMISSION","FINANCE_UNAVAILABLE",
 "FINANCE_CLAIM_FORM_INVALID","FINANCE_CLAIM_REQUEST_KEY_INVALID","FINANCE_CLAIM_PURPOSE_INVALID","FINANCE_CLAIM_BREAKDOWN_INVALID",
 "FINANCE_CLAIM_CATEGORY_INVALID","FINANCE_CLAIM_DATE_INVALID","FINANCE_CLAIM_AMOUNT_INVALID",
 "FINANCE_CLAIM_REPLAY_CONFLICT","FINANCE_CLAIM_FILTER_INVALID",
 "FINANCE_CLAIM_SOURCE_INVALID","FINANCE_CLAIM_NOT_EDITABLE","FINANCE_CLAIM_BILL_INVALID",
 "FINANCE_CLAIM_BILL_CONFLICT","FINANCE_CLAIM_REVIEW_INVALID","FINANCE_CLAIM_REVIEW_UNAVAILABLE",
 "FINANCE_CLAIM_STALE","FINANCE_CLAIM_VOUCHER_INVALID",
 "FINANCE_INVOICE_SOURCE_INVALID","FINANCE_INVOICE_FORM_INVALID",
 "FINANCE_INVOICE_TEXT_INVALID","FINANCE_INVOICE_DATE_INVALID",
 "FINANCE_INVOICE_AMOUNT_INVALID","FINANCE_INVOICE_ITEMS_INVALID",
 "FINANCE_INVOICE_ACCOUNT_INVALID","FINANCE_INVOICE_STAGE_INVALID",
 "FINANCE_INVOICE_STALE","FINANCE_INVOICE_REPLAY_CONFLICT",
 "FINANCE_INVOICE_REVIEW_UNAVAILABLE","FINANCE_INVOICE_REVIEW_INVALID",
 "FINANCE_INVOICE_INCOMPLETE","FINANCE_INVOICE_POSTING_NOT_READY",
 "FINANCE_INVOICE_NOT_ISSUABLE","FINANCE_INVOICE_DOCUMENT_UNAVAILABLE",
 "FINANCE_INVOICE_ISSUE_CONFLICT","FINANCE_INVOICE_FILTER_INVALID","FINANCE_INVOICE_RECEIPT_NOT_READY",
 "FINANCE_INVOICE_CANCEL_INVALID","FINANCE_INVOICE_CANCEL_CONFLICT",
 "FINANCE_ADJUSTMENT_INVALID","FINANCE_ADJUSTMENT_NOT_FOUND",
 "FINANCE_CREDIT_NOTE_CONFLICT","FINANCE_CREDIT_NOTE_ALREADY_EXISTS",
 "FINANCE_INVOICE_REISSUE_CONFLICT",
 "FINANCE_CREDIT_NOTE_COLLECTION_PENDING","FINANCE_CREDIT_NOTE_REFUND_ACCOUNT_REQUIRED",
 "FINANCE_CREDIT_NOTE_NOT_FOUND","FINANCE_REFUND_CONFLICT","FINANCE_REFUND_NOT_REQUIRED",
 "FINANCE_REFUND_ALREADY_REQUESTED","FINANCE_REFUND_BANK_INVALID",
 "FINANCE_REFUND_NOT_FOUND","FINANCE_REFUND_ALREADY_APPROVED",
 "FINANCE_REFUND_INDEPENDENT_REVIEWER",
 "FINANCE_BUDGET_SOURCE_INVALID","FINANCE_BUDGET_DUPLICATE","FINANCE_BUDGET_STALE",
 "FINANCE_BUDGET_FORM_INVALID","FINANCE_BUDGET_AMOUNT_INVALID",
 "FINANCE_BUDGET_PERIOD_INVALID","FINANCE_BUDGET_REPLAY_CONFLICT",
 "FINANCE_BUDGET_REVIEW_INVALID","FINANCE_BUDGET_REVIEW_UNAVAILABLE",
 "FINANCE_BUDGET_NOT_APPROVED","FINANCE_BUDGET_EVENT_INVALID",
 "FINANCE_BUDGET_FILTER_INVALID",
 "FINANCE_REPORT_FILTER_INVALID","FINANCE_REPORT_TOO_LARGE",
 "FINANCE_RECONCILIATION_INVALID","FINANCE_RECONCILIATION_CONFLICT",
 "FINANCE_RECONCILIATION_VARIANCE",
 "FINANCE_RECONCILIATION_EVIDENCE_INVALID","FINANCE_RECONCILIATION_EVIDENCE_CONFLICT"
]);
function allowed(parts:string[],method:string):boolean{
 if(parts[0]==="reports"){
  if(parts.length===3&&parts[1]==="export"&&parts[2]==="csv")return method==="GET";
  if(parts.length===2&&["options","summary","general-ledger","trial-balance",
     "day-book","cash-book","bank-book","receivables"].includes(parts[1]))return method==="GET";
  if(parts.length===3&&parts[1]==="reconciliation"&&
     ["banks","matches"].includes(parts[2]))
   return parts[2]==="banks"?method==="GET":method==="GET"||method==="POST";
  if(parts.length===5&&parts[1]==="reconciliation"&&parts[2]==="banks"&&
     UUID.test(parts[3])&&parts[4]==="entries")return method==="GET";
  if(parts.length===5&&parts[1]==="reconciliation"&&parts[2]==="matches"&&
     UUID.test(parts[3])&&parts[4]==="decision")return method==="POST";
  return false;
 }
 if(parts[0]==="budgets"){
  if(parts.length===2&&["options","list","dashboard"].includes(parts[1]))return method==="GET";
  if(parts.length===2&&parts[1]==="drafts")return method==="POST";
  if(parts.length===3&&parts[1]==="drafts"&&UUID.test(parts[2]))return method==="PATCH";
  if(parts.length===3&&parts[1]==="commands"&&UUID.test(parts[2]))return method==="GET";
  if(parts.length===2&&UUID.test(parts[1]))return method==="GET";
  if(parts.length===3&&UUID.test(parts[1])&&parts[2]==="eligible-expenses")return method==="GET";
  if(parts.length===3&&UUID.test(parts[1])&&["submit","reconcile","events","archive"].includes(parts[2]))
   return method==="POST";
  return false;
 }
 if(parts[0]==="invoices"){
  if(parts.length===4&&parts[1]==="refunds"&&UUID.test(parts[2])&&parts[3]==="approve")return method==="POST";
  if(parts.length===4&&UUID.test(parts[1])&&parts[2]==="credit-note"&&parts[3]==="pdf")return method==="GET";
  if(parts.length===3&&UUID.test(parts[1])&&["adjustment","adjustment-options"].includes(parts[2]))return method==="GET";
  if(parts.length===3&&UUID.test(parts[1])&&["credit-note","refunds"].includes(parts[2]))return method==="POST";
  if(parts.length===2&&["options","posting-accounts","dashboard","draft-commands","workflow-commands","cancel-commands","drafts"].includes(parts[1])){
   if(["draft-commands","workflow-commands","cancel-commands"].includes(parts[1]))return false;
   return parts[1]==="drafts"?(method==="GET"||method==="POST"):method==="GET";
  }
  if(parts.length===2&&parts[1]==="cancel-eligibility")return method==="GET";
  if(parts.length===3&&["draft-commands","workflow-commands","cancel-commands"].includes(parts[1])&&UUID.test(parts[2]))return method==="GET";
  if(parts.length===3&&parts[1]==="drafts"&&UUID.test(parts[2]))return method==="GET";
  if(parts.length===4&&parts[1]==="drafts"&&UUID.test(parts[2])&&parts[3]==="stages")return method==="PATCH";
  if(parts.length===3&&UUID.test(parts[1])&&["receipt","receipt-options","collection-options"].includes(parts[2]))return method==="GET";
  if(parts.length===3&&UUID.test(parts[1])&&["submit","reconcile","post","issue","link-receipt","record-collection","cancel-posted"].includes(parts[2]))return method==="POST";
  return false;
 }
 if(parts.length===2&&parts[0]==="claims"&&parts[1]==="dashboard")return method==="GET";
 if(parts.length===2&&parts[0]==="claims"&&parts[1]==="approved-options")return method==="GET";
 if(parts.length===3&&parts[0]==="claims"&&parts[1]==="workflow-commands"&&UUID.test(parts[2]))return method==="GET";
 if(parts.length===3&&parts[0]==="claims"&&UUID.test(parts[1])&&
   parts[2]==="eligible-vouchers")return method==="GET";
 if(parts.length===3&&parts[0]==="claims"&&UUID.test(parts[1])&&
   ["correct","submit","reconcile","link-voucher"].includes(parts[2]))return method==="POST";
 if(parts.length===2&&parts[0]==="claims"&&UUID.test(parts[1]))return method==="GET";
 if(parts.length===2&&parts[0]==="claims"&&parts[1]==="drafts")return method==="POST";
 if(parts.length===2&&parts[0]==="claims"&&["mine","managed"].includes(parts[1]))return method==="GET";
 if(parts.length===3&&parts[0]==="claims"&&parts[1]==="draft-commands"&&UUID.test(parts[2]))return method==="GET";
 if(parts.length===1&&["setup","account-options"].includes(parts[0]))return method==="GET";
 if(parts.length===1&&parts[0]==="manual-journals")return method==="GET"||method==="POST";
 if(parts.length===2&&parts[0]==="manual-journals"&&parts[1]==="reversal-eligibility")return method==="GET";
 if(parts.length===3&&parts[0]==="manual-journals"&&parts[1]==="reversal-commands"&&UUID.test(parts[2]))return method==="GET";
 if(parts.length===3&&parts[0]==="manual-journals"&&UUID.test(parts[1])&&parts[2]==="reverse")return method==="POST";
 if(parts.length===2&&parts[0]==="vouchers"&&parts[1]==="options")return method==="GET";
 if(parts.length===2&&parts[0]==="vouchers"&&parts[1]==="dashboard")return method==="GET";
 if(parts.length===2&&parts[0]==="vouchers"&&parts[1]==="payment-accounts")return method==="GET";
 if(parts.length===2&&parts[0]==="vouchers"&&parts[1]==="posting-accounts")return method==="GET";
 if(parts.length===2&&parts[0]==="vouchers"&&parts[1]==="drafts")return method==="GET"||method==="POST";
 if(parts.length===3&&parts[0]==="vouchers"&&parts[1]==="drafts"&&UUID.test(parts[2]))return method==="GET"||method==="PATCH";
 if(parts.length===5&&parts[0]==="vouchers"&&parts[1]==="drafts"
   &&UUID.test(parts[2])&&parts[3]==="revisions"&&/^[1-9][0-9]{0,5}$/.test(parts[4]))
  return method==="GET";
 if(parts.length===3&&parts[0]==="vouchers"&&parts[1]==="draft-commands"&&UUID.test(parts[2]))return method==="GET";
 if(parts.length===4&&parts[0]==="vouchers"&&parts[1]==="drafts"
   &&UUID.test(parts[2])&&parts[3]==="submit")return method==="POST";
 if(parts.length===3&&parts[0]==="vouchers"&&UUID.test(parts[1])
   &&parts[2]==="settle")return method==="POST";
 if(parts.length===3&&parts[0]==="vouchers"&&UUID.test(parts[1])&&
   ["request-payment","post"].includes(parts[2]))return method==="POST";
 if(parts.length===3&&parts[0]==="vouchers"&&UUID.test(parts[1])&&
   parts[2]==="payment-proofs")return method==="GET"||method==="POST";
 if(parts.length===5&&parts[0]==="vouchers"&&UUID.test(parts[1])&&
   parts[2]==="payment-proofs"&&UUID.test(parts[3])&&parts[4]==="verify")
  return method==="POST";

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
 if(method==="GET"&&parts[0]==="reports"){
  const keys=new Set(["yearRef","branchRef","accountRef","from","to","offset",
   ...(parts[1]==="export"?["view"]:[])]);
  for(const [k,value] of request.nextUrl.searchParams){
   if(!keys.has(k)||value.length>80||(k.endsWith("Ref")&&value&&!UUID.test(value))||
     (k==="offset"&&!/^(0|[1-9][0-9]{0,4})$/.test(value))||
     (["from","to"].includes(k)&&value&&!/^\d{4}-\d{2}-\d{2}$/.test(value)))
    return NextResponse.json({message:"Choose a valid financial year, account, branch and date filter."},{status:400});
   target.searchParams.set(k,value);
  }
 }
 if(method==="GET"&&parts[0]==="budgets"&&parts[1]==="list"){
  const offset=request.nextUrl.searchParams.get("offset")??"0";
  if(!/^(0|[1-9][0-9]{0,4})$/.test(offset))
   return NextResponse.json({message:"Choose a valid budget list page."},{status:400});
  target.searchParams.set("offset",offset);
 }
 if(method==="GET"&&parts[0]==="invoices"&&parts[1]==="drafts"){
  const filter=request.nextUrl.searchParams.get("status")??"ALL";
  if(!["ALL","DRAFT","SUBMITTED","RETURNED","REJECTED","APPROVED","POSTED","ISSUED","REVERSED","CREDITED"].includes(filter))
   return NextResponse.json({message:"Choose a supported invoice status tab."},{status:400});
  target.searchParams.set("status",filter);
  const offset=request.nextUrl.searchParams.get("offset")??"0";
  if(!/^(0|[1-9][0-9]{0,4})$/.test(offset))
   return NextResponse.json({message:"Choose a valid invoice list page."},{status:400});
  target.searchParams.set("offset",offset);
 }
 if(method==="GET"&&parts[0]==="invoices"&&parts[1]==="posting-accounts"){
  const q=request.nextUrl.searchParams.get("q")??"";
  if(q.length>80)return NextResponse.json({message:"Use a shorter account name."},{status:400});
  target.searchParams.set("q",q);
 }
 if(method==="GET"&&parts[0]==="claims"&&parts[1]==="approved-options"){
  const query=request.nextUrl.searchParams.get("q")??"";
  if(query.length>80)return NextResponse.json({message:"Search using a shorter claim number, category or purpose."},{status:400});
  target.searchParams.set("q",query);
 }
 if(method==="GET"&&parts[0]==="claims"&&["mine","managed"].includes(parts[1])){
  const offset=request.nextUrl.searchParams.get("offset")??"0";
  if(!/^(0|[1-9][0-9]{0,4})$/.test(offset))
   return NextResponse.json({message:"Choose a valid claim list page and try again."},{status:400});
  target.searchParams.set("offset",offset);
  if(parts[1]==="mine"){
   const source=request.nextUrl.searchParams.get("source")??"GENERAL";
   if(source!=="GENERAL"&&source!=="HR_ALLOWANCE")return NextResponse.json({message:"Choose a valid claim source."},{status:400});
   target.searchParams.set("source",source);
   if(source==="HR_ALLOWANCE"){const status=request.nextUrl.searchParams.get("status")??"ALL",q=request.nextUrl.searchParams.get("q")??"";
    if(!["ALL","DRAFT","SUBMITTED","APPROVED","PAYABLE","PAYMENT_REQUESTED","PAYMENT_VERIFIED_UNPOSTED","PAID_VERIFIED","RETURNED","REJECTED"].includes(status)||q.length>80)return NextResponse.json({message:"Choose an allowance status or shorter search."},{status:400});
    target.searchParams.set("status",status);target.searchParams.set("q",q);}
  }
 }
 if(method==="GET"&&parts[0]==="vouchers"&&parts[1]==="drafts"&&parts.length===2){
  const offset=request.nextUrl.searchParams.get("offset")??"0";
  if(!/^(0|[1-9][0-9]{0,4})$/.test(offset))
   return NextResponse.json({message:"Choose a valid voucher list page and try again."},{status:400});
  target.searchParams.set("offset",offset);
 }
 if(method==="GET"&&parts[0]==="vouchers"&&["payment-accounts","posting-accounts"].includes(parts[1])){
  const query=request.nextUrl.searchParams.get("q")??"";
  if(query.length>80)
   return NextResponse.json({message:"Use a shorter account name or code (up to 80 characters)."}, {status:400});
  target.searchParams.set("q",query);
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
  if(res.ok&&parts[0]==="invoices"&&parts.length===4&&parts[2]==="credit-note"&&parts[3]==="pdf"){
   if(!res.headers.get("content-type")?.startsWith("application/pdf"))
    return NextResponse.json({message:"Protected credit note PDF is unavailable."},{status:503});
   const file=await res.arrayBuffer();
   if(file.byteLength<100||file.byteLength>10485760)
    return NextResponse.json({message:"Private credit note PDF failed size verification."},{status:503});
   return new NextResponse(file,{status:200,headers:{"Content-Type":"application/pdf",
    "Content-Disposition":"attachment; filename=CareGanga-Credit-Note.pdf",
    "Cache-Control":"private, no-store"}});
  }
  if(res.ok&&parts[0]==="reports"&&parts[1]==="export"&&parts[2]==="csv"){
   const type=res.headers.get("content-type")??"";
   if(!type.startsWith("text/csv"))
    return NextResponse.json({message:"The exported statement could not be verified."},{status:503});
   const csv=await res.text();
   if(csv.length<4||new TextEncoder().encode(csv).byteLength>1048576)
    return NextResponse.json({message:"The report export exceeded the safe file size."},{status:409});
   return new NextResponse(csv,{status:200,headers:{"Content-Type":"text/csv; charset=utf-8",
    "Content-Disposition":"attachment; filename=CareGanga-Finance-Report.csv",
    "Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
  }
  const data:unknown=await res.json().catch(()=>null);
  if(res.ok)return NextResponse.json(data,{status:res.status,headers:{"Cache-Control":"no-store"}});
  const safeStatus=[400,401,403,404,409,429].includes(res.status)?res.status:503;
  const obj=data&&typeof data==="object"&&!Array.isArray(data)?data as Record<string,unknown>:{};
  const code=typeof obj.code==="string"&&financeErrors.has(obj.code)?obj.code:null;
  const fields=new Set(["fileRef","fileVersion","transactionReference","paymentMethod","paymentAccountRef","debitAccountRef","creditAccountRef","proofFileRef","proofVersion","caseRef","requestKey","voucherRef","purpose","payeeName","voucherType","postingDate","quantity","unitRate","tax","charges","expectedVersion","description","lines","search","offset","name","code","category","startOn","endOn","scopeKind","branchRef",
   "bankAccountRef","refundLiabilityAccountRef","replacesInvoiceRef","transferReference","postingDate","amount","reconciliationRef","bankRef","bankItemReference","statementDate","statementAmount","statementFileRef","statementFileVersion","reconciliationRef","budgetRef","budgetName","periodStart","periodEnd","fundingNote","kind","journalRef","date","invoiceRef","invoiceDate","dueDate","counterpartyName","counterpartyAddress","receivableAccountRef","incomeAccountRef","taxAccountRef","stage","rows","terms","notes","expectedVersion","expenseClaimRef","billFileRef","billVersion","linkKind","expenseDate","claimRef","expectedRevision","groupRef","parentRef","financialYearRef","bankLabel","accountKind","bankLastFour","postingDate","amount","debitAccountRef","creditAccountRef"]);
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
