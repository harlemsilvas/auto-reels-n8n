# Feature 002 — Modelos de mídias com textos por IA e criação por TAG

Data: 2026-07-13
Status: em implementação — fundação de banco, CRUD backend, variações manuais,
geração local em modo teste, interface autenticada, upload de mídia para modelos
e criação inicial de post por TAG

## Objetivo

Adicionar ao SocialBot uma biblioteca de modelos/campanhas reutilizáveis por
TAG. Um modelo guarda mídias aprovadas, dados comerciais e variações de texto
assistidas por IA. Ao criar uma postagem, o usuário poderá buscar a TAG,
carregar mídias e legenda sugerida, revisar e publicar/agendar usando o fluxo
atual de posts.

## Decisão inicial

Implementar dentro do SocialBot, no PostgreSQL atual, sem integrar diretamente o
banco do `otimizador_skills`. O outro projeto fica como referência conceitual
para:

- imagem-modelo;
- dados reais do produto;
- regras para a IA não inventar;
- prompt salvo para auditoria;
- modo teste/provedor configurável em fase futura.

## Escopo da primeira implementação

Esta primeira etapa cria a fundação persistente e o CRUD backend inicial:

- `media_templates`;
- `media_template_items`;
- `media_template_text_variants`;
- vínculos opcionais em `posts`:
  - `media_template_id`;
  - `media_template_text_variant_id`.
- rotas de listagem, criação, edição, aprovação, arquivamento e itens de mídia.
- rotas de criação, edição, aprovação e rejeição de variações de texto.
- página autenticada `/modelos` no dashboard para consumir os endpoints.
- endpoint inicial para criar postagem a partir de TAG, modelo ativo, variação
  aprovada e mídias já vinculadas ao modelo.
- endpoint e interface inicial para anexar JPG, JPEG, PNG ou MP4 ao modelo.
- endpoint e interface para gerar sugestão de texto em modo teste, sem provedor
  externo de IA e sem publicação automática.

Não altera worker, n8n nem publicação real nesta etapa.

## Fluxo alvo

```text
TAG cadastrada
↓
Modelo ativo com mídias aprovadas
↓
Texto gerado ou aprovado por IA
↓
Usuário cria post a partir da TAG
↓
Sistema copia texto/mídias para o post
↓
Post segue fluxo atual de agendamento/publicação
```

## Status dos arquivos

- Proposta completa local: `docs/features/002-modelos-midias-ia-tags.md`
  - atenção: `/docs/` é ignorado pelo `.gitignore` para arquivos novos.
- Documento versionável: este arquivo em `project-docs/features/`.
- Migration: `backend/sql/010-media-templates.sql`.
- Verificador: `backend/sql/010-media-templates-verify.sql`.
- Backend:
  - `backend/src/modules/media-templates/media-templates.service.js`;
  - `backend/src/modules/media-templates/media-templates.routes.js`;
  - `backend/src/modules/auth/permissions.service.js`;
  - `backend/src/app.js`.

## Endpoints implementados

Endpoints principais:

- `GET /api/media/templates`;
- `GET /api/media/templates/by-tag/:tag`;
- `GET /api/media/templates/:id`;
- `POST /api/media/templates`;
- `PATCH /api/media/templates/:id`;
- `POST /api/media/templates/:id/approve`;
- `DELETE /api/media/templates/:id`;
- `POST /api/media/templates/:id/items`;
- `POST /api/media/templates/:id/media-upload`;
- `DELETE /api/media/templates/:id/items/:itemId`.
- `POST /api/media/templates/:id/text-variants`;
- `POST /api/media/templates/:id/text-variants/generate`;
- `PATCH /api/media/templates/:id/text-variants/:variantId`;
- `POST /api/media/templates/:id/text-variants/:variantId/approve`;
- `DELETE /api/media/templates/:id/text-variants/:variantId`.
- `POST /api/media/templates/by-tag/:tag/posts`.

Alias temporário para facilitar testes:

- `/api/media-templates`.

## Permissões já registradas

- `media_templates.view`;
- `media_templates.create`;
- `media_templates.update`;
- `media_templates.approve`;
- `media_templates.generate_ai_text`;
- `media_templates.create_post`.

Admin recebe todas. Operador recebe inicialmente:

- `media_templates.view`;
- `media_templates.create_post`.

Na interface:

- o menu `Modelos` aparece para usuários com `media_templates.view`;
- criação de modelo exige `media_templates.create`;
- criação/rejeição de variação exige `media_templates.update`;
- geração de sugestão em modo teste exige `media_templates.generate_ai_text`;
- aprovação exige `media_templates.approve`.

## Próximas fases planejadas

1. Preparar deploy incremental da interface atual para VPS, preservando
   migrations já aplicadas.
2. Evoluir o gerador para provedor de IA configurável, mantendo modo teste e
   aprovação humana obrigatória.
3. Criar gestão mais fina de permissões para operadores.

## Segurança

- Não versionar tokens, chaves de IA ou exemplos com credenciais reais.
- A IA não publica diretamente.
- O usuário revisa e aprova o conteúdo antes de gerar postagem.
- O post deve copiar o texto final usado, preservando histórico mesmo se o
  modelo mudar depois.

## Atualização 2026-07-13 — geração local em modo teste

Foi implementado o primeiro gerador de sugestão de texto para os modelos, ainda
sem chamada a provedor externo de IA.

Backend:

- `POST /api/media/templates/:id/text-variants/generate`;
- permissão exigida: `media_templates.generate_ai_text`;
- função `generateTextVariantDraft`;
- status inicial da variação: `generated`;
- usa dados do modelo (`product_name`, descrição base, público-alvo, claims
  permitidos, claims proibidos, CTA e hashtags);
- salva `prompt_sent` e `ai_response` em formato seguro, sem tokens ou chaves;
- registra auditoria `media_templates.text_variant_generated_local`.

Dashboard:

- botão "Gerar sugestão em modo teste" na seção "Nova variação de texto";
- reaproveita tipo de publicação, tom, objetivo, título e CTA informados pelo
  usuário;
- informa que a sugestão deve ser revisada e aprovada antes do uso.

Validação executada:

- `node --check` em `media-templates.service.js`;
- `node --check` em `media-templates.routes.js`;
- `npm run build` no dashboard via WSL.

Decisão de segurança: esta etapa não publica, não enfileira e não chama IA
externa. A variação gerada só pode virar postagem após aprovação humana e uso no
fluxo de criação por TAG.

## Atualização 2026-07-13 — revisão e edição de variações

Foi implementada a primeira interface de revisão das variações de texto na tela
`/modelos`.

Dashboard:

- botão "Revisar" em cada variação;
- legenda exibida com quebra de linha e área rolável, evitando tabela
  espremida;
- formulário de edição para tipo de publicação, tom, objetivo, título, legenda,
  hashtags e CTA;
- botão "Salvar revisão", que grava a variação como `generated`;
- botão "Salvar e aprovar", disponível somente para usuários com
  `media_templates.approve`;
- botão para cancelar edição sem alterar dados.

Backend:

- reaproveita o endpoint já existente
  `PATCH /api/media/templates/:id/text-variants/:variantId`;
- não exige migration nova;
- não altera worker, n8n ou publicação real.

Validação executada:

- `npm run build` no dashboard via WSL.

## Atualização 2026-07-13 — fluxo guiado na tela de modelos

Após validação manual, a página `/modelos` recebeu melhorias para reduzir a
sensação de tela longa e sem direção.

Dashboard:

- barra de etapas clicáveis no topo da página;
- fases: Buscar, Conferir modelo, Mídias, Textos e Criar post;
- ao clicar em "Abrir", o modelo é selecionado e a tela rola para os detalhes;
- ao clicar em "Revisar", a tela rola para o formulário de edição da variação;
- cada seção principal ganhou cabeçalho com fase, descrição e cor lateral;
- foram adicionados botões de próximo passo nas seções intermediárias.

Backend:

- não houve alteração;
- não houve migration nova;
- não houve alteração de worker, n8n ou publicação real.

Validação executada:

- `npm run build` no dashboard via WSL.

Decisão de segurança: editar uma variação aprovada por "Salvar revisão" volta o
texto para `generated`, exigindo nova aprovação antes de criar postagens.

## Atualização 2026-07-13 — prévia da postagem por TAG

Foi implementada uma prévia visual antes da criação final da postagem pela TAG.

Dashboard:

- a seção "Criar postagem pela TAG" agora mostra status inicial previsto
  (`pending` ou `scheduled`);
- exibe tipo de publicação, quantidade de mídias, data de agendamento, título,
  legenda, CTA e hashtags;
- lista as mídias que serão copiadas para a postagem, com ordem, tipo, papel,
  arquivo e tamanho;
- bloqueia o botão de confirmação quando o modelo não está ativo, não possui
  mídia ou não há variação aprovada;
- o botão passou a ser "Confirmar criação da postagem", deixando mais claro que
  a prévia é a última etapa antes de gravar o post.

Backend:

- não houve alteração;
- o fluxo continua usando `POST /api/media/templates/by-tag/:tag/posts`;
- não houve migration nova, alteração de worker, n8n ou publicação real.

Validação executada:

- `npm run build` no dashboard via WSL.

## 2026-07-15 — Uso recente por TAG

Foi adicionada uma melhoria da Fase E para mostrar, dentro do detalhe do modelo, as postagens recentes criadas a partir daquela TAG/modelo.

Comportamento:

- `GET /api/media/templates/:id` com detalhes agora retorna `recentPosts`;
- cada item mostra título, status, tipo de publicação, agendamento, criação, publicação, criador e quantidade de mídias;
- a tela `/modelos` exibe a seção `Uso recente da TAG` logo abaixo das mídias do modelo;
- não há alteração de schema, worker, fila ou publicação.

Objetivo:

- facilitar auditoria operacional;
- confirmar se um modelo/TAG já está sendo usado para gerar posts;
- preparar métricas futuras por campanha/TAG.
