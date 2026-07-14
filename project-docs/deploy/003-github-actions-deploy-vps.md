# Deploy controlado por GitHub Actions

Data: 2026-07-13

Foi criado um workflow manual em:

```text
.github/workflows/deploy-vps.yml
```

Ele não executa deploy automático em `git push`. O deploy precisa ser iniciado
manualmente em:

```text
GitHub → Actions → Deploy VPS → Run workflow
```

## Objetivo

Automatizar o deploy na VPS sem perder controle operacional.

O workflow conecta por SSH na VPS, atualiza o repositório com
`git pull --ff-only origin main` e, conforme as opções escolhidas, pode:

- publicar o dashboard;
- reiniciar o backend PM2;
- aplicar migrations `009`, `010` ou ambas;
- executar backup PostgreSQL antes de migrations.

## Secrets necessários no GitHub

Configurar em:

```text
GitHub → Settings → Secrets and variables → Actions → New repository secret
```

Secrets:

- `VPS_HOST`: IP ou host da VPS. Exemplo: `187.77.61.83`.
- `VPS_USER`: usuário SSH. Exemplo: `socialbot`.
- `VPS_SSH_KEY`: chave privada SSH autorizada na VPS.
- `VPS_PORT`: porta SSH. Normalmente `22`.

Não versionar chaves, senhas, tokens ou `.env`.

## Pré-condição de sudo

O deploy do dashboard chama:

```bash
sudo -n ./deploy_frontend_hostinger.sh
```

O `-n` faz o comando falhar em vez de pedir senha interativamente. Portanto, a
VPS precisa permitir que o usuário do deploy execute os comandos necessários sem
prompt de senha, ou o workflow falhará com segurança.

Se hoje o deploy manual já pede senha de `sudo`, será necessário ajustar a regra
de sudoers antes de usar a Action para publicar o dashboard. Fazer isso somente
com cuidado na VPS.

## Uso recomendado

### Deploy apenas do dashboard

Usar quando a alteração for somente frontend/CSS/docs.

Opções:

```text
deploy_dashboard = true
restart_backend = false
run_migrations = false
migration_set = none
```

### Deploy backend sem migration

Usar quando houver alteração de backend sem schema novo.

Opções:

```text
deploy_dashboard = false ou true
restart_backend = true
run_migrations = false
migration_set = none
```

### Deploy com migrations

Usar somente quando uma migration precisa ser aplicada na VPS.

Opções:

```text
deploy_dashboard = conforme necessidade
restart_backend = true
run_migrations = true
migration_set = 009, 010 ou 009_010
```

Quando `run_migrations=true`, o workflow executa antes:

```bash
bash scripts/backup_postgres_db.sh
```

## O que o workflow não faz

- Não altera portas.
- Não altera Nginx, exceto pelo script de dashboard já existente.
- Não altera Docker Compose.
- Não altera n8n.
- Não publica conteúdo no Instagram.
- Não liga feature flags.

## Validação após execução

Depois de rodar o workflow, conferir:

```bash
curl -I https://dashboard.hrmmotos.com.br
curl -I https://api.hrmmotos.com.br/api/health
```

Também conferir os logs da Action no GitHub. Em caso de falha, não repetir às
cegas: ler a etapa que falhou e corrigir a causa.
