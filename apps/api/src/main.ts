import { randomUUID } from "node:crypto";
import { serve } from "@hono/node-server";
import {
  InMemoryProcessedChangeStore,
  InMemoryTaskRepository,
} from "@nowwhats/infrastructure-server";
import { createApp } from "./app.ts";
import { createDevOwnerResolver } from "./dev-owner-resolver.ts";

// Composition Root: ここでだけ具体的な実装（Adapter）を組み立てる
const repository = new InMemoryTaskRepository();
const app = createApp({
  repository,
  changeFeed: repository,
  processedChanges: new InMemoryProcessedChangeStore(),
  // メモリ実装は再起動でデータが消えるため、起動ごとに epoch を変えてクライアントに取り込み直させる
  changeLogEpoch: randomUUID(),
  clock: { now: () => new Date() },
  resolveOwner: createDevOwnerResolver(),
});

const port = Number(process.env["PORT"] ?? 8787);
// 開発時はローカルからのみ接続を受け付ける
const hostname = process.env["HOST"] ?? "127.0.0.1";

serve({ fetch: app.fetch, port, hostname }, (info) => {
  console.log(`api listening on http://${hostname}:${info.port}`);
});
