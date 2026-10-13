# MR-05 — Diretriz de retenção e desenho de exclusão

Atualizado em 2026-10-13. Usuário autorizou seguir as sugestões de
`docs/prazo-retencao-backup-logs.md`. Fonte fornecida pelo usuário, sem URL ou
atribuição verificável à Meta. Arquivo original preservado, tabela corrigida.
Como `docs/` é ignorado pelo Git, este registro mantém a decisão versionável.

Estado: diretriz aceita; base técnica abaixo preparada, nenhuma limpeza,
rotação, migration ou configuração aplicada. Não declarar esses prazos como
rotina operacional ou obrigação universal da Meta.

## Base para implementação

As faixas foram aceitas pelo usuário. Valores exatos abaixo são escolhas técnicas
dentro dessas faixas para preparar a implementação, não declaração de que o dono
escolheu cada número individualmente. Contagem por registro, sem renovar o prazo
de mensagens antigas a cada nova DM; pedidos verificados exigem fluxo próprio.

| Categoria | Sugestão recebida | Base técnica | Tratamento necessário |
| --- | --- | --- | --- |
| Texto e payload de DMs | 30 a 90 dias | 90 dias desde criação da mensagem | Remover também cópias em webhook e ledger; definir efeito no histórico. |
| Ledger concluído | Até 1 ano, somente metadados | Até 1 ano desde conclusão | Retirar texto, payload/recibo desnecessário e referências dispensáveis; IDs continuam podendo ser dados pessoais. |
| Tentativas ativas/incertas | Não especificado | Sem expiração automática que libere reenvio | Bloquear envio e reconciliar antes de remover/compactar. Exceção controlada, não retenção indefinida aprovada. |
| Imagens DM enviadas | 7 a 30 dias | 30 dias desde criação | Remover arquivo privado e capacidade, atualizar histórico com estado indisponível. |
| Anexos DM recebidos | 7 a 30 dias | 30 dias para URL/metadata de anexo | Não há download permanente nesse fluxo; validade da URL Meta não elimina a cópia no payload. |
| Webhook filtrado | Não especificado separadamente | Proposta: 14 dias desde recebimento | Contém cópia de dados DM; excluir por escopo também em pedido individual. |
| Logs operacionais | 7 a 14 dias | 14 dias desde evento | Inspecionar PM2/proxy/n8n e logs antigos antes de implementar rotação; sem DMs/tokens. |
| Registros de acesso/segurança | 6 meses | 6 meses de calendário | Definir campos mínimos, sigilo e aplicabilidade; não conservar todo payload de auditoria. |
| Backups diários | 14 a 30 dias | 30 dias desde criação | Rotação verificada, catálogo, proteção e restauração com reaplicação de exclusões. |
| Snapshots longos, se instituídos | Até 90 dias | Limite proposto de 90 dias | Não instituir cópias extras automaticamente; incluir dumps manuais e backups de configuração. |
| Reels/modelos/posts | Até 7 dias/remoção pós-publicação sugerida | Planejamento separado | Arquivos são reutilizados por modelos/posts; não apagar por data ou status sem análise de referências. |

Prazo de webhook de 14 dias é proposta adicional de engenharia para cobrir uma
categoria omitida no texto recebido. Requer fechamento junto ao processo de
exclusão. Datas de criação/conclusão e FKs precisam ser conferidas no schema real
antes de migration; não adaptar dados históricos por conveniência.

## Correções e limites das afirmações recebidas

- A referência a seis meses é do [Marco Civil, Lei 12.965/2014, art. 15](https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2014/lei/l12965.htm),
  não da LGPD. Refere-se a registros de acesso a aplicações para os provedores
  descritos no artigo; art. 5º, VIII define esses registros. Isso não impõe a
  mesma retenção a todo log de debug, DM ou auditoria. Avaliar aplicabilidade
  ao uso interno HRM e exceções de guarda antes da política pública.
- As faixas numéricas recebidas são sugestões; não foi comprovado prazo universal
  Meta de 30 dias para desautorização, nem expiração universal de URLs em 24 horas.
  Não basear limpeza em validade de URL nem prometer sincronização de toda DM
  apagada sem evento/contrato demonstrados.
- Callback de exclusão não deve ser chamado genericamente de webhook
  `data_deletion_request` sem validar o contrato. Verificar callback/instruções
  aceitos no painel, `signed_request`, código opaco e status público antes de
  escolher a integração. Documentação Meta de callback e termos não ficou
  acessível nesta consulta (429/erro); isso não valida as afirmações recebidas.
- Rotação de backup sozinha não garante exclusão completa: inventariar todas as
  cópias, restringir acesso e impedir que restore reintroduza dados excluídos.
- AES-GCM de IA, HTTPS e modo 0600 não comprovam criptografia de tokens Meta,
  mensagens ou backups. TLS 1.3/AES sugeridos não foram verificados ou aplicados.

## Próximo incremento de implementação

1. Inspecionar schema/FKs reais somente localmente e mapear arquivos/cache,
   webhook, mensagens, ledger e auditoria por conta/conversa/solicitante.
2. Preparar seleção de candidatos em modo somente relatório, sem conteúdo
   sensível; mostrar contagens e exclusões de tentativas ativas/incertas.
3. Desenhar exclusão autenticada com escopo verificado, bloqueio de novos envios,
   transação DB e remoção de arquivos recuperável/reexecutável. Não usar cascade
   amplo nem endpoint público que apague por ID livre.
4. Testar dados demonstrativos, concorrência, rollback e restore com reaplicação
   do registro mínimo de exclusões. Definir retenção desse registro também.
5. Implementar rotina agendada somente após validar comportamento e inventário;
   ativação VPS depende de pedido e inspeção próprios. Reels permanecem preservados.
6. Redigir política/instruções PT/EN conforme controles efetivamente disponíveis,
   com revisão do responsável antes de publicar.

Ainda faltam pessoas com acesso à VPS/caixa de vendas, provedor de e-mail,
entidade/região de hospedagem, verificação do solicitante, tratamento de
desautorização, exceções de guarda e processo de exclusão de cópias. O dono
continua responsável pelo atendimento conforme relato anterior; não foi atribuído
acesso exclusivo a ele por ausência de informação sobre outros operadores.
