---
id: LAW-006
title: Lei da Composition Root
status: canonical
version: 1.0.0
scope: backend-typescript
supersedes: null
tags: [architecture, clean-architecture, composition-root, dependency-injection, canonical-law]
related:
  - "[[LAW-001 Lei do Módulo]]"
  - "[[LAW-002 Lei da Camada Domain]]"
  - "[[LAW-003 Lei da Camada Application]]"
  - "[[LAW-004 Lei da Camada Infrastructure]]"
  - "[[LAW-005 Lei da Camada Presentation]]"
  - "[[LAW-007 Lei de Nomenclatura e Organização de Arquivos]]"
  - "[[LAW-008 Lei de Comunicação Entre Módulos]]"
---
	
# Lei da Composition Root

> Lei canônica que define o que é e o que não é a composition root, como o wiring manual de dependências acontece, onde infraestrutura encontra o domain, e qual é a única API pública que o módulo expõe para o mundo. A composition root é o único lugar do módulo onde todas as camadas se cruzam. Esta lei é referência para qualquer agente ou humano escrevendo código de bootstrap ou registro de módulo.

## Definição

A **composition root** é o único lugar do módulo onde objetos concretos são instanciados e plugados uns aos outros. É onde o `PrismaClient` recebido do bootstrap global vira `PrismaStudentsRepository`, que vira dependência do `CreateStudentUseCase`, que vira dependência do `CreateStudentController`.

Fora da composition root, nada no módulo instancia classes concretas. Use cases, controllers e adapters recebem suas dependências pelo construtor e não sabem de onde elas vieram. Essa é a pedra de toque: **todo `new` do módulo acontece aqui, e em nenhum outro lugar**.

A composition root é também quem expõe a **API pública do módulo** — a função de registro que o bootstrap global chama, a facade síncrona que outros módulos consomem, e os integration events que outros módulos assinam. O mundo exterior conhece o módulo exclusivamente através do seu `index.ts`.

Decisão fixada no projeto: **composição manual**, sem containers como tsyringe, awilix ou inversify. DI é feito por código TypeScript comum, usando construtores e funções.

## Estrutura canônica

```
src/modules/<nome>/
├── composition/
│   ├── container.ts       # instancia adapters, repositories, use cases, controllers
│   ├── register.ts        # função de registro (rotas + handlers de eventos)
│   └── facade.ts          # implementação da facade pública do módulo
└── index.ts               # ÚNICA API pública: registro + tipo da facade + integration events
```

## Regras

### LAW-006.1 — Composição é manual; containers de DI são proibidos

**Regra:** Wiring de dependências é feito com código TypeScript comum — `new`, construtores, funções. Bibliotecas de container (tsyringe, awilix, inversify, typedi, NestJS DI) são **proibidas** no projeto.

**Justificativa:** Mark Seemann (*Dependency Injection Principles, Practices, and Patterns*) defende Pure DI como padrão preferencial sobre containers. Composição manual é rastreável (você lê o código e vê exatamente como tudo se conecta), não depende de decorators mágicos, não exige reflection e tem tipagem exata. Containers resolvem problemas que aparecem em projetos gigantes; em módulos bem fatorados como estes, o custo supera o ganho.

### LAW-006.2 — Cada módulo tem sua própria composition root

**Regra:** Cada módulo em `src/modules/<nome>/` tem sua pasta `composition/` com container próprio. Composition roots **não** se importam entre si. O bootstrap global instancia cada módulo independentemente e passa adiante só as dependências compartilhadas (ver LAW-006.4) e as facades de outros módulos.

**Justificativa:** Isolamento de módulo (LAW-001) exige que o wiring interno de A seja opaco para B. Se o container de A importa classes concretas de B, a fronteira do módulo se dissolve e o monólito deixa de ser modular.

### LAW-006.3 — Composition é o único local do módulo que importa de `infrastructure/`

**Regra:** Refina LAW-004.2. Arquivos em `composition/container.ts` são os únicos que podem `import` de `@/modules/<x>/infrastructure/*`. Arquivos em `composition/register.ts` e `composition/facade.ts` importam apenas do próprio `container.ts` ou de interfaces do domain/application.

**Justificativa:** O container é o ponto de encontro entre infra e domain; é onde `PrismaStudentsRepository` é instanciado e passado, tipado como `StudentsRepository` (interface), para quem precisa. Limitar o import de classes concretas ao container garante que o resto do módulo continua trabalhando só com interfaces.

### LAW-006.4 — Dependências compartilhadas chegam via parâmetro, nunca via import global

**Regra:** Dependências de infraestrutura compartilhadas entre módulos — `PrismaClient`, event bus global, logger, configuração — são **recebidas como parâmetro** pela função de registro do módulo. O módulo **não** importa essas dependências de `@/shared/*` ou de um singleton global.

**Justificativa:** Se o módulo importa `PrismaClient` de um singleton, ele virou dependente do bootstrap global — e deixa de ser testável ou reutilizável isoladamente. Passagem por parâmetro preserva a possibilidade de subir o módulo em testes com um cliente Prisma apontado pra banco de testes, ou até com uma implementação in-memory.

**Exemplo certo:**
```ts
// src/modules/students/composition/register.ts
import type { FastifyInstance } from 'fastify'
import type { PrismaClient } from '@prisma/client'
import type { EventBus } from '@/shared/event-bus' // interface, não implementação
import { createStudentsContainer } from './container'
import { registerStudentsRoutes } from '@/modules/students/presentation/routes/students-routes'
import { studentsErrorHandler } from '@/modules/students/presentation/error-handler'

export type StudentsModuleDeps = {
  prisma: PrismaClient
  eventBus: EventBus
}

export function registerStudentsModule(app: FastifyInstance, deps: StudentsModuleDeps): void {
  const container = createStudentsContainer(deps)
  registerStudentsRoutes(app, container.controllers)
  app.setErrorHandler(studentsErrorHandler)
  // registro de event handlers acontece aqui também
}
```

### LAW-006.5 — Container instancia na ordem: adapters → repositories → use cases → controllers

**Regra:** A função `createContainer` respeita a ordem de dependências:

1. **Adapters primeiro** — `SystemClock`, `UuidIdGenerator`, `PrismaUnitOfWork`, adapters de outros módulos.
2. **Repositories** — recebem o `PrismaClient` e eventualmente adapters auxiliares.
3. **Use cases** — recebem repositories, adapters e o event bus.
4. **Controllers** — recebem os use cases.
5. **Facade** (quando o módulo expõe uma) — recebe use cases e é retornada pelo container.

Instanciar fora dessa ordem (ex: use case antes do repository) é impossível por tipos, mas misturar as categorias no arquivo prejudica a leitura.

**Justificativa:** A ordem reflete a regra da dependência: adapters e repositories são infra, use cases são application, controllers são presentation. Segui-la torna o container lido de cima pra baixo como uma árvore de dependências.

**Exemplo certo:**
```ts
// src/modules/students/composition/container.ts
import type { PrismaClient } from '@prisma/client'
import type { EventBus } from '@/shared/event-bus'

import { SystemClock } from '@/modules/students/infrastructure/adapters/system-clock'
import { UuidIdGenerator } from '@/modules/students/infrastructure/adapters/uuid-id-generator'
import { PrismaUnitOfWork } from '@/modules/students/infrastructure/adapters/prisma-unit-of-work'
import { PrismaStudentsRepository } from '@/modules/students/infrastructure/repositories/prisma-students-repository'

import { CreateStudentUseCase } from '@/modules/students/application/use-cases/create-student'
import { GetStudentUseCase } from '@/modules/students/application/use-cases/get-student'

import { CreateStudentController } from '@/modules/students/presentation/controllers/create-student-controller'
import { GetStudentController } from '@/modules/students/presentation/controllers/get-student-controller'

export function createStudentsContainer(deps: { prisma: PrismaClient; eventBus: EventBus }) {
  // 1. adapters
  const clock = new SystemClock()
  const ids = new UuidIdGenerator()
  const uow = new PrismaUnitOfWork(deps.prisma)

  // 2. repositories
  const students = new PrismaStudentsRepository(deps.prisma)

  // 3. use cases
  const createStudent = new CreateStudentUseCase(students, ids, clock, deps.eventBus, uow)
  const getStudent = new GetStudentUseCase(students)

  // 4. controllers
  const controllers = {
    createStudent: new CreateStudentController(createStudent),
    getStudent: new GetStudentController(getStudent),
  }

  return { controllers, useCases: { createStudent, getStudent } }
}

export type StudentsContainer = ReturnType<typeof createStudentsContainer>
```

### LAW-006.6 — Instanciação acontece uma única vez, no boot do módulo

**Regra:** `createContainer` é chamado **uma vez** por processo, durante o bootstrap da aplicação. Instanciar containers ou dependências por requisição (ou dentro de handlers HTTP) é **proibido**.

**Justificativa:** Objetos stateless como use cases e controllers podem e devem ser reusados entre requisições. Recriá-los por request é desperdício e abre porta para bugs de estado. Objetos com estado por requisição (contexto de auth, trace id) são responsabilidade de middleware (LAW-005.9), não do container.

### LAW-006.7 — Nenhuma camada importa de `composition/`

**Regra:** Imports de `@/modules/<x>/composition/*` acontecem **apenas** no bootstrap global da aplicação (tipicamente `src/main.ts` ou `src/app.ts`) ou em outros composition roots que precisem injetar a facade. Domain, application, infrastructure e presentation do próprio módulo **nunca** importam de `composition/`.

**Justificativa:** Composition é o topo da árvore de dependências; se alguma camada abaixo importa de lá, houve inversão de direção (ciclo de dependência ou acoplamento circular). Em particular, presentation recebe controllers já instanciados via parâmetro da função de rota (LAW-005.10), não importando-os do container.

### LAW-006.8 — Escopo do container não cruza módulos

**Regra:** O container do módulo A **não** instancia nem conhece classes concretas do módulo B. Quando A precisa consumir B de forma síncrona, o bootstrap global instancia o container de B primeiro, extrai a facade pública (`StudentsFacade`), e passa essa facade como parâmetro para o container de A, que a injeta no adapter cross-module definido em LAW-004.11.

**Justificativa:** Isola ciclo de vida e dependências de módulos. A é ignorante quanto à composição interna de B; só conhece a interface pública que B expôs.

**Exemplo certo (bootstrap global):**
```ts
// src/main.ts
const prisma = new PrismaClient()
const eventBus = new NodeEventBus()
const app = Fastify().withTypeProvider<TypeBoxTypeProvider>()

const students = createStudentsContainer({ prisma, eventBus })
const studentsFacade = createStudentsFacade(students.useCases)

// payments precisa falar com students
const payments = createPaymentsContainer({ prisma, eventBus, studentsFacade })

registerStudentsModule(app, { prisma, eventBus })
registerPaymentsModule(app, { prisma, eventBus, studentsFacade })

await app.listen({ port: 3000 })
```

### LAW-006.9 — `index.ts` do módulo reexporta apenas a API pública

**Regra:** O arquivo `src/modules/<nome>/index.ts` exporta **exclusivamente**:

1. A função de registro (`registerStudentsModule`).
2. O tipo da facade pública (`export type { StudentsFacade }`), quando o módulo expõe uma.
3. A factory da facade (`createStudentsFacade`), quando aplicável.
4. Integration events (classes de evento que outros módulos podem assinar).

Qualquer outro export — entities, VOs, use cases, controllers, repositories, adapters — é **proibido** no `index.ts`. O que não está nesse arquivo é, por definição, interno ao módulo.

**Justificativa:** Sustenta a fronteira do módulo definida em LAW-001. Consumidores externos (outros módulos, bootstrap global) só podem acessar o módulo por essa superfície controlada. Detalhes sobre como facades e integration events são consumidos vivem em [[LAW-008 Lei de Comunicação Entre Módulos]].

**Exemplo certo:**
```ts
// src/modules/students/index.ts
export { registerStudentsModule } from './composition/register'
export type { StudentsModuleDeps } from './composition/register'
export { createStudentsFacade } from './composition/facade'
export type { StudentsFacade } from './composition/facade'
export { StudentCreated } from './domain/events/student-created'
export { StudentActivated } from './domain/events/student-activated'
```

### LAW-006.10 — Testes usam um composition root paralelo com adapters em memória

**Regra:** Para testes de integração do módulo, existe um `composition/test-container.ts` (ou equivalente) que instancia as mesmas interfaces com adapters em memória — `InMemoryStudentsRepository`, `FixedClock`, `StubEventBus`. A assinatura é a mesma do container de produção; o que muda são as implementações injetadas.

**Justificativa:** Se o teste de integração precisa subir Prisma, banco e Fastify, deixa de ser teste de integração útil e vira teste e2e caro. Com um container paralelo, o módulo inteiro (domain + application + presentation) é testável com sub-segundo de feedback. As implementações in-memory vivem em `infrastructure/` com o prefixo `InMemory*` (LAW-004.4) e são **legítimas infra de teste**.

### LAW-006.11 — Função de registro é a única forma de montar o módulo no Fastify

**Regra:** O módulo expõe uma função `register<Nome>Module(app, deps)` que é **o único ponto** onde o Fastify conhece o módulo. Essa função:

1. Chama `createContainer(deps)`.
2. Passa `container.controllers` para a função de registro de rotas (LAW-005.10).
3. Registra o error handler do módulo (LAW-005.7).
4. Registra handlers de eventos (domain e integration) no event bus.

Rotas soltas registradas fora dessa função, ou múltiplas funções de registro por módulo, são **proibidas**.

**Justificativa:** Uniformiza o bootstrap: o arquivo `src/main.ts` consiste basicamente em chamadas `registerXModule(app, deps)`. Nenhum módulo tem inicialização especial escondida; todos seguem o mesmo contrato.

### LAW-006.12 — Composition é arquivos, não pastas-por-unidade

**Regra:** Exceção explícita a [[LAW-007 Lei de Nomenclatura e Organização de Arquivos]]: os três arquivos da composition (`container.ts`, `register.ts`, `facade.ts`) são **arquivos soltos** dentro de `composition/`, não pastas com `index.ts`. Cada arquivo tem responsabilidade única e pequena; forçar pasta-por-arquivo aqui seria cerimônia sem ganho.

**Justificativa:** A convenção de pasta-por-unidade existe pra agrupar `index.ts` + `types.ts` + `errors.ts` em torno de uma unidade de código. Os três arquivos de composition são heterogêneos e independentes entre si — container não tem `types.ts` próprio, register não tem `errors.ts`. Manter arquivos soltos aqui é mais honesto.

## Sumário executivo

| # | Regra | Consequência da violação |
|---|-------|--------------------------|
| 1 | Composição é manual; containers de DI são proibidos | Mágica, reflection, tipagem imprecisa, dependências escondidas |
| 2 | Cada módulo tem sua própria composition root | Fronteira de módulo dissolvida |
| 3 | Composition é o único local que importa de `infrastructure/` | Classes concretas vazando pra outras camadas |
| 4 | Dependências compartilhadas chegam via parâmetro | Módulo amarrado a singleton global, intestável |
| 5 | Ordem: adapters → repositories → use cases → controllers | Container ilegível, ordem de criação fora da dependência |
| 6 | Instanciação uma única vez, no boot | Objetos duplicados, estado acidental por requisição |
| 7 | Nenhuma outra camada importa de `composition/` | Ciclo de dependência, inversão de direção |
| 8 | Container não cruza módulos; facade é passada via bootstrap | Módulo A conhece composição interna de B |
| 9 | `index.ts` reexporta só a API pública | Internals vazam, módulo deixa de ser encapsulado |
| 10 | Teste usa composition root paralelo com adapters em memória | Testes lentos, frágeis ou inexistentes |
| 11 | Função `register<X>Module(app, deps)` é a única forma de montar o módulo no Fastify | Bootstrap inconsistente, rotas soltas |
| 12 | Arquivos soltos em `composition/`, não pastas-por-unidade | Cerimônia sem ganho |

## Referências

- Mark Seemann, *Dependency Injection Principles, Practices, and Patterns* (2019), capítulos sobre Composition Root e Pure DI.
- Mark Seemann, *Pure DI*. https://blog.ploeh.dk/2014/06/10/pure-di/
- Robert C. Martin, *Clean Architecture* (2017), capítulo sobre Main Component.
- Vaughn Vernon, *Implementing Domain-Driven Design* (2013), capítulo sobre Application bootstrap e wiring.
- Kamil Grzybek, `modular-monolith-with-ddd`, bootstrap de módulos e Public API via composição manual. https://github.com/kgrzybek/modular-monolith-with-ddd
- Nicolas Bouvrette, *Composition Root: a Singleton Pattern Alternative*. https://www.nicolasbouvrette.com/blog/composition-root/

