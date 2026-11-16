import {createConnection} from "node:net";
import {createHash} from "node:crypto";
import {ServiceUnavailableException} from "@nestjs/common";

export interface VerifiedScan {
  state:"CLEAN_VERIFIED";verifiedAt:string;scanProofRef:string;
}

/** Only a real ClamAV INSTREAM OK response is accepted.
 * All timeouts, missing configuration, partial replies and FOUND responses
 * fail closed. The receipt is an internal event correlation, not a public attestation.
 */
export class ClamAvScanner{
  constructor(private readonly host:string,private readonly port:number){}
  async scan(bytes:Buffer):Promise<VerifiedScan>{
    if(!this.host||!Number.isSafeInteger(this.port)||this.port<1||this.port>65535||
      !Buffer.isBuffer(bytes)||bytes.length<1||bytes.length>10*1024*1024)
      throw new ServiceUnavailableException("The private malware scanner is unavailable");
    const reply=await new Promise<string>((resolve,reject)=>{
      const connection=createConnection({host:this.host,port:this.port});
      let complete=false,received="",wrote=false;
      const finish=(error?:Error,reply?:string)=>{
        if(complete)return;
        complete=true;connection.destroy();
        if(error)reject(error);else resolve(reply??"");
      };
      connection.setTimeout(20000);
      connection.on("timeout",()=>finish(new Error("Scanner timed out")));
      connection.on("error",()=>finish(new Error("Scanner connection failed")));
      connection.on("close",()=>{if(!complete)finish(new Error("Scanner closed without proof"));});
      connection.on("data",chunk=>{
        received+=chunk.toString("utf8");
        if(received.length>1024){finish(new Error("Invalid scanner reply"));return;}
        if(received.includes("\0")||received.includes("\n"))
          finish(undefined,received.replace(/\0/g,"").trim());
      });
      connection.on("connect",()=>{
        if(wrote)return;wrote=true;
        connection.write(Buffer.from("zINSTREAM\0","utf8"));
        // Explicit 1 MiB framed chunks and terminating zero-length frame.
        for(let i=0;i<bytes.length;i+=1024*1024){
          const chunk=bytes.subarray(i,Math.min(i+1024*1024,bytes.length));
          const length=Buffer.allocUnsafe(4);length.writeUInt32BE(chunk.length,0);
          connection.write(length);connection.write(chunk);
        }
        connection.write(Buffer.alloc(4));
      });
    }).catch(()=>{throw new ServiceUnavailableException("File scanning could not be verified");});
    if(reply!=="stream: OK")
      throw new ServiceUnavailableException("The file was not verified as malware-free");
    const checksum=createHash("sha256").update(bytes).digest("hex");
    return {state:"CLEAN_VERIFIED" as const,verifiedAt:new Date().toISOString(),
      scanProofRef:"clamav:"+checksum};
  }
}
