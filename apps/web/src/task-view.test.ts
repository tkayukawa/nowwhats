import type { TaskDto } from "@nowwhats/task-management";
import { describe, expect, it } from "vitest";
import {
  compareTasks,
  dueDateFromInput,
  dueDateFromToday,
  dueInfo,
  groupTasks,
  matchesDueFilter,
  sumPoints,
} from "./task-view.ts";

const today = new Date(2026, 9, 6, 15, 30); // 2026-10-06（火）15:30
const day = (offset: number) => dueDateFromToday(offset, today);

const task = (overrides: Partial<TaskDto>): TaskDto => ({
  id: "0199b1a0-0000-7000-8000-000000000001",
  title: "a",
  description: "",
  status: "todo",
  priority: "medium",
  dueDate: null,
  storyPoints: 1,
  completedAt: null,
  version: 1,
  ...overrides,
});

describe("dueInfo", () => {
  it("未完了の期限切れ・今日・明日・それ以降を出し分ける", () => {
    expect(dueInfo(task({ dueDate: day(-2) }), today)).toEqual({
      text: "2日超過",
      tone: "overdue",
    });
    expect(dueInfo(task({ dueDate: day(0) }), today)).toEqual({ text: "今日", tone: "today" });
    expect(dueInfo(task({ dueDate: day(1) }), today)).toEqual({ text: "明日", tone: "normal" });
    expect(dueInfo(task({ dueDate: day(4) }), today)).toEqual({
      text: "10/10(土)",
      tone: "normal",
    });
    expect(dueInfo(task({}), today)).toBeNull();
  });

  it("完了済みのタスクは期限切れとして強調しない", () => {
    expect(dueInfo(task({ status: "done", dueDate: day(-2) }), today)?.tone).toBe("normal");
  });
});

describe("matchesDueFilter", () => {
  it("今日まで・7 日以内・期限なしで絞り込む", () => {
    const overdue = task({ dueDate: day(-1) });
    const inWeek = task({ dueDate: day(7) });
    const later = task({ dueDate: day(8) });
    const none = task({});

    expect(
      [overdue, inWeek, later, none].filter((t) => matchesDueFilter(t, "today", today)),
    ).toEqual([overdue]);
    expect(
      [overdue, inWeek, later, none].filter((t) => matchesDueFilter(t, "week", today)),
    ).toEqual([overdue, inWeek]);
    expect(
      [overdue, inWeek, later, none].filter((t) => matchesDueFilter(t, "none", today)),
    ).toEqual([none]);
  });
});

describe("compareTasks / groupTasks", () => {
  it("期限の近い順 → 優先度 → 作成順に並べ、状態ごとに分ける", () => {
    const a = task({ id: "0199b1a0-0000-7000-8000-000000000001", dueDate: null, priority: "high" });
    const b = task({ id: "0199b1a0-0000-7000-8000-000000000002", dueDate: day(3) });
    const c = task({
      id: "0199b1a0-0000-7000-8000-000000000003",
      dueDate: day(3),
      priority: "high",
    });
    const d = task({ id: "0199b1a0-0000-7000-8000-000000000004", status: "doing" });
    const e = task({ id: "0199b1a0-0000-7000-8000-000000000005", status: "done", storyPoints: 5 });

    expect([a, b, c].sort(compareTasks).map((t) => t.id.slice(-1))).toEqual(["3", "2", "1"]);
    const groups = groupTasks([a, b, c, d, e]);
    expect(groups.doing).toEqual([d]);
    expect(groups.todo).toHaveLength(3);
    expect(groups.closed).toEqual([e]);
    expect(sumPoints([a, e])).toBe(6);
  });
});

describe("dueDateFromInput", () => {
  it("日付の入力値を端末のタイムゾーンの 0 時として扱う", () => {
    expect(dueDateFromInput("2026-10-12")).toBe(new Date(2026, 9, 12).toISOString());
    expect(dueDateFromInput("")).toBeNull();
  });
});
