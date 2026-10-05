import { availableActions, type TaskAction } from "@nowwhats/task-management";
import { useState, type FormEvent } from "react";
import { ACTION_LABEL, rejectionLabel, STATUS_LABEL, syncLabel } from "./labels.ts";
import { useLocalTasks } from "./local/use-local-tasks.ts";

export const App = () => {
  const { state, createTask, changeStatus, dismissRejections } = useLocalTasks();
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const failure = await createTask(title);
    setError(failure);
    if (failure === null) setTitle("");
  };

  const handleAction = async (id: string, action: TaskAction) => {
    setError(await changeStatus(id, action));
  };

  return (
    <main className="app">
      <header className="header">
        <h1>nowwhats</h1>
        <span className="sync-status" role="status">
          {state.ready ? syncLabel(state) : "読み込み中…"}
        </span>
      </header>
      {!state.persistent && (
        <p role="alert" className="error">
          このブラウザでは端末内への保存ができないため、再読み込みすると未送信の変更が失われます。
        </p>
      )}
      {state.rejections.length > 0 && (
        <div role="alert" className="notice">
          <ul>
            {state.rejections.map((r) => (
              <li key={r.change.changeId}>{rejectionLabel(r)}</li>
            ))}
          </ul>
          <button type="button" onClick={dismissRejections}>
            閉じる
          </button>
        </div>
      )}
      <form className="capture" onSubmit={(e) => void handleSubmit(e)}>
        <input
          aria-label="タスクのタイトル"
          placeholder="やること・やりたいこと"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />
        <button type="submit" disabled={!state.ready}>
          登録
        </button>
      </form>
      {error !== null && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <ul className="tasks">
        {state.tasks.map((task) => (
          <li key={task.id} className={`task task--${task.status}`}>
            <span className="task__title">{task.title}</span>
            <span className="task__status">{STATUS_LABEL[task.status]}</span>
            <span className="task__actions">
              {availableActions(task.status).map((action) => (
                <button
                  key={action}
                  type="button"
                  onClick={() => void handleAction(task.id, action)}
                >
                  {ACTION_LABEL[action]}
                </button>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
};
