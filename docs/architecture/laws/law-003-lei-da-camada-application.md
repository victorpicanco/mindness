---
id: LAW-003
title: Lei da Camada Application
status: canonical
version: 1.0.0
scope: backend-typescript
supersedes: null
tags: [architecture, clean-architecture, application-layer, use-cases, canonical-law]
related:
  - "[[LAW-001 Lei do Módulo]]"
  - "[[LAW-002 Lei da Camada Domain]]"
  - "[[LAW-004 Lei da Camada Infrastructure]]"
  - "[[LAW-005 Lei da Camada Presentation]]"
  - "[[LAW-006 Lei da Composition Root]]"
  - "[[LAW-007 Lei de Nomenclatura e Organização de Arquivos]]"
  - "[[LAW-008 Lei de Comunicação Entre Módulos]]"
  - "[[LAW-009 Lei de Erros]]"
---
# Lei da Camada Application

> Lei canônica que define o que é e o que não é a camada application, como os use cases se organizam, o que podem fazer e o que devem delegar. A application é a camada que orquestra cenários de negócio usando o domain como vocabulário. Esta lei é referência para qualquer agente ou humano escrevendo use cases.

## Definição

A **camada application** contém as **regras de negócio específicas da aplicação** (application business rules, no vocabulário de Uncle Bob). Ela não contém lógica de domínio — a lógica de domínio mora em entities, VOs e domain services. A application **orquestra** o domínio pra cumprir **cenários concretos de uso** iniciados por atores externos.

A unidade fundamental da application é o **use case**: uma classe (ou função) que representa **uma intenção de negócio específica e completa** — "Criar Aluno", "Matricular Aluno em Curso", "Cancelar Matrícula".

A application é **transporte-agnostic**. Um use case não sabe se foi invocado por HTTP, CLI, fila, job agendado ou teste. Essa é a pedra de toque da camada.

## Estrutura canônica

```
src/modules/<nome>/application/
├── use-cases/
│   └── <use-case-em-kebab-case>/
│       ├── index.ts        # a classe/função do use case
│       ├── types.ts        # Input e Output DTOs
│       └── errors.ts       # (opcional) erros específicos do use case
├── event-handlers/         # handlers de domain events e integration events
│   └── <handler>/
│       ├── index.ts
│       └── types.ts
└── dtos/                   # (opcional) DTOs compartilhados entre use cases
    └── <dto>/
        └── index.ts
```

## Regras

### LAW-003.1 — Um use case representa uma única intenção de negócio

**Regra:** Cada use case tem **um** propósito de negócio e **uma** forma de ser invocado. Nomes são verbais e específicos: `CreateStudent`, `EnrollStudentInCourse`, `CancelEnrollment`, `SuspendStudent`. Nomes genéricos (`StudentService`, `StudentManager`, `StudentHandler`) são **proibidos**.

**Justificativa:** É o Single Responsibility Principle aplicado à camada. Um use case com múltiplas responsabilidades vira god-class — o bad pattern que esta lei foi desenhada pra eliminar. Um nome genérico é sinal quase certo de múltiplas responsabilidades escondidas.

**Critério prático:** se você não consegue descrever o que o use case faz em uma frase no presente do indicativo ("cria um aluno", "matricula o aluno no curso"), ele tem mais de uma responsabilidade.

### LAW-003.2 — Use case não chama outro use case

**Regra:** Um use case **nunca** instancia, injeta ou invoca outro use case. Se dois use cases compartilham lógica, essa lógica:

1. Pertence ao **domain** (entity, value object, domain service) → mover pra lá.
2. É orquestração pura de I/O → criar um **port** no domain e injetar.
3. É reação a um evento → usar **event handler** reagindo a domain event.

**Justificativa:** Use cases que se chamam criam grafos de dependência ocultos, acoplam cenários de uso entre si e tornam impossível testar um sem os outros. O "reuso" via invocação cruzada é o caminho mais curto pra god-module. Se um use case A precisa do efeito de B, isso é sinal de que:

- B publica um evento e A reage (ou vice-versa), **ou**
- A e B compartilham uma operação de domínio que deveria estar numa entity/domain service, **ou**
- A e B são na verdade **o mesmo caso de uso** mal fatorado.

**Exemplo errado:**
```ts
// application/use-cases/enroll-student/index.ts
export class EnrollStudentUseCase {
  constructor(
    private readonly createPaymentUseCase: CreatePaymentUseCase, // VIOLAÇÃO
    private readonly sendWelcomeEmailUseCase: SendWelcomeEmailUseCase, // VIOLAÇÃO
  ) {}

  async execute(input: EnrollStudentInput): Promise<EnrollStudentOutput> {
    const enrollment = // ...
    await this.createPaymentUseCase.execute({ /* ... */ })
    await this.sendWelcomeEmailUseCase.execute({ /* ... */ })
    return { /* ... */ }
  }
}
```

**Exemplo certo:**
```ts
// application/use-cases/enroll-student/index.ts
export class EnrollStudentUseCase {
  constructor(
    private readonly enrollments: EnrollmentsRepository,
    private readonly students: StudentsRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: EnrollStudentInput): Promise<EnrollStudentOutput> {
    // ... lógica de matrícula ...
    await this.eventBus.publish(new EnrollmentCreated(enrollment.id, student.id))
    return { enrollmentId: enrollment.id.value }
  }
}

// application/event-handlers/on-enrollment-created-create-payment/index.ts
// outro handler reage e cria o pagamento

// application/event-handlers/on-enrollment-created-send-welcome-email/index.ts
// outro handler reage e envia o email
```

### LAW-003.3 — Use case expõe método único `execute(input): Promise<output>`

**Regra:** A interface pública de todo use case é:

```ts
class <Name>UseCase {
  execute(input: <Name>Input): Promise<<Name>Output>
}
```

Nada de `run`, `handle`, `invoke`, `perform`. Nada de múltiplos métodos públicos (`create`, `update`, `delete` no mesmo use case). Um método, um propósito.

**Justificativa:** Uniformidade de contrato. Permite que controllers, event handlers, jobs e testes invoquem use cases sem saber de qual se trata. Também facilita middlewares de aplicação (logging, tracing, transação) que decoram `execute`.

### LAW-003.4 — Input e Output são DTOs em `types.ts`

**Regra:** Cada use case declara seus tipos `Input` e `Output` em `types.ts`, ao lado do `index.ts`. Ambos são:

1. **Estruturas puras** (interfaces ou types), sem métodos.
2. **Compostos por primitivos** (`string`, `number`, `boolean`, `Date`) ou por outros DTOs — **nunca** entities ou VOs do domain.
3. **Serializáveis**: podem ser convertidos pra JSON sem perda.

**Justificativa:** Expor entity do domain no Input/Output faz o mundo externo (controller, fila, CLI) conhecer o domain model — viola encapsulamento e cria acoplamento em direção errada. DTO é o contrato da application com o mundo; entity é o modelo interno.

**Exemplo errado:**
```ts
// types.ts
import { Student } from '@/modules/students/domain/entities/student' // VIOLAÇÃO

export type CreateStudentOutput = {
  student: Student // expõe entity pra fora
}
```

**Exemplo certo:**
```ts
// types.ts
export type CreateStudentInput = {
  readonly name: string
  readonly email: string
}

export type CreateStudentOutput = {
  readonly studentId: string
  readonly createdAt: string // ISO 8601
}
```

### LAW-003.5 — Use case não retorna entity nem Value Object

**Regra:** O tipo `Output` de um use case **não** contém instâncias de entities ou VOs. Quando o cliente precisa de dados do agregado, o use case **mapeia** pra um DTO plano antes de retornar.

**Justificativa:** Se um controller recebe uma entity, ele pode invocar métodos de negócio (`student.suspend()`) — ou seja, pode executar lógica de domínio fora do lugar onde ela deveria viver. Retornando DTO, essa possibilidade some.

**Exemplo certo:**
```ts
async execute(input: GetStudentInput): Promise<GetStudentOutput> {
  const student = await this.students.findById(StudentId.create(input.studentId))
  if (!student) throw new StudentNotFoundError(input.studentId)

  return {
    id: student.id.value,
    name: student.name.value,
    email: student.email.value,
    status: student.status,
    createdAt: student.createdAt.toISOString(),
  }
}
```

### LAW-003.6 — Use case depende apenas de domain (interfaces) e de outros use cases é proibido

**Regra:** As dependências de um use case, declaradas via construtor, são:

1. **Interfaces de repository** (de `domain/repositories/`).
2. **Ports** (de `domain/ports/`).
3. **Event bus** (como port ou interface do próprio domain).

**Proibido:** injetar implementações concretas (Prisma client, axios instance, classe de infra), injetar outros use cases (ver LAW-003.2), importar de `infrastructure/` ou `presentation/`.

**Justificativa:** Isso garante que o use case seja testável sem bootstrap pesado: no teste você passa mocks das interfaces e verifica o comportamento. Também sustenta a Regra da Dependência — application só aponta pra domain, nunca pra fora.

**Exemplo errado:**
```ts
import { PrismaClient } from '@prisma/client' // VIOLAÇÃO
import axios from 'axios' // VIOLAÇÃO

export class CreateStudentUseCase {
  constructor(private readonly prisma: PrismaClient) {} // VIOLAÇÃO
}
```

**Exemplo certo:**
```ts
import type { StudentsRepository } from '@/modules/students/domain/repositories/students-repository'
import type { IdGenerator } from '@/modules/students/domain/ports/id-generator'
import type { EventBus } from '@/modules/students/domain/ports/event-bus'

export class CreateStudentUseCase {
  constructor(
    private readonly students: StudentsRepository,
    private readonly idGenerator: IdGenerator,
    private readonly eventBus: EventBus,
  ) {}
}
```

### LAW-003.7 — Use case não contém regra de negócio; ele orquestra

**Regra:** O corpo de um `execute` é composto por:

1. Converter `Input` (primitivos) em VOs/IDs do domain.
2. Carregar agregados via repositories.
3. Chamar **métodos de negócio nas entities** ou domain services.
4. Persistir agregados via repositories.
5. Publicar eventos via event bus.
6. Mapear resultado pra `Output`.

Cálculos, validações de invariante, transições de estado — tudo isso mora no **domain**, não no use case. Se o corpo do `execute` tem `if` decidindo regra de negócio, a regra está no lugar errado.

**Justificativa:** É o ponto mais sutil e violado. Use case que "faz as contas" é transaction script disfarçado e transforma o domain em repositório de DTOs anêmicos. A regra é: **se é sobre o quê o negócio faz, é domain; se é sobre como o cenário de uso se desenrola (sequência, I/O, coordenação), é application**.

**Exemplo errado (regra de negócio no use case):**
```ts
async execute(input: EnrollStudentInput): Promise<EnrollStudentOutput> {
  const student = await this.students.findById(/* ... */)
  const course = await this.courses.findById(/* ... */)

  // VIOLAÇÃO: regra de negócio no use case
  if (student.age < 18 && course.requiresAdult) {
    throw new Error('Adult course requires 18+')
  }
  if (course.seatsAvailable <= 0) {
    throw new Error('No seats available')
  }

  const enrollment = new Enrollment(student.id, course.id, new Date())
  // ...
}
```

**Exemplo certo (use case orquestra, domain decide):**
```ts
async execute(input: EnrollStudentInput): Promise<EnrollStudentOutput> {
  const student = await this.students.findById(StudentId.create(input.studentId))
  const course = await this.courses.findById(CourseId.create(input.courseId))

  if (!student) throw new StudentNotFoundError(input.studentId)
  if (!course) throw new CourseNotFoundError(input.courseId)

  // domain decide se pode; se não, lança erro de domínio
  const enrollment = course.enroll(student, this.clock.now())

  await this.enrollments.save(enrollment)
  await this.eventBus.publish(new EnrollmentCreated(enrollment.id.value, student.id.value))

  return { enrollmentId: enrollment.id.value }
}
```

Note: `course.enroll(student, now)` encapsula as regras — idade mínima, vagas disponíveis, período de matrícula aberto. O use case só **coordena**.

### LAW-003.8 — Use case é a fronteira transacional

**Regra:** Uma execução de `execute` corresponde a **uma** transação de negócio. Se o use case modifica múltiplos agregados ou múltiplas tabelas, essas operações acontecem dentro de uma única transação de banco, aberta e fechada no use case (ou num decorator que o envolve).

**Justificativa:** O use case é o único ponto onde a aplicação tem visão completa do cenário; ele é quem sabe quando a operação começa e termina. Abrir transação no repository é cedo demais (fragmenta); abrir no controller é tarde demais (vaza infra pra camada errada).

**Limite:** a transação **não cruza** fronteiras de módulo — ver [[LAW-001 Lei do Módulo]], regra 1.8. Operações que parecem exigir isso devem ser quebradas em passos coordenados por eventos.

**Nota de implementação:** a abertura/fechamento de transação pode ser feita via um **Unit of Work** port injetado, ou via decorator aplicado pela composition root. O que não pode é o use case chamar `prisma.$transaction` diretamente (acoplamento com ORM).

### LAW-003.9 — Use case valida Input, mas a validação de negócio é do domain

**Regra:** O use case valida que o `Input` está **estruturalmente correto** (campos presentes, formatos reconhecíveis) ao converter primitivos em VOs. A validação **semântica de negócio** (email único, saldo suficiente, aluno ativo) é delegada ao domain — acontece ao construir VOs, carregar agregados e invocar métodos de negócio.

**Distinção:**
- Validação estrutural: "email tem `@`", "idade é inteiro positivo" → acontece no construtor do VO (`StudentEmail.create`), chamado no início do `execute`.
- Validação de negócio: "email ainda não existe no sistema", "aluno pode se matricular neste curso" → acontece ao carregar agregados e invocar métodos.

**Proibido:** validação de Input no controller usando schemas que bypassam o domain. O controller valida **formato HTTP** (existência de campos obrigatórios, tipos JSON corretos); validação semântica é da application/domain. Ver [[LAW-005 Lei da Camada Presentation]].

### LAW-003.10 — Erros de use case: de domínio sobem; de infra são traduzidos

**Regra:** Quando o use case chama o domain e o domain lança um erro de domínio (ex: `StudentAlreadyExistsError`), esse erro **sobe inalterado** para fora do use case. Quando um port/repository lança erro de infraestrutura (ex: `DatabaseConnectionError`), o use case **traduz** pra erro de aplicação (`OperationFailedError`) ou re-lança mantendo contexto.

**Justificativa:** Erros de domínio são parte do contrato do módulo e precisam chegar à apresentação pra mapeamento HTTP consistente. Erros de infra nunca devem vazar pra apresentação crus — denunciam tecnologia e dão dicas pra atacante.

**Exemplo certo:**
```ts
async execute(input: CreateStudentInput): Promise<CreateStudentOutput> {
  try {
    const email = StudentEmail.create(input.email) // pode lançar InvalidEmailError
    const existing = await this.students.findByEmail(email.value)
    if (existing) throw new StudentAlreadyExistsError(email.value) // erro de domínio sobe

    // ...
  } catch (err) {
    if (isDomainError(err)) throw err // domínio sobe
    throw new OperationFailedError('create-student', { cause: err })
  }
}
```

Hierarquia completa é tratada em [[LAW-009 Lei de Erros]].

### LAW-003.11 — Event handlers seguem as mesmas regras de use cases

**Regra:** Handlers em `application/event-handlers/<handler>/index.ts` obedecem às mesmas leis dos use cases: uma intenção por handler, nomes descritivos (`OnEnrollmentCreatedCreatePayment`), `execute(event)` como método público, dependências injetadas, orquestração pura, zero lógica de negócio.

**Diferença:** o `Input` de um handler é **um evento** (domain event ou integration event), não um DTO arbitrário. O `Output` geralmente é `void` — handlers não têm chamador que espera resultado.

**Justificativa:** Event handlers **são** use cases disparados por eventos em vez de por controllers. Trata-los como cidadãos de segunda classe leva a lógica duplicada, handlers inchados e bagunça arquitetural.

### LAW-003.12 — Cada use case é uma pasta com `index.ts`, `types.ts` (e opcionalmente `errors.ts`)

**Regra:** Segue [[LAW-007 Lei de Nomenclatura e Organização de Arquivos]]:

```
use-cases/enroll-student/
├── index.ts     # export class EnrollStudentUseCase
├── types.ts     # EnrollStudentInput, EnrollStudentOutput
└── errors.ts    # (opcional) erros que só esse use case produz
```

Arquivos soltos (`enroll-student.ts`, `enroll-student.types.ts`) são **proibidos**.

**Justificativa:** Uniformidade, previsibilidade em leitura automatizada, menos tokens consumidos por agentes que querem ler só o contrato (`types.ts`) ou só a implementação (`index.ts`).

## Sumário executivo

| # | Regra | Consequência da violação |
|---|-------|--------------------------|
| 1 | Um use case = uma intenção de negócio específica | God-class, responsabilidades embaralhadas |
| 2 | Use case não chama outro use case | Grafo de dependência oculto, testes impossíveis |
| 3 | Método único `execute(input): Promise<output>` | Contrato não uniforme, middleware impossível |
| 4 | Input e Output são DTOs puros em `types.ts` | Vazamento de domain pra fora |
| 5 | Use case não retorna entity nem VO | Lógica de domínio executável fora do domain |
| 6 | Depende só de interfaces do domain (nunca de outros use cases) | Acoplamento com infra, testes frágeis |
| 7 | Use case orquestra; regra de negócio é do domain | Transaction script, modelo anêmico |
| 8 | Use case é a fronteira transacional | Fragmentação ou vazamento de transação |
| 9 | Valida estrutura; negócio valida no domain | Validação duplicada ou incompleta |
| 10 | Erros de domínio sobem; erros de infra são traduzidos | Vazamento de tecnologia pra presentation |
| 11 | Event handlers seguem as mesmas regras | Lógica duplicada, handlers inchados |
| 12 | Pasta-por-use-case com `index.ts` e `types.ts` | Organização imprevisível |

## Referências

- Robert C. Martin, *Clean Architecture* (2017), capítulos sobre Use Cases e Regra da Dependência.
- Robert C. Martin, *The Clean Architecture*. https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html
- Eric Evans, *Domain-Driven Design* (2003), capítulo sobre Application Services.
- Vaughn Vernon, *Implementing Domain-Driven Design* (2013), capítulo sobre Application Layer.
- George, *Clean DDD lessons: use cases*. https://medium.com/unil-ci-software-engineering/clean-ddd-lessons-use-cases-e9d11f64a0e9
- Kranio, *Application-Services Patterns in Domain-Driven Design*.
- Martin Fowler, *AnemicDomainModel*. https://martinfowler.com/bliki/AnemicDomainModel.html
- Kamil Grzybek, `modular-monolith-with-ddd`, estrutura de Application Layer. https://github.com/kgrzybek/modular-monolith-with-ddd
