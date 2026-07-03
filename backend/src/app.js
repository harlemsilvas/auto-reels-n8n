const express = require("express");
const cors = require("cors");

const dashboardRoutes = require("./routes/dashboard.routes");
const mediaRoutes = require("./routes/media.routes");

const internalAccountsRoutes = require("./modules/accounts/accounts.internal.routes");
const internalPostsRoutes = require("./modules/posts/posts.internal.routes");
const internalSchedulerRoutes = require("./modules/scheduler/scheduler.internal.routes");
const internalMetricsRoutes = require("./modules/metrics/metrics.internal.routes");
const internalQueueRoutes = require("./modules/queue/queue.internal.routes");
const historyRoutes = require("./modules/history/history.routes");
const instagramMessagesRoutes = require("./modules/webhooks/instagram-messages.routes");

const instagramSendInternalRoutes = require("./modules/instagram/instagram-send.internal.routes");

const instagramConversationsRoutes = require("./modules/conversations/instagram-conversations.routes");
const instagramSendMessageRoutes = require("./modules/inbox/instagram-send-message.routes");
const testersDmRoutes = require("./modules/inbox/testers-dm.routes");
const usersRoutes = require("./modules/users/users.routes");

const realtimeRoutes = require("./modules/realtime/realtime.routes");

const metaOAuthRoutes = require("./modules/auth/meta-oauth.routes");
const adminAuthRoutes = require("./modules/auth/admin-auth.routes");
const {
  ADMIN_AUTH_ENABLED,
  getAllowedOrigins,
} = require("./config/env");
const {
  requireAdminSession,
  requireCsrf,
  requirePasswordChanged,
  requirePermission,
} = require("./modules/auth/admin-auth.middleware");
const { PERMISSIONS } = require("./modules/auth/permissions.service");

const mediaInternalRoutes = require("./modules/media/media.internal.routes");

const app = express();

app.disable("etag");

const allowedOrigins = getAllowedOrigins();

if (allowedOrigins === "*") {
  app.use(cors());
} else {
  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true,
    }),
  );
}

app.use(express.json());

app.use("/api/webhooks/instagram", instagramMessagesRoutes);

app.use("/api/auth", adminAuthRoutes);
app.use("/api/auth/meta", metaOAuthRoutes);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use((req, res, next) => {
  if (!ADMIN_AUTH_ENABLED) {
    return next();
  }

  return requireAdminSession(req, res, next);
});

app.use((req, res, next) => {
  if (
    !ADMIN_AUTH_ENABLED ||
    ["GET", "HEAD", "OPTIONS"].includes(req.method)
  ) {
    return next();
  }

  return requireCsrf(req, res, next);
});

app.use((req, res, next) => {
  if (!ADMIN_AUTH_ENABLED) {
    return next();
  }

  return requirePasswordChanged(req, res, next);
});

app.use(
  "/api/internal/instagram",
  ...(ADMIN_AUTH_ENABLED
    ? [requirePermission(PERMISSIONS.INBOX_REPLY)]
    : []),
  instagramSendInternalRoutes,
);

app.use(
  "/api/internal/conversations",
  ...(ADMIN_AUTH_ENABLED
    ? [requirePermission(PERMISSIONS.INBOX_VIEW)]
    : []),
  instagramConversationsRoutes,
);

app.use(
  "/api/inbox/send-message",
  ...(ADMIN_AUTH_ENABLED
    ? [requirePermission(PERMISSIONS.INBOX_REPLY)]
    : []),
  instagramSendMessageRoutes,
);

app.use(
  "/api/realtime",
  ...(ADMIN_AUTH_ENABLED
    ? [requirePermission(PERMISSIONS.INBOX_VIEW)]
    : []),
  realtimeRoutes,
);

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

    if (process.env.NODE_ENV !== "production") {
      console.log("BODY:", safeBody);
    }
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

app.use(
  "/api/dashboard",
  ...(ADMIN_AUTH_ENABLED
    ? [requirePermission(PERMISSIONS.METRICS_VIEW)]
    : []),
  dashboardRoutes,
);
app.use(
  "/api/history",
  ...(ADMIN_AUTH_ENABLED
    ? [requirePermission(PERMISSIONS.METRICS_VIEW)]
    : []),
  historyRoutes,
);
app.use("/api/media", mediaRoutes);

app.use(
  "/api/internal/accounts",
  ...(ADMIN_AUTH_ENABLED
    ? [requirePermission(PERMISSIONS.ACCOUNTS_MANAGE)]
    : []),
  internalAccountsRoutes,
);
app.use("/api/internal/users", usersRoutes);
app.use("/api/internal/posts", internalPostsRoutes);
app.use("/api/internal/scheduler", internalSchedulerRoutes);
app.use("/api/internal/queue", internalQueueRoutes);
app.use(
  "/api/internal/metrics",
  ...(ADMIN_AUTH_ENABLED
    ? [requirePermission(PERMISSIONS.METRICS_VIEW)]
    : []),
  internalMetricsRoutes,
);
app.use(
  "/api/metrics",
  ...(ADMIN_AUTH_ENABLED
    ? [requirePermission(PERMISSIONS.METRICS_VIEW)]
    : []),
  internalMetricsRoutes,
);

app.use(
  "/api/internal/messages",
  ...(ADMIN_AUTH_ENABLED
    ? [requirePermission(PERMISSIONS.INBOX_REPLY)]
    : []),
  instagramSendMessageRoutes,
);
app.use(
  "/api/internal/testers-dm",
  ...(ADMIN_AUTH_ENABLED
    ? [requirePermission(PERMISSIONS.INBOX_MANAGE_TESTERS)]
    : []),
  testersDmRoutes,
);

app.use("/api/internal/media", mediaInternalRoutes);

// app.use((error, _req, res, _next) => {
//   const status = error?.status ?? 500;
//   const message = error?.message ?? "Erro interno do servidor.";

//   res.status(status).json({ message });
// });

app.use((error, req, res, _next) => {
  if (process.env.NODE_ENV !== "production") {
    console.error("======================================");
    console.error("[ERROR]");
    console.error("METHOD:", req.method);
    console.error("URL:", req.originalUrl);
    console.error("ERROR MESSAGE:", error?.message);
    console.error("ERROR NAME:", error?.name);
    console.error("STACK:", error?.stack);
    console.error("======================================");
  }

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
