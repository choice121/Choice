// Choice Properties — Shared: proration.ts
//
// Phase 07 — Computes the prorated first-month rent when a tenant moves in
// mid-cycle. Pure, no I/O, no Deno-specific APIs so it's trivially testable.
//
// Methods:
//   'daily'  — (monthlyRent / daysInMoveInMonth) * daysOccupied. Most accurate.
//   '30day'  — (monthlyRent / 30) * daysOccupied. Common in legacy leases.
//   'none'   — full month charged regardless of move-in date.

export type ProrationMethod = 'daily' | '30day' | 'none';

export interface ProrationInput {
  /** ISO-8601 yyyy-mm-dd. Day the tenant takes possession. */
  moveInDate: string;
  /** Full monthly rent in dollars. */
  monthlyRent: number;
  /** Day of month rent is due (1-28). Defaults to 1. */
  dueDay?: number;
  /** Calculation method. Defaults to 'daily'. */
  method?: ProrationMethod;
}

export interface ProrationResult {
  /** Amount the tenant owes for the partial first cycle, in dollars (rounded to cents). */
  proratedAmount: number;
  /** What a full month would have been (== monthlyRent). */
  fullMonthAmount: number;
  /** Number of days the tenant is being charged for in the first cycle. */
  prorationDays: number;
  /** Total days in the divisor used (calendar month length, 30, or 0). */
  divisorDays: number;
  /** First date the tenant is being charged for (== moveInDate). */
  startDate: string;
  /** Last date the tenant is being charged for in the first cycle. */
  endDate: string;
  /** Human-readable explanation suitable for inclusion in a lease body. */
  explanation: string;
  /** The method actually used. */
  method: ProrationMethod;
}

function daysInMonth(year: number, monthIdx: number): number {
  // monthIdx is 0-based (Jan=0)
  return new Date(year, monthIdx + 1, 0).getDate();
}

function fmtMoney(n: number): string {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Compute the prorated first-month rent.
 *
 * Convention: "first cycle" runs from `moveInDate` through the day before the
 * next `dueDay`. If moveInDate already lands on dueDay, no proration is
 * applied (full month charged, returns full amount).
 */
export function computeFirstMonthProration(input: ProrationInput): ProrationResult {
  const method: ProrationMethod = input.method ?? 'daily';
  const dueDay = Math.max(1, Math.min(28, input.dueDay ?? 1));
  const monthly = Math.max(0, Number(input.monthlyRent) || 0);

  const m = new Date(input.moveInDate + 'T00:00:00');
  if (isNaN(m.getTime())) {
    throw new Error('proration: invalid moveInDate, expected yyyy-mm-dd');
  }

  const moveYear = m.getFullYear();
  const moveMonthIdx = m.getMonth();
  const moveDay = m.getDate();

  // Determine the next dueDay date (start of full cycle).
  let nextDueYear = moveYear;
  let nextDueMonthIdx = moveMonthIdx;
  if (moveDay < dueDay) {
    // Next dueDay falls in the same calendar month.
    nextDueMonthIdx = moveMonthIdx;
  } else {
    // Next dueDay is in the following calendar month.
    nextDueMonthIdx = moveMonthIdx + 1;
    if (nextDueMonthIdx > 11) { nextDueMonthIdx = 0; nextDueYear += 1; }
  }
  const nextDueDate = new Date(nextDueYear, nextDueMonthIdx, dueDay);

  // Prorated cycle = [moveInDate, nextDueDate - 1day], inclusive.
  const endDate = new Date(nextDueDate);
  endDate.setDate(endDate.getDate() - 1);

  const msPerDay = 86_400_000;
  const prorationDays = Math.round((endDate.getTime() - m.getTime()) / msPerDay) + 1;

  if (method === 'none' || prorationDays <= 0 || monthly === 0) {
    return {
      proratedAmount: round2(monthly),
      fullMonthAmount: round2(monthly),
      prorationDays: prorationDays > 0 ? prorationDays : 0,
      divisorDays: 0,
      startDate: input.moveInDate,
      endDate: endDate.toISOString().slice(0, 10),
      explanation: monthly > 0
        ? `No proration applied — full monthly rent of ${fmtMoney(monthly)} charged for the first cycle starting ${fmtDate(m)}.`
        : 'No proration — monthly rent is zero.',
      method,
    };
  }

  let divisor: number;
  if (method === '30day') {
    divisor = 30;
  } else {
    // 'daily' — use the actual length of the move-in calendar month.
    divisor = daysInMonth(moveYear, moveMonthIdx);
  }

  const dailyRate = monthly / divisor;
  const prorated = round2(dailyRate * prorationDays);

  const explanation =
    `First cycle prorated: ${prorationDays} day(s) from ${fmtDate(m)} through ${fmtDate(endDate)} ` +
    `at ${fmtMoney(round2(dailyRate))}/day (${fmtMoney(monthly)} ÷ ${divisor} days, ${method} method) ` +
    `= ${fmtMoney(prorated)}. Full monthly rent of ${fmtMoney(monthly)} resumes ${fmtDate(nextDueDate)}.`;

  return {
    proratedAmount: prorated,
    fullMonthAmount: round2(monthly),
    prorationDays,
    divisorDays: divisor,
    startDate: input.moveInDate,
    endDate: endDate.toISOString().slice(0, 10),
    explanation,
    method,
  };
}
