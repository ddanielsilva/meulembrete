export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { BellRing } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { ServiceWorkerRegister } from "@/components/service-worker-register";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims) redirect("/login");

  const email = (claims as { email?: string }).email ?? "";

  return (
    <div className="flex min-h-dvh flex-col">
      <ServiceWorkerRegister />
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 pt-safe backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center justify-between px-4">
          <Link href="/lembretes" className="flex items-center gap-2 font-semibold">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary">
              <BellRing className="h-4 w-4" />
            </span>
            Meu Lembrete
          </Link>
          <div className="flex items-center gap-1">
            <span className="hidden max-w-[180px] truncate text-xs text-muted-foreground sm:inline">
              {email}
            </span>
            <ThemeToggle />
            <form action="/auth/signout" method="post">
              <Button variant="ghost" size="sm" type="submit">
                Sair
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-28 pt-4 sm:pb-10">
        {children}
      </main>
    </div>
  );
}
