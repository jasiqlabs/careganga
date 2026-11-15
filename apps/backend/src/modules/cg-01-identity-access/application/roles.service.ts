import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { DATABASE } from "../../../core/infrastructure/database.module";
import { SessionService } from "./session.service";
import { assignableKeys, capabilitiesInUse } from "../domain/capability-catalog";
import type { VerifiedFoundationActor } from "../public-api";

type Row = {
  id:string;realm_id:string;name:string;normalized_name:string;description:string;
  color_key:string|null;is_protected:boolean;active:boolean;revision:number;
};
type ListRow = Row & {assigned_count:string;grant_keys:string[]|null};
type Change = {name:string;description?:string;colorKey?:string|null;actionKeys:unknown;requestKey:string;expectedRevision?:number};
type Outcome = {roleRef:string;revision:number;message:string};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const colorKeys=new Set(["default"]); // Until the original CareGanga asset palette is authoritatively sampled.
const hash=(s:string)=>createHash("sha256").update(s).digest("hex");

function parseRef(value:string):string{
  if(typeof value!=="string"||!UUID.test(value))throw new BadRequestException();
  return value;
}
function normalName(value:unknown):{name:string;normalized:string}{
  if(typeof value!=="string")throw new BadRequestException();
  const name=value.trim().replace(/\s+/g," ");
  if(name.length<2||name.length>80)throw new BadRequestException();
  return {name,normalized:name.toLowerCase()};
}
function parseChange(input:Change):{name:string;normalized:string;description:string;colorKey:string|null;keys:string[];requestKey:string}{
  if(!input||typeof input!=="object")throw new BadRequestException();
  const {name,normalized}=normalName(input.name);
  if(input.description!==undefined&&typeof input.description!=="string")throw new BadRequestException();
  const description=(input.description??"").trim();
  if(description.length>350)throw new BadRequestException();
  const colorKey=input.colorKey??null;
  if(colorKey!==null && (typeof colorKey!=="string"||!colorKeys.has(colorKey)))throw new BadRequestException();
  if(typeof input.requestKey!=="string"||!UUID.test(input.requestKey))throw new BadRequestException();
  let keys:string[];
  try{keys=assignableKeys(input.actionKeys);}catch{throw new BadRequestException("Invalid permission selection");}
  return {name,normalized,description,colorKey,keys,requestKey:input.requestKey};
}
function revision(value:unknown):number{
  if(!Number.isInteger(value)||Number(value)<1||Number(value)>2147483647)throw new BadRequestException();
  return Number(value);
}
function toView(row:ListRow){
  return {
    roleRef:row.id,name:row.name,description:row.description,colorKey:row.color_key,
    protected:row.is_protected,active:row.active,revision:Number(row.revision),
    assignedCount:Number(row.assigned_count),actionKeys:(row.grant_keys??[])
      .filter(k=>capabilitiesInUse().some(cap=>cap.key===k)).sort()
  };
}

@Injectable()
export class RolesService {
  constructor(@Inject(DATABASE) private readonly db:Pool,private readonly sessions:SessionService){}

  async catalog(bearer:string){
    await this.sessions.requireAction(bearer,"roles.view");
    return {groups:[...new Set(capabilitiesInUse().map(c=>c.group))].map(group=>({
      group,actions:capabilitiesInUse().filter(c=>c.group===group)
    }))};
  }
  async list(bearer:string,query:{search?:string;offset?:number;limit?:number}={}){
    const actor=await this.sessions.requireAction(bearer,"roles.view");
    const search=(query.search??"").trim();
    const offset=query.offset??0,limit=query.limit??20;
    if(search.length>80||!Number.isInteger(offset)||offset<0||offset>10000||
       !Number.isInteger(limit)||limit<1||limit>50)throw new BadRequestException();
    const result=await this.db.query<ListRow>(`
      SELECT r.*,coalesce(count(DISTINCT ar.id),0)::text AS assigned_count,
        coalesce(array_agg(DISTINCT rg.capability_key)
          FILTER(WHERE rg.capability_key IS NOT NULL),'{}'::text[]) AS grant_keys
      FROM role r
      LEFT JOIN account_role ar ON ar.role_id=r.id AND ar.revoked_at IS NULL
      LEFT JOIN role_grant rg ON rg.role_id=r.id
      WHERE r.realm_id=$1 AND ($2='' OR r.normalized_name LIKE $2)
      GROUP BY r.id
      ORDER BY r.normalized_name,r.id
      LIMIT $3 OFFSET $4`,[actor.realmId,search?("%"+search.toLowerCase().replace(/[\\%_]/g,"\\$&")+"%"):"",limit,offset]);
    const total=await this.db.query<{n:string}>(`
      SELECT count(*)::text AS n FROM role WHERE realm_id=$1
      AND ($2='' OR normalized_name LIKE $2)`,
      [actor.realmId,search?("%"+search.toLowerCase().replace(/[\\%_]/g,"\\$&")+"%"):""]);
    return {roles:result.rows.map(toView),total:Number(total.rows[0].n),offset,limit};
  }
  async options(bearer:string,search=""){
    const actor=await this.sessions.requireAction(bearer,"roles.select");
    if(typeof search!=="string"||search.length>80)throw new BadRequestException();
    const rows=await this.db.query<{id:string;name:string}>(`
      SELECT id,name FROM role WHERE realm_id=$1 AND active=true AND is_protected=false
      AND ($2='' OR normalized_name LIKE $2)
      ORDER BY normalized_name,id LIMIT 30`,
      [actor.realmId,search?("%"+search.trim().toLowerCase()+"%"):""]);
    return {options:rows.rows.map(r=>({value:r.id,label:r.name,context:"Foundation"}))};
  }

  private async authorizeWrite(client:PoolClient,actor:VerifiedFoundationActor):Promise<void>{
    // Lock actual session/account/assignment/role so security changes cannot race through a write.
    const q=await client.query<{is_protected:boolean}>(`
      SELECT r.is_protected FROM auth_session s
      JOIN account a ON a.id=s.account_id AND a.status='ACTIVE'
        AND a.access_version=s.account_access_version
      JOIN account_role ar ON ar.account_id=a.id AND ar.realm_id=a.realm_id AND ar.revoked_at IS NULL
      JOIN role r ON r.id=ar.role_id AND r.active=true
      WHERE s.id=$1 AND a.id=$2 AND a.realm_id=$3 AND s.revoked_at IS NULL
        AND s.expires_at>now() AND s.last_seen_at>now()-interval '30 minutes'
        AND s.mfa_verified_at IS NOT NULL
      FOR SHARE OF s,a,ar,r`,[actor.activeSessionId,actor.accountId,actor.realmId]);
    // Non-root grant of roles.manage requires a genuine CG-03 approval/finalizer.
    if(!q.rowCount||!q.rows[0].is_protected)throw new ForbiddenException();
  }
  private async startCommand(client:PoolClient,actor:VerifiedFoundationActor,action:string,
    requestKey:string,requestDigest:string):Promise<{id:string|null;replay:Outcome|null}>{
    const created=await client.query<{id:string}>(`
      INSERT INTO role_command(actor_account_id,action,request_key)
      VALUES($1,$2,$3) ON CONFLICT(actor_account_id,action,request_key) DO NOTHING
      RETURNING id`,[actor.accountId,action,requestKey]);
    if(created.rowCount)return {id:created.rows[0].id,replay:null};
    const old=await client.query<{role_id:string;result_revision:number}>(`
      SELECT role_id,result_revision FROM role_command WHERE actor_account_id=$1
      AND action=$2 AND request_key=$3 FOR SHARE`,[actor.accountId,action,requestKey]);
    if(!old.rowCount||!old.rows[0].role_id)throw new ConflictException("Previous request is still being confirmed");
    // Replays do not execute the command or re-send audit entries.
    return {id:null,replay:{roleRef:old.rows[0].role_id,revision:old.rows[0].result_revision,message:"Previously confirmed."}};
  }
  private async finishCommand(client:PoolClient,id:string,roleRef:string,rev:number){
    await client.query("UPDATE role_command SET role_id=$2,result_revision=$3 WHERE id=$1",[id,roleRef,rev]);
  }
  private async audit(client:PoolClient,actor:VerifiedFoundationActor,action:string,roleName:string,correlationRef:string){
    await client.query(`INSERT INTO access_audit
      (realm_id,actor_account_id,action_key,outcome,safe_context,correlation_ref)
      VALUES($1,$2,$3,'SUCCESS',$4::jsonb,$5)`,
      [actor.realmId,actor.accountId,action,JSON.stringify({targetDisplay:roleName.slice(0,80)}),correlationRef]);
  }
  private async replaceGrants(client:PoolClient,roleRef:string,keys:string[]){
    await client.query("DELETE FROM role_grant WHERE role_id=$1",[roleRef]);
    for(const key of keys){
      await client.query("INSERT INTO role_grant(role_id,capability_key) VALUES($1,$2)",[roleRef,key]);
    }
  }
  private async revokeAssignedSessions(client:PoolClient,roleRef:string,realmRef:string){
    const affected=await client.query<{id:string}>(`
      UPDATE account SET access_version=access_version+1,updated_at=now()
      WHERE id IN (
        SELECT ar.account_id FROM account_role ar
        WHERE ar.role_id=$1 AND ar.realm_id=$2 AND ar.revoked_at IS NULL
      ) RETURNING id`,[roleRef,realmRef]);
    if(affected.rowCount){
      await client.query(`UPDATE auth_session SET revoked_at=now()
        WHERE account_id=ANY($1::uuid[]) AND revoked_at IS NULL`,
        [affected.rows.map(r=>r.id)]);
    }
  }
  private async perform(bearer:string,action:"CREATE"|"EDIT"|"COPY"|"RETIRE",
    requestKey:string,commandData:unknown,
    work:(client:PoolClient,actor:VerifiedFoundationActor)=>Promise<{roleRef:string;revision:number;name:string}>,
    correlationRef:string):Promise<Outcome>{
    const actor=await this.sessions.requireAction(bearer,"roles.manage");
    const client=await this.db.connect();
    try{
      await client.query("BEGIN");
      await this.authorizeWrite(client,actor);
      const command=await this.startCommand(client,actor,action,requestKey,hash(JSON.stringify(commandData)));
      if(command.replay){
        await client.query("COMMIT");
        return command.replay;
      }
      const result=await work(client,actor);
      await this.audit(client,actor,"identity.role."+action.toLowerCase(),result.name,correlationRef);
      await this.finishCommand(client,command.id!,result.roleRef,result.revision);
      await client.query("COMMIT");
      return {roleRef:result.roleRef,revision:result.revision,message:"Role change confirmed."};
    }catch(e){
      try{await client.query("ROLLBACK");}catch{ /* avoid masking original failure */ }
      if(e&&typeof e==="object"&&"code" in e&&e.code==="23505")
        throw new ConflictException("A role with this name already exists.");
      throw e;
    }finally{client.release();}
  }
  async create(bearer:string,input:Change,correlationRef:string):Promise<Outcome>{
    const x=parseChange(input);
    return this.perform(bearer,"CREATE",x.requestKey,x,async(client,actor)=>{
      const result=await client.query<{id:string;revision:number}>(`
        INSERT INTO role(realm_id,name,normalized_name,description,color_key)
        VALUES($1,$2,$3,$4,$5) RETURNING id,revision`,
        [actor.realmId,x.name,x.normalized,x.description,x.colorKey]);
      await this.replaceGrants(client,result.rows[0].id,x.keys);
      return {roleRef:result.rows[0].id,revision:result.rows[0].revision,name:x.name};
    },correlationRef);
  }
  async copy(bearer:string,sourceRef:string,input:Change,correlationRef:string):Promise<Outcome>{
    parseRef(sourceRef);
    const x=parseChange(input);
    return this.perform(bearer,"COPY",x.requestKey,{...x,sourceRef},async(client,actor)=>{
      const source=await client.query<Row>(`
        SELECT * FROM role WHERE id=$1 AND realm_id=$2 AND active=true FOR SHARE`,[sourceRef,actor.realmId]);
      if(!source.rowCount)throw new NotFoundException();
      if(source.rows[0].is_protected)throw new ForbiddenException();
      const original=await client.query<{capability_key:string}>(`
        SELECT capability_key FROM role_grant WHERE role_id=$1`,[sourceRef]);
      const safeKeys=original.rows.map(r=>r.capability_key)
        .filter(k=>capabilitiesInUse().some(c=>c.key===k&&c.assignable));
      const result=await client.query<{id:string;revision:number}>(`
        INSERT INTO role(realm_id,name,normalized_name,description,color_key)
        VALUES($1,$2,$3,$4,$5) RETURNING id,revision`,
        [actor.realmId,x.name,x.normalized,x.description,x.colorKey]);
      await this.replaceGrants(client,result.rows[0].id,safeKeys);
      return {roleRef:result.rows[0].id,revision:result.rows[0].revision,name:x.name};
    },correlationRef);
  }
  async edit(bearer:string,roleRef:string,input:Change,correlationRef:string):Promise<Outcome>{
    parseRef(roleRef);
    const x=parseChange(input),expected=revision(input.expectedRevision);
    return this.perform(bearer,"EDIT",x.requestKey,{...x,roleRef,expected},async(client,actor)=>{
      const found=await client.query<Row>("SELECT * FROM role WHERE id=$1 AND realm_id=$2 FOR UPDATE",[roleRef,actor.realmId]);
      if(!found.rowCount)throw new NotFoundException();
      if(found.rows[0].is_protected)throw new ForbiddenException();
      if(!found.rows[0].active)throw new ConflictException("Role has been retired.");
      if(found.rows[0].revision!==expected)throw new ConflictException("Role was changed elsewhere.");
      const saved=await client.query<{revision:number}>(`
        UPDATE role SET name=$3,normalized_name=$4,description=$5,color_key=$6,revision=revision+1
        WHERE id=$1 AND realm_id=$2 RETURNING revision`,
        [roleRef,actor.realmId,x.name,x.normalized,x.description,x.colorKey]);
      await this.replaceGrants(client,roleRef,x.keys);
      await this.revokeAssignedSessions(client,roleRef,actor.realmId);
      return {roleRef,revision:saved.rows[0].revision,name:x.name};
    },correlationRef);
  }
  async retire(bearer:string,roleRef:string,expectedRevision:number,requestKey:string,correlationRef:string):Promise<Outcome>{
    parseRef(roleRef);parseRef(requestKey);
    const expected=revision(expectedRevision);
    return this.perform(bearer,"RETIRE",requestKey,{roleRef,expected},async(client,actor)=>{
      const found=await client.query<Row>("SELECT * FROM role WHERE id=$1 AND realm_id=$2 FOR UPDATE",[roleRef,actor.realmId]);
      if(!found.rowCount)throw new NotFoundException();
      if(found.rows[0].is_protected)throw new ForbiddenException();
      if(!found.rows[0].active||found.rows[0].revision!==expected)throw new ConflictException("Refresh this role before retiring.");
      const assigned=await client.query("SELECT 1 FROM account_role WHERE role_id=$1 AND revoked_at IS NULL LIMIT 1",[roleRef]);
      if(assigned.rowCount)throw new ConflictException("Reassign the accounts using this role before retiring it.");
      const saved=await client.query<{revision:number}>(`
        UPDATE role SET active=false,revision=revision+1 WHERE id=$1 RETURNING revision`,[roleRef]);
      return {roleRef,revision:saved.rows[0].revision,name:found.rows[0].name};
    },correlationRef);
  }
}
