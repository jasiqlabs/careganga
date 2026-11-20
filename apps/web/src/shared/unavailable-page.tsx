import React from "react";
import Link from "next/link";

export interface UnavailablePageProps {
  /** Page-specific heading title (e.g., "Audit Logs unavailable") */
  title?: string;
  /** Descriptive explanation for the unavailable state */
  description?: string;
  /** Destination for the return/account action link (defaults to "/admin", pass null/undefined to hide) */
  linkHref?: string | null;
  /** Label for the return/account action link (defaults to "My account") */
  linkLabel?: string;
  /** Optional additional elements to render within the main container */
  children?: React.ReactNode;
}

/**
 * Standard reusable error / unavailable / protected-session verification failure page.
 * Renders consistent layout, typography, description, link styling, and accessibility landmarks
 * matching the canonical CareGanga reference design.
 */
export function UnavailablePage({
  title = "Unavailable",
  description = "We could not verify your current protected session.",
  linkHref = "/admin",
  linkLabel = "My account",
  children,
}: UnavailablePageProps) {
  return (
    <main className="page main">
      <h1>{title}</h1>
      <p>{description}</p>
      {linkHref ? <Link href={linkHref}>{linkLabel}</Link> : null}
      {children}
    </main>
  );
}
