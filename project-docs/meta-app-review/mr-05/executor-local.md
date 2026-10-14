# MR-05 — Bloqueio por escopo e executor local

Evolução posterior de cache e cópias em
[cache-backups-restore.md](cache-backups-restore.md). Os resultados abaixo
registram a etapa inicial do executor; não significam conclusão da MR-05.

Para o deploy de validação017, as três operações do executor HTTP exigem
também `PRIVACY_EXECUTOR_ENABLED=true`; flag ausente mantém exclusão desabilitada.
Ver [preflight-017.md](preflight-017.md). Não ativar flag como teste de deploy.

Estado em 14/10/2026: implementado e validado com PostgreSQL em schemas
temporários e arquivos de demonstração. Migration 017 não aplicada ao schema
principal local nem à VPS. API local não reiniciada nesta etapa; nenhum pedido
real executado. Sem commit, push ou deploy deste incremento.

A VPS permanece no deploy registrado de `09a1bb9`, com migration 016. Isso é
estado confirmado na etapa anterior, não uma nova inspeção da VPS.

## Operações administrativas preparadas

Base: `/api/internal/privacy/deletion-requests/:id`. Todas as operações exigem sessão,
senha definitiva, administrador, CSRF e corpo `{ "acknowledged": true }`.
O pedido deve estar `verified`, com identidade e escopo revisados.

| POST | Comportamento |
| --- | --- |
| `block-scope` | Aguarda operações do mesmo par conta/usuário e persiste bloqueio. Recusa tentativas incertas ou confirmações inconsistentes. |
| `execute-database` | Exige bloqueio; remove conversas, mensagens, ledger e diário de operações do escopo na mesma transação. Redige somente itens de webhook correlacionados ao par exato; registra plano durável de arquivos. |
| `process-files` | Revalida referências, move arquivos privados para quarentena e remove com estados retomáveis. Preserva mídia compartilhada. |

O bloqueio é permanente nesta implementação; não há endpoint de desbloqueio.
Seu hash corresponde ao par conta/usuário, sem supor equivalência entre IDs
de produtos Meta. Triggers protegem inserts/updates de conversas, mensagens e
tentativas, incluindo troca de escopo. O ingresso de webhook pela aplicação
filtra eventos bloqueados dentro de transação, preservando outros eventos do
lote. SQL administrativo direto em `webhook_events` não passa por esse filtro.

Envios de texto/imagem/quick replies, consultas de perfil e acesso às imagens
usam bloqueio compartilhado durante a operação. Repositórios reutilizam a mesma
conexão da operação; o pool normal permanece disponível fora desse contexto.
O diário registra a imagem antes da escrita em disco. Queda durante envio
mantém `sending`; resultado duvidoso mantém `uncertain`, ambos exigindo revisão.
Não há resolução automática dessas operações nem política de expurgo do novo
diário nesta etapa.

## Arquivos e recuperação

Referências de mensagens fora do escopo, posts, itens de posts, modelos e uploads
continuam protegendo o arquivo, inclusive registros soft-deleted. Comparação
por basename é conservadora. O executor não remove arquivos órfãos sem vínculo.
Arquivos ausentes, symlinks, paths inesperados e troca de inode/device exigem
revisão. A quarentena fica em `.quarantine/<pedido>/` no diretório privado Inbox.
Uma barreira curta de escrita nas tabelas de referência cobre a revalidação e a
ação em disco. Alterações externas ao filesystem devem permanecer suspensas
durante a operação; essas ferramentas não participam dos locks PostgreSQL.

Retomada cobre renomear antes de persistir `quarantined` e remover antes de
persistir `removed`. Novas referências são reavaliadas antes da remoção; um
arquivo ainda presente em quarentena pode ser restaurado ao tornar-se compartilhado.
Os locks possuem timeout e falhas não provocam repetição de envio Meta.

## Limites de conclusão e contrato Meta

Todas as respostas permanecem com `deletionComplete: false`. O pedido fica
`verified`; finalizar arquivos não finaliza o pedido. Webhooks legados sem
correlação mantêm a tarefa de banco bloqueada para revisão. Cache/capacidades
em outros processos, logs, backups, expiração das cópias, exclusão em restore,
inventário de órfãos e minimização dos identificadores do pedido/tombstone
continuam pendentes. O serviço anterior de invalidação local segue disponível.

A consulta à documentação oficial do callback em 14/10 retornou HTTP 429:
[Data Deletion Callback — Meta](https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback/).
O contrato não foi confirmado nesta sessão. Não foi criado callback público,
parser de `signed_request`, associação de ID externo ao escopo, URL de status
ou acionamento automático do executor. A página pública de exclusão continua
orientando o pedido por e-mail.

## Validações desta sessão

- Migration 017: rollback, aplicação repetida, verificador, triggers e hash.
- Executor real em schema temporário: concorrência entre lease e bloqueio,
  outros escopos livres, conexão compartilhada, saída do contexto, diário de
  imagem antes da operação e sem duplicação no envio aninhado, incerteza,
  bloqueio de escrita/reclassificação/envio, filtragem do lote de webhook,
  rollback transacional, exclusão somente do escopo e replay.
- Arquivos temporários: compartilhados preservados, substituição de inode
  recusada, recuperação após falha de rename e unlink. Backups continuam bloqueados.
- Rotas: sessão/admin/CSRF nas três operações, mesmo com flag antiga de auth
  desativada; executor substituído por stub nesse teste de middleware.
- Regressões: envio 15/15, imagens 5/5, perfis 9/9, segurança webhook 3/3,
  retenção 11/11; scripts PostgreSQL de ledger, unread, pedidos duráveis e
  demonstração de exclusão passaram. Suites unitárias de Inbox usam gate
  simulado; a concorrência real do gate foi exercitada no teste do executor.
- YAML e `bash -n` do workflow passaram. Workflow apenas preparado com opção
  017, verificador antes de COMMIT e verificação obrigatória antes de restart.

Os testes usam respostas Meta simuladas. Nenhum envio real ou limpeza do schema
principal. Para ativação futura: backup protegido, migration 017 + verificador
antes do código novo, preflight/revisão operacional e deploy próprio. Não
reiniciar a API com este código sobre schema sem 017.
