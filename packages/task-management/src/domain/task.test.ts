import { OwnerId } from "@nowwhats/shared-kernel";
import { describe, expect, it } from "vitest";
import { Task } from "./task.ts";
import { TaskId } from "./task-id.ts";
import { TaskTitle } from "./task-title.ts";

const now = new Date("2026-10-05T00:00:00Z");

const newTask = (): Task => {
  const title = TaskTitle.create("牛乳を買う");
  if (!title.ok) throw new Error("invalid title");
  return Task.create({ id: TaskId.of("t-1"), ownerId: OwnerId.of("u-1"), title: title.value, now });
};

describe("Task", () => {
  it("作成直後は todo・優先度 medium・version 1 で、TaskCreated を発行する", () => {
    const task = newTask();

    expect(task.toSnapshot()).toMatchObject({ status: "todo", priority: "medium", version: 1 });
    expect(task.pullEvents().map((e) => e.type)).toEqual(["TaskCreated"]);
  });

  it("todo → doing → done と遷移し、遷移ごとに version が増える", () => {
    const task = newTask();
    task.pullEvents();

    expect(task.start(now).ok).toBe(true);
    expect(task.complete(now).ok).toBe(true);

    expect(task.toSnapshot()).toMatchObject({ status: "done", version: 3 });
    expect(task.pullEvents().map((e) => e.type)).toEqual(["TaskStarted", "TaskCompleted"]);
  });

  it("done から start はできず、状態もイベントも変わらない", () => {
    const task = newTask();
    task.complete(now);
    task.pullEvents();

    const result = task.start(now);

    expect(result).toEqual({
      ok: false,
      error: { type: "InvalidStatusTransition", from: "done", action: "start" },
    });
    expect(task.toSnapshot()).toMatchObject({ status: "done", version: 2 });
    expect(task.pullEvents()).toEqual([]);
  });

  it("canceled は reopen で todo に戻る", () => {
    const task = newTask();
    task.cancel(now);

    expect(task.reopen(now).ok).toBe(true);
    expect(task.status).toBe("todo");
  });
});

describe("TaskTitle", () => {
  it("前後の空白を除去し、空文字は拒否する", () => {
    expect(TaskTitle.create("  a  ")).toEqual({ ok: true, value: "a" });
    expect(TaskTitle.create("   ")).toEqual({ ok: false, error: { type: "TaskTitleEmpty" } });
  });
});
