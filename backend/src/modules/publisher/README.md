# Publisher Module

Camada de roteamento por tipo de publicacao criada na Fase 4.

Entrada comum:

```js
const { publishPost } = require("./publisher.service");

await publishPost(post);
```

Tipos roteados:

- `reel`
- `feed_image`
- `feed_carousel`
- `story_image`
- `story_video`

Compatibilidade:

- aceita `post.publishType`;
- aceita `post.publish_type`;
- assume `reel` quando o campo nao existe, para registros legados.

Estado atual:

- o modulo esta conectado ao worker pela Fase 9;
- a integracao multi-tipo depende de `MULTI_PUBLISH_ENABLED=true`;
- o valor padrao e `false`;
- Feed Imagem está implementado com o fluxo
  `/{ig-user-id}/media` seguido de `/{ig-user-id}/media_publish`;
- Carrossel cria os filhos em ordem, aguarda vídeos, cria o container pai,
  aguarda o pai e publica;
- Stories criam container com `media_type=STORIES`; vídeo aguarda
  processamento antes de publicar;
- as estratégias somente fazem chamada de rede quando `publishPost` for
  invocado;
- Reel ainda retorna `PUBLISH_STRATEGY_NOT_IMPLEMENTED`;
- tipos desconhecidos retornam `UNSUPPORTED_PUBLISH_TYPE`.

O Reel continua sendo publicado exclusivamente pelo worker/n8n existente.
O fallback n8n para Reels permanece obrigatorio.

Feed Imagem requer:

- `igAccountId` ou `instagramId`;
- `metaToken` ou `accessToken`;
- URL pública explícita em `imageUrl`, `mediaPublicUrl` ou no item de mídia;
- alternativamente, `storedFilename` e `MEDIA_PUBLIC_BASE_URL`.

Resultado:

```js
{
  publishType: "feed_image",
  metaContainerId: "...",
  metaMediaId: "..."
}
```

Carrossel requer `mediaItems` com 2 a 10 itens. Cada item deve conter:

- `mediaKind` ou `media_kind`: `image` ou `video`;
- URL pública explícita ou filename armazenado;
- `sortOrder` ou `sort_order`.

Resultado adicional:

```js
{
  publishOptions: {
    carouselChildren: ["...", "..."],
    parentContainerId: "..."
  }
}
```

Stories requerem exatamente um item:

- `story_image`: item `image`;
- `story_video`: item `video`.

A legenda de Story não é enviada à Meta.
