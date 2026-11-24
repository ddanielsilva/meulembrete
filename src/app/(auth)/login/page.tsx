export const dynamic = "force-dynamic";

import { AuthForm } from "@/components/auth/auth-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const callbackError =
    params.error === "callback_failed"
      ? "Não foi possível concluir o login com Google. Confira se a URL de redirecionamento está liberada no Supabase."
      : null;

  return <AuthForm callbackError={callbackError} />;
}
