import {Injectable,ServiceUnavailableException} from "@nestjs/common";

/** The storage and malware-scanning boundary is deliberately explicit.
 * Private evidence MUST NOT be marked validated without independently
 * checked bytes, checksum and a CLEAN_VERIFIED malware scan.
 * A URL by itself proves nothing about an uploaded object.
 */
export type PrivateUploadReservation=Readonly<{
  url:string;expiresAt:string;reservationRef:string;
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
}
