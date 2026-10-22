# HANDOFF

## Estado atual

A correção da **reorganização da fila** ("Organizar cards atrasados") está
implementada e verificada (ver `SPECS/ACTIVE.md` e `VERIFY.md`). Nada foi
commitado — a validação humana do diff é o próximo passo.

Diff em 4 arquivos de código + 1 de teste (+ `DEV/`). **Sem migration**: o
filtro de ciclo usa o `ReviewCycle.status` que já existe.

O trabalho anterior (cronograma reverso / Edital Fechado) segue implementado e
verificado. Spec arquivada em `SPECS/2026-10-20-cronograma-reverso.md`.

## O que o próximo agente precisa saber

1. **A fila do SRS lê `ProgressCard.nextReviewDate`** — não
   `Flashcard.nextReview`. O segundo é só o espelho dos badges de "devidos"
   (`/dashboard/flashcards` dueCount, `/dashboard/configuracoes` cardsDue).
   Escrever só no espelho move o badge e **não** move a fila.
2. **Card com `ReviewCycle` ACTIVE: a data não é livre.** `nextReviewDate`
   espelha a `ScheduledReview` pendente. Reescrever essa data dessincroniza a
   fila do cronograma persistido e quebra os intervalos do ciclo
   (HARD = +1, +2, +7, +30, +60, +90 dias). A reorganização preserva esses
   cards e devolve `skippedActiveCycles`.
3. **A lógica da reorganização mora em `src/lib/flashcards/organize-core.ts`**
   (não é Server Action). `organize-actions.ts` e `organize.ts` são wrappers
   (sessão/assinatura/revalidação). Não replique a lógica em outro lugar.
4. **A paginação usa cursor em `id`**, nunca em `nextReviewDate`: `id` não é
   mutado pela operação, então a posição do cursor é estável entre páginas.
   Se alguém ordenar a leitura por um campo mutado, a paginação quebra.
5. **O `updateMany` repete o filtro de ciclo** (`reviewCycles: { none: {
   status: "ACTIVE" } }`) de propósito: é a rede de segurança para card que
   entrou em ciclo entre a leitura e a escrita.
6. **`difficultyStage` é String livre** — ordenar por ele como string dá
   `"MEDIUM" > "HARD" > "EASY"`, o oposto do pretendido. O rank explícito
   está em `DIFFICULTY_RANK` (`organize-core.ts`).
7. **O perfil ativo tem uma regra só** e a fila e a reorganização precisam
   seguir a mesma: `activeProfileId || isActiveProfile || profiles[0]`
   (`upcoming-actions.ts` e `organize-actions.ts`).

## Riscos / pendências conhecidas

- **`Flashcard.nextReview` é global, não por perfil.** `ProgressCard.flashcardId`
  é `@unique` (um progress card por flashcard, globalmente), então na prática
  não há divergência entre perfis — mas o espelho continua sendo herança do
  schema, mantida por compatibilidade com todos os outros escritores do SRS.
- **Card com ciclo encerrado não volta para a fila.**
  `queueFilterWithoutCompletedOnly()` exclui card que só tem ciclos
  `COMPLETED`; reorganizá-lo é inócuo (a renovação sobrescreve a data) mas ele
  não reaparece como atraso.
- **`organize-button.tsx` continua sem uso** em qualquer página (morto desde
  sempre). Agora aponta para o wrapper deprecated `redistributeOverdueCards`.
  Pode ser apagado junto com `organize.ts` se ninguém quiser o caminho legado.
- **`scheduleTopicReviews` cria ciclo ACTIVE pré-agendado**
  (`initialCycleEvaluationCompleted = false`). Ele conta como "ciclo ativo" e
  portanto é preservado pela reorganização — que é o correto: as datas são
  escolhidas pelo usuário.
- A migration antiga continua pendente de criação no repositório
  (`ScheduleItem`/`StudySchedule` foram criados por `prisma db push`).

## Como validar de novo

```powershell
npx tsc --noEmit
npm run lint
npm run build
npx tsx scripts/srs-tests-a-k.ts      # A–M (19 testes, banco real)
npx tsx scripts/organize-tests.ts     # O1–O9 (banco real)
npx tsx scripts/schedule-plan-tests.ts
npx tsx scripts/schedule-tests.ts
npx tsx --tsconfig scripts/tsconfig.ui-tests.json scripts/schedule-ui-tests.tsx
```

Os harnesses que tocam o banco exigem `DATABASE_URL` (Neon) e criam/apagam
usuários de teste.
