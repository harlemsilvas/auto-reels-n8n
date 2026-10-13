# Etapas de desenvolvimento

MR-01 em andamento; base MR-02 aceita pelo usuario; Contas/feedback OAuth MR-03
implementados/testados localmente, aceite manual e demais itens MR-03 pendentes.
MR-04 implementado/testado localmente, aceite manual pendente; MR-05..07
pendentes. Sem prazo ou aprovacao Meta garantidos.
Executar uma entrega verificavel por vez, com teste local antes de deploy autorizado.

## MR-01 - Escopo, dados e ambiente do analista

Levantamento tecnico iniciado em 2026-10-12: [registro MR-01](mr-01/README.md).
Inventario/matriz/desenho documentados. Dono confirmou uso interno HRM/contas
proprias, primeira submissao Inbox e ambiente separado em 2026-10-12. Demais
decisoes de dados/topologia e validacoes externas pendentes; nao marcar concluido
enquanto os gates de aceite nao forem satisfeitos.

- Confirmar uso interno HRM versus atendimento multiempresa; nao anunciar SaaS
  multi-tenant enquanto controles de isolamento nao forem demonstrados.
- Fechar matriz de permissoes/chamadas/scopes da submissao. Priorizar Inbox;
  separar evidencias de publicacao/insights e nao remover dependencias do Reels.
- Escolher ambiente dedicado e conta profissional demonstrativa, com acesso
  autorizado aos analistas conforme requisitos do painel. Nao usar senha pessoal,
  dados de clientes reais, admin global de producao ou bypass de autenticacao.
- Confirmar responsavel legal, contato, URLs publicas, operadores/suboperadores,
  prazos de retencao/exclusao e dados efetivamente enviados a cada integracao.
- Tratar riscos encontrados na leitura: payload bruto/verify token em logs,
  autenticidade de POST webhook nao validada no caminho inspecionado e eventos
  salvos antes do escopo de conta. Correcao de runtime deve ter entrega/teste
  proprio antes de expor ambiente ao analista, sem modificar producao por surpresa.

Aceite: decisoes registradas, escopo do analista aprovado pelo dono e inventario
de dados completo. Provisionamento/URLs/proxy exigem autorizacao especifica.

## MR-02 - Fundacao de internacionalizacao

Primeiro incremento entregue localmente em 2026-10-12: [registro MR-02](mr-02/README.md).
i18next 26.4.4 + react-i18next 17.0.16, catalogos JSON common/auth no bundle,
tipagem, seletor/persistencia/fallback, autenticacao/layout e formatadores Intl
testados. Sem traducao completa, backend de traducao ou detector externo.

Estrutura base/common/auth/accounts/inbox ja existe:

```text
dashboard/src/shared/i18n/
  index.ts
  formatters.ts
  locales/pt-BR/{common,auth,accounts,inbox}.json
  locales/en/{common,auth,accounts,inbox}.json
```

- `pt-BR` como default/fallback para preservar operacao; `en` selecionavel.
  Idioma explicito persistido localmente, inclusive no login. Storage bloqueado
  nao pode impedir acesso. Idioma nao muda conta, sessao ou permissao.
- Seletor acessivel Portugues/English em login e layout; html.lang atualizado,
  titulo traduzido, chaves tipadas/estaveis e testes de paridade dos catalogos.
- Traduzir UI, validacao, toast/erro, status, confirmacao, tooltip, aria-label,
  plural de nao lidas e estados vazios/loading. Nao traduzir DMs, nomes, usernames,
  TAGs, enum/ID de API ou conteudo criado pelo usuario.
- Intl.DateTimeFormat/NumberFormat centralizados por locale; locale nao deve
  alterar timezone, horario de agendamento ou valores enviados ao backend.
- Erros internos devem ganhar codigos estaveis e mensagem segura traduzivel,
  mantendo contratos atuais. Provedor desconhecido usa fallback, sem revelar
  payload/token/stack. Traducao por comparacao de frase bruta nao e contrato.

Aceite: alternancia PT/EN antes/depois do login sem perda de rascunho; fallback,
persistencia, plural e datas testados. Sem dependencia de traducao automatica externa.

## MR-03 - Login e conexao Meta demonstraveis

Primeiro incremento concluido localmente em 2026-10-13: [registro MR-03](mr-03/README.md).
Contas PT/EN, manutencao separada, datas, estados/avisos, callback com codigos
seguros e conta conferida. Selecao multipagina, grants e OAuth real/acesso do
analista ainda pendentes. Scopes/host/banco/roles atuais preservados.

- Traduzir login/troca de senha/logout, estados loading/erro e navegacao basica.
  Manter cookies/SameSite/CSRF e validar teclado/acessibilidade.
- Contas: acao OAuth principal clara; formulario manual e importacao do env
  restritos a manutencao tecnica, fora do fluxo do analista. Nunca exibir token salvo.
- Tratar retorno connected/error com resultado traduzido, consumir query params
  apos exibicao e nao refletir mensagem externa arbitraria na UI.
- Mostrar nome/ID/estado da conta realmente salva, nao sucesso generico sem conta.
  Nao fingir conexao/consentimento. Se varias paginas elegiveis, acrescentar selecao
  segura: candidatos associados a sessao, tokens somente no backend e confirmacao
  autenticada/CSRF, sem perder a protecao state de uso unico.
- Mapear permissao recusada/token revogado/expirado e reconexao. Auditar campos
  ignorados pelo upsert e logs OAuth; migration somente se metadata for necessaria.
- Resolver acesso limitado do analista: ambiente isolado inicialmente ou permissoes
  especificas com isolamento real. OAuth hoje exige admin; mudar roles exige testes
  de autorizacao, nao apenas esconder menus. Nao promover operator globalmente.

Aceite: Playwright PT/EN desktop/mobile com OAuth simulado para sucesso,
cancelamento/state invalido/expirado, paginas ausentes/multiplas e falhas. Depois
teste OAuth real autorizado em ambiente de avaliacao; nenhum segredo no browser/log.

## MR-04 - Inbox em ingles e feedback de permissao

Incremento implementado/testado localmente em 2026-10-13:
[registro MR-04](mr-04/README.md). Inbox e Testers DM PT/EN, datas/estados,
codigo seguro para permissao Meta 200, rascunhos/SSE/ledger preservados e
regressoes aprovadas. Aceite manual e teste real autorizado ainda pendentes.

- Traduzir componentes/hooks relevantes, busca/filtros, data, anexos, composer,
  erros e confirmacoes do ledger, mantendo rascunho e bloqueios entre dispositivos.
- Diferenciar erro Meta 200/subcodigo de permissao de falha de rede/entrega incerta:
  backend retorna codigo interno seguro, frontend explica acesso insuficiente.
  Nao marcar como enviado, repetir DM ou instruir cliente comum a virar tester.
- Mostrar permissoes locais sem confundir com acesso avancado do app Meta.
  Nao inferir que aprovacao existe apenas porque token contem scope.

Aceite: cenarios PT/EN de sucesso, rejeicao e timeout; regressao ledger 015,
imagens, nao lidas, SSE/polling e troca de conversa. Screenshot desktop/mobile
sem overflow, sem chave literal e sem mudanca de tamanho por loading/idioma.

## MR-05 - Privacidade, exclusao e seguranca de dados

Entrada para nova sessao: [ponto de retomada MR-05](mr-05/README.md).
MR-02..04 ja publicados na VPS em `f7d52a0`; primeiro incremento webhook MR-05
implementado/testado somente localmente. Retencao/exclusao/politica pendentes.
Priorizar reinspecao/seguranca webhook local e fechar decisoes de dados antes
de declarar politica ou executar exclusao. Deploy futuro exige autorizacao propria.

- Verificar URLs existentes e publicar politica/instrucoes PT/EN acessiveis sem
  sessao, com contato real e links no login. Texto aprovado pelo responsavel;
  documento tecnico nao certifica conformidade legal.
- Inventariar DB/tokens/historico/anexos/cache/ledger/logs/backups; definir retencao
  e processo de exclusao efetivo. Ocultar tester/desativar conta nao apaga dados.
- Se callback Meta for exigido/escolhido, verificar contrato oficial e validar
  signed_request no servidor; idempotencia, protocolo de confirmacao e status
  publico opaco sem revelar dados. Nao abrir rota que apague por ID fornecido
  sem verificacao. Alternativa por instrucoes so se aceita e operacional.
- Revisar revogacao, limpeza de cache, credenciais Meta em repouso, sanitizacao
  de logs e backups. Nao inventar prazo/SLA/criptografia no formulario.
- Exclusao envolve FKs do ledger/historico, tentativas ativas e dados compartilhados;
  exigir desenho transacional, migrations idempotentes se necessarias e teste
  isolado/rollback/backup. Nao usar cascade generalizado em producao.

Aceite: fluxo de pedido de exclusao testado com dados demonstrativos, acesso
publico seguro, auditoria sem dados sensiveis e evidencia dos controles declarados.

## MR-06 - Internacionalizacao dos demais modulos

Usuario confirmou aceite da base e ampliou requisito para todas as partes das
paginas: botoes, textos, avisos, tooltips, estados, confirmacoes e formatadores.
Validacao das telas/etapas de avaliacao em EN, com regressao PT. Nao tratar
menus traduzidos como pagina completamente traduzida.

- Dashboard, Agenda, Historico, detalhes, Uploads, Modelos, Horarios, Usuarios
  e IA em catalogos por dominio; Testers DM entregue no MR-04. Traduzir textos de negocio da UI,
  nao captions/prompts/hashtags ou payloads de publicacao automaticamente.
- Revisar status-dictionary, erros frontend/backend e datas com mesma estrategia.
  Nao alterar formatacao/transporte de horario nem pipeline Reels/worker.
- Escopo expandido de permissao na analise exige video da funcionalidade correspondente.

Aceite: auditoria de strings visiveis, testes por risco/modulo e regressao de
criacao/agendamento, formatos de post e badges. Nao chamar esse marco concluido
enquanto somente login/Inbox estiverem traduzidos.

## MR-07 - Evidencias, deploy e submissao

- Rodar build, lint focado, sintaxe backend, testes de i18n e regressao funcional.
  Lint preexistente e alertas de dependencias registrados, sem upgrades amplos.
- Deploy somente autorizado, com preflight/config real, backup e migrations
  verificadas antes do restart; worker/portas/proxy preservados.
- Gravar fluxo real com tester autorizado, preencher respostas verificadas e
  instrucoes do analista; manter credenciais fora do Git/video, entregar somente
  pelo campo privado apropriado da Meta. Enviar analise apos aceite do dono.

Aceite de envio: todas as permissoes mantidas demonstradas, dados/instrucoes
completos e analista capaz de reproduzir. Aprovacao so depois da decisao Meta.

## Ordem sugerida

MR-01 -> MR-02 -> MR-03 -> MR-04; MR-05 pode avancar apos MR-01 em paralelo
organizacional. Se pedir publicacao/insights nesta submissao, incluir respectivos
modulos de MR-06 antes de MR-07; traducao completa pode seguir incrementalmente
quando a submissao for limitada ao Inbox e suas dependencias.
