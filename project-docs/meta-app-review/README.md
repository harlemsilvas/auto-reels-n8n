# Preparacao SocialBot para analise Meta

Atualizado em: 2026-10-13. Branch: `docs/meta-app-review-i18n`.
Status: MR-01 em andamento; base PT/EN do MR-02 implementada/testada localmente,
com autenticacao/layout aceitos pelo usuario. Contas/feedback OAuth PT/EN do
MR-03 e Inbox/Testers DM MR-04 testados localmente, aceite pendente.
MR-02..04 publicados na VPS na release `f7d52a0` em 2026-10-13;
[registro do deploy](deploy-2026-10-13.md). Sem traducao completa ou aprovacao Meta.

## Base confirmada

- Release VPS atual verificada: `f7d52a0`, migration 015 preservada, sem migration
  nova; HEAD documental anterior a esta branch: `c2655a2`.
- Usuario relatou DM inbound de nao tester recebida, mas resposta rejeitada com
  erro 200 exigindo acesso avancado a `instagram_manage_messages`.
- Capturas fornecidas: empresa verificada, testes concluidos, analise ainda nao
  enviada e perguntas de tratamento de dados pendentes. Isso nao e aprovacao.
- Codigo inspecionado nesta etapa: login local, OAuth Facebook Login, Contas,
  Inbox, permissoes, persistencia de contas e formatacao de datas. Nenhuma sessao
  OAuth real, token, configuracao .env ou dado privado consultado.

## Objetivo

Escopo confirmado pelo dono em 2026-10-12: uso interno da HRM/contas proprias;
primeira submissao Inbox (receber/responder DMs); ambiente separado de avaliacao,
ainda nao provisionado. Publicacao e metricas existentes permanecem preservadas.
Razao social informada: HRM MOTOS PECAS E ACESSORIOS LTDA; contato de exclusao:
exclusao@hrmmotos.com.br. Politica publica existente em
https://midia.hrmmotos.com.br/privacy.html foi lida; revisao para Inbox e pagina
dedicada/processo de exclusao ainda pendentes.
Dono confirmou atendimento pessoal do alias exclusao@, entregue a vendas@;
VPS na Hostinger e backups na propria VPS. Copia local futura nao implementada.
Ausencia de prazo atual de retencao para DMs/imagens/logs/backups confirmada
pelo dono; politica futura e rotina de exclusao ainda precisam ser definidas.

Permitir que um analista reproduza o fluxo real: sair, entrar no SocialBot,
autorizar uma conta profissional pela Meta, receber uma DM e responder pelo
Inbox. Preparar evidencias em ingles e respostas de tratamento de dados baseadas
no funcionamento real, sem inventar funcionalidades ou controles.

Internacionalizar ajuda a avaliacao, mas a orientacao enviada pelo usuario
permite legendas em ingles quando a UI nao estiver em ingles. Nao e necessario
criar uma landing page, cadastro publico ou copiar o layout BizOne dos exemplos.
Nosso login proprio pode continuar separado da autorizacao Meta.

## Documentos

1. [Diagnostico e permissoes](01-diagnostico.md): evidencias locais e lacunas.
2. [Etapas de desenvolvimento](02-plano-desenvolvimento.md): entregas, dependencias
   e criterios de aceite, incluindo internacionalizacao completa incremental.
3. [Formulario, dados e screencast](03-submissao-e-evidencias.md): texto candidato,
   roteiro de gravacao, acesso do analista e perguntas a responder.
4. [MR-01 em andamento](mr-01/README.md): decisoes pendentes, matriz detalhada,
   inventario tecnico de dados e desenho seguro do ambiente do analista.
5. [MR-02 local](mr-02/README.md): base PT/EN entregue, testes e limites do incremento.
6. [MR-03 local](mr-03/README.md): Contas traduzidas e callback seguro/conferido;
   limites de OAuth real, selecao multipagina e ambiente do analista.
7. [MR-04 local](mr-04/README.md): Inbox/Testers PT/EN, feedback seguro de
   permissao e regressao de entrega incerta, anexos e nao lidas.
8. [Retomada MR-05](mr-05/README.md): estado pos-deploy, decisoes pendentes,
   sequencia de seguranca/privacidade/exclusao e gates para nova sessao.

## Decisoes propostas

- Manter Facebook Login no incremento inicial; nao migrar para Instagram Login
  somente porque existe uma permissao com prefixo `instagram_business_*`.
- Priorizar avaliacao de Inbox; validar dependencias oficiais antes de reduzir
  scopes. Publicacao/metricas existentes nao podem perder acesso por conveniencia.
- Adotar `pt-BR` e `en` com i18next/react-i18next, primeiro no caminho de avaliacao
  e depois nos demais modulos. Dependencias instaladas localmente no MR-02;
  catalogos common/auth/accounts/inbox implementados; demais paginas pendentes.
  Usuario pediu traducao completa de botoes/textos/avisos e avaliacao em EN,
  mantendo PT como regressao e conteudo do usuario no idioma original.
- Nao abrir atendimento/publicacao irrestritos, desativar CSRF ou compartilhar
  administrador de producao para facilitar a analise.
- Nenhuma promessa de aprovacao: desenvolvimento e evidencias nao substituem a
  decisao da Meta nem concedem acesso avancado.

## Fontes e limites

- Diretrizes de screencast e formulario transcritos pelo usuario nesta conversa:
  login completo, demonstracao por permissao e ingles ou legendas explicativas.
- [Documentacao oficial Meta no Postman](https://www.postman.com/meta/workspace/instagram/documentation/23987686-9386f468-7714-490f-9bfc-9442db5c8f00)
  diferencia Instagram Login e suas permissoes/host.
- [Guia oficial react-i18next](https://react.i18next.com/latest/i18next-instance)
  sustenta a integracao proposta para traducoes React.
- Paginas Meta de [screencast](https://developers.facebook.com/docs/app-review/submission-guide/screen-recordings/)
  e [data deletion](https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback/)
  retornaram 429 na consulta desta etapa. Revalidar detalhes no painel/documentacao
  antes de implementar contratos ou enviar a analise; nao inferir requisitos novos.

## Proxima entrega

MR-01 iniciado: levantamento tecnico e D01-D03 confirmados pelo dono. Faltam
contratos/localizacao/acessos dos operadores, retencao/exclusao, revisar politica,
definir URL de avaliacao e topologia segura dos
eventos antes de aceita-lo. MR-02 aceito pelo usuario; incremento Contas/OAuth
MR-03 testado localmente. Proximo MR-04 Inbox/Testers DM, sem declarar MR-03
completo enquanto selecao multipagina/OAuth real/acesso do analista estiverem pendentes.
Os documentos nao autorizam provisionamento externo, migration, push ou deploy.
Preservar arquivos locais do usuario e manter `main`/VPS fora desta preparacao.
