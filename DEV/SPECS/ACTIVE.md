# SPEC ATIVA — Reorganização da fila: campo certo, ciclo ativo preservado, sem take:200

Status: **implementada e verificada** (2026-10-22)
Área: `src/lib/flashcards/organize-core.ts` (novo),
`src/lib/flashcards/organize-actions.ts`, `src/lib/flashcards/organize.ts`,
`src/app/organizar/client.tsx`, `scripts/organize-tests.ts` (novo)

## Problema

A ação "Organizar cards atrasados" (`/organizar`) escrevia no campo errado e
quebrava o cronograma de cards que já estavam em ciclo.

## Causa raiz

O sistema tem **duas** datas paralelas e elas precisam concordar:

| Campo | Papel | Lido por |
|---|---|---|
| `ProgressCard.nextReviewDate` | **verdade da fila** | fila do SRS (`/dashboard/flashcards/[deckId]`, `getReviewQueueCount`, `getUpcomingFlashcards`, métricas do dashboard) |
| `Flashcard.nextReview` | espelho denormalizado | só badges de "devidos" (`/dashboard/flashcards` dueCount, `/dashboard/configuracoes` cardsDue) |

Para card **com ciclo ativo**, `nextReviewDate` NÃO é uma data livre: ela
espelha a `ScheduledReview` pendente (o cronograma persistido é a verdade —
`createCycleInternal`, `completeCycleReview`, `adoptPreScheduledCycle` e
`skipFlashcard` em `src/lib/srs.ts` mantêm esse invariante).

### Os quatro defeitos

1. **`organize.ts` escrevia no espelho, não na verdade.** `redistributeOverdueCards()`
   lia e escrevia `Flashcard.nextReview`. A fila do SRS lê
   `ProgressCard.nextReviewDate` → o efeito real era só mover os badges
   enquanto a fila continuava intacta. A ação "não reorganizava nada de útil".
2. **`organize-actions.ts` reescrevia a data de card em ciclo ativo.** Sem
   filtro por `ReviewCycle.status`, cards com ciclo ACTIVE entravam na
   redistribuição; a `nextReviewDate` deixava de espelhar a `ScheduledReview`
   pendente → fila e cronograma dessincronizados e intervalos do ciclo
   (HARD = +1, +2, +7, +30, +60, +90 dias) quebrados.
3. **`take: 200` sem paginação e sem `orderBy`.** Cards além dos 200
   primeiros nunca eram reorganizados, e *quais* 200 vinham era
   não-determinístico (sem ordenação).
4. **Perfil divergente da fila.** A ação resolvia o perfil por
   `isActiveProfile: true`; a fila resolve por `activeProfileId || isActiveProfile ||
   profiles[0]`. Podia reorganizar o perfil errado.

### Defeitos secundários encontrados no caminho

- **Prioridade invertida:** `orderBy: { difficultyStage: "desc" }` ordena a
  *string*, e `"MEDIUM" > "HARD" > "EASY"` — o oposto do comentário
  ("HARD comes first"). Agora há rank explícito.
- **N+1 sem transação:** `organize-actions.ts` fazia um `update` por card, um
  por round-trip, sem transação (falha no meio deixava a fila meio
  reorganizada).

## Decisões (maestro)

| Decisão | Escolha |
|---|---|
| Escopo da reorganização | só card **sem ciclo ativo** (ou com ciclo já encerrado) |
| Card em ciclo ativo | **preservado** e reportado (`skippedActiveCycles`) |
| `organize.ts` | **redirecionado** (wrapper da mesma implementação), não removido |
| Leitura | paginação por cursor em `id`, **sem teto** |
| Escrita | lote por data alvo (`updateMany`), em transação |

## Escopo entregue

- `src/lib/flashcards/organize-core.ts` (novo, **não** é Server Action):
  - leitura paginada por cursor em `id` (`id` nunca é mutado → a posição do
    cursor é estável entre páginas; `nextReviewDate`, que é mutado, ficou
    fora da ordenação);
  - filtro `reviewCycles: { none: { status: "ACTIVE" } }` na leitura **e**
    dentro do `updateMany` (rede de segurança contra corrida: card que entrou
    em ciclo entre a leitura e a escrita é preservado de novo);
  - prioridade HARD → MEDIUM → EASY, depois o mais atrasado primeiro, `id`
    desempata (determinismo);
  - 5 cards/dia a partir de hoje; escrita agrupada por data alvo (um
    `updateMany` de `ProgressCard` + o espelho `Flashcard.nextReview` por
    data), em transações de até 100 datas.
- `src/lib/flashcards/organize-actions.ts`: perfil resolvido com a **mesma**
  regra da fila; `safeRevalidate`; devolve `{ count, skippedActiveCycles }`.
- `src/lib/flashcards/organize.ts`: wrapper `@deprecated` da mesma
  implementação (uma única fonte de verdade, campo certo).
- `src/app/organizar/client.tsx`: reporta quantos cards foram preservados.
- `scripts/organize-tests.ts` (novo): 9 testes no banco real.

## Critérios de aceite

- [x] Card sem ciclo e atrasado é reprogramado (5/dia, HARD primeiro).
- [x] Card com `ReviewCycle` ACTIVE **nunca** é tocado: `nextReviewDate`
      continua espelhando a `ScheduledReview` pendente.
- [x] Card com ciclo já encerrado pode ser reorganizado (o ciclo continua
      `COMPLETED`).
- [x] `skippedActiveCycles` conta exatamente os cards preservados.
- [x] **Todos** os cards atrasados são reorganizados (250 no teste, o teto
      antigo era 200).
- [x] `Flashcard.nextReview` (espelho) acompanha o `nextReviewDate` — badge e
      fila não divergem.
- [x] Card de outro usuário não é tocado.
- [x] Prioridade HARD antes de MEDIUM/EASY.
- [x] Harness do SRS (A–M) inalterado: **19/19**.

## Fora de escopo

- **Sem migration.** Nenhuma coluna nova; o filtro de ciclo usa o
  `ReviewCycle.status` que já existe.
- `Flashcard.nextReview` continua sendo um espelho **global** (não é por
  perfil) — herança do schema, mantida por compatibilidade com todos os
  outros escritores do SRS (`submitFirstReview`, `classifyAndCreateCycle`,
  `completeCycleReview`, `skipFlashcard`, `scheduleTopicReviews`).
- Card com ciclo encerrado não volta para a fila: `queueFilterWithoutCompletedOnly()`
  exclui card que só tem ciclos `COMPLETED`. Reorganizá-lo é inócuo (a
  renovação sobrescreve a data) — mas ele **não** reaparece como atraso.
- `organize-button.tsx` continua sem uso em nenhuma página (componente morto
  desde sempre); agora ele aponta para o wrapper deprecated.
