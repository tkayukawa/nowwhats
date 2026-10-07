import { fromTagDto, fromTaskDto, TagId, TaskId } from "@nowwhats/task-management";
import type { LocalStore, LocalTransaction, SyncApi } from "./client-ports.ts";
import { fixedClock, replayTime } from "./execute-command.ts";
import { executeLocally, type ClientContext } from "./execute-local-command.ts";
import type { CommandError, SyncChange } from "./sync-protocol.ts";
import { isTagCommand, type PendingChange } from "./task-command.ts";

const PUSH_BATCH_SIZE = 100;

export interface RejectedChange {
  readonly change: PendingChange;
  readonly error: CommandError;
  /** 利用者への通知用。差し戻し時点でローカルにあったタスクのタイトル、またはタグの名前 */
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

/** リベースの対象。タスクとタグを分けて持つ */
interface Affected {
  readonly tasks: Set<string>;
  readonly tags: Set<string>;
}

/**
 * Outbox の変更をサーバーへ送り（push）、サーバーの変更を取り込む（pull）。
 * 最後に、影響を受けたタスクとタグを「サーバーの状態 + 未送信の操作の再実行」で作り直す（リベース）。
 * 通信に失敗した場合は例外を投げ、Outbox とカーソルは失敗前の状態を保つ。
 */
export class SynchronizeWithServer {
  private readonly deps: SynchronizeWithServerDeps;

  constructor(deps: SynchronizeWithServerDeps) {
    this.deps = deps;
  }

  async execute(): Promise<SyncReport> {
    const { store, api } = this.deps;
    const affected: Affected = { tasks: new Set(), tags: new Set() };
    const markCommand = (change: PendingChange) =>
      (isTagCommand(change.command) ? affected.tags : affected.tasks).add(change.command.id);
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
            markCommand(change);
            rejected.push({
              change,
              error: result.error,
              title: await this.titleOf(tx, change),
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
          // 初回、または変更ログが振り直された。取り込み済みの状態を捨て、すべてをリベース対象にする
          await tx.serverTasks.clear();
          await tx.serverTags.clear();
          await tx.syncState.setEpoch(page.epoch);
          const { ownerId } = this.deps.context;
          for (const task of await tx.tasks.findAllByOwner(ownerId)) affected.tasks.add(task.id);
          for (const tag of await tx.tags.findAllByOwner(ownerId)) affected.tags.add(tag.id);
          if (cursor !== 0) {
            // 途中からのページは使えないので、最初から取り込み直す
            await tx.syncState.setCursor(0);
            return true;
          }
        }
        for (const change of page.changes) {
          await applyServerChange(tx, change, affected);
        }
        await tx.syncState.setCursor(page.cursor);
        return false;
      });
      if (reset) continue;
      pulled += page.changes.length;
      if (!page.hasMore) break;
    }

    if (affected.tasks.size > 0 || affected.tags.size > 0) {
      await store.transaction((tx) => this.rebase(tx, affected));
    }
    return { pushed, rejected, pulled };
  }

  private async rebase(tx: LocalTransaction, affected: Affected): Promise<void> {
    const { ownerId } = this.deps.context;
    for (const id of affected.tasks) {
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
    for (const id of affected.tags) {
      const parsed = TagId.parse(id);
      if (!parsed.ok) continue;
      const server = await tx.serverTags.find(id);
      const tag = server === null ? null : fromTagDto(server, ownerId);
      if (tag === null) {
        await tx.tags.remove(ownerId, parsed.value);
      } else {
        await tx.tags.save(tag);
      }
    }
    // 未送信の操作を、実行された日時で再実行する。失敗したものは次回の push でサーバーに差し戻される
    const now = this.deps.context.clock.now();
    for (const change of await tx.outbox.list()) {
      const target = isTagCommand(change.command) ? affected.tags : affected.tasks;
      if (target.has(change.command.id)) {
        await executeLocally(tx, change.command, {
          ...this.deps.context,
          clock: fixedClock(replayTime(change.occurredAt, now)),
        });
      }
    }
  }

  private async titleOf(tx: LocalTransaction, change: PendingChange): Promise<string | null> {
    const { command } = change;
    const { ownerId } = this.deps.context;
    switch (command.type) {
      case "CreateTask":
        return command.title;
      case "CreateTag":
        return command.name;
      case "RenameTag":
      case "RecolorTag":
      case "DeleteTag": {
        const id = TagId.parse(command.id);
        return id.ok ? ((await tx.tags.findById(ownerId, id.value))?.name ?? null) : null;
      }
      case "ChangeTaskStatus":
      case "EditTask": {
        const id = TaskId.parse(command.id);
        if (!id.ok) return null;
        return (await tx.tasks.findById(ownerId, id.value))?.toSnapshot().title ?? null;
      }
    }
  }
}

/** pull で受け取った変更を、最後に受け取ったサーバーの状態として保存する */
const applyServerChange = async (
  tx: LocalTransaction,
  change: SyncChange,
  affected: Affected,
): Promise<void> => {
  switch (change.kind) {
    case "task":
      await tx.serverTasks.upsert(change.task);
      affected.tasks.add(change.task.id);
      return;
    case "tag":
      await tx.serverTags.upsert(change.tag);
      affected.tags.add(change.tag.id);
      return;
    case "tagDeleted":
      await tx.serverTags.remove(change.tagId);
      affected.tags.add(change.tagId);
      return;
  }
};
