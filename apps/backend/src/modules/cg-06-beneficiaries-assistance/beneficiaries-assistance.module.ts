import {Module} from "@nestjs/common";
import {BeneficiariesSourceModule} from "./beneficiaries-source.module";
import {AssistanceController} from "./http/assistance.controller";
import {BeneficiariesController} from "./http/beneficiaries.controller";

@Module({
 imports:[BeneficiariesSourceModule],
 controllers:[BeneficiariesController,AssistanceController],
 exports:[BeneficiariesSourceModule]
})
export class BeneficiariesAssistanceModule{}
