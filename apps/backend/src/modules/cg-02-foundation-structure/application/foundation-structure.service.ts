import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { DATABASE } from "../../../core/infrastructure/database.module";
import { SessionService } from "../../cg-01-identity-access/application/session.service";
import { FoundationStructureIdentityFacade } from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type { VerifiedFoundationActor } from "../../cg-01-identity-access/public-api";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const digest=(s:string)=>createHash("sha256").update(s).digest("hex");
const id=(v:unknown):string=>{
  if(typeof v!=="string"||!UUID.test(v))throw new BadRequestException("Choose an existing Foundation record");
  return v;
};
const positive=(v:unknown,allowZero=false):number=>{
  if(!Number.isSafeInteger(v)||Number(v)<(allowZero?0:1)||Number(v)>2147483647)
    throw new BadRequestException("Refresh the information before saving");
  return Number(v);
};
const text=(v:unknown,min:number,max:number):string=>{
  if(typeof v!=="string")throw new BadRequestException("Check the required information");
  const x=v.trim().replace(/\s+/g," ");
  if(x.length<min||x.length>max)throw new BadRequestException("Check the required information");
  return x;
};
const optional=(v:unknown,max:number):string|null=>{
  if(v===undefined||v===null||v==="")return null;
  return text(v,1,max);
};
const date=(v:unknown):string|null=>{
  if(v===undefined||v===null||v==="")return null;
  if(typeof v!=="string"||!/^(19|20|21)\d\d-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(v)||
     new Date(v+"T00:00:00Z").toISOString().slice(0,10)!==v)
    throw new BadRequestException("Enter a valid date");
  return v;
};
const normal=(v:string)=>v.toLowerCase();
const levelParent:Record<string,readonly string[]>={
  STATE:[],DISTRICT:["STATE"],SUBDIVISION:["DISTRICT"],BLOCK:["DISTRICT","SUBDIVISION"]
};
type Outcome={recordRef:string;version:number;status:"CONFIRMED";message:string};
type CommandResult={id:string|null;replay:Outcome|null};
type Base={requestKey:string;expectedVersion?:number};
type Profile=Base&{legalName:string;officialContact?:string;postalAddress?:string;
  registrationRef?:string|null;registrationAuthority?:string|null;registrationDate?:string|null};
type Area=Base&{level:string;name:string;parentRef?:string|null;code?:string|null;status?:string};
type Department=Base&{kind:string;name:string;description?:string;openingDate?:string|null;
  geographyRef?:string|null;parentRef?:string|null;headAccountRef?:string|null;active?:boolean};
type Participant=Base&{accountRef:string;officeRole:string};

@Injectable()
export class FoundationStructureService {
  constructor(@Inject(DATABASE) private readonly db:Pool,
    private readonly sessions:SessionService,
    private readonly identity:FoundationStructureIdentityFacade){}
  private async actor(bearer:string,action:string){
    return this.sessions.requireAction(bearer,action);
  }
  private async command(client:PoolClient,actor:VerifiedFoundationActor,action:string,requestKey:string,
      payload:unknown):Promise<CommandResult>{
    id(requestKey);
    const requestDigest=digest(JSON.stringify(payload));
    const added=await client.query<{id:string}>(`
      INSERT INTO foundation_command(root_realm_id,actor_ref,action,request_key,request_digest)
      VALUES($1,$2,$3,$4,$5) ON CONFLICT(root_realm_id,actor_ref,action,request_key)
      DO NOTHING RETURNING id`,[actor.realmId,actor.accountId,action,requestKey,requestDigest]);
    if(added.rowCount)return {id:added.rows[0].id,replay:null};
    const old=await client.query<{request_digest:string;result_ref:string|null;result_version:number|null}>(`
      SELECT request_digest,result_ref,result_version FROM foundation_command
      WHERE root_realm_id=$1 AND actor_ref=$2 AND action=$3 AND request_key=$4 FOR SHARE`,
      [actor.realmId,actor.accountId,action,requestKey]);
    if(!old.rowCount||old.rows[0].request_digest!==requestDigest||!old.rows[0].result_ref||
      old.rows[0].result_version===null)throw new ConflictException("This change has already been submitted differently");
    return {id:null,replay:{recordRef:old.rows[0].result_ref,version:old.rows[0].result_version,
      status:"CONFIRMED",message:"Previously confirmed. Refresh to see current information."}};
  }
  private async perform(bearer:string,permission:string,action:string,requestKey:string,payload:unknown,
      kind:string,change:(client:PoolClient,actor:VerifiedFoundationActor)=>Promise<{id:string;version:number}>,
      lockRoot=false):Promise<Outcome>{
    const actor=await this.actor(bearer,permission);
    const client=await this.db.connect();
    let transactionOpen=false;
    try{
      await client.query("BEGIN");transactionOpen=true;
      await this.identity.assertCurrent(client,actor,permission);
      const command=await this.command(client,actor,action,requestKey,payload);
      if(command.replay){
        await client.query("COMMIT");transactionOpen=false;return command.replay;
      }
      if(lockRoot){
        const root=await client.query(`
          SELECT id FROM access_realm WHERE id=$1 AND realm_key='FOUNDATION_ROOT' FOR UPDATE`,[actor.realmId]);
        if(!root.rowCount)throw new ForbiddenException("Foundation access is unavailable");
      }
      const result=await change(client,actor);
      await client.query(`
        INSERT INTO foundation_event(root_realm_id,actor_ref,entity_kind,entity_ref,action,version,command_ref)
        VALUES($1,$2,$3,$4,$5,$6,$7)`,
        [actor.realmId,actor.accountId,kind,result.id,action,result.version,command.id]);
      await client.query(`
        UPDATE foundation_command SET result_ref=$2,result_version=$3 WHERE id=$1`,
        [command.id,result.id,result.version]);
      await client.query("COMMIT");transactionOpen=false;
      return {recordRef:result.id,version:result.version,status:"CONFIRMED",message:"Foundation change confirmed."};
    }catch(error){
      if(transactionOpen)try{await client.query("ROLLBACK");}catch{}
      if(error&&typeof error==="object"&&"code" in error){
        if(error.code==="23505")throw new ConflictException("This name is already in use");
        if(error.code==="23503")throw new BadRequestException("Choose an existing eligible Foundation record");
      }
      throw error;
    }finally{client.release();}
  }
  async profile(bearer:string){
    const actor=await this.actor(bearer,"foundation.profile.view");
    const result=await this.db.query<{
      legal_name:string;official_contact:string;postal_address:string;
      legal_registration_ref:string|null;registration_authority:string|null;registration_date:string|null;
      version:number;updated_at:Date;
    }>(`SELECT legal_name,official_contact,postal_address,legal_registration_ref,registration_authority,
         registration_date::text,version,updated_at FROM foundation_profile WHERE root_realm_id=$1`,[actor.realmId]);
    const row=result.rows[0];
    return {profile:row?{
      legalName:row.legal_name,officialContact:row.official_contact,postalAddress:row.postal_address,
      registrationRef:row.legal_registration_ref,registrationAuthority:row.registration_authority,
      registrationDate:row.registration_date,version:row.version,updatedAt:row.updated_at.toISOString()
    }:null};
  }
  async saveProfile(bearer:string,input:Profile){
    if(!input||typeof input!=="object")throw new BadRequestException();
    const x={legalName:text(input.legalName,2,180),officialContact:optional(input.officialContact,180)??"",
      postalAddress:optional(input.postalAddress,700)??"",registrationRef:optional(input.registrationRef,120),
      registrationAuthority:optional(input.registrationAuthority,180),registrationDate:date(input.registrationDate),
      expectedVersion:positive(input.expectedVersion,true)};
    return this.perform(bearer,"foundation.profile.manage","PROFILE_SAVE",input.requestKey,x,"PROFILE",
      async(client,actor)=>{
        const existing=await client.query<{version:number}>(`
          SELECT version FROM foundation_profile WHERE root_realm_id=$1 FOR UPDATE`,[actor.realmId]);
        const old=existing.rows[0];
        if(!old&&x.expectedVersion!==0||old&&old.version!==x.expectedVersion)
          throw new ConflictException("Foundation profile changed. Refresh before saving.");
        if(!old){
          await client.query(`INSERT INTO foundation_profile
            (root_realm_id,legal_name,official_contact,postal_address,legal_registration_ref,
              registration_authority,registration_date,updated_by)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
            [actor.realmId,x.legalName,x.officialContact,x.postalAddress,
              x.registrationRef,x.registrationAuthority,x.registrationDate,actor.accountId]);
          return {id:actor.realmId,version:1};
        }
        const updated=await client.query<{version:number}>(`
          UPDATE foundation_profile SET legal_name=$2,official_contact=$3,postal_address=$4,
            legal_registration_ref=$5,registration_authority=$6,registration_date=$7,
            updated_by=$8,version=version+1,updated_at=now()
          WHERE root_realm_id=$1 RETURNING version`,
          [actor.realmId,x.legalName,x.officialContact,x.postalAddress,
            x.registrationRef,x.registrationAuthority,x.registrationDate,actor.accountId]);
        return {id:actor.realmId,version:updated.rows[0].version};
      });
  }
  async areas(bearer:string,level?:string,parentRef?:string,search="",offset=0){
    const actor=await this.actor(bearer,"foundation.geography.view");
    if(level!==undefined&&(typeof level!=="string"||!Object.hasOwn(levelParent,level))||
       typeof search!=="string"||search.length>80||
       (parentRef!==undefined&&(typeof parentRef!=="string"||!UUID.test(parentRef)))||
       !Number.isInteger(offset)||offset<0||offset>50000)
      throw new BadRequestException("Check geography filters");
    const term=search.trim().toLowerCase().replace(/[\\%_]/g,"\\$&");
    const result=await this.db.query<{
      id:string;level:string;parent_area_id:string|null;display_name:string;code:string|null;status:string;version:number;
    }>(`SELECT id,level,parent_area_id,display_name,code,status,version FROM geography_area
      WHERE root_realm_id=$1 AND ($2::text IS NULL OR level=$2)
        AND ($3::uuid IS NULL OR parent_area_id=$3)
        AND ($4='' OR normalized_name LIKE $4 ESCAPE '\\')
      ORDER BY level,display_name,id LIMIT 100 OFFSET $5`,
      [actor.realmId,level??null,parentRef??null,term?"%"+term+"%":"",offset]);
    return {areas:result.rows.map(x=>({
      areaRef:x.id,level:x.level,parentRef:x.parent_area_id,name:x.display_name,code:x.code,
      status:x.status,version:x.version
    })),limit:100,offset,nextOffset:result.rows.length===100?offset+100:null};
  }
  private async checkAreaParent(client:PoolClient,actor:VerifiedFoundationActor,
    level:string,parentRef:string|null,excludeRef?:string):Promise<void>{
    if(!Object.hasOwn(levelParent,level))throw new BadRequestException("Choose a supported geography level");
    if(level==="STATE"){
      if(parentRef)throw new BadRequestException("State cannot have a parent area");
      return;
    }
    if(!parentRef)throw new BadRequestException("Choose a valid parent geography");
    const p=await client.query<{level:string;status:string}>(`
      SELECT level,status FROM geography_area WHERE id=$1 AND root_realm_id=$2 FOR SHARE`,
      [parentRef,actor.realmId]);
    if(!p.rowCount||p.rows[0].status!=="ACTIVE"||!levelParent[level].includes(p.rows[0].level))
      throw new BadRequestException("Choose an active compatible parent area");
    if(excludeRef){
      const cycle=await client.query<{id:string}>(`
        WITH RECURSIVE descendants AS (
          SELECT id FROM geography_area WHERE id=$1 AND root_realm_id=$3
          UNION ALL
          SELECT child.id FROM geography_area child JOIN descendants d ON child.parent_area_id=d.id
            WHERE child.root_realm_id=$3
        ) SELECT id FROM descendants WHERE id=$2 LIMIT 1`,
        [excludeRef,parentRef,actor.realmId]);
      if(cycle.rowCount)throw new ConflictException("A geography area cannot contain itself");
    }
  }
  async createArea(bearer:string,input:Area){
    if(!input||typeof input!=="object")throw new BadRequestException();
    const x={level:text(input.level,3,20),name:text(input.name,2,100),
      parentRef:input.parentRef? id(input.parentRef):null,code:optional(input.code,24)};
    return this.perform(bearer,"foundation.geography.manage","AREA_CREATE",input.requestKey,x,"AREA",
      async(client,actor)=>{
        await this.checkAreaParent(client,actor,x.level,x.parentRef);
        const row=await client.query<{id:string;version:number}>(`
          INSERT INTO geography_area(root_realm_id,level,parent_area_id,display_name,
            normalized_name,code,updated_by)
          VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,version`,
          [actor.realmId,x.level,x.parentRef,x.name,normal(x.name),x.code,actor.accountId]);
        return row.rows[0];
      },true);
  }
  async updateArea(bearer:string,areaRef:string,input:Area){
    id(areaRef);
    if(!input||typeof input!=="object")throw new BadRequestException();
    const x={areaRef,expectedVersion:positive(input.expectedVersion),name:text(input.name,2,100),
      parentRef:input.parentRef? id(input.parentRef):null,code:optional(input.code,24),
      status:input.status??"ACTIVE"};
    if(!["ACTIVE","INACTIVE"].includes(x.status))throw new BadRequestException("Choose a valid status");
    return this.perform(bearer,"foundation.geography.manage","AREA_UPDATE",input.requestKey,x,"AREA",
      async(client,actor)=>{
        const old=await client.query<{level:string;version:number;status:string}>(`
          SELECT level,version,status FROM geography_area WHERE id=$1 AND root_realm_id=$2 FOR UPDATE`,
          [areaRef,actor.realmId]);
        if(!old.rowCount)throw new NotFoundException("Geography area is unavailable");
        if(old.rows[0].version!==x.expectedVersion)throw new ConflictException("Area was changed. Refresh first.");
        await this.checkAreaParent(client,actor,old.rows[0].level,x.parentRef,areaRef);
        if(x.status==="INACTIVE"){
          const active=await client.query(`SELECT 1 FROM geography_area
            WHERE parent_area_id=$1 AND root_realm_id=$2 AND status='ACTIVE' LIMIT 1`,
            [areaRef,actor.realmId]);
          const depts=await client.query(`SELECT 1 FROM department
            WHERE geography_area_id=$1 AND root_realm_id=$2 AND active LIMIT 1`,
            [areaRef,actor.realmId]);
          if(active.rowCount||depts.rowCount)throw new ConflictException("This area is still in use");
        }
        const updated=await client.query<{id:string;version:number}>(`
          UPDATE geography_area SET display_name=$3,normalized_name=$4,parent_area_id=$5,
            code=$6,status=$7,version=version+1,updated_by=$8,updated_at=now()
          WHERE id=$1 AND root_realm_id=$2 RETURNING id,version`,
          [areaRef,actor.realmId,x.name,normal(x.name),x.parentRef,x.code,x.status,actor.accountId]);
        return updated.rows[0];
      },true);
  }
  async departments(bearer:string,search="",kind?:string){
    const actor=await this.actor(bearer,"foundation.departments.view");
    if(typeof search!=="string"||search.length>80||(kind!==undefined&&!["DEPARTMENT","COMMITTEE"].includes(kind)))
      throw new BadRequestException("Check department filters");
    const term=search.trim().toLowerCase().replace(/[\\%_]/g,"\\$&");
    const r=await this.db.query<{
      id:string;kind:string;name:string;description:string;active:boolean;version:number;
      parent_department_id:string|null;geography_area_id:string|null;
      head_account_ref:string|null;opening_date:string|null;
    }>(`SELECT id,kind,name,description,active,version,parent_department_id,
        geography_area_id,head_account_ref,opening_date::text
        FROM department WHERE root_realm_id=$1 AND ($2::text IS NULL OR kind=$2)
        AND ($3='' OR normalized_name LIKE $3 ESCAPE '\\')
        ORDER BY name,id LIMIT 100`,
      [actor.realmId,kind??null,term?"%"+term+"%":""]);
    // Read-only CG-01 name projection; no account table imports into the CG-02 owner.
    const labelClient=await this.db.connect();
    let labels:Record<string,string>;
    try{
      labels=await this.identity.accountLabels(labelClient,actor,
        r.rows.flatMap(d=>d.head_account_ref?[d.head_account_ref]:[]));
    }finally{labelClient.release();}
    return {departments:r.rows.map(d=>({
      departmentRef:d.id,kind:d.kind,name:d.name,description:d.description,
      active:d.active,version:d.version,parentRef:d.parent_department_id,
      geographyRef:d.geography_area_id,headAccountRef:d.head_account_ref,
      headDisplayName:d.head_account_ref?labels[d.head_account_ref]??null:null,
      openingDate:d.opening_date,scope:"Foundation"
    })),limit:100};
  }
  private async departmentSources(client:PoolClient,actor:VerifiedFoundationActor,
    geographyRef:string|null,parentRef:string|null,headRef:string|null,excludeRef?:string){
    if(geographyRef){
      const area=await client.query(`SELECT 1 FROM geography_area WHERE id=$1
        AND root_realm_id=$2 AND status='ACTIVE' FOR SHARE`,[geographyRef,actor.realmId]);
      if(!area.rowCount)throw new BadRequestException("Choose an active Foundation location");
    }
    if(parentRef){
      const parent=await client.query(`SELECT 1 FROM department WHERE id=$1
        AND root_realm_id=$2 AND active=true FOR SHARE`,[parentRef,actor.realmId]);
      if(!parent.rowCount)throw new BadRequestException("Choose an active Foundation department");
      if(excludeRef){
        const found=await client.query(`
          WITH RECURSIVE descendants AS (
            SELECT id FROM department WHERE id=$1 AND root_realm_id=$3
            UNION ALL SELECT child.id FROM department child JOIN descendants d
              ON child.parent_department_id=d.id WHERE child.root_realm_id=$3)
          SELECT id FROM descendants WHERE id=$2 LIMIT 1`,
          [excludeRef,parentRef,actor.realmId]);
        if(found.rowCount)throw new ConflictException("A department cannot become its own parent");
      }
    }
    if(headRef)await this.identity.eligibleOfficeholder(client,actor,headRef);
  }
  async createDepartment(bearer:string,input:Department){
    if(!input||typeof input!=="object")throw new BadRequestException();
    const x={name:text(input.name,2,100),kind:input.kind,description:optional(input.description,800)??"",
      openingDate:date(input.openingDate),geographyRef:input.geographyRef?id(input.geographyRef):null,
      parentRef:input.parentRef?id(input.parentRef):null,headRef:input.headAccountRef?id(input.headAccountRef):null};
    if(!["DEPARTMENT","COMMITTEE"].includes(x.kind))throw new BadRequestException("Select department or committee");
    return this.perform(bearer,"foundation.departments.manage","DEPARTMENT_CREATE",input.requestKey,x,"DEPARTMENT",
      async(client,actor)=>{
        if(x.headRef)await this.identity.assertCurrent(client,actor,"foundation.departments.assign");
        await this.departmentSources(client,actor,x.geographyRef,x.parentRef,x.headRef);
        const row=await client.query<{id:string;version:number}>(`
          INSERT INTO department(root_realm_id,kind,name,normalized_name,description,opening_date,
            geography_area_id,parent_department_id,head_account_ref,updated_by)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id,version`,
          [actor.realmId,x.kind,x.name,normal(x.name),x.description,x.openingDate,
            x.geographyRef,x.parentRef,x.headRef,actor.accountId]);
        return row.rows[0];
      },true);
  }
  async updateDepartment(bearer:string,departmentRef:string,input:Department){
    id(departmentRef);
    if(!input||typeof input!=="object")throw new BadRequestException();
    const x={departmentRef,expectedVersion:positive(input.expectedVersion),name:text(input.name,2,100),
      kind:input.kind,description:optional(input.description,800)??"",
      openingDate:date(input.openingDate),geographyRef:input.geographyRef?id(input.geographyRef):null,
      parentRef:input.parentRef?id(input.parentRef):null,headRef:input.headAccountRef?id(input.headAccountRef):null,
      active:input.active??true};
    if(!["DEPARTMENT","COMMITTEE"].includes(x.kind)||typeof x.active!=="boolean")
      throw new BadRequestException("Check Foundation department details");
    return this.perform(bearer,"foundation.departments.manage","DEPARTMENT_UPDATE",input.requestKey,x,"DEPARTMENT",
      async(client,actor)=>{
        const old=await client.query<{version:number;head_account_ref:string|null}>(`
          SELECT version,head_account_ref FROM department WHERE id=$1 AND root_realm_id=$2 FOR UPDATE`,
          [departmentRef,actor.realmId]);
        if(!old.rowCount)throw new NotFoundException("Department is unavailable");
        if(old.rows[0].version!==x.expectedVersion)throw new ConflictException("Department was changed. Refresh.");
        if(x.headRef!==old.rows[0].head_account_ref)
          await this.identity.assertCurrent(client,actor,"foundation.departments.assign");
        await this.departmentSources(client,actor,x.geographyRef,x.parentRef,x.headRef,departmentRef);
        if(!x.active){
          const active=await client.query(`SELECT 1 FROM department
            WHERE root_realm_id=$1 AND parent_department_id=$2 AND active LIMIT 1`,
            [actor.realmId,departmentRef]);
          if(active.rowCount)throw new ConflictException("This department has active subdepartments");
        }
        const row=await client.query<{id:string;version:number}>(`
          UPDATE department SET name=$3,normalized_name=$4,kind=$5,description=$6,
            opening_date=$7,geography_area_id=$8,parent_department_id=$9,
            head_account_ref=$10,active=$11,version=version+1,updated_at=now(),updated_by=$12
          WHERE id=$1 AND root_realm_id=$2 RETURNING id,version`,
          [departmentRef,actor.realmId,x.name,normal(x.name),x.kind,x.description,x.openingDate,
            x.geographyRef,x.parentRef,x.headRef,x.active,actor.accountId]);
        return row.rows[0];
      },true);
  }
  async officeholderOptions(bearer:string,search=""){
    const actor=await this.actor(bearer,"foundation.departments.assign");
    if(typeof search!=="string"||search.length>80)throw new BadRequestException("Check the staff search");
    const client=await this.db.connect();
    try{
      await this.identity.assertCurrent(client,actor,"foundation.departments.assign");
      return {options:await this.identity.eligibleOfficeholderOptions(client,actor,search)};
    }finally{client.release();}
  }
  async addParticipant(bearer:string,departmentRef:string,input:Participant){
    id(departmentRef);
    if(!input||typeof input!=="object")throw new BadRequestException();
    const x={departmentRef,accountRef:id(input.accountRef),officeRole:text(input.officeRole,2,80)};
    return this.perform(bearer,"foundation.departments.assign","PARTICIPANT_ADD",input.requestKey,x,"PARTICIPANT",
      async(client,actor)=>{
        const dep=await client.query(`SELECT 1 FROM department WHERE root_realm_id=$1
          AND id=$2 AND active FOR SHARE`,[actor.realmId,departmentRef]);
        if(!dep.rowCount)throw new NotFoundException("This department is unavailable");
        await this.identity.eligibleOfficeholder(client,actor,x.accountRef);
        const row=await client.query<{id:string}>(`
          INSERT INTO department_participation(root_realm_id,department_id,account_ref,office_role,created_by)
          VALUES($1,$2,$3,$4,$5) RETURNING id`,
          [actor.realmId,departmentRef,x.accountRef,x.officeRole,actor.accountId]);
        return {id:row.rows[0].id,version:1};
      },true);
  }
  async participants(bearer:string,departmentRef:string){
    id(departmentRef);
    const actor=await this.actor(bearer,"foundation.departments.view");
    const exists=await this.db.query(`SELECT 1 FROM department WHERE root_realm_id=$1 AND id=$2`,
      [actor.realmId,departmentRef]);
    if(!exists.rowCount)throw new NotFoundException("Department unavailable");
    const rows=await this.db.query<{id:string;account_ref:string;office_role:string;active_from:Date;active_until:Date|null}>(`
      SELECT id,account_ref,office_role,active_from,active_until FROM department_participation
      WHERE root_realm_id=$1 AND department_id=$2 ORDER BY active_from DESC,id DESC LIMIT 100`,
      [actor.realmId,departmentRef]);
    const labelClient=await this.db.connect();
    let labels:Record<string,string>;
    try{
      labels=await this.identity.accountLabels(labelClient,actor,
        rows.rows.map(row=>row.account_ref));
    }finally{labelClient.release();}
    return {participants:rows.rows.map(x=>({
      participationRef:x.id,accountRef:x.account_ref,displayName:labels[x.account_ref]??null,
      officeRole:x.office_role,
      activeFrom:x.active_from.toISOString(),activeUntil:x.active_until?.toISOString()??null
    })),limit:100};
  }
  async endParticipant(bearer:string,departmentRef:string,participationRef:string,requestKey:string){
    id(departmentRef);id(participationRef);
    return this.perform(bearer,"foundation.departments.assign","PARTICIPANT_END",requestKey,
      {departmentRef,participationRef},"PARTICIPANT",
      async(client,actor)=>{
        const dep=await client.query(`SELECT 1 FROM department
          WHERE id=$1 AND root_realm_id=$2 FOR SHARE`,[departmentRef,actor.realmId]);
        if(!dep.rowCount)throw new NotFoundException("Department is unavailable");
        const done=await client.query<{id:string}>(`
          UPDATE department_participation SET active_until=now()
          WHERE id=$1 AND root_realm_id=$2 AND department_id=$3 AND active_until IS NULL
          RETURNING id`,[participationRef,actor.realmId,departmentRef]);
        if(!done.rowCount)throw new ConflictException("This officeholder assignment has changed");
        return {id:done.rows[0].id,version:2};
      },true);
  }
  async lookupChange(bearer:string,action:string,requestKey:string){
    id(requestKey);
    const actions:Record<string,string>={
      PROFILE_SAVE:"foundation.profile.manage",AREA_CREATE:"foundation.geography.manage",
      AREA_UPDATE:"foundation.geography.manage",DEPARTMENT_CREATE:"foundation.departments.manage",
      DEPARTMENT_UPDATE:"foundation.departments.manage",PARTICIPANT_ADD:"foundation.departments.assign",
      PARTICIPANT_END:"foundation.departments.assign"
    };
    const permission=actions[action];
    if(!permission)throw new BadRequestException("This change type is not supported");
    const actor=await this.actor(bearer,permission);
    const rows=await this.db.query<{result_ref:string|null;result_version:number|null}>(`
      SELECT result_ref,result_version FROM foundation_command
      WHERE root_realm_id=$1 AND actor_ref=$2 AND action=$3 AND request_key=$4`,
      [actor.realmId,actor.accountId,action,requestKey]);
    const row=rows.rows[0];
    return {status:row?.result_ref&&row.result_version!==null?"CONFIRMED":"NOT_CONFIRMED",
      ...(row?.result_ref&&row.result_version!==null?
        {recordRef:row.result_ref,version:row.result_version}:{}),
      message:row?.result_ref?"The original change is recorded. Refresh the information.":
        "This change has not been confirmed. Refresh before trying again."};
  }

  async history(bearer:string,entityKind:string,entityRef:string){
    if(!(entityKind==="PROFILE"&&entityRef==="self"))id(entityRef);
    const grant:Record<string,string>={
      PROFILE:"foundation.profile.view",AREA:"foundation.geography.view",
      DEPARTMENT:"foundation.departments.view",PARTICIPANT:"foundation.departments.view"
    };
    const permission=grant[entityKind];
    if(!permission)throw new BadRequestException("Unsupported Foundation history");
    const actor=await this.actor(bearer,permission);
    if(entityKind==="PROFILE"&&entityRef!=="self")
      throw new BadRequestException("Choose a Foundation history item");
    const effectiveRef=entityKind==="PROFILE"?actor.realmId:entityRef;
    const records=await this.db.query<{action:string;version:number;at:Date}>(`
      SELECT action,version,at FROM foundation_event WHERE root_realm_id=$1
        AND entity_kind=$2 AND entity_ref=$3
      ORDER BY at DESC,id DESC LIMIT 60`,[actor.realmId,entityKind,effectiveRef]);
    return {events:records.rows.map(x=>({action:x.action,version:x.version,recordedAt:x.at.toISOString()})),limit:60};
  }
  async exportPage(bearer:string,kind:string,offset=0){
    if(!["AREAS","DEPARTMENTS"].includes(kind)||!Number.isInteger(offset)||offset<0||offset>50000)
      throw new BadRequestException("Choose an available Foundation export");
    const permission=kind==="AREAS"?"foundation.geography.view":"foundation.departments.view";
    const actor=await this.actor(bearer,permission);
    let heading:string[];
    let rows:string[][];
    if(kind==="AREAS"){
      const result=await this.db.query<{display_name:string;level:string;parent_name:string|null;status:string}>(`
        SELECT a.display_name,a.level,parent.display_name AS parent_name,a.status
        FROM geography_area a LEFT JOIN geography_area parent ON parent.id=a.parent_area_id
          AND parent.root_realm_id=a.root_realm_id
        WHERE a.root_realm_id=$1 ORDER BY a.level,a.display_name,a.id LIMIT 250 OFFSET $2`,
        [actor.realmId,offset]);
      heading=["Area","Level","Parent","Status"];
      rows=result.rows.map(x=>[x.display_name,x.level,x.parent_name??"Foundation",x.status]);
    }else{
      const result=await this.db.query<{name:string;kind:string;parent_name:string|null;active:boolean}>(`
        SELECT d.name,d.kind,parent.name AS parent_name,d.active FROM department d
        LEFT JOIN department parent ON parent.id=d.parent_department_id
          AND parent.root_realm_id=d.root_realm_id
        WHERE d.root_realm_id=$1 ORDER BY d.name,d.id LIMIT 250 OFFSET $2`,
        [actor.realmId,offset]);
      heading=["Name","Type","Parent","Status"];
      rows=result.rows.map(x=>[x.name,x.kind,x.parent_name??"Foundation",x.active?"Active":"Inactive"]);
    }
    const cell=(value:string)=>{
      const safe=/^[=+@\-\t\r]/.test(value)?"'"+value:value;
      return '"'+safe.replace(/"/g,'""')+'"';
    };
    const csv=[heading,...rows].map(row=>row.map(cell).join(",")).join("\r\n")+"\r\n";
    return {filename:kind==="AREAS"?"Foundation-areas.csv":"Foundation-departments.csv",
      csv,count:rows.length,limit:250,offset,nextOffset:rows.length===250?offset+250:null};
  }

}
