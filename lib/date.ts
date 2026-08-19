const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseDateOnly(value: string): Date {
  const match = DATE_ONLY_PATTERN.exec(value);

  if (!match) {
    throw new Error("Date must use YYYY-MM-DD format.");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new Error("Date must be valid.");
  }

  return date;
}

export function formatDateOnly(date: Date): string {
  if (Number.isNaN(date.getTime())) {
    throw new Error("Date must be valid.");
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

export function formatDatabaseDateOnly(date: Date): string {
  if (Number.isNaN(date.getTime())) {
    throw new Error("Date must be valid.");
  }

  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(
    date.getUTCDate()
  ).padStart(2, "0")}`;
}
