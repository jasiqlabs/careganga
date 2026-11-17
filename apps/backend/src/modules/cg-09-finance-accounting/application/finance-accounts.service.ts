import {BadRequestException,ConflictException,Inject,Injectable} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import {BranchSourceFacade} from "../../cg-02-foundation-structure/application/branch-source.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";

type CommandKind="YEAR_CREATE"|"YEAR_STATUS"|"GROUP_CREATE"|"ACCOUNT_CREATE"|"ACCOUNT_STATUS"|"OPENING_POST";
type CommandResult={recordRef:string;confirmed:true;replayed:boolean};
type Normalized=Record<string,string|null>;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const codePattern=/^[A-Z0-9][A-Z0-9_-]{1,19}$/;
const fieldError=(code:string,field:string):never=>{throw new BadRequestException({code,field});};
const asForm=(input:unknown):Record<string,unknown>=>{
 if(!input||typeof input!=="object"||Array.isArray(input))
  throw new BadRequestException({code:"FINANCE_FORM_INVALID"});
 return input as Record<string,unknown>;
};
function label(value:unknown,field:string,max:number):string{
 if(typeof value!=="string"||value.trim().length<2||value.trim().length>max)
  return fieldError("FINANCE_NAME_REQUIRED",field);
 return value.trim().replace(/\s+/g," ");
}
function businessCode(value:unknown):string{
 if(typeof value!=="string"||!codePattern.test(value.trim().toUpperCase()))
  return fieldError("FINANCE_CODE_INVALID","code");
 return value.trim().toUpperCase();
}
function ref(value:unknown,field:string,err="FINANCE_GROUP_INVALID"):string{
 if(typeof value!=="string"||!UUID.test(value))return fieldError(err,field);
 return value;
}
function dateOnly(value:unknown,field:string):string{
 const invalid=field==="postingDate"?"FINANCE_OPENING_DATE":"FINANCE_YEAR_DATE_INVALID";
 if(typeof value!=="string"||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value))
  return fieldError(invalid,field);
 const date=new Date(value+"T00:00:00Z");
 if(Number.isNaN(date.getTime())||date.toISOString().slice(0,10)!==value)
  return fieldError("FINANCE_YEAR_DATE_INVALID",field);
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
  private readonly branches:BranchSourceFacade){}

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
 async setup(bearer:string,searchInput?:string,offsetInput?:string){
  const actor=await this.sessions.requireAction(bearer,"finance.accounts.view");
  const search=typeof searchInput==="string"?searchInput.trim().slice(0,80):"";
  if(offsetInput!==undefined&&!/^(0|[1-9][0-9]{0,5})$/.test(offsetInput))
   throw new BadRequestException({code:"FINANCE_SCOPE_INVALID",field:"offset"});
  const offset=Number(offsetInput??"0");
  const [years,groups,accounts,opening,branches]=await Promise.all([
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
    status:string;version:number;balanceMinor:string;bankLabel:string|null;maskedDetails:string|null;
   }>(`
    SELECT a.id AS "accountRef",a.code,a.name,a.normal_side AS "normalSide",
     a.account_kind AS kind,a.scope_kind AS "scopeKind",a.branch_id AS "branchRef",
     NULL::text AS "branchName",g.name AS "groupName",g.category,a.status,a.version,
     COALESCE(SUM(l.debit_minor-l.credit_minor),0)::text AS "balanceMinor",
     cb.display_label AS "bankLabel",cb.masked_details AS "maskedDetails"
    FROM finance_account a JOIN account_group g ON g.id=a.group_id
    LEFT JOIN journal_line l ON l.account_id=a.id AND l.root_realm_id=a.root_realm_id
    LEFT JOIN cash_bank_account cb ON cb.account_id=a.id AND cb.root_realm_id=a.root_realm_id
    WHERE a.root_realm_id=$1 AND ($2='' OR a.name ILIKE $2 ESCAPE '\\'
      OR a.code ILIKE $2 ESCAPE '\\')
    GROUP BY a.id,g.name,g.category,cb.display_label,cb.masked_details
    ORDER BY a.name,a.id LIMIT 51 OFFSET $3`,
    [actor.realmId,search?"%"+search.replace(/[\\%_]/g,"\\$&")+"%":"",offset]),
   this.db.query<{journalRef:string;postingDate:string;yearName:string;amountMinor:string}>(`
    SELECT j.id AS "journalRef",j.posting_date AS "postingDate",fy.name AS "yearName",
     MAX(l.debit_minor)::text AS "amountMinor"
    FROM journal j JOIN financial_year fy ON fy.id=j.financial_year_id
    JOIN journal_line l ON l.journal_id=j.id
    WHERE j.root_realm_id=$1 AND j.posting_kind='OPENING'
    GROUP BY j.id,fy.name ORDER BY j.posting_date DESC,j.id DESC LIMIT 10`,[actor.realmId]),
   this.branches.financeBranches(bearer)
  ]);
  const hasMore=accounts.rows.length>50;
  const accountRows=accounts.rows.slice(0,50);
  const branchLabels=await this.branches.financeBranchLabels(bearer,
    accountRows.map(a=>a.branchRef).filter((x):x is string=>x!==null));
  const safeAccounts=accountRows.map(a=>({
    ...a,branchName:a.branchRef?(branchLabels[a.branchRef]??"Branch unavailable"):null
  }));
  return {years:years.rows,groups:groups.rows,accounts:safeAccounts,
   openingJournals:opening.rows,branches,nextOffset:hasMore?offset+50:null};
 }
 async createYear(bearer:string,input:unknown):Promise<CommandResult>{
  const body=asForm(input);
  const name=label(body.name,"name",80),start=dateOnly(body.startOn,"startOn"),
   end=dateOnly(body.endOn,"endOn"),key=ref(body.requestKey,"requestKey");
  if(end<start)fieldError("FINANCE_YEAR_DATE_INVALID","endOn");
  const data={name,start,end};
  return this.transact(bearer,"finance.accounts.manage",async(client,actor)=>{
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
  const body=asForm(input),name=label(body.name,"name",120),
   code=businessCode(body.code),category=body.category,
   parent=body.parentRef?ref(body.parentRef,"groupRef"):null,
   key=ref(body.requestKey,"requestKey");
  if(!["ASSET","LIABILITY","FUND","INCOME","EXPENSE"].includes(String(category)))
   fieldError("FINANCE_GROUP_INVALID","category");
  const normalized={name,code,category:String(category),parent};
  return this.transact(bearer,"finance.accounts.manage",async(client,actor)=>{
   const claim=await this.claim(client,actor,"GROUP_CREATE",key,normalized);
   if(claim.duplicate)return {recordRef:claim.duplicate,confirmed:true,replayed:true};
   if(parent){
    const found=await client.query<{category:string}>(`
     SELECT category FROM account_group WHERE id=$1 AND root_realm_id=$2 FOR SHARE`,
     [parent,actor.realmId]);
    if(!found.rows[0]||found.rows[0].category!==category)
     fieldError("FINANCE_GROUP_INVALID","groupRef");
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
  const body=asForm(input),name=label(body.name,"name",140),
   code=businessCode(body.code),group=ref(body.groupRef,"groupRef"),
   kind=body.accountKind,scope=body.scopeKind,
   branch=scope==="BRANCH"?ref(body.branchRef,"branchRef","FINANCE_SCOPE_INVALID"):null,
   branchVersion=body.branchVersion,key=ref(body.requestKey,"requestKey");
  if(!["GENERAL","CASH","BANK"].includes(String(kind)))
   fieldError("FINANCE_SCOPE_INVALID","accountKind");
  if(!["FOUNDATION","BRANCH"].includes(String(scope)))
   fieldError("FINANCE_SCOPE_INVALID","scopeKind");
  if(scope==="BRANCH"&&(!Number.isSafeInteger(branchVersion)||Number(branchVersion)<1))
   fieldError("FINANCE_BRANCH_STALE","branchRef");
  const bankLabel=kind==="GENERAL"?null:label(body.bankLabel,"name",120);
  const lastFour=kind==="BANK"&&body.bankLastFour?String(body.bankLastFour):"";
  if(lastFour&&!/^[0-9]{4}$/.test(lastFour))fieldError("FINANCE_BANK_LAST_FOUR","bankLastFour");
  const data={name,code,group,kind:String(kind),scope:String(scope),branch,
   branchVersion:String(branchVersion??""),bankLabel,lastFour};
  return this.transact(bearer,"finance.accounts.manage",async(client,actor)=>{
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
  const body=asForm(input);
  const year=ref(body.financialYearRef,"startOn","FINANCE_YEAR_CLOSED"),
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
   if(branch){
    const branchVersion=body.branchVersion;
    if(!Number.isSafeInteger(branchVersion)||Number(branchVersion)<1)
     fieldError("FINANCE_BRANCH_STALE","branchRef");
    await this.branches.financeActiveBranch(client,actor,branch,
     Number(branchVersion),"finance.journals.post");
   }
   const inserted=await client.query<{id:string}>(`
    INSERT INTO journal(root_realm_id,financial_year_id,source_owner,source_ref,posting_kind,
      immutable_source_event_key,immutable_payload_digest,posting_date,created_by)
    VALUES($1,$2,'CG-09',$3,'OPENING',$3,$4,$5,$6) RETURNING id`,
    [actor.realmId,year,key,digest(data),date,actor.accountId]);
   const id=inserted.rows[0].id;
   await client.query(`
    INSERT INTO journal_line(root_realm_id,journal_id,account_id,branch_id,debit_minor,credit_minor)
    VALUES($1,$2,$3,$5,$6,0),($1,$2,$4,$5,0,$6)`,
    [actor.realmId,id,debit,credit,branch,amount]);
   await this.finish(client,actor,"OPENING_POST",key,id,"OPENING_POSTED");
   return {recordRef:id,confirmed:true,replayed:false};
  });
 }
 async changeYearStatus(bearer:string,yearInput:string,input:unknown):Promise<CommandResult>{
  const year=ref(yearInput,"startOn","FINANCE_YEAR_CLOSED"),body=asForm(input);
  const key=ref(body.requestKey,"requestKey");
  if(body.status!=="CLOSED"||!Number.isSafeInteger(body.expectedVersion)||
    Number(body.expectedVersion)<1)
   throw new BadRequestException({code:"FINANCE_YEAR_CLOSED"});
  const expectedVersion=Number(body.expectedVersion);
  const payload={year,expectedVersion:String(expectedVersion),status:"CLOSED"};
  return this.transact(bearer,"finance.accounts.manage",async(client,actor)=>{
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
  const account=ref(accountInput,"code","FINANCE_ACCOUNT_INACTIVE"),body=asForm(input);
  const key=ref(body.requestKey,"requestKey"),status=body.status;
  if(!["ACTIVE","INACTIVE"].includes(String(status))||
    !Number.isSafeInteger(body.expectedVersion)||Number(body.expectedVersion)<1)
   throw new BadRequestException({code:"FINANCE_ACCOUNT_INACTIVE"});
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
   if(current.branch_id&&status==="ACTIVE")
    await this.branches.requireFinanceActiveBranch(client,actor,current.branch_id,
     "finance.accounts.manage");
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
  const actor=await this.sessions.requireAction(bearer,"finance.accounts.view");
  const kind=kindInput as CommandKind;
  if(!["YEAR_CREATE","YEAR_STATUS","GROUP_CREATE","ACCOUNT_CREATE","ACCOUNT_STATUS","OPENING_POST"].includes(kind))
   throw new BadRequestException({code:"FINANCE_REQUEST_CONFLICT"});
  const key=ref(keyInput,"requestKey");
  const found=await this.db.query<{entity_ref:string|null}>(`
   SELECT entity_ref FROM finance_command WHERE root_realm_id=$1
    AND command_kind=$2 AND request_key=$3 AND actor_ref=$4`,
   [actor.realmId,kind,key,actor.accountId]);
  return {confirmed:Boolean(found.rows[0]?.entity_ref)};
 }
}
