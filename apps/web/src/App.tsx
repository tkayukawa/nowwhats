import { useState } from "react";
import { isOpen, matchesDueFilter, type DueFilter } from "./task-view.ts";
import { useAiCleanup } from "./local/use-ai-cleanup.ts";
import { useLocalTasks } from "./local/use-local-tasks.ts";
import { AppShell, type View } from "./ui/app-shell.tsx";
import { CaptureForm } from "./ui/capture-form.tsx";
import { DueFilters } from "./ui/due-filters.tsx";
import { InsightsView } from "./ui/insights/insights-view.tsx";
import { RejectionNotice, StorageWarning } from "./ui/notices.tsx";
import { SettingsView } from "./ui/settings-view.tsx";
import { TagFilter } from "./ui/tag-filter.tsx";
import { SyncBadge } from "./ui/sync-badge.tsx";
import { TaskDetail } from "./ui/task-detail.tsx";
import { TaskList } from "./ui/task-list.tsx";
import { Toast } from "./ui/toast.tsx";

export const App = () => {
  const {
    state,
    load,
    createTask,
    changeStatus,
    editTask,
    createTag,
    renameTag,
    recolorTag,
    deleteTag,
    dismissRejections,
  } = useLocalTasks();
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const ai = useAiCleanup({
    load,
    online: state.online,
    synced: state.syncStatus === "synced",
    editTask,
    createTag,
  });
  /** 登録する。「AI で清書して登録」のときは、登録してから清書する（ADR 0008） */
  const handleCreate = async (
    task: Parameters<typeof createTask>[0],
    { withCleanup }: { readonly withCleanup: boolean },
  ): Promise<string | null> => {
    const { id, error } = await createTask(task);
    if (error === null && id !== null && withCleanup) void ai.cleanUp(id);
    return error;
  };
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<View>("tasks");
  const [filter, setFilter] = useState<DueFilter>("all");
  const [actionError, setActionError] = useState<string | null>(null);
  const today = new Date();
  // 同期で消えたタスクを開いていた場合は、パネルを閉じる
  const selected = state.tasks.find((t) => t.id === selectedId) ?? null;
  // タグを作ったときのエラーは、操作のエラーと同じ場所に表示する
  const handleCreateTag = async (name: string): Promise<string | null> => {
    const { id, error } = await createTag(name);
    setActionError(error);
    return id;
  };
  // 絞り込み中のタグが削除されたら、絞り込みを解除する
  const activeTagFilter = state.tags.some((t) => t.id === tagFilter) ? tagFilter : null;
  const handleAction = (id: string, action: Parameters<typeof changeStatus>[1]) =>
    void changeStatus(id, action).then(setActionError);

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
          <CaptureForm
            disabled={!state.ready}
            tags={state.tags}
            onCreateTag={handleCreateTag}
            onSubmit={handleCreate}
          />
          {actionError !== null && (
            <p role="alert" className="text-sm text-danger">
              {actionError}
            </p>
          )}
          <DueFilters tasks={state.tasks} today={today} value={filter} onChange={setFilter} />
          <TagFilter
            tasks={state.tasks}
            tags={state.tags}
            value={activeTagFilter}
            onChange={setTagFilter}
          />
          <TaskList
            tasks={state.tasks.filter(
              (t) =>
                matchesDueFilter(t, filter, today) &&
                (activeTagFilter === null || t.tagIds.includes(activeTagFilter)),
            )}
            tags={state.tags}
            today={today}
            selectedId={selectedId}
            onAction={handleAction}
            onOpen={setSelectedId}
          />
          {selected !== null && (
            <TaskDetail
              task={selected}
              tags={state.tags}
              today={today}
              onCreateTag={handleCreateTag}
              onEdit={(changes) => editTask(selected.id, changes)}
              onAction={(action) => handleAction(selected.id, action)}
              onClose={() => setSelectedId(null)}
              onCleanup={() => void ai.cleanUp(selected.id)}
              cleaning={ai.running === selected.id}
              online={state.online}
            />
          )}
        </>
      )}
      {view === "insights" && <InsightsView tasks={state.tasks} tags={state.tags} today={today} />}
      {view === "settings" && (
        <SettingsView
          tags={state.tags}
          tasks={state.tasks}
          onRename={renameTag}
          onRecolor={recolorTag}
          onDelete={deleteTag}
        />
      )}
      {ai.undo !== null ? (
        <Toast action={{ label: "元に戻す", onClick: () => void ai.undoCleanup() }}>
          AI で清書しました:「{ai.undo.title}」
        </Toast>
      ) : ai.message !== null ? (
        <Toast onDismiss={ai.dismissMessage}>{ai.message}</Toast>
      ) : null}
    </AppShell>
  );
};
