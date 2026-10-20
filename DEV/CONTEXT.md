# CONTEXTO — Edcards

Next.js 14 (App Router) + Prisma 6 + Postgres (Neon) + Supabase Auth + Sentry.
Server Actions em `src/lib/**/actions.ts` com `"use server"`.

## Regras que valem para TODO o código

1. **Identidade nunca vem do cliente.** Toda action deriva o usuário de
   `ensureUserExists()` (sessão) e de `requireActiveSubscriptionForAction()`.
   `userId` vindo do cliente é bug (já houve IDOR).
2. **Propriedade sempre validada no servidor**, não só na UI.
3. `revalidatePath` fora de um request lança → usar `safeRevalidate` (ver `lib/srs.ts`).
4. TypeScript strict, sem `any`; comandos de gate: `npx tsc --noEmit`, `npm run lint`, `npm run build`.

## SRS — como o "quando revisar" é decidido

Três fontes, e elas precisam concordar:

| Fonte | Escrita por | Lida por |
|---|---|---|
| `ProgressCard.nextReviewDate` | ações de revisão | fila do `/flashcards`, "próximas revisões" |
| `ScheduledReview.scheduleDate` | criação de ciclo | **calendário** do dashboard, `completeCycleReview` |
| `CYCLES[classification]` (derivada) | — | preview do cliente (`buildReviewSchedule`) |

`CYCLES` é **não-cumulativa**: HARD = +1, +2, +7, +30, +60, +90 dias a partir da
data-base. A mesma convenção vale para o agendamento manual (`offset`).

## Máquina de estados do card

Definida em `deriveReviewState` (`src/lib/srs-review-utils.ts`) — fonte única,
usada pela UI e pelos testes A–M:

```
FIRST_RESOLUTION → AGUARDANDO_AVALIACAO_24H → CICLO_ATIVO → ULTIMA_REVISAO
                                                              → CICLO_FINALIZADO (renovar)
CONSULTA: qualquer estado + isQuizMode → nenhuma escrita
```

## Armadilhas conhecidas

- **`initialCycleEvaluationCompleted`** é o discriminador entre "ciclo do SRS"
  (nascido de uma classificação, `true`) e "ciclo pré-agendado" pelo Gerenciador
  (`false`). Todo comportamento novo do agendamento manual fica atrás dele —
  ciclos do SRS seguem exatamente como antes.
- `ProgressCard.flashcardId` é `@unique`: existe **um** ProgressCard por
  flashcard, globalmente (não por perfil). `scheduleTopicReviews` usa o
  `profileId` do próprio ProgressCard ao criar o ciclo.
- `ScheduledReview` tem `@@unique([cycleId, order])` e `order` é 1-based.
- O índice do array de revisões é `order - 1`: o preview usa
  `plan[currentReview - 1]` para a revisão atual e `plan[currentReview]` para a
  seguinte.
- `skipFlashcard` move a **primeira pendente** (order asc) — revisões vencidas
  precisam estar marcadas como concluídas para não "roubar" a fila.
- Scripts em `scripts/` rodam contra o **banco real**; o harness A–M cria e
  apaga um usuário descartável.
