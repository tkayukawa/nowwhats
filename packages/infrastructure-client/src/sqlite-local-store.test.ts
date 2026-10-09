import { OwnerId } from "@nowwhats/shared-kernel";
import { Task, TaskId, TaskTitle } from "@nowwhats/task-management";
import { describe, expect, it } from "vitest";
import { migrate } from "./migrations.ts";
import { SqliteLocalStore } from "./sqlite-local-store.ts";
import { createTestDatabase } from "./test-support.ts";

const owner = OwnerId.of("local");
const now = new Date("2026-10-05T00:00:00Z");
const ID = "0199b1a0-0000-7000-8000-000000000001";

const newTask = (): Task => {
  const id = TaskId.parse(ID);
  const title = TaskTitle.create("牛乳を買う");
  if (!id.ok || !title.ok) throw new Error("fixture");
  return Task.create({
    id: id.value,
    ownerId: owner,
    title: title.value,
    dueDate: new Date("2026-10-06T00:00:00Z"),
    now,
  });
};

describe("SqliteLocalStore", () => {
  it("タスクを保存・取得・削除できる", async () => {
    const store = new SqliteLocalStore(await createTestDatabase());
    const task = newTask();

    await store.transaction((tx) => tx.tasks.save(task));
    const found = await store.transaction((tx) => tx.tasks.findById(owner, task.id));
    expect(found?.toSnapshot()).toEqual(task.toSnapshot());

    await store.transaction((tx) => tx.tasks.remove(task.id));
    expect(await store.transaction((tx) => tx.tasks.findAllByOwner(owner))).toEqual([]);
  });

  it("例外が起きたトランザクションの変更は取り消される", async () => {
    const store = new SqliteLocalStore(await createTestDatabase());

    await expect(
      store.transaction(async (tx) => {
        await tx.tasks.save(newTask());
        await tx.outbox.append({
          changeId: "c-1",
          command: { type: "CreateTask", id: ID, title: "a" },
        });
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    expect(await store.transaction((tx) => tx.tasks.findAllByOwner(owner))).toEqual([]);
    expect(await store.transaction((tx) => tx.outbox.count())).toBe(0);
    // 失敗後も次のトランザクションは実行できる
    expect(await store.transaction((tx) => tx.syncState.getCursor())).toBe(0);
  });

  it("Outbox は記録順に取り出し、指定した変更だけ削除する", async () => {
    const store = new SqliteLocalStore(await createTestDatabase());
    await store.transaction(async (tx) => {
      await tx.outbox.append({
        changeId: "c-1",
        command: { type: "CreateTask", id: ID, title: "a" },
      });
      await tx.outbox.append({
        changeId: "c-2",
        command: { type: "ChangeTaskStatus", id: ID, action: "complete" },
      });
    });

    await store.transaction((tx) => tx.outbox.remove(["c-1"]));

    const rest = await store.transaction((tx) => tx.outbox.list());
    expect(rest.map((c) => c.changeId)).toEqual(["c-2"]);
  });

  it("マイグレーションは何度実行しても安全", async () => {
    const db = await createTestDatabase();

    expect(() => migrate(db)).not.toThrow();
    expect(db.all<{ user_version: number }>("PRAGMA user_version")).toEqual([{ user_version: 6 }]);
  });
});

describe("マイグレーション 2〜6（ポイント・説明文・完了日時・タグ・状態の履歴）", () => {
  it("ポイント導入前に保存されたタスクは 1 ポイントとして読み込まれる", async () => {
    const sqlite3 = await (await import("@sqlite.org/sqlite-wasm")).default();
    const { fromSqliteWasm } = await import("./sql-database.ts");
    const db = fromSqliteWasm(new sqlite3.oo1.DB(":memory:", "c"));
    // バージョン 1 のスキーマとデータを再現する
    db.run(`CREATE TABLE tasks (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, title TEXT NOT NULL,
      status TEXT NOT NULL, priority TEXT NOT NULL, due_date TEXT, version INTEGER NOT NULL);
      CREATE TABLE server_tasks (id TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE outbox (seq INTEGER PRIMARY KEY AUTOINCREMENT, change_id TEXT NOT NULL UNIQUE, command TEXT NOT NULL);
      CREATE TABLE sync_state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      PRAGMA user_version = 1;`);
    db.run("INSERT INTO tasks VALUES (?, 'local', '古いタスク', 'todo', 'medium', NULL, 1)", [ID]);

    migrate(db);
    const store = new SqliteLocalStore(db);
    const [task] = await store.transaction((tx) => tx.tasks.findAllByOwner(owner));

    expect(task?.toSnapshot()).toMatchObject({
      title: "古いタスク",
      storyPoints: 1,
      description: "",
      completedAt: null,
      tagIds: [],
      statusHistory: [],
    });
  });
});
