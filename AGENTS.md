# Instruções para Codex

Antes de trabalhar neste repositório:

1. Usar a skill `$auto-reels-continuity` quando estiver disponível.
2. Ler completamente `CODEX_CONTINUITY.md`.
3. Ler `docs/0006-mult-posts.md` para tarefas de publicação, upload, banco,
   worker ou frontend.
4. Executar `git status --short` e preservar alterações não relacionadas.

Regras essenciais:

- Não quebrar o fluxo atual de Reels.
- Separar rigorosamente ambiente local e VPS.
- Portas locais podem ser ajustadas para resolver conflitos.
- Não copiar portas locais para a VPS.
- Não alterar portas, proxy, firewall, Docker, PM2, n8n, hosts ou URLs da VPS
  sem solicitação explícita e inspeção da configuração real.
- Manter migrations idempotentes e transacionais.
- Atualizar `CODEX_CONTINUITY.md` após mudanças materiais, indicando o que foi
  aplicado localmente e o que ainda não foi aplicado na VPS.
- Nunca registrar tokens, senhas ou conteúdo de `.env`.
