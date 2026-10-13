# MR-01 - Matriz de permissoes e evidencia

Leitura local em 2026-10-12. Esta tabela nao substitui contrato da Meta nem
inspecao de grants do token; nenhuma credencial/grant real foi consultado.

Escopo confirmado pelo dono em 2026-10-12: uso interno HRM/contas proprias,
primeira submissao apenas Inbox (receber/responder DMs), ambiente separado.
Publicacao/insights permanecem no produto, mas ficam fora desta primeira
submissao. Nao houve remocao de permissoes no painel nem mudanca de scopes.

## Caminho observado

Login SocialBot -> GET /api/auth/meta/login -> Facebook OAuth -> callback
protegido por sessao/state -> `/me/accounts` -> primeira pagina elegivel ->
perfil da conta Instagram -> upsert conta -> `/contas`.

Inbox recebe webhook e consulta historico local. Sender usa `/me/messages` em
graph.facebook.com; perfil opcional usa `/{instagramUserId}?fields=name,username`.
Listar historico local nao e uma chamada a Conversations API da Meta.

Fontes de codigo:

- `backend/src/modules/auth/meta-oauth.service.js`: scopes e chamadas OAuth.
- `backend/src/modules/instagram/instagram-api.client.js`: envio/perfil/typing.
- `backend/src/modules/webhooks/instagram-messages.repository.js`: historico local.
- `backend/src/modules/metrics/metrics.service.js`: contadores e `/insights`.

## Candidatas para Inbox

| Permissao | Evidencia local | Decisao da submissao |
| --- | --- | --- |
| instagram_manage_messages | Pedida no OAuth; erro fornecido pelo usuario exige acesso avancado; leitura/resposta demonstraveis | Prioridade para analise, ainda sem aprovar/solicitar automaticamente |
| instagram_basic | Pedida no OAuth; consulta perfil profissional/vinculo com pagina | Dependencia indicada no formulario do usuario; manter na candidata |
| pages_show_list | Pedida no OAuth; `/me/accounts` descobre paginas | Manter na candidata de conexao e demonstrar descoberta |
| pages_manage_metadata | Pedida no OAuth; webhook assinado externamente no painel, assinatura via subscribed_apps nao localizada no codigo | Dependencia da familia de mensagens documentada pela Meta; manter sob revisao, nao eliminar apenas por ausencia de chamada direta |
| pages_messaging | Pedida no OAuth; sender Instagram usa Facebook Graph | Confirmar exigencia do endpoint/config real. Nao justificar como Inbox Facebook que nao demonstramos |
| pages_read_engagement | Pedida no OAuth; fields da pagina/conta consultados | Confirmar exigencia dos fields/fluxo, sem inventar gerenciamento de feed da pagina |
| public_profile | OAuth consulta `/me?fields=id,name` | Confirmar tratamento/grant do Facebook Login no painel; nao confundir com login local |
| business_management | Pedida no OAuth; dependencia especifica nao estabelecida | Investigar antes de decidir; nao retirar do OAuth compartilhado sem regressao |

A [colecao oficial Meta de Conversations API](https://www.postman.com/meta/messenger-platform-api/folder/22794852-255610cd-47f5-4f4d-b3fa-71aec360be9a)
lista instagram_basic, instagram_manage_messages e pages_manage_metadata e
explica acesso avancado para conversas com pessoas sem funcao. Consulta nesta
rodada; nao prova que o nosso app usa todos os endpoints dessa colecao ou que
isso seja a lista completa do Send API. Conferir dependencias especificas antes
de finalizar o pedido.

## Fora da candidata Inbox, sujeito ao escopo do dono

| Permissao | Produto existente | Encaminhamento |
| --- | --- | --- |
| instagram_content_publish | Publicacao de conteudo, scope OAuth atual | Se D02 for Inbox apenas, preparar evidencia/pedido separado; preservar integracao atual e Reels |
| instagram_manage_insights | metrics.service.js consulta insights; scope ausente no OAuth atual | Auditar concessoes/chamadas; incluir somente com evidencia e autorizacao adequadas |
| instagram_manage_comments | Campo webhook/contador nao prova moderacao | Sem fluxo de moderacao comprovado; candidata a adiar, nao remover automaticamente |
| instagram_business_basic / instagram_business_manage_messages | Nenhum caminho Instagram Login no OAuth/sender inspecionado | Nao justificar com fluxo Facebook Login; revisar selecao no painel |

## Fechamento da matriz

1. D02 confirmada: Inbox. Registrar para cada permissao de suporte: manter,
   adiar ou investigar, sem remover automaticamente dependencias.
2. Revalidar dependencias oficiais do Send API/OAuth/webhook e campos consultados.
3. Confrontar com selecoes do pedido atual, sem acessar/alterar o painel em nome do dono.
4. Definir videos e descricao por permissao mantida; obter aceite do dono.
5. Mudanca de scopes do produto, se necessaria, e outra entrega com teste de
   conexao/reconexao/publicacao. Permissoes de token, configuracao de app,
   selecao de review e role local sao camadas diferentes.

Nenhuma reducao da lista atual foi aplicada; lista final depende destas verificacoes.
