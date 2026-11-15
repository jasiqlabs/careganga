export type AppConfig = Readonly<{ port: number; databaseUrl: string; webOrigin: string }>;

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
  return Object.freeze({ databaseUrl, port, webOrigin });
}
