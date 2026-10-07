import type { TagDto, TaskAction, TaskDto } from "@nowwhats/task-management";
import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "../error-message.ts";
import { LocalClient } from "./local-client.ts";
import type { NewTask, RejectedChange, TaskEdits } from "./protocol.ts";

const SYNC_INTERVAL_MS = 30_000;
const SYNC_DEBOUNCE_MS = 300;

export type SyncStatus = "idle" | "syncing" | "synced" | "failed";

export interface LocalTasksState {
  readonly ready: boolean;
  readonly tasks: TaskDto[];
  readonly tags: TagDto[];
  readonly pending: number;
  readonly persistent: boolean;
  readonly online: boolean;
  readonly syncStatus: SyncStatus;
  readonly rejections: RejectedChange[];
}

/**
 * ローカル DB（Worker）を使ったタスク操作と、自動同期を提供する。
 * 同期の契機: 起動時・オンライン復帰時・操作の直後・30 秒ごと。
 */
export const useLocalTasks = () => {
  const client = useRef<LocalClient | null>(null);
  const [state, setState] = useState<LocalTasksState>({
    ready: false,
    tasks: [],
    tags: [],
    pending: 0,
    persistent: true,
    online: navigator.onLine,
    syncStatus: "idle",
    rejections: [],
  });
  const syncTimer = useRef<number | undefined>(undefined);

  const getClient = () => (client.current ??= new LocalClient());

  const refresh = useCallback(async () => {
    const snapshot = await getClient().request({ type: "listTasks" });
    setState((s) => ({ ...s, ...snapshot, ready: true }));
  }, []);

  const sync = useCallback(async () => {
    if (!navigator.onLine) return;
    setState((s) => ({ ...s, syncStatus: "syncing" }));
    try {
      const report = await getClient().request({ type: "sync" });
      setState((s) => ({
        ...s,
        syncStatus: "synced",
        rejections: [...s.rejections, ...report.rejected],
      }));
    } catch {
      // 通信失敗。未送信の変更は Outbox に残り、次の契機で再送される
      setState((s) => ({ ...s, syncStatus: "failed" }));
    }
    await refresh();
  }, [refresh]);

  const scheduleSync = useCallback(() => {
    window.clearTimeout(syncTimer.current);
    syncTimer.current = window.setTimeout(() => void sync(), SYNC_DEBOUNCE_MS);
  }, [sync]);

  useEffect(() => {
    void refresh().then(sync);
    const onOnline = () => {
      setState((s) => ({ ...s, online: true }));
      scheduleSync();
    };
    const onOffline = () => setState((s) => ({ ...s, online: false }));
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const interval = window.setInterval(() => void sync(), SYNC_INTERVAL_MS);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.clearInterval(interval);
      window.clearTimeout(syncTimer.current);
    };
  }, [refresh, sync, scheduleSync]);

  /** 失敗時は利用者向けのエラー文言を返す */
  const createTask = async (task: NewTask): Promise<string | null> => {
    const { error } = await getClient().request({ type: "createTask", task });
    await refresh();
    if (error !== null) return errorMessage(error);
    scheduleSync();
    return null;
  };

  const changeStatus = async (id: string, action: TaskAction): Promise<string | null> => {
    const { error } = await getClient().request({ type: "changeStatus", id, action });
    await refresh();
    if (error !== null) return errorMessage(error);
    scheduleSync();
    return null;
  };

  const editTask = async (id: string, changes: TaskEdits): Promise<string | null> => {
    const { error } = await getClient().request({ type: "editTask", id, changes });
    await refresh();
    if (error !== null) return errorMessage(error);
    scheduleSync();
    return null;
  };

  /** 操作を実行して一覧を更新し、成功したら同期を予約する。失敗時は利用者向けの文言を返す */
  const perform = async (
    request: Parameters<LocalClient["request"]>[0],
  ): Promise<string | null> => {
    const { error } = (await getClient().request(request)) as { error: string | null };
    await refresh();
    if (error !== null) return errorMessage(error);
    scheduleSync();
    return null;
  };

  /** タグを作る。成功したら新しいタグの ID を返す */
  const createTag = async (name: string): Promise<{ id: string | null; error: string | null }> => {
    const result = await getClient().request({ type: "createTag", name });
    await refresh();
    if (result.error !== null) return { id: null, error: errorMessage(result.error) };
    scheduleSync();
    return { id: result.id, error: null };
  };
  const renameTag = (id: string, name: string) => perform({ type: "renameTag", id, name });
  const recolorTag = (id: string, color: string) => perform({ type: "recolorTag", id, color });
  const deleteTag = (id: string) => perform({ type: "deleteTag", id });

  const dismissRejections = () => setState((s) => ({ ...s, rejections: [] }));

  return {
    state,
    createTask,
    changeStatus,
    editTask,
    createTag,
    renameTag,
    recolorTag,
    deleteTag,
    dismissRejections,
  };
};
