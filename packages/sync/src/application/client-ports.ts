import type {
  TagDto,
  TagRepository,
  TaskDto,
  TaskId,
  TaskRepository,
} from "@nowwhats/task-management";
import type { ChangeResult, PullResult } from "./sync-protocol.ts";
import type { PendingChange } from "./task-command.ts";

/** クライアントのローカル表示用 Repository。リベース時に削除が必要になる。 */
export interface LocalTaskRepository extends TaskRepository {
  remove(id: TaskId): Promise<void>;
}

/** 送信待ちの変更の置き場（記録順に取り出す） */
export interface OutboxStore {
  append(change: PendingChange): Promise<void>;
  list(limit?: number): Promise<PendingChange[]>;
  remove(changeIds: readonly string[]): Promise<void>;
  count(): Promise<number>;
}

/** 最後に受け取ったサーバー側の状態（リベースの基準） */
export interface ServerStateStore<T> {
  upsert(item: T): Promise<void>;
  find(id: string): Promise<T | null>;
  remove(id: string): Promise<void>;
  /** サーバーの epoch が変わったときに、取り込み済みの状態をすべて捨てる */
  clear(): Promise<void>;
}

export type ServerTaskStore = ServerStateStore<TaskDto>;
export type ServerTagStore = ServerStateStore<TagDto>;

export interface SyncStateStore {
  getCursor(): Promise<number>;
  setCursor(cursor: number): Promise<void>;
  getEpoch(): Promise<string | null>;
  setEpoch(epoch: string): Promise<void>;
}

export interface LocalTransaction {
  readonly tasks: LocalTaskRepository;
  readonly tags: TagRepository;
  readonly serverTasks: ServerTaskStore;
  readonly serverTags: ServerTagStore;
  readonly outbox: OutboxStore;
  readonly syncState: SyncStateStore;
}

/** ローカル DB の Unit of Work。fn 内の変更はすべて確定するか、すべて取り消される。 */
export interface LocalStore {
  transaction<T>(fn: (tx: LocalTransaction) => Promise<T>): Promise<T>;
}

/** サーバーの同期 API の Port。通信に失敗した場合は例外を投げる。 */
export interface SyncApi {
  push(changes: readonly PendingChange[]): Promise<ChangeResult[]>;
  pull(cursor: number): Promise<PullResult>;
}
