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

app.disable("etag");

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

app.use((req, res, next) => {
  const startedAt = Date.now();

  console.log("======================================");
  console.log("[REQUEST]");
  console.log("METHOD:", req.method);
  console.log("URL:", req.originalUrl);
  console.log("IP:", req.ip);

  if (Object.keys(req.params || {}).length > 0) {
    console.log("PARAMS:", req.params);
  }

  if (Object.keys(req.query || {}).length > 0) {
    console.log("QUERY:", req.query);
  }

  if (
    req.body &&
    typeof req.body === "object" &&
    Object.keys(req.body).length > 0
  ) {
    const safeBody = { ...req.body };

    if (safeBody.access_token) {
      safeBody.access_token = "***hidden***";
    }

    console.log("BODY:", safeBody);
  }

  res.on("finish", () => {
    const duration = Date.now() - startedAt;

    console.log("[RESPONSE]");
    console.log("STATUS:", res.statusCode);
    console.log("DURATION:", `${duration}ms`);
    console.log("======================================");
  });

  next();
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/dashboard", dashboardRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/internal/accounts", internalAccountsRoutes);
app.use("/api/internal/posts", internalPostsRoutes);
app.use("/api/internal/scheduler", internalSchedulerRoutes);
app.use("/api/internal/metrics", internalMetricsRoutes);

// app.use((error, _req, res, _next) => {
//   const status = error?.status ?? 500;
//   const message = error?.message ?? "Erro interno do servidor.";

//   res.status(status).json({ message });
// });

app.use((error, req, res, _next) => {
  console.error("======================================");
  console.error("[ERROR]");
  console.error("METHOD:", req.method);
  console.error("URL:", req.originalUrl);
  console.error("ERROR MESSAGE:", error?.message);
  console.error("ERROR NAME:", error?.name);
  console.error("STACK:", error?.stack);
  console.error("======================================");

  const status = error?.status ?? 500;
  const message = error?.message ?? "Erro interno do servidor.";

  res.status(status).json({
    message,
    stack: process.env.NODE_ENV === "development" ? error?.stack : undefined,
  });
});

console.log("======================================");
console.log("[APP START]");
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("POSTS_DATA_SOURCE:", process.env.POSTS_DATA_SOURCE);
console.log("PORT:", process.env.PORT);
console.log("======================================");

module.exports = app;
