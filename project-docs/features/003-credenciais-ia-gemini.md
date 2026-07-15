# 003 — Credenciais de IA / Gemini

Atualizado em: 2026-07-14

## Objetivo

Criar uma área administrativa para cadastrar chaves de provedores de IA, começando pelo Google Gemini, sem expor segredos no dashboard, nas respostas da API ou no repositório.

Esta fase prepara o cofre e a rotação por tarefa. A geração automática real com Gemini será ligada em uma fase posterior ao fluxo de modelos de mídia por TAG.

## O que foi implementado

### Banco

Migration:

- `backend/sql/011-ai-provider-credentials.sql`
- `backend/sql/011-ai-provider-credentials-verify.sql`

Tabelas:

- `ai_provider_credentials`
- `ai_provider_usage_events`

Campos principais de `ai_provider_credentials`:

- `provider`: inicialmente `gemini`
- `label`: nome amigável da chave
- `task`: uso da credencial, como `media_templates_text`
- `model`: modelo selecionado
- `encrypted_api_key`: segredo criptografado
- `api_key_hint`: final mascarado para conferência
- `status`: `active`, `limited`, `expired` ou `disabled`
- `priority`: ordem de seleção automática
- `last_used_at`, `last_error_at`, `last_error_code`, `last_error_message`

### Segurança

A chave informada no dashboard é criptografada com AES-256-GCM antes de ser salva.

O backend exige a variável:

```bash
AI_CREDENTIALS_ENCRYPTION_KEY=
```

Gerar uma chave segura:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Nunca commitar o valor real. Configurar apenas em `.env` local, `.env` da VPS ou secret operacional equivalente.

### Backend

Novo módulo:

- `backend/src/modules/ai-credentials/ai-credentials.crypto.js`
- `backend/src/modules/ai-credentials/ai-credentials.service.js`
- `backend/src/modules/ai-credentials/ai-credentials.routes.js`

Rotas:

- `GET /api/ai/credentials/options`
- `GET /api/ai/credentials`
- `GET /api/ai/credentials/:id`
- `POST /api/ai/credentials`
- `PATCH /api/ai/credentials/:id`
- `DELETE /api/ai/credentials/:id`

Permissões:

- `ai_credentials.view`
- `ai_credentials.manage`

Admin recebe todas as permissões. Operador não gerencia credenciais nesta fase.

### Dashboard

Nova página:

- `/ia/credenciais`

Funcionalidades:

- cadastrar chave Gemini usando campo `password`;
- selecionar tarefa;
- selecionar modelo;
- informar prioridade;
- informar limites opcionais;
- listar chaves com hint mascarado;
- alterar status/prioridade/modelo/tarefa;
- desativar credencial.

A chave completa não é exibida depois do salvamento.

## Modelos iniciais no listbox

A lista foi deixada configurável no backend. Opções iniciais:

- `gemini-3.5-flash`
- `gemini-3.1-flash-lite`
- `gemini-2.5-flash`
- `gemini-2.5-flash-lite`
- `gemini-2.5-pro`
- `gemini-flash-lite-latest`
- `gemini-flash-latest`
- `gemini-pro-latest`

Em 2026-07-15, o teste mínimo local com a chave salva no cofre retornou `OK`
com `gemini-flash-lite-latest`. Alguns modelos versionados retornaram `429`
por quota zero no projeto, apesar da chave estar válida. Esses nomes devem ser
revisados periodicamente na documentação oficial do Gemini antes de uso em
produção.

## Rotação planejada

A função `selectCredential` já seleciona uma credencial ativa por:

1. workspace;
2. provider;
3. tarefa;
4. status `active`;
5. menor prioridade;
6. menor histórico recente de erro.

Na próxima fase, o gerador real do Gemini deve:

1. chamar `selectCredential({ provider: 'gemini', task: 'media_templates_text' })`;
2. tentar gerar o texto;
3. se receber rate limit/expiração/autorização inválida, marcar a credencial como `limited` ou `expired`;
4. tentar a próxima credencial ativa;
5. registrar evento em `ai_provider_usage_events`;
6. manter revisão humana obrigatória antes de publicar.

## Aplicação local — PowerShell

Na raiz do projeto:

```powershell
cd C:\Projetos\auto-reels-n8n
```

Gerar chave de criptografia:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Adicionar no `.env` local:

```text
AI_CREDENTIALS_ENCRYPTION_KEY=COLE_A_CHAVE_GERADA_AQUI
```

Aplicar migration local:

```powershell
docker exec -i socialbot_postgres psql -U n8n -d n8n < .\backend\sql\011-ai-provider-credentials.sql
```

Validar:

```powershell
docker exec -i socialbot_postgres psql -U n8n -d n8n < .\backend\sql\011-ai-provider-credentials-verify.sql
```

Reiniciar backend local depois de alterar `.env`.

## Deploy VPS

Antes da migration na VPS:

1. gerar `AI_CREDENTIALS_ENCRYPTION_KEY`;
2. adicionar no `.env` do backend na VPS;
3. fazer backup PostgreSQL;
4. aplicar a migration 011;
5. reiniciar backend;
6. publicar dashboard.

Comandos manuais na VPS, se não usar GitHub Actions:

```bash
cd /home/socialbot/apps/auto-reels-n8n
git pull --ff-only origin main
bash scripts/backup_postgres_db.sh
cd backend
docker exec -i socialbot_postgres psql -U n8n -d n8n < sql/011-ai-provider-credentials.sql
docker exec -i socialbot_postgres psql -U n8n -d n8n < sql/011-ai-provider-credentials-verify.sql
pm2 restart socialbot-backend
cd ../scripts
./deploy_frontend_hostinger.sh
```

Pelo GitHub Actions, selecionar:

- `run_migrations=true`
- `migration_set=011`
- `restart_backend=true`
- `deploy_dashboard=true`

## Observações importantes

- Não colar chaves reais no chat, em docs ou commits.
- Não salvar chaves reais em `.env.example`.
- A integração real com Gemini ainda não publica e ainda não substitui a geração local de teste.
- Reels e fluxo n8n não foram alterados.
