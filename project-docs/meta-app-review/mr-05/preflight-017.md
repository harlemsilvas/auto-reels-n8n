# MR-05 — Preflight do deploy de validação 017

14/10/2026. Release anterior VPS09a1bb9; main/localbasea6320d8.
Proposta: publicar backend e aplicar017, sem dashboard, worker, n8n, Nginx,
rotacao/logrotate, permissoes legadas, exclusao real ou callback Meta.

Executores HTTP ficam desabilitados por padrao. A flag
`PRIVACY_EXECUTOR_ENABLED=true` requer ativacao propria posterior; neste deploy
o workflow exige flag desligada. Sessao/admin/CSRF continuam obrigatorios.
Pedidos/verificacao existentes permanecem disponiveis. Leases/triggers/diario
e sweep de caches passam a operar apos migration e restart; sem escopo bloqueado,
nao ha exclusao ou bloqueio de usuario iniciado pelo deploy.

Testes atuais passaram: scope-executor, privacy-dump-restore (dados sinteticos),
deletion-requests incluindo flagoff e HTTPadmin/CSRF, ledger, unread,
reliability15, imagens5, perfis9, webhooksecurity3, retention11,
privacyrecovery e retention_plan2. Sintaxe29JavaScript/YAML/bash/diff passou.
Suites unitarias usam Meta/gate simulados; concorrencia real exercitada em
schemas locais e dump/restore em bancos descartaveis, nao no banco da VPS.

VPSreadonly:21posts,6conversas,42mensagens,0pedidos; tabela017ausente. Alteracoes
remotas em scripts/create-user.sh, publish_instagram_reel.sh,
validar_publicacao_real.sh e scripts/sql/005-atualizacao.sql preservadas.
Nenhuma Action de deploy em andamento na consulta. Nada aplicado por este
documento. Backend.env/runtime flag de exclusao e schema devem passar preflight.

Workflow preparado: backup protegido de release/config/dependencias, dump
PostgreSQL antes017, catalogo/hashes, migration/verificador antes COMMIT,
validacao obrigatoria antes restartAPI; dashboard=false. Nenhuma configuracao
de logrotate/acesso instalada automaticamente. npm remoto pode repetir alertas
ja registrados; nao atualizar dependencias automaticamente durante deploy.

Verificacao posdeploy: release/Action,017verificador, health, auth/CSRF/flagoff,
contagens preservadas, workersemrestart, backupsmodo600/catalogo/hash e env
preservado. Não enviar DM real nem executar limpeza como smoke test.

Rollback imediato antes de uso real do executor: restaurar release/config/
dependencias do backup e reiniciar somenteAPI, preservando schema017aditivo.
Se houver bloqueio real, nao retornar ao codigo que envia sem leases; congelar
operacao e elaborar rollback que mantenha o bloqueio. Não usar git reset,
restore de dump no banco principal ou apagar tabelas por conveniencia.

Resultado e SHA de publicacao devem ser registrados apos concluir a Action.
MR-05 segue aberta: contratoMeta, logs/copias/retencao e ativacao integral.
