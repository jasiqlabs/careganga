import {Storage} from "@google-cloud/storage";
import {createPrivateKey} from "node:crypto";
import {ServiceUnavailableException} from "@nestjs/common";
import {ClamAvScanner} from "./clamav-scanner";
import {ObjectBytes,UploadInput,VerifiedPrivateStorage} from "./verified-private-storage";
import {PrivateUploadReservation} from "./private-object-storage";

export type FirebaseStorageCredentials={client_email:string;private_key:string};
export type FirebaseStorageConfig={projectId?:string;credentials?:FirebaseStorageCredentials};

/** Backend-only configuration. Null means explicit configuration is invalid.
 * Empty credential placeholders preserve Application Default Credentials.
 */
export function resolveFirebaseStorageConfig(env:NodeJS.ProcessEnv):FirebaseStorageConfig|null{
  const legacyProject=env.CG19_FIREBASE_PROJECT_ID?.trim()||undefined;
  const firebaseProject=env.FIREBASE_PROJECT_ID?.trim()||undefined;
  const clientEmail=env.FIREBASE_CLIENT_EMAIL?.trim()??"";
  const privateKey=(env.FIREBASE_PRIVATE_KEY?.trim()??"").replace(/\\r\\n|\\n|\r\n/g,"\n");
  const explicit=Boolean(clientEmail||privateKey);
  const projectId=explicit?firebaseProject||legacyProject:legacyProject||firebaseProject;
  if(projectId&&!/^[a-z][a-z0-9-]{2,60}$/.test(projectId))return null;
  if(!explicit)return projectId?{projectId}:{};
  if(!projectId||!clientEmail||!privateKey||
    (legacyProject&&firebaseProject&&legacyProject!==firebaseProject)||
    !/^[^\s@]+@[^\s@]+\.iam\.gserviceaccount\.com$/.test(clientEmail)||
    !privateKey.startsWith("-----BEGIN PRIVATE KEY-----\n")||
    !privateKey.endsWith("\n-----END PRIVATE KEY-----"))return null;
  try{
    if(createPrivateKey(privateKey).asymmetricKeyType!=="rsa")return null;
  }catch{return null;}
  return {projectId,credentials:{client_email:clientEmail,private_key:privateKey+"\n"}};
}

/** Firebase Storage is backed by a Google Cloud Storage bucket.
 * Uses server-side explicit credentials or Application Default Credentials / workload identity;
 * NEVER Firebase client SDK download tokens or world-readable rules.
 *
 * Set CG19_FIREBASE_BUCKET to the client's exact Firebase bucket name
 * (including its .firebasestorage.app suffix when applicable).
 */
export class FirebasePrivateStorage extends VerifiedPrivateStorage{
  private readonly storage:Storage;
  constructor(
    private readonly bucketName:string,scanner:ClamAvScanner,
    projectId?:string,credentials?:FirebaseStorageCredentials
  ){
    super(scanner);
    this.storage=new Storage(credentials?{projectId,credentials}:projectId?{projectId}:{});
  }
  private bucket(){return this.storage.bucket(this.bucketName);}

  protected async signUpload(input:UploadInput):Promise<PrivateUploadReservation>{
    // A single-use immutable object key cannot be overwritten with a
    // subsequent signed URL. Google validates the signed precondition header.
    const headers={"Content-Type":input.mime,"x-goog-if-generation-match":"0"};
    const [url]=await this.bucket().file(input.objectKey).getSignedUrl({
      version:"v4",action:"write",expires:new Date(input.expiresAt),
      contentType:input.mime,
      extensionHeaders:{"x-goog-if-generation-match":"0"}
    });
    if(!url.startsWith("https://storage.googleapis.com/"))
      throw new ServiceUnavailableException("Firebase private upload cannot be signed");
    return {url,expiresAt:input.expiresAt,
      reservationRef:"firebase:"+input.requestKey,headers};
  }
  private async load(objectKey:string,generation:string|undefined,maxBytes:number){
    if(generation!==undefined&&!/^[0-9]{1,30}$/.test(generation))
      throw new ServiceUnavailableException("Invalid Firebase object generation");
    const ref=this.bucket().file(objectKey,generation?{generation}:{});
    const [metadata]=await ref.getMetadata();
    const actualGeneration=String(metadata.generation??"");
    const size=Number(metadata.size);
    const mime=String(metadata.contentType??"");
    if(!/^[0-9]{1,30}$/.test(actualGeneration)||
      !Number.isSafeInteger(size)||size<1||size>maxBytes)
      throw new ServiceUnavailableException("Firebase object size or version is unverified");
    // Pin this specific generation before downloading; never accept an
    // overwritten latest object after metadata was read.
    const pinned=this.bucket().file(objectKey,{generation:actualGeneration});
    const [bytes]=await pinned.download();
    if(!Buffer.isBuffer(bytes)||bytes.length!==size)
      throw new ServiceUnavailableException("Firebase object data did not match its metadata");
    return {bytes,objectVersion:"gcs:"+actualGeneration,mime} as ObjectBytes;
  }
  protected loadLatest(objectKey:string,maxBytes:number){
    return this.load(objectKey,undefined,maxBytes);
  }
  protected loadVersion(objectKey:string,version:string,maxBytes:number){
    if(!/^gcs:[0-9]{1,30}$/.test(version))
      throw new ServiceUnavailableException("Invalid Firebase object version");
    return this.load(objectKey,version.slice(4),maxBytes);
  }
  protected async saveNewPdf(objectKey:string,bytes:Buffer){
    const file=this.bucket().file(objectKey);
    await file.save(bytes,{
      resumable:false,validation:"crc32c",
      preconditionOpts:{ifGenerationMatch:0},
      metadata:{contentType:"application/pdf",cacheControl:"private, no-store"}
    });
    const [metadata]=await file.getMetadata();
    const generation=String(metadata.generation??"");
    if(!/^[0-9]{1,30}$/.test(generation))
      throw new ServiceUnavailableException("Firebase PDF generation not verified");
    return {objectVersion:"gcs:"+generation};
  }
  protected async saveNewGeneratedReport(key:string,bytes:Buffer,mime:string){
    const file=this.bucket().file(key);
    await file.save(bytes,{resumable:false,validation:"crc32c",
      preconditionOpts:{ifGenerationMatch:0},
      metadata:{contentType:mime,cacheControl:"private, no-store"}});
    const [metadata]=await file.getMetadata();
    const generation=String(metadata.generation??"");
    if(!/^[0-9]{1,30}$/.test(generation))
      throw new ServiceUnavailableException("Generated private report object is unverified");
    return {objectVersion:"gcs:"+generation};
  }

}
