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
const allowedMime=new Set(["application/pdf","image/jpeg","image/png","image/webp","video/mp4"]);
// A short MP4 is permitted only for original CG19 scanned CMS assets.
const maxFor=(key:string,mime:string)=>
 key.startsWith("careganga/private/cg19/cms/")&&mime==="video/mp4"?
  25*1024*1024:10*1024*1024;
const supported=(key:string,mime:string)=>allowedMime.has(mime)&&
 (mime!=="video/mp4"||key.startsWith("careganga/private/cg19/cms/"));
const SHA=/^[a-f0-9]{64}$/;
const validKey=(key:string)=>
  typeof key==="string"&&key.startsWith("careganga/private/cg19/")&&
  key.length<=255&&!key.includes("..")&&!key.includes("\\");
export const digest=(bytes:Buffer)=>
  createHash("sha256").update(bytes).digest("hex");
export function byteSignatureMatches(bytes:Buffer,mime:string):boolean{
  if(!Buffer.isBuffer(bytes)||bytes.length<12)return false;
  if(mime==="application/pdf")
    return bytes.subarray(0,5).equals(Buffer.from("%PDF-"))&&
      bytes.subarray(Math.max(0,bytes.length-2048))
        .includes(Buffer.from("%%EOF"));
  if(mime==="image/jpeg")
    return bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff&&
      bytes[bytes.length-2]===0xff&&bytes[bytes.length-1]===0xd9;
  if(mime==="image/png")
    return bytes.subarray(0,8).equals(
      Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
  if(mime==="image/webp")
    return bytes.toString("ascii",0,4)==="RIFF"&&
      bytes.toString("ascii",8,12)==="WEBP";
  if(mime==="video/mp4"){
    // ISO BMFF: require a finite ftyp box and accepted MP4-compatible brand.
    const size=bytes.readUInt32BE(0),brand=bytes.toString("ascii",8,12);
    return bytes.length>=16&&size>=16&&size<=bytes.length&&
      bytes.toString("ascii",4,8)==="ftyp"&&
      ["isom","iso2","iso4","iso5","iso6","mp41","mp42","avc1","M4V ","dash"].includes(brand);
  }
  return false;
}

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
  protected abstract saveNewGeneratedReport(objectKey:string,bytes:Buffer,
    mime:string):Promise<{objectVersion:string}>;
  private isGeneratedKey(key:string){
    const segments=key.split("/");
    return segments.length===6&&segments[0]==="careganga"&&
      segments[1]==="private"&&segments[2]==="cg19"&&
      /^[0-9a-f-]{36}$/.test(segments[3])&&segments[4]==="mis"&&
      /^[0-9a-f-]{36}$/.test(segments[5]);
  }
  private generatedSignature(bytes:Buffer,mime:string){
    if(mime==="application/pdf")return byteSignatureMatches(bytes,mime);
    if(mime==="text/csv")return bytes.length>=10&&bytes.length<=5242880&&
      !bytes.includes(0)&&!bytes.toString("utf8").includes("\uFFFD");
    if(mime==="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      return bytes.length>=100&&bytes.subarray(0,4).equals(Buffer.from([0x50,0x4b,0x03,0x04]))&&
       bytes.subarray(Math.max(0,bytes.length-300)).includes(
        Buffer.from([0x50,0x4b,0x05,0x06]));
    return false;
  }

  async reservePrivateUpload(request:UploadInput):Promise<PrivateUploadReservation>{
    const expiry=Date.parse(request.expiresAt);
    // Only the backend may create issued invoice, receipt and generated lab PDF keys.
    if(!validKey(request.objectKey)||/\/(?:invoices|receipts|lab-generated|mis)\//.test(request.objectKey)||
      !supported(request.objectKey,request.mime)||
      !Number.isSafeInteger(request.sizeBytes)||request.sizeBytes<1||
      request.sizeBytes>maxFor(request.objectKey,request.mime)||!SHA.test(request.sha256)||
      !Number.isFinite(expiry)||expiry<=Date.now()||expiry>Date.now()+16*60*1000)
      throw new BadRequestException("Invalid private upload request");
    return this.signUpload(request);
  }

  async verifyPrivateObject(request:{
    objectKey:string;mime:string;sizeBytes:number;sha256:string
  }):Promise<PrivateVerifiedObject>{
    if(!validKey(request.objectKey)||!supported(request.objectKey,request.mime)||
      !Number.isSafeInteger(request.sizeBytes)||request.sizeBytes<1||
      request.sizeBytes>maxFor(request.objectKey,request.mime)||!SHA.test(request.sha256))
      throw new BadRequestException("Invalid private file verification");
    const file=await this.loadLatest(request.objectKey,request.sizeBytes);
    if(file.mime!==request.mime||file.bytes.length!==request.sizeBytes||
      digest(file.bytes)!==request.sha256||
      !byteSignatureMatches(file.bytes,request.mime))
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
      request.maxBytes>(request.objectKey.startsWith("careganga/private/cg19/cms/")?
         25*1024*1024:10*1024*1024))
      throw new BadRequestException("Invalid private file");
    const file=await this.loadVersion(request.objectKey,request.objectVersion,
      request.maxBytes);
    if(file.objectVersion!==request.objectVersion||file.bytes.length>request.maxBytes)
      throw new ServiceUnavailableException("Stored file version no longer matches");
    return file.bytes;
  }

  async reconcileIssuedPrivateDocument(request:{
    objectKey:string;maxBytes:number
  }):Promise<{objectVersion:string;sha256:string;sizeBytes:number}>{
    // An invoice/receipt key is server-created, random and never signed for upload.
    if(!/^careganga\/private\/cg19\/[0-9a-f-]{36}\/(invoices|receipts)\/[0-9a-f-]{36}$/.test(request.objectKey)||
      !Number.isSafeInteger(request.maxBytes)||request.maxBytes<100||
      request.maxBytes>10*1024*1024)
      throw new BadRequestException("Invalid private document recovery request");
    const stored=await this.loadLatest(request.objectKey,request.maxBytes);
    if(stored.mime!=="application/pdf"||stored.bytes.length<100||
      !byteSignatureMatches(stored.bytes,"application/pdf")||
      stored.objectVersion.length>160)
      throw new ServiceUnavailableException("The original private PDF is not verified");
    await this.scanner.scan(stored.bytes);
    return {objectVersion:stored.objectVersion,sha256:digest(stored.bytes),
      sizeBytes:stored.bytes.length};
  }

  async writeVerifiedPrivateDocument(request:{
    objectKey:string;bytes:Buffer;sha256:string
  }):Promise<{objectVersion:string;sha256:string}>{
    if(!validKey(request.objectKey)||!Buffer.isBuffer(request.bytes)||
      request.bytes.length<100||request.bytes.length>10*1024*1024||
      !byteSignatureMatches(request.bytes,"application/pdf")||
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
  /** CG20 server-generated reports only; never client-uploadable objects.
   * Verify actual MIME, signature, scan result, version, checksum and bytes.
   * Lost provider acknowledgment returns UNKNOWN unless original key reconciles.
   */
  async writeVerifiedGeneratedReport(request:{
    objectKey:string;bytes:Buffer;sha256:string;
    mime:"application/pdf"|"text/csv"|
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  }):Promise<{objectVersion:string;sha256:string}>{
    if(!this.isGeneratedKey(request.objectKey)||!Buffer.isBuffer(request.bytes)||
      request.bytes.length<10||request.bytes.length>5242880||
      !SHA.test(request.sha256)||digest(request.bytes)!==request.sha256||
      !this.generatedSignature(request.bytes,request.mime))
      throw new BadRequestException("Invalid protected generated report");
    await this.scanner.scan(request.bytes);
    let version:string;
    try{
      const saved=request.mime==="application/pdf"?
        await this.saveNewPdf(request.objectKey,request.bytes):
        await this.saveNewGeneratedReport(request.objectKey,request.bytes,request.mime);
      version=saved.objectVersion;
    }catch{
      const actual=await this.loadLatest(request.objectKey,request.bytes.length).catch(()=>null);
      if(!actual||actual.mime!==request.mime||
        actual.bytes.length!==request.bytes.length||
        digest(actual.bytes)!==request.sha256||
        !this.generatedSignature(actual.bytes,request.mime))
        throw new ServiceUnavailableException("Protected generated report outcome is unconfirmed");
      version=actual.objectVersion;
    }
    const actual=await this.loadVersion(request.objectKey,version,request.bytes.length);
    if(actual.mime!==request.mime||actual.bytes.length!==request.bytes.length||
       digest(actual.bytes)!==request.sha256||
       !this.generatedSignature(actual.bytes,request.mime))
      throw new ServiceUnavailableException("Protected report version could not be verified");
    return {objectVersion:version,sha256:request.sha256};
  }
  async reconcileGeneratedReport(request:{
    objectKey:string;mime:"application/pdf"|"text/csv"|
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    maxBytes:number
  }):Promise<{objectVersion:string;sha256:string;sizeBytes:number}>{
    if(!this.isGeneratedKey(request.objectKey)||
      !Number.isSafeInteger(request.maxBytes)||request.maxBytes<10||
      request.maxBytes>5242880)
      throw new BadRequestException("Invalid protected report recovery");
    const actual=await this.loadLatest(request.objectKey,request.maxBytes);
    if(actual.mime!==request.mime||actual.objectVersion.length>160||
       !this.generatedSignature(actual.bytes,request.mime))
      throw new ServiceUnavailableException("Protected original report is unavailable");
    await this.scanner.scan(actual.bytes);
    return {objectVersion:actual.objectVersion,
      sha256:digest(actual.bytes),sizeBytes:actual.bytes.length};
  }

}
