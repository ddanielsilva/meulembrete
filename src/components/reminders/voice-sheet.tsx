"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { RecorderPhase } from "@/hooks/use-recorder";
import { Loader2, Mic, RotateCcw, Square } from "lucide-react";

export type VoiceSaveStage = "uploading" | "saving";

interface VoiceSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phase: RecorderPhase;
  seconds: number;
  maxSeconds: number;
  error: string | null;
  stage: VoiceSaveStage | null;
  onStop: () => void;
  onRetry: () => void;
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function VoiceSheet({
  open,
  onOpenChange,
  phase,
  seconds,
  maxSeconds,
  error,
  stage,
  onStop,
  onRetry,
}: VoiceSheetProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value && stage) return;
        onOpenChange(value);
      }}
    >
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-center">Novo lembrete por voz</DialogTitle>
          <DialogDescription className="text-center">
            Fale naturalmente. A IA transcreve e salva automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          {stage ? (
            <>
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm font-medium">
                {stage === "uploading"
                  ? "Transcrevendo o áudio..."
                  : "Salvando o lembrete..."}
              </p>
              <p className="text-xs text-muted-foreground">
                Isso leva só alguns segundos.
              </p>
            </>
          ) : phase === "recording" ? (
            <>
              <div className="relative flex h-28 w-28 items-center justify-center">
                <span className="recording-pulse absolute inset-0 rounded-full" />
                <Button
                  type="button"
                  size="icon"
                  onClick={onStop}
                  className="relative h-20 w-20 rounded-full bg-destructive text-white shadow-lg hover:bg-destructive/90"
                  aria-label="Parar gravação"
                >
                  <Square className="h-7 w-7 fill-current" />
                </Button>
              </div>
              <p className="font-mono text-2xl tabular-nums">
                {formatDuration(seconds)}
              </p>
              <p className="text-center text-xs text-muted-foreground">
                Toque no quadrado para parar
                <br />
                tempo máximo: {Math.floor(maxSeconds / 60)} minutos
              </p>
            </>
          ) : phase === "requesting" ? (
            <>
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm font-medium">Preparando o microfone...</p>
            </>
          ) : (
            <>
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
                <Mic className="h-9 w-9 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                {error ? "A gravação não iniciou." : "Pronto para gravar."}
              </p>
            </>
          )}
        </div>

        {error && !stage && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={Boolean(stage)}
          >
            Cancelar
          </Button>
          {error && !stage && (
            <Button type="button" className="flex-1" onClick={onRetry}>
              <RotateCcw className="h-4 w-4" />
              Gravar de novo
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
