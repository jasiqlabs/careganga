import { randomBytes,scrypt,timingSafeEqual } from "node:crypto";

// Strong salted password derivation shared by root provisioning, Admin user creation,
// routine sign-in, signed-in password changes and email/SMS OTP-confirmed resets.
const COST={N:32768,r:8,p:1,maxmem:64*1024*1024};
function derive(value:string,salt:Buffer):Promise<Buffer>{
  return new Promise((resolve,reject)=>{
    scrypt(value,salt,64,COST,(error,out)=>error?reject(error):resolve(out as Buffer));
  });
}
export async function hashPassword(password:string):Promise<string>{
  if(typeof password!=="string"||password.length<8||Buffer.byteLength(password,"utf8")>1024)
    throw new Error("Password does not meet required length");
  const salt=randomBytes(24),digest=await derive(password,salt);
  return ["scrypt",String(COST.N),salt.toString("hex"),digest.toString("hex")].join("$");
}
export async function verifyPassword(password:string,encoded:string):Promise<boolean>{
  if(typeof password!=="string"||Buffer.byteLength(password,"utf8")>1024)return false;
  const [algorithm,cost,salt,expected]=encoded.split("$");
  if(algorithm!=="scrypt"||cost!==String(COST.N)||
    !/^[a-f0-9]{48}$/.test(salt??"")||!/^[a-f0-9]{128}$/.test(expected??""))
    return false;
  const actual=await derive(password,Buffer.from(salt,"hex"));
  return timingSafeEqual(actual,Buffer.from(expected,"hex"));
}
