# VERIFY

Evidências por mudança. Só registre aqui o que foi **executado** e o resultado real.

## 2026-10-22 — Baseline de migrations (fecha P0.1)

| Verificação | Comando | Resultado |
|---|---|---|
| Drift produção ↔ schema (antes) | `prisma migrate diff --from-url <produção> --to-schema-datamodel prisma/schema.prisma --exit-code` | **No difference detected** (exit 0) — baseline bate com produção |
| Baseline gerado | `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script` (UTF-8 sem BOM) | `prisma/migrations/20261022_000000_baseline/migration.sql` (18 023 chars) |
| **Teste 1 — deploy em banco novo vazio** | `prisma migrate deploy` (banco descartável recém-criado) | **sucesso** — "All migrations have been successfully applied" |
| Teste 1 — schema reproduzido | `prisma migrate diff --from-url <novo> --to-schema-datamodel prisma/schema.prisma --exit-code` | **No difference detected** (exit 0) |
| **Teste 2 — simula produção** (schema existe, sem `_prisma_migrations`) | `db execute` do baseline (schema manual) → `migrate resolve --applied 20261022_000000_baseline` | **"marked as applied"** (sem DDL) |
| Teste 2 — deploy vira no-op | `prisma migrate deploy` | **"No pending migrations to apply"** |
| Teste 2 — status | `prisma migrate status` | **"Database schema is up to date!"** |
| **Produção real** | `prisma migrate resolve --applied 20261022_000000_baseline` (sem DDL) | **"marked as applied"** |
| Produção — status final | `prisma migrate status` | **"Database schema is up to date!"** (1 migration, `_prisma_migrations` criada) |
| Gate de tipos | `npx tsc --noEmit` | **0 erros** (nenhum `src/` alterado) |

7 bancos descartáveis usados nos testes foram removidos com
`DROP DATABASE ... WITH (FORCE)`. Produção: schema intocado, apenas histórico
registrado.

## 2026-10-22 — Auditoria de prontidão (projeto inteiro)

Auditoria completa do repositório: gates, harnesses, banco real, runtime
(servidor Next de verdade), integrações externas e dependências.
Resultado e pendências: `BACKLOG/PRONTIDAO.md`.

### Gates

| Gate | Comando | Resultado |
|---|---|---|
| Tipos | `npx tsc --noEmit` | **sem saída (0 erros)** |
| Lint | `npm run lint` | **0 erros**; 3 warnings pré-existentes (`configuracoes/client.tsx`, `profile-form.tsx`, `public-deck-view.tsx`) |
| Build | `npm run build` | **ok** — 35 rotas, 30 páginas, prisma generate + next build |

### Harnesses (banco real Neon, usuários descartáveis)

| Harness | Comando | Resultado |
|---|---|---|
| SRS A–M | `npx tsx scripts/srs-tests-a-k.ts` | **19/19** |
| Reorganização O1–O9 | `npx tsx scripts/organize-tests.ts` | **9/9** |
| Política do cronograma (puro) | `npx tsx scripts/schedule-plan-tests.ts` | **1482/1482** |
| Render da tela do cronograma | `npx tsx --tsconfig scripts/tsconfig.ui-tests.json scripts/schedule-ui-tests.tsx` | **12/12** |
| Cronograma end-to-end | `npx tsx scripts/schedule-tests.ts` | **7/7** |
| Webhook Mercado Pago | `npx tsx scripts/mp-webhook-tests.ts` | **6/6** |

Total: **1535 verificações, 0 falhas**.

**Efeito colateral verificado:** 0 usuários `@edcards.test` / `test-*` /
`test-organize-*` sobraram no banco depois de todos os harnesses.

### Banco de dados (produção)

| Verificação | Comando | Resultado |
|---|---|---|
| Drift schema ↔ banco | `prisma migrate diff --from-url <produção> --to-schema-datamodel prisma/schema.prisma` | **No difference detected** — `schema.prisma` == banco real |
| Histórico de migrations | `prisma migrate status` | **5 migrations "not yet been applied"** — a tabela `_prisma_migrations` **não existe** no banco |
| Reprodução do schema | `prisma migrate deploy` contra banco vazio de sondagem (criado e removido no mesmo projeto Neon) | **FALHA**: `ERROR: relation "Subscription" does not exist` (42P01) — as 5 migrations são incrementais e **nenhuma cria as 21 tabelas base** |

> A sonda (`edcards_migrate_probe`) foi removida no final. O banco de produção
> (`neondb`) não foi tocado.

### Runtime (servidor Next real, `next start` na porta 3111)

| Cenário | Resultado |
|---|---|
| 10 rotas públicas (`/`, `/login`, `/register`, `/termos`, `/privacidade`, `/reembolso`, `/recuperar-senha`, `/decks`, `/robots.txt`, `/sitemap.xml`) | **200** em todas |
| `/d/inexistente-xyz` | **404** (correto) |
| 8 rotas protegidas sem sessão | **307 → `/login`** (middleware ok), sem 500 |
| 15 rotas protegidas **com sessão real** (usuário descartável no Supabase + assinatura ACTIVE no Prisma) | **200 em todas**, nenhum erro de render (`Application error` / `Unhandled Runtime Error` ausentes no HTML): `/dashboard`, `/dashboard/flashcards`, `/dashboard/questoes`, `/dashboard/questoes/simulado`, `/dashboard/configuracoes`, `/dashboard/convite`, `/dashboard/materiais`, `/flashcards`, `/organizar`, `/edital`, `/gerenciador`, `/materias`, `/decks`, `/bem-vindo`, `/criar-com-edcards` |
| `/dashboard/subjects` | **307 → `/materias`** — redirect intencional (`page.tsx` chama `redirect()`), não é falha |
| `/api/study-sessions`, `/api/webhooks/mercadopago` (GET) | **405** — rejeitam método inválido |
| `/api/sentry-example-api` | **500 proposital** (rota temporária de teste — ver backlog) |

O usuário de teste foi removido do Supabase e do Prisma no final.

### Integrações externas (chamada real, somente leitura)

| Integração | Verificação | Resultado |
|---|---|---|
| Groq (IA) | `GET /openai/v1/models` | **200** — `GROQ_API_KEY` válida |
| Mercado Pago | `GET /users/me` | **200** — token válido |
| Supabase Auth | `GET /auth/v1/health` | **200** |
| Sentry | DSN `NEXT_PUBLIC_SENTRY_DSN` | formato válido (`...@o4512251111538688.ingest.us.sentry.io/4512251145355264`) |

### Produção no ar (Vercel)

`https://edcards.com.br` → 308 → `https://www.edcards.com.br` (Vercel, Linux).
Rotas checadas no ar: `/` 200, `/login` 200, `/termos` 200, `/privacidade` 200,
`/d/inexistente` 404, `/dashboard` 307, `/organizar` 307, `/edital` 307.
O build publicado é o mesmo do repositório (`/sentry-example-page` 200 e
`/api/sentry-example-api` 500 também estão no ar).

### Higiene do código

| Verificação | Resultado |
|---|---|
| `TODO` / `FIXME` / `stub` / `mock` / `em breve` em `src/` | **0** — as 91 ocorrências de "placeholder" são atributos HTML `placeholder=` |
| `console.log` / `debugger` residuais | 13 `console.log` (11 no webhook MP — logs operacionais; 1 em `subscription-status-sync.tsx`; 1 em `mercadopago/actions.ts`) · 0 `debugger` |
| Links internos (`href="/..."`) apontando para rota inexistente | **0** (os grupos `(auth)`/`(legal)` resolvem para `/login`, `/register`, `/termos`, `/privacidade`, `/reembolso`, `/recuperar-senha` — todos confirmados 200) |
| Componentes mortos | `src/components/organize-button.tsx` — **0 referências** (aponta para wrapper deprecated) |
| `.env` versionado | **não** (`.env` no `.gitignore`; `git ls-files` não lista nenhum arquivo de env) |

### Dependências

`npm audit --omit=dev` → **23 vulnerabilidades (2 críticas, 15 altas, 6 moderadas)**.
Detalhe em `BACKLOG/PRONTIDAO.md`. Críticas: `next@14.2.35` (RCE na Image
Optimization API com AVIF — `GHSA-2xp9-vwfh-vxw4`; RCE em servidor Windows —
`GHSA-p293-qw3h-jr36`) e `proxy-addr` (transitiva do `next`).
`sanitize-html@2.17.7` tem 3 advisories de XSS com patch em 2.18.1.
`npm audit fix` sem `--force` ainda instala `next@16.4.2` (major) → não é
correção segura automática.

### Arquivos de teste verificados

`scripts/`: `srs-tests-a-k.ts`, `organize-tests.ts`, `schedule-plan-tests.ts`,
`schedule-tests.ts`, `schedule-ui-tests.tsx`, `mp-webhook-tests.ts`,
`backfill-review-cycles.ts`, `remigrate-review-cycles.ts`,
`tsconfig.ui-tests.json`.


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
### 2026-10-22 — Ajustes P1 da auditoria (sanitize-html + rotas Sentry de teste)
| Gate | Comando | Resultado |
|---|---|---|
| Dependência | 
pm ls sanitize-html | sanitize-html@2.18.1 |
| Segurança | 
pm audit (antes/depois) | total 28 → 25; advisories XSS de sanitize-html resolvidos |
| Tipos | 
px tsc --noEmit | 0 erros |
| Lint | 
pm run lint | 0 erros |
| Build | 
pm run build | ok |

Removidos src/app/sentry-example-page/ e src/app/api/sentry-example-api/; retirado /sentry-example-page de publicPaths em src/middleware.ts. Sem essas rotas no build; Sentry continua funcional.

