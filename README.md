# SocialBot

Plataforma full stack para operacao de conteudo no Instagram, combinando publicacao, agendamento, automacao, inbox, autenticacao administrativa e monitoramento em uma unica base de produto.

Este projeto demonstra a construcao de um sistema real de operacao interna: backend, dashboard, banco de dados, filas, workers, integracoes externas e evolucao incremental de arquitetura sem quebrar o fluxo legado mais sensivel do negocio.

## Destaques Do Projeto

- Evolucao de um fluxo legado de Reels para uma arquitetura preparada para multiplos formatos de publicacao
- Backend modular com autenticacao, permissoes, scheduler, historico, inbox, metricas e publisher por estrategia
- Dashboard administrativo em React para operacao diaria
- Worker assíncrono com BullMQ e Redis para processamento desacoplado
- Integracao com n8n e Meta Graph API
- Modelagem de dados preparada para multiplas midias por post
- Separacao cuidadosa entre ambiente local e VPS

## O Problema Que O Sistema Resolve

O SocialBot centraliza tarefas que normalmente ficariam espalhadas entre planilhas, ferramentas de automacao, publicacao manual e operacao via celular.

Na pratica, ele cria uma base unica para:

- receber uploads de conteudo;
- agendar publicacoes;
- controlar status operacionais;
- publicar com seguranca;
- acompanhar historico;
- responder mensagens;
- administrar contas, usuarios e permissoes;
- preparar a evolucao do produto sem interromper o fluxo que ja funciona.

## Escopo Tecnico Atual

Hoje o sistema ja possui implementacao real para:

- upload legado de Reels via `POST /api/media/upload`;
- upload multi-tipo via `POST /api/media/upload-post`;
- posts `reel`, `feed_image`, `feed_carousel`, `story_image` e `story_video`;
- dashboard administrativo com login, troca obrigatoria de senha e controle por permissao;
- tela de uploads, agendamentos, historico, contas, usuarios e horarios;
- inbox Instagram com visualizacao de conversas, leitura de mensagens e resposta;
- stream em tempo real via SSE para atualizacao de inbox;
- worker de publicacao com BullMQ;
- fluxo seguro de Reels via n8n;
- publisher multi-tipo com estrategias por formato;
- metricas e consultas operacionais;
- templates de midia e base para geracao assistida de conteudo;
- gerenciamento de credenciais de IA;
- limpeza e manutencao de midia por worker dedicado.

## Arquitetura E Decisoes De Engenharia

Uma das decisoes centrais do projeto foi preservar o fluxo funcional de Reels enquanto a plataforma ganhava suporte a novos formatos.

Isso levou a algumas escolhas importantes:

- `publish_type = 'reel'` como default para compatibilidade com dados antigos;
- criacao de `post_media_items` para suportar multiplos arquivos por post;
- camada de publisher por estrategia, separando o comportamento por tipo;
- uso de feature flag para liberar multi-publicacao de forma controlada;
- manutencao do caminho n8n para Reels enquanto os novos formatos evoluem;
- separacao clara entre configuracoes locais e configuracoes de VPS.

Esse desenho mostra um tipo de evolucao muito comum em sistemas reais: melhorar a arquitetura sem exigir reescrita total nem interromper a operacao existente.

## Fluxo Simplificado

```text
Dashboard
   ->
Backend / API
   ->
PostgreSQL + Redis
   ->
BullMQ
   ->
Worker
   ->
n8n ou Meta Graph API
   ->
Instagram
```

Regras atuais do fluxo:

- Reels continuam publicados pelo caminho mais estavel com n8n.
- Feed, Carrossel e Stories passam pela camada de publisher multi-tipo.
- A publicacao multi-tipo depende de `MULTI_PUBLISH_ENABLED=true`.
- Com a flag desligada, o sistema ainda pode criar e agendar posts multi-tipo sem publica-los automaticamente.

## Stack

### Backend

- Node.js
- Express 5
- PostgreSQL
- `pg`
- Multer
- Axios
- dotenv

### Frontend

- React 19
- React Router 7
- TypeScript
- Vite

### Processamento E Automacao

- Redis
- BullMQ
- node-cron
- n8n

### Infraestrutura

- Docker
- Docker Compose
- Linux / WSL
- Git e GitHub

## Estrutura Do Repositorio

```text
auto-reels-n8n/
├── backend/
│   ├── scripts/
│   ├── sql/
│   └── src/
│       ├── app.js
│       ├── server.js
│       ├── worker.js
│       ├── config/
│       ├── lib/
│       ├── middlewares/
│       ├── modules/
│       ├── routes/
│       ├── services/
│       └── utils/
├── dashboard/
│   └── src/
├── docs/
├── postgres-init/
├── docker-compose.yml
├── CODEX_CONTINUITY.md
└── README.md
```

## Modulos Relevantes

O backend hoje cobre dominios que vao muito alem de upload e publicacao:

- `auth/`
- `accounts/`
- `posts/`
- `scheduler/`
- `publisher/`
- `history/`
- `metrics/`
- `inbox/`
- `conversations/`
- `realtime/`
- `media-templates/`
- `ai-credentials/`
- `users/`

Isso reflete um sistema interno de operacao com responsabilidades reais de produto, e nao apenas uma API isolada.

## Banco De Dados

O modelo atual contempla:

- `workspaces`
- `instagram_accounts`
- `uploads`
- `posts`
- `post_media_items`
- `post_events`
- usuarios administrativos, sessoes e permissoes
- templates de midia e variantes de texto

Na evolucao multi-tipo, ja estao presentes:

- `posts.publish_type`
- `posts.media_type`
- `posts.carousel_children`
- `posts.cover_image_filename`
- `posts.publish_options`
- tabela `post_media_items`

As migrations SQL ficam em `backend/sql/` e o bootstrap inicial do banco em `postgres-init/000_socialbot_init.sql`.

## O Que Este Projeto Demonstra

Como portfolio, o SocialBot evidencia experiencia pratica em:

- arquitetura full stack orientada a operacao;
- modularizacao de backend em sistema crescente;
- evolucao de schema com compatibilidade retroativa;
- filas, workers e processamento assincrono;
- integracao com APIs externas;
- autenticacao e autorizacao por permissoes;
- dashboard interno em React;
- automacao com n8n;
- desenho de feature flags para rollout seguro;
- cuidado com separacao entre desenvolvimento local e producao.

## Execucao Em Desenvolvimento

### Infraestrutura local

```bash
docker compose up -d postgres redis n8n
```

### Backend

```bash
cd backend
npm install
npm run dev
```

### Worker

```bash
cd backend
npm run worker
```

### Dashboard

```bash
cd dashboard
npm install
npm run dev
```

## Estado Atual Em 13 De Agosto De 2026

Em 13 de agosto de 2026, o banco local ja estava validado com as fases 1 e 2 da evolucao multi-posts aplicadas, incluindo colunas de `publish_type` e a tabela `post_media_items`.

O sistema atual ja cobre operacao administrativa, publicacao, historico, inbox e preparacao para formatos multi-midia, mantendo Reels como fluxo mais consolidado.

## Documentacao Complementar

- [docs/](/mnt/c/Projetos/auto-reels-n8n/docs/)
- [CODEX_CONTINUITY.md](/mnt/c/Projetos/auto-reels-n8n/CODEX_CONTINUITY.md)
- [docs/0006-mult-posts.md](/mnt/c/Projetos/auto-reels-n8n/docs/0006-mult-posts.md)
- [docs/0007-auth-users.md](/mnt/c/Projetos/auto-reels-n8n/docs/0007-auth-users.md)
- [docs/features/001-permissoes-granulares.md](/mnt/c/Projetos/auto-reels-n8n/docs/features/001-permissoes-granulares.md)
- [docs/features/002-modelos-midias-ia-tags.md](/mnt/c/Projetos/auto-reels-n8n/docs/features/002-modelos-midias-ia-tags.md)

## Autor

Harlem Afonso Claumann Silva

- GitHub: https://github.com/harlemsilvas
