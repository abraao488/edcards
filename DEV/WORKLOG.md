# WORKLOG

## 2026-10-22 — Baseline de migrations (fecha P0.1 da auditoria)

**Por quê:** o banco de produção foi construído via `prisma db push` (sem
histórico) e as 5 migrations existentes eram **incrementais** — nenhuma criava
as ~21 tabelas base. Resultado: `prisma migrate deploy` falhava em banco novo
(`relation "Subscription" does not exist`) e `_prisma_migrations` não existia
em produção. Nenhum ambiente novo (preview, CI, DR, outra máquina) podia ser
provisionado.

**Decisão do maestro:** **baseline consolidado único** — substituir as 5
incrementais por UMA migration gerada do `schema.prisma` atual. Garante casar
100% com produção (auditoria já provou drift zero) e `migrate deploy` num banco
novo reproduz o schema inteiro. (Alternativa descartada: reconstruir o schema
"antes das 5" — maior risco de divergência sutil de defaults/ordem.)

**O que mudou:**

| Arquivo | Mudança |
|---|---|
| `prisma/migrations/20260902_add_pix_fields_to_subscription/` (removido) | Incremental — conteúdo absorvido pelo baseline |
| `prisma/migrations/20260902_add_session_history_fields/` (removido) | Idem |
| `prisma/migrations/20260902_add_user_id_to_subject/` (removido) | Idem |
| `prisma/migrations/20261012_add_pending_mercadopago_id/` (removido) | Idem |
| `prisma/migrations/20261019_add_growth_features/` (removido) | Idem |
| `prisma/migrations/20261022_000000_baseline/migration.sql` (novo) | Baseline gerado via `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script` (UTF-8 sem BOM). Cria todas as tabelas/enums/índices/FKs do schema atual. |

Nenhum `src/` nem `schema.prisma` foi alterado.

**Procedimento (testado em descartável ANTES de tocar em produção):**

1. Removidas as 5 incrementais; baseline gerado (encoding UTF-8 — o redirect
   do PowerShell `>` gera UTF-16 com BOM, que quebra o driver; gerado via Node
   `writeFileSync(..., 'utf8')`).
2. **Teste 1 (banco novo vazio):** `prisma migrate deploy` → aplicou o baseline
   com sucesso; `migrate diff --from-url <novo> --to-schema-datamodel` → *"No
   difference detected"* (schema novo == schema.prisma == produção).
3. **Teste 2 (simula produção):** banco descartável com o schema aplicado
   manualmente (`db execute` do baseline, sem `_prisma_migrations`) →
   `migrate resolve --applied 20261022_000000_baseline` (marcou, sem DDL) →
   `migrate deploy` → *"No pending migrations to apply"* → `migrate status` →
   *"Database schema is up to date!"*.
4. **Produção real:** `prisma migrate resolve --applied
   20261022_000000_baseline` (sem DDL) → `prisma migrate status` → *"Database
   schema is up to date!"*. Confirmei drift zero produção↔schema ANTES de
   resolver (`migrate diff --from-url <prod> --to-schema-datamodel` → *"No
   difference detected"*).

**Verificação:** Teste 1 e 2 verdes no descartável; produção com histórico
registrado e schema intocado; 7 bancos descartáveis removidos com `DROP
DATABASE ... WITH (FORCE)`; `npx tsc --noEmit` 0 erros (nenhum `src/` mudou).

## 2026-10-22 — Auditoria de prontidão do projeto inteiro

**Por quê:** o maestro pediu uma verificação completa ("está pronto agora ou
falta alguma coisa?"). A resposta curta: **o código está pronto e funcionando,
mas não está pronto para produção** — falta o histórico de migrations e o
upgrade do Next.js (2 advisories críticos).

**O que mudou:** nenhum arquivo de `src/` foi alterado. A auditoria só produziu
documentação:

| Arquivo | Mudança |
|---|---|
| `DEV/BACKLOG/PRONTIDAO.md` (novo) | Backlog priorizado (2×P0, 3×P1, 4×P2) com evidência reproduzível de cada item |
| `DEV/VERIFY.md` | Seção "Auditoria de prontidão" com todas as evidências (gates, harnesses, banco, runtime, integrações, produção, higiene, dependências) |
| `DEV/HANDOFF.md` | Bloco "O que falta para estar pronto" + riscos atualizados |
| `DEV/README.md` | Índice atualizado com `BACKLOG/PRONTIDAO.md` |

**Verificação (tudo executado, tudo verde):** `npx tsc --noEmit` 0 erros ·
`npm run lint` 0 erros (3 warnings pré-existentes) · `npm run build` ok ·
harnesses **1535/1535** (SRS 19/19 · reorganização 9/9 · cronograma 1482/1482 ·
render 12/12 · cronograma e2e 7/7 · webhook MP 6/6) · `prisma migrate diff`
**sem drift** entre `schema.prisma` e o banco de produção · runtime real
(`next start`): 10 rotas públicas 200, 8 protegidas 307→login, **15 protegidas
com sessão real 200 sem erro de render** · integrações externas Groq/MP/
Supabase/Sentry respondendo 200 · site no ar em `www.edcards.com.br` (Vercel).

**Duas pendências reais (com prova, não opinião):**

1. **`prisma migrate deploy` não reproduz o schema.** As 5 migrations em
   `prisma/migrations/` são incrementais e nenhuma cria as 20 tabelas base; a
   tabela `_prisma_migrations` nem existe no banco de produção. Provado com
   uma sonda em banco vazio do mesmo projeto Neon: `ERROR: relation
   "Subscription" does not exist`. A sonda foi removida; produção não foi
   tocada.
2. **`next@14.2.35` tem 2 advisories críticos** (RCE na Image Optimization com
   AVIF; RCE em servidor Windows) e `14.2.35` é a última versão da linha 14 —
   o conserto exige major (>=15.5.24). `npm audit --omit=dev` → 23
   vulnerabilidades (2 críticas, 15 altas, 6 moderadas).

## 2026-10-22 — Reorganização da fila: campo certo, ciclo ativo preservado, sem take:200

**Por quê:** "Organizar cards atrasados" escrevia em `Flashcard.nextReview`
(campo que a fila do SRS **não** lê — só movia badges), reescrevia a
`ProgressCard.nextReviewDate` de card com `ReviewCycle` ACTIVE (dessincronizando
a fila do cronograma persistido) e truncava em `take: 200` sem paginação
(cards além disso nunca eram reorganizados).

**O que mudou:**

| Arquivo | Mudança |
|---|---|
| `src/lib/flashcards/organize-core.ts` (novo) | Núcleo (não é Server Action): leitura paginada por cursor em `id` **sem teto**; filtro `reviewCycles: { none: { status: "ACTIVE" } }` na leitura e dentro do `updateMany` (rede de segurança contra corrida); prioridade HARD → MEDIUM → EASY (rank explícito — `orderBy` de string dava o inverso); 5/dia; escrita em lote por data alvo (2 `updateMany` por data) em transações de 100 datas |
| `src/lib/flashcards/organize-actions.ts` | Perfil resolvido com a **mesma** regra da fila (`activeProfileId \|\| isActiveProfile \|\| profiles[0]`); `safeRevalidate`; devolve `{ count, skippedActiveCycles }`; N+1 → lote |
| `src/lib/flashcards/organize.ts` | Wrapper `@deprecated` da mesma implementação (escreve no campo certo; era `take: 200` + campo errado) |
| `src/app/organizar/client.tsx` | Reporta quantos cards ficaram preservados por estar em ciclo ativo |
| `scripts/organize-tests.ts` (novo) | 9 testes no banco real: sem ciclo, ciclo ativo, ciclo encerrado, contagem, paginação (250 cards), prioridade, fila, propriedade, Server Action |

**Verificação:** `npx tsc --noEmit` limpo · `npm run lint` sem warnings novos ·
`npm run build` ok · harness A–M **19/19** (inalterado) · harness da
reorganização **9/9** · cronograma 1482/1482 e 7/7 · os 2 testes novos foram
provados capable de falhar (revertendo o guard do ciclo → O2/O4/O7/O9 falham;
revertendo a paginação → O5 falha).

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
`npm run build` ok · harness A–M 19/19.## 2026-10-22 — Ajustes P1 da auditoria (sanitize-html + rotas Sentry de teste)
- **Mudança:** sanitize-html atualizado de 2.17.7 para 2.18.1 (npm install). Removidas src/app/sentry-example-page/ e src/app/api/sentry-example-api/ e retirado /sentry-example-page de publicPaths em src/middleware.ts. 
- **Motivo:** P1.1/P1.2 da auditoria de prontidão para produção (corrigir advisories de XSS em sanitize-html, remover rota de teste exposta em produção que lança 500 de propósito).
- **Verificação:** 
pm ls sanitize-html → 2.18.1. 
pm audit: total 28→25; vulnerabilidades de sanitize-html removidas da lista. 
px tsc --noEmit 0 erros; 
pm run lint 0 erros; 
pm run build ok (sem /sentry-example-page//api/sentry-example-api).
- **Próximo:** Restam P0 (migrations reproduzíveis / Next 14.2.35 com 2 advisories críticos) e P1.3 (CI + .env.example). P1.1 e P1.2 fechados.

