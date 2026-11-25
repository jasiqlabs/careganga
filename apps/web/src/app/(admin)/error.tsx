"use client";

import { useEffect } from "react";
import { AccessVerificationView } from "../../shared/access-verification-view";

export default function AdminErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (error.digest?.startsWith("NEXT_REDIRECT")) {
      const match = error.digest.split(";");
      const target = match.length > 2 && match[2] ? match[2] : "/admin/login";
      window.location.href = target;
      return;
    }

    // Log sanitized error diagnostic without exposing internal secrets or stack traces to end users
    const failureName = error instanceof Error && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(error.name)
      ? error.name
      : "ClientRenderError";
    try {
      console.error(
        JSON.stringify({
          at: new Date().toISOString(),
          module: "web_admin",
          event: "error_boundary_intercepted",
          failureName,
          ...(error.digest ? { digest: error.digest } : {}),
        })
      );
    } catch {
      // Diagnostic sink must not throw
    }
  }, [error]);

  return (
    <AccessVerificationView
      mode="service-unavailable"
      title="An unexpected error occurred"
      description="Something went wrong while displaying this administration page. Please try again."
      ctaLabel="Try again"
      onCtaClick={reset}
    />
  );
}
