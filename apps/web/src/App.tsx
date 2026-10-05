import { availableActions, type TaskAction } from "@nowwhats/task-management";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, type TaskView } from "./api-client.ts";
import { errorMessage } from "./error-message.ts";
import { uuidv7 } from "./uuidv7.ts";

const ACTION_LABEL: Record<TaskAction, string> = {
  start: "着手",
  complete: "完了",
  cancel: "中止",
  reopen: "再開",
};

const STATUS_LABEL: Record<TaskView["status"], string> = {
  todo: "未着手",
  doing: "進行中",
  done: "完了",
  canceled: "中止",
};

export const App = () => {
  const [tasks, setTasks] = useState<TaskView[]>([]);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const res = await api.api.tasks.$get();
    if (res.ok) {
      setTasks((await res.json()).tasks);
    } else {
      setError(errorMessage(await res.json()));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const res = await api.api.tasks.$post({ json: { id: uuidv7(), title } });
    if (!res.ok) {
      setError(errorMessage(await res.json()));
      return;
    }
    setTitle("");
    await reload();
  };

  const handleAction = async (id: string, action: TaskAction) => {
    setError(null);
    const res = await api.api.tasks[":id"].status.$post({ param: { id }, json: { action } });
    if (!res.ok) {
      setError(errorMessage(await res.json()));
    }
    await reload();
  };

  return (
    <main className="app">
      <h1>nowwhats</h1>
      <form className="capture" onSubmit={(e) => void handleSubmit(e)}>
        <input
          aria-label="タスクのタイトル"
          placeholder="やること・やりたいこと"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />
        <button type="submit">登録</button>
      </form>
      {error !== null && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <ul className="tasks">
        {tasks.map((task) => (
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
