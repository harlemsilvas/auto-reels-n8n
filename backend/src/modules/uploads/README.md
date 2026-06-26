# Uploads Module

## Endpoint multi-midia

```http
POST /api/media/upload-post
Content-Type: multipart/form-data
```

Campos:

- `files`: um ou mais arquivos, conforme o tipo.
- `publishType`: `reel`, `feed_image`, `feed_carousel`, `story_image` ou
  `story_video`.
- `captionText`: opcional.
- `scheduleAt`: data/hora opcional em formato aceito por JavaScript.
- `workspaceId`: UUID opcional; sem ele, usa a primeira conta ativa.

Regras:

- `reel`: 1 MP4.
- `feed_image`: 1 JPG, JPEG ou PNG.
- `feed_carousel`: de 2 a 10 imagens ou MP4, preservando a ordem recebida.
- `story_image`: 1 JPG, JPEG ou PNG.
- `story_video`: 1 MP4.

O endpoint requer `POSTS_DATA_SOURCE=db`.

Cada arquivo cria um registro em `uploads` e `post_media_items`. O primeiro
arquivo também é referenciado por `posts.upload_id` para compatibilidade.
Todas as inserções usam uma única transação.

Arquivos gravados no disco são removidos quando a validação ou a persistência
falha.

O endpoint legado `POST /api/media/upload` permanece exclusivo para Reels e não
foi removido.
