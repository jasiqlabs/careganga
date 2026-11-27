import {PrivateObjectStorage,UnconfiguredPrivateObjectStorage} from "./private-object-storage";
import {ClamAvScanner} from "./clamav-scanner";
import {FirebasePrivateStorage,resolveFirebaseStorageConfig} from "./firebase-private-storage";
import {S3PrivateStorage} from "./s3-private-storage";

/** One provider per client deployment. No browser-supplied provider name,
 * Firebase token, AWS key, Google service-account JSON or bucket URL is trusted.
 * A missing malware scanner means no production storage provider is activated.
 */
export function makePrivateStorageProvider():PrivateObjectStorage{
  const disabled=()=>new UnconfiguredPrivateObjectStorage();
  const provider=process.env.CG19_STORAGE_PROVIDER?.trim().toUpperCase();
  if(provider!=="FIREBASE"&&provider!=="S3")return disabled();
  const scanHost=process.env.CG19_CLAMAV_HOST?.trim()??"";
  const scanPort=Number(process.env.CG19_CLAMAV_PORT);
  if(!scanHost||scanHost.length>253||!Number.isSafeInteger(scanPort)||
    scanPort<1||scanPort>65535)return disabled();
  const scanner=new ClamAvScanner(scanHost,scanPort);

  if(provider==="FIREBASE"){
    const bucket=process.env.CG19_FIREBASE_BUCKET?.trim()??"";
    const config=resolveFirebaseStorageConfig(process.env);
    // Firebase default buckets commonly end in .firebasestorage.app.
    // Legacy clients may have .appspot.com buckets. Use the exact bucket.
    if(!/^[a-z0-9][a-z0-9._-]{2,220}$/.test(bucket)||
      !config)return disabled();
    return new FirebasePrivateStorage(bucket,scanner,config.projectId,config.credentials);
  }

  const bucket=process.env.CG19_S3_BUCKET?.trim()??"";
  const region=process.env.AWS_REGION?.trim()??"";
  if(!/^[a-z0-9][a-z0-9.-]{2,61}[a-z0-9]$/.test(bucket)||
    !/^[a-z]{2}(-gov)?-[a-z]+-\d$/.test(region))
    return disabled();
  return new S3PrivateStorage(bucket,region,scanner);
}
