import {
  BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,NotFoundException
} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sha=(value:unknown)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
const ref=(value:unknown):string=>{
  if(typeof value!=="string"||!UUID.test(value))throw new BadRequestException("Choose an existing record");
  return value;
};
const object=(value:unknown):Record<string,unknown>=>{
  if(!value||typeof value!=="object"||Array.isArray(value))throw new BadRequestException("Check the branch form");
  return value as Record<string,unknown>;
};
const field=(value:unknown,max:number,required=false):string=>{
  if(value===undefined||value===null||value===""){
    if(required)throw new BadRequestException("Complete the required branch information");
    return "";
  }
  if(typeof value!=="string")throw new BadRequestException("Check the branch information");
  const cleaned=value.trim().replace(/\s+/g," ");
  if(cleaned.length>(max)||required&&cleaned.length<2)
    throw new BadRequestException("Check the branch information");
  return cleaned;
};
const optionalRef=(value:unknown):string|null=>{
  if(value===undefined||value===null||value==="")return null;
  return ref(value);
};
const integer=(value:unknown,min:number,max:number):number=>{
  if(!Number.isSafeInteger(value)||Number(value)<min||Number(value)>max)
    throw new BadRequestException("Refresh the branch form before saving");
  return Number(value);
};
const refs=(value:unknown,max:number):string[]=>{
  if(value===undefined||value===null)return [];
  if(!Array.isArray(value)||value.length>max)throw new BadRequestException("Choose valid existing records");
  const list=value.map(ref);
  if(new Set(list).size!==list.length)throw new BadRequestException("Remove repeated selections");
  return list;
};
const isoDate=(value:unknown):string|null=>{
  if(value===undefined||value===null||value==="")return null;
  if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(value)||
    Number.isNaN(Date.parse(value+"T00:00:00Z"))||
    new Date(value+"T00:00:00Z").toISOString().slice(0,10)!==value)
    throw new BadRequestException("Choose a valid date");
  return value;
};
const coordinate=(value:unknown,min:number,max:number):number|null=>{
  if(value===undefined||value===null||value==="")return null;
  if(typeof value!=="number"||!Number.isFinite(value)||value<min||value>max)
    throw new BadRequestException("Check the location coordinates");
  return value;
};
/** Only allow-listed user fields are persisted. File refs in DRAFT remain UNVERIFIED.
 * CG-19 must validate every byte/version before a later submit command exists.
 */
function normalizedStage(step:number,raw:unknown):Record<string,unknown>{
  const data=object(raw);
  switch(step){
    case 1:return {
      branchName:field(data.branchName,160,true),
      branchType:field(data.branchType,80),
      openingDate:isoDate(data.openingDate)
    };
    case 2:{
      const pin=field(data.pinCode,6);
      if(pin&&!/^[0-9]{6}$/.test(pin))throw new BadRequestException("Enter a six-digit PIN code");
      return {geographyRef:optionalRef(data.geographyRef),postalAddress:field(data.postalAddress,700),
        pinCode:pin,latitude:coordinate(data.latitude,-90,90),longitude:coordinate(data.longitude,-180,180)};
    }
    case 3:return {registrationFiles:refs(data.registrationFiles,5),evidenceStatus:"UNVERIFIED_DRAFT"};
    case 4:return {agreementFiles:refs(data.agreementFiles,5),
      photoFiles:refs(data.photoFiles,5),evidenceStatus:"UNVERIFIED_DRAFT"};
    case 5:return {managerRef:optionalRef(data.managerRef)};
    case 6:return {departmentRefs:refs(data.departmentRefs,30)};
    case 7:{
      if(data.reviewAcknowledged!==true&&data.reviewAcknowledged!==false)
        throw new BadRequestException("Confirm whether the draft has been reviewed");
      return {reviewAcknowledged:data.reviewAcknowledged};
    }
    default:throw new BadRequestException("Choose a valid registration stage");
  }
}
type DraftRow={
  id:string;root_realm_id:string;requested_by:string;manager_account_ref:string|null;
  geography_area_id:string|null;current_step:number;draft_version:number;
  status:string;profile_payload:Record<string,unknown>;updated_at:Date;
};
type Result={recordRef:string;version:number;status:string;currentStep:number|null;message:string};
@Injectable()
export class BranchRegistrationDraftService{
  constructor(@Inject(DATABASE)private readonly db:Pool,
    private readonly sessions:SessionService,
    private readonly identity:FoundationStructureIdentityFacade){}
  private async actor(bearer:string,capability:string){
    return this.sessions.requireAction(bearer,capability);
  }
  private async administrator(bearer:string):Promise<boolean>{
    try{await this.sessions.requireAction(bearer,"foundation.branches.admin");return true;}
    catch{return false;}
  }
  private async command(client:PoolClient,actor:VerifiedFoundationActor,
    action:"BRANCH_DRAFT_CREATE"|"BRANCH_DRAFT_SAVE",requestKey:string,payload:unknown):
      Promise<{id:string|null;replay:Result|null}>{
    ref(requestKey);
    const digest=sha(payload);
    const added=await client.query<{id:string}>(
      "INSERT INTO branch_registration_command(root_realm_id,actor_ref,action,request_key,request_digest) "+
      "VALUES($1,$2,$3,$4,$5) ON CONFLICT(root_realm_id,actor_ref,action,request_key) "+
      "DO NOTHING RETURNING id",[actor.realmId,actor.accountId,action,requestKey,digest]);
    if(added.rows[0])return {id:added.rows[0].id,replay:null};
    const old=await client.query<{request_digest:string;result_ref:string|null;result_version:number|null}>(
      "SELECT request_digest,result_ref,result_version FROM branch_registration_command "+
      "WHERE root_realm_id=$1 AND actor_ref=$2 AND action=$3 AND request_key=$4 FOR SHARE",
      [actor.realmId,actor.accountId,action,requestKey]);
    if(!old.rows[0]||old.rows[0].request_digest!==digest||!old.rows[0].result_ref||
      old.rows[0].result_version===null)
      throw new ConflictException("This branch change was already submitted differently");
    return {id:null,replay:{recordRef:old.rows[0].result_ref,
      version:old.rows[0].result_version,status:"CONFIRMED",currentStep:null,
      message:"Previously saved. Refresh to view the latest branch draft."}};
  }
  private async finish(client:PoolClient,commandId:string,recordRef:string,version:number){
    await client.query(
      "UPDATE branch_registration_command SET result_ref=$2,result_version=$3 WHERE id=$1",
      [commandId,recordRef,version]);
  }
  private async revision(client:PoolClient,root:string,registration:string,version:number,
    actor:string,step:number,status:string,payload:Record<string,unknown>){
    await client.query(
      "INSERT INTO branch_registration_revision "+
      "(registration_id,root_realm_id,draft_version,changed_by,current_step,status,stage_payload,payload_sha256) "+
      "VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8)",
      [registration,root,version,actor,step,status,JSON.stringify(payload),sha(payload)]);
  }
  private error(error:unknown):never{
    if(error&&typeof error==="object"&&"code" in error){
      if(error.code==="23505")throw new ConflictException("The branch draft changed. Refresh before saving.");
      if(error.code==="23503")throw new BadRequestException("Choose existing Foundation records");
    }
    throw error;
  }
  async create(bearer:string,raw:unknown):Promise<Result>{
    const actor=await this.actor(bearer,"foundation.branches.manage"),input=object(raw);
    const key=ref(input.requestKey),stage=normalizedStage(1,input.stage);
    const client=await this.db.connect();let tx=false;
    try{
      await client.query("BEGIN");tx=true;
      await this.identity.assertCurrent(client,actor,"foundation.branches.manage");
      const owner=await client.query(
        "SELECT root_realm_id FROM foundation_profile WHERE root_realm_id=$1 FOR SHARE",[actor.realmId]);
      if(!owner.rowCount)throw new BadRequestException("Set up the Foundation profile before adding branches");
      const command=await this.command(client,actor,"BRANCH_DRAFT_CREATE",key,{stage});
      if(command.replay){await client.query("COMMIT");tx=false;return command.replay;}
      const payload={"1":stage};
      const created=await client.query<{id:string}>(
        "INSERT INTO branch_registration(root_realm_id,requested_by,updated_by,profile_payload) "+
        "VALUES($1,$2,$2,$3::jsonb) RETURNING id",
        [actor.realmId,actor.accountId,JSON.stringify(payload)]);
      const registration=created.rows[0].id;
      await this.revision(client,actor.realmId,registration,1,actor.accountId,1,"DRAFT",payload);
      await this.finish(client,command.id!,registration,1);
      await client.query("COMMIT");tx=false;
      return {recordRef:registration,version:1,currentStep:1,status:"DRAFT",
        message:"Branch registration draft saved."};
    }catch(e){if(tx)try{await client.query("ROLLBACK");}catch{};return this.error(e);}
    finally{client.release();}
  }
  async save(bearer:string,registrationRef:unknown,raw:unknown):Promise<Result>{
    const actor=await this.actor(bearer,"foundation.branches.manage"),admin=await this.administrator(bearer);
    const reg=ref(registrationRef),input=object(raw),key=ref(input.requestKey);
    const version=integer(input.expectedVersion,1,2147483646);
    const step=integer(input.step,1,7),stage=normalizedStage(step,input.stage);
    const client=await this.db.connect();let tx=false;
    try{
      await client.query("BEGIN");tx=true;
      await this.identity.assertCurrent(client,actor,"foundation.branches.manage");
      if(admin)await this.identity.assertCurrent(client,actor,"foundation.branches.admin");
      const result=await client.query<DraftRow>(
        "SELECT * FROM branch_registration WHERE id=$1 AND root_realm_id=$2 FOR UPDATE",
        [reg,actor.realmId]);
      const row=result.rows[0];
      if(!row||!admin&&row.requested_by!==actor.accountId&&row.manager_account_ref!==actor.accountId)
        throw new NotFoundException("Branch registration unavailable");
      const command=await this.command(client,actor,"BRANCH_DRAFT_SAVE",key,
        {registrationRef:reg,expectedVersion:version,step,stage});
      if(command.replay){await client.query("COMMIT");tx=false;return command.replay;}
      if(!["DRAFT","RETURNED"].includes(row.status))
        throw new ConflictException("This registration can no longer be edited");
      if(row.draft_version!==version)
        throw new ConflictException("This draft changed. Refresh before saving.");
      if(step>row.current_step+1)
        throw new BadRequestException("Complete earlier registration steps first");
      if(step===2&&stage.geographyRef){
        const valid=await client.query("SELECT id FROM geography_area WHERE id=$1 AND root_realm_id=$2 "+
          "AND status='ACTIVE' FOR SHARE",[stage.geographyRef,actor.realmId]);
        if(!valid.rowCount)throw new BadRequestException("Choose an active Foundation area");
      }
      if(step===5&&stage.managerRef)
        await this.identity.eligibleOfficeholder(client,actor,stage.managerRef as string);
      if(step===6){
        const ids=stage.departmentRefs as string[];
        if(ids.length){
          const departments=await client.query<{id:string}>(
            "SELECT id FROM department WHERE root_realm_id=$1 AND id=ANY($2::uuid[]) "+
            "AND scope_kind='FOUNDATION' AND active=true FOR SHARE",[actor.realmId,ids]);
          if(departments.rowCount!==ids.length)
            throw new BadRequestException("Choose active Foundation departments");
        }
      }
      const payload={...row.profile_payload,[String(step)]:stage};
      const nextVersion=version+1,nextStep=Math.max(row.current_step,step);
      await client.query(
        "UPDATE branch_registration SET profile_payload=$2::jsonb,geography_area_id=$3, "+
        "manager_account_ref=$4,current_step=$5,draft_version=$6,updated_by=$7,updated_at=now() "+
        "WHERE id=$1 AND root_realm_id=$8",
        [reg,JSON.stringify(payload),
          step===2?stage.geographyRef:row.geography_area_id,
          step===5?stage.managerRef:row.manager_account_ref,
          nextStep,nextVersion,actor.accountId,actor.realmId]);
      await this.revision(client,actor.realmId,reg,nextVersion,actor.accountId,nextStep,
        row.status,payload);
      await this.finish(client,command.id!,reg,nextVersion);
      await client.query("COMMIT");tx=false;
      return {recordRef:reg,version:nextVersion,currentStep:nextStep,
        status:row.status,message:"Branch registration draft updated."};
    }catch(e){if(tx)try{await client.query("ROLLBACK");}catch{};return this.error(e);}
    finally{client.release();}
  }
  async list(bearer:string,offset=0){
    const actor=await this.actor(bearer,"foundation.branches.view");
    const admin=await this.administrator(bearer);
    integer(offset,0,50000);
    const result=await this.db.query<DraftRow>(
      "SELECT * FROM branch_registration WHERE root_realm_id=$1 AND "+
      "($2::boolean OR requested_by=$3 OR manager_account_ref=$3) "+
      "ORDER BY updated_at DESC,id DESC LIMIT 30 OFFSET $4",
      [actor.realmId,admin,actor.accountId,offset]);
    return {drafts:result.rows.map(row=>this.summary(row)),offset,limit:30,
      nextOffset:result.rows.length===30?offset+30:null};
  }
  private summary(row:DraftRow){
    const first=object(row.profile_payload["1"]??{});
    return {recordRef:row.id,branchName:first.branchName??"Untitled branch",
      branchType:first.branchType??"",status:row.status,
      currentStep:row.current_step,version:row.draft_version,
      updatedAt:new Date(row.updated_at).toISOString()};
  }
  async detail(bearer:string,registrationRef:unknown){
    const actor=await this.actor(bearer,"foundation.branches.view");
    const admin=await this.administrator(bearer),reg=ref(registrationRef);
    const result=await this.db.query<DraftRow>(
      "SELECT * FROM branch_registration WHERE id=$1 AND root_realm_id=$2 AND "+
      "($3::boolean OR requested_by=$4 OR manager_account_ref=$4)",
      [reg,actor.realmId,admin,actor.accountId]);
    if(!result.rows[0])throw new NotFoundException("Branch registration unavailable");
    const row=result.rows[0];
    return {...this.summary(row),stages:row.profile_payload,
      managerRef:row.manager_account_ref,geographyRef:row.geography_area_id};
  }
  async lookup(bearer:string,actionInput:unknown,keyInput:unknown){
    const actor=await this.actor(bearer,"foundation.branches.view");
    const key=ref(keyInput),action=actionInput;
    if(action!=="BRANCH_DRAFT_CREATE"&&action!=="BRANCH_DRAFT_SAVE")
      throw new BadRequestException("Choose a valid branch change");
    const result=await this.db.query<{result_ref:string|null;result_version:number|null}>(
      "SELECT result_ref,result_version FROM branch_registration_command "+
      "WHERE root_realm_id=$1 AND actor_ref=$2 AND action=$3 AND request_key=$4",
      [actor.realmId,actor.accountId,action,key]);
    const old=result.rows[0];
    return {status:old?.result_ref?"CONFIRMED":"NOT_CONFIRMED",recordRef:old?.result_ref??null,
      version:old?.result_version??null};
  }
}
