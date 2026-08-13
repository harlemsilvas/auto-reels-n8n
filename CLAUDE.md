# CLAUDE.md

Use este arquivo junto com `AGENTS.md`. O `AGENTS.md` manda no projeto; este
arquivo reforca o comportamento esperado do agente.

## Principio central

Trabalhe como engenheiro agentic disciplinado: especifique, implemente pouco,
revise o diff, valide e explique. Nao pratique vibe coding cego em sistema
com fluxo real de publicacao, banco, worker e integracoes externas.

## 1. Pense antes de codar

Antes de implementar:

- Leia o contexto obrigatorio definido em `AGENTS.md`.
- Leia `CODEX_CONTINUITY.md` e, quando aplicavel, `docs/0006-mult-posts.md`.
- Entenda o problema antes de tocar arquivos.
- Declare premissas quando elas afetarem a solucao.
- Se houver risco funcional, de banco, deploy ou seguranca, pare e explique.
- Prefira perguntas curtas e objetivas quando a decisao nao puder ser inferida.

## 2. Simplicidade primeiro

- Faca a menor alteracao correta.
- Nao crie abstracoes especulativas.
- Nao adicione flexibilidade nao solicitada.
- Nao reescreva modulos inteiros se uma correcao local resolve.
- Preserve padroes existentes do projeto.

## 3. Mudancas cirurgicas

- Toque apenas nos arquivos necessarios.
- Nao limpe codigo antigo que nao faz parte da tarefa.
- Nao altere formatacao de arquivos inteiros sem motivo.
- Remova apenas codigo morto criado pela sua propria mudanca.
- Cada linha alterada deve conseguir responder: "por que isto era necessario?"

## 4. Validacao orientada a objetivo

Para bugs:

- Reproduza ou identifique a causa.
- Corrija.
- Rode teste focado.
- Rode validacao maior apenas quando o pacote justificar.

Para features:

- Defina comportamento esperado.
- Implemente em passos pequenos.
- Teste contratos, UI e API quando aplicavel.
- Atualize documentacao viva.

## 5. Banco e migrations

- Migrations ja aplicadas sao imutaveis.
- Correcoes estruturais devem ser novas migrations.
- Nao mudar convencoes de schema sem confirmar o impacto; o projeto atual usa
  objetos existentes no schema `public`.
- Validar scripts SQL quando houver mudanca de banco.
- Nunca aplicar mudancas diretas em producao sem plano claro.

## 5.1 Regras deste projeto

- Nao quebrar o fluxo atual de Reels.
- Preservar o endpoint legado `/api/media/upload` para Reel ate migracao
  explicitamente planejada.
- Separar rigorosamente ambiente local e VPS.
- Nao copiar portas locais para a VPS.
- Nao alterar portas, proxy, firewall, Docker, PM2, n8n, hosts ou URLs da VPS
  sem solicitacao explicita e inspecao real do ambiente.

## 6. Comunicacao

- Seja claro, curto e especifico.
- Explique o que foi feito, o que foi validado e o que falta.
- Nao esconda incertezas.
- Nao prometa que algo foi testado se nao foi.
- Quando houver risco, diga antes de executar.

## 7. Commit e deploy

- Antes de commit, conferir `git status`.
- Commitar apenas arquivos relacionados.
- Nao incluir credenciais, `.env`, `.venv`, `.vscode` ou artefatos locais.
- Push e deploy dependem de autorizacao do usuario.
- Apos deploy, registrar SHA/release quando relevante.
