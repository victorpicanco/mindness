---
id: LAW-009
title: Lei de Erros
status: canonical
version: 1.0.0
scope: backend-typescript
supersedes:
tags:
  - architecture
  - errors
  - exceptions
  - error-handling
  - canonical-law
related:
  - "[[LAW-001 Lei do Módulo]]"
  - "[[LAW-002 Lei da Camada Domain]]"
  - "[[LAW-003 Lei da Camada Application]]"
  - "[[LAW-004 Lei da Camada Infrastructure]]"
  - "[[LAW-005 Lei da Camada Presentation]]"
  - "[[LAW-007 Lei de Nomenclatura e Organização de Arquivos]]"
  - "[[LAW-008 Lei de Comunicação Entre Módulos]]"
  - "[[LAW-010 Lei do Lib]]"
---

# Lei de Erros

> Lei canônica que define a hierarquia de erros, onde cada categoria mora, como erros são propagados entre camadas, e como são traduzidos em respostas HTTP. Erros são parte do contrato do módulo — modela-los explicitamente é tão importante quanto modelar o caminho feliz.

## Definição

**Erros não são imprevistos** — são estados legítimos que o sistema produz e precisa comunicar com clareza. Modela-los como classes nomeadas, organizadas em hierarquia tipada e propagadas com contexto, é o que separa um sistema observável de uma caixa-preta que devolve `500 Internal Server Error` pra tudo.

Esta lei estabelece três princípios fundadores:

1. **Erros têm taxonomia.** Falha de invariante de negócio é diferente de timeout de banco — e o cliente, o operador e os logs precisam dessa distinção.
2. **Erros carregam contexto estruturado.** `Error('Student not found')` é inútil. Um erro tipado com `studentId`, `code` e `cause` é evidência operacional.
3. **Erros são parte do contrato.** Mudar erro publicamente exposto é breaking change — tanto quanto mudar o tipo de retorno.

## Estrutura canônica

```
shared/errors/
├── base-error/                  # raiz da hierarquia
│   └── index.ts
├── domain-error/                # base de erros de domínio
│   └── index.ts
├── application-error/           # base de erros de orquestração
│   └── index.ts
├── infrastructure-error/        # base de erros técnicos
│   └── index.ts
└── categories/                  # categorias semânticas (mapeiam pra status HTTP)
    ├── not-found-error/
    ├── conflict-error/
    ├── validation-error/
    ├── unauthorized-error/
    ├── forbidden-error/
    └── unprocessable-error/

src/modules/<nome>/domain/errors/
└── <erro-de-negocio>/           # erros de domínio específicos do módulo
    └── index.ts

src/modules/<nome>/application/use-cases/<x>/
└── errors.ts                    # erros específicos do use case (opcional)
```

## Regras

### LAW-009.1 — Todo erro lançado é uma classe que estende `BaseError`

**Regra:** Em todo o código sob `src/`, qualquer `throw` lança uma instância de classe que estende `BaseError` (ou suas descendentes). `throw new Error(...)` genérico, `throw 'string'`, `throw { ... }` são **proibidos**.

**Justificativa:** `BaseError` carrega campos uniformes (`code`, `context`, `cause`, `httpStatus`) que todo o pipeline de tratamento depende. Erros sem essa estrutura quebram o middleware, os logs estruturados e a resposta HTTP padronizada — produzindo o `500 Internal Server Error` sem detalhe que esta lei existe pra eliminar.

### LAW-009.2 — `BaseError` vive em `shared/errors/base-error/` e define o formato uniforme

**Regra:** A classe `BaseError` vive em `shared/errors/base-error/index.ts` e define os campos obrigatórios que todo erro do sistema carrega:

```ts
export interface ErrorContext {
  readonly [key: string]: unknown
}

export abstract class BaseError extends Error {
  abstract readonly code: string         // namespaced: '<modulo>.<CONSTANT_CASE>'
  abstract readonly httpStatus: number   // 400, 404, 409, 500, etc.
  readonly context: ErrorContext
  readonly cause?: unknown

  constructor(message: string, options?: { context?: ErrorContext; cause?: unknown }) {
    super(message)
    this.name = this.constructor.name
    this.context = options?.context ?? {}
    this.cause = options?.cause
    Object.setPrototypeOf(this, new.target.prototype) // restaura prototype chain
  }
}
```

**Justificativa:** Centralizar a forma garante que (1) middleware único de erro consiga serializar qualquer erro do sistema, (2) logs estruturados sempre tenham os mesmos campos, (3) `instanceof BaseError` distingue erros do sistema de erros nativos não tratados.

A linha `Object.setPrototypeOf` é necessidade técnica do TypeScript: sem ela, `instanceof` falha em subclasses de `Error`.

### LAW-009.3 — Existem três classes-base de categoria fonte

**Regra:** Todo erro concreto estende uma de três classes-base, cada uma representando a **fonte** do erro:

```ts
// shared/errors/domain-error/index.ts
export abstract class DomainError extends BaseError {}

// shared/errors/application-error/index.ts
export abstract class ApplicationError extends BaseError {}

// shared/errors/infrastructure-error/index.ts
export abstract class InfrastructureError extends BaseError {
  readonly httpStatus = 500  // padrão; subclasses podem sobrescrever
}
```

**Distinção:**
- **`DomainError`** — violação de invariante de negócio (`StudentEmailAlreadyExistsError`, `EnrollmentPeriodClosedError`). Origem: domain.
- **`ApplicationError`** — falha de orquestração ou validação de input (`ValidationError`, `OperationFailedError`). Origem: application/presentation.
- **`InfrastructureError`** — falha técnica (`DatabaseConnectionError`, `ExternalServiceTimeoutError`). Origem: infrastructure.

**Justificativa:** A fonte do erro determina como ele é tratado:
- Erros de domínio têm mensagem voltada para o cliente final ("Aluno já cadastrado").
- Erros de infraestrutura **nunca** vazam mensagem técnica para o cliente — viram `"Internal Server Error"` ou similar, com detalhes apenas nos logs.
- Erros de aplicação ficam no meio: validação volta com detalhe (campo inválido), falha de orquestração vira mensagem genérica.

### LAW-009.4 — Categorias semânticas carregam `httpStatus`

**Regra:** Entre as classes-base de fonte e os erros concretos, existe uma camada de **categorias semânticas** que define o `httpStatus`:

```ts
// shared/errors/categories/not-found-error/index.ts
export abstract class NotFoundError extends DomainError {
  readonly httpStatus = 404
}

// shared/errors/categories/conflict-error/index.ts
export abstract class ConflictError extends DomainError {
  readonly httpStatus = 409
}

// shared/errors/categories/validation-error/index.ts
export abstract class ValidationError extends ApplicationError {
  readonly httpStatus = 400
}

// shared/errors/categories/unauthorized-error/index.ts
export abstract class UnauthorizedError extends ApplicationError {
  readonly httpStatus = 401
}

// shared/errors/categories/forbidden-error/index.ts
export abstract class ForbiddenError extends ApplicationError {
  readonly httpStatus = 403
}

// shared/errors/categories/unprocessable-error/index.ts
export abstract class UnprocessableError extends DomainError {
  readonly httpStatus = 422
}
```

Erros concretos estendem a categoria apropriada, **não** `DomainError`/`ApplicationError` diretamente:

```ts
// students/domain/errors/student-not-found/index.ts
import { NotFoundError } from '@/shared/errors/categories/not-found-error'

export class StudentNotFoundError extends NotFoundError {
  readonly code = 'students.STUDENT_NOT_FOUND'

  constructor(studentId: string) {
    super(`Student with id ${studentId} not found`, { context: { studentId } })
  }
}
```

**Justificativa:** Categorias semânticas mantêm o `httpStatus` próximo à intenção (não em tabela distante no middleware), são poucas e estáveis (raro adicionar nova), e desacoplam o erro concreto do código numérico — `NotFoundError` vira `404` em REST, `code 5` em gRPC, sem modificar o erro de domínio.

**Sobre o argumento "isso vaza HTTP pro domain":** o vocabulário "not found", "conflict", "forbidden" é universal de protocolo de transporte, não específico de HTTP. REST formaliza códigos; gRPC formaliza outros; a categoria semântica é o invariante. Se você ainda preferir nomes neutros (`NotFoundError` em vez de `Http404Error`), está adotada essa neutralidade — a categoria descreve a **natureza do erro**, não o transporte.

### LAW-009.5 — Domain errors específicos vivem em `<modulo>/domain/errors/`

**Regra:** Cada erro de negócio concreto fica em `src/modules/<modulo>/domain/errors/<erro>/index.ts`. O nome da classe descreve o estado violado em termos de negócio: `StudentNotFoundError`, `EnrollmentAlreadyExistsError`, `InsufficientCreditsError`.

**Proibido:** nomes genéricos (`StudentError`, `BusinessError`, `ValidationFailed`).

**Justificativa:** Reforça [[LAW-002 Lei da Camada Domain]] regra 7. O nome do erro é parte da linguagem ubíqua do bounded context. `StudentEmailAlreadyExistsError` comunica imediatamente o que aconteceu; `StudentError('email exists')` força o leitor a parsear a mensagem.

### LAW-009.6 — Application errors específicos moram ao lado do use case quando exclusivos

**Regra:** Erros que só fazem sentido no contexto de um use case específico vivem em `application/use-cases/<x>/errors.ts`. Erros de aplicação reutilizáveis (ex: `OperationFailedError` genérico) vivem em `shared/errors/`.

**Critério:** se o erro é nomeado em termos do use case (`EnrollStudentValidationError`), mora ao lado. Se é estrutural (`OperationTimeoutError`), está em shared.

**Justificativa:** Co-localização aproxima erro do código que o lança e permite leitura completa do contrato do use case (input, output, errors) abrindo uma única pasta. Isso se alinha com [[LAW-003 Lei da Camada Application]] regra 12.

### LAW-009.7 — Infrastructure errors nunca vazam mensagem técnica para o cliente

**Regra:** `InfrastructureError` e suas subclasses (`DatabaseConnectionError`, `ExternalServiceTimeoutError`, `MessageBrokerError`) carregam mensagem técnica detalhada **para logs**, mas o middleware HTTP serializa para o cliente apenas `"Internal Server Error"` (ou equivalente neutro), nunca o `message` do erro.

**Proibido:**
- Vazar stack trace na resposta HTTP.
- Vazar nome de tabela, query, código de erro do ORM.
- Vazar detalhes de serviços externos (host, endpoint, headers).

**Justificativa:** Mensagens técnicas dão dicas para atacantes (engenharia da stack, vulnerabilidades de versão) e são inúteis para o cliente final. Quem opera precisa do detalhe técnico — esse fica nos logs estruturados, correlacionado por `requestId`.

**Exemplo certo:**
```ts
// shared/errors/infrastructure-error/index.ts
export abstract class InfrastructureError extends BaseError {
  readonly httpStatus = 500
}

// shared/errors/database-error/index.ts
export class DatabaseError extends InfrastructureError {
  readonly code = 'shared.DATABASE_ERROR'

  constructor(message: string, options?: { cause?: unknown; context?: ErrorContext }) {
    super(message, options)
  }
}

// no log: full message + cause + stack
// na resposta HTTP: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }
```

### LAW-009.8 — `code` é namespaced no formato `<modulo>.<CONSTANT_CASE>`

**Regra:** Todo erro define um `code` único e estável, no formato `<modulo>.<CONSTANT_CASE>` (ex: `students.STUDENT_NOT_FOUND`, `enrollments.ENROLLMENT_PERIOD_CLOSED`). Erros do shared usam prefixo `shared.` (ex: `shared.VALIDATION_FAILED`, `shared.DATABASE_ERROR`).

**Justificativa:** O `code` é o que o cliente da API programa contra (mais estável que `message`, traduzível, roteável). Namespace por módulo:
- Evita colisão entre módulos.
- Comunica origem ao consumidor (`students.*` veio do módulo students).
- Facilita auditoria e mapeamento para mensagens localizadas.

**Proibido:** códigos sem namespace (`STUDENT_NOT_FOUND` solto), códigos com nome diferente entre erros (`STUDENT_404` vs `STUDENT_NOT_FOUND` — escolha um).

### LAW-009.9 — `context` é estruturado, não concatenado em `message`

**Regra:** Dados relevantes para diagnóstico moram no campo `context: ErrorContext` — um objeto plano de chaves e valores. **Não** concatenam-se valores na `message`.

**Proibido:**
```ts
throw new StudentNotFoundError(`Student ${id} (email ${email}) at ${new Date()}`)
// message string com dados embutidos é anti-pattern
```

**Certo:**
```ts
throw new StudentNotFoundError(id, { context: { searchedEmail: email, searchedAt: new Date() } })
```

**Justificativa:** `context` estruturado é (a) machine-readable para logs e métricas, (b) seguro para tradução (mensagem pode ser localizada sem perder dados), (c) impossível de quebrar parseando string. Concatenar valores em `message` é o erro mais comum e o que destrói observabilidade — você acaba escrevendo regex pra extrair `studentId` de log que devia ter sido um campo desde o início.

### LAW-009.10 — `cause` é sempre preservado quando há erro original

**Regra:** Quando um erro é capturado e relançado (ou traduzido), o erro original é passado como `cause`. Engolir o erro original é **proibido**.

**Exemplo certo:**
```ts
try {
  await this.prisma.student.create({ data })
} catch (err) {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    throw new StudentEmailAlreadyExistsError(email, { cause: err })
  }
  throw new DatabaseError('Failed to create student', { cause: err, context: { studentId: id } })
}
```

**Proibido:**
```ts
catch (err) {
  throw new DatabaseError('Failed') // CAUSE PERDIDO
}
catch (err) {
  console.log(err)                  // ERRO ENGOLIDO
  return null
}
```

**Justificativa:** Sem `cause`, o stack trace original é perdido — você sabe que falhou, mas não onde. Em produção, isso transforma 5 minutos de diagnóstico em 5 horas.

### LAW-009.11 — `ValidationError` padroniza falhas de schema de input

**Regra:** Erros de validação de schema (request HTTP, payload de evento, parâmetros de fila) são traduzidos para `ValidationError` antes de subir. Erros nativos do validador (Fastify schema error, Zod issue, etc.) **não** vazam pra fora da camada de presentation.

A `ValidationError` carrega `context.fields: Array<{ path: string; message: string; code: string }>` listando todas as falhas estruturadas:

```ts
// shared/errors/validation-failed-error/index.ts
import { ValidationError } from '@/shared/errors/categories/validation-error'

export interface FieldError {
  readonly path: string       // 'email', 'address.zipCode'
  readonly message: string    // 'must be a valid email'
  readonly code: string       // 'invalid_email_format'
}

export class ValidationFailedError extends ValidationError {
  readonly code = 'shared.VALIDATION_FAILED'

  constructor(fields: FieldError[]) {
    super('Request validation failed', { context: { fields } })
  }
}
```

**Justificativa:** O cliente da API espera **um** formato de erro de validação, não três (Fastify, Zod, custom). Tradução centralizada no middleware ou em error handler dedicado garante consistência.

### LAW-009.12 — Middleware único traduz `BaseError` para resposta HTTP

**Regra:** Existe **um único** error handler global (registrado uma vez no bootstrap do Fastify) que:

1. Recebe o erro lançado.
2. Se for `BaseError`: serializa usando seu `httpStatus`, `code`, `message` (apenas para domain/application errors), `context.fields` (se ValidationError), correlaciona com `requestId`.
3. Se for `InfrastructureError`: loga detalhe técnico, retorna `{ code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }` com `500`.
4. Se **não** for `BaseError`: trata como erro desconhecido — loga, retorna mesmo formato genérico de `500`.

**Proibido:** controllers individuais com try/catch traduzindo erro para resposta. Controllers lançam; middleware traduz.

**Justificativa:** Tradução centralizada garante formato consistente de resposta de erro em toda a API. Espalhar a tradução por controllers leva a divergência inevitável (cada um trata um pouco diferente). Esta é uma das regras mais auditáveis: `try/catch` em controller = violação.

**Formato de resposta canônico:**
```json
{
  "error": {
    "code": "students.STUDENT_NOT_FOUND",
    "message": "Student with id abc-123 not found",
    "fields": null,
    "requestId": "req_xyz"
  }
}
```

Detalhes do formato (envelope, campos opcionais) ficam para [[LAW-005 Lei da Camada Presentation]].

### LAW-009.13 — Erro desconhecido nunca vaza detalhe; sempre vira `500` genérico

**Regra:** Qualquer `throw` que produza algo que **não** seja `BaseError` (erro nativo escapado, lib externa, bug não previsto) é tratado pelo middleware como erro desconhecido: logado com stack completo, retornado como `500` com mensagem genérica e `code: 'INTERNAL_ERROR'`.

**Justificativa:** Vazar `TypeError: Cannot read property 'foo' of undefined` para o cliente expõe detalhes da implementação. Erros que escapam da hierarquia são sintoma de código não-disciplinado — devem ser identificados nos logs (alertados) e corrigidos com erro tipado próprio.

### LAW-009.14 — `try/catch` em código de negócio só existe para traduzir erro

**Regra:** `try/catch` em use cases, controllers, repositories tem **um único propósito legítimo**: capturar erro de uma camada inferior e traduzir para erro de categoria correta. Capturar erro para retornar valor especial (null, undefined, false), engolir, ou continuar fluxo "como se nada tivesse acontecido" é **proibido**.

**Exemplo certo (tradução):**
```ts
try {
  await this.prisma.student.create({ data })
} catch (err) {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    throw new StudentEmailAlreadyExistsError(email, { cause: err })
  }
  throw err
}
```

**Exemplo errado (engolir):**
```ts
try {
  await this.notifyService.send(message)
} catch {
  // ignora — só pra logar de manhã
}
```

**Justificativa:** `try/catch` que engole erro produz o pior tipo de bug: o silencioso. O sistema continua "funcionando" enquanto efeitos colaterais críticos falham invisivelmente. Se a operação **legitimamente** pode falhar e o fluxo continua, isso é decisão de negócio explícita — modela como `Result<Success, Failure>`, retorne resultado tipado, **não** silencie.

### LAW-009.15 — Toda captura de erro registra log estruturado com `requestId`, `code`, `context` e `cause`

**Regra:** O middleware de erro (e qualquer ponto legítimo de captura para tradução) registra log estruturado com no mínimo:

- `requestId` — correlação com a request
- `code` — código do erro
- `message` — mensagem original
- `context` — campos estruturados
- `cause` — erro original (com sua mensagem e stack)
- `stack` — stack trace
- `httpStatus` — status retornado ao cliente

**Justificativa:** Logs estruturados são a única forma viável de operar um sistema em produção. Sem `requestId`, é impossível correlacionar erro com request. Sem `cause`, é impossível diagnosticar a raiz. Sem `context`, é impossível filtrar por usuário/recurso. Esta regra é o que transforma erros tipados em **sistema observável**.

## Sumário executivo

| # | Regra | Consequência da violação |
|---|-------|--------------------------|
| 1 | Todo erro estende `BaseError` | Pipeline de erro quebrado, formato inconsistente |
| 2 | `BaseError` em `shared/errors/`, define formato uniforme | Cada erro reinventa estrutura |
| 3 | Três classes-base de fonte: Domain/Application/Infrastructure | Tratamento indiferenciado, vazamento técnico |
| 4 | Categorias semânticas (NotFound, Conflict, etc.) carregam `httpStatus` | Status HTTP em tabela frágil, espalhado |
| 5 | Domain errors em `<modulo>/domain/errors/` | Erro de negócio fora do bounded context |
| 6 | Application errors específicos ao lado do use case | Contrato do use case fragmentado |
| 7 | Infrastructure errors não vazam mensagem técnica | Vazamento de stack/tecnologia ao cliente |
| 8 | `code` namespaced `<modulo>.<CONSTANT_CASE>` | Colisão entre módulos, instabilidade do contrato |
| 9 | `context` estruturado, não concatenado em `message` | Logs inúteis, observabilidade morta |
| 10 | `cause` preservado em re-throw | Stack original perdido, diagnóstico impossível |
| 11 | `ValidationError` padroniza falhas de schema | Múltiplos formatos de erro de validação |
| 12 | Middleware único traduz `BaseError` em resposta HTTP | Tradução divergente por controller |
| 13 | Erro desconhecido vira `500` genérico | Vazamento de detalhe técnico, ataque facilitado |
| 14 | `try/catch` só pra traduzir, nunca pra engolir | Bug silencioso, falha invisível |
| 15 | Log estruturado com `requestId`, `code`, `context`, `cause` | Sistema operacional cego |

## Referências

- Eric Evans, *Domain-Driven Design* (2003), capítulo sobre Domain Errors and Invariants.
- Vaughn Vernon, *Implementing Domain-Driven Design* (2013), capítulo sobre Application Layer Error Handling.
- Robert C. Martin, *Clean Code* (2008), capítulo "Error Handling".
- Khalil Stemmler, *Functional Error Handling with Express.js and DDD*. https://khalilstemmler.com/articles/enterprise-typescript-nodejs/functional-error-handling/
- Bruno Vegreville, *Expressive error handling in TypeScript and benefits for domain-driven design*. https://medium.com/inato/expressive-error-handling-in-typescript-and-benefits-for-domain-driven-design-70726e061c86
- Kamil Grzybek, `modular-monolith-with-ddd` — Error Handling. https://github.com/kgrzybek/modular-monolith-with-ddd
- IETF RFC 7807, *Problem Details for HTTP APIs*. https://datatracker.ietf.org/doc/html/rfc7807
- Prisma Docs, *Error Reference*. https://www.prisma.io/docs/orm/reference/error-reference
