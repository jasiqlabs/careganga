import {Module} from "@nestjs/common";
import {BeneficiariesSourceModule} from "./beneficiaries-source.module";
import {BeneficiariesController} from "./http/beneficiaries.controller";

@Module({
 imports:[BeneficiariesSourceModule],
 controllers:[BeneficiariesController],
 exports:[BeneficiariesSourceModule]
})
export class BeneficiariesAssistanceModule{}
