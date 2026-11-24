"use client";

import {
  BellOff,
  BellRing,
  Loader2,
  Send,
  Share,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { toast } from "sonner";

export function NotificationsCard({ userId }: { userId: string }) {
  const { status, busy, enable, disable, sendTest } = usePushNotifications(userId);

  if (status === "loading" || status === "unsupported") return null;

  async function handleEnable() {
    const ok = await enable();
    if (ok) {
      toast.success("Notificações ativadas", {
        description: "Você deve receber uma notificação de teste agora.",
      });
    } else {
      toast.error("Não foi possível ativar", {
        description:
          "Confira a permissão de notificações nas configurações do navegador.",
      });
    }
  }

  async function handleTest() {
    const ok = await sendTest();
    if (ok) {
      toast.success("Notificação de teste enviada");
    } else {
      toast.error("Não foi possível enviar o teste");
    }
  }

  if (status === "subscribed") {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm">
        <span className="flex h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
        <span className="font-medium text-emerald-700 dark:text-emerald-300">
          Notificações ativas neste aparelho
        </span>
        <div className="ml-auto flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleTest}
            disabled={busy}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Testar
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={disable}
            disabled={busy}
          >
            Desativar
          </Button>
        </div>
      </div>
    );
  }

  if (status === "needs-install") {
    return (
      <div className="rounded-xl border border-primary/25 bg-primary/5 p-3">
        <div className="flex items-start gap-2">
          <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="text-sm">
            <p className="font-medium">Instale o app para receber notificações</p>
            <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-xs text-muted-foreground">
              <li>Toque em Compartilhar no Safari.</li>
              <li>Escolha “Adicionar à Tela de Início”.</li>
              <li>Abra o app pelo ícone e ative as notificações aqui.</li>
            </ol>
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Share className="h-3.5 w-3.5" />
              Necessário no iPhone (iOS 16.4+).
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
        <div className="flex items-start gap-2">
          <BellOff className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="text-sm">
            <p className="font-medium text-amber-700 dark:text-amber-300">
              Notificações bloqueadas
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              No navegador, abra as configurações do site (ícone de cadeado) →
              Notificações → Permitir. Depois recarregue a página.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <BellRing className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Receba os lembretes no celular</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Ative as notificações para ser avisado na hora certa, mesmo com o app
            fechado.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={handleEnable}
          disabled={busy}
          className="shrink-0"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Ativar
        </Button>
      </div>
    </div>
  );
}
