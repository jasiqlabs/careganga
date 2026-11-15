import { CanActivate,ExecutionContext,Injectable } from "@nestjs/common";
import { SessionService } from "../application/session.service";
import type { VerifiedFoundationActor } from "../public-api";
import type { CareGangaRequest } from "../../../core/observability/request-correlation";

export type AuthenticatedRequest=CareGangaRequest&{cgActor?:VerifiedFoundationActor};
@Injectable()
export class SessionGuard implements CanActivate{
  constructor(private readonly sessions:SessionService){}
  async canActivate(context:ExecutionContext):Promise<boolean>{
    const request=context.switchToHttp().getRequest<AuthenticatedRequest>();
    request.cgActor=await this.sessions.verifySession(request.headers.authorization??"");
    return true;
  }
}
