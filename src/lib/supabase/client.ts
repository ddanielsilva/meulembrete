import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    // Evita crash no `next build` quando env ainda não está configurada na Vercel (prerender).
    // Em runtime a UI mostrará erro claro. Defina as vars em Vercel → Settings → Environment Variables.
    if (typeof window === "undefined") {
      // Durante build/SSR, retorna um client dummy que não será usado (páginas são force-dynamic)
      return createBrowserClient("https://placeholder.supabase.co", "placeholder-anon-key");
    }
    throw new Error("Supabase env ausente: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY na Vercel");
  }
  return createBrowserClient(url, key);
}
