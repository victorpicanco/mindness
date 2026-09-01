# ADR-009 — Processamento de áudio no Vertex AI e tratamento do consentimento

- **Status:** aceito
- **Data:** 2026-09-01
- **Decisores:** Mindness
- **Escopo:** pré-condição de ativação da análise v2 (`docs/roadmap/13-analise-multimodal-de-fala.md`, D-14 e T-001)

## Contexto

Até o Bloco 12, o áudio de voz circulava por dois destinos externos: o Supabase Storage, que o guarda em bucket privado, e o Deepgram Nova-3, que o transcreve. O Gemini recebia apenas tema, transcrição e métricas derivadas — o PRD registra isso como decisão explícita em §9: "o Gemini não recebe o áudio no MVP. (…) Isso limita a circulação do áudio e mantém o pipeline de avaliação reversível."

O Bloco 13 desfaz essa decisão por necessidade de produto: sem ouvir o áudio, o modelo não distingue prolongamento de token longo, filler audível de palavra lexical, pausa retórica de pausa disruptiva, nem percebe entrega vocal. As duas passagens da v2 (`AuditoryAnalysisPort` e `FeedbackSynthesisPort`) enviam o mesmo FLAC mono 16 kHz ao Gemini via `inlineData`. O cliente já é o Vertex AI (`new GoogleGenAI({ vertexai: true })` em `src/main.ts` e `src/worker.ts`), com `GOOGLE_CLOUD_PROJECT` e `GOOGLE_CLOUD_LOCATION` vindos de configuração.

O resultado é um **terceiro destino de áudio** e uma mudança material na finalidade descrita ao titular. D-14 do Bloco 13 condiciona a ativação de `ANALYSIS_PIPELINE_VERSION=v2` a fechar essa questão por escrito, antes de qualquer sessão real.

### Estado do consentimento no código, em 2026-09-01

| Fato                                                                                                                  | Local                                                               |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Versão vigente é `2026-08-15`                                                                                         | `ACCOUNTS_CONSENT_VERSION` em `apps/api/.env.example`               |
| A finalidade registrada é `voice_recording_and_analysis`                                                              | `VoiceConsent` em `accounts/domain/value-objects/voice-consent/`    |
| O aceite é gravado no provisionamento, e **somente quando não existe consentimento** (`profile.consent === null`)     | `apps/web/src/lib/auth/provision-account/index.ts`                  |
| A copy que o titular lê no cadastro é "Ao criar sua conta, você aceita os termos de uso e a política de privacidade." | `apps/web/src/i18n/messages/pt-BR/auth.json`                        |
| Iniciar prática exige apenas consentimento **não nulo** — a versão registrada nunca é comparada com a configurada     | `Account.canStartPractice()` em `accounts/domain/entities/account/` |

A última linha é determinante para esta decisão: **subir `ACCOUNTS_CONSENT_VERSION` hoje não produz reaceite nem bloqueia sessão**. Contas existentes seguem com o registro antigo e continuam praticando; o fluxo web só chama `POST /accounts/me/consent` quando não há consentimento algum. Exigir reaceite pelo fluxo existente, como T-001 admite como hipótese, não é executável sem código novo — comparação de versão em `canStartPractice()`, tela de reaceite e copy aprovada — que nenhuma tarefa do Bloco 13 prevê.

### O que a documentação do fornecedor diz

Consultada em 2026-09-01, e tratada aqui como **baseline a confirmar**, não como confirmação:

| Tema                   | Documentação corrente                                                                                                                                                              |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Treinamento            | dados de cliente não são usados para treinar ou ajustar modelos sem permissão prévia; dados de monitoramento de abuso também não                                                   |
| Cache de latência      | entradas e saídas são armazenadas por até 24 horas para reduzir latência, e isso é desativável no nível do projeto (zero data retention)                                           |
| Monitoramento de abuso | quando classificadores automáticos detectam atividade suspeita, prompts podem ser registrados por até 90 dias, na mesma região selecionada, com possibilidade de pedido de exceção |
| Região                 | o processamento e a residência seguem a região configurada no projeto                                                                                                              |

## Decisão

### 1. O Vertex AI passa a ser subprocessador de áudio

O inventário de subprocessadores e a política de privacidade — documentos de produto, mantidos fora deste repositório — registram, antes da ativação da v2:

| Dado enviado                                              | Destino                                             | Finalidade                                                         | Base legal    | Retenção no destino                                                             |
| --------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------ | ------------- | ------------------------------------------------------------------------------- |
| Áudio da sessão, em FLAC mono 16 kHz derivado do original | Gemini no Vertex AI, projeto `GOOGLE_CLOUD_PROJECT` | Produzir a percepção auditiva independente e a síntese de feedback | Consentimento | Nenhuma cópia persistida pelo produto; no fornecedor, conforme §3 desta decisão |
| Transcrição do Deepgram, tema e métricas de ritmo         | Gemini no Vertex AI, segunda passagem               | Verificar e localizar a percepção auditiva                         | Consentimento | idem                                                                            |

A observação auditiva intermediária não é persistida (D-04 e A-05 do Bloco 13) e nenhuma cópia canônica vai para o Storage.

### 2. `ACCOUNTS_CONSENT_VERSION` permanece `2026-08-15`; não há reaceite

A finalidade consentida é `voice_recording_and_analysis` — gravação **e análise** de voz. A v2 não amplia a finalidade: continua analisando a voz para devolver retorno de comunicação à própria pessoa. O que muda é **qual fornecedor executa parte dessa análise**, e a enumeração de fornecedores é matéria da política de privacidade, não do texto curto do aceite. A atualização da política e do inventário, com a inclusão do Vertex AI como processador de áudio, é feita antes da ativação e é o instrumento que informa a mudança.

Consequência aceita: nenhuma conta existente vê uma nova tela de aceite por causa da v2.

### 3. Região `us-central1` mantida, com transferência internacional declarada

`GOOGLE_CLOUD_LOCATION` continua `us-central1`. Voz de titulares no Brasil é processada nos Estados Unidos, e isso é declarado na política de privacidade como transferência internacional, ao lado dos demais fornecedores. Migrar para `southamerica-east1` fica registrado como melhoria possível, não como pré-condição.

### 4. Retenção: cache de 24 h desativado; monitoramento de abuso no padrão

- **Pré-requisito de ativação:** desativar, no nível do projeto, o armazenamento de entradas e saídas por 24 horas (zero data retention). É a única alavanca de retenção inteiramente sob controle do time e é a que reduz de fato o tempo em que a voz permanece no fornecedor.
- **Aceito no padrão:** o registro de prompts por monitoramento de abuso, com retenção de até 90 dias na região selecionada e sem uso para treinamento.
- **Divergência declarada:** o PRD §12.1 promete remoção dos dados "inclusive dos serviços de §9" em até 30 dias. A janela de até 90 dias do monitoramento de abuso não cabe nessa promessa. A divergência fica registrada aqui e deve ser resolvida por pedido de exceção de monitoramento de abuso **antes de o produto sair do beta fechado**. Ela não bloqueia o beta de 100 contas.

### 5. Treinamento: proibido, e confirmado no ambiente real

Nenhum dado enviado ao Vertex AI pode ser usado para treinar ou ajustar modelos. A garantia é contratual e documental; a confirmação no projeto real é item do checklist abaixo.

### 6. Checklist de pré-ativação

A ativação de `ANALYSIS_PIPELINE_VERSION=v2` em produção depende deste checklist, executado e registrado na T-032. Nenhum item é presumido a partir do texto de consentimento vigente:

- [ ] política de privacidade e inventário de subprocessadores publicados com o Vertex AI como processador de áudio, finalidade e região;
- [ ] `GOOGLE_CLOUD_LOCATION` conferido no ambiente real e igual ao valor declarado na política;
- [ ] armazenamento de 24 horas de entradas e saídas desativado no projeto;
- [ ] ausência de uso para treinamento confirmada nos termos aplicáveis à conta de faturamento em uso;
- [ ] exposição ao registro de prompts por monitoramento de abuso conferida para a conta de faturamento em uso, com a janela de até 90 dias registrada como diferença conhecida em relação ao prazo de 30 dias;
- [ ] verificação de que nenhum log, trace ou evento carrega áudio, transcrição, observação intermediária, prompt preenchido ou feedback.

## Consequências

- O PRD §9 fica **desatualizado** em dois pontos — "o Gemini não recebe o áudio no MVP" e a descrição da linha "Gemini 2.5 Flash no Vertex AI" como avaliação apenas de tema, transcrição e métricas. A divergência já está registrada em §2.3 do Bloco 13; a revisão editorial do PRD é tarefa de produto separada e não é feita por esta ADR.
- O consentimento passa a sustentar um processamento cuja descrição completa vive na política de privacidade, e não no texto lido no cadastro. Isso é aceitável enquanto a política enumerar os subprocessadores e estiver publicada antes da ativação; deixa de ser se a v2 mudar de finalidade — nova finalidade exige nova versão de consentimento.
- **Gap registrado, não fechado:** o produto não sabe exigir reaceite. Se uma decisão futura precisar de reaceite — nova finalidade, novo país de processamento, mudança de base legal — será necessário implementar antes: comparação da versão registrada com a configurada em `Account.canStartPractice()`, gate no fluxo web e copy aprovada. Enquanto isso não existir, subir `ACCOUNTS_CONSENT_VERSION` é um registro sem efeito para contas existentes.
- **Divergência preexistente observada:** CA-001.4 do PRD descreve marca obrigatória de consentimento antes da primeira sessão; a implementação atual grava o aceite no provisionamento, sem tela dedicada. Esta ADR não altera esse comportamento e não depende dele para sua validade, mas o registra porque a força do consentimento em que a decisão se apoia depende de como ele foi colhido.
- A janela de até 90 dias do monitoramento de abuso é a única retenção externa declarada acima do prazo de 30 dias do produto, e existe apenas quando há detecção de atividade suspeita.
- Se a suíte real da T-031 mostrar que a v2 não cabe nos tetos de custo, isso é decisão separada; esta ADR não autoriza elevar teto algum.

## Alternativas rejeitadas

- **Nova versão de consentimento com reaceite obrigatório.** É a leitura mais conservadora, e seria a escolha se a finalidade mudasse. Foi rejeitada por duas razões: a finalidade consentida não muda, apenas o fornecedor que a executa; e o fluxo existente não bloqueia prática por versão desatualizada, de modo que "exigir reaceite pelo fluxo existente" exigiria código novo, fora do escopo da T-001 e sem tarefa correspondente no Bloco 13. Escolher esta alternativa pararia o bloco até que essa tarefa existisse.
- **Nova versão sem bloqueio de prática.** Subir a versão só para novos cadastros produz o pior dos dois mundos: cria um marco de auditoria que sugere reaceite e não entrega nenhum, e contas existentes — justamente as afetadas pela mudança — nunca leem o texto novo.
- **Migrar para `southamerica-east1` antes de ativar.** Elimina a transferência internacional, mas condiciona o rollout a confirmar disponibilidade dos modelos escolhidos na região e a um benchmark novo de latência e custo. Fica como melhoria posterior, com a transferência declarada enquanto isso.
- **Exigir a exceção de monitoramento de abuso aprovada antes da ativação.** Elimina a janela de 90 dias, mas amarra o rollout de um beta fechado de 100 contas a uma fila de aprovação de terceiro, com prazo que o time não controla.
- **Aceitar todos os padrões do fornecedor sem configurar nada.** Deixaria o cache de 24 horas ligado sem necessidade, sendo ele desativável por configuração própria e sem custo.

## Referências

- `docs/roadmap/13-analise-multimodal-de-fala.md` — D-01, D-02, D-04, D-13, D-14, T-001, T-032 e §2.3.
- `docs/prd/2026-08-15-mindness-mvp.md` — §9 (decisão de análise e tabela de integrações), §12.1 (dados pessoais, prazo de exclusão), RF-001 (CA-001.4).
- `apps/api/src/modules/accounts/domain/entities/account/index.ts` — `canStartPractice()`.
- `apps/web/src/lib/auth/provision-account/index.ts` — momento do aceite.
- Documentação corrente do Vertex AI, consultada em 2026-09-01: `https://cloud.google.com/vertex-ai/generative-ai/docs/data-governance` e `https://cloud.google.com/vertex-ai/generative-ai/docs/learn/abuse-monitoring`.
- ADR-003 — autorização de áudio sem RLS por identidade; ADR-004 — suíte opt-in de medição de custo real.
