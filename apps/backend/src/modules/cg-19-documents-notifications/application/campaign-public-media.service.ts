import {ConflictException,Inject,Injectable,NotFoundException} from "@nestjs/common";
import {createHash} from "node:crypto";
import {Pool} from "pg";
import {DATABASE} from "../../../core/infrastructure/database.module";
import {publicCampaignMedia} from "../../cg-07-campaigns-donations/application/campaign-public-source";
import {PrivateObjectStorage} from "../infrastructure/private-object-storage";

/** Read original CG19 private bytes only through a CURRENT separately
 * published CG18 campaign placement. No CDN, public bucket or stale redirect.
 */
@Injectable()
export class CampaignPublicMediaService{
 constructor(@Inject(DATABASE)private readonly db:Pool,private readonly storage:PrivateObjectStorage){}
 async current(ref:string){
  const first=await publicCampaignMedia(this.db,ref);
  if(!first)throw new NotFoundException("Public campaign photograph is no longer available.");
  const maxBytes=5*1024*1024;
  if(!["image/jpeg","image/png","image/webp"].includes(first.original_mime)||
    Number(first.verified_size_bytes)<1||Number(first.verified_size_bytes)>maxBytes)
   throw new NotFoundException("Campaign photograph cannot be displayed.");
  const bytes=await this.storage.readVerifiedPrivateObject({
   objectKey:first.object_key,objectVersion:first.object_version,maxBytes});
  if(bytes.length!==Number(first.verified_size_bytes)||
    createHash("sha256").update(bytes).digest("hex")!==first.verified_sha256)
   throw new ConflictException("The original campaign image changed.");
  // Recheck current CG03 approval, CG18 publication, CG19 revocation and exact
  // object version after fetching bytes, before returning any public content.
  const current=await publicCampaignMedia(this.db,ref);
  if(!current||current.object_version!==first.object_version||
    current.verified_sha256!==first.verified_sha256)
   throw new NotFoundException("Public campaign photograph was withdrawn.");
  return {bytes,mime:first.original_mime};
 }
}
