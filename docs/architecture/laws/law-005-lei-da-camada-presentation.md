---
id: LAW-005
title: Lei da Camada Presentation
status: canonical
version: 1.0.0
scope: backend-typescript
supersedes: null
tags: [architecture, clean-architecture, presentation-layer, controllers, http, canonical-law]
related:
  - "[[LAW-001 Lei do Módulo]]"
  - "[[LAW-002 Lei da Camada Domain]]"
  - "[[LAW-003 Lei da Camada Application]]"
  - "[[LAW-004 Lei da Camada Infrastructure]]"
  - "[[LAW-006 Lei da Composition Root]]"
  - "[[LAW-007 Lei de Nomenclatura e Organização de Arquivos]]"
  - "[[LAW-008 Lei de Comunicação Entre Módulos]]"
  - "[[LAW-009 Lei de Erros]]"
---
# Lei da Camada Presentation

> Lei canônica que define o que é e o que não é a camada presentation, como controllers se organizam, onde o framework HTTP aparece, como input é validado, como output é serializado e como erros de domínio viram respostas HTTP. A presentation é a única camada que conhece o protocolo de transporte. Esta lei é referência para qualquer agente ou humano escrevendo controllers, rotas e serializers.

## Definição

A **camada presentation** é a **fronteira entre o mundo HTTP e a application**. Ela recebe requisições do framework (Fastify), extrai input do formato de transporte, invoca o use case apropriado e traduz o resultado — DTO ou erro — em resposta HTTP.

A presentation é a **única camada onde Fastify (ou qualquer framework HTTP) é visível**. `FastifyRequest`, `FastifyReply`, hooks, decorators e plugins **só existem aqui**. Application, domain e infrastructure são ignorantes quanto ao transporte.

A pedra de toque: se amanhã você troca Fastify por Hono, ou expõe os mesmos use cases via gRPC, **apenas a presentation muda**.

## Estrutura canônica

```
src/modules/<nome>/presentation/
├── controllers/
│   └── <nome-do-controller>/
│       ├── index.ts        # classe do controller
│       └── schemas.ts      # TypeBox schemas (body, params, query, response)
├── serializers/            # opcional; só onde há transformação
│   └── <serializer>/
│       └── index.ts
├── routes/
│   └── <nome-do-módulo>-routes.ts  # registra controllers no Fastify
├── middleware/             # opcional; plugins e hooks
│   └── <middleware>/
│       └── index.ts
└── error-handler/
    └── index.ts            # mapeia erros de domínio → HTTP
```

## Regras

### LAW-005.1 — Presentation é a única camada que conhece o framework HTTP

**Regra:** Imports de `fastify`, `@fastify/*`, `FastifyRequest`, `FastifyReply`, `FastifyInstance` só existem em arquivos dentro de `presentation/` e `composition/`. Em application, domain e infrastructure esses imports são **proibidos**.

**Justificativa:** Sustenta a regra da dependência. Se um use case importa `FastifyRequest`, ele virou acoplado a HTTP e perdeu a capacidade de ser invocado por CLI, fila ou job (LAW-003). Também garante substituibilidade de framework.

**Verificação programática:** grep por `from 'fastify'` ou `from '@fastify/` fora de `presentation/` e `composition/` é sempre violação.

### LAW-005.2 — Controller é classe com método único `handle(req, reply)`

**Regra:** Todo controller é uma classe que implementa:

```ts
class <Nome>Controller {
  constructor(private readonly useCase: <Nome>UseCase) {}
  handle(req: FastifyRequest, reply: FastifyReply): Promise<void>
}
```

Nada de múltiplos métodos públicos (`create`, `update`, `delete` no mesmo controller). Um controller = um endpoint = um use case.

**Justificativa:** Uniformidade de contrato, consistência com LAW-003.3 (use case tem `execute` único), facilita DI manual (construtor recebe exatamente o use case que orquestra) e torna o controller trivialmente testável.

### LAW-005.3 — Controller é thin: extrai, invoca, serializa

**Regra:** O corpo de `handle` tem exatamente três passos, nessa ordem:

1. Extrair input de `req.body`, `req.params`, `req.query`, `req.headers`.
2. Invocar `this.useCase.execute(input)`.
3. Escrever a resposta em `reply` (com status code apropriado e body serializado).

Qualquer lógica condicional de negócio no controller — `if (user.age < 18)`, loops de cálculo, agregação de dados — é **proibida**. Se precisa, está no use case ou no domain.

**Justificativa:** Controller "gordo" é transaction script disfarçado: a regra vai parar na camada que sabe de HTTP, e fica impossível testá-la sem subir framework. A magreza do controller é o que permite que ele seja escrito e revisado em segundos.

**Exemplo certo:**
```ts
// presentation/controllers/create-student-controller/index.ts
import type { FastifyRequest, FastifyReply } from 'fastify'
import type { CreateStudentUseCase } from '@/modules/students/application/use-cases/create-student'
import type { CreateStudentBody } from './schemas'

export class CreateStudentController {
  constructor(private readonly useCase: CreateStudentUseCase) {}

  async handle(
    req: FastifyRequest<{ Body: CreateStudentBody }>,
    reply: FastifyReply,
  ): Promise<void> {
    const output = await this.useCase.execute({
      name: req.body.name,
      email: req.body.email,
    })
    reply.code(201).send({ studentId: output.studentId, createdAt: output.createdAt })
  }
}
```

### LAW-005.4 — Um endpoint = um controller = um use case

**Regra:** Cada combinação de método HTTP + rota (`POST /students`, `GET /students/:id`, `PATCH /students/:id/suspend`) tem seu próprio controller em sua própria pasta, invocando exatamente um use case.

**Proibido:** controllers que delegam pra múltiplos use cases ("controller orquestrador"), controllers que escolhem qual use case chamar em runtime, ou controllers compartilhados entre endpoints.

**Justificativa:** Se um controller chama múltiplos use cases, ele está fazendo orquestração — e orquestração é responsabilidade da application (LAW-003.2). Se dois endpoints parecem querer compartilhar controller, ou são na verdade o mesmo endpoint mal fatorado, ou precisam de use cases distintos.

### LAW-005.5 — Validação de input via schema declarado na rota

**Regra:** Input HTTP é validado por **schema declarativo** (TypeBox) registrado no Fastify via type provider (`@fastify/type-provider-typebox`). O schema vive em `schemas.ts` ao lado do controller e é referenciado no registro da rota. Validação manual dentro do controller (`if (!req.body.email) ...`) é **proibida**.

**Justificativa:** Schema declarativo é single-source-of-truth: valida input, tipa `req.body` automaticamente e gera OpenAPI sem código adicional (LAW-005.11). Validação manual no controller duplica regras e infla o corpo do `handle`. TypeBox foi escolhido sobre Zod por integração nativa com Fastify (gera JSON Schema cru, sem adapter).

**Alternativa aceitável:** Zod via `fastify-type-provider-zod`, caso o time prefira a API de Zod. A regra é "schema via type provider"; a lib é secundária.

**Escopo:** Este schema valida **formato HTTP** (campo presente, tipo correto, email com `@`). Validação de negócio (email único, aluno ativo) continua sendo responsabilidade do domain/application (LAW-003.9).

**Exemplo certo:**
```ts
// presentation/controllers/create-student-controller/schemas.ts
import { Type, type Static } from '@sinclair/typebox'

export const CreateStudentBodySchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 120 }),
  email: Type.String({ format: 'email', maxLength: 255 }),
})
export type CreateStudentBody = Static<typeof CreateStudentBodySchema>

export const CreateStudentResponseSchema = Type.Object({
  studentId: Type.String({ format: 'uuid' }),
  createdAt: Type.String({ format: 'date-time' }),
})

// presentation/routes/students-routes.ts
fastify.post('/students', {
  schema: {
    body: CreateStudentBodySchema,
    response: { 201: CreateStudentResponseSchema },
  },
}, (req, reply) => controller.handle(req, reply))
```

### LAW-005.6 — Serializer é obrigatório quando há transformação; proibido quando seria identidade

**Regra:** Se o shape do Output do use case = shape da resposta HTTP, o controller retorna o DTO direto. Quando há **qualquer** transformação (remoção de campos, renomeação, reformatação, versionamento de API), a transformação vive em um serializer dedicado em `serializers/<nome>/index.ts`, invocado pelo controller. Transformações inline dentro do `handle` são **proibidas**.

**Justificativa:** Obrigar serializer sempre vira cerimônia em CRUDs onde o DTO já é exatamente o que sai. Proibir completamente força o use case a conhecer o formato HTTP (ex: datas como string ISO) — o que viola LAW-003.4. A regra do "meio-termo" mantém o controller magro e isola cada transformação de apresentação em arquivo testável.

**Exemplo certo (serializer necessário):**
```ts
// presentation/serializers/student-public-serializer/index.ts
import type { GetStudentOutput } from '@/modules/students/application/use-cases/get-student'

export class StudentPublicSerializer {
  static serialize(output: GetStudentOutput) {
    return {
      id: output.id,
      name: output.name,
      // email omitido por privacidade
      joinedAt: output.createdAt, // renomeado
    }
  }
}

// presentation/controllers/get-student-controller/index.ts
async handle(req, reply): Promise<void> {
  const output = await this.useCase.execute({ studentId: req.params.id })
  reply.code(200).send(StudentPublicSerializer.serialize(output))
}
```

### LAW-005.7 — Erros de domínio são traduzidos em HTTP por error handler global

**Regra:** O módulo declara um error handler em `presentation/error-handler/index.ts` registrado via `app.setErrorHandler(...)`. Esse handler inspeciona a classe do erro, consulta um mapa `ErrorClass → { status, code }` e devolve resposta HTTP uniforme. `try/catch` dentro de controllers é **proibido**, salvo quando há necessidade comprovada de resposta customizada para um único endpoint.

**Justificativa:** Como erros de domínio são classes nomeadas (LAW-002.7) e erros de infra foram envelopados em `InfrastructureError` (LAW-004.9), a tradução para HTTP é puramente um mapeamento de tipo pra status. Centralizar no handler elimina repetição, garante consistência de formato de erro e mantém controllers magros. Detalhes do mapa classe→status e formato de resposta vivem em [[LAW-009 Lei de Erros]].

**Exemplo certo:**
```ts
// presentation/error-handler/index.ts
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify'
import { StudentNotFoundError } from '@/modules/students/domain/errors/student-not-found'
import { StudentEmailAlreadyExistsError } from '@/modules/students/domain/errors/student-email-already-exists'
import { InfrastructureError } from '@/modules/students/infrastructure/errors/infrastructure-error'

const ERROR_MAP = new Map<Function, { status: number }>([
  [StudentNotFoundError, { status: 404 }],
  [StudentEmailAlreadyExistsError, { status: 409 }],
])

export function studentsErrorHandler(err: FastifyError, req: FastifyRequest, reply: FastifyReply) {
  const mapped = ERROR_MAP.get(err.constructor)
  if (mapped) {
    return reply.code(mapped.status).send({ code: (err as any).code, message: err.message })
  }
  if (err instanceof InfrastructureError) {
    req.log.error({ err: err.cause }, 'infrastructure error')
    return reply.code(503).send({ code: 'INFRASTRUCTURE_ERROR', message: 'Service unavailable' })
  }
  req.log.error({ err }, 'unhandled error')
  return reply.code(500).send({ code: 'INTERNAL_ERROR', message: 'Internal server error' })
}
```

### LAW-005.8 — Presentation não importa de infrastructure nem conhece entities/VOs

**Regra:** Arquivos em `presentation/` importam apenas de:

1. `application/use-cases/<x>` — tipos `<Name>Input` e `<Name>Output` e a classe do use case (para tipar o construtor do controller).
2. `domain/errors/` — classes de erro do domínio (para uso no error handler).
3. `presentation/` do próprio módulo.
4. Framework HTTP (Fastify) e bibliotecas de schema (TypeBox/Zod).

**Proibido:** importar entities, VOs, repositories, ports, ou qualquer arquivo de `infrastructure/`. Presentation não sabe o que é `Student`, só sabe o que é `CreateStudentOutput`.

**Justificativa:** Se o controller importa `Student` ou `StudentEmail`, ele pode invocar métodos de negócio da entity e contornar o use case — exatamente o que LAW-003.5 proíbe. Limitando os imports a DTOs da application, o controller é forçado a permanecer thin.

### LAW-005.9 — Middleware é framework-level e vive só em presentation

**Regra:** Hooks, plugins Fastify, decorators e middleware global (autenticação, rate limiting, request logging, CORS) vivem em `presentation/middleware/<nome>/index.ts`. Middleware **não** contém regra de negócio.

**Justificativa:** Middleware é, por definição, sobre a requisição HTTP — autenticar o token, adicionar um trace id, rejeitar por rate limit. Todos esses conceitos só existem no mundo HTTP, então vivem na única camada que conhece HTTP. Qualquer "validação" que um middleware faça deve ser **estrutural** (token presente e bem-formado); validação semântica (usuário ativo, permissão pro recurso) é do domain/application.

### LAW-005.10 — Rotas ficam em `routes/` e só fazem wiring

**Regra:** Arquivos em `presentation/routes/` têm **exclusivamente** o papel de:

1. Registrar caminhos HTTP no Fastify (`app.post`, `app.get`, ...).
2. Declarar os schemas (referenciando `schemas.ts` dos controllers).
3. Delegar para o `handle` do controller instanciado pela composition root.

Nenhuma lógica, extração de input, transformação de output, ou tratamento de erro vive em rotas. Rota é wiring HTTP puro.

**Justificativa:** Separar rota de controller permite que a rota seja trivialmente lida ("POST /students chama CreateStudentController") sem perder o detalhe de como o controller funciona. Também simplifica testes: rota é testada em integração com framework; controller é testado em isolamento.

**Exemplo certo:**
```ts
// presentation/routes/students-routes.ts
import type { FastifyInstance } from 'fastify'
import type { StudentsController } from '@/modules/students/composition/container'
import { CreateStudentBodySchema, CreateStudentResponseSchema } from '@/modules/students/presentation/controllers/create-student-controller/schemas'

export function registerStudentsRoutes(app: FastifyInstance, controllers: StudentsController): void {
  app.post('/students', {
    schema: {
      body: CreateStudentBodySchema,
      response: { 201: CreateStudentResponseSchema },
    },
  }, (req, reply) => controllers.createStudent.handle(req, reply))
}
```

### LAW-005.11 — OpenAPI é efeito colateral dos schemas; nunca escrito à mão

**Regra:** Documentação OpenAPI do módulo é gerada automaticamente a partir dos schemas declarados nas rotas, via `@fastify/swagger` + type provider. Escrever spec OpenAPI separado em YAML/JSON manual é **proibido**.

**Justificativa:** Spec escrito à mão diverge do código real no segundo commit depois de criado. Como os schemas já são a fonte da verdade para validação e tipagem (LAW-005.5), usá-los também como fonte da documentação elimina divergência por construção. Se um endpoint precisa de descrição adicional, isso vai como propriedade do próprio schema (`description`, `examples`).

**Exceção aceitável:** se o time decide não expor OpenAPI publicamente, a regra apenas desliga `@fastify/swagger` — os schemas continuam sendo a fonte única de verdade para validação.

### LAW-005.12 — Cada controller é uma pasta com `index.ts` e `schemas.ts`

**Regra:** Segue [[LAW-007 Lei de Nomenclatura e Organização de Arquivos]]:

```
controllers/create-student-controller/
├── index.ts      # export class CreateStudentController
└── schemas.ts    # TypeBox schemas + tipos inferidos

serializers/student-public-serializer/
└── index.ts      # export class StudentPublicSerializer
```

Arquivos soltos (`create-student-controller.ts`, `create-student-controller.schemas.ts`) são **proibidos**.

**Justificativa:** Uniformidade com as demais camadas. Consumidores (rotas, composition root) importam sempre de `index.ts`; schemas são importados explicitamente de `schemas.ts` quando a rota precisa referenciá-los.

## Sumário executivo

| # | Regra | Consequência da violação |
|---|-------|--------------------------|
| 1 | Só presentation conhece Fastify | Use case acoplado a HTTP, perda de substituibilidade |
| 2 | Controller é classe com `handle(req, reply)` | Contrato inconsistente, DI complicada |
| 3 | Controller é thin (extrai, invoca, serializa) | Transaction script no lugar errado |
| 4 | Um endpoint = um controller = um use case | Orquestração na camada errada, controllers god-class |
| 5 | Validação via schema no type provider (TypeBox) | Validação duplicada, tipos manuais, OpenAPI divergente |
| 6 | Serializer só quando há transformação | Cerimônia excessiva ou use case vazando HTTP |
| 7 | Erro de domínio → HTTP via error handler global | `try/catch` repetido, respostas inconsistentes |
| 8 | Presentation não importa entities/VOs/infra | Controller contorna use case, regra vaza |
| 9 | Middleware é framework-level e só em presentation | Regra de negócio em hook, testabilidade perdida |
| 10 | Rotas são wiring puro | Lógica dispersa entre rota e controller |
| 11 | OpenAPI é gerado dos schemas, nunca escrito à mão | Doc divergente do código |
| 12 | Pasta-por-controller com `index.ts` e `schemas.ts` | Organização inconsistente com demais camadas |

## Referências

- Robert C. Martin, *Clean Architecture* (2017), capítulo sobre Interface Adapters e Camada de Frameworks & Drivers.
- Eric Evans, *Domain-Driven Design* (2003), capítulo sobre User Interface / Presentation Layer.
- Vaughn Vernon, *Implementing Domain-Driven Design* (2013), capítulo sobre Application e UI Integration.
- Fastify, *Type Providers documentation*. https://fastify.dev/docs/latest/Reference/Type-Providers/
- Sinclair, *TypeBox*. https://github.com/sinclairzx81/typebox
- Fastify, *Validation and Serialization*. https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/
- Fastify, *Errors*. https://fastify.dev/docs/latest/Reference/Errors/
- Kamil Grzybek, `modular-monolith-with-ddd`, estrutura de camada de apresentação e error handling. https://github.com/kgrzybek/modular-monolith-with-ddd
- Mark Seemann, *Dependency Injection Principles, Practices, and Patterns* (2019), capítulo sobre Composition Root e Controllers.

