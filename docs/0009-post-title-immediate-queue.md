# Nome da postagem e fila imediata

## Objetivo

- identificar posts por um nome curto e estável, separado da legenda;
- deixar explícito que ausência de agendamento significa publicar assim que
  possível;
- enfileirar imediatamente após o commit, sem esperar o próximo polling;
- preservar recuperação pelo coletor quando Redis estiver indisponível.

## Schema

Migration: `backend/sql/009-post-title-immediate-queue.sql`.

- `posts.title VARCHAR(160)`, inicialmente opcional para compatibilidade;
- constraint impede strings vazias quando o valor não é nulo;
- índice parcial `idx_posts_title`;
- nenhum backfill foi realizado em posts antigos.

Novos uploads feitos pelo dashboard exigem título. Clientes legados que não
enviarem o campo recebem fallback pelo nome do primeiro arquivo.

## Comportamento sem data

Depois do commit de `uploads`, `posts`, `post_media_items` e evento `created`:

1. o backend adiciona o job ao BullMQ;
2. marca o post como `queued`;
3. registra evento `queued` com origem `media.upload.immediate`;
4. responde ao dashboard indicando o destino do post.

Se a fila falhar, o upload não é desfeito nem a mídia é apagada. O post continua
`pending`, recebe um evento `queue_failed` quando possível e poderá ser
recuperado pelo coletor periódico.

Quando a publicação multi-tipo está desabilitada, formatos Meta permanecem em
preparação e não são enviados para uma fila que certamente falharia. Reels
continuam usando seu publisher n8n normal.

## Interface

- nome obrigatório, até 160 caracteres;
- ausência de dia e horário mostra aviso de entrada imediata na fila;
- preencher apenas um dos dois impede o envio;
- sucesso diferencia fila, agendamento, preparação e fallback pendente;
- Agendamentos mostra a coluna Nome;
- Histórico prioriza o título persistido quando disponível.

## Validações realizadas

- migration aplicada duas vezes no PostgreSQL local;
- verificador confirmou coluna, constraint, índice e zero títulos inválidos;
- bootstrap completo aprovado em banco temporário removido ao final;
- consulta real de posts aprovada após migration;
- fila simulada com sucesso confirmou `markQueued` e evento `queued`;
- falha simulada confirmou retorno `queue_error` e evento `queue_failed`, sem
  propagar erro para a camada de upload;
- sintaxe do backend, ESLint do escopo e build do dashboard aprovados;
- nenhuma publicação real foi disparada.

## Teste funcional seguro

1. criar um post **com data futura** e confirmar título/status `scheduled`;
2. testar validação preenchendo somente dia ou somente horário;
3. para testar “sem data”, usar conteúdo descartável autorizado e confirmar
   previamente que a publicação externa pode ocorrer;
4. conferir eventos `created` e `queued`, job BullMQ e título em Agendamentos.

A migration ainda não foi aplicada na VPS.
