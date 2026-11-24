import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
import type { Reminder } from "@/types/reminder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const received = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function pushPayload(reminder: Reminder) {
  const body =
    reminder.content.length > 160
      ? `${reminder.content.slice(0, 157)}...`
      : reminder.content;

  return JSON.stringify({
    title: "⏰ Lembrete",
    body,
    url: `/lembretes?highlight=${reminder.id}`,
    tag: reminder.id,
  });
}

async function handle(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT || "mailto:contato@example.com";

  if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey) {
    return NextResponse.json(
      { error: "server_not_configured" },
      { status: 503 }
    );
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.rpc("claim_due_reminders", {
    p_limit: 50,
  });

  if (error) {
    console.error("[api/cron/notify] claim_due_reminders", error);
    return NextResponse.json({ error: "claim_failed" }, { status: 500 });
  }

  const due = (data ?? []) as Reminder[];
  let sent = 0;
  let failed = 0;
  let removed = 0;

  for (const reminder of due) {
    const { data: subscriptions, error: subsError } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", reminder.user_id);

    if (subsError) {
      console.error("[api/cron/notify] subscriptions", subsError);
      failed += 1;
      continue;
    }

    if (!subscriptions?.length) continue;

    let delivered = 0;
    let transientFailure = false;

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          pushPayload(reminder),
          { TTL: 3600 }
        );
        delivered += 1;
        sent += 1;
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
          removed += 1;
        } else {
          transientFailure = true;
          failed += 1;
          console.error(
            "[api/cron/notify] sendNotification",
            statusCode,
            (err as Error).message
          );
        }
      }
    }

    // Se nenhum aparelho recebeu por falha temporária, devolve para a fila
    // e o próximo minuto tenta de novo.
    if (delivered === 0 && transientFailure) {
      await supabase
        .from("reminders")
        .update({ notified_at: null })
        .eq("id", reminder.id);
    }
  }

  return NextResponse.json({
    claimed: due.length,
    sent,
    failed,
    removed,
  });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
