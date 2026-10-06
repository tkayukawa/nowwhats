import type { TaskDto } from "@nowwhats/task-management";
import { describe, expect, it } from "vitest";
import {
  completionsOf,
  dailyCompletions,
  recentCompletionsByDay,
  startOfWeek,
  summarizeWeeks,
  weeklyCompletions,
  type Completion,
} from "./summarize.ts";

// 2026-10-07（水）15:00。今週は 10/5（月）〜
const today = new Date(2026, 9, 7, 15, 0);
const at = (month: number, day: number, hour = 12) => new Date(2026, month - 1, day, hour);

const done = (id: number, points: number, completedAt: Date | null): TaskDto => ({
  id: `0199b1a0-0000-7000-8000-${String(id).padStart(12, "0")}`,
  title: `タスク ${id}`,
  description: "",
  status: "done",
  priority: "medium",
  dueDate: null,
  storyPoints: points,
  completedAt: completedAt?.toISOString() ?? null,
  version: 2,
});

const completions: Completion[] = completionsOf([
  done(1, 3, at(10, 7, 9)), // 今週（水）
  done(2, 2, at(10, 5, 0)), // 今週（月）0 時ちょうど
  done(3, 5, at(10, 4, 23)), // 先週（日）
  done(4, 8, at(9, 28)), // 先週（月）
  done(5, 1, at(9, 22)), // 2 週前
  done(6, 13, null), // 完了日時の記録なし（集計しない）
  { ...done(7, 5, at(10, 6)), status: "todo" }, // 未完了（集計しない）
]);

describe("startOfWeek", () => {
  it("月曜始まりで週の初日を返す", () => {
    expect(startOfWeek(at(10, 7))).toEqual(new Date(2026, 9, 5));
    expect(startOfWeek(at(10, 4))).toEqual(new Date(2026, 8, 28)); // 日曜は前の週
  });
});

describe("weeklyCompletions / summarizeWeeks", () => {
  it("週ごとに完了ポイントと件数を集計し、今週・先週・平均を求める", () => {
    const weekly = weeklyCompletions(completions, today, 3);

    expect(weekly.map((w) => [w.start.getDate(), w.points, w.count])).toEqual([
      [21, 1, 1],
      [28, 13, 2],
      [5, 5, 2],
    ]);
    expect(summarizeWeeks(weekly)).toMatchObject({
      thisWeek: { points: 5, count: 2 },
      lastWeek: { points: 13, count: 2 },
      averagePoints: 7, // (1 + 13) / 2
    });
  });
});

describe("dailyCompletions", () => {
  it("最初の週の月曜から今日まで、日ごとに集計する", () => {
    const daily = dailyCompletions(completions, today, 2);

    expect(daily).toHaveLength(10); // 9/28（月）〜 10/7（水）
    expect(daily[0]).toMatchObject({ start: new Date(2026, 8, 28), points: 8 });
    expect(daily.at(-1)).toMatchObject({ start: new Date(2026, 9, 7), points: 3 });
  });
});

describe("recentCompletionsByDay", () => {
  it("先週の月曜以降の完了を、日ごとに新しい順でまとめる", () => {
    const days = recentCompletionsByDay(completions, today);

    expect(days.map((d) => [d.date.getDate(), d.points])).toEqual([
      [7, 3],
      [5, 2],
      [4, 5],
      [28, 8],
    ]);
  });
});
