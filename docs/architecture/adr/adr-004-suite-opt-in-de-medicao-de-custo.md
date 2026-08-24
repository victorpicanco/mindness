# ADR-004 — Suíte opt-in de medição de custo real

- **Status:** aceito
- **Data:** 2026-08-21
- **Decisores:** Mindness

## Contexto

O DoD do Bloco 5 exige que o custo por sessão de processamento (transcrição Deepgram + avaliação Gemini) seja **medido em teste real**, dentro de US$ 0,06 (D-10 do `docs/roadmap/05-pipeline-de-processamento.md`), além dos dois tetos por fornecedor (US$ 0,02 de transcrição, US$ 0,04 de avaliação). Nenhuma das três categorias de teste definidas por LAW-011.1 (unit, integration, e2e) serve para isso: unit não toca rede; integration e e2e proíbem explicitamente serviço externo pago (LAW-011, tabela de definição). Medir custo real exige, por definição, chamar Deepgram e o Gemini de verdade — o oposto do que as três categorias existentes garantem.

Além disso, o projeto não tem hoje credencial de Deepgram nem de Google Cloud (nenhuma das duas está em `.env`). A suíte precisa existir e ser exercitável quando as credenciais chegarem, sem bloquear `pnpm test`, `pnpm verify` nem o job `quality` do CI enquanto elas não existirem.

## Decisão

Criar uma quarta categoria de teste, **provider**, em exceção explícita a LAW-011.1:

- Caminho: `src/tests/providers/<fluxo>/index.test.ts` — fora de qualquer módulo, ao lado de `src/tests/e2e/`. Não em `presentation/providers/`: LAW-001.2 fecha `presentation/` em sete subpastas fixas, e uma oitava seria violação sem ADR próprio.
- Configuração dedicada: `vitest.config.providers.ts`, com `include: ['src/tests/providers/**/index.test.ts']` e **sem** `setupFiles` — o network guard de `src/tests/setup.ts` bloqueia qualquer host que não seja `localhost`/`127.0.0.1`/`::1`, por desenho, e bloquearia a própria chamada que esta suíte existe para fazer.
- Script próprio: `pnpm test:providers`. Não entra em `pnpm verify` nem no job `quality` do CI.
- `vitest.config.ts` passa a excluir `src/tests/providers/**` explicitamente, ao lado das exclusões já existentes de `presentation/integration/**` e `tests/e2e/**` — sem essa terceira entrada, o `include` genérico (`src/**/*.test.ts`) do config unitário coletaria o arquivo e passaria a bater em fornecedor pago a cada `pnpm test`.
- **Opt-in por credencial:** a suíte se pula sozinha com `describe.skipIf` quando `DEEPGRAM_API_KEY` ou `GOOGLE_CLOUD_PROJECT` estão ausentes do ambiente. Rodar `pnpm test:providers` sem credencial é um no-op silencioso, não uma falha.

## Consequências

- O item de DoD "custo por sessão medido em teste real dentro de US$ 0,06" fica **pendente** até as credenciais de Deepgram e de Google Cloud existirem no ambiente onde a suíte roda. O Bloco 5 não pode ser declarado 100% entregue antes disso.
- A suíte usa os mesmos adapters de produção (`DeepgramTranscriptionAdapter`, `GeminiEvaluationAdapter`) e o mesmo `CostCalculator` de domínio — não há lógica de custo duplicada só para o teste.
- Uma quinta categoria futura (por exemplo, testes de carga) exigiria o mesmo tratamento: ADR próprio, config e script dedicados, exclusão explícita das demais.

## Alternativas rejeitadas

- **Deixar a medição fora do repositório** (script manual, planilha, execução ad-hoc): rejeitada porque o DoD do bloco exige evidência verificável — nome de teste, caminho de arquivo, saída de comando (`docs/roadmap/00-convencoes-e-dod.md` §8). Uma medição fora do repositório não é reproduzível nem revisável em PR, e tende a apodrecer sem ninguém notar quando o preço de um fornecedor muda.
- **Rodar como teste de integração comum**, aceitando a exceção a LAW-011 caso a caso: rejeitada porque misturaria, na mesma suíte e no mesmo `pnpm test:integration`, testes que nunca tocam fornecedor pago com um que sempre toca — quebrando a garantia de LAW-011.1 de que a categoria é determinada pelo path, não por exceção implícita dentro do arquivo.

## Referências

- `docs/roadmap/05-pipeline-de-processamento.md` D-10, D-13, T-042.
- `docs/architecture/laws/law-011-lei-de-testes-de-integracao-e-e2e.md`, LAW-011.1.
- `docs/roadmap/00-convencoes-e-dod.md` §1, §6, §8.
