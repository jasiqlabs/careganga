import { NextRequest, NextResponse } from "next/server";
import { isAllowedOrigin } from "../../../../shared/request-origin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isAllowedOrigin(request))
    return NextResponse.json({ message: "Request could not be completed" }, { status: 403 });

  const backend = process.env.BACKEND_URL;
  if (!backend) return NextResponse.json({ message: "Sign-in unavailable" }, { status: 503 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid request" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body))
    return NextResponse.json({ message: "Invalid request" }, { status: 400 });

  try {
    const result = await fetch(new URL("/api/identity/login", backend), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, deviceLabel: "Foundation Admin Web" }),
      cache: "no-store",
      signal: AbortSignal.timeout(45000)
    });
    if (!result.ok) {
      const data: unknown = await result.json().catch(() => null);
      const obj =
        data && typeof data === "object" && !Array.isArray(data)
          ? (data as Record<string, unknown>)
          : {};

      if (result.status === 400) {
        const codes = new Set([
          "IDENTITY_IDENTIFIER_REQUIRED",
          "IDENTITY_IDENTIFIER_INVALID",
          "IDENTITY_PASSWORD_REQUIRED",
          "IDENTITY_PASSWORD_TOO_LONG",
          "IDENTITY_DEVICE_INVALID"
        ]);
        const code = typeof obj.code === "string" && codes.has(obj.code) ? obj.code : null;
        const field = code && ["identifier", "password"].includes(String(obj.field)) ? obj.field : null;
        const message =
          code && typeof obj.message === "string" && obj.message.length <= 220
            ? obj.message
            : "Check the mobile number/email and password fields before signing in.";
        return NextResponse.json(
          { message, ...(code ? { code } : {}), ...(field ? { field } : {}) },
          { status: 400, headers: { "Cache-Control": "no-store" } }
        );
      }

      if (result.status === 403) {
        const allowed403Codes = new Set([
          "ACCOUNT_SUSPENDED",
          "IDENTITY_ACCOUNT_SUSPENDED",
          "SUSPENDED",
          "ACCOUNT_IN_STATUS_SUSPENDED",
          "ACCOUNT_DISABLED",
          "IDENTITY_ACCOUNT_DISABLED",
          "DEACTIVATED",
          "ACCOUNT_DEACTIVATED",
          "DISABLED",
          "ACCOUNT_LOCKED",
          "IDENTITY_ACCOUNT_LOCKED",
          "LOCKED",
          "FORBIDDEN"
        ]);
        const rawCode = typeof obj.code === "string" ? obj.code.trim().toUpperCase() : "";
        const code = allowed403Codes.has(rawCode) ? rawCode : "ACCOUNT_SUSPENDED";

        const rawReason =
          typeof obj.reason === "string"
            ? obj.reason
            : typeof obj.suspensionReason === "string"
            ? obj.suspensionReason
            : obj.details && typeof (obj.details as Record<string, unknown>).reason === "string"
            ? (obj.details as { reason: string }).reason
            : null;

        const reason =
          rawReason &&
          rawReason.trim().length > 0 &&
          !/error:|exception|at\s+[a-z0-9_.]+|select\s+|insert\s+|update\s+|delete\s+|nullpointer|[<>{}]|p0\d{3}/i.test(
            rawReason
          )
            ? rawReason.replace(/<[^>]*>/g, "").trim().slice(0, 180)
            : null;

        const rawMsg =
          typeof obj.message === "string" && obj.message.length >= 10 && obj.message.length <= 220
            ? obj.message
            : null;

        return NextResponse.json(
          {
            code,
            ...(reason ? { reason } : {}),
            ...(rawMsg ? { message: rawMsg } : {})
          },
          { status: 403, headers: { "Cache-Control": "no-store" } }
        );
      }

      if (result.status === 401) {
        // Identity failures share one generic server-owned, Admin-editable message.
        // Never reveal whether the identifier exists or the account is inactive.
        const payload = obj;
        const isSafe =
          payload.code==="IDENTITY_LOGIN_INVALID" &&
          typeof payload.message === "string" &&
          payload.message.length >= 16 &&
          payload.message.length <= 220 &&
          !/[<>]/.test(payload.message);

        return NextResponse.json(
          {
            code: "IDENTITY_LOGIN_INVALID",
            message: isSafe
              ? (payload.message as string)
              : "Mobile number, email or password could not be confirmed. Check your details and try again."
          },
          { status: 401, headers: { "Cache-Control": "no-store" } }
        );
      }

      if (result.status === 423) {
        return NextResponse.json(
          {
            code: "ACCOUNT_LOCKED",
            message: "Your account is temporarily locked. Please contact your administrator for assistance."
          },
          { status: 423, headers: { "Cache-Control": "no-store" } }
        );
      }

      if (result.status === 429) {
        return NextResponse.json(
          {
            code: "TOO_MANY_ATTEMPTS",
            message: "Too many sign-in attempts. Please wait a while before trying again."
          },
          { status: 429, headers: { "Cache-Control": "no-store" } }
        );
      }

      if (result.status >= 500) {
        return NextResponse.json(
          {
            code: "SERVER_UNAVAILABLE",
            message: "We're having trouble signing you in right now. Please try again shortly."
          },
          { status: 503, headers: { "Cache-Control": "no-store" } }
        );
      }

      return NextResponse.json(
        {
          code: "UNKNOWN_ERROR",
          message: "We couldn't sign you in right now. Please try again. If the problem continues, contact your administrator."
        },
        { status: result.status, headers: { "Cache-Control": "no-store" } }
      );
    }

    const data: unknown = await result.json();
    if (
      !data ||
      typeof data !== "object" ||
      !("sessionToken" in data) ||
      typeof data.sessionToken !== "string" ||
      !("expiresAt" in data) ||
      typeof data.expiresAt !== "string"
    )
      return NextResponse.json({ message: "Sign-in status could not be confirmed" }, { status: 503 });

    const expiry = new Date(data.expiresAt);
    if (!Number.isFinite(expiry.getTime()) || expiry.getTime() <= Date.now())
      return NextResponse.json({ message: "Sign-in status could not be confirmed" }, { status: 503 });

    const displayName =
      "displayName" in data && typeof data.displayName === "string" ? data.displayName : undefined;

    const response = NextResponse.json({ signedIn: true, displayName });
    const rememberMe = "rememberMe" in body && (body as { rememberMe?: boolean }).rememberMe === true;

    response.cookies.set("cg_staff_session", data.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      expires: rememberMe ? expiry : undefined
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error: unknown) {
    const isTimeout =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError");
    if (isTimeout) {
      return NextResponse.json(
        {
          code: "REQUEST_TIMEOUT",
          message: "The request took too long. Please try again."
        },
        { status: 504, headers: { "Cache-Control": "no-store" } }
      );
    }
    return NextResponse.json(
      {
        code: "SERVER_UNAVAILABLE",
        message: "We're having trouble signing you in right now. Please try again shortly."
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
