# ADR-001 — Identidade Supabase e módulo `accounts`

- **Status:** aceito
- **Data:** 2026-08-15
- **Decisores:** Mindness

## Contexto

O Bloco 1 exige identidade por e-mail/senha e Google OAuth, confirmação de e-mail, JWT validado a cada operação autenticada, uma única sessão por conta e um modelo próprio de conta que seja dono de consentimento, fuso, plano e ciclo de vida de exclusão. A identidade externa não pode se tornar o identificador de domínio nem ser confiada a partir de dados enviados pelo cliente.

## Decisão

O módulo `accounts` será o bounded context dono dos registros de conta, consentimento e pedido de exclusão. Ele guardará uma referência única e imutável ao `authUserId` do Supabase Auth, mas usará seu próprio `accountId` em dados e eventos de domínio. O Supabase Auth será acessado exclusivamente por ports do domínio e adapters da infraestrutura: um adapter valida o JWT em cada requisição autenticada e outro inicia os fluxos de cadastro e login. O middleware de apresentação anexará apenas a identidade validada à requisição; rotas nunca aceitarão `accountId` como autoridade.

A vaga beta será representada pela própria conta criada no módulo `accounts`. A criação ocorrerá numa transação serializável com tentativa limitada para conflito de serialização, garantindo que no máximo 100 contas sejam persistidas. A exclusão revogará acesso imediatamente e registrará um pedido de remoção para o Bloco 10 executar fisicamente.

## Consequências

- Fluxos de autenticação são testáveis por adapters em memória; testes de integração não chamam Supabase.
- O projeto Supabase, o provedor Google, URLs de callback, CAPTCHA e políticas de sessão precisam estar configurados antes da validação contra o fornecedor real.
- A expiração de uma hora e a observação da sessão anterior seguem a semântica documentada do Supabase: a revogação é efetiva, no máximo, na próxima expiração/validação do JWT.
- Trocar o provedor de autenticação exige substituir adapters e migrar as referências `authUserId`, mas preserva o identificador de domínio e os dados da conta.

## Alternativas rejeitadas

- Usar `auth.uid()` como identificador de domínio: acopla todas as tabelas e eventos ao fornecedor.
- Delegar conta, consentimento e exclusão inteiramente ao Supabase Auth: não modela as invariantes e a retenção do produto.
- Aceitar `accountId` no corpo ou em cabeçalho: viola a autorização definida no PRD.

## Referências

- Supabase Auth — "Summary of the methods" e "JWT session_id validation against auth.sessions", consultados em 2026-08-15.
- Prisma — "Transactions" e "P2034 retry loop for Serializable isolation level", consultados em 2026-08-15.
- `docs/prd/2026-08-15-mindness-mvp.md` §10 e §12.1.

## Adendo — desenvolvimento no plano Free

Enquanto o projeto estiver no plano Free, a sessão única será aplicada pelo backend: após validar assinatura, emissor, audiência, expiração e `session_id` do JWT, o middleware aceitará apenas o `session_id` corrente persistido pela conta. Um login novo substitui esse identificador; o token do dispositivo anterior recebe 401 na próxima requisição autenticada. O backend não confiará em `user_metadata` e não consultará nem modificará tabelas internas do schema `auth`.

No lançamento, o controle de sessão única do Supabase Pro será habilitado como defesa adicional. A regra de negócio não dependerá dele, portanto a mudança de plano não altera o comportamento já validado.

## Adendo — deploy do beta e Google OAuth

O desenvolvimento permanece no plano Free. O deploy do beta é bloqueado até o projeto ser promovido ao Supabase Pro e ter a proteção contra senhas vazadas e a sessão única nativa habilitadas. Os adapters em memória simulam esses comportamentos durante desenvolvimento, mas não substituem a configuração do ambiente de produção.

Google usa OAuth Authorization Code com PKCE iniciado pela API. O verificador PKCE permanece em cookie `HttpOnly`, `Secure` em produção e `SameSite=Lax`; o callback autorizado troca o código pela sessão. O produto não persiste tokens OAuth do Google. Receber um Google ID token diretamente do cliente foi rejeitado para evitar que cada superfície cliente coordene detalhes do fornecedor e proteção contra replay.

Exclusão de conta exige um JWT validado emitido nos últimos cinco minutos. Uma identidade mais antiga precisa autenticar novamente antes da operação destrutiva.
