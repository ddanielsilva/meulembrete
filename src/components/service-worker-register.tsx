"use client";

import { useEffect } from "react";

/** Registra o service worker para o app ser instalável (PWA). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // instalação do PWA é opcional; push será avisado na UI
    });
  }, []);

  return null;
}
