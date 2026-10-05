import type { AppType } from "@nowwhats/api/app";
import { hc, type InferResponseType } from "hono/client";

/** Hono RPC クライアント。API のルート定義から型が導出される（ADR 0005）。 */
export const api = hc<AppType>("/");

export type TaskView = InferResponseType<typeof api.api.tasks.$get, 200>["tasks"][number];
