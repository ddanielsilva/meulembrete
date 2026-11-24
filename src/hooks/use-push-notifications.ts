"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type PushStatus =
  | "loading"
  | "unsupported"
  | "needs-install"
  | "default"
  | "denied"
  | "subscribed";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    nav.standalone === true
  );
}

/** Apenas lê o estado do navegador; não chama setState. */
async function getPushStatus(): Promise<PushStatus> {
  if (typeof window === "undefined") return "loading";

  if (
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  ) {
    return isIOS() && !isStandalone() ? "needs-install" : "unsupported";
  }

  if (isIOS() && !isStandalone()) return "needs-install";
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission !== "granted") return "default";

  try {
    const registration = await navigator.serviceWorker.getRegistration("/");
    const subscription = await registration?.pushManager.getSubscription();
    return subscription ? "subscribed" : "default";
  } catch {
    return "default";
  }
}

export function usePushNotifications(userId: string) {
  const supabase = useMemo(() => createClient(), []);
  const [status, setStatus] = useState<PushStatus>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void getPushStatus().then((next) => {
      if (active) setStatus(next);
    });
    return () => {
      active = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    const next = await getPushStatus();
    setStatus(next);
  }, []);

  const enable = useCallback(async (): Promise<boolean> => {
    if (busy) return false;
    setBusy(true);

    try {
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) throw new Error("Chave pública de push não configurada.");

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "default");
        return false;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
        });
      }

      const json = subscription.toJSON();
      const endpoint = json.endpoint;
      const p256dh = json.keys?.p256dh;
      const auth = json.keys?.auth;
      if (!endpoint || !p256dh || !auth) {
        throw new Error("Assinatura de push inválida.");
      }

      const { error } = await supabase.from("push_subscriptions").upsert(
        {
          user_id: userId,
          endpoint,
          p256dh,
          auth,
          user_agent: navigator.userAgent.slice(0, 500),
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "endpoint" }
      );

      if (error) throw error;

      setStatus("subscribed");

      // Notificação de teste para confirmar que está funcionando.
      void fetch("/api/push/test", { method: "POST" }).catch(() => {});

      return true;
    } catch (err) {
      console.error("[push] enable", err);
      await refresh();
      return false;
    } finally {
      setBusy(false);
    }
  }, [busy, refresh, supabase, userId]);

  const disable = useCallback(async (): Promise<void> => {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe().catch(() => {});
        await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
      }
      setStatus(
        typeof Notification !== "undefined" && Notification.permission === "denied"
          ? "denied"
          : "default"
      );
    } catch (err) {
      console.error("[push] disable", err);
    } finally {
      setBusy(false);
    }
  }, [supabase]);

  const sendTest = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      return res.ok;
    } catch {
      return false;
    }
  }, []);

  return { status, busy, enable, disable, sendTest, refresh };
}
