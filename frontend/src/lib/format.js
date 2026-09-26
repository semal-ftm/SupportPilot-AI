function locale() {
  return "en";
}

export function formatNumber(value, options) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat(locale(), options).format(value);
}

export function formatCurrency(value, currency = "USD") {
  if (value === null || value === undefined) return "—";
  try {
    return new Intl.NumberFormat(locale(), { style: "currency", currency: currency || "USD" }).format(value);
  } catch {
    // Unknown currency code from a store
    return `${formatNumber(value)} ${currency}`;
  }
}

export function formatDateTime(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale(), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatDay(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat(locale(), { month: "short", day: "numeric" }).format(
    new Date(`${value}T00:00:00`)
  );
}

const DIVISIONS = [
  { amount: 60, unit: "second" },
  { amount: 60, unit: "minute" },
  { amount: 24, unit: "hour" },
  { amount: 7, unit: "day" },
  { amount: 4.34524, unit: "week" },
  { amount: 12, unit: "month" },
  { amount: Infinity, unit: "year" },
];

export function timeAgo(value) {
  if (!value) return "";

  let duration = (new Date(value).getTime() - Date.now()) / 1000;
  const formatter = new Intl.RelativeTimeFormat(locale(), { numeric: "auto", style: "short" });

  for (const division of DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return formatter.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }

  return "";
}

export function formatDuration(ms) {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

export function initials(name = "") {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
