import { Platform } from "react-native";
import Constants from "expo-constants";

function isAndroidEmulator(): boolean {
  if (Platform.OS !== "android") return false;
  const c = Platform.constants as {
    Brand?: string;
    Manufacturer?: string;
    Model?: string;
    Fingerprint?: string;
    Hardware?: string;
    Product?: string;
  };
  const fingerprint = (c.Fingerprint ?? "").toLowerCase();
  const model = (c.Model ?? "").toLowerCase();
  const brand = (c.Brand ?? "").toLowerCase();
  const manufacturer = (c.Manufacturer ?? "").toLowerCase();
  const hardware = (c.Hardware ?? "").toLowerCase();
  const product = (c.Product ?? "").toLowerCase();

  return (
    fingerprint.startsWith("generic") ||
    fingerprint.includes("vbox") ||
    fingerprint.includes("emulator") ||
    model.includes("google_sdk") ||
    model.includes("emulator") ||
    model.includes("android sdk built for") ||
    hardware.includes("goldfish") ||
    hardware.includes("ranchu") ||
    product.includes("sdk_google") ||
    product.includes("google_sdk") ||
    brand.includes("generic") ||
    manufacturer.includes("genymotion")
  );
}

function getDevHost(): string | null {
  try {
    const hostUri = Constants.expoConfig?.hostUri;
    if (hostUri) {
      const host = hostUri.split(":")[0];
      if (host && host !== "localhost" && host !== "127.0.0.1") return host;
    }
    const manifest = (Constants as unknown as { manifest?: { debuggerHost?: string } })?.manifest;
    if (manifest?.debuggerHost) {
      const host = manifest.debuggerHost.split(":")[0];
      if (host && host !== "localhost" && host !== "127.0.0.1") return host;
    }
    const linkingUri = Constants.linkingUri;
    if (linkingUri) {
      const match = linkingUri.match(/:\/\/(.[^/:]+)/);
      if (match && match[1] && match[1] !== "localhost" && match[1] !== "127.0.0.1") {
        return match[1];
      }
    }
  } catch {
    // Fail safe if Constants is unavailable
  }
  return null;
}

function getBaseUrl(): string {
  return process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000";
}

function resolveEndpoint(path: string): string {
  const base = getBaseUrl();
  if (!base) throw new Error("Authentication service unavailable");
  let resolvedBase = base;
  if (Platform.OS === "android" && (resolvedBase.startsWith("http://localhost:") || resolvedBase.startsWith("http://127.0.0.1:"))) {
    const devHost = getDevHost();
    if (devHost) {
      resolvedBase = resolvedBase.replace(/localhost|127\.0\.0\.1/, devHost);
    } else if (isAndroidEmulator()) {
      resolvedBase = resolvedBase.replace(/localhost|127\.0\.0\.1/, "10.0.2.2");
    } else {
      throw new Error("API configuration error: localhost cannot be reached from a physical Android device. Configure EXPO_PUBLIC_API_URL with your backend network IP (e.g. http://192.168.x.x:4000).");
    }
  }
  return new URL(path, resolvedBase).toString();
}

export async function identityRequest(path:string,options:RequestInit={}):Promise<Response>{
  const base = getBaseUrl();
  if(!base||!/^https?:\/\//.test(base)||
    (process.env.NODE_ENV==="production"&&!base.startsWith("https://")))
    throw new Error("Authentication service unavailable");
  const abort=new AbortController();
  const timeout=setTimeout(()=>abort.abort(),10000);
  try{return await fetch(resolveEndpoint(path),{...options,signal:abort.signal});}
  finally{clearTimeout(timeout);}
}
