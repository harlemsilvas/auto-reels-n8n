# 📱 SocialBot

**Plataforma para gerenciamento, agendamento e automação de publicações no Instagram, integrando backend, banco de dados, filas, automações e APIs externas.**

O **SocialBot** nasceu como uma solução para automatizar a publicação de Reels e evoluiu para uma arquitetura preparada para trabalhar com diferentes formatos de conteúdo do Instagram.

O projeto combina desenvolvimento backend, automação, filas de processamento, banco de dados e infraestrutura para criar um fluxo controlado de gerenciamento e publicação de conteúdo.

---

## 🎯 Objetivo

Centralizar e automatizar processos relacionados à publicação de conteúdo em redes sociais, reduzindo tarefas manuais e criando uma infraestrutura capaz de evoluir para múltiplas contas e diferentes formatos de publicação.

O desenvolvimento preserva o fluxo funcional existente de Reels enquanto novos tipos de publicação são incorporados gradualmente.

---

## ✨ Funcionalidades

Entre os recursos implementados e em evolução estão:

- Upload e gerenciamento de mídia
- Cadastro e gerenciamento de publicações
- Agendamento de conteúdo
- Processamento assíncrono de tarefas
- Filas de publicação
- Worker dedicado
- Integração com PostgreSQL
- Integração com Redis
- Automação de processos
- Dashboard administrativo
- Gerenciamento de contas
- Estrutura para múltiplos workspaces
- Histórico e acompanhamento de publicações

O modelo de dados já contempla diferentes tipos de publicação:

- Reels
- Imagens no Feed
- Carrosséis
- Stories com imagem
- Stories com vídeo

A evolução desses formatos é realizada de forma incremental para preservar compatibilidade com o fluxo de Reels já existente.

---

## 📸 Screenshots

> As capturas serão adicionadas após a seleção das principais telas para apresentação pública.

### Dashboard

`docs/screenshots/dashboard.png`

### Gestão de Publicações

`docs/screenshots/posts.png`

### Upload e Agendamento

`docs/screenshots/scheduler.png`

### Gestão de Contas

`docs/screenshots/accounts.png`

### Métricas / Acompanhamento

`docs/screenshots/metrics.png`

---

## 🚀 Tecnologias

### Backend

- Node.js
- Express 5
- PostgreSQL
- Axios
- Multer
- dotenv

### Filas e Automação

- BullMQ
- Redis
- ioredis
- node-cron
- n8n

### Infraestrutura

- Docker
- Docker Compose
- Linux
- Git
- GitHub

### Integrações

- APIs externas para publicação e gerenciamento de conteúdo
- Automações n8n
- Serviços de mídia

---

## 🏗️ Arquitetura

O projeto é organizado em componentes independentes para API, dashboard, banco de dados, automações e processamento assíncrono.

```text
auto-reels-n8n/
│
├── backend/
│   ├── src/
│   │   ├── modules/
│   │   ├── routes/
│   │   ├── providers/
│   │   ├── server.js
│   │   └── worker.js
│   │
│   ├── sql/
│   └── scripts/
│
├── dashboard/
│
├── postgres-init/
│
├── config/
│
├── docs/
│
├── docker-compose.yml
│
└── README.md
```

---

## 🔄 Fluxo Geral

De forma simplificada, uma publicação percorre o seguinte fluxo:

```text
Usuário
   │
   ▼
Dashboard
   │
   ▼
Backend / API
   │
   ├── PostgreSQL
   │
   ├── Upload de mídia
   │
   └── Fila de processamento
           │
           ▼
        BullMQ
           │
           ▼
         Worker
           │
           ▼
   Automação / Integração
           │
           ▼
       Instagram
```

Essa separação permite que tarefas demoradas ou dependentes de APIs externas sejam processadas fora do fluxo principal da aplicação.

---

## 🎬 Publicações

O projeto começou com foco na publicação automática de **Reels**.

O fluxo existente mantém compatibilidade com publicações de vídeo enquanto a estrutura de dados evolui para suportar outros formatos.

O modelo atualmente prevê:

```text
reel
feed_image
feed_carousel
story_image
story_video
```

Para publicações com múltiplos arquivos, o projeto possui estrutura específica para itens de mídia associados à publicação.

---

## ⚙️ Backend

O backend é responsável por:

- API da aplicação
- Upload de arquivos
- Gestão de publicações
- Gestão de contas
- Agendamento
- Comunicação com PostgreSQL
- Integração com Redis
- Enfileiramento de tarefas
- Processamento através de workers

Execução em desenvolvimento:

```bash
cd backend
npm install
npm run dev
```

Execução normal:

```bash
npm start
```

Worker:

```bash
npm run worker
```

---

## 🗄️ Banco de Dados

O SocialBot utiliza **PostgreSQL** para persistência.

A estrutura contempla informações relacionadas a:

- contas;
- workspaces;
- publicações;
- uploads;
- itens de mídia;
- agendamentos;
- status de publicação;
- informações operacionais.

As alterações estruturais do banco são controladas através de scripts SQL e migrations versionadas.

---

## 📬 Filas e Processamento Assíncrono

O projeto utiliza:

**BullMQ + Redis**

para separar o processamento de tarefas do fluxo principal da API.

Essa arquitetura permite controlar melhor processos como:

- publicações agendadas;
- processamento de jobs;
- tentativas de execução;
- workers independentes;
- tarefas que dependem de serviços externos.

---

## 🤖 Automação

O projeto utiliza **n8n** como parte da infraestrutura de automação.

A arquitetura permite integrar fluxos da aplicação com processos externos sem concentrar toda a lógica de automação diretamente no backend.

---

## 🐳 Infraestrutura

O repositório possui configuração com Docker Compose para os serviços utilizados pelo projeto.

Os ambientes local e de produção são tratados separadamente para evitar que configurações específicas de desenvolvimento sejam propagadas indevidamente para a infraestrutura de produção.

---

## 🔐 Configuração e Segurança

Credenciais, tokens, senhas e configurações específicas de ambiente não devem ser armazenados diretamente no código.

A aplicação utiliza variáveis de ambiente para configurações sensíveis.

Antes de publicar ou clonar o projeto, configure corretamente os arquivos de ambiente necessários.

---

## 🧭 Evolução para múltiplos formatos

Uma das evoluções arquiteturais do SocialBot é permitir que o sistema deixe de trabalhar exclusivamente com Reels.

A estrutura está sendo preparada para suportar:

```text
Reels
   ↓
Feed Image
   ↓
Feed Carousel
   ↓
Story Image
   ↓
Story Video
```

Essa evolução é realizada sem remover o fluxo já funcional de publicação de Reels.

---

## 📖 Documentação

O projeto mantém documentação complementar na pasta:

```text
docs/
```

Também existem documentos de continuidade utilizados para registrar decisões técnicas, estado atual e próximas etapas do desenvolvimento.

---

## 🎯 Conhecimentos Demonstrados

O SocialBot demonstra na prática conhecimentos em:

- Node.js
- Express
- APIs REST
- PostgreSQL
- Redis
- BullMQ
- Processamento assíncrono
- Workers
- Filas
- Upload de arquivos
- Automação de processos
- n8n
- Integração com APIs externas
- Docker
- Linux
- Arquitetura de sistemas
- Integração entre serviços
- Git e GitHub

---

## 📌 Status

**Em desenvolvimento ativo.**

O fluxo de Reels é preservado enquanto a plataforma evolui para uma arquitetura mais ampla de gerenciamento e publicação de conteúdo.

---

## 👨‍💻 Autor

**Harlem Afonso Claumann Silva**

Analista de Sistemas | Desenvolvedor de Software | Integrações

GitHub:
https://github.com/harlemsilvas
