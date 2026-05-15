export type MetricTone = "ok" | "warn" | "danger";

export type Metric = {
  label: string;
  value: string;
  trend: string;
  tone: MetricTone;
};

export type QueueItem = {
  id: string;
  accountName: string;
  videoName: string;
  scheduledAt: string;
  status: "processando" | "agendado" | "aguardando" | "erro";
};

export type DashboardSummary = {
  metrics: Metric[];
  queue: QueueItem[];
};
