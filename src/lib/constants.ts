// Fonte única do preço do Plano Individual.
// Centralizado aqui para que preço, checkout e UI nunca fiquem dessincronizados.
// Valor armazenado em centavos para evitar erros de ponto flutuante.
export const PLAN_PRICE_CENTS = 1500

// Mercado Pago espera `transaction_amount` em reais (ex.: 15), não em centavos.
export const PLAN_PRICE_BRL = PLAN_PRICE_CENTS / 100

// "R$ 15,00" por padrão; use `fractionDigits: 0` para o preço grande da landing.
export function formatPlanPrice(fractionDigits = 2): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(PLAN_PRICE_BRL)
}
