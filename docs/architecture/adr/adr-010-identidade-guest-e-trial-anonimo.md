# ADR-010 — Identidade guest, trial anônimo e limite best-effort por navegador

- **Status:** aceito
- **Data:** 2026-09-10
- **Decisores:** Mindness
- **Estende:** ADR-001 (identidade Supabase e módulo `accounts`), ADR-007 (rate limit das rotas públicas de `/auth/*`)

## Contexto

Até aqui o Mindness só mostrava valor depois do cadastro: `/` exigia sessão, e a primeira coisa que um visitante via era um formulário de login. A decisão de produto de 2026-09-09 inverte isso — a pessoa completa **uma** sessão de prática antes de criar conta.

Isso levanta três perguntas que nenhum ADR anterior responde:

1. Quem é a pessoa que ainda não tem conta, do ponto de vista de autorização, isolamento, consentimento e Storage?
2. O que acontece com o que ela produziu quando ela finalmente cria uma conta?
3. Como limitar o benefício a uma sessão, sabendo que não existe identificador de dispositivo confiável e que o produto rejeitou fingerprinting?

## Decisão

### 1. Guest é uma identidade real, não a ausência de identidade

“Sem conta” é descrição de produto. Internamente, `POST /auth/anonymous` chama `signInAnonymously()` no Supabase e o provisionamento cria uma conta de domínio `kind = guest`, sem e-mail.

A alternativa — um caminho sem identidade, com `accountId` opcional em sessão, áudio e análise — foi rejeitada: ela duplicaria toda a autorização do produto num segundo regime e transformaria `Session.accountId` em `string | null`, contaminando ADR-003 (autorização de áudio por `accountId`) e todo o pipeline. Guest custa uma linha em `accounts` e reaproveita cem por cento das invariantes existentes.

`ADR-001 continua valendo integralmente`: o Supabase segue encapsulado por `apps/api`, o `apps/web` não recebe `@supabase/supabase-js`, e o `accountId` de domínio continua sendo a única chave de autorização. Guest não é exceção a ADR-001 — é mais um valor de `authenticationMethod` dentro dela.

### 2. O discriminador de anonimato vem da claim `amr`, com `is_anonymous` como verificação cruzada

`AuthenticationMethod` ganha `anonymous`, e `VerifiedAuthIdentity.email` passa a aceitar `null`. Anonimato **não** vira um campo próprio: é `authenticationMethod === 'anonymous'`, derivado, para não existirem duas verdades que possam divergir.

`readAuthenticationMethod` continua sendo a única fonte do método e passa a aceitar `amr: [{ method: 'anonymous' }]`. A claim `is_anonymous` é lida apenas para **conferir**: se ela e o método derivado de `amr` discordarem, a identidade é rejeitada como inválida, em vez de o backend escolher um dos dois. `email` só pode ser `null` quando o método é `anonymous`; ausência de e-mail em qualquer outro método continua invalidando a identidade.

Nenhum header, body ou `user_metadata` decide se a identidade é guest.

### 3. O trial não migra

Ao entrar ou criar conta, os cookies de autenticação permanente substituem os anônimos e nada mais acontece. Não existe `linkIdentity()`, reatribuição de `auth_user_id`, atualização de `sessions.account_id`, cópia de análise, movimentação de objeto no Storage ou evento de merge. `enable_manual_linking` fica `false`.

Migrar exigiria resolver conflito entre duas contas (consentimento de versões diferentes, duas sessões ativas, dois planos) num fluxo que a pessoa atravessa em segundos e sem contexto para decidir. O custo de não migrar é uma sessão perdida; o custo de migrar mal é dado de uma pessoa aparecendo na conta de outra.

A interface precisa informar essa consequência antes de sair do contexto guest.

### 4. O limite é best-effort por navegador, e isso é dito em voz alta

“Uma sessão por dispositivo” significa, neste MVP, “uma sessão por perfil de navegador enquanto o cookie `mindness_guest_trial_used` existir”. Apagar cookies, usar aba anônima ou trocar de navegador devolve o trial. Aceito conscientemente.

Fingerprinting, identificação por IP, canvas, hardware, App Attest e Play Integrity estão **fora de escopo** — não por dificuldade técnica, mas porque o produto não quer identificar dispositivos de pessoas que ainda não são clientes.

O cookie é a aproximação de dispositivo; a invariante de consistência é do backend (item 5).

### 5. Uma sessão `guest_trial` por conta guest, garantida por índice único parcial em SQL

`sessions` ganha `access_mode` (`guest_trial | account`), derivado do tipo da conta — nunca do body. A migração faz backfill de `account` em todas as linhas existentes antes de tornar a coluna obrigatória.

A garantia final é um índice único parcial escrito à mão:

```sql
CREATE UNIQUE INDEX sessions_account_id_guest_trial_key
ON sessions (account_id)
WHERE access_mode = 'guest_trial';
```

**Por que SQL e não `previewFeatures = ["partialIndexes"]`.** O Prisma 7.9 já expressa índices parciais declarativamente (`@@unique([accountId], where: { accessMode: 'guest_trial' })`), o que eliminaria a divergência entre schema e banco. A tabela `sessions` já tem `sessions_account_id_active_key` em SQL puro, do Bloco 4. Converter só o índice novo criaria dois estilos na mesma tabela, e converter os dois agora misturaria a mudança de escopo deste bloco com a adoção de uma preview feature. **Dívida registrada:** converter os dois índices de `sessions` para `partialIndexes` de uma vez, em bloco posterior.

O índice não filtra por estado: sessão expirada, abandonada, falha ou deletada continua ocupando o trial. Violação concorrente chega como `P2002` com o nome do índice e é traduzida para `sessions.GUEST_TRIAL_CONSUMED` (403) — mesmo padrão já usado para `sessions_account_id_active_key`.

O nome do erro descreve o que aconteceu, não o que falta fazer: `ACCOUNT_REQUIRED` se confundiria com falha de autenticação (401), enquanto o caso é uma conta guest que já gastou o benefício.

**Ordem no use case.** A consulta que produz o erro semântico roda **antes** de expirar a sessão anterior e antes de sortear o tema. `drawEligibleTheme` publica `ThemePoolLowAlert` como efeito colateral, e um guest já bloqueado não pode emitir alerta de pool nem mutar a própria sessão anterior a caminho de uma rejeição.

### 6. `accounts.email` passa a ser anulável, com `CHECK` no banco

```sql
ALTER TABLE accounts
  ADD CONSTRAINT accounts_email_matches_kind_check
  CHECK ((kind = 'guest' AND email IS NULL) OR (kind = 'registered' AND email IS NOT NULL));
```

O domínio já impede o estado inválido; a restrição existe porque uma escrita concorrente ou um caminho futuro que escape do domínio não pode gravar linha inválida — o mesmo raciocínio que põe o índice do item 5 no banco em vez de confiar só no use case. Postgres permite múltiplos `NULL` num índice único, então vários guests coexistem sob o `UNIQUE` de `email`.

**Não usar e-mail sintético para guests.** Um `guest-<uuid>@invalid` faria o guest passar por todas as verificações escritas para conta permanente sem nunca ser um endereço real, e a primeira tentativa de envio de e-mail descobriria isso em produção.

**Deduplicação.** `CreateAccountUseCase` procura conta existente por `authUserId` e, como segundo caminho, por e-mail. Para identidade anônima o segundo caminho **não existe**: consultar por e-mail nulo casaria a conta de outro guest e devolveria a conta alheia — vazamento entre pessoas. O desvio acontece antes da chamada; a port de leitura por e-mail continua exigindo `string`.

### 7. `/auth/anonymous` entra no rate limit da ADR-007, e o limite do Supabase é capacidade

A rota é pública, protegida por Turnstile, e opta pelo plugin de rate limit (`config: { rateLimit: {} }`) como as demais rotas públicas de `/auth/*`. Ver o adendo em ADR-007.

`[auth.rate_limit] anonymous_users` é contado **por hora e por IP de origem**. Como `apps/api` encapsula o Supabase, todo `signInAnonymously()` sai do IP único do servidor: o valor deixa de ser limite por pessoa e vira o teto de trials por hora do produto inteiro — exatamente o raciocínio que originou a ADR-007. Portanto `anonymous_users = 1000` é **dimensionamento de capacidade**, não defesa; a defesa por pessoa continua sendo Turnstile mais o rate limit por IP da ADR-007, que enxerga o IP real do visitante.

Esgotar o limite do Supabase não pode ser reportado como credencial inválida: o adapter já traduz `over_request_rate_limit` para `accounts.RATE_LIMITED` (429), e o trial **não** é marcado como consumido.

### 8. Sign-in anônimo liga em staging antes de produção

`[auth]` passa a declarar `enable_anonymous_sign_ins = true`, e `[remotes.*]` são overrides sobre a base — mudar `[auth]` ligaria o trial em staging **e** produção no mesmo commit. Como a validação manual do bloco acontece em `dev.mindness.app`, produção recebe override explícito:

```toml
[remotes.production.auth]
enable_anonymous_sign_ins = false
```

Ligar produção é uma mudança de uma linha, deliberada, depois da validação — não um efeito colateral deste commit.

Nenhum workflow em `.github/workflows/` roda `supabase config push`. O push é manual contra cada projeto remoto, e a validação manual confere o valor efetivo antes de a DoD ser considerada cumprida.

## Consequências

- `VerifiedAuthIdentity.email` anulável obriga todo consumidor a tratar a ausência. Os que exigem e-mail (criação de conta permanente, recuperação de senha) passam a rejeitar explicitamente em vez de assumir presença.
- O contrato HTTP do perfil vira união discriminada por `accountKind`, validável sem cast forçado.
- `GET /sessions/theme-categories` sai do escopo de `registerAuthenticatedIdentityGuard` e passa a responder sem JWT. Nenhuma outra rota de sessão muda: tudo que cria, altera ou lê uma sessão específica continua exigindo identidade válida.
- **Identidade órfã.** Se provisionamento, consentimento ou leitura de perfil falhar depois de `POST /auth/anonymous` ter criado o usuário no Supabase, a identidade fica sem conta de domínio. Cada retentativa cunha uma identidade nova. Aceito neste MVP, contido apenas por Turnstile e pelos dois rate limits, sem reaproveitamento — reaproveitar exigiria devolver tokens de uma identidade que o navegador já perdeu. O volume de órfãs entra na observabilidade e é o sinal que dispara o bloco de retenção.
- **Sem limpeza automática.** O Supabase não remove identidades anônimas, e este bloco não apaga guest, áudio ou análise em nenhum momento. Dívida operacional explícita: política de retenção e cleanup em bloco posterior.
- Guest não tem e-mail, então `posthog.identify(email)` não pode ser chamado com valor sintético. Os eventos de servidor da jornada anônima usam o `distinctId` anônimo que o `posthog-js` já gerou no navegador — nunca o `authUserId` do Supabase, que é identificador de identidade externa e não deve sair do backend para um provedor de analytics. A transição para conta permanente emite `alias`, costurando **telemetria**, não dados: a proibição do item 3 continua valendo.

## Alternativas rejeitadas

- **Trial sem identidade, com `accountId` opcional:** ver item 1.
- **`isAnonymous` como campo próprio da identidade:** duas fontes de verdade para o mesmo fato, livres para divergir. O método derivado de `amr` já responde a pergunta.
- **Escolher entre `amr` e `is_anonymous` quando discordam:** discordância entre duas claims do mesmo provider é sinal de token malformado ou de mudança de contrato do Supabase, não de ambiguidade a resolver por heurística. Rejeitar é a única leitura segura.
- **E-mail sintético para guests:** ver item 6.
- **Migrar o trial para a conta permanente:** ver item 3.
- **Fingerprinting ou identificação por IP para tornar o limite resistente:** ver item 4.
- **Confiar só na verificação do use case, sem índice parcial:** duas requisições concorrentes do mesmo guest passariam as duas pela consulta antes de qualquer escrita. O índice é o que fecha a janela.
- **Dimensionar `anonymous_users` como defesa contra abuso:** ele é global por IP de origem, e o IP de origem é o do servidor. Como defesa, ele só consegue derrubar o funil inteiro.

## Referências

- `docs/roadmap/14-trial-anonimo-por-navegador.md` — decisões D-01 a D-10, escopo fechado e casos de borda.
- Supabase Docs — “Anonymous Sign-Ins”, consultado em 2026-09-09.
- Supabase Docs — “Rate Limits” e “Branching: Configuration”, consultados em 2026-09-10.
