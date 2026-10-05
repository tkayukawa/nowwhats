import { zValidator } from "@hono/zod-validator";
import type { OwnerId } from "@nowwhats/shared-kernel";
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
  readonly clock: Clock;
  readonly resolveOwner: OwnerResolver;
}

const createTaskBody = z.object({
  id: z.string(),
  title: z.string(),
  priority: z.enum(PRIORITIES).optional(),
  dueDate: z.iso.datetime({ offset: true }).nullable().optional(),
});

const changeStatusBody = z.object({
  action: z.enum(["start", "complete", "cancel", "reopen"]),
});

/** Composition Root から依存を受け取り、HTTP の入口を組み立てる。 */
export const createApp = (deps: AppDeps) => {
  const createTask = new CreateTask(deps);
  const changeTaskStatus = new ChangeTaskStatus(deps);
  const listTasks = new ListTasks(deps);

  return new Hono<{ Variables: { ownerId: OwnerId } }>()
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
    });
};

/** Hono RPC クライアント（apps/web）が参照する API の型（ADR 0005） */
export type AppType = ReturnType<typeof createApp>;
