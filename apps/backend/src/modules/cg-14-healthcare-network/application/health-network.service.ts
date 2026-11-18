import {
  BadRequestException,ConflictException,ForbiddenException,Inject,Injectable,
  NotFoundException
} from "@nestjs/common";
import {createHash} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {SessionService} from "../../cg-01-identity-access/application/session.service";
import {FoundationStructureIdentityFacade} from "../../cg-01-identity-access/application/foundation-structure-identity.facade";
import type {VerifiedFoundationActor} from "../../cg-01-identity-access/public-api";
import {HealthDraftEvidenceService} from "../../cg-19-documents-notifications/application/health-draft-evidence.service";
import {HealthNetworkIdentityFacade} from "../../cg-01-identity-access/application/health-network-identity.facade";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODE=/^[A-Z0-9][A-Z0-9-]{1,23}$/;
const PHONE=/^[+]?[0-9]{10,15}$/;
const PIN=/^[1-9][0-9]{5}$/;
const TYPES=["HOSPITAL","CLINIC","DIAGNOSTIC_LAB","PHARMACY","NURSING","OTHER"] as const;
const SERVICES=["CONSULTATION","DIAGNOSTICS","PHARMACY","NURSING","SURGERY","EMERGENCY"] as const;
const HOUR_SERVICES=["GENERAL","CONSULTATION","DIAGNOSTICS","PHARMACY","NURSING"] as const;
type Hour={weekday:number;openLocal:string;closeLocal:string;serviceType:string};
type CenterDraft={
  centerCode:string;displayName:string;centerType:string;addressLine:string;
  stateRef:string;districtRef:string;blockRef:string|null;pinCode:string;
  latitude:number|null;longitude:number|null;timeZone:string;publicPhone:string|null;
  hours:Hour[];capabilities:string[];
};
type ProviderDraft={
  providerCode:string;legalName:string;providerType:string;contactName:string;
  contactPhone:string;contactEmail:string|null;registrationRef:string|null;
};
type Command={requestKey:string;expectedVersion?:number};
const hash=(value:unknown)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
function record(value:unknown,label:string):Record<string,unknown>{
  if(!value||typeof value!=="object"||Array.isArray(value))
    throw new BadRequestException({code:"HEALTH_FIELD_INVALID",field:label});
  return value as Record<string,unknown>;
}
function only(o:Record<string,unknown>,fields:readonly string[],label:string){
  if(Object.keys(o).some(key=>!fields.includes(key)))
    throw new BadRequestException({code:"HEALTH_FIELD_INVALID",field:label});
}
function str(v:unknown,field:string,min:number,max:number){
  if(typeof v!=="string")throw new BadRequestException({code:"HEALTH_FIELD_INVALID",field});
  const s=v.trim().replace(/\s+/g," ");
  if(s.length<min||s.length>max)
    throw new BadRequestException({code:"HEALTH_FIELD_INVALID",field});
  return s;
}
function optional(v:unknown,field:string,max:number):string|null{
  return v===undefined||v===null||v===""?null:str(v,field,1,max);
}
function uuid(v:unknown,field:string):string{
  if(typeof v!=="string"||!UUID.test(v))
    throw new BadRequestException({code:"HEALTH_FIELD_INVALID",field});
  return v;
}
function version(v:unknown,allowZero=false){
  if(!Number.isSafeInteger(v)||Number(v)<(allowZero?0:1)||Number(v)>2147483647)
    throw new BadRequestException({code:"HEALTH_VERSION_INVALID",field:"expectedVersion"});
  return Number(v);
}
function code(v:unknown,field:string){
  const s=str(v,field,2,24).toUpperCase();
  if(!CODE.test(s))throw new BadRequestException({code:"HEALTH_FIELD_INVALID",field});
  return s;
}
function oneOf(v:unknown,options:readonly string[],field:string):string{
  if(typeof v!=="string"||!options.includes(v))
    throw new BadRequestException({code:"HEALTH_FIELD_INVALID",field});
  return v;
}
function parseProvider(value:unknown):ProviderDraft{
  const x=record(value,"provider");
  only(x,["providerCode","legalName","providerType","contactName","contactPhone",
    "contactEmail","registrationRef"],"provider");
  const phone=str(x.contactPhone,"contactPhone",10,16);
  if(!PHONE.test(phone))throw new BadRequestException({code:"HEALTH_FIELD_INVALID",field:"contactPhone"});
  const email=optional(x.contactEmail,"contactEmail",180)?.toLowerCase()??null;
  if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new BadRequestException({code:"HEALTH_FIELD_INVALID",field:"contactEmail"});
  return {providerCode:code(x.providerCode,"providerCode"),
    legalName:str(x.legalName,"legalName",2,180),
    providerType:oneOf(x.providerType,TYPES,"providerType"),
    contactName:str(x.contactName,"contactName",2,120),
    contactPhone:phone,contactEmail:email,
    registrationRef:optional(x.registrationRef,"registrationRef",120)};
}
function parseCenter(value:unknown):CenterDraft{
  const x=record(value,"center");
  only(x,["centerCode","displayName","centerType","addressLine","stateRef",
    "districtRef","blockRef","pinCode","latitude","longitude","timeZone",
    "publicPhone","hours","capabilities"],"center");
  const pin=str(x.pinCode,"pinCode",6,6);
  if(!PIN.test(pin))throw new BadRequestException({code:"HEALTH_FIELD_INVALID",field:"pinCode"});
  const latitude=x.latitude===undefined||x.latitude===null||x.latitude===""?null:x.latitude;
  const longitude=x.longitude===undefined||x.longitude===null||x.longitude===""?null:x.longitude;
  if(latitude!==null&&(typeof latitude!=="number"||!Number.isFinite(latitude)||latitude < -90||latitude >90)||
     longitude!==null&&(typeof longitude!=="number"||!Number.isFinite(longitude)||longitude < -180||longitude >180))
    throw new BadRequestException({code:"HEALTH_FIELD_INVALID",field:"coordinates"});
  const zone=str(x.timeZone,"timeZone",3,64);
  try{new Intl.DateTimeFormat("en",{timeZone:zone});}
  catch{throw new BadRequestException({code:"HEALTH_FIELD_INVALID",field:"timeZone"});}
  const phone=optional(x.publicPhone,"publicPhone",16);
  if(phone&&!PHONE.test(phone))
    throw new BadRequestException({code:"HEALTH_FIELD_INVALID",field:"publicPhone"});
  if(!Array.isArray(x.hours)||x.hours.length>42)
    throw new BadRequestException({code:"HEALTH_FIELD_INVALID",field:"hours"});
  const hours:Hour[]=x.hours.map((value:unknown)=>{
    const h=record(value,"hours");only(h,["weekday","openLocal","closeLocal","serviceType"],"hours");
    if(!Number.isInteger(h.weekday)||Number(h.weekday)<0||Number(h.weekday)>6)
      throw new BadRequestException({code:"HEALTH_FIELD_INVALID",field:"weekday"});
    const open=str(h.openLocal,"openLocal",5,5),close=str(h.closeLocal,"closeLocal",5,5);
    if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(open)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(close)||open>=close)
      throw new BadRequestException({code:"HEALTH_FIELD_INVALID",field:"hours"});
    return {weekday:Number(h.weekday),openLocal:open,closeLocal:close,
      serviceType:oneOf(h.serviceType??"GENERAL",HOUR_SERVICES,"serviceType")};
  });
  for(let i=0;i<hours.length;i++)for(let j=i+1;j<hours.length;j++){
    const a=hours[i],b=hours[j];
    if(a.weekday===b.weekday&&a.serviceType===b.serviceType&&
      a.openLocal<b.closeLocal&&b.openLocal<a.closeLocal)
      throw new BadRequestException({code:"HEALTH_HOURS_OVERLAP",field:"hours"});
  }
  if(!Array.isArray(x.capabilities)||x.capabilities.length>SERVICES.length||
     x.capabilities.some(cap=>typeof cap!=="string"||!SERVICES.includes(cap as typeof SERVICES[number]))||
     new Set(x.capabilities).size!==x.capabilities.length)
    throw new BadRequestException({code:"HEALTH_FIELD_INVALID",field:"capabilities"});
  return {centerCode:code(x.centerCode,"centerCode"),
    displayName:str(x.displayName,"displayName",2,160),
    centerType:oneOf(x.centerType,TYPES,"centerType"),
    addressLine:str(x.addressLine,"addressLine",5,500),
    stateRef:uuid(x.stateRef,"stateRef"),districtRef:uuid(x.districtRef,"districtRef"),
    blockRef:x.blockRef?uuid(x.blockRef,"blockRef"):null,pinCode:pin,
    latitude:latitude as number|null,longitude:longitude as number|null,
    timeZone:zone,publicPhone:phone,hours,capabilities:x.capabilities as string[]};
}
type Actor=VerifiedFoundationActor;
type CommandRow={id:string;request_digest:string;result_ref:string|null;result_version:number|null};
@Injectable()
export class HealthNetworkService{
  constructor(@Inject(DATABASE)private readonly db:Pool,
    private readonly sessions:SessionService,
    private readonly identity:FoundationStructureIdentityFacade,
    private readonly evidence:HealthDraftEvidenceService,
    private readonly representativeIdentity:HealthNetworkIdentityFacade){}
  private async transact<T>(fn:(client:PoolClient)=>Promise<T>):Promise<T>{
    const client=await this.db.connect();let open=false;
    try{
      await client.query("BEGIN");open=true;
      const result=await fn(client);
      await client.query("COMMIT");open=false;return result;
    }catch(e){
      if(open)try{await client.query("ROLLBACK");}catch{}
      if(e&&typeof e==="object"&&"code" in e){
        const pg=(e as {code?:string}).code;
        if(pg==="23505")throw new ConflictException({code:"HEALTH_DUPLICATE"});
        if(pg==="23503"||pg==="23514"||pg==="22P02")
          throw new BadRequestException({code:"HEALTH_FIELD_INVALID"});
      }
      throw e;
    }finally{client.release();}
  }
  private async command(client:PoolClient,actor:Actor,action:string,
    requestKey:unknown,payload:unknown):Promise<{commandId:string|null;replay:CommandRow|null}>{
    const key=uuid(requestKey,"requestKey"),digest=hash(payload);
    const inserted=await client.query<{id:string}>(
      "INSERT INTO health_network_command(root_realm_id,actor_ref,action_key,request_key,request_digest) "+
      "VALUES($1,$2,$3,$4,$5) ON CONFLICT(root_realm_id,actor_ref,action_key,request_key) DO NOTHING RETURNING id",
      [actor.realmId,actor.accountId,action,key,digest]);
    if(inserted.rows[0])return {commandId:inserted.rows[0].id,replay:null};
    const old=await client.query<CommandRow>(
      "SELECT id,request_digest,result_ref,result_version FROM health_network_command "+
      "WHERE root_realm_id=$1 AND actor_ref=$2 AND action_key=$3 AND request_key=$4 FOR SHARE",
      [actor.realmId,actor.accountId,action,key]);
    if(!old.rows[0]||old.rows[0].request_digest!==digest||!old.rows[0].result_ref)
      throw new ConflictException({code:"HEALTH_REQUEST_CONFLICT"});
    return {commandId:null,replay:old.rows[0]};
  }
  private async done(client:PoolClient,cmd:string|null,actor:Actor,action:string,
    providerId:string,centerId:string|null,ref:string,v:number){
    if(cmd)await client.query(
      "UPDATE health_network_command SET result_ref=$2,result_version=$3 WHERE id=$1",
      [cmd,ref,v]);
    await client.query(
      "INSERT INTO health_network_event(root_realm_id,actor_ref,provider_id,center_id,action_key,version,command_id) "+
      "VALUES($1,$2,$3,$4,$5,$6,$7)",
      [actor.realmId,actor.accountId,providerId,centerId,action,v,cmd]);
  }
  private async validGeo(client:PoolClient,actor:Actor,draft:CenterDraft){
    const ids=[draft.stateRef,draft.districtRef,...(draft.blockRef?[draft.blockRef]:[])];
    const r=await client.query<{id:string;level:string;parent_area_id:string|null;status:string}>(
      "SELECT id,level,parent_area_id,status FROM geography_area "+
      "WHERE root_realm_id=$1 AND id=ANY($2::uuid[]) FOR SHARE",
      [actor.realmId,ids]);
    const map=new Map(r.rows.map(row=>[row.id,row]));
    const state=map.get(draft.stateRef),district=map.get(draft.districtRef);
    if(!state||state.level!=="STATE"||state.status!=="ACTIVE"||
       !district||district.level!=="DISTRICT"||district.parent_area_id!==state.id||
       district.status!=="ACTIVE")
      throw new BadRequestException({code:"HEALTH_GEOGRAPHY_INVALID",field:"districtRef"});
    if(draft.blockRef){
      const block=map.get(draft.blockRef);
      if(!block||block.level!=="BLOCK"||block.status!=="ACTIVE")
        throw new BadRequestException({code:"HEALTH_GEOGRAPHY_INVALID",field:"blockRef"});
      if(block.parent_area_id!==district.id){
        const parent=await client.query<{id:string}>(
          "SELECT id FROM geography_area WHERE id=$1 AND root_realm_id=$2 "+
          "AND level='SUBDIVISION' AND parent_area_id=$3 AND status='ACTIVE' FOR SHARE",
          [block.parent_area_id,actor.realmId,district.id]);
        if(!parent.rows[0])
          throw new BadRequestException({code:"HEALTH_GEOGRAPHY_INVALID",field:"blockRef"});
      }
    }
  }
  private async insertCenter(client:PoolClient,actor:Actor,providerId:string,draft:CenterDraft){
    await this.validGeo(client,actor,draft);
    const created=await client.query<{id:string;version:number}>(
      "INSERT INTO health_center(root_realm_id,provider_id,center_code,display_name,center_type,"+
      "address_line,state_ref,district_ref,block_ref,pin_code,latitude,longitude,time_zone,public_phone) "+
      "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id,version",
      [actor.realmId,providerId,draft.centerCode,draft.displayName,draft.centerType,
       draft.addressLine,draft.stateRef,draft.districtRef,draft.blockRef,draft.pinCode,
       draft.latitude,draft.longitude,draft.timeZone,draft.publicPhone]);
    const centerId=created.rows[0].id;
    await this.replaceDetails(client,actor,centerId,draft);
    return created.rows[0];
  }
  private async replaceDetails(client:PoolClient,actor:Actor,centerId:string,draft:CenterDraft){
    await client.query("DELETE FROM health_center_hours WHERE root_realm_id=$1 AND center_id=$2",
      [actor.realmId,centerId]);
    await client.query("DELETE FROM health_center_capability WHERE root_realm_id=$1 AND center_id=$2",
      [actor.realmId,centerId]);
    for(const h of draft.hours)await client.query(
      "INSERT INTO health_center_hours(root_realm_id,center_id,weekday,open_local,close_local,service_type) "+
      "VALUES($1,$2,$3,$4,$5,$6)",
      [actor.realmId,centerId,h.weekday,h.openLocal,h.closeLocal,h.serviceType]);
    for(const service of draft.capabilities)await client.query(
      "INSERT INTO health_center_capability(root_realm_id,center_id,capability_code) VALUES($1,$2,$3)",
      [actor.realmId,centerId,service]);
  }
  private async allowed(bearer:string,capability:string){
    return this.sessions.requireAction(bearer,capability);
  }
  private async foundationAdmin(client:PoolClient,actor:Actor):Promise<boolean>{
    const role=await client.query<{allowed:boolean}>(
      "SELECT EXISTS(SELECT 1 FROM account_role ar JOIN role r ON r.id=ar.role_id "+
      "WHERE ar.account_id=$1 AND ar.realm_id=$2 AND ar.revoked_at IS NULL "+
      "AND r.active=true AND r.is_protected=true) AS allowed",
      [actor.accountId,actor.realmId]);
    return role.rows[0]?.allowed===true;
  }
  async createProvider(bearer:string,body:unknown){
    const input=record(body,"provider");
    only(input,["requestKey","provider","centers"],"provider");
    const provider=parseProvider(input.provider);
    if(!Array.isArray(input.centers)||input.centers.length<1||input.centers.length>10)
      throw new BadRequestException({code:"HEALTH_FIELD_INVALID",field:"centers"});
    const centers=input.centers.map(parseCenter);
    if(new Set(centers.map(x=>x.centerCode)).size!==centers.length)
      throw new BadRequestException({code:"HEALTH_DUPLICATE",field:"centerCode"});
    const actor=await this.allowed(bearer,"health.providers.manage");
    return this.transact(async client=>{
      await this.identity.assertCurrent(client,actor,"health.providers.manage");
      const payload={provider,centers};
      const cmd=await this.command(client,actor,"PROVIDER_CREATE",input.requestKey,payload);
      if(cmd.replay)return {providerRef:cmd.replay.result_ref,version:cmd.replay.result_version,
        status:"PENDING",replayed:true,message:"Previously saved. Refresh provider details."};
      const row=await client.query<{id:string;version:number}>(
        "INSERT INTO health_provider(root_realm_id,provider_code,legal_name,normalized_name,provider_type,"+
        "contact_name,contact_phone,contact_email,registration_ref,created_by) "+
        "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id,version",
        [actor.realmId,provider.providerCode,provider.legalName,provider.legalName.toLowerCase(),
         provider.providerType,provider.contactName,provider.contactPhone,provider.contactEmail,
         provider.registrationRef,actor.accountId]);
      for(const center of centers)await this.insertCenter(client,actor,row.rows[0].id,center);
      await this.done(client,cmd.commandId,actor,"PROVIDER_CREATE",row.rows[0].id,null,
        row.rows[0].id,1);
      return {providerRef:row.rows[0].id,version:1,status:"PENDING",
        replayed:false,message:"Provider and pending centers saved. Verification has not begun."};
    });
  }
  async list(bearer:string,offset=0,status="ALL",search=""){
    const actor=await this.allowed(bearer,"health.providers.view");
    if(!Number.isInteger(offset)||offset<0||offset>10000||
      !["ALL","PENDING","SUBMITTED","RETURNED","REJECTED","VERIFIED","SUSPENDED"].includes(status)||
      typeof search!=="string"||search.length>80)
      throw new BadRequestException({code:"HEALTH_FIELD_INVALID",field:"search"});
    const rows=await this.db.query<{id:string;provider_code:string;legal_name:string;
      provider_type:string;status:string;version:number;centers:string}>(
      "SELECT p.id,p.provider_code,p.legal_name,p.provider_type,p.status,p.version,"+
      "(SELECT COUNT(*)::text FROM health_center c WHERE c.root_realm_id=p.root_realm_id "+
      "AND c.provider_id=p.id) AS centers "+
      "FROM health_provider p WHERE p.root_realm_id=$1 "+
      "AND ($3::text='ALL' OR p.status=$3) "+
      "AND ($4::text='' OR strpos(p.normalized_name,lower($4))>0 "+
      "OR strpos(lower(p.provider_code),lower($4))>0) "+
      "ORDER BY p.normalized_name,p.id LIMIT 51 OFFSET $2",
      [actor.realmId,offset,status,search.trim()]);
    return {providers:rows.rows.slice(0,50).map(x=>({
      providerRef:x.id,code:x.provider_code,name:x.legal_name,
      type:x.provider_type,status:x.status,version:x.version,centerCount:Number(x.centers)})),
      nextOffset:rows.rows.length>50?offset+50:null};
  }
  async provider(bearer:string,providerRef:string){
    const actor=await this.allowed(bearer,"health.providers.view");
    const ref=uuid(providerRef,"providerRef");
    const r=await this.db.query<{id:string;provider_code:string;legal_name:string;
      provider_type:string;contact_name:string;contact_phone:string;contact_email:string|null;
      registration_ref:string|null;status:string;version:number}>(
      "SELECT id,provider_code,legal_name,provider_type,contact_name,contact_phone,contact_email,"+
      "registration_ref,status,version FROM health_provider WHERE root_realm_id=$1 AND id=$2",
      [actor.realmId,ref]);
    if(!r.rows[0])throw new NotFoundException("Provider draft unavailable");
    const centers=await this.db.query(
      "SELECT id,center_code,display_name,center_type,address_line,state_ref,district_ref,"+
      "block_ref,pin_code,latitude,longitude,time_zone,public_phone,status,version,"+
      "access_state,publication_state,public_slug,publication_generation "+
      "FROM health_center WHERE root_realm_id=$1 AND provider_id=$2 ORDER BY display_name,id LIMIT 100",
      [actor.realmId,ref]);
    return {provider:{providerRef:ref,code:r.rows[0].provider_code,name:r.rows[0].legal_name,
      type:r.rows[0].provider_type,contactName:r.rows[0].contact_name,
      contactPhone:r.rows[0].contact_phone,contactEmail:r.rows[0].contact_email,
      registrationRef:r.rows[0].registration_ref,status:r.rows[0].status,version:r.rows[0].version},
      centers:centers.rows.map(x=>({
        centerRef:x.id,code:x.center_code,name:x.display_name,type:x.center_type,
        addressLine:x.address_line,stateRef:x.state_ref,districtRef:x.district_ref,
        blockRef:x.block_ref,pinCode:x.pin_code,latitude:x.latitude,longitude:x.longitude,
        timeZone:x.time_zone,publicPhone:x.public_phone,status:x.status,version:x.version,
        accessState:x.access_state,publicationState:x.publication_state,
        publicSlug:x.public_slug,publicationGeneration:x.publication_generation
      }))};
  }
  async updateProvider(bearer:string,providerRef:string,body:unknown){
    const input=record(body,"provider");
    only(input,["requestKey","expectedVersion","provider"],"provider");
    const ref=uuid(providerRef,"providerRef"),expected=version(input.expectedVersion);
    const draft=parseProvider(input.provider);
    const actor=await this.allowed(bearer,"health.providers.manage");
    return this.transact(async client=>{
      await this.identity.assertCurrent(client,actor,"health.providers.manage");
      const cmd=await this.command(client,actor,"PROVIDER_UPDATE",input.requestKey,
        {ref,expected,draft});
      if(cmd.replay)return {providerRef:cmd.replay.result_ref,
        version:cmd.replay.result_version,replayed:true,status:"PENDING"};
      const source=await client.query<{version:number}>(
        "SELECT version FROM health_provider WHERE root_realm_id=$1 "+
        "AND id=$2 AND status='PENDING' FOR UPDATE",
        [actor.realmId,ref]);
      if(!source.rows[0])throw new NotFoundException("Pending provider unavailable");
      if(source.rows[0].version!==expected)
        throw new ConflictException({code:"HEALTH_VERSION_CHANGED"});
      await client.query(
        "UPDATE health_provider SET provider_code=$3,legal_name=$4,normalized_name=$5,"+
        "provider_type=$6,contact_name=$7,contact_phone=$8,contact_email=$9,"+
        "registration_ref=$10,version=version+1,updated_at=now() "+
        "WHERE root_realm_id=$1 AND id=$2",
        [actor.realmId,ref,draft.providerCode,draft.legalName,draft.legalName.toLowerCase(),
         draft.providerType,draft.contactName,draft.contactPhone,draft.contactEmail,
         draft.registrationRef]);
      await this.done(client,cmd.commandId,actor,"PROVIDER_UPDATE",ref,null,ref,expected+1);
      return {providerRef:ref,version:expected+1,replayed:false,status:"PENDING",
        message:"Pending provider details saved. Verification has not begun."};
    });
  }
  async centerDraft(bearer:string,centerRef:string,own=false){
    const actor=await this.allowed(bearer,
      own?"health.centers.draft.edit":"health.providers.view");
    const ref=uuid(centerRef,"centerRef");
    const rows=await this.db.query<{
      id:string;provider_id:string;center_code:string;display_name:string;center_type:string;
      address_line:string;state_ref:string;district_ref:string;block_ref:string|null;
      pin_code:string;latitude:string|null;longitude:string|null;time_zone:string;
      public_phone:string|null;version:number;status:string;provider_status:string;
      access_state:string;publication_state:string;public_slug:string|null
    }>(
      "SELECT c.id,c.provider_id,c.center_code,c.display_name,c.center_type,c.address_line,"+
      "c.state_ref,c.district_ref,c.block_ref,c.pin_code,c.latitude,c.longitude,c.time_zone,"+
      "c.public_phone,c.version,c.status,p.status AS provider_status,"+
      "c.access_state,c.publication_state,c.public_slug FROM health_center c "+
      "JOIN health_provider p ON p.root_realm_id=c.root_realm_id AND p.id=c.provider_id "+
      (own?"JOIN health_center_account_affiliation f ON f.root_realm_id=c.root_realm_id "+
        "AND f.center_id=c.id AND f.account_ref=$3 AND f.status IN('PENDING_EDIT','ACTIVE') ":"")+
      "WHERE c.root_realm_id=$1 AND c.id=$2 AND c.status IN('PENDING','SUBMITTED','RETURNED','VERIFIED') AND p.status IN('PENDING','SUBMITTED','RETURNED','VERIFIED') "+
      "LIMIT 1",own?[actor.realmId,ref,actor.accountId]:[actor.realmId,ref]);
    const x=rows.rows[0];
    if(!x)throw new NotFoundException("Pending center is unavailable");
    const hours=await this.db.query<{weekday:number;open_local:string;close_local:string;service_type:string}>(
      "SELECT weekday,open_local::text,close_local::text,service_type "+
      "FROM health_center_hours WHERE root_realm_id=$1 AND center_id=$2 "+
      "ORDER BY weekday,open_local LIMIT 42",[actor.realmId,ref]);
    const capabilities=await this.db.query<{capability_code:string}>(
      "SELECT capability_code FROM health_center_capability "+
      "WHERE root_realm_id=$1 AND center_id=$2 ORDER BY capability_code",[actor.realmId,ref]);
    return {centerRef:x.id,providerRef:x.provider_id,version:x.version,status:x.status,
      providerStatus:x.provider_status,accessState:x.access_state,
      publicationState:x.publication_state,publicSlug:x.public_slug,
      center:{centerCode:x.center_code,displayName:x.display_name,centerType:x.center_type,
        addressLine:x.address_line,stateRef:x.state_ref,districtRef:x.district_ref,
        blockRef:x.block_ref,pinCode:x.pin_code,
        latitude:x.latitude===null?null:Number(x.latitude),
        longitude:x.longitude===null?null:Number(x.longitude),
        timeZone:x.time_zone,publicPhone:x.public_phone,
        hours:hours.rows.map(h=>({weekday:h.weekday,openLocal:h.open_local.slice(0,5),
          closeLocal:h.close_local.slice(0,5),serviceType:h.service_type})),
        capabilities:capabilities.rows.map(s=>s.capability_code)}};
  }
  async createCenter(bearer:string,providerRef:string,body:unknown){
    const input=record(body,"center");
    only(input,["requestKey","expectedVersion","center"],"center");
    const ref=uuid(providerRef,"providerRef"),expected=version(input.expectedVersion);
    const center=parseCenter(input.center);
    const actor=await this.allowed(bearer,"health.providers.manage");
    return this.transact(async client=>{
      await this.identity.assertCurrent(client,actor,"health.providers.manage");
      const cmd=await this.command(client,actor,"CENTER_CREATE",input.requestKey,{ref,expected,center});
      if(cmd.replay)return {centerRef:cmd.replay.result_ref,version:cmd.replay.result_version,
        status:"PENDING",replayed:true};
      const provider=await client.query<{version:number}>(
        "SELECT version FROM health_provider WHERE root_realm_id=$1 AND id=$2 "+
        "AND status IN('PENDING','VERIFIED') FOR UPDATE",
        [actor.realmId,ref]);
      if(!provider.rows[0])throw new NotFoundException("Provider draft unavailable");
      if(provider.rows[0].version!==expected)
        throw new ConflictException({code:"HEALTH_VERSION_CHANGED"});
      const result=await this.insertCenter(client,actor,ref,center);
      await client.query(
        "UPDATE health_provider SET version=version+1,updated_at=now() "+
        "WHERE root_realm_id=$1 AND id=$2",[actor.realmId,ref]);
      await this.done(client,cmd.commandId,actor,"CENTER_CREATE",ref,result.id,result.id,result.version);
      return {centerRef:result.id,version:result.version,status:"PENDING",replayed:false};
    });
  }
  private async canEdit(client:PoolClient,actor:Actor,centerRef:string,admin:boolean){
    const center=await client.query<{id:string;provider_id:string;status:string;version:number}>(
      "SELECT id,provider_id,status,version FROM health_center "+
      "WHERE root_realm_id=$1 AND id=$2 FOR UPDATE",[actor.realmId,centerRef]);
    if(!center.rows[0]||center.rows[0].status!=="PENDING")
      throw new NotFoundException("Pending center unavailable");
    if(!admin){
      const assigned=await client.query<{id:string}>(
        "SELECT f.id FROM health_center_account_affiliation f "+
        "JOIN account a ON a.id=f.account_ref AND a.realm_id=f.root_realm_id "+
        "AND a.status='ACTIVE' "+
        "WHERE f.root_realm_id=$1 AND f.center_id=$2 AND f.account_ref=$3 "+
        "AND f.status='PENDING_EDIT' FOR SHARE OF f,a",
        [actor.realmId,centerRef,actor.accountId]);
      if(!assigned.rows[0])throw new ForbiddenException("This center is not assigned to you");
    }
    return center.rows[0];
  }
  async updateCenter(bearer:string,centerRef:string,body:unknown,own=false){
    const input=record(body,"center");
    only(input,["requestKey","expectedVersion","center"],"center");
    const ref=uuid(centerRef,"centerRef"),expected=version(input.expectedVersion);
    const draft=parseCenter(input.center);
    const capability=own?"health.centers.draft.edit":"health.providers.manage";
    const actor=await this.allowed(bearer,capability);
    return this.transact(async client=>{
      await this.identity.assertCurrent(client,actor,capability);
      const cmd=await this.command(client,actor,"CENTER_UPDATE",input.requestKey,
        {ref,expected,draft});
      if(cmd.replay)return {centerRef:cmd.replay.result_ref,version:cmd.replay.result_version,
        status:"PENDING",replayed:true};
      const original=await this.canEdit(client,actor,ref,!own);
      if(original.version!==expected)throw new ConflictException({code:"HEALTH_VERSION_CHANGED"});
      if(own){
        const old=await client.query<{center_code:string;center_type:string;state_ref:string;
          district_ref:string;block_ref:string|null}>(
          "SELECT center_code,center_type,state_ref,district_ref,block_ref "+
          "FROM health_center WHERE root_realm_id=$1 AND id=$2",
          [actor.realmId,ref]);
        if(!old.rows[0]||old.rows[0].center_code!==draft.centerCode||
          old.rows[0].center_type!==draft.centerType||
          old.rows[0].state_ref!==draft.stateRef||
          old.rows[0].district_ref!==draft.districtRef||
          old.rows[0].block_ref!==draft.blockRef)
          throw new ForbiddenException("Foundation must approve changes to registered center identity or location");
      }
      await this.validGeo(client,actor,draft);
      await client.query(
        "UPDATE health_center SET center_code=$3,display_name=$4,center_type=$5,address_line=$6,"+
        "state_ref=$7,district_ref=$8,block_ref=$9,pin_code=$10,latitude=$11,longitude=$12,"+
        "time_zone=$13,public_phone=$14,version=version+1,updated_at=now() "+
        "WHERE root_realm_id=$1 AND id=$2",
        [actor.realmId,ref,draft.centerCode,draft.displayName,draft.centerType,
         draft.addressLine,draft.stateRef,draft.districtRef,draft.blockRef,draft.pinCode,
         draft.latitude,draft.longitude,draft.timeZone,draft.publicPhone]);
      await this.replaceDetails(client,actor,ref,draft);
      await this.done(client,cmd.commandId,actor,"CENTER_UPDATE",
        original.provider_id,ref,ref,expected+1);
      return {centerRef:ref,version:expected+1,status:"PENDING",replayed:false,
        message:"Pending center draft saved. It has not been approved."};
    });
  }
  async myCenters(bearer:string){
    const actor=await this.allowed(bearer,"health.centers.draft.edit");
    const r=await this.db.query<{id:string;display_name:string;provider_id:string;
      legal_name:string;version:number;status:string}>(
      "SELECT c.id,c.display_name,c.provider_id,p.legal_name,c.version,c.status "+
      "FROM health_center_account_affiliation f "+
      "JOIN health_center c ON c.root_realm_id=f.root_realm_id AND c.id=f.center_id "+
      "JOIN health_provider p ON p.root_realm_id=c.root_realm_id AND p.id=c.provider_id "+
      "WHERE f.root_realm_id=$1 AND f.account_ref=$2 AND f.status IN('PENDING_EDIT','ACTIVE') "+
      "AND c.status IN('PENDING','SUBMITTED','RETURNED','VERIFIED') AND p.status IN('PENDING','SUBMITTED','RETURNED','VERIFIED') "+
      "ORDER BY c.display_name,c.id LIMIT 50",[actor.realmId,actor.accountId]);
    return {centers:r.rows.map(x=>({centerRef:x.id,name:x.display_name,
      providerName:x.legal_name,version:x.version,status:x.status}))};
  }
  async myCenter(bearer:string,centerRef:string){
    const actor=await this.allowed(bearer,"health.centers.draft.edit");
    const ref=uuid(centerRef,"centerRef");
    const rows=await this.db.query(
      "SELECT c.id,c.center_code,c.display_name,c.center_type,c.address_line,"+
      "c.state_ref,c.district_ref,c.block_ref,c.pin_code,c.latitude,c.longitude,"+
      "c.time_zone,c.public_phone,c.version,c.status "+
      "FROM health_center c "+
      "JOIN health_center_account_affiliation f "+
      "ON f.root_realm_id=c.root_realm_id AND f.center_id=c.id AND f.status IN('PENDING_EDIT','ACTIVE') "+
      "JOIN health_provider p ON p.root_realm_id=c.root_realm_id AND p.id=c.provider_id "+
      "WHERE c.root_realm_id=$1 AND c.id=$2 AND c.status IN('PENDING','VERIFIED') AND p.status IN('PENDING','VERIFIED') "+
      "AND f.account_ref=$3 LIMIT 1",[actor.realmId,ref,actor.accountId]);
    if(!rows.rows[0])throw new NotFoundException("This pending center is not assigned to you");
    const [hours,capabilities]=await Promise.all([
      this.db.query("SELECT weekday,open_local::text AS open_local,close_local::text AS close_local,"+
        "service_type FROM health_center_hours WHERE root_realm_id=$1 AND center_id=$2 "+
        "ORDER BY weekday,open_local LIMIT 42",[actor.realmId,ref]),
      this.db.query("SELECT capability_code FROM health_center_capability "+
        "WHERE root_realm_id=$1 AND center_id=$2 ORDER BY capability_code",
        [actor.realmId,ref])
    ]);
    return {center:rows.rows[0],hours:hours.rows,capabilities:capabilities.rows.map(x=>x.capability_code)};
  }
  async affiliate(bearer:string,centerRef:string,body:unknown){
    const input=record(body,"representative");
    only(input,["requestKey","accountRef"],"representative");
    const ref=uuid(centerRef,"centerRef"),accountRef=uuid(input.accountRef,"accountRef");
    const actor=await this.allowed(bearer,"health.providers.manage");
    return this.transact(async client=>{
      await this.identity.assertCurrent(client,actor,"health.providers.manage");
      const cmd=await this.command(client,actor,"CENTER_AFFILIATE",input.requestKey,{ref,accountRef});
      if(cmd.replay)return {affiliationRef:cmd.replay.result_ref,status:"PENDING_EDIT",replayed:true};
      const centerResult=await client.query<{provider_id:string;status:string;access_state:string}>(
        "SELECT c.provider_id,c.status,c.access_state FROM health_center c "+
        "JOIN health_provider p ON p.root_realm_id=c.root_realm_id AND p.id=c.provider_id "+
        "WHERE c.root_realm_id=$1 AND c.id=$2 "+
        "AND ((c.status='PENDING' AND p.status IN('PENDING','VERIFIED')) "+
        "OR (c.status='VERIFIED' AND p.status='VERIFIED')) FOR UPDATE OF c",
        [actor.realmId,ref]);
      const center=centerResult.rows[0];
      if(!center)throw new NotFoundException("Center unavailable for representative assignment");
      await this.representativeIdentity.eligibleRepresentative(client,actor,accountRef);
      const state=center.status==="VERIFIED"&&center.access_state==="ENABLED"?
        "ACTIVE":"PENDING_EDIT";
      const inserted=await client.query<{id:string;revision:number}>(
        "INSERT INTO health_center_account_affiliation(root_realm_id,center_id,account_ref,assigned_by,status) "+
        "VALUES($1,$2,$3,$4,$5) "+
        "ON CONFLICT(root_realm_id,center_id,account_ref) WHERE status IN('PENDING_EDIT','ACTIVE') "+
        "DO NOTHING RETURNING id,revision",
        [actor.realmId,ref,accountRef,actor.accountId,state]);
      if(!inserted.rows[0])throw new ConflictException({code:"HEALTH_REPRESENTATIVE_EXISTS"});
      await this.done(client,cmd.commandId,actor,"CENTER_AFFILIATE",
        center.provider_id,ref,inserted.rows[0].id,inserted.rows[0].revision);
      return {affiliationRef:inserted.rows[0].id,status:state,replayed:false,
        message:state==="ACTIVE"?
          "Representative assigned to this active center only.":
          "Representative assigned to this center pending Foundation activation."};
    });
  }
  async financeReference(bearer:string,providerRef:string){
    const actor=await this.allowed(bearer,"health.providers.finance.view");
    const ref=uuid(providerRef,"providerRef");
    const found=await this.db.query<{masked_label:string;protected_file_ref:string;version:number;file_ok:boolean}>(
      "SELECT f.masked_label,f.protected_file_ref,f.version, "+
      "EXISTS(SELECT 1 FROM cg19_stored_file file JOIN cg19_upload_intent intent "+
      "ON intent.id=file.upload_intent_id AND intent.realm_id=file.realm_id "+
      "WHERE file.id=f.protected_file_ref AND file.realm_id=f.root_realm_id "+
      "AND file.health_provider_id=f.provider_id "+
      "AND file.owner_kind='CG14_DRAFT' AND file.revoked_at IS NULL "+
      "AND file.scan_status='CLEAN_VERIFIED' AND intent.status='VALIDATED' "+
      "AND intent.classification='HEALTH_BANK_PROOF') AS file_ok "+
      "FROM health_provider_finance_ref f JOIN health_provider p "+
      "ON p.root_realm_id=f.root_realm_id AND p.id=f.provider_id "+
      "WHERE f.root_realm_id=$1 AND f.provider_id=$2 AND p.status='PENDING'",
      [actor.realmId,ref]);
    return {reference:found.rows[0]&&found.rows[0].file_ok?{
      maskedLabel:found.rows[0].masked_label,fileRef:found.rows[0].protected_file_ref,version:found.rows[0].version
    }:null};
  }
  async saveFinanceReference(bearer:string,providerRef:string,body:unknown){
    const input=record(body,"finance");
    only(input,["requestKey","expectedVersion","fileRef","maskedLabel"],"finance");
    const ref=uuid(providerRef,"providerRef");
    const file=uuid(input.fileRef,"fileRef"),expected=version(input.expectedVersion,true);
    const masked=str(input.maskedLabel,"maskedLabel",4,60);
    // No raw destination number, UPI ID, IFSC or unmasked sensitive data
    // is accepted: only a visible redacted label + verified CG-19 private file.
    if(!/^(?:[*•xX]{4,}|[A-Za-z ]{1,24}[*•xX]{4,})[0-9]{4}$/.test(masked))
      throw new BadRequestException({code:"HEALTH_FINANCE_MASK_INVALID",field:"maskedLabel"});
    const actor=await this.allowed(bearer,"health.providers.finance.manage");
    return this.transact(async client=>{
      await this.identity.assertCurrent(client,actor,"health.providers.finance.manage");
      const cmd=await this.command(client,actor,"FINANCE_REF_SAVE",input.requestKey,
        {ref,file,masked,expected});
      if(cmd.replay)return {status:"CONFIRMED",version:cmd.replay.result_version,
        replayed:true,message:"Previously saved. Refresh the masked reference."};
      // Serialize first-set and subsequent CAS updates even before a finance row exists.
      const source=await client.query<{version:number}>(
        "SELECT version FROM health_provider WHERE root_realm_id=$1 AND id=$2 "+
        "AND status='PENDING' FOR UPDATE",[actor.realmId,ref]);
      if(!source.rows[0])throw new NotFoundException("Pending provider unavailable");
      const proof=await this.evidence.prove(client,actor,ref,null,file,"HEALTH_BANK_PROOF");
      if(proof.health_source_version!==source.rows[0].version)
        throw new ConflictException({code:"HEALTH_EVIDENCE_SOURCE_CHANGED"});
      const prior=await client.query<{version:number}>(
        "SELECT version FROM health_provider_finance_ref "+
        "WHERE root_realm_id=$1 AND provider_id=$2 FOR UPDATE",[actor.realmId,ref]);
      if((prior.rows[0]?.version??0)!==expected)
        throw new ConflictException({code:"HEALTH_VERSION_CHANGED",field:"expectedVersion"});
      const next=expected+1;
      await client.query(
        "INSERT INTO health_provider_finance_ref(root_realm_id,provider_id,"+
        "protected_file_ref,masked_label,version,updated_by) "+
        "VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(root_realm_id,provider_id) "+
        "DO UPDATE SET protected_file_ref=EXCLUDED.protected_file_ref,"+
        "masked_label=EXCLUDED.masked_label,version=EXCLUDED.version,"+
        "updated_by=EXCLUDED.updated_by,updated_at=now()",
        [actor.realmId,ref,file,masked,next,actor.accountId]);
      await this.done(client,cmd.commandId,actor,"FINANCE_REF_SAVE",ref,null,ref,next);
      return {status:"CONFIRMED",version:next,replayed:false,
        message:"The protected settlement reference was saved."};
    });
  }
  async centerRepresentatives(bearer:string,centerRef:string){
    const actor=await this.allowed(bearer,"health.providers.view");
    const ref=uuid(centerRef,"centerRef");
    return this.transact(async client=>{
      await this.identity.assertCurrent(client,actor,"health.providers.view");
      const center=await client.query<{id:string}>(
        "SELECT c.id FROM health_center c JOIN health_provider p "+
        "ON p.root_realm_id=c.root_realm_id AND p.id=c.provider_id "+
        "WHERE c.root_realm_id=$1 AND c.id=$2 "+
        "AND c.status IN('PENDING','VERIFIED','SUSPENDED') FOR SHARE OF c,p",
        [actor.realmId,ref]);
      if(!center.rows[0])throw new NotFoundException("Pending center unavailable");
      const reps=await client.query<{id:string;account_ref:string;status:string;revision:number}>(
        "SELECT id,account_ref,status,revision FROM health_center_account_affiliation "+
        "WHERE root_realm_id=$1 AND center_id=$2 ORDER BY created_at DESC,id DESC LIMIT 50",
        [actor.realmId,ref]);
      const labels=await this.identity.accountLabels(client,actor,reps.rows.map(x=>x.account_ref));
      return {representatives:reps.rows.map(x=>({affiliationRef:x.id,
        name:labels[x.account_ref]??"Former staff member",status:x.status,
        version:x.revision}))};
    });
  }
  async revokeRepresentative(bearer:string,centerRef:string,
    affiliationRef:string,body:unknown){
    const input=record(body,"representative");
    only(input,["requestKey","expectedVersion"],"representative");
    const ref=uuid(centerRef,"centerRef"),
      assignment=uuid(affiliationRef,"affiliationRef"),
      expected=version(input.expectedVersion);
    const actor=await this.allowed(bearer,"health.providers.manage");
    return this.transact(async client=>{
      await this.identity.assertCurrent(client,actor,"health.providers.manage");
      const cmd=await this.command(client,actor,"CENTER_REVOKE",input.requestKey,
        {ref,assignment,expected});
      if(cmd.replay)return {status:"REVOKED",version:cmd.replay.result_version,replayed:true};
      const centerResult=await client.query<{provider_id:string}>(
        "SELECT provider_id FROM health_center WHERE root_realm_id=$1 AND id=$2 "+
        "AND status IN('PENDING','VERIFIED') FOR SHARE",[actor.realmId,ref]);
      const center=centerResult.rows[0];
      if(!center)throw new NotFoundException("Center representative unavailable");
      const row=await client.query<{id:string;revision:number;status:string}>(
        "SELECT id,revision,status FROM health_center_account_affiliation "+
        "WHERE id=$1 AND root_realm_id=$2 AND center_id=$3 FOR UPDATE",
        [assignment,actor.realmId,ref]);
      if(!row.rows[0])throw new NotFoundException("Center representative unavailable");
      if(row.rows[0].revision!==expected)
        throw new ConflictException({code:"HEALTH_VERSION_CHANGED"});
      if(row.rows[0].status==="REVOKED")
        throw new ConflictException({code:"HEALTH_REPRESENTATIVE_REVOKED"});
      await client.query(
        "UPDATE health_center_account_affiliation SET status='REVOKED',revoked_at=now(),"+
        "revision=revision+1 WHERE id=$1 AND root_realm_id=$2",
        [assignment,actor.realmId]);
      await this.done(client,cmd.commandId,actor,"CENTER_REVOKE",
        center.provider_id,ref,assignment,expected+1);
      return {status:"REVOKED",version:expected+1,replayed:false,
        message:"The representative can no longer access this healthcare center."};
    });
  }
  async representativeOptions(bearer:string,search?:string){
    return this.representativeIdentity.eligibleRepresentativeOptions(bearer,search??"");
  }
  async geo(bearer:string,level:string,parentRef?:string){
    if(!["STATE","DISTRICT","SUBDIVISION","BLOCK"].includes(level))
      throw new BadRequestException({code:"HEALTH_FIELD_INVALID",field:"level"});
    // An affiliated representative needs limited geography names for their
    // center draft, without CG-02 private Foundation branch information.
    let actor:Actor;
    try{actor=await this.allowed(bearer,"health.providers.view");}
    catch(e){
      if(!(e instanceof ForbiddenException))throw e;
      actor=await this.allowed(bearer,"health.centers.draft.edit");
    }
    const rows=await this.db.query<{id:string;display_name:string;level:string}>(
      "SELECT area.id,area.display_name,area.level FROM geography_area area "+
      "WHERE area.root_realm_id=$1 AND area.status='ACTIVE' AND area.level=$2 AND "+
      "($3::uuid IS NULL OR area.parent_area_id=$3 OR "+
      "(area.level='BLOCK' AND EXISTS(SELECT 1 FROM geography_area parent "+
      "WHERE parent.id=area.parent_area_id AND parent.root_realm_id=area.root_realm_id "+
      "AND parent.level='SUBDIVISION' AND parent.status='ACTIVE' "+
      "AND parent.parent_area_id=$3))) "+
      "ORDER BY area.display_name,area.id LIMIT 100",
      [actor.realmId,level,parentRef?uuid(parentRef,"parentRef"):null]);
    return {options:rows.rows.map(x=>({value:x.id,label:x.display_name,level:x.level}))};
  }
}
