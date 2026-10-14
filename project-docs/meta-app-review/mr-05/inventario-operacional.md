# MR-05 — Inventário operacional e confirmações do responsável

Atualizado em 14/10/2026. Confirmações recebidas do usuário; inspeção VPS
somente leitura em `2026-10-14T15:36:45Z`. Sem deploy, restart, limpeza,
chmod, edição de configuração ou aplicação da migration 017.

## Confirmações recebidas

| Item | Declaração do responsável | Alcance |
| --- | --- | --- |
| Processos | Aplicação roda na VPS, sem instâncias externas. Integrações Meta e Gemini. | Não exclui outros projetos/containers na mesma VPS. |
| Cópias | Não há backups operacionais externos conhecidos. Organização do armazenamento ainda será definida na VPS. | Snapshots automáticos do provedor não foram consultados por esta inspeção. |
| Acesso | Somente administrador deve acessar backups e logs. | Diretriz de acesso; não é comprovação das permissões atuais. Root e contas técnicas precisam integrar o inventário. |
| Logs | Permanecem na VPS; não existe serviço externo de logs informado. | Arquivos locais/PM2/Docker/Nginx e execução n8n precisam ser tratados. |
| Retenção | Manter os prazos já registrados. | Confirmado explicitamente após esclarecer a referência documental. |

`informacoes-app-meta.md` não foi localizado; existe
`docs/informacoes-app-meta.txt`, sem prazos encontrados na busca. O usuário
confirmou manter a base aceita de `docs/prazo-retencao-backup-logs.md`, registrada
em [retencao-e-exclusao.md](retencao-e-exclusao.md): DMs90d, imagens30d,
logs operacionais14d, backups diários30d. Demais categorias/exceções seguem
esse registro; não usar14d para todos os registros de acesso/segurança.

O inventário local de desenvolvimento já observado tem85 arquivos e continua
separado do inventário operacional da VPS. A declaração sobre cópias externas
não elimina esses artefatos locais: classificar se algum contém dado operacional
antes de concluir que não há cópias adicionais abrangidas pela exclusão.

## Evidência técnica desta sessão

- VPS release `09a1bb996f8af842bfb940232b63996c58feaf1a` confirmada novamente.
  Migration016 presente; tabela de bloqueios017 ausente.
- PM2: `socialbot-backend` online, PID2026901, restart9, modo fork;
  `socialbot-worker` online, PID1653, restart0, modo fork. Nenhuma outra API
  SocialBot foi observada no PM2. Isso não é varredura completa de processos
  fora do PM2 nem validação de memória/cache de cada processo.
- Containers `socialbot_n8n`, `socialbot_postgres`, `socialbot_redis` em execução.
  Há containers de outros projetos na VPS; excluídos do escopo de alterações.
  Os três SocialBot usam driver `json-file`, max-size10m/max-file3.
- `/home/socialbot/backups`:46 arquivos,64.254.050 bytes;17 têm bits de acesso
  de grupo/outros. Diretório0755. Existem SQL, workflows e arquivos auxiliares
  antigos, além de dumps e releases recentes. Nada removido ou reclassificado
  automaticamente; mtime não prova criação, propósito ou elegibilidade.
- PM2: quatro logs,154.669.398 bytes. API-out153.741.503 bytes; todos os quatro
  arquivos0664, diretório0775. Não observado módulo `pm2-logrotate` na listagem
  de processos nem regra específica PM2 em `/etc/logrotate.d`.
- Nginx:225 arquivos de log na árvore, incluindo outros projetos. Regra atual
  `/etc/logrotate.d/nginx`:daily/rotate14/compress/delaycompress/notifempty,
  create0640 www-data adm. Quatorze rotações não comprovam prazo máximo14d;
  logs antigos de serviços inativos também precisam de revisão. Não alterar
  regra global para todos os sites por conta da MR-05.
- `nginx -T` não forneceu dump utilizável nesta inspeção; mapeamento exato dos
  logs/formats do SocialBot segue pendente. Nenhum conteúdo de log foi lido.
- No ambiente inspecionado de `socialbot_n8n` não estavam explícitas as opções
  de pruning/save de execuções. Isso não comprova pruning desligado: defaults,
  versão efetiva e ajustes por workflow precisam de verificação específica.
  Não foram lidos payloads/workflows/credenciais do n8n.

## Organização proposta para implementação

Manter o armazenamento na VPS conforme preferência do responsável. Começar
com diretórios restritos e rotação dos mecanismos existentes; não criar um
container coletor nesta etapa. Um coletor adicional exigiria inventário próprio
de volumes, acesso, cópias e retenção, e não resolveria sozinho logs PM2/Nginx.

| Controle | Proposta concreta | Evidência necessária para fechar |
| --- | --- | --- |
| Backups diários | Organizar sob `/home/socialbot/backups/socialbot-postgres/`, diretórios0700/arquivos0600; catálogo com criação, hash, finalidade e expiração30d. | Backup/restore verificados, dono/grupos/ACLs conferidos e expiração testada antes da primeira limpeza. |
| Releases/config/workflows | Classificar os46 arquivos existentes; aplicar a categoria correta, inclusive segredos em backups de configuração. | Inventário revisado; retenção definida por finalidade. Não apagar arquivo antigo só pelo mtime. |
| Recibos de exclusão | Área restrita separada do conjunto restaurado; checkpoint autoritativo e hash separado. | Retenção suficiente para todos os backups abrangidos e teste de reaplicação. Não expirar recibo antes da última cópia relevante. |
| PM2 | Regra específica dos quatro logs SocialBot, arquivos0600 e expiração14d; rotação com reabertura correta e limite de tamanho. | Identificar caminho do binário/usuário, validar configuração em dry-run e confirmar logs após rotação. Sem truncar154MB antes da revisão. |
| Nginx | Identificar sites/logs do SocialBot e campos mínimos; tratar logs operacionais e registros de acesso/segurança conforme categorias distintas. | Revisão dos formatos/URLs e acesso do grupo adm; não guardar query strings/capacidades desnecessárias. |
| Docker | Preservar limites existentes; definir mecanismo adicional se for necessário comprovar expiração por tempo. | Limites por tamanho não são TTL. Não editar/remover JSONs internos com ferramentas externas. |
| n8n | Conferir versão/configurações/workflows e minimização dos dados de execução antes de preparar pruning. | Verificar execuções ativas, anotadas e cópias/binários; não remover fluxo Reels ou alterar container sem plano próprio. |
| Cache | Ativar017/sweeper no deploy planejado da API única e verificar recusa de acesso + remoção local. | Evidência em produção após deploy; confirmar capacidades anteriores e demais produtores. Não ler heap contendo dados para isso. |

As documentações oficiais confirmam que Docker controla rotação por tamanho/
quantidade e não deve ter seus JSONs internos manipulados externamente:
[driver json-file](https://docs.docker.com/engine/logging/drivers/json-file/).
No n8n, pruning depende de idade/quantidade e exclui certos estados/anotações:
[dados de execução](https://docs.n8n.io/hosting/scaling/execution-data/).
Essas referências orientam o desenho, não comprovam os defaults da versão
efetivamente em execução nesta VPS.

Permissões0700/0600 reduzem acesso de outras contas, mas processos executados
com o mesmo UID e root continuam tendo acesso. "Somente admin" exige revisar
contas, grupos, sudo/Docker e ACLs; uma permissão de arquivo isolada não prova
separação do processo da API. Não foi presumido usuário humano exclusivo.

## Estado e próximo incremento

Informações do responsável e inspeção inicial registradas. Inventário operacional
não está integralmente fechado: falta classificar todas as cópias/artefatos e
verificar snapshots do provedor, contas/ACLs, logs/formats, workflows e cache
depois da ativação. Não há mais dúvida sobre os prazos básicos ou a preferência
de armazenamento; não solicitar novamente essas confirmações.

Próximo incremento técnico: preparar controles específicos de logs/backups com
base nesses caminhos reais, dry-run e validação local. Aplicação da configuração
e deploy permanecem etapas próprias. Contrato Meta e conclusão de MR-05 pendentes.
