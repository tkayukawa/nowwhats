import { syncLabel } from "../labels.ts";
import type { LocalTasksState } from "../local/use-local-tasks.ts";

export const SyncBadge = ({ state }: { readonly state: LocalTasksState }) => {
  const dot = !state.online
    ? "bg-warn"
    : state.syncStatus === "syncing"
      ? "bg-accent animate-pulse motion-reduce:animate-none"
      : state.syncStatus === "failed"
        ? "bg-danger"
        : "bg-ok";
  return (
    <span
      role="status"
      className="inline-flex items-center gap-1.5 rounded-full border border-faint bg-surface px-2.5 py-1 text-xs whitespace-nowrap text-muted"
    >
      <span className={`size-[7px] rounded-full ${dot}`} aria-hidden="true" />
      {state.ready ? syncLabel(state) : "読み込み中…"}
    </span>
  );
};
