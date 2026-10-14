# MR-05 — Cache, inventário de backups e verificação de restore

Evolução posterior: [reaplicação e ciclo real de dump/restore](reaplicacao-dump-restore.md).
Este documento registra a primeira etapa de inventário/verificação.

Estado em 14/10/2026: preparado e testado localmente. Sem deploy, restart,
ativação de collectors, aplicação da migration 017 no banco principal ou
exclusão de dados reais. A VPS não foi consultada nesta etapa.

## Cache em cada processo

`cache-sweep.js` consulta o registro durável de bloqueios a cada 30 segundos e
remove perfis e capacidades de imagem da memória desse processo. Consulta em
voo não se duplica; não imprime identificadores nem erros do provedor. Outros
escopos permanecem preservados. Acesso por capacidade bloqueada também revoga
as capacidades daquele escopo na instância que recebeu a chamada.

O sweeper foi conectado ao bootstrap `server.js`, mas esse código não foi
reiniciado nesta etapa. Cada instância com código novo deve iniciar o sweeper.
Instâncias antigas ou launchers alternativos que importem somente `app.js`
não participam automaticamente. A tarefa de cache permanece bloqueada: não há
inventário/ack de toda a frota ou tratamento de capacidades legadas sem escopo.
O controle de acesso com lease continua verificando o bloqueio no banco antes
de servir dados; indisponibilidade do banco não autoriza acesso ao cache.

## Registro externo e inspeção de banco restaurado

`privacy-recovery.js export` prepara um manifesto 0600 contendo hashes dos
escopos bloqueados e dos nomes de arquivos privados planejados, sem tokens,
texto DM, conta/remetente em claro ou nomes de arquivo em claro. Os hashes ainda
devem ser tratados como registros restritos, não como anonimização garantida.
O manifesto é separado do dump e precisa representar o registro mais recente
da fonte autoritativa. Exportar uma cópia antiga restaurada não recupera os
pedidos posteriores ao backup.

`check` exige SHA256 dos bytes do manifesto e inspeciona o banco local em
transação repeatable-read/read-only. Detecta bloqueios ausentes, conversas e
operações do escopo, mensagens/tentativas órfãs, itens de webhook do escopo e
eventos que não consegue correlacionar. Todas as contas mapeadas ao mesmo ID
Instagram são consideradas. Eventos com estruturas/metadados desconhecidos
exigem revisão. O resultado só contém contagens.

O SHA256 detecta alteração quando comparado ao hash guardado separadamente;
não autentica sozinho o autor nem prova que o manifesto é o mais recente.
O export não elimina a necessidade de interromper escritores durante o
checkpoint final. Arquivos adicionados posteriormente ao plano exigem nova
exportação. Arquivos compartilhados não entram como removíveis.

**Este incremento é um verificador, não um filtro de restauração.** Não aplica
novos bloqueios, não reaplica exclusões e não executa `pg_restore`. A inspeção
não cobre conteúdo de arquivos, caches, logs ou validade/expiração de cópias.
`databaseClear: true` indica somente que a inspeção de banco passou. A resposta
mantém `activationAllowed: false`, e o comando retorna código 2; nunca serve
como autorização para reativar a API nesta etapa. Erro de argumentos, digest,
manifesto ou schema retorna 1. Export/inventory válidos retornam 0.

## Inventário local de cópias

O modo `inventory` percorre somente um diretório local do repositório sob
`backups/` ou `.dev-run/`, sem seguir symlinks nem ler conteúdo de arquivos.
Registra hash do caminho relativo, tipo aproximado, tamanho e idade do mtime.
Idade >=30 dias é sinal para revisão, nunca ordem de remoção. Dumps, arquivos
compactados, snapshots, backups de configuração e arquivos auxiliares precisam
de classificação operacional; extensão e mtime não provam propósito/criação.
O inventário não é atômico e não cobre VPS, snapshots do provedor ou cópias externas.

Inventário real local desta sessão:
`.dev-run/privacy-recovery/inventory-2026-10-14.json`, modo 0600, 85 arquivos:
11 banco, quatro compactados, 70 outros; um sinalizado por idade e zero symlinks.
SHA256 `54f6f8eb1d2da2cc6277039ea6d0befbe64962f35e3f32ee939d42b134069a03`.
Nenhum arquivo removido. Nomes/hash por item não são lista executável.

O script existente `backup_postgres_db.sh` passou a usar umask 077 e noclobber:
novos backups/metadados ficam restritos e colisão de nome não sobrescreve cópia
anterior. Não modifica permissões de cópias já existentes. Nenhum novo backup
real foi criado ao validar essa alteração; somente `bash -n` foi executado.

## Uso preparado

Os comandos são locais, recusam produção/DB remoto/connection string e não
iniciam API, worker ou cliente Meta. O script muda cwd para `backend`; os paths
dos argumentos abaixo são relativos a esse diretório. Não sobrescreve output.

```bash
node backend/scripts/privacy-recovery.js inventory --root ../backups --output ../.dev-run/privacy-recovery/inventory-novo.json
node backend/scripts/privacy-recovery.js export --output ../.dev-run/privacy-recovery/manifesto-novo.json
node backend/scripts/privacy-recovery.js check --manifest ../.dev-run/privacy-recovery/manifesto-novo.json --sha256 HASH_GUARDADO_SEPARADAMENTE
```

Export/check exigem schema 017; esses dois modos não foram executados contra
o banco principal, onde 017 continua ausente. Não remover a guarda local para
usar na VPS. A adaptação operacional para produção exige inspeção própria.

## Evidências e próximo passo

- Teste cache: duas instâncias simuladas, remoção por escopo, preservação de
  outros escopos, consulta única em voo e falha de banco. Teste de inventário:
  arquivos temporários, symlink não seguido, saída sem nome/conteúdo e nenhum delete.
- PostgreSQL real isolado: manifesto de bloqueio, estado antigo com conteúdo,
  ausência de bloqueio, estado limpo após executor e webhook legado desconhecido.
  Cópia de tabelas demonstrativas em segundo schema preservou dados antigos;
  verificação após exclusão no primeiro schema recusou liberar a cópia antiga.
  Isso não é restore de dump por `pg_restore` nem teste de recovery da VPS.
- Regressões perfis 9/9 e imagens 5/5 passaram; gate/executor/migration 017
  passaram novamente em schemas temporários. Digest incorreto foi recusado
  pelo CLI antes de conectar ao banco. Nenhuma chamada Meta real.

Próximo incremento: reaplicação autenticada dos bloqueios/exclusões na cópia
isolada, tratamento de arquivos e teste completo de dump/restore antes de
ativação. Fechar inventário de instâncias/cópias externas, retenção e rotação
de logs/backups, exceções e minimização do registro externo. Tarefas cache e
backups e `deletionComplete` continuam pendentes; contrato callback Meta segue
pendente conforme registro anterior, sem nova consulta nesta etapa.
