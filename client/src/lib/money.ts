export function formatLek(amount: number, decimals = 0): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  return `Lek ${safeAmount.toFixed(decimals)}`;
}

export function formatLekFromCents(cents: number, decimals = 2): string {
  const safeCents = Number.isFinite(cents) ? cents : 0;
  return formatLek(safeCents / 100, decimals);
}
