const formatter = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const formatterWithPence = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrency(amount: number, showPence = false): string {
  return showPence ? formatterWithPence.format(amount) : formatter.format(amount);
}

export function formatPercentage(value: number): string {
  return `${Math.round(value)}%`;
}
