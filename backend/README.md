# SocialBot Backend (MVP)

Backend Node.js para o dashboard React e fluxo de upload de reels.

## Endpoints

- `GET /api/health`
- `GET /api/dashboard/summary`
- `GET /api/media/pending`
- `POST /api/media/upload` (multipart: `video`, `captionText`, opcional `accountName`, `scheduleAt`)

## Executar

1. Copie `.env.example` para `.env` (opcional)
2. Rode:

```bash
npm run dev
```

## Observacoes

- O backend cria automaticamente as pastas:
  - `/home/socialbot/media/reels/pending`
  - `/home/socialbot/media/reels/published`
  - `/home/socialbot/media/reels/error`
- Upload salva `video.mp4` + `video.txt` na pasta `pending`.
