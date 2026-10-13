# MR-01 - Inventario tecnico de dados

Escopo: codigo local inspecionado, sem ler registros, backups ou .env. Nao e
certificacao de seguranca/conformidade nem prova de configuracao efetiva da VPS.

## Responsavel e politica informados

- Razao social declarada pelo dono: HRM MOTOS PECAS E ACESSORIOS LTDA.
- Contato declarado para privacidade/exclusao: exclusao@hrmmotos.com.br.
  Dono confirmou recebimento: alias de vendas@hrmmotos.com.br, com atendimento
  pessoal pelo proprio dono. Nenhum e-mail de teste enviado pelo agente.
- [Politica publica](https://midia.hrmmotos.com.br/privacy.html) lida via HTTPS
  sem sessao em 2026-10-12. Ferramenta web nao conseguiu abrir; leitura publica
  via curl teve sucesso. Sem alterar pagina/servidor nesta rodada.
- Texto publicado informa atualizacao em 15/05/2026 e foco em publicacao;
  nao descreve Inbox/DMs/ledger. Identifica responsavel genericamente e usa
  contato@hrmmotos.com.br. Retencao sem prazos concretos; secao 13 orienta
  pedidos por e-mail, mas nao detalha verificacao, atendimento ou exclusao de copias.
- Dono informou nao existir pagina dedicada de exclusao. Revisar politica e
  preparar instrucoes operacionais PT/EN em MR-05, com aprovacao do responsavel.
  Nao afirmar que nao ha nenhuma orientacao: a politica ja possui secao breve.
- Nao verificadas configuracoes legais no painel Meta, caixa de e-mail,
  identidade documental, contratos ou execucao de exclusao. Sem declarar conformidade.

## Hospedagem, e-mail e backups declarados

- VPS hospedada na Hostinger, conforme dono; nao reinspecionados contrato,
  entidade legal contratada, regiao, acessos ou controles da infraestrutura.
- Backups atuais ficam na propria VPS. Deploys anteriores registram dumps e
  backups de release/config protegidos por permissao; isso nao prova criptografia,
  rotacao, copia externa ou recuperacao apos perda da VPS.
- Dono sugeriu copia local pelo aplicativo se necessario. Registrar como
  possibilidade futura: nao identificado/implementado fluxo de download de
  backup no dashboard nesta entrega, nem instituida rotina externa periodica.
  Script existente pode gerar dump; eventual transferencia segura exige etapa
  propria e nao deve expor download de DB/tokens a operadores gerais do Inbox.
- VPS perdida pode levar tambem seus backups. Definir destino externo seguro,
  acesso, criptografia, retencao e teste de restore antes de afirmar recuperacao.
- Provedor de e-mail nao informado. Alias de vendas nao e caixa isolada;
  confirmar quem acessa a caixa principal e evitar pedir DMs/documentos extras
  desnecessarios para identificar e atender o pedido.

## Categorias e ciclo de vida observado

Dono confirmou em 2026-10-12 que ainda nao ha prazo definido para guardar DMs,
imagens, logs e backups. Nao afirmar exclusao automatica ou prazo de atendimento
ja estabelecido. A ausencia de prazo e estado atual, nao politica futura aprovada.
TTL de cache/capacidade e expiracao de sessao nao removem historico, ledger ou copias.

| Categoria | Persistencia/destino | Finalidade e limite observado | Evidencia |
| --- | --- | --- | --- |
| Usuarios internos | socialbot_users: username/nome/email opcional/role/hash de senha/status | Login administrativo; hash scrypt, nao senha em texto claro | auth/password.service.js e admin-auth.repository.js |
| Sessoes e auditoria | socialbot_sessions e socialbot_audit_log: hashes, IP, user-agent, eventos/details | Controle de sessao/auditoria; expirar/revogar nao prova remocao fisica | auth/admin-auth.repository.js |
| Cookie/CSRF | Cookie HttpOnly/SameSite Lax; Secure configuravel; CSRF em sessionStorage | Autenticacao real; configuracao Secure da VPS nao reinspecionada | auth/admin-auth.routes.js e dashboard AuthContext |
| OAuth | socialbot_oauth_states: hash state, sessao/usuario/IP/expiracao/consumo | State de dez minutos; limpeza local de usados/expirados por sessao durante novo fluxo | auth/meta-oauth.service.js |
| Contas Meta | instagram_accounts: nome, Instagram ID, Page ID, token, expiracao/workspace/status | Token necessario no servidor; upsert grava access_token diretamente. Sem criptografia aplicacional Meta identificada nesse caminho | accounts/accounts.service.js |
| Eventos webhook brutos | webhook_events.payload JSON; controller tambem imprime body | Rastreamento/recebimento; conteudo/IDs/URLs podem estar duplicados em DB e logs | webhooks/instagram-messages.repository.js e controller.js |
| Conversas/mensagens | instagram_conversations e instagram_messages: IDs, texto, payload, datas/nao lidas/perfil | Historico/atendimento; payload/raw_payload conforme schema | webhooks repository e conversations service |
| Tentativas de texto | instagram_send_attempts: texto/hash/conversa/destinatario/estado/ID Meta/recibo | Protecao contra reenvio; texto original permanece, hash nao anonimiza registro | inbox/message-send-attempts.js e sql/015 |
| Rascunho de entrega incerta | sessionStorage por usuario/conta/conversa, texto e metadata | Recuperacao local; fechar aba e limites de storage nao apagam ledger servidor | dashboard/modules/inbox/uncertain-send.ts |
| Perfil opcional | Memoria do processo: nome/username/chave por conta/destinatario/fingerprint da credencial | TTL positivo uma hora/negativo cinco minutos, ate 500 entradas; TTL nao e exclusao do historico | conversations/instagram-profile-cache.js |
| Imagem enviada | Arquivo privado JPG/PNG normalizado, metadata em payload; URL capacidade temporaria | Arquivo 0600/diretorio 0700, EXIF removido; capacidade quinze minutos, nao prazo de retencao do arquivo | inbox/inbox-images.service.js |
| Anexo recebido | URL/metadata no evento/historico, exibidos ao operador | URL pode expirar; nao identificado arquivo permanente de download nesse fluxo | webhooks service e dashboard message-content.ts |
| Posts/modelos/metricas | Tabelas de produto, midias/prompts/textos/eventos e contadores | Publicacao/geracao/medicao; incluir no inventario global mesmo se pedido inicial for Inbox | media-templates, posts e metrics |
| Credencial IA | Credencial criptografada com AES-256-GCM no modulo de IA | Protecao especifica de IA, nao extensivel por declaracao aos tokens Meta/DB/backup | ai-credentials/ai-credentials.crypto.js |
| Backups | pg_dump do banco; workflow tambem copia configuracao e release | Modo protegido em deploy anterior registrado; sem retencao/rotacao ou criptografia do dump comprovadas | scripts/backup_postgres_db.sh e deploy-vps.yml |

Caminhos de evidencia relativos a `backend/src/modules/`, exceto onde explicitado.
Ausencia de rotina identificada nao prova que nao exista operacao externa; confirmar
com responsavel antes de preencher formulario.

## Fluxos para outros sistemas

| Destino | Dado enviado/recebido no codigo | Confirmacao pendente |
| --- | --- | --- |
| Meta | Autorizacao/token; IDs/perfis; destinatario/texto/URL de imagem; mensagens/events inbound; posts/metricas nos respectivos fluxos | Conta/app, finalidade permitida, acesso avancado e grants reais |
| PostgreSQL/filesystem/Redis | Persistencia interna e filas de trabalho | Hospedagem real, acessos, TLS interno, disco/backup criptografado e localizacao |
| n8n | publish.worker.js envia post/jobData para webhook de publicacao; logs mascaram campos conhecidos de token | Conteudo completo do job, workflow efetivo, credenciais/destinatarios/logs/retencao; nao reinspecionado n8n |
| Google Gemini | Gerador envia descricao de produto/TAG/nome/claims/publico/observacoes/CTA para gerar texto | Contrato/regiao/politica e conteudo livre informado por usuarios; nao identificado encaminhamento automatico de DMs nesse caminho |
| Hostinger / hospedagem e backups | VPS e backups na propria VPS conforme relato do dono; dados acima podem ser acessiveis a operadores de infraestrutura | Entidade contratual, regiao, suboperadores/acessos e eventual copia externa a confirmar |
| Provedor de e-mail, ainda nao informado | Pedidos enviados a exclusao@ chegam a vendas@, dono responsavel | Provedor, acessos da caixa, retencao de pedidos e processo operacional a confirmar |

Integracoes existentes nao significam que todo dado seja enviado a todos os
destinos. Observacoes livres podem conter dado pessoal inserido pelo operador;
nao afirmar que Gemini nunca recebe dados pessoais sem controle operacional.

## Riscos que precisam de tratamento

1. Webhook POST montado antes da autenticacao; app usa express.json sem captura
   raw body e rota/controller inspecionados nao validam assinatura Meta. GET
   challenge nao autentica os POSTs. Contrato/implementacao e testes negativos
   devem ser tratados antes da avaliacao, preservando eventos legitimos.
2. Controller imprime payload completo; GET verify imprime token/challenge;
   OAuth tem logs de erro externo bruto. Remover dados/segredos de logs e limitar
   retention/access e entrega de seguranca, nao apenas texto de politica.
3. Evento bruto e salvo antes do tratamento por conta; evitar que dataset do
   analista receba dados reais de outras contas quando app/webhook forem comuns.
4. Token Meta salvo diretamente; nao declarar criptografia total em repouso.
   Backup de banco/config pode conter credenciais, precisa controle proprio.
5. Roles globais/workspace padrao nao comprovam isolamento por cliente. Operator
   nao tem reply/accounts; promover role para facilitar review amplia acesso.
6. Sem rotina geral de exclusao/retencao comprovada para DB, logs, midias e
   backups. Ocultar tester ou desativar conta nao e pedido de exclusao cumprido.

## O que o dono precisa completar

- Revisar politica com identidade/contato e atendimento confirmados por relato,
  sem presumir verificacao documental ou exclusao ja implementada.
- Contratos/nomes dos operadores, localizacao e pessoas com acesso aos dados.
- Politica futura de prazos por categoria, incluindo backups, webhook/ledger
  e pedidos de exclusao/restricao; ausencia de prazo atual ja confirmada pelo dono.
- Procedimento para pedido externo/autoridade e auditabilidade das respostas.
- Uso interno versus clientes e restricoes a inserir dados pessoais em prompts.

Nenhuma resposta de tratamento de dados foi enviada; nao registrar credenciais
ou dados individuais aqui. Validar politicas pelo responsavel antes de declarar
conformidade legal, retencao ou controles que ainda nao operam.
