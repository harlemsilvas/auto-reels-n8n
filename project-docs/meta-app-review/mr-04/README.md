# MR-04 - Inbox e Testers PT/EN

Implementado e testado localmente em 2026-10-13, na branch
`docs/meta-app-review-i18n`. Aceite manual do usuario pendente. Publicado na VPS
em 2026-10-13 na release `f7d52a0`, sem migration nova:
[registro do deploy](../deploy-2026-10-13.md). Testes locais abaixo sao historicos.

## Entrega

- Catalogo tipado `inbox` PT/EN: busca, filtros, nao lidas, loading/vazio,
  mensagens, anexos, composer, erros, confirmacoes e comandos dos Testers DM.
- Datas via Intl no locale ativo, sem alterar timestamp/timezone/payload.
- Erros armazenados por chave, traduzidos ao renderizar. Payload bruto do
  provedor nao aparece na UI. Erro Meta numerico 200 ganha o codigo interno
  `META_MESSAGE_PERMISSION_DENIED` e resposta HTTP 403 segura; nao confirma
  acesso avancado nem substitui a analise da Meta. Entrega incerta tem prioridade
  e continua retornando 502, sem reenvio automatico.
- Hooks nao dependem do tradutor para carregar/pollar. Trocar locale nao reseta
  conversa, ledger ou rascunho e nao reconecta SSE.
- Listagem de conversas acrescenta `lastMessageKind` opcional, mantendo
  `lastMessageText`. Preview de anexo usa tipo estruturado, nao comparacao com
  texto de cliente. DMs, nomes, usernames e conteudo digitado nao sao traduzidos.
- Testers envia a mensagem padrao realmente exibida (antes enviava rascunho
  vazio). Mensagens do fluxo sao capturadas no idioma do clique; troca durante
  o envio nao muda nem repete etapas. Mutacoes simultaneas ficam bloqueadas.
- Ocultacao continua restrita ao painel Testers: confirmacao informa que o
  historico Inbox e a funcao na Meta nao sao removidos.

## Validacao executada

- `node dashboard/tests/i18n-catalogs.mjs`: paridade de chaves/variaveis,
  plural e fallback em common/auth/accounts/inbox.
- Playwright `dashboard/tests/i18n-inbox.mjs`: EN/PT desktop/390/320, conteudo
  original, previews estruturados, rascunho, erro de permissao seguro, bloqueio
  incerto, SSE sem reconexao, mensagem padrao, snapshot do fluxo, confirmacao
  de ocultacao e ausencia de overflow da pagina.
- Regressoes Playwright `inbox-reliability.mjs`, `inbox-images.mjs` e
  `inbox-send-reconciliation.mjs`: troca de conversa, respostas atrasadas,
  SSE/polling, anexos/CSRF, rejeicao, reload e reconciliacao sem duplicacoes.
- Backend `test-inbox-permission.js`: cliente com Meta simulada e registro real
  de middleware com dependencias isoladas; code 200, sanitizacao, ausencia de
  retry, HTTP 403 e prioridade 502. Nao e chamada real nem teste HTTP de rede.
- `test-inbox-reliability.js` (15 testes), `test-inbox-profiles.js` (7),
  `test-inbox-summaries.js`, `test-inbox-unread.js` e
  `test-inbox-send-attempts.js`: aprovados; testes PostgreSQL em schemas locais
  isolados removidos ao finalizar. Zero envio real para Meta.
- Build e lint Inbox/i18n aprovados. Bundle 550.72 kB / gzip 166.36 kB;
  aviso preexistente acima de 500 kB mantido. Capturas EN desktop e mobile
  inspecionadas; tabela Testers usa rolagem interna no mobile.

## Como validar manualmente

API de simulacao local reiniciada pelo launcher protegido em 3101, sem jobs ou
worker. Dashboard local em 5181:

1. Abrir http://localhost:5181/inbox e selecionar English.
2. Conferir filtros, datas, mensagens/anexos e estados vazios/erro.
3. Escrever um rascunho e alternar PT/EN: o texto deve permanecer original.
4. Abrir http://localhost:5181/inbox/testers-dm e conferir botoes/confirmacoes.

No ambiente local protegido, credenciais reais de publicacao permanecem ausentes;
testes automatizados interceptam APIs. Nao usar estas instrucoes para disparar
DM real sem autorizacao/configuracao apropriada.

## Limites e proximos passos

- Ledger de texto 015 preservado; nao foi acrescentado ledger duravel de imagens
  nem nova recuperacao persistente de fluxos na pagina Testers.
- Permissoes/roles/scopes/host Graph existentes preservados. A resposta segura
  nao resolve acesso avancado pendente da Meta.
- OAuth real, selecao multipagina e ambiente limitado do analista seguem abertos
  no MR-03. Riscos de webhook e decisoes de retencao/exclusao seguem no MR-01/05.
- MR-05 exige politica aprovada pelo dono e implementacao verificavel de exclusao
  e seguranca; nao inventar prazos. MR-06 traduz os demais modulos incrementalmente.
- MR-07 somente apos aceite e autorizacao explicita de deploy/submissao.
