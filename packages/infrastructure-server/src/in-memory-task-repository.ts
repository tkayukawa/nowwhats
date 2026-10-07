import type { OwnerId } from "@nowwhats/shared-kernel";
import {
  Task,
  toTaskDto,
  type TaskId,
  type TaskRepository,
  type TaskSnapshot,
} from "@nowwhats/task-management";
import type { InMemoryChangeLog } from "./in-memory-change-log.ts";

/**
 * メモリ上に保存する TaskRepository。保存のたびに変更ログへ記録する。
 * プロセスを再起動するとデータは消える。PostgreSQL 実装（ADR 0003）に置き換えるまでの暫定。
 */
export class InMemoryTaskRepository implements TaskRepository {
  private readonly snapshots = new Map<TaskId, TaskSnapshot>();
  private readonly log: InMemoryChangeLog;

  constructor(log: InMemoryChangeLog) {
    this.log = log;
  }

  findById(ownerId: OwnerId, id: TaskId): Promise<Task | null> {
    const snapshot = this.snapshots.get(id);
    if (snapshot === undefined || snapshot.ownerId !== ownerId) {
      return Promise.resolve(null);
    }
    return Promise.resolve(Task.reconstruct(snapshot));
  }

  findAllByOwner(ownerId: OwnerId): Promise<Task[]> {
    const tasks = [...this.snapshots.values()]
      .filter((s) => s.ownerId === ownerId)
      .map((s) => Task.reconstruct(s));
    return Promise.resolve(tasks);
  }

  save(task: Task): Promise<void> {
    // 呼び出し側が保持する集約の変更が混ざらないよう、スナップショットで保存する
    const snapshot = task.toSnapshot();
    this.snapshots.set(task.id, snapshot);
    this.log.append(snapshot.ownerId, { kind: "task", task: toTaskDto(task) });
    return Promise.resolve();
  }
}
