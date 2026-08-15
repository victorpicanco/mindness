---
id: LAW-002
title: Lei da Camada Domain
status: canonical
version: 1.0.0
scope: backend-typescript
supersedes: null
tags: [architecture, ddd, domain, entities, value-objects, canonical-law]
related:
  - "[[LAW-001 Lei do Módulo]]"
  - "[[LAW-003 Lei da Camada Application]]"
  - "[[LAW-004 Lei da Camada Infrastructure]]"
  - "[[LAW-007 Lei de Nomenclatura e Organização de Arquivos]]"
  - "[[LAW-008 Lei de Comunicação Entre Módulos]]"
  - "[[LAW-009 Lei de Erros]]"
---

# Lei da Camada Domain

> Lei canônica que define o que é e o que não é a camada domain, como ela se organiza, o que pode e o que não pode conter. O domain é o núcleo do módulo e a fonte da verdade para todas as regras de negócio. Esta lei é referência para qualquer agente ou humano escrevendo código de domínio.

## Definição

A **camada domain** é o núcleo do módulo. Ela contém as regras de negócio que existiriam mesmo se o software não existisse — o vocabulário e as invariantes do bounded context em forma de código.

O domain é **framework-agnostic, library-agnostic, persistência-agnostic, transporte-agnostic**. Se amanhã você trocar Fastify por Hono, Prisma por Drizzle, HTTP por gRPC, **nada no domain muda**. Essa é a pedra de toque da camada.

## Estrutura canônica

```
src/modules/<nome>/domain/
├── entities/           # objetos com identidade e ciclo de vida
│   └── <entity>/
│       ├── index.ts
│       └── types.ts
├── value-objects/      # objetos imutáveis definidos por seus valores
│   └── <value-object>/
│       └── index.ts
├── repositories/       # interfaces (ports) de persistência
│   └── <nome>-repository/
│       └── index.ts
├── ports/              # interfaces de serviços externos consumidos
│   └── <nome>-port/    # (inclui ports pra outros módulos)
│       └── index.ts
├── errors/             # erros de negócio
│   └── <erro>/
│       └── index.ts
├── events/             # domain events e integration events
│   └── <evento>/
│       └── index.ts
└── services/           # (opcional) domain services para lógica cross-entity
    └── <service>/
        └── index.ts
```

**Nota:** `services/` é opcional e deve ser o último recurso. Ver LAW-002.11.

## Regras

### LAW-002.1 — Domain não importa de fora do domain

**Regra:** Nenhum arquivo dentro de `domain/` pode importar de:
- Qualquer outra camada do mesmo módulo (`application/`, `infrastructure/`, `presentation/`, `composition/`).
- Qualquer outro módulo (`@/modules/<outro>/...`).
- Bibliotecas de framework (Fastify, Express), ORM (Prisma, TypeORM, Drizzle), HTTP client (axios, fetch wrappers), validação (zod, joi), logger, queue, cache.
- Tipos gerados por ferramentas externas (`@prisma/client`, tipos de migração, etc.).

**Permitido importar:** apenas outros arquivos do próprio `domain/` do mesmo módulo, e tipos nativos do TypeScript/JavaScript (`Date`, `Map`, `Set`, etc.).

**Justificativa:** É a aplicação direta da Regra da Dependência (Uncle Bob). O domain é o círculo mais interno; se ele conhece o externo, a arquitetura inverteu. Se o domain importa Prisma, a regra de negócio fica refém de uma escolha de ORM, e toda a premissa do módulo como unidade portável desmorona.

**Exemplo errado:**
```ts
// domain/entities/student/index.ts
import { Student as PrismaStudent } from '@prisma/client'
import { FastifyRequest } from 'fastify'
import { z } from 'zod'

export class Student {
  static fromPrisma(row: PrismaStudent): Student { /* ... */ }
}
```

**Exemplo certo:**
```ts
// domain/entities/student/index.ts
import type { StudentId } from './types'
import { StudentEmail } from '../../value-objects/student-email'
import { InvalidStudentStateError } from '../../errors/invalid-student-state'

export class Student {
  // ...
}
```

### LAW-002.2 — Entities protegem suas invariantes

**Regra:** Entities não são bolsas de getters e setters. Toda entity:

1. Tem construtor privado (ou factory estática `create`) que valida o estado inicial.
2. Expõe propriedades como `readonly` ou via getters — nunca setters públicos.
3. Muda de estado **apenas** através de métodos com nomes de negócio (`activate()`, `suspend()`, `enroll()`, `rename()`), não via atribuição direta.
4. Rejeita transições de estado inválidas lançando erros de domínio.

**Justificativa:** Uma entity que aceita qualquer estado é um DTO disfarçado — o padrão que Martin Fowler batizou de Anemic Domain Model (anti-pattern). Quando regras vivem fora da entity, qualquer use case pode criar uma entity inconsistente, e a responsabilidade por validar se espalha pelo sistema inteiro.

**Exemplo errado (modelo anêmico):**
```ts
export class Student {
  public id: string
  public email: string
  public status: 'active' | 'suspended' | 'inactive'

  constructor(id: string, email: string, status: string) {
    this.id = id
    this.email = email
    this.status = status as any
  }
}

// em algum use case:
const student = new Student('abc', 'not-an-email', 'whatever')
student.status = 'active' // nada impede
```

**Exemplo certo (modelo rico):**
```ts
export class Student {
  private constructor(
    public readonly id: StudentId,
    private _email: StudentEmail,
    private _status: StudentStatus,
  ) {}

  static create(params: { id: StudentId; email: StudentEmail }): Student {
    return new Student(params.id, params.email, StudentStatus.Active)
  }

  get email(): StudentEmail { return this._email }
  get status(): StudentStatus { return this._status }

  suspend(): void {
    if (this._status === StudentStatus.Inactive) {
      throw new InvalidStudentStateError('Cannot suspend inactive student')
    }
    this._status = StudentStatus.Suspended
  }

  changeEmail(newEmail: StudentEmail): void {
    this._email = newEmail
  }
}
```

### LAW-002.3 — Value Objects são imutáveis e validam no construtor

**Regra:** Value Objects:

1. São **imutáveis**: propriedades `readonly`, nenhum método que mute estado interno.
2. Validam suas invariantes no construtor ou em factory estática — impossível criar um Value Object em estado inválido.
3. Têm igualdade **por valor**, não por referência: implementam `equals(other)`.
4. "Mudar" um VO significa criar um novo.

**Justificativa:** VOs são como tipos primitivos enriquecidos — `Email`, `Money`, `CPF`, `DateRange`. Se eles podem ser inválidos ou mutáveis, perdem a razão de existir: centralizar validação e garantir estado sempre válido.

**Exemplo certo:**
```ts
export class StudentEmail {
  private constructor(public readonly value: string) {}

  static create(raw: string): StudentEmail {
    const trimmed = raw.trim().toLowerCase()
    if (!trimmed.includes('@') || trimmed.length > 255) {
      throw new InvalidEmailError(raw)
    }
    return new StudentEmail(trimmed)
  }

  equals(other: StudentEmail): boolean {
    return this.value === other.value
  }
}
```

**Quando usar VO em vez de primitivo:** sempre que um primitivo (`string`, `number`) representar um conceito do domínio com regras próprias. Preço, email, CPF, coordenada geográfica, faixa de datas — tudo VO. Primitivos crus no domain são sinal de *primitive obsession*.

### LAW-002.4 — Repositories são interfaces, não implementações

**Regra:** `domain/repositories/<nome>-repository/index.ts` contém **exclusivamente a interface** do repository. A implementação concreta vive em `infrastructure/repositories/` (ver [[LAW-004 Lei da Camada Infrastructure]]).

**Justificativa:** É a aplicação do Dependency Inversion Principle: o domain define o contrato, a infra se adapta. Isso é o que permite trocar Prisma por Drizzle sem tocar no domain.

**Exemplo certo:**
```ts
// domain/repositories/students-repository/index.ts
import type { Student } from '../../entities/student'
import type { StudentId } from '../../entities/student/types'

export interface StudentsRepository {
  findById(id: StudentId): Promise<Student | null>
  findByEmail(email: string): Promise<Student | null>
  save(student: Student): Promise<void>
  delete(id: StudentId): Promise<void>
}
```

### LAW-002.5 — Interfaces de repository não vazam tipos de ORM ou persistência

**Regra:** Os tipos usados nas assinaturas da interface do repository são exclusivamente:
- Entities e Value Objects do próprio domain.
- Tipos primitivos do TypeScript.
- Tipos definidos no próprio `domain/` (em `types.ts` da entity, etc.).

**Proibido:** usar `Prisma.StudentWhereInput`, `FindOptionsWhere<T>`, `SelectQueryBuilder`, ou qualquer tipo que denuncie uma tecnologia específica de persistência.

**Justificativa:** É o bad pattern mais insidioso em projetos com ORM. Parece inofensivo ("é só um tipo"), mas cria acoplamento em tempo de compilação: o domain passa a depender do Prisma. A partir daí, trocar de ORM exige reescrever o domain, e o módulo deixa de ser uma unidade portável.

**Exemplo errado:**
```ts
import { Prisma } from '@prisma/client'

export interface StudentsRepository {
  findMany(where: Prisma.StudentWhereInput): Promise<Student[]>  // VIOLAÇÃO
}
```

**Exemplo certo:**
```ts
export interface StudentsRepository {
  findActiveByEnrollmentDate(range: DateRange): Promise<Student[]>
  findById(id: StudentId): Promise<Student | null>
}
```

Métodos de busca devem refletir **intenções de negócio**, não querys genéricas. Se você precisa de 15 variações de `findBy`, a interface está errada e está servindo à persistência em vez do domínio.

### LAW-002.6 — Repository opera sobre agregados inteiros

**Regra:** Um repository retorna e persiste **agregados completos** (entity raiz + suas entities internas + VOs), não fragmentos. O método `save(student)` persiste o aluno **e** seus VOs e entities associadas atomicamente.

**Justificativa:** O agregado é a unidade de consistência transacional (Evans). Permitir que métodos do repository retornem/salvem pedaços quebra as invariantes que a entity raiz está ali pra proteger.

**Exceção:** projeções de leitura otimizadas para queries específicas (CQRS read model) podem viver em repositories separados — mas isso é padrão avançado e fora do escopo desta lei na versão atual.

### LAW-002.7 — Erros de domínio são classes nomeadas, não strings

**Regra:** Toda violação de invariante ou transição inválida de estado lança uma **classe de erro** declarada em `domain/errors/<erro>/index.ts`. Nomes são expressivos e em termos de negócio: `StudentAlreadyEnrolledError`, `InsufficientBalanceError`, `EnrollmentPeriodClosedError`.

**Proibido:** lançar `Error('...')` genérico, `throw 'string literal'`, ou usar erros de biblioteca (`ZodError`, `PrismaClientKnownRequestError`) dentro do domain.

**Justificativa:** Erros de domínio são parte do contrato do módulo tanto quanto as entities. Permitem que camadas superiores distingam "aluno não existe" de "aluno está inativo" sem parsear strings, e possibilitam mapeamento consistente pra respostas HTTP em [[LAW-005 Lei da Camada Presentation]].

**Exemplo certo:**
```ts
// domain/errors/student-not-found/index.ts
export class StudentNotFoundError extends Error {
  readonly code = 'STUDENT_NOT_FOUND'
  constructor(public readonly studentId: string) {
    super(`Student with id ${studentId} not found`)
    this.name = 'StudentNotFoundError'
  }
}
```

Hierarquia completa e mapeamento HTTP são tratados em [[LAW-009 Lei de Erros]].

### LAW-002.8 — Domain events vivem em `domain/events/`

**Regra:** Eventos que representam "algo aconteceu no domínio" são classes imutáveis com nome em **pretérito** (`StudentCreated`, `StudentActivated`, `EnrollmentCancelled`) e vivem em `domain/events/`. Eles carregam apenas os dados necessários para consumidores.

**Distinção:**
- **Domain events** (consumidos dentro do mesmo módulo) — podem conter IDs e VOs do domain.
- **Integration events** (consumidos por outros módulos ou serviços externos) — contêm apenas tipos primitivos ou estruturas simples serializáveis, nunca entities ou VOs.

**Justificativa:** Eventos de domínio são o mecanismo que permite comunicação assíncrona entre módulos (ver [[LAW-008 Lei de Comunicação Entre Módulos]]) e reações a mudanças sem acoplar o publicador aos consumidores.

**Exemplo certo:**
```ts
// domain/events/student-activated/index.ts
export class StudentActivated {
  readonly occurredAt: Date

  constructor(
    public readonly studentId: string,
    occurredAt?: Date,
  ) {
    this.occurredAt = occurredAt ?? new Date()
  }
}
```

### LAW-002.9 — Ports para dependências externas vivem em `domain/ports/`

**Regra:** Quando o domain precisa invocar uma capacidade externa (enviar email, consultar outro módulo, obter hora atual, gerar ID), ele declara uma **interface (port)** em `domain/ports/` e depende dessa interface. A implementação concreta vive em `infrastructure/` (adapters) e é plugada pela composition root.

**Justificativa:** É o padrão Ports & Adapters (Hexagonal Architecture). O domain declara o que precisa em seus próprios termos; adapters traduzem pra tecnologias específicas. Testar o domain fica trivial porque ports são mockáveis.

**Exemplo certo:**
```ts
// domain/ports/clock/index.ts
export interface Clock {
  now(): Date
}

// domain/ports/id-generator/index.ts
export interface IdGenerator {
  generate(): string
}
```

**Distinção entre `repositories/` e `ports/`:**
- `repositories/` é pra persistência de agregados do próprio módulo.
- `ports/` é pra todo resto: serviços externos, outros módulos, utilidades sistêmicas (clock, uuid, crypto).

### LAW-002.10 — Domain não conhece IDs gerados fora dele

**Regra:** Entities não recebem IDs "de fora" (banco, framework). O ID é gerado **dentro do domain** via um port `IdGenerator`, ou é um VO auto-contido (ex: `StudentId.create()`). Auto-increment de banco é **proibido** como fonte primária de identidade.

**Justificativa:** IDs gerados por banco forçam o domain a esperar a persistência pra ter identidade — o que inverte dependência (domain passa a precisar da infra só pra criar uma entity). IDs gerados no domain permitem criar entity e publicar eventos antes mesmo de salvar.

**Exemplo certo:**
```ts
static create(params: { email: StudentEmail }, idGenerator: IdGenerator): Student {
  const id = StudentId.create(idGenerator.generate())
  return new Student(id, params.email, StudentStatus.Active)
}
```

### LAW-002.11 — Domain services são o último recurso

**Regra:** Lógica de negócio pertence a entities e value objects. Um **domain service** (em `domain/services/`) só se justifica quando a operação envolve múltiplos agregados e não pertence naturalmente a nenhum deles.

**Sinais de que você está criando domain service demais:**
- O service manipula uma única entity — a lógica deveria estar na entity.
- O service tem estado — domain services devem ser stateless.
- O service se chama `StudentManager`, `StudentHelper`, `StudentUtils` — são nomes de código anêmico disfarçado.

**Justificativa:** Domain services são legítimos (Evans os descreve), mas viram escape hatch pra quem não quer colocar lógica em entity. Quando o projeto tem `UserService`, `OrderService`, `ProductService` com toda a lógica, o modelo é anêmico — a entity virou DTO.

### LAW-002.12 — Domain expõe sua superfície pelo `index.ts` interno de cada pasta

**Regra:** Cada subpasta do domain (`entities/<x>/`, `value-objects/<x>/`, etc.) segue a convenção de pasta-por-unidade com `index.ts` como ponto de entrada. Consumidores (application layer, outros arquivos do domain) importam do `index.ts`, não de arquivos internos.

**Justificativa:** Reforça a disciplina de [[LAW-007 Lei de Nomenclatura e Organização de Arquivos]] e reduz tokens em leitura automatizada.

## Sumário executivo

| # | Regra | Consequência da violação |
|---|-------|--------------------------|
| 1 | Domain não importa de fora do domain | Acoplamento a framework/ORM, perda de portabilidade |
| 2 | Entities protegem invariantes (construtor privado, sem setters) | Modelo anêmico, estado inválido, lógica espalhada |
| 3 | Value Objects são imutáveis e validam no construtor | Primitive obsession, validação duplicada |
| 4 | Repositories são interfaces, não implementações | Inversão de dependência quebrada |
| 5 | Interfaces de repository não vazam tipos de ORM | Domain amarrado ao Prisma |
| 6 | Repository opera sobre agregados inteiros | Invariantes violáveis por fora da entity |
| 7 | Erros de domínio são classes nomeadas | Impossível distinguir causas, mapeamento HTTP frágil |
| 8 | Domain events em `domain/events/`, nome em pretérito | Comunicação entre módulos vira bagunça |
| 9 | Ports pra dependências externas em `domain/ports/` | Domain acoplado a tecnologia concreta |
| 10 | IDs gerados no domain, não pelo banco | Identidade depende de persistência |
| 11 | Domain services são o último recurso | Anemic model disfarçado de service |
| 12 | `index.ts` como ponto de entrada de cada pasta | Leitura automatizada cara, imports instáveis |

## Referências

- Eric Evans, *Domain-Driven Design: Tackling Complexity in the Heart of Software* (2003), capítulos sobre Entities, Value Objects, Aggregates, Services e Repositories.
- Martin Fowler, *AnemicDomainModel*. https://martinfowler.com/bliki/AnemicDomainModel.html
- Vladimir Khorikov, *Entity vs Value Object: the ultimate list of differences*.
- Robert C. Martin, *Clean Architecture* (2017), Regra da Dependência.
- Alistair Cockburn, *Hexagonal Architecture (Ports and Adapters)*.
- Khalil Stemmler, *Domain-Driven Design with TypeScript* series. https://khalilstemmler.com/articles/domain-driven-design-intro/
- Kamil Grzybek, `modular-monolith-with-ddd`, modelagem de agregados e domain events. https://github.com/kgrzybek/modular-monolith-with-ddd
