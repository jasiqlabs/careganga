import type {Pool,PoolClient} from "pg";
export const beneficiaryImpactSource="CG06 verified beneficiary impact";
export async function beneficiaryImpactFields(db:Pool|PoolClient,root:string,year:string){
 if(!/^\d{4}$/.test(year)||Number(year)<1900||Number(year)>=new Date().getUTCFullYear())return null;
 const q=await db.query<{n:number}>("SELECT count(DISTINCT b.id)::int AS n FROM assistance_delivery_event d JOIN assistance_case a ON a.root_realm_id=d.root_realm_id AND a.id=d.assistance_id JOIN beneficiary b ON b.root_realm_id=a.root_realm_id AND b.id=a.beneficiary_id AND b.branch_scope_id IS NOT DISTINCT FROM a.branch_ref WHERE d.root_realm_id=$1 AND b.consent_revoked_at IS NULL AND b.lifecycle_state='ACTIVE' AND d.action IN('DELIVERED','PAID') AND d.at>=($2::date::timestamp AT TIME ZONE 'Asia/Kolkata') AND d.at<(($3::date+1)::timestamp AT TIME ZONE 'Asia/Kolkata')",[root,year+"-01-01",year+"-12-31"]);
 const count=Math.floor(q.rows[0].n/10)*10;
 return {group:"STATS",heading:"Beneficiary impact",intro:count>=10?"Approved aggregate, rounded down to tens.":"Verified beneficiary impact is currently unavailable.",source:beneficiaryImpactSource,asOfDate:year+"-12-31",items:count>=10?[{title:"Beneficiaries supported",value:count,description:"Foundation-wide, rounded down to tens",unit:"people"}]:[]};
}
export async function approvedBeneficiaryImpact(db:Pool|PoolClient,root:string,fields:Record<string,unknown>){
 const year=typeof fields.asOfDate==="string"?fields.asOfDate.slice(0,4):"";
 const current=await beneficiaryImpactFields(db,root,year);
 const item=Array.isArray(fields.items)&&fields.items.length===1?fields.items[0] as Record<string,unknown>:null;
 const count=current?.items[0]?.value;
 const valid=fields.group==="STATS"&&fields.asOfDate===current?.asOfDate&&item?.title==="Beneficiaries supported"&&count!==undefined&&count===item?.value;
 return {valid,fields:valid?current:{group:"STATS",heading:"Beneficiary impact",intro:"Verified beneficiary impact is currently unavailable.",source:beneficiaryImpactSource,asOfDate:current?.asOfDate??"",items:[]}};
}
