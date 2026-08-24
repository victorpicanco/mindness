# ADR-006 — Cobrança adiada: Blocos 11 e 10 antes de 7, 8 e 9

- **Status:** aceito
- **Data:** 2026-08-23
- **Decisores:** Mindness
- **Documentos afetados:** `docs/roadmap/01-guia-tecnico-de-fases.md` §1 (regra de dependência), §2 (mapa de blocos e caminho crítico), Blocos 10 e 11 (DoD)

## Contexto

O guia técnico de fases fixa, em §1:

> **Nenhum bloco começa sem que suas dependências estejam com DoD cumprido. Dependência parcial não conta.**

Pelo mapa de §2, o Bloco 10 depende dos Blocos 6 e 8, e o Bloco 12 depende dos Blocos 9, 10 e 11. Executar o mapa na ordem escrita significa entregar comunicação transacional (7), cobrança (8) e instrumentação (9) **antes** de existir qualquer superfície pela qual uma pessoa consiga percorrer a jornada à mão.

O objetivo declarado é o inverso: ter o produto central rodando e validável de ponta a ponta antes de cobrar de alguém. Três fatos sustentam a inversão.

**O PRD já ordena as hipóteses nesse sentido.** §3:

> "a secundária depende da primeira. Se o feedback não gerar retorno, não há o que vender, e a leitura da conversão perde sentido. Por isso o critério de kill do produto está ligado à retenção, não à conversão."

E o critério de kill de §4 vai além: se o North Star bater a meta e a conversão ficar abaixo de 3% em 42 dias, **o plano pago é retirado do produto** e o beta continua. O PRD admite explicitamente um produto sem cobrança; não admite um produto sem retorno de análise.

**A habilitação fiscal é externa e lenta.** §1.2 do guia registra CNPJ, conta AbacatePay aprovada em produção e emissão de NFS-e testada como trilha não-técnica que bloqueia o Bloco 8. Adiar o Bloco 8 converte essa trilha de caminho crítico em folga.

**O código já absorveu o custo de acoplamento do plano pago.** O Bloco 3 foi entregue com o lado "conta paga" inteiro:

- `QuotaPolicy` (`modules/quota/domain/services/quota-policy/`) tipa `QuotaPlan = 'free' | 'plus'` e `isEnforced` já retorna `false` para `plus`.
- `presentation/integration/quota-plan-transitions/index.test.ts` já cobre, contra banco real, conta `plus` sem ciclo, sem evento de exaustão, com reserva em voo preservada e recálculo de saldo na reentrada no free (CA-006.7).
- `AccountsPortAdapter` de `quota`, `sessions` e `analyses` lê a conta por porta estreita (`{ accountId, plan, createdAt, timeZone }`), nunca por acesso direto.
- Os eventos já carregam `plan` na carga (D-10 do Bloco 6).
- O enum `AccountPlan` do Prisma tem apenas `free`; acrescentar `plus` é migração aditiva.
- Não existe nenhuma infraestrutura de e-mail no repositório — o Bloco 7 é campo limpo e adiá-lo tem custo de refatoração zero.

O Bloco 8 não reabre a cota nem a fronteira de contas: ele vira uma chave que já está construída e testada. O acoplamento que tornaria a inversão cara não existe.

Nada disso torna 7, 8 e 9 dispensáveis. O Definition of Done da release (§14 do PRD) exige ciclo de assinatura testado ponta a ponta em produção, com nota fiscal e reembolso, e exige que os eventos de §13 calculem todas as métricas de §4. **O Bloco 13 é intransponível sem eles.** A decisão é de ordem, não de escopo.

## Decisão

A ordem de execução dos blocos passa a ser:

**6 → 11 → 10 → 7 → 8 → 9 → 12 → 13**

com três consequências normativas.

### 1. O Bloco 11 abre sem exceção; fecha com dois itens suspensos

O Bloco 11 depende de 4 e 6, não de 8. Sua abertura antes do Bloco 8 **não viola** a regra de §1 — o mapa já a permitia. O que a viola é o seu DoD, que exige o ramo de upgrade. Ficam suspensos, e **apenas** eles:

| Item de DoD do Bloco 11                                                                                                  | Situação                                                            |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| "O ramo de upgrade é percorrível ponta a ponta, incluindo cancelamento."                                                 | suspenso integralmente                                              |
| "Metas de performance de §12 medidas: p95 da página inicial, da abertura de análise e **da confirmação de assinatura**." | suspenso apenas na terceira medição; as duas primeiras são exigidas |

Na entrega de capacidade "Ramo de upgrade: cota esgotada, oferta, contratação, área de assinatura, cancelamento", o Bloco 11 entrega **cota esgotada e oferta** — o estado de limite e a tela que o comunica são consequência do Bloco 3, que já emite `quota_exhausted` com data de renovação. Contratação, área de assinatura e cancelamento ficam para o segundo passe.

### 2. O Bloco 10 abre com o Bloco 8 em aberto — exceção escopada à regra de §1

Esta é a única violação real da regra "dependência parcial não conta". Ela é aceita porque a dependência do Bloco 10 em relação ao 8 é de **um único item**:

| Item de DoD do Bloco 10                                                                                                        | Situação                                           |
| ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| "Dados sob retenção fiscal sobrevivem à exclusão da conta, ficam bloqueados para outro uso e são elimináveis ao fim do prazo." | suspenso — não existe dado fiscal antes do Bloco 8 |

Todo o resto do Bloco 10 pende apenas do Bloco 6 e é exigido na íntegra: expiração de áudio, transcrição, análise e score aos 30 dias; execução de exclusão alcançando banco, armazenamento e fornecedores; registro auditável; restauração de backup que não reexpõe dado excluído; RPO e RTO de 24 horas; revogação de credencial e de processamento sobre dado excluído.

### 3. Os itens suspensos são pré-condição do Bloco 12

Os três itens da tabela acima são **reabertos e fechados ao final do Bloco 8, antes da abertura do Bloco 12**. O Bloco 12 depende de 9, 10 e 11 com DoD integral: ele é o bloco adversarial, e atacar de fora uma superfície de upgrade que ainda não existe não prova nada.

Nenhum outro item de DoD, de nenhum bloco, é suspenso por este ADR. Suspensão fora desta lista é improviso e cai na regra de §1 do guia: pare e reporte.

### 4. Os Blocos 7, 8, 9 e 12 fecham íntegros

Como 9 passa a rodar depois de 8, e 12 depois de 9, nenhum dos quatro tem item suspenso. A métrica de conversão, o funil de assinatura, o alerta de falha de cobrança e a idempotência de webhook sob concorrência são exigidos integralmente onde sempre estiveram.

## Consequências

- **Segundo passe previsto em dois blocos.** O Bloco 11 volta para receber contratação, área de assinatura, cancelamento e a medição de p95 da confirmação de assinatura. O Bloco 10 volta para a retenção fiscal. Esse retrabalho é conhecido e aceito: é o preço de validar o core antes de cobrar.
- **A trilha de habilitação fiscal ganha folga.** Ela deixa de bloquear o caminho crítico e passa a ter toda a janela dos Blocos 11, 10 e 7 para concluir. §1.2 do guia permanece válido: sem ela, o Bloco 8 não fecha.
- **O beta não abre antes de 7 e 8.** O Bloco 13 verifica o Definition of Done da release de §14 item a item, incluindo assinatura, cobrança, nota fiscal e reembolso em produção. Este ADR não move essa exigência.
- **A jornada fica manualmente validável muito mais cedo.** É o ganho que motiva a decisão: a hipótese principal do PRD — retorno em 7 dias após ver a análise — passa a ser observável em navegador real antes de qualquer risco financeiro.
- **Enquanto o Bloco 10 não fecha, a exclusão de conta do Bloco 1 continua sendo apenas agendamento.** Antecipá-lo reduz a janela em que dado de voz de teste se acumula sem remoção física.
- **A regra de §1 permanece de pé para todos os demais blocos.** A exceção é escopada ao par (Bloco 10, Bloco 8) e enumerada item a item. Uma segunda reordenação exigiria ADR próprio.

## Alternativas rejeitadas

- **Executar o mapa na ordem escrita (7, 8, 9 antes de 10 e 11).** Rejeitada porque inverte a ordem de hipóteses do próprio PRD: constrói e arrisca dinheiro de pessoa real sobre um retorno de análise que ninguém percorreu à mão. Também mantém a habilitação fiscal — trilha externa de semanas — dentro do caminho crítico, sem necessidade.

- **Ordem 6 → 11 → 7 → 8 → 10 → 9 → 12 → 13**, com o Bloco 10 depois do 8. Tecnicamente mais limpa: elimina a única violação real da regra de §1, porque o Bloco 10 abriria com ambas as dependências fechadas, e dispensa o segundo passe da retenção fiscal. Rejeitada porque adia por dois blocos inteiros a exclusão física de dado pessoal — hoje a exclusão de conta do Bloco 1 apenas agenda a remoção, e nada a executa. Manter dado de voz de teste acumulado sem remoção durante toda a construção da cobrança troca uma exceção documentada por um passivo de conformidade. Se essa leitura mudar, a inversão é barata: só o item de retenção fiscal muda de lugar.

- **Suspender também itens do Bloco 9** e rodá-lo cedo, em versão parcial (North Star, ativação, retenção e as duas contra-métricas, sem conversão). Rejeitada porque não serve ao objetivo: instrumentação não é necessária para validar a jornada à mão, e rodar o Bloco 9 duas vezes acrescentaria um terceiro segundo-passe sem ganho correspondente. Depois do Bloco 8 ele fecha íntegro, de uma vez.

- **Remover 7, 8 e 9 do MVP**, entregando o beta sem plano pago. Rejeitada porque contraria §14 do PRD, que exige o ciclo de assinatura no Definition of Done da release, e porque a hipótese secundária — 10% de conversão — não teria como ser medida. O PRD prevê retirar o plano pago **como reação a um resultado medido** (conversão abaixo de 3% com North Star na meta), não como decisão prévia.

## Referências

- `docs/roadmap/01-guia-tecnico-de-fases.md` §1, §1.2, §2, Blocos 8, 10, 11, 12, 13.
- `docs/prd/2026-08-15-mindness-mvp.md` §3 (ordem das hipóteses), §4 (métricas e critério de kill), §14 (marcos e Definition of Done da release).
- `docs/roadmap/03-cota-e-ciclo-da-conta.md` e `apps/api/src/modules/quota/` — o plano `plus` já modelado e coberto por teste de integração.
- `docs/architecture/adr/adr-002-reserva-de-cota-como-passo-sincrono-de-saga.md` — a fronteira `quota`/faturamento que torna o adiamento barato.
