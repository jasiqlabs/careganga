/** CG-01 original security-policy owner: safe positive bounds, never user-controlled current password confirmation disable. */
export type SecurityPolicyValues={
  maxSessionAgeSeconds:number;idleTimeoutSeconds:number;
  failedAttemptWindowSeconds:number;maxFailedAttempts:number;rootPasswordReauthRequired:true;
};
export type SecurityPolicyView=SecurityPolicyValues&{
  revision:number;updatedAt:string|null;
};
export const DEFAULT_SECURITY_POLICY:Readonly<SecurityPolicyValues>=Object.freeze({
  maxSessionAgeSeconds:28800,idleTimeoutSeconds:1800,
  failedAttemptWindowSeconds:900,maxFailedAttempts:6,rootPasswordReauthRequired:true
});
export function validateSecurityPolicy(v:unknown):SecurityPolicyValues {
  if(!v||typeof v!=="object"||Array.isArray(v))throw new Error("INVALID_POLICY");
  const p=v as Record<string,unknown>;
  const allowed=["maxSessionAgeSeconds","idleTimeoutSeconds","failedAttemptWindowSeconds",
    "maxFailedAttempts","rootPasswordReauthRequired"];
  if(Object.keys(p).some(k=>!allowed.includes(k))||allowed.some(k=>!(k in p)))
    throw new Error("INVALID_POLICY");
  function number(key:string,lower:number,upper:number):number{
    const n=p[key];
    if(typeof n!=="number"||!Number.isSafeInteger(n)||n<lower||n>upper)
      throw new Error("INVALID_POLICY");
    return n;
  }
  const maxSessionAgeSeconds=number("maxSessionAgeSeconds",900,28800);
  const idleTimeoutSeconds=number("idleTimeoutSeconds",300,3600);
  const failedAttemptWindowSeconds=number("failedAttemptWindowSeconds",300,3600);
  const maxFailedAttempts=number("maxFailedAttempts",3,10);
  if(idleTimeoutSeconds>maxSessionAgeSeconds||p.rootPasswordReauthRequired!==true)
    throw new Error("INVALID_POLICY");
  return {maxSessionAgeSeconds,idleTimeoutSeconds,
    failedAttemptWindowSeconds,maxFailedAttempts,rootPasswordReauthRequired:true};
}
