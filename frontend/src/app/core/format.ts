/** Dates and amounts as the staff in Peru reads them. */
const LOCALE = 'es-PE';

export function formatDateTime(value: string | undefined | null): string {
  const date = parse(value);
  return date
    ? date.toLocaleString(LOCALE, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';
}

export function formatDate(value: string | undefined | null): string {
  const date = parse(value);
  return date
    ? date.toLocaleDateString(LOCALE, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '—';
}

export function formatTime(value: string | undefined | null): string {
  const date = parse(value);
  return date
    ? date.toLocaleTimeString(LOCALE, {hour: '2-digit', minute: '2-digit'})
    : '—';
}

export function formatMoney(
  amount: number | undefined | null,
  currency = 'PEN',
): string {
  if (amount === undefined || amount === null || Number.isNaN(amount)) {
    return '—';
  }
  return amount.toLocaleString(LOCALE, {style: 'currency', currency});
}

function parse(value: string | undefined | null): Date | undefined {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}
