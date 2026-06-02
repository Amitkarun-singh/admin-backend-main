export function todayIST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // "YYYY-MM-DD"
}

interface StreakRow {
  last_active_date?: string | null;
  current_streak?: number;
  longest_streak?: number;
}

interface StreakUpdate {
  current_streak: number;
  longest_streak: number;
  last_active_date: string;
}

export function calcStreak(
  row: StreakRow | null,
  today: string
): StreakUpdate | null {
  // ── First login ever ──
  if (!row || !row.last_active_date) {
    return { current_streak: 1, longest_streak: 1, last_active_date: today };
  }

  const last = row.last_active_date; // "YYYY-MM-DD"

  // ── Already counted today ── no-op
  if (last === today) return null;

  const diffDays = daysBetween(last, today);

  let current_streak: number;
  if (diffDays === 1) {
    current_streak = (row.current_streak ?? 0) + 1;
  } else {
    current_streak = 1;
  }

  const longest_streak = Math.max(current_streak, row.longest_streak ?? 0);

  return { current_streak, longest_streak, last_active_date: today };
}

function daysBetween(from: string, to: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const fromMs = new Date(from).getTime();
  const toMs = new Date(to).getTime();
  return Math.round((toMs - fromMs) / msPerDay);
}