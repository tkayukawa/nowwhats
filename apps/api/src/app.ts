import { zValidator } from "@hono/zod-validator";
import type { OwnerId } from "@nowwhats/shared-kernel";
import {
  ApplyPushedChanges,
  PULL_LIMIT_MAX,
  PullChanges,
  type ProcessedChangeStore,
  type TaskChangeFeed,
} from "@nowwhats/sync";
import {
  ChangeTaskStatus,
  CreateTask,
  ListTasks,
  PRIORITIES,
  type Clock,
  type TaskRepository,
} from "@nowwhats/task-management";
import { Hono } from "hono";
import { z } from "zod";
import { toHttpError } from "./http-error.ts";

/** 認証 Port。リクエストヘッダーから利用者を特定し、特定できなければ null を返す。 */
export type OwnerResolver = (headers: Headers) => Promise<OwnerId | null>;

export interface AppDeps {
  readonly repository: TaskRepository;
  readonly changeFeed: TaskChangeFeed;
  readonly processedChanges: ProcessedChangeStore;
  /** 変更ログの識別子（ADR 0006）。メモリ実装では起動ごとに変わる */
  readonly changeLogEpoch: string;
  readonly clock: Clock;
  readonly resolveOwner: OwnerResolver;
}

const createTaskBody = z.object({
  id: z.string(),
  title: z.string(),
  priority: z.enum(PRIORITIES).optional(),
  dueDate: z.iso.datetime({ offset: true }).nullable().optional(),
  // 値の範囲（目盛り）はドメインで検証する
  storyPoints: z.number().int().optional(),
});

const taskAction = z.enum(["start", "complete", "cancel", "reopen"]);

const changeStatusBody = z.object({ action: taskAction });

/** 1 回の push で受け付ける変更の上限 */
export const PUSH_LIMIT_MAX = 100;

const pushBody = z.object({
  changes: z
    .array(
      z.object({
        changeId: z.string().min(1).max(64),
        command: z.discriminatedUnion("type", [
          createTaskBody.extend({ type: z.literal("CreateTask") }),
          z.object({ type: z.literal("ChangeTaskStatus"), id: z.string(), action: taskAction }),
        ]),
      }),
    )
    .max(PUSH_LIMIT_MAX),
});

const pullQuery = z.object({
  cursor: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(PULL_LIMIT_MAX).default(PULL_LIMIT_MAX),
});

/** Composition Root から依存を受け取り、HTTP の入口を組み立てる。 */
export const createApp = (deps: AppDeps) => {
  const createTask = new CreateTask(deps);
  const changeTaskStatus = new ChangeTaskStatus(deps);
  const listTasks = new ListTasks(deps);
  const applyPushedChanges = new ApplyPushedChanges({
    createTask,
    changeTaskStatus,
    processedChanges: deps.processedChanges,
  });
  const pullChanges = new PullChanges({ feed: deps.changeFeed, epoch: deps.changeLogEpoch });

  return (
    new Hono<{ Variables: { ownerId: OwnerId } }>()
      .basePath("/api")
      .use(async (c, next) => {
        const ownerId = await deps.resolveOwner(c.req.raw.headers);
        if (ownerId === null) {
          return c.json({ error: { type: "Unauthorized" } }, 401);
        }
        c.set("ownerId", ownerId);
        await next();
      })
      .get("/tasks", async (c) => {
        const tasks = await listTasks.execute({ ownerId: c.get("ownerId") });
        return c.json({ tasks }, 200);
      })
      .post("/tasks", zValidator("json", createTaskBody), async (c) => {
        const body = c.req.valid("json");
        const result = await createTask.execute({
          ownerId: c.get("ownerId"),
          id: body.id,
          title: body.title,
          ...(body.priority !== undefined && { priority: body.priority }),
          ...(body.dueDate !== undefined && {
            dueDate: body.dueDate === null ? null : new Date(body.dueDate),
          }),
          ...(body.storyPoints !== undefined && { storyPoints: body.storyPoints }),
        });
        if (!result.ok) {
          const { status, body: errorBody } = toHttpError(result.error);
          return c.json(errorBody, status);
        }
        return c.json({ task: result.value }, 201);
      })
      .post("/tasks/:id/status", zValidator("json", changeStatusBody), async (c) => {
        const result = await changeTaskStatus.execute({
          ownerId: c.get("ownerId"),
          id: c.req.param("id"),
          action: c.req.valid("json").action,
        });
        if (!result.ok) {
          const { status, body: errorBody } = toHttpError(result.error);
          return c.json(errorBody, status);
        }
        return c.json({ task: result.value }, 200);
      })
      // 同期（ADR 0002 / 0006）。ドメインのルールに反する変更も 200 で返し、結果の中で rejected とする
      .post("/sync/push", zValidator("json", pushBody), async (c) => {
        const results = await applyPushedChanges.execute({
          ownerId: c.get("ownerId"),
          changes: c.req.valid("json").changes,
        });
        return c.json({ results }, 200);
      })
      .get("/sync/pull", zValidator("query", pullQuery), async (c) => {
        const { cursor, limit } = c.req.valid("query");
        const result = await pullChanges.execute({ ownerId: c.get("ownerId"), cursor, limit });
        return c.json(result, 200);
      })
  );
};

/** Hono RPC クライアント（apps/web）が参照する API の型（ADR 0005） */
export type AppType = ReturnType<typeof createApp>;
