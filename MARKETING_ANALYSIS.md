# Análise de Marketing — EDCards

> Levantamento factual do código-fonte (out/2026). Cada afirmação referencia o arquivo de origem.

---

## 1. O que é o produto

**EDCards** — plataforma de estudo para **concursos públicos** que combina flashcards com
geração por IA e repetição espaçada (SRS).

- **Stack:** Next.js 14 (App Router) · Supabase Auth · Prisma/Neon · Mercado Pago · Groq (IA) · Sentry
- **Slogan oficial** (em `src/app/layout.tsx`): *"Flashcards com IA e repetição espaçada para
  concursos públicos. Estude menos, memorize mais."*
- **Preço:** único — **R$ 15/mês** (cartão recorrente) ou **Pix avulso R$ 15 / 30 dias**

### Diferenciais técnicos reais (comprovados no código)

| Diferencial | Evidência |
|---|---|
| Geração de flashcards a partir de **texto ou PDF** | `src/lib/ai/actions.ts` (Groq `gpt-oss-120b`, PDF ≤5 MB via `pdf-parse`) |
| Auto-classificação do card na matéria/assunto via IA | `classifyFlashcard` em `ai/actions.ts` |
| Avaliação semântica da resposta do aluno | `evaluateAnswerWithAI` em `src/lib/srs.ts` |
| SRS com ciclos por dificuldade | `CYCLES` em `srs-review-utils.ts`: EASY [14,30,60,90] · MEDIUM [7,21,30,60,90] · HARD [1,2,7,30,60,90] dias |
| 3 tipos de card: básica, **reversa** e **cloze** | `CardType` no schema; parser `{{c1::resposta::dica}}` em `src/lib/cloze.ts` |
| **Edital Fechado** — cronograma reverso a partir da data da prova | `generateReverseSchedule`, rota `/edital` |
| Gerenciador com **Pomodoro integrado** + registro de sessões | `pomodoro-timer.tsx`, `study-sessions` |
| Modo **Simulado** com timer e resultado | `simulado-engine.tsx` |
| **Baralhos públicos indexáveis** `/d/[slug]` (loop viral + SEO) | `src/app/d/[slug]/page.tsx`, sitemap até 5.000 decks |
| **Indicação com recompensa mútua de 30 dias** | `src/lib/referral/service.ts` |
| Múltiplos perfis (1 / 2 / 5 por plano) | `Profile` no schema |

---

## 2. Público-alvo

**Concurseiros brasileiros** — foco declarado em concursos públicos (não vestibulares, apesar do
prompt de IA aceitar ambos).

Sinais no código:
- Campo de cadastro "Concurso de interesse" (placeholder *"Ex: Polícia Militar do Alagoas"*) — `register-form.tsx`
- Perfil carrega `concurrenceName` e `targetExam` — `schema.prisma`
- Landing segmenta por "Foco em Concursos Públicos" e "edital"

**Sub-públicos identificáveis:**
1. **Concurseiros solo** que já usam Anki e querem algo em português, com IA e foco em edital
2. **Iniciantes** que não têm tempo/método para criar cards — o "cole o PDF e a IA faz" é o gancho
3. **Grupos de estudo / casais** — os planos Dupla (R$25) e Grupo (R$50) existem na UI
4. **Preparadores e cursos** — não há oferta B2B hoje (gap)

---

## 3. Modelo de negócio

### Planos (UI — `configuracoes/client.tsx`)

| Plano | Preço | Perfis | Status real no checkout |
|---|---|---|---|
| Individual | R$ 15/mês | 1 | ✅ implementado |
| Em Dupla | R$ 25 | 2 | ⚠️ **preço exibido, checkout não implementado** (sempre cobra R$15) |
| Em Grupo | R$ 50 | 5 | ⚠️ **idem** |
| Pix avulso | R$ 15 / 30 dias | 1 | ✅ implementado |

### O que é free vs. premium

**Grátis (sem assinatura):** conta, matérias/assuntos, baralhos públicos, diretório `/decks`,
páginas legais.

**Premium (assinatura ativa obrigatória):** flashcards/SRS, IA, questões/simulado, materiais/PDF,
agendamento/Pomodoro, edital, organizar atrasados, **compartilhar baralho**.

Guards: `src/lib/subscription/guard.ts` → redireciona para `?upgrade=true` ou lança erro de ação.

> ⚠️ **Ponto de atrito:** não existe trial. O usuário cria a conta, cai em `/bem-vindo` (tela de
> pagamento imediata) e quase tudo é premium. O "free tier" real (matérias) é fraco como isca.

### Limites

- **IA: 20 gerações/dia** por usuário (`AI_DAILY_LIMIT` em `lib/ai/limit.ts`) — mesmo para assinantes
- Cota compartilhada entre geração, classificação e avaliação

### Fluxo de cobrança

Pix (libera em segundos via webhook) · Cartão recorrente via preapproval Mercado Pago.
Webhook com verificação HMAC (`api/webhooks/mercadopago/route.ts`), trata estorno/chargeback.

### Páginas legais

`/termos`, `/privacidade` (LGPD, DPO), `/reembolso` (CDC art. 49, 7 dias).
> ⚠️ **Termos ainda com placeholders:** `[inserir CNPJ]`, `[inserir endereço]` — bloqueio legal.

---

## 4. Canais de aquisição já construídos

### Loop 1 — Baralhos públicos (SEO/viral)
Usuário publica deck → página `/d/[slug]` indexável com OG/canonical → sitemap com até 5.000 URLs
→ visitante vê o conteúdo → CTA "Criar conta grátis" → `/register` (com atribuição `?ref=`).
Eventos: `deck_published`, `public_deck_cta_clicked` *(declarado mas nunca disparado)*.

### Loop 2 — Indicação (mutual benefit)
`/dashboard/convite` → link `/register?ref=CÓDIGO` → **ambos ganham 30 dias** quando o indicado paga.
Share text pronto para WhatsApp/Telegram. Cookie `ed_ref` dura 30 dias.
Eventos: `referral_claimed`, `referral_rewarded`.

### Instrumentação de funil (tabela `AnalyticsEvent`)

`user_registered` (com `referred`) → `checkout_started` → `subscription_activated` →
`referral_claimed` / `referral_rewarded` / `deck_published`.

> Só isso. **Não há GA4, Meta Pixel, PostHog, Clarity nem nenhum analytics de marketing.**

---

## 5. Gaps críticos — o que impede fazer marketing hoje

### 🔴 Bloqueadores (resolver antes de qualquer campanha)

1. **Zero mensuração externa.** Sem GA4/Pixel não dá para medir ROI de anúncio nenhum.
   O `AnalyticsEvent` interno mede funil, mas não serve para atribuição de tráfego pago.

2. **Sem imagem social.** Não existe pasta `public/` no projeto — nenhum logo, og-image ou
   screenshot. O Twitter declara `summary_large_image` mas não há imagem: **todo link
   compartilhado sai sem thumbnail**. Inviável para anúncio ou post.

3. **Landing `/` sem metadata própria** — sem canonical, sem OG específico, H1 é só "Edcards".
   Landing sem prova social, sem depoimentos, sem seção "como funciona", sem FAQ.

4. **Termos com placeholders de CNPJ/endereço.** Risco legal para cobrar de verdade.

5. **`NEXT_PUBLIC_SITE_URL` precisa estar setada** — sem ela, `metadataBase` fica undefined e
   OGs/canonicals quebram (`resolveMetadataBase()` em `layout.tsx`).

### 🟡 Dívidas que limitam crescimento

6. **Planos Dupla/Grupo fantasma** — aparecem na UI com preços, mas o checkout cobra R$15
   individual sempre. Quem clica em "Em Dupla" paga R$15. Perda de receita + má experiência.

7. **Sem trial / garantia visível.** "Sem cartão no cadastro" é bom, mas o paywall aparece
   imediatamente em `/bem-vindo`. Sem demonstração de valor antes de cobrar.

8. **CTA de deck público não é rastreado** — `public_deck_cta_clicked` existe no enum mas
   nunca é disparado. Não dá para saber a conversão do loop viral.

9. **Sem JSON-LD/schema.org** — nenhum Product, Organization ou FAQ. Perde rich results.

10. **Sem blog/conteúdo.** Zero páginas de SEO por keyword ("melhores flashcards para concurso",
    "como estudar para [concurso X]"). As únicas URLs indexáveis são `/`, `/decks` e decks.

11. **Copy de referral inconsistente:** painel diz "30 dias", share text diz "1 mês".

12. **IA de questões não existe** — o simulado é 100% user-generated. Mercado esperaria banco
    de questões ou geração por IA.

---

## 6. Mensagens de marketing defensáveis (com base no código)

| Mensagem | Suporte real |
|---|---|
| "Cole o PDF da sua apostila e receba flashcards prontos em segundos" | `generateFlashcardsFromPDF` |
| "Repetição espaçada que respeita a dificuldade de cada card" | ciclos EASY/MEDIUM/HARD |
| "Informe a data da prova e receba um cronograma reverso" | `/edital` |
| "Estude por R$ 15/mês — menos que um café por semana" | pricing |
| "Convide um amigo e vocês dois ganham 1 mês grátis" | referral 30 dias |
| "Estude de graça com baralhos compartilhados pela comunidade" | `/decks` + `/d/[slug]` |
| "Cloze, card reverso e revisão com avaliação por IA" | `CardType`, `evaluateAnswerWithAI` |

---

## 7. Plano de ação sugerido (priorizado)

**Semana 1 — destravar medição e identidade**
- [ ] Criar pasta `public/`: logo (SVG/PNG), og-image 1200×630, apple-touch-icon, manifest
- [ ] Adicionar `opengraph-image` estática + metadata própria na landing `/`
- [ ] Instalar GA4 (ou PostHog) + Meta Pixel, com eventos de conversão mapeados ao funil existente
- [ ] Preencher CNPJ/endereço nos termos
- [ ] Confirmar `NEXT_PUBLIC_SITE_URL` em produção

**Semana 2 — converter melhor**
- [ ] Instrumentar `public_deck_cta_clicked` nos 2 CTAs de `/d/[slug]`
- [ ] Adicionar prova social na landing (nº de cards gerados, usuários, depoimentos)
- [ ] Adicionar JSON-LD (Product do plano R$15, Organization, FAQPage)
- [ ] Testar CTA de trial de 7 dias ou garantia de 7 dias visível (já existe no `/reembolso`)
- [ ] Corrigir copy do referral ("30 dias" vs "1 mês")

**Semana 3 — crescer**
- [ ] Páginas de SEO por concurso/alvo (`/para/[concurso]`) usando `concurrenceName` dos usuários
- [ ] Blog com conteúdo de estudo para concursos
- [ ] Ligar os planos Dupla/Grupo no checkout (receita incremental)
- [ ] Campanhas de WhatsApp/Instagram usando o share text já pronto do referral

---

## 8. Números atuais no banco (referência)

- 22 usuários · 3 baralhos (banco Neon, produção)
- Base muito inicial — **priorize loops orgânicos (referral + deck público) antes de pagar tráfego**
