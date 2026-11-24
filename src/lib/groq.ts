const GROQ_BASE = "https://api.groq.com/openai/v1";

export class GroqError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = "GroqError";
    this.status = status;
  }
}

const MIME_TO_EXT: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/m4a": "m4a",
  "audio/x-m4a": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/aac": "m4a",
  "audio/flac": "flac",
  "audio/x-flac": "flac",
};

function audioExtension(mimeType: string): string {
  const base = mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  return MIME_TO_EXT[base] ?? "webm";
}

async function readError(res: Response): Promise<string> {
  try {
    const text = await res.text();
    try {
      const json = JSON.parse(text) as { error?: { message?: string } };
      return json.error?.message ?? text.slice(0, 300);
    } catch {
      return text.slice(0, 300);
    }
  } catch {
    return "";
  }
}

export async function transcribeAudio({
  file,
  apiKey,
}: {
  file: File;
  apiKey: string;
}): Promise<string> {
  const model = process.env.GROQ_STT_MODEL || "whisper-large-v3-turbo";
  const form = new FormData();
  form.append("file", file, `lembrete.${audioExtension(file.type)}`);
  form.append("model", model);
  form.append("language", "pt");
  form.append("response_format", "json");
  form.append("temperature", "0");
  form.append(
    "prompt",
    "Transcrição de lembretes pessoais em português do Brasil. Preserve nomes próprios, marcas, números e horários."
  );

  const res = await fetch(`${GROQ_BASE}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const detail = await readError(res);
    throw new GroqError(`Falha na transcrição (${res.status}): ${detail}`, res.status);
  }

  const data = (await res.json()) as { text?: string };
  return (data.text ?? "").trim();
}

export interface ReminderExtraction {
  content: string;
  remind_at: string | null;
  raw: string;
}

export async function extractReminder({
  text,
  apiKey,
  timeZone,
  nowIso,
  localLabel,
}: {
  text: string;
  apiKey: string;
  timeZone: string;
  nowIso: string;
  localLabel: string;
}): Promise<ReminderExtraction> {
  const model = process.env.GROQ_LLM_MODEL || "openai/gpt-oss-20b";

  const system = [
    "Você transforma uma fala ou texto solto em um lembrete estruturado, em português do Brasil.",
    `Agora, no fuso ${timeZone}, é ${localLabel} (ISO: ${nowIso}).`,
    'Responda SOMENTE com JSON válido: {"content": string, "remind_at": string | null}.',
    "Regras de content:",
    "- Escreva o lembrete de forma curta e clara (idealmente até 90 caracteres), sem inventar informação.",
    "- Remova expressões de data/hora do content (elas vão em remind_at).",
    "- Corrija pontuação, acentuação e nomes próprios. Ex.: fala \"ligar pro joao amanha as 15\" -> content \"Ligar para o João\".",
    "Regras de remind_at:",
    "- Interprete datas relativas (hoje, amanhã, depois de amanhã, segunda, dia 5, daqui a 2 horas, meio-dia, às 15h) no fuso informado.",
    "- Se houver só data e nenhuma hora, use 09:00.",
    "- Se houver só hora e essa hora já passou hoje, use amanhã.",
    "- Se não houver nenhuma data/hora, use null.",
    "- Formato ISO 8601 com offset do fuso, ex.: 2026-11-25T15:00:00-03:00.",
  ].join("\n");

  async function callGroq(includeReasoningEffort: boolean) {
    const body: Record<string, unknown> = {
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: text },
      ],
      temperature: 0.1,
      max_tokens: 400,
      response_format: { type: "json_object" },
    };
    if (includeReasoningEffort) body.reasoning_effort = "low";

    return fetch(`${GROQ_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
  }

  let res = await callGroq(true);
  if (!res.ok && res.status === 400) {
    const detail = await readError(res);
    if (/reasoning_effort/i.test(detail)) {
      res = await callGroq(false);
    }
  }

  if (!res.ok) {
    const detail = await readError(res);
    throw new GroqError(`Falha ao interpretar o lembrete (${res.status}): ${detail}`, res.status);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = data.choices?.[0]?.message?.content ?? "";
  if (!raw.trim()) throw new GroqError("A IA não retornou conteúdo para o lembrete.");

  let parsed: { content?: unknown; remind_at?: unknown };
  try {
    parsed = JSON.parse(raw) as { content?: unknown; remind_at?: unknown };
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new GroqError("A IA retornou um formato inválido.");
    parsed = JSON.parse(match[0]) as { content?: unknown; remind_at?: unknown };
  }

  const content =
    typeof parsed.content === "string" ? parsed.content.trim().slice(0, 2000) : "";
  if (!content) throw new GroqError("A IA não conseguiu identificar o lembrete.");

  return {
    content,
    remind_at: sanitizeRemindAt(parsed.remind_at, new Date(nowIso)),
    raw,
  };
}

/** Garante uma data válida, não absurda e não muito antiga. */
export function sanitizeRemindAt(value: unknown, now: Date): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const min = now.getTime() - 24 * 60 * 60 * 1000; // até 24h no passado
  const max = now.getTime() + 5 * 365 * 24 * 60 * 60 * 1000; // até 5 anos
  if (date.getTime() < min || date.getTime() > max) return null;

  return date.toISOString();
}
