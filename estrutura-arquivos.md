```txt
auto-reels-n8n/
│
├── backend/
│   ├── src/
│   │
│   ├── app.js
│   ├── server.js
│   │
│   ├── config/
│   │   └── env.js
│   │
│   ├── lib/
│   │   ├── db.js
│   │   ├── redis.js
│   │   └── logger.js
│   │
│   ├── routes/
│   │   ├── dashboard.routes.js
│   │   └── media.routes.js
│   │
│   ├── modules/
│   │
│   │   ├── auth/
│   │   │   ├── meta-oauth.routes.js
│   │   │   ├── meta-oauth.controller.js
│   │   │   └── meta-oauth.service.js
│   │   │
│   │   ├── accounts/
│   │   │   ├── accounts.internal.routes.js
│   │   │   ├── accounts.controller.js
│   │   │   └── accounts.service.js
│   │   │
│   │   ├── posts/
│   │   │   ├── posts.internal.routes.js
│   │   │   ├── posts.controller.js
│   │   │   └── posts.service.js
│   │   │
│   │   ├── scheduler/
│   │   │   ├── scheduler.internal.routes.js
│   │   │   ├── scheduler.controller.js
│   │   │   ├── scheduler.service.js
│   │   │   └── scheduler.worker.js
│   │   │
│   │   ├── metrics/
│   │   │   ├── metrics.internal.routes.js
│   │   │   ├── metrics.controller.js
│   │   │   └── metrics.service.js
│   │   │
│   │   ├── webhooks/
│   │   │   ├── instagram-webhook.verify.js
│   │   │   ├── instagram-messages.routes.js
│   │   │   ├── instagram-messages.controller.js
│   │   │   └── instagram-messages.service.js
│   │   │
│   │   ├── conversations/
│   │   │   ├── instagram-conversations.routes.js
│   │   │   └── instagram-conversations.service.js
│   │   │
│   │   ├── messages/
│   │   │   ├── instagram-send-message.routes.js
│   │   │   ├── instagram-send-message.controller.js
│   │   │   └── instagram-send-message.service.js
│   │   │
│   │   ├── realtime/
│   │   │   ├── instagram-realtime.routes.js
│   │   │   └── instagram-realtime.service.js
│   │   │
│   │   ├── ai/
│   │   │   ├── instagram-ai.routes.js
│   │   │   ├── instagram-ai.service.js
│   │   │   ├── instagram-ai-prompts.js
│   │   │   └── instagram-ai-memory.service.js
│   │   │
│   │   ├── uploads/
│   │   │   ├── upload.routes.js
│   │   │   ├── upload.controller.js
│   │   │   └── upload.service.js
│   │   │
│   │   └── insights/
│   │       ├── insights.routes.js
│   │       ├── insights.service.js
│   │       └── insights.worker.js
│   │
│   ├── jobs/
│   │   ├── publish.job.js
│   │   ├── insights.job.js
│   │   └── ai-reply.job.js
│   │
│   ├── queues/
│   │   ├── publish.queue.js
│   │   ├── ai.queue.js
│   │   └── messages.queue.js
│   │
│   ├── middlewares/
│   │   ├── auth.middleware.js
│   │   ├── error.middleware.js
│   │   ├── request-logger.middleware.js
│   │   └── validate.middleware.js
│   │
│   ├── utils/
│   │   ├── dates.js
│   │   ├── meta.js
│   │   ├── crypto.js
│   │   └── formatters.js
│   │
│   └── database/
│       ├── migrations/
│       ├── seeds/
│       └── schema.sql
│
│
├── frontend/
│   ├── src/
│   │
│   ├── main.tsx
│   ├── App.tsx
│   │
│   ├── core/
│   │   ├── api/
│   │   │   ├── api.ts
│   │   │   └── axios.ts
│   │   │
│   │   ├── guards/
│   │   │   └── ProtectedRoute.tsx
│   │   │
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   └── PageContainer.tsx
│   │   │
│   │   └── routes/
│   │       └── AppRouter.tsx
│   │
│   ├── modules/
│   │
│   │   ├── auth/
│   │   │   ├── pages/
│   │   │   │   └── LoginPage.tsx
│   │   │   │
│   │   │   ├── services/
│   │   │   └── hooks/
│   │   │
│   │   ├── dashboard/
│   │   │   └── pages/
│   │   │       └── DashboardPage.tsx
│   │   │
│   │   ├── accounts/
│   │   │   ├── pages/
│   │   │   │   ├── AccountsPage.tsx
│   │   │   │   └── ConnectInstagramPage.tsx
│   │   │   │
│   │   │   ├── hooks/
│   │   │   ├── services/
│   │   │   └── components/
│   │   │
│   │   ├── upload/
│   │   │   ├── pages/
│   │   │   │   └── UploadPage.tsx
│   │   │   │
│   │   │   ├── components/
│   │   │   │   ├── UploadForm.tsx
│   │   │   │   ├── UploadQueue.tsx
│   │   │   │   └── UploadPreview.tsx
│   │   │   │
│   │   │   ├── hooks/
│   │   │   └── services/
│   │   │
│   │   ├── schedule/
│   │   │   ├── pages/
│   │   │   │   ├── SchedulePage.tsx
│   │   │   │   └── ScheduleSlotsPage.tsx
│   │   │   │
│   │   │   ├── hooks/
│   │   │   ├── services/
│   │   │   └── components/
│   │   │
│   │   ├── history/
│   │   │   └── pages/
│   │   │       └── HistoryPage.tsx
│   │   │
│   │   ├── inbox/
│   │   │   ├── pages/
│   │   │   │   └── InstagramInboxPage.tsx
│   │   │   │
│   │   │   ├── components/
│   │   │   │   ├── ConversationSidebar.tsx
│   │   │   │   ├── ConversationItem.tsx
│   │   │   │   ├── ConversationMessages.tsx
│   │   │   │   ├── MessageBubble.tsx
│   │   │   │   ├── MessageComposer.tsx
│   │   │   │   └── EmptyConversation.tsx
│   │   │   │
│   │   │   ├── hooks/
│   │   │   │   ├── useConversations.ts
│   │   │   │   └── useMessages.ts
│   │   │   │
│   │   │   ├── services/
│   │   │   │   └── inbox.service.ts
│   │   │   │
│   │   │   ├── types/
│   │   │   │   └── inbox.types.ts
│   │   │   │
│   │   │   └── styles/
│   │   │       └── inbox.css
│   │   │
│   │   ├── ai/
│   │   │   ├── pages/
│   │   │   ├── hooks/
│   │   │   ├── services/
│   │   │   └── components/
│   │   │
│   │   └── analytics/
│   │       ├── pages/
│   │       ├── hooks/
│   │       ├── services/
│   │       └── components/
│   │
│   ├── shared/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── utils/
│   │   ├── constants/
│   │   └── types/
│   │
│   └── styles/
│       ├── globals.css
│       └── tailwind.css
│
│
├── docker/
│   ├── nginx/
│   ├── postgres/
│   ├── redis/
│   └── n8n/
│
├── scripts/
│   ├── backup.sh
│   ├── deploy.sh
│   └── migrate.sh
│
├── .env
├── docker-compose.yml
├── package.json
└── README.md
```
