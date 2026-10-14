# MR-05 — Reaplicação e ciclo real de dump/restore local

Implementado em 14/10/2026. Execução restrita a bancos descartáveis locais e
arquivos sintéticos. Nenhum restore, migration, exclusão ou restart do banco
principal/API/VPS; sem commit/push/deploy. Worker, n8n e Reels reais preservados.

## Reaplicação preparada

`restore-replay.js` reconstrói o pedido verificado a partir de um recibo externo,
restabelece o bloqueio e usa o executor existente para excluir os dados e
processar arquivos. Não revalida a identidade automaticamente: importa a
verificação anterior de uma fonte autoritativa confiável, conferida pelo operador.

O recibo versão 2 complementa o manifesto versão 1 do verificador. Inclui
conta/remetente, pedido/conversa, responsáveis pela criação/verificação,
método/referência/data de verificação e nomes privados de arquivos. São dados
pessoais/restritos, necessários nesta implementação para reconstruir um pedido
que não existe no backup antigo. Não contém texto DM, token ou imagem. Guardar
fora do conjunto restaurado, em arquivo 0600; definir retenção/minimização e
proteção das cópias desse recibo antes do uso operacional.

Export só aceita escopos bloqueados com pedido verificado e tarefas de banco
e arquivos concluídas. Cache/backups podem continuar pendentes; o recibo não
comprova exclusão integral. Fonte com escopo incompleto interrompe o export.
O CLI exporta em transação read-only; o checkpoint exige interromper escritores
e usar o registro autoritativo mais recente. Hash guardado separadamente detecta
alteração, mas não prova autoria ou atualidade por si só.

Reaplicação exige digest dos bytes, escopo compatível com seu hash, confirmação
explícita e operador com UUID presente no banco restaurado. A confirmação original
é preservada; a execução registra o operador de restore. Usuários ausentes no
backup, conflitos de pedido/escopo e FKs interrompem a operação; não são criados
usuários artificiais nem removidas constraints para facilitar execução.

O alvo deve ser PostgreSQL em loopback, fora de produção, banco
`mr05_restore_<32 caracteres hex>` no schema `public`; o diretório de imagens
deve ser real, sem symlink e ter o mesmo nome do banco. A CLI não é rota HTTP e
depende de acesso local autorizado às credenciais PostgreSQL. Não usar para
ativar a aplicação nem remover essas guardas para executar na VPS.

## Arquivos, falhas e limites

Uma nova cópia de arquivos possui novos inodes. No primeiro replay do recibo,
o plano do dump é reconstruído com as identidades atuais; estado antigo de
arquivo não comprova remoção na cópia restaurada. Quarentena antiga exige
revisão. Arquivos privados do recibo que reapareçam sem mensagem também entram
na revalidação de referências. Arquivo privado já ausente não é recriado.
Referências compartilhadas continuam protegendo a mídia, mesmo que tenha sido
privada na fonte original. Arquivos não conhecidos pelo recibo/escopo não são
limpos automaticamente.

O digest fica como marcador de retomada: repetir o mesmo recibo preserva os
estados de quarentena/remoção em vez de reinicializá-los. Reintrodução de conversa
após conclusão ou arquivo anteriormente removido provoca revisão; esse novo
conteúdo não é apagado silenciosamente. Recibo diferente não substitui uma
quarentena em andamento automaticamente.

Tentativas `sending`/`uncertain` e confirmação inconsistente interrompem o
executor. Não presumir que o estado antigo foi reconciliado posteriormente só
porque existe recibo. FK adicional faz rollback da remoção de dados; bloqueio
durável e preparação do pedido podem já ter sido persistidos. Escopos são
processados individualmente; falha posterior não desfaz escopos já concluídos.
Não há nova chamada Meta, liberação de reenvio nem cascade amplo.

A inspeção final exige banco sem dados do escopo/bloqueios ausentes/órfãos e sem
webhooks desconhecidos. Mesmo após sucesso, `activationAllowed` e
`deletionComplete` permanecem falsos. Cache, logs, cópias externas, recibos e
inventário de arquivos ainda exigem fechamento antes de reativação operacional.

## Evidências desta sessão

`backend/scripts/test-privacy-dump-restore.js` executou:

1. Criação de banco fonte descartável em `template0`, schema demonstrativo com
   mensagens/conversas/FKs, mídias compartilhadas e migrations 015/016/017.
2. `pg_dump -Fc --no-owner --no-privileges` real pelo container PostgreSQL local,
   antes do pedido de exclusão. Dump restrito 0600 e cópia sintética das imagens.
3. Exclusão na fonte, export do recibo externo e rejeição de recibo incompleto,
   bytes alterados ou par conta/remetente incompatível com o hash.
4. Criação de segundo banco descartável e `pg_restore --exit-on-error
   --single-transaction --no-owner --no-privileges` real. Pedido/bloqueio posterior
   ao backup estavam ausentes; dados antigos voltaram à cópia isolada.
5. Reaplicação: recusa sem confirmação e de alvo fonte; incerteza preservou
   mensagens/imagem; FK extra fez rollback. Remoção da FK/inconsistência apenas
   na fixture permitiu validar a retomada, não é procedimento operacional.
6. Exclusão somente do escopo; imagem privada removida, compartilhada preservada,
   outra conversa/mensagem e registro Reel preservados. Trigger bloqueou nova
   conversa do escopo excluído. Repetição do replay passou.
7. Webhook legado desconhecido recusou conclusão e permaneceu intacto. Arquivo
   reintroduzido após conclusão foi preservado com erro de revisão.
8. Pools fechados; bancos/dump/recibo/imagens temporários removidos pelo teste.

Isso é um ciclo completo das ferramentas de dump/restore com um banco
demonstrativo; não valida todo o bootstrap SocialBot/n8n, um dump real do usuário,
restore do sistema operacional ou recovery da VPS. Nenhum dado real foi copiado.
Teste de cache/inventário anterior passou novamente; sintaxe/diff-check validados.

## Ferramentas preparadas

O export local precisa do schema 017 na fonte; não foi executado no banco
principal, onde essa migration continua ausente. Paths dos argumentos são
relativos a `backend`, pois os scripts ajustam o cwd.

```bash
node backend/scripts/privacy-recovery.js export-receipt --output ../.dev-run/privacy-recovery/recibo-novo.json
node backend/scripts/replay-privacy-restore.js --database mr05_restore_HEX32 --media /caminho/isolado/mr05_restore_HEX32 --receipt /caminho/restrito/recibo.json --sha256 HASH_CONFERIDO --actor UUID_OPERADOR --acknowledged true
node backend/scripts/test-privacy-dump-restore.js
```

`HEX32`, hash e UUID são placeholders. A reaplicação bem-sucedida retorna 2,
indicando que ativação continua bloqueada; falhas retornam 1. Nenhum código 0
deve ser inferido como aprovação para iniciar API/worker. O teste retorna 0 ao
passar e executa seu próprio cleanup de recursos descartáveis.

Próximo fechamento: inventário de instâncias/capacidades legadas, cópias externas,
retenção/rotação de logs/backups/recibos, contrato callback Meta e preflight do
fluxo completo antes de ativação. Sem deploy autorizado neste incremento.
