/**
 * Utilidades para cálculo de divisas entre Quetzal (GTQ) y Dólar (USD)
 * con redondeo comercial limpio (evitando decimales como .23 o .24,
 * prefiriendo terminaciones comerciales limpias como .00, .25, .50, .75, .80, .90, .95)
 */

export const DEFAULT_EXCHANGE_RATE = 7.78; // 1 USD ≈ 7.78 GTQ

/**
 * Redondea un valor numérico a pasos comerciales limpios
 * Por ejemplo: 10.23 -> 10.25, 10.77 -> 10.80, 10.92 -> 10.95
 */
export function roundToCommercialPrice(num: number): number {
  if (!num || isNaN(num)) return 0;

  // Redondear a múltiplos de 0.05 para que termine siempre en .00, .05, .10, .25, .50, .75, .80, .95, etc.
  const rounded = Math.round(num * 20) / 20;
  return parseFloat(rounded.toFixed(2));
}

/**
 * Convierte de Quetzales a USD con redondeo comercial
 */
export function convertGTQtoUSD(amountGTQ: number, rate = DEFAULT_EXCHANGE_RATE): number {
  if (!amountGTQ) return 0;
  const rawUSD = amountGTQ / rate;
  return roundToCommercialPrice(rawUSD);
}

/**
 * Convierte de USD a Quetzales con redondeo comercial
 */
export function convertUSDtoGTQ(amountUSD: number, rate = DEFAULT_EXCHANGE_RATE): number {
  if (!amountUSD) return 0;
  const rawGTQ = amountUSD * rate;
  return roundToCommercialPrice(rawGTQ);
}

/**
 * Intenta obtener la tasa de cambio en vivo con fallback seguro
 */
export async function fetchLiveExchangeRate(): Promise<number> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", { next: { revalidate: 3600 } });
    if (res.ok) {
      const data = await res.json();
      if (data?.rates?.GTQ) {
        return parseFloat(data.rates.GTQ.toFixed(2));
      }
    }
  } catch (err) {
    console.warn("Using default exchange rate", err);
  }
  return DEFAULT_EXCHANGE_RATE;
}
