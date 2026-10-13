# Diagnostico do app para avaliacao

Inspecao de codigo em 2026-10-12; nao equivale a teste real de OAuth na VPS.
Referencias relativas a raiz do repositorio.

## O que ja existe e o que falta

| Area | Evidencia atual | Lacuna / acao |
| --- | --- | --- |
| Login proprio | `dashboard/src/modules/auth/pages/LoginPage.tsx`, AuthContext e `/api/auth/*` | Gravar desde logout; erros/loading/acessibilidade e idioma precisam revisao. Sem cadastro publico, usuarios criados por admin. |
| Autorizacao Meta | `backend/src/modules/auth/meta-oauth.service.js`, routes/controller; `/api/auth/meta/login` e callback | Fluxo Facebook Login, state ligado a sessao, expiracao de dez minutos e consumo unico. Testar sucesso, cancelamento, state invalido/expirado e retorno seguro. |
| Conexao pela UI | `dashboard/src/modules/accounts/pages/AccountsPage.tsx` tem Logar Meta | Botao junto de formulario manual Access Token/Importar do env. Separar conexao OAuth de manutencao tecnica, sem revelar token em gravacao. |
| Retorno OAuth | Backend retorna `/contas?connected=true` ou `?error=...` | Contas nao interpreta query params; falta feedback visivel, seguro e traduzivel de sucesso/erro. |
| Escolha da conta | OAuth usa `pages.find(...)` com Instagram vinculado | Escolhe primeira pagina elegivel, sem selecao explicita/paginacao. Definir conta de demonstracao; implementar escolha antes de oferecer conexao multipagina. |
| Identidade | OAuth busca perfil; `accounts.service.js` salva nome/Instagram ID/Page ID/token/expiracao | Campos extras enviados pelo OAuth, como facebookUserId/username/profilePictureUrl, nao sao persistidos por esse upsert. Nao prometer identidade/vinculo de instalador que nao e salvo. |
| Inbox | `/inbox`, texto/imagens, historico, nao lidas, SSE/polling, ledger 015 de texto | Funcional com testers segundo usuario. Resposta a nao tester bloqueada por permissao Meta, nao corrigivel por traducao/deploy. |
| Acesso do analista | Permissoes em `backend/src/modules/auth/permissions.service.js` | Operator padrao nao pode responder nem gerenciar contas; OAuth exige admin quando auth ativa. Nao fornecer operator esperando fluxo completo nem admin global sobre dados reais. |
| Isolamento | Contas usa primeiro workspace ativo; roles globais | Isolamento por cliente/analista nao demonstrado. Necessario ambiente dedicado ou escopo real antes de expor dados de terceiros. |
| Internacionalizacao | `dashboard/package.json` sem i18n; strings em componentes | `pt-BR` fixo em datas; `<html lang="en">` apesar da UI PT. Criar catalogos e formatadores, traduzir estados/erros/aria/tooltips e ajustar lang dinamicamente. |
| Privacidade/exclusao | Nao identificadas rotas correspondentes em backend/src/dashboard/src | URLs externas podem existir, mas nao foram verificadas. Confirmar configuracao no painel, publicacao e processo real de exclusao. |
| Retencao | Historico, tentativas, imagens privadas e backups existem | Politica e rotina de exclusao/retencao ainda pendentes. Hash de texto no ledger nao anonimiza o texto, tambem armazenado. |
| Tokens e logs | Conta grava access_token diretamente no upsert; listagem omite token | Nao declarar criptografia de tokens Meta em repouso. Revisar criptografia/chaves/backups e sanitizacao de erros OAuth brutos antes de responder sobre seguranca. |

Legado de autenticacao desativada ainda existe no frontend. Preflight de avaliacao
deve exigir autenticacao real ativa; nunca gravar/utilizar esse modo como acesso
do analista. Sem alterar configuracao apenas para facilitar o review.

## Matriz de permissoes

OAuth atual pede: instagram_basic, instagram_content_publish,
instagram_manage_messages, pages_show_list, pages_manage_metadata,
pages_messaging, pages_read_engagement e business_management.
Nao modificar esta lista sem verificar dependencias e regressao Reels/publicacao.

| Permissao na solicitacao | Evidencia / encaminhamento |
| --- | --- |
| instagram_manage_messages | Sender atual usa graph.facebook.com; prioridade para Inbox. Demonstrar leitura/resposta e solicitar acesso avancado correspondente. |
| instagram_basic | Escopo atual e dependencia apresentada no formulario para mensagens. Demonstrar perfil/conta profissional conectada. |
| pages_show_list | OAuth chama `/me/accounts`; demonstrar descoberta das paginas acessiveis e vinculacao Instagram. |
| pages_read_engagement | Pedida no OAuth; mapear chamadas/fields que efetivamente dependem dela antes de justificar. |
| pages_manage_metadata | Pedida no OAuth; nao encontrada chamada subscribed_apps na busca local. Conferir assinatura feita fora do app e necessidade oficial do fluxo. |
| pages_messaging | Pedida no OAuth; nao presumir que existe Inbox Facebook separado. Conferir dependencia do envio Instagram via Facebook Login. |
| instagram_content_publish | Publicacao implementada e scope atual; video proprio se mantida na submissao. Nao publicar em conta real apenas para gravar sem autorizacao. |
| instagram_manage_insights | metrics.service.js consulta insights; ausente na lista de scopes OAuth. Auditar autorizacao antes de demonstrar ou incluir. |
| instagram_manage_comments | Receber campos webhook/contador de comentarios nao prova gerenciamento. Nao localizado fluxo de moderacao demonstravel. Adiar se desnecessaria apos verificacao. |
| business_management | Pedida no OAuth, mas necessidade funcional especifica nao estabelecida nesta leitura. Mapear uso antes de justificar. |
| public_profile | Perfil Facebook consultado em `/me`; confirmar tratamento no fluxo de login e requisitos reais do painel. |
| instagram_business_basic / instagram_business_manage_messages | Pertencem ao fluxo Instagram Login; nao encontrados no OAuth/sender inspecionados. Nao justificar com video do fluxo Facebook Login. |

Manter no pedido apenas recursos demonstraveis e dependencias confirmadas. Remover
da submissao e remover do produto/scopes sao operacoes diferentes; nao executar
nenhuma automaticamente. Registrar decisao por permissao antes de enviar.

## Bloqueios de prontidao

1. Analista precisa acessar login, autorizacao e resposta sem acesso global a dados reais.
2. Identificar permissao exata e completar review/dados; publicar app nao concede acesso avancado.
3. Demonstrar OAuth real de ponta a ponta, sem token manual como substituto.
4. Definir privacidade, exclusao, retencao e operadores de dados com evidencia.
5. Gravar UI compreensivel em ingles ou legendada, com estado real e resultado no Instagram.

Nao corrigimos lacunas de runtime nesta branch documental; nenhuma migration nova.
