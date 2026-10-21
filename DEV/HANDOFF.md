# HANDOFF

## Estado atual

A correção do **cronograma reverso (Edital Fechado)** está implementada e
verificada (ver `SPECS/ACTIVE.md` e `VERIFY.md`). Nada foi commitado — a
validação humana do diff é o próximo passo.

Diff em 4 arquivos de código + 3 de teste (+ `DEV/`). **Sem migration**: o
`ScheduleItem` continua sem coluna `kind`; a marcação de revisão é derivada
na leitura.

O trabalho anterior (agendamento manual de revisões, Gerenciador) segue no
mesmo estado: implementado, verificado, não commitado. Spec arquivada em
`SPECS/2026-10-20-agendamento-manual-revisoes.md`.

## O que o próximo agente precisa saber

1. **A política do cronograma vive em `src/lib/schedule/plan.ts`** (puro,
   sem banco). `buildStudyPlan()` distribui; `classifyScheduleItems()` marca.
   Não replique a lógica em outro lugar.
2. **`StudySchedule.totalDays` = tamanho da janela de ESTUDO**, não o total do
   plano. A janela de revisão final é derivada: `[startDate + totalDays,
   examDate)`. Se alguém "corrigir" esse campo para o total, a marcação de
   revisão final quebra silenciosamente.
3. **Não existe coluna `kind`**: a 1ª ocorrência de um assunto é o ESTUDO
   dele, as seguintes são REVISÕES. A janela final sobrepõe essa regra
   (data manda).
4. **A data exibida é um dia do calendário, não um instante.** Use
   `formatDateKeyPtBr`/`toDateKey`; `new Date("2026-10-20")` mostra 19/10 em
   UTC-3.
5. **`/edital` já carrega o cronograma salvo** (a página busca o
   `StudySchedule` mais recente e passa por `initialSchedule`). A página é
   premium: sem assinatura ativa ela redireciona para upgrade, no padrão do
   `/gerenciador`.

## Riscos / pendências conhecidas

- **Carga da revisão final**: com muito material e poucos dias finais, o
  último dia pode ter ~15 itens (100 assuntos em 7 dias). Decisão do maestro:
  cobrir tudo. Se virar reclamação, o ajuste é em `buildStudyPlan` (fase 3).
- **Revisão intermediária repetitiva no começo**: com 5 assuntos e 60 dias, os
  primeiros dias revisam o mesmo assunto (é o único material estudado
  naquele momento). É intencional — nunca se revisa o que ainda não caiu.
- **`/edital` é premium agora**: usuário sem assinatura ativa é redirecionado
  para `/dashboard/configuracoes?upgrade=true` ao abrir a página. Antes
  ele via o formulário e recebia erro ao gerar. É o mesmo tratamento do
  `/gerenciador` — se a intenção era só degradar, usar
  `hasActiveSubscription()` e passar `null` no lugar do redirect.
- `getSchedules()` continua sem uso no app.
- A migration antiga continua pendente de criação no repositório
  (`ScheduleItem`/`StudySchedule` foram criados por `prisma db push`).

## Como validar de novo

```powershell
npx tsc --noEmit
npm run lint
npm run build
npx tsx scripts/schedule-plan-tests.ts
npx tsx scripts/schedule-tests.ts
npx tsx --tsconfig scripts/tsconfig.ui-tests.json scripts/schedule-ui-tests.tsx
npx tsx scripts/srs-tests-a-k.ts
```

Os harnesses que tocam o banco exigem `DATABASE_URL` (Neon) e criam/apagam
usuários de teste.
