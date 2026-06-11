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
  scheduledAt: string | null;
  status: string;
};

export type DashboardCounters = {
  publishedToday: number;
  publishedWeek: number;
  pending: number;
  scheduled: number;
  queued: number;
  processing: number;
  retrying: number;
  error: number;
  canceled: number;
};

export type DashboardExecutiveSummary = {
  totalPublished: number;
  totalViews: number;
  totalLikes: number;
  averageEngagement: number;
};

export type TopPostItem = {
  postId: string;
  videoFilename: string | null;
  caption: string | null;
  likes: number;
  reach: number;
  views: number;
  engagementRate: number;
  fetchedAt: string;
};

export type DashboardSummary = {
  metrics: Metric[];
  queue: QueueItem[];
  counters: DashboardCounters;
  executive: DashboardExecutiveSummary;
};

export type DashboardQueueStats = {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
};
