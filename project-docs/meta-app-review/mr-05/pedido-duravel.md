# MR-05 — Pedido durável e verificação autenticada

Implementado em 2026-10-13. Migration 016 aplicada somente no banco local,
tabelas vazias. API local iniciada pelo launcher protegido. VPS não consultada
nem alterada; nenhuma solicitação real registrada ou exclusão executada.

## Contrato interno

Base `/api/internal/privacy/deletion-requests`. Exige sessão real, senha
definitiva, papel admin e CSRF nas operações POST, inclusive se a flag antiga
de autenticação administrativa estiver desativada. Operator recebe 403.
Corpos JSON têm limite 16 KiB; campos extras são rejeitados e erros são seguros.
Router é montado antes do JSON/logger global para não expor corpo ou erro bruto.

| Método e caminho | Entrada | Resultado |
| --- | --- | --- |
| POST `/` | requestId UUID e conversationId UUID | Pedido pending_verification; escopo resolvido pelo servidor |
| GET `/:id` | UUID do pedido | Estado, datas e tarefas agregadas, sem texto/IDs pessoais/manifesto |
| POST `/:id/verify` | identityReviewed e scopeReviewed true, method e reference | Registra admin/data/método/referência e quatro tarefas duráveis |
| POST `/:id/invalidate-cache` | Objeto vazio | Remove perfis/capacidades do escopo nesta instância e registra pendências |
| POST `/:id/review-backups` | inventoryReviewed e restoreSafeguardsReviewed true; inventoryReference e restoreReference | Registra revisão autenticada; não elimina cópias nem conclui tarefa |

Métodos de verificação aceitos: `instagram_confirmation`, `verified_email` e
`documented_review`. Referências são códigos internos de até 64 caracteres,
somente letras/números/ponto/hífen/underscore, não conteúdo de e-mail ou documentos.
O administrador precisa realizar a verificação de fato: o sistema registra sua
declaração autenticada, não verifica sozinho a identidade do titular.

Mesmo requestId/conversa retorna o pedido existente; outro escopo é rejeitado.
Índice único impede pedidos abertos duplicados por conta/remetente. Mudança da
identidade da conversa antes da verificação bloqueia o fluxo. Verificação e
criação das tarefas ocorrem na mesma transação. Nenhuma rota aceita estado
completed ou realiza exclusão de banco/arquivos.

## Tratamento das dependências

- **Banco:** tarefa bloqueada até executor e bloqueio durável de ingresso/envios.
  Verificar pedido não congela Inbox nem autoriza remover tentativas incertas.
- **Arquivos:** manifesto privado identifica imagens referenciadas por todas as
  conversas do escopo. Cruza mensagens externas, posts, capas, caminhos legados,
  uploads/modelos e referências soft-deleted. Compartilhadas preservadas; nomes
  inválidos/ambíguos bloqueados. Comparação por basename é conservadora. Nenhum
  arquivo é aberto, copiado ou removido aqui; inventário físico, órfãos, quarentena
  e revalidação ficam pendentes. Manifesto não é lista executável de exclusão.
- **Cache:** remove todas as credenciais/perfis da conta/remetente nesta instância.
  Resposta de consulta em voo não repovoa o cache nem retorna o perfil invalidado.
  Capacidades novas armazenam escopo; revogação não afeta outros destinatários.
  Capacidades legadas sem escopo são contadas para revisão. Tarefa fica bloqueada
  porque outras instâncias e novo ingresso podem recriar dados; não declaramos
  revogação global ou exclusão de cache definitivamente concluída.
- **Backups:** revisão registra admin, data e referências ao inventário/plano de
  restauração. Continua bloqueada até expiração/eliminação de cópias e validação
  do restore. É evidência de revisão humana, não comprovação automática de que
  todos os backups foram encontrados/apagados. Nenhum backup compartilhado é
  removido para atender um único pedido.

O retorno mantém deletionComplete false enquanto qualquer etapa faltar.
Conservação de identidade do pedido e referências é necessária ao processamento,
mas ainda exige política própria de minimização após conclusão; não instituída
retenção indefinida desses registros. Estado completed é reservado para futuro
executor, sem endpoint de conclusão nesta entrega. Ainda não há formulário/UI
de gestão nem callback público Meta/signed_request.

## Banco e validações

- Migration/verificador `016-privacy-deletion-requests*`, BEGIN/COMMIT, IF NOT
  EXISTS, FKs de operadores e tarefas sem cascade amplo, índice único parcial.
  Compatibilidade com bootstrap Inbox segue via migrations numeradas; bootstrap
  compartilhado não alterado. Nenhum dado antigo recebeu backfill.
- Schema real anterior inspecionado na etapa do relatório. Backup local antes
  de aplicar 016: `backups/privacy-requests-016-2026-10-13T22-05-12.977Z/local.dump`,
  392235 bytes, modo 0600, SHA-256
  `1c36c1745250d0b9e4f4eae7df31d4cc7e2670f10a5ea6cd19081fe08f5eea1b`.
  Identificador do servidor comparado ao container antes de pg_dump; catálogo
  pg_restore validado. Restore desse backup não testado.
- Migration testada com ROLLBACK e duas aplicações em schema temporário;
  verificador passou e foi executado antes do COMMIT no banco principal local.
  Tabelas de pedidos/tarefas estavam vazias após aplicar. Nenhum pedido real usado.
- `test-deletion-requests.js` passou: idempotência, conflito, duplicidade,
  verificação, manifesto compartilhado, persistência após recarregar módulo,
  tarefas/cache/backups pendentes e HTTP 401/403/admin/CSRF mesmo com auth flag
  false. JSON inválido retorna resposta segura. Schema de teste removido.
- Cache perfis 9/9, imagens 5/5 e reliability 15/15 passaram com Meta simulada;
  sintaxe/diff-check aprovados. Sem mensagem, imagem ou publicação real enviada.
- PID antigo da API não existia, porta 3101 livre; iniciado launcher protegido
  após checar auth ligada, DB local, credenciais Meta e jobs desligados.
  Health 200 e pedido privacy anônimo 401 confirmados. Worker não iniciado.

## Próxima etapa

Implementar executor de pedido com bloqueio durável por escopo compartilhado por
todos os produtores, tarefas de arquivos em quarentena com recuperação após falha,
reconciliação de tentativas e inventário/restore de cópias. Logs e resumos/eventos
também precisam cobertura. Este pedido é uma fundação operacional; não usar sua
verificação como prova de exclusão completa no formulário Meta.

Sem commit/push/deploy ou alterações da VPS. Para deploy futuro, 016 precisa de
backup, verificação e aplicação próprios antes de carregar as rotas; workflow
não recebeu seleção 016 nesta entrega.
