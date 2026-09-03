<p align="center">
  <img src="apps/web/public/logo-icon.svg" width="96" height="96" alt="Mindness" />
</p>

<h1 align="center">mindness</h1>

<p align="center">
  Um SaaS com inteligência artificial para desenvolver comunicação e oratória.<br />
  Transforme apresentações faladas em feedback prático, claro e personalizado.<br />
  Pratique com propósito, identifique oportunidades e fale com mais confiança.
</p>

## O que é o Mindness?

O Mindness é uma plataforma de prática de comunicação **AI-powered**. Ela propõe temas, acompanha a preparação de uma apresentação e analisa a gravação para ajudar cada pessoa a evoluir sua clareza, estrutura e segurança ao falar.

Em vez de depender apenas de percepção, quem pratica recebe uma análise estruturada da própria apresentação: resumo, pontos fortes, oportunidades de melhoria, evidências e transcrição. O objetivo é tornar a prática deliberada, recorrente e mensurável.

## Ambientes

| Ambiente                  | Endereço                                     | Status                                        |
| ------------------------- | -------------------------------------------- | --------------------------------------------- |
| Desenvolvimento / staging | [dev.mindness.app](https://dev.mindness.app) | Disponível para desenvolvimento e validação.  |
| Produção                  | —                                            | Em ajustes antes da disponibilização pública. |

## Como funciona

1. **Clique em “Nova sessão”.** Inicie uma nova prática a partir da área autenticada da plataforma.
2. **Defina o desafio.** Escolha a categoria, o nível de dificuldade e o tempo disponível para pesquisar.
3. **Prepare-se para o tema.** O Mindness apresenta um tema e abre uma janela de pesquisa para você organizar suas ideias.
4. **Grave sua apresentação.** Use o gravador da plataforma para apresentar o tema no seu ritmo.
5. **Receba a análise da IA.** Depois do envio, a IA processa a apresentação e entrega um resumo, pontos fortes, próximos passos, evidências e a transcrição para orientar a próxima prática.

## Monorepo

O Mindness é organizado como um monorepo gerenciado pelo [pnpm](https://pnpm.io/). Esse formato mantém as aplicações do produto no mesmo repositório, com dependências, comandos e padrões compartilhados.

```text
apps/
├── api/     # API e serviços de backend
└── web/     # Aplicação web em Next.js
```

O arquivo `pnpm-workspace.yaml` define os pacotes do workspace, e os comandos na raiz são executados de forma recursiva quando aplicável.

## Começando

```bash
pnpm install
pnpm --filter @mindness/web dev
```

Para trabalhar na API, use:

```bash
pnpm --filter @mindness/api dev
```

## Comandos principais

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm verify
```

`pnpm verify` executa as verificações locais de lint, formatação, tipagem e testes.
