import { describe, expect, it } from "vitest";
import { availableActions, Task } from "./task.ts";
import { TaskId } from "./task-id.ts";
import { TaskTitle } from "./task-title.ts";
import { NOW as now, OWNER, uuid } from "../testing/fixtures.ts";

const newTask = (): Task => {
  const title = TaskTitle.create("牛乳を買う");
  const id = TaskId.parse(uuid(1));
  if (!title.ok || !id.ok) throw new Error("invalid fixture");
  return Task.create({ id: id.value, ownerId: OWNER, title: title.value, now });
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

  it("完了すると完了日時を記録し、再開すると消す", () => {
    const task = newTask();
    const later = new Date("2026-10-06T09:00:00Z");

    task.complete(later);
    expect(task.toSnapshot().completedAt).toEqual(later);

    task.reopen(later);
    expect(task.toSnapshot().completedAt).toBeNull();
  });

  it("登録と状態の変更を、日時付きで履歴に記録する", () => {
    const task = newTask();
    const t1 = new Date("2026-10-06T09:00:00Z");
    const t2 = new Date("2026-10-07T18:00:00Z");

    task.start(t1);
    task.complete(t2);

    expect(task.toSnapshot().statusHistory).toEqual([
      { status: "todo", at: now },
      { status: "doing", at: t1 },
      { status: "done", at: t2 },
    ]);
  });

  it("canceled は reopen で todo に戻る", () => {
    const task = newTask();
    task.cancel(now);

    expect(task.reopen(now).ok).toBe(true);
    expect(task.status).toBe("todo");
  });
});

describe("availableActions", () => {
  it("状態ごとに実行できる操作を返す", () => {
    expect(availableActions("todo")).toEqual(["start", "complete", "cancel"]);
    expect(availableActions("doing")).toEqual(["complete", "cancel"]);
    expect(availableActions("done")).toEqual(["reopen"]);
    expect(availableActions("canceled")).toEqual(["reopen"]);
  });
});

describe("TaskId", () => {
  it("UUID 形式のみ受け付け、小文字に正規化する", () => {
    expect(TaskId.parse(uuid(1).toUpperCase())).toEqual({ ok: true, value: uuid(1) });
    expect(TaskId.parse("t-1")).toEqual({ ok: false, error: { type: "TaskIdInvalid" } });
  });
});

describe("TaskTitle", () => {
  it("前後の空白を除去し、空文字は拒否する", () => {
    expect(TaskTitle.create("  a  ")).toEqual({ ok: true, value: "a" });
    expect(TaskTitle.create("   ")).toEqual({ ok: false, error: { type: "TaskTitleEmpty" } });
  });
});

describe("Task.edit", () => {
  it("値が変わった項目だけを TaskEdited に記録する", () => {
    const task = newTask();
    task.pullEvents();
    const title = TaskTitle.create("牛乳と卵を買う");
    if (!title.ok) throw new Error("fixture");

    task.edit({ title: title.value, priority: "medium", storyPoints: 3 }, now);

    expect(task.pullEvents()).toEqual([
      expect.objectContaining({ type: "TaskEdited", fields: ["title", "storyPoints"] }),
    ]);
    expect(task.toSnapshot()).toMatchObject({
      title: "牛乳と卵を買う",
      storyPoints: 3,
      version: 2,
    });
  });
});
