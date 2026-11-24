import Link from "next/link";
import { BellRing } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-14 items-center justify-between border-b px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary">
            <BellRing className="h-4 w-4" />
          </span>
          Meu Lembrete
        </Link>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-center justify-center bg-muted/30 p-4">
        {children}
      </main>
      <footer className="border-t px-4 py-3 text-center text-xs text-muted-foreground">
        Seus lembretes ficam salvos na sua conta Supabase e sincronizam entre
        celular e computador.
      </footer>
    </div>
  );
}
