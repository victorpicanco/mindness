---
id: LAW-011
title: Lei de Testes de Integração e E2E
status: canonical
version: 1.0.0
scope: backend-typescript
supersedes: null
tags: [testing, integration-tests, e2e, vitest, testcontainers, canonical-law]
related:
  - "[[LAW-001 Lei do módulo]]"
  - "[[LAW-002 Lei da Camada Domain]]"
  - "[[LAW-003 Lei da Camada Application]]"
  - "[[LAW-004 Lei da Camada Infrastructure]]"
  - "[[LAW-005 Lei da Camada Presentation]]"
  - "[[LAW-006 Lei da Composition Root]]"
  - "[[LAW-007 Lei de Nomenclatura e Organização de Arquivos]]"
  - "[[LAW-008 Lei de Comunicação Entre Módulos]]"
  - "[[LAW-009 Lei de Erros]]"
  - "[[LAW-010 Lei do Lib]]"
---

# Lei de Testes de Integração e E2E

> Lei canônica que define o que é um teste de integração no contexto deste monolito modular, onde ele vive, com qual nível de realidade, como compõe dependências e como se distingue de unit tests e de testes ponta-a-ponta. Esta lei é a fonte da verdade para qualquer agente ou humano que escreva, revise ou refatore testes acima do nível unitário.

## Definição

Existem três categorias de teste neste backend, e cada uma tem fronteira **estritamente** delimitada. Confundir as categorias é a forma mais comum de produzir testes lentos, frágeis ou inúteis.

| Categoria | O que exercita | O que é real | O que é falso |
|-----------|----------------|--------------|---------------|
| **unit** | Uma única unidade do domínio ou um use case isolado | A unidade sob teste e suas dependências de domínio | Repositórios, ports, framework, DB, rede |
| **integration** | Um fluxo HTTP completo dentro de **um único módulo**: route → controller → use case → domain → repository → DB | HTTP (`app.inject`), Fastify, controllers, use cases, domain, repositórios, Prisma, Redis | Serviços externos pagos, e-mail, storage, facades de outros módulos, event bus, clock |
| **e2e** | Um fluxo de negócio que **cruza múltiplos módulos**, bootando a aplicação inteira | Tudo de integration + facades reais de todos os módulos + InProcessEventBus real | Apenas serviços externos pagos (Asaas, SERPRO, GCS) e e-mail (Resend) |

Esta lei trata exclusivamente das categorias **integration** e **e2e**. Unit tests são governados pelas leis das camadas que testam.

### Por que esta lei existe

A refatoração arquitetural concluída em 2026 quebrou todos os testes de integração herdados, porque eles foram escritos antes das camadas de composição, ports e facades existirem. Reescrevê-los exige um padrão canônico — caso contrário, cada módulo vai produzir uma variação própria de setup, fixture, mock e cleanup, e a suíte vai voltar a ser um conjunto incoerente de scripts em poucos meses.

### Testes como check arquitetural

Integration tests neste backend não servem apenas para pegar regressões de comportamento. Eles funcionam como **verificação dupla**: pegam bugs **e** expõem gaps arquiteturais que passariam silenciosos em produção. Várias regras desta lei são desenhadas justamente para fazer falhas arquiteturais aparecerem como falhas de teste:

- **LAW-011.6** — `TRUNCATE CASCADE` que transborda o módulo revela FK cruzando fronteira (violação de [[LAW-001 Lei do módulo]] §7/§8).
- **LAW-011.7** — quando `vi.mock` parece a única saída, é sinal de que falta um port no domain (violação de [[LAW-002 Lei da Camada Domain]]).
- **LAW-011.10** — port de outro módulo difícil de fakear é sinal de port gordo, vazando vocabulário do produtor (violação de [[LAW-008 Lei de Comunicação Entre Módulos]]).

Quando esse tipo de "atrito" aparecer ao escrever um teste, **a regra é parar e corrigir o gap arquitetural**, não escrever o teste em torno do problema. Silenciar o sintoma no teste perpetua a violação na arquitetura e adia uma dor que sempre cresce.

## Regras

### LAW-011.1 — Três categorias de teste com fronteira explícita

**Regra:** Todo teste neste backend pertence a exatamente uma das três categorias: `unit`, `integration` ou `e2e`. A categoria é determinada pelo **path do arquivo**, não por sufixo no nome:

| Categoria | Path |
|-----------|------|
| unit | `src/modules/**/index.test.ts` (excluindo `presentation/integration/` e `tests/e2e/`) |
| integration | `src/modules/<x>/presentation/integration/<flow>/index.test.ts` |
| e2e | `src/tests/e2e/<flow>/index.test.ts` |

Cada categoria tem seu próprio arquivo de configuração do Vitest (`vitest.config.ts`, `vitest.config.integration.ts`, `vitest.config.e2e.ts`) e seu próprio script `pnpm test:<categoria>`.

**Justificativa:** Uma categoria que pode rodar com qualquer pipeline produz cobertura redundante e relatórios incompreensíveis. Path-based separation elimina ambiguidade e permite que CI rode cada categoria em estágios independentes (unit em todo commit, integration em PR, e2e em merge).

**Proibido:** sufixos `*.integration.test.ts`, `*.e2e.test.ts` ou `*.spec.ts`. O nome do arquivo é sempre `index.test.ts` dentro da pasta da unidade testada (consistente com [[LAW-007 Lei de Nomenclatura e Organização de Arquivos]]).

### LAW-011.2 — Integration tests vivem dentro do módulo, em `presentation/integration/`

**Regra:** Para um módulo `<x>`, todo arquivo de integration test mora em:

```
src/modules/<x>/presentation/integration/<flow>/index.test.ts
```

Onde `<flow>` é o nome em kebab-case de um **fluxo cooperativo de negócio** (ver LAW-011.5). A pasta `presentation/integration/` é o único lugar do módulo onde testes vivem — não há `tests/`, `__tests__/` ou `spec/` no root do módulo, em respeito a [[LAW-001 Lei do módulo]] §2.

**Justificativa:** Integration tests exercitam o módulo a partir do seu boundary HTTP, então pertencem semanticamente à camada `presentation/`. Co-localizar com a camada testada significa que mover o módulo move os testes junto, e que o agente lendo `presentation/` encontra a especificação executável de cada controller à mão.

**Exemplo certo:**
```
src/modules/students/presentation/
├── controllers/
├── routes/
├── middleware/
├── serializers/
└── integration/
    ├── onboarding/
    │   └── index.test.ts
    ├── auth/
    │   └── index.test.ts
    ├── profile-management/
    │   └── index.test.ts
    └── admin-students/
        └── index.test.ts
```

### LAW-011.3 — Cada módulo tem `composition/integration-container.ts`

**Regra:** Todo módulo que possui integration tests deve expor, na sua pasta `composition/`, um arquivo `integration-container.ts` que oferece a função:

```ts
createIntegrationContainer(deps: IntegrationDeps): <Module>Container
```

Esta função **não duplica wiring**. Ela invoca a `createXContainer` de produção, passando:

- `prisma`, `redis` — instâncias reais (recebidas como parâmetro do test runner).
- Adapters in-memory para todo serviço externo pago ou de I/O lento (Resend, Asaas, SERPRO, GCS).
- `FakeEventBus` no lugar do `InProcessEventBus`.
- `Clock` controlável no lugar do clock do sistema.
- Fakes hand-rolled de cada `<Other>Port` que aponta para outro módulo (ver LAW-011.10).

**Justificativa:** Reutilizar `createXContainer` garante que adicionar um novo adapter à produção quebre o setup do teste em **tempo de compilação** — o teste não pode silenciosamente passar usando uma versão divergente do container. Substituir apenas as dependências externas mantém o teste fiel ao módulo real.

**Proibido:**
- Wiring manual de use cases / repositories no integration container.
- Aceitar `vi.mock` como substituto: o objetivo do container é evitar `vi.mock` (ver LAW-011.7).
- Usar `composition/test-container.ts` (que é puramente in-memory) para integration tests — são containers diferentes com responsabilidades diferentes.

**Exemplo certo:**
```ts
// src/modules/students/composition/integration-container.ts
export interface IntegrationDeps {
  prisma: PrismaClient
  redis: RedisClient
}

export function createStudentsIntegrationContainer(deps: IntegrationDeps) {
  const fakeEventBus = new FakeEventBus()
  const clock = new ControllableClock()
  const resend = new InMemoryResendClient()

  const container = createStudentsContainer({
    prisma: deps.prisma,
    redis: deps.redis,
    eventBus: fakeEventBus,
    resendClient: resend,
    config: TEST_STUDENTS_CONFIG,
    auditLogsFacade: createFakeAuditLogsFacade(),
    citiesFacade: createFakeCitiesFacade(),
    adminUsersFacade: createFakeAdminUsersFacade(),
    instructorsPort: createFakeInstructorsPort(),
  })

  return { container, fakeEventBus, clock, resend }
}
```

### LAW-011.4 — Cada módulo tem `composition/integration-fixtures.ts`

**Regra:** Ao lado do integration container, o módulo expõe `composition/integration-fixtures.ts`, que reúne **toda** a interação com o estado de teste:

- Factories Prisma: `createTestStudent({...})`, `createVerifiedStudent({...})`.
- Cleanup: `clearStudentData(prisma)` via `TRUNCATE ... CASCADE` (ver LAW-011.6).
- Auth helpers: `loginAsStudent(app, email)`, `getStudentAuthHeaders(app, ...)`.

Fixtures **nunca** ficam em pastas globais (`src/tests/helpers/`, `src/tests/factories/`). Cada módulo é dono das suas factories de dados, espelhando a regra de ownership de [[LAW-001 Lei do módulo]] §7.

**Justificativa:** Fixtures globais geram acoplamento oculto: uma factory em `src/tests/factories/make-student.ts` viola a fronteira do módulo students tão gravemente quanto um repository externo. Movendo fixtures para o composition root do próprio módulo, o teste de integração herda a mesma disciplina arquitetural do código de produção.

**Proibido:**
- Factories em `src/tests/factories/`.
- Helpers de auth, cleanup ou seed em `src/tests/helpers/`.
- Importar fixtures de um módulo em testes de outro módulo (e2e usa fixtures via composição, não import direto).

### LAW-011.5 — Granularidade do arquivo é o fluxo, não o endpoint

**Regra:** Cada `presentation/integration/<flow>/index.test.ts` cobre **um fluxo cooperativo de negócio** — um caminho coeso que envolve um ou mais endpoints relacionados, vivendo o ciclo do mesmo objetivo do usuário.

Tamanho-alvo:
- 80–250 linhas por arquivo.
- 4–12 cenários (`it`).
- 1 happy path obrigatório + variações relevantes (estado inicial, erro, idempotência, autorização).

**Justificativa:** "Um arquivo por endpoint" produz fragmentação inútil (`GET /me` raramente justifica seu próprio arquivo). "Um arquivo por recurso REST" produz god-files de 600+ linhas que ninguém revisa. O fluxo cooperativo é a granularidade que casa com o jeito que o produto é usado e descrito.

**Exemplo de fluxos válidos para `students`:**

| Pasta | Endpoints exercitados |
|-------|------------------------|
| `onboarding/` | `POST /register`, `POST /:id/verify-email/send`, `POST /:id/verify-email/confirm`, `POST /:id/accept-terms` |
| `auth/` | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `POST /login/lookup` |
| `password-recovery/` | `POST /auth/forgot-password`, `POST /auth/reset-password` |
| `profile-management/` | `GET /me`, `PUT /me` |
| `admin-students/` | `GET /admin/students`, `GET /admin/students/:id`, `PATCH /admin/students/:id/status` |

**Proibido:**
- Testar regra de negócio (cálculo, invariante, transição de estado) em integration test. Isso é unit test do domain — ver [[LAW-002 Lei da Camada Domain]].
- Espalhar o mesmo fluxo entre múltiplos arquivos.
- Misturar fluxos não relacionados no mesmo arquivo (ex: `onboarding` + `password-recovery`).

### LAW-011.6 — Isolamento de DB via `TRUNCATE ... CASCADE` em `beforeEach`

**Regra:** O estado do banco entre testes é resetado via uma única operação de `TRUNCATE` por módulo, com `CASCADE` para resolver foreign keys, executada no `beforeEach`:

```ts
await prisma.$executeRawUnsafe(`
  TRUNCATE TABLE
    students,
    student_consents,
    student_verifications
  RESTART IDENTITY CASCADE
`)
```

Cada módulo expõe sua própria função `clearXData(prisma)` em `composition/integration-fixtures.ts`, que conhece exclusivamente as tabelas do **próprio módulo** ([[LAW-001 Lei do módulo]] §7).

**Justificativa:** `deleteMany` em ordem manual de FKs (estratégia herdada) acumula custo linear no número de tabelas e exige que cada novo modelo seja inserido na ordem correta, manualmente, sob pena de quebra silenciosa. `TRUNCATE ... CASCADE` resolve a ordem em uma única declaração SQL e roda em milissegundos. Transação-com-rollback (alternativa popular) quebra quando o use case abre `prisma.$transaction` internamente — cenário que vai se tornar comum com o `UnitOfWork` planejado.

**Pré-requisito arquitetural:** esta regra é segura **se, e somente se**, o schema respeita [[LAW-001 Lei do módulo]] §7 (cada tabela tem dono único) e §8 (sem FK constraint cruzando módulos com `ON DELETE CASCADE`). Quando uma das duas é violada, `TRUNCATE` numa tabela do módulo A vai derrubar dados do módulo B — e o teste vai falhar de forma confusa (registros desaparecendo "sem motivo" entre `it` blocks ou inserts violando constraint inexistente).

Esse tipo de falha **não é um problema do teste**: é o teste expondo um gap arquitetural (ver "Testes como check arquitetural" no topo desta lei). Modificar `clearXData` para também truncar tabelas de B é a forma errada de resolver — perpetua a violação de fronteira. A forma certa é uma das três:

1. Mover a tabela compartilhada para o módulo dono real, refletindo a fronteira correta.
2. Trocar a FK constraint por referência por ID sem `CASCADE` (o ORM/use case carrega dados via facade, não via JOIN).
3. Se A e B precisam genuinamente compartilhar uma tabela com FK forte, isso é evidência de que A e B são o mesmo módulo (revisar fronteira).

**Proibido:**
- `prisma.x.deleteMany()` em sequência para cleanup de integration test.
- Cleanup global que toca tabelas de outros módulos (`clearAllTestData()` é proibido — cada módulo limpa o que é seu).
- Adicionar tabelas de outro módulo no `TRUNCATE` do módulo A para "fazer o teste passar" diante de FK cross-module.
- Reutilizar registros entre `it` blocks (cada teste começa com banco vazio para o módulo).

**Nota de evolução:** Quando `fileParallelism` for ligado no Vitest, esta regra evolui para schema-per-worker (cada worker recebe um schema dedicado). A mudança fica isolada em `composition/integration-fixtures.ts` e não afeta os testes.

### LAW-011.7 — Serviços externos via `InMemory*Adapter` injetado

**Regra:** Todo serviço externo (Resend, Asaas, SERPRO, GCS, Stripe, etc.) tem um adapter in-memory correspondente em `infrastructure/adapters/in-memory-<servico>-adapter/index.ts`. O `integration-container.ts` injeta o adapter in-memory no lugar do real.

O adapter in-memory:
- Implementa fielmente a mesma interface do port.
- Expõe inspetores de teste (`getEmailsSent()`, `getChargesCreated()`) **na implementação**, não no port.
- Expõe **simuladores de falha** (`simulateFailure(error)`, `simulateNetworkError()`, `simulateLatency(ms)`) para que o teste possa exercitar os caminhos de erro do código que consome o port — fallback, retry, mensagem de erro propagada, evento de compensação, etc.
- É retornado pelo `createIntegrationContainer` para que o teste possa fazer asserções sobre side-effects e configurar simulação de falha.

**Justificativa:** `vi.mock` mocka o **caminho de import**, vazando detalhes de implementação para o teste e quebrando refatorações de path. Adapter in-memory é uma implementação real do port, validada pelo TypeScript e refatorável com o resto do código. Bonus: o mesmo adapter serve para desenvolvimento local sem depender de credenciais externas.

A obrigação de expor simuladores de falha existe porque adapter in-memory que sempre retorna sucesso esconde uma classe inteira de bugs: o que acontece quando Asaas devolve 503? Quando SERPRO devolve CPF inválido? Quando Resend devolve quota excedida? Sem simulação, o caminho feliz fica testado e o caminho crítico (degradação) só aparece em produção.

**Proibido:**
- `vi.mock('@/lib/mail/resend/...')` em integration test.
- `vi.mock` em general (única exceção: utilitários determinísticos baixo nível como `crypto.randomInt` para OTP — ver LAW-011.9).
- Adapter in-memory que não implementa a interface completa do port (`Method not implemented` no TypeScript).
- Adapter in-memory que sempre retorna sucesso — degradação e falha precisam ser simuláveis via API explícita.
- Vazar tipos `vi.Mock` ou `MockedFunction` para fora do arquivo de teste.

**Defesa em profundidade:** o `setup.ts` global mantém o `fetch`-guard que bloqueia chamadas para `serpro.gov.br` e `asaas.com`. É backstop, não substituto da regra principal — se o teste tenta sair pela rede, o adapter in-memory falhou ou não foi injetado.

### LAW-011.8 — HTTP transport é `app.inject`, sem socket real

**Regra:** Integration tests exercitam o pipeline HTTP via `app.inject({ method, url, payload, headers })` do Fastify. **Não** abrem socket real (`app.listen()` + `fetch`).

**Justificativa:** `app.inject` cobre 100% do pipeline HTTP do Fastify (hooks, plugins, body parsing, validation, error handler) sem custo de socket nem porta dinâmica. Eliminam-se flakiness de rede, conflitos de porta entre workers e timeouts artificiais. Teste de socket real só faz sentido para validar headers de transport (chunked encoding, keep-alive) — fora do escopo desta lei.

**Exemplo certo:**
```ts
const res = await app.inject({
  method: 'POST',
  url: '/api/students/register',
  payload: validRegisterPayload,
  remoteAddress: '10.0.0.1',
})

expect(res.statusCode).toBe(201)
expect(res.json()).toMatchObject({
  data: { studentId: expect.any(String) },
})
```

### LAW-011.9 — `EventBus` é `FakeEventBus`; tempo é via `Clock` port

**Regra:**

**Eventos:** o integration container injeta um `FakeEventBus implements EventBusPort` que acumula publicações em `published: IntegrationEvent[]`. O teste assere sobre `fakeEventBus.published` para verificar que o use case publicou o evento esperado, com o payload esperado, na ordem esperada. Não há cadeia de handlers sendo executada — efeitos cross-module pertencem aos testes e2e.

**Tempo:** todo módulo que depende de tempo declara um port `Clock` em `domain/ports/clock/index.ts` com `now(): Date`. Produção pluga `SystemClock`; integration test pluga `ControllableClock` com método `set(date: Date)` e `advance(ms: number)`. Asserções de "expira em 10 minutos" tornam-se `clock.advance(11 * 60 * 1000)` antes da segunda chamada.

**Justificativa:** EventBus real ativa handlers de outros módulos, transformando um teste "do students" num teste implícito do `audit-logs`, `notifications`, etc. Isso quebra a fronteira do per-module. O FakeEventBus mantém o teste responsável apenas pela publicação. Para o tempo, `vi.useFakeTimers` mexe em globals do Node e tem efeitos colaterais em libs que cacheiam `Date` — Clock port é a forma DDD-pura, e o ganho de não criar um glitch global supera o custo de um port a mais.

**Proibido:**
- `new InProcessEventBus()` em integration container.
- `vi.useFakeTimers()` em integration test.
- `Date.now()`, `new Date()` direto em código de produção testado por integração — sempre via `clock.now()`.

**Exceção limitada:** `vi.mock('node:crypto', ...)` para controlar `randomInt` em testes de OTP é tolerado quando o módulo não tem (ainda) um port `RandomNumberGenerator`. Tratar como dívida técnica — quando um segundo caso aparecer, criar o port.

### LAW-011.10 — Facades de outros módulos são fakes do port consumidor

**Regra:** Quando o módulo A precisa do módulo B em integration test, A **não** boota o módulo B. Em vez disso, A fornece um **fake hand-rolled** da própria interface `BPort` que vive em `A/domain/ports/<b>-port/index.ts` (declarada conforme [[LAW-008 Lei de Comunicação Entre Módulos]]).

O fake mora em `A/composition/integration-fixtures.ts` (ou em arquivo separado `A/composition/fakes/<b>-port-fake.ts` se a complexidade justificar).

**Justificativa:** A premissa do per-module é que cada módulo é testável em isolamento. Bootar o módulo B junto contraria essa premissa e cria acoplamento de teste cruzado: uma quebra em B faz testes de A falharem. Fake hand-rolled mantém A independente; a corretude da integração real entre A e B é responsabilidade dos testes **e2e** (LAW-011.11).

**Exemplo certo:**
```ts
// src/modules/students/composition/integration-fixtures.ts
export function createFakeInstructorsPort(): InstructorsPort {
  const cpfsRegistered = new Set<string>()
  const emailsRegistered = new Set<string>()

  return {
    existsByCpf: async (cpf) => cpfsRegistered.has(cpf),
    existsByEmail: async (email) => emailsRegistered.has(email),
    __seed: { cpfsRegistered, emailsRegistered },
  } as InstructorsPort & { __seed: ... }
}
```

**Proibido:**
- Importar `createInstructorsContainer` ou `createInstructorsFacade` em integration test do students.
- Importar `@/modules/<outro-modulo>/...` (mesmo via `index.ts`) em integration container/fixtures de A.
- Fake que não implementa todos os métodos do port (TypeScript deve quebrar quando um método for adicionado).

### LAW-011.11 — E2E vive em `src/tests/e2e/<flow>/index.test.ts` e usa `buildApp()`

**Regra:** Testes que cruzam fronteiras de módulo vivem em `src/tests/e2e/<flow>/index.test.ts`, fora de qualquer módulo. Eles usam `buildApp()` para subir a aplicação inteira, com:

- Prisma + Redis reais (testcontainers).
- `InProcessEventBus` real (handlers cross-module rodam de verdade).
- Facades reais de todos os módulos.
- Adapters in-memory **somente** para serviços externos pagos (Resend, Asaas, SERPRO, GCS).

A suíte e2e cobre **apenas fluxos críticos do negócio** que envolvem múltiplos módulos. Meta: 5–15 arquivos no total para o monolito inteiro.

**Justificativa:** E2E é caro (boot completo, todos os módulos) e frágil (qualquer módulo quebra a suíte inteira). Tratá-lo como rede de segurança para os 5–15 caminhos que **realmente** importam — não como duplicação de cobertura de integration. Cada fluxo e2e justifica sua existência respondendo "o que quebra silenciosamente em produção se este fluxo não for testado ponta-a-ponta?".

**Exemplos de fluxos e2e válidos:**

| Pasta | Fluxo |
|-------|-------|
| `instructor-onboarding-completo/` | Cadastro → SERPRO mock → KYC → ativo |
| `student-books-lesson-with-payment/` | Login student → busca instructor → reserva slot → cobrança → confirmação |
| `instructor-cancels-lesson-refunds-student/` | Cancelamento → publicação de evento → refund → notificação |

**Proibido:**
- Cobrir cenário no e2e que já foi coberto por algum integration test do módulo.
- E2E "de um módulo só" — se cabe em integration, é integration.
- Mais de 15 arquivos e2e sem revisão arquitetural justificando.

### LAW-011.12 — Asserções cobrem status, envelope e efeitos colaterais

**Regra:** Toda asserção de integration / e2e cobre, no mínimo, **três planos**:

1. **HTTP:** status code esperado e shape do envelope de resposta (`{ data, meta }` para sucesso, `{ error: { code, message, ... } }` para erro — ver [[LAW-009 Lei de Erros]]).
2. **Estado persistido:** o registro foi criado / atualizado / deletado no banco com os campos esperados (consultar via repositório do próprio módulo, não via SQL cru).
3. **Side-effects:** eventos publicados (`fakeEventBus.published`), e-mails enviados (`resend.sent`), audit logs registrados, etc.

**Justificativa:** Asserção apenas no status code testa que o handler retorna 200 — não que ele faz a coisa certa. O bug clássico ("retornei 200 mas não persistí o registro") só aparece quando os três planos são verificados. Inversamente, asserir só estado sem verificar resposta perde regressões de serialização e contrato de API.

**Exemplo certo:**
```ts
it('register cria student pending_verification e publica StudentRegistered', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/api/students/register',
    payload: basePayload,
  })

  // 1. HTTP
  expect(res.statusCode).toBe(201)
  expect(res.json()).toMatchObject({
    data: { studentId: expect.any(String) },
    meta: expect.any(Object),
  })

  // 2. Estado persistido
  const persisted = await studentRepo.findByCpf(basePayload.cpf)
  expect(persisted).toMatchObject({ status: 'pending_verification' })

  // 3. Side-effects
  expect(fakeEventBus.published).toContainEqual(
    expect.objectContaining({ eventName: 'StudentRegistered' }),
  )
})
```

**Proibido:**
- `expect(res.statusCode).toBe(200)` como única asserção.
- Asserções via SQL cru (`prisma.$queryRaw`) — usar repository do módulo.
- Asserções sobre logs de console (logs não são contrato).

### LAW-011.13 — Toda response é validada contra o schema OpenAPI da rota

**Regra:** Em todo integration test, a response do `app.inject` é cruzada com o schema OpenAPI declarado na rota correspondente. Helper canônico: `assertResponseMatchesSchema(app, method, url, response, statusCode)` em `composition/integration-fixtures.ts` (ou em helper compartilhado de teste, se a implementação for genuinamente agnóstica de módulo). Se o handler retorna shape diferente do declarado no `schemas.ts` da rota, o teste falha.

**Justificativa:** O OpenAPI spec é o contrato consumido pelo frontend (geração de tipos via `openapi-typescript`/`orval`, mock servers, documentação). Se o spec mente, o frontend quebra silencioso em produção mesmo com 100% de coverage do backend. Asserir só `expect(res.json().data.studentId).toBeDefined()` no teste passa enquanto o schema declara `studentId` que o handler renomeou para `id` — drift invisível.

A validação sai praticamente grátis: o schema já está declarado em `presentation/controllers/<x>/schemas.ts` ([[LAW-005 Lei da Camada Presentation]]) e o Fastify já o serve via `app.swagger()`. Validar a response contra ele é uma única chamada Ajv reutilizável.

Esta regra é o que torna verdadeira a frase "se o backend está bem testado, o frontend só precisa consumir": sem ela, o front continua refém de drift entre o que o `swagger.json` promete e o que o handler entrega.

**Exemplo certo:**
```ts
const res = await app.inject({
  method: 'POST',
  url: '/api/students/register',
  payload: basePayload,
})

// 1. Status + envelope
expect(res.statusCode).toBe(201)

// 2. Response bate com OpenAPI schema declarado para 201
assertResponseMatchesSchema(app, 'POST', '/api/students/register', res, 201)

// 3. Asserções específicas adicionais
expect(res.json().data.studentId).toMatch(/^[0-9a-f-]{36}$/)
```

**Proibido:**
- Asserir apenas via `toMatchObject` ou `toBeDefined` sem cross-check com o OpenAPI schema.
- Atualizar handler sem atualizar `schemas.ts` (o teste deve quebrar — esse é o comportamento desejado).
- Skip ou bypass do `assertResponseMatchesSchema` para "destravar o teste rapidamente".
- Manter schema OpenAPI defasado da realidade do handler com o argumento de "documentar depois".

## Sumário executivo

| # | Regra | Consequência da violação |
|---|-------|--------------------------|
| 1 | Três categorias com fronteira por path | Cobertura redundante, CI ininterpretável |
| 2 | Integration vive em `presentation/integration/<flow>/` | Testes órfãos, pasta `tests/` quebrando LAW-001 |
| 3 | `composition/integration-container.ts` reutiliza container de prod | Wiring divergente passa silencioso |
| 4 | `composition/integration-fixtures.ts` por módulo | Fixtures globais furam ownership |
| 5 | Arquivo por fluxo cooperativo (80–250 linhas) | God-files ou fragmentação inútil |
| 6 | `TRUNCATE ... CASCADE` por módulo no `beforeEach` | Cleanup lento, ordem manual de FKs |
| 7 | `InMemory*Adapter` injetado com simuladores de falha; sem `vi.mock` | Vazamento de implementação; caminhos de degradação não testados |
| 8 | HTTP via `app.inject`, sem socket real | Flakiness de rede, conflito de porta |
| 9 | `FakeEventBus` + `Clock` port | Cascata de handlers cruzando módulos, globals corrompidos |
| 10 | Outros módulos via fake hand-rolled do port consumidor | Acoplamento cruzado entre suítes |
| 11 | E2E em `src/tests/e2e/`, máx 15 arquivos, fluxos críticos | Suíte e2e infinita, frágil, redundante |
| 12 | Asserção em HTTP + estado + side-effects | Bug "200 mas nada persistido" passa |
| 13 | Response cross-checked com schema OpenAPI da rota | Drift invisível entre spec e handler quebra o frontend |

## Aprendizados do piloto (admin-users, 2026-05-11)

Esta seção registra o que foi aprendido ao aplicar a lei pela primeira vez, no módulo `admin-users`. Não substitui as regras acima — complementa com decisões de implementação que economizam tempo nas próximas migrações.

### A1 — `buildXTestApp` é o entrypoint, não `buildApp` global

`createIntegrationContainer` (LAW-011.3) entrega o container, mas o teste ainda precisa de um Fastify para `app.inject`. **Não** subir o app inteiro via `buildApp()` — isso boota todos os módulos e contraria LAW-011.10. Em vez disso, cada `composition/integration-container.ts` exporta uma função `buildXTestApp()` que monta um Fastify mínimo:

1. `fastify({ ajv: { customOptions: { strict: false, keywords: ['example'], coerceTypes: true } }, logger: false })`.
2. Registra `rate-limit` com `max: 10_000` para neutralizar limites em testes.
3. Registra `@fastify/swagger` (necessário para `app.swagger()` no `assertResponseMatchesSchema`).
4. Chama `createXIntegrationContainer({ prisma, redis })` para obter `{ container, fakeEventBus, clock }`.
5. `app.register(registerXModule, { container })` + `app.ready()`.
6. Retorna `{ app, prisma, redis, container, fakeEventBus, clock, close }` para o teste.

`close()` faz `app.close()` + `redis.quit()` + `prisma.$disconnect()`. Cada arquivo de teste cria o harness no `beforeAll` e fecha no `afterAll`.

### A2 — Schema OpenAPI vs envelope do error handler

Erros que retornam 500 INTERNAL_ERROR em paths de erro (401, 404, 409) onde claramente deveria ser o status semântico **são sintoma de mismatch entre o shape enviado pelo error handler e o `errorSchema` declarado na rota**. Fast-json-stringify com `additionalProperties: false` falha silenciosamente quando um campo `required` está ausente; Fastify cai no error handler de novo, agora com erro técnico → 500.

No piloto, `errorSchema` exigia `{ error: { code, message, issues } }` mas o handler emitia `{ error: { code, message, fields, requestId } }`. Correção foi no módulo: handler renomeia `fields → issues` e cada item passa de `{ path, message, code }` para `{ field, message }`. Itens com `additionalProperties: false` são especialmente sensíveis.

**Regra prática:** o `assertResponseMatchesSchema` (LAW-011.13) detecta esse mismatch já no primeiro teste — antes mesmo de bater nas asserções de payload. Se a suíte falha com 500 em paths de erro, o error handler do módulo não está alinhado com o `errorSchema` da rota. Ajustar **o handler do módulo**, não bypass do schema cross-check.

### A3 — Parametrizar `createContainer`, não fork

LAW-011.3 proíbe duplicar wiring no integration container. A forma canônica é estender a assinatura do `createContainer(deps)` de produção com `deps.adapters?: Partial<XAdapterOverrides>`:

```ts
export interface XAdapterOverrides {
  // todo adapter que o teste possa querer substituir
  eventBus?: EventBusPort
  clock?: Clock
  // ... outros ports que possam variar
}

export interface XModuleDeps {
  prisma: PrismaClient
  redis: RedisClient
  eventBus: EventBus
  config: XConfig
  adapters?: XAdapterOverrides
}
```

Cada adapter concreto é instanciado como `const x = deps.adapters?.x ?? new ConcretoDefault(...)`. Produção em `server.ts` continua chamando `createXContainer({ prisma, redis, eventBus, config })` sem mudanças. Integration container sobrescreve **apenas** o que muda (tipicamente `eventBus` e `clock`).

Benefício colateral: adicionar um novo adapter na produção quebra o tipo do override em tempo de compilação — o teste reclama antes de rodar.

### A4 — `vitest.config.ts` (unit) precisa excluir o novo path

Por padrão, vitest casa `**/*.{test,spec}.ts`. Os novos integration tests vivem em `src/modules/**/presentation/integration/**/index.test.ts` e seriam executados pelo runner de unit sem o `exclude`:

```ts
// vitest.config.ts
exclude: [
  'node_modules',
  'dist',
  'src/tests/integration/**',
  'src/modules/**/presentation/integration/**', // ← obrigatório
],
```

E em `vitest.config.integration.ts` o `include` precisa incluir explicitamente o path novo:

```ts
include: [
  'src/modules/**/presentation/integration/**/index.test.ts',
  'src/tests/integration/**/*.{test,spec}.ts', // legacy, remover quando migrar tudo
],
```

### A5 — `ajv` + `ajv-formats` como devDependencies

`assertResponseMatchesSchema` precisa de Ajv para compilar o schema OpenAPI extraído de `app.swagger()`. Fastify usa Ajv internamente mas não o expõe; instalar como devDependency:

```bash
pnpm add -D ajv ajv-formats
```

`ajv-formats` é CJS e o `default` export precisa ser desembrulhado em ESM:

```ts
import { Ajv } from 'ajv'
import * as addFormatsNs from 'ajv-formats'
const addFormats = ((addFormatsNs as unknown as { default: (ajv: Ajv) => Ajv }).default ??
  (addFormatsNs as unknown as (ajv: Ajv) => Ajv)) as (ajv: Ajv) => Ajv
```

O `assertResponseMatchesSchema` aceita a **rota como pattern OpenAPI** (`/api/admin/admins/{id}`), não a URL resolvida que o teste passa para `app.inject` (`/api/admin/admins/uuid-here`). O helper resolve `app.swagger().paths[route][method].responses[statusCode].content['application/json'].schema`, compila com Ajv, cacheia o validator por `WeakMap<app, Map<key, ValidateFunction>>` e valida `response.json()`.

### A6 — `Clock` port elimina flakiness silenciosa

Antes do piloto, `LoginAdminUseCase` e `RefreshAdminTokenUseCase` chamavam `Date.now()` direto para calcular `expiresAt` do refresh-token. Funcionava em produção mas impedia o teste de asserir expiração de forma determinística — `vi.useFakeTimers` é proibido (LAW-011.9) e o teste real (sleep) é flaky.

Criar o port (`domain/ports/clock/index.ts` com `now(): Date`) + adapter (`SystemClockAdapter` em produção, `ControllableClock` com `set/advance` no integration-fixtures) leva ~20 minutos e desbloqueia testes de TTL/expiração. **Regra prática:** se o use case tem `new Date()` ou `Date.now()`, criar o port **antes** de escrever o teste que depende dele.

### A7 — `TRUNCATE CASCADE` denuncia FK cross-module

LAW-011.6 prevê o caso, mas vale registrar: no piloto, `instructors.approved_by → admin_users.id` (FK cruzando módulos, violando LAW-001 §8) **não** apareceu como erro porque testes de admin-users isolados não criam instructors. O gap só seria detectado no e2e. Para casos análogos, a regra é:

1. Registrar como gap arquitetural (memória, issue, etc.).
2. Proceder com `TRUNCATE <tabela-do-modulo> RESTART IDENTITY CASCADE` no `beforeEach`.
3. **Não** adicionar tabelas de outros módulos ao TRUNCATE para "fazer o teste passar" se a FK aparecer — isso perpetua a violação.

### A8 — Errors fluem pelo error handler do **scope**, não pelo global

Quando o módulo registra seu próprio `setErrorHandler` dentro de `fastify.register(async (scope) => { scope.setErrorHandler(adminUsersErrorHandler); ... })`, **todos** os erros das rotas daquele scope (incluindo `preHandler` hooks de auth) caem no handler do módulo, não no global. Logo, o handler do módulo precisa cobrir **todas** as categorias: `InfrastructureError`, `BaseError`, `FastifyError` com `validation`, e o catch-all `INTERNAL_ERROR`.

Não dá pra contar com o global error handler como "fallback automático" para validation errors do Fastify — se ele não souber tratar, o request termina em 500 sem nunca chegar no global.

## Referências

- Vladimir Khorikov, *Unit Testing: Principles, Practices, and Patterns* (2020). Capítulos 8 e 9 (definição de integration test sociable, classicist).
- Martin Fowler, *Integration Test*. https://martinfowler.com/bliki/IntegrationTest.html
- Martin Fowler, *Test Pyramid*. https://martinfowler.com/bliki/TestPyramid.html
- Kent C. Dodds, *Write Tests. Not Too Many. Mostly Integration*. https://kentcdodds.com/blog/write-tests
- Kent C. Dodds, *The Testing Trophy and Testing Classifications*. https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications
- Justin Searls, *Test Doubles: Mocks, Stubs, Fakes*. https://blog.testdouble.com/posts/2014-05-14-the-rspec-style-guide/
- Kamil Grzybek, *Modular Monolith: Architectural Drivers* — seção sobre testabilidade. https://www.kamilgrzybek.com
- Vitest Docs, *Test Filtering and Configuration*. https://vitest.dev/guide/cli.html
- Testcontainers Node.js Docs, *PostgreSQL Module*. https://node.testcontainers.org/modules/postgresql/
- Fastify Docs, *Testing — `inject` API*. https://fastify.dev/docs/latest/Guides/Testing/
- Prisma Docs, *Integration Testing*. https://www.prisma.io/docs/orm/prisma-client/testing/integration-testing
