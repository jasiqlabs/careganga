import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export type CareGangaRequest=Request & { cgRequestId?:string };

export function correlateRequest(req:CareGangaRequest,res:Response,next:NextFunction):void {
  // Generate on the server; no client-supplied tracing input can poison log correlation.
  req.cgRequestId=randomUUID();
  res.setHeader("X-Request-ID",req.cgRequestId);
  const started=process.hrtime.bigint();
  res.on("finish",()=>{
    const elapsedMs=Number(process.hrtime.bigint()-started)/1e6;
    // Restricted structured diagnostics: no URL/query, raw account, contact, auth, body or token.
    process.stdout.write(JSON.stringify({
      at:new Date().toISOString(),module:"http",event:"request",
      requestId:req.cgRequestId,method:req.method,status:res.statusCode,
      durationMs:Math.round(elapsedMs)
    })+"\n");
  });
  next();
}
