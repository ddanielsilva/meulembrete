# Meu Lembrete

App pessoal para capturar lembretes em segundos — por **voz** ou texto — direto do celular ou do computador. A IA transcreve o áudio, entende a data e salva tudo no Supabase. Os lembretes sincronizam em tempo real e as notificações chegam pelo PWA, mesmo com o app fechado.

- **Stack:** Next.js 16, React 19, Tailwind v4, Supabase (mesmo projeto do mapaMental)
- **IA:** Groq — Whisper `large-v3-turbo` (transcrição) + `gpt-oss-20b` (extração de data)
- **Push:** Web Push (VAPID) + `pg_cron`/`pg_net` do Supabase
- **Deploy:** Vercel

## Como funciona

1. Toque em **Falar** e diga, por exemplo: *"me lembra de ligar pro João amanhã às 15h"*.
2. O áudio vai para `POST /api/ai/reminder`, que valida a sessão e chama o Groq.
3. O Whisper transcreve; o LLM devolve `content` + `remind_at`.
4. O lembrete é salvo no Supabase e aparece na lista (Realtime entre dispositivos).
5. No horário, um job do `pg_cron` chama `/api/cron/notify`, que envia o push.

## Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha:

| Variável | Onde obter |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API (somente servidor) |
| `GROQ_API_KEY` | https://console.groq.com/keys |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | `npx web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY` | idem |
| `VAPID_SUBJECT` | `mailto:seu@email.com` |
| `CRON_SECRET` | string aleatória longa |
| `NEXT_PUBLIC_APP_URL` | URL de produção (ex.: `https://meulembrete.vercel.app`) |

## Banco de dados

As migrations estão em `supabase/migrations`:

- `001_reminders.sql` — tabela `reminders`, RLS, Realtime e `claim_due_reminders()`
- `002_push_subscriptions.sql` — inscrições de push por usuário
- `003_cron.sql` — template do agendamento (`pg_cron` + `pg_net`)

As duas primeiras já foram aplicadas no projeto Supabase. A `003` é aplicada depois do primeiro deploy, substituindo `__APP_URL__` e `__CRON_SECRET__`.

## Rodando localmente

```bash
npm install
npm run dev
```

Abra http://localhost:3000 e entre com a mesma conta do mapaMental.

> Microfone funciona em `localhost` ou HTTPS (exigência dos navegadores).

## Deploy

1. Push na `main` (com o repositório importado na Vercel, o deploy é automático).
2. Configure as variáveis de ambiente na Vercel.
3. Aplique `003_cron.sql` com a URL final e o `CRON_SECRET`.
4. No celular, abra o site → **Adicionar à Tela de Início** → **Ativar notificações**.

No iPhone as notificações exigem iOS 16.4+ e o app instalado na Tela de Início.

## Solução de problemas

### Erro de certificado ao rodar localmente

Se a transcrição falhar no `npm run dev` com `self-signed certificate in certificate chain`, é um proxy/antivírus interceptando o HTTPS. Isso não acontece na Vercel. Como último recurso, apenas em desenvolvimento:

```powershell
$env:NODE_TLS_REJECT_UNAUTHORIZED="0"; npm run dev
```

### A notificação não chega no iPhone

Confirme: iOS 16.4+, app instalado pela Tela de Início, permissão de notificações ativa e o botão “Testar” retornando sucesso. No Android, verifique se o app não está com economia de bateria restringindo o navegador/PWA.

## Segurança

- RLS em `reminders` e `push_subscriptions`: cada usuário só acessa os próprios dados.
- `SUPABASE_SERVICE_ROLE_KEY` e `VAPID_PRIVATE_KEY` só existem no servidor.
- `/api/cron/notify` exige `Authorization: Bearer $CRON_SECRET`.
- O áudio é descartado logo após a transcrição; apenas o texto é salvo.
