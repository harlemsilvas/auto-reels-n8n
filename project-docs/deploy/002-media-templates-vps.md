# Deploy VPS — Feature 002: Modelos de mídias com IA e TAG

Data de preparo: 2026-07-13

Este roteiro prepara a subida da Feature 002 para a VPS. Ele cobre schema,
backend CRUD, interface inicial de modelos, upload de mídias para modelos,
criação de postagem por TAG e geração local de sugestão de texto em modo teste.
Não altera portas, Nginx, Docker, n8n, domínio, `.env` ou configuração de proxy
da VPS.

## Escopo deste deploy

Inclui:

- migration `010-media-templates.sql`;
- verificador `010-media-templates-verify.sql`;
- tabelas `media_templates`, `media_template_items` e
  `media_template_text_variants`;
- colunas opcionais em `posts`: `media_template_id` e
  `media_template_text_variant_id`;
- permissões backend `media_templates.*`;
- rotas backend:
  - `/api/media/templates`;
  - `/api/media-templates` como alias temporário.
- página `/modelos` no dashboard;
- upload de mídias do modelo;
- criação de postagem pela TAG;
- geração local de variação de texto em modo teste.

Não inclui ainda:

- geração real por provedor externo de IA;
- alterações no worker;
- alterações no n8n.

## Pré-condição importante

A VPS pode ainda não ter recebido a evolução anterior de título/fila imediata
da migration `009`. Antes de aplicar a `010`, valide/aplique a `009`.

Ordem segura:

1. backup PostgreSQL;
2. `git pull`;
3. aplicar/verificar `009`, se ainda não estiver aplicada;
4. aplicar/verificar `010`;
5. reiniciar backend;
6. validar API;
7. executar deploy do dashboard.

## 1. Entrar na VPS e ir para o projeto

```bash
ssh socialbot@187.77.61.83
cd /home/socialbot/apps/auto-reels-n8n
```

## 2. Preflight sem alteração de estado

```bash
git status --short
git rev-parse --short HEAD
pm2 status
docker ps --format '{{.Names}}'
```

Confirme que existem os containers esperados, especialmente
`socialbot_postgres`.

## 3. Backup do banco antes de migrations

Opção recomendada, usando o script versionado:

```bash
cd /home/socialbot/apps/auto-reels-n8n
bash scripts/backup_postgres_db.sh
```

O script cria um backup em formato `custom` do `pg_dump` e grava metadados em:

```text
$HOME/backups/socialbot-postgres/
```

Para gerar SQL puro em vez de `dump`:

```bash
cd /home/socialbot/apps/auto-reels-n8n
SOCIALBOT_BACKUP_FORMAT=plain bash scripts/backup_postgres_db.sh
```

Variáveis suportadas pelo script:

```bash
SOCIALBOT_PG_CONTAINER=socialbot_postgres
SOCIALBOT_PG_DATABASE=n8n
SOCIALBOT_PG_USER=n8n
SOCIALBOT_BACKUP_DIR="$HOME/backups/socialbot-postgres"
SOCIALBOT_BACKUP_FORMAT=custom
```

Para backup do Docker local no Windows/PowerShell, usar o script separado:

```powershell
cd C:\Projetos\auto-reels-n8n
powershell -ExecutionPolicy Bypass -File .\scripts\backup_postgres_db_local.ps1
```

Esse script local salva por padrão em:

```text
C:\Projetos\auto-reels-n8n\backups\postgres-local
```

Opção manual equivalente, caso o script ainda não esteja no servidor:

Backup em SQL puro, fácil de inspecionar e restaurar manualmente:

```bash
BACKUP_DIR="$HOME/backups/socialbot/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
docker exec socialbot_postgres pg_dump -U n8n -d n8n > "$BACKUP_DIR/n8n-before-feature-002.sql"
ls -lh "$BACKUP_DIR"
```

Opcional: registrar o commit atual junto do backup.

```bash
git rev-parse HEAD > "$BACKUP_DIR/git-head-before-feature-002.txt"
```

## 4. Atualizar código

```bash
cd /home/socialbot/apps/auto-reels-n8n
git pull --ff-only origin main
git status --short
```

Se o `git pull --ff-only` falhar, pare e resolva antes de prosseguir. Não usar
`reset --hard` sem decisão explícita.

## 5. Aplicar/validar migration 009 primeiro

Se a VPS ainda não recebeu a evolução de título/fila imediata, aplicar:

```bash
cd /home/socialbot/apps/auto-reels-n8n/backend
docker exec -i socialbot_postgres psql -U n8n -d n8n < sql/009-post-title-immediate-queue.sql
docker exec -i socialbot_postgres psql -U n8n -d n8n < sql/009-post-title-immediate-queue-verify.sql
```

Se a `009` já tiver sido aplicada, os scripts devem permanecer seguros pela
estratégia idempotente. Ainda assim, manter a validação.

## 6. Aplicar/validar migration 010

```bash
cd /home/socialbot/apps/auto-reels-n8n/backend
docker exec -i socialbot_postgres psql -U n8n -d n8n < sql/010-media-templates.sql
docker exec -i socialbot_postgres psql -U n8n -d n8n < sql/010-media-templates-verify.sql
```

Resultado esperado do verificador:

```text
010-media-templates ok
```

Checagem adicional:

```bash
docker exec -i socialbot_postgres psql -U n8n -d n8n -c "
SELECT 'media_templates' AS table_name, COUNT(*) FROM media_templates
UNION ALL
SELECT 'media_template_items', COUNT(*) FROM media_template_items
UNION ALL
SELECT 'media_template_text_variants', COUNT(*) FROM media_template_text_variants;
"
```

Em deploy inicial, o esperado é `0` nas três tabelas.

## 7. Validar sintaxe backend na VPS

```bash
cd /home/socialbot/apps/auto-reels-n8n/backend
node --check src/modules/media-templates/media-templates.service.js
node --check src/modules/media-templates/media-templates.routes.js
node --check src/modules/auth/permissions.service.js
node --check src/app.js
```

Não há mudança de dependência prevista. Rodar `npm ci` somente se
`package-lock.json` tiver mudado.

## 8. Reiniciar backend

```bash
pm2 restart socialbot-backend
pm2 save
pm2 logs socialbot-backend --lines 80
```

O worker e o n8n não precisam ser reiniciados para esta etapa, pois a Feature
002 ainda não altera publicação nem filas.

## 9. Validar rotas

Health geral:

```bash
curl -i https://api.hrmmotos.com.br/api/health
```

Rota nova sem sessão administrativa:

```bash
curl -i https://api.hrmmotos.com.br/api/media/templates
```

Resultado aceitável sem cookie/login:

- `401 Unauthorized` ou `403 Forbidden`: rota existe e está protegida;
- `200 OK`: rota existe e o ambiente permitiu a consulta;
- `404` ou `500`: investigar antes de seguir.

Teste autenticado deve ser feito pelo dashboard ou com cookie de sessão válido.

## 10. Dashboard

Há alteração no dashboard nesta etapa. Depois de validar backend e sessão
administrativa, executar o script já usado na VPS:

```bash
cd /home/socialbot/apps/auto-reels-n8n/scripts
sudo ./deploy_frontend_hostinger.sh
```

Depois validar:

```bash
curl -I https://dashboard.hrmmotos.com.br
```

Teste manual esperado:

1. acessar o dashboard com usuário admin;
2. abrir o menu `Modelos`;
3. listar/criar/abrir um modelo;
4. gerar uma sugestão em modo teste;
5. aprovar a variação somente após revisão;
6. criar uma postagem pela TAG sem disparar publicação automática.

## 11. Rollback seguro

Preferência em caso de problema:

1. voltar o código para o commit anterior com um revert/pull controlado;
2. reiniciar `socialbot-backend`;
3. manter a migration `010`, pois ela é aditiva e não deve quebrar o fluxo
   atual.

Restaurar backup do banco somente se houver corrupção ou erro grave confirmado.

## Próximo passo após deploy

Com a Feature 002 validada na VPS, implementar a próxima camada localmente:

1. prévia completa da postagem por TAG antes de criar;
2. edição de variações geradas pela interface;
3. permissões refinadas para operador;
4. provedor externo de IA configurável, mantendo modo teste e aprovação humana;
5. seeds oficiais opcionais, revisados antes de aplicar na VPS.
