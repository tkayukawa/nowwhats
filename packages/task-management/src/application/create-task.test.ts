import { OwnerId } from "@nowwhats/shared-kernel";
import { describe, expect, it } from "vitest";
import type { Task } from "../domain/task.ts";
import { TaskId } from "../domain/task-id.ts";
import type { TaskRepository } from "../domain/task-repository.ts";
import { CreateTask } from "./create-task.ts";

class InMemoryTaskRepository implements TaskRepository {
  readonly tasks = new Map<string, Task>();

  findById(_ownerId: OwnerId, id: TaskId): Promise<Task | null> {
    return Promise.resolve(this.tasks.get(id) ?? null);
  }

  save(task: Task): Promise<void> {
    this.tasks.set(task.id, task);
    return Promise.resolve();
  }
}

const setup = () => {
  const repository = new InMemoryTaskRepository();
  const useCase = new CreateTask({
    repository,
    idGenerator: { next: () => TaskId.of("t-1") },
    clock: { now: () => new Date("2026-10-05T00:00:00Z") },
  });
  return { repository, useCase };
};

describe("CreateTask", () => {
  it("タイトルのみでタスクを登録できる", async () => {
    const { repository, useCase } = setup();

    const result = await useCase.execute({ ownerId: OwnerId.of("u-1"), title: "牛乳を買う" });

    expect(result).toEqual({ ok: true, value: { id: "t-1" } });
    expect(repository.tasks.get("t-1")?.toSnapshot()).toMatchObject({
      title: "牛乳を買う",
      status: "todo",
      priority: "medium",
    });
  });

  it("空のタイトルは保存せずエラーを返す", async () => {
    const { repository, useCase } = setup();

    const result = await useCase.execute({ ownerId: OwnerId.of("u-1"), title: " " });

    expect(result).toEqual({ ok: false, error: { type: "TaskTitleEmpty" } });
    expect(repository.tasks.size).toBe(0);
  });
});
