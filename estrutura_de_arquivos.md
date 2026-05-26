backend
├── .env
├── .env.example
├── ecosystem.config.cjs
├── package-lock.json
├── package.json
├── README.md
└── src
├── app.js
├── config
│ └── env.js
├── lib
│ └── db.js
├── modules
│ ├── accounts
│ │ ├── accounts.internal.routes.js
│ │ ├── accounts.service.js
│ │ └── README.md
│ ├── metrics
│ │ ├── insights.collector.js
│ │ ├── metrics.internal.routes.js
│ │ ├── metrics.service.js
│ │ └── README.md
│ ├── posts
│ │ ├── posts.internal.routes.js
│ │ ├── posts.service.js
│ │ └── providers
│ │ ├── db-posts.provider.js
│ │ └── file-posts.provider.js
│ ├── scheduler
│ │ ├── publish.worker.js
│ │ ├── scheduler-slots.service.js
│ │ ├── scheduler.internal.routes.js
│ │ └── scheduler.queue.js
│ └── uploads
│ └── README.md
├── routes
│ ├── dashboard.routes.js
│ └── media.routes.js
├── server.js
├── services
│ └── media.service.js
├── utils
│ └── fs.utils.js
└── worker.js
dashboard
├── .env
├── .env.example
├── .gitignore
├── eslint.config.js
├── index.html
├── package-lock.json
├── package.json
├── public
│ ├── favicon.svg
│ └── icons.svg
├── README.md
├── src
│ ├── app
│ │ ├── guards
│ │ │ └── ProtectedRoute.tsx
│ │ ├── layout
│ │ │ └── AppLayout.tsx
│ │ └── routes
│ │ └── AppRouter.tsx
│ ├── App.css
│ ├── App.tsx
│ ├── assets
│ │ ├── hero.png
│ │ ├── react.svg
│ │ └── vite.svg
│ ├── index.css
│ ├── main.tsx
│ ├── modules
│ │ ├── accounts
│ │ │ ├── pages
│ │ │ │ └── AccountsPage.tsx
│ │ │ └── services
│ │ │ └── accounts.service.ts
│ │ ├── auth
│ │ │ ├── context
│ │ │ │ └── AuthContext.tsx
│ │ │ └── pages
│ │ │ └── LoginPage.tsx
│ │ ├── dashboard
│ │ │ ├── data
│ │ │ ├── hooks
│ │ │ │ └── useDashboardData.ts
│ │ │ ├── pages
│ │ │ │ └── DashboardPage.tsx
│ │ │ └── services
│ │ │ └── dashboard.service.ts
│ │ ├── history
│ │ │ ├── pages
│ │ │ │ └── HistoryPage.tsx
│ │ │ └── services
│ │ │ └── history.service.ts
│ │ ├── schedule
│ │ │ ├── pages
│ │ │ │ ├── SchedulePage.tsx
│ │ │ │ └── ScheduleSlotsPage.tsx
│ │ │ └── services
│ │ │ └── schedule.service.ts
│ │ └── upload
│ │ ├── hooks
│ │ │ └── useUploadModule.ts
│ │ ├── pages
│ │ │ └── UploadPage.tsx
│ │ └── services
│ │ └── upload.service.ts
│ └── shared
│ ├── config
│ │ └── api.ts
│ ├── lib
│ │ ├── http.ts
│ │ └── status-dictionary.ts
│ └── types
│ ├── dashboard.ts
│ └── upload.ts
├── tsconfig.app.json
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
config
├── accounts.md
├── instagran-reels-v3-webhook.json
├── nginx-socialbot-backend.conf.example
├── nginx-socialbot-dashboard.conf.example
└── socialbot.conf
