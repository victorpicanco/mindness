# ADR-005 — Erros de fronteira externa declarados em `analyses/domain/errors/`

- **Status:** aceito
- **Data:** 2026-08-21
- **Decisores:** Mindness

## Contexto

O módulo `analyses` declara seis erros em `src/modules/analyses/domain/errors/` (T-006 do Bloco 5). Três deles herdam de `InfrastructureError`:

| Erro                       | `code`                          | Categoria             |
| -------------------------- | ------------------------------- | --------------------- |
| `TranscriptionFailedError` | `analyses.TRANSCRIPTION_FAILED` | `InfrastructureError` |
| `EvaluationFailedError`    | `analyses.EVALUATION_FAILED`    | `InfrastructureError` |
| `MalformedEvaluationError` | `analyses.MALFORMED_EVALUATION` | `InfrastructureError` |

Isso cria uma tensão com duas leis:

- **LAW-009.4** descreve `InfrastructureError` como "falha técnica. Origem: infrastructure".
- **LAW-002** descreve `domain/errors/` como o lugar dos "erros de negócio" do módulo.

Lidas ao pé da letra, as duas juntas mandariam esses três erros para `infrastructure/errors/` — pasta que a estrutura obrigatória de módulo (LAW-001.2) não prevê.

## Decisão

Manter os três em `analyses/domain/errors/`, com a categoria semântica que já têm.

O motivo é a direção da dependência. Quem **declara** o contrato de falha é a porta, não o adapter:

- `TranscriptionPort.transcribe` e `EvaluationPort.evaluate` vivem em `domain/ports/`. O contrato delas não é só a forma do retorno: é também o conjunto fechado de falhas que o chamador precisa distinguir. `ProcessSessionAudioUseCase` traduz `MalformedEvaluationError` em `reason: 'malformed_evaluation'` e `EvaluationFailedError` em `reason: 'evaluation_failed'` — dois eventos de integração diferentes, decididos em `application/`.
- Se os erros morassem em `infrastructure/`, `application/` teria de importar de `infrastructure/` para distinguir um do outro, o que LAW-003.6 proíbe. O `domain/` é a única camada que as duas pontas podem enxergar.
- O adapter em memória de T-018 lança exatamente os mesmos erros do adapter real. Um fake que não consegue reproduzir as falhas do real torna o teste de integração inútil (LAW-011).

A categoria continua sendo `InfrastructureError` porque a **natureza** da falha é técnica: o error handler HTTP tem de tratá-la como 500 e não vazar a mensagem ao cliente (LAW-009, regra de serialização). O que este ADR abre é a exceção de **local de declaração**, não de categoria.

## Consequências

- Um erro de `domain/errors/` de qualquer módulo pode herdar de `InfrastructureError` quando — e somente quando — ele é parte do contrato declarado de uma porta de `domain/ports/`. Erro técnico sem porta correspondente (falha de driver, de conexão, de serialização) continua sendo de `infrastructure/` e reusa `DatabaseError` e companhia de `shared/errors/`.
- O lint de camada não muda: `domain/` continua proibido de importar SDK, ORM ou framework. Os três erros não importam nada do fornecedor — recebem `cause: unknown`.
- Se um módulo futuro precisar de um erro técnico **sem** porta, ele não se apoia neste ADR.

## Alternativas rejeitadas

- **Mover para `infrastructure/errors/`:** quebra LAW-003.6 no `ProcessSessionAudioUseCase`, que precisa distinguir as falhas para escolher o `reason` do evento.
- **Rebaixar para `DomainError`:** mentiria sobre a natureza da falha e faria o handler HTTP devolver 4xx para indisponibilidade de fornecedor.
- **Um erro genérico único (`AnalysisFailedError`) com discriminador em `context`:** o use case passaria a ramificar por string dentro de `context`, o oposto do que LAW-009 pede ao exigir classes por categoria semântica.
