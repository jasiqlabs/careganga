import {Controller,Get,Headers,Query} from "@nestjs/common";
import {MisDashboardService} from "../application/mis-dashboard.service";

/** GET only: reporting does not mutate any original source. */
@Controller("api/v1/mis")
export class MisDashboardController{
 constructor(private readonly dashboardService:MisDashboardService){}
 @Get("dashboard")
 dashboard(@Headers("authorization")authorization:string,
  @Query()query:Record<string,unknown>){
  return this.dashboardService.dashboard(authorization,query);
 }
}
