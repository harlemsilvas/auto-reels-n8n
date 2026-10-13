# MR-05 — Exclusão transacional demonstrativa

Preparada e validada em 2026-10-13. Protótipo restrito a schema local descartável;
não é endpoint de produção nem processo completo de exclusão de dados pessoais.

## Aceite recebido

Usuário confirmou as páginas PT/EN e pediu seguir a sequência. Registrado como
aceite do texto pelo responsável na conversa, sem presumir parecer jurídico,
aprovação Meta, confirmação de operadores ou autorização de deploy. Avisos de
rascunho removidos das páginas locais após esse aceite. Páginas remotas intactas.

## Protótipo e teste

`backend/src/modules/privacy/deletion-demo.js` aceita somente schema com prefixo
`mr05_deletion_demo_` e UUID aleatório sem hífens. Recusa `public` e qualquer nome
arbitrário. Não foi montado em rota HTTP nem ligado ao relatório de retenção.
Flag `verified` é um pré-requisito fictício do teste, não autenticação real.

```bash
node backend/scripts/test-deletion-demo.js
```

Runner recusa DB remoto, connection string e NODE_ENV production. Cria dados
fictícios no schema temporário, executa casos de COMMIT/ROLLBACK e remove esse
schema ao terminar. Não usa dados de mensagens reais, arquivos Inbox, Meta ou
e-mail; imprime só o resultado da validação. Contagens `public` antes/depois
comparadas, sem alterações pelo script. Não é clone de dataset de produção.

## Comportamento validado

- Pedido limitado a conta + identificador do remetente; desconhecido não
  amplia seleção. Mesmo UUID de pedido retorna resultado original; reutilizá-lo
  para outro escopo é rejeitado.
- Transação trava conta, conversas e tentativas; `sending`, `uncertain`, estado
  desconhecido, confirmação inconsistente e mensagem referenciada por ledger
  de outra conversa bloqueiam a operação, sem descarte automático.
- Eventos brutos em lote misto são filtrados por par exato de conta/remetente,
  nos formatos messaging, changes.messages direto ou value.messaging. Evento
  de outra conta ou remetente permanece. Identificador em estrutura desconhecida
  aborta por escopo ambíguo; não exclui lote inteiro.
- Ordem no banco: redigir eventos, remover tentativas concluídas, mensagens e
  conversas (inclusive resumo/perfil nessa linha), registrar resultado agregado
  no audit demonstrativo e COMMIT. Falha tardia restaura todas as alterações.
- FK adicional bloqueando mensagem provoca ROLLBACK real; referência entre
  conversas é rejeitada antes de tentar remover dados.
- Arquivos compartilhados com outras mensagens/produto entram no manifesto de
  preservação. Arquivos privados ficam como pendência de limpeza separada;
  nenhum arquivo é removido ou apresentado como excluído.
- Testados pedido não verificado, schema inválido, escopo distinto, estados,
  rollback tardio/FK, preservação de eventos externos, compartilhamento e replay.
  Sintaxe e diff-check passaram. Schema temporário removido ao final.

## Limites deliberados antes de usar em dados reais

1. O schema demonstrativo acrescenta FKs de conta/conversa/mensagem; o banco
   atual não tem todas essas FKs. Portanto, locks desse teste não comprovam
   exclusão concorrente segura no runtime real. Criar bloqueio durável por
   escopo e verificar todos os produtores/ingresso, não apenas o sender de texto.
2. `product_media` é uma tabela fictícia de referências. Implementação real
   precisa consultar posts, uploads, modelos, caminhos e referências históricas
   como no relatório, sem copiar a simplificação do teste.
3. Audit demonstrativo retém IDs de conta/solicitante para exercitar replay;
   schema é descartado. Audit real precisa registro mínimo, retenção e limites
   definidos, sem conservar dados pessoais indefinidamente em nome de auditoria.
4. Sem remoção de arquivos, revogação de capacidades/cache, backups ou logs.
   Um COMMIT no DB não deve produzir status público de exclusão completa se essas
   etapas faltarem. Planejar fila durável/quarentena de arquivos e reconciliação
   após falhas; reaplicar exclusões ao restaurar backup.
5. Contrato callback Meta, identificação do solicitante e revisão autenticada
   do operador seguem pendentes. Não expor flag verified ou IDs livres no público.
6. Não habilitar a função em `public` removendo a guarda. A entrega de produção
   deve ter desenho próprio, migrations idempotentes/transacionais e regressões
   de ingresso, ledger, arquivos, auth e Reels.

Próximo incremento: persistência do pedido e bloqueio por escopo, verificação
autenticada pelo responsável, plano de arquivos/cache/copias e teste de corrida
com os produtores reais. Somente então integrar execução e eventual callback.
Sem migration no banco principal, endpoint novo, limpeza de histórico, restart,
commit/push/deploy ou acesso VPS nesta etapa. MR-05 continua aberto.
