# HANDOFF

## Estado atual

**O código está pronto e funcionando; o projeto ainda NÃO está pronto para
produção.** Auditoria de 2026-10-22 (evidências em `VERIFY.md`, pendências
priorizadas em `BACKLOG/PRONTIDAO.md`).

Tudo que é código está verde: `tsc` 0 erros · `lint` 0 erros (3 warnings
pré-existentes) · `build` ok · **1535/1535** verificações de teste (6
harnesses, banco real) · schema sem drift em relação ao banco de produção ·
runtime real com **15/15 rotas autenticadas em 200 sem erro de render** ·
Groq/Mercado Pago/Supabase/Sentry respondendo 200 · site no ar em
`www.edcards.com.br` (Vercel).

O que falta é **1 item P0 (Next.js) e 3 itens P1** — nenhum deles exige mexer na
lógica de negócio:

| # | Pendência | Impacto |
|---|---|---|
| P0.1 | ~~Histórico de migrations não reproduzível~~ **FEITO (2026-10-22)** — baseline consolidado único; `migrate deploy` reproduz o schema num banco novo e produção tem histórico (via `resolve --applied`, sem DDL) | Ambientes novos agora provisionáveis com `prisma migrate deploy` |
| P0.2 | **`next@14.2.35` com 2 advisories críticos** (RCE na Image Optimization com AVIF; RCE em servidor Windows). `14.2.35` é a última da linha 14 | Conserto exige major (`>=15.5.24`): React 19, `cookies()`/`headers()` async, `params` async |
| P1.1 | `sanitize-html@2.17.7` → **2.18.1** (3 advisories de XSS) | **FEITO** (2026-10-22) — atualizado, advisories resolvidos |
| P1.2 | `/sentry-example-page` e `/api/sentry-example-api` no ar em produção (o segundo lança 500 de propósito) | **FEITO** (2026-10-22) — removidos, fora do middleware |
| P1.3 | Sem CI (`.github/` não existe) e sem `.env.example` | Nada trava build quebrado; deployer novo não tem contrato de env |

O `SPECS/ACTIVE.md` (reorganização da fila) continua implementado e verificado.
A auditoria **não mudou nenhum arquivo de `src/`**.


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
- ~~A migration antiga continua pendente de criação no repositório
  (`ScheduleItem`/`StudySchedule` foram criados por `prisma db push`).~~
  **Resolvido pela baseline de 2026-10-22:** `prisma/migrations/` agora tem um
  baseline consolidado único (`20261022_000000_baseline`) que cria todas as
  tabelas; produção e bancos novos têm histórico reproduzível.

## O que falta para estar pronto (auditoria de 2026-10-22)

Lista completa e priorizada em **`BACKLOG/PRONTIDAO.md`**. Resumo:

**P0**
1. ~~**Histórico de migrations**~~ **FEITO** (2026-10-22) — baseline consolidado
   único; `prisma migrate deploy` reproduz o schema em banco novo, produção com
   histórico via `resolve --applied`.
2. **Next.js 14.2.35 → >= 15.5.24** — 2 advisories críticos (RCE na Image
   Optimization com AVIF; RCE em servidor Windows). É major: React 19,
   `cookies()`/`headers()`/`params` async. **Não cabe num patch** — planejar
   como trabalho próprio, com os gates da DEV.

**P1**
3. ~~`npm i sanitize-html@2.18.1` (patch, sem breaking).~~ **FEITO** (2026-10-22).
4. ~~Apagar `src/app/sentry-example-page/` e `src/app/api/sentry-example-api/`
   (e tirar `/sentry-example-page` de `publicPaths` no `src/middleware.ts`).~~ **FEITO** (2026-10-22).
5. CI (`.github/workflows/`) com `tsc` + `lint` + `build` +
   `scripts/schedule-plan-tests.ts` (puro, sem banco) + `.env.example`.

**P2**
6. Rate limit de auth em memória → contador persistente (o limite diário de IA
   já é persistente no Postgres — não mexer nele).
7. Apagar `src/components/organize-button.tsx` + `src/lib/flashcards/organize.ts`
   (código morto).
8. README próprio (hoje é o padrão do `create-next-app`).
9. Webhook MP loga `external_reference` (= `userId`) em texto claro.

## Como validar de novo

```powershell
npx tsc --noEmit
npm run lint
npm run build
npx tsx scripts/srs-tests-a-k.ts      # A-M (19 testes, banco real)
npx tsx scripts/organize-tests.ts     # O1-O9 (banco real)
npx tsx scripts/schedule-plan-tests.ts
npx tsx scripts/schedule-tests.ts
npx tsx --tsconfig scripts/tsconfig.ui-tests.json scripts/schedule-ui-tests.tsx
npx tsx scripts/mp-webhook-tests.ts   # 6 testes do webhook do Mercado Pago
```

Os harnesses que tocam o banco exigem `DATABASE_URL` (Neon) e criam/apagam
usuários de teste.

Smoke de runtime (servidor real, não build):

```powershell
npm run build
npx next start -p 3111
# rotas públicas -> 200; protegidas sem sessão -> 307 /login
```