import type { AppType } from "@nowwhats/api/app";
import type { CleanupProposal } from "@nowwhats/capture";
import { TagName, type TagDto, type TaskDto } from "@nowwhats/task-management";
import { hc } from "hono/client";
import { dueDateFromInput } from "../task-view.ts";
import type { TaskEdits } from "./protocol.ts";

const api = hc<AppType>("/");

/** ISO 文字列を、端末のタイムゾーンの YYYY-MM-DD にする */
export const toLocalDate = (iso: string | Date): string => {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export type CleanupFailure = "quota" | "failed" | "offline";

/**
 * AI 清書を API に依頼する（ADR 0008）。送るのはこのタスクの内容と、既存のタグの名前・今日の日付だけ。
 */
export const requestCleanup = async (
  task: TaskDto,
  tags: readonly TagDto[],
  now: Date,
): Promise<{ ok: true; proposal: CleanupProposal } | { ok: false; reason: CleanupFailure }> => {
  if (!navigator.onLine) return { ok: false, reason: "offline" };
  try {
    const res = await api.api.ai.cleanup.$post({
      json: {
        task: {
          title: task.title,
          description: task.description,
          dueDate: task.dueDate === null ? null : toLocalDate(task.dueDate),
          priority: task.priority,
          storyPoints: task.storyPoints,
          tagNames: tags.filter((t) => task.tagIds.includes(t.id)).map((t) => t.name),
        },
        existingTagNames: tags.map((t) => t.name),
        today: toLocalDate(now),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    });
    if (res.status === 429) return { ok: false, reason: "quota" };
    if (!res.ok) return { ok: false, reason: "failed" };
    const body = await res.json();
    return { ok: true, proposal: body.proposal };
  } catch {
    // 通信に失敗した（オフラインになった等）
    return { ok: false, reason: "offline" };
  }
};

/** 清書の結果のタグ名を ID に変える。既存にない名前は createTag で作る */
export const resolveTagNames = async (
  names: readonly string[],
  tags: readonly TagDto[],
  createTag: (name: string) => Promise<{ id: string | null; error: string | null }>,
): Promise<string[]> => {
  const ids: string[] = [];
  for (const name of names) {
    const existing = tags.find((t) => TagName.normalize(t.name) === TagName.normalize(name));
    const id = existing?.id ?? (await createTag(name)).id;
    if (id !== null && !ids.includes(id)) ids.push(id);
  }
  return ids;
};

/** 清書の結果を、EditTask で反映する変更に変える */
export const proposalToEdits = (proposal: CleanupProposal, tagIds: string[]): TaskEdits => ({
  title: proposal.title,
  description: proposal.description,
  priority: proposal.priority,
  storyPoints: proposal.storyPoints,
  dueDate: proposal.dueDate === null ? null : dueDateFromInput(proposal.dueDate),
  tagIds,
});

/** 「元に戻す」で使う、清書前の値 */
export const snapshotEdits = (task: TaskDto): TaskEdits => ({
  title: task.title,
  description: task.description,
  priority: task.priority,
  storyPoints: task.storyPoints,
  dueDate: task.dueDate,
  tagIds: [...task.tagIds],
});

const PENDING_KEY = "nowwhats:pending-cleanups";

/** オフライン中に予約した清書（タスク ID）。端末内にだけ保存する */
export const pendingCleanups = {
  list(): string[] {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(PENDING_KEY) ?? "[]");
      return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
    } catch {
      return [];
    }
  },
  save(ids: readonly string[]): void {
    try {
      localStorage.setItem(PENDING_KEY, JSON.stringify(ids));
    } catch {
      // 保存できない環境では予約を残さない
    }
  },
  add(id: string): void {
    pendingCleanups.save([...pendingCleanups.list().filter((x) => x !== id), id]);
  },
  remove(id: string): void {
    pendingCleanups.save(pendingCleanups.list().filter((x) => x !== id));
  },
};
