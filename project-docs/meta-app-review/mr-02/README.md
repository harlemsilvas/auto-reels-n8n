# MR-02 - Base PT/EN implementada localmente

Data: 2026-10-12, branch `docs/meta-app-review-i18n`.
Estado: base e primeiro incremento de autenticacao/layout implementados/testados;
aceite manual local confirmado pelo usuario (registro em 2026-10-13).
Publicado na VPS em 2026-10-13 na release `f7d52a0`:
[registro do deploy](../deploy-2026-10-13.md). Entradas locais abaixo sao historicas.
MR-01 continua em andamento com dados/topologia/retencao pendentes.

## Entrega atual

- i18next 26.4.4 e react-i18next 17.0.16, versoes fixas no package/lockfile.
  Recursos JSON comuns e auth importados no bundle, sem backend HTTP de traducao,
  detector externo, traducao automatica ou envio de dados a outro servico.
- Portugues pt-BR por padrao/fallback; ingles en explicito pelo seletor acessivel
  com icone Languages, presente no login/troca de senha/layout autenticado.
- Preferencia em localStorage `socialbot.language`, mantida apos login/logout/
  reload e sincronizada entre abas. Nao contem credenciais nem altera permissoes.
  Falha de storage da preferencia permite troca em memoria; nao promete que
  outros recursos do app funcionem com todo storage do navegador desabilitado.
- html.lang e titulo acompanham idioma; chaves tipadas, paridade de catalogos,
  interpolacao/plural testados. Sem chave/dados do usuario traduzidos por heuristica.
- Login/troca de senha/loading/erro, roles locais, aria-labels e menus traduzidos.
  Formularios preservados durante troca de idioma; mensagens de erro usam chave
  de estado, portanto tambem mudam de idioma apos uma falha. Loading bloqueia
  submit enquanto requisicao esta em andamento. Autenticacao/CSRF inalterados.
- Falha de troca de senha mostra fallback seguro traduzido, nao frase externa
  bruta. Confirmacao divergente/senha igual validadas localmente, regra backend
  preservada. Codigos estruturados de erros do backend ainda sao entrega futura.
- formatDateTime/formatNumber centralizam Intl por idioma; datas invalidas e
  numeros nao finitos usam fallback. Nao alteram timestamp/timezone do navegador.
  A migracao das datas nos modulos existentes ainda nao foi executada.
- Nao remonta router/AuthProvider/paginas ao trocar idioma. Teste demonstrou
  rascunho e texto original de DM preservados no Inbox, sem disparar envio.

## Estrutura entregue

```text
dashboard/src/shared/i18n/
  index.ts
  i18next.d.ts
  formatters.ts
  LanguageSelector.tsx
  locales/pt-BR/{common,auth}.json
  locales/en/{common,auth}.json
```

Contas e feedback OAuth agora traduzidos no [incremento MR-03](../mr-03/README.md).
Ainda nao traduzidos: conteudo interno de Inbox, Testers DM, Dashboard,
Uploads, Agenda, Historico, Modelos, Horarios, Usuarios e IA. Menus traduzidos
nao significam traducao dessas telas. Namespace accounts entregue no MR-03;
inbox ainda pendente. Sem arquivos vazios so por plano.

## Validacoes executadas

- `node dashboard/tests/i18n-catalogs.mjs`: chaves, variaveis, plural e fallback.
- `PLAYWRIGHT_MODULE=/tmp/socialbot-ui-check/node_modules/playwright node dashboard/tests/i18n-auth.mjs`:
  desktop/390/320, default PT mesmo com navegador EN, persistencia/reload,
  storage negado/valor invalido, sincronizacao de abas, erro/loading reativos,
  login/logout/CSRF e troca de senha com sucesso/falha via API simulada,
  formulario/rascunho/DM originais preservados, Intl e ausencia de overflow.
- Regressoes Playwright inbox-durable-send e inbox-reliability passaram com API
  simulada. Sem autenticar com senha real ou enviar Meta/DM/IA/publicacao.
- Build TypeScript/Vite e lint dos arquivos alterados passaram; diff-check OK.
  Capturas login 320 e layout mobile inspecionadas; sem sobreposicao de controles.
- Build gera bundle 533.38 kB (160.76 kB gzip), com aviso Vite acima de 500 kB.
  Split de modulos e melhoria futura, sem esconder aviso nem refatorar app agora.
- Instalacao manteve doze alertas npm (nove high); revisao pontual pendente.
  Nenhum upgrade automatico de dependencias alheias ao incremento.

## Ambiente e proximo aceite

Dashboard local http://localhost:5181 iniciado com Vite; API local localhost:3101
iniciada pelo launcher protegido de simulacao (health 200), jobs/worker/Meta
desativados. Usar localhost no navegador, nao misturar com 127.0.0.1.
Nenhum schema/dado foi alterado; release VPS registrada permanece 47a5dac/015.

1. Abrir login, alternar Portugues/English e validar labels/erro/loading.
2. Entrar, conferir navegacao e trocar idioma sem perder rascunho no Inbox.
3. Recarregar e sair: preferencia deve persistir. Conteudo de DM nao e traduzido.

## Status incremental

- [x] Dependencias/catalogos/tipagem e seletor com fallback/persistencia.
- [x] Login, troca de senha, loading e navegacao PT/EN.
- [x] Formatadores Intl e plural preparados/testados.
- [x] Testes locais/regressoes, build/lint e screenshots.
- [x] Aceite manual local pelo usuario.
- [x] MR-03: Contas/feedback OAuth traduzidos; demais gates MR-03 ainda pendentes.
- [ ] MR-04: Inbox completo, datas e erros de permissao traduzidos.
- [ ] MR-06: demais telas e formatadores existentes migrados.
- [ ] Codigos seguros/estaveis de erro API, sem mapear frase bruta.
- [ ] Deploy explicitamente autorizado e evidencias de avaliacao reais.
