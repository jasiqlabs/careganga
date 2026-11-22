import React from "react";
import {
  AccessVerificationView,
  type AccessVerificationMode,
} from "./access-verification-view";

export interface UnavailablePageProps {
  /** Page-specific heading title (e.g., "Audit Logs unavailable") */
  title?: string;
  /** Descriptive explanation for the unavailable state */
  description?: string;
  /** Destination for the return/account action link (defaults to "/admin", pass null/undefined to hide) */
  linkHref?: string | null;
  /** Label for the return/account action link (defaults to "My account") */
  linkLabel?: string;
  /** Explicit verification mode override */
  mode?: AccessVerificationMode;
  /** Optional additional elements to render within the main container */
  children?: React.ReactNode;
}

/**
 * Standard reusable error / unavailable / protected-session verification failure page.
 * Renders consistent layout, typography, description, link styling, and accessibility landmarks
 * matching the canonical CareGanga reference design by delegating to AccessVerificationView.
 */
export function UnavailablePage({
  title = "Unavailable",
  description = "Protected information is temporarily unavailable. Please try again shortly.",
  linkHref = "/admin",
  linkLabel = "My account",
  mode,
  children,
}: UnavailablePageProps) {
  // Infer mode if not explicitly provided:
  // - If linkHref points to public routes ("/" or "/ngo-information"), use "service-unavailable".
  // - If description explicitly states session verification failure, use "unverified-access".
  // - Otherwise, default to "service-unavailable" so infrastructure failures do not blame user sessions.
  const resolvedMode: AccessVerificationMode =
    mode ??
    (linkHref === "/" || linkHref?.startsWith("/ngo-information")
      ? "service-unavailable"
      : description.toLowerCase().includes("session")
        ? "unverified-access"
        : "service-unavailable");

  return (
    <AccessVerificationView
      mode={resolvedMode}
      title={title}
      description={description}
      ctaHref={linkHref}
      ctaLabel={linkLabel}
    >
      {children}
    </AccessVerificationView>
  );
}
