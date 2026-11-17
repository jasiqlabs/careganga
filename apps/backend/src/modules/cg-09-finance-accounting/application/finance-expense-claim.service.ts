import {BadRequestException,ConflictException,Inject,Injectable} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {Pool} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function invalid(code:string,field?:string):never{
 throw new BadRequestException({code,...(field?{field}:{})});
}
function keyOf(value:unknown):string{
 if(typeof value!=="string"||!UUID.test(value))
  return invalid("FINANCE_CLAIM_REQUEST_KEY_INVALID","requestKey");
 return value;
}
function label(value:unknown,field:"purpose"|"category",min:number,max:number):string{
 if(typeof value!=="string"||value.trim().length<min||value.trim().length>max)
  return invalid(field==="purpose"?"FINANCE_CLAIM_PURPOSE_INVALID":"FINANCE_CLAIM_CATEGORY_INVALID",field);
 return value.trim().replace(/\s+/g," ");
}
function dateOnly(value:unknown):string{
 if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(value))
  return invalid("FINANCE_CLAIM_DATE_INVALID","expenseDate");
 const date=new Date(value+"T00:00:00Z");
 if(Number.isNaN(date.getTime())||date.toISOString().slice(0,10)!==value)
  return invalid("FINANCE_CLAIM_DATE_INVALID","expenseDate");
 return value;
}
function amount(value:unknown):string{
 if(typeof value!=="string"||!/^([1-9][0-9]{0,11}|0)(\.[0-9]{1,2})?$/.test(value))
  return invalid("FINANCE_CLAIM_AMOUNT_INVALID","amount");
 const [r,p=""]=value.split(".");
 const minor=BigInt(r)*100n+BigInt((p+"00").slice(0,2));
 if(minor<=0n||minor>99999999999999n)
  return invalid("FINANCE_CLAIM_AMOUNT_INVALID","amount");
 return minor.toString();
}
type Normal={key:string;purpose:string;category:string;expenseDate:string;amountMinor:string};
function parse(input:unknown):Normal{
 if(!input||typeof input!=="object"||Array.isArray(input))
  return invalid("FINANCE_CLAIM_FORM_INVALID");
 const v=input as Record<string,unknown>;
 if(Object.keys(v).some(k=>!["requestKey","purpose","category","expenseDate","amount"].includes(k)))
  return invalid("FINANCE_CLAIM_FORM_INVALID");
 return {key:keyOf(v.requestKey),purpose:label(v.purpose,"purpose",3,500),
  category:label(v.category,"category",2,80),
  expenseDate:dateOnly(v.expenseDate),amountMinor:amount(v.amount)};
}
type Claim={id:string;status:string;version:number;create_digest:string};
@Injectable()
export class FinanceExpenseClaimService{
 constructor(@Inject(DATABASE)private readonly db:Pool,
  private readonly sessions:SessionService,
  private readonly identity:FoundationStructureIdentityFacade){}
 /** Real CG-01 Foundation requester; never invent an HR employee/volunteer. */
 async create(bearer:string,input:unknown){
  const actor=await this.sessions.requireAction(bearer,"finance.claims.create");
  const v=parse(input),digest=createHash("sha256").update(JSON.stringify(
   ["CG09_CLAIM_DRAFT_V1",v.purpose,v.category,v.expenseDate,v.amountMinor]
  )).digest("hex");
  const client=await this.db.connect();
  try{
   await client.query("BEGIN");
   await this.identity.assertCurrent(client,actor,"finance.claims.create");
   const created=await client.query<Claim>(
    "INSERT INTO expense_claim(root_realm_id,requested_by,category_label,purpose,"+
    " expense_date,amount_minor,create_request_key,create_digest) "+
    " VALUES($1,$2,$3,$4,$5,$6,$7,$8) "+
    " ON CONFLICT(root_realm_id,requested_by,create_request_key) DO NOTHING "+
    " RETURNING id,status,version,create_digest",
    [actor.realmId,actor.accountId,v.category,v.purpose,v.expenseDate,
     v.amountMinor,v.key,digest]);
   let row=created.rows[0],replayed=false;
   if(!row){
    const found=await client.query<Claim>(
     "SELECT id,status,version,create_digest FROM expense_claim "+
     "WHERE root_realm_id=$1 AND requested_by=$2 AND create_request_key=$3 FOR SHARE",
     [actor.realmId,actor.accountId,v.key]);
    row=found.rows[0];
    if(!row||row.create_digest!==digest)
     throw new ConflictException({code:"FINANCE_CLAIM_REPLAY_CONFLICT",field:"requestKey"});
    replayed=true;
   }else{
    await client.query(
     "INSERT INTO finance_event(root_realm_id,actor_ref,entity_kind,entity_ref,action,request_key) "+
     "VALUES($1,$2,'CLAIM',$3,'CLAIM_DRAFT_CREATED',$4)",
     [actor.realmId,actor.accountId,row.id,v.key]);
   }
   await client.query("COMMIT");
   return {confirmed:true,claimRef:row.id,status:row.status,version:row.version,
    replayed,nextStep:"VERIFIED_BILL_REQUIRED_BEFORE_SUBMISSION"};
  }catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}
 }
 async mine(bearer:string,offsetInput?:string){
  const actor=await this.sessions.requireAction(bearer,"finance.claims.view");
  if(offsetInput!==undefined&&!/^(0|[1-9][0-9]{0,4})$/.test(offsetInput))
   return invalid("FINANCE_CLAIM_FILTER_INVALID","offset");
  const offset=Number(offsetInput??"0");
  const client=await this.db.connect();
  try{
   await client.query("BEGIN");
   await this.identity.assertCurrent(client,actor,"finance.claims.view");
   const result=await client.query<{
    claimRef:string;category:string;purpose:string;expenseDate:string;
    amountMinor:string;status:string;version:number;createdAt:Date}>(
    "SELECT id AS \"claimRef\",category_label AS category,purpose, "+
    "expense_date::text AS \"expenseDate\",amount_minor::text AS \"amountMinor\", "+
    "status,version,created_at AS \"createdAt\" FROM expense_claim "+
    "WHERE root_realm_id=$1 AND requested_by=$2 "+
    "ORDER BY created_at DESC,id DESC LIMIT 31 OFFSET $3",
    [actor.realmId,actor.accountId,offset]);
   await client.query("COMMIT");
   return {claims:result.rows.slice(0,30),nextOffset:result.rows.length>30?offset+30:null};
  }catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}
 }
 /** Lost-response check: same actor and request key, no second draft. */
 async command(bearer:string,keyInput:string){
  const actor=await this.sessions.requireAction(bearer,"finance.claims.create");
  const key=keyOf(keyInput);
  const client=await this.db.connect();
  try{
   await client.query("BEGIN");
   await this.identity.assertCurrent(client,actor,"finance.claims.create");
   const result=await client.query<{id:string;status:string;version:number}>(
    "SELECT id,status,version FROM expense_claim "+
    "WHERE root_realm_id=$1 AND requested_by=$2 AND create_request_key=$3",
    [actor.realmId,actor.accountId,key]);
   await client.query("COMMIT");
   return result.rows[0]?{confirmed:true,claimRef:result.rows[0].id,
    status:result.rows[0].status,version:result.rows[0].version}:
    {confirmed:false,status:"NOT_FOUND"};
  }catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}
 }
}
