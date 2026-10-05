import {
  InMemoryProcessedChangeStore,
  InMemoryTaskRepository,
} from "@nowwhats/infrastructure-server";
import { OwnerId } from "@nowwhats/shared-kernel";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.ts";

const ID = "0199b1a0-0000-7000-8000-000000000001";

const setup = (owner: OwnerId | null = OwnerId.of("u-1")) => {
  const repository = new InMemoryTaskRepository();
  return createApp({
    repository,
    changeFeed: repository,
    processedChanges: new InMemoryProcessedChangeStore(),
    changeLogEpoch: "epoch-1",
    clock: { now: () => new Date("2026-10-05T00:00:00Z") },
    resolveOwner: () => Promise.resolve(owner),
  });
};

const post = (body: unknown) => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

describe("API", () => {
  it("登録 → 一覧 → 完了 の一連の流れ", async () => {
    const app = setup();

    const created = await app.request("/api/tasks", post({ id: ID, title: "牛乳を買う" }));
    expect(created.status).toBe(201);

    const completed = await app.request(`/api/tasks/${ID}/status`, post({ action: "complete" }));
    expect(completed.status).toBe(200);

    const list = await app.request("/api/tasks");
    expect(await list.json()).toMatchObject({
      tasks: [{ id: ID, title: "牛乳を買う", status: "done", version: 2 }],
    });
  });

  it("ドメインのエラーを HTTP ステータスに変換する", async () => {
    const app = setup();

    const emptyTitle = await app.request("/api/tasks", post({ id: ID, title: " " }));
    expect(emptyTitle.status).toBe(400);

    const notFound = await app.request(`/api/tasks/${ID}/status`, post({ action: "start" }));
    expect(notFound.status).toBe(404);

    await app.request("/api/tasks", post({ id: ID, title: "a" }));
    const invalidTransition = await app.request(
      `/api/tasks/${ID}/status`,
      post({ action: "reopen" }),
    );
    expect(invalidTransition.status).toBe(409);
  });

  it("入力形式が不正なら 400 を返す", async () => {
    const app = setup();

    const res = await app.request("/api/tasks", post({ id: ID, title: "a", priority: "x" }));

    expect(res.status).toBe(400);
  });

  it("利用者を特定できなければ 401 を返す", async () => {
    const app = setup(null);

    const res = await app.request("/api/tasks");

    expect(res.status).toBe(401);
  });

  it("同期: push した変更を適用し、pull で cursor 以降の変更を返す", async () => {
    const app = setup();

    const pushed = await app.request(
      "/api/sync/push",
      post({
        changes: [
          { changeId: "c-1", command: { type: "CreateTask", id: ID, title: "a" } },
          { changeId: "c-2", command: { type: "ChangeTaskStatus", id: ID, action: "reopen" } },
        ],
      }),
    );
    expect(await pushed.json()).toEqual({
      results: [
        { changeId: "c-1", status: "applied" },
        {
          changeId: "c-2",
          status: "rejected",
          error: { type: "InvalidStatusTransition", from: "todo", action: "reopen" },
        },
      ],
    });

    const pulled = await app.request("/api/sync/pull?cursor=0");
    expect(await pulled.json()).toMatchObject({
      epoch: "epoch-1",
      changes: [{ seq: 1, task: { id: ID, status: "todo" } }],
      cursor: 1,
      hasMore: false,
    });
  });

  it("同期: 形式が不正な push は 400 を返す", async () => {
    const app = setup();

    const res = await app.request(
      "/api/sync/push",
      post({ changes: [{ changeId: "c-1", command: { type: "DeleteTask", id: ID } }] }),
    );

    expect(res.status).toBe(400);
  });
});
