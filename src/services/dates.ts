import * as chrono from 'chrono-node';

export interface ParsedDue {
  date: string | null; // YYYY-MM-DD
  datetime: string | null; // ISO 8601
  string: string; // Original input
  isRecurring: boolean;
  timezone: string | null;
}

const RECURRING_PATTERNS = [
  /^every\s+/i,
  /^daily$/i,
  /^weekly$/i,
  /^monthly$/i,
  /^yearly$/i,
  /^annually$/i,
];

export function parseDueString(input: string, timezone?: string): ParsedDue {
  const isRecurring = RECURRING_PATTERNS.some((pattern) => pattern.test(input.trim()));

  // For recurring tasks, parse the first occurrence
  let parseableInput = input;
  if (isRecurring) {
    // Convert "every monday" to just "monday" for parsing the next occurrence
    parseableInput = input.replace(/^every\s+/i, '');
    if (/^daily$/i.test(input)) parseableInput = 'today';
    if (/^weekly$/i.test(input)) parseableInput = 'next week';
    if (/^monthly$/i.test(input)) parseableInput = 'next month';
    if (/^yearly$/i.test(input) || /^annually$/i.test(input)) parseableInput = 'next year';
  }

  const parsed = chrono.parseDate(parseableInput);

  if (!parsed) {
    return {
      date: null,
      datetime: null,
      string: input,
      isRecurring,
      timezone: timezone ?? null,
    };
  }

  // Check if the original input implies a specific time
  const hasTime = /\d{1,2}:\d{2}|noon|midnight|\d{1,2}\s*(am|pm)/i.test(input);

  const date = formatDate(parsed);
  const datetime = hasTime ? parsed.toISOString() : null;

  return {
    date,
    datetime,
    string: input,
    isRecurring,
    timezone: timezone ?? null,
  };
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTodayDate(): string {
  return formatDate(new Date());
}

export function getDateInDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return formatDate(date);
}

export function isToday(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return dateStr === getTodayDate();
}

export function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return dateStr < getTodayDate();
}

export function isWithinDays(dateStr: string | null, days: number): boolean {
  if (!dateStr) return false;
  const today = getTodayDate();
  const future = getDateInDays(days);
  return dateStr >= today && dateStr <= future;
}
