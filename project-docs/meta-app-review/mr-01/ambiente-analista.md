# MR-01 - Proposta de ambiente do analista

Estado: ambiente separado escolhido pelo dono em 2026-10-12; desenho/topologia
e conta demonstrativa pendentes. Nenhum ambiente criado.

## Opcao escolhida: ambiente separado

- Instalacao/dataset dedicados para avaliacao, nao clone de dados de producao.
- Apenas conta Instagram profissional e pagina demonstrativas autorizadas;
  usuarios/sessoes, DB, filas, storage, secrets e backups separados.
- HTTPS publico para analista/Meta, URL/callback permitidos no app em analise
  e credenciais fornecidas pelo formulario privado, nao por Git/video.
- No ambiente dedicado, role administrativa pode ser usada se necessaria ao
  OAuth atual, pois deve conter somente demonstracao. Nao compartilhar admin
  de producao, SSH, credenciais da pagina pessoal ou acesso a .env.
- Desabilitar jobs/coletores/publicacao/IA que nao fazem parte do teste; nao
  reutilizar Redis, worker, fila ou storage reais. Isso nao e uma flag de
  seguranca que substitui isolamento de dados.

Esta proposta nao decide provedor/domain/ports. Provisionamento requer pedido
especifico, inspecao da infraestrutura e plano de operacao/rollback.

## Ponto critico: mesmo app Meta, webhook e contas

Outro frontend/banco nao isola sozinho os eventos Meta. O app em analise ja
entrega eventos ao callback de producao; trocar essa URL pode interromper Inbox.
Eventos brutos sao guardados antes de selecionar/tratar entradas por conta.

Antes de publicar ambiente de avaliacao, escolher e testar uma topologia que:

1. Preserve callback, assinatura e entrega de producao, sem sobrescrever URL.
2. Autorize exclusivamente a conta demonstrativa no dataset do analista.
3. Evite armazenar/logar payload de contas reais no ambiente de avaliacao.
4. Mantenha secrets e autorizacao de relay/roteamento somente no backend, caso
   essa arquitetura seja necessaria. Nao confiar em accountId arbitrario do cliente.
5. Demonstre o app efetivamente submetido. App de desenvolvimento separado pode
   ajudar testes, mas nao presumir transferencia de grants/aprovacao ao app principal.
6. Adicione callback OAuth autorizado sem remover o existente; teste state/sessao
   para dominios apropriados, sem desabilitar SameSite/CSRF por conveniencia.

Nao implementado: multiplexacao/relay/isolamento de eventos. Decidir caminho
depois de inspecionar configuracao real autorizada. Nao adicionar subdominio,
proxy ou nova assinatura de webhook automaticamente.

## Alternativa: instalacao atual

Nao escolhida para esta primeira avaliacao. Mantida como referencia de riscos.

Nao liberar analista neste estado: roles sao globais, OAuth requer admin e
workspace atual nao comprova segregacao. Requer desenvolvimento/testes de
restricao por conta/dados, incluindo SSE, anexos, tentativas, listas, posts,
usuarios e credenciais. Esconder menus nao basta. Avaliar custo antes de escolher.

## Gates antes de criar acesso externo

- [x] D01-D03 escolhidas pelo dono: interno HRM, Inbox e ambiente separado.
- [ ] Conta demonstrativa e ownership confirmados.
- [ ] Dados/contatos/operadores do inventario confirmados.
- [ ] Topologia de OAuth/webhook aprovada sem impacto na producao.
- [ ] Validacao de assinatura webhook e logs seguros testados localmente.
- [ ] Dataset sem mensagens/tokens/posts de producao e filas/storage separados.
- [ ] Publicacao so em conta demonstrativa, se explicitamente parte do review.
- [ ] URLs/credenciais/validade/acesso por sessao nova verificados; troca obrigatoria
  resolvida pelo responsavel previamente sem desativar seguranca.
- [ ] Politica/exclusao publicas e operacionais; nenhuma credencial em documentos.
- [ ] Plano de backup/rollback, limite de acesso e revogacao pos-review aprovado.

Provisionamento e um incremento posterior, nao o resultado desta etapa MR-01.
