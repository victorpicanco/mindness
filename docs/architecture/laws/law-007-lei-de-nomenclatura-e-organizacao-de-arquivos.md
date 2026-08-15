---
id: LAW-007
title: Lei de Nomenclatura e Organização de Arquivos
status: canonical
version: 1.0.0
scope: backend-typescript
supersedes: null
tags: [architecture, naming-conventions, file-organization, canonical-law]
related:
  - "[[LAW-001 Lei do Módulo]]"
  - "[[LAW-002 Lei da Camada Domain]]"
  - "[[LAW-003 Lei da Camada Application]]"
  - "[[LAW-004 Lei da Camada Infrastructure]]"
  - "[[LAW-005 Lei da Camada Presentation]]"
  - "[[LAW-006 Lei da Composition Root]]"
---
# Lei de Nomenclatura e Organização de Arquivos


> Lei canônica que consolida as convenções de nomenclatura, estrutura de pastas, formato de imports e localização de arquivos auxiliares (tipos, erros, testes). Esta lei é transversal: ela é citada por praticamente todas as outras leis e formaliza padrões que vinham sendo invocados de forma dispersa. Serve de referência única para qualquer agente ou humano criando arquivos no projeto.


## Definição


Esta lei trata de **forma**, não de arquitetura. As outras leis decidem o que cada camada faz e o que cada arquivo contém; esta lei decide **como esse arquivo se chama, onde mora, como é importado, e quais arquivos auxiliares moram ao lado dele**.


A pedra de toque é a **previsibilidade**. Um agente lendo o repositório (humano ou LLM) deve conseguir prever, com alta probabilidade, em que caminho um conceito vive sem precisar listar diretórios. Essa previsibilidade é o que torna o corpus de leis verificável programaticamente e o que permite navegação rápida em módulos não-familiares.


## Regras


### LAW-007.1 — Arquivos e pastas em kebab-case


**Regra:** Todo arquivo e toda pasta usam **kebab-case** (`enroll-student`, `prisma-students-repository`, `student-email`). PascalCase (`EnrollStudent`), camelCase (`enrollStudent`) e snake_case (`enroll_student`) em nomes de arquivo são **proibidos**.


**Justificativa:** Sistemas de arquivos case-insensitive (macOS default, Windows) tornam diferenças de caixa não-confiáveis. kebab-case é case-safe, separa palavras de forma legível, e é a convenção dominante no ecossistema Node.js/TypeScript moderno (Next.js, Remix, NestJS-DDD samples). Misturar convenções no mesmo repositório gera bugs em CI/Linux que não aparecem localmente em macOS.


### LAW-007.2 — Classes, interfaces e tipos em PascalCase; funções e variáveis em camelCase


**Regra:** O conteúdo dos arquivos segue o padrão TypeScript canônico:


- **PascalCase** para classes (`Student`), interfaces (`StudentsRepository`), tipos (`StudentPersistenceModel`), enums (`StudentStatus`).
- **camelCase** para funções (`createStudentsContainer`), variáveis (`studentEmail`), parâmetros, propriedades de objeto.
- **SCREAMING_SNAKE_CASE** apenas para constantes globais imutáveis de configuração (`MAX_STUDENT_NAME_LENGTH`).


**Justificativa:** É a convenção do TypeScript handbook oficial e da Microsoft. Manter consistência com o ecossistema reduz fricção pra qualquer dev novo no projeto e evita debates estéticos.


### LAW-007.3 — Interfaces não usam prefixo `I`


**Regra:** Interfaces em TypeScript **não** levam prefixo `I` (`StudentsRepository`, não `IStudentsRepository`). A implementação concreta usa um nome qualificado pela tecnologia (`PrismaStudentsRepository`, `InMemoryStudentsRepository`), conforme LAW-004.4.


**Justificativa:** É a convenção oficial do TypeScript (documentada no handbook e nas guidelines da Microsoft) e é o estilo idiomático do ecossistema. O prefixo `I` é herança de C#/Hungarian notation; em TypeScript ele apenas duplica o que o sistema de tipos já comunica. Quando há colisão de nome entre interface e classe (ambas se chamariam `StudentsRepository`), a regra LAW-004.4 resolve: a interface fica com o nome curto (no domain), a implementação ganha o prefixo da tecnologia.


### LAW-007.4 — Pasta-por-unidade com `index.ts` como ponto de entrada


**Regra:** Cada **unidade** de código — entity, value object, use case, controller, repository, adapter, evento, erro — é uma **pasta** contendo um `index.ts` que exporta a unidade. Arquivos auxiliares (tipos, erros locais, testes, mappers) ficam ao lado do `index.ts` na mesma pasta.


```
entities/student/
├── index.ts          # export class Student
├── types.ts          # tipos auxiliares: StudentId, StudentStatus
└── index.test.ts     # testes (LAW-007.10)


use-cases/enroll-student/
├── index.ts          # export class EnrollStudentUseCase
├── types.ts          # EnrollStudentInput, EnrollStudentOutput
├── errors.ts         # (opcional) erros específicos
└── index.test.ts
```


Arquivos soltos no estilo `student.ts` + `student.types.ts` + `student.test.ts` no mesmo nível são **proibidos**.


**Justificativa:** Pasta-por-unidade torna a estrutura previsível e permite que ferramentas (incluindo LLMs com budget de tokens curto) leiam apenas `index.ts` quando querem o contrato, ou apenas `types.ts` quando querem a forma. Também evita o ruído visual de múltiplos arquivos com o mesmo prefixo numa pasta pai. A única exceção desta lei é a composition (LAW-006.12).


### LAW-007.5 — Nome da pasta = conceito; nome da classe = conceito + papel


**Regra:** A pasta nomeia o conceito em kebab-case; a classe dentro dela nomeia o conceito + sufixo de papel:


| Pasta | Classe / símbolo exportado |
|-------|---------------------------|
| `entities/student/` | `Student` |
| `value-objects/student-email/` | `StudentEmail` |
| `repositories/students-repository/` | `StudentsRepository` (interface) |
| `repositories/prisma-students-repository/` | `PrismaStudentsRepository` (classe) |
| `use-cases/enroll-student/` | `EnrollStudentUseCase` |
| `controllers/create-student-controller/` | `CreateStudentController` |
| `events/student-activated/` | `StudentActivated` |
| `errors/student-not-found/` | `StudentNotFoundError` |
| `adapters/system-clock/` | `SystemClock` (implementa `Clock`) |
| `event-handlers/on-enrollment-created-create-payment/` | `OnEnrollmentCreatedCreatePayment` |


**Justificativa:** O sufixo de papel (`UseCase`, `Controller`, `Repository`, `Error`) deixa o tipo da unidade óbvio em qualquer ponto do código onde a classe é importada, mesmo longe da pasta. Sem o sufixo, `import { Student }` é ambíguo (entity? VO? DTO?); com o sufixo, `import { CreateStudentUseCase }` é inequívoco.


**Exceção:** entities e value objects **não** levam sufixo. `Student`, não `StudentEntity`; `StudentEmail`, não `StudentEmailVO`. O sufixo só aparece em construções arquiteturais (use case, controller, repository, error) — entities e VOs são vocabulário do negócio, e o vocabulário do negócio não fala "entity" nem "VO".


### LAW-007.6 — Tipos auxiliares vivem em `types.ts`; nunca como arquivos separados


**Regra:** Quando uma unidade precisa expor tipos auxiliares (DTOs de Input/Output, IDs tipados, modelos de persistência, status enums), eles vivem em `types.ts` ao lado do `index.ts`. Arquivos como `student-input.ts`, `student-output.ts`, `student.dto.ts` são **proibidos**.


**Justificativa:** Tipos auxiliares são parte do contrato da unidade; separá-los em arquivos individuais por tipo gera proliferação sem ganho. `types.ts` único permite leitura rápida do contrato completo da unidade em uma janela.


**Exemplo certo:**
```ts
// use-cases/enroll-student/types.ts
export type EnrollStudentInput = {
  readonly studentId: string
  readonly courseId: string
}


export type EnrollStudentOutput = {
  readonly enrollmentId: string
  readonly enrolledAt: string
}
```


### LAW-007.7 — Erros locais vivem em `errors.ts`; erros compartilhados em `domain/errors/`


**Regra:** Quando um erro é específico de uma única unidade (lançado apenas por aquele use case ou pelo construtor de uma única VO), ele vive em `errors.ts` na pasta da unidade. Quando um erro é parte do vocabulário do módulo (lançado por múltiplas unidades, mapeado pelo error handler de presentation), ele vive em `domain/errors/<nome-do-erro>/index.ts` como sua própria unidade.


**Justificativa:** Erros que fazem parte do contrato público do módulo (LAW-002.7, LAW-005.7) precisam ser importáveis individualmente e mapeados pelo error handler — merecem ser unidades próprias. Erros locais a uma unidade (ex: erro de parse interno, condição rara que nunca é exposta) podem coexistir no `errors.ts` da própria unidade sem inflar `domain/errors/`.


**Critério prático:** se o erro aparece no `index.ts` do módulo (LAW-006.9) ou no mapa do error handler (LAW-005.7), ele é unidade própria em `domain/errors/`. Se não, pode viver em `errors.ts` local.


### LAW-007.8 — Imports usam alias `@/`, nunca caminhos relativos longos


**Regra:** Imports entre pastas distantes usam o alias do projeto (`@/modules/students/domain/entities/student`). Caminhos relativos com `../` que cruzam mais de **um nível de pasta** são **proibidos**.


**Permitido:** caminho relativo dentro da mesma unidade (`./types`, `./errors`, `./mapper`) — esses são **arquivos irmãos** dentro da pasta-por-unidade e o relativo é mais legível que o alias completo.


**Proibido:** `../../value-objects/student-email`, `../../../shared/clock`. Sempre `@/modules/students/domain/value-objects/student-email`.


**Justificativa:** Caminhos com `../../../` quebram em todo refator, são ilegíveis em revisão de código e tornam impossível mover pastas sem busca-e-substituição manual. O alias é estável e diz exatamente onde a coisa vive na árvore. Caminhos relativos dentro da unidade são curtos, legíveis e não quebram em refator (a pasta inteira move junto).


**Exemplo certo:**
```ts
// use-cases/enroll-student/index.ts
import type { EnrollStudentInput, EnrollStudentOutput } from './types' // mesmo diretório, OK
import { EnrollmentClosedError } from './errors' // mesmo diretório, OK


import type { StudentsRepository } from '@/modules/students/domain/repositories/students-repository'
import { StudentId } from '@/modules/students/domain/entities/student/types'
import { StudentNotFoundError } from '@/modules/students/domain/errors/student-not-found'
```


### LAW-007.9 — Barrels só existem no `index.ts` público do módulo


**Regra:** O **único** arquivo do módulo cujo papel é reexportar conteúdo de várias subpastas é `src/modules/<nome>/index.ts` (LAW-006.9). Barrels intermediários — `domain/index.ts`, `entities/index.ts`, `use-cases/index.ts` — são **proibidos**.


Os `index.ts` em pastas-por-unidade (`entities/student/index.ts`) **não são barrels** no sentido proibido: eles exportam **uma única unidade** (a classe `Student`) e cumprem o papel de ponto de entrada da unidade.


**Justificativa:** Barrels intermediários são conhecidos por:
- Gerar **ciclos de importação** em projetos médios (`A` importa de `domain/index.ts`, que reexporta `B`, que importa de `domain/index.ts` de novo).
- Quebrar **tree-shaking** e inflar o bundle final.
- Causar **lentidão em type-checking** porque o TypeScript precisa resolver toda a árvore reexportada.
- Esconder dependências reais — fica impossível saber, lendo o import, qual arquivo concreto está sendo usado.


O ganho — imports ligeiramente mais curtos — não compensa. O alias `@/` já resolve o problema de legibilidade.


### LAW-007.10 — Testes co-localizados em `index.test.ts` dentro da pasta da unidade


**Regra:** Testes vivem **na mesma pasta da unidade testada**, em arquivo `index.test.ts`. Quando uma unidade tem múltiplos arquivos de teste (raro, mas legítimo para use cases complexos), nomes adicionais usam o padrão `<aspecto>.test.ts` (`integration.test.ts`, `errors.test.ts`).


```
use-cases/enroll-student/
├── index.ts
├── types.ts
├── errors.ts
└── index.test.ts
```


Pastas paralelas (`tests/modules/students/...`) ou diretórios `__tests__/` separados são **proibidos**.


**Justificativa:** Co-localização é prática mainstream em TypeScript moderno (Vitest default, Jest com `testMatch` co-located, NestJS, Next.js). Testes ficam visíveis ao lado do código, refator move teste junto, e a estrutura é consistente com a convenção pasta-por-unidade. Diretórios paralelos `tests/` foram a norma na era CommonJS, mas geram dois caminhos para a mesma coisa e divergem em refator.


### LAW-007.11 — Nomes em verbo no presente para use cases e controllers; pretérito para eventos


**Regra:** Nomes refletem o tempo verbal correto:


- **Use cases** e **controllers**: verbo no infinitivo/presente, indicando intenção (`CreateStudent`, `EnrollStudent`, `SuspendStudent`, `CancelEnrollment`).
- **Eventos** (domain e integration): verbo no **pretérito**, indicando que algo já aconteceu (`StudentCreated`, `EnrollmentCancelled`, `StudentActivated`).
- **Event handlers**: prefixo `On` + nome do evento + ação (`OnEnrollmentCreatedCreatePayment`, `OnStudentSuspendedNotifyAdmins`).


**Justificativa:** É a convenção universal em DDD desde Evans. O tempo verbal é semântica: use case **vai fazer**, evento **já aconteceu**. Misturar (ex: `CreateStudent` como nome de evento) é fonte sutil de confusão em revisões de código e em qualquer pipeline de auditoria automatizada.


### LAW-007.12 — Plural para coleções (repositórios), singular para a unidade


**Regra:** Repositórios e suas tabelas de dados usam **plural** (`StudentsRepository`, `students/`, tabela `students`). Entities e VOs individuais usam **singular** (`Student`, `entities/student/`, `StudentEmail`, `value-objects/student-email/`). Use cases e controllers refletem o agente da ação no singular (`CreateStudent`, não `CreateStudents` — exceto se o use case genuinamente cria múltiplos, ex: `BulkImportStudents`).


**Justificativa:** Repositório é uma coleção de entities; o nome reflete isso. Entity é uma instância; o nome reflete isso. É a convenção de Evans (Repository é "uma coleção em memória" no DDD original) e elimina ambiguidade visual ao escanear pastas.


## Sumário executivo


| # | Regra | Consequência da violação |
|---|-------|--------------------------|
| 1 | Arquivos e pastas em kebab-case | Bugs em CI Linux, inconsistência |
| 2 | PascalCase para classes/interfaces/tipos; camelCase para funções/variáveis | Convenção quebrada, fricção pra novos devs |
| 3 | Interfaces sem prefixo `I` | Hungarian notation desnecessária, fora do idioma TS |
| 4 | Pasta-por-unidade com `index.ts` como ponto de entrada | Estrutura imprevisível, leitura cara |
| 5 | Pasta = conceito, classe = conceito + sufixo de papel | Imports ambíguos, papel da unidade obscuro |
| 6 | Tipos auxiliares em `types.ts` único | Proliferação de arquivos, contrato fragmentado |
| 7 | Erros públicos em `domain/errors/`; erros locais em `errors.ts` | Hierarquia de erros bagunçada |
| 8 | Imports usam alias `@/`; relativos só dentro da unidade | Caminhos quebrados em refator, ilegibilidade |
| 9 | Barrels só no `index.ts` público do módulo | Ciclos de import, tree-shaking quebrado |
| 10 | Testes co-localizados em `index.test.ts` | Estrutura espelhada divergente, refator incompleto |
| 11 | Use cases no presente, eventos no pretérito, handlers `On...` | Semântica verbal trocada, confusão em auditoria |
| 12 | Repositórios no plural, entities no singular | Convenção DDD quebrada, ambiguidade visual |


## Referências


- TypeScript Team, *TypeScript Handbook — Naming Conventions*. https://www.typescriptlang.org/docs/handbook/declaration-files/do-s-and-don-ts.html
- Microsoft, *TypeScript Coding Guidelines* (interface sem prefixo `I`). https://github.com/microsoft/TypeScript/wiki/Coding-guidelines
- Eric Evans, *Domain-Driven Design* (2003), capítulos sobre Ubiquitous Language e Repositories.
- Vaughn Vernon, *Implementing Domain-Driven Design* (2013), nomenclatura de eventos e agregados.
- Kamil Grzybek, `modular-monolith-with-ddd`, organização de arquivos por módulo. https://github.com/kgrzybek/modular-monolith-with-ddd
- Vitest, *Co-locating tests*. https://vitest.dev/guide/
- Tomek Sułkowski, *Why I no longer use barrel files*. https://tkdodo.eu/blog/please-stop-using-barrel-files

