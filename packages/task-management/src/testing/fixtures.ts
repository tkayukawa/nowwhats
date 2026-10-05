import { OwnerId } from "@nowwhats/shared-kernel";
import type { Task } from "../domain/task.ts";
import type { TaskId } from "../domain/task-id.ts";
import type { TaskRepository } from "../domain/task-repository.ts";

/** テスト専用。公開 API（index.ts）からは export しない。 */
export class InMemoryTaskRepository implements TaskRepository {
  private readonly tasks = new Map<string, Task>();

  findById(ownerId: OwnerId, id: TaskId): Promise<Task | null> {
    const task = this.tasks.get(id);
    return Promise.resolve(task !== undefined && task.ownerId === ownerId ? task : null);
  }

  findAllByOwner(ownerId: OwnerId): Promise<Task[]> {
    return Promise.resolve([...this.tasks.values()].filter((t) => t.ownerId === ownerId));
  }

  save(task: Task): Promise<void> {
    this.tasks.set(task.id, task);
    return Promise.resolve();
  }

  get size(): number {
    return this.tasks.size;
  }
}

export const OWNER = OwnerId.of("u-1");
export const OTHER_OWNER = OwnerId.of("u-2");
export const NOW = new Date("2026-10-05T00:00:00Z");
export const fixedClock = { now: () => NOW };

/** 固定の UUIDv7 形式 ID（末尾の数字だけ変える） */
export const uuid = (n: number): string => `0199b1a0-0000-7000-8000-${String(n).padStart(12, "0")}`;
