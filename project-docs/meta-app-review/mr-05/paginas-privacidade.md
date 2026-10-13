# MR-05 — Privacidade e instruções de exclusão PT/EN

Revisão local preparada em 2026-10-13. Texto PT/EN confirmado pelo usuário na
sequência; avisos de rascunho removidos localmente. Não publicada. Esse aceite
não constitui parecer jurídico, aprovação Meta ou exclusão executada.

## Entrega preparada

Arquivos estáticos em `dashboard/public/`, copiados pelo build sem depender
de React, autenticação, JavaScript ou serviços externos:

| Página | Português | Inglês |
| --- | --- | --- |
| Privacidade | `/privacy.html` | `/privacy.en.html` |
| Instruções de exclusão | `/data-deletion.html` | `/data-deletion.en.html` |

Usar `http://localhost:5181` como base na simulação local, inclusive no Chrome.
Idioma escolhido por links com lang/hreflang e aria-current, sem cookies nem
armazenamento nessas páginas. Links entre privacidade e exclusão preservam o
idioma. Login mostra os dois links conforme PT/EN selecionado; sem alteração
de autenticação, CSRF, sessão, OAuth, banco ou envio.

## Revisão de conteúdo

- Política pública existente `https://midia.hrmmotos.com.br/privacy.html` lida
  novamente por curl HTTPS em 2026-10-13, depois de falha da ferramenta web.
  Texto de 15/05/2026 com foco publicação/contato antigo não cobria Inbox/ledger.
  Página remota intacta; novo texto é preparado localmente.
- Razão social HRM MOTOS PECAS E ACESSORIOS LTDA e contato
  exclusao@hrmmotos.com.br/alias vendas incorporados conforme relato do dono.
- Incluídos uso interno/contas próprias, DMs, anexos, perfis, eventos, tentativas,
  sessões/auditoria, posts/modelos/métricas e cópias. Finalidades e destinatários
  Meta/Hostinger/n8n/Gemini/e-mail descritos sem presumir envio automático de DM à IA.
- Retenção descreve o estado operacional real: prazos/execução em revisão,
  sem rotina geral de expiração aplicada. Números do planejamento não foram
  anunciados como controles existentes; links temporários não apagam histórico.
- Segurança não declara criptografia total/tokens Meta/backup nem aprovação
  de acesso avançado. Não acrescentada coleta analítica nas páginas.
- Instruções: e-mail, username/conta envolvida e período quando necessário,
  escopo pedido e verificação proporcional. Sem senha/token/documento automático,
  formulário que capture dados, endpoint que apague por ID livre ou SLA inventado.
- Revogação Meta não equivale a exclusão do histórico; atendimento e limites de
  guarda/backups precisam confirmação operacional do dono. Não enviamos e-mail
  nem executamos qualquer pedido externo nesta etapa.
- Termos oficiais Meta/callback ficaram indisponíveis na consulta desta sessão.
  O texto foi baseado no inventário e fatos confirmados do produto. Contrato
  aplicável deve ser conferido antes de declarar conformidade/submeter.

## Validações realizadas

- Build TypeScript/Vite passou; quatro HTML e CSS presentes no dist.
  Bundle 551.15 kB/166.49 kB gzip; aviso anterior >500 kB mantido.
- Catalogos i18n/paridade PT/EN passaram; lint Login e sintaxe teste passaram.
- `dashboard/tests/privacy-pages.mjs`, Playwright externo, passou desktop 1440,
  mobile 390/320: páginas HTTP 200 sem sessão/JavaScript, idioma, navegação,
  contato mailto, sem formulário/script e sem overflow. APIs do login simuladas.
  Links do login PT/EN e navegação para exclusão verificados sem credenciais reais.
- Revisão anterior de privacy PT/EN no navegador também passou sem JavaScript;
  captura mobile de exclusão EN inspecionada. Chromium é ferramenta do teste,
  não dependência que o usuário de Chrome precisa instalar.
- Diff-check e links locais do registro passaram. Nenhum teste Meta real.

## Gates antes de publicar

1. Responsável revisar e aceitar textos PT/EN, confirmar outros acessos e
   operadores/localizações ainda pendentes e processo proporcional do pedido.
2. Implementar/testar exclusão demonstrativa (DB, ledger, arquivos, eventos,
   resumos, cache e cópias), sem tratar e-mail ou página como exclusão concluída.
3. Verificar tipo de URL/instruções/callback aceito no painel e contrato Meta.
   Estas páginas são GET de instruções, não callback POST com signed_request.
4. Escolher publicação no host real inspecionado. Build dashboard publicaria
   no host do dashboard; não atualiza sozinho o arquivo no host de mídia.
   URLs remotas de exclusão ainda não existem como entrega confirmada.
5. Deploy exige autorização própria; preservar versão anterior e configuração,
   remover aviso de revisão somente após aceite e testar acesso público PT/EN.
6. Atualizar URLs no painel Meta somente após publicação e teste; nenhum campo
   do painel foi alterado. Aprovação do app depende da Meta, não da existência
   dessas páginas. MR-05 permanece aberto.
