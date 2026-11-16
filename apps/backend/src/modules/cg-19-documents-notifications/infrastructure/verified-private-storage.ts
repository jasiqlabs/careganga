import {createHash} from "node:crypto";
import {BadRequestException,ServiceUnavailableException} from "@nestjs/common";
import {
  PrivateObjectStorage,PrivateUploadReservation,PrivateVerifiedObject
} from "./private-object-storage";
import {ClamAvScanner} from "./clamav-scanner";

export type ObjectBytes=Readonly<{
  bytes:Buffer;objectVersion:string;mime:string;
}>;
export type UploadInput={
  objectKey:string;requestKey:string;mime:string;sizeBytes:number;
  sha256:string;expiresAt:string;
};
const allowedMime=new Set(["application/pdf","image/jpeg","image/png","image/webp"]);
const SHA=/^[a-f0-9]{64}$/;
const validKey=(key:string)=>
  typeof key==="string"&&key.startsWith("careganga/private/cg19/")&&
  key.length<=255&&!key.includes("..")&&!key.includes("\\");
export const digest=(bytes:Buffer)=>
  createHash("sha256").update(bytes).digest("hex");

/** The provider-specific methods supply a version-pinned object; all providers
 * share the exact same checksum, MIME, byte bounds and malware-scan gate.
 */
export abstract class VerifiedPrivateStorage extends PrivateObjectStorage{
  constructor(protected readonly scanner:ClamAvScanner){super();}
  protected abstract signUpload(request:UploadInput):Promise<PrivateUploadReservation>;
  protected abstract loadLatest(objectKey:string,maxBytes:number):Promise<ObjectBytes>;
  protected abstract loadVersion(objectKey:string,version:string,maxBytes:number):
    Promise<ObjectBytes>;
  protected abstract saveNewPdf(objectKey:string,bytes:Buffer):
    Promise<{objectVersion:string}>;

  async reservePrivateUpload(request:UploadInput):Promise<PrivateUploadReservation>{
    const expiry=Date.parse(request.expiresAt);
    if(!validKey(request.objectKey)||!allowedMime.has(request.mime)||
      !Number.isSafeInteger(request.sizeBytes)||request.sizeBytes<1||
      request.sizeBytes>10*1024*1024||!SHA.test(request.sha256)||
      !Number.isFinite(expiry)||expiry<=Date.now()||expiry>Date.now()+16*60*1000)
      throw new BadRequestException("Invalid private upload request");
    return this.signUpload(request);
  }

  async verifyPrivateObject(request:{
    objectKey:string;mime:string;sizeBytes:number;sha256:string
  }):Promise<PrivateVerifiedObject>{
    if(!validKey(request.objectKey)||!allowedMime.has(request.mime)||
      !Number.isSafeInteger(request.sizeBytes)||request.sizeBytes<1||
      request.sizeBytes>10*1024*1024||!SHA.test(request.sha256))
      throw new BadRequestException("Invalid private file verification");
    const file=await this.loadLatest(request.objectKey,request.sizeBytes);
    if(file.mime!==request.mime||file.bytes.length!==request.sizeBytes||
      digest(file.bytes)!==request.sha256)
      throw new ServiceUnavailableException("Private object bytes were not verified");
    const proof=await this.scanner.scan(file.bytes);
    return {state:proof.state,mime:request.mime,sizeBytes:request.sizeBytes,
      sha256:request.sha256,objectVersion:file.objectVersion,
      verifiedAt:proof.verifiedAt,scanProofRef:proof.scanProofRef};
  }

  async readVerifiedPrivateObject(request:{
    objectKey:string;objectVersion:string;maxBytes:number
  }):Promise<Buffer>{
    if(!validKey(request.objectKey)||typeof request.objectVersion!=="string"||
      !Number.isSafeInteger(request.maxBytes)||request.maxBytes<1||
      request.maxBytes>10*1024*1024)
      throw new BadRequestException("Invalid private file");
    const file=await this.loadVersion(request.objectKey,request.objectVersion,
      request.maxBytes);
    if(file.objectVersion!==request.objectVersion||file.bytes.length>request.maxBytes)
      throw new ServiceUnavailableException("Stored file version no longer matches");
    return file.bytes;
  }

  async writeVerifiedPrivateDocument(request:{
    objectKey:string;bytes:Buffer;sha256:string
  }):Promise<{objectVersion:string;sha256:string}>{
    if(!validKey(request.objectKey)||!Buffer.isBuffer(request.bytes)||
      request.bytes.length<100||request.bytes.length>10*1024*1024||
      !request.bytes.subarray(0,5).equals(Buffer.from("%PDF-"))||
      !SHA.test(request.sha256)||digest(request.bytes)!==request.sha256)
      throw new BadRequestException("Invalid private PDF");
    // Even server-created PDFs must pass malware scanning before issuance.
    await this.scanner.scan(request.bytes);
    let objectVersion:string;
    try{
      const saved=await this.saveNewPdf(request.objectKey,request.bytes);
      objectVersion=saved.objectVersion;
    }catch{
      // A create-only write can commit but lose its reply. Reconcile the
      // *original key* by reading actual private bytes; do not issue a second
      // object or assume an ambiguous provider response was successful.
      const existing=await this.loadLatest(request.objectKey,request.bytes.length)
        .catch(()=>null);
      if(!existing||existing.mime!=="application/pdf"||
        existing.bytes.length!==request.bytes.length||
        digest(existing.bytes)!==request.sha256)
        throw new ServiceUnavailableException("Original private PDF is unconfirmed");
      objectVersion=existing.objectVersion;
    }
    const proof=await this.loadVersion(request.objectKey,objectVersion,
      request.bytes.length);
    if(proof.mime!=="application/pdf"||
      proof.bytes.length!==request.bytes.length||
      digest(proof.bytes)!==request.sha256)
      throw new ServiceUnavailableException("The generated PDF was not verified");
    return {objectVersion,sha256:request.sha256};
  }
}
