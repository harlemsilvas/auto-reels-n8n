export type Tone = "ok" | "warn" | "error" | "info";

export const STATUS_LABELS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: "Pendente", tone: "warn" },
  scheduled: { label: "Agendado", tone: "info" },
  queued: { label: "Na fila", tone: "info" },
  processing: { label: "Processando", tone: "info" },
  uploading: { label: "Enviando", tone: "info" },
  publishing: { label: "Publicando", tone: "info" },
  published: { label: "Publicado", tone: "ok" },
  retrying: { label: "Tentando novamente", tone: "warn" },
  error: { label: "Erro", tone: "error" },
  canceled: { label: "Cancelado", tone: "warn" },
};

export const EVENT_LABELS: Record<string, { label: string; tone: Tone }> = {
  queued: { label: "Enfileirado", tone: "info" },
  queue_skipped: { label: "Fila ignorada", tone: "warn" },
  processing_started: { label: "Processamento iniciado", tone: "info" },
  webhook_sent: { label: "Webhook enviado", tone: "info" },
  published: { label: "Publicado", tone: "ok" },
  publish_error: { label: "Erro na publicacao", tone: "error" },
  retry_scheduled: { label: "Nova tentativa agendada", tone: "warn" },
  canceled: { label: "Cancelado", tone: "warn" },
  metrics_collected: { label: "Metricas coletadas", tone: "ok" },
};

export function getStatusLabel(status: string | null | undefined) {
  if (!status) {
    return { label: "-", tone: "info" as Tone };
  }

  return STATUS_LABELS[status] ?? { label: status, tone: "info" };
}

export function getEventLabel(eventType: string | null | undefined) {
  if (!eventType) {
    return { label: "-", tone: "info" as Tone };
  }

  return EVENT_LABELS[eventType] ?? { label: eventType, tone: "info" };
}
