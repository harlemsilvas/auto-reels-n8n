# Arquitetura de autenticação e usuários

## Estado atual

O dashboard valida `admin` / `123456` no navegador e grava apenas uma flag no
`localStorage`. O backend não autentica as rotas administrativas. Esse mecanismo
deve ser removido antes de considerar o painel protegido.

## Objetivos

- autenticação no backend;
- senha armazenada apenas com hash forte;
- sessão opaca em cookie `HttpOnly`, `Secure` em produção e `SameSite=Lax`;
- proteção CSRF nas operações de escrita;
- papéis `admin` e `operator`;
- associação opcional de usuários a workspaces;
- auditoria de login e ações administrativas;
- autoria de posts e eventos sem apagar histórico quando o usuário for removido;
- rollout por feature flag, sem interromper o dashboard atual.

## Modelo de dados

- `socialbot_users`: identidade, hash de senha, papel, bloqueio e estado;
- `socialbot_user_workspaces`: acesso e papel por workspace;
- `socialbot_sessions`: hash do token opaco, CSRF, expiração e revogação;
- `socialbot_audit_log`: trilha imutável das ações relevantes;
- `posts.created_by_user_id`: autor original, inicialmente opcional;
- `post_events.actor_user_id`: usuário responsável pelo evento, opcional.

As tabelas usam o prefixo `socialbot_` porque o banco da VPS também contém as
tabelas internas do n8n, inclusive uma tabela chamada `user`.

## Senhas e sessões

- usar `crypto.scrypt` do Node.js com salt aleatório e comparação constante;
- nunca registrar senha, hash, token de sessão ou CSRF em logs;
- gerar token e CSRF com `crypto.randomBytes(32)`;
- persistir apenas SHA-256 dos tokens;
- sessão padrão de 12 horas, renovação controlada e revogação no logout;
- invalidar todas as sessões após troca de senha ou desativação do usuário;
- bloquear temporariamente após tentativas consecutivas inválidas.

## Endpoints planejados

- `POST /api/auth/login`;
- `GET /api/auth/me`;
- `POST /api/auth/logout`;
- `POST /api/internal/users` (`admin`);
- `GET /api/internal/users` (`admin`);
- `PATCH /api/internal/users/:id` (`admin`);
- `POST /api/internal/users/:id/reset-password` (`admin`).

## Rollout seguro

1. aplicar `007-auth-users-foundation.sql` e executar o verificador;
2. implantar backend com `ADMIN_AUTH_ENABLED=false`;
3. criar o primeiro administrador por script CLI, com senha fornecida por
   variável temporária e sem default;
4. implantar login real no dashboard;
5. validar login, logout, expiração, CSRF e permissões;
6. ativar `ADMIN_AUTH_ENABLED=true` na VPS;
7. remover credenciais fixas e a flag do `localStorage`;
8. adicionar autoria às operações de criação e alteração de posts.

## Implementado nesta etapa

- migration `007-auth-users-foundation.sql` e verificador;
- schema inicial alinhado para instalações limpas;
- hash de senha com `crypto.scrypt` e comparação constante;
- sessão opaca com token e CSRF persistidos somente como SHA-256;
- cookie `HttpOnly`, `SameSite=Lax` e `Secure` configurável;
- bloqueio temporário após falhas de login;
- auditoria de login e logout;
- endpoints `status`, `login`, `me`, `csrf` e `logout`;
- middleware condicional de sessão, CSRF e papel;
- script `npm run create-admin`, sem senha padrão;
- dashboard preparado para sessão real e envio de cookies/CSRF;
- fallback legado disponível somente quando o backend declara explicitamente
  `ADMIN_AUTH_ENABLED=false`; falhas de rede não liberam o acesso.

## Bloqueios antes de ativar na VPS

- aplicar migration e criar o primeiro administrador;
- validar todas as rotas internas usadas por serviços, separando autenticação de
  usuário e autenticação de serviço;
- executar teste ponta a ponta com cookie seguro no domínio real.

## OAuth Meta protegido localmente

- login e callback exigem sessão administrativa quando a autenticação está ativa;
- cada início de OAuth gera um `state` aleatório vinculado à sessão e ao usuário;
- o banco armazena somente o SHA-256 do `state`;
- o callback aceita o valor uma única vez e respeita expiração de dez minutos;
- a conexão concluída é registrada na auditoria;
- migration `008-meta-oauth-state.sql` e verificador correspondente preparados;
- migration aplicada e comportamento de consumo único validado somente no banco
  local; nada desta etapa foi aplicado na VPS.

O perfil `operator` já não acessa Contas nem Usuários. A autorização granular de
postagens, métricas e Inbox está planejada em
`docs/features/001-permissoes-granulares.md` e será aplicada por capacidade no
backend, não apenas pela visibilidade do menu.

## Autoria e eventos implementados localmente

- uploads legado e multi-tipo gravam `posts.created_by_user_id` a partir da
  sessão autenticada;
- a criação também gera evento `created` na mesma transação do post e das
  mídias;
- enfileiramento manual, publicação imediata e cancelamento gravam
  `post_events.actor_user_id`;
- processos automáticos mantêm ator nulo e são identificados pelo campo
  `source` dos detalhes;
- posts legados continuam válidos com autoria nula;
- API de posts retorna identificação e nome do criador;
- API de eventos retorna identificação e nome do responsável;
- dashboard exibe o criador no agendamento e o responsável nos detalhes do
  histórico.

Esta etapa depende da migration `007` e está validada apenas localmente. Não foi
aplicada nem ativada na VPS.

## Informativo da sessão implementado

O cabeçalho exibe junto ao botão “Sair” um resumo da sessão atual com:

- nome de exibição, usando o username como fallback;
- papel atual (`Administrador` ou `Operador`);
- layout compacto e responsivo para não comprometer o cabeçalho em telas
  menores;
- dados vindos do contexto autenticado e de `/api/auth/me`, sem nova consulta
  sensível ou armazenamento paralelo no navegador.

Lint do componente e build de produção do dashboard foram aprovados.

## Gestão de usuários implementada

- troca obrigatória de senha com revogação de todas as sessões;
- bloqueio backend das APIs enquanto `force_password_change=true`;
- listagem de usuários restrita a administradores;
- criação com senha temporária e papel `admin` ou `operator`;
- edição de nome, e-mail, papel e estado ativo;
- proteção contra o administrador atual desativar ou rebaixar a si mesmo;
- redefinição administrativa de senha com revogação de sessões;
- menu e página de usuários visíveis apenas para administradores;
- eventos de auditoria para criação, atualização, redefinição e troca de senha.

## Teste local recomendado

1. iniciar Docker Desktop e habilitar a integração com a distribuição WSL;
2. aplicar `007-auth-users-foundation.sql` no PostgreSQL local;
3. executar `007-auth-users-foundation-verify.sql`;
4. criar o primeiro administrador com `npm run create-admin`, fornecendo a senha
   somente por variável temporária;
5. configurar localmente `ADMIN_AUTH_ENABLED=true` e
   `ADMIN_AUTH_COOKIE_SECURE=false`;
6. reiniciar apenas backend e dashboard locais;
7. validar login, redirecionamento para troca obrigatória, novo login, criação
   de operador, bloqueio de rota administrativa, logout e expiração;
8. voltar a flag para `false` se qualquer etapa falhar.

## Rotas públicas após ativação

- health check estritamente necessário;
- webhook do Instagram;
- callback OAuth da Meta, protegido por `state`;
- login/logout e consulta da sessão.

As demais rotas administrativas devem exigir sessão válida. Endpoints chamados
apenas internamente deverão receber autenticação de serviço separada, não uma
sessão de usuário.
