import {Module} from "@nestjs/common";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {HrSourceModule} from "../cg-10-human-resources/hr-source.module";
import {PrivateObjectStorage} from "./infrastructure/private-object-storage";
import {makePrivateStorageProvider} from "./infrastructure/private-storage-provider.factory";
import {HrEmployeeEvidenceService} from "./application/hr-employee-evidence.service";
import {HrEmployeeEvidenceController} from "./http/hr-employee-evidence.controller";
/** CG19 owns original private file storage, verification and audit for HR
 * before an approval case exists. This small source module avoids a Nest cycle.
 */
@Module({imports:[IdentityAccessModule,HrSourceModule],
 providers:[HrEmployeeEvidenceService,{
  provide:PrivateObjectStorage,useFactory:makePrivateStorageProvider}],
 controllers:[HrEmployeeEvidenceController],
 exports:[HrEmployeeEvidenceService]})
export class HrEvidenceSourceModule{}
