import type { OwnerId } from "@nowwhats/shared-kernel";
import {
  Task,
  type TaskId,
  type TaskRepository,
  type TaskSnapshot,
} from "@nowwhats/task-management";

/**
 * メモリ上に保存する TaskRepository。プロセスを再起動するとデータは消える。
 * ステップ 3（縦の一本通し）専用で、PostgreSQL 実装（ADR 0003）に置き換える。
 */
export class InMemoryTaskRepository implements TaskRepository {
  private readonly snapshots = new Map<TaskId, TaskSnapshot>();

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
    this.snapshots.set(task.id, task.toSnapshot());
    return Promise.resolve();
  }
}
