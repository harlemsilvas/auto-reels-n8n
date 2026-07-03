# Feature: permissões granulares por capacidade

## Fase 1 implementada em 2026-07-02

A primeira matriz foi implementada de forma estática e versionada no código,
sem migration adicional:

- backend calcula capacidades efetivas a partir do papel;
- login e `/api/auth/me` devolvem `permissions`;
- middleware `requirePermission()` nega por padrão e responde HTTP 403 com o
  código `PERMISSION_DENIED`;
- com autenticação desligada, o middleware mantém compatibilidade de rollout;
- dashboard monta menus e protege rotas usando as capacidades devolvidas pelo
  backend.

Template atual do operador:

- pode visualizar, criar, agendar, publicar e cancelar posts;
- pode visualizar conversas e mensagens do Inbox;
- não pode visualizar Dashboard, Histórico ou endpoints de métricas;
- não pode responder mensagens por nenhuma das rotas de envio conhecidas;
- não pode acessar Testers DM;
- não pode alterar horários globais;
- não pode gerenciar contas ou usuários.

Também foi protegida `/api/internal/posts/events`, pois eventos de coleta
poderiam expor dados de métricas indiretamente.

Esta fase ainda não implementa concessões por usuário ou workspace. As tabelas
propostas abaixo permanecem como evolução futura.

## Motivação

Os papéis `admin` e `operator` são apenas modelos iniciais. Um operador pode,
por exemplo, criar e agendar postagens sem poder visualizar métricas, responder
mensagens, alterar tokens Meta ou administrar usuários.

Por isso, a autorização futura deve verificar capacidades específicas no
backend. Esconder itens do menu é apenas uma melhoria de interface, não uma
barreira de segurança.

## Capacidades candidatas

### Publicações

- `posts.view`;
- `posts.create`;
- `posts.schedule`;
- `posts.publish_now`;
- `posts.cancel_own`;
- `posts.cancel_any`;
- `posts.delete`.

### Histórico e métricas

- `history.view`;
- `metrics.view`;
- `metrics.collect`.

### Inbox

- `inbox.view`;
- `inbox.reply`;
- `inbox.manage_testers`.

### Configuração

- `accounts.view`;
- `accounts.manage`;
- `accounts.manage_tokens`;
- `schedule_slots.manage`;
- `users.manage`;
- `audit.view`.

## Modelo sugerido

- `socialbot_permissions`: catálogo versionado de capacidades;
- `socialbot_role_permissions`: permissões padrão de cada papel;
- `socialbot_user_permissions`: concessões ou negações específicas por usuário;
- permissões efetivas calculadas no backend e devolvidas por `/api/auth/me`;
- middleware `requirePermission('posts.create')` em cada endpoint;
- menu e botões renderizados a partir das permissões efetivas.

## Templates iniciais

### Administrador

Todas as capacidades.

### Operador de conteúdo

- visualizar, criar e agendar posts;
- cancelar apenas posts permitidos pela política definida;
- visualizar histórico operacional necessário;
- sem métricas por padrão;
- sem resposta no Inbox por padrão;
- sem usuários, contas, tokens ou configurações.

Outros perfis poderão ser compostos depois, como `analyst`, `support` e
`content_manager`, sem criar condicionais espalhadas pelo código.

## Questões para decisão antes da implementação

- operador altera apenas posts próprios ou todos do workspace?;
- operador pode publicar imediatamente ou apenas agendar?;
- histórico mostra somente ações próprias ou do workspace?;
- leitura do Inbox e resposta devem ser permissões independentes?;
- métricas podem ser liberadas por conta, workspace ou usuário?;
- quem pode conceder uma permissão fora do template do papel?;

## Critérios de segurança

- toda autorização ocorre no backend;
- negar por padrão quando a capacidade estiver ausente;
- registrar concessões, remoções e ações sensíveis em auditoria;
- preservar autoria mesmo após desativação do usuário;
- impedir que o último administrador remova o próprio acesso;
- testar matriz de permissão por endpoint antes do rollout.
