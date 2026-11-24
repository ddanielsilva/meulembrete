import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GroqError, extractReminder, transcribeAudio } from "@/lib/groq";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_AUDIO_BYTES = 4 * 1024 * 1024; // 4 MB (limite de body da Vercel é 4,5 MB)
const MAX_TEXT = 2000;

type Body = {
  text?: unknown;
  timezone?: unknown;
};

function isFileLike(value: unknown): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as File).arrayBuffer === "function" &&
    typeof (value as File).size === "number"
  );
}

function localLabel(now: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone,
      dateStyle: "full",
      timeStyle: "short",
    }).format(now);
  } catch {
    return now.toLocaleString("pt-BR");
  }
}

function validTimeZone(value: string): string {
  try {
    new Intl.DateTimeFormat("pt-BR", { timeZone: value });
    return value;
  } catch {
    return "America/Sao_Paulo";
  }
}

export async function POST(request: Request) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GROQ_API_KEY não configurada no servidor." },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  let audioFile: File | null = null;
  let text = "";
  let timeZone = "America/Sao_Paulo";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("audio");
      if (isFileLike(file) && file.size > 0) audioFile = file;
      text = String(form.get("text") ?? "").trim();
      timeZone = String(form.get("timezone") ?? timeZone);
    } else {
      const body = (await request.json().catch(() => ({}))) as Body;
      text = typeof body.text === "string" ? body.text.trim() : "";
      timeZone = typeof body.timezone === "string" ? body.timezone : timeZone;
    }
  } catch {
    return NextResponse.json(
      { error: "Não foi possível ler o conteúdo enviado." },
      { status: 400 }
    );
  }

  timeZone = validTimeZone(timeZone);

  if (!audioFile && !text) {
    return NextResponse.json(
      { error: "Envie um áudio ou um texto para criar o lembrete." },
      { status: 400 }
    );
  }

  if (text.length > MAX_TEXT) {
    return NextResponse.json(
      { error: `O texto deve ter no máximo ${MAX_TEXT} caracteres.` },
      { status: 400 }
    );
  }

  if (audioFile) {
    if (!audioFile.type.startsWith("audio/")) {
      return NextResponse.json(
        { error: "Formato de áudio não suportado." },
        { status: 415 }
      );
    }
    if (audioFile.size > MAX_AUDIO_BYTES) {
      return NextResponse.json(
        { error: "Áudio muito grande. Grave no máximo 2 minutos." },
        { status: 413 }
      );
    }
  }

  try {
    const transcript = audioFile
      ? await transcribeAudio({ file: audioFile, apiKey })
      : text;

    if (!transcript.trim()) {
      return NextResponse.json(
        { error: "Não consegui ouvir nada. Tente falar mais perto do microfone." },
        { status: 422 }
      );
    }

    const now = new Date();
    const structured = await extractReminder({
      text: transcript,
      apiKey,
      timeZone,
      nowIso: now.toISOString(),
      localLabel: localLabel(now, timeZone),
    });

    return NextResponse.json({
      transcript,
      content: structured.content,
      remind_at: structured.remind_at,
      source: audioFile ? "audio" : "text",
    });
  } catch (err) {
    if (err instanceof GroqError) {
      const retryable = err.status === 429 || err.status >= 500;
      return NextResponse.json(
        {
          error: retryable
            ? "A IA está sobrecarregada agora. Tente novamente em instantes."
            : err.message,
        },
        { status: retryable ? 503 : 502 }
      );
    }
    if (err instanceof DOMException && err.name === "TimeoutError") {
      return NextResponse.json(
        { error: "A IA demorou demais para responder. Tente novamente." },
        { status: 504 }
      );
    }
    console.error("[api/ai/reminder] erro inesperado", err);
    return NextResponse.json(
      { error: "Erro inesperado ao processar o lembrete." },
      { status: 500 }
    );
  }
}
