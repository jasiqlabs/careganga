"use client";

import React, { useCallback, useState } from "react";
import { CareGangaLivePreloader } from "../shared/careganga-live-preloader";

export function PublicAppClientWrapper({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const handleDone = useCallback(() => setLoading(false), []);

  return (
    <>
      {loading && <CareGangaLivePreloader onFinish={handleDone} logoSrc="/logo.png" />}
      {children}
    </>
  );
}
