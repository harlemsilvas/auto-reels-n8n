# MR-03 - Contas e feedback OAuth PT/EN

Atualizado em 2026-10-13, branch `docs/meta-app-review-i18n`.
Estado: primeiro incremento local implementado/testado, aceite manual pendente.
Publicado na VPS em 2026-10-13 na release `f7d52a0`:
[registro do deploy](../deploy-2026-10-13.md). Sem novo OAuth real nesta validacao.
MR-03 completo ainda pendente; nao confundir feedback traduzido com prontidao
do ambiente externo de avaliacao ou aprovacao de acesso avancado Meta.

## Entrega atual

- Namespace accounts PT/EN: todos os titulos, labels, botoes, tooltips, estados
  vazios/loading, status ativo/inativo, avisos, erros e confirmacao de importacao.
  Datas de expiracao usam Intl do locale, sem alterar valor ISO enviado a API.
- Conectar com Meta e acao principal; tabela operacional e manutencao tecnica
  separada em details inicialmente fechado. Formulario/token manual e importacao
  continuam disponiveis aos usuarios com acesso atual, nao sao novos controles
  de autorizacao. Token digitado mascarado por padrao, sem preencher token salvo.
- Switch de ativo/inativo, refresh e gravacoes protegidos contra duplicacao
  de operacao em andamento. Falha preserva formulario/status real da lista;
  sucesso limpa token digitado. Mensagens do servidor nao exibidas como texto cru.
- OAuth devolve accountId da conta salva junto de connected=true. Pagina confere
  ID na listagem autenticada e estado ativo antes de mostrar nome/Instagram ID.
  Conta ausente/inativa/lista indisponivel ou retorno legado sem ID mostram aviso,
  nao sucesso confirmado. Nao verifica grants, validade do token ou acesso avancado.
- Params connected/error/accountId consumidos com replace, mantendo parametros
  nao relacionados. Apenas erros de whitelist traduzidos; query antiga/arbitraria
  vira fallback generico, sem refletir payload/token no DOM.
- Backend usa codigos seguros no redirect e logs de falha OAuth, sem mensagem
  bruta do provedor. Config Meta incompleta encerra antes de criar state/redirect
  externo; callback recusa state/code estruturados em vez de strings.
- Preservados Facebook Login, scopes, host/versao, sessao/admin, CSRF, state
  associado a usuario/sessao, prazo e consumo unico; nenhuma migration nova.

## Validacao registrada em 2026-10-13

- `node backend/scripts/test-meta-oauth-feedback.js`: banco/Meta simulados,
  sucesso/ID/audit, state de outra sessao, expirado/replay/array, cancelamento,
  code ausente/array, paginas/IG ausentes, falha sanitizada/config ausente,
  HTTP anonimo 401/operator 403/admin 302. Sem chamadas reais Meta/banco.
- `node dashboard/tests/i18n-catalogs.mjs`: common/auth/accounts com paridade,
  variaveis, plural e fallback.
- `PLAYWRIGHT_MODULE=/tmp/socialbot-ui-check/node_modules/playwright node dashboard/tests/i18n-accounts.mjs`:
  desktop/390/320 PT/EN, conta conferida/retorno legado/query consumida, datas,
  formulario preservado/token mascarado, status/CSRF/importacao/confirmacao/
  falhas/lista vazia/loading reativo. APIs/dados simulados.
- Regressoes i18n-auth e inbox-durable-send passaram. Capturas EN desktop e
  mobile 320 inspecionadas, sem sobreposicao/overflow da pagina; tabela larga
  tem rolagem interna, inclusive acesso a colunas fora da primeira tela mobile.
- Build, lint focado, sintaxe JS e diff-check aprovados. Bundle 543.74 kB /
  164.28 kB gzip, com aviso Vite acima de 500 kB ainda presente.
- Playwright temporario perdido apos reinicio do ambiente foi reinstalado em
  /tmp, sem alterar dependencias do projeto. Vite 5181 e API protegida 3101
  retomados localmente; health API 200, anonimo OAuth 401. Jobs/worker/Meta
  permanecem desativados na simulacao; sem acessar .env/dados reais pelo agente.

## Limites restantes

- OAuth ainda escolhe primeira pagina elegivel; selecao/paginacao multipagina
  nao implementadas. Restringir demonstracao a conta apropriada ate essa entrega.
- Campos extras de identidade no upsert, verificacao de grants/revogacao e
  erros mais especificos de permissao continuam para incremento proprio.
- Isolamento/topologia/conta do analista e seguranca webhook/retencao do MR-01
  continuam pendentes. Nao dar administrador global de producao ao analista.
- OAuth real deve ser validado somente com autorizacao em ambiente adequado.
  A simulacao local deliberadamente nao possui secret Meta e retorna aviso de
  configuracao ausente ao conectar. Interface Meta externa nao e traduzida por
  nossos catalogos; video EN requer conferir sua lingua ou fornecer legendas.
- Nenhum deploy, commit/push, schema, porta/proxy VPS, worker ou Reels alterado.
  Ultima release VPS registrada continua 47a5dac/015.

## Proximo aceite e sequencia

1. Acessar http://localhost:5181/contas e conferir EN/PT, status, datas e manutencao.
2. Na simulacao, Conectar com Meta deve retornar aviso traduzido de configuracao
   ausente, sem conectar conta real. Nao importar/gravar credenciais reais para teste.
3. Proximo incremento: MR-04 Inbox/Testers DM, incluindo botoes, avisos, datas,
   erros seguros e confirmacoes, com validacao em EN e regressao PT.

- [x] Contas PT/EN e callback seguro/conferido implementados localmente.
- [x] Testes simulados, build/lint/sintaxe e capturas desktop/mobile.
- [ ] Aceite manual do usuario para Contas.
- [ ] Escolha segura/paginacao entre varias Paginas e metadata necessaria.
- [ ] Revisao de grants/reconexao e ambiente limitado do analista.
- [ ] OAuth real autorizado, depois deploy explicitamente solicitado.
