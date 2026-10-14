# MR-05 — Deploy de validação 017 confirmado

Concluído em 14/10/2026 às 13:39 America/Sao_Paulo. Release
`8bd6f300f1b9534d932a0ea002f3965fe46954ce`.
[Action38599832462](https://github.com/harlemsilvas/auto-reels-n8n/actions/runs/38599832462)
com sucesso, parâmetros dashboard=false/restart_backend=true/run_migrations=true/
migration_set=017. Commit publicado em main e docs/meta-app-review-i18n.

## Aplicado e verificado na VPS

- Migration017/verificador antes COMMIT, três triggers, tabelas de bloqueios,
  operações e plano de arquivos. Verificador repetido após deploy passou.
- API com leases/diário/filtro de ingresso e sweeper de cache. Teste read-only
  carregando o código da release confirmou conexão compartilhada durante lease
  com escopo artificial sem inserir dados ou chamar Meta. Não comprova delivery
  Meta nem evicção de cache de usuário real dentro do processo da API.
- API online, PID2330147, restart9→10; worker PID1653/restart0 preservado.
- Contagens após deploy iguais ao preflight:21posts,6conversas,42mensagens.
  Pedidos/bloqueios/operações/jobs de arquivos todos0. Nenhuma exclusão iniciada.
- Público: health200; GET privacy sem sessão401; POST execute-database sem
  sessão401, sem processar pedido. Não foi realizada autenticação administrativa
  real para testar executor; flagoff/503/admin/CSRF validados nos testes locais.
- `PRIVACY_EXECUTOR_ENABLED` não habilitada no arquivo ou ambiente PM2; executor
  HTTP permanece desabilitado por padrão. `.env` idêntico ao backup por comparação
  de bytes, sem conteúdo/credencial na saída.

## Backups antes da migration

| Artefato | Tamanho | Modo | SHA256 |
| --- | --- | --- | --- |
| `inbox-images-pre-deploy-20261014T163859Z/release-anterior.tar.gz` | 12857390 bytes | 0600 | `b13e1382820667413612e4ccf133b65994308d024c1e22f9c91cd619d850ff20` |
| `socialbot-postgres/deploy-20261014T163919Z/n8n_20261014_163919.dump` | 415787 bytes | 0600 | `871c2057e9e613cde5913070962bd885b89c3195b6a3fb84a62075f45a5cd172` |

Raiz `/home/socialbot/backups/`. Release/config/dependências protegidas; catálogo
do dump verificado novamente com pg_restore --list, hashes/modos conferidos.
Não foi restaurado esse dump de produção; o ciclo completo demonstrativo local
registrado no preflight não equivale a restore do banco real.

## Preservado e pendente

Dashboard não republicado; workflow/frontend/Nginx/n8n/worker/portas sem alteração
por este deploy. Arquivos locais de simulação/Docker/mídias/.gitignore e scripts
remotos sujos preservados. Regras logrotate/acesso/expiração somente versionadas,
sem instalar, aplicar chmod legado ou apagar backups/logs. O script de backup
atualizado gerou os novos arquivos com acesso restrito, sem alterar os antigos.
Migration017 não aplicada ao banco principal local nesta etapa.

Próximo aceite: validar Inbox/histórico/perfis pelo dashboard existente. Um envio
real, se necessário, depende de ação deliberada do responsável; não foi usado
como smoke test. Exclusão autenticada continua bloqueada até etapa de ativação
própria, conclusão de controles operacionais e validação do contrato Meta.
Ferramentas de reaplicação continuam restritas a banco descartável local.

MR-05 permanece aberta. Pendentes cache/capacidades em operação, classificação
de cópias/ACLs/retencão/logs, reabertura PM2 após rotação real, recibos/restore e
callback Meta. Sucesso do deploy não é aprovação da Meta nem exclusão integral.

O npm remoto repetiu quatro alertas backend (um low, um moderate e dois high),
já registrados no deploy anterior. Lockfile/dependências não foram atualizados
para corrigir esses alertas nesta publicação.

Rollback imediato antes de qualquer escopo bloqueado: release protegida anterior
e restart somente API, mantendo schema aditivo. Após uso real de bloqueios não
retornar ao código sem leases; manter proteção e preparar plano específico.
