# SocialBot

Plataforma full stack para operacao de conteudo no Instagram, combinando publicacao, agendamento, automacao, inbox, autenticacao administrativa e monitoramento em uma unica base de produto.

Este projeto demonstra a construcao de um sistema real de operacao interna: backend, dashboard, banco de dados, filas, workers, integracoes externas e evolucao incremental de arquitetura sem quebrar o fluxo legado mais sensivel do negocio.

## Destaques Do Projeto

Preparacao para analise Meta e internacionalizacao PT/EN documentada em
[project-docs/meta-app-review](project-docs/meta-app-review/README.md), com
diagnostico, etapas de desenvolvimento e roteiro de evidencias. Base PT/EN local
implementada no MR-02 para login/troca de senha/navegacao, com seletor e preferencia
persistida e aceite do usuario. Contas/feedback OAuth PT/EN implementados localmente
no MR-03; Inbox e Testers DM PT/EN implementados e testados localmente no
[MR-04](project-docs/meta-app-review/mr-04/README.md), preservando rascunhos e
bloqueios de entrega incerta. Demais telas, ambiente de avaliacao e controles
adicionais ainda pendentes. Nenhuma traducao publicada na VPS.

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
- Inbox responsivo com busca, filtro de nao lidas, agrupamento por data e navegacao mobile;
- painel Testers DM com envio individual, fluxo de teste e ocultacao de registros;
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
- Lucide React para icones do Inbox

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
- `instagram_conversations`, `instagram_messages` e historico bruto de webhooks

A migration `013-testers-dm-visibility.sql` adiciona `testers_hidden_at` para ocultar
conversas apenas na pagina Testers DM. Nao apaga mensagens, nao altera a exclusao
geral da conversa e nao remove funcoes de testador na Meta. Deve ser aplicada e
verificada antes de iniciar o backend que utiliza esse campo.

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

### Cuidados com a simulacao local

O ambiente local restaurado da VPS e exclusivamente para testes: tokens Meta
removidos, credenciais de IA desabilitadas, worker/coletores desligados e workflow
importado inativo. Nao executar os comandos de worker abaixo nessa simulacao nem
iniciar o bootstrap oficial sem revisar as flags de automacao e os dados da fila.

Os acessos locais registrados sao dashboard `http://localhost:5181`, API
`http://localhost:3101` e n8n `http://localhost:5678`. Esses valores nao devem ser
copiados para a VPS. Consulte o [roteiro local](project-docs/retomada-2026-10-09.md)
para iniciar a simulacao com o launcher local; os scripts de simulacao ainda nao
estao versionados e nao fazem parte de uma instalacao limpa.

Os comandos seguintes descrevem o desenvolvimento geral, nao autorizam ativar
publicacao real e exigem configuracao de ambiente propria, fora do Git.

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

## Estado Atual Em 11 De Outubro De 2026

Ultimo deploy confirmado em 11/10/2026: commit `a7101b6`, com backend e dashboard
atualizados e migration `014` aplicada/verificada na VPS apos backup PostgreSQL.
Inclui confiabilidade Inbox e contadores de nao lidas. A migration `013` permanece
aplicada desde o deploy anterior.
[Execucao do deploy](https://github.com/harlemsilvas/auto-reels-n8n/actions/runs/38142591308).

### Funcionalidades testadas

- DM real recebida por webhook, persistida e exibida no painel; resposta entregue
  ao testador, conforme consultas registradas e confirmacao do usuario.
- Botoes Enviar DM de teste e Enviar fluxo teste validados pelo usuario.
- Inbox modernizado: busca por nome, username, ID ou resumo, filtro de nao lidas,
  mensagens recebidas/enviadas distintas, datas, horarios e compositor com icone.
  Layout desktop/mobile testado com APIs simuladas e validado localmente pelo usuario.
- Testers DM consulta nome/username por ID scoped quando disponiveis na Meta e
  deriva a ultima mensagem real do historico. Perfil indisponivel nao bloqueia
  a listagem; nome ausente nao e inventado. Esse enriquecimento e exclusivo dessa
  pagina e ainda nao atualiza o perfil no Inbox geral.
- Botao Ocultar com confirmacao e endpoint
  `DELETE /api/internal/testers-dm/conversations/:id`, protegido por sessao,
  CSRF e `inbox.manage_testers`. Operacao idempotente e preservacao de historico
  verificadas com testes locais e ROLLBACK. Validacao visual pos-deploy ainda pendente.
- Eventos sem objeto de mensagem valido, como recibos de leitura, nao criam
  mensagens vazias; o webhook bruto permanece registrado.

Na verificacao apos o deploy, API/dashboard responderam HTTP 200 e o hash do
bundle publico correspondeu ao build da VPS. Worker permaneceu online sem reinicio.
Esses resultados foram novamente verificados em 11/10 apos o deploy da migration 014.
Vinte mensagens/quatro conversas preservadas; nova DM/badge exige teste do usuario.
Nenhuma conversa foi ocultada automaticamente pelo deploy.

A pagina Testers DM lista conversas recebidas, nao uma lista de funcoes validada
com a Meta. Falha ao buscar perfil nao comprova que um usuario seja invalido.

### Testes De Regressao

```bash
node backend/scripts/test-instagram-webhook.js
node backend/scripts/test-testers-dm-list.js
node backend/scripts/test-inbox-reliability.js
node backend/scripts/test-inbox-unread.js
node dashboard/tests/inbox-service.test.mjs
npm run build --prefix dashboard
```

Os testes isolados usam dependencias simuladas, sem enviar DMs reais. Para incluir
os testes SQL, use `node backend/scripts/test-testers-dm-list.js --database`
somente com PostgreSQL local configurado; o teste de escrita usa ROLLBACK.
O teste visual `dashboard/tests/inbox-ui.mjs` exige Playwright/Chromium e dashboard
local ativo; `PLAYWRIGHT_MODULE` permite apontar para uma instalacao externa da
biblioteca. Todas as chamadas de API sao interceptadas nesse teste.
O teste `test-inbox-unread.js` exige PostgreSQL local e cria/remove um schema
temporario: cobre migration idempotente, concorrencia, deduplicacao e leitura
parcial. `dashboard/tests/inbox-unread.mjs` valida badges/filtro e leitura mobile
com APIs interceptadas; requer Playwright e dashboard local ativo.

### Contadores De Nao Lidas

Implementados e testados localmente em 11/10, publicados na VPS com migration
`014-inbox-unread.sql` aplicada apos backup. Novas DMs recebidas incrementam
o contador; respostas enviadas e webhooks repetidos com o mesmo ID Meta nao.
A API calcula o contador pelo estado das mensagens, sem zero fixo.
O painel reconhece somente os IDs carregados na conversa visivel, sem apagar
mensagens posteriores. No celular, apenas exibir a lista nao marca como lida.
O estado de leitura e compartilhado pelo Inbox, nao individual por operador.
Historico anterior permanece sem badges retroativos, pois sua leitura era desconhecida.
Workflow oferece a migration 014 e bloqueia publicacao sem o schema exigido.
Em 11/10, o usuario relatou que o badge nao atualizava. Consultas na VPS confirmaram
nao lidas persistidas e retornadas pelo servico. Correcao de sincronizacao publicada
na VPS em `151d235`: polling da lista a cada cinco segundos, reconciliacao ao voltar
ao painel/reconectar SSE e protecao por conversa contra respostas atrasadas.
Ainda precisa de nova validacao real dos badges/leitura pelo usuario.

### Links E Imagens No Inbox

Publicado na VPS em 11/10/2026, commit `7f01376`,
[deploy validado](https://github.com/harlemsilvas/auto-reels-n8n/actions/runs/38160575371).
Testes locais simulados aprovados. Em 11/10/2026, o usuario confirmou em producao
o envio e recebimento de imagens por DM e a permanencia no historico apos recarregar
o painel. Essa confirmacao funcional nao inclui videos, audio ou documentos.

- Links HTTP/HTTPS clicaveis, com abertura segura em outra aba.
- Imagens recebidas exibidas no historico e via SSE, com fallback quando indisponiveis.
- Selecao/previa/remocao e envio de uma JPG/PNG por vez, ate 8 MB; texto e imagem
  sao mensagens separadas, sem repetir texto ja enviado quando a imagem falha.
- Upload protegido por sessao, CSRF e inbox.reply; conversa/conta/destinatario
  resolvidos pelo backend. Sharp valida/recodifica pixels, limita 20 megapixels
  e remove metadados. Armazenamento privado fora das pastas de publicacao.
- GET privado de imagem exige inbox.view. Para a Meta, URL opaca valida por
  quinze minutos; esse acesso temporario nao usa token de sessao nem token Meta.
  Entrega incerta nao provoca retry automatico e remove a imagem selecionada.

Rotas novas: `POST /api/internal/conversations/:id/images` (multipart, campo image),
`GET /api/internal/conversations/:id/messages/:messageId/image` (autenticada) e
`GET /api/inbox/media/:token` (somente capacidade temporaria, sem upload publico).
Nenhuma migration nova: metadados da imagem ficam no payload existente.

O deploy instala dependencias backend pelo lockfile (inclui sharp), valida a
conversao nativa e configura URL HTTPS externa e armazenamento persistente privado.
Backup protegido de release/dependencias/configuracao precede o restart da API;
worker e proxy preservados. Nenhuma migration nova; schema 014 verificado.
URL de entrega em memoria exige que a instancia permaneça ativa durante o envio;
multiplas instancias precisarao armazenamento compartilhado das capacidades.
URLs de imagens recebidas podem expirar; nao fazemos download/arquivo permanente
dos anexos recebidos. Retencao/limpeza de imagens locais ainda precisa de politica.
Videos, audio, documentos e anexos antigos sem URL nao fazem parte deste incremento.

Testes: `node backend/scripts/test-inbox-images.js` e
`PLAYWRIGHT_MODULE=... node dashboard/tests/inbox-images.mjs`; banco/Meta simulados,
arquivos temporarios e desktop/mobile. Nenhuma DM real enviada nestes testes.

### Proximas Etapas

Deploy concluido em 12/10/2026: release `47a5dac`,
[Action validada](https://github.com/harlemsilvas/auto-reels-n8n/actions/runs/38305628683).
Resumos, perfis com cache e registro duravel de texto publicados; migration 015
aplicada/verificada com backup protegido. Preservados 21 posts, quatro conversas
e 39 mensagens; somente API reiniciada, worker preservado. API/dashboard HTTP 200,
rota de tentativas anonima 401, bundle publico igual ao build VPS e login
desktop/mobile sem erros JavaScript. Teste autenticado de envio pelo usuario
ainda pendente; nenhuma DM real enviada pelo agente.

As descricoes locais abaixo registram a preparacao desta release. Proximos itens:
aceite em producao, ledger para imagens, retencao e manutencao de dependencias/lint.

Envio duravel de texto (12/10, somente local): migration `015-inbox-send-attempts.sql`
aplicada/verificada apos backup. PostgreSQL registra tentativa antes da chamada
Meta; lock e indice unico bloqueiam concorrencia entre abas/dispositivos/processos.
Mesmo requestId confirmado retorna resultado original. Novo ID com texto identico
confirmado nos ultimos 90 segundos reutiliza resultado, inclusive repeticao
intencional; apos essa janela novo ID permite repetir. Tentativa incerta nao expira
nem provoca retry automatico da DM. Texto rejeitado preserva rascunho editavel.

Rotas protegidas por `inbox.reply`: `GET /api/internal/messages/attempts/:conversationId`,
`POST .../:conversationId/reconcile` e `POST .../:conversationId/dismiss`.
Mutacoes exigem sessao/CSRF. Confirmacao Meta duravel permite reparar apenas
historico; sem ID exige conferencia humana. Encerramento manual nao cancela DM
nem comprova falha; sending sem confirmacao so pode ser encerrado apos cinco
minutos. Frontend recupera bloqueio em outros dispositivos e preserva rascunhos.
Sem garantia absoluta exactly-once da Meta; imagens/quick replies fora do ledger.

Testes: `node backend/scripts/test-inbox-send-attempts.js` usa PostgreSQL local em
schema isolado e Meta simulada; `dashboard/tests/inbox-durable-send.mjs` verifica
multi-aba/dispositivo/mobile com API simulada. Regressao, build/lint aprovados.
VPS atualizada para `47a5dac`: 015 aplicada/verificada antes do restart API.
Retencao de tentativas/textos ainda pendente.

Perfis Inbox (12/10, somente local): nomes/usernames ausentes podem ser
complementados pelo cliente Meta existente, com cache por conta/destinatario/
credencial, TTL uma hora e espera de cinco minutos em falha. Limites por processo:
cinco consultas simultaneas, dez novos inicios por minuto e 500 entradas.
Dados salvos preservados, sem token na resposta e sem migration. Testes simulados
`backend/scripts/test-inbox-profiles.js` e regressoes aprovados; validacao com
Meta real pendente; deploy concluido em `47a5dac`. Usuario confirmou os testes locais da etapa de resumos
e acesso localhost. Reconciliacao duravel implementada localmente como descrita acima.

Em 12/10, o usuario confirmou em producao selecao de modelos, confirmacao de
agendamento e contadores da release `151d235`. Proximo incremento preparado
somente localmente: Inbox usa nome ja salvo e resumo da ultima mensagem real,
incluindo imagens/anexos, sem recibos vazios apagarem resumo/data. Payload/URLs
de anexos nao sao incluidos na listagem; sem novas chamadas Meta ou migration.
Testes PostgreSQL isolados e desktop/mobile aprovados; publicado em `47a5dac`.
Perfis ausentes continuam username/ID; cache e reconciliacao duravel tambem foram
publicados nessa release. Rotulos de outros anexos nao habilitam seu envio.

Deploy Inbox/Modelos concluido em 11/10/2026, release `151d235`,
[Action validada](https://github.com/harlemsilvas/auto-reels-n8n/actions/runs/38172633374).
Dashboard/API HTTP 200 e bundle publico conferidos; backup validado, somente API
reiniciada, worker preservado e nenhuma migration nova. Teste autenticado das
novas correcoes em producao ainda depende do usuario.

Modelos (11/10, publicado na VPS): confirmar a criacao na Fase 5 mostra resumo de
sucesso com titulo, TAG, ID e data salva pela API, acesso a Agenda e opcao de criar
outra postagem. Erros preservam o formulario; retorno pendente nao e tratado como
agendamento confirmado. Teste `dashboard/tests/media-templates-scheduling.mjs`
desktop/mobile com APIs simuladas e build aprovados; sem migration nova.

Correcao em Modelos (11/10, publicada): criar/abrir modelo passa a atualizar a Fase 2
sem respostas antigas sobrescreverem a selecao. Detalhes/midias de outro modelo
nao permanecem durante carregamento ou falha. Testes simulados desktop/mobile
e build aprovados; aplicada na VPS junto da sincronizacao dos badges.

Gemini local validado em 11/10 as 17:13 (America/Sao_Paulo), apos o usuario
cadastrar nova credencial para "Modelos de midia / textos". Evento request_success
e variacao com origem gemini/modelo gemini-flash-lite-latest confirmados no banco.
Variacao salva e aprovada; nenhuma publicacao Instagram foi validada neste teste.
Melhoria publicada: Fase 4 mostra progresso e erros no contexto da geracao, e uma
sugestao salva abre para revisao automaticamente. Falha Gemini nao vira sugestao
local silenciosamente. Testes desktop/mobile simulados e geracao real local
aprovados; UI publicada na VPS. Credencial/geracao Gemini real da VPS ainda
precisa de validacao propria; nenhuma chave local foi copiada no deploy.

Em 11/10, o primeiro incremento de confiabilidade foi implementado e testado
localmente: rascunho preservado em falha, typing nao bloqueante, isolamento
de respostas atrasadas e SSE/polling sem duplicacao nos cenarios simulados.
Foi publicado junto dos contadores de nao lidas/migration 014; reconciliacao
de envio e validacao funcional autenticada em producao continuam pendentes.

1. Consolidar confiabilidade do Inbox: testes de permissao/sessao/CSRF, falhas de
   envio, typing indicator, polling/SSE, nao lidas e troca de conversa.
2. Ampliar identificacao e resumo para o Inbox geral, com consulta de perfil
   controlada e sem bloquear o atendimento quando a Meta estiver indisponivel.
3. Evoluir atendimento com respostas rapidas e anexos, apos definir escopo e
   validar contratos; nao confundir suporte do cliente Meta com UI ja implementada.
4. Retomar validacao das telas de publicacao/modelos e tratar lint/dependencias
   por modulo, preservando Reels e separacao local/VPS.

O [roteiro atualizado](project-docs/retomada-2026-10-09.md) define criterios de
aceite e distingue entregas concluidas de pendencias. Nao ha prazo fechado para
essas etapas; novos deploys exigem autorizacao.

## Documentacao Complementar

- [Documentacao tecnica](docs/)
- [Continuidade e validacoes](CODEX_CONTINUITY.md)
- [Roteiro de evolucao](project-docs/retomada-2026-10-09.md)
- [Autenticacao e usuarios](docs/0007-auth-users.md)
- [Permissoes granulares](docs/features/001-permissoes-granulares.md)
- [Modelos, midias, IA e TAGs](project-docs/features/002-modelos-midias-ia-tags.md)
- [Deploy controlado](project-docs/deploy/003-github-actions-deploy-vps.md)

O documento historico `docs/0006-mult-posts.md` permanece ausente neste checkout;
o estado consolidado das fases multi-posts esta registrado na continuidade.

## Autor

Harlem Afonso Claumann Silva

- GitHub: https://github.com/harlemsilvas
