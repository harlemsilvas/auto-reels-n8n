# SocialBot — Contexto de Continuidade para Codex

Atualizado em: 2026-10-12

## TAG de retomada: RETOMADA-2026-10-12

### Deploy Inbox duravel concluido em 2026-10-12

- Release confirmada na VPS: 47a5dacb64cda69ddd9f5b0211990eacf2708d32.
  Action 38305628683 concluida com sucesso em 12/10 as 17:40 (America/Sao_Paulo):
  https://github.com/harlemsilvas/auto-reels-n8n/actions/runs/38305628683
  Publicados resumos/perfis com cache e reconciliacao duravel de texto no Inbox;
  migration 015 aplicada/verificada antes do restart API. Entradas somente locais
  abaixo sao historicas; estes incrementos nao estao mais pendentes de deploy.
- Backup protegido da release anterior 151d235/config/dependencias:
  /home/socialbot/backups/inbox-images-pre-deploy-20261012T203930Z/release-anterior.tar.gz,
  12806544 bytes, modo 0600, SHA-256
  80f2e654d3e262a7daea2a59888c51e1ee966ee3d28acba4b325faa17d9c9f18.
  Arquivo tar validado pelo workflow; configuracao anterior copiada em modo 0600,
  sem consultar conteudo. Backup PostgreSQL anterior a migration:
  /home/socialbot/backups/socialbot-postgres/deploy-20261012T203947Z/n8n_20261012_203947.dump,
  399784 bytes, modo 0600, SHA-256
  ce172d0a38fb83a7370b6f6c5bf95f29f770c0d824a167a133f6649d8f16c6da.
  Catalogo pg_restore verificado novamente por SSH, sem teste de restore.
- Verificador 015 passou novamente na VPS. Preservados 21 posts, quatro conversas
  e 39 mensagens; ledger novo vazio na verificacao. API online restart 6 -> 7,
  PID 648344; worker online restart 0/PID 1653 preservados. Scripts remotos sujos
  mantidos. Sem mudar portas/proxy/credenciais ou fluxo Reels; reload Nginx pelo
  script de frontend existente, sem alterar configuracao.
- Health API e dashboard HTTP 200; tentativas anonimas HTTP 401.
  Bundle publico /assets/index-BNDpM1Hx.js igual ao build da VPS, SHA-256
  6a5ec762239a29633196863a3e2c9844190947dbcae073f450f72d22ffcf15ed.
  Playwright publico desktop/mobile carregou login/bundle sem erro JavaScript ou
  overflow; captura mobile inspecionada. Sem sessao autenticada/DM/IA/post real.
- Antes do deploy passaram testes PostgreSQL isolados de tentativas/resumos/
  nao lidas, cache de perfis, confiabilidade/imagens e Playwright reconciliacao/
  multi-aba/dispositivo. Build/lint focado/sintaxe/diff aprovados. Lint amplo Inbox
  possui quatro erros preexistentes em TestersDmPage (arquivo nao alterado).
  npm ci VPS reportou quatro alertas backend (dois high) e doze dashboard (nove
  high); manutencao pontual pendente, sem upgrade automatico no deploy.
- Proximo aceite do usuario: enviar texto pelo Inbox, recarregar/verificar
  historico e abrir a mesma conversa em outra aba/dispositivo. Falhas incertas
  devem bloquear novo envio; nao induzir timeout em producao para testar.
  Cenarios de falha foram simulados localmente. Perfil depende de permissao/
  credencial Meta e pode manter fallback. Ledger duravel ainda nao cobre imagens/
  quick replies; politica de retencao permanece pendente.
- README/roteiro atualizados em commit documental separado, sem novo deploy.
  .gitignore do usuario, scripts de simulacao e midias locais continuam fora dos
  commits/VPS. Sem copiar .env ou registrar segredos.

### Deploy Inbox autorizado: preflight em 2026-10-12

- Usuario autorizou deploy do pacote local de resumos/perfis/reconciliacao e
  registro duravel de texto. Inspecao atual confirmou VPS na release 151d235,
  Node 20.20.2, API online restart 6/PID 3918851, worker online restart 0/PID
  1653. Sem deploy concorrente; main remoto e HEAD local e9d6ceb.
- PostgreSQL VPS: 21 posts, quatro conversas, 39 mensagens; tabela de tentativas
  ausente. Schema 014 verificado somente leitura. Alteracoes remotas nos scripts
  create-user/publish_instagram_reel/validar_publicacao_real e sql/005 preservadas.
- Workflow autorizado com dashboard=true, restart_backend=true,
  run_migrations=true e migration_set=015. Backup protegido da release/config
  e dump PostgreSQL com catalogo/hash antes da migration. Reiniciar somente API;
  manter worker, configuracoes/portas e fluxo de Reels.
- Regressao PostgreSQL isolada de tentativas/resumos/nao lidas, perfis Meta
  simulados, quinze testes confiabilidade/quatro imagens, Playwright multi-aba/
  dispositivo, build e sintaxe aprovados. Nenhuma DM/publicacao real no preflight.
- .gitignore do usuario, arquivos de simulacao e midias nao integram o commit.
  Esta entrada registra preparacao; resultado real sera registrado apos deploy.

### Envio duravel: migration 015 aplicada somente localmente

- Usuario confirmou teste da primeira etapa e pediu registro no servidor para
  proteger tambem entre abas/dispositivos. Esta entrada substitui a pendencia de
  ledger da etapa abaixo. HEAD documental anterior e9d6ceb; ultima release VPS
  registrada 151d235. Sem commit/push/deploy ou acesso VPS nesta etapa.
- Nova tabela instagram_send_attempts registra UUID, conversa, hash/texto, estado
  e confirmacao Meta antes de finalizar historico. Lock da conversa e indice
  parcial unico impedem duas tentativas ativas entre processos/clientes. Conta e
  destinatario devem corresponder a conversa ativa. Tentativa fica duravel antes
  da chamada Meta; falha de banco impede novo envio, nao libera retry.
- Mesmo UUID confirmado retorna mensagem original; UUID reutilizado com outro
  texto/conversa e rejeitado. Novo UUID com texto identico confirmado nos ultimos
  90 segundos reutiliza resultado, inclusive entre dispositivos. Essa janela
  tambem suprime repeticoes intencionais identicas; depois dela novo UUID permite
  novo envio. Chamadores legados sem UUID recebem ID no servidor, mas devem
  reutilizar requestId para garantia de replay alem da janela.
- GET /api/internal/messages/attempts/:conversationId recupera tentativa;
  POST no mesmo caminho /reconcile repara somente persistencia com ID/confirmacao
  Meta duraveis, sem reenviar DM. POST /dismiss exige acknowledged=true e
  conferencia humana; nao aceita tentativa com ID Meta nem sending recente.
  Sending orfao so pode ser encerrado manualmente depois de cinco minutos.
  Rotas exigem inbox.reply, sessao e CSRF nas mutacoes; aliases Inbox mantidos.
- Frontend recupera bloqueio do servidor em outra aba/dispositivo e apos reload;
  preserva rascunho nao enviado quando outra tentativa esta ativa. Confirmacao
  duravel permite reconciliar historico automaticamente, nunca repetir Meta.
  Sem ID, nao ha expiracao/desbloqueio automatico. Encerramento manual nao cancela
  envio em curso nem prova ausencia de entrega; nao prometemos exactly-once Meta.
- Protecao duravel cobre texto do sender central, nao imagens/quick replies.
  Registros mantem texto como o historico existente e apenas recibo message_id,
  sem token/credenciais/erro bruto do provedor. Politica de retencao pendente;
  nao remover automaticamente tentativas ativas. Reels/worker/echo preservados.
- Migration 015 transacional/idempotente: rollback e duas aplicacoes testadas
  primeiro em schema temporario. Verificador valida colunas/tipos/nulabilidade,
  FKs e indice unico parcial na coluna conversation_id; teste rejeita indice
  sobre coluna errada. Bootstrap existente nao contem tabelas Inbox e nao foi
  alterado. docs/0006-mult-posts.md continua ausente.
- Backup local protegido antes de aplicar:
  `backups/inbox-attempts-pre-migration-20261012T175043Z/n8n_20261012_145043.dump`,
  388070 bytes, modo 0600, SHA-256
  8fe64ed47f767269309b648f04585c06faee3b1260bb5e3a43783e3ced10cd84.
  Catalogo pg_restore verificado, sem teste de restore. Migration aplicada duas
  vezes localmente; verificador final aprovado. Preservados 26 posts, duas
  conversas e cinco mensagens; tabela nova vazia apos aplicacao.
- Teste PostgreSQL isolado aprovado: concorrencia de IDs, escopo, reuso/restart,
  timeout/rejeicao, recibo duravel, reparo concorrente, ack de commit perdido,
  falha de journal, descarte manual, indice e HTTP sessao/CSRF/permissoes.
  Meta simulada. Quinze testes confiabilidade e quatro imagens passaram.
  Playwright multi-aba/dispositivo/mobile passou com API simulada: recuperacao
  sem storage, rascunho preservado, reparo sem segundo envio e encerramento
  compartilhado. Regressoes reconciliacao/imagens/confiabilidade, lint focado,
  build e sintaxe passaram; captura mobile inspecionada. Nenhuma DM/IA/post real.
- API local reiniciada pelo launcher protegido, health localhost:3101 HTTP 200;
  consulta anonima de tentativas HTTP 401. Dashboard usar http://localhost:5181.
  Jobs/worker continuam desligados. Configuracoes, simulacao, midias e alteracoes
  do usuario preservadas, incluindo .gitignore; segredos nao consultados.
- Workflow preparado com opcao 015 e verificacao obrigatoria antes de publicar
  backend/dashboard. VPS NAO recebeu schema/codigo novo. Proximo: aceite local
  desta etapa e deploy explicitamente autorizado com backup/migration 015 antes
  do restart API. Depois ampliar ledger a imagens e definir retencao.

### Envio incerto: primeira etapa de reconciliacao somente local

- Usuario pediu reconciliacao para evitar duplicacao em respostas incertas.
  Implementada protecao de texto no Inbox: rejeicao HTTP 4xx preserva rascunho;
  timeout/erro sem resposta, HTTP 5xx e MESSAGE_DELIVERY_UNCERTAIN preservam
  texto como registro local visivel, bloqueando texto/imagem naquela conversa.
  Sem retry automatico de chamada de envio Meta.
- Backend de texto exige ID Meta antes de confirmar sucesso. Apos envio confirmado,
  falha ao salvar permite uma segunda tentativa somente de persistencia com mesmo
  ID (repository ja deduplica). Se ambas falham, middleware retorna 502/codigo
  MESSAGE_DELIVERY_UNCERTAIN e ID conhecido, sem stack/erro do banco/provedor.
- Registro guardado antes do POST em sessionStorage por usuario/conta/conversa;
  recarregar/sair-voltar restaura bloqueio conservador. Contem texto do rascunho,
  nao token; escopo da aba, descartado ao fecha-la. Storage indisponivel conserva
  protecao em memoria, mas nao garante recuperacao apos reload. Nao ha expiracao
  que libere reenvio automaticamente.
- Historico libera bloqueio somente por mensagem bot da mesma conversa com ID
  Meta exato; texto igual/horario nao comprovam entrega. Retorno tardio de sucesso
  confirma a mesma tentativa mesmo apos sair-voltar. Descarte manual tem confirmacao,
  remove apenas registro local e nao cancela DM nem prova falha de entrega.
- Limites: nao e idempotencia global/duravel entre abas, dispositivos ou clientes;
  sem ID conhecido, ausencia no historico nao comprova falha e exige conferencia
  humana. Webhook atual ignora echo, nao foi alterado. Historico nao necessariamente
  recebera registro de uma falha permanente de banco. Ledger duravel de tentativas
  e endpoint de conciliacao seguem pendentes para proxima etapa; nenhuma migration.
  Persistencia/reconciliacao automatica nova cobre texto, nao quick replies/imagens.
- Quinze testes backend confiabilidade (Meta/banco simulados), quatro imagens e
  Playwright reconciliacao desktop/mobile passaram: rejeicao, rede, reload, escopo,
  ID divergente/exato, descarte e retorno tardio. Regressao frontend confiabilidade
  e imagens passou; build, lint focado, sintaxe e diff-check aprovados.
  Capturas inspecionadas; nenhuma DM/IA/publicacao real executada pelo agente.
- API local reiniciada apenas pelo launcher protegido; health localhost:3101
  HTTP 200, dashboard usar localhost:5181. Sem worker/jobs, commit/push/deploy,
  acesso VPS ou mudanca de banco. Correcoes locais anteriores de resumos/perfis,
  arquivos de simulacao e midias do usuario preservados. VPS registrada 151d235.

### Perfis Inbox: enriquecimento com cache somente local

- Usuario confirmou Tudo testado apos orientacao localhost e incremento de
  resumos. Aceite local relatado pelo usuario, nao nova sessao autenticada do
  agente. Ultima release VPS registrada permanece 151d235; HEAD e9d6ceb.
- Listagem Inbox agora complementa nome/username ausentes com cliente de perfil
  ja existente. Nao altera host/versao/scopes/token/fields do cliente Meta.
  Credencial e destinatario obtidos exclusivamente da conta da conversa ativa;
  contas excluidas/inativas e ID ficticio/sem token nao acionam consulta.
- Cache de processo por conta/destinatario/hash da credencial, TTL sucesso uma
  hora, falha/perfil vazio cinco minutos, single-flight e capacidade 500 entradas.
  Maximo cinco consultas simultaneas/dez novos inicios por minuto por processo.
  Rotacao de credencial nao reutiliza perfil da chave anterior. Falha transitoria
  preserva ultimo perfil conhecido; dados salvos no banco nunca substituidos.
- Tokens, erros do provedor e payloads internos nao incluidos na resposta/logs
  desta funcionalidade; somente nome/username normalizados. Sem gravar perfis
  no banco, sem migration e sem modificar Testers DM/envio/Reels/worker.
  Cache nao compartilhado entre instancias e descartado ao reiniciar API.
  Primeiras consultas podem adicionar ate o timeout existente de tres segundos;
  consultas suprimidas por limite permanecem com fallback username/ID.
- Sete testes test-inbox-profiles.js aprovados com Meta simulada: TTL/backoff,
  deduplicacao, conta/destinatario/rotacao, falha preservando perfil, limites,
  capacidade e listagem sem vazamento. PostgreSQL isolado resumos/nao lidas,
  Playwright resumos/identidade e sincronizacao desktop/mobile, sete testes
  Testers DM sem banco (dois DB opcionais pulados), build/sintaxe/diff passaram.
- Documentacao Meta direta consultada, mas respondeu 429; nenhuma mudanca de
  contrato externo inferida desse bloqueio. Mantido cliente getUserProfile
  existente/testado. Nenhuma chamada real Meta/DM/IA/publicacao durante validacao.
- API local reiniciada somente pelo launcher protegido apos inspecao do processo;
  health localhost:3101 HTTP 200. Dashboard usar http://localhost:5181 (nao misturar
  hosts no navegador). Jobs/worker permanecem desligados; dados/segredos preservados.
- Alteracoes ainda somente locais, sem commit/push/deploy e sem acesso VPS nesta
  rodada. Resumos anteriores e arquivos de simulacao/midias do usuario preservados.
  Proximo: validar perfis com conta autorizada em deploy futuro; reconciliacao
  de envio continua pendente, sem retry automatico nem reenvio de entrega incerta.

### Dashboard local: nao misturar localhost e 127.0.0.1

- Usuario abriu http://127.0.0.1:5181 e relatou Falha ao carregar dashboard.
  Configuracao publica do frontend aponta a API para http://localhost:3101.
- Nesta sessao, resumo/top-posts SQL locais e estatisticas Redis passaram;
  API/dashboard estao ouvindo nas portas 3101/5181. Teste Chromium com cookie
  ficticio SameSite=Lax confirmou: frontend 127.0.0.1 nao envia cookie para
  API localhost; frontend localhost envia. Nao usada senha/sessao real no teste.
- Orientacao: acessar http://localhost:5181 e entrar novamente, mantendo
  localhost nos dois enderecos do navegador. Bind dos processos pode continuar
  127.0.0.1. Nao desabilitar SameSite/autenticacao para contornar o problema.
- Sem alteracao de .env, codigo, VPS ou banco. Validacao autenticada pelo usuario
  ainda pendente; incremento local de resumos Inbox permanece preservado.

### Cronograma retomado: aceite da release anterior e resumos Inbox

- Usuario confirmou em 12/10 que validou na VPS selecao do modelo, confirmacao
  de agendamento e contadores Inbox: funcionaram. Aceite relatado pelo usuario,
  nao nova verificacao autenticada do agente. Ultimo deploy registrado continua
  151d235/Action 38172633374; HEAD documental e9d6ceb antes desta etapa.
- Proximo incremento implementado somente localmente: listagem Inbox passa a
  usar instagram_name salvo, sem consulta Meta, e resumir a ultima mensagem
  significativa, incluindo imagens recebidas e enviadas/anexos. Texto tem
  prioridade sobre anexo; recibos e payloads vazios/invalidos nao substituem
  resumo/data anteriores. Desempate por ID mantem ordem deterministica.
- Payload da ultima mensagem fica interno ao servico; resposta de listagem
  nao expoe URL/capacidade/anexo bruto. Contadores por mensagem preservados,
  conversas deleted omitidas, escopo por conta mantido. Schemas legados sem
  instagram_name e com raw_payload permanecem compativeis; sem migration.
- backend/scripts/test-inbox-summaries.js passou em schema PostgreSQL temporario
  isolado/removido: nome, texto, anexos, recibos, data, contadores, empate,
  escopo/deleted, payload invalido e legado. Regressao PostgreSQL nao lidas,
  oito testes confiabilidade, Playwright resumos desktop/mobile e sincronizacao
  de badges passaram. Build, sintaxe e diff-check aprovados; capturas inspecionadas.
  Meta/API nos testes de UI simuladas; nenhuma DM, publicacao ou chamada IA real.
- Dashboard local 127.0.0.1:5181 e API 127.0.0.1:3101 iniciados; launcher protegido
  valida autenticacao, banco local e jobs/worker desativados. Health local HTTP
  200 e listagem anonima 401. Playwright instalado apenas em /tmp para testes.
- Alteracoes somente locais, sem commit/push/deploy ou mudanca na VPS; arquivos
  de simulacao e midias do usuario preservados. docs/0006-mult-posts.md segue ausente.
- Proximos passos: testar resumos locais e autorizar deploy deste incremento;
  depois planejar enriquecimento de perfil com cache/limites de consultas Meta
  e reconciliacao de envio. Nome ausente permanece com fallback username/ID;
  nao inventar perfil nem fazer chamada externa em cada polling de cinco segundos.
  Rotulos video/audio/arquivo apenas identificam payload recebido, nao habilitam
  envio desses formatos. Respostas rapidas seguem no backlog de atendimento.

## TAG de retomada: RETOMADA-2026-10-11

### Deploy Inbox/Modelos concluido em 2026-10-11

- Release confirmada na VPS: 151d235d695a9af8ecd6c8dc614c1c0f49668d49.
  Action 38172633374 concluida com sucesso em 11/10 as 17:33 (America/Sao_Paulo):
  https://github.com/harlemsilvas/auto-reels-n8n/actions/runs/38172633374
  Dashboard publicado e somente API reiniciada; migrations desligadas.
- Aplicadas sincronizacao dos badges Inbox/SSE, selecao/Fase 2 de Modelos,
  feedback/revisao de Gemini e confirmacao de criacao/agendamento na Fase 5.
  Estes itens nao estao mais pendentes de deploy; entradas locais abaixo sao historicas.
- API online restart 5 -> 6/PID 3918851. Worker online restart 0/PID 1653
  preservados. Scripts remotos sujos mantidos; nenhuma alteracao de portas,
  proxy, n8n, tokens ou fluxo de Reels. Configuracao Inbox existente compativel,
  sharp nativo validado e schema 014 verificado sem nova migration.
- Backup anterior de 7f01376 validado por catalogo/commit/SHA-256, modo 0600,
  12805130 bytes: /home/socialbot/backups/inbox-images-pre-deploy-20261011T203236Z/release-anterior.tar.gz.
  SHA-256 f4c36e0d5bbae5585498867ddb3ef037044ddfc1f81f9bdbf5514ce88627a9dc.
  Inclui codigo/dependencias/build/workflow; backup de configuracao 0600
  preservado sem consultar seu conteudo. Sem mudanca de schema/banco neste deploy.
- Verificacoes atuais: health API/dashboard HTTP 200; conversas e SSE anonimos
  HTTP 401. Bundle publico /assets/index-CUYZwy9R.js igual ao dist da VPS,
  SHA-256 136e10243709abd28301db9854b86c1af2827718b255477d4c1a4195b88a6083.
  Playwright publico desktop/mobile carregou login/bundle sem erro JavaScript;
  nenhuma sessao autenticada, DM, agendamento ou chamada Gemini real executada.
- Antes do deploy passaram oito testes backend de confiabilidade e Playwright
  sincronizacao, badges/leitura, imagens, selecao, geracao e agendamento; APIs
  simuladas. Build, lint Inbox, sintaxe e diff-check passaram. Lint Modelos
  permanece com cinco problemas preexistentes. npm ci reportou quatro alertas
  backend (dois high) e doze dashboard (nove high); revisao pontual pendente.
- Proximo aceite do usuario na VPS: selecionar/criar modelo e conferir Fase 2;
  gerar texto com credencial propria da VPS; confirmar agendamento e abrir Agenda;
  testar badge com outra conversa selecionada e leitura ao abrir. Geracao Gemini
  real registrada abaixo foi local e nao comprova credenciais da VPS.
- README/roteiro atualizados; resultado segue em commit documental separado,
  sem disparar outro deploy. Arquivos locais de simulacao e midias do usuario
  continuam fora dos commits e da VPS.

### Deploy Inbox/Modelos autorizado: preflight em 2026-10-11

- Usuario autorizou publicar o pacote local. Inspecao atual confirmou VPS em
  7f01376, Node 20.20.2, API online restart 5/PID 3808101 e worker online
  restart 0/PID 1653. Scripts remotos nao relacionados permanecem preservados.
- Configuracao existente de imagens compativel com workflow e schema 014
  verificado sem aplicar migration. Nenhum deploy concorrente no GitHub Actions.
- Oito testes backend de confiabilidade/SSE, Playwright sincronizacao/nao lidas/
  imagens e selecao/geracao/agendamento de modelos aprovados com APIs simuladas.
  Build, lint focado Inbox, sintaxe do controller e diff-check aprovados.
  Modelos mantem os cinco problemas de lint preexistentes registrados acima.
- Publicar dashboard e reiniciar somente API pelo workflow existente, com backup
  protegido de release/dependencias/configuracao antes do pull. Migrations
  desligadas; nao copiar segredos locais, alterar proxy/portas ou reiniciar worker.
  Esta entrada registra preparacao; resultado real sera registrado apos deploy.

### Modelos: confirmacao de agendamento na Fase 5

- Usuario relatou falta de confirmacao apos agendar pelo modelo 174GT. O sucesso
  anterior aparecia somente no topo da pagina, longe do formulario da Fase 5.
- Sucesso agora substitui o formulario por resumo com titulo, TAG, ID e data
  efetivamente retornados pela API, com rolagem para a confirmacao, Abrir Agenda
  e Criar outra postagem. Sem redirecionamento automatico; Agenda abre sua lista
  operacional existente, sem filtro por ID. Retorno pending nao e exibido como
  agendamento confirmado; nao mantemos previa vazia pendente ao lado do sucesso.
- Progresso/erro ficam na Fase 5; falha preserva formulario. Submit simultaneo
  bloqueado no frontend e resposta de outro modelo nao altera a selecao atual.
  Nao ha retry automatico nem mudanca no endpoint/worker/publicacao.
- Teste media-templates-scheduling.mjs aprovado desktop/mobile com APIs simuladas:
  data retornada, resumo/ID, navegacao Agenda, nova postagem, submit repetido,
  erro preservando dados e retorno pending. Capturas desktop/mobile inspecionadas.
  Regressao de selecao e geracao passou; build aprovado. Lint comparado ao HEAD
  mantem os cinco problemas preexistentes. Nenhum post real criado nos testes.
- Aplicado somente localmente, sem migration, commit/push ou deploy. VPS segue
  na release registrada 7f01376, nao consultada nesta tarefa. Melhorias anteriores
  de Inbox, selecao e Gemini permanecem pendentes de deploy e foram preservadas.

### Gemini local: geracao real confirmada em 2026-10-11

- Usuario cadastrou nova chave no local; metadados confirmaram credencial ativa
  para media_templates_text, chave criptografada presente e descriptografia valida,
  no mesmo workspace do modelo. Credencial antiga desativada preservada.
- Apos teste feito pelo usuario, consultas somente leitura confirmaram evento
  request_success/success=true sem erro em 11/10 as 17:13:28 (America/Sao_Paulo).
  Variacao Potenza - Pastilha Metalica Kevlar Carbono registra mode/provider gemini,
  modelo gemini-flash-lite-latest e status approved. Nao foi sugestao local/fallback.
- Agente nao consultou texto/prompt/chave nem fez nova chamada ao provedor,
  geracao, aprovacao ou publicacao. Este teste confirma geracao/salvamento local,
  nao publicacao Instagram nem validacao da configuracao Gemini na VPS.
- README/roteiro atualizados apenas localmente. Deploy das correcoes de Modelos,
  feedback de geracao e sincronizacao Inbox continua pendente, sem commit/push.

### Modelos/Gemini: diagnostico local e feedback de geracao

- Usuario relatou criacao confusa e Gemini sem funcionar. Consultas somente
  leitura no banco local confirmaram uma credencial Gemini para media_templates_text,
  status disabled, disabled_at preenchido e chave criptografada ausente. Bloqueio
  coerente com a simulacao local sem segredos de producao; nenhuma credencial
  alterada, copiada ou reativada. Eventos de uso consultados apenas por tipo/codigo/data.
- Fase 4 agora mostra progresso/erro/sucesso da geracao no contexto do modelo;
  falha Gemini oferece link para Credenciais ao usuario com ai_credentials.view.
  Mantido allowLocalFallback false; sem chamada Gemini real nem custo externo.
- Sugestao local/Gemini bem-sucedida abre automaticamente a variacao salva para
  revisao. Falha de refresh posterior informa que o texto ja foi salvo, sem
  reenviar geracao automaticamente. Retorno de outra selecao nao altera o editor atual.
- Teste media-templates-generation.mjs desktop/mobile aprovado com APIs simuladas:
  credencial indisponivel, progresso/botoes, erro contextual, link de configuracao,
  ausencia de fallback silencioso, revisao automatica local/Gemini e falha de refresh.
  Regressao de selecao/Fase 2 passou; build aprovado e capturas inspecionadas.
  Lint comparado ao HEAD permanece com cinco problemas preexistentes.
- Para habilitar Gemini local, usuario deve cadastrar chave propria pelo painel
  /ia/credenciais, tarefa Modelos de midia / textos, status ativo. Nao pedir chaves
  no chat nem recuperar token da VPS. Teste real com provedor ainda pendente.
- Alteracoes somente locais, sem commit/push/deploy, migration ou publicacao.
  Correcoes pendentes de selecao Modelos e contadores Inbox preservadas;
  arquivos de midia novos do usuario permanecem fora deste escopo.

### Modelos: selecao e Fase 2 corrigidas somente localmente

- Usuario relatou selecao 192XT-Traseira mantendo detalhes do modelo 380XT.
  Causa no frontend: createTemplate selecionava o ID criado, mas refreshSelected
  ainda usava selectedId da renderizacao anterior; loadSelected nao protegia
  respostas antigas e podia sobrescrever os detalhes do modelo novo.
- Selecao centralizada, detalhes antigos limpos durante carregamento, resposta
  aplicada somente se ID/revisao continuam atuais. Criacao atualiza a lista sem
  recarregar detalhes do ID anterior; refresh posterior usa selecao atual.
- Troca de modelo limpa selecao de texto/post e editor de variacao anterior;
  navegacao para Fase 2 aguarda o modelo correto. Abrir permite repetir consulta
  apos falha sem manter dados do modelo anterior. Endpoint/banco nao alterados.
- Playwright media-templates-selection.mjs aprovado desktop/mobile com APIs
  simuladas: criar modelo, Fase 2/midias, troca rapida, resposta atrasada, falha
  e reabertura. Build TypeScript/Vite aprovado. Lint comparado ao HEAD: mesmos
  cinco problemas preexistentes, sem novos apontamentos; limpeza fora do escopo.
- Correcao apenas local. Sem commit/push/deploy, migration ou publicacao real.
  VPS permanece na release registrada 7f01376 (nao consultada nesta correcao).
  Correcao local de contadores Inbox continua pendente e foi preservada.

### Contadores Inbox: sincronizacao corrigida somente localmente

- Usuario relatou badge nao atualizando apos validar imagens. Consulta somente
  leitura nesta sessao confirmou VPS em 7f01376: duas mensagens inbox_unread true,
  em duas conversas; servico listConversations retorna unreadCount 1 para cada.
  Nao houve mudanca de leitura/dados, envio de DM ou restart em producao.
- Frontend dependia do SSE para atualizar a lista; so mensagens da conversa
  selecionada tinham polling. Cada confirmacao de leitura invalidava respostas
  pendentes da lista inteira, descartando tambem contadores de outras conversas.
- useConversations agora reconcilia a lista a cada cinco segundos com pagina
  visivel, ao recuperar foco/visibilidade e reconectar SSE. Polling de fundo nao
  pisca loading nem sobrepoe outra requisicao pendente. Selecao preservada.
- Confirmacoes de leitura recebem revisao por conversa: resposta antiga da lista
  preserva badge mais recente daquela conversa, sem descartar outras atualizacoes.
- Resposta SSE passa a incluir X-Accel-Buffering: no. Nenhum arquivo/configuracao
  Nginx alterado; buffering real do proxy nao foi confirmado nesta sessao.
- Novo teste inbox-unread-sync.mjs desktop/mobile passou com APIs simuladas:
  badges sem SSE, lista atrasada concorrente com leitura e reconciliacao ao conectar.
  Teste badges/filtro/leitura mobile existente, oito testes backend incluindo SSE,
  build TypeScript/Vite, lint focado e sintaxe do controller aprovados.
- Correcoes apenas locais, sem commit/push/deploy nem nova migration. VPS ainda
  usa release 7f01376. Para aplicar, publicar dashboard e reiniciar somente API
  em deploy autorizado; depois validar DM com outra conversa selecionada/fechada.
  Conversa aberta e visivel continua reconhecendo automaticamente mensagens lidas;
  filtro Nao lidas conta conversas, enquanto badge individual conta mensagens.

### Imagens DM: validacao real confirmada pelo usuario

- Em 11/10/2026, apos o deploy 7f01376/Action 38160575371, o usuario confirmou
  recebimento de anexos enviados via DM, envio pelo Inbox chegando ao testador
  e permanencia da imagem no historico apos recarregar o painel.
- Trata-se de confirmacao funcional relatada pelo usuario, nao nova verificacao
  autenticada executada pelo agente. Nenhuma DM enviada pelo agente nesta etapa.
- README e roteiro atualizados somente localmente; sem novo commit/push/deploy,
  migration, restart ou mudanca de configuracao na VPS.
- Links reais e badges/leitura ainda sem confirmacao explicita nesta rodada.
  Pendentes retencao/limpeza de imagens, revisao de dependencias e capacidades
  compartilhadas multi-instancia; videos/audio/documentos nao implementados.

### Deploy links/imagens concluido em 2026-10-11

- Release confirmada na VPS: 7f01376fdbce7082eb1d06c981d0c260d23f154d.
  Action concluida com sucesso, dashboard/backend habilitados, migrations desligadas:
  https://github.com/harlemsilvas/auto-reels-n8n/actions/runs/38160575371
- Backup anterior validado por catalogo tar e SHA-256, arquivo 0600/4690504 bytes:
  /home/socialbot/backups/inbox-images-pre-deploy-20261011T173951Z/release-anterior.tar.gz.
  Inclui codigo/dependencias/build/workflow; copia de configuracao anterior 0600
  preservada no mesmo diretorio, sem registrar conteudo. Sem mudanca de banco.
- npm ci backend instalado; sharp 0.35.5 converteu PNG na VPS. Multer 2.4.0 e
  proxy-addr 2.0.8 confirmados. URL HTTPS de entrega e armazenamento persistente
  privado configurados; diretorio 0700 e arquivo de configuracao 0600 verificados.
  Nenhuma mudanca de proxy/portas/worker/n8n/tokens/fluxo Reels.
- Backend online, restart 4 -> 5, PID 3808101; worker online, restart 0,
  PID 1653 preservado. Scripts remotos sujos mantidos. Schema 014 passou novamente.
- Verificacoes desta sessao: API health/dashboard HTTP 200; Inbox, upload e
  imagem privada anonimos HTTP 401; capacidade invalida HTTP 404. Asset publico
  /assets/index-CR7byaW4.js HTTP 200 e SHA-256 igual ao build da release na VPS.
  Nenhuma sessao autenticada, DM real ou registro de mensagem criado por nos.
- Auditoria npm ci producao backend: quatro alertas (dois high, um moderate,
  um low), zero critical. Dashboard reportou doze (nove high). Revisao pontual
  restante pendente, sem audit fix amplo. Validacoes simuladas descritas abaixo
  nao comprovam a entrega de imagem real pela Meta.
- Proximo teste do usuario: nova DM com imagem de testador para conta conectada;
  confirmar exibicao, responder com JPG/PNG e link pelo Inbox e conferir Instagram.
  Pendentes politica de retencao/limpeza e capacidades compartilhadas multi-instancia;
  videos/audio/documentos ainda fora do escopo. Resultado documental sera enviado
  em commit separado, sem novo deploy.

### Deploy de links/imagens autorizado: preparacao

- Usuario autorizou publicar na VPS. Preflight desta sessao confirmou a7101b6,
  Node 20.20.2, migration 014 valida, backend online restart 4 e worker online
  restart 0/PID 1653. Scripts remotos nao relacionados preservados.
- Nginx API inspecionado: proxy existente e limite de corpo suficientes;
  nenhuma alteracao de proxy/portas necessaria. Configuracao Inbox ainda ausente.
- Workflow passa a preservar release/dependencias/configuracao em backup protegido,
  instalar backend via npm ci e testar sharp nativo antes de reiniciar somente API.
  Configuracao privada Inbox adicionada apenas quando ausente, divergencias abortam.
  Nenhuma migration nova; nenhuma DM real sera enviada durante verificacoes.
- Atualizacao pontual do lockfile para proxy-addr e multer antes de publicar;
  repetir testes e registrar versoes/auditoria e resultado real ao concluir.
- Versoes validadas: proxy-addr 2.0.8, multer 2.4.0 e sharp 0.35.5. Auditoria
  local: oito alertas (seis high, um moderate, um low), zero critical. Revisao
  restante de dependencias pendente; sem audit fix generalizado.
- Nesta sessao passaram quatro testes imagens, sete confiabilidade, onze webhook,
  teste cookies/CSRF/multipart, PostgreSQL isolado de nao lidas, Playwright imagens
  desktop/mobile, build dashboard, sintaxe de oito arquivos e YAML/bash do workflow.
- Esta entrada registra preparacao, nao deploy concluido.

### Links e imagens Inbox: novo incremento somente local

- Usuario autorizou comecar links/imagens no envio e recebimento, nao novo deploy.
  Ultimo deploy registrado permanece a7101b6, Action 38142591308, migration 014;
  HEAD documental 59081d9. Nenhuma consulta/mudanca VPS nesta implementacao.
- UI renderiza links HTTP/HTTPS seguros e imagens recebidas do payload.message.
  attachments, inclusive SSE: repository agora retorna payload na insercao.
  URLs javascript/data e credenciais na URL nao viram links; imagem inbound so HTTPS.
  Imagem abre em outra aba; indisponibilidade tem fallback. Payload frontend unknown.
- Compositor seleciona/mostra previa/remove JPG/PNG ate 8 MB. Texto/imagem enviados
  separadamente; falha na imagem nao repete texto entregue. Sem retry automatico;
  resultado incerto remove selecao e orienta conferir o Instagram antes de reenviar.
- POST multipart conversations/:id/images herda sessao/CSRF e inbox.reply;
  backend resolve conta/destinatario pela conversa ativa, rejeita campos extras.
  Multer limita upload, sharp decodifica/recodifica, remove metadados e limita
  20 megapixels. Arquivos privados 0600, diretorio 0700, fora das pastas Reels.
- Historico de imagens outbound usa payload.inboxImage e GET privado por conversa/
  mensagem, com inbox.view. URL de leitura Meta usa capacidade aleatoria de 256 bits,
  quinze minutos em memoria, sem token Meta/sessao; GET publico separado sem listagem.
  Erro definitivo remove arquivo; entrega incerta preserva arquivo e nao reenvia.
  Log de requisicao Meta nao imprime payload/URL de capacidade; timeout 30s.
- Configuracoes novas: INBOX_PUBLIC_BASE_URL (HTTPS da API obrigatoria em producao;
  local default 127.0.0.1:API_PORT) e INBOX_MEDIA_DIR (default backend/storage/inbox,
  ignorado Git). Arquivos .env reais preservados. Adicionada dependencia sharp
  0.35.5/lockfile; carregamento nativo local aprovado. Nenhuma migration nova.
- Testes novos backend/scripts/test-inbox-images.js: JPG/PNG, metadados, tamanho,
  corrupcao/dimensoes, multipart/permissoes/CSRF, conversa inexistente, arquivo
  privado/escopo, capacidade/expiracao, limpeza em rejeicao e resultado incerto.
  Meta/banco simulados, arquivos temporarios removidos. Servico real de envio
  testado com mocks: imagem persistida, token ausente, Meta rejeitando e falha DB.
- Playwright dashboard/tests/inbox-images.mjs desktop/mobile aprovado: preview,
  multipart com boundary/CSRF, links/XSS, imagem inbound/SSE, falha/retry sem repetir
  texto, entrega incerta e sem overflow. Capturas inspecionadas /tmp/inbox-images-*.
  Regressao confiabilidade, nao lidas e UI Playwright anteriores aprovadas; onze
  webhook, teste cookies/CSRF com FormData e PostgreSQL isolado de nao lidas aprovados.
- Documentacao Meta direta indisponivel (429); exemplos oficiais de fbsamples/
  messenger-platform-samples consultados por GitHub. Mantido cliente existente
  Facebook Login com token PAGE, envio image/url; nao mudar host/scopes/token.
  Nenhuma imagem/DM real enviada e nenhum registro de producao criado.
- npm reportou dez alertas backend (sete high, um critical em proxy-addr, indireto).
  Sem audit fix/refactor fora do escopo; revisar dependencias antes de ampliar uso.
- Futuro deploy precisa npm ci backend (workflow atual nao instala dependencias
  backend), URL HTTPS API e diretorio persistente privado antes do restart.
  Nao copiar configuracao local. Retencao/limpeza dos arquivos e capacidade
  compartilhada em multiplas instancias pendentes; anexos recebidos usam URLs Meta
  temporarias, sem download permanente. Videos/audio/documentos fora do incremento.
- API local reiniciada pelo launcher protegido: health 3101 HTTP 200, capacidade
  invalida 404 e upload anonimo 401; dashboard 5181 HTTP 200. Nenhum worker iniciado.
  Quatro testes backend de imagens aprovados; sintaxe de oito arquivos, build
  TypeScript/Vite, lint focado e git diff --check aprovados. Sem commit/push/deploy.

### Deploy controlado Inbox/014 concluido em 2026-10-11

- Commit implantado: a7101b629e246c043b3b0ee2dadeb172acf042b5.
  Action concluida com sucesso:
  https://github.com/harlemsilvas/auto-reels-n8n/actions/runs/38142591308
- Backup PostgreSQL validado por catalogo pg_restore/SHA-256, modo 0600,
  386083 bytes: /home/socialbot/backups/socialbot-postgres/deploy-20261011T131747Z/n8n_20261011_131747.dump.
  Backup de release anterior em inbox-unread-pre-deploy-20261011T131510Z preservado.
- Migration 014 executada com BEGIN/COMMIT e verificador antes do restart.
  Coluna inbox_unread boolean NOT NULL DEFAULT false e indice parcial confirmados
  na VPS. Vinte mensagens/quatro conversas preservadas; zero badges historicos,
  conforme politica de leitura desconhecida. Nenhum registro removido/ocultado.
- Backend online, restart 3 -> 4; worker online, restart 0, mesmo PID 1653.
  Checkout VPS confirmado em a7101b6; scripts remotos sujos preservados.
  Sem mudanca em worker/n8n/portas/tokens/configuracoes de infraestrutura.
  Script frontend existente validou/recarregou Nginx sem mudar configuracao.
- Health API HTTP 200 ok=true, dashboard e asset index-BpIX3Gg6.js HTTP 200.
  SHA-256 do bundle publico igual ao build dashboard/dist na VPS.
  GET Inbox anonimo HTTP 401; listagem do servico em leitura retornou quatro
  conversas com contadores numericos. Sem sessao autenticada nem envio de DM.
- Correcoes de confiabilidade e contadores agora aplicadas localmente e na VPS.
  Pendente teste real pelo usuario: enviar nova DM sem conversa aberta, observar
  badge/filtro, abrir conversa e confirmar leitura/resposta. Historico nao deve
  ganhar badges retroativos. Testes simulados nao comprovam entrega real pos-deploy.
- npm ci remoto reportou 12 alertas (nove high), sem audit fix. Nginx mostrou
  avisos de OCSP e nomes duplicados de outro dominio; teste de sintaxe aprovado.
  Nenhuma tentativa de corrigir infra/dependencias fora do escopo.
- Resultado sera enviado em commit documental separado, sem novo deploy.

### Deploy controlado Inbox/014 autorizado: preparacao

- Usuario autorizou deploy das correcoes locais de confiabilidade e nao lidas.
  Preflight atual confirmou VPS em 982b3b7, API/dashboard HTTP 200, backend online
  restart 3 e worker online restart 0. Quatro conversas/vinte mensagens, schema
  sender_type/payload; inbox_unread ainda ausente. Scripts remotos sujos preservados.
- Backup da release anterior validado por catalogo tar/SHA-256, modo 0600:
  /home/socialbot/backups/inbox-unread-pre-deploy-20261011T131510Z/.
  Inclui backend/src, dashboard/dist e workflow anterior; scripts locais remotos
  preservados separadamente no mesmo diretorio, sem credenciais.
- Workflow preparado com opcao 014, sintaxe dos modulos Inbox, backup custom
  protegido/catalogo pg_restore e SHA-256 antes da migration. Schema 014 verificado
  antes de publicar frontend/reiniciar backend; health API com retry e falha real.
- Testes PostgreSQL isolado/ROLLBACK, nove Testers, onze webhook, sete HTTP
  simulados, cookies/CSRF, build e badges desktop/mobile repetidos e aprovados.
  Main local e origin/main em fb979ae antes do commit. Nenhuma DM real enviada.
- Execucao planejada: dashboard=true, restart_backend=true, run_migrations=true,
  migration_set=014. Worker/n8n/tokens/portas preservados. Esta entrada nao comprova
  deploy concluido; registrar SHA/Action/backup PostgreSQL e verificacoes ao finalizar.

### Nao lidas: segundo incremento aplicado somente localmente

- API Inbox e Testers calculam unreadCount por COUNT das mensagens inbox_unread,
  substituindo zero fixo/contador legado. Novos inbound user sao nao lidos;
  outbound nao incrementa. Estado compartilhado do Inbox, nao por operador.
- Migration 014 idempotente/transacional adiciona boolean default false e indice
  parcial. Historico anterior permanece sem badges retroativos (leitura desconhecida).
  Aplicada/verificada somente no PostgreSQL local, cinco mensagens preservadas.
  Backup validado por pg_restore --list, arquivo modo 0600:
  backups/inbox-unread-2026-10-11T13-00-42-026Z/local.dump.
  Host nao tem pg_dump: utilizado binario do container socialbot_postgres.
- Insercao de mensagem e contador em transacao, com lock por conversa;
  deduplicacao por conversation_id/meta_message_id antes de inserir/emitir SSE.
  Criacao de conversa serializada por conta/tester com advisory lock.
  Compatibilidade sender_type/sent_by e payload/raw_payload usa savepoints.
- POST read aceita messageIds UUID (maximo 500); IDs vazios nao apagam nada,
  IDs de outro chat nao alteram estado. Sem corpo mantem compatibilidade com
  clientes antigos (reconhece snapshot atual). Validacao 400 e ausente 404.
  API lista as ultimas 100 mensagens em ordem cronologica, nao as primeiras 100.
- UI confirma IDs carregados/eventos recebidos somente com conversa visivel e
  aba ativa; lista mobile nao marca chat oculto. Resposta atualiza badge/filtro;
  respostas antigas de listagem sao invalidadas apos leitura. Mudanca de viewport
  nao reinicia o estado de envio. Nao lidas anteriores ao recorte de 100 permanecem.
- Teste PostgreSQL em schema temporario aprovado: migration duas vezes/verificador,
  historico, inbound/outbound, duplicados concorrentes, leitura parcial/vazia/escopo,
  corrida leitura+nova DM, rollback em falha e schema legado. Nove testes Testers,
  onze webhook, sete confiabilidade HTTP simulados e teste cookies/CSRF aprovados.
  Playwright badges/filtro/IDs e leitura mobile, confiabilidade e UI desktop/mobile
  aprovados com APIs interceptadas. Build TypeScript/Vite e lint focado aprovados.
- Novos testes: backend/scripts/test-inbox-unread.js e
  dashboard/tests/inbox-unread.mjs (PLAYWRIGHT_MODULE externo, dashboard 5181).
- API local reiniciada exclusivamente pelo launcher protegido de simulacao,
  health 3101 HTTP 200. Dashboard existente 5181 mantido; nenhum worker iniciado.
  Sintaxe dos modulos backend alterados e git diff --check aprovados.
- Sem Meta/DM real, commit/push/deploy ou acesso VPS. Ultimo deploy confirmado
  continua 982b3b7 com migration 013. Proximo deploy deve habilitar 014 no workflow
  e aplica-la/verifica-la antes de reiniciar backend; nao publicar codigo sem schema.
  Reels, worker, n8n e configuracoes VPS preservados. Residual: eventos sem ID Meta
  nao tem deduplicacao confiavel; reconciliacao de envio segue pendente.

### Confiabilidade Inbox: primeiro incremento aplicado somente localmente

- Envio: hook propaga falha ao compositor; rascunho mantido e mensagem otimista
  removida individualmente. Guards por ref impedem envio simultaneo no compositor.
  Typing indicator passou a best-effort: falha nao bloqueia texto; sem retry automatico
  de envio/persistencia. Erros externos nao sao impressos pelo catch do indicador.
- Mensagens: uma carga inicial por ciclo, polling sem sobreposicao e invalidacao por
  geracao ao trocar/desmontar conversa. Respostas antigas nao atualizam outro chat.
  Lista unica por ID integra polling, SSE e envio; polling preserva eventos recebidos
  durante requisicao e mensagens otimistas. Envio finalizado em outro chat nao o invade.
- Listagem nao recarrega por selecionar conversa; refresh mantem selecao por ID e
  descarta respostas fora de ordem. SSE mantem uma conexao por montagem e handlers
  atuais, sem reconectar a cada render. Scroll preserva leitura de mensagens antigas.
- Sete testes backend com cliente Meta/repositorio simulados aprovados: sucesso,
  typing falhando, conta/token ausentes, falha externa/persistencia e matriz HTTP
  sessao/CSRF/permissao admin/operator. HTTP usa middleware/rotas reais e servicos
  simulados, nao autentica sessoes em PostgreSQL nem exercita app.js completo.
- Testes Playwright com APIs interceptadas aprovados: resposta atrasada, erro de
  envio/rascunho, SSE duplicado durante polling, estabilidade da conexao e envio
  finalizado em outra conversa. Regressao desktop/mobile anterior tambem aprovada.
  Build TypeScript/Vite, lint dos seis arquivos frontend alterados, sintaxe backend
  e diff --check aprovados. Testes cookies/CSRF e dez testes webhook repetidos.
- Comandos novos: node backend/scripts/test-inbox-reliability.js e
  PLAYWRIGHT_MODULE=/tmp/socialbot-ui-check/node_modules/playwright node
  dashboard/tests/inbox-reliability.mjs. Playwright instalado apenas fora do repo.
- Sem migration, banco real nos testes, envio DM, commit/push/deploy ou consulta VPS.
  Ultimo deploy confirmado continua 982b3b7. Dashboard local iniciado na porta 5181;
  API iniciada pelo launcher protegido de simulacao, health 3101 HTTP 200. Nenhum
  worker/coletor iniciado. Documentacao local anterior preservada.
- Proximo incremento: nao lidas/resumos no Inbox geral. API hoje retorna unreadCount
  fixo zero; revisar persistencia inbound/mark-read com transacoes e testes antes
  de substituir esse valor. Perfil da pagina Testers nao atualiza Inbox geral.
- Residual: erro de persistencia apos envio Meta pode significar mensagem entregue
  sem registro. Nao repetir envio automaticamente; idempotencia/reconciliacao exige
  desenho posterior. Testes atuais nao comprovam comportamento real de Meta/SSE VPS.

- README atualizado com funcionalidades Inbox/Testers testadas, limites do
  enriquecimento de perfil, migration 013, testes, seguranca local e links relativos.
- Roteiro de 09/10 ganhou secao atual que prevalece sobre pendencias historicas.
  Proxima etapa recomendada: confiabilidade Inbox (permissoes, falhas de envio,
  typing indicator, troca de conversa, polling/SSE e nao lidas), antes de anexos
  ou respostas rapidas. Nenhuma nova feature funcional implementada nesta revisao.
- Ultimo deploy confirmado permanece 982b3b7, Action 38074150243, migration 013.
  HEAD local fb979ae no inicio da sessao; registro documental do deploy anterior.
  Sem consulta de saude/VPS hoje; nao interpretar resultados de ontem como atuais.
- Usuario pediu atualizar README e seguir evolucao. Testes/relatos anteriores
  usados como evidencia; nao inferir validacao visual pos-deploy de cada controle.
- Apenas documentacao alterada localmente; sem commit/push/deploy, migration,
  envio DM ou leitura de .env. Artefatos de simulacao nao versionados preservados.
- docs/0006-mult-posts.md continua ausente. Validacao desta revisao: links locais
  do README e git diff --check; testes funcionais nao repetidos para mudanca textual.

## TAG de retomada: RETOMADA-2026-10-10

### Deploy Inbox e migration 013 concluido em 2026-10-10

- Commit implantado: 982b3b7b89003acbcf4f2b4f59e220b1d1852756.
  Action concluida com sucesso:
  https://github.com/harlemsilvas/auto-reels-n8n/actions/runs/38074150243
- Backup PostgreSQL anterior: /home/socialbot/backups/socialbot-postgres/n8n_20261010_180218.dump
  (384677 bytes, modo 0600, catalogo pg_restore e SHA-256 conferidos).
  Backup frontend/backend anterior mantido em inbox-pre-deploy-20261010T175912Z.
- Migration 013 aplicada com COMMIT e verificador aprovado antes do restart.
  Coluna testers_hidden_at confirmada na VPS como timestamptz nullable.
- Checkout remoto confirmado no SHA acima; alteracoes remotas de scripts
  preservadas. Backend online (contador restart 2 -> 3); worker online, restart 0.
  Worker/n8n/portas/tokens/configuracoes nao alterados por esta publicacao.
- API health HTTP 200, ok=true; dashboard e asset index-CFgLuXRk.js HTTP 200.
  Hash do bundle publico igual ao build dashboard/dist da VPS. Leitura direta
  /var/www negada por EACCES; nao foram alteradas permissoes para contornar.
- Listagem do servico Testers executada em leitura: quatro registros, tres com
  username, um com nome e quatro com ultima mensagem. Token interno ausente.
  Quatro conversas preservadas; zero ocultadas automaticamente. Nenhuma DM enviada.
- UI Inbox, ocultacao Testers, enriquecimento de perfil/resumo e filtro de recibos
  agora aplicados na VPS. Usuario deve atualizar navegador e validar nova DM,
  resposta e botao Ocultar; teste visual autenticado de producao nao feito pelo agente.
- Documentacao de resultado sera enviada em commit separado, sem novo deploy.

### Deploy Inbox e migration 013 autorizado em 2026-10-10

- Usuario confirmou teste visual e autorizou deploy/migration. Preflight VPS
  confirmou c4f3cbc, backend/worker online e coluna testers_hidden_at ausente.
  Alteracoes remotas em scripts preservadas; arquivos locais de simulacao excluidos.
- Backup anterior de frontend/backend validado (catalogo tar e SHA-256) em
  /home/socialbot/backups/inbox-pre-deploy-20261010T175912Z/.
- Workflow ampliado apenas com migration_set=013; backup PostgreSQL com umask 077,
  migration/verificador antes do restart. Nenhuma migration anterior selecionada.
- Nove testes servico/SQL local, dez webhook, teste cookies/CSRF e build dashboard
  repetidos e aprovados. Deploy sera acionado com dashboard=true,
  restart_backend=true, run_migrations=true, migration_set=013.
- Esta entrada registra preparacao; resultado/commit/Action e verificacoes de
  producao devem ser registrados depois. Worker, n8n, portas e tokens nao alterados.

### UI do Instagram Inbox modernizada somente localmente

- Substituidas classes Tailwind sem framework configurado por CSS isolado inbox-*,
  sem alterar tema global, endpoints, banco, hooks de envio/polling ou Reels.
- Lista pesquisavel por nome, username, ID e resumo; filtro Todas/Nao lidas,
  contadores existentes, atualizar, selecao destacada e fallback ID sem @undefined.
- Chat com mensagens recebidas/enviadas distintas, separadores de data, horarios,
  erro visivel e compositor com icone, bloqueio de texto vazio e suporte IME.
  No celular alterna lista/chat com botao Voltar; layout com scroll interno.
- Adicionada dependencia lucide-react e lockfile atualizado. npm reportou 12
  alertas de dependencias (nove high); nao executado audit fix automatico.
- Build TypeScript/Vite, teste do cliente cookies/CSRF e diff --check aprovados.
  Playwright com APIs totalmente interceptadas validou desktop 1440x1000 e
  celular 390x844: busca, nao lidas, datas, compositor, voltar e ausencia de overflow
  horizontal/erros JS. Capturas inspecionadas em /tmp/socialbot-inbox-*.png.
- Teste dashboard/tests/inbox-ui.mjs usa Playwright externo instalado em
  /tmp/socialbot-ui-check; executar com PLAYWRIGHT_MODULE apontando para esse
  node_modules/playwright, ou instalar Playwright no ambiente de testes.
- Nenhuma mensagem real enviada ou dado de producao consultado. API/dashboard
  locais continuam 3101/5181. Sem commit/push/deploy; VPS permanece no ultimo
  estado registrado c4f3cbc. Mudancas de perfil anteriores sao da pagina Testers DM,
  nao enriquecem automaticamente o Inbox geral. Validacao com sessao/dados reais
  e deploy continuam pendentes, incluindo migration 013 da etapa anterior.

### Ocultacao de conversas da pagina Testers DM preparada localmente

- Usuario confirmou Enviar DM de teste e Enviar fluxo teste funcionando e pediu
  remover registros ficticios/desconhecidos da pagina. Nao inferir invalidade
  apenas por falha de consulta de perfil; nao remover funcoes na Meta.
- Botao Ocultar com confirmacao e estado de carregamento. DELETE
  `/api/internal/testers-dm/conversations/:id` valida UUID, retorna 400/404 quando
  aplicavel e marca somente testers_hidden_at. Repeticao idempotente; listagem
  ignora marcados. Preserva deleted_at, mensagens, Inbox e processamento webhook.
- Rota herda sessao, CSRF e inbox.manage_testers do mount existente. Cliente
  DELETE usa cookies e CSRF. Nenhum registro ocultado automaticamente.
- Schema local inspecionado antes da mudanca. Migration 013 e verificador
  preparados; executada duas vezes em transacao com ROLLBACK nos testes.
  Depois aplicada e verificada somente no banco local, sem backfill.
- Nove testes do servico/listagem aprovados, incluindo idempotencia e preservacao
  de mensagens/Inbox no PostgreSQL local; dez testes webhook e teste Axios
  cookies/CSRF aprovados. Build dashboard, sintaxe JS e git diff --check aprovados.
- API de simulacao e Vite iniciados; health local 3101 e dashboard 5181 HTTP 200.
  Launcher seguro usado, sem worker ou publicacao. Teste visual autenticado do
  botao ainda pendente; Playwright nao instalado no dashboard.
- Sem commit, push ou deploy nesta etapa. VPS nao consultada/alterada; ultimo
  checkout registrado c4f3cbc. Deploy exige backup/inspecao do schema VPS,
  aplicar/verificar 013 ANTES de carregar backend novo, restart somente backend
  e publicacao do dashboard. Workflow atual nao oferece migration_set=013;
  nao executar deploy ignorando esse requisito nem reaplicar 012 por conveniencia.
- Consulta de nome/username por ID scoped continua preparada localmente; dados
  ausentes na Meta permanecem vazios. Documento docs/0006-mult-posts.md ausente.

### Campos da pagina Testers DM corrigidos somente localmente

- Usuario relatou Nome, Username e Ultima mensagem vazios. Leitura VPS confirmou
  quatro conversas, zero nomes/usernames/resumos preenchidos e nenhum trigger
  em instagram_messages para atualizar a conversa. Tela apenas exibe esses campos.
- GET de perfis por ID scoped com token PAGE existente retornou 200 para os dois
  testadores recentes. Meta retornou username nos dois casos e nome em um deles;
  nome nao fornecido deve continuar vazio, sem inventar a partir do username.
- listTesterConversations agora deriva ultimo texto/data de instagram_messages
  via LATERAL, desconsiderando textos nulos/vazios e ordenando por atividade real.
  Inclui respostas enviadas, sem considerar recibos legados como ultima mensagem.
- Campos de perfil ausentes complementados por GET name,username no cliente Meta
  existente. Consulta tem timeout de tres segundos e lotes de ate cinco; falha
  externa nao bloqueia listagem. Sem token ou ID ficticio, nao consulta perfil.
  Token interno removido da resposta da API em todos os caminhos.
- Enriquecimento acontece apenas na resposta da listagem, sem gravar campos na
  conversa ou fazer backfill. Nenhuma migration ou alteracao de dados realizada.
  Inbox geral/unread/SSE nao alterados por esta correcao da pagina Testers DM.
- Seis testes da listagem aprovados, incluindo SELECT PostgreSQL com CTEs ficticias
  no banco local e nenhuma escrita. Dez testes do filtro de webhook continuam
  aprovados. Sintaxe dos arquivos modificados e git diff --check aprovados.
- Comandos: `node backend/scripts/test-testers-dm-list.js --database` e
  `node backend/scripts/test-instagram-webhook.js`.
- Correcao apenas no codigo local, sem reinicio da API ou deploy. VPS permanece
  c4f3cbc. Campos so aparecerao na pagina de producao apos publicacao autorizada
  do backend e teste visual; frontend nao exige mudanca para esse contrato.

### Resposta validada e filtro de recibos preparado localmente

- Usuario confirmou resposta pelo painel entregue ao testador. Consulta de leitura
  na VPS confirmou outbound em `2026-10-10T17:26:07.541Z` (14h26min07s BRT),
  com texto e ID Meta. Recebimento, resposta, persistencia e entrega ao usuario
  validados por consultas e relato do usuario; esta sessao nao enviou mensagens.
- Corrigido somente no codigo local processMessagingEvent: eventos sem objeto
  message valido sao ignorados antes de consultar conta/criar conversa/salvar.
  Historico bruto de webhook preservado. Nao trata recibos como mensagens novas.
- Testes com db, repository e emissor realtime simulados: defeito reproduzido
  antes da correcao (seis falhas); dez casos aprovados depois. Cobrem read,
  delivery, reaction, postback, message invalida, lote recibo+texto, anexo, echo,
  formato changes e conta desconhecida. Nenhum acesso a banco ou Meta nos testes.
- Comando: `node backend/scripts/test-instagram-webhook.js`.
  `node --check` dos dois arquivos e `git diff --check` aprovados.
- Sem reinicio da API local ou deploy da correcao. VPS permanece em c4f3cbc com
  handler anterior; commit/push/restart do backend dependem de nova autorizacao.
  Nenhum registro historico removido, migration ou mudanca no fluxo Reels.
- Proximos passos: implantar filtro com autorizacao e validar nova DM/read/echo;
  revisar nomes/username e atualizacao da conversa/unread/SSE. Testes mockados
  nao substituem verificacao de SSE no navegador ou transacoes no banco.

### Recebimento real confirmado apos publicacao do app

- Usuario publicou o app Meta e confirmou duas mensagens aparecendo no painel.
- Consulta VPS em `2026-10-10T17:21:16.122Z` (14h21 BRT): 200 webhooks e nove
  mensagens. Antes da publicacao/teste eram 193 webhooks e cinco mensagens.
- Duas mensagens de usuario com texto persistidas em `2026-10-10T17:20:04.613Z`
  e `2026-10-10T17:20:19.276Z`; ambas correlacionadas aos webhooks por meta_message_id.
  Entrega Meta, persistencia e exibicao no painel confirmadas para esse teste.
  Publicacao do app destravou o recebimento observado; nao requer outro deploy.
- Ha tambem mensagem outbound registrada as 14h20min44s; esta sessao nao enviou
  DM nem acionou endpoint de envio, apenas realizou consultas de leitura.
- Defeito adicional confirmado: aviso read com sender/recipient em
  `2026-10-10T17:20:46.299Z` criou mensagem de usuario sem texto e sem ID Meta
  em `2026-10-10T17:20:46.306Z`. Handler processMessagingEvent nao exige message
  antes de criar conversa/salvar. Proximo ajuste: distinguir mensagens de recibos
  e preservar eventos brutos; testar texto, anexos, echo e read sem alterar Reels.
- Nomes/username da conversa continuam nulos. Revisar identificacao e atualizacao
  da conversa/unread/SSE nas proximas etapas. Nao apagar registros por conveniencia.
- Nenhuma mudanca de codigo, infraestrutura, token ou assinatura na VPS nesta
  verificacao. Estado do app foi alterado pelo usuario no painel Meta.

### Investigacao antes da publicacao

- Retomada focada na entrega de eventos e no estado do app, sem alteracoes de
  producao. Checkout VPS revalidado em `c4f3cbc`; deploy do frontend permanece
  o da Action 37979762493. Alteracoes locais existentes preservadas.
- Consulta em `2026-10-10T15:22:29.312Z` (12h22 BRT): 193 webhooks e cinco
  mensagens. Evento adicional de `2026-10-09T21:17:02.417Z` (18h17 BRT) e read,
  sem mensagem. Ultima mensagem salva continua em 17/06/2026.
- GETs Meta atuais aprovados: pagina assinada para messages, messaging_postbacks,
  messaging_optins e message_deliveries no app configurado; assinatura do objeto
  Instagram ativa com callback https://api.hrmmotos.com.br/api/webhooks/instagram.
- Confirmacoes anteriores mantidas: dois remetentes aparecem nas conversas Meta,
  teste sintetico chegou ao banco, conta hrmmotos inscrita no painel e convite
  Instagram de harleysilvasaulo aceito. Nao repetir essas pendencias.
- Principal bloqueio a verificar: estado Nao publicado mostrado nos prints de
  09/10. O proprio painel Meta informa que o app precisa estar publicado para
  receber webhooks. Hipotese forte, ainda nao comprovada com mudanca de estado
  e nova DM real. Estado atual de publicacao nao consultado por API nesta sessao.
- Documentacao oficial consultada por navegador retornou 429/indisponivel;
  nao usar relatos secundarios como confirmacao da causa raiz. Aviso de publicacao
  utilizado como evidencia direta do painel fornecido pelo usuario.
- Backend usa Facebook Login, token PAGE e permissoes instagram_manage_messages;
  painel fornecido usa Instagram Login e instagram_business_manage_messages.
  Preservar fluxo de Reels e nao trocar token/host/scopes por tentativa.
- Proximo passo: usuario abrir Publicar e mostrar pendencias/requisitos sem
  confirmar publicacao. Revisar requisitos e alcance; alteracao do estado exige
  autorizacao explicita. Depois correlacionar DM real, webhook e mensagem salva.
- Nenhum deploy, restart, migration, envio DM ou alteracao de token/assinatura
  realizado. Logs protegidos Nginx continuam sem leitura confirmada nesta sessao.

## TAG de retomada: RETOMADA-2026-10-09

### Publicacao da correcao do Inbox concluida em 2026-10-09

- Usuario confirmou aceite do convite de testador e autorizou push/deploy.
- Escopo: cliente Inbox (cookies/CSRF), teste de regressao e documentacao.
  Arquivos .env, override Docker e scripts da simulacao local excluidos do commit.
- Teste Axios simulado, build TypeScript/Vite e lint do servico repetidos e aprovados.
- Workflow `Deploy VPS` executado com dashboard=true, restart_backend=false,
  run_migrations=false e migration_set=none. Nao altera portas/configuracao Nginx;
  usa o script existente que valida e recarrega Nginx apos publicar os arquivos.
- Backup do frontend anterior verificado na VPS em
  `/home/socialbot/backups/dashboard-pre-inbox-20261009/frontend-anterior.tar.gz`.
  Alteracoes remotas em scripts existentes preservadas.
- Commit enviado e implantado: `c4f3cbce3d72a32d69da71bd8c8ba471f1033168`.
- Action concluida com sucesso:
  https://github.com/harlemsilvas/auto-reels-n8n/actions/runs/37979762493
- Checkout VPS confirmado em `c4f3cbc`. Bundle publico `index-tYXkkmOS.js`
  respondeu HTTP 200 e seu SHA-256 confere com o arquivo publicado na VPS.
  Cliente Inbox compilado contem cookies e CSRF; API de producao configurada,
  sem URLs da API local. Dashboard e health da API HTTP 200 apos deploy.
- Backend e worker permanecem online; nao reiniciados por este workflow.
  Sem migrations ou alteracao de tokens/webhooks. Recebimento de uma nova DM e
  validacao autenticada no navegador ainda precisam de teste pelo usuario.

### Teste do usuario apos deploy: historico verificado em 2026-10-09

- Teste de outro remetente confirmado na Meta: conversa hrmmotos com
  abccenterdistribuidora atualizada em `2026-10-09T20:21:27+0000` (17h21min27s BRT).
  Participantes da conversa de 17h12min26s confirmados: hrmmotos/harleysilvasaulo.
- Consulta VPS em `2026-10-09T20:22:06.706Z` (17h22 BRT): continuam 192 eventos
  e cinco mensagens. Nenhum webhook novo persistido para os dois testes reais.
  Falha observada nao restrita a um testador. Investigar entrega real/estado do
  app e assinatura por fluxo; callback sintetico funciona. Causa raiz nao confirmada.

- Print de Convites do testador confirma `socialbot-IG` autorizado em 09/10:
  aceite do convite Instagram confirmado. Nao repetir essa pendencia.
- Consulta VPS em `2026-10-09T20:15:27.176Z` (17h15 BRT): 192 webhooks e cinco
  mensagens, sem novos registros. GET da identidade Instagram retorna hrmmotos.
- GET Facebook Graph de conversas da pagina, platform=instagram, respondeu 200:
  duas conversas, uma atualizada em `2026-10-09T20:12:26+0000` (17h12min26s BRT).
  API enxerga conversa recente, enquanto a VPS nao possui webhook correspondente.
  Texto/remetente dessa conversa ainda nao correlacionados com o teste informado.
  Investigar entrega/configuracao de webhooks e compatibilidade dos fluxos
  Facebook Login/Instagram Login sem substituir tokens ou publicar app por tentativa.

- Prints posteriores mostram app nao publicado e diferenca entre funcoes Facebook
  e Instagram. `harleysilvasaulo` inicialmente ausente dos testadores Instagram;
  print mais recente confirma inclusao como Testador do Instagram. Aceite desse
  novo convite Instagram nao foi confirmado pelo print (status vazio).
- Usuario enviou nova mensagem de teste. Consulta em `2026-10-09T20:13:01.435Z`
  (17h13 BRT): permanecem 192 webhooks e cinco mensagens, sem mensagem nova.
  Ultimo evento ainda e o teste sintetico Meta das 16h50. Confirmar aceite do
  convite especifico do Instagram antes de atribuir o problema a outra causa.

- Teste manual Meta `messages v25.0` confirmado pelo usuario as 16h50.
  Evento registrado na VPS em `2026-10-09T19:50:07.182Z` (16h50min07s BRT):
  total passou de 191 para 192. Payload usa entry.changes, campo messages,
  com remetente/destinatario presentes; destinatario nao corresponde a nenhuma
  conta Instagram ativa cadastrada. Conversas permanecem duas e mensagens cinco.
- Teste confirma entrega ao callback e persistencia do evento bruto, nao o fluxo
  completo de DM real. Prints do painel confirmam messages assinado v25.0.
  Proximo foco: vinculo/assinatura da conta profissional no produto configurado;
  expandir etapa Gerar tokens de acesso sem expor ou substituir tokens.

- Usuario informou novos testes. Consulta VPS em `2026-10-09T19:27:38.549Z`
  (16h27 America/Sao_Paulo): contagens permanecem 191 webhooks, duas conversas
  e cinco mensagens. Nenhum registro novo dos testes encontrado.
- Ultimo webhook segue em 08/10 (evento read); ultima mensagem salva em 17/06.
  Cauda dos logs do backend sem novos marcadores de recebimento de webhook.
- Logs protegidos de acesso Nginx nao puderam ser lidos, inclusive via sudo
  nao interativo. Nao concluir ausencia de entrega HTTP apenas pela ausencia no banco.
- Proximo passo: confirmar @ destinatario e verificar no painel Meta a assinatura
  messages e o resultado de entrega de webhook para o teste. Deploy do frontend
  confirmado, mas recebimento de DM ainda nao resolvido. Nenhuma mudanca na VPS.

### Estado local antes da publicacao

- Base local permanece em `63f90d3`; ultimo checkout/deploy VPS registrado em
  `cecd3d6`, sem revalidacao remota nesta sessao. Alteracoes locais anteriores preservadas.
- Primeira etapa do roteiro aplicada somente localmente: cliente Axios do Inbox
  envia cookies e consulta o CSRF atual em sessionStorage antes de cada escrita.
  Erros Axios permanecem disponiveis para as telas, sem alterar contratos dos endpoints.
- Teste `node --test dashboard/tests/inbox-service.test.mjs` aprovado com transporte
  Axios simulado: sete operacoes, cookies, CSRF nas escritas, renovacao/remocao do
  token e preservacao do erro da API. Nenhuma chamada Meta ou mensagem real enviada.
- Build TypeScript/Vite, lint do servico alterado e `git diff --check` aprovados.
  Lint completo e teste visual/autenticado no navegador nao repetidos nesta sessao.
- API e dashboard estavam indisponiveis no inicio da verificacao HTTP. Iniciados
  apenas launcher de simulacao e Vite, ligados ao loopback. API 3101, dashboard 5181
  e readiness n8n 5678 retornaram HTTP 200 nesta sessao. Worker nao iniciado.
- Proximos passos: validar permissoes admin/operator e sessao/CSRF no backend;
  testar envio/persistencia com Meta simulado; revisar falha do typing indicator;
  definir escopo de testers e validar webhook/SSE. Credenciais Meta locais continuam
  removidas. Nenhum commit, push, migration ou deploy realizado.
- Roteiro atualizado em `project-docs/retomada-2026-10-09.md`.

### Diagnostico somente-leitura de DM na VPS em 2026-10-09

- Usuario relata DM de `harleysilvasaulo` ausente no local e na producao.
  Aceite do convite confirmado pelo usuario; @ destinatario ainda nao confirmado.
- Checkout VPS revalidado em `cecd3d6`; backend/worker online no PM2.
  API health e dashboard publicos HTTP 200. GET do callback sem parametros de
  verificacao retornou 403, resultado esperado para requisicao nao verificada.
- Banco VPS: 191 eventos, duas conversas e cinco mensagens. Ultimo evento em
  `2026-10-08T09:49:09.398Z`; ultima mensagem salva em `2026-06-17T14:03:33.633Z`.
  Os cinco eventos mais recentes possuem `read`/`timestamp`, sem mensagem de texto.
  Nao foi encontrada DM recente persistida; causa do nao recebimento ainda aberta.
- GETs na Meta: token valido, tipo PAGE, pertence ao app configurado e inclui
  `instagram_manage_messages`, `pages_messaging` e `pages_manage_metadata`.
  Pagina assinada para `messages`, `messaging_postbacks`, `messaging_optins` e
  `message_deliveries`. App possui assinatura Instagram ativa no callback publico.
  A consulta do app nao retornou seus campos, mesmo com selecao explicita;
  verificar `messages` no painel Meta antes de concluir que esta ativo ou ausente.
  Consulta de subscribed_apps no ID Instagram via Facebook Graph retornou code 100;
  nao interpretar como ausencia de assinatura, considerando fluxo Facebook Login.
- Bundle publicado do dashboard datado de 2026-07-16; checkout VPS ainda sem
  cookies/CSRF no cliente Inbox. Deploy do frontend pendente, mas nao ha evidencia
  de que essa correcao resolva o recebimento dos webhooks.
- Local permanece copia de teste sem sincronizacao de novas DMs da VPS.
- Nenhum deploy, restart, alteracao de assinatura/token, envio Meta ou modificacao
  de banco/infraestrutura realizada nesta investigacao. Apenas consultas de leitura.

## TAG de retomada: RETOMADA-2026-10-08

Data local: 2026-10-08 (America/Sao_Paulo). A restauracao local da VPS registrada abaixo e o estado mais recente desta TAG. Os itens iniciais descrevem a reconciliacao anterior a essa restauracao.

- Main local reconciliada por fast-forward com `origin/main`, commit `63f90d3a6e3b8f63d7bf1f2abd8ae46c4eee5f3b`.
- Backup protegido: `backups/reconciliacao-20261009T003826Z/`. Inclui checkout anterior, patch e bundle completo do Git; os 58 arquivos modificados e quatro configuracoes locais foram conferidos contra o arquivo compactado antes da restauracao.
- Configuracoes locais e override preservados. Dados persistentes nao foram alterados; o volume PostgreSQL foi excluido do arquivo compactado e permanece no mesmo local. Dependencias, build e logs de runtime tambem foram excluidos; o historico Git foi preservado no bundle.
- README e dois arquivos de dashboard divergentes preservados no backup; adotados os contratos coerentes da main remota. SQLs 012 locais anteriores preservados em `sql-locais/`, usando agora os SQLs rastreados do remoto.
- Validacoes desta sessao: sintaxe dos 97 arquivos JavaScript aprovada; build TypeScript/Vite do dashboard aprovado; permissoes, hash/verificacao de senha, selecao dos cinco tipos de publicacao e cinco contratos HTTP aprovados em servidor temporario.
- Testes HTTP usaram autenticacao ativa e automacoes desativadas somente no processo de teste. A configuracao local efetiva preservada diverge do registro anterior: autenticacao desativada e enqueue automatico habilitado. Nao iniciar o backend oficial antes de revisar essas flags.
- Lint completo do dashboard: 23 erros e 3 avisos na base remota, principalmente regras de hooks React e tipos `any`. Build aprovado nao significa lint aprovado.
- Validacao de consultas de banco bloqueada: PostgreSQL local responde `42501`, `could not open file "global/pg_filenode.map": Permission denied`. Mount confirmado em `/home/harlem/projetos/auto-reels-n8n/postgres`; diretorio raiz com owner `1000:1000` e modo `0700`. Nenhuma permissao foi alterada nesta sessao.
- Nenhum worker/coletor iniciado, publicacao enviada, migration aplicada ou deploy realizado. VPS nao foi revalidada; ultimo deploy registrado permanece `cecd3d6`.
- Pendencias: corrigir acesso ao volume PostgreSQL local, revisar flags locais, repetir consultas e testes autenticados com banco real e tratar os debitos de lint. `docs/0006-mult-posts.md` continua ausente.
- Acesso SSH preparado em 2026-10-08: documentacao aponta `socialbot@187.77.61.83`. Nova chave local dedicada em `~/.ssh/socialbot_vps_ed25519`, criada sem passphrase, com alias `socialbot-vps`. Chave publica ainda precisa ser instalada em `authorized_keys` por acesso existente (senha ou console do provedor); conexao e fingerprint do servidor ainda nao validados. Nenhuma chave antiga foi substituida e nenhum acesso remoto foi realizado nesta etapa.
- SSH local apresentou `Bad owner or permissions on /etc/ssh/ssh_config.d/20-systemd-ssh-proxy.conf`. Configuracao do sistema preservada; usar `ssh -F ~/.ssh/config socialbot-vps` para carregar explicitamente a configuracao do usuario.
- Usuario confirmou cadastro/teste da chave. Acesso SSH sem senha revalidado nesta sessao como `socialbot` no host `srv1433055`; consultas somente leitura confirmaram checkout VPS em `cecd3d686b46e21f1853d5734f6e9c471f09260e`, backend e worker online no PM2, PostgreSQL 15.17 com 20 posts, Redis 7.4.9 e n8n 2.20.7-exp.0. Midias em `/home/socialbot/media/reels` ocupam aproximadamente 1,1 GB. Alteracoes remotas existentes em tres scripts e `scripts/sql/005-atualizacao.sql` preservadas. Nenhum backup remoto ou download executado ainda; proximo passo e copiar dados de forma consistente, mantendo automacoes locais desligadas.

### Restauracao da VPS para simulacao local em 2026-10-08

- Usuario autorizou backup/importacao, dispensou midias reais e confirmou que o local e apenas para testes, sem publicacao oficial.
- Backup consistente via `pg_dump -Fc --no-owner --no-privileges` da VPS em `cecd3d6`; banco restaurado em volume local novo, em transacao unica. Nao foram executadas migrations adicionais.
- Backup protegido: `backups/vps-local-20261009T005652Z/`; contem `postgres-vps.dump`, `n8n-vps.tar.gz`, `redis-vps.rdb`, hashes em `manifesto.json`, configuracoes locais anteriores e copia fisica dos volumes locais parados. Nenhuma midia da VPS foi baixada.
- Imagens PostgreSQL, Redis e n8n fixadas nos mesmos digests da VPS em `docker-compose.override.yml`. Novos volumes `socialbot_simulation_postgres_20261009`, `socialbot_simulation_redis_20261009` e `socialbot_simulation_n8n_20261009`; volumes/pastas anteriores preservados. Os tres containers locais estao ativos; PostgreSQL/Redis saudaveis e readiness do n8n HTTP 200.
- Restaurados 20 posts publicados, 37 itens de midia e um workflow; nenhum item orfao. Caminhos de midia adaptados para `media/reels/pending` local, sem arquivos reais. URL local de midia e apenas apontamento de teste; nao existe servidor de midia nem preview real.
- Redis da VPS preservado apenas como backup: nao importado, evitando jobs reais. Todos os seis contadores da fila local retornaram zero.
- Apenas na copia local: tokens Meta esvaziados, sessoes de producao revogadas, estados OAuth removidos, credenciais IA desabilitadas/invalidadas e usuarios administrativos originais desativados. Workflow do n8n desativado e webhooks locais removidos antes de iniciar o n8n.
- Configuracoes locais geradas com novas senhas/chaves locais, autenticacao habilitada, enqueue/insights/multi-publish desabilitados e webhook de publicacao apontando para destino local inoperante. Nenhuma credencial de producao foi incorporada aos arquivos .env locais.
- Login do n8n reinicializado somente localmente para permitir cadastro de usuario de testes. Dados do workflow permanecem no PostgreSQL; filesystem/config original do n8n preservado no backup, sem reaproveitar sua chave de producao.
- API em `http://localhost:3101`, iniciada por `node scripts/dev_local_simulation.cjs`, que carrega somente app.js e nao inicia bootstrap de recuperacao, manutencao, coletores ou worker. Dashboard em `http://localhost:5181`; n8n em `http://localhost:5678`.
- Administrador `admin-local` criado apenas localmente; login, troca de senha e logout validados. Acesso atual em `backups/vps-local-20261009T005652Z/acesso-local.txt`, permissao 0600. O arquivo da simulacao de 03/10 nao corresponde ao banco atual.
- Validacoes atuais: oito APIs retornaram HTTP 200 (health, usuario, posts, dashboard, overview, capabilities, modelos e usuarios); dashboard/readiness n8n HTTP 200; build TypeScript/Vite aprovado; consultas de banco e integridade aprovadas. Lint preexistente continua pendente.
- VPS permaneceu operacional: nenhum restart, importacao, migration ou alteracao das configuracoes de producao. Somente leitura/backups, incluindo arquivo temporario de snapshot Redis.
- Proximo passo: testar visualmente as telas com admin-local. Usar o launcher de simulacao, manter worker desligado e nao ativar workflows importados. Para midias reais/previews, criar arquivos locais de teste; posts historicos possuem apenas apontamentos.

### Proxima evolucao planejada para 2026-10-09: Testers DM

- Usuario decidiu retomar amanha, priorizando Testers DM. Roteiro em `project-docs/retomada-2026-10-09.md`.
- Defeito de autenticacao confirmado no cliente Axios do Inbox: nao configura cookies nem CSRF, diferentemente dos helpers compartilhados. Requisicoes locais: GET sem cookie 401; GET com admin 200 e duas conversas; POST vazio com cookie sem CSRF 403; POST vazio com cookie/CSRF 400 de validacao. Nenhuma DM enviada e nenhuma chamada Meta executada.
- Outras verificacoes para a proxima sessao: falha do typing indicator bloqueia envio principal; listagem de testers inclui todas as conversas; revisar webhook, atualizacao de conversas e SSE. Diagnostico externo de token/permissoes/endpoint Meta permanece pendente, sem causa de producao confirmada.
- Corrigir e testar primeiro cookies/CSRF localmente; seguir com cliente Meta simulado e validacao de permissoes. Teste real na VPS requer alvo e autorizacao explicita. Tokens locais devem continuar removidos.
- Pendencias secundarias: validacao visual das telas, lint preexistente, revisao dos artefatos locais antes de commit e documento multi-posts ausente. Nenhuma correcao funcional do Inbox aplicada hoje.

## TAG de retomada: RETOMADA-2026-10-03

Data local: 2026-10-03 (America/Sao_Paulo). Esta TAG resume o último estado confirmado; registros anteriores abaixo são históricos.

- Projeto oficial: `/home/harlem/projetos/auto-reels-n8n`.
- Commit publicado na main e implantado na VPS: `cecd3d686b46e21f1853d5734f6e9c471f09260e`.
- Execução de deploy: https://github.com/harlemsilvas/auto-reels-n8n/actions/runs/37169476403 — concluída com sucesso.
- Backend atualizado e reiniciado via PM2; API retornou HTTP 200 e `ok=true` em três verificações posteriores. Dashboard respondeu HTTP 200.
- Health check imediato da Action recebeu 502 durante o reinício; as verificações posteriores passaram. O workflow atualmente tolera falhas no health check; seu sucesso sozinho não comprova a saúde da API.
- Dashboard não republicado; migrations não executadas na VPS. Migration 012 aplicada e validada somente no banco local de simulação.
- Local: migrations 006–012 aplicadas, 23 posts preservados; worker não iniciado e flags de enqueue, insights e multi-publish desativadas. Mídias permanecem como apontamentos, conforme decisão do usuário.
- Pasta `auto-reels-n8n-orig` removida após verificar ausência de mounts Docker e preservar arquivo completo em `backups/orig-removido-20261003/auto-reels-n8n-orig.tar.gz` (permissão 0600, ignorado pelo Git).
- Relatório do deploy: `backups/deploy-20261004T0155Z/RELATORIO.md`.
- Na próxima retomada: informar esta TAG, o último commit implantado e as validações acima; conferir Git e saúde atual antes de afirmar que os serviços continuam disponíveis. Não aplicar migration 012 na VPS sem verificar necessidade no schema real.

## Objetivo

Este documento é o ponto de retomada para sessões do Codex no VS Code e no
desktop. Antes de alterar o projeto, ler este arquivo e
`docs/0006-mult-posts.md`.

O objetivo atual é evoluir o SocialBot para publicações Instagram de múltiplos
tipos sem quebrar o fluxo existente de Reels.

## Repositório e execução

Local atual de desenvolvimento: `/home/harlem/projetos/auto-reels-n8n`.
Os caminhos Windows/WSL abaixo são registros do ambiente anterior.


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

## Retomada em 2026-08-13 — verificação real do banco local

A checagem pendente das fases 1 e 2 foi executada hoje diretamente no
PostgreSQL local, sem alterar dados nem schema, usando o script:

- `backend/sql/006-mult-posts-phase-1-2-verify.sql`

### Ambiente confirmado na verificação

- Container `socialbot_postgres` ativo no Docker local.
- PostgreSQL publicado em `127.0.0.1:55532`.
- Banco acessado: `n8n`.
- Usuário acessado: `n8n`.
- Versão retornada: PostgreSQL `15.18`.

### Resultado da verificação

- `posts` contém as colunas `publish_type`, `media_type`,
  `carousel_children`, `cover_image_filename` e `publish_options`.
- `post_media_items` existe com a estrutura esperada das fases 1 e 2.
- Constraints de domínio e integridade estão presentes e validadas.
- Índices `idx_posts_publish_type`, `idx_post_media_items_post_id`,
  `idx_post_media_items_workspace_id` e
  `uq_post_media_items_post_sort_active` estão presentes.
- Não há `posts` com `publish_type` nulo.
- Não há `posts` com `publish_type` inválido.
- Não há itens órfãos em `post_media_items`.
- Não há divergência de `workspace_id` entre `posts` e `post_media_items`.

### Contagens observadas em 2026-08-13

- `posts_total = 19`
- `reel_posts = 5`
- `media_items_total = 28`

### Decisão após a verificação

- As fases 1 e 2 estão efetivamente aplicadas no banco local atual.
- Não é necessário reaplicar a migration localmente neste ambiente.
- Para VPS, continuar tratando a migration como etapa separada, com backup,
  inspeção do banco real e execução idempotente.

## Retomada em 2026-08-13 — README alinhado ao estado real do sistema

O `README.md` foi revisado para servir melhor como apresentação pública e
portfolio técnico do repositório.

### Ajustes realizados

- descrição atualizada do escopo full stack do projeto;
- stack real do backend e dashboard refletida no documento;
- arquitetura do repositório corrigida para a estrutura atual;
- funcionalidades existentes expostas com mais precisão:
  - autenticação administrativa;
  - permissões;
  - inbox;
  - métricas;
  - templates de mídia;
  - credenciais de IA;
  - worker;
  - publicações multi-tipo;
- status do fluxo legado de Reels e da feature flag
  `MULTI_PUBLISH_ENABLED` documentados de forma explícita;
- remoção de seções vagas ou imprecisas que não representavam mais o sistema.

### Validação

- `git diff --check -- README.md CODEX_CONTINUITY.md`

### Observação

- O README agora está mais fiel ao sistema real para uso no GitHub, mas ainda
  pode receber screenshots finais quando o usuário quiser publicar uma versão
  visual do portfolio.

### Refinamento posterior no mesmo dia

- O `README.md` foi reescrito novamente com foco mais forte em recrutador.
- A abertura passou a enfatizar proposta de valor, escopo full stack e
  responsabilidades de engenharia.
- O texto agora destaca impacto, decisoes arquiteturais e competencias
  demonstradas, reduzindo o tom de inventario tecnico cru.

## Retomada em 2026-08-13 — alinhamento de instrucoes do agente

Foi revisado o arquivo `CLAUDE.md` e alinhado o bootstrap documental do
repositório.

### Ajustes realizados

- `AGENTS.md` agora exige leitura completa de `CLAUDE.md` antes do trabalho.
- `CLAUDE.md` foi ajustado para refletir este projeto, removendo referencia
  indevida a "sistema financeiro".
- A secao de banco em `CLAUDE.md` deixou de conflitar com o uso atual do
  schema `public`.
- Foram reforcadas em `CLAUDE.md` as regras locais deste projeto:
  - preservar o fluxo de Reels;
  - manter o endpoint legado de upload;
  - separar ambiente local e VPS;
  - nao inferir mudancas de infra na VPS.

### Estado no Git

- `AGENTS.md` ficou modificado.
- `CLAUDE.md` permanece como arquivo novo nao rastreado no worktree local.

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

#### UX guiada na tela de modelos

Em 2026-07-13 foi iniciada a melhoria de usabilidade da página `/modelos`:

- barra superior com fases clicáveis: Buscar, Conferir modelo, Mídias, Textos e
  Criar post;
- clique em "Abrir" passa a selecionar o modelo e rolar para a seção de
  detalhes;
- clique em "Revisar" rola para o formulário de revisão da variação;
- seções principais receberam cabeçalhos com fase, descrição curta e cor
  lateral;
- botões de próximo passo foram adicionados em detalhes, mídias e textos.

Validação executada:

- `npm run build` no dashboard via WSL.

Essa mudança é somente frontend/CSS. Não altera banco, backend, worker ou n8n.

#### GitHub Actions para deploy controlado

Em 2026-07-13 foi criado o primeiro workflow manual de deploy da VPS:

- arquivo:
  `.github/workflows/deploy-vps.yml`;
- acionamento:
  somente `workflow_dispatch` pelo GitHub Actions;
- não executa deploy automático a cada `git push`;
- opções manuais:
  `deploy_dashboard`, `restart_backend`, `run_migrations` e `migration_set`;
- migrations suportadas:
  `009`, `010` ou `009_010`;
- quando `run_migrations=true`, executa backup PostgreSQL antes das migrations
  via `scripts/backup_postgres_db.sh`;
- deploy do dashboard usa o script existente
  `scripts/deploy_frontend_hostinger.sh`;
- restart do backend usa `pm2 restart socialbot-backend` e `pm2 save`.

Secrets necessários no GitHub Actions:

- `VPS_HOST`;
- `VPS_USER`;
- `VPS_SSH_KEY`;
- `VPS_PORT`.

Documento de apoio criado:

- `project-docs/deploy/003-github-actions-deploy-vps.md`.

Observação operacional: o workflow usa `sudo -n` ao publicar o dashboard. Se o
usuário da VPS exigir senha interativa para `sudo`, essa etapa falhará com
segurança. Ajustar sudoers/NOPASSWD somente com cuidado e autorização explícita.

Atualização em 2026-07-14: a Action foi ajustada para executar
`./deploy_frontend_hostinger.sh` como usuário `socialbot`, sem `sudo` antes do
script. O próprio script mantém os `sudo` internos apenas para `mkdir`, `rsync`,
`chown`, `nginx -t` e `systemctl reload nginx`. Também foi removida a checagem
direta de leitura do arquivo em `/etc/nginx/sites-enabled`, pois o usuário
`socialbot` não tem permissão de listagem/leitura nesse diretório; a validação
real fica a cargo de `sudo nginx -t`, que já funciona na VPS.

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

## 2026-07-14 — Credenciais de IA / Gemini preparadas

Foi iniciada a fase de cofre de credenciais de IA para suportar Gemini sem expor chaves no repositório ou no dashboard.

Arquivos adicionados/preparados:

- `backend/sql/011-ai-provider-credentials.sql`
- `backend/sql/011-ai-provider-credentials-verify.sql`
- `backend/src/modules/ai-credentials/ai-credentials.crypto.js`
- `backend/src/modules/ai-credentials/ai-credentials.service.js`
- `backend/src/modules/ai-credentials/ai-credentials.routes.js`
- `dashboard/src/modules/ai-credentials/services/aiCredentials.service.ts`
- `dashboard/src/modules/ai-credentials/pages/AiCredentialsPage.tsx`
- `project-docs/features/003-credenciais-ia-gemini.md`

Alterações:

- nova rota `/api/ai/credentials`;
- novas permissões `ai_credentials.view` e `ai_credentials.manage`;
- nova página `/ia/credenciais` no dashboard;
- chaves Gemini salvas com AES-256-GCM usando `AI_CREDENTIALS_ENCRYPTION_KEY`;
- respostas da API retornam apenas `apiKeyHint`, nunca a chave completa;
- schema inicial e workflow de deploy preparados para a migration 011.

Validações executadas:

- `node --check` nos arquivos backend alterados;
- `npm run build` no dashboard.

Pendente para teste local/VPS:

1. gerar e configurar `AI_CREDENTIALS_ENCRYPTION_KEY` no `.env` do ambiente;
2. aplicar `backend/sql/011-ai-provider-credentials.sql`;
3. reiniciar backend;
4. acessar `/ia/credenciais` com usuário admin;
5. cadastrar chave de teste Gemini pela UI.

Não foram alterados worker, n8n, portas, PM2, Nginx ou fluxo de Reels.

## 2026-07-14 — Integração real Gemini no gerador de modelos

O botão de geração de variações em `/modelos` foi conectado ao Gemini real usando credenciais cadastradas em `/ia/credenciais`.

Arquivos alterados/adicionados:

- `backend/src/modules/media-templates/gemini-text-generator.js`
- `backend/src/modules/media-templates/media-templates.service.js`
- `backend/src/modules/ai-credentials/ai-credentials.service.js`
- `dashboard/src/modules/media-templates/pages/MediaTemplatesPage.tsx`
- `project-docs/features/003-credenciais-ia-gemini.md`

Comportamento:

- seleciona credencial ativa da tarefa `media_templates_text`;
- chama Gemini via REST `generateContent`;
- exige JSON com `title`, `caption`, `hashtags` e `cta`;
- cria variação com status `generated`;
- salva prompt e resposta bruta em `prompt_sent` e `ai_response`;
- registra eventos de uso em `ai_provider_usage_events`;
- marca credencial como `limited` em 429 e `expired` em 401/403/404;
- tenta outra credencial ativa quando a falha for limitação/expiração;
- não aprova nem publica automaticamente.

Validação local:

- sintaxe backend validada com `node --check`;
- build do dashboard validado com `npm run build`;
- conectividade WSL com Gemini validada;
- chamada sem chave retornou 403 esperado;
- listagem de modelos com a chave local retornou modelos disponíveis;
- chamadas com `gemini-2.0-flash` e `gemini-2.0-flash-lite` retornaram 429 de quota zero, indicando chave reconhecida mas sem quota disponível no projeto atual.

Pendente:

- testar geração bem-sucedida com chave/projeto com quota disponível;
- opcionalmente criar endpoint de teste de credencial/modelo na tela `/ia/credenciais`.

## 2026-07-15 — Uso recente da TAG em Modelos

Como retomada das fases pendentes após decidir deixar API/modelo local para etapa posterior, a geração de texto na tela de modelos foi ajustada para modo local por padrão:

- `generateTextVariantDraft` agora gera local direto quando recebe `generationMode = 'local'` ou `useLocalFallback = true`;
- a tela `/modelos` envia `generationMode: 'local'` no botão de geração;
- o botão voltou a informar `Gerar sugestão local`;
- a integração Gemini permanece preparada para uso futuro, mas não bloqueia o fluxo atual.

Foi adicionada melhoria da Fase E dos modelos:

- `getTemplate(..., { includeDetails: true })` retorna `recentPosts`;
- a tela `/modelos` exibe `Uso recente da TAG` com posts criados por aquele modelo;
- não houve alteração de schema, worker, n8n, portas ou publicação.

Validações executadas:

- `node --check` em `backend/src/modules/media-templates/media-templates.service.js`;
- `npm run build` no dashboard;
- `git diff --check`.

Tentativa de teste direto via WSL com `getTemplate` ficou bloqueada por `ECONNREFUSED 127.0.0.1:55532`, indicando indisponibilidade momentânea da conexão local com PostgreSQL a partir do WSL. Não foi feita alteração de porta.

Próximo passo recomendado:

1. testar visualmente `/modelos` com backend local ativo;
2. criar/abrir um modelo que já tenha posts por TAG;
3. confirmar a tabela `Uso recente da TAG`;
4. seguir para refinamento de permissões granulares ou provider local de IA quando for a prioridade.

### Validação local de uso por TAG em 2026-07-15

O usuário criou uma nova postagem local a partir de modelo/TAG e a checagem no PostgreSQL confirmou:

- post `c42ac3be-85ee-4eb3-b147-c52c4c573436`;
- título `Pastilha PTZ231GT`;
- `publish_type = feed_image`;
- `status = scheduled`;
- agendamento `2026-07-15 23:00:00-03`;
- TAG `potenza-231gt`;
- modelo `ptz231gt`;
- criador `Administrador`;
- 1 mídia vinculada.

Isso valida a nova seção `Uso recente da TAG` e a vinculação `posts.media_template_id` para pelo menos um fluxo real local. A migration `011` também foi verificada no banco local com `011-ai-provider-credentials-verify.sql`.

### Ajuste de modelo Gemini funcional em 2026-07-15

Após teste mínimo com a chave salva no cofre de credenciais IA, a API Gemini
respondeu `OK` usando o modelo `gemini-flash-lite-latest`. Os modelos
`gemini-2.0-flash` e `gemini-2.0-flash-lite` retornaram `429 RESOURCE_EXHAUSTED`
com quota free tier zerada no projeto, apesar de a chave autenticar e listar
modelos com sucesso.

Foi ajustada a lista de modelos em `backend/src/modules/ai-credentials/ai-credentials.service.js`
para incluir `gemini-flash-lite-latest` como opção recomendada. O formulário
`/ia/credenciais` também passou a usar esse modelo como default para novas
credenciais. Nenhum segredo foi registrado no repositório.

### Teste real de geração Gemini em 2026-07-15

A credencial local ativa da tarefa `media_templates_text` foi ajustada para o
modelo `gemini-flash-lite-latest`, preservando a chave criptografada e sem
registrar segredo em arquivo versionado.

Foi executado teste real de criação de variação de texto por Gemini no modelo
`ptz231gt` (`tag = potenza-231gt`). Resultado:

- variação criada com status `generated`;
- `hasAiResponse = true`;
- título gerado: `Pastilha de Freio Potenza GT Forza PTZ231GT`;
- hashtags retornadas pela IA;
- nenhuma postagem foi criada;
- nenhuma publicação externa foi disparada.

A primeira tentativa direta sem objeto `req` HTTP chegou a criar resposta da IA,
mas falhou no audit log por falta de `req.ip`. A segunda tentativa usou um
`req` falso mínimo e confirmou o fluxo.

Também foi aumentado `maxOutputTokens` do gerador Gemini de `1200` para `2400`
para reduzir risco de JSON truncado em legendas maiores, e a tela `/modelos`
passou a exibir dois caminhos explícitos:

- `Gerar sugestão local`;
- `Gerar com Gemini`.

O botão `Gerar com Gemini` não usa fallback local, para que erros de chave,
quota ou modelo apareçam claramente durante validação.

### Melhoria de orientação da tela `/modelos` em 2026-07-15

A tela de modelos recebeu uma camada de orientação para reduzir dúvidas no
preenchimento:

- guia rápido no topo explicando o fluxo: criar/abrir TAG, preencher ficha,
  adicionar mídias, gerar/aprovar texto e criar postagem;
- botão `Sugerir preenchimento` no formulário de novo modelo, com exemplos
  editáveis para TAG, descrição, público, claims, CTA, hashtags e observações;
- explicações curtas abaixo dos campos principais;
- bloco de ajuda na fase de textos;
- botão `Sugerir preenchimento do texto`, que preenche tom, objetivo, título,
  legenda, hashtags e CTA com base no modelo selecionado;
- correção de artefato visual literal `` `n `` que aparecia na seção de detalhes.

Esses recursos não salvam automaticamente, não chamam Gemini e não publicam. São
apenas auxiliares de preenchimento antes da revisão humana.

### Rastreabilidade de posts por modelo na agenda em 2026-07-15

Foi iniciada a fase de rastreabilidade operacional dos posts criados por
modelo/TAG, sem migration nova e sem alterar worker/publicação:

- `listPosts()` passou a retornar, quando houver origem por modelo:
  - `mediaTemplateId`;
  - `mediaTemplateTextVariantId`;
  - `mediaTemplateTag`;
  - `mediaTemplateName`;
  - `mediaTemplateTextVariantTitle`;
  - `mediaTemplateTextVariantStatus`.
- a página `/agendamentos` passou a mostrar uma coluna `Origem`;
- posts vindos de modelo aparecem como `TAG <tag>` com detalhes do modelo e
  variação de texto;
- posts legados/upload manual aparecem como `Upload/manual`;
- o card de última publicação real também mostra a origem quando houver modelo.

Validações executadas:

- `node --check` em `backend/src/modules/posts/providers/db-posts.provider.js`;
- `npm run build` no dashboard;
- `git diff --check`;
- teste direto local de `listPosts({ limit: 20 })`, confirmando exemplos com
  tags como `potenza-xt-evolution`, `potenza-231gt` e `potenza-605xt`.

Próximo passo recomendado: testar visualmente `/agendamentos` com posts
criados pela TAG na VPS e, em seguida, evoluir os detalhes/ações da seção
`Uso recente da TAG` dentro de `/modelos`.

### Validação VPS e evolução de `Uso recente da TAG` em 2026-07-16

Após a publicação real programada por modelo/TAG, a VPS foi verificada de forma
somente leitura:

- commit em produção: `81c041b feat: exibe origem por modelo nos agendamentos`;
- backend `socialbot-backend` online no PM2;
- worker `socialbot-worker` online no PM2;
- API `https://api.hrmmotos.com.br/api/health` retornou `{"ok":true}`.

Posts por modelo confirmados na VPS:

- `acf4d308-8549-435f-9968-5a017f65ee43`
  - título: `🚀 Dê um Upgrade na sua Pilotagem com a Potenza XT Evolution!`;
  - `publish_type = feed_carousel`;
  - status `published`;
  - retry `0`;
  - `scheduled_at = 2026-07-16 08:01:00-03`;
  - `published_at = 2026-07-16 08:01:45.766-03`;
  - `meta_container_id = 18547214059078109`;
  - `meta_media_id = 17871746001553033`;
  - TAG `potenza-campanha-380xt`;
  - modelo `Potenza - 380XT`;
  - variação `Potenza 380XT: Tecnologia e Performance para sua Honda`.

Eventos do post agendado confirmados:

- `created`;
- `processing_started`;
- `queued`;
- `publisher_completed`;
- `published`.

Também havia post por modelo publicado em `2026-07-15 22:04:48.642-03` com
evento posterior de `metrics_collected`.

Como continuação, a seção `/modelos > Uso recente da TAG` foi enriquecida sem
alterar schema, worker ou publicação:

- backend `listTemplateRecentPosts()` agora retorna `retryCount`,
  `errorMessage`, `updatedAt`, `metaContainerId`, `metaMediaId`,
  `mediaTemplateTextVariantId` e `mediaTemplateTextVariantTitle`;
- dashboard mostra na tabela:
  - texto/variação usada;
  - data de publicação;
  - IDs Meta resumidos;
  - retry/erro quando houver.

Validações locais executadas:

- `node --check backend/src/modules/media-templates/media-templates.service.js`;
- `npm run build` no dashboard;
- `git diff --check`;
- consulta local de `getTemplate(..., { includeDetails: true })` confirmando
  os novos campos em `recentPosts`.

Validação visual posterior:

- o usuário confirmou que o post local `a99999bc` aparece corretamente como
  recente no modelo/TAG `potenza-231gt`;
- foi adicionado na tabela `Uso recente da TAG` o campo `Ações`, com atalhos
  para abrir `Detalhes` do post e voltar para `/agendamentos`;
- `npm run build` no dashboard e `git diff --check` passaram após essa melhoria.

### Script local WSL para subir backend/dashboard em background

Foi criado `scripts/dev_wsl_background.sh` para facilitar testes locais no WSL
sem alterar configuração da VPS:

- `bash scripts/dev_wsl_background.sh start` sobe backend com `npm run dev` e
  dashboard com `npm run dev -- --host 0.0.0.0 --strictPort`;
- `bash scripts/dev_wsl_background.sh start --with-worker` também sobe o worker
  local com `npm run worker`;
- `status`, `logs`, `restart` e `stop` auxiliam operação local;
- PIDs e logs ficam em `.dev-run/`, que é artefato local de execução.

Validações:

- `chmod +x scripts/dev_wsl_background.sh`;
- `bash -n scripts/dev_wsl_background.sh`;
- `bash scripts/dev_wsl_background.sh status`.

Observação posterior: o Vite pode subir em outra porta quando `5181` está
ocupada. O script foi ajustado para usar `--strictPort`, evitando que o
dashboard suba silenciosamente em `5182` enquanto o usuário testa uma instância
antiga em `5181`.

Observação posterior em 2026-07-16: o script agora prepara as portas locais
antes de subir backend/dashboard. Ao executar `start`, ele encerra processos
registrados em `.dev-run/`, limpa processos órfãos conhecidos do projeto,
libera as portas `3101` e `5181` com `fuser` ou `lsof` quando disponíveis e
inicia os serviços em sessão própria para permitir parada por grupo de
processos. Isso evita instâncias antigas do Vite/backend ocupando as portas e
servindo bundle antigo. Esta regra é apenas para o ambiente local WSL; não deve
ser copiada como alteração de PM2/portas na VPS.

### Detalhes genéricos de post em 2026-07-16

A página histórica `/reels/:id` foi evoluída para funcionar como uma tela
genérica de detalhes do post, mantendo a rota antiga por compatibilidade:

- textos da UI agora falam em `Post`, não apenas `Reel`;
- o backend `getPostDetail()` passou a retornar dados genéricos:
  - `title`;
  - `publishType`;
  - `mediaType`;
  - `scheduledAt`, `createdAt`, `updatedAt`;
  - `retryCount`, `errorMessage`;
  - `metaContainerId`;
  - `mediaFile`, `mediaItemsCount`;
  - origem por modelo/TAG e variação de texto.
- a tela mostra tipo de publicação, origem, agendamento, criação/atualização,
  retry/erro, IDs Meta, conta e mídia principal;
- foram adicionados atalhos para histórico, agendamentos e modelos.

Validações locais:

- `node --check backend/src/modules/metrics/metrics.service.js`;
- `npm run build` no dashboard;
- `git diff --check`;
- chamada direta de `getPostDetail()` para o post local `a99999bc`, confirmando
  `feed_image`, TAG `potenza-231gt`, modelo `ptz231gt`, variação vinculada,
  mídia principal e eventos.

### Agendamento guiado na criação por TAG em 2026-07-16

A criação de postagem pela TAG em `/modelos` deixou de usar um campo único
`datetime-local` e passou a seguir o mesmo padrão da página de upload:

- campo separado para `Dia do agendamento`;
- seleção de `Horário fixo`;
- horários carregados de `/api/internal/scheduler/slots`;
- fallback local para horários padrão se a API de horários não responder;
- validação impedindo criar post com apenas data ou apenas horário;
- mensagem clara para postagem sem data: entra na fila quando criada pela TAG.

Também foi adicionado um atalho `Criar pela TAG` na página de agendamentos,
apontando para `/modelos`, para conectar melhor o fluxo de agenda com a criação
por modelo/TAG.

Validação local:

- `npm run build` no dashboard.


## Migração local em 2026-10-02

- Clone atualizado de `harlemsilvas/auto-reels-n8n`, branch `main`, criado em
  `/home/harlem/projetos/auto-reels-n8n`.
- Origem preservada em `/mnt/dados-docker/projetos/auto-reels-n8n`.
- Base Git: `796c43437ab16b839ab6b5964bd30509eb6ed6ad`.
- Arquivos exclusivos de documentação, configuração e mídia copiados com
  verificação SHA-256; arquivos do GitHub não foram sobrescritos.
- 54 versões locais correspondem a blobs históricos do Git.
- Duas versões locais divergentes preservadas para revisão:
  `dashboard/src/modules/dashboard/hooks/useDashboardData.ts` e
  `dashboard/src/modules/dashboard/services/dashboard.service.ts`.
  Elas usam overview operacional, enquanto a versão atual usa fila e top posts;
  sua incorporação exige decisão funcional e revisão conjunta de tipos e página.
- Nove chats `auto-reels-n8n 01` a `09` associados ao novo caminho.
- PostgreSQL, Redis e n8n permanecem na origem; dados persistidos não foram
  copiados nem migrations aplicadas. Validar backup lógico e ambiente antes
  de migrar serviços. Configurações .env foram preservadas, mas ainda devem
  ser revisadas para hosts, URLs, caminhos e variáveis requeridas pelo código atual.
- node_modules e builds antigos não foram reutilizados.
- Nenhum serviço/worker iniciado, postagem disparada ou alteração aplicada na VPS.
- Documento `docs/0006-mult-posts.md` não foi encontrado no Git nem na origem.

### Validação da migração

- Dependências de backend e dashboard instaladas com `npm ci`.
- Sintaxe dos 97 arquivos JavaScript de backend/src e backend/scripts aprovada.
- `npm run build --prefix dashboard` aprovado (TypeScript e Vite).
- `git diff --check` aprovado; única alteração rastreada: este documento.
- Instalação reportou 9 alertas de dependências no backend (7 high) e 11
  no dashboard (8 high); revisão de dependências pendente, sem correção
  automática ou alteração dos lockfiles durante a migração.
- Extensão nativa opcional msgpackr-extract teve script de instalação bloqueado
  pela política npm; validar sua necessidade ao testar as filas localmente.
- Relatório e versões preservadas:
  `/home/harlem/projetos/historico_codex/migracao-auto-reels/20261003T012851Z`.


## Docker local restaurado em 2026-10-02

- Daemon ativo; Docker Engine 29.8.2 e Compose 5.5.1.
- Falhas identificadas: .env ausente, mounts de dados ausentes na nova pasta
  e backup SQL da migração contendo erro de pg_dump.
- PostgreSQL e chave/config n8n recuperados de cópias da origem preservada;
  Redis restaurado do RDB de 30/09/2026.
- PostgreSQL 15.18 e Redis 7 saudáveis; n8n 2.20.9 acessível em localhost:5678,
  com healthz/readiness HTTP 200. Portas locais PG 55432 e Redis 56379.
- Criado .env local e override não versionado; Compose compartilhado intacto.
- Dump PostgreSQL válido criado antes de iniciar n8n, com catálogo/hash verificados.
- Banco: 23 posts e um workflow v3 (Safe); dois registros Redis.
- Dados PostgreSQL antigos de junho: migrations e contrato n8n v4 ainda precisam
  revisão antes de executar o backend/worker atuais.
- Nenhum backend, coletor ou worker foi iniciado; nada aplicado na VPS.
- Relatório detalhado: `backups/docker-restauracao-20261003T013912Z/RESTAURACAO.md`.


## Validação de Docker e chaves locais em 2026-10-03

- .env completo incorporado pelo usuário foi comparado ao .env.old e backend/.env.
- Corrigidas senha PostgreSQL e porta local 55432 usando configuração anteriormente
  validada, preservando o restante do arquivo e backup anterior.
- N8N_ENCRYPTION_KEY restaurada; igualdade com config persistida e container
  verificada sem revelar valores.
- AI_CREDENTIALS_ENCRYPTION_KEY validada em roundtrip AES-256-GCM; nenhuma
  credencial de provedor externo foi consultada ou alterada.
- Referências ngrok removidas do .env da raiz; WEBHOOK_URL ajustada para localhost.
- .env recebeu permissão 0600; Compose validado e autenticação PostgreSQL TCP aprovada.
- PostgreSQL e Redis saudáveis; n8n editor e readiness HTTP 200.
- Sem restart, publicação, início de backend/worker ou mudança na VPS.
- AUTO_ENQUEUE_READY_ENABLED permanece true nos arquivos existentes: revisar
  filas e posts antes de iniciar backend. INSIGHTS_JOB_ENABLED efetivo continua
  false no backend/.env, que tem precedência sobre a raiz.
- Migrations e workflow v3 versus contrato atual continuam pendentes.
- Backup: backups/env-validacao-20261004T012020Z/.env.anterior.


## Validação restante em 2026-10-03

- App Meta e dois tokens validados via consultas GET; nenhuma publicação enviada.
- Migrations 006–011 e verificadores passaram em banco isolado, inclusive segunda
  execução idempotente, preservando os 23 posts. Banco principal não alterado.
- listPosts falhou por video_filename ausente. Migration 012 e verificador
  preparados para quatro colunas legadas de mídia do bootstrap, sem backfill.
- 012 validada duas vezes na cópia; consultas posts/métricas passaram.
- 13 testes HTTP de autenticação, troca obrigatória, CSRF, posts, dashboard,
  modelos e logout passaram. Servidor, usuário/banco de teste e fila temporária removidos.
- Quatro posts queued/scheduled antigos exigem decisão antes do coletor.
- Só 2 de 23 mídias encontradas localmente; caminhos antigos inexistentes.
- Pendentes: aplicar migrations locais, preparar admin real, revisar MEDIA_ROOT,
  webhook local (backend/.env prevalece), workflow v3/v4 e credenciais Gemini.
- Sem início de backend/worker oficial e sem alterações na VPS.
- Relatório: `backups/validacao-restante-20261004T012346Z/RELATORIO.md`.


## Simulação local preparada em 2026-10-03

- Usuário confirmou uso do banco local como simulação e dispensa de copiar mídias.
- Migrations 006–012 aplicadas no banco local com backup e sete verificadores.
- 23 posts preservados, sem alterar estados queued/scheduled históricos.
- Corrigida conversão enum em recover-stuck-posts.js; resultados retrying/error
  testados com rollback. Backend real iniciou corretamente depois da correção.
- Backend local localhost:3101, dashboard localhost:5181 e n8n localhost:5678
  respondem HTTP 200. Administrador admin-local criado com senha temporária
  em arquivo 0600 no backup; troca obrigatória e logout validados.
- AUTO_ENQUEUE_READY_ENABLED, INSIGHTS_JOB_ENABLED e MULTI_PUBLISH_ENABLED
  desativados na raiz e backend. Worker não iniciado.
- MEDIA_ROOT alinhado à pasta local, sem recuperar arquivos nem mudar apontamentos
  históricos do banco. Webhook backend alinhado ao n8n local.
- Nenhuma mudança aplicada na VPS.
- Relatório: /home/harlem/projetos/auto-reels-n8n/backups/simulacao-local-20261004T013702Z/RELATORIO.md.

### Validação dos arquivos pendentes em 2026-10-03

- Migration 012 validada em banco temporário, aplicada duas vezes com sucesso; verificador rejeitou tipo incompatível.
- Recuperação de posts validada: primeira tentativa agenda retry, segunda encerra com erro e processamento recente é preservado; ROLLBACK confirmado.
- JavaScript passou em `node --check`. Banco temporário removido; nenhum commit ou push realizado nesta etapa.
