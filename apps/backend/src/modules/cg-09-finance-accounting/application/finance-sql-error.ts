import {BadRequestException,ConflictException,HttpException} from "@nestjs/common";

/** Narrow SQLSTATE -> original CG-21-editable Finance error boundary.
 * Never echo raw DB/provider error text, values, private account or SQL.
 */
type FinanceArea="invoice"|"budget"|"bank";
export function financeSqlFailure(error:unknown,area:FinanceArea):never{
 if(error instanceof HttpException)throw error;
 const code=error!==null&&typeof error==="object"&&"code" in error&&
  typeof error.code==="string"?error.code:"";
 if(code==="40001"||code==="40P01")
  throw new ConflictException({code:area==="invoice"?"FINANCE_INVOICE_STALE":
   area==="budget"?"FINANCE_BUDGET_STALE":"FINANCE_RECONCILIATION_CONFLICT"});
 if(["P0901","P0911"].includes(code))
  throw new ConflictException({code:"FINANCE_YEAR_CLOSED"});
 if(["P0902","P0904","P0905"].includes(code))
  throw new ConflictException({code:area==="invoice"?"FINANCE_INVOICE_ACCOUNT_INVALID":
   area==="budget"?"FINANCE_BRANCH_STALE":"FINANCE_RECONCILIATION_INVALID"});
 if(code==="23505")
  throw new ConflictException({code:area==="invoice"?"FINANCE_INVOICE_REPLAY_CONFLICT":
   area==="budget"?"FINANCE_BUDGET_DUPLICATE":"FINANCE_RECONCILIATION_CONFLICT"});
 if(["P0921","P0922"].includes(code))
  throw new ConflictException({code:"FINANCE_INVOICE_STALE"});
 if(code==="P0923")
  throw new ConflictException({code:"FINANCE_INVOICE_DOCUMENT_UNAVAILABLE"});
 if(code==="P0927")
  throw new ConflictException({code:"FINANCE_INVOICE_RECEIPT_NOT_READY"});
 if(code==="P0928")
  throw new ConflictException({code:area==="budget"?"FINANCE_BUDGET_REVIEW_UNAVAILABLE":
   "FINANCE_INVOICE_REVIEW_UNAVAILABLE"});
 if(code==="P0924")
  throw new ConflictException({code:"FINANCE_BUDGET_EVENT_INVALID"});
 if(code==="P0925")
  throw new ConflictException({code:"FINANCE_BUDGET_STALE"});
 if(code==="P0926")
  throw new ConflictException({code:"FINANCE_RECONCILIATION_INVALID"});
 if(["23503","23514","22P02","22003"].includes(code))
  throw new BadRequestException({code:area==="invoice"?"FINANCE_INVOICE_FORM_INVALID":
   area==="budget"?"FINANCE_BUDGET_FORM_INVALID":"FINANCE_RECONCILIATION_INVALID"});
 throw error;
}
