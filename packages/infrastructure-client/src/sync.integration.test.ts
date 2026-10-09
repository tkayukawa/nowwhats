import {
  InMemoryChangeLog,
  InMemoryProcessedChangeStore,
  InMemoryTagRepository,
  InMemoryTaskRepository,
} from "@nowwhats/infrastructure-server";
import { OwnerId } from "@nowwhats/shared-kernel";
import {
  ApplyPushedChanges,
  ExecuteLocalCommand,
  PullChanges,
  SynchronizeWithServer,
  type SyncApi,
  type TaskCommand,
} from "@nowwhats/sync";
import {
  ChangeTaskStatus,
  CreateTag,
  CreateTask,
  DeleteTag,
  EditTask,
  ListTags,
  ListTasks,
  RecolorTag,
  RenameTag,
} from "@nowwhats/task-management";
import { describe, expect, it } from "vitest";
import { SqliteLocalStore } from "./sqlite-local-store.ts";
import { createTestDatabase } from "./test-support.ts";
import { uuidv7 } from "./uuidv7.ts";

// サーバーの時計。テストの中で進められるようにする
const serverTime = { now: new Date("2026-10-05T00:00:00Z") };
const clock = { now: () => serverTime.now };

/** サーバー（メモリ実装）と、それに接続する SyncApi を作る。online=false で通信失敗を再現する */
const createServer = (epoch = "epoch-1") => {
  const log = new InMemoryChangeLog();
  const repository = new InMemoryTaskRepository(log);
  const tags = new InMemoryTagRepository(log);
  const owner = OwnerId.of("dev-user");
  const push = new ApplyPushedChanges({
    useCasesAt: (at) => ({
      createTask: new CreateTask({ repository, clock: at }),
      changeTaskStatus: new ChangeTaskStatus({ repository, clock: at }),
      editTask: new EditTask({ repository, clock: at }),
      createTag: new CreateTag({ tags }),
      renameTag: new RenameTag({ tags }),
      recolorTag: new RecolorTag({ tags }),
      deleteTag: new DeleteTag({ tags }),
    }),
    clock,
    processedChanges: new InMemoryProcessedChangeStore(),
  });
  const pull = new PullChanges({ feed: log, epoch });
  const connect = (network: { online: boolean }): SyncApi => ({
    push: (changes) => {
      if (!network.online) return Promise.reject(new Error("offline"));
      return push.execute({ ownerId: owner, changes });
    },
    pull: (cursor) => {
      if (!network.online) return Promise.reject(new Error("offline"));
      return pull.execute({ ownerId: owner, cursor, limit: 2 }); // ページ送りも確認するため小さくする
    },
  });
  return { connect };
};

/** クライアント 1 台分（ローカル DB + 操作実行 + 同期）。connectTo で接続先のサーバーを差し替えられる */
const createClient = async (server: ReturnType<typeof createServer>) => {
  const store = new SqliteLocalStore(await createTestDatabase());
  // 端末の時計。テストの中で進められるようにする
  const deviceTime = { now: new Date("2026-10-05T00:00:00Z") };
  const context = { ownerId: OwnerId.of("local"), clock: { now: () => deviceTime.now } };
  const network = { online: true };
  const exec = new ExecuteLocalCommand({ store, context, newChangeId: uuidv7 });
  let sync = new SynchronizeWithServer({ store, api: server.connect(network), context });
  return {
    network,
    deviceTime,
    connectTo: (next: ReturnType<typeof createServer>) => {
      sync = new SynchronizeWithServer({ store, api: next.connect(network), context });
    },
    run: (command: TaskCommand) => exec.execute(command),
    sync: () => sync.execute(),
    tasks: () =>
      store.transaction((tx) =>
        new ListTasks({ repository: tx.tasks }).execute({ ownerId: context.ownerId }),
      ),
    pending: () => store.transaction((tx) => tx.outbox.count()),
    tags: () =>
      store.transaction((tx) =>
        new ListTags({ tags: tx.tags }).execute({ ownerId: context.ownerId }),
      ),
  };
};

describe("同期（クライアント 2 台 + サーバー）", () => {
  it("オフラインで登録した変更が、オンライン復帰後の同期で他の端末に届く", async () => {
    const server = createServer();
    const a = await createClient(server);
    const b = await createClient(server);
    a.network.online = false;

    const id = uuidv7();
    await a.run({ type: "CreateTask", id, title: "牛乳を買う" });
    await a.run({ type: "ChangeTaskStatus", id, action: "start" });
    await expect(a.sync()).rejects.toThrow("offline");
    expect(await a.pending()).toBe(2);
    expect((await a.tasks())[0]).toMatchObject({ title: "牛乳を買う", status: "doing" });

    a.network.online = true;
    expect(await a.sync()).toMatchObject({ pushed: 2, rejected: [] });
    expect(await a.pending()).toBe(0);

    await b.sync();
    expect(await b.tasks()).toMatchObject([{ id, title: "牛乳を買う", status: "doing" }]);
  });

  it("競合した変更は差し戻され、ローカルはサーバーの状態に作り直される", async () => {
    const server = createServer();
    const a = await createClient(server);
    const b = await createClient(server);
    const id = uuidv7();
    await a.run({ type: "CreateTask", id, title: "本を読む" });
    await a.sync();
    await b.sync();

    // A が完了させて同期した後、オフラインの B が中止する
    await a.run({ type: "ChangeTaskStatus", id, action: "complete" });
    await a.sync();
    b.network.online = false;
    await b.run({ type: "ChangeTaskStatus", id, action: "cancel" });
    expect((await b.tasks())[0]?.status).toBe("canceled");

    b.network.online = true;
    const report = await b.sync();

    expect(report.rejected).toEqual([
      expect.objectContaining({
        title: "本を読む",
        error: { type: "InvalidStatusTransition", from: "done", action: "cancel" },
      }),
    ]);
    expect((await b.tasks())[0]).toMatchObject({ status: "done" });
    expect(await b.pending()).toBe(0);
  });

  it("未送信の操作は、サーバーの変更を取り込んだ後も再実行されて残る", async () => {
    const server = createServer();
    const a = await createClient(server);
    const b = await createClient(server);
    const t1 = uuidv7();
    const t2 = uuidv7();
    await a.run({ type: "CreateTask", id: t1, title: "1" });
    await a.run({ type: "CreateTask", id: t2, title: "2" });
    await a.sync();
    await b.sync();

    // A が t1 に着手して同期。B はオフラインで t1 を完了させる（doing → done は有効）
    await a.run({ type: "ChangeTaskStatus", id: t1, action: "start" });
    await a.sync();
    b.network.online = false;
    await b.run({ type: "ChangeTaskStatus", id: t1, action: "complete" });

    b.network.online = true;
    const report = await b.sync();

    expect(report).toMatchObject({ pushed: 1, rejected: [] });
    expect((await b.tasks()).find((t) => t.id === t1)?.status).toBe("done");
    await a.sync();
    expect((await a.tasks()).find((t) => t.id === t1)?.status).toBe("done");
  });

  it("サーバーの変更ログが振り直されたら（epoch の変化）、最初から取り込み直す", async () => {
    const before = createServer("epoch-1");
    const a = await createClient(before);
    const old = uuidv7();
    await a.run({ type: "CreateTask", id: old, title: "消えるタスク" });
    await a.run({ type: "ChangeTaskStatus", id: old, action: "start" });
    await a.sync();

    // サーバーのデータが失われて作り直された。別の端末 B が新しいサーバーにタスクを登録する
    const after = createServer("epoch-2");
    const b = await createClient(after);
    const kept = uuidv7();
    await b.run({ type: "CreateTask", id: kept, title: "新しいサーバーのタスク" });
    await b.sync();

    a.connectTo(after);
    await a.sync();

    // 新しいサーバーにあるタスクを取り込み、存在しないタスクはローカルからも消える
    expect((await a.tasks()).map((t) => t.title)).toEqual(["新しいサーバーのタスク"]);
  });

  it("2 台で別の項目を編集すると、両方の変更が残る（項目ごとに後の変更を優先）", async () => {
    const server = createServer();
    const a = await createClient(server);
    const b = await createClient(server);
    const id = uuidv7();
    await a.run({ type: "CreateTask", id, title: "旅行の準備" });
    await a.sync();
    await b.sync();

    // オフラインの間に、A は説明文、B はポイントとタイトルを編集する
    a.network.online = false;
    b.network.online = false;
    await a.run({ type: "EditTask", id, changes: { description: "- 宿を予約\n- 切符を買う" } });
    await b.run({ type: "EditTask", id, changes: { storyPoints: 3, title: "週末の旅行の準備" } });
    await a.run({ type: "EditTask", id, changes: { title: "旅行の準備をする" } });

    a.network.online = true;
    b.network.online = true;
    await a.sync();
    await b.sync();
    await a.sync();

    // タイトルは後からサーバーに届いた B の値。説明文（A）とポイント（B）は両方残る
    for (const client of [a, b]) {
      expect((await client.tasks())[0]).toMatchObject({
        title: "週末の旅行の準備",
        description: "- 宿を予約\n- 切符を買う",
        storyPoints: 3,
      });
    }
  });

  it("オフラインで完了したタスクは、同期した日時ではなく完了した日時が記録される", async () => {
    const server = createServer();
    const a = await createClient(server);
    const id = uuidv7();
    await a.run({ type: "CreateTask", id, title: "請求書を送る" });
    await a.sync();

    a.network.online = false;
    a.deviceTime.now = new Date("2026-10-05T09:30:00Z");
    await a.run({ type: "ChangeTaskStatus", id, action: "complete" });

    // 2 日後にオンラインに戻って同期する
    serverTime.now = new Date("2026-10-07T12:00:00Z");
    a.deviceTime.now = serverTime.now;
    a.network.online = true;
    await a.sync();

    const b = await createClient(server);
    await b.sync();
    for (const client of [a, b]) {
      const task = (await client.tasks())[0];
      expect(task?.completedAt).toBe("2026-10-05T09:30:00.000Z");
      // 状態の履歴も、同期した日時ではなく操作した日時で残る
      expect(task?.statusHistory).toEqual([
        { status: "todo", at: "2026-10-05T00:00:00.000Z" },
        { status: "done", at: "2026-10-05T09:30:00.000Z" },
      ]);
    }
    serverTime.now = new Date("2026-10-05T00:00:00Z");
  });

  it("タグの作成・名前変更・削除と、タスクへのタグ付けが他の端末に届く", async () => {
    const server = createServer();
    const a = await createClient(server);
    const b = await createClient(server);
    const work = uuidv7();
    const home = uuidv7();
    const task = uuidv7();
    await a.run({ type: "CreateTag", id: work, name: "仕事" });
    await a.run({ type: "CreateTag", id: home, name: "家" });
    await a.run({ type: "CreateTask", id: task, title: "請求書", tagIds: [work, home] });
    await a.sync();
    await b.sync();
    expect((await b.tags()).map((t) => [t.name, t.color])).toEqual(
      expect.arrayContaining([
        ["仕事", "blue"],
        ["家", "orange"],
      ]),
    );
    expect((await b.tasks())[0]?.tagIds).toEqual([work, home]);

    await b.run({ type: "RenameTag", id: work, name: "仕事（本業）" });
    await b.run({ type: "DeleteTag", id: home });
    await b.sync();
    await a.sync();

    expect((await a.tags()).map((t) => t.name)).toEqual(["仕事（本業）"]);
    // 削除したタグの ID はタスクに残る（表示・集計で外す。ADR 0007）
    expect((await a.tasks())[0]?.tagIds).toEqual([work, home]);
  });

  it("オフラインの 2 台で同じ名前のタグを作ると、後から届いた方が差し戻される", async () => {
    const server = createServer();
    const a = await createClient(server);
    const b = await createClient(server);
    a.network.online = false;
    b.network.online = false;
    await a.run({ type: "CreateTag", id: uuidv7(), name: "読書" });
    const late = uuidv7();
    await b.run({ type: "CreateTag", id: late, name: "読書" });

    a.network.online = true;
    b.network.online = true;
    await a.sync();
    const report = await b.sync();

    expect(report.rejected).toEqual([
      expect.objectContaining({ title: "読書", error: { type: "TagNameDuplicate" } }),
    ]);
    // B のローカルは、サーバーにある A のタグだけになる
    const tags = await b.tags();
    expect(tags).toHaveLength(1);
    expect(tags[0]?.id).not.toBe(late);
  });
});
