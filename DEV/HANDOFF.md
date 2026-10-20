# HANDOFF

## Estado atual

A correção do agendamento manual de revisões **está implementada e verificada**
(ver `SPECS/ACTIVE.md` e `VERIFY.md`). Nada foi commitado — a validação
humana do diff é o próximo passo.

Diff em 7 arquivos de código + 1 de teste (+ `DEV/`). Houve **uma** migration
necessária? **Não** — `initialCycleEvaluationCompleted` já existia no schema e
passou a ser usado de fato.

## O que o próximo agente precisa saber

1. **O discriminador é `initialCycleEvaluationCompleted`.** Qualquer
   comportamento novo do agendamento manual fica atrás dele. Ciclo do SRS
   (`true`) continua exatamente como antes — por isso a suíte A–L não mudou.
2. **Não copie a lógica de classificação.** `scheduleTopicReviews` não fala com
   IA e não escolhe dificuldade: ele cria o ciclo com
   `initialCycleEvaluationCompleted: false` e a classificação o adota depois
   (`adoptPreScheduledCycle`).
3. **Se mexer no cronograma, mexa nas duas pontas.** O banco (persiste) e o
   preview do cliente (lê) precisam concordar — o preview agora usa o
   cronograma persistido.
4. **`resolveManualSchedule` é a única fonte da semântica dos dias.** Se mudar
   os planos, mexa lá e nos testes M1/M3/M4.

## Riscos / pendências conhecidas

- **Cards com ciclo `COMPLETED` e sem ciclo ativo** recebem um novo ciclo
  pré-agendado, e o estado passa a "aguardando avaliação". Não há teste
  específico para esse caminho isolado (o M3 cobre o caminho feliz).
- **Renovação pela rota `/flashcards?renewCardId=`**: para um card com ciclo
  pré-agendado, o botão "Renovar Ciclo" cai no passo de classificação (que adota
  o ciclo manual) em vez de renovar. É coerente, mas não foi testado
  end-to-end na UI.
- **`scheduleTopicReviews` é por tópico e não é transacional entre cards**:
  uma falha isolada não derruba as demais (o card com falha é contado em
  `failed` e o toast avisa).
- O `DEV/` foi criado do zero nesta tarefa — é o primeiro uso dessa convenção
  neste repositório. Mantenha-o curto.

## Como validar de novo

```powershell
npx tsc --noEmit
npm run lint
npm run build
npx tsx scripts/srs-tests-a-k.ts
```

O harness exige `DATABASE_URL` (Neon) e cria/apaga um usuário de teste.
