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

export type OperationalPostsCounters = {
  pending: number;
  scheduled: number;
  queued: number;
  processing: number;
  retrying: number;
  published: number;
  error: number;
  canceled: number;
  total: number;
};

export type OperationalQueueCounters = {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
};

export type DashboardOperationalOverview = {
  generatedAt: string;
  source: "file" | "db";
  posts: OperationalPostsCounters;
  queue: OperationalQueueCounters;
};
