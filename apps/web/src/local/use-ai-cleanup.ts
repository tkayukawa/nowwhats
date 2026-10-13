import { useCallback, useEffect, useRef, useState } from "react";
import {
  pendingCleanups,
  proposalToEdits,
  requestCleanup,
  resolveTagNames,
  snapshotEdits,
  type CleanupFailure,
} from "./ai-cleanup.ts";
import type { LocalSnapshot, TaskEdits } from "./protocol.ts";

const UNDO_MS = 8_000;

const FAILURE_MESSAGE: Record<CleanupFailure, string> = {
  quota: "今日の AI 清書の上限（50 回）に達しました。明日またお試しください",
  failed: "AI で清書できませんでした。時間をおいてお試しください",
  offline: "オフラインのため、オンラインに戻ったら AI で清書します",
};

export interface UndoState {
  readonly taskId: string;
  readonly title: string;
  readonly previous: TaskEdits;
}

interface Deps {
  /**
   * ローカル DB から最新のタスクとタグを読む。登録した直後のタスクはまだ画面の状態に
   * 反映されていないため、清書の対象は必ずここから取る
   */
  readonly load: () => Promise<LocalSnapshot>;
  readonly online: boolean;
  readonly synced: boolean;
  readonly editTask: (id: string, changes: TaskEdits) => Promise<string | null>;
  readonly createTag: (name: string) => Promise<{ id: string | null; error: string | null }>;
}

/**
 * AI 清書（ADR 0008）。結果で自動的に書き換え、8 秒間「元に戻す」を出す。
 * オフライン中は予約だけ記録し、オンラインに戻って同期できたら実行する。
 */
export const useAiCleanup = ({ load, online, synced, editTask, createTag }: Deps) => {
  const [running, setRunning] = useState<string | null>(null);
  const [undo, setUndo] = useState<UndoState | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const undoTimer = useRef<number | undefined>(undefined);

  const cleanUp = useCallback(
    async (taskId: string, { queueIfOffline = true } = {}): Promise<void> => {
      const { tasks, tags } = await load();
      const task = tasks.find((t) => t.id === taskId);
      if (task === undefined) {
        pendingCleanups.remove(taskId);
        setMessage("清書するタスクが見つかりませんでした");
        return;
      }
      setRunning(taskId);
      setMessage(null);
      const result = await requestCleanup(task, tags, new Date());
      if (!result.ok) {
        setRunning(null);
        if (result.reason === "offline" && queueIfOffline) pendingCleanups.add(taskId);
        // 上限・拒否などの失敗は自動では再実行しない
        if (result.reason !== "offline") pendingCleanups.remove(taskId);
        if (result.reason !== "offline" || queueIfOffline)
          setMessage(FAILURE_MESSAGE[result.reason]);
        return;
      }
      pendingCleanups.remove(taskId);
      const tagIds = await resolveTagNames(result.proposal.tagNames, tags, createTag);
      const failure = await editTask(taskId, proposalToEdits(result.proposal, tagIds));
      setRunning(null);
      if (failure !== null) {
        setMessage(failure);
        return;
      }
      window.clearTimeout(undoTimer.current);
      setUndo({ taskId, title: result.proposal.title, previous: snapshotEdits(task) });
      undoTimer.current = window.setTimeout(() => setUndo(null), UNDO_MS);
    },
    [load, createTag, editTask],
  );

  const undoCleanup = async () => {
    if (undo === null) return;
    window.clearTimeout(undoTimer.current);
    setUndo(null);
    setMessage(await editTask(undo.taskId, undo.previous));
  };

  // オンラインで同期できたら、予約した清書を順に実行する。
  // 通信に失敗し続けても繰り返さないよう、オンラインになるたびに各予約を 1 回だけ試す
  const tried = useRef(new Set<string>());
  useEffect(() => {
    if (!online) tried.current.clear();
  }, [online]);
  useEffect(() => {
    if (!online || !synced || running !== null) return;
    const next = pendingCleanups.list().find((id) => !tried.current.has(id));
    if (next === undefined) return;
    tried.current.add(next);
    void cleanUp(next, { queueIfOffline: false });
  }, [online, synced, running, cleanUp]);

  useEffect(() => () => window.clearTimeout(undoTimer.current), []);

  return {
    running,
    undo,
    message,
    cleanUp,
    undoCleanup,
    dismissMessage: () => setMessage(null),
  };
};
