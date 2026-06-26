---
name: auto-reels-continuity
description: Retomar e conduzir com segurança o desenvolvimento do projeto SocialBot/auto-reels-n8n, especialmente a evolução multi-tipo de publicações Instagram, migrations PostgreSQL, uploads, worker, Docker local e preparação para VPS. Usar quando Codex trabalhar neste repositório, quando o usuário pedir para continuar as fases de multi-posts, diagnosticar o ambiente local, preparar migrations ou evitar perda de contexto entre sessões.
---

# Continuidade do Auto Reels

## Iniciar sempre pelo contexto versionado

1. Ler completamente `CODEX_CONTINUITY.md` na raiz do repositório.
2. Ler `docs/0006-mult-posts.md` quando o trabalho envolver publicações,
   upload, banco, worker ou frontend.
3. Executar `git status --short` e inspecionar apenas os diffs do escopo.
4. Preservar todas as alterações não relacionadas.

Se o documento de continuidade não existir ou estiver desatualizado, reconstruir
o estado pelos arquivos e atualizá-lo antes de encerrar a tarefa.

## Separar local de VPS

- Permitir ajustes de portas e hosts no ambiente local para resolver conflitos.
- Considerar o PostgreSQL local publicado em `127.0.0.1:55532`, salvo se a
  configuração real mostrar outra coisa.
- Considerar `postgres:5432` apenas para comunicação dentro da rede Docker.
- Não propagar portas locais para a VPS.
- Não alterar portas, proxy, firewall, PM2, Docker, n8n, domínios ou URLs da VPS
  sem solicitação explícita e inspeção da configuração real.
- Preparar migrations da VPS de forma idempotente e transacional.

## Preservar o fluxo de Reels

- Tratar como regra máxima: não quebrar o fluxo existente de Reels.
- Manter `/api/media/upload` como caminho legado de um arquivo MP4 até uma
  migração explicitamente planejada.
- Não alterar o worker/n8n de Reels durante fases de banco ou upload, salvo
  pedido explícito.
- Fazer alterações aditivas e manter defaults compatíveis, especialmente
  `publish_type = 'reel'`.

## Trabalhar com banco

Antes de mudar schema:

1. Inspecionar schema, constraints, índices e nulos no banco real.
2. Comparar com `postgres-init/000_socialbot_init.sql`.
3. Criar migration numerada em `backend/sql/`.
4. Usar `\set ON_ERROR_STOP on`, `BEGIN` e `COMMIT`.
5. Preferir `IF NOT EXISTS` e blocos `DO` para constraints idempotentes.
6. Criar um script de verificação correspondente.
7. Testar primeiro com `ROLLBACK` ou em banco temporário.
8. Não fazer backfill destrutivo por conveniência.

Para uploads relacionados, manter `uploads`, `posts` e `post_media_items` na
mesma transação.

## Validar em proporção ao risco

- Executar `node --check` nos arquivos JavaScript alterados.
- Executar testes de `COMMIT` e `ROLLBACK` para alterações transacionais.
- Validar bootstrap em banco temporário para mudanças no schema inicial.
- Executar `git diff --check` apenas no escopo alterado.
- Não publicar conteúdo real nem disparar worker sem autorização explícita.

## Atualizar a continuidade

Ao concluir uma etapa material:

1. Atualizar `CODEX_CONTINUITY.md` com data, alterações, validações, decisões de
   ambiente e próximo passo.
2. Não incluir segredos ou valores de `.env`.
3. Registrar claramente o que foi apenas preparado, o que foi aplicado
   localmente e o que ainda não foi aplicado na VPS.
4. Manter este `SKILL.md` procedural; colocar detalhes mutáveis no documento do
   projeto.

