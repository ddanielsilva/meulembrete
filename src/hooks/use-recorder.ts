"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderPhase = "idle" | "requesting" | "recording";

const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
  "audio/mpeg",
];

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type));
}

export function useRecorder({ maxSeconds = 120 }: { maxSeconds?: number } = {}) {
  const [phase, setPhase] = useState<RecorderPhase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const cancelledRef = useRef(false);
  const resolveRef = useRef<((blob: Blob | null) => void) | null>(null);

  const cleanup = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
  }, []);

  const start = useCallback(async () => {
    setError(null);

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setError("Seu navegador não permite gravar áudio. Use Chrome ou Safari atualizado.");
      return;
    }

    setPhase("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        audioBitsPerSecond: 32000,
      });

      chunksRef.current = [];
      cancelledRef.current = false;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || mimeType || "audio/webm",
        });
        const wasCancelled = cancelledRef.current;
        cancelledRef.current = false;
        cleanup();
        setPhase("idle");
        setSeconds(0);
        resolveRef.current?.(wasCancelled || blob.size === 0 ? null : blob);
        resolveRef.current = null;
      };

      recorderRef.current = recorder;
      recorder.start(1000);
      setSeconds(0);
      setPhase("recording");
    } catch (err) {
      const name = (err as DOMException)?.name;
      if (name === "NotAllowedError" || name === "SecurityError") {
        setError(
          "Permissão de microfone negada. Libere o microfone nas configurações do navegador e tente de novo."
        );
      } else if (name === "NotFoundError") {
        setError("Nenhum microfone encontrado neste aparelho.");
      } else {
        setError("Não foi possível iniciar a gravação. Tente novamente.");
      }
      cleanup();
      setPhase("idle");
      setSeconds(0);
    }
  }, [cleanup]);

  const stop = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        resolve(null);
        return;
      }
      resolveRef.current = resolve;
      recorder.stop();
    });
  }, []);

  const cancel = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      cleanup();
      setPhase("idle");
      setSeconds(0);
      return;
    }
    cancelledRef.current = true;
    resolveRef.current?.(null);
    resolveRef.current = null;
    recorder.stop();
  }, [cleanup]);

  useEffect(() => {
    if (phase !== "recording") return;
    const interval = window.setInterval(() => {
      setSeconds((value) => value + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [phase]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return { phase, seconds, error, maxSeconds, start, stop, cancel };
}
