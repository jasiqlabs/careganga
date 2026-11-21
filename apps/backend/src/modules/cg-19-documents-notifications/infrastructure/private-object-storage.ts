import {Injectable,ServiceUnavailableException} from "@nestjs/common";

/** The storage and malware-scanning boundary is deliberately explicit.
 * Private evidence MUST NOT be marked validated without independently
 * checked bytes, checksum and a CLEAN_VERIFIED malware scan.
 * A URL by itself proves nothing about an uploaded object.
 */
export type PrivateUploadReservation=Readonly<{
  url:string;expiresAt:string;reservationRef:string;
  headers:Record<string,string>;
}>;
export type PrivateVerifiedObject=Readonly<{
  state:"CLEAN_VERIFIED";sha256:string;sizeBytes:number;mime:string;
  objectVersion:string;verifiedAt:string;scanProofRef:string;
}>;
export abstract class PrivateObjectStorage{
  abstract reservePrivateUpload(request:{
    objectKey:string;requestKey:string;mime:string;sizeBytes:number;
    sha256:string;expiresAt:string;
  }):Promise<PrivateUploadReservation>;
  abstract verifyPrivateObject(request:{
    objectKey:string;mime:string;sizeBytes:number;sha256:string;
  }):Promise<PrivateVerifiedObject>;
  /** A protected proxy, rechecking the current actor on every download.
   * Pre-signed public/CDN URLs are NOT an implementation of this contract.
   */
  abstract readVerifiedPrivateObject(request:{
    objectKey:string;objectVersion:string;maxBytes:number
  }):Promise<Buffer>;
  /** Server-rendered, deterministic private PDF; never a client upload token.
   * Returns only when object bytes/checksum and version are verified.
   */
  abstract writeVerifiedPrivateDocument(request:{
    objectKey:string;bytes:Buffer;sha256:string
  }):Promise<{objectVersion:string;sha256:string}>;
  /** Recover an existing create-only, server-issued invoice/receipt PDF after
   * a lost write/SQL response. Verify actual private bytes and malware state.
   * Never permit a client-uploaded evidence key to use this operation.
   */
  abstract writeVerifiedGeneratedReport(request:{
    objectKey:string;bytes:Buffer;sha256:string;
    mime:"application/pdf"|"text/csv"|
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  }):Promise<{objectVersion:string;sha256:string}>;
  abstract reconcileGeneratedReport(request:{
    objectKey:string;mime:"application/pdf"|"text/csv"|
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    maxBytes:number
  }):Promise<{objectVersion:string;sha256:string;sizeBytes:number}>;
  abstract reconcileIssuedPrivateDocument(request:{
    objectKey:string;maxBytes:number
  }):Promise<{objectVersion:string;sha256:string;sizeBytes:number}>;
}
@Injectable()
export class UnconfiguredPrivateObjectStorage extends PrivateObjectStorage{
  private unavailable():never{
    throw new ServiceUnavailableException(
      "Secure file storage and malware scanning are not configured");
  }
  async reservePrivateUpload(_request:{
    objectKey:string;requestKey:string;mime:string;sizeBytes:number;
    sha256:string;expiresAt:string;
  }):Promise<PrivateUploadReservation>{return this.unavailable();}
  async verifyPrivateObject(_request:{
    objectKey:string;mime:string;sizeBytes:number;sha256:string
  }):Promise<PrivateVerifiedObject>{return this.unavailable();}
  async readVerifiedPrivateObject(_request:{
    objectKey:string;objectVersion:string;maxBytes:number
  }):Promise<Buffer>{return this.unavailable();}
  async writeVerifiedPrivateDocument(_request:{
    objectKey:string;bytes:Buffer;sha256:string
  }):Promise<{objectVersion:string;sha256:string}>{return this.unavailable();}
  async writeVerifiedGeneratedReport(_request:{
    objectKey:string;bytes:Buffer;sha256:string;
    mime:"application/pdf"|"text/csv"|
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  }):Promise<{objectVersion:string;sha256:string}>{return this.unavailable();}
  async reconcileGeneratedReport(_request:{
    objectKey:string;mime:"application/pdf"|"text/csv"|
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    maxBytes:number
  }):Promise<{objectVersion:string;sha256:string;sizeBytes:number}>{
    return this.unavailable();
  }
  async reconcileIssuedPrivateDocument(_request:{
    objectKey:string;maxBytes:number
  }):Promise<{objectVersion:string;sha256:string;sizeBytes:number}>{return this.unavailable();}
}
