"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
export function SignOutButton({
  variant = "default",
  className
}: {
  variant?: "default" | "icon";
  className?: string;
} = {}) {
  const router=useRouter();
  const [pending,setPending]=useState(false);
  const [error,setError]=useState("");
  async function signOut() {
    if(pending)return;
    setPending(true);setError("");
    try{
      const result=await fetch("/api/session/logout",{method:"POST",credentials:"same-origin"});
      if(!result.ok) throw new Error("revocation not confirmed");
      router.replace("/admin/login");router.refresh();
    } catch {setError("Sign-out could not be confirmed. Please retry.");setPending(false);}
  }
  if (variant === "icon") {
    return <button
      type="button"
      onClick={signOut}
      disabled={pending}
      className={className || "sidebar-logout-btn"}
      aria-label={pending ? "Signing out…" : "Sign out of Foundation account"}
      title={pending ? "Signing out…" : "Sign out"}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points="16 17 21 12 16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>;
  }
  return <div><button type="button" onClick={signOut} disabled={pending}>{pending?"Signing out…":"Sign out"}</button>{error&&<p role="alert">{error}</p>}</div>;
}
