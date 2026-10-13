# MR-05 — Relatório local de candidatos à limpeza

Preparado e executado em 2026-10-13, somente na simulação local. Não apaga,
anonimiza, compacta, revoga capacidades ou altera estados de envio.

## Executar

Na raiz do repositório:

```bash
node backend/scripts/report-retention-candidates.js
node backend/scripts/report-retention-candidates.js --save-local
node backend/scripts/test-retention-report.js
```

Sem opções, imprime JSON agregado; `--save-local` também grava arquivo novo
0600 em `.dev-run/retention-reports/`, ignorado pelo Git. Não aceita alvo remoto
ou opção de execução da limpeza. Configuração carregada do backend, sem
imprimir valores; recusa host diferente de localhost/127.0.0.1, connection
string, NODE_ENV production e diretório de imagens fora do repositório.
O runner não importa app, worker, cliente Meta ou bootstrap de manutenção.

Banco: snapshot `REPEATABLE READ READ ONLY`, timeout de consulta 15 segundos e
`ROLLBACK`. SQL retorna apenas metadados necessários; não carrega texto, URL,
token ou recibo bruto. Saída só tem contagens, datas e regras, sem IDs/caminhos.
Filesystem: somente listagem/lstat do diretório privado Inbox; não lê conteúdo,
segue symlink ou percorre subdiretórios. Falha de schema/acesso aborta o relatório,
sem preencher silenciosamente categorias inacessíveis com zero.

## Regras de proteção

- `sending`, `uncertain`, estado desconhecido, confirmação sem mensagem ligada,
  recibo divergente ou inconsistência de conversa protegem a tentativa e as
  mensagens/imagens de toda a conversa. Datas antigas não desbloqueiam envio.
- Conteúdo de mensagens: 90 dias desde criação, sem renovar pelo chat recente.
  Linha ligada a qualquer tentativa fica preservada mesmo quando o conteúdo é
  candidato à revisão. Minimização de conteúdo e remoção de linha são operações
  diferentes; payload/arquivo/resumo devem ser tratados juntos no desenho futuro.
- Ledger concluído: revisão para minimizar conteúdo após 90 dias e para remover
  linha após um ano de calendário desde `updated_at` (data conservadora; não há
  conclusão explícita para todos os estados). Tentativas protegidas ficam de fora.
- Imagem: mensagem e mtime do arquivo devem ter mais de 30 dias; qualquer
  referência por post/modelo/upload, múltiplas mensagens, ledger ou conversa
  protegida impede seleção. Referências soft-deleted continuam contando.
- Compara nomes de arquivo conservadoramente, incluindo paths de armazenamento,
  mídias legadas e capa dos posts; colisões de nome podem preservar arquivos a
  mais. Nunca seleciona arquivos de Reels/modelos/uploads.
- Arquivo sem referência pode ser imagem entregue sem persistência: sempre
  revisão manual, sem candidato automático. Entrada fora do padrão UUID JPG/PNG,
  symlink, diretório ou metadata de imagem com path também fica fora da seleção.
- FKs adicionais para mensagens/ledger bloqueiam candidatos até revisão. A FK
  conhecida `message_id → instagram_messages(id) ON DELETE SET NULL` não autoriza
  apagar mensagens ligadas: esses registros são preservados explicitamente.
- Webhooks não entram na seleção: precisam de correlação segura de dados e
  verificação do significado de `created_at` sem timezone, encontrado no banco.
- Logs, backups, cache/capacidades e resumos/perfis de conversa ficam pendentes
  de inventário próprio. Prazos no cabeçalho não significam análise dessas fontes.

Contagens se sobrepõem; não somá-las para obter total de exclusões. Não há lista
executável de IDs. O snapshot DB e inventário de arquivos não são atômicos; uma
futura rotina deve revalidar referências e bloquear envios antes de qualquer ação.
Presença de conteúdo antigo não prova que já pode ser apagado por pedido externo.

## Resultado confirmado nesta sessão

Relatório final: `2026-10-13T20:26:09.856Z` (17:26 America/Sao_Paulo).
Arquivo local `.dev-run/retention-reports/report-2026-10-13T20-26-09.856Z.json`.

| Categoria | Resultado |
| --- | --- |
| Mensagens | 5 de 5 com mais de 90 dias; 5 candidatas à revisão de conteúdo/linha |
| Ledger | 0 registros; nenhuma tentativa real ativa/incerta nesse snapshot |
| Imagens Inbox | Diretório ausente; nenhum arquivo observado ou candidato |
| Referências de mídias do produto | 74 nomes distintos preservados, não contagem de arquivos existentes |
| Webhooks | 191 registros; todos pendentes de correlação/fuso, nenhum selecionado |
| FKs extras/proteções | 0 FKs desconhecidas; 0 conversas protegidas no dataset atual |

Schema e FKs reais inspecionados em transação somente leitura. Onze testes
com fixtures passaram: estados ativos/incertos, confirmação inconsistente,
linha/arquivo ligado ao ledger, referências compartilhadas, FKs novas, datas
inválidas/limites, órfãos, symlinks e saída sem dados individuais. Sintaxe e
diff-check aprovados. A conexão local exigiu permissão fora do sandbox.

O dataset real está vazio no ledger/arquivos Inbox; as proteções nesses cenários
foram verificadas por fixtures, não por uma entrega Meta real. Nenhuma mutation
DB, migration, exclusão de mídia, restart, chamada Meta, commit/push/deploy ou
consulta VPS nesta etapa. A próxima fase é o desenho da exclusão transacional
demonstrativa, com histórico/resumos, cópias e revalidação de envios/referências.
