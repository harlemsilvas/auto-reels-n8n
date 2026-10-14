# MR-05 - Ponto de retomada

Preparado em 2026-10-13 para iniciar em uma nova sessao.
Atualizacao 2026-10-14: pacote publicado/verificado na VPS em `09a1bb9`,
migration 016, [Action/backup/verificacoes](../deploy-2026-10-14.md).
Politica e instrucoes PT/EN publicas no dominio dashboard. Demais entradas de
implementacao somente local abaixo sao historicas; executor/callback/exclusao
completa e aceite Inbox real permanecem pendentes. MR-05 nao concluido.

Status: primeiro incremento webhook implementado/testado somente localmente;
diretriz de retencao aceita, exclusao, politica e deploy pendentes. Handoff original abaixo e historico.

Diretriz aceita pelo usuario em 2026-10-13: [prazos e desenho](retencao-e-exclusao.md).
Faixas aceitas como orientacao, base tecnica proposta registrada; nenhuma rotina
de limpeza aplicada. Operadores/acessos e processo de exclusao seguem pendentes.

## Incremento local em 2026-10-13

[Pedido duravel/verificacao autenticada](pedido-duravel.md) implementado e
testado. Migration 016 aplicada somente localmente com backup; API 3101 com
health 200/privacy anonimo 401. Tarefas de banco/arquivos/cache/backups preservam
pendencias e nao concluem exclusao; sem pedido real, UI ou callback Meta.

Usuario confirmou textos PT/EN; avisos de rascunho removidos localmente, sem
publicacao. Proximo passo validado em schema descartavel:
[exclusao transacional demonstrativa](exclusao-demonstrativa.md). COMMIT/ROLLBACK,
ledger incerto, eventos mistos, compartilhamento e replay testados; nao e endpoint
nem exclusao completa (arquivos/cache/logs/backups e ingresso real pendentes).

Politica revisada e instrucoes de exclusao PT/EN preparadas localmente,
com links de idioma/login: [paginas, validacoes e gates](paginas-privacidade.md).
Textos confirmados pelo usuario; sem callback automatico ou exclusao real executada.
Publicacao autorizada e demais gates operacionais continuam pendentes.

Relatorio de candidatos preparado/executado somente localmente:
[comando, protecoes, limites e resultado](relatorio-local.md). Snapshot com cinco
mensagens antigas, ledger vazio, imagens Inbox ausentes e 191 webhooks pendentes
de revisao. Sem limpeza ou alteracao runtime; Reels/modelos preservados.

- Assinatura obrigatoria HMAC-SHA256 com `META_APP_SECRET`, comparacao constante
  e bytes originais via parser exclusivo anterior ao JSON global. Secret ausente
  retorna 503; assinatura ausente/invalida 403; JSON invalido 400. Sem bypass.
- Limite anterior 100 KiB preservado (413); Content-Encoding comprimido rejeitado
  (400), tipo diferente de application/json rejeitado (403). Erros seguros locais.
- Challenge GET preservado, sem token/challenge nos logs; configuracao ausente
  ou parametros nao escalares rejeitados. Logs do webhook nao imprimem conteudo,
  identidades, objetos de conversa ou erro externo bruto.
- `webhook_events` recebe envelope filtrado: contas cadastradas ativas e nao
  excluidas, recipient inbound/sender echo; lote misto remove eventos externos,
  campos nao tratados e metadados do envelope. `changes.messages` nas duas formas
  existentes preservado, recibos conhecidos mantidos sem criar mensagens.
- Contas desconhecidas/inativas/excluidas nao recebem persistencia. Esse filtro
  usa banco local da instalacao; nao cria isolamento por operador/workspace nem
  topologia de relay. Dataset do analista deve cadastrar somente demonstracao.
- ACK 200 continua antes do processamento; falha DB depois dele nao garante retry
  Meta nem entrega duravel. Evento filtrado e mensagem nao sao transacao unica.
  Nenhum dado historico/log/backup foi limpo e nao ha politica de retencao nova.
- Testes desta sessao: `node backend/scripts/test-instagram-webhook.js` (15/15),
  `node backend/scripts/test-webhook-security.js` (3/3), reliability (15/15), imagens
  (4/4), OAuth feedback, sintaxe JS e diff-check passaram. HTTP em loopback fora
  do sandbox autorizado; banco/Meta simulados, nenhuma DM/publicacao real.
- Documentacao [Graph Webhooks](https://developers.facebook.com/docs/graph-api/webhooks/getting-started/)
  respondeu 429. [SDK oficial Meta](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/webhooks/start/)
  consultado: confirma autenticacao POST pelo header X-Hub-Signature-256/App Secret.
  SDK arquivado de WhatsApp e evidencia do mecanismo, nao validacao completa do
  contrato Instagram atual. Entrega real do app ainda precisa verificacao autorizada.
- Sem migration, restart, commit/push/deploy ou acesso VPS. Antes de futuro deploy,
  confirmar App Secret do app assinante sem expor valor e uma entrega legitima;
  falta de configuracao bloqueara POST. Nunca usar verify token ou token PAGE como secret.
- Proximo: confirmar prazos DMs/ledger/imagens/logs/backups e operadores/acessos,
  desenhar verificacao do pedido e exclusao segura, depois politica/instrucoes PT/EN
  para aprovacao do dono. Pergunta feita nesta sessao, sem decisao presumida.

## Base confirmada

- Branch de trabalho: `docs/meta-app-review-i18n`. Ultimo commit documental
  enviado: `0216ebd`; release funcional VPS: `f7d52a0`.
- MR-02..04 publicados pelo workflow 38453215523, sem migration nova.
  [Registro verificavel do deploy](../deploy-2026-10-13.md).
- Login publico PT/EN validado em desktop/mobile. Aceite autenticado na VPS
  de Contas/Inbox pelo usuario ainda nao registrado; nao presumir esse teste.
- Schemas 014/015 preservados. Worker nao reiniciado; configuracao/portas intactas.
- Escopo: uso interno HRM/contas proprias, primeira submissao Inbox receber/
  responder DMs, ambiente separado de avaliacao ainda nao provisionado.
- Traducao dos demais modulos pertence ao MR-06; OAuth real/multipagina e
  acesso avancado Meta permanecem pendentes. Deploy nao e aprovacao Meta.

## Ler antes de implementar

1. AGENTS.md, skill auto-reels-continuity, CODEX_CONTINUITY.md e CLAUDE.md.
2. [Inventario de dados](../mr-01/inventario-dados.md) e
   [decisoes MR-01](../mr-01/README.md).
3. [Ambiente do analista](../mr-01/ambiente-analista.md),
   [plano MR-05](../02-plano-desenvolvimento.md) e
   [submissao/evidencias](../03-submissao-e-evidencias.md).
4. git status/diffs: preservar .gitignore, simulacao, override Docker e midias
   nao versionadas do usuario. Revalidar estado, nao reutilizar PIDs antigos.

## Fatos e decisoes abertas

- Responsavel declarado: HRM MOTOS PECAS E ACESSORIOS LTDA.
- exclusao@hrmmotos.com.br e alias de vendas@hrmmotos.com.br; dono atende,
  caixa operacional segundo relato. Nao houve teste de e-mail pelo agente.
- Politica existente: https://midia.hrmmotos.com.br/privacy.html, lida em
  2026-10-12; precisa incluir Inbox/ledger e atualizar identificacao/contato.
  Nao existe pagina dedicada de exclusao segundo dono. Revalidar conteudo
  publico antes de editar; nenhuma pagina remota foi alterada neste marco.
- VPS Hostinger; backups na mesma VPS. Entidade contratual/regiao, outros
  operadores e acessos ainda por confirmar. Copia local nao e rotina implementada.
- Nao ha prazo definido para DMs/imagens/logs/backups. Definir com o dono
  prazos por categoria, tratamento de copias, verificacao do solicitante,
  procedimento e responsavel pela exclusao. Nao inventar SLA ou limpeza automatica.
- Ocultar tester/desativar conta nao exclui dados. Inventario inclui webhook
  bruto, historico, ledger com texto/recibo Meta, anexos, cache, logs e backups.

## Sequencia recomendada

1. Reinspecionar localmente entrada webhook, logs e persistencia. Riscos
   registrados no MR-01: raw body/verify token em logs, assinatura POST nao
   validada no caminho inspecionado e eventos salvos antes do escopo de conta.
   Sanitizacao OAuth/Send API do MR-03/04 nao corrige estes pontos.
2. Preparar incremento local de seguranca webhook, com contrato oficial Meta
   verificado e testes de assinatura valida/invalida/ausente, corpo original,
   escopo e nao persistencia de evento rejeitado. Preservar challenge GET e
   entrega legitima; nao mudar callback de producao nem provisionar ambiente.
3. Fechar decisoes de retencao/exclusao com o dono. Desenhar operacao segura
   incluindo FKs, tentativas ativas, cache/anexos e copias, sem cascade amplo.
4. Redigir politica/instrucoes PT/EN baseadas nos controles reais, para revisao
   do responsavel. Depois implementar paginas publicas e links no login.
5. Se callback de exclusao for exigido/escolhido, verificar contrato oficial
   antes de implementar signed_request, idempotencia e status publico opaco.
   Nao criar exclusao publica por ID livre; e-mail tambem exige processo seguro.
6. Testar com dados demonstrativos, transacao/rollback quando aplicavel e
   regressoes Inbox/Reels/auth. Preparar deploy separado somente autorizado.

## Gates de conclusao

- [x] Riscos webhook reinspecionados e incremento de seguranca testado localmente.
- [ ] Responsavel aprovou retencao/exclusao e confirmou operadores/acessos.
- [ ] Politica/instrucoes PT/EN aprovadas e publicas, sem promessas inexistentes.
- [ ] Pedido de exclusao demonstrativo verificado, executado e auditado sem
  expor dados, incluindo limites de backups e tentativas em andamento.
- [ ] Controle de acesso, revogacao e armazenamento de tokens avaliados;
  nao declarar criptografia total por existir HTTPS ou AES-GCM de credenciais IA.
- [ ] Migrations necessarias idempotentes/transacionais e testadas isoladamente.
- [ ] Deploy explicitamente autorizado e verificado; evidencias atualizadas.

Nao marcar MR-01/05 ou formulario Meta como concluidos por existir este documento.

## Pedido para a nova sessao

> Retome o MR-05 lendo CODEX_CONTINUITY.md e
> project-docs/meta-app-review/mr-05/README.md. Confirme o estado do Git,
> reinspecione os riscos de webhook e comece pelo primeiro incremento local
> de seguranca com testes. Preserve a VPS e o fluxo Reels; decisoes de
> retencao/exclusao precisam ser confirmadas antes de prometer ou apagar dados.
