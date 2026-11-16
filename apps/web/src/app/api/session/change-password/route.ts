import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== request.nextUrl.origin)
    return NextResponse.json({ message: "Request could not be completed" }, { status: 403 });

  const session = (await cookies()).get("cg_staff_session")?.value;
  if (!session)
    return NextResponse.json({ message: "Sign in to change password" }, { status: 401 });

  const backend = process.env.BACKEND_URL;
  if (!backend)
    return NextResponse.json({ message: "Service temporarily unavailable" }, { status: 503 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid password details." }, { status: 400 });
  }

  try {
    const res = await fetch(new URL("/api/identity/change-password", backend), {
      method: "POST",
      headers: {
        Authorization: "Bearer " + session,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(10000)
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { message: data?.message ?? "Password update could not be completed." },
        { status: res.status }
      );
    }
    const response = NextResponse.json(data, { status: 200 });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    return NextResponse.json({ message: "The password update outcome could not be confirmed." }, { status: 503 });
  }
}

