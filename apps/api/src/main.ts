import { randomUUID } from "node:crypto";
import { serve } from "@hono/node-server";
import {
  FakeTaskCleaner,
  InMemoryChangeLog,
  InMemoryCleanupQuota,
  InMemoryProcessedChangeStore,
  InMemoryTagRepository,
  InMemoryTaskRepository,
  VertexTaskCleaner,
} from "@nowwhats/infrastructure-server";
import { createApp } from "./app.ts";
import { createDevOwnerResolver } from "./dev-owner-resolver.ts";

// Composition Root: ここでだけ具体的な実装（Adapter）を組み立てる
// AI 清書: Vertex AI のプロジェクト ID があるときだけ本物を使い、なければ偽の実装（ADR 0008）
const vertexProjectId = process.env["NOWWHATS_VERTEX_PROJECT_ID"];
const cleaner =
  vertexProjectId === undefined || vertexProjectId === ""
    ? new FakeTaskCleaner()
    : new VertexTaskCleaner({
        projectId: vertexProjectId,
        region: process.env["NOWWHATS_VERTEX_REGION"] ?? "global",
      });
console.log(`ai cleanup: ${cleaner instanceof FakeTaskCleaner ? "fake" : "vertex ai"}`);

const changeLog = new InMemoryChangeLog();
const app = createApp({
  repository: new InMemoryTaskRepository(changeLog),
  tags: new InMemoryTagRepository(changeLog),
  changeFeed: changeLog,
  processedChanges: new InMemoryProcessedChangeStore(),
  // メモリ実装は再起動でデータが消えるため、起動ごとに epoch を変えてクライアントに取り込み直させる
  changeLogEpoch: randomUUID(),
  clock: { now: () => new Date() },
  resolveOwner: createDevOwnerResolver(),
  cleaner,
  cleanupQuota: new InMemoryCleanupQuota(),
});

const port = Number(process.env["PORT"] ?? 8787);
// 開発時はローカルからのみ接続を受け付ける
const hostname = process.env["HOST"] ?? "127.0.0.1";

serve({ fetch: app.fetch, port, hostname }, (info) => {
  console.log(`api listening on http://${hostname}:${info.port}`);
});
