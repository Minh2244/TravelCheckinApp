import type { CheckinItem } from "../types/user.types";
import type { Location } from "../types/location.types";

export type Badge = {
  id: string;
  title: string;
  description: string;
  achieved: boolean;
  progressText?: string;
};

const toLocalDateKey = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const computeStreak = (checkins: CheckinItem[]) => {
  const days = new Set<string>();
  for (const c of checkins) {
    const key = toLocalDateKey(c.checkin_time);
    if (key) days.add(key);
  }

  const sorted = Array.from(days).sort();
  if (sorted.length === 0) return { current: 0, best: 0, totalDays: 0 };

  // best streak
  let best = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const cur = new Date(sorted[i]);
    const diffDays = Math.round(
      (cur.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000),
    );
    if (diffDays === 1) run += 1;
    else run = 1;
    if (run > best) best = run;
  }

  // current streak ending today or yesterday
  const todayKey = toLocalDateKey(new Date().toISOString());
  const today = new Date(todayKey);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayKey = toLocalDateKey(yesterday.toISOString());

  let current = 0;
  if (days.has(todayKey) || days.has(yesterdayKey)) {
    // walk backwards from today if present else from yesterday
    const start = days.has(todayKey) ? today : yesterday;
    current = 1;
    for (;;) {
      const prev = new Date(start);
      prev.setDate(prev.getDate() - current);
      const prevKey = toLocalDateKey(prev.toISOString());
      if (!days.has(prevKey)) break;
      current += 1;
    }
  }

  return { current, best, totalDays: days.size };
};

export const computeBadges = (
  checkins: CheckinItem[],
  locationsById?: Map<number, Location>,
): Badge[] => {
  const total = checkins.length;
  const typesCount = new Map<string, number>();
  for (const c of checkins) {
    const loc = locationsById?.get(c.location_id);
    const type = loc?.location_type ?? "other";
    typesCount.set(type, (typesCount.get(type) ?? 0) + 1);
  }

  const streak = computeStreak(checkins);

  const getTypeCount = (type: string) => typesCount.get(type) ?? 0;

  return [
    {
      id: "first_checkin",
      title: "Check-in đầu tiên",
      description: "Hoàn thành 1 check-in.",
      achieved: total >= 1,
      progressText: `${Math.min(total, 1)}/1`,
    },
    {
      id: "explorer_5",
      title: "Explorer",
      description: "Hoàn thành 5 check-in.",
      achieved: total >= 5,
      progressText: `${Math.min(total, 5)}/5`,
    },
    {
      id: "globetrotter_20",
      title: "Globetrotter",
      description: "Hoàn thành 20 check-in.",
      achieved: total >= 20,
      progressText: `${Math.min(total, 20)}/20`,
    },
    {
      id: "streak_7",
      title: "Streak 7 ngày",
      description: "Duy trì chuỗi check-in 7 ngày.",
      achieved: streak.best >= 7,
      progressText: `${Math.min(streak.best, 7)}/7`,
    },
    {
      id: "cafe_lover_10",
      title: "Cafe Lover",
      description: "Check-in quán cafe 10 lần.",
      achieved: getTypeCount("cafe") >= 10,
      progressText: `${Math.min(getTypeCount("cafe"), 10)}/10`,
    },
  ];
};
