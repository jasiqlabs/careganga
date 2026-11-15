/** CG-01 US-001 (FR-081): safe deployment switches, not partner/center entitlements.
 * No ERP owner module, database table, worker or route exists in this bootstrap.
 * Even a deliberate "true" request is NOT_AVAILABLE until its owning module
 * implements independent center, actor, clinical and server-readiness gates.
 */
export type ErpCapabilityName = "lab" | "pharmacy" | "nursing" | "ot";
export type ErpCapabilityState = Readonly<{
  requested: boolean;
  available: false;
  status: "OFF" | "NOT_AVAILABLE";
}>;
export type ErpDeploymentCapabilities = Readonly<Record<ErpCapabilityName, ErpCapabilityState>>;

const ERP_ENV_NAMES: Readonly<Record<ErpCapabilityName, string>> = Object.freeze({
  lab: "CAREGANGA_ERP_LAB_ENABLED",
  pharmacy: "CAREGANGA_ERP_PHARMACY_ENABLED",
  nursing: "CAREGANGA_ERP_NURSING_ENABLED",
  ot: "CAREGANGA_ERP_OT_ENABLED"
});

function requestedErpCapability(key: ErpCapabilityName): boolean {
  const envName=ERP_ENV_NAMES[key];
  const raw=process.env[envName];
  if(raw===undefined || raw==="false")return false;
  if(raw==="true")return true;
  // This logs only the public variable *name*; never a raw value, token, or PII.
  // Invalid/mixed-case/injected values always fail OFF.
  try{
    process.stderr.write(JSON.stringify({
      event:"erp_deployment_capability_invalid",variable:envName,decision:"OFF"
    })+"\\n");
  }catch{ /* Diagnostic sinks must not change a safe default. */ }
  return false;
}

/** Resolve once at process startup; immutable for the entire process lifetime.
 * No UI/app bundle can override this server-owned deployment decision.
 */
export function readErpDeploymentCapabilities(): ErpDeploymentCapabilities {
  const state=(key:ErpCapabilityName):ErpCapabilityState=>{
    const requested=requestedErpCapability(key);
    // Future module-owned enablement is NOT provided by CG-01.
    const result:ErpCapabilityState=Object.freeze({
      requested,available:false,status:requested?"NOT_AVAILABLE":"OFF"
    });
    if(requested){
      try{
        process.stderr.write(JSON.stringify({
          event:"erp_module_not_installed",variable:ERP_ENV_NAMES[key],decision:"NOT_AVAILABLE"
        })+"\\n");
      }catch{ /* No secrets or runtime disruption from diagnostics. */ }
    }
    return result;
  };
  return Object.freeze({
    lab:state("lab"),pharmacy:state("pharmacy"),nursing:state("nursing"),ot:state("ot")
  });
}
export type AppConfig = Readonly<{
  port:number;databaseUrl:string;webOrigin:string;
  erpDeploymentCapabilities:ErpDeploymentCapabilities
}>;

export function readConfig(): AppConfig {
  const databaseUrl = process.env.DATABASE_URL;
  const webOrigin = process.env.WEB_ORIGIN;
  const port = Number(process.env.PORT ?? 4000);
  if (!databaseUrl) throw new Error("Missing DATABASE_URL");
  if (Buffer.from(process.env.IDENTITY_ENCRYPTION_KEY ?? "", "base64").length !== 32)
    throw new Error("Missing or invalid IDENTITY_ENCRYPTION_KEY");
  if (!webOrigin || !/^https?:\/\/[^/]+$/.test(webOrigin)) throw new Error("Missing or invalid WEB_ORIGIN");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT");
  if (process.env.NODE_ENV === "production" && !webOrigin.startsWith("https://"))
    throw new Error("Production WEB_ORIGIN must use HTTPS");
  return Object.freeze({ databaseUrl, port, webOrigin,
    erpDeploymentCapabilities:readErpDeploymentCapabilities() });
}
