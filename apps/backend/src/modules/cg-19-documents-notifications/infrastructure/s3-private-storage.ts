import {
  S3Client,PutObjectCommand,GetObjectCommand,HeadObjectCommand,
  GetBucketVersioningCommand
} from "@aws-sdk/client-s3";
import {getSignedUrl} from "@aws-sdk/s3-request-presigner";
import {ServiceUnavailableException} from "@nestjs/common";
import {ClamAvScanner} from "./clamav-scanner";
import {ObjectBytes,UploadInput,VerifiedPrivateStorage,digest} from "./verified-private-storage";
import {PrivateUploadReservation} from "./private-object-storage";

/** AWS S3 only, versioning required. Credentials come from the standard
 * server-side AWS credential chain. No bucket ACL/public GET or client keys.
 */
export class S3PrivateStorage extends VerifiedPrivateStorage{
  private readonly client:S3Client;
  private versioningVerifiedAt=0;
  constructor(
    private readonly bucket:string,region:string,scanner:ClamAvScanner
  ){
    super(scanner);
    this.client=new S3Client({region});
  }
  private async requireVersioning(){
    if(this.versioningVerifiedAt>Date.now()-5*60*1000)return;
    const state=await this.client.send(new GetBucketVersioningCommand({Bucket:this.bucket}));
    if(state.Status!=="Enabled")
      throw new ServiceUnavailableException("S3 bucket versioning must be enabled");
    this.versioningVerifiedAt=Date.now();
  }
  protected async signUpload(input:UploadInput):Promise<PrivateUploadReservation>{
    await this.requireVersioning();
    const checksum=Buffer.from(input.sha256,"hex").toString("base64");
    const expiresIn=Math.min(900,Math.floor((Date.parse(input.expiresAt)-Date.now())/1000));
    if(expiresIn<1)throw new ServiceUnavailableException("Private upload permission expired");
    const command=new PutObjectCommand({
      Bucket:this.bucket,Key:input.objectKey,ContentType:input.mime,
      ContentLength:input.sizeBytes,ChecksumSHA256:checksum,IfNoneMatch:"*"
    });
    const url=await getSignedUrl(this.client,command,{expiresIn});
    if(!url.startsWith("https://"))
      throw new ServiceUnavailableException("S3 private upload could not be signed");
    return {url,expiresAt:input.expiresAt,
      reservationRef:"s3:"+input.requestKey,
      headers:{"Content-Type":input.mime,
        "x-amz-checksum-sha256":checksum,"If-None-Match":"*"}};
  }
  private async load(objectKey:string,version:string|undefined,maxBytes:number){
    await this.requireVersioning();
    const head=await this.client.send(new HeadObjectCommand({
      Bucket:this.bucket,Key:objectKey,...(version?{VersionId:version}:{})
    }));
    const versionId=head.VersionId;
    if(typeof versionId!=="string"||!versionId||versionId==="null"||
      (version!==undefined&&version!==versionId)||
      !Number.isSafeInteger(head.ContentLength)||!head.ContentLength||
      head.ContentLength<1||head.ContentLength>maxBytes)
      throw new ServiceUnavailableException("S3 file size or version could not be verified");
    const reply=await this.client.send(new GetObjectCommand({
      Bucket:this.bucket,Key:objectKey,VersionId:versionId
    }));
    if(reply.VersionId!==versionId||!reply.Body)
      throw new ServiceUnavailableException("The stored S3 version changed");
    const bytes=Buffer.from(await reply.Body.transformToByteArray());
    if(bytes.length!==head.ContentLength||bytes.length>maxBytes)
      throw new ServiceUnavailableException("S3 bytes did not match object metadata");
    return {bytes,mime:String(head.ContentType??""),
      objectVersion:"s3:"+versionId} as ObjectBytes;
  }
  protected loadLatest(key:string,maxBytes:number){
    return this.load(key,undefined,maxBytes);
  }
  protected loadVersion(key:string,version:string,maxBytes:number){
    if(!version.startsWith("s3:")||version.length>160)
      throw new ServiceUnavailableException("Invalid S3 private object version");
    return this.load(key,version.slice(3),maxBytes);
  }
  protected async saveNewPdf(key:string,bytes:Buffer){
    await this.requireVersioning();
    const response=await this.client.send(new PutObjectCommand({
      Bucket:this.bucket,Key:key,Body:bytes,ContentLength:bytes.length,
      ContentType:"application/pdf",ChecksumSHA256:Buffer.from(digest(bytes),"hex").toString("base64"),
      IfNoneMatch:"*"
    }));
    const versionId=response.VersionId;
    if(!versionId||versionId==="null"||versionId.length>150)
      throw new ServiceUnavailableException("PDF S3 object version is unverified");
    return {objectVersion:"s3:"+versionId};
  }
  protected async saveNewGeneratedReport(key:string,bytes:Buffer,mime:string){
    await this.requireVersioning();
    const response=await this.client.send(new PutObjectCommand({
      Bucket:this.bucket,Key:key,Body:bytes,ContentLength:bytes.length,
      ContentType:mime,ChecksumSHA256:Buffer.from(digest(bytes),"hex").toString("base64"),
      IfNoneMatch:"*"
    }));
    const version=response.VersionId;
    if(!version||version==="null"||version.length>150)
      throw new ServiceUnavailableException("Generated private report object is not versioned");
    return {objectVersion:"s3:"+version};
  }

}
