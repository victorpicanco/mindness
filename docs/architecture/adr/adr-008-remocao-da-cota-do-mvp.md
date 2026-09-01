# ADR-008 — Remoção da cota do produto, da API e do banco

- **Status:** aceito
- **Data:** 2026-08-31
- **Decisores:** Mindness
- **Substitui:** ADR-002 (Reserva de cota como passo síncrono de saga)

## Contexto

A ADR-002 desenhou a cota da conta free como um módulo próprio (`quota`) cuja reserva era o primeiro passo de uma saga síncrona, com compensação obrigatória a cargo de quem chamava. Era uma exceção escopada à LAW-008.5 — a única escrita síncrona cross-module do sistema — e ela cobrou o preço previsto:

1. **A compensação vazou para todo lugar.** `releaseReservation` precisava ser chamado em `start-session` (falha ao salvar), `expire-session`, `get-active-session`, `start-recording`, `sweep-expired-sessions`, `on-analysis-failed-fail-session` e `on-analysis-timed-out-fail-session`. Sete pontos de chamada para uma compensação de um passo. Cada caso de uso novo do módulo `sessions` que pudesse expirar uma sessão herdava a obrigação de lembrar da cota.
2. **O acoplamento subiu até a entidade.** `Session` carregava `quotaReservationId` como campo obrigatório, e `sessions.quota_reservation_id` era `NOT NULL` no banco. A sessão não conseguia nascer sem uma reserva, o que fazia da cota uma dependência estrutural do agregado central do produto, não uma política aplicada sobre ele.
3. **A regra de negócio ainda não está fechada.** O modelo implementado (ciclo de 30 dias com `carried_usage`, reabertura de ciclo na volta ao plano pago, reserva `held`/`consumed`/`released`) foi derivado do PRD antes de qualquer evidência de uso. Manter uma implementação de sete casos de uso, cinco fluxos de integração e duas tabelas para uma política que será redesenhada é pagar juros sobre uma decisão não tomada.

O beta é fechado e limitado a 100 contas: o risco de custo de uma prática sem limite é conhecido e contido. Não há motivo para carregar a exceção da ADR-002 enquanto a política que a justificava não existir de fato.

## Decisão

A cota é removida por inteiro do produto, em vez de ser desativada por configuração ou mantida atrás de uma flag.

**No `apps/api`:**

- O módulo `quota` é apagado — domínio, casos de uso, repositórios, mappers, public API, composição e os cinco fluxos de integração.
- A `QuotaPort` do módulo `sessions`, o `QuotaPortAdapter`, o caso de uso `GetSessionQuotaBalance` e o `GetQuotaBalanceController` são apagados.
- A rota `GET /sessions/quota` deixa de existir.
- `Session` perde `quotaReservationId`; `SessionStarted` e a resposta de `POST /sessions` perdem `remaining`.
- Os sete pontos de compensação somem junto com a port.

**No banco:**

- A migração `20260831120000_drop_quota` derruba `quota_reservations`, `quota_cycles`, o enum `quota_reservation_status` e a coluna `sessions.quota_reservation_id`. As migrações históricas que criaram essas estruturas não são reescritas.

**No `apps/web`:**

- O componente `SessionQuota`, o `getSessionQuota`, o `quotaSchema` e a apresentação do erro `quota.QUOTA_EXHAUSTED` são apagados, junto das mensagens em `pt-BR` que falavam de cota.

Enquanto não houver uma nova política, iniciar uma sessão depende apenas do consentimento vigente (`sessions.PRACTICE_NOT_ALLOWED`), de não haver sessão ativa e de existir tema elegível.

## Consequências

- A exceção escopada da ADR-002 à LAW-008.5 deixa de existir. Não há mais nenhuma escrita síncrona atravessando fronteira de módulo no sistema.
- `Session` volta a ser um agregado sobre configuração, gravação e análise. Expirar uma sessão é uma transação local do próprio módulo, sem compensação externa.
- **A prática deixa de ter limite.** Toda conta pode iniciar quantas sessões quiser, e cada análise concluída tem custo de transcrição e avaliação. A contenção passa a ser o tamanho do beta, não o produto. O registro de custo por análise (`analysis_cost_entries`) continua de pé e é a fonte para dimensionar a política futura.
- CA-006.1 a CA-006.7 do PRD ficam **sem implementação** até que a nova política seja decidida. O PRD não é reescrito por esta ADR: ele descreve o produto pretendido, e a lacuna é deliberada e datada.
- Os dados de ciclo e reserva já gravados são perdidos na migração. Isso é aceito: são dados de beta fechado, e a política que os produziu não será a mesma que os leria.

## Alternativas rejeitadas

- **Manter o módulo com cota infinita (`enforced: false` para todo mundo).** Conserva o código morto inteiro — sete casos de uso, duas tabelas, sete pontos de compensação — e o campo obrigatório na `Session`, sem entregar nada. A implementação futura ainda teria de desfazer o desenho antigo, agora com o custo extra de convergir dados.
- **Manter só a leitura de saldo.** `readQuota` sem reserva não é uma cota; é um contador sem escrita que ainda obriga o módulo a existir.
- **Esconder a cota atrás de uma feature flag.** Adia a decisão e mantém dois caminhos vivos no código e nos testes — exatamente o que a próxima implementação vai querer não encontrar.

## Referências

- ADR-002 — desenho substituído; a leitura dela permanece útil como registro do que foi tentado e por quê.
- `docs/prd/2026-08-15-mindness-mvp.md` — RF-006 (CA-006.1 a CA-006.7), hoje sem implementação.
- LAW-001.7, LAW-001.8, LAW-008.5, LAW-008.10.
- Migração `apps/api/prisma/migrations/20260831120000_drop_quota`.
