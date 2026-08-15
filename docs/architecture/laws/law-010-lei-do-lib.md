---
id: LAW-010
title: Lei do Shared
status: canonical
version: 1.1.0
scope: backend-typescript
supersedes: null
tags: [architecture, shared, building-blocks, infrastructure, canonical-law]
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

# Lei do Shared

> Lei canônica que define o que `src/shared/` é, o que pode conter, e — mais importante — o que **não** pode conter. `shared/` é a pasta mais perigosa de qualquer monolito modular: sem disciplina explícita, ela vira o caminho de menor resistência para acoplamento oculto entre módulos. Esta lei existe para impedir esse vetor de degradação arquitetural.

## Definição

`src/shared/` é o conjunto de **building blocks técnicos** consumidos por múltiplos módulos. Cliente Prisma instanciado, logger configurado, classes-base de erro, EventBus in-process, wrappers de bibliotecas externas — coisas que existiriam mesmo se o sistema não tivesse domínio nenhum.

`shared/` é, deliberadamente, **um anti-módulo**:

- Não tem bounded context.
- Não tem linguagem ubíqua.
- Não tem regra de negócio.
- Não segue a estrutura `domain/application/infrastructure/presentation`.
- Não é dono de tabelas no banco.

A Lei do Módulo ([[LAW-001 Lei do Módulo]]) **não se aplica a `shared/`**. Tentar tratar `shared/` como módulo cria "domínios técnicos" artificiais que são pura cerimônia.

## Critério operacional: o que pertence a `shared/`

Um arquivo pertence a `shared/` se, e apenas se, satisfaz **as três condições simultaneamente**:

1. **Não implementa nenhum port** declarado em `<modulo>/domain/ports/` de qualquer módulo.
2. **Não conhece vocabulário** de nenhum bounded context (não menciona `Student`, `Enrollment`, `Course`, etc., nem nas classes, nem nos tipos, nem nos nomes de arquivo).
3. **Poderia ser publicado como pacote npm independente** sem perder utilidade — `@minha-empresa/database-client`, `@minha-empresa/structured-logger` fazem sentido fora do contexto do sistema.

Se o arquivo falha em qualquer um dos três testes, ele **não pertence** a `shared/`. Ele pertence ao módulo cujo vocabulário ele carrega ou cujo port ele implementa.

## Estrutura canônica

```
src/shared/
├── errors/                  # BaseError, categorias semânticas, hierarquia (LAW-009)
│   ├── base-error/
│   ├── domain-error/
│   ├── application-error/
│   ├── infrastructure-error/
│   └── categories/
├── database/                # PrismaClient singleton, helpers de transação
│   ├── prisma-client/
│   └── unit-of-work/
├── messaging/               # EventBus in-process, IntegrationEvent base type
│   ├── event-bus/
│   └── integration-event/
├── logger/                  # logger configurado, tipos de structured log
│   └── pino-logger/
├── http/                    # clientes HTTP base configurados
│   └── http-client/
├── id/                      # geradores de ID (UUID/ULID)
│   └── uuid-generator/
├── time/                    # Clock real e mock para testes
│   └── system-clock/
├── crypto/                  # hashing, signing, primitivas
│   └── bcrypt-hasher/
└── types/                   # tipos utilitários TS (Result, Brand, DeepReadonly)
    ├── result/
    ├── brand/
    └── deep-readonly/
```

**Estas 9 subpastas formam um conjunto fechado.** Adicionar uma nova exige justificativa documentada (PR description ou ADR) provando que (a) há mais de um módulo precisando do mesmo building block, (b) ele passa nos três testes do critério operacional, (c) não cabe em nenhuma subpasta existente.

## Regras

### LAW-010.1 — `shared/` é anti-módulo; a Lei do Módulo não se aplica

**Regra:** `shared/` não segue a estrutura interna de módulo (`domain/`, `application/`, `infrastructure/`, `presentation/`, `composition/`). Sua estrutura é **plana e funcional**: subpastas por categoria técnica, cada uma contendo unidades autônomas.

**Proibido:**
- Criar `shared/<x>/domain/`, `shared/<x>/application/` ou similares.
- Tratar `shared/` como bounded context.
- Aplicar regras de comunicação entre módulos (LAW-008) ao consumo de `shared/`.

**Justificativa:** `shared/` existe **precisamente porque** seu conteúdo não tem domínio. Impor camadas em código sem domínio força você a inventar conceitos artificiais ("o domínio do logger", "a application layer do clock") que adicionam ruído sem ganho. A simplicidade plana é uma escolha arquitetural deliberada.

### LAW-010.2 — Conteúdo de `shared/` passa simultaneamente nos três testes do critério operacional

**Regra:** Antes de adicionar qualquer arquivo a `shared/`, verifica-se:

1. Não implementa port declarado em `<modulo>/domain/ports/`?
2. Não conhece vocabulário de bounded context?
3. Poderia ser publicado como pacote npm e ainda fazer sentido?

Se qualquer resposta for "não", o arquivo **não pertence** a `shared/`.

**Exemplo de aplicação:**

| Candidato | Teste 1 (port?) | Teste 2 (domain?) | Teste 3 (npm?) | Pertence? |
|-----------|----------------|-------------------|----------------|-----------|
| `PrismaClient` singleton | ✅ não implementa port | ✅ sem domínio | ✅ "@x/db-client" faria sentido | **Sim** |
| `BaseError`, `NotFoundError` | ✅ não implementa port | ✅ sem domínio | ✅ "@x/errors" faria sentido | **Sim** |
| `EventBus` (interface técnica) | ✅ é base, não implementação | ✅ sem domínio | ✅ "@x/event-bus" faria sentido | **Sim** |
| `WelcomeEmailSender` | ❌ implementa port de students | ❌ "Welcome" carrega contexto | ❌ não independente | **Não** — vai para `students/infrastructure/adapters/` |
| `StudentValidator` | ✅ talvez não implemente port | ❌ menciona Student | ❌ específico do sistema | **Não** — vai para `students/domain/` |
| `MoneyValueObject` | ✅ não implementa port | 🟡 depende — se múltiplos módulos usam Money como conceito de domínio | 🟡 marginal | **Caso a caso** — ver LAW-010.6 |

**Justificativa:** O critério é o que separa `shared/` saudável de `shared/` apodrecido. Sem teste explícito, "compartilhado" vira sinônimo de "qualquer coisa que parece reutilizável" — caminho mais curto pra big ball of mud.

### LAW-010.3 — `shared/` nunca importa de `modules/`

**Regra:** Nenhum arquivo em `src/shared/` pode importar de `src/modules/`. A direção é inviolável: `modules/` consomem `shared/`, nunca o contrário.

**Justificativa:** `shared/` é a base. Depender de módulos cria ciclo de dependência conceitual e quebra todos os três testes do critério operacional simultaneamente — `shared/` deixaria de ser publicável e passaria a conhecer vocabulário de domínio.

Esta é uma das regras mais auditáveis: `grep -r "from '@/modules" src/shared/` deve retornar zero resultados. Qualquer match é violação.

### LAW-010.4 — Domínio de módulo importa apenas tipos e classes-base de `shared/`

**Regra:** Arquivos em `<modulo>/domain/` podem importar de `shared/` **apenas**:

- **Tipos utilitários** de `shared/types/` (`Result<T,E>`, `Brand<T>`, `DeepReadonly<T>`).
- **Classes-base de erro** de `shared/errors/` (`BaseError`, `DomainError`, `NotFoundError`, etc.).
- **Tipos** (não implementações) de `shared/messaging/integration-event/` (a interface `IntegrationEvent`).

**Proibido em `domain/`:**
- Importar `PrismaClient`, `pino`, `axios`, `bcrypt`, ou qualquer wrapper concreto de `shared/`.
- Importar instâncias singleton (`prismaClient`, `eventBus`).

**Justificativa:** O domain é o núcleo puro. Importar tipo utilitário (`Result<T,E>`) ou classe-base de erro não compromete a pureza — esses são primitivos de modelagem, não tecnologias. Importar wrapper concreto de tecnologia quebra [[LAW-002 Lei da Camada Domain]] regra 1.

### LAW-010.5 — Application de módulo importa de `shared/` o mesmo que `domain/`, mais bases de aplicação

**Regra:** Arquivos em `<modulo>/application/` podem importar de `shared/` tudo que `domain/` pode, **mais**:

- Classes-base de `ApplicationError` e `ValidationError`.
- Tipo de `IntegrationEvent` (para handlers que reagem a eventos de outros módulos).

**Proibido em `application/`:** importar implementações concretas (`PrismaClient`, `httpClient`). Implementações são consumidas via ports injetados, não importadas diretamente.

**Justificativa:** Application orquestra usando ports declarados no domain. Wrappers concretos só aparecem em infrastructure (que injeta no use case via composition root). Esta regra mantém a Regra da Dependência intacta.

### LAW-010.6 — Infrastructure de módulo é o consumidor primário de `shared/`

**Regra:** Arquivos em `<modulo>/infrastructure/` podem importar livremente de `shared/`. É a única camada do módulo onde wrappers concretos de `shared/` aparecem.

**Casos canônicos:**
- `infrastructure/repositories/prisma-*-repository/` consome `PrismaClient` de `shared/database/`.
- `infrastructure/adapters/*-adapter/` consome `httpClient`, `logger`, `clock` de `shared/`.
- `infrastructure/messaging/` consome `eventBus` de `shared/messaging/`.

**Justificativa:** Infrastructure é a camada de tradução tecnologia↔domínio. Consumir wrappers técnicos compartilhados é seu trabalho normal — sem isso, cada módulo reinstanciaria seu próprio `PrismaClient`, com pool de conexões próprio, custo desnecessário.

### LAW-010.7 — `shared/` nunca implementa ports de domain de módulo

**Regra:** Arquivos em `shared/` não implementam interfaces declaradas em `<modulo>/domain/ports/`. Implementação de port mora em `<modulo>/infrastructure/adapters/`.

**Caso comum confundido:** "mas o `EventBus` é uma interface, e a implementação dele em `shared/messaging/event-bus/in-memory-event-bus.ts` parece implementar um port".

**Resolução:** o `EventBus` definido em `shared/messaging/integration-event/` é uma **interface técnica neutra** (`publish`, `subscribe`), sem vocabulário de bounded context. Cada módulo que usa eventos declara seu próprio port `EventBus` em `<modulo>/domain/ports/event-bus/` que tem **a mesma assinatura técnica** — coincidência intencional. A composition root injeta a mesma instância concreta de `shared/messaging/in-memory-event-bus/` em todos os ports.

Isso não viola a regra porque o adapter "implementador" (`InMemoryEventBus` em `shared/`) **não foi escrito para implementar** o port de algum módulo específico — ele é uma utilidade técnica genérica que **acidentalmente satisfaz** ports técnicos genericamente equivalentes. Diferente de `WelcomeEmailSender`, que **só faz sentido** como implementação do port de `students`.

**Critério prático:** se a implementação concreta tem nome de tecnologia (`InMemoryEventBus`, `PinoLogger`, `BcryptHasher`), pode estar em `shared/`. Se tem nome de intenção de domínio (`WelcomeEmailSender`, `StudentNotifier`), pertence ao módulo.

**Justificativa:** Esta é a regra mais sutil de `shared/` e a mais facilmente violada. A intuição "isso é genérico, vai pra shared" leva à proliferação de implementações que tecnicamente parecem agnósticas mas carregam conceitos de domínio nos nomes/tipos. O teste do nome (tecnologia vs intenção) é a heurística que separa os dois casos.

### LAW-010.8 — Sem regra de negócio em `shared/`

**Regra:** Nenhum arquivo em `shared/` contém validação de invariante de negócio, decisão de domínio, cálculo específico de regra do sistema, ou texto de mensagem de erro orientado ao usuário final.

**Sinais de violação:**
- `shared/validators/email-validator.ts` que valida formato + checa "domínio permitido" segundo regra interna do sistema → vai para o módulo dono da regra.
- `shared/utils/calculate-discount.ts` → cálculo de negócio, vai para domínio do módulo.
- `shared/messages/error-messages.pt-br.ts` com strings tipo "Aluno menor de idade não pode se matricular" → mensagem de domínio, vai para o módulo.

**Justificativa:** Regra de negócio em `shared/` é o pior tipo de bug arquitetural — fica invisível para quem lê o módulo, escapa de auditoria de bounded context, e bloqueia a evolução independente dos módulos. A regra é absoluta: `shared/` é técnico, e técnico apenas.

### LAW-010.9 — Estrutura plana dentro das subpastas

**Regra:** Cada subpasta de `shared/` segue a convenção pasta-por-unidade com `index.ts` (ver [[LAW-007 Lei de Nomenclatura e Organização de Arquivos]]). **Não** se cria sub-camadas internas (`shared/database/domain/`, `shared/logger/application/`).

**Exemplo certo:**
```
shared/database/
├── prisma-client/
│   ├── index.ts          # singleton + factory
│   └── types.ts          # tipos auxiliares
└── unit-of-work/
    └── index.ts
```

**Exemplo errado:**
```
shared/database/
├── domain/               # VIOLAÇÃO — sem domínio em shared
│   └── interfaces/
├── application/          # VIOLAÇÃO
└── infrastructure/       # VIOLAÇÃO
```

**Justificativa:** Estrutura plana reflete a natureza não-camadeada de `shared/`. Sub-camadas seriam cerimônia sem ganho — não há regra de dependência interna a enforce porque não há domínio.

### LAW-010.10 — Singletons de `shared/` são instanciados na composition root, nunca em escopo de módulo

**Regra:** Recursos compartilhados que precisam ser singleton (`PrismaClient`, `EventBus`, `Logger`) são instanciados **uma única vez** no bootstrap da aplicação (composition root principal) e injetados nos containers dos módulos.

**Proibido:**
- `import { prismaClient } from '@/shared/database/prisma-client'` em código de módulo (singleton importado globalmente).
- Cada módulo instanciar seu próprio `PrismaClient`.

**Certo:** `shared/database/prisma-client/index.ts` exporta uma **factory** (`createPrismaClient(config)`); o bootstrap chama uma vez e passa a instância pra cada `createXContainer(deps)`.

**Justificativa:** Singletons globais via import quebram testabilidade (impossível swap em testes) e escondem dependências (nada na assinatura do use case denuncia que ele depende do banco). Instanciação na composition root mantém DI explícita e permite swap por mocks/stubs em testes de integração.

Detalhes de composition root vivem em [[LAW-006 Lei da Composition Root]].

### LAW-010.11 — Mudanças quebráveis em `shared/` são tratadas como mudança no contrato de todos os módulos

**Regra:** Modificações em `shared/` que quebram contrato (renomear classe/função pública, remover método, mudar assinatura, mudar comportamento documentado) são **breaking changes** que afetam todo o sistema. Tais mudanças seguem fluxo aditivo:

1. Adicionar a nova versão (`BaseErrorV2`, `createPrismaClientV2`).
2. Marcar a antiga como deprecada (`@deprecated` com instrução de migração).
3. Migrar consumidores um por um.
4. Remover a versão antiga apenas após 100% dos consumidores migrados.

**Justificativa:** `shared/` é dependência transversal — uma quebra simultânea afeta todos os módulos no mesmo PR, criando merge conflicts massivos e rollback inviável. Processo aditivo permite migração incremental e rollback granular se algo der errado.

**Nota pragmática:** em projetos pequenos com poucos módulos, essa regra parece overkill. À medida que o sistema cresce, ela se torna salvavidas. Adotá-la cedo evita a dor de descobri-la tarde.

### LAW-010.12 — Cada subpasta de `shared/` tem responsabilidade única e documentada

**Regra:** Cada subpasta de `shared/` (errors, database, messaging, logger, http, id, time, crypto, types) tem **uma responsabilidade técnica única**, documentada em um `README.md` na raiz da subpasta.

**Estrutura mínima do README:**

```markdown
# shared/<categoria>

## Responsabilidade
<uma frase descrevendo o building block técnico>

## O que vai aqui
- Lista de tipos de coisa que entram

## O que NÃO vai aqui
- Lista explícita de coisas comumente confundidas, com redirecionamento
```

**Justificativa:** Sem documentação explícita, "shared/database" eventualmente acumula coisas que pareciam de banco mas eram de outro lugar. README opera como gate cognitivo no momento do PR: "isso é mesmo `shared/database`? lê o README primeiro".

### LAW-010.13 — Qualquer adição a `shared/` exige justificativa de pelo menos dois consumidores

**Regra:** Adicionar um novo arquivo a `shared/` exige que **pelo menos dois módulos** já o precisem (ou estejam claramente prestes a precisar). "Vai ser útil no futuro" não é justificativa.

**Aplicação:** se apenas um módulo usa, o código vive **dentro do módulo**. Quando o segundo módulo precisar, refatora-se: extrai pra `shared/` no mesmo PR que adiciona o segundo consumidor.

**Justificativa:** Premature sharing é uma das principais formas de poluir `shared/`. "Vou já colocar em shared porque algum dia outro módulo vai usar" é como cria-se utilities órfãos, código morto, e API genérica demais que serve mal a todos. A regra de dois consumidores é a versão arquitetural do "Rule of Three" de Martin Fowler para refactoring: extrair só quando o padrão real emerge.

### LAW-010.14 — Exceções ao teste #2 são nomeadas, verificadas por lint e documentadas em ADR

**Regra:** Um conjunto de arquivos que falha **apenas no teste #2** (conhece vocabulário de bounded context) mas passa nos testes #1 (não implementa port) e #3 (motor genérico e publicável) pode permanecer no anti-módulo **somente** se:

1. For registrado em ADR próprio, com a alternativa de conformação avaliada e rejeitada com justificativa técnica.
2. Permanecer **puramente apresentacional / técnico**: recebe apenas primitivos e DTOs planos, nunca entities, VOs ou tipos de ORM, e não contém regra de negócio (LAW-010.8 continua absoluta).
3. Tiver **guard-rail executável no CI** — tipicamente `no-restricted-imports` barrando `@/modules/*` e `@prisma/client` na pasta — de modo que a exceção quebre automaticamente no dia em que um arquivo tentar puxar vocabulário de módulo.

Sem os três, não há exceção: o arquivo vai para o módulo dono.

**Caso canônico registrado:** `src/lib/mail/templates/` — templates de e-mail nomeados por conceito de negócio (`student-welcome`, `payout-completed`), funções puras `build<X>Email(params): EmailMessage` que só recebem primitivos. O motor (`lib/mail/render/`, `lib/mail/resend/`) passa nos três testes normalmente; apenas os templates falham no teste #2, e a centralização (identidade visual única, `escapeHtml` central, um só cliente Resend) tem valor real. Ver ADR-0001 no repositório (`docs/adr/0001-templates-email-em-lib-mail.md`).

**Justificativa:** O perigo do anti-módulo não é o *nome* carregar vocabulário — é a *regra de negócio* escondida ali. Quando o conteúdo é comprovadamente apresentacional e o vetor de contrabando está fechado por lint, mover pelo módulo custa muito (redesenho de port, N consumidores reescritos, identidade visual espalhada) sem reduzir o risco que a lei protege. A exceção nomeada + verificada é mais honesta que uma violação silenciosa ou um refactor cerimonial.

## Sumário executivo

| # | Regra | Consequência da violação |
|---|-------|--------------------------|
| 1 | `shared/` é anti-módulo; sem `domain/application/infrastructure/` interno | Cerimônia sem ganho, "domínios técnicos" artificiais |
| 2 | Conteúdo passa nos três testes (não-port, não-domínio, npm-publishable) | `shared/` vira lixeira |
| 3 | `shared/` nunca importa de `modules/` | Ciclo de dependência, quebra dos três testes |
| 4 | Domain importa só tipos utilitários e classes-base de erro | Pureza do domain comprometida |
| 5 | Application importa o mesmo que domain + bases de aplicação | Wrappers concretos onde não devem estar |
| 6 | Infrastructure é o consumidor primário | (regra permissiva, sem violação por ela) |
| 7 | `shared/` não implementa ports de domain de módulo | Vocabulário de bounded context vazando |
| 8 | Sem regra de negócio em `shared/` | Lógica invisível, escapa de auditoria |
| 9 | Estrutura plana dentro das subpastas | Sub-camadas artificiais sem domínio |
| 10 | Singletons instanciados na composition root, não importados globalmente | Testabilidade morta, DI implícita |
| 11 | Mudanças quebráveis tratadas como breaking change global | Merge conflicts massivos, rollback inviável |
| 12 | Cada subpasta tem README de responsabilidade | Categoria vira saco-de-gato |
| 13 | Adição exige dois consumidores reais | Premature sharing, utilities órfãos |
| 14 | Exceção ao teste #2 exige ADR + puramente apresentacional + guard-rail de lint | Exceção vira rota de contrabando de regra de negócio |

## Referências

- Eric Evans, *Domain-Driven Design* (2003), capítulo sobre Shared Kernel.
- Vaughn Vernon, *Implementing Domain-Driven Design* (2013), Shared Kernel e Anti-Corruption Layer.
- Kamil Grzybek, *Modular Monolith: A Primer* — sobre Building Blocks. https://www.kamilgrzybek.com/blog/posts/modular-monolith-primer
- Kamil Grzybek, `modular-monolith-with-ddd` — pasta `BuildingBlocks/`. https://github.com/kgrzybek/modular-monolith-with-ddd
- Mark Seemann, *Dependency Injection Principles, Practices, and Patterns* (2019), Composition Root.
- Martin Fowler, *Refactoring* (1999), Rule of Three.
- Mateusz Gajewski (mgce), `modular-monolith-nodejs` — `shared/infrastructure/`. https://github.com/mgce/modular-monolith-nodejs
- Mehmet Ozkaya, *Shared Kernel Pattern in Domain-Driven Design*. https://mehmetozkaya.medium.com/shared-kernel-pattern-in-domain-driven-design-ddd-21cba2a9f92a
