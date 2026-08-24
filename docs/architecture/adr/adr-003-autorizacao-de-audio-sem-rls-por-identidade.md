# ADR-003 — Autorização de áudio sem RLS por identidade em `storage.objects`

- **Status:** aceito
- **Data:** 2026-08-18
- **Decisores:** Mindness

## Contexto

O Bloco 4 recebe o primeiro dado sensível vindo de fora: o áudio da apresentação, guardado no Supabase Storage. O PRD (§10, "Autorização de áudio") exige bucket privado, prefixo imutável `<account-id>/<session-id>` e políticas de `storage.objects` que validem bucket, identidade e prefixo em toda operação; a emissão de URL de upload e de download é sempre feita pelo backend, após autorizar a sessão ou confirmar a posse.

A documentação oficial da Supabase recomenda, para esse cenário, uma política de RLS em `storage.objects` que compara o primeiro segmento do caminho do objeto com `auth.uid()` (`(storage.foldername(name))[1] = auth.uid()::text`). Esse padrão só funciona se o prefixo do objeto for o `authUserId` emitido pelo Supabase Auth — porque é o único identificador que `auth.uid()` consegue enxergar dentro de uma política SQL.

A ADR-001 já decidiu o oposto para as tabelas de domínio: o módulo `accounts` guarda uma referência imutável ao `authUserId`, mas todo dado e evento de domínio usa o `accountId` próprio, exatamente para que a troca de provedor de autenticação não vaze para o resto do produto. Usar `authUserId` como prefixo de objeto no Storage reabriria esse acoplamento — agora no lugar onde o áudio, o dado mais sensível do produto, é guardado — e tornaria uma futura troca de provedor mais cara: seria preciso migrar o prefixo de cada objeto já armazenado, não só trocar um adapter.

## Decisão

O bucket de áudio (`session-audio`) é privado e **não recebe nenhuma política de RLS para os papéis `anon` e `authenticated`** em `storage.objects`. Sem uma política que conceda a operação, o Storage nega por padrão — o mesmo modelo de "tabela gerenciada pelo servidor não concede privilégio a `anon` nem `authenticated`" que o §10 já aplica ao schema Postgres, estendido ao Storage.

Toda operação privilegiada — emitir URL de upload assinada, checar tamanho do objeto, baixar o objeto para validação, remover objeto rejeitado — passa exclusivamente pelo backend, usando a **service role key** do Supabase, que ignora RLS. A autorização real acontece em código de aplicação, antes de qualquer chamada ao Storage:

1. Toda operação de áudio recebe o `accountId` de domínio já validado pelo middleware de identidade (nunca do corpo da requisição).
2. O backend confirma que a sessão referenciada pertence a esse `accountId` e está no estado esperado antes de assinar qualquer URL ou de servir o objeto.
3. O prefixo do objeto continua sendo `<account-id>/<session-id>` com o `accountId` de domínio — nunca o `authUserId`.
4. O bucket é criado com `file_size_limit` igual ao teto de domínio de `SessionAudio` (25 MiB — Bloco 4 T-004/T-013). Essa checagem é nativa do motor de Storage (`can_insert_object`, avaliada sobre `storage.buckets.file_size_limit`) e roda **antes** de qualquer policy ou código de aplicação — uma camada independente de RLS e independente do backend contra o vetor específico de objeto oversized.

A frase do §10 "as políticas de storage.objects validam bucket, identidade e prefixo para toda operação" é satisfeita pela ausência de política de concessão (bucket sempre fechado para qualquer papel que não seja a service role) somada à checagem de identidade e prefixo em código de aplicação — não por uma política de RLS que compare `auth.uid()` com o nome do objeto.

O token emitido por `createSignedUploadUrl` usa o TTL padrão da plataforma: a API do `supabase-js` 2.112.3 não expõe parâmetro de expiração para esse método (diferente de `createSignedUrl`, que aceita `expireIn`). A janela de exposição desse token não é reduzida por configuração — é contida operacionalmente: toda confirmação de upload (Bloco 4 T-023) revalida que a sessão ainda está `in_progress` antes de aceitar o objeto, e um upload que chega fora dessa janela é tratado como órfão e removido no mesmo passo, em vez de permanecer acessível na Storage (Bloco 4 D-09).

## Consequências

- Preserva a ADR-001: `authUserId` nunca aparece em um caminho de objeto, em uma tabela de domínio ou em um evento.
- Uma eventual troca de provedor de autenticação não exige migrar nenhum objeto armazenado.
- O backend é o único ponto de decisão de autorização de áudio; um bug de autorização no backend não tem uma segunda camada de RLS como rede de segurança no Storage. Isso eleva a exigência de cobertura de teste sobre as verificações de posse do Bloco 4 e do Bloco 6, especialmente o caso "conta B acessa objeto de conta A". O `file_size_limit` do bucket é a única checagem deste desenho que não depende desse backend — um objeto acima do teto é recusado pelo próprio Storage mesmo que o backend jamais chegasse a validar tamanho.
- A service role key é um segredo de alto privilégio; vive apenas no backend, nunca em código de cliente, seguindo a mesma regra já aplicada às demais credenciais de serviço do produto.

## Alternativas rejeitadas

- **RLS em `storage.objects` com `auth.uid()` (padrão oficial da Supabase)** — funciona, mas exige usar `authUserId` como prefixo do objeto, reabrindo o acoplamento que a ADR-001 rejeitou para as tabelas de domínio, agora sobre o dado mais sensível do produto.
- **Custom claim de `accountId` no JWT do Supabase, lido por RLS via `auth.jwt()`** — resolveria o conflito preservando o prefixo por `accountId`, mas exige alterar o fluxo de emissão de identidade do Bloco 1 (já concluído) para gravar o claim na criação da conta, o que está fora do escopo do Bloco 4.

## Referências

- `docs/prd/2026-08-15-mindness-mvp.md` §10 ("Autorização de áudio") e §9 (Supabase Storage).
- Supabase JS — Context7 `/supabase/supabase-js`, "Storage File Operations" (`createSignedUploadUrl`, `uploadToSignedUrl`, `createSignedUrl`, `download`), consultado em 2026-08-18.
- Supabase — Context7 `/supabase/supabase`, "Storage Buckets > Access model > Private buckets" e "Storage Access Control > Access policies" (bypass por service key para clientes confiáveis), consultado em 2026-08-18.
- Supabase — Context7 `/supabase/supabase`, "Storage Buckets > Creating Buckets" (`file_size_limit`/`allowed_mime_types` como colunas nativas de `storage.buckets`, checadas por `can_insert_object`) e "Bypassing Row Level Security" (`service_role` vs. `bypassrls`), consultado em 2026-08-18.
- Supabase JS — Context7 `/supabase/supabase-js`, `StorageFileApi.createSignedUploadUrl`/`createSignedUrl` (só `createSignedUrl` aceita `expireIn`; `createSignedUploadUrl` não expõe TTL customizado), consultado em 2026-08-18.
- `docs/architecture/adr/adr-001-identidade-supabase-e-modulo-accounts.md`.
- `docs/roadmap/01-guia-tecnico-de-fases.md` — Bloco 4.
