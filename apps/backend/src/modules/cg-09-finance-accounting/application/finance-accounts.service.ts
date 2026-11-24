import {BadRequestException,ConflictException,ForbiddenException,Inject,Injectable} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {BranchSourceFacade} from "../../cg-02-foundation-structure/application/branch-source.facade";
import {FinanceJournalPostingService} from "./finance-journal-posting.service";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";

type CommandKind="YEAR_CREATE"|"YEAR_STATUS"|"GROUP_CREATE"|"ACCOUNT_CREATE"|"ACCOUNT_STATUS"|"OPENING_POST"|"GENERAL_POST";
type CommandResult={recordRef:string;confirmed:true;replayed:boolean};
type AccountFilters={kind?:string;groupRef?:string;branchRef?:string;status?:string;yearRef?:string};
type Normalized=Record<string,string|null>;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const codePattern=/^[A-Z0-9][A-Z0-9_-]{1,19}$/;
const fieldError=(code:string,field:string):never=>{throw new BadRequestException({code,field});};
const asForm=(input:unknown):Record<string,unknown>=>{
 if(!input||typeof input!=="object"||Array.isArray(input))
  throw new BadRequestException({code:"FINANCE_FORM_INVALID"});
 return input as Record<string,unknown>;
};
/** Accept only the current story contract. Future owner keys (project/supplier) are
 * rejected, never silently accepted or treated as a valid finance selector. */
function fields(input:unknown,allowed:readonly string[]):Record<string,unknown>{
 const body=asForm(input);
 if(Object.keys(body).some(k=>!allowed.includes(k)))
  throw new BadRequestException({code:"FINANCE_FORM_INVALID"});
 return body;
}
function label(value:unknown,field:string,max:number):string{
 if(typeof value!=="string"||value.trim().length<2)
  return fieldError("FINANCE_NAME_REQUIRED",field);
 if(value.trim().length>max){
  const rule=field==="bankLabel"?"FINANCE_BANK_LABEL_TOO_LONG":
    max===80?"FINANCE_YEAR_NAME_TOO_LONG":
    max===120?"FINANCE_GROUP_NAME_TOO_LONG":"FINANCE_ACCOUNT_NAME_TOO_LONG";
  return fieldError(rule,field);
 }
 return value.trim().replace(/\s+/g," ");
}
function businessCode(value:unknown):string{
 if(typeof value!=="string"||!codePattern.test(value.trim().toUpperCase()))
  return fieldError("FINANCE_CODE_INVALID","code");
 return value.trim().toUpperCase();
}
function ref(value:unknown,field:string,err="FINANCE_GROUP_INVALID"):string{
 if(typeof value!=="string"||!UUID.test(value))
  return fieldError(field==="requestKey"?"FINANCE_REQUEST_KEY_INVALID":err,field);
 return value;
}
function dateOnly(value:unknown,field:string):string{
 const invalid=field==="postingDate"?"FINANCE_OPENING_DATE":"FINANCE_YEAR_DATE_INVALID";
 if(typeof value!=="string"||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value))
  return fieldError(invalid,field);
 const date=new Date(value+"T00:00:00Z");
 if(Number.isNaN(date.getTime())||date.toISOString().slice(0,10)!==value)
  return fieldError(invalid,field);
 return value;
}
function amountMinor(value:unknown):string{
 if(typeof value!=="string"||!/^([1-9][0-9]{0,11}|0)(\.[0-9]{1,2})?$/.test(value))
  return fieldError("FINANCE_OPENING_AMOUNT","amount");
 const [rupees,paise=""]=value.split(".");
 const minor=BigInt(rupees)*100n+BigInt((paise+"00").slice(0,2));
 if(minor<=0n||minor>99999999999999n)return fieldError("FINANCE_OPENING_AMOUNT","amount");
 return minor.toString();
}
function digest(payload:Normalized):string{
 return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}
function dbError(error:unknown):never{
 if(error&&typeof error==="object"&&"code" in error){
  if(error.code==="P0901")throw new ConflictException({code:"FINANCE_YEAR_CLOSED"});
  if(error.code==="P0902")throw new ConflictException({code:"FINANCE_ACCOUNT_INACTIVE"});
  if(error.code==="P0903")throw new BadRequestException({code:"FINANCE_DEBITS_CREDITS",field:"amount"});
  if(error.code==="P0904")throw new ConflictException({code:"FINANCE_ACCOUNT_SCOPE"});
  if(error.code==="P0905")throw new BadRequestException({code:"FINANCE_GROUP_INVALID",field:"groupRef"});
  if(error.code==="P0906"||error.code==="P0907")throw new ConflictException({code:"FINANCE_STALE_RECORD"});
  if(error.code==="P0908")throw new BadRequestException({code:"FINANCE_GROUP_INVALID",field:"groupRef"});
  if(error.code==="P0911")throw new BadRequestException({code:"FINANCE_OPENING_DATE",field:"postingDate"});
  if(error.code==="P0912")throw new ConflictException({code:"FINANCE_POSTED_IMMUTABLE"});
  if(error.code==="23P01")throw new ConflictException({code:"FINANCE_YEAR_OVERLAP"});
  if(error.code==="23505")throw new ConflictException({code:"FINANCE_DUPLICATE"});
  if(error.code==="23503"||error.code==="23514"||error.code==="22P02")
   throw new BadRequestException({code:"FINANCE_SCOPE_INVALID"});
  if(error.code==="40001"||error.code==="40P01")
   throw new ConflictException({code:"FINANCE_REQUEST_CONFLICT"});
 }
 throw error;
}
@Injectable()
export class FinanceAccountsService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade,
  private readonly branches:BranchSourceFacade,
  private readonly postings:FinanceJournalPostingService){}

 private async transact<T>(bearer:string,capability:string,
  task:(client:PoolClient,actor:VerifiedFoundationActor)=>Promise<T>):Promise<T>{
  const actor=await this.sessions.requireAction(bearer,capability);
  const client=await this.db.connect();
  try{
   await client.query("BEGIN");
   try{
    await this.identity.assertCurrent(client,actor,capability);
    const result=await task(client,actor);
    await client.query("COMMIT");
    return result;
   }catch(e){await client.query("ROLLBACK");throw e;}
  }catch(e){dbError(e);}finally{client.release();}
  throw new Error("Unreachable finance transaction");
 }
 /** One canonical command key: matching retry returns the original effect, a
  * different body with same key fails rather than duplicating accounts or money.
  */
 private async claim(client:PoolClient,actor:VerifiedFoundationActor,
  kind:CommandKind,key:string,payload:Normalized):Promise<{duplicate:string|null}>{
  const hash=digest(payload);
  const inserted=await client.query<{id:string}>(`
   INSERT INTO finance_command(root_realm_id,actor_ref,command_kind,request_key,payload_digest)
   VALUES($1,$2,$3,$4,$5) ON CONFLICT(root_realm_id,command_kind,request_key)
   DO NOTHING RETURNING id`,[actor.realmId,actor.accountId,kind,key,hash]);
  if(inserted.rowCount)return {duplicate:null};
  const earlier=await client.query<{entity_ref:string|null;payload_digest:string;actor_ref:string}>(`
   SELECT entity_ref,payload_digest,actor_ref FROM finance_command
   WHERE root_realm_id=$1 AND command_kind=$2 AND request_key=$3 FOR UPDATE`,
   [actor.realmId,kind,key]);
  const previous=earlier.rows[0];
  if(!previous||previous.payload_digest!==hash||previous.actor_ref!==actor.accountId||!previous.entity_ref)
   throw new ConflictException({code:"FINANCE_REQUEST_CONFLICT"});
  return {duplicate:previous.entity_ref};
 }
 private async finish(client:PoolClient,actor:VerifiedFoundationActor,kind:CommandKind,
  key:string,entityRef:string,action:string):Promise<void>{
  await client.query(`
   UPDATE finance_command SET entity_ref=$1
   WHERE root_realm_id=$2 AND command_kind=$3 AND request_key=$4`,
   [entityRef,actor.realmId,kind,key]);
  await client.query(`
   INSERT INTO finance_event(root_realm_id,actor_ref,entity_kind,entity_ref,action,request_key)
   VALUES($1,$2,$3,$4,$5,$6)`,
   [actor.realmId,actor.accountId,
    kind.startsWith("YEAR_")?"YEAR":kind==="GROUP_CREATE"?"GROUP":
    kind.startsWith("ACCOUNT_")?"ACCOUNT":"JOURNAL",entityRef,action,key]);
 }
 async setup(bearer:string,searchInput?:string,offsetInput?:string,filters:AccountFilters={}){
  const actor=await this.sessions.requireAction(bearer,"finance.accounts.view");
  if(searchInput!==undefined&&(typeof searchInput!=="string"||searchInput.length>80))
   throw new BadRequestException({code:"FINANCE_ACCOUNT_SEARCH_INVALID",field:"search"});
  const search=searchInput?.trim()??"";
  if(offsetInput!==undefined&&!/^(0|[1-9][0-9]{0,5})$/.test(offsetInput))
   throw new BadRequestException({code:"FINANCE_FILTER_INVALID",field:"offset"});
  const offset=Number(offsetInput??"0");
  const kind=filters.kind||"ALL",status=filters.status||"ALL";
  if(!["ALL","GENERAL","CASH","BANK"].includes(kind)||
     !["ALL","ACTIVE","INACTIVE"].includes(status))
   throw new BadRequestException({code:"FINANCE_FILTER_INVALID"});
  const group=filters.groupRef?ref(filters.groupRef,"groupRef"):null;
  const branch=filters.branchRef?ref(filters.branchRef,"branchRef","FINANCE_SCOPE_INVALID"):null;
  const scope=await this.branches.financeReportScope(bearer,"finance.accounts.view");
  if(branch&&!scope.all&&!scope.branchRefs.includes(branch))
   throw new ForbiddenException("This finance branch is not assigned to your account");
  const year=filters.yearRef?ref(filters.yearRef,"startOn","FINANCE_YEAR_CLOSED"):null;
  if(year){
   const found=await this.db.query("SELECT 1 FROM financial_year WHERE id=$1 AND root_realm_id=$2",
    [year,actor.realmId]);
   if(!found.rowCount)throw new BadRequestException({code:"FINANCE_YEAR_CLOSED",field:"startOn"});
  }
  const [years,groups,accounts,opening,branches,categorySummary]=await Promise.all([
   this.db.query<{yearRef:string;name:string;startOn:string;endOn:string;status:string;version:number}>(`
    SELECT id AS "yearRef",name,start_on::text AS "startOn",end_on::text AS "endOn",status,version
    FROM financial_year WHERE root_realm_id=$1
    ORDER BY start_on DESC,id DESC LIMIT 30`,[actor.realmId]),
   this.db.query<{groupRef:string;code:string;name:string;category:string}>(`
    SELECT id AS "groupRef",code,name,category FROM account_group
    WHERE root_realm_id=$1 ORDER BY category,name,id LIMIT 100`,[actor.realmId]),
   this.db.query<{
    accountRef:string;code:string;name:string;normalSide:string;kind:string;
    scopeKind:string;branchRef:string|null;branchName:string|null;groupName:string;category:string;
    status:string;version:number;balanceMinor:string;openingMinor:string;bankLabel:string|null;maskedDetails:string|null;
   }>(`
    WITH page AS MATERIALIZED (
     SELECT a.id,a.root_realm_id,a.group_id,a.code,a.name,a.normal_side,
       a.account_kind,a.scope_kind,a.branch_id,a.status,a.version
     FROM finance_account a
     WHERE a.root_realm_id=$1 AND ($2='' OR a.name ILIKE $2 ESCAPE '\\'
       OR a.code ILIKE $2 ESCAPE '\\')
       AND ($5::text='ALL' OR a.account_kind=$5)
       AND ($6::uuid IS NULL OR a.group_id=$6)
       AND ($7::uuid IS NULL OR a.branch_id=$7)
       AND ($8::text='ALL' OR a.status=$8)
       AND ($9::boolean OR a.branch_id IS NULL OR a.branch_id=ANY($10::uuid[]))
     ORDER BY a.name,a.id LIMIT 51 OFFSET $3
    )
    SELECT a.id AS "accountRef",a.code,a.name,a.normal_side AS "normalSide",
      a.account_kind AS kind,a.scope_kind AS "scopeKind",a.branch_id AS "branchRef",
      NULL::text AS "branchName",g.name AS "groupName",g.category,a.status,a.version,
      COALESCE(SUM(CASE WHEN $4::uuid IS NULL OR j.financial_year_id=$4
       THEN CASE WHEN a.normal_side='DEBIT'
         THEN l.debit_minor-l.credit_minor ELSE l.credit_minor-l.debit_minor END
       ELSE 0 END),0)::text AS "balanceMinor",
      COALESCE(SUM(CASE WHEN j.posting_kind='OPENING'
       AND ($4::uuid IS NULL OR j.financial_year_id=$4)
       THEN CASE WHEN a.normal_side='DEBIT'
         THEN l.debit_minor-l.credit_minor ELSE l.credit_minor-l.debit_minor END
       ELSE 0 END),0)::text AS "openingMinor",
      CASE WHEN $9::boolean OR a.branch_id=ANY($10::uuid[])
       THEN cb.display_label ELSE NULL END AS "bankLabel",
      CASE WHEN $9::boolean OR a.branch_id=ANY($10::uuid[])
       THEN cb.masked_details ELSE NULL END AS "maskedDetails"
    FROM page a JOIN account_group g ON g.id=a.group_id AND g.root_realm_id=a.root_realm_id
    LEFT JOIN journal_line l ON l.account_id=a.id AND l.root_realm_id=a.root_realm_id
       AND ($9::boolean OR l.branch_id=ANY($10::uuid[]))
    LEFT JOIN journal j ON j.id=l.journal_id AND j.root_realm_id=l.root_realm_id
    LEFT JOIN cash_bank_account cb ON cb.account_id=a.id AND cb.root_realm_id=a.root_realm_id
    GROUP BY a.id,a.code,a.name,a.normal_side,a.account_kind,a.scope_kind,a.branch_id,
      a.status,a.version,g.name,g.category,cb.display_label,cb.masked_details
    ORDER BY a.name,a.id`,
    [actor.realmId,search?"%"+search.replace(/[\\%_]/g,"\\$&")+"%":"",offset,
     year,kind,group,branch,status,scope.all,scope.branchRefs]),
   this.db.query<{journalRef:string;postingDate:string;yearName:string;amountMinor:string}>(`
    SELECT j.id AS "journalRef",j.posting_date::text AS "postingDate",fy.name AS "yearName",
     MAX(l.debit_minor)::text AS "amountMinor"
    FROM journal j JOIN financial_year fy ON fy.id=j.financial_year_id
    JOIN journal_line l ON l.journal_id=j.id AND l.root_realm_id=j.root_realm_id
      AND ($2::boolean OR l.branch_id=ANY($3::uuid[]))
    WHERE j.root_realm_id=$1 AND j.posting_kind='OPENING'
    GROUP BY j.id,fy.name ORDER BY j.posting_date DESC,j.id DESC LIMIT 10`,
    [actor.realmId,scope.all,scope.branchRefs]),
   this.branches.financeBranches(bearer),
   this.db.query<{category:string;balanceMinor:string;accountCount:string}>(`
    SELECT g.category,
      COALESCE(SUM(CASE WHEN $2::uuid IS NULL OR j.financial_year_id=$2
        THEN CASE WHEN a.normal_side='DEBIT'
         THEN l.debit_minor-l.credit_minor ELSE l.credit_minor-l.debit_minor END
        ELSE 0 END),0)::text
        AS "balanceMinor",
      COUNT(DISTINCT a.id)::text AS "accountCount"
    FROM account_group g
    JOIN finance_account a ON a.group_id=g.id AND a.root_realm_id=g.root_realm_id
      AND ($3::boolean OR a.branch_id IS NULL OR a.branch_id=ANY($4::uuid[]))
    LEFT JOIN journal_line l ON l.account_id=a.id AND l.root_realm_id=a.root_realm_id
      AND ($3::boolean OR l.branch_id=ANY($4::uuid[]))
    LEFT JOIN journal j ON j.id=l.journal_id AND j.root_realm_id=l.root_realm_id
    WHERE g.root_realm_id=$1 GROUP BY g.category ORDER BY g.category`,
    [actor.realmId,year,scope.all,scope.branchRefs])
  ]);
  const hasMore=accounts.rows.length>50;
  const accountRows=accounts.rows.slice(0,50);
  const branchLabels=await this.branches.financeBranchLabels(bearer,
    accountRows.map(a=>a.branchRef).filter((x):x is string=>x!==null));
  const safeAccounts=accountRows.map(a=>({
    ...a,branchName:a.branchRef?(branchLabels[a.branchRef]??"Branch unavailable"):null
  }));
  return {years:years.rows,groups:groups.rows,accounts:safeAccounts,
   openingJournals:opening.rows,branches,categorySummary:categorySummary.rows,
   canManageFoundationFinance:scope.all,nextOffset:hasMore?offset+50:null};
 }
 /** Authenticated, root-scoped account search independent of the current table page.
  * Only display-safe account names/codes; never exposes bank account numbers.
  */
 async postingAccountOptions(bearer:string,query?:string){
  const actor=await this.sessions.requireAction(bearer,"finance.journals.post");
  await this.sessions.requireAction(bearer,"finance.accounts.view");
  if(query!==undefined&&(typeof query!=="string"||query.length>80))
   throw new BadRequestException({code:"FINANCE_ACCOUNT_SEARCH_INVALID"});
  const q=query?.trim()??"";
  const escaped="%"+q.replace(/[\\%_]/g,"\\$&")+"%";
  const activeBranches=await this.branches.financeBranches(bearer,"finance.accounts.view");
  const labels=new Map(activeBranches.map(b=>[b.branchRef,b]));
  const activeBranchRefs=activeBranches.map(b=>b.branchRef);
  const rows=await this.db.query<{
    accountRef:string;name:string;code:string;scopeKind:string;branchRef:string|null
  }>(`
   SELECT a.id AS "accountRef",a.name,a.code,a.scope_kind AS "scopeKind",
    a.branch_id AS "branchRef"
   FROM finance_account a
   WHERE a.root_realm_id=$1 AND a.status='ACTIVE'
     AND (a.branch_id IS NULL OR a.branch_id=ANY($3::uuid[]))
     AND (a.name ILIKE $2 ESCAPE '\\' OR a.code ILIKE $2 ESCAPE '\\')
   ORDER BY a.name,a.id LIMIT 51`,[actor.realmId,escaped,activeBranchRefs]);
  return {accounts:rows.rows.filter(a=>!a.branchRef||labels.has(a.branchRef))
    .slice(0,50).map(a=>({...a,
      branchName:a.branchRef?labels.get(a.branchRef)?.name??null:null,
      branchVersion:a.branchRef?labels.get(a.branchRef)?.version??null:null})),
   hasMore:rows.rows.length>50};
 }
 async createYear(bearer:string,input:unknown):Promise<CommandResult>{
  const body=fields(input,["name","startOn","endOn","requestKey"]);
  const name=label(body.name,"name",80),start=dateOnly(body.startOn,"startOn"),
   end=dateOnly(body.endOn,"endOn"),key=ref(body.requestKey,"requestKey");
  if(end<start)fieldError("FINANCE_YEAR_DATE_INVALID","endOn");
  const data={name,start,end};
  return this.transact(bearer,"finance.accounts.manage",async(client,actor)=>{
   await this.branches.requireFinanceRootScope(client,actor,"finance.accounts.manage");
   const claim=await this.claim(client,actor,"YEAR_CREATE",key,data);
   if(claim.duplicate)return {recordRef:claim.duplicate,confirmed:true,replayed:true};
   const inserted=await client.query<{id:string}>(`
    INSERT INTO financial_year(root_realm_id,name,start_on,end_on,created_by)
    VALUES($1,$2,$3,$4,$5) RETURNING id`,
    [actor.realmId,name,start,end,actor.accountId]);
   const id=inserted.rows[0].id;
   await this.finish(client,actor,"YEAR_CREATE",key,id,"YEAR_CREATED");
   return {recordRef:id,confirmed:true,replayed:false};
  });
 }
 async createGroup(bearer:string,input:unknown):Promise<CommandResult>{
  const body=fields(input,["name","code","category","parentRef","requestKey"]),name=label(body.name,"name",120),
   code=businessCode(body.code),category=body.category,
   parent=body.parentRef?ref(body.parentRef,"groupRef"):null,
   key=ref(body.requestKey,"requestKey");
  if(!["ASSET","LIABILITY","FUND","INCOME","EXPENSE"].includes(String(category)))
   fieldError("FINANCE_GROUP_CATEGORY_INVALID","category");
  const normalized={name,code,category:String(category),parent};
  return this.transact(bearer,"finance.accounts.manage",async(client,actor)=>{
   await this.branches.requireFinanceRootScope(client,actor,"finance.accounts.manage");
   const claim=await this.claim(client,actor,"GROUP_CREATE",key,normalized);
   if(claim.duplicate)return {recordRef:claim.duplicate,confirmed:true,replayed:true};
   if(parent){
    const found=await client.query<{category:string}>(`
     SELECT category FROM account_group WHERE id=$1 AND root_realm_id=$2 FOR SHARE`,
     [parent,actor.realmId]);
    if(!found.rows[0]||found.rows[0].category!==category)
     fieldError("FINANCE_GROUP_INVALID","parentRef");
   }
   const inserted=await client.query<{id:string}>(`
    INSERT INTO account_group(root_realm_id,code,name,category,parent_id,created_by)
    VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
    [actor.realmId,code,name,category,parent,actor.accountId]);
   const id=inserted.rows[0].id;
   await this.finish(client,actor,"GROUP_CREATE",key,id,"GROUP_CREATED");
   return {recordRef:id,confirmed:true,replayed:false};
  });
 }
 async createAccount(bearer:string,input:unknown):Promise<CommandResult>{
  const body=fields(input,["name","code","groupRef","accountKind","scopeKind","branchRef","branchVersion","bankLabel","bankLastFour","requestKey"]),name=label(body.name,"name",140),
   code=businessCode(body.code),group=ref(body.groupRef,"groupRef"),
   kind=body.accountKind,scope=body.scopeKind,
   branch=scope==="BRANCH"?ref(body.branchRef,"branchRef","FINANCE_SCOPE_INVALID"):null,
   branchVersion=body.branchVersion,key=ref(body.requestKey,"requestKey");
  if(!["GENERAL","CASH","BANK"].includes(String(kind)))
   fieldError("FINANCE_ACCOUNT_KIND_INVALID","accountKind");
  if(!["FOUNDATION","BRANCH"].includes(String(scope)))
   fieldError("FINANCE_SCOPE_INVALID","scopeKind");
  if(scope==="BRANCH"&&(!Number.isSafeInteger(branchVersion)||Number(branchVersion)<1))
   fieldError("FINANCE_BRANCH_STALE","branchRef");
  const bankLabel=kind==="GENERAL"?null:label(body.bankLabel,"bankLabel",120);
  if(bankLabel&&/[0-9]{8,}/.test(bankLabel))fieldError("FINANCE_BANK_LABEL_INVALID","bankLabel");
  const lastFour=(kind==="BANK"&&typeof body.bankLastFour==="string")?body.bankLastFour:"";
  if(typeof lastFour!=="string"||(lastFour&&!/^[0-9]{4}$/.test(lastFour)))fieldError("FINANCE_BANK_LAST_FOUR","bankLastFour");
  const data={name,code,group,kind:String(kind),scope:String(scope),branch,
   branchVersion:String(branchVersion??""),bankLabel,lastFour};
  return this.transact(bearer,"finance.accounts.manage",async(client,actor)=>{
   if(!branch)await this.branches.requireFinanceRootScope(client,actor,"finance.accounts.manage");
   const claim=await this.claim(client,actor,"ACCOUNT_CREATE",key,data);
   if(claim.duplicate)return {recordRef:claim.duplicate,confirmed:true,replayed:true};
   const groupRow=await client.query<{category:string}>(`
    SELECT category FROM account_group WHERE id=$1 AND root_realm_id=$2 FOR SHARE`,
    [group,actor.realmId]);
   if(!groupRow.rows[0])fieldError("FINANCE_GROUP_INVALID","groupRef");
   const category=groupRow.rows[0].category;
   if(kind!=="GENERAL"&&category!=="ASSET")fieldError("FINANCE_GROUP_INVALID","groupRef");
   if(branch)await this.branches.financeActiveBranch(client,actor,branch,
    Number(branchVersion),"finance.accounts.manage");
   const normalSide=["ASSET","EXPENSE"].includes(category)?"DEBIT":"CREDIT";
   const inserted=await client.query<{id:string}>(`
    INSERT INTO finance_account(root_realm_id,group_id,code,name,normal_side,
      account_kind,scope_kind,branch_id,created_by)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [actor.realmId,group,code,name,normalSide,kind,scope,branch,actor.accountId]);
   const id=inserted.rows[0].id;
   if(kind!=="GENERAL")await client.query(`
    INSERT INTO cash_bank_account(root_realm_id,account_id,kind,display_label,masked_details)
    VALUES($1,$2,$3,$4,$5)`,
    [actor.realmId,id,kind,bankLabel,lastFour?"•••• "+lastFour:""]);
   await this.finish(client,actor,"ACCOUNT_CREATE",key,id,"ACCOUNT_CREATED");
   return {recordRef:id,confirmed:true,replayed:false};
  });
 }
 async postOpening(bearer:string,input:unknown):Promise<CommandResult>{
  const body=fields(input,["financialYearRef","debitAccountRef","creditAccountRef","postingDate","amount","branchVersion","requestKey"]);
  const year=ref(body.financialYearRef,"financialYearRef","FINANCE_YEAR_CLOSED"),
   debit=ref(body.debitAccountRef,"debitAccountRef","FINANCE_DEBITS_CREDITS"),
   credit=ref(body.creditAccountRef,"creditAccountRef","FINANCE_DEBITS_CREDITS"),
   date=dateOnly(body.postingDate,"postingDate"),amount=amountMinor(body.amount),
   key=ref(body.requestKey,"requestKey");
  if(debit===credit)fieldError("FINANCE_DEBITS_CREDITS","creditAccountRef");
  const data={year,debit,credit,date,amount};
  return this.transact(bearer,"finance.journals.post",async(client,actor)=>{
   const claim=await this.claim(client,actor,"OPENING_POST",key,data);
   if(claim.duplicate)return {recordRef:claim.duplicate,confirmed:true,replayed:true};
   const fy=await client.query<{start_on:string;end_on:string;status:string}>(`
    SELECT start_on::text AS start_on,end_on::text AS end_on,status FROM financial_year WHERE id=$1 AND root_realm_id=$2
    FOR SHARE`,[year,actor.realmId]);
   if(!fy.rows[0]||fy.rows[0].status!=="OPEN")
    throw new ConflictException({code:"FINANCE_YEAR_CLOSED"});
   if(date<fy.rows[0].start_on||date>fy.rows[0].end_on)
    fieldError("FINANCE_OPENING_DATE","postingDate");
   const accounts=await client.query<{id:string;status:string;scope_kind:string;
       branch_id:string|null;version:number}>(`
    SELECT id,status,scope_kind,branch_id,version FROM finance_account
    WHERE root_realm_id=$1 AND id IN ($2,$3) FOR SHARE`,
    [actor.realmId,debit,credit]);
   if(accounts.rows.length!==2||accounts.rows.some(a=>a.status!=="ACTIVE"))
    throw new ConflictException({code:"FINANCE_ACCOUNT_INACTIVE"});
   const branchRefs=[...new Set(accounts.rows.map(a=>a.branch_id).filter((v):v is string=>v!==null))];
   if(branchRefs.length>1)throw new ConflictException({code:"FINANCE_ACCOUNT_SCOPE"});
   const branch=branchRefs[0]??null;
   if(!branch)await this.branches.requireFinanceRootScope(client,actor,"finance.journals.post");
   if(branch){
    const branchVersion=body.branchVersion;
    if(!Number.isSafeInteger(branchVersion)||Number(branchVersion)<1)
     fieldError("FINANCE_BRANCH_STALE","branchRef");
    await this.branches.financeActiveBranch(client,actor,branch,
     Number(branchVersion),"finance.journals.post");
   }
   const id=await this.postings.postBalanced(client,actor,{
    financialYearRef:year,postingDate:date,sourceRef:key,eventKey:key,
    immutableDigest:digest(data),kind:"OPENING",
    lines:[
     {accountRef:debit,branchRef:branch,debitMinor:amount,creditMinor:"0"},
     {accountRef:credit,branchRef:branch,debitMinor:"0",creditMinor:amount}
    ]
   });
   await this.finish(client,actor,"OPENING_POST",key,id,"OPENING_POSTED");
   return {recordRef:id,confirmed:true,replayed:false};
  });
 }

 /** US-002: manually posted balanced journal is a financial POSTED event,
  * not a voucher, approval, receivable or verified cash/bank payment.
  * No CG-03/CG-19 case or future project is assumed by this first subflow.
  */
 /** Read immutable genuine posted manual journals; never label them paid. */
 async manualJournalHistory(bearer:string){
  const actor=await this.sessions.requireAction(bearer,"finance.accounts.view");
  const scope=await this.branches.financeReportScope(bearer,"finance.accounts.view");
  const rows=await this.db.query<{journalRef:string;description:string;
    postingDate:string;yearName:string;debitMinor:string;
    reversed:boolean;differentCreator:boolean}>(`
   SELECT j.id AS "journalRef",j.description,j.posting_date::text AS "postingDate",
     fy.name AS "yearName",SUM(l.debit_minor)::text AS "debitMinor",
     (r.reversal_journal_id IS NOT NULL) AS reversed,
     (j.created_by<>$2::uuid) AS "differentCreator", (j.posting_kind='VOUCHER') AS "payrollBankReturn"
   FROM journal j
   JOIN financial_year fy ON fy.id=j.financial_year_id
    AND fy.root_realm_id=j.root_realm_id
   JOIN journal_line l ON l.journal_id=j.id AND l.root_realm_id=j.root_realm_id
     AND ($3::boolean OR l.branch_id=ANY($4::uuid[]))
   LEFT JOIN finance_manual_journal_reversal r
    ON r.original_journal_id=j.id AND r.root_realm_id=j.root_realm_id
   WHERE j.root_realm_id=$1 AND ((j.posting_kind='GENERAL' AND j.source_ref=j.immutable_source_event_key) OR ($3::boolean AND j.posting_kind='VOUCHER' AND cg11_original_settled_bank_journal(j.root_realm_id,j.id)))
   GROUP BY j.id,fy.name,r.reversal_journal_id
   ORDER BY j.posting_date DESC,j.id DESC LIMIT 25`,
   [actor.realmId,actor.accountId,scope.all,scope.branchRefs]);
  return {journals:rows.rows,status:"POSTED_NOT_PAYMENT"};
 }
 async postGeneral(bearer:string,input:unknown):Promise<CommandResult>{
  const body=fields(input,["financialYearRef","postingDate","description",
    "lines","branchVersion","requestKey"]);
  const year=ref(body.financialYearRef,"financialYearRef","FINANCE_YEAR_CLOSED"),
    date=dateOnly(body.postingDate,"postingDate"),
    key=ref(body.requestKey,"requestKey");
  const rawDesc=body.description;
  if(typeof rawDesc!=="string"||
    rawDesc.trim().length<3||rawDesc.trim().length>500)
   throw new BadRequestException({code:"FINANCE_JOURNAL_MEMO_INVALID",field:"description"});
  const memo=rawDesc.trim().replace(/\s+/g," ");
  const rawLines=body.lines;
  if(!Array.isArray(rawLines)||rawLines.length<2||rawLines.length>40)
   throw new BadRequestException({code:"FINANCE_JOURNAL_LINES_INVALID",field:"lines"});
  type ParsedLine={accountRef:string;debitMinor:string;creditMinor:string};
  const parsed:ParsedLine[]=rawLines.map((inputLine:unknown):ParsedLine=>{
   const line=fields(inputLine,["accountRef","debit","credit"]);
   const accountRef=ref(line.accountRef,"lines","FINANCE_JOURNAL_LINES_INVALID");
   const parseSide=(value:unknown):string=>{
    if(value===undefined||value===null||value===""||
      (typeof value==="string"&&/^0(?:\.0{1,2})?$/.test(value)))return "0";
    if(typeof value!=="string"||!/^([1-9][0-9]{0,11}|0)(\.[0-9]{1,2})?$/.test(value))
     return fieldError("FINANCE_JOURNAL_LINES_INVALID","lines");
    const [whole,decimals=""]=value.split(".");
    const minor=BigInt(whole)*100n+BigInt((decimals+"00").slice(0,2));
    if(minor<=0n||minor>99999999999999n)
     return fieldError("FINANCE_JOURNAL_LINES_INVALID","lines");
    return minor.toString();
   };
   const debit=parseSide(line.debit),credit=parseSide(line.credit);
   if((debit==="0")===(credit==="0"))
    fieldError("FINANCE_JOURNAL_LINES_INVALID","lines");
   return {accountRef,debitMinor:debit,creditMinor:credit};
  });
  const debitTotal=parsed.reduce((acc:bigint,l:ParsedLine)=>acc+BigInt(l.debitMinor),0n);
  const creditTotal=parsed.reduce((acc:bigint,l:ParsedLine)=>acc+BigInt(l.creditMinor),0n);
  if(debitTotal<=0n||debitTotal!==creditTotal)
   fieldError("FINANCE_DEBITS_CREDITS","lines");
  const digestBody={year,date,memo,lines:JSON.stringify(parsed)};
  return this.transact(bearer,"finance.journals.post",async(client,actor)=>{
   const claim=await this.claim(client,actor,"GENERAL_POST",key,digestBody);
   if(claim.duplicate)
    return {recordRef:claim.duplicate,confirmed:true,replayed:true};
   const fy=await client.query<{start_on:string;end_on:string;status:string}>(`
     SELECT start_on::text AS start_on,end_on::text AS end_on,status FROM financial_year
     WHERE id=$1 AND root_realm_id=$2 FOR SHARE`,[year,actor.realmId]);
   if(!fy.rows[0]||fy.rows[0].status!=="OPEN")
    throw new ConflictException({code:"FINANCE_YEAR_CLOSED",field:"financialYearRef"});
   if(date<fy.rows[0].start_on||date>fy.rows[0].end_on)
    fieldError("FINANCE_OPENING_DATE","postingDate");
   const accountIds=[...new Set(parsed.map((l:ParsedLine)=>l.accountRef))];
   const accounts=await client.query<{id:string;status:string;scope_kind:string;branch_id:string|null}>(`
     SELECT id,status,scope_kind,branch_id FROM finance_account
     WHERE root_realm_id=$1 AND id=ANY($2::uuid[]) ORDER BY id FOR SHARE`,
     [actor.realmId,accountIds]);
   if(accounts.rows.length!==accountIds.length||
     accounts.rows.some(a=>a.status!=="ACTIVE"))
    throw new ConflictException({code:"FINANCE_ACCOUNT_INACTIVE",field:"lines"});
   const branchIds=[...new Set(accounts.rows.map(a=>a.branch_id)
     .filter((b):b is string=>b!==null))];
   if(branchIds.length>1)
    throw new ConflictException({code:"FINANCE_ACCOUNT_SCOPE",field:"lines"});
   const branch=branchIds[0]??null;
   if(!branch)await this.branches.requireFinanceRootScope(client,actor,"finance.journals.post");
   if(branch){
    const branchVersion=body.branchVersion;
    if(!Number.isSafeInteger(branchVersion)||Number(branchVersion)<1)
     fieldError("FINANCE_BRANCH_STALE","branchRef");
    await this.branches.financeActiveBranch(client,actor,branch,
      Number(branchVersion),"finance.journals.post");
   }
   const id=await this.postings.postBalanced(client,actor,{
    financialYearRef:year,postingDate:date,sourceRef:key,eventKey:key,
    immutableDigest:digest(digestBody),kind:"GENERAL",description:memo,
    lines:parsed.map((l:ParsedLine)=>({...l,branchRef:branch}))
   });
   await this.finish(client,actor,"GENERAL_POST",key,id,"GENERAL_JOURNAL_POSTED");
   return {recordRef:id,confirmed:true,replayed:false};
  });
 }
 async changeYearStatus(bearer:string,yearInput:string,input:unknown):Promise<CommandResult>{
  const year=ref(yearInput,"startOn","FINANCE_YEAR_CLOSED"),body=fields(input,["status","expectedVersion","requestKey"]);
  const key=ref(body.requestKey,"requestKey");
  if(body.status!=="CLOSED"||!Number.isSafeInteger(body.expectedVersion)||
    Number(body.expectedVersion)<1)
   throw new BadRequestException({code:"FINANCE_STALE_RECORD"});
  const expectedVersion=Number(body.expectedVersion);
  const payload={year,expectedVersion:String(expectedVersion),status:"CLOSED"};
  return this.transact(bearer,"finance.accounts.manage",async(client,actor)=>{
   await this.branches.requireFinanceRootScope(client,actor,"finance.accounts.manage");
   const claim=await this.claim(client,actor,"YEAR_STATUS",key,payload);
   if(claim.duplicate)return {recordRef:claim.duplicate,confirmed:true,replayed:true};
   const found=await client.query<{status:string;version:number}>(`
    SELECT status,version FROM financial_year WHERE id=$1 AND root_realm_id=$2 FOR UPDATE`,
    [year,actor.realmId]);
   if(!found.rows[0])throw new ConflictException({code:"FINANCE_YEAR_CLOSED"});
   if(found.rows[0].version!==expectedVersion)
    throw new ConflictException({code:"FINANCE_STALE_RECORD"});
   if(found.rows[0].status!=="OPEN")
    throw new ConflictException({code:"FINANCE_YEAR_CLOSED"});
   await client.query(`UPDATE financial_year SET status='CLOSED',version=version+1
    WHERE id=$1 AND root_realm_id=$2`,[year,actor.realmId]);
   await this.finish(client,actor,"YEAR_STATUS",key,year,"YEAR_CLOSED");
   return {recordRef:year,confirmed:true,replayed:false};
  });
 }
 async changeAccountStatus(bearer:string,accountInput:string,input:unknown):Promise<CommandResult>{
  const account=ref(accountInput,"code","FINANCE_ACCOUNT_INACTIVE"),body=fields(input,["status","expectedVersion","requestKey"]);
  const key=ref(body.requestKey,"requestKey"),status=body.status;
  if(!["ACTIVE","INACTIVE"].includes(String(status))||
    !Number.isSafeInteger(body.expectedVersion)||Number(body.expectedVersion)<1)
   throw new BadRequestException({code:"FINANCE_ACCOUNT_STATUS_INVALID"});
  const expectedVersion=Number(body.expectedVersion);
  const payload={account,expectedVersion:String(expectedVersion),status:String(status)};
  return this.transact(bearer,"finance.accounts.manage",async(client,actor)=>{
   const claim=await this.claim(client,actor,"ACCOUNT_STATUS",key,payload);
   if(claim.duplicate)return {recordRef:claim.duplicate,confirmed:true,replayed:true};
   const found=await client.query<{version:number;status:string;scope_kind:string;
    branch_id:string|null}>(`
    SELECT version,status,scope_kind,branch_id FROM finance_account
     WHERE id=$1 AND root_realm_id=$2 FOR UPDATE`,[account,actor.realmId]);
   if(!found.rows[0])throw new ConflictException({code:"FINANCE_ACCOUNT_INACTIVE"});
   const current=found.rows[0];
   if(current.version!==expectedVersion)
    throw new ConflictException({code:"FINANCE_STALE_RECORD"});
   if(current.status===status)throw new ConflictException({code:"FINANCE_STALE_RECORD"});
   if(current.branch_id){
    await this.branches.requireFinanceActorBranch(client,actor,current.branch_id,
     "finance.accounts.manage");
    if(status==="ACTIVE")
     await this.branches.requireFinanceActiveBranch(client,actor,current.branch_id,
      "finance.accounts.manage");
   }else{
    await this.branches.requireFinanceRootScope(client,actor,"finance.accounts.manage");
   }
   await client.query(`
    UPDATE finance_account SET status=$1,version=version+1
    WHERE id=$2 AND root_realm_id=$3`,[status,account,actor.realmId]);
   await client.query(`
    UPDATE cash_bank_account SET status=$1 WHERE account_id=$2 AND root_realm_id=$3`,
    [status,account,actor.realmId]);
   await this.finish(client,actor,"ACCOUNT_STATUS",key,account,"ACCOUNT_STATUS_CHANGED");
   return {recordRef:account,confirmed:true,replayed:false};
  });
 }
 async commandStatus(bearer:string,kindInput:string,keyInput:string){
  const kind=kindInput as CommandKind;
  if(!["YEAR_CREATE","YEAR_STATUS","GROUP_CREATE","ACCOUNT_CREATE","ACCOUNT_STATUS","OPENING_POST","GENERAL_POST"].includes(kind))
   throw new BadRequestException({code:"FINANCE_REQUEST_CONFLICT"});
  const actor=await this.sessions.requireAction(bearer,
   ["OPENING_POST","GENERAL_POST"].includes(kind)?"finance.journals.post":"finance.accounts.manage");
  const key=ref(keyInput,"requestKey");
  const found=await this.db.query<{entity_ref:string|null}>(`
   SELECT entity_ref FROM finance_command WHERE root_realm_id=$1
    AND command_kind=$2 AND request_key=$3 AND actor_ref=$4`,
   [actor.realmId,kind,key,actor.accountId]);
  return {confirmed:Boolean(found.rows[0]?.entity_ref)};
 }
}
