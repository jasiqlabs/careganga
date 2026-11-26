"use client";

import React, { useCallback, useState } from "react";
import { usePathname } from "next/navigation";
import { CareGangaLivePreloader } from "../shared/careganga-live-preloader";

export function PublicAppClientWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isStaffRoute = pathname?.startsWith("/admin") || pathname?.startsWith("/center");
  const [loading, setLoading] = useState(true);
  const handleDone = useCallback(() => setLoading(false), []);

  return (
    <>
      {!isStaffRoute && loading && <CareGangaLivePreloader onFinish={handleDone} logoSrc="/logo.png" />}
      {children}
    </>
  );
}
