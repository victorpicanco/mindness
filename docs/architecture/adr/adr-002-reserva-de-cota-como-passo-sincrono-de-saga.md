# ADR-002 — Reserva de cota como passo síncrono de saga

- **Status:** aceito
- **Data:** 2026-08-16
- **Decisores:** Mindness
- **Leis afetadas:** LAW-008.5 (exceção escopada), LAW-001.8 e LAW-008.10 (respeitadas)

## Contexto

O Bloco 3 entrega a cota da conta free. O Bloco 4 entrega a sessão de prática. O PRD amarra os dois de forma explícita:

- **CA-006.3** — cota esgotada faz a sessão **não iniciar**; a recusa é vista pela pessoa no ato.
- **RF-006, caso de borda "Ação concorrente"** — "a reserva de cota é criada **atomicamente** com a sessão".
- **DoD do Bloco 4** — "início de sessão cria sessão e reserva de cota atomicamente; falha em qualquer parte não deixa resíduo".

Ao mesmo tempo:

- **LAW-001.7** — cada módulo é dono exclusivo das suas tabelas.
- **LAW-001.8** — uma transação de banco não abrange tabelas de mais de um módulo.
- **LAW-008.5** — chamada síncrona entre módulos serve **exclusivamente** para leitura; escrita que atravessa fronteira vai por evento.
- **LAW-008.10** — operação multi-módulo que precisa de atomicidade é **saga**: passos que são transações locais, cada um com compensação definida.

Cota e sessão não podem ser o mesmo módulo. A cota tem ciclo de vida próprio dirigido também pelo faturamento — renovação de 30 dias, isenção no plano pago e recálculo na volta ao free (CA-006.4, CA-006.5, CA-006.7) — e o Bloco 8 precisará mexer nela sem tocar em sessões. Enterrar a cota dentro do módulo de sessão trocaria uma fronteira difícil por uma pior: o faturamento passaria a escrever no contexto de prática.

Logo, a reserva é necessariamente uma escrita que atravessa fronteira de módulo, e ela precisa acontecer **antes** da resposta HTTP, porque a recusa de CA-006.3 é síncrona.

## Decisão

A cota vive no módulo próprio `quota`, dono exclusivo de `quota_cycles` e `quota_reservations`. A reserva de uma unidade é o **primeiro passo de uma saga síncrona**, executado como transação local do `quota` e invocado diretamente pelo consumidor:

1. O consumidor chama `QuotaPublicApi.reserveForSession({ accountId, sessionId })`. O `quota` decide sozinho, dentro da sua própria transação serializável, se há saldo. Sem saldo, lança `quota.QUOTA_EXHAUSTED` e publica `quota_exhausted` — a sessão não chega a nascer.
2. Com a reserva concedida, o consumidor persiste o próprio agregado na sua própria transação.
3. Se o passo 2 falhar, o consumidor **é obrigado** a chamar `QuotaPublicApi.releaseReservation({ sessionId })`. Essa é a compensação do passo 1 e faz parte do contrato: quem chama `reserveForSession` assume a compensação.

Isto é uma exceção **escopada** à LAW-008.5: uma única operação de escrita síncrona cross-module, mais a sua compensação. Todo o resto do ciclo de vida da reserva permanece assíncrono e conforme às leis — `consume` e `release` por expiração, descarte, falha ou timeout são acionados por **event handlers dentro do próprio `quota`**, reagindo aos eventos publicados pelos módulos de sessão e de processamento (LAW-008.9, LAW-008.11).

Nenhuma transação atravessa fronteira de módulo: LAW-001.7 e LAW-001.8 continuam íntegras. O que é excetuado é apenas o gatilho do passo — chamada direta em vez de evento.

### Condições que tornam a exceção segura

Estas condições são parte da decisão, não recomendações:

1. **Idempotência por sessão.** `session_id` é único em `quota_reservations`. Uma segunda reserva para a mesma sessão devolve a reserva existente e nunca cria uma segunda unidade.
2. **Compensação idempotente e total.** `releaseReservation` é seguro para reserva desconhecida, já liberada ou já consumida — no último caso ele **não** devolve a unidade, conforme a reversibilidade de RF-006.
3. **Reserva pendente é varrível.** Uma reserva que fica `held` além do tempo de vida da sessão pode ser liberada por varredura, de modo que uma compensação perdida não vaze a unidade para sempre. A varredura pertence ao Bloco 4/10.
4. **Uma única operação.** A `QuotaPublicApi` expõe exatamente `readQuota` (leitura), `reserveForSession` e `releaseReservation`. `consume` e a reabertura de ciclo **não** entram na API pública: são use cases internos, acionados por event handler dentro do `quota`.
5. **Sentido único.** O `quota` nunca escreve em outro módulo. Ele lê plano e data de criação da conta pela port de leitura para `accounts`, o que LAW-008.5 já permite.

## Consequências

- A recusa por cota esgotada é síncrona e determinística, como o PRD exige, e a garantia de concorrência ("N inícios simultâneos nunca produzem mais reservas que o saldo") fica inteiramente dentro de uma transação serializável de um único módulo.
- O consumidor conhece três verbos do `quota`, não a sua implementação; extrair o `quota` como serviço depois troca a chamada direta por RPC sem tocar no domínio.
- O custo da exceção é real e fica registrado: se a compensação do passo 2 não for chamada, uma unidade fica presa até a varredura. Por isso a varredura é condição, não melhoria futura.
- Todo módulo novo que precisar escrever no `quota` cai sob esta ADR e deve ser avaliado contra ela; a exceção **não** é um precedente geral para escrita síncrona entre módulos.

## Alternativas rejeitadas

- **Consistência eventual pura** — sessão nasce, evento dispara a reserva, sessão é descartada depois se faltar saldo. Cumpre LAW-008.5 ao pé da letra e quebra CA-006.3: a pessoa receberia uma sessão que morre em seguida.
- **Cota dentro de `accounts`** — não resolve nada: o módulo de sessão continua sendo outro, a mesma escrita cross-module continua necessária, e o contexto de identidade passa a reagir a sessão expirada e análise concluída.
- **Cota dentro do módulo de sessão** — resolveria a atomicidade literal com uma única transação, mas quebra a fronteira na outra ponta: renovação de 30 dias, isenção de plano pago e recálculo na volta ao free são dirigidos pelo faturamento, e o Bloco 8 passaria a escrever no contexto de prática.
- **Transação distribuída (2PC)** — proibida por LAW-008.10 e desproporcional ao problema.

## Referências

- `docs/prd/2026-08-15-mindness-mvp.md` — RF-006 (CA-006.1 a CA-006.7), casos de borda e reversibilidade; DA-16 e DA-17.
- `docs/roadmap/01-guia-tecnico-de-fases.md` — Bloco 3 e Bloco 4.
- LAW-001.7, LAW-001.8, LAW-008.5, LAW-008.9, LAW-008.10, LAW-008.11.
- `docs/roadmap/03-cota-e-ciclo-da-conta.md` §3 (D-01 a D-08).
