import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { createHash } from "node:crypto";
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
// Keep wire keys stable: values and visible labels live in packages/design-tokens.
const colorKeys=new Set(["default","blue","green","amber","orange","violet","pink","teal"]);
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
  // Definition is restricted to currently protected root by authorizeWrite().
  // roles.manage may be defined on a custom role, but CG-01 direct assignment
  // remains forbidden and only the later approved CG-03 finalizer may grant it.
  let keys:string[];
  try{
    if(!Array.isArray(input.actionKeys)||new Set(input.actionKeys).size!==input.actionKeys.length)
      throw new Error("INVALID_CAPABILITIES");
    const hasSensitive=input.actionKeys.includes("roles.manage");
    keys=assignableKeys(input.actionKeys.filter((key:unknown)=>key!=="roles.manage"));
    if(hasSensitive)keys=[...keys,"roles.manage"].sort();
  }catch{throw new BadRequestException("Invalid permission selection");}
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
  async list(bearer:string,query:{search?:string;offset?:number;limit?:number;status?:"all"|"active"|"retired";type?:"all"|"system"|"custom"}={}){
    const actor=await this.sessions.requireAction(bearer,"roles.view");
    if(query.search!==undefined&&typeof query.search!=="string"||
       query.status!==undefined&&typeof query.status!=="string"||
       query.type!==undefined&&typeof query.type!=="string")
      throw new BadRequestException("Check the role search filters");
    const search=(query.search??"").trim();
    const offset=query.offset??0,limit=query.limit??20,status=query.status??"all",kind=query.type??"all";
    if(search.length>80||!["all","active","retired"].includes(status)||!["all","system","custom"].includes(kind)||!Number.isInteger(offset)||offset<0||offset>10000||
       !Number.isInteger(limit)||limit<1||limit>50)throw new BadRequestException();
    const result=await this.db.query<ListRow>(`
      SELECT r.*,coalesce(count(DISTINCT ar.id),0)::text AS assigned_count,
        coalesce(array_agg(DISTINCT rg.capability_key)
          FILTER(WHERE rg.capability_key IS NOT NULL),'{}'::text[]) AS grant_keys
      FROM role r
      LEFT JOIN account_role ar ON ar.role_id=r.id AND ar.revoked_at IS NULL
      LEFT JOIN role_grant rg ON rg.role_id=r.id
      WHERE r.realm_id=$1 AND ($2='' OR r.normalized_name LIKE $2)
        AND ($5='all' OR r.active=($5='active'))
        AND ($6='all' OR r.is_protected=($6='system'))
      GROUP BY r.id
      ORDER BY r.normalized_name,r.id
      LIMIT $3 OFFSET $4`,[actor.realmId,search?("%"+search.toLowerCase().replace(/[\\%_]/g,"\\$&")+"%"):"",limit,offset,status,kind]);
    const total=await this.db.query<{n:string}>(`
      SELECT count(*)::text AS n FROM role WHERE realm_id=$1
      AND ($2='' OR normalized_name LIKE $2)
      AND ($3='all' OR active=($3='active'))
      AND ($4='all' OR is_protected=($4='system'))`,
      [actor.realmId,search?("%"+search.toLowerCase().replace(/[\\%_]/g,"\\$&")+"%"):"",status,kind]);
    // Six factual Foundation-role summaries corresponding to the original U05/U06 KPI row.
    // This queries only CG-01 roles; do not invent future module permission counts.
    const overall=await this.db.query<{
      total_roles:string;active_roles:string;inactive_roles:string;
      system_roles:string;custom_roles:string;
    }>(`
      SELECT count(*)::text AS total_roles,
        count(*) FILTER (WHERE active)::text AS active_roles,
        count(*) FILTER (WHERE NOT active)::text AS inactive_roles,
        count(*) FILTER (WHERE is_protected)::text AS system_roles,
        count(*) FILTER (WHERE NOT is_protected)::text AS custom_roles
      FROM role WHERE realm_id=$1`,[actor.realmId]);
    const summary=overall.rows[0];
    return {roles:result.rows.map(toView),total:Number(total.rows[0].n),offset,limit,
      summary:{
        totalRoles:Number(summary.total_roles),
        implementedActions:capabilitiesInUse().length,
        activeRoles:Number(summary.active_roles),
        inactiveRoles:Number(summary.inactive_roles),
        customRoles:Number(summary.custom_roles),
        systemRoles:Number(summary.system_roles)
      }
    };
  }
  async options(bearer:string,search=""){
    let actor:VerifiedFoundationActor;
    try{actor=await this.sessions.requireAction(bearer,"roles.select");}
    catch(error){
      if(!(error instanceof ForbiddenException))throw error;
      try{actor=await this.sessions.requireAction(bearer,"accounts.create");}
      catch(second){
        if(!(second instanceof ForbiddenException))throw second;
        actor=await this.sessions.requireAction(bearer,"roles.assign");
      }
    }
    if(typeof search!=="string"||search.length>80)throw new BadRequestException();
    const rows=await this.db.query<{id:string;name:string}>(`
      SELECT r.id,r.name FROM role r WHERE r.realm_id=$1 AND r.active=true AND r.is_protected=false
      AND NOT EXISTS(
        SELECT 1 FROM role_grant g WHERE g.role_id=r.id
          AND g.capability_key IN ('roles.manage','identity.security-policy.manage')
      )
      AND ($2='' OR r.normalized_name LIKE $2)
      ORDER BY r.normalized_name,r.id LIMIT 30`,
      [actor.realmId,search?("%"+search.trim().toLowerCase().replace(/[\\%_]/g,"\\$&")+"%"):""]);
    return {options:rows.rows.map(r=>({value:r.id,label:r.name,context:"Foundation"}))};
  }

  private async authorizeWrite(client:PoolClient,actor:VerifiedFoundationActor):Promise<boolean>{
    // Lock actual session/account/assignment/role so security changes cannot race through a write.
    const q=await client.query<{is_protected:boolean;approved_sensitive:boolean}>(`
      SELECT r.is_protected,
        EXISTS(SELECT 1 FROM cg01_approved_sensitive_assignment eff
          WHERE eff.target_account_id=a.id AND eff.realm_id=a.realm_id
            AND eff.target_role_id=r.id AND eff.approved_role_revision=r.revision
            AND eff.resulting_access_version<=a.access_version
        ) AS approved_sensitive
      FROM auth_session s
      JOIN account a ON a.id=s.account_id AND a.status='ACTIVE'
        AND a.access_version=s.account_access_version
      JOIN account_role ar ON ar.account_id=a.id AND ar.realm_id=a.realm_id AND ar.revoked_at IS NULL
      JOIN role r ON r.id=ar.role_id AND r.active=true
      LEFT JOIN auth_security_policy policy ON policy.access_realm_id=a.realm_id
      WHERE s.id=$1 AND a.id=$2 AND a.realm_id=$3 AND s.revoked_at IS NULL
        AND s.expires_at>now()
        AND s.issued_at>now()-make_interval(secs=>COALESCE(policy.max_session_age_seconds,28800))
        AND s.last_seen_at>now()-make_interval(secs=>COALESCE(policy.idle_timeout_seconds,1800))
        AND s.password_authenticated_at IS NOT NULL
      FOR SHARE OF s,a,ar,r`,[actor.activeSessionId,actor.accountId,actor.realmId]);
    // Root may edit the sensitive definition; approved non-root staff may
    // manage ordinary roles only. Neither can bypass CG-03 sensitive assignment.
    if(!q.rowCount||(!q.rows[0].is_protected&&!q.rows[0].approved_sensitive))
      throw new ForbiddenException();
    return q.rows[0].is_protected;
  }
  private async startCommand(client:PoolClient,actor:VerifiedFoundationActor,action:string,
    requestKey:string,requestDigest:string):Promise<{id:string|null;replay:Outcome|null}>{
    const created=await client.query<{id:string}>(`
      INSERT INTO role_command(actor_account_id,action,request_key,request_digest)
      VALUES($1,$2,$3,$4) ON CONFLICT(actor_account_id,action,request_key) DO NOTHING
      RETURNING id`,[actor.accountId,action,requestKey,requestDigest]);
    if(created.rowCount)return {id:created.rows[0].id,replay:null};
    const old=await client.query<{role_id:string;result_revision:number;request_digest:string}>(`
      SELECT role_id,result_revision,request_digest FROM role_command WHERE actor_account_id=$1
      AND action=$2 AND request_key=$3 FOR SHARE`,[actor.accountId,action,requestKey]);
    if(!old.rowCount||!old.rows[0].role_id)throw new ConflictException({code:"REPLAY_CONFLICT"});
    if(old.rows[0].request_digest!==requestDigest)
      throw new ConflictException({code:"REPLAY_CONFLICT"});
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
    work:(client:PoolClient,actor:VerifiedFoundationActor,root:boolean)=>Promise<{roleRef:string;revision:number;name:string}>,
    correlationRef:string):Promise<Outcome>{
    const actor=await this.sessions.requireAction(bearer,"roles.manage");
    const client=await this.db.connect();
    try{
      await client.query("BEGIN");
      const root=await this.authorizeWrite(client,actor);
      const command=await this.startCommand(client,actor,action,requestKey,hash(JSON.stringify(commandData)));
      if(command.replay){
        await client.query("COMMIT");
        return command.replay;
      }
      const result=await work(client,actor,root);
      await this.audit(client,actor,"identity.role."+action.toLowerCase(),result.name,correlationRef);
      await this.finishCommand(client,command.id!,result.roleRef,result.revision);
      await client.query("COMMIT");
      return {roleRef:result.roleRef,revision:result.revision,message:"Role change confirmed."};
    }catch(e){
      try{await client.query("ROLLBACK");}catch{ /* avoid masking original failure */ }
      if(e&&typeof e==="object"&&"code" in e&&e.code==="23505")
        throw new ConflictException({code:"DUPLICATE_ROLE"});
      throw e;
    }finally{client.release();}
  }
  async create(bearer:string,input:Change,correlationRef:string):Promise<Outcome>{
    const x=parseChange(input);
    return this.perform(bearer,"CREATE",x.requestKey,x,async(client,actor,root)=>{
      if(!root&&x.keys.includes("roles.manage"))throw new ForbiddenException();
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
    const x=parseChange(input),expected=revision(input.expectedRevision);
    return this.perform(bearer,"COPY",x.requestKey,{...x,sourceRef,expected},async(client,actor,root)=>{
      if(!root&&x.keys.includes("roles.manage"))throw new ForbiddenException();
      const source=await client.query<Row>(`
        SELECT * FROM role WHERE id=$1 AND realm_id=$2 AND active=true FOR SHARE`,[sourceRef,actor.realmId]);
      if(!source.rowCount)throw new NotFoundException();
      if(source.rows[0].is_protected)throw new ForbiddenException();
      if(source.rows[0].revision!==expected)throw new ConflictException({code:"STALE_ROLE"});
      const original=await client.query<{capability_key:string}>(`
        SELECT capability_key FROM role_grant WHERE role_id=$1`,[sourceRef]);
      if(!root&&original.rows.some(entry=>entry.capability_key==="roles.manage"))
        throw new ForbiddenException("Protected role definitions require Foundation root");
      // Copy the permissions explicitly selected in the review form.
      // Protected managers may include roles.manage; non-root editors are denied.
      const safeKeys=x.keys;
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
    return this.perform(bearer,"EDIT",x.requestKey,{...x,roleRef,expected},async(client,actor,root)=>{
      if(!root&&x.keys.includes("roles.manage"))throw new ForbiddenException();
      const found=await client.query<Row>("SELECT * FROM role WHERE id=$1 AND realm_id=$2 FOR UPDATE",[roleRef,actor.realmId]);
      if(!found.rowCount)throw new NotFoundException();
      if(found.rows[0].is_protected)throw new ForbiddenException();
      if(!found.rows[0].active)throw new ConflictException({code:"ROLE_RETIRED"});
      if(!root){
        const sensitive=await client.query("SELECT 1 FROM role_grant WHERE role_id=$1 AND capability_key='roles.manage'",[roleRef]);
        if(sensitive.rowCount)throw new ForbiddenException("Protected role definitions require Foundation root");
      }
      if(found.rows[0].revision!==expected)throw new ConflictException({code:"STALE_ROLE"});
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
    return this.perform(bearer,"RETIRE",requestKey,{roleRef,expected},async(client,actor,root)=>{
      const found=await client.query<Row>("SELECT * FROM role WHERE id=$1 AND realm_id=$2 FOR UPDATE",[roleRef,actor.realmId]);
      if(!found.rowCount)throw new NotFoundException();
      if(found.rows[0].is_protected)throw new ForbiddenException();
      if(!root){
        const sensitive=await client.query("SELECT 1 FROM role_grant WHERE role_id=$1 AND capability_key='roles.manage'",[roleRef]);
        if(sensitive.rowCount)throw new ForbiddenException("Protected role definitions require Foundation root");
      }
      if(!found.rows[0].active||found.rows[0].revision!==expected)throw new ConflictException({code:"STALE_ROLE"});
      const assigned=await client.query("SELECT 1 FROM account_role WHERE role_id=$1 AND revoked_at IS NULL LIMIT 1",[roleRef]);
      if(assigned.rowCount)throw new ConflictException({code:"ROLE_ASSIGNED"});
      const saved=await client.query<{revision:number}>(`
        UPDATE role SET active=false,revision=revision+1 WHERE id=$1 RETURNING revision`,[roleRef]);
      return {roleRef,revision:saved.rows[0].revision,name:found.rows[0].name};
    },correlationRef);
  }
}
