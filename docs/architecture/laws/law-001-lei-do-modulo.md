---
id: LAW-001
title: Lei do Módulo
status: canonical
version: 1.0.0
scope: backend-typescript
supersedes: null
tags: [architecture, modular-monolith, ddd, bounded-context, canonical-law]
related:
  - "[[LAW-002 Lei da Camada Domain]]"
  - "[[LAW-003 Lei da Camada Application]]"
  - "[[LAW-004 Lei da Camada Infrastructure]]"
  - "[[LAW-005 Lei da Camada Presentation]]"
  - "[[LAW-006 Lei da Composition Root]]"
  - "[[LAW-007 Lei de Nomenclatura e Organização de Arquivos]]"
  - "[[LAW-008 Lei de Comunicação Entre Módulos]]"
  - "[[LAW-009 Lei de Erros]]"
---
	
# Lei do Módulo

> Lei canônica que define o que é um módulo, como ele se organiza, o que expõe ao mundo externo e como se comunica com outros módulos. Esta lei é a fonte da verdade para qualquer agente ou humano trabalhando em projetos backend TypeScript.

## Definição

Um **módulo** é um *bounded context* no sentido estrito de Domain-Driven Design: um conjunto coeso de regras de negócio em torno de um conceito do domínio, com linguagem ubíqua própria, dono exclusivo dos seus dados, e que poderia — em tese — ser extraído como microsserviço sem reescrita do núcleo.

Um módulo é um mini-aplicativo autocontido. Tratá-lo como pasta de organização é o primeiro passo pro big ball of mud.

### Critério de existência

Um conceito merece módulo próprio quando **tem regras de negócio próprias e ciclo de vida próprio**. Quando é apenas atributo ou detalhe de outro conceito, não é módulo — é parte do módulo dono.

- `Student`, `Enrollment`, `Billing` → módulos (cada um tem regras, estados, eventos).
- `StudentAddress`, `EnrollmentStatus` → **não** são módulos (são detalhes de `Student` e `Enrollment`).

## Regras

### LAW-001.1 — Um módulo vive em `src/modules/<nome>/`

**Regra:** Todo módulo fica em `src/modules/<nome-em-kebab-case>/`. Nunca fora.

**Justificativa:** A localização física comunica a arquitetura. Código de negócio espalhado fora de `modules/` indica camada mal endereçada (é infra compartilhada, é utility, é código órfão).

### LAW-001.2 — Um módulo tem estrutura interna canônica

**Regra:** A estrutura interna obrigatória é:

```
src/modules/<nome>/
├── domain/          # núcleo; zero dependência externa
├── application/     # use cases; depende só de domain
├── infrastructure/  # adapters de recursos externos
├── presentation/    # entry points HTTP (controllers, routes, middleware, serializers, schemas)
├── composition/     # composition root; wiring de DI
└── index.ts         # API pública do módulo
```

**Justificativa:** A ordem de dependência é `presentation → application → domain ← infrastructure`. Composition conhece todas (ela é a única que pode). Cada camada tem lei própria: [[LAW-002 Lei da Camada Domain]], [[LAW-003 Lei da Camada Application]], [[LAW-004 Lei da Camada Infrastructure]], [[LAW-005 Lei da Camada Presentation]], [[LAW-006 Lei da Composition Root]].

**Proibido:** criar pastas fora dessa lista no root do módulo (ex: `helpers/`, `utils/`, `services/`, `types/`). Se aparecer necessidade, é sinal de que o código pertence a uma das camadas existentes e você está evitando decidir onde.

### LAW-001.3 — O `index.ts` é a única API pública do módulo

**Regra:** O arquivo `src/modules/<nome>/index.ts` é a **única** superfície pública do módulo. Ele pode exportar exclusivamente:

1. A função de registro de rotas (ex: `registerStudentsRoutes(app)`).
2. A factory do container do módulo (pra testes de integração e pro bootstrap).
3. Interfaces de **ports públicos** (facades consumidas por outros módulos).
4. Tipos de **integration events** que o módulo publica ou consome.

**Proibido exportar:** entities, repositories (interface ou implementação), use cases, controllers, serializers, schemas de validação, erros de domínio, ou qualquer tipo interno que não esteja nas 4 categorias acima.

**Justificativa:** Um módulo é uma caixa preta. Se outros módulos conhecem seus internals, ele deixou de ser módulo e virou namespace. A fronteira só existe se for enforced.

**Exemplo errado:**
```ts
// src/modules/students/index.ts
export * from './domain/entities/student'
export * from './application/use-cases/create-student'
export { PrismaStudentsRepository } from './infrastructure/repositories/prisma-students-repository'
```

**Exemplo certo:**
```ts
// src/modules/students/index.ts
export { registerStudentsRoutes } from './presentation/routes'
export { createStudentsContainer } from './composition/container'
export type { StudentsPort } from './domain/ports/students-port'
export type { StudentActivated, StudentDeactivated } from './domain/events'
```

### LAW-001.4 — Módulos não importam internals de outros módulos

**Regra:** Qualquer import de outro módulo DEVE apontar para o `index.ts` desse módulo (ou seja, `@/modules/<outro>`). Imports em profundidade (`@/modules/<outro>/domain/...`, `@/modules/<outro>/application/...`) são **violação arquitetural**.

**Justificativa:** Se um módulo pode alcançar as entrails de outro, o encapsulamento não existe. Esse é o bad pattern mais comum em monolitos modulares mal disciplinados e a principal causa de reversão pra big ball of mud.

**Exemplo errado:**
```ts
// em enrollments/application/use-cases/enroll-student/index.ts
import { Student } from '@/modules/students/domain/entities/student'
import { PrismaStudentsRepository } from '@/modules/students/infrastructure/repositories/prisma-students-repository'
```

**Exemplo certo:**
```ts
// em enrollments/application/use-cases/enroll-student/index.ts
import type { StudentsPort } from '@/modules/students'

class EnrollStudentUseCase {
  constructor(private readonly studentsPort: StudentsPort) {}
}
```

### LAW-001.5 — Comunicação síncrona entre módulos acontece via facade injetada

**Regra:** Quando o módulo A precisa **consultar** dados do módulo B de forma síncrona, A depende de uma **interface** (`<B>Port`) declarada no próprio módulo A ou exportada pelo `index.ts` de B. A implementação concreta é injetada pela composition root no bootstrap.

**Proibido:** o módulo A chamar diretamente um use case, repository ou controller do módulo B.

**Justificativa:** A facade é um contrato. Ela permite que A seja desenvolvido e testado sem conhecer como B funciona internamente. Mudanças internas em B não quebram A enquanto a facade for respeitada. Aprofundado em [[LAW-008 Lei de Comunicação Entre Módulos]].

**Exemplo certo:**
```ts
// modules/enrollments/domain/ports/students-port.ts
export interface StudentsPort {
  exists(id: string): Promise<boolean>
  getBasicInfo(id: string): Promise<{ id: string; name: string; active: boolean } | null>
}

// modules/students/index.ts expõe a interface
export type { StudentsPort } from './presentation/ports/students-port-adapter'

// a implementação concreta mora em students e é registrada na composition root do app
```

### LAW-001.6 — Comunicação assíncrona entre módulos acontece via eventos de integração

**Regra:** Quando o módulo A precisa **reagir** a mudanças de estado do módulo B, B publica um **integration event** e A se inscreve. Integration events são objetos imutáveis, com nome em pretérito (`StudentActivated`, `EnrollmentCreated`), e contêm apenas os dados necessários para o consumidor.

**Justificativa:** Evita acoplamento temporal e permite múltiplos consumidores sem que o publicador saiba da existência deles. Prepara o módulo pra eventual extração em microsserviço sem reescrita. Aprofundado em [[LAW-008 Lei de Comunicação Entre Módulos]].

**Nota de evolução:** o barramento pode começar como um `EventEmitter` in-process. Quando o sistema demandar, migra-se pra um bus real (Redis Streams, Kafka) com outbox pattern, sem mudanças nos módulos.

**Exemplo certo:**
```ts
// modules/students/domain/events/student-activated.ts
export class StudentActivated {
  constructor(
    public readonly studentId: string,
    public readonly activatedAt: Date,
  ) {}
}

// modules/students/application/use-cases/activate-student/index.ts publica
await this.eventBus.publish(new StudentActivated(student.id, new Date()))

// modules/enrollments/application/event-handlers/on-student-activated/index.ts consome
eventBus.on(StudentActivated, async (event) => {
  await this.reactivateEnrollmentsUseCase.execute(event.studentId)
})
```

### LAW-001.7 — Cada módulo é dono exclusivo dos seus dados

**Regra:** Cada módulo é dono exclusivo das tabelas que representam seu domínio. Nenhum outro módulo lê ou escreve nessas tabelas diretamente — o acesso só acontece via a API pública do módulo dono (facade ou evento).

**Justificativa:** Ownership de dados é o que separa "modular" de "monolito com pastas". Sem isso, qualquer módulo pode corromper invariantes de outro com um `UPDATE` direto, e a fronteira arquitetural vira ficção.

**Aplicação com Prisma:** um único `schema.prisma` master com modelos particionados por módulo em `prisma/models/<nome-do-modulo>.prisma`. Cada arquivo é de propriedade exclusiva do módulo correspondente.

```
prisma/
├── schema.prisma          # apenas generator + datasource
├── migrations/
└── models/
    ├── students.prisma    # propriedade do módulo students
    ├── enrollments.prisma # propriedade do módulo enrollments
    └── billing.prisma     # propriedade do módulo billing
```

**Proibido:** um use case de `enrollments` chamar `prisma.student.findUnique()`. Deve chamar `StudentsPort.getBasicInfo()`.

### LAW-001.8 — Escritas transacionais não cruzam fronteiras de módulo

**Regra:** Uma única transação de banco não abrange tabelas de mais de um módulo. Operações que parecem exigir isso são sinal de uma das três coisas: (a) a fronteira entre os módulos está errada e eles deveriam ser um só; (b) o fluxo deve ser quebrado em passos com consistência eventual via eventos; (c) é necessário um saga pra coordenar compensação.

**Justificativa:** Permitir transação cross-module anula o ownership de dados e transforma a refatoração pra microsserviços em impossível. Além disso, esconde fronteiras mal desenhadas.

### LAW-001.9 — Convenção de nomenclatura de arquivos e pastas

**Regra:**
- Toda nomenclatura de pasta e arquivo é **kebab-case**.
- Cada unidade (use case, entity, repository, controller, event handler) é uma **pasta** com `index.ts` como ponto de entrada. Arquivos auxiliares (`types.ts`, `errors.ts`, `schema.ts`) moram ao lado quando necessário.
- Arquivos soltos (`create-student.ts` direto numa pasta) são **proibidos**.

**Justificativa:** Agentes e humanos leem `index.ts` pra entender o contrato sem carregar detalhes; descem pros arquivos auxiliares só quando precisam. Reduz tokens em leitura automatizada e disciplina a organização. Aprofundado em [[LAW-007 Lei de Nomenclatura e Organização de Arquivos]].

**Exemplo errado:**
```
application/use-cases/
├── create-student.ts
├── create-student.types.ts
└── update-student.ts
```

**Exemplo certo:**
```
application/use-cases/
├── create-student/
│   ├── index.ts
│   ├── types.ts
│   └── errors.ts
└── update-student/
    └── index.ts
```

### LAW-001.10 — Um módulo tem um único composition root

**Regra:** Cada módulo tem uma pasta `composition/` com um `container.ts` que é o **único lugar** onde dependências concretas são instanciadas e plugadas nas interfaces. Use cases, controllers e repositories nunca fazem `new OutroRepositório()` por conta própria.

**Justificativa:** Composition root é a única camada que tem permissão pra conhecer todas as outras. Espalhar `new` pelo código quebra a regra de dependência e torna testes impossíveis sem mocks invasivos. Aprofundado em [[LAW-006 Lei da Composition Root]].

### LAW-001.11 — O bootstrap do app apenas compõe módulos

**Regra:** O bootstrap da aplicação (`src/main.ts` ou equivalente) não contém lógica de negócio. Sua responsabilidade é:

1. Instanciar recursos compartilhados (DB client, logger, event bus).
2. Chamar a factory do container de cada módulo passando esses recursos.
3. Registrar as rotas de cada módulo via `register<Modulo>Routes(app, container)`.
4. Subir o servidor HTTP.

**Justificativa:** O app é uma *composition root de composition roots*. Ele não sabe do que os módulos fazem — só os pluga.

## Sumário executivo

| # | Regra | Consequência da violação |
|---|-------|--------------------------|
| 1 | Módulos vivem em `src/modules/<nome>/` | Código de negócio órfão |
| 2 | Estrutura interna canônica (5 camadas + index) | Organização inconsistente |
| 3 | `index.ts` é a única API pública | Vazamento de internals |
| 4 | Sem imports profundos entre módulos | Acoplamento oculto |
| 5 | Comunicação síncrona via facade injetada | Acoplamento forte entre módulos |
| 6 | Comunicação assíncrona via integration events | Impossibilidade de extrair módulo |
| 7 | Cada módulo é dono exclusivo das suas tabelas | Fronteira arquitetural fictícia |
| 8 | Sem transação cross-module | Fronteiras mal desenhadas escondidas |
| 9 | kebab-case + pasta-por-unidade + `index.ts` | Organização imprevisível |
| 10 | Um composition root por módulo | Testes impossíveis, acoplamento difuso |
| 11 | Bootstrap só compõe, não decide | Lógica espalhada entre app e módulos |

## Referências

- Robert C. Martin, *Clean Architecture: A Craftsman's Guide to Software Structure and Design* (2017).
- Eric Evans, *Domain-Driven Design: Tackling Complexity in the Heart of Software* (2003).
- Kamil Grzybek, *Modular Monolith: A Primer* e *Modular Monolith: Integration Styles*. https://www.kamilgrzybek.com
- Kamil Grzybek, `modular-monolith-with-ddd`. https://github.com/kgrzybek/modular-monolith-with-ddd
- Mateusz Gajewski (mgce), `modular-monolith-nodejs`. https://github.com/mgce/modular-monolith-nodejs
- Mark Seemann, *Dependency Injection Principles, Practices, and Patterns* (2019).
- Shopify Engineering, Packwerk e modularização do monolito Rails.
- Prisma Docs, *Prisma Schema Location and Configuration* (multi-file schema). https://www.prisma.io/docs/orm/prisma-schema/overview/location
