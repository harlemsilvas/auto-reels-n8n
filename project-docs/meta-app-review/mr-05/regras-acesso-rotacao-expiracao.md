# MR-05 — Regras preparadas de acesso, rotação e expiração

Preparado em14/10/2026. Regra logrotate e planejador validados; configuração
não instalada e nenhum arquivo real removido, chmod/restart/reload/cron/deploy
executado. Migration017 continua ausente na VPS conforme inspeção anterior.

## Artefatos concretos

- [socialbot-pm2.logrotate](config/socialbot-pm2.logrotate): exatamente os quatro
  logs PM2 SocialBot, daily/maxsize20M/rotate14/maxage14, compress/delaycompress,
  dateext, novos logs0600 e reabertura com `pm2 reloadLogs` sob socialbot.
  Sem copytruncate, globs globais, Nginx ou JSONs internos Docker.
- [access-policy.json](config/access-policy.json): proposta0700 para diretórios
  de backups/PM2 e0600 para os quatro arquivos PM2; apply=false. Arquivos de
  backup exigem revisão individual de dono/propósito/ACL, sem chmod recursivo.
- `scripts/retention_plan.py`: relatório somente leitura, sem modo apply,
  unlink/chmod/rotação/serviços. Caminhos no relatório são hashes; o catálogo
  restrito é necessário para correlacionar itens durante revisão.
- [retention-catalog.example.json](config/retention-catalog.example.json): exemplo
  protegido por hold e sem evidências; não é catálogo real de arquivos elegíveis.

## Critérios do planejador

Backups só recebem `review_expiry` após30dias quando o operador classificou
explicitamente como backup diário, confirmou criação com timezone, hold=false,
referência de restore e SHA256 que corresponde aos bytes atuais. Isso é uma
seleção para revisão, não comprovação automática de que a referência de restore
é suficiente. Propósito/criação não são inferidos de mtime/extensão. Recibos de
exclusão ficam protegidos, sem prazo arbitrário que permita perder a proteção
das cópias ainda existentes. Releases/config/workflows não seguem30dias por
analogia; permanecem protegidos até classificação.

Logs ativos nunca são candidatos por idade do mtime. Somente arquivos rotados
com nome específico SocialBot, categoria operacional e instante de rotação UTC
conferido podem receber revisão de expiração14dias. Registros de segurança e
outros projetos não são classificados automaticamente. Nomes dateext usam o
relógio do servidor; timezone/criação precisam de evidência antes de conversão.

Symlinks/entradas especiais são protegidos e não percorridos. Paths fora da raiz,
`..`, duplicados, datas futuras e manifestos inválidos são rejeitados. Relatório
marca revisão de permissões e entradas ausentes do catálogo, mas não prova
owner/grupos/ACLs. Inspeção não é atômica; qualquer execução futura deve
revalidar identidade, hash, escopo e referências antes de remover.

Antes de futura limpeza: preservar capacidade de restore e última cópia útil,
fechar inventário de todas as cópias/holds/recibos e validar evidências do catálogo.
O planejador não calcula sozinho a dependência entre todas as cópias nem
garante uma última cópia restaurável; por isso não possui executor de remoção.

## Validação desta sessão

Caminhos VPS confirmados somente leitura: `/usr/bin/pm2`, `/usr/bin/node`,
`/usr/sbin/logrotate`, `/usr/sbin/runuser`. Socialbot UID/GID1010, grupos
socialbot/sudo/users/docker. Isso reforça que bits0700/0600 não garantem
isolamento de root/processos do mesmo UID ou membros com poderes administrativos.

`logrotate --debug --state /dev/null` validou a regra em arquivo temporário0600,
removido ao final. Leitura direta por stdin foi ignorada pelo logrotate; não
foi contada como validação. O teste corrigido reconheceu os quatro arquivos,
simulou rotação de API-out por tamanho e criação0600. Nenhum log/state foi
alterado; o postrotate apenas apareceu na simulação, sem execução. Portanto,
reabertura com PM2 ainda não foi comprovada em runtime.

A referência oficial de [logrotate](https://github.com/logrotate/logrotate/blob/main/logrotate.8.in)
confirma que debug não modifica logs/state; também documenta que maxage é
avaliado durante rotação. A regra não garante limpeza de arquivos parados
nem um teto20MB permanente: maxsize é checado quando o scheduler invoca a
ferramenta. A primeira rotação também não minimiza conteúdo histórico no
arquivo de154MB. Clock, agendamento e arquivos anteriores exigem tratamento
próprio antes de declarar TTL14dias cumprido.

Planejador executado somente leitura na VPS em14/10 às13:22 America/Sao_Paulo
(`2026-10-14T16:22:24Z`), sem catálogo classificado:63entradas(46arquivos e
17diretórios),46arquivos protegidos, zero revisões de expiração.24entradas
exigem revisão de bits de acesso, além da raiz. Nenhum conteúdo de backup foi
lido nessa execução sem catálogo; somente metadados. Relatório resumido
registrado aqui; nenhum catálogo de produção foi criado/aprovado.

Dois testes locais com diretório temporário passaram: backup no limite30dias,
hold/hash divergente/recibo/symlink/path inválido, saída sem nomes/conteúdo,
logs ativos/outro projeto preservados e rotação conferida no limite14dias.
Teste verifica arquivos ainda presentes após o relatório. Sem dados reais.

## Uso somente relatório

```bash
python3 scripts/test_retention_plan.py
python3 scripts/retention_plan.py --root /caminho/local/backup --kind backups
python3 scripts/retention_plan.py --root /caminho/local/backup --kind backups --catalog /caminho/restrito/catalogo.json
python3 scripts/retention_plan.py --root /caminho/local/pm2 --kind pm2 --catalog /caminho/restrito/catalogo-logs.json
```

Para armazenar catálogo/relatório futuro, usar diretório0700/arquivo0600. Não
incluir catálogo de produção no Git. Catálogo é atestação operacional confiável,
não parser de instruções da Meta. A regra de logrotate só deve ser instalada
em etapa autorizada, após conferir ausência de regra concorrente e o scheduler.

## Próximo incremento

Classificar as46cópias e revisar owner/ACLs/holds/restore, fechar o mapeamento
Nginx/formats e configurações/workflows n8n, preparar rotina de expiração que
revalide o plano antes de agir. Aplicação das permissões e rotação PM2 depende
de etapa própria com evidência de reabertura. Não alterar cron global, regra
Nginx global, containers ou processos dos demais projetos.
MR-05 e contrato Meta continuam abertos; sem novo deploy neste incremento.
