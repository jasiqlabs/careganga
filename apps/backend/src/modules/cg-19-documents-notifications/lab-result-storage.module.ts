import {Module} from "@nestjs/common";
import {PrivateObjectStorage} from "./infrastructure/private-object-storage";
import {makePrivateStorageProvider}
 from "./infrastructure/private-storage-provider.factory";
/** Narrow CG19 owner storage export. CG16 reuses the SAME configured private
 * storage/scanner adapter without importing the entire notification stack,
 * storing a second object or pretending to be the patient uploader. */
@Module({
 providers:[{provide:PrivateObjectStorage,useFactory:makePrivateStorageProvider}],
 exports:[PrivateObjectStorage]
})
export class LabResultStorageModule{}
