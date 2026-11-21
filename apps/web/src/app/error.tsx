"use client";

import { useEffect } from "react";
import { AccessVerificationView } from "../shared/access-verification-view";

export default function RootErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log sanitized error diagnostic without exposing internal secrets or stack traces to end users
    const failureName = error instanceof Error && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(error.name)
      ? error.name
      : "ClientRenderError";
    try {
      console.error(
        JSON.stringify({
          at: new Date().toISOString(),
          module: "web_root",
          event: "root_error_boundary_intercepted",
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
      description="We are experiencing difficulty loading this page. Please try again shortly."
      ctaLabel="Try again"
      onCtaClick={reset}
    />
  );
}
