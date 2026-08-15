---
id: LAW-008
title: Lei de Comunicação Entre Módulos
status: canonical
version: 1.0.0
scope: backend-typescript
supersedes:
tags:
  - architecture
  - modular-monolith
  - integration
  - events
  - ports
  - canonical-law
related:
  - "[[LAW-001 Lei do Módulo]]"
  - "[[LAW-002 Lei da Camada Domain]]"
  - "[[LAW-003 Lei da Camada Application]]"
  - "[[LAW-004 Lei da Camada Infrastructure]]"
  - "[[LAW-006 Lei da Composition Root]]"
  - "[[LAW-007 Lei de Nomenclatura e Organização de Arquivos]]"
  - "[[LAW-009 Lei de Erros]]"
  - "[[LAW-010 Lei do Lib]]"
---

# Lei de Comunicação Entre Módulos

> Lei canônica que define como módulos se comunicam: o que cada módulo expõe ao mundo externo, como consumir outro módulo de forma síncrona, como publicar e reagir a eventos, e qual a fronteira entre consistência forte e consistência eventual. Esta lei aprofunda os pontos 5 e 6 da [[LAW-001 Lei do Módulo]].

## Definição

A **comunicação entre módulos** é o conjunto de protocolos pelos quais bounded contexts trocam informação e coordenam efeitos sem violar suas fronteiras. Em um modular monolith bem desenhado, módulos são caixas-pretas: cada um expõe uma **API pública explícita** e tudo mais é interno.

Existem dois protocolos canônicos:

- **Comunicação síncrona via facade** — o módulo A precisa de um dado do módulo B *agora* para continuar a request. A invoca uma port que aponta pra API pública de B.
- **Comunicação assíncrona via integration events** — o módulo B publica um evento ("algo aconteceu"). Módulos interessados (incluindo A) reagem em suas próprias transações.

A escolha entre os dois não é estilística. É arquitetural e tem implicação direta em consistência, acoplamento e capacidade de extração futura.

## Estrutura canônica

```
src/modules/<nome>/
├── domain/
│   ├── ports/
│   │   └── <outro-modulo>-port/         # port que enrollments declara pra falar com students
│   │       ├── index.ts
│   │       └── types.ts
│   └── events/
│       └── <evento>/                    # integration events publicados por este módulo
│           ├── index.ts
│           └── types.ts
├── application/
│   └── event-handlers/
│       └── on-<evento>-<acao>/          # handlers de domain events e integration events
│           ├── index.ts
│           └── types.ts
├── infrastructure/
│   └── module-adapters/
│       └── <outro-modulo>-port-adapter/ # implementação da port chamando o index.ts do outro módulo
│           └── index.ts
├── presentation/
│   └── public-api/
│       └── index.ts                     # interface PublicApi do módulo
└── index.ts                             # exporta a PublicApi e o registro de rotas
```

## Regras

### LAW-008.1 — Módulo expõe uma `PublicApi` tipada

**Regra:** Todo módulo declara uma interface `<n>PublicApi` em `presentation/public-api/index.ts`. Essa interface é o **contrato externo** do módulo: lista todos os métodos que outros módulos podem invocar de forma síncrona. A classe que implementa a `PublicApi` também vive em `presentation/public-api/` e é instanciada pela composition root do módulo (ver [[LAW-006 Lei da Composition Root]]).

**Justificativa:** A `PublicApi` é o contrato. Sem uma interface tipada explícita, "API pública do módulo" vira folclore — cada consumidor descobre por tentativa e erro o que pode chamar. Com a interface, o type-checker garante que mudanças incompatíveis quebrem em tempo de compilação.

**Exemplo certo:**
```ts
// students/presentation/public-api/index.ts
export interface StudentsPublicApi {
  exists(id: string): Promise<boolean>
  getBasicInfo(id: string): Promise<StudentBasicInfo | null>
  // ... apenas operações de leitura legítimas pra outros módulos
}

export interface StudentBasicInfo {
  readonly id: string
  readonly name: string
  readonly active: boolean
}

export class StudentsPublicApiImpl implements StudentsPublicApi {
  constructor(
    private readonly existsUseCase: ExistsStudentUseCase,
    private readonly getBasicInfoUseCase: GetStudentBasicInfoUseCase,
  ) {}

  exists(id: string): Promise<boolean> {
    return this.existsUseCase.execute({ studentId: id }).then(r => r.exists)
  }

  getBasicInfo(id: string): Promise<StudentBasicInfo | null> {
    return this.getBasicInfoUseCase.execute({ studentId: id })
  }
}
```

### LAW-008.2 — `index.ts` do módulo exporta a `PublicApi`, não use cases

**Regra:** O `index.ts` do módulo exporta:
- A **interface** `<n>PublicApi`.
- A **factory** que constrói a instância da `PublicApi` (consumindo o container).
- A função de registro de rotas.
- Os **tipos** dos integration events publicados.

Nunca exporta use cases, repositories, entities, controllers ou serializers diretamente.

**Justificativa:** Reforça [[LAW-001 Lei do Módulo]] regra 3. Expor use cases bypassa a `PublicApi` e cria múltiplos pontos de entrada — caminho mais curto pra fronteira fictícia.

**Exemplo certo:**
```ts
// students/index.ts
export type { StudentsPublicApi, StudentBasicInfo } from '@/modules/students/presentation/public-api'
export { createStudentsPublicApi } from '@/modules/students/composition/create-public-api'
export { registerStudentsRoutes } from '@/modules/students/presentation/routes'
export type { StudentActivated } from '@/modules/students/domain/events/student-activated'
export type { StudentDeactivated } from '@/modules/students/domain/events/student-deactivated'
```

### LAW-008.3 — Cada consumidor declara sua própria port; não compartilha

**Regra:** Quando o módulo A consome o módulo B, A declara uma interface `<B>Port` em `A/domain/ports/<b>-port/`. Essa port contém **apenas os métodos que A precisa**, com as assinaturas que A precisa — não a `PublicApi` inteira de B.

**Proibido:** A importar diretamente `BPublicApi` e usar como dependência de um use case.

**Justificativa:** Interface Segregation Principle (Uncle Bob). Ports específicas ao consumidor protegem A contra mudanças irrelevantes em B: se B adiciona métodos novos à `PublicApi`, A não é afetado. Se B mantém compatibilidade da `PublicApi` mas muda o que A precisa, só a port de A precisa atualizar — e o type-checker força A a notar.

**Exemplo certo:**
```ts
// enrollments/domain/ports/students-port/index.ts
export interface StudentsPort {
  exists(id: string): Promise<boolean>
  getBasicInfo(id: string): Promise<EnrollmentStudentInfo | null>
}

// note: tipo EnrollmentStudentInfo é declarado em enrollments,
// pode ter forma diferente de StudentBasicInfo de students
export interface EnrollmentStudentInfo {
  readonly id: string
  readonly name: string
  readonly canEnroll: boolean
}
```

**Exemplo errado:**
```ts
// enrollments/application/use-cases/enroll-student/index.ts
import type { StudentsPublicApi } from '@/modules/students' // VIOLAÇÃO

export class EnrollStudentUseCase {
  constructor(private readonly studentsApi: StudentsPublicApi) {} // acopla ao contrato inteiro de students
}
```

### LAW-008.4 — `module-adapters/` é a única ponte para outros módulos

**Regra:** A implementação concreta de uma port que aponta pra outro módulo vive **exclusivamente** em `infrastructure/module-adapters/<outro-modulo>-port-adapter/`. Esta pasta é a **única** do módulo autorizada a importar de `@/modules/<outro-modulo>`.

Imports de outros módulos em qualquer outra pasta são violação auditável.

**Justificativa:** Reforça [[LAW-004 Lei da Camada Infrastructure]] regra 8. Torna o grafo de dependências entre módulos fisicamente visível e auditável: `ls infrastructure/module-adapters/` lista com quais módulos este aqui fala.

**Exemplo certo:**
```ts
// enrollments/infrastructure/module-adapters/students-port-adapter/index.ts
import type { StudentsPort, EnrollmentStudentInfo } from '@/modules/enrollments/domain/ports/students-port'
import type { StudentsPublicApi } from '@/modules/students'

export class StudentsModuleAdapter implements StudentsPort {
  constructor(private readonly studentsApi: StudentsPublicApi) {}

  async exists(id: string): Promise<boolean> {
    return this.studentsApi.exists(id)
  }

  async getBasicInfo(id: string): Promise<EnrollmentStudentInfo | null> {
    const info = await this.studentsApi.getBasicInfo(id)
    if (!info) return null
    return {
      id: info.id,
      name: info.name,
      canEnroll: info.active,
    }
  }
}
```

Note que o adapter **traduz** `StudentBasicInfo` (vocabulário de students) para `EnrollmentStudentInfo` (vocabulário de enrollments). Essa tradução é parte do trabalho do adapter — ele é a fronteira semântica entre os dois bounded contexts.

### LAW-008.5 — Comunicação síncrona é apenas para leitura

**Regra:** Chamadas síncronas via facade entre módulos servem **exclusivamente** para consultas (leitura). Toda escrita que precisa atravessar fronteira de módulo acontece via integration event — o módulo origem publica o que aconteceu, e o módulo destino reage em sua própria transação.

**Proibido:** A invocar `B.activateStudent(id)` ou `B.cancelEnrollment(id)` via facade.

**Justificativa:** É a regra de ouro da comunicação inter-módulos. Escritas síncronas cross-module:
- Criam transação distribuída implícita (ou pior: duas transações independentes que podem divergir).
- Acoplam o tempo de resposta de A ao tempo de B (cascata de falhas).
- Tornam a extração futura de qualquer um dos módulos impossível sem reescrita.
- Misturam responsabilidades — A passa a saber *como* B muda estado, em vez de apenas *que* algo aconteceu.

Quando A precisa que B mude estado, A publica um evento descrevendo a intenção (ou A muda seu próprio estado e B reage ao evento). Coordenação de operações multi-módulo que precisam de atomicidade é resolvida com **saga** (ver LAW-008.10).

**Exemplo errado:**
```ts
// enrollments/application/use-cases/cancel-enrollment/index.ts
async execute(input) {
  await this.enrollments.cancel(input.enrollmentId)
  await this.studentsPort.deactivateStudent(input.studentId) // VIOLAÇÃO: escrita cross-module síncrona
}
```

**Exemplo certo:**
```ts
// enrollments cancela e publica
async execute(input) {
  const enrollment = await this.enrollments.cancel(input.enrollmentId)
  await this.eventBus.publish(new EnrollmentCancelled(enrollment.id, enrollment.studentId))
}

// students reage em seu próprio handler, decidindo se isso desativa o aluno
// students/application/event-handlers/on-enrollment-cancelled-evaluate-student-status/
```

### LAW-008.6 — Integration events têm formato canônico

**Regra:** Todo integration event implementa o contrato:

```ts
interface IntegrationEvent<TName extends string, TPayload> {
  readonly eventId: string         // UUID v4 — identificador único, usado para idempotência
  readonly eventName: TName        // discriminador para routing/serialização
  readonly occurredAt: Date        // quando o fato aconteceu no domínio
  readonly version: number         // versão do schema do payload
  readonly payload: TPayload       // dados — apenas tipos primitivos serializáveis
}
```

**Regras adicionais:**
- O nome do evento é em **pretérito** (`StudentActivated`, `EnrollmentCreated`, `PaymentSettled`).
- O payload contém **apenas tipos primitivos serializáveis** (`string`, `number`, `boolean`, `Date` como ISO 8601, arrays e objetos simples desses tipos). Nunca entities, VOs, classes do domain.
- O evento é **imutável** — todas as propriedades são `readonly`.

**Justificativa:** O formato canônico permite:
- **Idempotência** — consumidores rastreiam `eventId` processados e descartam duplicatas.
- **Routing** — o bus distribui por `eventName`.
- **Versionamento** — quando o schema muda incompatível, cria-se `<Evento>V2` e o `version` distingue.
- **Serialização** — quando o bus evolui pra Redis Streams/Kafka, eventos serializam sem perda.
- **Observabilidade** — `occurredAt` separa o tempo do fato do tempo de processamento, permitindo análise de lag.

**Exemplo certo:**
```ts
// students/domain/events/student-activated/index.ts
import type { IntegrationEvent } from '@/shared/messaging/integration-event'

export interface StudentActivatedPayload {
  readonly studentId: string
  readonly activatedAt: string  // ISO 8601
}

export class StudentActivated implements IntegrationEvent<'StudentActivated', StudentActivatedPayload> {
  readonly eventName = 'StudentActivated' as const
  readonly version = 1
  readonly eventId: string
  readonly occurredAt: Date
  readonly payload: StudentActivatedPayload

  constructor(params: { studentId: string; activatedAt: Date; eventId?: string; occurredAt?: Date }) {
    this.eventId = params.eventId ?? crypto.randomUUID()
    this.occurredAt = params.occurredAt ?? new Date()
    this.payload = {
      studentId: params.studentId,
      activatedAt: params.activatedAt.toISOString(),
    }
  }
}
```

### LAW-008.7 — Integration events vivem em `domain/events/` do módulo publicador

**Regra:** A definição da classe do integration event vive em `domain/events/<evento>/` no módulo que **publica** o evento. Consumidores importam **apenas o tipo** via `import type`.

**Justificativa:** O publicador é dono da semântica do evento — ele define quando o evento ocorre, qual seu payload, qual sua versão. Consumidores não devem depender da classe concreta (que poderia ser instanciada por eles, criando confusão sobre quem é o publicador real); dependem apenas do **tipo** para tipar seus handlers.

**Exemplo certo:**
```ts
// students publica
// students/domain/events/student-activated/index.ts → exporta classe StudentActivated

// enrollments consome
// enrollments/application/event-handlers/on-student-activated-reactivate-enrollments/index.ts
import type { StudentActivated } from '@/modules/students' // import type, não a classe

export class OnStudentActivatedReactivateEnrollments {
  async execute(event: StudentActivated): Promise<void> {
    // ...
  }
}
```

### LAW-008.8 — Versionamento de evento é aditivo; mudança incompatível cria novo evento

**Regra:** Mudanças compatíveis (adicionar campo opcional, relaxar constraint) são feitas no mesmo evento, incrementando `version` quando relevante. Mudanças incompatíveis (remover campo, mudar tipo, mudar significado) **criam um novo evento** (`StudentActivatedV2`) — o evento original continua sendo publicado em paralelo enquanto consumidores migram.

**Justificativa:** Eventos são contratos públicos do módulo. Quebra-los silenciosamente quebra todos os consumidores ao mesmo tempo. A coexistência de versões dá janela controlada de migração e permite fase de transição sem downtime.

**Nota de evolução:** quando o sistema cresce e múltiplos consumidores existem, considerar Schema Registry para enforcement programático.

### LAW-008.9 — Event handlers seguem as regras de use case

**Regra:** Handlers em `application/event-handlers/<handler>/` obedecem [[LAW-003 Lei da Camada Application]]:
- Nome descritivo no padrão `On<Evento><Ação>` (ex: `OnStudentActivatedReactivateEnrollments`).
- Método único `execute(event): Promise<void>`.
- Dependências injetadas via construtor.
- Orquestração pura, zero regra de negócio.
- Erros de domínio sobem; erros de infra são traduzidos.

**Distinção entre tipos de evento (do ponto de vista do consumidor):** nenhuma. Domain events publicados pelo próprio módulo e integration events publicados por outros módulos são consumidos pela mesma pasta `event-handlers/`. A distinção fica visível pelo import: handlers de eventos próprios importam de `@/modules/<self>/domain/events/`; handlers de eventos externos importam de `@/modules/<outro>` via `import type`.

**Justificativa:** Pro consumidor, o que importa é "evento chegou, eu reajo" — a origem é detalhe. Manter pastas separadas seria cerimônia sem ganho.

### LAW-008.10 — Operações multi-módulo que precisam de atomicidade são sagas

**Regra:** Quando um caso de uso de negócio exige que múltiplos módulos mudem estado de forma coordenada, a coordenação acontece via **saga**: uma sequência de passos onde cada passo é uma transação local em um módulo, disparada por evento, com **passo de compensação** definido caso a sequência precise ser revertida.

**Proibido:** invocar use cases de múltiplos módulos dentro de uma mesma transação (anti-pattern conhecido como "transação distribuída por código").

**Justificativa:** Atomicidade real cross-module exige two-phase commit ou similar — caro, frágil e desnecessário em quase todos os casos de negócio reais. Sagas modelam o fato de que processos de negócio têm passos com pontos legítimos de compensação ("se o pagamento falhar depois da matrícula, cancela a matrícula"). Documentar a saga deixa o fluxo de compensação explícito em vez de implícito.

**Nota de implementação inicial:** sagas começam **simples**, como handlers que reagem a eventos e publicam novos eventos. Frameworks de orquestração (Temporal, AWS Step Functions, Camunda) entram apenas quando a complexidade do fluxo justifica.

### LAW-008.11 — Event handlers são idempotentes

**Regra:** Todo event handler é projetado para ser executado **mais de uma vez com o mesmo evento** sem efeito colateral indesejado. A idempotência é garantida por:

1. **Verificação de `eventId` processado** — handler mantém registro dos `eventId` já tratados e descarta duplicatas.
2. **Operações naturalmente idempotentes** — usar `upsert` em vez de `insert`, verificar estado antes de mutar.

**Justificativa:** Bus de eventos garante "at-least-once delivery" na prática — duplicatas acontecem (retry após timeout, falha de ack, replay manual). Handler não-idempotente que processa `EnrollmentCreated` duas vezes cria duas matrículas, dois cobrança, dois emails. Idempotência é responsabilidade do **consumidor**, não do publicador.

**Exemplo certo:**
```ts
async execute(event: EnrollmentCreated): Promise<void> {
  const alreadyProcessed = await this.processedEvents.has(event.eventId)
  if (alreadyProcessed) return

  await this.unitOfWork.run(async () => {
    await this.someUseCase.execute(/* ... */)
    await this.processedEvents.markProcessed(event.eventId)
  })
}
```

### LAW-008.12 — Publicação confiável: outbox quando o ambiente exigir

**Regra:** Quando a publicação de um integration event precisa ser **garantida** ao commit da transação que o originou, o módulo usa o **transactional outbox pattern**: o evento é gravado em uma tabela de outbox **na mesma transação** que persiste o agregado, e um processo separado lê a outbox e publica no bus.

**Quando aplicar:**
- Bus externo (Redis Streams, Kafka, RabbitMQ) já em uso.
- Consumidores em outros processos/serviços.
- Negócio exige garantia "se o estado mudou, o evento foi publicado".

**Quando dispensar (estado atual do projeto):**
- Bus in-process (EventEmitter local).
- Publicação dentro da mesma transação do agregado (evento é "publicado" só após commit, no mesmo processo).
- Tolerância a perda de evento em caso de crash entre commit e publish é aceitável.

**Justificativa:** Outbox resolve o "dual write problem" — sem ele, há janela onde a transação commitou mas o evento não foi publicado (crash do processo, falha do bus). Pra sistemas in-process atuais, a janela é minúscula e o custo do outbox supera o benefício. A regra exige outbox quando o ambiente passa a torná-lo necessário, sem onerar o estado atual.

**Aprofundamento futuro:** quando o sistema migrar pra bus externo, esta regra ganha precedência sobre simplicidade — outbox passa a ser obrigatório.

### LAW-008.13 — Bus de eventos é injetado via port; nunca acessado globalmente

**Regra:** O `EventBus` é declarado como port em `domain/ports/event-bus/` em cada módulo que publica ou consome eventos. A implementação concreta vive em `shared/messaging/` (in-process atual) e é injetada na composition root.

**Proibido:** singleton global importado, `import { eventBus } from 'somewhere'`, ou qualquer acesso fora de injeção via construtor.

**Justificativa:** Tratar o bus como port mantém o domain testável (mock trivial) e prepara a migração pra bus externo sem mudanças no domain/application — só a implementação injetada muda.

## Sumário executivo

| # | Regra | Consequência da violação |
|---|-------|--------------------------|
| 1 | Módulo expõe `PublicApi` tipada em `presentation/public-api/` | API pública implícita, contratos por folclore |
| 2 | `index.ts` exporta `PublicApi`, não use cases | Múltiplos pontos de entrada, fronteira fictícia |
| 3 | Cada consumidor declara sua própria port | Acoplamento ao contrato inteiro do outro módulo |
| 4 | `module-adapters/` é a única ponte pra outros módulos | Grafo de dependência oculto |
| 5 | Comunicação síncrona é apenas para leitura | Transação distribuída implícita, cascata de falhas |
| 6 | Integration events têm formato canônico (eventId, occurredAt, version) | Sem idempotência, sem versionamento, sem rastreio |
| 7 | Eventos vivem em `domain/events/` do publicador | Confusão sobre dono semântico |
| 8 | Versionamento aditivo; quebra cria novo evento | Quebra silenciosa de consumidores |
| 9 | Event handlers seguem regras de use case | Lógica duplicada, regra de negócio em handler |
| 10 | Operações multi-módulo atômicas são sagas | Transação distribuída por código |
| 11 | Event handlers são idempotentes | Duplicação de efeitos em retry/replay |
| 12 | Outbox quando o ambiente exigir publicação garantida | Dual write problem, eventos perdidos |
| 13 | Event bus é port injetado, nunca singleton global | Domain acoplado a tecnologia, testes frágeis |

## Referências

- Eric Evans, *Domain-Driven Design* (2003), capítulo sobre Bounded Context Integration.
- Vaughn Vernon, *Implementing Domain-Driven Design* (2013), capítulo sobre Domain Events e Integration Strategies.
- Martin Fowler, *What do you mean by "Event-Driven"?*. https://martinfowler.com/articles/201701-event-driven.html
- Kamil Grzybek, *Modular Monolith: Integration Styles*. https://www.kamilgrzybek.com/blog/posts/modular-monolith-integration-styles
- Kamil Grzybek, `modular-monolith-with-ddd` — Integration Events e Outbox. https://github.com/kgrzybek/modular-monolith-with-ddd
- Chris Richardson, *Pattern: Saga*. https://microservices.io/patterns/data/saga.html
- Gunnar Morling, *Reliable Microservices Data Exchange With the Outbox Pattern*. https://debezium.io/blog/2019/02/19/reliable-microservices-data-exchange-with-the-outbox-pattern/
- NILUS, *Domain Events vs Integration Events in DDD*. https://www.nilus.be/blog/domain_events_vs_integration_events_in_ddd/
- Milan Jovanovic, *How To Use Domain Events To Build Loosely Coupled Systems*. https://www.milanjovanovic.tech/blog/how-to-use-domain-events-to-build-loosely-coupled-systems
