# VERIFY

Evidências por mudança. Só registre aqui o que foi **executado** e o resultado real.

## 2026-10-22 — Reorganização da fila (campo certo, ciclo ativo preservado, sem take:200)

| Gate | Comando | Resultado |
|---|---|---|
| Tipos | `npx tsc --noEmit` | sem saída (sem erros) |
| Lint | `npm run lint` | sem erros; 3 warnings pré-existentes (`configuracoes/client.tsx`, `profile-form.tsx`, `public-deck-view.tsx`) |
| Build | `npm run build` | ok (prisma generate + next build) |
| Reorganização (banco real) | `npx tsx scripts/organize-tests.ts` | **9/9** testes |
| Regressão SRS (A–M) | `npx tsx scripts/srs-tests-a-k.ts` | **19/19** (A–L + M1–M7, inalterado) |
| Política do cronograma (puro) | `npx tsx scripts/schedule-plan-tests.ts` | **1482/1482** verificações |
| Cronograma end-to-end | `npx tsx scripts/schedule-tests.ts` | **7/7** testes |

### Baseline antes da mudança

`npx tsx scripts/srs-tests-a-k.ts` → **19/19** (mesmo resultado depois).

### Cobertura do harness da reorganização (O1–O9)

| Teste | Verifica |
|---|---|
| O1 | card sem ciclo e atrasado é reprogramado (`nextReviewDate` + espelho `Flashcard.nextReview`) |
| O2 | card com ciclo ACTIVE **não** é tocado: `nextReviewDate` continua espelhando a `ScheduledReview` pendente (ambos intocados) |
| O3 | card com ciclo encerrado pode ser reorganizado; o ciclo continua `COMPLETED` |
| O4 | `skippedActiveCycles` = 1 (conta só os preservados) |
| O5 | paginação: **250** cards atrasados → `count = 250` e 0 cards continuam atrasados (o teto antigo era 200) |
| O6 | prioridade HARD antes de EASY (rank explícito; `orderBy` de string dava o inverso) |
| O7 | a fila do SRS deixa de ver o card sem ciclo como atrasado; só o de ciclo ativo permanece (é o ciclo que manda) |
| O8 | card de outro usuário não é tocado |
| O9 | a Server Action usa o perfil ativo e devolve `{ count, skippedActiveCycles }` |

### Prova de que os testes novos pegam o bug (mutação temporária, revertida)

| Mutação aplicada | Resultado |
|---|---|
| removido o filtro `reviewCycles: { none: { status: "ACTIVE" } }` | **5/9** — falham O2 (`nextReviewDate` deixou de espelhar a pendente: `2026-10-21` → `2026-10-22`), O4, O7, O9 |
| leitura interrompida após a 1ª página (simula `take: 200` sem paginação) | **8/9** — falha O5 |

### Efeito colateral

Os harnesses criam usuários descartáveis no Postgres de produção e os removem
no final. O harness da reorganização registra os usuários descartáveis em uma
lista e limpa **mesmo quando uma asserção falha** (verificado: com a paginação
quebrada de propósito, sobraram **0** usuários de teste no banco). Nenhum dado
de usuário real foi tocado: todos os cards exercitados pertencem a usuários
`test-organize-*` / `test-*` criados e apagados pelo próprio harness.

## 2026-10-20 — Cronograma reverso (revisão final + redistribuição)

| Gate | Comando | Resultado |
|---|---|---|
| Tipos | `npx tsc --noEmit` | sem saída (sem erros) |
| Lint | `npm run lint` | sem erros; 3 warnings pré-existentes (`configuracoes/client.tsx`, `profile-form.tsx`, `public-deck-view.tsx`) |
| Build | `npm run build` | ok (prisma generate + next build) |
| Política (puro) | `npx tsx scripts/schedule-plan-tests.ts` | **1482/1482** verificações |
| End-to-end (banco real) | `npx tsx scripts/schedule-tests.ts` | **7/7** testes |
| Render da tela | `npx tsx --tsconfig scripts/tsconfig.ui-tests.json scripts/schedule-ui-tests.tsx` | **12/12** verificações |
| Regressão SRS | `npx tsx scripts/srs-tests-a-k.ts` | **19/19** (inalterado) |

### Cobertura do harness do cronograma (S1–S6)

- S1 — 5 assuntos, 40 dias até a prova, 7 de revisão final: 40 itens, 40 dias
  com conteúdo (**nenhum dia vazio**), 7 dias finais com item e marcados como
  `FINAL_REVIEW`, cada assunto estudado 1× e coberto pela revisão final,
  estudo espalhado (último estudo depois do dia 20).
- S2 — re-gerar apaga o cronograma anterior: 1 `StudySchedule`, 40 itens.
- S3 — `reviewDays = 0` é rejeitado com mensagem clara.
- S4 — data da prova próxima demais é rejeitada.
- S5 — 30 assuntos em 20 dias: 2 itens por dia de estudo, 6 por dia de
  revisão final, 20 dias com conteúdo.
- S6 — o cronograma de outro usuário não é tocado (propriedade).
- S7 — `getScheduleWithDetails` devolve o plano salvo (é o que a página
  carrega): 40 itens, 40 dias com conteúdo, fases e relações intactas
  depois da ida e volta ao banco.

### Smoke de runtime da página `/edital` (servidor Next real)

Executado com `next start` na porta 3111, usuário descartável criado no
Supabase (admin) + assinatura no Prisma + plano salvo:

| Cenário | Resultado |
|---|---|
| Assinatura ativa + plano salvo | **200** — renderiza "Cronograma do Edital", a matéria/assunto do usuário, os rótulos de fase e o resumo; o formulário **não** aparece |
| Sem assinatura ativa | **307 → `/dashboard/configuracoes?upgrade=true`** (sem erro 500) |

Ambos os usuários (Supabase + Prisma) foram removidos no final. Script
temporário, não versionado.

### Cobertura dos testes puros (1482 verificações)

11 cenários (N de 1 a 200 assuntos, D de 1 a 100 dias, R de 1 a 30 dias) mais
os testes de classificação, helpers e validação. Invariantes conferidos:
nenhum dia vazio; todo assunto estudado exatamente 1×; todo assunto coberto
pela revisão final; revisão intermediária só de assunto já estudado; dia de
estudo sem assunto novo **sempre** tem revisão; estudo espalhado quando
N < D; carga por dia equilibrada (≤1) no estudo e na revisão final; nenhum
assunto repetido na revisão final quando N ≥ R; a data exibida não desloca o
dia (off-by-one de fuso).

### Efeito colateral

Os harnesses criam usuários descartáveis no Postgres de produção e os removem
no final (inclusive em caso de falha). Conferido após a execução:
0 usuários `@edcards.test`, 0 `StudySchedule`, 0 `ScheduleItem`.

### Validação humana pendente

A tela `/edital` foi verificada por render do componente real (10 checagens de
HTML), **não** por navegador logado. Confere visualmente o resultado na UI
antes de publicar.

## 2026-10-20 — Agendamento manual de revisões

| Gate | Comando | Resultado |
|---|---|---|
| Tipos | `npx tsc --noEmit` | sem saída (sem erros) |
| Lint | `npm run lint` | sem erros; 3 warnings pré-existentes (`configuracoes/client.tsx`, `profile-form.tsx`, `public-deck-view.tsx`) |
| Build | `npm run build` | ok (prisma generate + next build) |
| Testes | `npx tsx scripts/srs-tests-a-k.ts` | **19/19** |

### Cobertura do harness A–M

- A–L (regressão do SRS, **inalterados**): todos PASS — a máquina de estados, o
  ciclo do SRS, o filtro de fila, o calendário, o Modo Consulta e a propriedade
  entre usuários continuam iguais.
- M1 `resolveManualSchedule`: padrão → +1/+7/+15; intensiva → +2/+4/+6/+8;
  datas distintas, início do dia, `isFinal` só na última.
- M2 `deriveReviewState`: ciclo pré-agendado → `AGUARDANDO_AVALIACAO_24H`;
  ciclo classificado → `CICLO_ATIVO`; sem `firstReviewAt` → `FIRST_RESOLUTION`.
- M3 `scheduleTopicReviews("standard")`: cria `ReviewCycle` ACTIVE
  (`initialCycleEvaluationCompleted=false`, `totalReviews=3`) + 3
  `ScheduledReview` em +1/+7/+15; `nextReviewDate` = 1ª revisão.
- M4 `scheduleTopicReviews("intensive")`: 4 `ScheduledReview` em +2/+4/+6/+8.
- M5 Re-agendar não cria ciclo novo nem altera o cronograma de card com ciclo ativo.
- M6 A classificação **adota** o ciclo pré-agendado: continua com 1 ciclo só,
  `classification` gravada, `initialCycleEvaluationCompleted=true`, datas preservadas.
- M7 Na adoção, revisões vencidas são marcadas como concluídas e `currentReview`
  avança para a próxima ainda futura.

### Efeito colateral

O harness cria um usuário descartável no Postgres de produção e o remove no
final (`cleanupAll`). Nenhum dado de usuário real é tocado.
