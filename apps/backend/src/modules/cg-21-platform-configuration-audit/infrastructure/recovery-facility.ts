import {Injectable} from "@nestjs/common";
export type VerifiedBackupEvidence={
  backupReference:string;facilityRef:string;verifiedAt:string;
};
/** Narrow, independently registered operations boundary; no fake restore adapter. */
export abstract class RecoveryFacility {
  abstract availability():Promise<{
    status:"AVAILABLE"|"NOT_AVAILABLE";message:string;
  }>;
  abstract inspectBackup(backupReference:string):Promise<VerifiedBackupEvidence|null>;
}
@Injectable()
export class UnavailableRecoveryFacility extends RecoveryFacility{
  async availability(){
    return {status:"NOT_AVAILABLE" as const,
      message:"No independently verified secured backup facility is connected."};
  }
  async inspectBackup(_backupReference:string):Promise<VerifiedBackupEvidence|null>{
    return null; // Do not assume an integration reference is a usable backup.
  }
}
