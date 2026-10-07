import type { OwnerId } from "@nowwhats/shared-kernel";
import type {
  LocalStore,
  LocalTaskRepository,
  LocalTransaction,
  OutboxStore,
  PendingChange,
  ServerStateStore,
  SyncStateStore,
} from "@nowwhats/sync";
import {
  fromTagDto,
  PRIORITIES,
  StoryPoint,
  type Tag,
  type TagDto,
  TagId,
  type TagRepository,
  Task,
  TaskDescription,
  TASK_STATUSES,
  TaskId,
  TaskTitle,
  type TaskDto,
} from "@nowwhats/task-management";
import type { SqlDatabase } from "./sql-database.ts";

type TaskRow = {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  due_date: string | null;
  story_points: number;
  tag_ids: string;
  completed_at: string | null;
  version: number;
};

const toTask = (row: TaskRow, ownerId: OwnerId): Task => {
  const id = TaskId.parse(row.id);
  const title = TaskTitle.create(row.title);
  const status = TASK_STATUSES.find((s) => s === row.status);
  const priority = PRIORITIES.find((p) => p === row.priority);
  const storyPoints = StoryPoint.parse(row.story_points);
  const description = TaskDescription.create(row.description);
  if (
    !id.ok ||
    !title.ok ||
    !description.ok ||
    status === undefined ||
    priority === undefined ||
    !storyPoints.ok
  ) {
    throw new Error(`corrupted local task row: ${row.id}`);
  }
  return Task.reconstruct({
    id: id.value,
    ownerId,
    title: title.value,
    description: description.value,
    status,
    priority,
    dueDate: row.due_date === null ? null : new Date(row.due_date),
    storyPoints: storyPoints.value,
    tagIds: (JSON.parse(row.tag_ids) as string[]).flatMap((raw) => {
      const tagId = TagId.parse(raw);
      return tagId.ok ? [tagId.value] : [];
    }),
    completedAt: row.completed_at === null ? null : new Date(row.completed_at),
    version: row.version,
  });
};

class SqliteTaskRepository implements LocalTaskRepository {
  private readonly db: SqlDatabase;

  constructor(db: SqlDatabase) {
    this.db = db;
  }

  findById(ownerId: OwnerId, id: TaskId): Promise<Task | null> {
    const [row] = this.db.all<TaskRow>("SELECT * FROM tasks WHERE owner_id = ? AND id = ?", [
      ownerId,
      id,
    ]);
    return Promise.resolve(row === undefined ? null : toTask(row, ownerId));
  }

  findAllByOwner(ownerId: OwnerId): Promise<Task[]> {
    const rows = this.db.all<TaskRow>("SELECT * FROM tasks WHERE owner_id = ?", [ownerId]);
    return Promise.resolve(rows.map((row) => toTask(row, ownerId)));
  }

  save(task: Task): Promise<void> {
    const s = task.toSnapshot();
    this.db.run(
      `INSERT INTO tasks (id, owner_id, title, description, status, priority, due_date, story_points, tag_ids, completed_at, version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET
         owner_id = excluded.owner_id, title = excluded.title, description = excluded.description,
         status = excluded.status,
         priority = excluded.priority, due_date = excluded.due_date,
         story_points = excluded.story_points, tag_ids = excluded.tag_ids,
         completed_at = excluded.completed_at,
         version = excluded.version`,
      [
        s.id,
        s.ownerId,
        s.title,
        s.description,
        s.status,
        s.priority,
        s.dueDate?.toISOString() ?? null,
        s.storyPoints,
        JSON.stringify(s.tagIds),
        s.completedAt?.toISOString() ?? null,
        s.version,
      ],
    );
    return Promise.resolve();
  }

  remove(id: TaskId): Promise<void> {
    this.db.run("DELETE FROM tasks WHERE id = ?", [id]);
    return Promise.resolve();
  }
}

/** 最後に受け取ったサーバーの状態を JSON で保存する（server_tasks / server_tags） */
class SqliteServerStateStore<T extends { readonly id: string }> implements ServerStateStore<T> {
  private readonly db: SqlDatabase;
  private readonly table: "server_tasks" | "server_tags";

  constructor(db: SqlDatabase, table: "server_tasks" | "server_tags") {
    this.db = db;
    this.table = table;
  }

  upsert(item: T): Promise<void> {
    this.db.run(
      `INSERT INTO ${this.table} (id, data) VALUES (?, ?) ON CONFLICT (id) DO UPDATE SET data = excluded.data`,
      [item.id, JSON.stringify(item)],
    );
    return Promise.resolve();
  }

  find(id: string): Promise<T | null> {
    const [row] = this.db.all<{ data: string }>(`SELECT data FROM ${this.table} WHERE id = ?`, [
      id,
    ]);
    return Promise.resolve(row === undefined ? null : (JSON.parse(row.data) as T));
  }

  remove(id: string): Promise<void> {
    this.db.run(`DELETE FROM ${this.table} WHERE id = ?`, [id]);
    return Promise.resolve();
  }

  clear(): Promise<void> {
    this.db.run(`DELETE FROM ${this.table}`);
    return Promise.resolve();
  }
}

type TagRow = { id: string; owner_id: string; name: string; color: string; version: number };

class SqliteTagRepository implements TagRepository {
  private readonly db: SqlDatabase;

  constructor(db: SqlDatabase) {
    this.db = db;
  }

  private toTag(row: TagRow, ownerId: OwnerId): Tag {
    const tag = fromTagDto(row, ownerId);
    if (tag === null) throw new Error(`corrupted local tag row: ${row.id}`);
    return tag;
  }

  findById(ownerId: OwnerId, id: TagId): Promise<Tag | null> {
    const [row] = this.db.all<TagRow>("SELECT * FROM tags WHERE owner_id = ? AND id = ?", [
      ownerId,
      id,
    ]);
    return Promise.resolve(row === undefined ? null : this.toTag(row, ownerId));
  }

  findAllByOwner(ownerId: OwnerId): Promise<Tag[]> {
    const rows = this.db.all<TagRow>("SELECT * FROM tags WHERE owner_id = ?", [ownerId]);
    return Promise.resolve(rows.map((row) => this.toTag(row, ownerId)));
  }

  save(tag: Tag): Promise<void> {
    const s = tag.toSnapshot();
    this.db.run(
      `INSERT INTO tags (id, owner_id, name, color, version) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET
         owner_id = excluded.owner_id, name = excluded.name, color = excluded.color, version = excluded.version`,
      [s.id, s.ownerId, s.name, s.color, s.version],
    );
    return Promise.resolve();
  }

  remove(ownerId: OwnerId, id: TagId): Promise<void> {
    this.db.run("DELETE FROM tags WHERE owner_id = ? AND id = ?", [ownerId, id]);
    return Promise.resolve();
  }
}

class SqliteOutboxStore implements OutboxStore {
  private readonly db: SqlDatabase;

  constructor(db: SqlDatabase) {
    this.db = db;
  }

  append(change: PendingChange): Promise<void> {
    this.db.run("INSERT INTO outbox (change_id, command, occurred_at) VALUES (?, ?, ?)", [
      change.changeId,
      JSON.stringify(change.command),
      change.occurredAt ?? null,
    ]);
    return Promise.resolve();
  }

  list(limit = -1): Promise<PendingChange[]> {
    const rows = this.db.all<{ change_id: string; command: string; occurred_at: string | null }>(
      "SELECT change_id, command, occurred_at FROM outbox ORDER BY seq LIMIT ?",
      [limit],
    );
    return Promise.resolve(
      rows.map((r) => ({
        changeId: r.change_id,
        command: JSON.parse(r.command) as PendingChange["command"],
        ...(r.occurred_at !== null && { occurredAt: r.occurred_at }),
      })),
    );
  }

  remove(changeIds: readonly string[]): Promise<void> {
    for (const id of changeIds) {
      this.db.run("DELETE FROM outbox WHERE change_id = ?", [id]);
    }
    return Promise.resolve();
  }

  count(): Promise<number> {
    const [row] = this.db.all<{ n: number }>("SELECT COUNT(*) AS n FROM outbox");
    return Promise.resolve(row?.n ?? 0);
  }
}

class SqliteSyncStateStore implements SyncStateStore {
  private readonly db: SqlDatabase;

  constructor(db: SqlDatabase) {
    this.db = db;
  }

  getCursor(): Promise<number> {
    const [row] = this.db.all<{ value: string }>(
      "SELECT value FROM sync_state WHERE key = 'cursor'",
    );
    return Promise.resolve(row === undefined ? 0 : Number(row.value));
  }

  setCursor(cursor: number): Promise<void> {
    this.set("cursor", String(cursor));
    return Promise.resolve();
  }

  getEpoch(): Promise<string | null> {
    const [row] = this.db.all<{ value: string }>(
      "SELECT value FROM sync_state WHERE key = 'epoch'",
    );
    return Promise.resolve(row?.value ?? null);
  }

  setEpoch(epoch: string): Promise<void> {
    this.set("epoch", epoch);
    return Promise.resolve();
  }

  private set(key: string, value: string): void {
    this.db.run(
      "INSERT INTO sync_state (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
      [key, value],
    );
  }
}

/**
 * SQLite による LocalStore。トランザクションは 1 本の列に並べて順番に実行する。
 * fn の中から transaction を呼ぶと、前の処理の完了を待ち続けて止まるため、入れ子にしないこと。
 */
export class SqliteLocalStore implements LocalStore {
  private readonly db: SqlDatabase;
  private readonly tx: LocalTransaction;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(db: SqlDatabase) {
    this.db = db;
    this.tx = {
      tasks: new SqliteTaskRepository(db),
      tags: new SqliteTagRepository(db),
      serverTasks: new SqliteServerStateStore<TaskDto>(db, "server_tasks"),
      serverTags: new SqliteServerStateStore<TagDto>(db, "server_tags"),
      outbox: new SqliteOutboxStore(db),
      syncState: new SqliteSyncStateStore(db),
    };
  }

  transaction<T>(fn: (tx: LocalTransaction) => Promise<T>): Promise<T> {
    const run = async (): Promise<T> => {
      this.db.run("BEGIN");
      try {
        const result = await fn(this.tx);
        this.db.run("COMMIT");
        return result;
      } catch (e) {
        this.db.run("ROLLBACK");
        throw e;
      }
    };
    const next = this.queue.then(run, run);
    this.queue = next.catch(() => undefined);
    return next;
  }
}
