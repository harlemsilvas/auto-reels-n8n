# Submissao, tratamento de dados e evidencias

Atualizado em 2026-10-13. Nao enviado; textos dependem de revisao do dono.
MR-02..04 publicados na release VPS `f7d52a0`; registro documental enviado
`0216ebd`. Login publico PT/EN validado, sem novo teste autenticado/OAuth real.
Preparacao da proxima sessao: [MR-05](mr-05/README.md). Politica, exclusao,
deploy/entrega real da seguranca webhook e ambiente do analista ainda pendentes.
Primeiro incremento de assinatura/escopo/logs webhook testado somente localmente
no MR-05; nao comprova configuracao de producao nem conclui os controles de dados.

Escopo confirmado: uso interno HRM/contas proprias, avaliacao de Inbox com
ambiente separado. Publicacao/insights nao integram esta primeira submissao;
permissoes de suporte ainda exigem verificacao. Ambiente nao provisionado.

Responsavel declarado: HRM MOTOS PECAS E ACESSORIOS LTDA.
Contato informado: exclusao@hrmmotos.com.br, alias de vendas@hrmmotos.com.br;
dono confirmou recebimento e atendimento por ele proprio. VPS Hostinger e
backups na propria VPS, conforme relato; copia local eventual ainda nao e rotina
ou funcionalidade implementada. Dono confirmou que DMs, imagens, logs e backups
ainda nao tem prazo de retencao definido. Contratos/localizacao, politica futura
e rotina de exclusao pendentes; nao declarar prazos/limpeza automatica inexistentes.
Politica existente: https://midia.hrmmotos.com.br/privacy.html, publica e lida
em 2026-10-12. Precisa atualizar escopo Inbox/identificacao/contato. Pagina
dedicada de exclusao nao existe segundo dono; politica atual ja orienta pedido
por e-mail, sem processo operacional comprovado. Nao enviar respostas de dados
como concluidas antes dessas verificacoes.

Atualizacao em 2026-10-13: diretriz de faixas de retencao aceita pelo dono,
[base tecnica registrada](mr-05/retencao-e-exclusao.md). Ainda sem rotina aplicada;
processo de exclusao, operadores e politica publica pendentes. Nao preencher o
formulario como se rotacao/expiracao/exclusao ja estivessem operacionais.

## Descricao candidata: instagram_manage_messages

Revisao privacy/instrucoes PT/EN preparada somente localmente em 2026-10-13:
[paginas e gates de publicacao](mr-05/paginas-privacidade.md). Ainda nao ha nova
URL remota de exclusao confirmada, callback automatico ou processo de exclusao
demonstrado. Nao usar caminhos localhost nos campos do painel Meta.

```text
SocialBot is an internal operations dashboard used by authorized staff to
manage customer conversations for a connected Instagram professional account.
The instagram_manage_messages permission is used to receive and read Direct
messages, display conversation history, and send individual text and image
replies from the Instagram Inbox screen.

This centralizes customer service so authorized staff can review incoming
requests and reply without switching between multiple tools. The permission
is necessary because these actions access the connected account's Instagram
Direct conversations and send replies through the Meta API. SocialBot uses a
separate username/password login for dashboard access and Facebook Login to
authorize the connection to the professional account.

The demonstrated workflow responds to conversations initiated by Instagram
users. It is not a tool for sending unsolicited bulk Direct messages.
```

Texto descreve funcionamento inspecionado e uso interno confirmado pelo dono.
Nao declarar CRM de
terceiros multiempresa, criptografia total ou anonimato sem evidencia.
Completar descricoes especificas por permissao mantida; nao reutilizar esta para insights.

## Roteiro real de screencast

1. Usar dados demonstrativos autorizados, interface EN no caminho ja traduzido ou
   legendas EN revisadas. Fechar .env, terminal de logs e ferramentas com tokens.
2. Mostrar SocialBot desconectado; iniciar no login publico. Capturar entrada
   com usuario de avaliacao, sem senha legivel. Nao mostrar senha pessoal Meta.
3. Abrir Accounts e iniciar Connect with Meta (rotulo EN implementado).
   Mostrar login/consentimento Meta real e conta/pagina escolhida quando disponivel.
4. Mostrar retorno e conta conectada. Se a conta ja autorizou e nao aparece
   consentimento, usar conta demonstrativa adequada; nao revogar a integracao
   de producao apenas para forcar essa tela.
5. Tester autorizado envia uma DM com identificador unico pelo Instagram.
   Mostrar chegada, identidade quando disponivel e historico no SocialBot Inbox.
6. Responder pelo Inbox e mostrar resultado no Instagram do tester. Se imagens
   fizerem parte da demonstracao, usar arquivo demonstrativo e mostrar chegada.
7. Recarregar historico e mostrar mensagem persistida; outra aba e opcional para
   evidenciar continuidade. Nao provocar timeout/duplicacoes em producao.
8. Encerrar com logout. Para outros scopes, gravar o recurso real correspondente
   com login/autorizacao suficientes para reproduzi-lo.

Videos de API simulada dos testes nao substituem evidencia real da analise.
Nao adicionar todos os clientes como testers nem usar testes para contornar acesso
avancado. Sem garantia de prazo ou aprovacao; testes expiram conforme painel atual.

Exemplos de legendas EN, nao textos explicativos permanentes dentro da UI:

- "Sign in to SocialBot using the dedicated review account."
- "Authorize the Instagram professional account through Facebook Login."
- "The tester sends a Direct message to the connected business account."
- "The incoming message is displayed in SocialBot's Instagram Inbox."
- "Send an individual reply and verify it in the tester's Instagram inbox."

## Acesso do analista

- URL/usuario do ambiente de avaliacao: a definir, nao inventar acesso existente.
- Credenciais entregues apenas no campo privado da Meta, fora de Git/video/docs.
- Registrar caminhos, nomes de botoes EN, conta demonstrativa, pre-requisitos e
  o resultado esperado de cada passo. Testar com navegador/sessao novos.
- Definir validade, renovacao e suporte de acesso conforme formulario; evitar
  troca obrigatoria/bloqueio expiring antes da avaliacao, sem enfraquecer seguranca.
- Operator atual nao pode executar resposta/OAuth; ambiente separado ou acesso
  limitado precisam estar prontos. Nao entregar conta de administrador da VPS.
- Qualquer tester/account role adicional deve respeitar instrucoes do painel;
  permissao de tester nao equivale a autorizacao do cliente para uso de dados.

## Perguntas de tratamento de dados: levantamento obrigatorio

| Tema | O que precisamos confirmar antes de responder |
| --- | --- |
| Responsavel | Razao social/controlador, contato real e finalidade interna versus multiempresa. |
| Dados coletados | IDs/nome de conta e pagina, tokens, DMs/perfis/anexos, ledger, usuarios/sessoes, IP/audit e metricas conforme fluxos reais. |
| Finalidade | Atendimento, autorizacao, publicacao e metricas somente se mantidos; nao marcar marketing/anuncios apenas porque a descricao da permissao permite. |
| Compartilhamento | Meta, hospedagem, backup, n8n, IA e outros servicos: mapear dado efetivamente enviado, operador/contrato/localizacao; nao presumir que DMs vao a Gemini. |
| Acesso | Roles reais, isolamento, suporte e acesso de operadores. Nao declarar segregacao entre empresas ainda nao testada. |
| Seguranca | HTTPS externo/cookies/CSRF/auditoria observados; tokens Meta salvos diretamente no upsert, criptografia em repouso precisa verificacao/melhoria. |
| Retencao | Prazos definidos para mensagens, tentativas, imagens, cache, logs e backups. Nao inventar prazos onde rotina nao existe. |
| Exclusao | Contato/processo, autenticacao do pedido, escopo, prazo, backup e evidencias. Ocultar testers nao e exclusao de dados. |
| Solicitacoes externas | Processo real para autoridades/avaliacao de pedidos, acesso/divulgacao e registro; dono responde conforme pratica existente. |

Atual: ledger conserva texto e recibo Meta; cache de perfil em memoria tem TTL;
imagens enviadas usam storage privado; URLs recebidas podem expirar. Esses fatos
nao significam eliminacao de dados de historico/backups. Nao responder "nao
armazenamos dados" ou "todos os dados sao anonimos".

## Checklist de envio

- [ ] Permissoes/chamadas/funcionalidades reconciliadas e dependencias verificadas.
- [ ] Login proprio e autorizacao Meta reproduziveis sem acesso indevido.
- [ ] Idioma EN completo no caminho demonstrado ou legendas EN claras.
- [ ] Descricao e video especificos para cada permissao mantida.
- [ ] Politica/contato/instrucoes de exclusao publicos e processo operacional.
- [ ] Tratamento de dados respondido com evidencias pelo responsavel.
- [ ] Credenciais/instrucoes privadas verificadas com sessao nova.
- [ ] Nenhum token/senha/dado real de cliente na gravacao ou documentos.
- [ ] Build/testes/aceite e deploy do ambiente de avaliacao autorizados.
- [ ] Solicitacao enviada e status acompanhado; acesso avancado nao presumido.
