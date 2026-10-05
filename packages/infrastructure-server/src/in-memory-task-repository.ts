import type { OwnerId } from "@nowwhats/shared-kernel";
import type { TaskChange, TaskChangeFeed } from "@nowwhats/sync";
import {
  Task,
  toTaskDto,
  type TaskId,
  type TaskRepository,
  type TaskSnapshot,
} from "@nowwhats/task-management";

interface ChangeLogEntry {
  readonly seq: number;
  readonly snapshot: TaskSnapshot;
}

/**
 * メモリ上に保存する TaskRepository 兼 変更ログ。プロセスを再起動するとデータは消える。
 * PostgreSQL 実装（ADR 0003）に置き換えるまでの暫定。
 */
export class InMemoryTaskRepository implements TaskRepository, TaskChangeFeed {
  private readonly snapshots = new Map<TaskId, TaskSnapshot>();
  private readonly changeLog: ChangeLogEntry[] = [];
  private seq = 0;

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
    this.seq += 1;
    this.changeLog.push({ seq: this.seq, snapshot });
    return Promise.resolve();
  }

  since(ownerId: OwnerId, cursor: number, limit: number): Promise<TaskChange[]> {
    const changes = this.changeLog
      .filter((e) => e.seq > cursor && e.snapshot.ownerId === ownerId)
      .slice(0, limit)
      .map((e) => ({ seq: e.seq, task: toTaskDto(Task.reconstruct(e.snapshot)) }));
    return Promise.resolve(changes);
  }
}
