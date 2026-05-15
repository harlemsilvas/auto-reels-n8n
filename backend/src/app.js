const express = require("express");
const cors = require("cors");
const dashboardRoutes = require("./routes/dashboard.routes");
const mediaRoutes = require("./routes/media.routes");
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

app.use((error, _req, res, _next) => {
  const status = error?.status ?? 500;
  const message = error?.message ?? "Erro interno do servidor.";

  res.status(status).json({ message });
});

module.exports = app;
