# SocialBot — Contexto de Continuidade para Codex

Atualizado em: 2026-07-14

## Objetivo

Este documento é o ponto de retomada para sessões do Codex no VS Code e no
desktop. Antes de alterar o projeto, ler este arquivo e
`docs/0006-mult-posts.md`.

O objetivo atual é evoluir o SocialBot para publicações Instagram de múltiplos
tipos sem quebrar o fluxo existente de Reels.

## Repositório e execução

- Repositório Windows: `C:\Projetos\auto-reels-n8n`
- Repositório no WSL: `/mnt/c/Projetos/auto-reels-n8n`
- Backend: `backend/`
- Dashboard: `dashboard/`
- Schema inicial: `postgres-init/000_socialbot_init.sql`
- Migrations manuais: `backend/sql/`
- Docker Compose: `docker-compose.yml`

O backend de desenvolvimento é executado no WSL e o Docker Desktop no Windows.

## Regra de ambiente: local versus VPS

Tratar configuração local e configuração da VPS como ambientes diferentes.

### Ambiente local

- É permitido ajustar portas e endereços locais quando houver conflito.
- PostgreSQL Docker local está publicado em `127.0.0.1:55532`.
- PostgreSQL dentro da rede Docker continua em `postgres:5432`.
- Backend local usa `DB_HOST=localhost` e `DB_PORT=55532`.
- Redis local permanece publicado em `56379`.
- n8n local permanece publicado em `5678`.

A porta local anterior `55432` pertence à faixa reservada pelo Windows
`55406–55505` e não deve voltar a ser usada nesta máquina.

### VPS

- Não alterar portas, hosts, URLs, proxy, PM2, Docker, n8n ou firewall da VPS
  por inferência.
- A VPS está operacional com configuração própria.
- Mudanças locais de porta não devem ser copiadas automaticamente para a VPS.
- Antes de qualquer alteração de infraestrutura na VPS, inspecionar a
  configuração real e pedir autorização quando a mudança não estiver
  explicitamente solicitada.
- Migrations SQL podem ser preparadas para a VPS, mas devem ser idempotentes,
  transacionais e precedidas de backup/verificação.

## Estado concluído: fases 1 e 2

Documento de origem: `docs/0006-mult-posts.md`.

Migration criada:

- `backend/sql/006-mult-posts-phase-1-2.sql`
- `backend/sql/006-mult-posts-phase-1-2-verify.sql`

A migration local já foi aplicada pelo usuário.

### Campos adicionados em `posts`

- `publish_type`, padrão `reel`
- `media_type`
- `carousel_children`
- `cover_image_filename`
- `publish_options`

Valores permitidos para `publish_type`:

- `reel`
- `feed_image`
- `feed_carousel`
- `story_image`
- `story_video`

### Tabela adicionada

`post_media_items`, com FKs para `posts` e `workspaces`, checks de domínio,
índices e unicidade de `(post_id, sort_order)` para itens ativos.

Reels antigos continuam usando:

- `posts.video_filename`
- `posts.source_path`
- `posts.media_size`

Não fazer backfill obrigatório dos Reels antigos sem uma necessidade concreta.

## Backend implementado

Arquivo principal:

- `backend/src/modules/posts/providers/db-posts.provider.js`

O upload atual de Reel agora cria, na mesma transação:

1. `uploads`
2. `posts`
3. `post_media_items`

Comportamento:

- `BEGIN` antes das inserções.
- `COMMIT` somente depois das três inserções.
- `ROLLBACK` em qualquer falha.
- `publish_type = 'reel'`.
- `media_type = 'video'`.
- `post_media_items.media_kind = 'video'`.
- O endpoint antigo continua aceitando apenas um `.mp4`.
- O worker e o fluxo n8n de publicação de Reels não foram alterados.

A rota `backend/src/routes/media.routes.js` agora encaminha o MIME type real.

## Schema inicial

`postgres-init/000_socialbot_init.sql` foi alinhado com o backend:

- adiciona `uploads.workspace_id`;
- inclui as colunas legadas usadas pelo código em `posts`;
- inclui os campos das fases 1 e 2;
- cria `post_media_items`;
- cria constraints e índices;
- remove saída de terminal que estava colada no final do SQL.

Uma instalação limpa foi exercitada em banco temporário.

## Validações já realizadas

- PostgreSQL local: versão 15.
- Extensões `pgcrypto` e `uuid-ossp` disponíveis.
- Posts existentes têm workspace válido.
- Posts existentes mantêm `publish_type = 'reel'`.
- Migration executada duas vezes em transação com rollback para validar
  idempotência.
- Sintaxe JavaScript validada com `node --check`.
- Fluxos simulados de `COMMIT` e `ROLLBACK` do provider aprovados.
- Conexão do backend no WSL ao PostgreSQL local validada.
- Dados locais existentes foram preservados.
- Teste ponta a ponta do upload legado de Reel aprovado em 2026-06-25:
  - post `43c42908-427d-44fb-bbe4-03d7322239f9`;
  - status `scheduled`;
  - agendamento para `2026-06-25 12:00:00-03`;
  - registros correlacionados em `uploads`, `posts` e `post_media_items`;
  - `publish_type = 'reel'`, `media_type = 'video'`;
  - `media_kind = 'video'`, `sort_order = 0`;
  - nenhum upload ou item de mídia ausente;
  - nenhuma divergência de workspace.

## Fase 3 implementada no backend

O backend agora possui:

- `POST /api/media/upload-post`;
- campo multipart `files`;
- validação de `reel`, `feed_image`, `feed_carousel`, `story_image` e
  `story_video`;
- carrossel misto com 2 a 10 imagens ou vídeos;
- preservação da ordem em `post_media_items.sort_order`;
- um registro em `uploads` para cada arquivo;
- `posts.upload_id` apontando para o primeiro arquivo por compatibilidade;
- rollback do banco e limpeza dos arquivos locais quando ocorre falha;
- suporte somente ao provider de banco para o endpoint novo;
- filtro de segurança em `listReadyPosts`: apenas `publish_type = 'reel'`
  entra no worker atual.

O endpoint legado `POST /api/media/upload` permanece inalterado para Reels.
O worker e o publisher n8n não foram modificados.

Validações realizadas:

- sintaxe dos arquivos JavaScript;
- matriz dos cinco tipos de publicação;
- carrossel misto;
- rejeição de tipo, quantidade e MIME inválidos;
- ordem dos itens;
- `COMMIT` em sucesso e `ROLLBACK` em falha simulada;
- existência da rota confirmada em instância temporária;
- requisição sem arquivos rejeitada com HTTP 400;
- nenhum registro real criado pelos testes automatizados.

Teste real realizado em 2026-06-25:

- `feed_image` criado pelo endpoint novo com HTTP 201;
- post `6bd0df65-953d-40a6-a10d-2a0bae402a2f`;
- arquivo original `hero.png`;
- arquivo armazenado `hero_76d2eff2.png`;
- um registro em `uploads`;
- um registro em `post_media_items`;
- `publish_type = 'feed_image'`;
- `media_type = 'image'`;
- `media_kind = 'image'`;
- `sort_order = 0`;
- nenhuma divergência de workspace;
- `video_filename` e `media_size` legados permaneceram nulos;
- o cálculo da data no comando de teste falhou, portanto o post ficou
  `pending`, sem `scheduled_at`;
- mesmo pendente, o post não apareceu em `/api/internal/posts/ready`;
- nenhuma publicação externa foi disparada.

## Próximo passo recomendado

O endpoint real da Fase 3 está validado. Agora é seguro avançar para a estratégia
de Feed Imagem da Fase 6 ou criar a interface do dashboard para os uploads
multi-tipo. O post de teste `feed_image` permanecerá parado enquanto nenhuma
estratégia correspondente estiver conectada ao fluxo de publicação.

## Fase 4 implementada estruturalmente

Foi criado `backend/src/modules/publisher/` com:

- `publisher.service.js`;
- `publisher.errors.js`;
- `publish-reel.strategy.js`;
- `publish-feed-image.strategy.js`;
- `publish-carousel.strategy.js`;
- `publish-story.strategy.js`;
- `README.md`.

Contrato:

```js
const { publishPost } = require("./publisher.service");

await publishPost(post);
```

Comportamento atual:

- aceita `publishType` e `publish_type`;
- assume `reel` para posts legados sem tipo;
- roteia os cinco tipos de publicação;
- Stories de imagem e vídeo compartilham a estratégia de Story;
- tipos desconhecidos geram `UNSUPPORTED_PUBLISH_TYPE`;
- Reel, Carrossel e Stories ainda geram
  `PUBLISH_STRATEGY_NOT_IMPLEMENTED`;
- Feed Imagem está implementado e pode realizar chamada à Meta quando invocado;
- o módulo ainda não está conectado ao worker.

O arquivo `publish.worker.js` não foi alterado. Reels continuam exclusivamente
no fluxo atual n8n.

Validações:

- sintaxe de todos os arquivos do publisher;
- roteamento dos cinco tipos;
- compatibilidade com posts legados;
- erros tipados e respectivos status;
- confirmação de ausência de diff no worker.

## Próximo passo após a Fase 4

O teste real do endpoint da Fase 3 foi concluído. Seguir para a Fase 5 mantendo
o Reel no n8n atual, ou para a Fase 6 implementando Feed Imagem. Não conectar
`publisher.service.js` ao worker antes da Fase 9.

## Retomada em 2026-06-26 — estado local antes de preparar VPS

O desenvolvimento local avançou além da Fase 4. Antes de subir para a VPS,
revalidar os diffs reais do repositório e tratar este bloco como contexto de
retomada, não como substituto de revisão de código.

### Implementado localmente após a Fase 4

- Fase 6: publicação Feed Imagem preparada no publisher Meta.
- Fases 7 e 8: carrossel e stories preparados no publisher.
- Fase 9: worker integrado ao publisher multi-tipo com feature flag segura.
- Fase 10: interface de upload multi-tipo criada no dashboard.
- Fase 11: tela de agendamentos ajustada para exibir tipo/mídia/quantidade.
- Agendamentos agora limitam tentativas e habilitam cancelamento/exclusão em
  estados pendentes, agendados, enfileirados, retentativa e erro.
- O token Meta não deve ser exposto na interface.

### Flags e comportamento atual

- `MULTI_PUBLISH_ENABLED=false` no ambiente local no último teste.
- Com a flag desligada, Feed, Carrossel e Stories podem ser criados/agendados,
  mas não devem publicar pelo worker.
- Reels continuam obrigatoriamente pelo fluxo n8n.
- Não habilitar multi-publicação na VPS sem teste controlado e escolha explícita
  de um post alvo.

### Ambiente local usado no teste

- PostgreSQL Docker local publicado em `127.0.0.1:55532`.
- Redis local publicado em `56379`.
- n8n local publicado em `5678`.
- Backend local em `3101`.
- Servidor HTTP de mídia no WSL em `127.0.0.1:8090`, servindo
  `/home/socialbot/media/reels`.
- URL pública temporária via ngrok:
  `https://chad-woozier-tara.ngrok-free.dev`.

Esses valores são somente locais. Não copiar portas locais nem URL ngrok para a
VPS. A VPS já possui portas, domínio e n8n próprios.

### n8n local

Workflow importado da VPS:

- Nome: `Instagram Reels Webhook Publisher v3 (Safe)`.
- ID: `pwQv3EWGGiY51ftz`.
- Webhook esperado: `POST /webhook/socialbot-publish`.
- O workflow espera receber `metaToken` no payload.

O nó de preparação de payload deve preferir `mediaPublicUrl` recebido do backend.
Se usar fallback por base URL, cuidar para não duplicar nem omitir `/pending`.

### Teste real de publicação Reel em 2026-06-25

Post testado:

- ID: `f369cee5-2ec0-4814-a9d4-8e2a252aba46`.
- Tipo: `reel`.
- Arquivo: `142xt_potenza_xt_bdd1e515.mp4`.
- Agendado para `2026-06-25 19:30:00-03`.
- Status final no banco: `published`.
- `published_at`: `2026-06-25 19:37:30-03`.
- `meta_container_id`: `18541896028078109`.
- `meta_media_id`: `18112619714489157`.
- Redis/BullMQ: job finalizado em `completed`.
- n8n: duas execuções webhook com status `success`.

Observação importante: a primeira tentativa executou no n8n, mas retornou para o
backend com `status=published` e `publishId=null`. O worker tratou como erro e
fez retry. A segunda tentativa retornou `publishId` corretamente e marcou o post
como publicado.

Antes de subir para VPS, corrigir ou revisar o retorno final do workflow/worker
para evitar retry indevido quando a Meta já publicou mas o `publishId` não foi
propagado. Esse é o principal risco de duplicidade.

### Posts locais relevantes

- `f369cee5-2ec0-4814-a9d4-8e2a252aba46`: Reel publicado com sucesso.
- `c86fed7b-697e-4a3d-9972-f4f6a20a72ca`: Reel agendado para
  `2026-06-26 08:00:00-03`.
- `52a5f978-5b9b-4efb-98a9-b123e663224a`: Feed Imagem agendado localmente.
- `e6964574-32a6-405f-96b4-d5d1d441345d`: Feed Carrossel agendado localmente.

Com `MULTI_PUBLISH_ENABLED=false`, os posts multi-tipo não devem publicar.

### Pendências antes da VPS

1. Revisar todos os diffs locais com `git status --short` e diffs por escopo.
2. Executar `node --check` nos arquivos JavaScript alterados do backend.
3. Executar build/lint do dashboard, se disponível.
4. Garantir que a migration `backend/sql/006-mult-posts-phase-1-2.sql` é a única
   mudança de schema necessária para a VPS, ou criar migration adicional
   idempotente se os diffs posteriores exigirem.
5. Preparar checklist de deploy VPS sem alterar portas/domínios existentes.
6. Fazer backup do banco da VPS antes da migration.
7. Aplicar migration na VPS em transação e rodar script de verificação.
8. Subir backend/dashboard preservando `.env` da VPS.
9. Manter `MULTI_PUBLISH_ENABLED=false` inicialmente na VPS.
10. Testar primeiro um Reel, depois decidir quando habilitar teste controlado de
    Feed/Carrossel/Stories.

## Fase 6 implementada

Feed Imagem foi implementado em:

- `backend/src/modules/publisher/meta-content.client.js`;
- `backend/src/modules/publisher/publish-feed-image.strategy.js`.

Fluxo:

1. `POST /{ig-user-id}/media` com `image_url`, `caption` e `access_token`;
2. obter o ID do container;
3. `POST /{ig-user-id}/media_publish` com `creation_id` e `access_token`;
4. retornar `metaContainerId` e `metaMediaId`.

A estratégia aceita:

- `igAccountId` ou `instagramId`;
- `metaToken` ou `accessToken`;
- URL explícita em `imageUrl`, `mediaPublicUrl` ou item de mídia;
- fallback usando `MEDIA_PUBLIC_BASE_URL`, `/pending/` e o filename armazenado.

Erros da Graph API são normalizados com:

- operação;
- status HTTP;
- código e subcódigo da Meta;
- detalhes estruturados.

Validações realizadas sem rede real:

- payload `application/x-www-form-urlencoded` de criação do container;
- payload de publicação;
- retorno dos dois IDs;
- resolução e codificação da URL pública;
- validação dos campos obrigatórios;
- normalização de erro da Meta;
- regressão do roteamento da Fase 4;
- confirmação de que `publish.worker.js` continua sem alterações.

A estratégia ainda não está conectada ao worker. Portanto, o post de teste
`feed_image` não será publicado automaticamente. Quando a integração da Fase 9
for realizada, o retorno da estratégia poderá ser passado ao
`markPublished`, que já persiste `meta_container_id` e `meta_media_id`.

## Próximo passo após a Fase 6

Criar a interface do dashboard para testar upload multi-tipo, como solicitado.
Não publicar o Feed Imagem real antes de validar que a URL pública da imagem é
acessível pela Meta e de receber autorização explícita para o disparo.

## Interface multi-tipo implementada no dashboard

A tela existente `dashboard/src/modules/upload/pages/UploadPage.tsx` foi
adaptada para:

- selecionar Reel, Feed Imagem, Carrossel, Story Imagem ou Story Vídeo;
- ajustar automaticamente `accept` e seleção múltipla;
- validar quantidade e MIME no cliente;
- aceitar de 2 a 10 itens no carrossel;
- exibir previews de imagens e vídeos;
- exibir ordem do carrossel;
- remover arquivos individualmente;
- mostrar tamanho e nome dos arquivos;
- aceitar legenda e agendamento;
- enviar multipart para `POST /api/media/upload-post`;
- mostrar o ID e o tipo depois da criação;
- exibir mensagens reais retornadas pelo backend;
- preservar a listagem legada de arquivos pending de Reels.

O backend também expõe:

```http
GET /api/media/capabilities
```

Essa resposta informa quais tipos aceitam upload e quais estão habilitados para
publicação automática.

Na configuração local atual:

- Reel: “Publicação ativa”, pelo n8n;
- Feed Imagem, Carrossel e Stories: “Somente preparação”;
- `MULTI_PUBLISH_ENABLED=false`.

A tela exibe um aviso explícito quando o formato pode ser enviado/agendado, mas
a publicação automática ainda está desativada.

Arquivos principais:

- `dashboard/src/modules/upload/pages/UploadPage.tsx`;
- `dashboard/src/modules/upload/hooks/useUploadModule.ts`;
- `dashboard/src/modules/upload/services/upload.service.ts`;
- `dashboard/src/shared/types/upload.ts`;
- `dashboard/src/shared/lib/http.ts`;
- `dashboard/src/index.css`.

Validações:

- TypeScript `tsc -b`: aprovado;
- ESLint nos arquivos alterados: aprovado;
- build completo `npm run build` no WSL: aprovado;
- endpoint `/api/media/capabilities`: HTTP 200;
- resposta confirmou Reel ativo e formatos multi-tipo em preparação;
- `git diff --check`: aprovado.

O build pelo Windows não é aplicável porque o `node_modules` contém binding
nativo do Linux; usar o WSL para builds deste dashboard. A inspeção visual
automatizada ficou bloqueada por restrição de permissão do navegador local
nesta sessão.

## Próximo passo após a interface

Reiniciar ou confirmar o Vite no WSL, abrir a tela Uploads e testar pelo menos:

1. Feed Imagem com uma imagem;
2. Carrossel com duas imagens;
3. rejeição de arquivo incompatível;
4. remoção e ordem dos previews;
5. agendamento;
6. confirmação dos registros em `posts`, `uploads` e `post_media_items`.

## Fase 10 concluída

Os critérios da Fase 10 estão atendidos:

- seletor com os cinco tipos;
- Reel: um vídeo;
- Feed imagem: uma imagem;
- Carrossel: 2 a 10 arquivos;
- Story imagem: uma imagem;
- Story vídeo: um vídeo;
- previews antes do envio;
- ordem visual para carrossel;
- remoção individual;
- validações de formato e quantidade;
- legenda;
- agendamento;
- envio para o endpoint multi-tipo;
- retorno de sucesso com ID do post;
- indicação da capacidade real de publicação do ambiente.

## Agendamentos multi-tipo e política de falhas

Em 2026-06-25 foram corrigidos os seguintes pontos:

### Listagem de agendamentos

`listPosts` agora retorna:

- `publishType`;
- `mediaType`;
- `mediaFile`, usando o primeiro `post_media_items` quando não há
  `video_filename`;
- `mediaItemsCount`;
- `workspaceId`.

A tela de Agendamentos agora mostra:

- coluna Tipo;
- nome da primeira mídia;
- quantidade adicional do carrossel;
- retry no formato `atual/2`.

Os testes do usuário aparecem corretamente:

- Feed Imagem `52a5f978-5b9b-4efb-98a9-b123e663224a`, agendado para
  2026-06-25 19:30 -03;
- Carrossel `e6964574-32a6-405f-96b4-d5d1d441345d`, agendado para
  2026-06-26 08:00 -03.

### Segurança da API

A listagem usada pelo dashboard não retorna mais `metaToken`. Credenciais só
são carregadas internamente quando necessárias para publicação manual de Reel.

“Publicar Agora” e “Enfileirar” ficam bloqueados para tipos diferentes de Reel
até a integração do publisher com o worker. O backend também recusa publicação
manual desses tipos com HTTP 409.

### Duas tentativas

- BullMQ usa `attempts: 2`;
- primeira falha deixa o post em `retrying`, com `retry_count = 1`;
- segunda falha deixa o post em `error`, com `retry_count = 2`;
- `next_retry_at` fica nulo após a falha definitiva;
- recuperação de posts presos em `processing` respeita o mesmo limite.

### Excluir/cancelar agendamento

O botão “Excluir agendamento” agora fica disponível para:

- `pending`;
- `scheduled`;
- `queued`;
- `retrying`;
- `error`.

Ele permanece bloqueado para `processing`, `published` e `canceled`.

O backend:

1. remove o job BullMQ quando ele não está ativo;
2. recusa cancelamento durante processamento ativo;
3. altera o post para `canceled`;
4. limpa `scheduled_at` e `next_retry_at`.

O post descartável `6bd0df65-953d-40a6-a10d-2a0bae402a2f` foi usado para
validar o cancelamento e permanece `canceled`.

Validações:

- sintaxe JavaScript;
- teste automatizado da transição `retrying` → `error`;
- opções reais da fila confirmadas com duas tentativas;
- build completo do dashboard no WSL;
- Feed Imagem e Carrossel confirmados na resposta da API;
- nenhum deles permanece na fila BullMQ de Reels;
- credencial da Meta ausente na resposta ao dashboard.

## Fases 7 e 8 implementadas

Foram implementadas as estratégias de Carrossel e Stories sem integração ao
worker.

Arquivos:

- `backend/src/modules/publisher/publisher-media.js`;
- `backend/src/modules/publisher/meta-content.client.js`;
- `backend/src/modules/publisher/publish-carousel.strategy.js`;
- `backend/src/modules/publisher/publish-story.strategy.js`.

### Carrossel

Fluxo:

1. normalizar e ordenar `mediaItems`;
2. validar de 2 a 10 imagens ou vídeos;
3. criar um container filho por item com `is_carousel_item=true`;
4. aguardar processamento de cada filho em vídeo;
5. criar container pai com `media_type=CAROUSEL`;
6. enviar filhos na ordem original;
7. aguardar processamento do container pai;
8. publicar o pai;
9. retornar IDs da Meta e:

```json
{
  "carouselChildren": ["...", "..."],
  "parentContainerId": "..."
}
```

### Stories

Fluxo:

1. validar `story_image` ou `story_video`;
2. exigir exatamente um item do tipo correspondente;
3. criar container com `media_type=STORIES`;
4. usar `image_url` ou `video_url`;
5. aguardar processamento para vídeo;
6. publicar o container.

A legenda é mantida internamente e não é enviada à Meta para Stories.

### Cliente Meta

O cliente agora suporta:

- criação de filho de carrossel;
- criação do pai do carrossel;
- criação de Story;
- consulta de `status_code,status`;
- polling com timeout;
- tratamento de `FINISHED`, `ERROR` e `EXPIRED`;
- publicação de container.

### Validações

- payload de imagem e vídeo filho;
- `children` em ordem;
- `media_type=CAROUSEL`;
- `media_type=STORIES`;
- polling de vídeo e container pai;
- Story imagem sem polling;
- Story vídeo com polling;
- ausência de legenda no payload de Story;
- limites e tipos inválidos;
- regressão das Fases 4 e 6;
- sintaxe de todos os arquivos;
- nenhuma chamada real à Meta.

O acesso automatizado à documentação oficial
`https://developers.facebook.com/docs/instagram-platform/content-publishing/`
retornou página de login em 2026-06-25. A implementação segue o contrato
funcional já registrado em `docs/0006-mult-posts.md`.

## Próximo passo após as Fases 7 e 8

Antes de integrar ao worker:

1. preparar carregamento completo do post com `mediaItems` e credenciais apenas
   no backend;
2. decidir a integração gradual da Fase 9;
3. preservar fallback n8n para Reel;
4. executar publicação real controlada primeiro com Feed Imagem;
5. depois testar Carrossel e Stories com autorização explícita.

## Fase 9 implementada com ativação gradual

O worker foi integrado ao `publisher.service.js`, preservando o fluxo de Reels.

### Roteamento

- `reel`: continua obrigatoriamente no webhook n8n;
- `feed_image`: estratégia Feed Imagem;
- `feed_carousel`: estratégia Carrossel;
- `story_image` e `story_video`: estratégia Story.

### Carregamento seguro

A fila agora transporta somente:

- `id`;
- `workspaceId`;
- `publishType`.

O worker carrega do banco, no momento da publicação:

- conta Instagram;
- token;
- tipo;
- legenda;
- mídias ordenadas;
- URL pública base.

Isso evita serializar credenciais no Redis.

A função interna `getPostForPublishing` retorna o post completo somente para o
backend. A listagem do dashboard continua sem tokens.

### Persistência

Após publicação por estratégia, o worker persiste:

- `meta_media_id`;
- `meta_container_id`;
- `publish_options`;
- `carousel_children`.

Eventos adicionados:

- `processing_started`;
- `publisher_completed`;
- `published`;
- eventos de erro e retry existentes.

### Ativação gradual

Foi criada:

```env
MULTI_PUBLISH_ENABLED=false
```

O padrão é `false`. Nesse estado:

- Reels continuam normais no n8n;
- Feed, Carrossel e Stories não aparecem em `ready`;
- publicação manual multi-tipo retorna HTTP 409;
- nenhum job multi-tipo é criado.

Para ativar localmente futuramente:

```env
MULTI_PUBLISH_ENABLED=true
```

Depois reiniciar backend e worker. Não copiar essa configuração para a VPS sem
validação e autorização específica.

### Validações

- fallback Reel → n8n;
- roteamento dos quatro tipos novos;
- bloqueio pela feature flag;
- ciclo completo simulado do worker;
- persistência de IDs e opções de carrossel;
- carregamento real de Feed e Carrossel com mídias em ordem;
- lista `ready` vazia para multi-tipo com flag desligada;
- publicação manual bloqueada com HTTP 409;
- nenhum job multi-tipo no Redis;
- build do dashboard no WSL;
- backend de desenvolvimento reiniciado;
- worker local reiniciado com a nova implementação;
- nenhuma chamada real à Meta.

## Próximo passo após a Fase 9

Antes de ativar a chave:

1. validar externamente a URL pública de uma imagem;
2. escolher um Feed Imagem controlado;
3. habilitar `MULTI_PUBLISH_ENABLED=true` apenas no ambiente local;
4. publicar com acompanhamento de logs;
5. validar IDs e status no banco;
6. manter VPS desativada até concluir os testes locais.

## Consultas úteis

Verificar gravação tripla mais recente:

```sql
SELECT
  p.id,
  p.publish_type,
  p.media_type,
  p.status,
  p.workspace_id,
  u.id AS upload_id,
  u.stored_filename,
  pmi.id AS media_item_id,
  pmi.media_kind,
  pmi.sort_order,
  pmi.workspace_id AS media_workspace_id
FROM posts p
LEFT JOIN uploads u ON u.id = p.upload_id
LEFT JOIN post_media_items pmi ON pmi.post_id = p.id
ORDER BY p.created_at DESC
LIMIT 10;
```

Verificar integridade:

```sql
SELECT
  COUNT(*) FILTER (WHERE p.workspace_id IS NULL) AS posts_sem_workspace,
  COUNT(*) FILTER (
    WHERE pmi.id IS NOT NULL
      AND p.workspace_id IS DISTINCT FROM pmi.workspace_id
  ) AS divergencias_workspace
FROM posts p
LEFT JOIN post_media_items pmi ON pmi.post_id = p.id;
```

## Cuidados com o worktree

O repositório contém alterações de outras frentes, especialmente Inbox/DM e
Dashboard. Não reverter, formatar em massa ou sobrescrever mudanças não
relacionadas.

Antes de editar:

```bash
git status --short
git diff -- <arquivos do escopo>
```

Trabalhar somente nos arquivos necessários e executar `git diff --check` no
escopo alterado.

## Segurança

- Nunca registrar tokens, senhas ou conteúdo completo de `.env` em documentos,
  logs ou respostas.
- Evitar `docker compose config` em saídas compartilhadas, pois ele expande
  variáveis sensíveis.
- Não publicar, enviar mensagens, executar deploy ou alterar a VPS sem
  autorização correspondente.

## Retomada imediata em 2026-06-26 — preparar subida para VPS

Pedido do usuário: amanhã retomar e subir para a VPS, porque localmente o
processo ficou muito lento. Antes de qualquer deploy, revisar diffs e preparar
um checklist seguro.

Estado validado em 2026-06-25:

- O fluxo local de Reel publicou com sucesso usando n8n local e mídia via ngrok.
- Post publicado: `f369cee5-2ec0-4814-a9d4-8e2a252aba46`.
- Arquivo: `142xt_potenza_xt_bdd1e515.mp4`.
- Status final: `published`.
- `published_at`: `2026-06-25 19:37:30-03`.
- `meta_container_id`: `18541896028078109`.
- `meta_media_id`: `18112619714489157`.
- BullMQ/Redis: job em `completed`.
- n8n: duas execuções webhook `success`.

Ponto crítico antes da VPS:

- A primeira tentativa do Reel retornou ao backend com `status=published`, mas
  `publishId=null`.
- O worker tratou como erro e fez retry.
- A segunda tentativa retornou `publishId` corretamente.
- Revisar/corrigir o retorno final do workflow n8n ou a interpretação no worker
  para evitar retry indevido e possível duplicidade em produção.

Ambiente local usado no teste:

- PostgreSQL local: `127.0.0.1:55532`.
- Redis local: `56379`.
- n8n local: `5678`.
- Backend local: `3101`.
- Servidor de mídia local: `127.0.0.1:8090`.
- Ngrok temporário: `https://chad-woozier-tara.ngrok-free.dev`.

Não copiar essas portas nem URL ngrok para a VPS. A VPS já tem configuração
operacional própria.

Flags:

- `MULTI_PUBLISH_ENABLED=false` no último teste local.
- Com a flag desligada, multi-tipos podem ser criados/agendados, mas não devem
  publicar.
- Manter a flag desligada inicialmente na VPS.

Posts locais relevantes:

- `c86fed7b-697e-4a3d-9972-f4f6a20a72ca`: Reel agendado para
  `2026-06-26 08:00:00-03`.
- `52a5f978-5b9b-4efb-98a9-b123e663224a`: Feed Imagem local.
- `e6964574-32a6-405f-96b4-d5d1d441345d`: Feed Carrossel local.

Checklist recomendado para a VPS:

1. Revisar `git status --short` e diffs por escopo.
2. Validar backend com `node --check` nos arquivos alterados.
3. Validar dashboard com build/lint se disponível.
4. Confirmar migrations necessárias e manter SQL idempotente/transacional.
5. Fazer backup do banco da VPS antes da migration.
6. Aplicar migration e rodar script de verificação.
7. Subir backend/dashboard preservando `.env`, portas, domínio, n8n e proxy da
   VPS.
8. Manter `MULTI_PUBLISH_ENABLED=false` no primeiro deploy.
9. Testar primeiro um Reel na VPS.
10. Só depois planejar teste controlado de Feed/Carrossel/Stories.

## Preflight realizado em 2026-06-26

Validações executadas:

- `node --check` nos principais arquivos JavaScript alterados do backend:
  aprovado.
- `npm run build` do dashboard via WSL: aprovado.
- `git diff --check` no escopo crítico de worker/migrations/schema: aprovado.
- Migration `backend/sql/006-mult-posts-phase-1-2.sql` revisada como
  idempotente e transacional.
- Script de verificação
  `backend/sql/006-mult-posts-phase-1-2-verify.sql` revisado.

Ajuste de segurança aplicado antes da VPS:

- `backend/src/modules/scheduler/publish.worker.js` agora trata resposta ambígua
  do n8n (`ok/status` de publicado, mas sem `publishId`) como erro sem retry.
- O worker chama `job.discard()` quando disponível e registra `publish_error`
  com `code=N8N_PUBLISHED_WITHOUT_PUBLISH_ID`, `noRetry=true` e `creationId`.
- Objetivo: evitar duplicidade no Instagram se a Meta já tiver publicado mas o
  n8n não tiver propagado o `publishId`.

Ajuste de ambiente para não vazar porta local para VPS:

- `docker-compose.yml` passou a usar
  `${POSTGRES_HOST_PORT:-55432}:5432`.
- O default do backend em `backend/src/config/env.js` voltou a ser `55432`.
- A porta local `55532` deve ficar somente em `.env` local, via:

```env
POSTGRES_HOST_PORT=55532
DB_PORT=55532
```

Não copiar esses valores locais para a VPS. Na VPS, preservar `.env`, portas,
domínio, n8n, proxy e PM2/Docker existentes.

Observação local:

- O `npm` do Windows está quebrado nesta máquina (`npm-cli.js` ausente em
  AppData/Roaming), mas o build via WSL funcionou. Isso não bloqueia deploy VPS.

## Regra operacional confirmada em 2026-06-26

Ambiente local de desenvolvimento:

- O Docker está instalado e gerenciado pelo Windows 11/Docker Desktop.
- O repositório fica em pasta do Windows:
  `C:\Projetos\auto-reels-n8n`.
- No VS Code, o projeto é aberto pelo WSL na imagem Ubuntu, usando o caminho:
  `/mnt/c/Projetos/auto-reels-n8n`.
- Comandos de desenvolvimento, compilação, validação, `curl`, scripts Node,
  `npm run build`, `node --check` e testes locais devem ser executados pelo WSL.
- Evitar rodar build/curl pelo PowerShell/Windows quando houver alternativa no
  WSL, porque o ambiente Node/npm do Windows pode divergir ou estar quebrado.
- Para Docker local, lembrar que o daemon/containers pertencem ao Docker
  Desktop no Windows, mas o uso pelo WSL pode depender da integração ativa da
  distro Ubuntu.

Ambiente VPS:

- A VPS é Linux/Ubuntu nativo.
- App/API rodam diretamente no Ubuntu da VPS.
- PostgreSQL, n8n, Redis e demais serviços de infraestrutura rodam em containers
  Docker na VPS.
- Na VPS, comandos de build, `curl`, migrations e restart devem ser pensados
  como comandos Linux/Ubuntu, sem adaptações de Windows/WSL.
- Não levar ajustes locais de Windows/WSL para a VPS, especialmente portas,
  caminhos `/mnt/c/...`, ngrok ou workarounds do Docker Desktop.

## Deploy VPS iniciado em 2026-06-26

Repositório:

- Commit enviado ao GitHub: `7d84372 feat: suporte multi-tipo de posts instagram`.
- Na VPS, o usuário executou `git pull origin main` em
  `/home/socialbot/apps/auto-reels-n8n`.
- O pull fez fast-forward de `ed8f9bc` para `7d84372` com sucesso.

Dashboard na VPS:

- O deploy do dashboard não deve ser feito manualmente copiando `dashboard/dist`
  por comandos avulsos.
- Usar o script existente:

```bash
cd /home/socialbot/apps/auto-reels-n8n/scripts
sudo ./deploy_frontend_hostinger.sh
```

O script:

- entra em `/home/socialbot/apps/auto-reels-n8n/dashboard`;
- executa `npm ci`;
- executa `npm run build`;
- publica `dashboard/dist/` em `/var/www/dashboard.hrmmotos.com.br`;
- ajusta owner para `www-data:www-data`;
- valida e recarrega Nginx;
- testa `https://dashboard.hrmmotos.com.br`.

Validação já observada na VPS:

```bash
curl -s https://api.hrmmotos.com.br/api/media/capabilities | jq
```

Resultado observado:

- `uploadPostEnabled=true`;
- `multiPublishEnabled=false`;
- `reel.publishEnabled=true` com publisher `n8n`;
- `feed_image`, `feed_carousel`, `story_image` e `story_video` com upload
  habilitado, mas publicação desabilitada;
- isso confirma que a flag segura permanece desligada na VPS.

Ainda falta confirmar nesta sessão:

1. backup do banco da VPS antes da migration;
2. aplicação da migration `backend/sql/006-mult-posts-phase-1-2.sql`;
3. execução do script `backend/sql/006-mult-posts-phase-1-2-verify.sql`;
4. `npm ci` no backend;
5. restart dos processos PM2 da API/worker;
6. execução do script de deploy do dashboard;
7. teste final de upload/agendamento sem habilitar multi-publicação.

## Deploy VPS confirmado em 2026-06-26

O usuário confirmou que todos os passos pendentes do deploy foram executados com
sucesso na VPS:

- backup do banco antes da migration;
- aplicação da migration `backend/sql/006-mult-posts-phase-1-2.sql`;
- execução do verificador `backend/sql/006-mult-posts-phase-1-2-verify.sql`;
- instalação/atualização de dependências do backend;
- restart dos processos PM2 da API/worker;
- execução do deploy do dashboard via
  `scripts/deploy_frontend_hostinger.sh`;
- validação de que a API responde
  `https://api.hrmmotos.com.br/api/media/capabilities`.

Estado seguro confirmado:

- `multiPublishEnabled=false` na VPS;
- Reels permanecem com publicação habilitada via n8n;
- Feed Imagem, Feed Carrossel, Story Imagem e Story Vídeo estão com upload
  habilitado, mas publicação desabilitada pela feature flag;
- não habilitar `MULTI_PUBLISH_ENABLED=true` em produção sem teste controlado e
  autorização explícita.

Próxima etapa recomendada:

1. testar no dashboard da VPS a criação/agendamento de um post multi-tipo sem
   publicar;
2. validar que o post aparece corretamente na agenda com tipo/mídia/quantidade;
3. validar no banco que `posts` e `post_media_items` foram gravados;
4. testar um Reel real pela VPS para confirmar que o fluxo legado n8n segue
   intacto;
5. somente depois planejar habilitação controlada de publicação multi-tipo.

## Validação VPS após uploads em 2026-06-26

O usuário criou na VPS um Reel e posts multi-tipo pelo dashboard.

Validações públicas realizadas pela API:

- `https://api.hrmmotos.com.br/api/media/capabilities` retornou:
  - `uploadPostEnabled=true`;
  - `multiPublishEnabled=false`;
  - Reel com publicação habilitada via `n8n`;
  - Feed Imagem, Feed Carrossel, Story Imagem e Story Vídeo com upload
    habilitado, mas publicação desabilitada.
- `https://api.hrmmotos.com.br/api/internal/posts?limit=10` mostrou novos posts:
  - `0babc122-e1e7-4fbe-bc35-cde8f06dc8c9`: `feed_image`, `mediaType=image`,
    `status=scheduled`, `mediaItemsCount=1`, agendado para
    `2026-06-27T11:00:00.000Z`;
  - `ebbd33cb-ad57-4d8d-aa4a-b42356321fe4`: `feed_carousel`,
    `mediaType=carousel`, `status=scheduled`, `mediaItemsCount=2`, agendado
    para `2026-06-26T15:00:00.000Z`;
  - `ded7ce3f-95e2-4dff-a0eb-be1a0c6bc6d7`: `reel`, `mediaType=video`,
    `status=pending`, `scheduledAt=null`, `mediaItemsCount=1`.
- `https://api.hrmmotos.com.br/api/internal/posts/ready` retornou apenas o Reel
  `ded7ce3f-95e2-4dff-a0eb-be1a0c6bc6d7`, porque está `pending` sem
  `scheduledAt`.
- `https://api.hrmmotos.com.br/api/internal/scheduler/stats` retornou fila vazia:
  `waiting=0`, `active=0`, `completed=0`, `failed=0`, `delayed=0`, `paused=0`.

Validação pública das mídias:

- `https://midia.hrmmotos.com.br/reels/pending/promocional_potenza_scooter_capa_0ca7b9ba.png`
  respondeu `200 OK`;
- `https://midia.hrmmotos.com.br/reels/pending/promocional_fluo125_23194fab.png`
  respondeu `200 OK`;
- `https://midia.hrmmotos.com.br/reels/pending/165gt_potenzagtforza_ninja_0b79ae54.mp4`
  respondeu `200 OK`.

Conclusão:

- Upload/agendamento multi-tipo está funcionando na VPS.
- As mídias estão acessíveis publicamente pelo domínio de mídia.
- A feature flag está protegendo a publicação multi-tipo como esperado.
- Atenção: o Reel novo ficou `pending` sem agendamento; ele aparece como
  `ready`, mas ainda não foi enfileirado. Se a intenção for publicar/agendar,
  escolher explicitamente agendar ou publicar agora.

## Incidente n8n VPS em 2026-06-26

Ao tentar publicar o Reel
`ded7ce3f-95e2-4dff-a0eb-be1a0c6bc6d7`, o backend registrou:

```json
{
  "jobId": "ded7ce3f-95e2-4dff-a0eb-be1a0c6bc6d7",
  "source": "worker",
  "attempt": 2,
  "message": "Webhook n8n retornou 2xx, mas corpo JSON invalido.",
  "maxAttempts": 2
}
```

Interpretação:

- A VPS provavelmente ainda está com o workflow n8n antigo ou incompleto.
- O webhook respondeu HTTP 2xx, mas não respondeu JSON válido para o worker.
- Não reenfileirar/publicar novamente sem antes verificar a execução no n8n ou
  no Instagram, porque uma resposta 2xx inválida pode significar que o workflow
  continuou executando e talvez tenha publicado.

Correção necessária na VPS:

- Atualizar o workflow n8n de Reels para usar `responseMode=responseNode`.
- Garantir que o caminho de sucesso termine em `Respond to Webhook` com JSON:
  `{ ok: true, postId, publishId, creationId, status: "published" }`.
- Garantir que o caminho de erro termine em `Respond to Webhook` com JSON e
  status HTTP 500.
- O nó `Prepare Payload` deve preferir `mediaPublicUrl` recebido do backend e
  usar fallback com `/pending` sem duplicar o caminho.

## Correção n8n v4 confirmada em 2026-06-26

Workflow ativo validado na VPS:

- nome: `Instagram Reels Webhook Publisher v4`;
- workflow id: `t8bjbHSAOk7vDiJS`;
- webhook path: `socialbot-publish-v4`;
- URL interna usada pelo backend:
  `http://localhost:5678/webhook/socialbot-publish-v4`.

Problemas corrigidos no workflow n8n:

- O webhook antigo `socialbot-publish` não estava registrado ou respondia JSON
  inválido para o worker.
- O workflow importado inicialmente retornava sucesso sem `publishId`, inclusive
  para payload vazio.
- Os nós IF (`Payload OK?`, `Container OK?`, `Published OK?`) estavam com
  condição visual corrompida, comparando textos como
  `value1: {{ $json.hasError }}` em vez do valor real.
- Foi necessário corrigir `workflow_entity` e `workflow_history`, porque o n8n
  2.20 pode executar versão publicada/cacheada diferente da edição visível.

Validações finais:

- Payload vazio para `/webhook/socialbot-publish-v4` agora retorna erro em
  `stage="prepare_payload"` e não segue para a Meta.
- O Reel `ded7ce3f-95e2-4dff-a0eb-be1a0c6bc6d7` foi resetado,
  reenfileirado e publicado com sucesso.
- Estado final observado no banco:
  - `status=published`;
  - `retry_count=0`;
  - `meta_container_id=18542120197078109`;
  - `meta_media_id=18117408442862097`;
  - `published_at=2026-06-26 15:28:32.588-03`.
- O usuário confirmou que o post apareceu corretamente no Instagram.

Decisões:

- Manter o webhook v4 como endpoint de produção para Reels.
- Não reativar o webhook antigo `socialbot-publish`.
- Rotacionar o token Meta depois da estabilização, porque um token real apareceu
  em logs/conversa durante o diagnóstico.

Script adicionado para backup do workflow n8n:

- `scripts/backup_n8n_workflow_json.sh`

Uso recomendado na VPS:

```bash
cd /home/socialbot/apps/auto-reels-n8n
chmod +x scripts/backup_n8n_workflow_json.sh
./scripts/backup_n8n_workflow_json.sh
```

O script salva por padrão em:

```text
/home/socialbot/backups/n8n-workflows/<timestamp>_<workflow_id>/
```

Arquivos gerados:

- `workflow_entity.json`;
- `workflow_history.jsonl`;
- `webhook_entity.json`;
- `manifest.txt`.

## Checklist pós-publicação antes de avançar multi-tipo

1. Executar o backup do workflow n8n v4 na VPS.
2. Confirmar que `N8N_PUBLISH_WEBHOOK` aponta para
   `http://localhost:5678/webhook/socialbot-publish-v4`.
3. Confirmar que o workflow antigo `socialbot-publish` está desativado,
   arquivado ou removido.
4. Confirmar que a feature flag de publicação multi-tipo continua desligada:
   `MULTI_PUBLISH_ENABLED=false`.
5. Conferir `https://api.hrmmotos.com.br/api/media/capabilities`.
6. Fazer backup/rotação do token Meta exposto durante os testes.
7. Só depois avançar para publicação controlada dos demais tipos
   (`feed_image`, `feed_carousel`, `story_image`, `story_video`).

## Publicação multi-tipo validada na VPS em 2026-06-26

Depois da correção do n8n v4 e do backup do workflow, a publicação multi-tipo
foi validada progressivamente na VPS.

### Feed imagem manual via estratégia Meta

Post testado:

- id: `0babc122-e1e7-4fbe-bc35-cde8f06dc8c9`;
- tipo: `feed_image`;
- mídia: `promocional_potenza_scooter_capa_0ca7b9ba.png`;
- execução: script Node manual chamando `publishPost(post)` e depois
  `markPublished`.

Resultado observado:

- `status=published`;
- `retry_count=0`;
- `meta_container_id=18542130673078109`;
- `meta_media_id=18147158956504336`;
- `published_at=2026-06-26 16:17:11.523-03`.

Conclusão: a estratégia Meta direta para `feed_image` funciona em produção.

### Flag multi-tipo habilitada

Após o teste manual de `feed_image`, a flag da VPS foi habilitada:

```text
MULTI_PUBLISH_ENABLED=true
```

Backend e worker foram reiniciados via PM2. A API passou a aceitar publicação
multi-tipo pelo fluxo normal.

### Feed imagem pelo fluxo normal

Post testado:

- id: `f587fd46-64b0-4004-a472-00d961806880`;
- tipo: `feed_image`;
- mídia: `promocional_potenza_gt_forza_capa_bbce0674.png`;
- execução: endpoint `POST /api/internal/posts/:id/publish-now` com worker.

Observação:

- A primeira chamada retornou `already_exists` porque o job já existia como
  `delayed`.
- O job foi tratado e o post publicou pelo fluxo normal.

Resultado observado:

- `status=published`;
- `retry_count=1`;
- `error_message` vazio;
- `meta_container_id=18542141116078109`;
- `meta_media_id=17872339356683657`;
- `published_at=2026-06-26 17:15:00.447-03`.

Conclusão: `feed_image` também funciona pelo fluxo normal com worker e
`MULTI_PUBLISH_ENABLED=true`.

### Feed carrossel pelo fluxo normal

Post testado:

- id: `ebbd33cb-ad57-4d8d-aa4a-b42356321fe4`;
- tipo: `feed_carousel`;
- mídia:
  - `promocional_fluo125_23194fab.png`;
  - `promocional_nmax160_2de5a916.png`.

Eventos observados:

- primeira tentativa falhou com `MULTI_PUBLISH_DISABLED`, antes da flag estar
  habilitada;
- retry foi agendado;
- segunda tentativa, já com a flag habilitada, publicou com sucesso.

Resultado observado:

- `status=published`;
- `retry_count=1`;
- `error_message` vazio;
- `meta_container_id=18542141149078109`;
- `meta_media_id=17873809869523368`;
- `published_at=2026-06-26 17:15:10.299-03`;
- evento `publisher_completed` registrado;
- evento `published` registrado com `publishType=feed_carousel`.

Conclusão: `feed_carousel` está funcionando pelo fluxo normal com worker e
`MULTI_PUBLISH_ENABLED=true`.

## Estado atual após validações multi-tipo

Tipos já validados em produção:

- `reel` via n8n v4;
- `feed_image` via estratégia Meta direta e via fluxo normal;
- `feed_carousel` via fluxo normal.

Todos os cinco tipos estão validados em produção. Ver validações de Stories
registradas abaixo.

Próximo passo recomendado:

1. aplicar e validar a redução do intervalo do scheduler na VPS;
2. rotacionar o token Meta exposto durante a sessão;
3. iniciar o desenho da autenticação, usuários e auditoria.

## Story imagem validado na VPS em 2026-06-27

Post testado pelo fluxo normal de agendamento e worker:

- id: `00f82fd3-8ba6-4ab2-bedf-8f42ba034593`;
- tipo: `story_image`;
- mídia: `promocional_xmax250_a97105d1.png`;
- agendado para `2026-06-27 10:30:00-03`;
- URL pública da mídia respondeu HTTP 200 com `image/png`;
- `MULTI_PUBLISH_ENABLED=true` e publicação de Stories habilitada pela API.

Resultado observado:

- `status=published`;
- `retry_count=0`;
- `error_message` vazio;
- `meta_media_id=17894636838490634`;
- `published_at=2026-06-27 10:44:03.029-03`.

Conclusão: `story_image` funciona em produção pelo fluxo normal. O coletor de
posts prontos usa polling com intervalo padrão de 15 minutos
(`AUTO_ENQUEUE_READY_INTERVAL_MS=900000`), por isso a publicação ocorreu cerca
de 14 minutos após o horário agendado. Isso não foi uma falha da Meta nem do
worker, mas deve ser melhorado posteriormente para reduzir a imprecisão dos
agendamentos. Não alterar o intervalo da VPS sem revisar carga e configuração
real.

## Story vídeo validado na VPS em 2026-06-27

Post testado pelo fluxo normal de agendamento e worker:

- id: `8b7350cd-d993-4f14-bb41-f71fd77a2c2e`;
- tipo: `story_video`;
- mídia: `video_ptz174gt_360gp_3fda23f9.mp4`;
- MIME: `video/mp4`;
- tamanho: `8041322` bytes;
- URL pública da mídia respondeu HTTP 200;
- horário corrigido, com autorização do usuário, de 17:00 para
  `2026-06-27 15:00:00-03` por uma atualização transacional e restrita ao post.

Resultado observado:

- enfileirado automaticamente pelo coletor às `15:13:49-03`;
- `status=published`;
- `retry_count=0`;
- `error_message` vazio;
- `meta_container_id=18542397442078109`;
- `meta_media_id=17935749714294072`;
- `published_at=2026-06-27 15:14:26.114-03`;
- eventos `queued`, `processing_started`, `publisher_completed` e `published`
  registrados com `publishType=story_video`.

Conclusão: `story_video` funciona em produção pelo fluxo normal. A publicação
teve aproximadamente 14 minutos de atraso pelo mesmo polling de 15 minutos do
coletor já observado em `story_image`.

## Marco: publicação multi-tipo concluída

Tipos validados em produção:

- `reel` via n8n v4;
- `feed_image` via Meta;
- `feed_carousel` via Meta;
- `story_image` via Meta;
- `story_video` via Meta.

O próximo desenvolvimento técnico recomendado é reduzir a imprecisão do
scheduler sem alterar o fluxo de Reels. Depois, seguir o roadmap programado de
autenticação segura, usuários, autoria/auditoria e postagem sem data.

## Precisão do scheduler preparada localmente em 2026-06-30

Foi preparada uma alteração local para reduzir a janela máxima do coletor de
posts prontos de 15 minutos para aproximadamente 1 minuto:

- `AUTO_ENQUEUE_READY_INTERVAL_MS` passa a usar `60000` como padrão;
- valores inválidos ou menores que `10000` ms voltam com segurança para o
  padrão de `60000` ms;
- `backend/.env.example` documenta a ativação, o intervalo recomendado e o
  limite mínimo;
- o fluxo de Reels, o n8n, o worker, a consulta de posts prontos e as regras de
  retry não foram alterados.

Validações locais no WSL:

- `node --check backend/src/config/env.js` aprovado;
- intervalo explícito de `60000` ms aprovado;
- valor inválido e valor abaixo do mínimo retornaram ao padrão de `60000` ms.

Estado da VPS inspecionado antes do deploy:

- `.env` possui `AUTO_ENQUEUE_READY_ENABLED=true`;
- `.env` possui `AUTO_ENQUEUE_READY_INTERVAL_MS=900000`;
- portanto, atualizar somente o código não mudará o intervalo da VPS;
- após commit/push/pull, alterar apenas essa variável para `60000` e reiniciar
  somente `socialbot-backend` com atualização do ambiente;
- não reiniciar n8n, PostgreSQL, Redis ou o worker por causa desta mudança.

O bloco acima descreve o estado anterior ao deploy; a validação aplicada na VPS
está registrada a seguir.

## Validação do scheduler de 1 minuto na VPS em 2026-06-30

Após commit, atualização e restart do backend, foi criado o post de teste:

- id: `dc3ef798-6a4a-41f3-819a-1762b4bb2d33`;
- tipo real: `feed_image`;
- agendado para `2026-06-30 19:30:00-03`;
- mídia `arte_final_potenza_9b6ef638.png`, pública e acessível por HTTP 200.

Resultado do scheduler:

- o coletor registrou ticks a cada 60 segundos;
- o post foi enfileirado às `19:30:55-03`;
- o desvio do agendamento caiu de aproximadamente 14 minutos para 55 segundos;
- a mudança de precisão está validada sem alteração no fluxo de Reels.

Observação de configuração:

- o processo PM2 executou efetivamente com intervalo de 60 segundos;
- o arquivo `.env` da VPS ainda mostrava
  `AUTO_ENQUEUE_READY_INTERVAL_MS=900000` durante a inspeção;
- alinhar o arquivo para `60000` antes de um próximo restart/reboot para evitar
  retorno acidental ao intervalo antigo.

Incidente separado durante a publicação:

- as duas tentativas de `feed_image` falharam na criação do container Meta com
  `META_GRAPH_API_ERROR` e mensagem `Timeout`;
- `creationId`, `meta_container_id` e `meta_media_id` permaneceram nulos;
- o post terminou em `status=error`, `retry_count=2`;
- não houve chamada confirmada de `media_publish`;
- conectividade posterior estava normal: Graph API respondeu em cerca de
  0,21 s e a mídia pública em cerca de 0,20 s;
- não reenfileirar sem antes confirmar visualmente que a publicação não apareceu
  no Instagram e, de preferência, melhorar o registro dos detalhes do erro Meta.

Melhoria de diagnóstico preparada localmente após o incidente:

- erros normalizados da Meta agora preservam `transportCode`;
- eventos `publish_error` passam a registrar `httpStatus`, `operation`,
  `metaCode`, `metaSubcode` e `transportCode`;
- publicação, tentativas e decisão de retry permanecem inalteradas;
- sintaxe dos arquivos alterados e normalização simulada de timeout foram
  validadas no WSL;
- a melhoria foi posteriormente commitada, implantada e carregada após restart
  do `socialbot-worker`.

### Reenfileiramento controlado concluído

Após confirmar o commit na VPS, o worker foi reiniciado para carregar a melhoria
de diagnóstico e o post `dc3ef798-6a4a-41f3-819a-1762b4bb2d33` foi
reenfileirado uma única vez pelo endpoint `publish-now`.

Resultado:

- execução manual iniciou às `2026-06-30 19:47:47-03`;
- publicação concluída às `19:48:00.580-03` na primeira tentativa do novo job;
- `status=published` e `error_message` vazio;
- `meta_container_id=18543303460078109`;
- `meta_media_id=17920851198381280`;
- eventos `manual_publish`, `processing_started`, `publisher_completed` e
  `published` registrados corretamente;
- o timeout anterior foi transitório.

Débito observado: `retry_count` permaneceu em `2` depois do sucesso manual,
porque representa as falhas do job anterior. Avaliar se a interface deve exibir
histórico total de falhas ou tentativas do ciclo atual; não alterar sem definir
essa semântica.

## Fundação de autenticação e usuários preparada em 2026-06-30

O login anterior foi confirmado como puramente local no React, com credencial
fixa e flag no `localStorage`. O backend não protegia as rotas administrativas.

Arquitetura criada localmente:

- documento `docs/0007-auth-users.md`;
- migration `backend/sql/007-auth-users-foundation.sql`;
- verificador `backend/sql/007-auth-users-foundation-verify.sql`;
- tabelas `socialbot_users`, `socialbot_user_workspaces`,
  `socialbot_sessions` e `socialbot_audit_log`;
- colunas opcionais `posts.created_by_user_id` e
  `post_events.actor_user_id`;
- prefixo `socialbot_` escolhido para não colidir com a tabela `user` do n8n;
- schema `postgres-init/000_socialbot_init.sql` alinhado.

Backend preparado:

- hash de senha com `crypto.scrypt`, salt aleatório e comparação constante;
- token de sessão e CSRF aleatórios, persistidos somente como SHA-256;
- cookie `HttpOnly`, `SameSite=Lax` e `Secure` em produção;
- sessão com expiração, revogação e atualização de atividade;
- limite de falhas e bloqueio temporário por usuário;
- auditoria de login/logout;
- endpoints `/api/auth/status`, `/login`, `/me`, `/csrf` e `/logout`;
- middleware condicional de sessão, CSRF e papel;
- script `npm run create-admin` exige senha via variável temporária;
- `ADMIN_AUTH_ENABLED=false` permanece como default seguro de rollout.

Dashboard preparado:

- campos de login não trazem mais credencial preenchida;
- sessão real restaurada pelo backend quando a flag estiver ativa;
- cookies são enviados com `credentials=include`;
- operações de escrita enviam `X-CSRF-Token`;
- SSE usa `withCredentials`;
- fallback legado só funciona quando o backend responde explicitamente que a
  autenticação nova está desativada; falha de rede é fail-closed.

Validações:

- sintaxe de todos os arquivos backend alterados;
- hash correto, senha incorreta, hash inválido e senha curta;
- carregamento do Express sem conexão antecipada ao banco;
- build completo do dashboard aprovado;
- ESLint aprovado em todos os arquivos alterados desta etapa;
- migration aplicada duas vezes em banco temporário isolado na VPS;
- bootstrap limpo, constraints, índices e verificador aprovados;
- banco temporário e arquivos em `/tmp` removidos ao final;
- banco real `n8n` ainda não recebeu a migration.

Não ativar `ADMIN_AUTH_ENABLED=true` ainda. Pendências obrigatórias:

1. implementar troca obrigatória de senha;
2. criar endpoints e interface de gestão de usuários;
3. proteger OAuth Meta com sessão administrativa e `state` validado;
4. separar autenticação de serviço para integrações internas;
5. aplicar migration, criar admin inicial e testar no domínio real;
6. somente então remover definitivamente o fallback `admin/123456`.

### Gestão de usuários e troca de senha concluídas localmente

Continuação implementada em 2026-07-01:

- endpoint autenticado para troca da própria senha;
- validação da senha atual e mínimo de 12 caracteres para a nova;
- revogação de todas as sessões depois da troca;
- bloqueio backend de qualquer API administrativa enquanto
  `force_password_change=true`;
- API `/api/internal/users` restrita ao papel `admin`;
- listagem, criação, edição, ativação/desativação e redefinição de senha;
- proteção contra o admin atual desativar ou rebaixar a si mesmo;
- senha redefinida volta a ser temporária e revoga sessões existentes;
- auditoria de criação, atualização, reset e troca de senha;
- tela `/change-password` e redirecionamento obrigatório;
- tela `/usuarios`, menu exclusivo para administradores e formulário de senha
  temporária.

Validações realizadas:

- sintaxe dos arquivos backend alterados;
- ESLint aprovado em todos os arquivos frontend do escopo;
- build de produção do dashboard aprovado;
- migration/schema já haviam sido validados em banco temporário isolado.

Teste local de banco não executado nesta retomada porque o Docker Desktop estava
desligado e a distribuição WSL não tinha acesso ao daemon. Próximo passo:

1. iniciar Docker Desktop com integração WSL;
2. aplicar e verificar a migration `007` somente no banco local;
3. criar admin local com senha temporária via variável de ambiente;
4. ligar `ADMIN_AUTH_ENABLED=true` apenas localmente;
5. testar login, troca obrigatória, CRUD de usuários, CSRF e logout;
6. manter a flag da VPS desligada.

### Autenticação local validada pelo usuário em 2026-07-01

O usuário confirmou no ambiente local:

- migration aplicada;
- primeiro administrador criado pelo script seguro;
- login com senha temporária aprovado;
- redirecionamento para troca obrigatória aprovado;
- alteração da senha aprovada;
- novo acesso ao painel aprovado.

Próxima fase recomendada:

1. validar a tela `/usuarios`, criação de operador e alteração de papel;
2. definir e aplicar uma matriz de permissões para `admin` e `operator`;
3. proteger o OAuth Meta com sessão administrativa e parâmetro `state`;
4. adicionar autenticação própria para integrações de serviço;
5. gravar `created_by_user_id` e `actor_user_id` nas ações de postagem;
6. somente depois preparar rollout controlado na VPS.

### Feature de permissões granulares registrada em 2026-07-01

Foi criado `docs/features/001-permissoes-granulares.md` para evoluir os papéis
fixos para capacidades verificadas pelo backend. O template inicial de operador
de conteúdo poderá criar e agendar postagens, mas não terá acesso a métricas,
respostas do Inbox, contas, tokens ou usuários por padrão.

A implementação foi deliberadamente adiada até definir regras como posts
próprios versus posts do workspace e permissão de publicação imediata. No estado
local atual, a proteção básica já impede `operator` de acessar Contas e Usuários
no backend e no dashboard.

### OAuth Meta protegido localmente em 2026-07-01

Foi preparada a migration `backend/sql/008-meta-oauth-state.sql`, seu verificador
e o alinhamento do schema inicial. Quando `ADMIN_AUTH_ENABLED=true`, o início e o
callback do OAuth Meta agora exigem sessão administrativa e senha definitiva.

O fluxo gera um `state` aleatório vinculado à sessão e ao usuário, armazena
somente seu SHA-256, expira em dez minutos e o consome atomicamente uma única
vez. A conexão bem-sucedida gera auditoria `accounts.meta_connected`.

Validações locais realizadas:

- migration `008` aplicada duas vezes sem erro no PostgreSQL local;
- verificador da migration aprovado;
- URL de autorização confirmou a presença de `state`;
- primeiro consumo do `state` foi aceito e o segundo foi recusado;
- sintaxe do backend, ESLint do escopo e build do dashboard aprovados;
- nenhuma conexão externa com a Meta foi iniciada;
- nenhuma alteração desta fase foi aplicada na VPS.

Próximo passo recomendado: reiniciar o backend local, confirmar que um operador
recebe acesso negado em Contas/Usuários e que um administrador consegue iniciar
o OAuth Meta. Depois, implementar autoria de postagens e atores dos eventos,
mantendo a autenticação de serviço como bloqueio obrigatório antes do rollout na
VPS.

### Autoria de postagens e eventos preparada localmente em 2026-07-01

Foi conectada a sessão autenticada às colunas já criadas pela migration `007`:

- uploads por `/api/media/upload` e `/api/media/upload-post` gravam
  `posts.created_by_user_id`;
- a criação grava um evento `created` com o mesmo usuário dentro da transação do
  post, uploads e itens de mídia;
- enfileiramento individual ou coletivo solicitado pela interface, publicação
  imediata e cancelamento gravam `post_events.actor_user_id`;
- eventos do coletor, worker e demais processos automáticos permanecem com ator
  nulo e continuam identificados por `details.source`;
- cancelamento e seu evento agora são atômicos no banco;
- consultas de posts e eventos retornam ID, username e nome de exibição;
- Agendamentos mostra “Criado por” e os detalhes do Histórico mostram
  “Responsável”; registros antigos aparecem como “Sistema/legado”.

Compatibilidade preservada:

- com `ADMIN_AUTH_ENABLED=false`, novas autorias ficam nulas;
- posts e eventos antigos não receberam backfill fictício;
- worker, n8n, política de tentativas e publicação de Reels não foram alterados;
- schema inicial recebeu `post_events.workspace_id`, já existente no banco real
  por migration anterior, para manter instalações limpas coerentes.

Validações locais:

- `node --check` aprovado em todos os arquivos backend alterados;
- consultas reais de posts e eventos aprovadas no PostgreSQL local;
- teste de autoria e ator com usuário `admin` aprovado dentro de transação com
  `ROLLBACK`;
- build de produção do dashboard aprovado;
- ESLint dos tipos/serviços alterados aprovado;
- o lint completo das duas páginas ainda aponta regras preexistentes de
  `setState` em `useEffect`, sem relação com esta alteração;
- nenhuma postagem foi criada, cancelada ou publicada pelo teste;
- nada foi aplicado na VPS.

Próximo passo recomendado: reiniciar backend e dashboard locais, criar uma
postagem de teste autenticada e confirmar criador/evento na interface. Depois,
adicionar autenticação de serviço para rotas chamadas por integrações antes de
preparar o rollout da autenticação na VPS.

#### Teste real local de autoria concluído

Post `d95ac58a-3845-4a61-a8b8-c4192f1f4bfe`, carrossel com três mídias:

- criado autenticado como `admin` e exibido como “Administrador” em
  Agendamentos;
- evento `created` gravado com `actor_user_id` do administrador;
- cancelamento gravado com evento `canceled` e o mesmo administrador como ator;
- status final `canceled`, `retry_count=0` e nenhum job restante no Redis;
- a tentativa de “Enfileirar” antes do horário agendado não encontrou o post na
  lista de prontos e, corretamente, não criou evento nem executou o worker;
- portanto, a URL local/ngrok não foi usada por esse post e não houve tentativa
  de publicação externa.

Conclusão: criação e cancelamento com autoria estão validados localmente. A tela
resumida do Histórico ainda não mostra a coluna de responsável, embora a API e o
banco já retornem o ator; os detalhes do histórico possuem essa exibição.

## Deploy de autenticação preparado em 2026-07-01

Inspeção somente leitura da VPS:

- branch `main`, commit observado `77fab77`;
- `socialbot-backend` e `socialbot-worker` online no PM2;
- containers `socialbot_postgres`, `socialbot_redis` e `socialbot_n8n` ativos;
- nenhuma tabela `socialbot_*` existente ainda;
- variáveis `ADMIN_AUTH_*` ausentes no `backend/.env`;
- CORS, callback Meta e frontend já apontam para os domínios operacionais;
- Node `v20.20.2`, npm `11.17.0` e disco com espaço suficiente;
- worktree da VPS possui apenas mudanças de modo executável em cinco scripts e
  um arquivo vazio não rastreado `scripts/sql/005-atualizacao.sql`; preservar.

Materiais criados:

- `scripts/prepare_auth_vps.sh`: backup validado do PostgreSQL seguido das
  migrations/verificadores `007` e `008`; não edita `.env`, não reinicia PM2 e
  recusa executar se a autenticação já estiver ativa;
- `docs/0008-auth-vps-deploy.md`: sequência completa de commit, pull seguro,
  migrations, backend com flag desligada, criação do admin, frontend, ativação,
  testes e retorno por feature flag.

Decisão de rollout:

1. publicar o código;
2. fazer backup e migrations com `ADMIN_AUTH_ENABLED=false`;
3. reiniciar backend e validar compatibilidade ainda sem autenticação;
4. criar admin temporário;
5. publicar dashboard;
6. ativar autenticação e testar login/troca de senha;
7. retornar apenas a flag para `false` se houver falha funcional.

Nenhuma alteração foi aplicada na VPS durante a preparação.

## Autenticação implantada e validada na VPS em 2026-07-01

O usuário executou o checklist de deploy e confirmou o funcionamento do painel.
Uma verificação posterior somente leitura confirmou:

- commit implantado na VPS: `2bbf4cf`;
- `socialbot-backend` online no PM2;
- `socialbot-worker` online e sem restart causado por esta validação;
- `GET https://api.hrmmotos.com.br/api/health` retornou `{"ok":true}`;
- `GET https://api.hrmmotos.com.br/api/auth/status` retornou
  `{"enabled":true}`;
- tabelas presentes: `socialbot_users`, `socialbot_user_workspaces`,
  `socialbot_sessions`, `socialbot_audit_log` e `socialbot_oauth_states`;
- migrations `007` e `008` estão, portanto, materializadas na VPS;
- autenticação administrativa está ativa em produção.

O usuário também informou que os testes funcionais na VPS ficaram operacionais.
Não houve alteração remota durante a verificação do Codex.

Próximos desenvolvimentos programados:

1. informativo do usuário e papel junto ao botão “Sair”;
2. autenticação própria para integrações de serviço;
3. matriz granular de permissões do operador;
4. nome da postagem e comportamento explícito para postagem sem agendamento.

## Informativo do usuário implementado localmente em 2026-07-02

O cabeçalho do dashboard agora apresenta, ao lado do botão “Sair”:

- nome de exibição do usuário;
- username como fallback;
- papel traduzido como “Administrador” ou “Operador”;
- truncamento seguro para nomes longos;
- layout responsivo em telas menores.

Os dados vêm do contexto de autenticação já restaurado por `/api/auth/me`; não
foi criada consulta adicional nem armazenamento paralelo. ESLint do componente
e build de produção do dashboard foram aprovados. A alteração ainda não foi
implantada na VPS.

### Análise inicial de autenticação de serviço

O mapeamento local encontrou uso externo de rotas `/api/internal` apenas em
scripts manuais de validação, principalmente `scripts/validar_publicacao_real.sh`.
Dashboard, coletor e worker usam sessão humana ou chamadas internas ao processo.

Decisão: não criar agora uma chave de serviço com acesso amplo a todas as rotas
internas. Antes da implementação, identificar um consumidor real, limitar rotas
e métodos necessários, usar hash/rotação da credencial e registrar auditoria
separada de usuários humanos.

Próximo passo recomendado: validar visualmente o novo cabeçalho e então evoluir
o modelo de permissões do operador ou implementar nome da postagem e semântica
explícita para posts sem data.

## Matriz inicial de permissões do operador implementada em 2026-07-02

Foi criado `backend/src/modules/auth/permissions.service.js` com capacidades
versionadas por papel. `publicUser()` agora inclui `permissions`, portanto login
e `/api/auth/me` entregam ao dashboard a mesma matriz usada pelo backend.

Operador atualmente pode:

- visualizar, criar, agendar, publicar imediatamente e cancelar posts;
- visualizar conversas e mensagens do Inbox.

Operador não pode:

- acessar Dashboard, Histórico, timelines ou endpoints de métricas;
- acessar `/api/internal/posts/events`, que poderia revelar métricas por eventos;
- responder mensagens pelas rotas atual, interna ou legada;
- acessar Testers DM;
- alterar horários globais;
- gerenciar contas ou usuários.

Proteções técnicas:

- middleware `requirePermission()` no backend, com HTTP 403 e código
  `PERMISSION_DENIED`;
- compatibilidade preservada quando `ADMIN_AUTH_ENABLED=false`;
- `PermissionRoute` no frontend;
- menu filtrado por capacidade;
- Inbox permanece legível para operador, mas exibe aviso no lugar do compositor;
- fallback de rollout permite admin de backend anterior, sem liberar operador.

Validações locais:

- `node --check` aprovado nos arquivos backend alterados;
- matriz testada: operador aceito em `posts.create` e negado em `metrics.view`
  e `inbox.reply`; admin aceito em `metrics.view`;
- ESLint aprovado nos novos componentes e arquivos do escopo;
- build de produção do dashboard aprovado;
- o lint isolado da página antiga do Inbox ainda aponta o débito preexistente de
  `setState` dentro de `useEffect`;
- nenhuma migration foi necessária;
- nada foi aplicado na VPS nesta fase.

Próximo teste: criar ou usar um operador local e confirmar menu reduzido, Inbox
somente leitura e respostas 403 nas APIs. Depois, preparar commit e rollout do
backend antes do dashboard para que `permissions` já esteja disponível.

### Testes funcionais do operador aprovados em 2026-07-03

O usuário executou os testes finais no ambiente local e confirmou que todos
passaram. A validação cobriu o comportamento esperado do perfil operador após a
matriz inicial de capacidades.

Também foi criado `backend/scripts/test-operator-permissions.js`, disponível por
`npm run test:operator-permissions`. O teste:

- usa o primeiro operador local ativo;
- cria uma sessão temporária sem conhecer ou alterar a senha;
- confirma acesso à listagem de posts;
- confirma `403 PERMISSION_DENIED` para métricas, eventos de histórico,
  respostas do Inbox, Testers DM, horários globais, contas e usuários;
- remove a sessão temporária em `finally`.

Estado: fase validada localmente e pronta para commit/deploy. Nenhuma alteração
desta fase foi aplicada na VPS ainda.

Próxima evolução recomendada: adicionar nome/título à postagem e tornar
explícito que uma postagem sem data entra na fila assim que possível.

## Nome da postagem e fila imediata preparados localmente em 2026-07-03

Foi criada a migration `009-post-title-immediate-queue.sql` e seu verificador:

- `posts.title VARCHAR(160)` opcional para compatibilidade;
- constraint contra título vazio;
- índice parcial `idx_posts_title`;
- schema inicial alinhado;
- posts antigos preservados sem backfill fictício.

Backend:

- endpoints legado e multi-tipo aceitam `postTitle` ou `title`;
- título ausente em cliente legado usa o nome do primeiro arquivo como fallback;
- criação retorna título e workspace necessários para orquestração;
- post sem data é enviado ao BullMQ imediatamente após o commit;
- sucesso marca `queued` e registra evento com origem
  `media.upload.immediate`;
- falha de Redis não desfaz o upload: mantém `pending`, registra `queue_failed`
  quando possível e permite recuperação pelo coletor;
- formatos multi-tipo não são enfileirados quando sua publicação está
  desabilitada;
- consultas de posts e eventos retornam o título.

Dashboard:

- título obrigatório com até 160 caracteres;
- aviso explícito de publicação assim que possível quando não há data;
- dia sem horário ou horário sem dia bloqueia o envio;
- mensagem de sucesso diferencia fila, agendamento, preparação e erro de fila;
- Agendamentos exibe a coluna Nome;
- Histórico prioriza `postTitle` quando disponível.

Validações locais:

- migration aplicada duas vezes e verificador aprovado;
- nove posts antigos permaneceram válidos com título nulo;
- bootstrap completo aprovado em banco temporário removido ao final;
- consulta real da listagem aprovada;
- fila simulada com sucesso confirmou `markQueued` e evento `queued`;
- falha simulada retornou `queue_error` e registrou `queue_failed` sem lançar
  erro para o upload;
- sintaxe backend aprovada;
- ESLint do escopo e build do dashboard aprovados;
- `SchedulePage` mantém débito preexistente de lint em `useEffect`;
- nenhuma publicação real foi disparada;
- migration `009` ainda não foi aplicada na VPS.

Próximo passo: testar localmente um post com data futura e as validações de
agendamento parcial. O teste real sem data exige autorização explícita porque
pode publicar no Instagram imediatamente.

### Ambiente local iniciado para validação em 2026-07-03

Antes de iniciar o worker foram encontrados e, com autorização do usuário,
cancelados três posts antigos:

- `c86fed7b-697e-4a3d-9972-f4f6a20a72ca`;
- `52a5f978-5b9b-4efb-98a9-b123e663224a`;
- `e6964574-32a6-405f-96b4-d5d1d441345d`.

Os três receberam evento `canceled`. A fila local `socialbot_publish` foi
limpa por completo; havia um job Reel ativo órfão e, depois da limpeza, os
estados waiting, active e delayed ficaram em zero.

Serviços locais ativos para teste:

- backend em `http://localhost:3101`, processo Node Windows `16856`;
- frontend em `http://localhost:5181`, servido pelo Vite no WSL;
- worker em processo Node Windows `10920`;
- PostgreSQL, Redis e n8n ativos no Docker.

O backend foi iniciado somente para esta sessão com
`AUTO_ENQUEUE_READY_ENABLED=false`, evitando recolher agendamentos antigos.
O novo enfileiramento imediato após upload continua ativo porque chama BullMQ
diretamente. Para testar posts com data futura, lembrar que o coletor automático
está desligado até o backend ser reiniciado normalmente.

### Teste funcional de título e agendamento em 2026-07-03

Dois carrosséis com quatro mídias cada foram criados pelo administrador:

- `24f63912-2320-4fe8-9f47-b1bbaf77098e`:
  - título `380xt-adv150`;
  - criado sem data;
  - status `pending`;
  - apenas evento `created`;
  - nenhum job no Redis;
  - comportamento esperado porque `MULTI_PUBLISH_ENABLED=false` localmente:
    formato permanece em preparação e não entra em uma fila que falharia.
- `b48fb947-97e5-4157-80ab-7ad8e2ca2294`:
  - título `Campanha Potenza 380XT para Scooters`;
  - status `scheduled`;
  - agendado para `2026-07-04 10:30:00-03`;
  - apenas evento `created` e nenhum job antecipado no Redis.

Ambos preservaram autoria `admin`, `retry_count=0`, ausência de erros e quatro
itens de mídia. Conclusão: título e agendamento futuro estão validados. Para
validar entrada imediata real de um carrossel, seria necessário ativar
`MULTI_PUBLISH_ENABLED=true`, disponibilizar URLs públicas válidas e aceitar a
possibilidade de publicação externa.

## Estado atual consolidado em 2026-07-12

Este é o ponto recomendado de retomada. O desenvolvimento local está à frente
da VPS no item de título/fila imediata, e a próxima sessão deve evitar refazer
fases já concluídas.

### Fases multi-tipo

- Fases 1 e 2 concluídas: schema multi-tipo e `post_media_items`.
- Fase 3 concluída: endpoint `POST /api/media/upload-post` com múltiplos tipos.
- Fases 4 a 8 concluídas: publisher por estratégia, Feed Imagem, Carrossel e
  Stories preparados.
- Fase 9 concluída: worker integrado ao publisher multi-tipo atrás de feature
  flag, preservando Reels via n8n.
- Fases 10 e 11 concluídas: interface multi-tipo e tela de Agendamentos com
  tipo, quantidade, autoria e título.
- Reels estão publicados via n8n v4 na VPS e o fluxo foi validado com sucesso.
- Feed Imagem, Carrossel, Story Imagem e Story Vídeo já têm publicação via Meta
  preparada/validada em rollout controlado anterior. Usar sempre feature flag e
  post alvo antes de testes reais.

### Autenticação, usuários e permissões

- Autenticação administrativa própria foi implantada na VPS e validada.
- Usuários, sessões, troca de senha, papéis e auditoria básica estão ativos.
- OAuth Meta possui proteção por sessão administrativa e `state`.
- Autoria de postagens e atores de eventos foi implementada localmente.
- Cabeçalho exibe usuário logado e papel.
- Matriz inicial de permissões do operador foi implementada e testada
  localmente:
  - operador pode criar/agendar/publicar/cancelar posts;
  - operador pode visualizar Inbox;
  - operador não pode acessar métricas, histórico/eventos, responder Inbox,
    testers DM, horários globais, contas ou usuários.

### Título da postagem e fila sem data

- Commit local criado: `6544139 feat: adiciona titulo e fila imediata`.
- Migration local criada e testada:
  - `backend/sql/009-post-title-immediate-queue.sql`;
  - `backend/sql/009-post-title-immediate-queue-verify.sql`.
- `posts.title` foi adicionado como campo opcional, com validação contra texto
  vazio e limite de 160 caracteres no dashboard.
- Uploads aceitam `postTitle` ou `title`; clientes legados usam fallback pelo
  primeiro arquivo.
- Sem data agendada significa “publicar assim que possível”, mas respeitando:
  - Reels podem entrar na fila imediatamente;
  - formatos multi-tipo só entram se a publicação estiver habilitada pela flag;
  - falha de Redis não desfaz upload, registra `queue_failed` e mantém
    recuperação possível.
- Testes locais de título/agendamento foram aprovados com posts:
  - `24f63912-2320-4fe8-9f47-b1bbaf77098e`, sem data, ficou `pending` porque
    `MULTI_PUBLISH_ENABLED=false`;
  - `b48fb947-97e5-4157-80ab-7ad8e2ca2294`, agendado para
    `2026-07-04 10:30:00-03`, sem job antecipado.

### Diferença local versus VPS

- A VPS já tem autenticação, usuários, permissões anteriores e fluxo de
  publicação funcionando.
- A migration `009` e o commit `6544139` ainda precisam ser enviados/aplicados
  na VPS.
- Não copiar portas locais para a VPS. A VPS já está operacional com PM2,
  Docker, n8n, domínios e Nginx próprios.
- Antes de qualquer deploy de schema na VPS, fazer backup PostgreSQL e rodar o
  verificador correspondente.

### Próxima ordem segura

1. Verificar `git status --short`; `reels/` pode permanecer não rastreado.
2. Fazer `git push origin main` local se o commit `6544139` ainda não estiver
   no remoto.
3. Na VPS, executar `git pull --ff-only origin main`.
4. Fazer backup do PostgreSQL da VPS.
5. Aplicar `backend/sql/009-post-title-immediate-queue.sql`.
6. Rodar `backend/sql/009-post-title-immediate-queue-verify.sql`.
7. Reiniciar backend e worker via PM2.
8. Publicar dashboard com `sudo ./scripts/deploy_frontend_hostinger.sh`.
9. Validar:
   - login;
   - tela de Uploads exigindo título;
   - post com data futura;
   - post sem data apenas quando a intenção for testar fila imediata;
   - permissões do operador.

### Próximas evoluções recomendadas

- Refinar permissões do operador em capacidades mais granulares, incluindo
  regras de posts próprios versus posts do workspace.
- Implementar autenticação de serviço para rotas chamadas por integrações, em
  vez de expor `/api/internal` sem escopo claro.
- Exibir responsável também no resumo do Histórico, não apenas nos detalhes.
- Melhorar painel de auditoria de ações administrativas.
- Criar rotina operacional para backup/export do workflow n8n v4 após mudanças.

### Modelos de mídia com IA e TAG — fundação preparada

Em 2026-07-12 foi criada a proposta
`docs/features/002-modelos-midias-ia-tags.md`.

A ideia é adicionar ao SocialBot uma biblioteca de campanhas/modelos
reutilizáveis, identificados por TAG, com mídias aprovadas e textos gerados ou
assistidos por IA. Ao criar uma postagem, o usuário poderá informar a TAG,
carregar mídias e legendas sugeridas, revisar e então criar Feed, Carrossel,
Story ou Reel usando o fluxo atual.

Referência conceitual usada: `C:\Projetos\otimizador_skills`, especialmente:

- cadastro de produto com imagem-modelo;
- compatibilidades e dados reais para evitar invenções da IA;
- fila de geração;
- prompt enviado salvo para auditoria;
- modo teste de IA;
- provedor OpenAI-compatible/LM Studio.

Como `/docs/` é ignorado para arquivos novos, também foi criada documentação
versionável em:

- `project-docs/features/002-modelos-midias-ia-tags.md`.

Fundação local implementada:

- `backend/sql/010-media-templates.sql`;
- `backend/sql/010-media-templates-verify.sql`;
- alinhamento de `postgres-init/000_socialbot_init.sql`;
- tabelas `media_templates`, `media_template_items` e
  `media_template_text_variants`;
- colunas opcionais em `posts`: `media_template_id` e
  `media_template_text_variant_id`;
- constraints, índices e triggers de `updated_at` para modelos e variações.

Validação realizada:

- `git diff --check` aprovado no escopo alterado;
- schema inicial aplicado com sucesso em banco temporário
  `socialbot_schema_010_tmp`;
- migration `010` aplicada duas vezes no mesmo banco temporário para validar
  idempotência;
- verificador `010-media-templates-verify.sql` aprovado;
- banco temporário removido ao final.

Status: fundação de banco pronta localmente. Ainda não foram criados endpoints,
serviços, dashboard, integração de IA, worker ou publicação por TAG. A migration
`010` ainda não foi aplicada no banco real local nem na VPS.

#### CRUD backend básico de modelos implementado

Ainda em 2026-07-12 foi implementada a primeira camada backend da Feature 002:

- permissões novas em `backend/src/modules/auth/permissions.service.js`:
  - `media_templates.view`;
  - `media_templates.create`;
  - `media_templates.update`;
  - `media_templates.approve`;
  - `media_templates.generate_ai_text`;
  - `media_templates.create_post`;
- operador recebe inicialmente somente `media_templates.view` e
  `media_templates.create_post`;
- novo módulo:
  - `backend/src/modules/media-templates/media-templates.service.js`;
  - `backend/src/modules/media-templates/media-templates.routes.js`;
- rotas montadas em:
  - `GET /api/media/templates`;
  - `GET /api/media/templates/by-tag/:tag`;
  - `GET /api/media/templates/:id`;
  - `POST /api/media/templates`;
  - `PATCH /api/media/templates/:id`;
  - `POST /api/media/templates/:id/approve`;
  - `DELETE /api/media/templates/:id`;
  - `POST /api/media/templates/:id/items`;
  - `DELETE /api/media/templates/:id/items/:itemId`;
  - alias temporário `/api/media-templates`.

O CRUD atual permite criar, listar, buscar por TAG, editar, aprovar, arquivar e
adicionar/remover itens de mídia já existentes por metadados. Ele ainda não faz
upload de arquivos para modelos, não gera textos por IA, não cria posts por TAG
e não possui interface no dashboard.

Validação adicional:

- `node --check` aprovado para o serviço, rotas, permissões e `app.js`;
- teste Node real contra banco temporário `socialbot_templates_crud_tmp`:
  - criou workspace temporário;
  - criou modelo com TAG `potenza-gt-forza-kawasaki`;
  - listou por busca;
  - buscou por TAG;
  - adicionou item de mídia;
  - aprovou o modelo;
  - arquivou o modelo;
  - banco temporário removido ao final.

A migration `010` foi aplicada no banco real local em Docker Desktop/Windows no
dia 2026-07-12:

- banco: `n8n`;
- container: `socialbot_postgres`;
- comando executado via PowerShell, usando `docker exec`;
- verificador `010-media-templates-verify.sql` aprovado;
- tabelas novas confirmadas vazias:
  - `media_templates = 0`;
  - `media_template_items = 0`;
  - `media_template_text_variants = 0`.

A migration `010` ainda não foi aplicada na VPS.

Roteiro versionável para a futura subida na VPS criado em:

- `project-docs/deploy/002-media-templates-vps.md`.

Script versionável de backup PostgreSQL criado em:

- `scripts/backup_postgres_db.sh`.

Uso recomendado na VPS antes das migrations:

```bash
cd /home/socialbot/apps/auto-reels-n8n
bash scripts/backup_postgres_db.sh
```

Script PowerShell separado para backup do PostgreSQL local em Docker
Desktop/Windows criado em:

- `scripts/backup_postgres_db_local.ps1`.

Uso local recomendado:

```powershell
cd C:\Projetos\auto-reels-n8n
powershell -ExecutionPolicy Bypass -File .\scripts\backup_postgres_db_local.ps1
```

Em 2026-07-13, o script local foi ajustado para compatibilidade com Windows
PowerShell 5.1, evitando `ProcessStartInfo.ArgumentList`, validado com parser
PowerShell e executado com sucesso contra o container `socialbot_postgres`.
Também foi adicionada a regra `backups/` ao `.gitignore` para impedir commit
acidental de dumps locais.

Script PowerShell local para reset seguro de senha administrativa criado em:

- `scripts/reset_admin_password_local.ps1`.

Ele pede a nova senha via prompt seguro, gera o hash usando
`backend/src/modules/auth/password.service.js`, atualiza `socialbot_users`,
limpa `failed_login_attempts`/`locked_until`, força `active = TRUE` e revoga
sessões abertas em `socialbot_sessions`. Uso local recomendado:

```powershell
cd C:\Projetos\auto-reels-n8n
powershell -ExecutionPolicy Bypass -File .\scripts\reset_admin_password_local.ps1
```

Esse roteiro mantém a ordem segura: backup, `git pull`, validar/aplicar `009`,
validar/aplicar `010`, reiniciar somente o backend, testar as rotas novas e
então publicar o dashboard com o script já existente da VPS. Não há necessidade
de alterar n8n, worker, portas ou domínios nesta etapa.

#### Variações de texto manuais para modelos

Em 2026-07-13 foi adicionada a camada backend para criar, editar, aprovar e
rejeitar variações de texto de um modelo, sem acionar IA externa e sem alterar
worker/publicação:

- `POST /api/media/templates/:id/text-variants`;
- `PATCH /api/media/templates/:id/text-variants/:variantId`;
- `POST /api/media/templates/:id/text-variants/:variantId/approve`;
- `DELETE /api/media/templates/:id/text-variants/:variantId`.

O `DELETE` não apaga fisicamente: ele marca a variação como `rejected`,
preservando histórico. A listagem detalhada do modelo já retorna
`textVariants`. Validação executada: `node --check` em
`media-templates.service.js` e `media-templates.routes.js`.

#### Primeira interface autenticada de modelos

Ainda em 2026-07-13 foi criada a página do dashboard `/modelos`, protegida por
`media_templates.view`, com consumo autenticado dos endpoints via cookie/CSRF:

- novo service:
  `dashboard/src/modules/media-templates/services/mediaTemplates.service.ts`;
- nova página:
  `dashboard/src/modules/media-templates/pages/MediaTemplatesPage.tsx`;
- rota adicionada em `AppRouter.tsx`;
- item `Modelos` adicionado ao menu principal em `AppLayout.tsx`.

A página permite listar/buscar modelos, criar modelo quando o usuário possui
`media_templates.create`, selecionar detalhes, aprovar/arquivar conforme
permissões, criar variações manuais e aprovar/rejeitar variações. Validação
executada: `npm run build` no dashboard via WSL, concluído com sucesso.

#### Criação inicial de postagem a partir da TAG

Em seguida foi implementado o primeiro fluxo de criação de post por TAG:

- backend:
  `POST /api/media/templates/by-tag/:tag/posts`, protegido por
  `media_templates.create_post`;
- service:
  `createPostFromTemplateTag` em `media-templates.service.js`;
- dashboard:
  formulário "Criar postagem pela TAG" na página `/modelos`;
- frontend service:
  `mediaTemplatesService.createPostFromTag`.

O fluxo exige modelo `active`, variação de texto `approved` e mídias já
cadastradas em `media_template_items`. Ele copia a legenda final para
`posts.caption`, grava `media_template_id` e `media_template_text_variant_id`,
copia mídias do modelo para `post_media_items`, cria evento `created` com
`source = media-template.tag` e não publica automaticamente. Sem data futura, o
post nasce `pending`; com data futura, nasce `scheduled`.

Validação executada: `node --check` nos arquivos backend e `npm run build` no
dashboard via WSL, concluído com sucesso.

Pendência direta: criar upload/reuso real de mídias para modelos na interface.
Enquanto isso não existir, modelos somente textuais retornarão "Modelo não
possui mídias cadastradas" ao tentar criar postagem por TAG.

#### Upload inicial de mídias para modelos

Foi implementada a primeira versão do upload de mídia para modelos:

- backend:
  `POST /api/media/templates/:id/media-upload`, protegido por
  `media_templates.update`;
- upload via `multer`, aceitando JPG, JPEG, PNG ou MP4;
- destino atual: `MEDIA_PENDING_DIR`, reaproveitando a infraestrutura local de
  mídias já usada por posts;
- após o upload, o backend cria o item em `media_template_items` usando
  `addTemplateItem`;
- dashboard `/modelos`: bloco "Adicionar mídia ao modelo";
- a tela também lista as mídias cadastradas no modelo selecionado.

Validação executada: `node --check` nos arquivos backend e `npm run build` no
dashboard via WSL, concluído com sucesso. Próximo teste manual recomendado:
anexar uma mídia real em um modelo ativo com variação aprovada e então criar
uma postagem pela TAG.

#### Seeds locais de referência para campos de modelo

Em 2026-07-13 foram preenchidos no banco local exemplos manuais para facilitar
o entendimento dos campos de modelo, com base nas postagens antigas locais:

- `potenza-380xt`;
- `potenza-xt-evolution`;
- `potenza-gt-forza`.

Foram atualizados campos como `brand`, `product_name`, `base_description`,
`target_audience`, `allowed_claims`, `forbidden_claims`, `default_cta`,
`base_hashtags` e `notes`. Também foi criada uma variação de texto aprovada
para cada modelo. O modelo `potenza-380xt` foi ativado localmente para permitir
teste do fluxo por TAG.

Esses dados são exemplos locais para validação/treinamento de uso da tela e não
contêm credenciais. Antes de levar para VPS, revisar se os textos e claims
devem ser considerados conteúdo oficial ou apenas seed de desenvolvimento.

#### Geração local de textos em modo teste

Em 2026-07-14 foi implementada a primeira geração de sugestão de texto para os
modelos, ainda sem provedor externo de IA:

- backend:
  `POST /api/media/templates/:id/text-variants/generate`;
- permissão:
  `media_templates.generate_ai_text`;
- service:
  `generateTextVariantDraft` em `media-templates.service.js`;
- dashboard:
  botão "Gerar sugestão em modo teste" na página `/modelos`;
- status criado:
  `generated`, exigindo revisão e aprovação humana antes de uso;
- auditoria:
  `media_templates.text_variant_generated_local`;
- campos usados:
  produto, marca, descrição base, público-alvo, claims permitidos, claims
  proibidos, CTA e hashtags base;
- campos auditáveis:
  `prompt_sent` e `ai_response`, sem tokens, chaves ou segredos.

A geração é determinística/local, útil para preencher rascunhos e testar a UX.
Ela não publica, não enfileira e não chama API externa. A postagem por TAG
continua exigindo variação aprovada e mídias vinculadas ao modelo.

Validações executadas:

- `node --check backend/src/modules/media-templates/media-templates.service.js`;
- `node --check backend/src/modules/media-templates/media-templates.routes.js`;
- `npm run build` no dashboard via WSL.

O usuário testou a criação de agendamentos a partir dos modelos localmente e
confirmou que a VPS ficou funcionando como a local.

#### Revisão e edição de variações de texto

Em 2026-07-13 foi implementada a revisão direta das variações na página
`/modelos`, sem migration nova e sem alterar backend de publicação:

- `dashboard/src/modules/media-templates/services/mediaTemplates.service.ts`
  passou a expor `updateTextVariant`;
- `dashboard/src/modules/media-templates/pages/MediaTemplatesPage.tsx` ganhou
  botão "Revisar" por variação;
- o texto da legenda agora é exibido com quebra de linha e rolagem na tabela;
- o formulário de revisão permite editar tipo, tom, objetivo, título, legenda,
  hashtags e CTA;
- "Salvar revisão" grava a variação como `generated`;
- "Salvar e aprovar" grava como `approved` apenas para usuários com
  `media_templates.approve`;
- cancelar edição não altera dados.

Validação executada:

- `npm run build` no dashboard via WSL.

Decisão de segurança: se uma variação aprovada for editada por "Salvar revisão",
ela volta para `generated`, exigindo nova aprovação antes de ser usada para
criar postagens.

#### Prévia da postagem por TAG

Em 2026-07-13 foi implementada a prévia da postagem antes da criação final pelo
fluxo de TAG, sem migration nova e sem alterar backend/worker/n8n:

- a seção "Criar postagem pela TAG" mostra status inicial previsto
  (`pending` ou `scheduled`);
- exibe tipo, quantidade de mídias, agendamento, título, legenda, CTA e
  hashtags;
- lista as mídias do modelo que serão copiadas para `post_media_items`, com
  ordem, tipo, papel, arquivo e tamanho;
- bloqueia a confirmação quando o modelo não está `active`, não possui mídia ou
  não há variação aprovada;
- o botão foi renomeado para "Confirmar criação da postagem".

Validação executada:

- `npm run build` no dashboard via WSL.

Próximo passo técnico recomendado: preparar commit/deploy incremental da
interface ou avançar para provedor real de IA configurável, mantendo o modo
teste e a aprovação humana.

## Desenvolvimento programado após a validação multi-tipo

Os itens abaixo foram solicitados em 2026-06-26 e ficaram registrados como
planejamento inicial. Parte deles já foi implementada nas seções posteriores
deste documento; manter esta seção apenas como histórico de intenção.

### Postagem sem data agendada

Ao criar uma postagem sem `scheduled_at`:

- manter e exibir a data e a hora de criação (`created_at`);
- permitir informar e persistir um nome/título para identificar a postagem;
- inserir a postagem automaticamente na fila de publicação;
- registrar em eventos quando ela foi criada e quando entrou na fila;
- impedir enfileiramento duplicado e preservar o limite atual de duas
  tentativas;
- definir claramente no dashboard que ausência de data significa “publicar
  assim que possível”, antes de ativar esse comportamento em produção.

Antes da implementação, revisar o comportamento atual de posts `pending` sem
agendamento, pois eles já podem ser considerados prontos pelo scheduler. A
mudança deve ser aditiva e não pode alterar o fluxo de Reels ou republicar posts
antigos.

### Autenticação e gestão de usuários do Admin

Substituir o acesso padrão do Admin por autenticação própria mais segura:

- cadastro e administração de usuários;
- senhas armazenadas somente com hash forte, nunca em texto puro;
- sessão segura, expiração, logout e proteção contra tentativas abusivas;
- papéis e permissões, começando por `admin` e `operator`;
- desativação de usuário sem apagar seu histórico;
- recuperação ou redefinição de senha por fluxo seguro;
- proteção das rotas do dashboard e das APIs administrativas;
- manter segredos e chaves fora do frontend e do repositório.

Antes de escolher biblioteca ou provedor, revisar a arquitetura atual do Admin,
as rotas expostas e o proxy da VPS. Fazer rollout com migration transacional,
usuário administrador inicial criado de forma segura e plano de retorno.

### Autoria e auditoria das postagens

Depois da gestão de usuários:

- relacionar a postagem ao usuário que a criou (`created_by_user_id`);
- registrar também quem alterou, agendou, enfileirou, cancelou ou solicitou
  publicação imediata;
- incluir o identificador do usuário nos eventos de auditoria;
- exibir criador, data/hora de criação e nome da postagem no Admin;
- preservar registros históricos mesmo quando um usuário for desativado;
- não fazer backfill atribuindo usuários fictícios sem uma regra aprovada.

### Ordem sugerida

1. reduzir a imprecisão do scheduler, preservando o fluxo de Reels;
2. mapear autenticação, autorização e rotas administrativas atuais;
3. projetar tabelas/migrations de usuários, sessões e auditoria;
4. implementar autenticação e autorização no backend;
5. criar cadastro e administração de usuários no dashboard;
6. adicionar nome e autoria às postagens;
7. implementar enfileiramento automático de posts sem data;
8. testar localmente e liberar na VPS por etapas, sem alterar portas ou
   infraestrutura operacional.
