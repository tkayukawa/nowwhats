import { useState } from "react";
import { isOpen, matchesDueFilter, type DueFilter } from "./task-view.ts";
import { useLocalTasks } from "./local/use-local-tasks.ts";
import { AppShell, type View } from "./ui/app-shell.tsx";
import { CaptureForm } from "./ui/capture-form.tsx";
import { DueFilters } from "./ui/due-filters.tsx";
import { ComingSoon, RejectionNotice, StorageWarning } from "./ui/notices.tsx";
import { SyncBadge } from "./ui/sync-badge.tsx";
import { TaskList } from "./ui/task-list.tsx";

export const App = () => {
  const { state, createTask, changeStatus, dismissRejections } = useLocalTasks();
  const [view, setView] = useState<View>("tasks");
  const [filter, setFilter] = useState<DueFilter>("all");
  const [actionError, setActionError] = useState<string | null>(null);
  const today = new Date();

  return (
    <AppShell
      view={view}
      onNavigate={setView}
      openTaskCount={state.tasks.filter((t) => isOpen(t.status)).length}
      status={<SyncBadge state={state} />}
    >
      {!state.persistent && <StorageWarning />}
      {state.rejections.length > 0 && (
        <RejectionNotice rejections={state.rejections} onDismiss={dismissRejections} />
      )}

      {view === "tasks" && (
        <>
          <CaptureForm disabled={!state.ready} onSubmit={createTask} />
          {actionError !== null && (
            <p role="alert" className="text-sm text-danger">
              {actionError}
            </p>
          )}
          <DueFilters tasks={state.tasks} today={today} value={filter} onChange={setFilter} />
          <TaskList
            tasks={state.tasks.filter((t) => matchesDueFilter(t, filter, today))}
            today={today}
            onAction={(id, action) => void changeStatus(id, action).then(setActionError)}
          />
        </>
      )}
      {view === "insights" && (
        <ComingSoon title="実績">
          完了したポイントの推移や活動カレンダーなど、進捗と成果を振り返れるようにする予定です。
        </ComingSoon>
      )}
      {view === "settings" && (
        <ComingSoon title="設定">
          表示やアカウント、データの管理などの設定をここに置く予定です。
        </ComingSoon>
      )}
    </AppShell>
  );
};
