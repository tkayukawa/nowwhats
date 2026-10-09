import type { TaskDto } from "@nowwhats/task-management";

/**
 * 実績（進捗・成果）の集計。タスクの一覧から計算する読み取り専用のモデル。
 * 日付は端末のタイムゾーンで扱い、週は月曜始まりとする。
 */

const DAY_MS = 86_400_000;

export interface Completion {
  readonly id: string;
  readonly title: string;
  readonly points: number;
  readonly completedAt: Date;
}

export interface Period {
  /** 期間の開始（その日の 0 時） */
  readonly start: Date;
  readonly points: number;
  readonly count: number;
}

export const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** その日を含む週の月曜 0 時 */
export const startOfWeek = (d: Date): Date => {
  const day = startOfDay(d);
  return addDays(day, -((day.getDay() + 6) % 7));
};

// 夏時間のある地域でもずれないよう、ミリ秒ではなく日付で足す
const addDays = (d: Date, days: number): Date =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);

/** 完了日時が記録されている完了済みのタスク（完了日時の導入前に完了したものは含まない） */
export const completionsOf = (tasks: readonly TaskDto[]): Completion[] =>
  tasks.flatMap((t) =>
    t.status === "done" && t.completedAt !== null
      ? [{ id: t.id, title: t.title, points: t.storyPoints, completedAt: new Date(t.completedAt) }]
      : [],
  );

const sumIn = (completions: readonly Completion[], start: Date, end: Date): Period => {
  const items = completions.filter((c) => c.completedAt >= start && c.completedAt < end);
  return { start, points: items.reduce((n, c) => n + c.points, 0), count: items.length };
};

/** 直近 weeks 週（今週を含む）の週ごとの完了。古い週から順に並べる */
export const weeklyCompletions = (
  completions: readonly Completion[],
  today: Date,
  weeks = 8,
): Period[] => {
  const thisWeek = startOfWeek(today);
  return Array.from({ length: weeks }, (_, i) => {
    const start = addDays(thisWeek, -(weeks - 1 - i) * 7);
    return sumIn(completions, start, addDays(start, 7));
  });
};

/** 直近 weeks 週の、月曜から今日までの日ごとの完了。古い日から順に並べる */
export const dailyCompletions = (
  completions: readonly Completion[],
  today: Date,
  weeks = 12,
): Period[] => {
  const first = addDays(startOfWeek(today), -(weeks - 1) * 7);
  const days = Math.round((startOfDay(today).getTime() - first.getTime()) / DAY_MS) + 1;
  return Array.from({ length: days }, (_, i) => {
    const start = addDays(first, i);
    return sumIn(completions, start, addDays(start, 1));
  });
};

export interface WeeklySummary {
  readonly thisWeek: Period;
  readonly lastWeek: Period;
  /** 今週を除いた週の平均完了ポイント（ベロシティ） */
  readonly averagePoints: number;
}

/** weeklyCompletions の結果（古い週から順。最後が今週）から、今週・先週・平均を求める */
export const summarizeWeeks = (weekly: readonly Period[]): WeeklySummary => {
  const thisWeek = weekly.at(-1);
  const lastWeek = weekly.at(-2);
  if (thisWeek === undefined || lastWeek === undefined) {
    throw new Error("summarizeWeeks needs at least two weeks");
  }
  const past = weekly.slice(0, -1);
  return {
    thisWeek,
    lastWeek,
    averagePoints: past.reduce((n, w) => n + w.points, 0) / past.length,
  };
};

export interface DayCompletions {
  readonly date: Date;
  readonly points: number;
  readonly items: Completion[];
}

/** 先週の月曜以降に完了したタスクを、日ごとに新しい順でまとめる */
export const recentCompletionsByDay = (
  completions: readonly Completion[],
  today: Date,
): DayCompletions[] => {
  const from = addDays(startOfWeek(today), -7);
  const byDay = new Map<number, Completion[]>();
  for (const c of [...completions]
    .filter((c) => c.completedAt >= from)
    .sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime())) {
    const key = startOfDay(c.completedAt).getTime();
    byDay.set(key, [...(byDay.get(key) ?? []), c]);
  }
  return [...byDay.entries()].map(([key, items]) => ({
    date: new Date(key),
    points: items.reduce((n, c) => n + c.points, 0),
    items,
  }));
};

export interface StatusCounts {
  /** その日の終わり（今日は現在時刻）時点の件数 */
  readonly date: Date;
  readonly todo: number;
  readonly doing: number;
  readonly done: number;
}

/**
 * 日ごとの状態別の件数（累積フロー図用）。古い日から順に days 日分（今日を含む）。
 * 各日の終わりの時点で、状態の履歴から各タスクの状態を求める。中止は数えない。
 * 履歴の記録を始める前に登録したタスクは、最初の記録以降だけを数える。
 */
export const dailyStatusCounts = (
  tasks: readonly TaskDto[],
  now: Date,
  days = 28,
): StatusCounts[] => {
  const histories = tasks
    .map((t) => t.statusHistory.map((h) => ({ status: h.status, at: new Date(h.at) })))
    .filter((h) => h.length > 0);
  const today = startOfDay(now);
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(today, -(days - 1 - i));
    const end = i === days - 1 ? now : addDays(date, 1);
    const counts = { todo: 0, doing: 0, done: 0 };
    for (const history of histories) {
      const last = history.filter((h) => h.at < end).at(-1);
      if (last !== undefined && last.status !== "canceled") counts[last.status] += 1;
    }
    return { date, ...counts };
  });
};

export interface TagTotal {
  /** null は「タグなし」 */
  readonly tagId: string | null;
  readonly points: number;
  readonly count: number;
}

/**
 * タグ別の完了ポイントと件数（from 以降に完了したもの。null はすべての期間）。
 * 複数のタグが付いたタスクは、それぞれのタグに全ポイントを数える（合計は完了ポイントの総数より多くなる）。
 * 存在しないタグ（削除済み）は数えず、有効なタグが 1 つもないタスクは「タグなし」に数える。
 * ポイントの多い順に並べ、「タグなし」は最後にする。
 */
export const completionsByTag = (
  tasks: readonly TaskDto[],
  tagIds: readonly string[],
  from: Date | null,
): TagTotal[] => {
  const known = new Set(tagIds);
  const totals = new Map<string | null, { points: number; count: number }>();
  for (const t of tasks) {
    if (t.status !== "done" || t.completedAt === null) continue;
    if (from !== null && new Date(t.completedAt) < from) continue;
    const tags = t.tagIds.filter((id) => known.has(id));
    for (const key of tags.length > 0 ? tags : [null]) {
      const total = totals.get(key) ?? { points: 0, count: 0 };
      totals.set(key, { points: total.points + t.storyPoints, count: total.count + 1 });
    }
  }
  return [...totals.entries()]
    .map(([tagId, total]) => ({ tagId, ...total }))
    .sort((a, b) =>
      a.tagId === null ? 1 : b.tagId === null ? -1 : b.points - a.points || b.count - a.count,
    );
};
