---
id: LAW-004
title: Lei da Camada Infrastructure
status: canonical
version: 1.0.0
scope: backend-typescript
supersedes:
tags:
  - architecture
  - clean-architecture
  - infrastructure
  - repositories
  - adapters
  - canonical-law
related:
  - "[[LAW-001 Lei do Módulo]]"
  - "[[LAW-002 Lei da Camada Domain]]"
  - "[[LAW-003 Lei da Camada Application]]"
  - "[[LAW-005 Lei da Camada Presentation]]"
  - "[[LAW-006 Lei da Composition Root]]"
  - "[[LAW-007 Lei de Nomenclatura e Organização de Arquivos]]"
  - "[[LAW-008 Lei de Comunicação Entre Módulos]]"
  - "[[LAW-009 Lei de Erros]]"
  - "[[LAW-010 Lei do Lib]]"
---
# Lei da Camada Infrastructure

> Lei canônica que define o que é e o que não é a camada infrastructure, como se organiza, o que pode conter, como implementa contratos do domain, e qual é sua relação com `shared/`. A infrastructure é onde tecnologia concreta encontra o domínio — e onde tecnologia deve permanecer contida.

## Definição

A **camada infrastructure** contém **implementações concretas** de contratos declarados no `domain/`. Ela é o lugar onde o módulo fala com o mundo exterior: banco de dados, filas, caches, APIs externas, relógio do sistema, outros módulos. Toda tecnologia específica (Prisma, axios, EventEmitter) vive aqui.

A infrastructure é a **única camada do módulo que pode importar tecnologias externas**. Ela é também a camada onde **tipos da tecnologia são traduzidos** para o vocabulário do domain, garantindo que as camadas internas permaneçam puras.

A infrastructure **depende do domain, nunca o contrário**. Ela implementa interfaces; não define contratos de negócio.

## Estrutura canônica

```
src/modules/<nome>/infrastructure/
├── repositories/          # implementações de domain/repositories/
│   └── prisma-<entidade>-repository/
│       └── index.ts
├── adapters/              # implementações de domain/ports/ (serviços externos)
│   └── <tecnologia>-<port>-adapter/
│       └── index.ts
├── module-adapters/       # implementações de ports que apontam pra outros módulos
│   └── <outro-modulo>-port-adapter/
│       └── index.ts
├── mappers/               # tradução entity <-> modelo persistido
│   └── <entidade>-mapper/
│       └── index.ts
└── clients/               # clientes específicos do módulo (opcional)
    └── <tecnologia>-client/
        └── index.ts
```

**Nota:** `clients/` é opcional e só se justifica quando o módulo precisa de um cliente técnico não compartilhável (wrappers técnicos compartilhados entre módulos vivem em `shared/` — ver [[LAW-010 Lei do Lib]]).

## Regras

### LAW-004.1 — Infrastructure depende do domain, nunca o contrário

**Regra:** Arquivos em `infrastructure/` podem importar livremente de `domain/` do próprio módulo. Nenhum arquivo em `domain/` pode importar de `infrastructure/`. Essa assimetria é inviolável.

**Justificativa:** Aplicação direta do Dependency Inversion Principle. Domain declara o contrato; infrastructure se adapta. Se domain precisasse conhecer infra, toda mudança de tecnologia exigiria reescrever o núcleo — a Regra da Dependência (Uncle Bob) seria quebrada.

**Aplicação prática:** a checagem é programática. Qualquer `import` em `domain/**/*.ts` apontando para `../infrastructure/` ou `@/modules/<mesmo-modulo>/infrastructure/` é violação.

### LAW-004.2 — Implementações de repository vivem em `infrastructure/repositories/`

**Regra:** Cada interface declarada em `domain/repositories/<nome>-repository/` tem sua implementação concreta em `infrastructure/repositories/<tecnologia>-<nome>-repository/`. O prefixo de tecnologia (`prisma-`, `mongo-`, `in-memory-`) é obrigatório.

**Justificativa:** O prefixo explicita que aquele arquivo é acoplado a uma tecnologia específica. Permite que múltiplas implementações coexistam (ex: `prisma-students-repository/` em produção, `in-memory-students-repository/` em testes) sem conflito de nome, e facilita identificar rapidamente qual tecnologia está em uso.

**Exemplo certo:**
```ts
// infrastructure/repositories/prisma-students-repository/index.ts
import type { StudentsRepository } from '@/modules/students/domain/repositories/students-repository'
import type { Student } from '@/modules/students/domain/entities/student'
import type { StudentId } from '@/modules/students/domain/entities/student/types'
import { StudentMapper } from '@/modules/students/infrastructure/mappers/student-mapper'
import type { PrismaClient } from '@prisma/client'

export class PrismaStudentsRepository implements StudentsRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly mapper: StudentMapper,
  ) {}

  async findById(id: StudentId): Promise<Student | null> {
    const row = await this.prisma.student.findUnique({ where: { id: id.value } })
    return row ? this.mapper.toDomain(row) : null
  }

  async save(student: Student): Promise<void> {
    const data = this.mapper.toPersistence(student)
    await this.prisma.student.upsert({
      where: { id: data.id },
      create: data,
      update: data,
    })
  }
}
```

### LAW-004.3 — Repository opera sobre agregados inteiros (implementa fielmente a interface do domain)

**Regra:** A implementação concreta **implementa literalmente** a interface declarada no domain, sem adicionar métodos públicos extras, sem mudar assinaturas, sem expandir contratos. Métodos retornam **entities/VOs do domain**, não modelos de banco.

**Justificativa:** Se a implementação expande o contrato, a interface deixa de ser fonte da verdade. Use cases começam a depender de métodos que só existem na implementação Prisma, e trocar de ORM fica impossível — exatamente o problema que [[LAW-002 Lei da Camada Domain]] regra 4 existe pra prevenir.

**Proibido:**
- Métodos públicos não declarados na interface.
- Retornar `PrismaStudent` em vez de `Student`.
- Aceitar `Prisma.StudentWhereInput` em parâmetros.

### LAW-004.4 — Mapper é o único lugar que conhece o formato persistido

**Regra:** A tradução `Student (domain entity) ⇄ PrismaStudent (modelo de banco)` acontece **exclusivamente** em `infrastructure/mappers/<entidade>-mapper/`. O repository usa o mapper; nenhum outro arquivo da infra faz esse mapeamento.

**Contrato mínimo do mapper:**
```ts
interface <n>Mapper {
  toDomain(row: <Persisted>): <Entity>
  toPersistence(entity: <Entity>): <Persisted>
}
```

**Justificativa:** Centraliza a lógica de tradução num único ponto testável. Se a entity ganha um VO novo ou o banco ganha uma coluna nova, só o mapper muda — o repository fica intacto. Evita duplicação: sem mapper dedicado, cada método do repository reimplementa a mesma tradução.

**Exemplo certo:**
```ts
// infrastructure/mappers/student-mapper/index.ts
import { Student } from '@/modules/students/domain/entities/student'
import { StudentEmail } from '@/modules/students/domain/value-objects/student-email'
import { StudentId } from '@/modules/students/domain/entities/student/types'
import type { Student as PrismaStudent } from '@prisma/client'

export class StudentMapper {
  toDomain(row: PrismaStudent): Student {
    return Student.reconstitute({
      id: StudentId.create(row.id),
      email: StudentEmail.create(row.email),
      status: row.status,
      createdAt: row.createdAt,
    })
  }

  toPersistence(student: Student): PrismaStudent {
    return {
      id: student.id.value,
      email: student.email.value,
      status: student.status,
      createdAt: student.createdAt,
    }
  }
}
```

**Nota:** `reconstitute` é uma factory estática do domain dedicada a reidratar uma entity já existente (diferente de `create`, que valida e cria do zero). Ela é legítima em DDD porque reidratar ≠ criar.

### LAW-004.5 — Tipos de ORM ficam contidos à infrastructure

**Regra:** Tipos importados de `@prisma/client` (ou qualquer ORM), `Prisma.*WhereInput`, `Prisma.*UncheckedCreateInput`, etc., podem aparecer **exclusivamente** dentro de `infrastructure/`. Nenhum outro arquivo do módulo (domain, application, presentation, composition) pode referenciar esses tipos.

**Justificativa:** Reforça [[LAW-002 Lei da Camada Domain]] regra 5 do lado da implementação. Se tipos Prisma escapam da infra, o acoplamento se alastra e o módulo deixa de ser portável. Esta é a regra mais auditável da camada: `grep -r "from '@prisma/client'"` fora de `infrastructure/` = violação.

### LAW-004.6 — Repository traduz erros de tecnologia em erros de domínio quando fazem sentido

**Regra:** Quando o ORM lança um erro que **tem significado de domínio**, o repository o captura e traduz para o erro de domínio correspondente. Exemplo: `PrismaClientKnownRequestError` com code `P2002` (unique constraint violation) em campo `email` é traduzido para `StudentEmailAlreadyExistsError`.

Erros genuinamente infraestruturais (conexão perdida, timeout, disco cheio) viram `InfrastructureError` (definido em `shared/errors/`) e sobem inalterados.

**Justificativa:** O repository é o único lugar que conhece o vocabulário do ORM (códigos de erro específicos). Fazer a tradução ali evita que use cases precisem parsear `err.code === 'P2002'` — o que acoplaria application ao ORM. Erros de infra legítimos sobem porque não representam violação de invariante; representam falha do ambiente.

**Exemplo certo:**
```ts
async save(student: Student): Promise<void> {
  try {
    const data = this.mapper.toPersistence(student)
    await this.prisma.student.create({ data })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new StudentEmailAlreadyExistsError(student.email.value)
    }
    throw new InfrastructureError('Failed to save student', { cause: err })
  }
}
```

Hierarquia completa é tratada em [[LAW-009 Lei de Erros]].

### LAW-004.7 — Adapters implementam ports do domain, não definem contratos

**Regra:** Cada classe em `infrastructure/adapters/` implementa **exclusivamente** uma interface declarada em `domain/ports/`. O nome da pasta segue o padrão `<tecnologia>-<port>-adapter` (ex: `sendgrid-welcome-email-sender-adapter`, `system-clock-adapter`, `uuid-id-generator-adapter`).

**Proibido:**
- Adapter sem port correspondente no domain.
- Adapter que adiciona métodos públicos não declarados no port.
- Adapter que implementa múltiplos ports não relacionados.

**Justificativa:** É Ports & Adapters canônico (Cockburn). O adapter traduz tecnologia em vocabulário do domain — tanto de entrada (quando domain invoca adapter) quanto de saída (quando adapter devolve dados).

**Exemplo certo:**
```ts
// infrastructure/adapters/system-clock-adapter/index.ts
import type { Clock } from '@/modules/students/domain/ports/clock'

export class SystemClockAdapter implements Clock {
  now(): Date {
    return new Date()
  }
}
```

### LAW-004.8 — Module-adapters são a única ponte autorizada para outros módulos

**Regra:** Adapters que implementam ports apontando para outros módulos vivem em `infrastructure/module-adapters/<outro-modulo>-port-adapter/`. Esta é a **única pasta do módulo** autorizada a importar de `@/modules/<outro-modulo>`.

Qualquer import de outro módulo fora de `module-adapters/` é violação auditável.

**Justificativa:** Torna o grafo de dependências entre módulos fisicamente visível. Listar `ls infrastructure/module-adapters/` em qualquer módulo revela imediatamente com quais outros módulos ele fala. Também permite que a skill de auditoria detecte violações com regra simples: imports de `@/modules/<outro>` só são legítimos dentro dessa pasta.

**Distinção em relação a adapters de serviço externo:**
- `adapters/` → implementa port falando com tecnologia genuinamente externa (SendGrid, Stripe, clock, filesystem).
- `module-adapters/` → implementa port falando com outro módulo do mesmo monolito.

A distinção importa porque outros módulos têm garantias que serviços externos não têm (type-safety, co-deploy, sem latência de rede). Tratamento de erro, retry, circuit breaker são legítimos em `adapters/` e costumam ser overkill em `module-adapters/`. Misturá-los na mesma pasta convida a patterns errados.

**Exemplo certo:**
```ts
// enrollments/infrastructure/module-adapters/students-port-adapter/index.ts
import type { StudentsPort } from '@/modules/enrollments/domain/ports/students-port'
import { studentsModule } from '@/modules/students'

export class StudentsModuleAdapter implements StudentsPort {
  async exists(id: string): Promise<boolean> {
    return studentsModule.existsStudent(id)
  }
}
```

### LAW-004.9 — Infrastructure consome `shared/` apenas para wrappers técnicos sem semântica de negócio

**Regra:** A infrastructure do módulo pode importar de `@/shared/` **apenas** wrappers técnicos agnósticos de negócio: `PrismaClient` singleton, logger configurado, `EventBus` in-process, cliente HTTP base.

**Proibido:**
- Importar de `shared/` algo que implemente um port de domain de qualquer módulo.
- Criar em `shared/` uma implementação genérica de um conceito de negócio (ex: `SharedEmailSender`, `GenericNotificationService`).

**Justificativa:** `shared/` é reservado a infraestrutura puramente técnica. Quando um módulo precisa de um serviço externo com semântica de negócio, ele declara seu próprio port no próprio domain e a implementação vive na própria `infrastructure/adapters/`. Isso evita `shared/` virar lixeira de "reuso acidental" e preserva o princípio de que bounded contexts têm vocabulário próprio.

Aprofundado em [[LAW-010 Lei do Lib]].

**Exemplo certo:**
```ts
// infrastructure/adapters/sendgrid-welcome-email-sender-adapter/index.ts
import type { WelcomeEmailSender } from '@/modules/students/domain/ports/welcome-email-sender'
import type { SendGridClient } from '@/shared/http/sendgrid-client'

export class SendGridWelcomeEmailSenderAdapter implements WelcomeEmailSender {
  constructor(private readonly client: SendGridClient) {}

  async send(params: { to: string; studentName: string }): Promise<void> {
    await this.client.send({
      to: params.to,
      template: 'welcome-student',
      data: { name: params.studentName },
    })
  }
}
```

Note: `SendGridClient` em `shared/` é um wrapper técnico sem conhecimento de negócio. O adapter no módulo carrega a semântica ("enviar email de boas-vindas pra aluno").

### LAW-004.10 — Infrastructure não contém regra de negócio

**Regra:** Nenhum arquivo em `infrastructure/` executa validação de invariante, decisão de negócio ou cálculo de regra. A infra **traduz, persiste e comunica**; não decide.

**Sinais de violação:**
- Repository com `if (student.age < 18) throw ...` — regra de negócio no lugar errado.
- Mapper que calcula preço final aplicando desconto — cálculo de negócio.
- Adapter que decide se envia email baseado em condição de negócio — lógica que pertence ao domain ou application.

**Justificativa:** Regra de negócio em infra é invisível para testes de domain, impossível de descobrir sem abrir arquivos de tecnologia e se duplica quando troca-se de implementação. É o vazamento mais caro porque inverte a pirâmide: regras estáveis ficam reféns de tecnologias voláteis.

### LAW-004.11 — Transações são coordenadas pela application via Unit of Work (port)

**Regra:** A infrastructure **não abre transações por conta própria**. Um use case que precisa de atomicidade entre operações injeta um port `UnitOfWork` (declarado em `domain/ports/unit-of-work/`) cuja implementação Prisma vive em `infrastructure/adapters/prisma-unit-of-work-adapter/`.

O repository individual executa operações dentro da transação ativa (se houver) ou na conexão padrão.

**Justificativa:** Transação é decisão de orquestração (application), não de persistência (infra) — ver [[LAW-003 Lei da Camada Application]] regra 8. Abrir transação no repository fragmenta (cada save abre a sua) ou acopla o repository a conhecimento de múltiplas operações (violando SRP). O padrão Unit of Work é canônico (Fowler, *Patterns of Enterprise Application Architecture*).

**Nota de flexibilização:** projetos em estágio inicial podem usar um decorator transacional aplicado pela composition root em vez de injetar `UnitOfWork` explicitamente. O que não pode é o use case chamar `prisma.$transaction` direto — isso acopla application ao ORM.

### LAW-004.12 — Messaging (publisher/subscriber do event bus) vive em `infrastructure/` quando tecnologia-específico

**Regra:** Quando o módulo implementa um publisher ou subscriber acoplado a tecnologia específica de fila (Redis Streams, Kafka, SQS), essa implementação vive em `infrastructure/messaging/`. A interface do event bus é declarada como port no domain de cada módulo que publica ou escuta.

**Nota de transição:** enquanto o sistema usa `EventEmitter` in-process via `shared/messaging/`, não há necessidade de `infrastructure/messaging/` local. A pasta passa a existir quando o módulo precisa de comportamento de messaging tecnologia-específico (ex: outbox pattern acoplado a Postgres).

Aprofundado em [[LAW-008 Lei de Comunicação Entre Módulos]].

### LAW-004.13 — Cada implementação é uma pasta com `index.ts`

**Regra:** Segue [[LAW-007 Lei de Nomenclatura e Organização de Arquivos]]:

```
infrastructure/repositories/prisma-students-repository/
├── index.ts       # export class PrismaStudentsRepository
└── queries.ts     # (opcional) SQL raw ou builders complexos
```

Arquivos soltos (`prisma-students-repository.ts`) são **proibidos**.

**Justificativa:** Uniformidade com o resto do módulo; permite adicionar arquivos auxiliares (queries complexas, constantes técnicas) sem reestruturar.

## Sumário executivo

| # | Regra | Consequência da violação |
|---|-------|--------------------------|
| 1 | Infrastructure depende do domain, nunca o contrário | Dependency Inversion quebrada |
| 2 | Implementações em `repositories/` com prefixo de tecnologia | Conflito de nomes, tecnologia oculta |
| 3 | Repository implementa fielmente a interface do domain | Contrato inchado, troca de ORM impossível |
| 4 | Mapper é o único lugar que conhece formato persistido | Tradução duplicada, acoplamento espalhado |
| 5 | Tipos de ORM ficam contidos à infrastructure | Domain/application amarrados ao ORM |
| 6 | Repository traduz erro de tecnologia em erro de domínio quando aplicável | Application parseia códigos de ORM |
| 7 | Adapter implementa port do domain, nunca define contrato | Port espectrais, contrato dispersado |
| 8 | `module-adapters/` é a única ponte pra outros módulos | Grafo de dependência oculto |
| 9 | `shared/` só para wrappers técnicos sem semântica | `shared/` vira lixeira, bounded contexts vazam |
| 10 | Infrastructure não contém regra de negócio | Domain anêmico, regras escondidas em infra |
| 11 | Transação é orquestrada pela application via Unit of Work | Transação fragmentada ou acoplamento a ORM |
| 12 | Messaging tecnologia-específico em `infrastructure/messaging/` | Tecnologia de fila vazando pra shared/domain |
| 13 | Cada implementação é pasta com `index.ts` | Organização imprevisível |

## Referências

- Robert C. Martin, *Clean Architecture* (2017), capítulos sobre Interface Adapters e Frameworks & Drivers.
- Alistair Cockburn, *Hexagonal Architecture (Ports and Adapters)*.
- Martin Fowler, *Patterns of Enterprise Application Architecture* (2002), Unit of Work, Data Mapper, Repository.
- Eric Evans, *Domain-Driven Design* (2003), capítulo sobre Repositories.
- Khalil Stemmler, *Implementing DTOs, Mappers & the Repository Pattern*. https://khalilstemmler.com/articles/typescript-domain-driven-design/repository-dto-mapper/
- Arnaud Renaud, *Clean Architecture in Practice with TypeScript, Prisma, Next.js*. https://www.arnaudrenaud.com/articles/clean-architecture-typescript-prisma-next/
- Kamil Grzybek, `modular-monolith-with-ddd`, estrutura de Infrastructure Layer. https://github.com/kgrzybek/modular-monolith-with-ddd
- Prisma Docs, *Error Reference*. https://www.prisma.io/docs/orm/reference/error-reference

