const express = require("express");
const cors = require("cors");
const dashboardRoutes = require("./routes/dashboard.routes");
const mediaRoutes = require("./routes/media.routes");
const internalAccountsRoutes = require("./modules/accounts/accounts.internal.routes");
const internalPostsRoutes = require("./modules/posts/posts.internal.routes");
const internalSchedulerRoutes = require("./modules/scheduler/scheduler.internal.routes");
const internalMetricsRoutes = require("./modules/metrics/metrics.internal.routes");
const { getAllowedOrigins } = require("./config/env");

const app = express();
const allowedOrigins = getAllowedOrigins();

if (allowedOrigins === "*") {
  app.use(cors());
} else {
  app.use(
    cors({
      origin: allowedOrigins,
    }),
  );
}

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/dashboard", dashboardRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/internal/accounts", internalAccountsRoutes);
app.use("/api/internal/posts", internalPostsRoutes);
app.use("/api/internal/scheduler", internalSchedulerRoutes);
app.use("/api/internal/metrics", internalMetricsRoutes);

app.use((error, _req, res, _next) => {
  const status = error?.status ?? 500;
  const message = error?.message ?? "Erro interno do servidor.";

  res.status(status).json({ message });
});

module.exports = app;
