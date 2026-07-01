# Deploy da autenticação na VPS

## Estado verificado antes do deploy

- VPS: `socialbot@187.77.61.83`;
- repositório: `/home/socialbot/apps/auto-reels-n8n`;
- branch `main`, commit observado `77fab77`;
- backend e worker online no PM2;
- PostgreSQL no container `socialbot_postgres`, banco e usuário `n8n`;
- dashboard publicado por `scripts/deploy_frontend_hostinger.sh`;
- domínio do dashboard: `https://dashboard.hrmmotos.com.br`;
- API e callback Meta: `https://api.hrmmotos.com.br`;
- nenhuma tabela `socialbot_*` existia durante a inspeção;
- variáveis `ADMIN_AUTH_*` ainda não estavam configuradas;
- alterações locais da VPS eram apenas permissões executáveis em cinco scripts;
- havia um arquivo vazio não rastreado `scripts/sql/005-atualizacao.sql`.

Não apagar, restaurar ou sobrescrever essas alterações locais por conveniência.

## Ordem obrigatória

### 1. Finalizar e publicar o código local

Antes de mexer na VPS:

```bash
cd /mnt/c/Projetos/auto-reels-n8n
git status --short
git diff --check
git diff --cached --check
git commit -m "feat: adiciona autenticação e autoria administrativa"
git push origin main
```

O arquivo `backend/exec.ps1` pertence ao usuário e não deve ser incluído sem
revisão explícita.

### 2. Atualizar o repositório da VPS

Confirmar que o pull não pretende substituir os scripts com alteração apenas de
modo:

```bash
cd /home/socialbot/apps/auto-reels-n8n
git status --short
git fetch origin main
git diff --name-only HEAD..origin/main
git pull --ff-only origin main
```

Não usar `reset --hard`, `checkout --`, limpeza de arquivos ou `stash` automático.

### 3. Backup e migrations, mantendo autenticação desligada

```bash
cd /home/socialbot/apps/auto-reels-n8n
chmod +x scripts/prepare_auth_vps.sh
./scripts/prepare_auth_vps.sh
```

O script:

1. recusa executar se `ADMIN_AUTH_ENABLED=true`;
2. cria e valida um backup custom-format do PostgreSQL;
3. aplica e verifica as migrations `007` e `008`;
4. não edita `.env`, não reinicia serviços e não ativa autenticação.

### 4. Instalar backend e manter rollout desligado

Adicionar ao `backend/.env` antes do primeiro restart:

```dotenv
ADMIN_AUTH_ENABLED=false
ADMIN_AUTH_COOKIE_NAME=socialbot_session
ADMIN_AUTH_SESSION_TTL_HOURS=12
ADMIN_AUTH_MAX_FAILED_ATTEMPTS=5
ADMIN_AUTH_LOCK_MINUTES=15
ADMIN_AUTH_COOKIE_SECURE=true
```

Preservar os valores operacionais já existentes, especialmente banco, Redis,
Meta, mídia, n8n, CORS, scheduler e portas.

```bash
cd /home/socialbot/apps/auto-reels-n8n/backend
npm ci
pm2 restart socialbot-backend --update-env
curl -fsS https://api.hrmmotos.com.br/api/health
curl -fsS https://api.hrmmotos.com.br/api/auth/status
```

Com a flag desligada, `/api/auth/status` deve informar que a autenticação não
está ativa e o painel existente deve continuar operacional.

### 5. Criar administrador inicial

Definir a senha temporária somente na sessão atual, sem gravá-la em histórico ou
arquivo. Uma opção segura é ler silenciosamente:

```bash
cd /home/socialbot/apps/auto-reels-n8n/backend
read -rsp "Senha temporária: " ADMIN_BOOTSTRAP_PASSWORD
echo
export ADMIN_BOOTSTRAP_PASSWORD
export ADMIN_BOOTSTRAP_USERNAME=admin
export ADMIN_BOOTSTRAP_DISPLAY_NAME="Administrador"
npm run create-admin
unset ADMIN_BOOTSTRAP_PASSWORD
```

O primeiro login exigirá troca de senha.

### 6. Publicar dashboard ainda com autenticação desligada

```bash
cd /home/socialbot/apps/auto-reels-n8n
sudo ./scripts/deploy_frontend_hostinger.sh
```

Testar o dashboard antes de ativar a flag.

### 7. Ativar autenticação

Alterar somente:

```dotenv
ADMIN_AUTH_ENABLED=true
ADMIN_AUTH_COOKIE_SECURE=true
```

Então:

```bash
cd /home/socialbot/apps/auto-reels-n8n/backend
pm2 restart socialbot-backend --update-env
curl -fsS https://api.hrmmotos.com.br/api/auth/status
```

No navegador:

1. entrar com o administrador temporário;
2. trocar a senha obrigatória;
3. sair e entrar novamente;
4. validar Usuários e Contas;
5. criar um operador e confirmar os bloqueios administrativos;
6. criar um post sem publicá-lo e confirmar “Criado por”;
7. validar OAuth Meta somente depois que login e CSRF estiverem estáveis.

### 8. Verificações finais

```bash
pm2 status
pm2 logs socialbot-backend --lines 100 --nostream
pm2 logs socialbot-worker --lines 50 --nostream
curl -fsS https://api.hrmmotos.com.br/api/health
curl -I https://dashboard.hrmmotos.com.br
```

Confirmar também que Reels e n8n continuam operacionais, sem disparar uma
publicação real apenas para testar autenticação.

## Retorno seguro

Se o login ou dashboard falhar, voltar somente:

```dotenv
ADMIN_AUTH_ENABLED=false
```

e reiniciar o backend com `--update-env`. Não restaurar o banco apenas para
desativar a autenticação: as migrations são aditivas e compatíveis com a flag
desligada. O backup deve ser usado somente em incidente real de schema/dados,
após diagnóstico.
