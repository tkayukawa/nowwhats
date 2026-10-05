import { fromTaskDto, TaskId } from "@nowwhats/task-management";
import type { LocalStore, LocalTransaction, SyncApi } from "./client-ports.ts";
import { executeLocally, type ClientContext } from "./execute-local-command.ts";
import type { CommandError } from "./sync-protocol.ts";
import type { PendingChange } from "./task-command.ts";

const PUSH_BATCH_SIZE = 100;

export interface RejectedChange {
  readonly change: PendingChange;
  readonly error: CommandError;
  /** 利用者への通知用。差し戻し時点でローカルにあったタイトル */
  readonly title: string | null;
}

export interface SyncReport {
  readonly pushed: number;
  readonly rejected: RejectedChange[];
  readonly pulled: number;
}

export interface SynchronizeWithServerDeps {
  readonly store: LocalStore;
  readonly api: SyncApi;
  readonly context: ClientContext;
}

/**
 * Outbox の変更をサーバーへ送り（push）、サーバーの変更を取り込む（pull）。
 * 最後に、影響を受けたタスクを「サーバーの状態 + 未送信の操作の再実行」で作り直す（リベース）。
 * 通信に失敗した場合は例外を投げ、Outbox とカーソルは失敗前の状態を保つ。
 */
export class SynchronizeWithServer {
  private readonly deps: SynchronizeWithServerDeps;

  constructor(deps: SynchronizeWithServerDeps) {
    this.deps = deps;
  }

  async execute(): Promise<SyncReport> {
    const { store, api } = this.deps;
    const affected = new Set<string>();
    const rejected: RejectedChange[] = [];
    let pushed = 0;

    for (;;) {
      const batch = await store.transaction((tx) => tx.outbox.list(PUSH_BATCH_SIZE));
      if (batch.length === 0) break;
      const results = await api.push(batch);
      await store.transaction(async (tx) => {
        for (const result of results) {
          const change = batch.find((c) => c.changeId === result.changeId);
          if (change === undefined) continue;
          pushed += 1;
          if (result.status === "rejected") {
            affected.add(change.command.id);
            rejected.push({
              change,
              error: result.error,
              title: await titleOf(tx, change, this.deps.context),
            });
          }
        }
        await tx.outbox.remove(results.map((r) => r.changeId));
      });
      if (results.length < batch.length) break;
    }

    let pulled = 0;
    for (;;) {
      const cursor = await store.transaction((tx) => tx.syncState.getCursor());
      const page = await api.pull(cursor);
      const reset = await store.transaction(async (tx) => {
        if ((await tx.syncState.getEpoch()) !== page.epoch) {
          // 初回、または変更ログが振り直された。取り込み済みの状態を捨て、全タスクをリベース対象にする
          await tx.serverTasks.clear();
          await tx.syncState.setEpoch(page.epoch);
          for (const task of await tx.tasks.findAllByOwner(this.deps.context.ownerId)) {
            affected.add(task.id);
          }
          if (cursor !== 0) {
            // 途中からのページは使えないので、最初から取り込み直す
            await tx.syncState.setCursor(0);
            return true;
          }
        }
        for (const change of page.changes) {
          await tx.serverTasks.upsert(change.task);
          affected.add(change.task.id);
        }
        await tx.syncState.setCursor(page.cursor);
        return false;
      });
      if (reset) continue;
      pulled += page.changes.length;
      if (!page.hasMore) break;
    }

    if (affected.size > 0) {
      await store.transaction((tx) => this.rebase(tx, affected));
    }
    return { pushed, rejected, pulled };
  }

  private async rebase(tx: LocalTransaction, taskIds: ReadonlySet<string>): Promise<void> {
    const { ownerId } = this.deps.context;
    for (const id of taskIds) {
      const parsed = TaskId.parse(id);
      if (!parsed.ok) continue;
      const server = await tx.serverTasks.find(id);
      const task = server === null ? null : fromTaskDto(server, ownerId);
      if (task === null) {
        await tx.tasks.remove(parsed.value);
      } else {
        await tx.tasks.save(task);
      }
    }
    // 未送信の操作を再実行する。失敗したものは次回の push でサーバーに差し戻される
    for (const change of await tx.outbox.list()) {
      if (taskIds.has(change.command.id)) {
        await executeLocally(tx, change.command, this.deps.context);
      }
    }
  }
}

const titleOf = async (
  tx: LocalTransaction,
  change: PendingChange,
  context: ClientContext,
): Promise<string | null> => {
  if (change.command.type === "CreateTask") {
    return change.command.title;
  }
  const id = TaskId.parse(change.command.id);
  if (!id.ok) return null;
  const task = await tx.tasks.findById(context.ownerId, id.value);
  return task?.toSnapshot().title ?? null;
};
