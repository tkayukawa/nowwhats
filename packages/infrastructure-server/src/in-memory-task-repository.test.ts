import { OwnerId } from "@nowwhats/shared-kernel";
import { Task, TaskId, TaskTitle } from "@nowwhats/task-management";
import { describe, expect, it } from "vitest";
import { InMemoryTaskRepository } from "./in-memory-task-repository.ts";

const owner = OwnerId.of("u-1");
const now = new Date("2026-10-05T00:00:00Z");

const newTask = (): Task => {
  const id = TaskId.parse("0199b1a0-0000-7000-8000-000000000001");
  const title = TaskTitle.create("a");
  if (!id.ok || !title.ok) throw new Error("invalid fixture");
  return Task.create({ id: id.value, ownerId: owner, title: title.value, now });
};

describe("InMemoryTaskRepository", () => {
  it("保存後に集約を変更しても、save するまで保存内容は変わらない", async () => {
    const repository = new InMemoryTaskRepository();
    const task = newTask();
    await repository.save(task);

    task.complete(now);

    expect((await repository.findById(owner, task.id))?.status).toBe("todo");
  });

  it("他の利用者のタスクは取得できない", async () => {
    const repository = new InMemoryTaskRepository();
    const task = newTask();
    await repository.save(task);

    expect(await repository.findById(OwnerId.of("u-2"), task.id)).toBeNull();
    expect(await repository.findAllByOwner(OwnerId.of("u-2"))).toEqual([]);
  });
});
