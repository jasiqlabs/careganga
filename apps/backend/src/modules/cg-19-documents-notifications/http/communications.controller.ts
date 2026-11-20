import {
  BadRequestException,Body,Controller,ForbiddenException,Get,Headers,Param,
  Post,Query,Req
} from "@nestjs/common";
import {NotificationService} from "../application/notification.service";
import {NoticeService} from "../application/notice.service";
import {DeliveryService} from "../application/delivery.service";
import {ClientEmailTemplateService} from "../application/client-email-template.service";
@Controller("api/communications")
export class CommunicationsController{
  constructor(private readonly inbox:NotificationService,
    private readonly notices:NoticeService,
    private readonly delivery:DeliveryService,
    private readonly clientEmails:ClientEmailTemplateService){}
  @Get("inbox")
  inboxPage(@Headers("authorization")token:string,@Query("limit")limit?:string){
    return this.inbox.inbox(token,limit??20);
  }
  @Post("inbox/:notificationRef/read")
  markRead(@Headers("authorization")token:string,
    @Param("notificationRef")ref:string){
    return this.inbox.read(token,ref);
  }
  @Get("preferences")
  preferences(@Headers("authorization")token:string){
    return this.inbox.preferences(token);
  }
  @Post("preferences")
  preference(@Headers("authorization")token:string,@Body()body:unknown){
    return this.inbox.setPreference(token,body);
  }
  @Get("client-email-templates")
  clientEmailCatalog(@Headers("authorization")token:string){
    return this.clientEmails.list(token);
  }
  @Post("client-email-templates/import-drafts")
  importClientEmailDrafts(@Headers("authorization")token:string){
    return this.clientEmails.importDrafts(token);
  }
  @Post("recover-decisions")
  recover(@Headers("authorization")token:string){
    return this.inbox.recover(token);
  }
  @Get("notices")
  listNotices(@Headers("authorization")token:string,@Query("limit")limit?:string){
    return this.notices.list(token,limit??20);
  }
  @Get("notices/requests/:requestKey")
  lookupDraft(@Headers("authorization")token:string,
    @Param("requestKey")key:string){
    return this.notices.lookupDraft(token,key);
  }
  @Post("notices")
  draft(@Headers("authorization")token:string,@Body()body:unknown){
    return this.notices.draft(token,body);
  }
  @Get("notices/:noticeRef/requests/:requestKey")
  noticeCommandStatus(@Headers("authorization")token:string,
    @Param("noticeRef")noticeRef:string,@Param("requestKey")key:string){
    return this.notices.commandStatus(token,noticeRef,key);
  }
  @Post("notices/:noticeRef/decision")
  noticeDecision(@Headers("authorization")token:string,
    @Param("noticeRef")ref:string,@Body()body:unknown){
    return this.notices.decide(token,ref,body);
  }
  @Get("notices/:noticeRef/counts")
  noticeStatus(@Headers("authorization")token:string,
    @Param("noticeRef")ref:string){
    return this.notices.deliveryCounts(token,ref);
  }
  @Post("process-due")
  process(@Headers("authorization")token:string){
    return this.delivery.process(token);
  }
  @Get("providers/status")
  availability(@Headers("authorization")token:string){
    return this.delivery.readiness(token);
  }
}

type RawProviderRequest={
 rawBody?:Buffer;
 body?:unknown;query?:Record<string,unknown>
};
@Controller("api/communications/provider")
export class CommunicationProviderWebhookController{
  constructor(private readonly delivery:DeliveryService){}
  @Post("sendgrid-events")
  async sendgrid(
    @Req()req:RawProviderRequest,
    @Headers("x-twilio-email-event-webhook-signature")signature:string,
    @Headers("x-twilio-email-event-webhook-timestamp")timestamp:string
  ){
    if(!Buffer.isBuffer(req.rawBody)||
      !this.delivery.verifySendGrid(req.rawBody,signature,timestamp))
      throw new ForbiddenException("Invalid signed provider callback");
    let payload:unknown;
    try{payload=JSON.parse(req.rawBody.toString("utf8"));}
    catch{throw new BadRequestException("Invalid provider event");}
    if(!Array.isArray(payload)||payload.length<1||payload.length>100)
      throw new BadRequestException("Invalid provider event batch");
    let accepted=0;
    for(const item of payload){
      if(!item||typeof item!=="object"||Array.isArray(item))continue;
      const event=item as Record<string,unknown>;
      const custom=event.custom_args&&typeof event.custom_args==="object"?
        event.custom_args as Record<string,unknown>:null;
      const attempt=custom?.cg19_attempt_ref,eventId=event.sg_event_id;
      const status=event.event;
      if(typeof attempt!=="string"||typeof eventId!=="string"||
        typeof status!=="string"||![
          "delivered","bounce","dropped","processed","deferred"
        ].includes(status))continue;
      const mapped=status==="delivered"?"DELIVERED":
        status==="bounce"||status==="dropped"?"BOUNCED":
        status==="processed"?"ACCEPTED":"UNKNOWN";
      const result=await this.delivery.receipt(
        "SENDGRID",attempt,eventId,mapped,
        typeof event.sg_message_id==="string"?event.sg_message_id:null
      );
      if(result.accepted)accepted++;
    }
    return {accepted};
  }
  @Post("twilio-status")
  async twilio(@Req()req:RawProviderRequest,
    @Headers("x-twilio-signature")signature:string,
    @Query("attempt")attempt:string){
    const body=req.body;
    if(!body||typeof body!=="object"||Array.isArray(body))
      throw new BadRequestException("Invalid delivery status");
    const params:Record<string,string>={};
    for(const [k,v] of Object.entries(body)){
      if(typeof v!=="string"||k.length>60||v.length>500)
        throw new BadRequestException("Invalid delivery status");
      params[k]=v;
    }
    if(!this.delivery.verifyTwilio(params,signature,attempt))
      throw new ForbiddenException("Invalid signed provider callback");
    const sid=params.MessageSid,status=params.MessageStatus;
    if(!/^SM[a-f0-9]{32}$/i.test(sid??"")||!status)
      throw new BadRequestException("Invalid SMS provider event");
    const mapped=status==="delivered"?"DELIVERED":
      status==="undelivered"?"UNDELIVERED":
      status==="failed"?"BOUNCED":
      ["accepted","queued","sending","sent"].includes(status)?"ACCEPTED":"UNKNOWN";
    const eventId="twilio:"+status+":"+sid;
    return this.delivery.receipt("TWILIO",attempt,eventId,mapped,sid);
  }
}
