import type { AppType } from "@nowwhats/api/app";
import { openBrowserDatabase, SqliteLocalStore, uuidv7 } from "@nowwhats/infrastructure-client";
import { OwnerId } from "@nowwhats/shared-kernel";
import {
  ExecuteLocalCommand,
  SynchronizeWithServer,
  type ClientContext,
  type SyncApi,
  type TaskCommand,
} from "@nowwhats/sync";
import { ListTasks } from "@nowwhats/task-management";
import { hc } from "hono/client";
import type { LocalSnapshot, WorkerMessage, WorkerRequest } from "./protocol.ts";

/**
 * ローカル DB と同期処理を動かす Web Worker。要求は届いた順に 1 件ずつ処理される
 * （トランザクションの直列化は SqliteLocalStore が行う）。
 */
// tsconfig の lib は DOM のため、Worker のグローバルは必要な分だけ型を付ける
const scope = self as unknown as {
  readonly location: { readonly origin: string };
  onmessage: ((e: MessageEvent<{ id: number; request: WorkerRequest }>) => void) | null;
  postMessage(message: WorkerMessage): void;
};

// ローカル DB は端末内の 1 利用者専用。認証導入後は利用者ごとに DB を分ける
const context: ClientContext = { ownerId: OwnerId.of("local"), clock: { now: () => new Date() } };

const api = hc<AppType>(scope.location.origin);

const syncApi: SyncApi = {
  async push(changes) {
    const res = await api.api.sync.push.$post({ json: { changes: [...changes] } });
    if (!res.ok) throw new Error(`push failed: ${res.status}`);
    return (await res.json()).results;
  },
  async pull(cursor) {
    const res = await api.api.sync.pull.$get({ query: { cursor: String(cursor) } });
    if (!res.ok) throw new Error(`pull failed: ${res.status}`);
    return res.json();
  },
};

const app = openBrowserDatabase().then(({ db, persistent }) => {
  const store = new SqliteLocalStore(db);
  return {
    store,
    persistent,
    exec: new ExecuteLocalCommand({ store, context, newChangeId: uuidv7 }),
    sync: new SynchronizeWithServer({ store, api: syncApi, context }),
  };
});

const snapshot = async (): Promise<LocalSnapshot> => {
  const { store, persistent } = await app;
  return store.transaction(async (tx) => ({
    tasks: await new ListTasks({ repository: tx.tasks }).execute({ ownerId: context.ownerId }),
    pending: await tx.outbox.count(),
    persistent,
  }));
};

const run = async (command: TaskCommand) => {
  const result = await (await app).exec.execute(command);
  return { error: result.ok ? null : result.error.type };
};

const handle = async (request: WorkerRequest): Promise<unknown> => {
  switch (request.type) {
    case "init":
    case "listTasks":
      return snapshot();
    case "createTask":
      return run({ type: "CreateTask", id: uuidv7(), title: request.title });
    case "changeStatus":
      return run({ type: "ChangeTaskStatus", id: request.id, action: request.action });
    case "sync":
      return (await app).sync.execute();
  }
};

scope.onmessage = (e) => {
  const { id, request } = e.data;
  handle(request).then(
    (value) => scope.postMessage({ id, ok: true, value } satisfies WorkerMessage),
    (error: unknown) =>
      scope.postMessage({ id, ok: false, error: String(error) } satisfies WorkerMessage),
  );
};
