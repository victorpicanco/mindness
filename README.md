<p align="center">
  <a href="https://mindness.app">
    <img src="apps/web/public/logo-icon.svg" width="88" height="88" alt="Mindness" />
  </a>
</p>

<h1 align="center">Mindness</h1>

<p align="center">Pratique sua comunicação. Entenda sua evolução.</p>

<p align="center">
  <a href="https://mindness.app"><img src="https://img.shields.io/badge/produção-mindness.app-black?style=flat-square" alt="Mindness em produção" /></a>
  <img src="https://img.shields.io/badge/versão-1.0.0-black?style=flat-square" alt="Versão 1.0.0" />
  <a href="https://www.instagram.com/mindnessapp/"><img src="https://img.shields.io/badge/Instagram-%40mindnessapp-black?style=flat-square" alt="Instagram @mindnessapp" /></a>
</p>

<p align="center">
  <a href="https://mindness.app"><strong>Acessar o Mindness →</strong></a>
</p>

## O que é

O Mindness é uma ferramenta de prática de comunicação. Você escolhe um tema,
prepara sua apresentação, grava sua fala e recebe uma análise para transformar
cada sessão em aprendizado prático.

O foco é ajudar você a comunicar ideias com mais clareza, estrutura e presença —
no seu ritmo e a partir de práticas reais.

## Como funciona

1. **Escolha o desafio.** Defina uma categoria, a dificuldade e o tempo que quer
   usar para pesquisar o tema.
2. **Prepare e apresente.** Organize as suas ideias e grave sua apresentação
   diretamente no app.
3. **Receba sua análise.** O Mindness transcreve sua fala e mostra pontos fortes,
   oportunidades de melhoria, ritmo, pausas e próximos passos para a próxima
   prática.

## Onde encontrar

- Aplicação: [mindness.app](https://mindness.app)
- Instagram: [@mindnessapp](https://www.instagram.com/mindnessapp/)

## Para desenvolvimento

Este repositório contém a aplicação web e a API do Mindness. Para iniciar o
ambiente local:

```bash
pnpm install
pnpm supabase:start
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
pnpm --filter @mindness/api db:deploy
pnpm --filter @mindness/api themes:catalog:apply
pnpm --filter @mindness/api dev
```

Em outro terminal, inicie a aplicação web:

```bash
pnpm --filter @mindness/web dev
```

Consulte os arquivos `.env.example` antes de iniciar: eles descrevem as variáveis
necessárias para integrações e autenticação local.

## Qualidade

```bash
pnpm verify
```

Esse comando executa lint, verificação de formatação, tipos e testes unitários.
