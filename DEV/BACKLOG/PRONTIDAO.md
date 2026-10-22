# BACKLOG — Prontidão para produção

Gerado pela auditoria de 2026-10-22 (ver `VERIFY.md` → "Auditoria de prontidão").
Ordenado por severidade. Cada item tem evidência reproduzível.

---

## P0 — Histórico de migration não é reproduzível

**Estado:** bloqueia qualquer ambiente novo (outro banco Neon, preview, CI, outra
máquina, restauração de desastre).

**Evidência**

- `prisma/migrations/` tem só 5 migrations incrementais. **Nenhuma cria as 21
  tabelas base** (User, Deck, Flashcard, ProgressCard, ReviewCycle,
  ScheduledReview, StudySchedule, ScheduleItem, …).
- A tabela `_prisma_migrations` **não existe** no banco de produção:
  `prisma migrate status` → *"5 migrations found … have not yet been applied"*.
- `prisma migrate deploy` contra um banco vazio (sonda descartável criada no
  mesmo projeto Neon e removida depois) **falha**:
  `ERROR: relation "Subscription" does not exist` (SQLState 42P01).
- Contra o banco de produção ele falharia em outro ponto (`accessExpiresAt`
  já existe) e deixaria uma migration "failed" registrada, o que bloqueia
  deploys futuros.
- O schema em si está **correto e sem drift**:
  `prisma migrate diff --from-url <produção> --to-schema-datamodel prisma/schema.prisma`
  → *"No difference detected"*. O schema veio de `prisma db push`, não de migrations.

**Correção proposta**

1. Gerar o baseline:
   `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`
   → `prisma/migrations/0_init/migration.sql`.
2. Remover (ou marcar como aplicadas com `prisma migrate resolve`) as 5
   migrations incrementais, que já estão contidas no baseline.
3. Validar `prisma migrate deploy` contra um banco vazio de sondagem.
4. `prisma migrate deploy` no banco de produção para registrar o histórico.

> Atenção: o passo 4 escreve em produção. Fazer com backup e janela.

---

## P0 — Next.js 14.2.35 com 2 advisories críticos (23 vulnerabilidades)

`npm audit --omit=dev` → **23 vulnerabilidades: 2 críticas, 15 altas, 6 moderadas**.
`14.2.35` é a **última** versão da linha 14 — não há patch dentro da série.

| ID | Sev. | Impacto | Afeta a produção? |
|---|---|---|---|
| [GHSA-2xp9-vwfh-vxw4](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4) | crítica (9.5) | RCE não autenticada na Image Optimization API (libheif/AVIF). Versões `>=10 <15.5.24` | Possível. O app usa `next/image` → `/_next/image` está no ar. Exploitabilidade prática hoje é baixa (sem `remotePatterns`, usuário não escreve em `/public`), mas o patch exige upgrade maior |
| [GHSA-p293-qw3h-jr36](https://github.com/advisories/GHSA-p293-qw3h-jr36) (CVE-2026-75604) | crítica (9.0) | RCE não autenticada (path traversal) em servidores com filesystem **Windows**. `>=13.4.0 <15.5.24` | Não na produção (Vercel = Linux). **Sim** em qualquer instância Windows self-hosted/exposta (inclusive a máquina de dev) |
| GHSA-m99w-x7hq-7vfj / GHSA-89xv-2m56-2m9x / GHSA-p9j2-gv94-2wf4 | altas | DoS e SSRF em Server Actions | Sim |
| GHSA-3g8h-86w9-wvmq, GHSA-wfc6-r584-vfw7, GHSA-68g3-v927-f742 | moderadas/baixa | Cache poisoning / confusão de cache | Sim |
| `proxy-addr` (crítica) | crítica | Spoofing de IP via IPv4-mapped IPv6 | Sim (transitiva do `next`) |

**Correção:** upgrade para `next >= 15.5.24` (ou `>= 16.3.3`). É major:
React 18 → 19, `cookies()`/`headers()` async, `params` async em page/route.
Não cabe num patch — planejar como trabalho próprio, com os gates da DEV.

**Mitigação imediata possível:** `images: { unoptimized: true }` no
`next.config.mjs` (o app só tem 1 `<Image>`, em `dashboard-header.tsx`) e
garantir que nenhuma instância self-hosted rode em Windows.

---

## P1 — `sanitize-html` 2.17.7 com XSS conhecido (patch sem breaking)

- `npm i sanitize-html@2.18.1` — `^2.17.7` já permite; **uma linha, sem breaking**.
- Advisories: `GHSA-x3q4-9hxx-gx8m` (`<noscript>` em `nonTextTags`),
  `GHSA-374f-7chj-9948` (bypass SMIL → `javascript:`),
  `GHSA-cv27-6wvh-8x7j` (`meta http-equiv=refresh`).
- Exposição prática **baixa**: `src/lib/sanitize.ts` usa whitelist estrita
  (`b/strong/i/em/u/span/br/p/ul/ol/li/div`), `allowedSchemes: []`, nenhum
  atributo além de `style` em `span`, e uma 2ª passada que restringe a cor.
  Ainda assim, a versão da lib está travada no branch vulnerável.

---

## P1 — Rotas temporárias de teste no ar em produção

- `src/app/sentry-example-page/` — página pública (listada em
  `publicPaths` no `src/middleware.ts`).
- `src/app/api/sentry-example-api/route.ts` — **lança 500 de propósito**
  ("ROTA TEMPORÁRIA DE TESTE — remover após validar a integração").

Confirmado no ar: `www.edcards.com.br/sentry-example-page` → **200** e
`www.edcards.com.br/api/sentry-example-api` → **500**.
O 500 aparece como erro no Sentry — ruído que mascara erro real.
**Ação:** apagar as duas rotas (e remover `/sentry-example-page` do
`publicPaths`).

---

## P1 — Sem CI

Sem `.github/`. Os gates (`tsc`, `lint`, `build`) e os 6 harnesses só rodam na
mão. Nada impede commit com build quebrado.

**Ação:** workflow de PR com `npx tsc --noEmit` + `npm run lint` +
`npm run build` + `npx tsx scripts/schedule-plan-tests.ts` (harness **puro**,
não precisa de banco).

---

## P1 — Sem `.env.example`

`.env` e `.env.example` estão **ambos** no `.gitignore` — quem for fazer o
deploy não tem contrato de variáveis. 12 chaves:

```
DATABASE_URL              DIRECT_URL
NEXT_PUBLIC_SUPABASE_URL  NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY GROQ_API_KEY
MERCADOPAGO_ACCESS_TOKEN  MERCADOPAGO_WEBHOOK_SECRET
NEXT_PUBLIC_APP_URL       NEXT_PUBLIC_SENTRY_DSN
SENTRY_ORG                SENTRY_PROJECT
```

`NEXT_PUBLIC_SITE_URL` é opcional (cai para `NEXT_PUBLIC_APP_URL`).

---

## P2 — Rate limit de auth em memória (best-effort em serverless)

`src/lib/rate-limit.ts` guarda os contadores em `Map` **por instância**. Na
Vercel cada instância tem o próprio contador → a proteção contra força-bruta
vale só "best effort" (o próprio arquivo avisa isso).

**Contraste:** o limite diário de IA (`src/lib/ai/limit.ts`) é **persistente**
(`UserSettings.aiGenerationsToday` no Postgres) — esse está correto e não
sofre do problema.

**Ação (opcional):** mover login/register para contador no Postgres ou para um
serviço de rate limit (Upstash/Redis), se a proteção contra força-bruta for
relevante para o negócio.

---

## P2 — Código morto

- `src/components/organize-button.tsx` — **0 referências** em todo o `src/`;
  aponta para o wrapper deprecated `redistributeOverdueCards`.
- `src/lib/flashcards/organize.ts` — wrapper `@deprecated`, usado só pelo
  componente morto acima.

Podem ser apagados juntos (a implementação viva está em
`src/lib/flashcards/organize-core.ts` + `organize-actions.ts`).

---

## P2 — README é o padrão do `create-next-app`

Não descreve o projeto, a stack, as variáveis de ambiente, os comandos dos
harnesses nem a topologia do banco. `DEV/` cobre boa parte disso, mas quem
chega no repositório pela primeira vez não sabe por onde começar.

---

## P2 — Logs do webhook com identificador de usuário

`src/app/api/webhooks/mercadopago/route.ts` loga `external_reference`
(= `userId`) em texto claro no log do servidor
(ex.: `"[Webhook MP] Pix payment processed for user: <userId>"`).
Baixa severidade (log do servidor, não resposta HTTP), mas é dado pessoal
em log — considerar trocar por hash/ID do pagamento.

---

## Cobertura verificada (não falta)

- Guardas de assinatura e de propriedade em todas as Server Actions.
- Identidade sempre derivada da sessão (`ensureUserExists`), nunca do cliente.
- Rate limit em login/register + cota diária de IA **persistente**.
- Sanitização de HTML server-side (`sanitize-html` com whitelist estrita).
- Webhook Mercado Pago com validação de assinatura (HMAC), tratamento de
  estorno/chargeback e promoção Pix → cartão (6/6 testes).
- Páginas legais (termos/privacidade/reembolso) + aceite no cadastro.
- Recuperação/redefinição de senha via Supabase.
- `error boundaries` do Sentry em `instrumentation.ts` / `instrumentation-client.ts`.
- Deck público compartilhável `/d/[slug]` + OG/Twitter card.
- Página de material premium protegida com `requireActiveSubscriptionForPage`.
