module.exports = {
  apps: [
    {
      name: "socialbot-backend",
      cwd: "/home/socialbot/apps/auto-reels-n8n/backend",
      script: "src/server.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "production",
        API_PORT: 3101,
        CORS_ALLOWED_ORIGINS: "https://dashboard.hrmmotos.com.br",
        MEDIA_ROOT: "/home/socialbot/media/reels",
      },
    },
  ],
};
