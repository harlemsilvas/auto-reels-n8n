# MR-01 - Escopo, dados e acesso do analista

Iniciado em 2026-10-12, branch `docs/meta-app-review-i18n`.
Status: levantamento tecnico, D01-D03 e identidade/contato declarados confirmados;
politica publica lida, atendimento e hospedagem/backups declarados pelo dono.
Contratos/localizacao, retencao/processo de exclusao, URL de avaliacao
e validacoes externas pendentes. MR-01 ainda nao concluido.

## Base e limites desta etapa

- Release VPS registrada `47a5dac`, migration 015; nao consultada novamente aqui.
- Somente codigo/documentacao local. Nenhuma leitura de .env, senha/token ou
  mensagens reais; sem criar usuario, conta Meta, ambiente ou alterar scopes.
- Inicio do MR-01 autorizado; isso nao autoriza deployment/provisionamento nem
  responder/enviar formularios da Meta em nome do responsavel.

## Registro de decisoes

| ID | Decisao | Proposta | Estado |
| --- | --- | --- | --- |
| D01 | Publico do app | Uso interno da HRM e contas proprias | Confirmado pelo dono em 2026-10-12 |
| D02 | Primeira submissao | Inbox: receber e responder DMs, com dependencias comprovadas | Confirmado pelo dono em 2026-10-12; publicacao/metricas fora desta primeira submissao, produto preservado |
| D03 | Acesso do analista | Ambiente separado de avaliacao | Confirmado pelo dono em 2026-10-12; conta demonstrativa e topologia ainda por definir, nada provisionado |
| D04 | Integracao | Preservar Facebook Login e graph.facebook.com; nao migrar por diferenca de nome da permissao | Proposta tecnica, consistente com codigo atual |
| D05 | Identidade legal | HRM MOTOS PECAS E ACESSORIOS LTDA; exclusao@hrmmotos.com.br, alias de vendas@hrmmotos.com.br; dono atende pedidos | Declarados pelo dono em 2026-10-12; caixa operacional segundo relato, sem teste de e-mail ou verificacao documental pelo agente |
| D06 | Operadores | Hostinger hospeda VPS; backups atuais na propria VPS | Confirmado pelo dono em 2026-10-12; entidade contratual/localizacao/outros acessos a confirmar. Copia local eventual e proposta, nao rotina ou recurso implementado |
| D07 | Retencao/exclusao | Ainda nao ha prazo definido para DMs, imagens, logs e backups | Estado atual confirmado pelo dono em 2026-10-12; politica futura e rotina de exclusao continuam pendentes |
| D08 | URLs de avaliacao/privacidade | Politica em https://midia.hrmmotos.com.br/privacy.html; pagina de exclusao ainda inexistente segundo dono | Politica acessivel/lida nesta etapa; revisao de conteudo, pagina de exclusao e URL de avaliacao pendentes |

Nao substituir campos pendentes por respostas convenientes. Uso por outras
empresas exige reabrir a decisao de isolamento, onboarding e controle por conta.

## Artefatos desta entrega

- [Permissoes e chamadas](permissoes.md): separa codigo, evidencia externa e
  recomendacao; nenhuma permissao removida da solicitacao ou do produto.
- [Inventario de dados](inventario-dados.md): armazenamento, destino, riscos e
  perguntas ao responsavel sem registrar conteudo real.
- [Ambiente de avaliacao](ambiente-analista.md): fronteiras de seguranca e gates
  de provisionamento, incluindo webhook compartilhado.

## Pendencias objetivas para o dono

1. Revisar politica existente para Inbox/razao social/contato; definir processo
   de exclusao antes de publicar instrucoes. Pagina atual tem orientacao breve
   de pedido por e-mail, mas nao comprova processo operacional.
2. Confirmar entidade contratual/localizacao Hostinger e pessoas com acesso
   administrativo, inclusive a caixa de vendas compartilhada se houver.
3. Definir e aprovar politica futura de prazos por categoria e rotina de
   exclusao. Dono confirmou ausencia de prazo atual para DMs/imagens/logs/backups;
   webhook/ledger e copias tambem precisam de tratamento, sem expiracao presumida.

## Aceite do MR-01

- [x] Fluxo Facebook Login/Inbox e pontos de persistencia identificados.
- [x] Matriz tecnica de scopes e dependencias documentada.
- [x] Riscos de acesso, webhook e tratamento de dados registrados.
- [x] Plano de ambiente sem provisionamento indevido documentado.
- [x] D01-D03 confirmadas e incorporadas aos documentos de escopo/submissao.
- [x] Razao social/contato declarados pelo dono e politica existente identificados.
- [x] Acesso publico e conteudo da politica inspecionados.
- [x] Dono confirmou atendimento do alias, hospedagem Hostinger e backup na VPS.
- [x] Estado atual de retencao confirmado: sem prazo definido para DMs/imagens/logs/backups.
- [ ] Politica futura de retencao/exclusao aprovada e plano de implementacao definido.
- [ ] D05-D08 preenchidas com fatos verificaveis pelo responsavel.
- [ ] Dependencias oficiais pendentes confrontadas com painel/contrato aplicavel.
- [x] Tipo de ambiente escolhido: separado de avaliacao.
- [ ] Conta demonstrativa e fluxo de eventos seguro aprovados, sem provisionamento automatico.
- [ ] Dono aceita escopo/inventario e libera a implementacao seguinte.

MR-02 (fundacao i18n) foi iniciado em paralelo por autorizacao do usuario:
[base PT/EN local](../mr-02/README.md), sem transformar decisoes pendentes em aprovadas. A submissao
MR-07 permanece bloqueada pelos dados/acesso nao confirmados.
