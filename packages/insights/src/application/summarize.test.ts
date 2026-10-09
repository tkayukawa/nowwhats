import type { TaskDto } from "@nowwhats/task-management";
import { describe, expect, it } from "vitest";
import {
  completionsByTag,
  completionsOf,
  dailyStatusCounts,
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
  tagIds: [],
  completedAt: completedAt?.toISOString() ?? null,
  statusHistory: [],
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

describe("dailyStatusCounts", () => {
  it("各日の終わりの状態で数え、中止と、登録前の日は数えない", () => {
    const history = (...entries: [TaskDto["status"], Date][]) =>
      entries.map(([status, at]) => ({ status, at: at.toISOString() }));
    const tasks = [
      // 10/5 登録 → 10/6 着手 → 10/7 9:00 完了
      {
        ...done(1, 3, at(10, 7, 9)),
        statusHistory: history(
          ["todo", at(10, 5, 9)],
          ["doing", at(10, 6, 9)],
          ["done", at(10, 7, 9)],
        ),
      },
      // 10/6 登録のまま
      {
        ...done(2, 1, null),
        status: "todo" as const,
        statusHistory: history(["todo", at(10, 6, 20)]),
      },
      // 10/5 登録 → 10/6 中止
      {
        ...done(3, 1, null),
        status: "canceled" as const,
        statusHistory: history(["todo", at(10, 5, 10)], ["canceled", at(10, 6, 10)]),
      },
      // 履歴の記録前のタスク（数えない）
      { ...done(4, 1, null), status: "todo" as const, statusHistory: [] },
    ];

    const counts = dailyStatusCounts(tasks, today, 3);

    expect(counts.map((c) => [c.date.getDate(), c.todo, c.doing, c.done])).toEqual([
      [5, 2, 0, 0],
      [6, 1, 1, 0],
      [7, 1, 0, 1], // 今日（15:00 時点）
    ]);
  });
});

describe("completionsByTag", () => {
  it("タグごとに完了ポイントと件数を数え、複数タグは重複して数え、削除済みのタグは外す", () => {
    const tasks = [
      { ...done(1, 3, at(10, 6)), tagIds: ["work", "money"] },
      { ...done(2, 5, at(10, 6)), tagIds: ["work"] },
      { ...done(3, 2, at(10, 6)), tagIds: ["deleted"] }, // 有効なタグがない → タグなし
      { ...done(4, 8, at(9, 1)), tagIds: ["money"] }, // 期間外
    ];

    expect(completionsByTag(tasks, ["work", "money"], new Date(2026, 9, 5))).toEqual([
      { tagId: "work", points: 8, count: 2 },
      { tagId: "money", points: 3, count: 1 },
      { tagId: null, points: 2, count: 1 },
    ]);
    // 期間を指定しなければ、期間外の完了も数える（お金が 11 pt で 1 位になる）
    expect(completionsByTag(tasks, ["work", "money"], null)[0]).toEqual({
      tagId: "money",
      points: 11,
      count: 2,
    });
  });
});
