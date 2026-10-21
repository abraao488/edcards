# WORKLOG

## 2026-10-20 — Cronograma reverso: revisão final + redistribuição

**Por quê:** os "dias de revisão final" eram só subtraídos da janela de estudo
(`studyDays = daysBetween - reviewDays`) e nunca viravam `ScheduleItem`; e a
distribuição preenchia pela frente (`slice` por bloco), deixando dezenas de
dias vazios no meio do plano. A promessa "cronograma até a prova" não era
cumprida pelo banco.

**O que mudou:**

| Arquivo | Mudança |
|---|---|
| `src/lib/schedule/plan.ts` (novo) | Política pura: `buildStudyPlan` (3 fases: estudo espalhado / revisão intermediária / revisão final), `classifyScheduleItems` (ESTUDO x REVISÃO sem coluna nova), helpers de data (`toDateKey`, `formatDateKeyPtBr`) |
| `src/lib/schedule/actions.ts` | Usa o plano; valida `reviewDays` e a data; grava em lotes; devolve `kind`/`phase`; `safeRevalidate` no lugar de `revalidatePath` cru |
| `src/app/edital/client.tsx` | Rótulos de fase por dia, tag "Revisão" por item, resumo do plano, **corrige o off-by-one da data exibida**; aceita `initialSchedule` |
| `src/components/reverse-schedule.tsx` | Copy alinhada ao novo comportamento |
| `scripts/schedule-plan-tests.ts` (novo) | 1482 verificações puras dos invariantes (sem banco) |
| `scripts/schedule-tests.ts` (novo) | Harness end-to-end no banco real (6 testes, usuário descartável) |
| `scripts/schedule-ui-tests.tsx` (novo) | Render real do componente do cliente (10 verificações) |
| `scripts/tsconfig.ui-tests.json` (novo) | `jsx: react-jsx` para o harness de render |

**Decisões do maestro:** derivar a marcação na leitura (sem migration no
Neon) · revisão final cobre todos os assuntos · dia vazio vira revisão
intermediária.

**Verificação:** `npx tsc --noEmit` limpo · `npm run lint` sem warnings novos ·
`npm run build` ok · harness do cronograma 7/7 · testes puros 1482/1482 ·
render 12/12 · harness A–M 19/19 (sem regressão) · smoke de runtime em
`/edital` autenticado (200 com o plano salvo) e sem assinatura (307 → upgrade).

**Recarga do cronograma salvo (mesmo dia):** `/edital` passou a buscar o
`StudySchedule` mais recente e passar para `EditalClient` via
`initialSchedule`; a página usa `requireActiveSubscriptionForPage()` (padrão
do `/gerenciador`) porque o recurso é premium. Título da tela trocado para
"Cronograma do Edital" (vale tanto para o plano recém-gerado quanto para o
recarregado) e o resumo passou a mostrar "criado em".

## 2026-10-20 — Agendamento manual de revisões (Gerenciador)

**Por quê:** `scheduleTopicReviews()` só usava `reviewDays[0]`; os arrays
`[1,7,15]` e `[2,2,2,2]` eram decorativos. Nenhum `ReviewCycle`/`ScheduledReview`
era criado, então os dias 7 e 15 (e +2/+4/+6/+8) não existiam em lugar nenhum —
nem na fila, nem no calendário. A UI prometia um cronograma que o banco não tinha.

**O que mudou:**

| Arquivo | Mudança |
|---|---|
| `src/lib/srs-review-utils.ts` | `resolveManualSchedule()` (planos `offset`/`step`, datas distintas); `ActiveCycleInfo.initialEvaluationCompleted` + `.schedule`; `deriveReviewState` trata ciclo pré-agendado como "aguardando avaliação" |
| `src/lib/study-sessions/actions.ts` | `scheduleTopicReviews` grava `ReviewCycle` + uma `ScheduledReview` por dia, em transação por card; pula card com ciclo ativo; devolve `{ created, skipped, failed }`; `safeRevalidate` |
| `src/lib/srs.ts` | `adoptPreScheduledCycle()` — a classificação adota o ciclo pré-agendado preservando as datas; revisões vencidas são consumidas; `classifyAndCreateCycle` deixa de lançar no ciclo pré-agendado; `ensureProgressCardsForFlashcards` passa o cronograma persistido |
| `src/app/flashcards/page.tsx` | Fila passa a carregar `initialCycleEvaluationCompleted` e as `ScheduledReview` do ciclo ativo |
| `src/components/srs-review-session.tsx` | Preview do ciclo usa o cronograma **persistido** (fallback: derivado da dificuldade) |
| `src/app/gerenciador/client.tsx` | Toast reporta o resumo real; rótulo "Ciclo Padrão SRS" → "Revisão Padrão" |
| `scripts/srs-tests-a-k.ts` | Bloco M (M1–M7): resolução do plano, estado, criação do ciclo, datas, skip, adoção, consumo de vencidas |

**Decisões do maestro:** adotar (preservar datas) · `[2,2,2,2]` = passos de 2 dias ·
não mexer em card com ciclo ativo.

**Verificação:** `npx tsc --noEmit` limpo · `npm run lint` sem erros novos ·
`npm run build` ok · harness A–M 19/19.
