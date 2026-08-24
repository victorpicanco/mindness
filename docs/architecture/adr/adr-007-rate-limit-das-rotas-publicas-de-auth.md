# ADR-007 — Rate limit das rotas públicas de `/auth/*` e a categoria de erro 429

- **Status:** aceito
- **Data:** 2026-08-24
- **Decisores:** Mindness

## Contexto

Até aqui, a única barreira contra tentativa repetida de login, cadastro e envio de e-mail era o rate limit interno do Supabase. Duas consequências práticas apareceram na revisão dos fluxos de autenticação:

1. O `apps/api` não tinha nenhuma defesa própria. Qualquer consumidor podia varrer `/auth/sign-in` até esgotar a cota do projeto Supabase inteiro — que é global, não por IP —, degradando o serviço para todos os usuários do beta.
2. Quando o Supabase enfim respondia `over_request_rate_limit`, o `SupabaseAuthIdentityProviderAdapter` não conhecia esse código e caía no fallback `invalid_credentials`. O usuário legítimo, barrado por excesso de tentativas, lia **"E-mail ou senha incorretos"** — uma mensagem falsa que o levava a tentar de novo, agravando o problema.

Corrigir (2) exige um erro com status 429. A lista de categorias semânticas de LAW-009.4 (`NotFoundError` 404, `ConflictError` 409, `ValidationError` 400, `UnauthorizedError` 401, `ForbiddenError` 403, `UnprocessableError` 422) não tem equivalente — a própria lei descreve as categorias como "poucas e estáveis (raro adicionar nova)", sem declarar a lista fechada.

## Decisão

**Categoria nova.** `shared/errors/categories/too-many-requests-error/` declara `TooManyRequestsError extends ApplicationError` com `httpStatus = 429`. Ela segue exatamente a forma das outras seis: abstrata, sem `code` próprio, só fixando o status. `accounts.RATE_LIMITED` é o primeiro erro concreto a herdar dela.

A fonte é `ApplicationError` — e não `DomainError` — porque estar acima do limite não viola nenhum invariante de negócio do módulo `accounts`; é uma decisão de orquestração sobre o volume de requisições, o mesmo raciocínio que já coloca `UnauthorizedError` e `ForbiddenError` em `ApplicationError`.

**Plugin.** `@fastify/rate-limit` registrado em `accounts/presentation/middleware/auth-rate-limit/`, com `global: false`. Só as rotas públicas optam por ele via `config: { rateLimit: {} }`: `sign-up`, `sign-in`, `refresh`, `email/confirm`, `email/resend`, `password/recovery` e `google` (start). Rotas autenticadas ficam de fora — elas já exigem um JWT válido, e um limite por IP ali penalizaria usuários atrás de NAT.

O `errorResponseBuilder` devolve uma instância de `RateLimitedError`. O plugin lança o que esse builder retorna, então o erro chega ao `registerErrorHandler` compartilhado como qualquer `BaseError` — o envelope `{ error: { code, message, issues, requestId } }` continua tendo um dono só. Sem essa escolha, o plugin responderia com o payload próprio dele e teríamos dois formatos de erro na mesma API.

**Store em memória.** `max` e `timeWindow` vêm de `AUTH_RATE_LIMIT_MAX` e `AUTH_RATE_LIMIT_WINDOW_MS` (padrão: 20 requisições por minuto, por IP). O store é o padrão do plugin: memória do processo.

## Consequências

- **O limite é por instância, não por cluster.** Com N instâncias atrás de um balanceador, o teto efetivo é `N × AUTH_RATE_LIMIT_MAX`. Para o beta (100 contas, instância única) isso é suficiente e evita introduzir o Redis como dependência de disponibilidade do caminho de login — hoje o Redis só serve à fila de análise, e uma falha dele não derruba a autenticação. Quando houver mais de uma instância, trocar para o store Redis do próprio plugin é mudança de uma opção, sem tocar em rota ou erro.
- O container de integração (`integration-container.ts`) fixa `max: 10_000` para que nenhum fluxo de teste esbarre no limite. O comportamento do limite em si é coberto pelo teste unitário de `auth-rate-limit`.
- Qualquer módulo futuro pode herdar de `TooManyRequestsError`. Adicionar uma **oitava** categoria continua exigindo ADR.
- `ERROR_RESPONSES` das rotas de `accounts` passa a declarar 403 e 429, para que a resposta continue batendo com o schema OpenAPI da rota (exigência de LAW-011).

## Alternativas rejeitadas

- **Mapear `over_request_rate_limit` para `ForbiddenError` (403) ou `ValidationError` (400):** evitaria a categoria nova ao custo de mentir sobre a natureza da falha. 429 é o único status que comunica "tente de novo mais tarde", e é o que permite ao cliente diferenciar limite de credencial rejeitada — exatamente a distinção que este ADR existe para criar.
- **Confiar apenas no rate limit do Supabase:** ele é global por projeto. Um atacante consumindo a cota derruba o login de todos os usuários; um limite por IP no `apps/api` contém o dano antes de chegar lá.
- **Store Redis desde já:** acopla o caminho de login à disponibilidade do Redis sem ganho real enquanto houver uma instância só.
- **Limite global (`global: true`) em toda a API:** penalizaria rotas autenticadas de uso legítimo intenso (polling do processamento de sessão, definido no Bloco 11) com um limite desenhado para o fluxo de identidade.
