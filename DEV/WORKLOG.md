# WORKLOG

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
