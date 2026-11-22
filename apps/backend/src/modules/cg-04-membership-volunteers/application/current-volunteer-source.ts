import {ForbiddenException} from "@nestjs/common";
import type {PoolClient} from "pg";

/** Single CG04 current-source predicate, implemented in migration 3218.
 * Trusted, fixed SQL alias expressions only; no string interpolation of user inputs.
 * No CG01 role is ever granted by volunteer activation. */
export const currentVolunteerPredicate=(v:string,account:string,branch:string)=>
 `cg04_current_volunteer(${v}.root_realm_id,${v}.id,${account},${branch})`;

export type CurrentVolunteer={id:string;account_ref:string;branch_ref:string|null;volunteer_no:string;display_name:string};
export async function requireCurrentVolunteer(tx:PoolClient,realm:string,ref:string,branch:string|null,
 account?:string):Promise<CurrentVolunteer>{
 const result=await tx.query<CurrentVolunteer>(`SELECT v.id,v.account_ref,v.branch_ref,v.volunteer_no,v.display_name
 FROM volunteer v WHERE v.root_realm_id=$1 AND v.id=$2
 AND cg04_current_volunteer(v.root_realm_id,v.id,v.account_ref,$3::uuid)
 AND ($4::uuid IS NULL OR v.account_ref=$4) FOR SHARE OF v`,[realm,ref,branch,account??null]);
 if(result.rows.length!==1)throw new ForbiddenException("Choose an active, independently approved volunteer for the current project branch.");
 return result.rows[0];
}
